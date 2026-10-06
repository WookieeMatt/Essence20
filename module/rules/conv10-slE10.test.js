import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * slE10 (docs/rules-batches/slE10.md): the items round 10's group E pieces unblocked, each loaded from its pack source,
 * doing what the removed slice code did - picked compendium entries (Extract Poison, Improvise Bomb / Demolition Artist,
 * Scavenger, Mutant Beast, Ninpō JOEs), team buttons (Early Adopter, Field Trials), picks (We Are One!, Dabbler,
 * Training Evolution, Thick Skin, Metier, Nothing Personal, Weather Gear), loops and per-member runs (In His Image,
 * Camper), registry rule types (Weather Gear, Acclimating, Misguide, Plow, Training Through Familiarity, Good To Go),
 * events and small tags (Junker, Cartography Suite, Lay of the Land, Uniform, Revengeful, Yo Joe!, Inspirational
 * Leader, Sensitive, Peak Performance) and the legacy mark pass (Fresh Mark, Natural Style).
 */

let picks = [];
let offered = [];
let rolls = [];
const grants = {
  findItems: jest.fn(async ({ type, availabilities, matches }) => CATALOG.filter(entry => entry.type == type
    && (!availabilities || availabilities.includes(entry.system.availability)) && (!matches || matches(entry)))),
  pickOne: jest.fn(async (title, rows) => {
    offered.push(rows.map(row => row.name));
    const name = picks.shift();
    return rows.find(row => row.name == name)?.uuid ?? null;
  }),
  chooseSelect: jest.fn(async (title, prompt, options) => {
    offered.push(options.map(option => option.label));
    const answer = picks.shift();
    return options.find(option => option.label == answer || option.value == answer)?.value ?? null;
  }),
  grantCopy: jest.fn(async (actor, uuid, { grantedBy, flags } = {}) => {
    const entry = CATALOG.find(e => e.uuid == uuid);
    const [made] = await actor.createEmbeddedDocuments('Item', [{ name: entry.name, type: entry.type, system: JSON.parse(JSON.stringify(entry.system)),
      flags: { core: { sourceId: uuid }, essence20: { ...(flags ?? {}), grantedBy: grantedBy?.id } } }]);
    return made;
  }),
  rollTest: jest.fn(async (actor, skill, dif) => {
    rollsMade.push({ skill, dif });
    return rolls.shift() ?? { success: true, crit: false };
  }),
  markIntegrated: jest.fn(),
  chooseButtons: jest.fn(async () => null),
};
const rollsMade = [];
jest.unstable_mockModule('./mechanics/resources/grants.mjs', () => grants);
jest.unstable_mockModule('./mechanics/resources/requisition.mjs', () => ({ requisitionSkill: item => (item.type == 'armor' ? 'athletics' : 'targeting') }));
jest.unstable_mockModule('./sheet-handlers/attachment-handler.mjs', () => ({
  createItemCopies: jest.fn(async () => {}),
  setEntryAndAddItem: jest.fn(async () => 'k1'),
}));

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));
const FILES = {
  extractPoison: 'ccitems/_source/Extract_Poison_0kcuvCeRhmneAJTl.json',
  improviseBomb: 'ccitems/_source/Improvise_Bomb_BUqXOt90M4yAsA7b.json',
  scavenger: 'ccitems/_source/Scavenger_VjLTohjkJJtJPXdE.json',
  metier: 'ccitems/_source/Metier_EcVOkUJE40sKSg8v.json',
  misguide: 'ccitems/_source/Misguide_IaxNOucyCcF6QDU1.json',
  uniform: 'ccitems/_source/Uniform_VkSI68BkpXLOC5ys.json',
  earlyAdopter: 'qgtgitems/_source/Early_Adopter_WrRChund2zAcHYfe.json',
  fieldTrials: 'qgtgitems/_source/Field_Trials_HBSVeVpRVBXiPgSW.json',
  junker: 'qgtgitems/_source/Junker_fiokYoWguE1eBVda.json',
  trainingEvolution: 'qgtgitems/_source/Training_Evolution_zqy47bzuJHaON2TP.json',
  mutantBeast: 'tsitems/_source/Mutant_Beast_gkcyg7KWih6QAZlq.json',
  weAreOne: 'eocitems/_source/We_Are_One__1MtovibPOMw9O2hP.json',
  cartography: 'eocitems/_source/Cartography_Suite_l2dioJyakPropGEx.json',
  layOfTheLand: 'eocitems/_source/Lay_of_the_Land_CTt9gmibpffGC0N4.json',
  dabbler: 'mlpcrbitems/_source/Dabbler_Tnr6LTI2yBHUxC7r.json',
  thickSkin: 'mlpcrbitems/_source/Thick_Skin_KakotlRk6PO2CRqu.json',
  sensitive: 'mlpcrbitems/_source/Sensitive_cLe7ettmAIaBUYIj.json',
  freshMark: 'mlpcrbitems/_source/Fresh_Mark_LWCNfr3eEU2y9MyP.json',
  naturalStyle: 'mlpcrbitems/_source/Natural_Style_IgjtNiGBXQinE1GO.json',
  inHisImage: 'dditems/_source/In_His_Image_DegS9JawsaAzOCR1.json',
  revengeful: 'dditems/_source/Revengeful_n1CZfponNlZ9I8uN.json',
  camper: 'kocitems/_source/Camper_dMEFcqcain5oS2mJ.json',
  peakPerformance: 'ghpfitems/_source/Peak_Performance_Uzs2Ms6MgPsxV8uU.json',
  weatherGear: 'gijcrbitems/_source/Weather_Gear_toav8R7TF92WnQ8G.json',
  acclimating: 'gijcrbitems/_source/Acclimating_HSmtPttbJvaNy5Tf.json',
  yoJoe: 'gijcrbitems/_source/Yo_Joe__8pFYTMSWUsVsfLPD.json',
  plow: 'tfcrbitems/_source/Plow_y7VBydpKD8O63C3b.json',
  ttf: 'tfcrbitems/_source/Training_Through_Familiarity_9XITV6O09Up8QiwL.json',
  goodToGo: 'iafav2items/_source/Good_To_Go_Yt3muowN1aALcqOj.json',
  ninpo: 'iafav2items/_source/Ninp__JOEs_8oZYgik001Dxxxa6.json',
  nothingPersonal: 'iafav2items/_source/Nothing_Personal_WsB4CydGzKF2g7Yi.json',
  inspirational: 'atsitems/_source/Inspirational_Leader_JH6xyTYUHCxAKkTP.json',
};

