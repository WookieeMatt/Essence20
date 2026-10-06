import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * slI12 (docs/rules-batches/slI12.md): the last item-specific code of eight items, moved onto item rules with the
 * round 12 group I pieces (module/rules/ext/i/) - More Bang for your Buck (Temper Tempest's storm), Ladder (its Use and
 * the allies' switch), Weapon Enthusiast (its Use and Qualification), Mystical Understanding (Refocus, Essential
 * Research, Magically Fit In), Brilliant Sight (its darkvision), We Are One! (the team's reroll), Early Adopter (its
 * Requisition DIF) and Detail Oriented (its Finesse Move action). Each item is loaded from its pack source and must do
 * what the removed code did.
 */

let picks = [];
let offered = [];
const granted = [];
const grants = {
  findItems: jest.fn(async ({ type, availabilities, matches }) => CATALOG.filter(entry => entry.type == type
    && (!availabilities || availabilities.includes(entry.system.availability)) && (!matches || matches(entry)))),
  pickOne: jest.fn(async (title, rows) => {
    offered.push(rows.map(row => row.name));
    const name = picks.shift();
    return rows.find(row => row.name == name)?.uuid ?? null;
  }),
  chooseSelect: jest.fn(async (title, prompt, options) => {
    offered.push(options.map(option => option.value));
    const answer = picks.shift();
    return options.find(option => option.label == answer || option.value == answer)?.value ?? null;
  }),
  grantCopy: jest.fn(async (actor, uuid, options = {}) => {
    granted.push({ uuid, ...options });
    const entry = CATALOG.find(e => e.uuid == uuid);
    const [made] = await actor.createEmbeddedDocuments('Item', [{ name: entry.name, type: entry.type, system: JSON.parse(JSON.stringify(entry.system)),
      flags: { core: { sourceId: uuid }, essence20: { ...(options.flags ?? {}), grantedBy: options.grantedBy?.id } } }]);
    return made;
  }),
  chooseButtons: jest.fn(async () => null),
  rollTest: jest.fn(async () => ({ success: true })),
  essenceRedirect: jest.fn(),
};
jest.unstable_mockModule('./helpers/grants.mjs', () => grants);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));
const FILES = {
  moreBang: 'kocitems/_source/More_Bang_for_your_Buck_mfS0v8KAhBcLCC9e.json',
  ladder: 'tfcrbitems/_source/Ladder_CjJGz1LLzFoveqZK.json',
  enthusiast: 'qgtgitems/_source/Weapon_Enthusiast_pwpCtdsf8l7T6Sii.json',
  enthusiastHangUp: 'qgtgitems/_source/Weapon_Enthusiast_GcMPz5MICXwTzKOq.json',
  mystical: 'mlpcrbitems/_source/Mystical_Understanding_23NeoRDRxlo0LpyQ.json',
  brilliantSight: 'kocitems/_source/Brilliant_Sight_Oc8NpQa5ylK2Ix0B.json',
  weAreOne: 'eocitems/_source/We_Are_One__1MtovibPOMw9O2hP.json',
  earlyAdopter: 'qgtgitems/_source/Early_Adopter_WrRChund2zAcHYfe.json',
  detailOriented: 'mlpcrbitems/_source/Detail_Oriented_FBIg9BWG2CyjqgBP.json',
  sensitive: 'mlpcrbitems/_source/Sensitive_cLe7ettmAIaBUYIj.json',
};
// The book uuids the removed code keyed on, for the items whose source matters.
const BOOK = {
  enthusiast: 'Compendium.essence20.quartermasters_guide_to_gear.Item.pwpCtdsf8l7T6Sii',
  enthusiastHangUp: 'Compendium.essence20.quartermasters_guide_to_gear.Item.GcMPz5MICXwTzKOq',
  temperTempest: 'Compendium.essence20.knights_of_canterlot.Item.qwUMlRGUBOSoZJEI',
  fireball: 'Compendium.essence20.knights_of_canterlot.Item.zlERIywyKQNBQzs6',
  detailOriented: 'Compendium.essence20.mlp_crb.Item.FBIg9BWG2CyjqgBP',
};

