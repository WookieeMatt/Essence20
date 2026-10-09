import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Book check, effects group (docs/rules-batches/book-effects.md): items whose rules now follow the rulebook where the old
 * code, the automation notes and the book disagreed. Each item is loaded from its pack source. (Items whose old tests
 * were updated in place: Growl - conv16-LeftA; Catch Off Guard, Might Makes Right, Menacing Glare - conv14-dice;
 * Avalanche Stomp - conv15-banked; Ground and Pound - conv15-systems; Constrictor, Shaped Charges - conv15-uses; the
 * Mutations' Beast Mode copies - conv15-items1; Favorite Command - conversions; Not On My Watch - conv9-slD9 and
 * mechanics/combat/combat.test.js.)
 */

global.Hooks = { on: () => 0, once: () => 0, callAll: () => {} };

const dealt = [];
jest.unstable_mockModule('./mechanics/combat/combat.mjs', () => ({
  applyDamage: jest.fn(async (actor, amount, type, isCrit, options) => dealt.push({ name: actor.name, amount, type, options })),
}));
// pick steps answer from `values` (a select's value).
let values = [];
jest.unstable_mockModule('./mechanics/resources/grants.mjs', () => ({
  chooseSelect: jest.fn(async () => values.shift() ?? null),
  chooseButtons: jest.fn(async () => null),
  rollTest: jest.fn(async () => ({ success: true })),
  findItems: jest.fn(async () => []),
  pickOne: jest.fn(async () => null),
}));
jest.unstable_mockModule('./mechanics/world/gm-relay.mjs', () => ({ needsGmRelay: () => false, relayToGm: jest.fn() }));
const timed = [];
jest.unstable_mockModule('./mechanics/combat/timed-status.mjs', () => ({
  applyTimedCondition: jest.fn(async (actor, status, rounds) => {
    timed.push({ name: actor.name, status, rounds });
    actor.statuses.add(status);
  }),
}));
// Allies the system way (getNearbyAllyTokens): same disposition, within range on the test canvas.
jest.unstable_mockModule('./mechanics/combat/nearby-allies.mjs', () => ({
  getNearbyAllyTokens: jest.fn((actor, feet) => canvas.tokens.placeables.filter(token => token.actor !== actor
    && token.document.disposition == actor.token?.document?.disposition && Math.abs(token.center.x - actor.token.center.x) <= feet)),
  getAllNearbyTokens: jest.fn(() => []),
  pickAllyTargets: jest.fn(async (actor, candidates, title, max) => candidates.slice(0, max)),
}));