const attack = (style, extra = {}) => ({ type: 'weaponEffect', classification: { style }, ...extra });
const entry = (name, type, availability = 'standard', system = {}) => ({
  uuid: `Compendium.essence20.cat.Item.${name.replace(/\W/g, '')}`, name, type, system: { availability, traits: [], items: {}, ...system },
});
const CATALOG = [
  entry('Toxin', 'weapon', 'limited', { isPoison: true }),
  entry('Frag Grenade', 'weapon', 'limited', { traits: ['consumable'], items: { a: attack('explosive') } }),
  entry('Missile', 'weapon', 'restricted', { traits: ['consumable', 'mounted'], items: { a: attack('explosive') } }),
  entry('Smoke Bomb', 'weapon', 'standard', { traits: ['consumable'], items: { a: attack('thrown') } }),
  entry('Rifle', 'weapon', 'standard', { items: { a: attack('projectile') } }),
  entry('Vest', 'armor', 'limited'),
  entry('Buckler', 'shield', 'standard'),
  entry('Katana', 'weapon', 'limited', { traits: ['martialArts'], items: { a: attack('melee') } }),
  entry('Club', 'weapon', 'limited', { items: { a: attack('melee') } }),
  entry('Shuriken', 'weapon', 'limited', { traits: ['martialArts'], items: { a: attack('thrown') } }),
  entry('Bow', 'weapon', 'limited', { items: { a: attack('projectile') } }),
  entry('Scope', 'upgrade', 'standard', { type: 'weapon' }),
  entry('Plating', 'upgrade', 'standard', { type: 'armor' }),
  entry('Field Kit', 'gear', 'standard', { gearType: 'kits' }),
  entry('Laser Sight', 'upgrade', 'limited', { type: 'weapon', traits: ['accurate'] }),
  entry('Beast Origin', 'origin', 'standard', { items: { m: { type: 'altMode', name: 'Rhino', uuid: 'Compendium.essence20.cat.Item.Rhino' } } }),
  entry('Fuzor Origin', 'origin', 'standard', { items: {} }),
  entry('Rhino', 'altMode'),
  entry('Grudge', 'hangUp'),
  entry('Fear', 'hangUp'),
  { uuid: 'Compendium.essence20.gi_joe_crb.Item.rSP76BWjYaifJLIZ', name: 'Silencer', type: 'upgrade', system: { availability: 'standard', traits: [], type: 'weapon' } },
  { uuid: 'Compendium.essence20.gi_joe_crb.Item.rFnoQTbnYQX2tlMe', name: 'Weapon Training', type: 'perk', system: {} },
  { uuid: 'U.momentum', name: 'Momentum', type: 'perk', system: {} },
];
const uuidOf = name => CATALOG.find(e => e.name == name).uuid;

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
  });
  item.setFlag = jest.fn(async (scope, key, value) => setPath(item, `flags.${scope}.${key}`, value));
  item.updateEmbeddedDocuments = jest.fn(async (type, updates) => {
    for (const { _id, ...rest } of updates) {
      Object.assign(item.effects.find(effect => effect.id == _id), rest);
    }
  });
  ALL.push(item);
  return item;
}

function packItem(key, flags = {}) {
  const doc = fromPack(FILES[key]);
  return makeItem({
    name: doc.name, type: doc.type, system: JSON.parse(JSON.stringify(doc.system)),
    effects: (doc.effects ?? []).map(effect => ({ id: effect._id, name: effect.name, changes: effect.changes, disabled: effect.disabled })),
    flags: { core: { sourceId: `Compendium.essence20.x.Item.${doc._id}` }, essence20: { ...flags } },
  });
}

function makeActor(items = [], extra = {}) {
  const list = [];
  const actor = {
    id: extra.id ?? `a${nextId++}`, name: extra.name ?? 'Hero', type: extra.type ?? 'playerCharacter', isOwner: true, documentName: 'Actor',
    flags: { essence20: { ...(extra.flags ?? {}) } }, system: { level: 10, skills: {}, health: { max: 10, value: 10 }, ...(extra.system ?? {}) },
    statuses: new Set(extra.statuses ?? []), hasPlayerOwner: true,
    items: { contents: list, get: id => list.find(i => i.id == id), filter: fn => list.filter(fn), find: fn => list.find(fn), some: fn => list.some(fn), [Symbol.iterator]: () => list[Symbol.iterator]() },
    getActiveTokens: () => (extra.token ? [extra.token] : []),
  };
  actor.uuid = `Actor.${actor.id}`;
  actor.getFlag = (scope, key) => key.split('.').reduce((at, part) => at?.[part], actor.flags[scope]);
  actor.setFlag = jest.fn(async (scope, key, value) => setPath(actor, `flags.${scope}.${key}`, value));
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
    return made;
  }));
  actor.deleteEmbeddedDocuments = jest.fn(async (type, ids) => {
    for (const id of ids) {
      list.splice(list.findIndex(i => i.id == id), 1);
    }
  });
  for (const item of items) {
    item.parent = actor;
    list.push(item);
  }

  ALL.push(actor);
  rebuildIndex(actor);
  return actor;
}

const { rebuildIndex } = await import('./index.mjs');
await import('./plugins/index.mjs');
const { runUse, useAvailable, fireTriggers } = await import('./triggers.mjs');
const { pressRuleButton } = await import('./buttons.mjs');
const { ruleRollSources, ruleRequisitionAccess, ruleSpecializes, ruleDialogSwitches, applyRuleSwitches, ruleMovement, ruleSurpriseModes } = await import('./adapter.mjs');
const { validateRule } = await import('./types.mjs');
const { registerCheck, setWorldLookups } = await import('./predicate.mjs');
const eTypes = {
  ...(await import('./plugins/combat/hazard-terrain-targets.mjs')), ...(await import('./plugins/resources/kit-prerequisite.mjs')),
  ...(await import('./plugins/combat/equipment-broke.mjs')),
};
const eDerived = await import('./plugins/effects/derived-stages.mjs');
const eLegacy = await import('./plugins/marks/legacy-marks.mjs');

const pay = jest.fn(async () => true);
const use = (item, option = 0) => runUse(item, pay, { ask: async () => option });
const usesOf = item => item.system.rules.map((rule, index) => ({ rule, index })).filter(({ rule }) => rule.type == 'Use');
const available = item => usesOf(item).filter(({ rule, index }) => useAvailable(item, rule, index)).map(({ rule }) => rule.label);