const weaponEntry = (name, availability, system = {}) => ({
  uuid: `Compendium.essence20.cat.Item.${name.replace(/\W/g, '')}`, name, type: 'weapon', system: { availability, traits: [], items: {}, ...system },
});
const CATALOG = [
  weaponEntry('Combat Shotgun', 'limited'),
  weaponEntry('Pump Shotgun', 'standard'),
  weaponEntry('Rifle', 'limited'),
  weaponEntry('Prototype Shotgun', 'prototype'),
];

let nextId = 1;
const ALL = [];

function setPath(object, key, value) {
  const keys = key.split('.');
  const last = keys.pop();
  const parent = keys.reduce((o, k) => (o[k] ??= {}), object);
  if (last.startsWith('-=')) {
    delete parent[last.slice(2)];
  } else {
    parent[last] = value;
  }
}

function makeItem(data) {
  const item = { id: `i${nextId++}`, effects: [], flags: { essence20: {} }, system: {}, ...data };
  item.flags.essence20 ??= {};
  item.uuid = `Item.${item.id}`;
  item.update = jest.fn(async update => {
    for (const [key, value] of Object.entries(update)) {
      setPath(item, key, value);
    }

    if (item.parent?.items) {
      rebuildIndex(item.parent);
    }
  });
  item.setFlag = jest.fn(async (scope, key, value) => setPath(item, `flags.${scope}.${key}`, value));
  ALL.push(item);
  return item;
}

function packItem(key, { flags = {}, source = null } = {}) {
  const doc = fromPack(FILES[key]);
  return makeItem({
    name: doc.name, type: doc.type, system: JSON.parse(JSON.stringify(doc.system)),
    flags: { core: { sourceId: source ?? `Compendium.essence20.x.Item.${doc._id}` }, essence20: { ...flags } },
  });
}

function makeActor(items = [], extra = {}) {
  const list = [];
  const effects = [...(extra.effects ?? [])];
  const actor = {
    id: extra.id ?? `a${nextId++}`, name: extra.name ?? 'Hero', type: extra.type ?? 'playerCharacter', isOwner: true, documentName: 'Actor',
    flags: { essence20: { ...(extra.flags ?? {}) } }, system: { level: 10, skills: {}, size: 'common', health: { max: 10, value: 10 }, ...(extra.system ?? {}) },
    statuses: new Set(), hasPlayerOwner: true,
    items: { contents: list, get: id => list.find(i => i.id == id), filter: fn => list.filter(fn), find: fn => list.find(fn), some: fn => list.some(fn), [Symbol.iterator]: () => list[Symbol.iterator]() },
    effects: { contents: effects, [Symbol.iterator]: () => effects[Symbol.iterator]() },
    getActiveTokens: () => [],
  };
  actor.uuid = `Actor.${actor.id}`;
  actor.getFlag = (scope, key) => key.split('.').reduce((at, part) => at?.[part], actor.flags[scope]);
  actor.setFlag = jest.fn(async (scope, key, value) => setPath(actor, `flags.${scope}.${key}`, value));
  actor.unsetFlag = jest.fn(async (scope, key) => setPath(actor, `flags.${scope}.-=${key}`, null));
  actor.update = jest.fn(async update => {
    for (const [key, value] of Object.entries(update)) {
      setPath(actor, key, value);
    }

    rebuildIndex(actor);
  });
  actor.createEmbeddedDocuments = jest.fn(async (type, datas) => datas.map(data => {
    const made = makeItem(JSON.parse(JSON.stringify(data)));
    made.parent = actor;
    list.push(made);
    rebuildIndex(actor);
    return made;
  }));
  actor.deleteEmbeddedDocuments = jest.fn(async (type, ids) => {
    const from = type == 'ActiveEffect' ? effects : list;
    for (const id of ids) {
      from.splice(from.findIndex(i => i.id == id), 1);
    }
  });
  for (const item of items) {
    item.parent = actor;
    list.push(item);
  }

  ALL.push(actor);
  global.game.actors.push(actor);
  rebuildIndex(actor);
  return actor;
}

