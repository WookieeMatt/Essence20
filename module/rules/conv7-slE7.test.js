import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * slE7: items of the qualify slices converted with the round-7 engine pieces (item:hasAttack,
 * self:wearingItem, the sessionStart Trigger, to: partyActor). Each is loaded from its pack source and
 * must do what the removed slice code did.
 */

const { rebuildIndex } = await import('./index.mjs');
const { ruleRequisitionAccess, ruleRollSources } = await import('./adapter.mjs');
const { fireTriggers } = await import('./triggers.mjs');
const { runSteps, setStoryPointHelpers, stepContext } = await import('./steps.mjs');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));

let nextId = 1;

function setPath(object, key, value) {
  const keys = key.split('.');
  const last = keys.pop();
  keys.reduce((o, k) => (o[k] ??= {}), object)[last] = value;
}

function makeActor({ name = 'Hero', type = 'playerCharacter', system = {}, items = [] } = {}) {
  const actor = {
    id: `a${nextId++}`, name, type, isOwner: true, statuses: new Set(), flags: { essence20: {} },
    system: { level: 5, health: { value: 3, max: 10 }, skills: {}, ...system },
    effects: { contents: [] },
    update: jest.fn(async function (data) {
      for (const [key, value] of Object.entries(data)) {
        setPath(this, key, value);
      }
    }),
    getActiveTokens: () => [],
    getFlag: (scope, key) => `${scope}.${key}`.split('.').reduce((at, part) => at?.[part], actor.flags),
    setFlag: async (scope, key, value) => setPath(actor.flags, `${scope}.${key}`, value),
  };
  actor.uuid = `Actor.${actor.id}`;
  const list = [...items];
  actor.items = { contents: list, get: id => list.find(i => i.id == id), [Symbol.iterator]: () => list[Symbol.iterator]() };
  for (const item of list) {
    item.parent = actor;
  }

  rebuildIndex(actor);
  return actor;
}

/** An owned copy of a pack item (its book source set, as a dropped copy has). */
function packItem(file, extra = {}) {
  const doc = fromPack(file);
  return {
    id: extra.id ?? `i${nextId++}`, name: doc.name, type: doc.type,
    flags: { core: { sourceId: `Compendium.essence20.x.Item.${doc._id}` }, ...(extra.flags ?? {}) },
    system: { ...doc.system, ...(extra.system ?? {}) },
  };
}

const plain = (type, extra = {}) => ({ id: extra.id ?? `i${nextId++}`, name: extra.name ?? type, type, flags: extra.flags ?? {}, system: extra.system ?? {} });

let posted;
beforeEach(() => {
  posted = [];
  global.game = {
    combat: null, user: { id: 'u', isGM: true, targets: new Set() }, users: { activeGM: null }, settings: { get: () => 1 },
    actors: { contents: [] },
    i18n: { localize: k => k, format: k => k },
  };
  global.ChatMessage = { create: jest.fn(async data => posted.push(data.content)), getSpeaker: () => ({}) };
  global.ui = { notifications: { warn: jest.fn() } };
  global.foundry = {
    ...(global.foundry ?? {}),
    utils: { ...(global.foundry?.utils ?? {}), setProperty: setPath, getProperty: (o, k) => k.split('.').reduce((at, key) => at?.[key], o) },
  };
});

/* -------------------------------------------- */
/*  Hardware Training (qualify2)                 */
/* -------------------------------------------- */

const HARDWARE = 'eocitems/_source/Hardware_Training_6Ov5odRU8tGhQJzu.json';