beforeAll(() => {
  global.foundry.utils.setProperty = setPath;
  global.foundry.applications.api.DialogV2 = { wait: jest.fn(async () => dialogAnswers.shift() ?? null) };
});

let dialogAnswers = [];
beforeEach(() => {
  picks = [];
  offered = [];
  rolls = [];
  rollsMade.length = 0;
  dialogAnswers = [];
  ALL.length = 0;
  pay.mockClear();
  global.game.user = { id: 'u1', isGM: true, targets: new Set() };
  global.game.users = [];
  global.game.combat = null;
  global.game.settings = { get: () => 1 };
  global.game.actors = [];
  global.game.actors.party = null;
  global.game.actors.get = id => ALL.find(a => a.id == id && a.documentName == 'Actor');
  global.canvas = undefined;
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
  global.fromUuid = jest.fn(async uuid => {
    const found = CATALOG.find(e => e.uuid == uuid);
    return found ? { ...found, toObject: () => JSON.parse(JSON.stringify({ name: found.name, type: found.type, system: found.system })) } : null;
  });
  global.fromUuidSync = jest.fn(uuid => ALL.find(doc => doc.uuid == uuid) ?? null);
  global.CONFIG.E20.availabilityDifficulties = { automatic: 0, standard: 0, limited: 10, restricted: 15, prototype: 20, unique: 25, theoretical: 30 };
});

test('every rule the batch added validates', () => {
  for (const key of Object.keys(FILES)) {
    for (const rule of fromPack(FILES[key]).system.rules ?? []) {
      expect([key, validateRule(rule)]).toEqual([key, []]);
    }
  }
});

/* -------------------------------------------- */
/*  Picked compendium entries                    */
/* -------------------------------------------- */

describe('Extract Poison, Improvise Bomb / Demolition Artist, Scavenger', () => {
  test('Extract Poison: out of combat only; a poison picked, Science against its Availability DIF, a dose on success', async () => {
    const perk = packItem('extractPoison');
    const actor = makeActor([perk]);
    global.game.combat = { combatants: [{ actor }] };
    expect(available(perk)).toEqual([]);
    global.game.combat = null;
    picks = ['Toxin'];
    await use(perk);
    expect(offered[0]).toEqual(['Toxin']);
    expect(rollsMade).toEqual([{ skill: 'science', dif: 10 }]);
    expect(actor.items.contents.filter(i => i.name == 'Toxin')).toHaveLength(1);
    rolls = [{ success: false }];
    picks = ['Toxin'];
    await use(perk);
    expect(actor.items.contents.filter(i => i.name == 'Toxin')).toHaveLength(1);
  });

  test('Improvise Bomb: bombs and grenades only; Standard action, Free with Demolition Artist; two on a crit', async () => {
    const perk = packItem('improviseBomb');
    const actor = makeActor([perk]);
    picks = ['Frag Grenade'];
    await use(perk);
    expect(offered[0]).toEqual(['Frag Grenade', 'Smoke Bomb']);
    expect(pay).toHaveBeenLastCalledWith('standard');
    expect(rollsMade.at(-1)).toEqual({ skill: 'technology', dif: 10 });
    expect(actor.items.contents.filter(i => i.name == 'Frag Grenade')).toHaveLength(1);

    actor.items.contents.push(Object.assign(makeItem({ name: 'Demolition Artist', type: 'perk', flags: { core: { sourceId: 'Compendium.essence20.cobra_codex.Item.QzcZLhyVvdbn09Es' } } }), { parent: actor }));
    rolls = [{ success: true, crit: true }];
    picks = ['Smoke Bomb'];
    await use(perk);
    expect(pay).toHaveBeenLastCalledWith('free');
    expect(actor.items.contents.filter(i => i.name == 'Smoke Bomb')).toHaveLength(2);
    // A cancelled pick costs nothing.
    pay.mockClear();
    await use(perk);
    expect(pay).not.toHaveBeenCalled();
  });

  test('Scavenger: out of combat, once per encounter; one step harder; found gear comes Temperamental', async () => {
    const perk = packItem('scavenger');
    const actor = makeActor([perk]);
    global.game.combat = { id: 'c' };
    expect(available(perk)).toEqual([]);
    global.game.combat = null;
    picks = ['Rifle'];
    await use(perk, 0);
    expect(rollsMade.at(-1)).toEqual({ skill: 'targeting', dif: 10 });
    const rifle = actor.items.contents.find(i => i.name == 'Rifle');
    expect(rifle.system.traits).toContain('temperamental');
    expect(rifle.flags.essence20).toMatchObject({ scavenged: true, temperamental: true });
    expect(available(perk)).toEqual([]);

    const again = makeActor([packItem('scavenger')]);
    picks = ['Vest'];
    rolls = [{ success: false }];
    await use(again.items.contents[0], 1);
    expect(rollsMade.at(-1)).toEqual({ skill: 'athletics', dif: 15 });
    expect(again.items.contents.some(i => i.name == 'Vest')).toBe(false);
    // A failed search still uses it up; a shield is a Technology test.
    expect(available(again.items.contents[0])).toEqual([]);
    const third = makeActor([packItem('scavenger')]);
    picks = ['Buckler'];
    await use(third.items.contents[0], 2);
    expect(rollsMade.at(-1)).toEqual({ skill: 'technology', dif: 10 });
  });
});

describe('Mutant Beast, Ninpō JOEs', () => {
  test('Mutant Beast: a non-Fuzor Origin\'s Alt Mode, while there are fewer than two', async () => {
    const influence = packItem('mutantBeast');
    const actor = makeActor([influence]);
    picks = ['Beast Origin'];
    await use(influence);
    expect(offered[0]).toEqual(['Beast Origin']);
    expect(actor.items.contents.filter(i => i.type == 'altMode').map(i => i.name)).toEqual(['Rhino']);
    actor.items.contents.push(Object.assign(makeItem({ name: 'Car', type: 'altMode' }), { parent: actor }));
    expect(available(influence)).toEqual([]);
  });

  test('Ninpō JOEs: a Limited melee weapon, then a projectile one - with Martial Arts unless the first had it; Qualified', async () => {
    const perk = packItem('ninpo');
    const actor = makeActor([perk]);
    picks = ['Club', 'Shuriken'];
    await use(perk);
    expect(offered).toEqual([['Katana', 'Club'], ['Shuriken']]);
    expect(ruleRequisitionAccess(actor, { name: 'Shuriken', type: 'weapon', system: { availability: 'limited' }, flags: { core: { sourceId: uuidOf('Shuriken') } } })).toBe('qualified');
    expect(ruleRequisitionAccess(actor, { name: 'Club', type: 'weapon', system: { availability: 'limited' }, flags: { core: { sourceId: uuidOf('Club') } } })).toBe('qualified');
    expect(ruleRequisitionAccess(actor, { name: 'Bow', type: 'weapon', system: { availability: 'limited' }, flags: {} })).toBeNull();
    offered = [];
    picks = ['Katana', 'Bow'];
    await use(perk);
    expect(offered[1]).toEqual(['Frag Grenade', 'Shuriken', 'Bow']);
    expect(perk.flags.essence20.rules.choices.chosen.map(e => e.name)).toEqual(['Katana', 'Bow']);
  });
});