const { rebuildIndex } = await import('./index.mjs');
await import('./ext/index.mjs');
const { runUse, fireTriggers } = await import('./triggers.mjs');
const { ruleRollSources, ruleRequisitionAccess, ruleDialogSwitches, applyRuleSwitches } = await import('./adapter.mjs');
const { validateRule } = await import('./types.mjs');
const { legacyChoiceUpdates } = await import('./legacy-choices.mjs');
const { pickedRerollGrants, legacyRerollEffects } = await import('./ext/i/scopes.mjs');
const { runPostRoll } = await import('../helpers/extensions.mjs');
const { requisitionDif } = await import('../helpers/requisition.mjs');
const { tempestDamage } = await import('../helpers/extensions/other2/magic.mjs');
const { getCostOptions, recordRuleUse, resetDailyActionPerkUses } = await import('../helpers/action-perks.mjs');
await import('./actions.mjs');

const pay = jest.fn(async () => true);
const use = (item, option = 0) => runUse(item, pay, { ask: async () => option });

let numbers = [];
beforeAll(() => {
  global.foundry.utils.setProperty = setPath;
  global.foundry.utils.getProperty = (object, key) => key.split('.').reduce((at, part) => at?.[part], object);
  global.foundry.applications.api.DialogV2 = {
    wait: jest.fn(async () => null),
    prompt: jest.fn(async () => numbers.shift() ?? null),
  };
});

beforeEach(() => {
  picks = [];
  offered = [];
  numbers = [];
  granted.length = 0;
  ALL.length = 0;
  pay.mockClear();
  global.game.user = { id: 'u1', isGM: true, isActiveGM: true, targets: new Set() };
  global.game.users = [];
  global.game.combat = null;
  global.game.settings = { get: () => 1 };
  global.game.actors = [];
  global.game.actors.party = null;
  global.game.actors.get = id => ALL.find(a => a.id == id && a.documentName == 'Actor');
  global.game.i18n = { localize: k => k, format: (k, d) => `${k} ${JSON.stringify(d)}`, has: () => false };
  global.canvas = undefined;
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn() } };
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
  global.fromUuidSync = jest.fn(uuid => ALL.find(doc => doc.uuid == uuid) ?? null);
  global.fromUuid = jest.fn(async uuid => ALL.find(doc => doc.uuid == uuid) ?? null);
  global.CONFIG.E20.availabilityDifficulties = { automatic: 0, standard: 0, limited: 10, restricted: 15, prototype: 20, unique: 25, theoretical: 30 };
  global.CONFIG.E20.weaponTypes = { shotguns: 'E20.WeaponTypeShotguns', assaultRifle: 'E20.WeaponTypeAssaultRifle' };
});

test('every rule on the converted items validates', () => {
  for (const key of Object.keys(FILES)) {
    for (const rule of fromPack(FILES[key]).system.rules ?? []) {
      expect([key, validateRule(rule)]).toEqual([key, []]);
    }
  }
});

/* -------------------------------------------- */
/*  More Bang for your Buck                      */
/* -------------------------------------------- */

describe('More Bang for your Buck: Temper Tempest\'s storm', () => {
  test('the storm\'s lightning is 3, 4 with More Bang (its cast HitRider read for the spell)', async () => {
    const tempest = () => makeItem({ name: 'Temper Tempest', type: 'spell', flags: { core: { sourceId: BOOK.temperTempest } } });
    const plain = makeActor([tempest()]);
    expect(await tempestDamage(plain)).toBe(3);
    const mage = makeActor([packItem('moreBang'), tempest()]);
    expect(await tempestDamage(mage)).toBe(4);
  });

  test('its cast bonus still lands on a Fireball row (unchanged), and not on a non-elemental spell', async () => {
    const mage = makeActor([packItem('moreBang')]);
    const fireball = makeItem({ name: 'Fireball', type: 'spell', flags: { core: { sourceId: BOOK.fireball } } });
    const other = makeItem({ name: 'Charm', type: 'spell', system: { damageType: 'psychic' } });
    for (const spell of [fireball, other]) {
      spell.parent = mage;
    }

    const rowsFor = async spell => {
      const rows = [{ success: true, damageValue: 2 }];
      await runPostRoll(mage, rows, { damageType: spell.system.damageType }, { rider: { itemUuid: spell.uuid } });
      return rows[0].damageValue;
    };

    expect(await rowsFor(fireball)).toBe(3);
    expect(await rowsFor(other)).toBe(2);
  });
});