describe('Hardware Training', () => {
  const gun = (availability, numHands, traits = ['ballistic']) => plain('weapon', {
    system: { availability, traits, items: { a: { type: 'weaponEffect', numHands } } },
  });

  test('Qualified in Restricted (or lower) two-handed Ballistic weapons', () => {
    const actor = makeActor({ items: [packItem(HARDWARE)] });
    expect(ruleRequisitionAccess(actor, gun('restricted', 2))).toBe('qualified');
    expect(ruleRequisitionAccess(actor, gun('restricted', '2'))).toBe('qualified');
    expect(ruleRequisitionAccess(actor, gun('limited', 2))).toBe('qualified');
    expect(ruleRequisitionAccess(actor, gun(undefined, 2))).toBe('qualified');
    expect(ruleRequisitionAccess(actor, gun('restricted', 1))).toBeNull();
    expect(ruleRequisitionAccess(actor, gun('restricted', undefined))).toBeNull();
    expect(ruleRequisitionAccess(actor, gun('prototype', 2))).toBeNull();
    expect(ruleRequisitionAccess(actor, gun('restricted', 2, ['energy']))).toBeNull();
    expect(ruleRequisitionAccess(makeActor(), gun('restricted', 2))).toBeNull();
  });

  test('an owned weapon is read through its own attack items', () => {
    const weapon = plain('weapon', { id: 'w1', system: { availability: 'restricted', traits: ['ballistic'], items: { a: { type: 'weaponEffect', numHands: 1 } } } });
    const attack = plain('weaponEffect', { flags: { essence20: { parentId: 'w1' } }, system: { numHands: 2 } });
    makeActor({ items: [weapon, attack] });
    const actor = makeActor({ items: [packItem(HARDWARE)] });
    expect(ruleRequisitionAccess(actor, weapon)).toBe('qualified');
  });

  test('its Use picks a two-handed Ballistic weapon from the compendium, granted as Qualified', async () => {
    const perk = packItem(HARDWARE);
    const actor = makeActor({ items: [perk] });
    const use = perk.system.rules.find(rule => rule.type == 'Use');
    const helpers = {
      findItems: jest.fn(async () => [{ uuid: 'C.big' }]),
      pickOne: jest.fn(async () => 'C.big'),
      grantCopy: jest.fn(async () => ({ name: 'Heavy Rifle' })),
    };
    const ctx = stepContext({ actor, item: perk, rule: use, targets: [] });
    ctx.grantHelpers = helpers;
    await runSteps(use.steps, ctx);
    const filter = helpers.findItems.mock.calls[0][0];
    expect(filter.type).toBe('weapon');
    expect(filter.availabilities).toEqual(['standard', 'limited', 'restricted']);
    const entry = (numHands, traits = ['ballistic']) => ({ type: 'weapon', system: { traits, items: { a: { type: 'weaponEffect', numHands } } } });
    expect(filter.matches(entry(2))).toBe(true);
    expect(filter.matches(entry(1))).toBe(false);
    expect(filter.matches(entry(2, ['energy']))).toBe(false);
    expect(helpers.grantCopy).toHaveBeenCalledWith(actor, 'C.big', expect.objectContaining({ grantedBy: perk, flags: { qualified: true } }));
    expect(ctx.chat.join(' ')).toContain('Heavy Rifle');
  });
});

/* -------------------------------------------- */
/*  Roaming the Land (qualify1)                  */
/* -------------------------------------------- */

const ROAMING = 'fffav1items/_source/Roaming_the_Land_jdQFjlYUHaRze6as.json';

describe('Roaming the Land', () => {
  const blade = (attack, traits) => plain('weapon', { system: { availability: 'restricted', traits, items: { a: { type: 'weaponEffect', ...attack } } } });

  test('Trained in energized close combat weapons (melee or Reach)', () => {
    const actor = makeActor({ items: [packItem(ROAMING)] });
    expect(ruleRequisitionAccess(actor, blade({ classification: { style: 'melee' } }, ['fire']))).toBe('trained');
    expect(ruleRequisitionAccess(actor, blade({ classification: { style: 'ranged' }, range: { reachMultiplier: 1 } }, ['laser']))).toBe('trained');
    expect(ruleRequisitionAccess(actor, blade({ classification: { style: 'melee' } }, ['element']))).toBe('trained');
  });

  test('not a ranged weapon, not without an energy trait, not without the Perk', () => {
    const actor = makeActor({ items: [packItem(ROAMING)] });
    expect(ruleRequisitionAccess(actor, blade({ classification: { style: 'ranged' } }, ['fire']))).toBeNull();
    expect(ruleRequisitionAccess(actor, blade({ classification: { style: 'melee' } }, ['sharp']))).toBeNull();
    expect(ruleRequisitionAccess(makeActor(), blade({ classification: { style: 'melee' } }, ['fire']))).toBeNull();
  });
});

/* -------------------------------------------- */
/*  The Glory of Cobra-La's battledress Snag      */
/* -------------------------------------------- */

const COBRA_LA = 'fffav1items/_source/The_Glory_of_Cobra_La_VAhtHpKlv4gsR0OY.json';
const ORGANIC_ARMOR = 'Compendium.essence20.ferocious_fighters.Item.W6fiSzyPOE2VGj8k';