await import('./plugins/index.mjs');
const { rebuildIndex } = await import('./index.mjs');
const { fireTriggers, runUse } = await import('./triggers.mjs');
const { ruleDerived, ruleDialogSwitches, ruleRollSources } = await import('./adapter.mjs');
const { validateRule } = await import('./types.mjs');
const { contextFor, evaluate, toggleOf } = await import('./predicate.mjs');
const { firstOnHost } = await import('./plugins/book/effects.mjs');
const { bankedEntries } = await import('./bank.mjs');
const { lateDefenseAdjust } = await import('./plugins/combat/defense-modes.mjs');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));
const P = {
  meatShield: 'sssitems/_source/Meat_Shield_hYwFDsC7azfYB5fO.json',
  animalGait: 'ccitems/_source/Animal_Gait_gWjcSPeqNe1h8rwZ.json',
  betterYou: 'fmmcitems/_source/Better_You_Than_Me_u0vF75YLcwdyY8pv.json',
  acting: 'mlpcrbitems/_source/Acting__oA8DrnUOOqc1mrd0.json',
  heart: 'gijcrbitems/_source/Heart_Of_The_Team_ME4xFG31XvT6q6Qp.json',
  decon: 'qgtgitems/_source/Deconstructionist_2qb5dV11qvWsN4xJ.json',
  catchOffGuard: 'sssitems/_source/Catch_Off_Guard_qplsg3JI3kmUCtU9.json',
  mightMakesRight: 'dditems/_source/Might_Makes_Right_lIiVbzESbPpV7Egu.json',
  iceEffect: 'fmmcitems/_source/Ice_Flechettes_Effect_vMoq7coIwWqEaTFI.json',
  iceAlternate: 'fmmcitems/_source/Ice_Flechettes_Alternate_Effect_5Y2brpJu5M8M0HV0.json',
  avalancheEffect: 'fmmcitems/_source/Avalanche_Stomp_Effect_C3dsyh98mb4TDW9o.json',
  avalanche: 'fmmcitems/_source/Avalanche_Stomp_NyK58rUo6jiwX5Aq.json',
  groundAndPound: 'ghpfitems/_source/Ground_and_Pound_2qdpoSqrOeBhWF1C.json',
  hydraulic: 'qgtgitems/_source/Hydraulic_Bounce_0yRAH39SEINP3CGT.json',
  energon: 'dditems/_source/Solid_State_Energon_aUxtcuKUb40JYoqx.json',
  munitions: 'eocitems/_source/Personnel_Munitions_Pack_CXenUI5l8c3WZNSw.json',
  terror: 'bthitems/_source/Terror_yBBB0Mi6fr84YcSd.json',
  glare: 'bthitems/_source/Menacing_Glare_eWlflRHYAVB9p5Z0.json',
  menace: 'bthitems/_source/Absolute_Menace_YsoS30FKigTm19CH.json',
  constrictor: 'ccitems/_source/Constrictor_S63cNsFogI1Ahh2C.json',
  notOnMyWatch: 'iafav2items/_source/Not_On_My_Watch_xH3iQ0NcXp1eFO35.json',
  favoriteWtnv: 'wtnvcgitems/_source/Favorite_Command_GeHPKfuWe24HpYcQ.json',
  innerMagic: 'mlpcrbitems/_source/Inner_Magic_E6GWRHzP9tOAxQP6.json',
  deadlyGij: 'gijcrbitems/_source/Deadly_hd1O6anmtNcyjpw9.json',
  deadlyTf: 'tfcrbitems/_source/Deadly_hd1O6anmtNcyjpw9.json',
  lingeringGij: 'gijcrbitems/_source/Lingering_LyOKEFZd8vriKLOs.json',
  lingeringTf: 'tfcrbitems/_source/Lingering_LyOKEFZd8vriKLOs.json',
  chrono: 'jttitems/_source/Chrono_Trigger_eFsOmJPMyuUHhcQD.json',
  shaped: 'gijcrbitems/_source/Shaped_Charges_xFMzM5pycDmmw4u3.json',
  evasive: 'qgtgitems/_source/Evasive_Handling_MRoi8QxW568uiCir.json',
  engrafted: 'ccitems/_source/Engrafted_Mutation_zuR9YJ2Wy956VGGy.json',
  evolving: 'ccitems/_source/Evolving_Mutation_7cL4aUwJwqvbhYCz.json',
  outright: 'ccitems/_source/Outright_Mutation_RcGUjeMpsNDFjwmL.json',
  growl: 'ccitems/_source/Growl_OSVtPXBdRmZ2C4PD.json',
  deadstick: 'qgtgitems/_source/Deadstick_SDwpvAzQX0pYSHyc.json',
};

let nextId = 1;
const getPath = (object, key) => String(key).split('.').reduce((o, k) => (o === null || o === undefined ? o : o[k]), object);
const setPath = (object, key, value) => {
  const keys = key.split('.');
  const last = keys.pop();
  keys.reduce((o, k) => (o[k] ??= {}), object)[last] = value;
};

async function applyUpdate(doc, data) {
  for (const [key, value] of Object.entries(data)) {
    setPath(doc, key, value);
  }

  rebuildIndex(doc.documentName == 'Actor' ? doc : doc.parent);
}

/** An item from a pack source file (its own rules), with its compendium id as its source. */
function packItem(key, extra = {}) {
  const doc = fromPack(P[key]);
  return {
    name: doc.name, type: doc.type, system: JSON.parse(JSON.stringify(doc.system)), ...extra,
    flags: { core: { sourceId: `Compendium.essence20.x.Item.${doc._id}` }, essence20: { ...(extra.flags ?? {}) } },
  };
}