/* -------------------------------------------- */
/*  Ladder                                       */
/* -------------------------------------------- */

describe('Ladder: extend / stow, and the allies\' ↑2', () => {
  const truckWith = (system = {}) => {
    const ladder = packItem('ladder');
    const truck = makeActor([ladder], { name: 'Truck', system: { canTransform: true, isTransformed: true, size: 'large', ...system } });
    return { ladder, truck };
  };

  test('Use: only in Alt Mode (a warning, nothing set); a second press stows it', async () => {
    const { ladder, truck } = truckWith({ isTransformed: false });
    expect(await use(ladder)).toBeNull();
    expect(ui.notifications.warn).toHaveBeenCalledWith('The ladder can only be extended in Alt Mode.');
    expect(ladder.flags.essence20.rules?.toggles?.out).toBeFalsy();
    truck.system.isTransformed = true;
    expect(await use(ladder)).toContain('Truck extends their ladder.');
    expect(ladder.flags.essence20.rules.toggles.out).toBe(true);
    expect(ladder.flags.essence20.rules.toggleUntil.out).toMatchObject({ until: 'scene' });
    // Stowing works in either mode.
    truck.system.isTransformed = false;
    expect(await use(ladder)).toContain('Truck stows their ladder.');
    expect(ladder.flags.essence20.rules.toggles.out).toBe(false);
    // A new scene: the ladder counts as stowed.
    truck.system.isTransformed = true;
    await use(ladder);
    global.game.settings = { get: () => 2 };
    expect(await use(ladder)).toContain('Truck extends their ladder.');
  });

  test('an ally no bigger than the truck gets an "Using Truck\'s ladder: ↑2" switch on Athletics / Acrobatics while it\'s out in Alt Mode', async () => {
    const { ladder, truck } = truckWith();
    const climber = makeActor([], { name: 'Bee', system: { size: 'common' } });
    const switches = (actor, skill) => ruleDialogSwitches(actor, { rolledSkill: skill }).filter(s => s.entry.rule.scope == 'alliesAnywhere');
    expect(switches(climber, 'athletics')).toEqual([]);
    await use(ladder);
    expect(switches(climber, 'athletics')).toEqual([expect.objectContaining({ label: "Using Truck's ladder: ↑2", type: 'checkbox', value: false })]);
    expect(switches(climber, 'acrobatics')).toHaveLength(1);
    expect(switches(climber, 'might')).toEqual([]);
    // Not for the truck itself; not for a bigger ally; not in Bot Mode; not for an enemy (an NPC, off the canvas).
    expect(switches(truck, 'athletics')).toEqual([]);
    const giant = makeActor([], { name: 'Giant', system: { size: 'huge' } });
    expect(switches(giant, 'athletics')).toEqual([]);
    const npc = makeActor([], { name: 'Foe', type: 'npc' });
    expect(switches(npc, 'athletics')).toEqual([]);
    truck.system.isTransformed = false;
    expect(switches(climber, 'athletics')).toEqual([]);
    truck.system.isTransformed = true;
    // Ticked: ↑2.
    const [{ name }] = switches(climber, 'athletics');
    const options = { ext: { [name]: true } };
    await applyRuleSwitches(climber, options, { rolledSkill: 'athletics' });
    expect(options.shiftUp).toBe(2);
  });

  test('two ladders out: two switches, ticking both still gives ↑2', async () => {
    const first = truckWith();
    const second = truckWith();
    await use(first.ladder);
    await use(second.ladder);
    const climber = makeActor([], { name: 'Bee' });
    const list = ruleDialogSwitches(climber, { rolledSkill: 'athletics' }).filter(s => s.entry.rule.scope == 'alliesAnywhere');
    expect(list).toHaveLength(2);
    const options = { ext: Object.fromEntries(list.map(s => [s.name, true])) };
    await applyRuleSwitches(climber, options, { rolledSkill: 'athletics' });
    expect(options.shiftUp).toBe(2);
  });
});