/* -------------------------------------------- */
/*  Team buttons                                 */
/* -------------------------------------------- */

describe('Early Adopter, Field Trials', () => {
  // Press the card's button as a player whose character is `who`, answering a choose with `option`.
  const press = async (card, who, option = null) => {
    dialogAnswers = option === null ? [] : [String(option)];
    global.game.user = { id: 'p', isGM: false, character: who };
    await pressRuleButton({ flags: card.flags, update: jest.fn() }, global.game.user);
  };

  test('Early Adopter: a card each teammate (not the holder) answers once a mission', async () => {
    const perk = packItem('earlyAdopter');
    const holder = makeActor([perk], { name: 'Holder' });
    const mate = makeActor([], { name: 'Mate' });
    const stranger = makeActor([], { name: 'Stranger' });
    global.game.actors.push(holder, mate, stranger);
    global.game.actors.party = { members: [holder, mate] };
    await use(perk);
    const card = ChatMessage.create.mock.calls.find(call => call[0].flags?.essence20?.ruleButton)?.[0];
    expect(card.flags.essence20.ruleButton).toMatchObject({ who: 'anyone', runAs: 'clicker', once: false });
    expect(available(perk)).toEqual([]);

    // A weapon upgrade for the mate; a second press this mission does nothing.
    picks = ['Scope'];
    await press(card, mate, 0);
    expect(offered.at(-1)).toEqual(['Scope', 'Silencer']);
    picks = ['Scope'];
    await press(card, mate, 0);
    expect(mate.items.contents.map(i => i.name)).toEqual(['Scope']);
    // Not for the holder, nor someone off the team.
    for (const who of [stranger, holder]) {
      picks = ['Plating'];
      await press(card, who, 1);
      expect(who.items.contents.filter(i => i.name == 'Plating')).toHaveLength(0);
    }
  });

  test('Early Adopter / Field Trials grants (the button steps run as the presser)', async () => {
    const perk = packItem('fieldTrials');
    const holder = makeActor([perk], { name: 'Holder' });
    global.game.actors.push(holder);
    global.game.actors.party = { members: [] };
    holder.hasPlayerOwner = true;
    await use(perk);
    const card = ChatMessage.create.mock.calls.find(call => call[0].flags?.essence20?.ruleButton)?.[0];
    picks = ['Laser Sight'];
    global.game.user = { id: 'p', isGM: false, character: holder };
    await pressRuleButton({ flags: card.flags, update: jest.fn() }, global.game.user);
    const upgrade = holder.items.contents.find(i => i.name == 'Laser Sight');
    expect(upgrade.system.traits).toEqual(['accurate', 'temperamental']);
    expect(upgrade.flags.essence20.gij3FieldTrials).toBe(true);
    // Once this mission for that member.
    picks = ['Laser Sight'];
    await pressRuleButton({ flags: card.flags, update: jest.fn() }, global.game.user);
    expect(holder.items.contents.filter(i => i.name == 'Laser Sight')).toHaveLength(1);
  });

  test('Early Adopter\'s kit pick (choose answered)', async () => {
    const perk = packItem('earlyAdopter');
    const holder = makeActor([perk], { name: 'Holder' });
    const mate = makeActor([], { name: 'Mate' });
    global.game.actors.push(holder, mate);
    global.game.actors.party = { members: [holder, mate] };
    await use(perk);
    const card = ChatMessage.create.mock.calls.find(call => call[0].flags?.essence20?.ruleButton)?.[0];
    dialogAnswers = ['2'];
    picks = ['Field Kit'];
    global.game.user = { id: 'p', isGM: false, character: mate };
    await pressRuleButton({ flags: card.flags, update: jest.fn() }, global.game.user);
    expect(offered.at(-1)).toEqual(['Field Kit']);
    expect(mate.items.contents.map(i => i.name)).toEqual(['Field Kit']);
    // No teammates: nothing to offer.
    const alone = packItem('earlyAdopter');
    makeActor([alone]);
    global.game.actors.party = { members: [] };
    global.game.actors.length = 0;
    expect(await use(alone)).toContain('no teammates');
  });
});

/* -------------------------------------------- */
/*  Picks                                        */
/* -------------------------------------------- */