function makeActor(name, { items = [], x = 0, disposition = 1, system = {}, statuses = [], type = 'playerCharacter', tags = '' } = {}) {
  const list = [];
  const actor = {
    id: `a${nextId++}`, name, type, documentName: 'Actor', isOwner: true, statuses: new Set(statuses), flags: { essence20: {} },
    system: {
      level: 5, size: 'common', creatureTags: tags, health: { value: 8, max: 10, bonus: 0 }, powers: { personal: { value: 3, max: 3 } }, skills: {},
      defenses: { toughness: { total: 12, value: 12 }, evasion: { total: 12, value: 12 }, willpower: { total: 12 }, cleverness: { total: 12 } },
      resistances: {}, immunities: {}, ...system,
    },
    async update(data) {
      await applyUpdate(this, data);
    },
    getFlag(scope, key) {
      return getPath(this.flags?.[scope], key);
    },
    async setFlag(scope, key, value) {
      setPath(this.flags, `${scope}.${key}`, value);
    },
    async unsetFlag(scope, key) {
      delete this.flags?.[scope]?.[key];
    },
    toggleStatusEffect: jest.fn(async function (status, { active }) {
      if (active) {
        this.statuses.add(status);
      } else {
        this.statuses.delete(status);
      }
    }),
    _dice: { rollSkill: jest.fn(async () => ({ success: true, outcomes: [] })) },
  };
  actor.uuid = `Actor.${actor.id}`;
  const token = { id: `t${actor.id}`, actor, document: { disposition }, center: { x, y: 0 } };
  actor.getActiveTokens = () => [token];
  actor.token = token;
  actor.items = {
    contents: list, get: id => list.find(item => item.id == id), find: fn => list.find(fn), some: fn => list.some(fn), filter: fn => list.filter(fn),
    [Symbol.iterator]: () => list[Symbol.iterator](),
  };
  actor.addItem = data => {
    const item = { effects: [], ...data, id: `i${nextId++}`, async update(changes) {
      await applyUpdate(this, changes);
    } };
    item.uuid = `${actor.uuid}.Item.${item.id}`;
    item.flags ??= {};
    item.flags.essence20 ??= {};
    item.parent = item.actor = actor;
    list.push(item);
    rebuildIndex(actor);
    return item;
  };

  items.forEach(data => actor.addItem(data));
  game.actors.contents.push(actor);
  canvas.tokens.placeables.push(token);
  return actor;
}

const itemNamed = (actor, name) => actor.items.contents.find(item => item.name == name);
function target(...actors) {
  game.user.targets = new Set(actors.map(actor => actor.token));
  game.user.targets.first = () => actors[0]?.token;
}

let picks = [];
const paid = [];
const pay = jest.fn(async action => paid.push(action) > 0);
const use = (item, which = null) => runUse(item, pay, {
  ask: async () => picks.shift() ?? 0,
  ...(which === null ? {} : { pick: async (it, available) => available.find(({ rule }) => rule.label == which) ?? null }),
});
const startCombat = (round = 1, turn = 0, actors = []) => {
  const turns = actors.map(actor => ({ actor, actorId: actor.id }));
  game.combat = { id: 'c1', started: true, round, turn, turns, combatants: turns };
  game.combats = { get: id => (id == 'c1' ? game.combat : null) };
};