/* -------------------------------------------- */
/*  Weapon Enthusiast                            */
/* -------------------------------------------- */

describe('Weapon Enthusiast (Perk)', () => {
  const holder = (flags = {}) => {
    const perk = packItem('enthusiast', { flags, source: BOOK.enthusiast });
    const hangUp = packItem('enthusiastHangUp', { source: BOOK.enthusiastHangUp });
    const actor = makeActor([perk, hangUp]);
    return { perk, hangUp, actor };
  };

  test('first press: choose the type - written on the Perk and the Hang-Up', async () => {
    const { perk, hangUp } = holder();
    picks = ['shotguns'];
    await use(perk);
    expect(offered[0]).toEqual(['shotguns', 'assaultRifle']);
    expect(perk.flags.essence20.q2WeaponType).toBe('shotguns');
    expect(hangUp.flags.essence20.q2WeaponType).toBe('shotguns');
  });

  test('then: take a Standard / Limited weapon of the type, flagged qualified and typed', async () => {
    const { perk, actor } = holder({ q2WeaponType: 'shotguns' });
    picks = ['Combat Shotgun'];
    await use(perk, 0);
    expect(offered[0]).toEqual(['Combat Shotgun', 'Pump Shotgun']);
    expect(granted[0]).toMatchObject({ uuid: CATALOG[0].uuid, grantedBy: perk, flags: { qualified: true, q2WeaponType: 'shotguns' } });
    expect(actor.items.contents.some(item => item.name == 'Combat Shotgun')).toBe(true);
    // The old flag was read as the pick.
    expect(perk.flags.essence20.rules.choices.type).toBe('shotguns');
  });

  test('then: tag an owned weapon as the type; or change the type', async () => {
    const { perk, hangUp, actor } = holder({ q2WeaponType: 'shotguns' });
    const blaster = makeItem({ name: 'Blaster', type: 'weapon' });
    blaster.parent = actor;
    actor.items.contents.push(blaster);
    picks = [blaster.id];
    await use(perk, 1);
    expect(blaster.flags.essence20.q2WeaponType).toBe('shotguns');
    picks = ['assaultRifle'];
    await use(perk, 2);
    expect(perk.flags.essence20.q2WeaponType).toBe('assaultRifle');
    expect(hangUp.flags.essence20.q2WeaponType).toBe('assaultRifle');
  });

  test('Qualified in Limited (or lower) weapons of the type - the Perk\'s type, else the Hang-Up\'s', () => {
    const { actor } = holder({ q2WeaponType: 'shotguns' });
    const weapon = (name, availability) => ({ type: 'weapon', name, flags: {}, system: { availability } });
    expect(ruleRequisitionAccess(actor, weapon('Combat Shotgun', 'limited'))).toBe('qualified');
    expect(ruleRequisitionAccess(actor, weapon('Shotgun', undefined))).toBe('qualified');
    expect(ruleRequisitionAccess(actor, weapon('Rifle', 'limited'))).toBeNull();
    expect(ruleRequisitionAccess(actor, weapon('Prototype Shotgun', 'prototype'))).toBeNull();
    expect(ruleRequisitionAccess(actor, { ...weapon('Blaster', 'standard'), flags: { essence20: { q2WeaponType: 'shotguns' } } })).toBe('qualified');
    // No type picked: nothing; the Hang-Up's type counts when the Perk has none.
    const fresh = holder();
    expect(ruleRequisitionAccess(fresh.actor, weapon('Combat Shotgun', 'limited'))).toBeNull();
    fresh.hangUp.flags.essence20.q2WeaponType = 'shotguns';
    expect(ruleRequisitionAccess(fresh.actor, weapon('Combat Shotgun', 'limited'))).toBe('qualified');
  });

  test('the start-up linking pass moves the old type into the pick', () => {
    const { perk, actor } = holder({ q2WeaponType: 'shotguns' });
    expect(legacyChoiceUpdates(actor)).toEqual(expect.arrayContaining([{ _id: perk.id, 'flags.essence20.rules.choices.type': 'shotguns' }]));
  });
});