describe('We Are One!, Dabbler, Training Evolution, Thick Skin', () => {
  test('We Are One!: up to half Social (rounded up) party mates, two Skills of different Essences', async () => {
    global.CONFIG.E20.skillToEssence = { science: 'smarts', alertness: 'smarts', might: 'strength' };
    const perk = packItem('weAreOne');
    const actor = makeActor([perk], { system: { essences: { social: { max: 3 } }, skills: { science: {}, alertness: {}, might: {} } } });
    const a = makeActor([], { name: 'A' });
    const b = makeActor([], { name: 'B' });
    const c = makeActor([], { name: 'C' });
    global.game.actors.push(actor, a, b, c, { type: 'party', system: { actors: [actor, a, b, c].map(x => ({ uuid: x.uuid })) } });
    dialogAnswers = [[a.uuid, b.uuid, c.uuid]];
    picks = ['science', 'might'];
    await use(perk);
    expect(offered[1]).not.toContain(global.CONFIG.E20.skills?.alertness ?? 'alertness');
    // What the Perk's picked-scope Reroll rule reads to give the team its reroll (rules/conv12-slI12.test.js).
    expect(perk.flags.essence20.rules.choices).toMatchObject({ team: [a.uuid, b.uuid], skillA: 'science', skillB: 'might' });
  });

  test('Dabbler: lower one Rank, raise one of the same Essence (or Spellcasting); undo early or on the Rest', async () => {
    global.CONFIG.E20.skillToEssence = { athletics: 'strength', brawn: 'strength', might: 'strength', science: 'smarts', spellcasting: 'social', conditioning: 'strength' };
    const perk = packItem('dabbler');
    const actor = makeActor([perk], { system: { skills: { athletics: { shift: 'd4' }, brawn: { shift: 'd20' }, might: { shift: 'd12' }, science: { shift: 'd20' }, spellcasting: { shift: 'd20' }, conditioning: { shift: 'd6' } } } });
    picks = ['athletics', 'spellcasting'];
    await use(perk);
    expect(offered[0].sort()).toEqual(['athletics', 'might'].map(k => global.CONFIG.E20.skills?.[k] ?? k).sort());
    expect(offered[1].sort()).toEqual(['brawn', 'spellcasting'].map(k => global.CONFIG.E20.skills?.[k] ?? k).sort());
    expect(actor.system.skills.athletics.shift).toBe('d2');
    expect(actor.system.skills.spellcasting.shift).toBe('d2');
    expect(available(perk)).toEqual(['Undo the swap early (Dabbler)']);
    await fireTriggers(actor, 'rest');
    expect(actor.system.skills.athletics.shift).toBe('d4');
    expect(actor.system.skills.spellcasting.shift).toBe('d20');
    expect(available(perk)).toEqual(['Swap a Skill Rank for the day (Dabbler)']);
    // An older swap (o3Dabbler, moved into the picks by the linking pass) is undone too.
    perk.flags.essence20.o3Dabbler = { lower: 'might', raise: 'brawn' };
    perk.flags.essence20.rules.choices = { lower: 'might', raise: 'brawn' };
    actor.system.skills.might.shift = 'd10';
    actor.system.skills.brawn.shift = 'd2';
    await use(perk);
    expect(actor.system.skills.might.shift).toBe('d12');
    expect(actor.system.skills.brawn.shift).toBe('d20');
    expect(perk.flags.essence20.o3Dabbler).toBeNull();
  });

  test('Training Evolution: an ally\'s weapon - Trained and Specialized with it this mission', async () => {
    const perk = packItem('trainingEvolution');
    const actor = makeActor([perk]);
    const ally = makeActor([makeItem({ name: 'Plasma Rifle', type: 'weapon', flags: { core: { sourceId: 'Compendium.x.Item.plasma' } } })], { name: 'Ally' });
    global.game.actors.push(actor, ally);
    picks = ['Ally', 'Plasma Rifle'];
    await use(perk);
    const plasma = { name: 'Plasma Rifle', type: 'weapon', system: { availability: 'limited' }, flags: { core: { sourceId: 'Compendium.x.Item.plasma' } } };
    expect(ruleRequisitionAccess(actor, plasma)).toBe('trained');
    const mine = makeItem({ name: 'Plasma Rifle', type: 'weapon', flags: { core: { sourceId: 'Compendium.x.Item.plasma' } } });
    mine.parent = actor;
    actor.items.contents.push(mine);
    const effect = makeItem({ type: 'weaponEffect', flags: { essence20: { parentId: mine.id } } });
    effect.parent = actor;
    expect(ruleSpecializes(actor, 'targeting', effect, {})).toBe(true);
    // A new mission ends it.
    global.game.settings = { get: () => 2 };
    expect(ruleRequisitionAccess(actor, plasma)).toBeNull();
    expect(ruleSpecializes(actor, 'targeting', effect, {})).toBe(false);
  });

  test('Thick Skin: a Defense at 7th, a different one at 15th, and the Health effects by level', async () => {
    const perk = packItem('thickSkin');
    const actor = makeActor([perk], { system: { level: 15 } });
    picks = ['evasion', 'willpower'];
    await use(perk);
    expect(offered[1]).not.toContain(global.CONFIG.E20.defenses?.evasion ?? 'evasion');
    const on = perk.effects.filter(effect => !effect.disabled).map(effect => effect.name).sort();
    expect(on).toEqual(['15th Level Health Bonus', '7th Level Health Bonus', 'Evasion Defense Bonus', 'Willpower Defense Bonus'].sort());
    actor.system.level = 8;
    picks = ['toughness'];
    await use(perk);
    expect(perk.effects.filter(effect => !effect.disabled).map(effect => effect.name).sort()).toEqual(['7th Level Health Bonus', 'Toughness Defense Bonus']);
  });
});