beforeEach(() => {
  dealt.length = 0;
  timed.length = 0;
  paid.length = 0;
  picks = [];
  values = [];
  global.game = {
    combat: null, combats: null, user: { id: 'u', isGM: true, isActiveGM: true, targets: new Set() }, users: { contents: [] },
    i18n: { localize: k => k, format: (k, d) => `${k}${d ? ` ${JSON.stringify(d)}` : ''}`, has: () => false },
    settings: { get: () => 1, set: async () => {} }, actors: { contents: [], get: id => game.actors.contents.find(a => a.id == id) },
    scenes: { active: null },
  };
  game.user.targets.first = () => undefined;
  global.CONFIG = { E20: { damageTypes: { blunt: 'Blunt', void: 'Void' }, skillToEssence: { intimidation: 'strength', technology: 'smarts' }, skills: {}, actorSizes: { small: 's', common: 'c', large: 'l' } } };
  global.canvas = { scene: null, tokens: { placeables: [], controlled: [], setTargets: jest.fn() }, grid: { measurePath: ([a, b]) => ({ distance: Math.abs(a.x - b.x) }) } };
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn(), error: jest.fn() } };
  global.ChatMessage = { create: jest.fn(async data => data), getSpeaker: () => ({}) };
  global.fromUuidSync = uuid => game.actors.contents.find(actor => actor.uuid == uuid)
    ?? game.actors.contents.flatMap(actor => actor.items.contents).find(item => item.uuid == uuid) ?? null;
  global.fromUuid = async uuid => global.fromUuidSync(uuid);
  global.foundry = {
    data: { operators: { ForcedDeletion: globalThis.foundry?.data?.operators?.ForcedDeletion ?? class ForcedDeletion {} } }, utils: { getProperty: getPath, setProperty: setPath, hasProperty: (o, k) => getPath(o, k) !== undefined, deepClone: v => JSON.parse(JSON.stringify(v)), randomID: () => `r${nextId++}` },
    applications: { api: { DialogV2: { wait: jest.fn(async () => null), prompt: jest.fn(async () => null), confirm: jest.fn(async () => true) } } },
  };
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('every rule on the checked items validates', () => {
  for (const [key, file] of Object.entries(P)) {
    for (const rule of fromPack(file).system.rules ?? []) {
      expect([key, rule.label, validateRule(rule)]).toEqual([key, rule.label, []]);
    }
  }
});

describe('Meat Shield: Free action until your next turn, shared within Reach from 5th, Resistance at 13th, immunity at 18th', () => {
  // The bonus is a per-attack addAfter Defense (stack meatShield - the best one counts), read by dice.mjs.
  const defenseOf = actor => 12 + lateDefenseAdjust(null, actor, 'toughness', {});

  test('5th level: a Free action, +4 until the start of your next turn; an ally within 5 ft gets it too', async () => {
    const tank = makeActor('Tank', { items: [packItem('meatShield')], x: 0 });
    const near = makeActor('Near', { x: 5 });
    const far = makeActor('Far', { x: 10 });
    startCombat(1, 0, [tank, near, far]);
    await use(itemNamed(tank, 'Meat Shield'), 'Switch Meat Shield on');
    expect(paid).toEqual(['free']);
    const perk = itemNamed(tank, 'Meat Shield');
    expect(toggleOf(perk, 'on')).toBe(true);
    expect([defenseOf(tank), defenseOf(near), defenseOf(far)]).toEqual([16, 16, 12]);
    // The start of the holder's next turn ends it.
    game.combat.round = 2;
    expect(toggleOf(perk, 'on')).toBe(false);
  });

  test('4th level: no sharing; 7th level: the permanent +2 without the Use', async () => {
    const low = makeActor('Low', { items: [packItem('meatShield')], x: 0, system: { level: 4 } });
    const near = makeActor('Near', { x: 5 });
    await use(itemNamed(low, 'Meat Shield'), 'Switch Meat Shield on');
    expect(defenseOf(near)).toBe(12);
    const seven = makeActor('Seven', { items: [packItem('meatShield')], x: 100, system: { level: 7 } });
    expect(defenseOf(seven)).toBe(14);
  });

  test('13th level: picks a damage type to resist while it lasts; 18th: one immunity and every other Resistance', async () => {
    const tank = makeActor('Tank', { items: [packItem('meatShield')], system: { level: 13 } });
    const perk = itemNamed(tank, 'Meat Shield');
    values = ['fire'];
    await use(perk, 'Switch Meat Shield on');
    ruleDerived(tank);
    expect(tank.system.resistances).toEqual({ fire: true });

    const titan = makeActor('Titan', { items: [packItem('meatShield')], system: { level: 18 } });
    const big = itemNamed(titan, 'Meat Shield');
    values = ['sharp'];
    await use(big, 'Switch Meat Shield on');
    ruleDerived(titan);
    expect(titan.system.immunities).toEqual({ sharp: true });
    expect(titan.system.resistances.sharp).toBeUndefined();
    expect(titan.system.resistances.fire && titan.system.resistances.blunt && titan.system.resistances.void).toBe(true);
  });
});