describe('The Glory of Cobra-La battledress Snag', () => {
  const armorSnag = (vest, extra = [], roll = { rolledSkill: 'alertness' }) => {
    const actor = makeActor({ items: [packItem(COBRA_LA), vest, ...extra] });
    return ruleRollSources(actor, null, roll).sources.some(source => source.snag && /battledress/.test(source.label));
  };

  const vest = (extra = {}) => plain('armor', { id: 'v1', name: extra.name ?? 'Protective Vest', system: { equipped: extra.equipped ?? true } });

  test('a Snag on every Skill Test while wearing battledress that isn\'t Biomechanical', () => {
    expect(armorSnag(vest())).toBe(true);
    expect(armorSnag(vest(), [], { rolledSkill: 'athletics' })).toBe(true);
  });

  test('none with Organic Armor attached (by source or name), a Bio-Mech / Cobra-La name, or unworn', () => {
    const organic = plain('upgrade', { name: 'Organic Armor', flags: { core: { sourceId: ORGANIC_ARMOR }, essence20: { parentId: 'v1' } } });
    expect(armorSnag(vest(), [organic])).toBe(false);
    const renamed = plain('upgrade', { name: 'Living Hide', flags: { core: { sourceId: ORGANIC_ARMOR }, essence20: { parentId: 'v1' } } });
    expect(armorSnag(vest(), [renamed])).toBe(false);
    const named = plain('upgrade', { name: 'Organic Armor', flags: { essence20: { parentId: 'v1' } } });
    expect(armorSnag(vest(), [named])).toBe(false);
    expect(armorSnag(vest({ name: 'Cobra-La Battle Shell' }))).toBe(false);
    expect(armorSnag(vest({ name: 'Bio-Mech Carapace' }))).toBe(false);
    expect(armorSnag(vest({ name: 'Biomech Plates' }))).toBe(false);
    expect(armorSnag(vest({ equipped: false }))).toBe(false);
    const elsewhere = plain('upgrade', { name: 'Organic Armor', flags: { essence20: { parentId: 'other' } } });
    expect(armorSnag(vest(), [elsewhere])).toBe(true);
  });

  test('a worn shield or gear doesn\'t count, and Initiative isn\'t snagged', () => {
    expect(armorSnag(plain('shield', { system: { equipped: true } }))).toBe(false);
    expect(armorSnag(vest(), [], { rolledSkill: 'alertness', dataset: { isInitiative: true } })).toBe(false);
  });
});

/* -------------------------------------------- */
/*  Everything is Inspiration (qualify2)         */
/*  Nobility (qualify1)                          */
/* -------------------------------------------- */

const INSPIRATION = 'wtnvcgitems/_source/Everything_is_Inspiration_c1gIi1A6MKHkOwdy.json';
const NOBILITY = 'fgtaaitems/_source/Nobility_gdWzwO7FpX9QOFQF.json';

describe('session start', () => {
  afterEach(() => setStoryPointHelpers(null));

  test('Everything is Inspiration adds a Story Point for a Player Character holder', async () => {
    const helpers = { requestStoryPointGrant: jest.fn(async () => {}), poolFor: () => 'story', canWriteStoryPoints: () => true };
    setStoryPointHelpers(helpers);
    const hobbyist = makeActor({ name: 'Cecil', items: [packItem(INSPIRATION)] });
    await fireTriggers(hobbyist, 'sessionStart');
    expect(helpers.requestStoryPointGrant).toHaveBeenCalledWith(hobbyist, 1, { pool: 'story' });
    expect(posted.join(' ')).toContain('Cecil');

    helpers.requestStoryPointGrant.mockClear();
    await fireTriggers(makeActor({ type: 'npc', items: [packItem(INSPIRATION)] }), 'sessionStart');
    await fireTriggers(makeActor(), 'sessionStart');
    await fireTriggers(hobbyist, 'sceneStart');
    expect(helpers.requestStoryPointGrant).not.toHaveBeenCalled();
  });

  test('Nobility takes 1 from its Party\'s pool, never below 0', async () => {
    const noble = makeActor({ items: [packItem(NOBILITY)] });
    const other = makeActor({ items: [packItem(NOBILITY)] });
    const party = makeActor({ type: 'party' });
    party.members = [noble, other, makeActor()];
    party.system.storyPoints = 3;
    game.actors = { contents: [noble, other, party], party };
    await fireTriggers(noble, 'sessionStart');
    expect(party.system.storyPoints).toBe(2);
    await fireTriggers(other, 'sessionStart');
    expect(party.system.storyPoints).toBe(1);
    party.system.storyPoints = 0;
    await fireTriggers(noble, 'sessionStart');
    expect(party.system.storyPoints).toBe(0);
  });

  test('Nobility on no Party roster changes no pool; other events do nothing', async () => {
    const party = makeActor({ type: 'party' });
    party.members = [];
    party.system.storyPoints = 3;
    game.actors = { contents: [party], party };
    await fireTriggers(makeActor({ items: [packItem(NOBILITY)] }), 'sessionStart');
    const member = makeActor({ items: [packItem(NOBILITY)] });
    party.members = [member];
    await fireTriggers(member, 'sceneStart');
    expect(party.update).not.toHaveBeenCalled();
    expect(party.system.storyPoints).toBe(3);
  });
});