describe('Metier, Peak Performance, Nothing Personal, Weather Gear', () => {
  test('Metier: picked when added, renamed; weapons take the Assassin\'s poison step off; Silent training; Weapon Training', async () => {
    const perk = packItem('metier');
    const origin = makeItem({ name: 'Assassin', type: 'origin', flags: { core: { sourceId: 'Compendium.essence20.cobra_codex.Item.HCIbetyFvjJGuDcV' } } });
    origin.effects = [{ disabled: false, changes: [{ key: 'system.poisonTraining' }] }];
    const actor = makeActor([origin, perk], { system: { poisonTraining: 2, trained: { weapons: { silent: false } } } });
    picks = ['silent'];
    await fireTriggers(actor, 'added');
    expect(perk.name).toBe('Metier (E20.G1MetierSilent)');
    expect(available(perk)).toEqual([]);
    eDerived.earlyDerivedStats(actor);
    expect(actor.system.poisonTraining).toBe(1);
    const { ruleDerived } = await import('./adapter.mjs');
    ruleDerived(actor);
    expect(actor.system.trained.weapons.silent).toBe(true);

    const poisons = packItem('metier', { rules: { choices: { metier: 'poisons' } } });
    const keeper = makeActor([origin, poisons], { system: { poisonTraining: 2 } });
    eDerived.earlyDerivedStats(keeper);
    expect(keeper.system.poisonTraining).toBe(2);

    const trainer = packItem('metier');
    const t = makeActor([trainer]);
    picks = ['weaponTraining'];
    await use(trainer);
    const wt = t.items.contents.find(i => i.name == 'Weapon Training');
    expect(wt).toBeDefined();
    expect(wt.flags.essence20.grantedBy).toBeNull();
  });

  test('Peak Performance: the base Role\'s top Perks, once', async () => {
    const perk = packItem('peakPerformance');
    const role = makeItem({ name: 'Officer', type: 'role', system: { items: {
      a: { type: 'perk', subtype: 'role', level: 18, name: 'Momentum', uuid: 'U.momentum' },
      b: { type: 'perk', subtype: 'role', level: 18, name: 'Plan of Action 5', uuid: 'U.plan' },
    } } });
    const actor = makeActor([role, perk]);
    await use(perk);
    expect(actor.items.contents.map(i => i.name)).toContain('Momentum');
    expect(actor.items.contents.map(i => i.name)).not.toContain('Plan of Action 5');
    expect(available(perk)).toEqual([]);
  });

  test('Nothing Personal: the Silencer fitted to a pistol (any weapon with none), once', async () => {
    const perk = packItem('nothingPersonal');
    const pistol = makeItem({ name: 'Heavy Pistol', type: 'weapon' });
    const actor = makeActor([perk, makeItem({ name: 'Rifle', type: 'weapon' }), pistol]);
    picks = ['Heavy Pistol'];
    await use(perk);
    expect(offered[0]).toEqual(['Heavy Pistol']);
    const silencer = actor.items.contents.find(i => i.name == 'Silencer');
    expect(silencer.flags.essence20).toMatchObject({ parentId: pistol.id, q1FreeSilencer: true });
    expect(available(perk)).toEqual([]);
  });

  test('Weather Gear / Acclimating: temperature only, while the armor carrying them is worn', async () => {
    const gear = packItem('weatherGear');
    const armor = makeItem({ name: 'Vest', type: 'armor', system: { equipped: true } });
    gear.flags.essence20.parentId = armor.id;
    const actor = makeActor([armor, gear]);
    picks = ['E20.S1EnvExtremeCold'];
    await use(gear);
    expect(eTypes.ruleHazardProtection(actor, 'extremeCold', { category: 'temperature' })).toBe('Weather Gear');
    expect(eTypes.ruleHazardProtection(actor, 'extremeHeat', { category: 'temperature' })).toBeNull();
    armor.system.equipped = false;
    rebuildIndex(actor);
    expect(eTypes.ruleHazardProtection(actor, 'extremeCold', { category: 'temperature' })).toBeNull();
    const acc = packItem('acclimating');
    const worn = makeItem({ name: 'Coat', type: 'armor', system: { equipped: true } });
    acc.flags.essence20.parentId = worn.id;
    const other = makeActor([worn, acc]);
    expect(eTypes.ruleHazardProtection(other, 'extremeHeat', { category: 'temperature' })).toBe('Acclimating');
    expect(eTypes.ruleHazardProtection(other, 'vacuum', { category: 'breathing' })).toBeNull();
    // A loose upgrade protects nothing.
    const loose = makeActor([packItem('acclimating')]);
    expect(eTypes.ruleHazardProtection(loose, 'extremeHeat', { category: 'temperature' })).toBeNull();
  });
});

/* -------------------------------------------- */
/*  Loops and per-member runs                    */
/* -------------------------------------------- */

describe('In His Image, Camper', () => {
  test('In His Image: a Defeated target, Culture against Toughness without armor, Hang-Ups exchanged, once per target', async () => {
    const rite = packItem('inHisImage');
    makeActor([rite]);
    const foe = makeActor([makeItem({ name: 'Old Fear', type: 'hangUp' }), makeItem({ name: 'Old Greed', type: 'hangUp' })], {
      name: 'Foe', type: 'npc', statuses: ['defeated'], system: { defenses: { toughness: { total: 16, armor: 3 } } },
    });
    global.game.user.targets = new Set([{ actor: foe }]);
    picks = ['Old Fear', 'Grudge', 'Old Greed', 'Fear'];
    await use(rite);
    expect(rollsMade).toEqual([{ skill: 'culture', dif: 13 }]);
    expect(offered[2]).toEqual(['Old Greed']);
    expect(foe.items.contents.map(i => i.name).sort()).toEqual(['Fear', 'Grudge']);
    expect(foe.flags.essence20.o2InHisImage).toBe(true);
    rollsMade.length = 0;
    await use(rite);
    expect(rollsMade).toEqual([]);
    // Not Defeated: no roll.
    const standing = makeActor([], { type: 'npc' });
    global.game.user.targets = new Set([{ actor: standing }]);
    await use(rite);
    expect(rollsMade).toEqual([]);
  });

  test('Camper: at half Health or more; each member heals 1 Health or 2 Essence; ↑1 for the team at camp', async () => {
    const perk = packItem('camper');
    const actor = makeActor([perk], { system: { health: { max: 10, value: 8 } } });
    const both = makeActor([], { name: 'Both', system: { health: { max: 6, value: 4 }, essences: { smarts: { max: 3, value: 1 } } } });
    const healthy = makeActor([], { name: 'Healthy', system: { health: { max: 6, value: 6 } } });
    global.game.actors.push(actor, both, healthy, { type: 'party', system: { actors: [actor, both, healthy].map(x => ({ uuid: x.uuid })) } });
    const answers = [];
    await runUse(perk, pay, { ask: async (step, options) => {
      answers.push(options.map(o => o.label));
      return 0;
    } });
    expect(answers).toEqual([['1 Health', '2 Essence']]);
    expect(actor.system.health.value).toBe(9);
    expect(both.system.health.value).toBe(5);
    expect(healthy.system.health.value).toBe(6);
    const upshift = who => ruleRollSources(who, null, { rolledSkill: 'persuasion' }).sources.filter(s => /Camper/.test(s.label)).reduce((n, s) => n + s.shiftUp, 0);
    rebuildIndex(actor);
    expect(upshift(actor)).toBe(1);
    expect(upshift(both)).toBe(1);
    actor.system.health.value = 4;
    expect(upshift(both)).toBe(0);
    expect(available(perk)).toEqual([]);
  });
});

/* -------------------------------------------- */
/*  Registry rule types                          */
/* -------------------------------------------- */