test('Animal Gait: a Standard action, one Movement type, until the end of your turn', async () => {
  const guerilla = makeActor('Guerilla', { items: [packItem('animalGait')] });
  const gait = itemNamed(guerilla, 'Animal Gait');
  startCombat(1, 0, [guerilla]);
  values = ['climb'];
  await use(gait, 'Switch Animal Gait on');
  expect(paid).toEqual(['standard']);
  expect(gait.flags.essence20.rules.choices.gait).toBe('climb');
  expect(toggleOf(gait, 'on')).toBe(true);
  game.combat.turn = 1;
  expect(toggleOf(gait, 'on')).toBe(false);
});

test('Better You Than Me: 1 Void damage nothing reduces to the touched ally, 1 Health back', async () => {
  const clone = makeActor('Clone', { items: [packItem('betterYou')] });
  const ally = makeActor('Ally');
  target(ally);
  await use(itemNamed(clone, 'Better You Than Me'));
  expect(dealt).toEqual([{ name: 'Ally', amount: 1, type: 'void', options: { unreducible: true } }]);
  expect([clone.system.health.value, clone.system.powers.personal.value]).toEqual([9, 2]);
});

test('Acting!: a Roll Options Dialog switch on Persuasion / Deception / Infiltration - 1 Cheer to roll Performance', () => {
  const pony = makeActor('Pony', { items: [packItem('acting'), { name: 'Cheer Points', type: 'rolePoints', system: { resource: { value: 1, max: 3 } } }], system: { skills: { performance: { shift: 'd6' }, deception: { shift: 'd2' } } } });
  const offered = skill => ruleDialogSwitches(pony, { rolledSkill: skill }).map(s => s.entry.rule);
  expect(offered('athletics')).toEqual([]);
  const [rule] = offered('deception');
  expect(rule).toEqual(expect.objectContaining({ useSkill: 'performance', cost: { resource: { rolePoints: 'Cheer Points' }, amount: 1 } }));
});

test('Heart Of The Team and Inner Magic take a Standard action', async () => {
  const leader = makeActor('Leader', { items: [packItem('heart'), packItem('innerMagic')], system: { level: 14 } });
  game.party = null;
  await use(itemNamed(leader, 'Inner Magic'));
  expect(paid).toEqual(['standard']);
  expect(itemNamed(leader, 'Heart Of The Team').system.rules[0].cost).toEqual(expect.objectContaining({ action: 'standard', resource: { storyPoints: true } }));
});

test('Deconstructionist: a success banks a Snag on every test the target makes until the end of its next turn', async () => {
  const tech = makeActor('Tech', { items: [packItem('decon')] });
  // A Computerized vehicle (book check follow-ups 2: the equipment must be Computerized).
  const truck = makeActor('Truck', { type: 'vehicle', disposition: -1, system: { traits: { computerized: true } } });
  startCombat(1, 0, [tech, truck]);
  await fireTriggers(tech, 'hit', { roll: { rolledSkill: 'technology', switches: ['deconstructionist'] }, outcome: 'success', targets: [truck], facts: { results: [{ success: true }] } });
  expect(bankedEntries(truck).map(entry => [entry.snag, entry.uses, entry.until])).toEqual([[true, 99, 'endOfNextTurnOrScene']]);
});

test('Hydraulic Bounce reaches the driver (scope pilot), not the whole crew; Evasive Handling halves Aerial only once', () => {
  expect(fromPack(P.hydraulic).system.rules[0].scope).toBe('pilot');
  expect(fromPack(P.evasive).system.rules.filter(rule => rule.type == 'Movement').map(rule => rule.movement)).toEqual(['ground', 'swim']);
});