/* -------------------------------------------- */
/*  Mystical Understanding                       */
/* -------------------------------------------- */

describe('Mystical Understanding: Refocus, Essential Research, Magically Fit In', () => {
  const caster = (points = 3, system = {}) => {
    const pool = makeItem({ name: 'Mystical Points', type: 'rolePoints', system: { resource: { value: points, max: 5 } } });
    const perk = packItem('mystical');
    const actor = makeActor([perk, pool], {
      name: 'Twilight',
      system: {
        skills: { spellcasting: { shiftDown: 2 }, athletics: {}, persuasion: {} },
        essences: { strength: { value: 2, max: 2 }, speed: { value: 3, max: 3 }, smarts: { value: 4, max: 4 }, social: { value: 1, max: 1 } },
        ...system,
      },
    });
    actor._getBaseRolePoints = () => pool;
    return { perk, pool, actor };
  };

  test('Refocus: 2 Mystical Points, the Spellcasting downshift cleared; too few points - a warning, nothing spent', async () => {
    const { perk, pool, actor } = caster(3);
    await use(perk, 0);
    expect(pool.system.resource.value).toBe(1);
    expect(actor.system.skills.spellcasting.shiftDown).toBe(0);
    actor.system.skills.spellcasting.shiftDown = 1;
    await use(perk, 0);
    expect(ui.notifications.warn).toHaveBeenCalledWith('E20.Mlp2NoMystical');
    expect(pool.system.resource.value).toBe(1);
    expect(actor.system.skills.spellcasting.shiftDown).toBe(1);
  });

  test('Essential Research: 1 point, +1 to the Essence (max and value), three a day, all undone on a Rest', async () => {
    const { perk, pool, actor } = caster(5);
    picks = ['strength'];
    await use(perk, 1);
    expect(actor.system.essences.strength).toEqual({ value: 3, max: 3 });
    expect(actor.flags.essence20.essentialResearch).toEqual(['strength']);
    picks = ['strength'];
    await use(perk, 1);
    picks = ['smarts'];
    await use(perk, 1);
    expect(pool.system.resource.value).toBe(2);
    expect(actor.system.essences.strength).toEqual({ value: 4, max: 4 });
    expect(actor.system.essences.smarts).toEqual({ value: 5, max: 5 });
    // A fourth: refused before anything is asked.
    picks = ['speed'];
    await use(perk, 1);
    expect(ui.notifications.warn).toHaveBeenCalledWith('E20.Mlp2ResearchDone');
    expect(actor.system.essences.speed).toEqual({ value: 3, max: 3 });
    // A Rest takes them back (the value never above the new max) and forgets them.
    actor.system.essences.strength.value = 1;
    await fireTriggers(actor, 'rest');
    expect(actor.system.essences.strength).toEqual({ value: 1, max: 2 });
    expect(actor.system.essences.smarts).toEqual({ value: 4, max: 4 });
    expect(actor.system.essences.speed).toEqual({ value: 3, max: 3 });
    expect(actor.flags.essence20.essentialResearch).toEqual([]);
  });

  test('Essential Research raised before the update (the old flag) is undone the same way', async () => {
    const { actor } = caster(3, { essences: { strength: { value: 2, max: 2 }, speed: { value: 4, max: 4 }, smarts: { value: 4, max: 4 }, social: { value: 1, max: 1 } } });
    actor.flags.essence20.essentialResearch = ['speed'];
    await fireTriggers(actor, 'rest');
    expect(actor.system.essences.speed).toEqual({ value: 3, max: 3 });
    expect(actor.system.essences.strength).toEqual({ value: 2, max: 2 });
  });

  test('Magically Fit In: points spent for that many ranks in the picked Skill, this scene; the latest use replaces it', async () => {
    const { perk, pool, actor } = caster(3);
    numbers = [2];
    picks = ['athletics'];
    await use(perk, 2);
    expect(pool.system.resource.value).toBe(1);
    const up = skill => ruleRollSources(actor, null, { rolledSkill: skill }).sources.filter(s => s.label == 'Magically Fit In').reduce((n, s) => n + s.shiftUp, 0);
    expect(up('athletics')).toBe(2);
    expect(up('persuasion')).toBe(0);
    // A new scene ends it.
    global.game.settings = { get: () => 2 };
    expect(up('athletics')).toBe(0);
    // The next use replaces the old one.
    picks = ['persuasion'];
    await use(perk, 2);
    expect(pool.system.resource.value).toBe(0);
    expect(up('persuasion')).toBe(1);
    expect(up('athletics')).toBe(0);
    // No points: a warning, nothing asked.
    await use(perk, 2);
    expect(ui.notifications.warn).toHaveBeenCalledWith('E20.Mlp2NoMystical');
  });

  test('Magically Fit In: a cancelled Skill pick spends nothing', async () => {
    const { perk, pool, actor } = caster(3);
    numbers = [2];
    picks = [null];
    await use(perk, 2);
    expect(pool.system.resource.value).toBe(3);
    expect(actor.flags.essence20.ruleMarks?.magicallyFitIn).toBeUndefined();
  });
});