describe('Misguide, Plow, Training Through Familiarity, Good To Go', () => {
  test('Misguide: a Story Point in combat; Rough Terrain for the creature on its (current or next) turn', async () => {
    const perk = packItem('misguide');
    const actor = makeActor([perk]);
    const foe = makeActor([], { name: 'Foe', type: 'npc' });
    global.game.actors.push(actor, foe);
    expect(available(perk)).toEqual([]);
    global.game.combat = { id: 'c', started: true, round: 2, turn: 0, combatant: { actor }, turns: [{ actor }, { actor: foe }] };
    global.game.user.targets = new Set([{ actor: foe }]);
    registerCheck('outsideEnvironmentOfExpertise', () => false);
    await use(perk);
    expect(foe.flags.essence20.ruleMarks.misguided).toMatchObject({ until: 'endOfNextTurn' });
    expect(eTypes.ruleImposesRoughTerrain({ actor: foe })).toBe(false);
    global.game.combat = { ...global.game.combat, turn: 1, combatant: { actor: foe } };
    expect(eTypes.ruleImposesRoughTerrain({ actor: foe })).toBe(true);
    // On their own turn already: this turn only.
    await use(perk);
    expect(foe.flags.essence20.ruleMarks.misguided).toMatchObject({ until: 'endOfTurn' });
    // Not on yourself.
    global.game.user.targets = new Set([{ actor }]);
    expect(await use(perk)).toContain('Target the creature');
  });

  test('Plow: Ram attacks have Multiple Targets, for its holder or the vehicle it drives', () => {
    const driver = makeActor([packItem('plow')]);
    const ram = { type: 'weaponEffect', system: { isRam: true }, flags: {} };
    expect(eTypes.ruleMultipleTargets(driver, ram)).toBe(true);
    expect(eTypes.ruleMultipleTargets(driver, { type: 'weaponEffect', system: {}, flags: {} })).toBe(false);
    const truck = makeActor([], { type: 'vehicle', system: { actors: { d: { uuid: driver.uuid, vehicleRole: 'driver' } } } });
    global.game.actors.push(driver, truck);
    expect(eTypes.ruleMultipleTargets(truck, ram)).toBe(true);
  });

  test('Kit prerequisites: Training Through Familiarity waives Standard / Limited; Good To Go lowers a Rank', () => {
    global.CONFIG.E20.skillShiftList = ['3d6', '2d8', 'd12', 'd10', 'd8', 'd6', 'd4', 'd2', 'd20'];
    const ttf = makeActor([packItem('ttf')]);
    const out = { need: 'd6' };
    eTypes.ruleKitPrerequisite(ttf, { tier: 'limited' }, out);
    expect(out.need).toBe('d20');
    const restricted = { need: 'd8' };
    eTypes.ruleKitPrerequisite(ttf, { tier: 'restricted' }, restricted);
    expect(restricted.need).toBe('d8');
    const ggo = makeActor([packItem('goodToGo')]);
    const lower = { need: 'd6' };
    eTypes.ruleKitPrerequisite(ggo, {}, lower);
    expect(lower.need).toBe('d4');
    const untouched = { need: 'd6' };
    eTypes.ruleKitPrerequisite(makeActor(), {}, untouched);
    expect(untouched.need).toBe('d6');
  });
});

/* -------------------------------------------- */
/*  Events and small tags                        */
/* -------------------------------------------- */

describe('Junker, Cartography Suite, Lay of the Land, Uniform', () => {
  test('Junker: gear breaking in combat banks one Snag for the next roll', async () => {
    const hangUp = packItem('junker');
    const actor = makeActor([hangUp]);
    global.game.actors.push(actor);
    await eTypes.equipmentBroke();
    expect(actor.flags.essence20.ruleBank).toBeUndefined();
    global.game.combat = { id: 'c' };
    await eTypes.equipmentBroke();
    await eTypes.equipmentBroke();
    expect(actor.flags.essence20.ruleBank).toHaveLength(1);
    expect(ruleRollSources(actor, null, { rolledSkill: 'might' }).sources).toEqual([expect.objectContaining({ snag: true })]);
  });

  test('Cartography Suite / Lay of the Land: the surveyed scene - Move while Surprised (allies within 60 ft too), no Rough Terrain', async () => {
    const scene = { id: 'sc', name: 'Canyon' };
    const perk = packItem('cartography');
    const actor = makeActor([perk, packItem('layOfTheLand')], { token: { parent: scene } });
    expect(ruleMovement(actor).ignoreRoughTerrain).toBeFalsy();
    await use(perk);
    expect(actor.flags.essence20.s2CartographySurvey).toMatchObject({ sceneId: 'sc' });
    rebuildIndex(actor);
    expect(ruleSurpriseModes(actor).has('move')).toBe(true);
    expect(ruleMovement(actor).ignoreRoughTerrain).toBe(true);
    actor.flags.essence20.s2CartographySurvey = { sceneId: 'elsewhere' };
    expect(ruleSurpriseModes(actor).has('move')).toBe(false);
    expect(ruleMovement(actor).ignoreRoughTerrain).toBeFalsy();
  });

  test('Uniform: a switch on rolls against its wearer, ↓1 plus 1 per ally also wearing one', async () => {
    const wearer = makeActor([packItem('uniform')], { name: 'Wearer' });
    const buddy = makeActor([packItem('uniform')], { name: 'Buddy' });
    setWorldLookups({ alliesWithin: actor => (actor === wearer ? [buddy] : []) });
    const roller = makeActor([], { name: 'Detective' });
    global.game.user.targets = new Set([{ actor: wearer }]);
    global.game.user.targets.first = () => ({ actor: wearer });
    const switches = ruleDialogSwitches(roller, { rolledSkill: 'alertness' });
    expect(switches).toHaveLength(1);
    expect(switches[0].value).toBe(false);
    const options = { shiftDown: 0, ext: { [switches[0].name]: true } };
    await applyRuleSwitches(roller, options, { rolledSkill: 'alertness' });
    expect(options.shiftDown).toBe(2);
    global.game.user.targets = new Set([{ actor: roller }]);
    global.game.user.targets.first = () => ({ actor: roller });
    expect(ruleDialogSwitches(makeActor(), { rolledSkill: 'alertness' })).toEqual([]);
    setWorldLookups({ alliesWithin: null });
  });
});