describe('Terror from Menacing Glare / Absolute Menace with Edge', () => {
  const darkRanger = () => makeActor('Dark', {
    items: [packItem('terror'), packItem('glare'), packItem('menace'), { name: 'Terror Points', type: 'rolePoints', system: { resource: { value: 0, max: 3 } } }],
  });
  const terrorOf = actor => itemNamed(actor, 'Terror Points').system.resource.value;

  test('Menacing Glare\'s Frightened with Edge gives 1 Terror; without Edge, or another effect, none', async () => {
    const dark = darkRanger();
    const foe = makeActor('Foe', { disposition: -1 });
    const glareHit = (edge, option) => {
      picks = [option];
      return fireTriggers(dark, 'hit', { roll: { rolledSkill: 'intimidation', switches: ['menacingGlare'], ...(edge === null ? {} : { edge }) }, outcome: 'success', targets: [foe], facts: { results: [{ success: true }] }, ask: async () => option });
    };

    await glareHit(false, 2);
    await glareHit(null, 2);
    expect(terrorOf(dark)).toBe(0);
    await glareHit(true, 0);
    expect(terrorOf(dark)).toBe(0);
    await glareHit(true, 2);
    expect(terrorOf(dark)).toBe(1);
    expect(foe.statuses.has('frightened')).toBe(true);
  });

  test('Absolute Menace\'s roll carries its flag; a hit with Edge gives 1 Terror (a Frighten-immune target none)', async () => {
    const dark = darkRanger();
    expect(itemNamed(dark, 'Absolute Menace').system.rules[0].steps.find(step => step.do == 'rollVsEach').dataset).toEqual({ absoluteMenace: true });
    const foe = makeActor('Foe', { disposition: -1 });
    const menaceHit = edge => fireTriggers(dark, 'hit', { roll: { rolledSkill: 'intimidation', dataset: { absoluteMenace: true }, edge }, outcome: 'success', targets: [foe], facts: { results: [{ success: true }] } });
    await menaceHit(false);
    expect(terrorOf(dark)).toBe(0);
    await menaceHit(true);
    expect(terrorOf(dark)).toBe(1);
  });
});

describe('rule:firstOnHost (Deadly, Lingering, Chrono-Trigger count once per weapon)', () => {
  test('a second copy on the same weapon is not first; a copy on another weapon is', () => {
    const joe = makeActor('Joe');
    const rifle = joe.addItem({ name: 'Rifle', type: 'weapon', system: {} });
    const pistol = joe.addItem({ name: 'Pistol', type: 'weapon', system: {} });
    const deadly = host => joe.addItem({ ...packItem('deadlyGij'), flags: { core: { sourceId: 'Compendium.essence20.gi_joe_crb.Item.hd1O6anmtNcyjpw9' }, essence20: { parentId: host.id } } });
    const [a, b, c] = [deadly(rifle), deadly(rifle), deadly(pistol)];
    expect([firstOnHost(a), firstOnHost(b), firstOnHost(c)]).toEqual([true, false, true]);
    const ask = item => evaluate(['rule:firstOnHost'], contextFor({ self: joe, ruleItem: item }));
    expect([ask(a), ask(b), ask(c)]).toEqual([true, false, true]);
    expect(firstOnHost({ name: 'Loose', flags: {} })).toBe(true);
    for (const key of ['deadlyGij', 'deadlyTf', 'lingeringGij', 'lingeringTf', 'chrono']) {
      const rules = fromPack(P[key]).system.rules.filter(rule => rule.type != 'AttackCount');
      expect([key, rules.every(rule => rule.when.includes('rule:firstOnHost'))]).toEqual([key, true]);
    }
  });

  test('Chrono-Trigger: two copies on one sidearm give ↓2, not ↓4', () => {
    const ranger = makeActor('Ranger');
    const gun = ranger.addItem({ name: 'Chrono Blaster', type: 'weapon', system: { equipped: true } });
    const shot = ranger.addItem({ name: 'Shot', type: 'weaponEffect', system: {}, flags: { essence20: { parentId: gun.id } } });
    for (let i = 0; i < 2; i++) {
      ranger.addItem({ ...packItem('chrono'), flags: { core: { sourceId: 'Compendium.essence20.jump_through_time.Item.eFsOmJPMyuUHhcQD' }, essence20: { parentId: gun.id } } });
    }

    const down = ruleRollSources(ranger, null, { item: shot, dataset: {} }).sources.reduce((n, s) => n + (Number(s.shiftDown) || 0), 0);
    expect(down).toBe(2);
  });
});