/* -------------------------------------------- */
/*  Brilliant Sight                              */
/* -------------------------------------------- */

describe('Brilliant Sight: darkvision for the scene', () => {
  const cast = async (caster, spell, rows) => runPostRoll(caster, rows, { riderContext: { itemUuid: spell.uuid } }, { rider: { itemUuid: spell.uuid } });

  test('a successful cast gives the targeted creature (else the caster) a 120 ft darkvision item until the scene ends', async () => {
    const spell = packItem('brilliantSight');
    const caster = makeActor([spell], { name: 'Caster' });
    const friend = makeActor([], { name: 'Friend' });
    global.game.user.targets = new Set([{ actor: friend }]);
    await cast(caster, spell, [{ success: true }]);
    const sight = friend.items.contents.find(item => item.name == 'Brilliant Sight');
    expect(sight).toMatchObject({ type: 'gear', system: { equipped: true, gearType: 'other', visionGrant: { enabled: true, mode: 'darkvision', range: 120 } } });
    expect(sight.flags.essence20.rulesExpiry).toMatchObject({ until: 'scene' });
    global.game.user.targets = new Set();
    await cast(caster, spell, [{ success: true }]);
    expect(caster.items.contents.filter(item => item.name == 'Brilliant Sight' && item.type == 'gear')).toHaveLength(1);
  });

  test('a failed cast, or another spell, gives nothing', async () => {
    const spell = packItem('brilliantSight');
    const other = makeItem({ name: 'Other', type: 'spell' });
    const caster = makeActor([spell, other], { name: 'Caster' });
    await cast(caster, spell, [{ success: false }]);
    await cast(caster, other, [{ success: true }]);
    expect(caster.items.contents.filter(item => item.type == 'gear')).toHaveLength(0);
  });
});

/* -------------------------------------------- */
/*  We Are One!                                  */
/* -------------------------------------------- */