describe('Revengeful, Yo Joe!, Inspirational Leader, Sensitive', () => {
  test('Revengeful: a damaging hit marks the attacker - ↑1 on attacks against them, a Story Point for Defeating them', async () => {
    const perk = packItem('revengeful');
    const actor = makeActor([perk]);
    const foe = makeActor([], { name: 'Foe', type: 'npc' });
    const other = makeActor([], { name: 'Other', type: 'npc' });
    global.game.actors.push(actor, foe, other);
    const attack = { type: 'weaponEffect', system: { classification: { style: 'melee' } }, flags: {} };
    await fireTriggers(actor, 'targeted', { outcome: 'success', facts: { results: [{ success: true, damageValue: 0 }] }, targets: [foe] });
    expect(ruleRollSources(actor, foe, { item: attack }).sources).toEqual([]);
    await fireTriggers(actor, 'targeted', { outcome: 'success', facts: { results: [{ success: true, damageValue: 2 }] }, targets: [foe] });
    expect(ruleRollSources(actor, foe, { item: attack }).sources).toEqual([expect.objectContaining({ label: 'Revengeful', shiftUp: 1 })]);
    expect(ruleRollSources(actor, other, { item: attack }).sources).toEqual([]);
    expect(ruleRollSources(actor, foe, { rolledSkill: 'persuasion' }).sources).toEqual([]);
    // The latest attacker takes the mark over.
    await fireTriggers(actor, 'targeted', { outcome: 'success', facts: { results: [{ success: true, damageValue: 1 }] }, targets: [other] });
    expect(ruleRollSources(actor, foe, { item: attack }).sources).toEqual([]);
    expect(ruleRollSources(actor, other, { item: attack }).sources).toHaveLength(1);
    ChatMessage.create.mockClear();
    await fireTriggers(actor, 'defeatedEnemy', { targets: [other] });
    expect(ChatMessage.create.mock.calls.some(call => /revenge/.test(call[0].content))).toBe(true);
    ChatMessage.create.mockClear();
    await fireTriggers(actor, 'defeatedEnemy', { targets: [foe] });
    expect(ChatMessage.create).not.toHaveBeenCalled();
  });

  test('Yo Joe!: +10 ft ground in round 1 until a Standard action is spent', () => {
    const actor = makeActor([packItem('yoJoe')], { system: { movement: { ground: { total: 30 } } } });
    let ledger = { standard: 0 };
    setWorldLookups({ actionLedger: () => ledger });
    global.game.combat = { round: 1, started: true, combatants: [{ actor, actorId: actor.id }] };
    eDerived.derivedMovement(actor);
    expect(actor.system.movement.ground.total).toBe(40);
    actor.system.movement.ground.total = 30;
    ledger = { standard: 1 };
    eDerived.derivedMovement(actor);
    expect(actor.system.movement.ground.total).toBe(30);
    ledger = { standard: 0 };
    global.game.combat.round = 2;
    eDerived.derivedMovement(actor);
    expect(actor.system.movement.ground.total).toBe(30);
    setWorldLookups({ actionLedger: null });
  });

  test('Inspirational Leader: a success in combat gives allies ↑1 on that Skill this round', async () => {
    const perk = packItem('inspirational');
    const leader = makeActor([perk], { name: 'Leader' });
    const ally = makeActor([], { name: 'Ally' });
    const foe = makeActor([], { name: 'Foe', type: 'npc' });
    global.game.actors.push(leader, ally, foe);
    global.game.combat = { id: 'c', started: true, round: 2, turn: 0 };
    await fireTriggers(leader, 'afterRoll', { outcome: 'success', facts: { results: [{ success: true }] }, vars: { skill: 'might' } });
    rebuildIndex(leader);
    const up = (who, skill) => ruleRollSources(who, null, { rolledSkill: skill }).sources.filter(s => /Inspired/.test(s.label)).length;
    expect(up(ally, 'might')).toBe(1);
    expect(up(ally, 'finesse')).toBe(0);
    expect(up(leader, 'might')).toBe(0);
    expect(up(foe, 'might')).toBe(0);
    global.game.combat = { ...global.game.combat, round: 3 };
    expect(up(ally, 'might')).toBe(0);
    // A failure inspires no one.
    await fireTriggers(leader, 'afterRoll', { outcome: 'failure', facts: { results: [{ success: false }] }, vars: { skill: 'athletics' } });
    expect(up(ally, 'athletics')).toBe(0);
  });

  test('Sensitive: damage banks a Snag; a Detail Oriented use ignores it for the round', async () => {
    const hangUp = packItem('sensitive');
    const actor = makeActor([hangUp, makeItem({ name: 'Detail Oriented', type: 'perk', flags: { core: { sourceId: 'Compendium.essence20.mlp_crb.Item.FBIg9BWG2CyjqgBP' } } })]);
    global.game.combat = { id: 'c1', started: true, round: 2, turn: 0 };
    await fireTriggers(actor, 'takesDamage', { damage: { amount: 2 }, roll: { damageAmount: 2 } });
    expect(ruleRollSources(actor, null, { rolledSkill: 'might' }).sources).toEqual([expect.objectContaining({ snag: true })]);
    await use(hangUp);
    expect(actor.flags.essence20.ruleBank).toEqual([]);
    expect(actor.flags.essence20.actionPerkDailyUses.detailOriented).toBe(1);
    await fireTriggers(actor, 'takesDamage', { damage: { amount: 2 }, roll: { damageAmount: 2 } });
    expect(actor.flags.essence20.ruleBank).toEqual([]);
    // Three uses a day; none without the Perk.
    actor.flags.essence20.actionPerkDailyUses.detailOriented = 3;
    expect(available(hangUp)).toEqual([]);
    const plain = packItem('sensitive');
    makeActor([plain]);
    expect(available(plain)).toEqual([]);
  });
});

/* -------------------------------------------- */
/*  Legacy marks                                 */
/* -------------------------------------------- */

describe('Fresh Mark / Natural Style - the old memories become marks', () => {
  test('d22Deceived / d22Met move onto the creatures as this holder\'s marks', () => {
    const fresh = packItem('freshMark');
    const natural = packItem('naturalStyle');
    const holder = makeActor([fresh, natural], { flags: { d22Deceived: ['c1'], d22Met: { c1: 1, c2: 0 } } });
    const c1 = makeActor([], { id: 'c1' });
    const c2 = makeActor([], { id: 'c2' });
    global.game.actors.push(holder, c1, c2);
    const moves = eLegacy.legacyMarkMoves(holder);
    const on = actor => Object.assign({}, ...moves.filter(m => m.doc === actor).map(m => m.update));
    expect(Object.keys(on(c1)).sort()).toEqual([`flags.essence20.ruleMarks.freshMarkDeceived--${holder.id}`, `flags.essence20.ruleMarks.naturalStyleMet--${holder.id}`, `flags.essence20.ruleMarks.naturalStyleMetHere--${holder.id}`].sort());
    expect(Object.keys(on(c2))).toEqual([`flags.essence20.ruleMarks.naturalStyleMet--${holder.id}`]);
    expect(on(c1)[`flags.essence20.ruleMarks.naturalStyleMetHere--${holder.id}`]).toMatchObject({ by: holder.uuid, until: 'scene' });
  });
});