test('armor is ignored once: an outgoing ignoreArmor rule (Charge It Up!) takes nothing more off a Defense dice.mjs already worked out without armor (Armor Piercing)', async () => {
  const { ignoreArmorAdjust } = await import('./plugins/combat/ignore-armor.mjs');
  const ranger = makeActor('Ranger', { items: [{ name: 'Charge', type: 'perk', system: { rules: [{ type: 'Defense', label: 'Charge', defense: 'any', mode: 'ignoreArmor', armor: 'defense', outgoing: true }] } }] });
  const foe = makeActor('Foe', { disposition: -1 });
  foe.system.defenses.toughness.armor = 3;
  expect(ignoreArmorAdjust(ranger, foe, 'toughness', {})).toBe(-3);
  expect(ignoreArmorAdjust(ranger, foe, 'toughness', { armorIgnored: true })).toBe(0);
});

test('nanomite gear: the linked Power\'s lasting rules run as the gear\'s, and using it switches them on the gear', async () => {
  const { gearPowerRules } = await import('./plugins/book/effects.mjs');
  const { firePowerUsed } = await import('./plugins/resources/power-used.mjs');
  const doc = fromPack('qgtgitems/_source/Protection_IF9v9C3tCJSQYRjd.json');
  const uuid = `Compendium.essence20.qgtg.Item.${doc._id}`;
  const power = { uuid, name: doc.name, type: 'power', system: JSON.parse(JSON.stringify(doc.system)), parent: null };
  const lookup = id => (id == uuid ? power : null);
  expect(gearPowerRules({ type: 'gear', system: { nanomite: { powerUuid: uuid } } }, lookup).map(rule => rule.type)).toEqual(['Defense']);
  expect(gearPowerRules({ type: 'weapon', system: { nanomite: { powerUuid: uuid } } }, lookup)).toEqual([]);

  const viper = makeActor('Viper');
  const vest = viper.addItem({ name: 'Nanomite Vest', type: 'gear', system: { nanomite: { powerUuid: uuid, uses: 2, spent: 0 }, rules: gearPowerRules({ type: 'gear', system: { nanomite: { powerUuid: uuid } } }, lookup) } });
  expect(lateDefenseAdjust(null, viper, 'toughness', {})).toBe(0);
  await firePowerUsed(viper, power, 0);
  expect(toggleOf(vest, 'boost')).toBe(true);
  expect(power.flags).toBeUndefined();
  expect(lateDefenseAdjust(null, viper, 'toughness', {})).toBe(1);
});

test('tags roll:noEdge and target:withinReach', () => {
  const joe = makeActor('Joe', { x: 0 });
  const near = makeActor('Near', { x: 5 });
  const far = makeActor('Far', { x: 15 });
  expect([true, false, undefined].map(edge => evaluate(['roll:noEdge'], contextFor({ self: joe, edge })))).toEqual([false, true, true]);
  expect([near, far].map(other => evaluate(['target:withinReach'], contextFor({ self: joe, other })))).toEqual([true, false]);
  joe.getActiveTokens = () => [];
  expect(evaluate(['target:withinReach'], contextFor({ self: joe, other: far }))).toBe(true);
});

test('Deadstick: only a robot within 100 ft - anything else stops before the Standard action is paid', async () => {
  const tech = makeActor('Tech', { items: [packItem('deadstick')], x: 0 });
  const human = makeActor('Human', { disposition: -1, x: 20 });
  const farBot = makeActor('Far Bot', { disposition: -1, x: 150, tags: 'robot' });
  const bot = makeActor('Bot', { disposition: -1, x: 50, tags: 'android' });
  const deadstick = itemNamed(tech, 'Deadstick');
  for (const foe of [human, farBot]) {
    target(foe);
    expect(await use(deadstick)).toContain('Deadstick only works on a robot within 100 ft.');
  }

  expect(paid).toEqual([]);
  target(bot);
  await use(deadstick);
  expect(paid).toEqual(['standard']);
});

test('the automation notes no longer leave the book\'s automated parts to the table', () => {
  const notes = key => fromPack(P[key]).system.automation.notes;
  expect(notes('innerMagic')).not.toContain('Left to the table');
  expect(notes('iceEffect')).toContain('Critical Success');
  expect(notes('avalancheEffect')).not.toContain('Left to the table');
  expect(notes('energon')).not.toContain('Either way');
  expect(notes('munitions')).toContain('your own');
  expect(notes('favoriteWtnv')).toContain('on the pet');
});