describe('We Are One!: the team\'s reroll', () => {
  test('the holder and every picked team mate get a reroll of 1s on the two Skills; nobody else', () => {
    const perk = packItem('weAreOne');
    const holder = makeActor([perk], { name: 'Holder' });
    const mate = makeActor([], { name: 'Mate' });
    const other = makeActor([], { name: 'Other' });
    expect(pickedRerollGrants(holder)).toEqual([]);
    perk.flags.essence20.rules = { choices: { team: [mate.uuid], skillA: 'science', skillB: 'might' } };
    rebuildIndex(holder);
    for (const actor of [holder, mate]) {
      expect(pickedRerollGrants(actor)).toEqual([expect.objectContaining({
        name: 'We Are One!', mode: 'ones', target: 'skillDice', reset: 'none', maxUses: 0, skills: ['science', 'might'], recursive: false,
      })]);
    }

    expect(pickedRerollGrants(other)).toEqual([]);
    // Skills not both picked yet: nothing.
    perk.flags.essence20.rules.choices.skillB = '';
    expect(pickedRerollGrants(mate)).toEqual([]);
  });

  test('an older pick on the holder is moved into the Perk\'s picks; the old reroll effects are swept', () => {
    const perk = packItem('weAreOne');
    const holder = makeActor([perk], { name: 'Holder', flags: { tf2WeAreOne: { members: ['Actor.m'], skills: ['athletics', 'persuasion'], label: 'We Are One!' } } });
    expect(legacyChoiceUpdates(holder)).toEqual([{
      _id: perk.id, 'flags.essence20.rules.choices.team': ['Actor.m'], 'flags.essence20.rules.choices.skillA': 'athletics', 'flags.essence20.rules.choices.skillB': 'persuasion',
    }]);
    const mate = makeActor([], { name: 'Mate', effects: [{ id: 'e1', flags: { essence20: { tf2WeAreOneBy: holder.uuid } } }, { id: 'e2', flags: { essence20: {} } }] });
    expect(legacyRerollEffects(global.game.actors)).toEqual([{ actor: mate, ids: ['e1'] }]);
  });

  test('the Use no longer bumps a sync flag', () => {
    const steps = fromPack(FILES.weAreOne).system.rules.find(rule => rule.type == 'Use').steps;
    expect(steps.map(step => step.do)).toEqual(['pickMany', 'pick', 'pick']);
  });
});

/* -------------------------------------------- */
/*  Early Adopter                                */
/* -------------------------------------------- */

describe('Early Adopter: Requisition DIF -5 on Prototypical / Theoretical gear', () => {
  test('prototype 20 -> 15, theoretical 30 -> 25; restricted and unique untouched; nothing without the Perk', () => {
    const actor = makeActor([packItem('earlyAdopter')]);
    const dif = (tier, who = actor) => requisitionDif({ system: { totalAvailability: tier } }, who);
    expect(dif('prototype')).toBe(15);
    expect(dif('theoretical')).toBe(25);
    expect(dif('restricted')).toBe(15);
    expect(dif('unique')).toBe(25);
    expect(dif('prototype', makeActor([]))).toBe(20);
  });
});

/* -------------------------------------------- */
/*  Detail Oriented                              */
/* -------------------------------------------- */

describe('Detail Oriented: a Finesse Use a Skill as a Move action, three times a day', () => {
  test('offered (asked) for Use a Skill, counted under actionPerkDailyUses.detailOriented, back after a Rest', async () => {
    const actor = makeActor([packItem('detailOriented', { source: BOOK.detailOriented })], { name: 'Pony' });
    const offers = () => getCostOptions(actor, 'standard', { key: 'useASkill' }, {}).offers;
    expect(offers()).toEqual([expect.objectContaining({ actionType: 'move', question: 'E20.ActionPerkAskFinesse', label: 'Detail Oriented' })]);
    expect(getCostOptions(actor, 'standard', { key: 'sprint' }, {}).offers).toEqual([]);
    for (let i = 0; i < 3; i++) {
      await recordRuleUse(actor, offers()[0], {});
    }

    expect(actor.flags.essence20.actionPerkDailyUses).toEqual({ detailOriented: 3 });
    expect(offers()).toEqual([]);
    expect(await resetDailyActionPerkUses(actor)).toBe(true);
    expect(offers()).toHaveLength(1);
  });

  test('shares its daily count with Sensitive\'s "spend a Detail Oriented use"', async () => {
    const actor = makeActor([packItem('detailOriented', { source: BOOK.detailOriented }), packItem('sensitive')], { name: 'Pony' });
    actor.flags.essence20.actionPerkDailyUses = { detailOriented: 2 };
    const offers = () => getCostOptions(actor, 'standard', { key: 'useASkill' }, {}).offers;
    expect(offers()).toHaveLength(1);
    await recordRuleUse(actor, offers()[0], {});
    expect(offers()).toEqual([]);
  });
});
