import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Round 18, convA (docs/rules-batches/slConvA18.md): Gallantry, Fighting Style's Trigger Happy, Brutal Might, Impenetrable
 * Armor, Stand Behind Me!, Concentrated Fire and Dominate's held use, on their own rules. Each is loaded from its pack
 * source and must do what the removed code (and its old tests in dice.test.js, documents/item.test.js,
 * items/defenses/interpose-attack.test.js, items/tests/lightspeed-spectrum-time-displaced.test.js and
 * rules/conv15-banked.test.js) did - with the book's durations where the book disagreed.
 */

global.Hooks = { on: jest.fn(), once: () => 0, callAll: () => {} };
const chat = [];
global.ChatMessage = {
  create: jest.fn(async data => {
    chat.push(data);
    return data;
  }),
  getSpeaker: ({ actor } = {}) => ({ actor: actor?.id ?? null }),
};
global.ui = { notifications: { warn: jest.fn(), info: jest.fn(), error: jest.fn() } };
global.game = {
  settings: { get: () => 1 }, combat: null, combats: null, i18n: null,
  user: { id: 'u1', isGM: true, targets: new Set() }, users: { activeGM: { isSelf: true }, contents: [] }, actors: [], scenes: [],
};

jest.unstable_mockModule('./mechanics/world/gm-relay.mjs', () => ({ needsGmRelay: () => false, relayToGm: jest.fn() }));
const conditions = [];
jest.unstable_mockModule('./mechanics/combat/timed-status.mjs', () => ({
  applyTimedCondition: jest.fn(async (actor, status, rounds, timing) => {
    conditions.push({ name: actor.name, status, rounds, until: timing?.expiry ?? null, of: timing?.combatantId ?? null });
    actor.statuses.add(status);
  }),
  // The real one needs a running combat's turn order; here it just says which `until` it was asked for, and whose.
  turnBoundTiming: jest.fn((until, actor) => ({ value: 0, expiry: until, combatantId: actor?.name ?? null })),
}));
const defenses = new Map();
jest.unstable_mockModule('./mechanics/combat/combat.mjs', () => ({
  getDefenseValue: jest.fn((actor, defense) => defenses.get(actor)?.[defense] ?? 0),
  applyDamage: jest.fn(),
  computeMultiplier: (total, dif) => (!dif || total < dif ? 0 : Math.max(1, Math.floor(total / dif))),
}));
const rolls = [];
let rollResult = { success: false };
jest.unstable_mockModule('./mechanics/resources/grants.mjs', () => ({
  rollTest: jest.fn(async (actor, skill, dif, extra) => {
    rolls.push({ name: actor.name, skill, dif, ...extra });
    return rollResult;
  }),
}));

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));
export const FILES = {
  fightingStyle: 'gijcrbitems/_source/Fighting_Style_2LtDCHxgg9bMvWQK.json',
  gallantry: 'gijcrbitems/_source/Gallantry_UIMocxFcGeJUm3D4.json',
  brutalMight: 'eocitems/_source/Brutal_Might_l0STCEYBuPMYfzSt.json',
  impenetrableArmor: 'gijcrbitems/_source/Impenetrable_Armor_vanN7kRYUhgHew7q.json',
  standBehindMe: 'atsitems/_source/Stand_Behind_Me__PcezfGdjUtNUZHYH.json',
  concentratedFire: 'ccitems/_source/Concentrated_Fire_2UPKeLtWRXIoDlux.json',
  dominate: 'qgtgitems/_source/Dominate_HwREY90wo09Hkdt1.json',
};

let nextId = 1;
const byUuid = new Map();
global.fromUuidSync = uuid => byUuid.get(uuid) ?? null;
global.fromUuid = async uuid => byUuid.get(uuid) ?? null;

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

const getPath = (object, key) => String(key).split('.').reduce((o, k) => (o === null || o === undefined ? o : o[k]), object);
global.foundry = {
  utils: { setProperty: setPath, getProperty: getPath, deepClone: v => JSON.parse(JSON.stringify(v)), randomID: () => `r${nextId++}` },
  applications: { api: { DialogV2: { wait: jest.fn(async () => null), confirm: jest.fn(async () => true) } } },
};
global.CONFIG = {
  E20: {
    skillToEssence: { might: 'strength', brawn: 'strength', alertness: 'smarts', targeting: 'speed', persuasion: 'social' },
    skills: {}, actorSizes: { small: 's', common: 'c', large: 'l' }, damageTypes: { fire: 'E20.DamageFire' },
    skillShiftList: ['criticalSuccess', 'autoSuccess', '3d6', '2d8', 'd12', 'd10', 'd8', 'd6', 'd4', 'd2', 'd20', 'autoFail', 'fumble'],
  },
};

const { rebuildIndex } = await import('./index.mjs');
await import('./plugins/index.mjs');
const { registerCheck } = await import('./predicate.mjs');
// The system's own check (essence20.mjs) asks mechanics/combat/multiple-targets.mjs; a weapon flag stands in for it here.
registerCheck('multipleTargetsWeapon', (actor, option, ctx) => (ctx?.item ? !!ctx.item.system?.multipleTargets : null));

function makeItem(data) {
  const item = { id: `i${nextId++}`, effects: [], flags: {}, system: {}, ...data };
  item.flags.essence20 ??= {};
  item.uuid = `Item.${item.id}`;
  item.update = jest.fn(async update => {
    for (const [key, value] of Object.entries(update)) {
      setPath(item, key, value);
    }

    if (item.parent) {
      rebuildIndex(item.parent);
    }
  });
  byUuid.set(item.uuid, item);
  return item;
}

function packItem(key, extra = {}) {
  const doc = fromPack(FILES[key]);
  return makeItem({
    name: doc.name, type: doc.type, system: { ...JSON.parse(JSON.stringify(doc.system)), ...(extra.system ?? {}) },
    flags: { core: { sourceId: `Compendium.essence20.x.Item.${doc._id}` }, essence20: { ...(extra.flags ?? {}) } },
  });
}

function makeActor(items = [], extra = {}) {
  const list = [];
  const actor = {
    id: extra.id ?? `a${nextId++}`, name: extra.name ?? 'Hero', type: extra.type ?? 'playerCharacter', isOwner: true, documentName: 'Actor',
    flags: { essence20: { ...(extra.flags ?? {}) } }, statuses: new Set(extra.statuses ?? []),
    system: {
      level: 10, size: 'common', skills: { might: { shift: 'd8' }, brawn: { shift: 'd12' }, alertness: { shift: 'd6' } },
      health: { max: 10, value: 10, bonus: 0 }, powers: { personal: { value: 3, max: 5 } }, immunities: {}, isMorphed: false,
      ...(extra.system ?? {}),
    },
    effects: [],
    items: { contents: list, get: id => list.find(i => i.id == id), filter: fn => list.filter(fn), find: fn => list.find(fn), some: fn => list.some(fn), [Symbol.iterator]: () => list[Symbol.iterator]() },
    toggleStatusEffect: jest.fn(async status => actor.statuses.add(status)),
    prototypeToken: { disposition: extra.disposition ?? 1 },
    updateEmbeddedDocuments: jest.fn(async (type, updates) => {
      for (const { _id, ...rest } of updates) {
        const item = list.find(i => i.id == _id);
        for (const [key, value] of Object.entries(rest)) {
          setPath(item, key, value);
        }
      }
    }),
  };
  actor.uuid = `Actor.${actor.id}`;
  actor.token = { actor, document: { disposition: extra.disposition ?? 1 }, center: { x: extra.x ?? 0 } };
  actor.getActiveTokens = () => (extra.offCanvas ? [] : [actor.token]);
  actor.getFlag = (scope, key) => getPath(actor.flags[scope], key);
  actor.setFlag = jest.fn(async (scope, key, value) => setPath(actor, `flags.${scope}.${key}`, value));
  actor.update = jest.fn(async update => {
    for (const [key, value] of Object.entries(update)) {
      setPath(actor, key, value);
    }

    rebuildIndex(actor);
  });
  for (const item of items) {
    item.parent = actor;
    list.push(item);
  }

  byUuid.set(actor.uuid, actor);
  rebuildIndex(actor);
  return actor;
}

const attack = (actor, data = {}) => {
  const one = makeItem({ name: data.name ?? 'Attack', type: 'weaponEffect',
    system: { classification: { style: data.style ?? 'ranged', skill: data.skill ?? 'targeting' }, damageType: data.damageType ?? 'ballistic', damageValue: 2, multipleTargets: !!data.multipleTargets } });
  one.parent = actor;
  actor.items.contents.push(one);
  rebuildIndex(actor);
  return one;
};

function placeOnCanvas(...actors) {
  global.canvas = { tokens: { placeables: actors.map(actor => actor.token) }, grid: { measurePath: ([a, b]) => ({ distance: Math.abs((a?.x ?? 0) - (b?.x ?? 0)) }) } };
  global.game.actors = actors;
}

function target(...actors) {
  global.game.user.targets = new Set(actors.map(actor => actor.token));
  global.game.user.targets.first = () => actors[0]?.token;
}

const { runUse, fireTriggers } = await import('./triggers.mjs');
const { applySkillSubstitution, ruleCritD2, ruleRollSources } = await import('./adapter.mjs');
const { validateRule } = await import('./types.mjs');
const { runSteps, stepContext } = await import('./steps.mjs');
const { pressRuleButton } = await import('./buttons.mjs');
const { runPreRoll } = await import('../mechanics/item-hooks.mjs');
const { ruleAttackSkill } = await import('./plugins/rolls/attack-skill-substitution.mjs');
const { ruleSelfRedirect, takeSelfRedirect } = await import('./plugins/combat/self-redirect.mjs');
const { ruleLateHitRiders } = await import('./plugins/combat/late-hit-rider.mjs');
const { ruleHeldUses } = await import('./plugins/resources/held-uses.mjs');
const { resetDailyPowerUses } = await import('../mechanics/resources/nanomite-uses.mjs');

const pay = jest.fn(async () => true);

beforeEach(() => {
  chat.length = 0;
  conditions.length = 0;
  rolls.length = 0;
  rollResult = { success: false };
  defenses.clear();
  global.game.combat = null;
  global.game.actors = [];
  global.canvas = undefined;
  target();
  ui.notifications.warn.mockClear();
});

test('every rule on these items validates', () => {
  for (const file of Object.values(FILES)) {
    for (const rule of fromPack(file).system.rules) {
      expect([file, validateRule(rule)]).toEqual([file, []]);
    }
  }
});

/* -------------------------------------------- */
/*  Trigger Happy and Gallantry                  */
/* -------------------------------------------- */

describe('Fighting Style: Trigger Happy', () => {
  const trooper = (choice = 'triggerHappy') => makeActor([packItem('fightingStyle', { system: { choice } })], { name: 'Trooper' });
  const results = (...rows) => ({ results: rows.map(([who, total, success]) => ({ targetUuid: who.uuid, total, success })), entries: [] });

  test("a Multiple Targets attack's total also reaching a target's Willpower leaves it Frightened until the end of its next turn", async () => {
    const actor = trooper();
    const lmg = attack(actor, { multipleTargets: true });
    const [weak, strong] = [makeActor([], { name: 'Weak' }), makeActor([], { name: 'Strong' })];
    defenses.set(weak, { willpower: 12 }).set(strong, { willpower: 16 });
    // A miss still compares ("in addition to their Toughness or Evasion").
    await fireTriggers(actor, 'afterRoll', { roll: { item: lmg, isAttack: true }, outcome: 'failure', facts: results([weak, 14, false], [strong, 14, true]) });
    expect(conditions).toEqual([{ name: 'Weak', status: 'frightened', rounds: 0, until: 'endOfNextTurn', of: 'Weak' }]);
  });

  test('not with another style, nor with a weapon that has no Multiple Targets', async () => {
    const other = makeActor([], { name: 'Other' });
    defenses.set(other, { willpower: 5 });
    const careful = trooper('careful');
    await fireTriggers(careful, 'afterRoll', { roll: { item: attack(careful, { multipleTargets: true }), isAttack: true }, outcome: 'success', facts: results([other, 14, true]) });
    const actor = trooper();
    await fireTriggers(actor, 'afterRoll', { roll: { item: attack(actor), isAttack: true }, outcome: 'success', facts: results([other, 14, true]) });
    expect(conditions).toEqual([]);
  });

  test("against a Gallantry holder the Frightened ends as its next turn starts (the book's halving)", async () => {
    const actor = trooper();
    const gallant = makeActor([packItem('gallantry')], { name: 'Gallant' });
    defenses.set(gallant, { willpower: 10 });
    await fireTriggers(actor, 'afterRoll', { roll: { item: attack(actor, { multipleTargets: true }), isAttack: true }, outcome: 'success', facts: results([gallant, 14, true]) });
    expect(conditions).toEqual([{ name: 'Gallant', status: 'frightened', rounds: 0, until: 'nextTurn', of: 'Gallant' }]);
  });
});

describe('Gallantry', () => {
  test('a Trigger Happy attack with a Multiple Targets weapon takes a Snag against the holder, labelled Gallantry', () => {
    const gallant = makeActor([packItem('gallantry')], { name: 'Gallant' });
    const attacker = makeActor([packItem('fightingStyle', { system: { choice: 'triggerHappy' } })]);
    const lmg = attack(attacker, { multipleTargets: true });
    const { sources } = ruleRollSources(attacker, gallant, { item: lmg, rolledSkill: 'targeting', isAttack: true });
    expect(sources).toEqual([expect.objectContaining({ label: 'Gallantry', snag: true })]);
  });

  test('no Snag without Gallantry, without Trigger Happy, or without a Multiple Targets weapon', () => {
    const gallant = makeActor([packItem('gallantry')]);
    const plain = makeActor();
    const happy = makeActor([packItem('fightingStyle', { system: { choice: 'triggerHappy' } })]);
    const careful = makeActor([packItem('fightingStyle', { system: { choice: 'careful' } })]);
    const roll = actor => ({ item: attack(actor, { multipleTargets: true }), rolledSkill: 'targeting', isAttack: true });
    expect(ruleRollSources(happy, plain, roll(happy)).sources).toEqual([]);
    expect(ruleRollSources(careful, gallant, roll(careful)).sources).toEqual([]);
    expect(ruleRollSources(happy, gallant, { item: attack(happy), rolledSkill: 'targeting', isAttack: true }).sources).toEqual([]);
  });

  test("a timed Frightened the rules put on the holder lasts half as long; other Conditions don't change", async () => {
    const gallant = makeActor([packItem('gallantry')], { name: 'Gallant' });
    const foe = makeActor([], { name: 'Foe' });
    const ctx = stepContext({ actor: foe, item: null, rule: {}, targets: [gallant] });
    await runSteps([{ do: 'applyCondition', condition: 'frightened', rounds: 3, to: 'target' }, { do: 'applyCondition', condition: 'prone', rounds: 3, to: 'target' }], ctx);
    expect(conditions).toEqual([
      { name: 'Gallant', status: 'frightened', rounds: 2, until: null, of: null },
      { name: 'Gallant', status: 'prone', rounds: 3, until: null, of: null },
    ]);
  });
});

/* -------------------------------------------- */
/*  Brutal Might                                 */
/* -------------------------------------------- */

describe('Brutal Might', () => {
  test("a Might attack rolls Brawn when the Brawn die is better (the attack's dataset is built with it)", () => {
    const pugilist = makeActor([packItem('brutalMight')]);
    const punch = attack(pugilist, { style: 'melee', skill: 'might' });
    expect(ruleAttackSkill(pugilist, punch, 'might')).toBe('brawn');
    // The preRoll substitution leaves it alone - it already happened.
    const dataset = { skill: 'might' };
    applySkillSubstitution(pugilist, dataset, punch);
    expect(dataset.skill).toBe('might');
  });

  test('keeps Might when it is the better die, leaves other Skills alone, and needs the Perk', () => {
    const strongMight = makeActor([packItem('brutalMight')], { system: { skills: { might: { shift: 'd12' }, brawn: { shift: 'd6' } } } });
    expect(ruleAttackSkill(strongMight, attack(strongMight, { skill: 'might' }), 'might')).toBe('might');
    const pugilist = makeActor([packItem('brutalMight')]);
    expect(ruleAttackSkill(pugilist, attack(pugilist, { skill: 'finesse' }), 'finesse')).toBe('finesse');
    const plain = makeActor();
    expect(ruleAttackSkill(plain, attack(plain, { skill: 'might' }), 'might')).toBe('might');
  });
});

/* -------------------------------------------- */
/*  Impenetrable Armor                           */
/* -------------------------------------------- */

describe('Impenetrable Armor', () => {
  const vehicleFor = (crew, role) => makeActor([], { name: 'Jeep', type: 'vehicle', system: { actors: { one: { uuid: crew.uuid, vehicleRole: role } } } });

  test("redirects to the vehicle its holder drives", async () => {
    const driver = makeActor([packItem('impenetrableArmor')], { name: 'Driver' });
    const vehicle = vehicleFor(driver, 'driver');
    global.game.actors = [driver, vehicle];
    const attacker = makeActor([], { name: 'Foe' });
    const redirect = ruleSelfRedirect(driver, attacker);
    expect(redirect).toEqual(expect.objectContaining({ protector: vehicle }));
    await takeSelfRedirect(redirect);
  });

  test('not as a passenger, not off a vehicle, and not without the Perk', () => {
    const passenger = makeActor([packItem('impenetrableArmor')]);
    const plain = makeActor();
    global.game.actors = [passenger, plain, vehicleFor(passenger, 'passenger'), vehicleFor(plain, 'driver')];
    expect(ruleSelfRedirect(passenger, null)).toBeNull();
    expect(ruleSelfRedirect(plain, null)).toBeNull();
    const walker = makeActor([packItem('impenetrableArmor')]);
    expect(ruleSelfRedirect(walker, null)).toBeNull();
  });
});

/* -------------------------------------------- */
/*  Stand Behind Me!                             */
/* -------------------------------------------- */

describe('Stand Behind Me!', () => {
  function setUp() {
    const ranger = makeActor([packItem('standBehindMe')], { name: 'Gold', x: 0, system: { isMorphed: true } });
    const foe = makeActor([], { name: 'Foe', x: 30, disposition: -1, type: 'npc' });
    const far = makeActor([], { name: 'Far', x: 100, disposition: -1, type: 'npc' });
    const friend = makeActor([], { name: 'Friend', x: 10, disposition: 1 });
    placeOnCanvas(ranger, foe, far, friend);
    global.game.combat = { id: 'c1', started: true, round: 2, turn: 0, turns: [], combatants: { contents: [] } };
    return { ranger, foe, far, friend, item: ranger.items.contents[0] };
  }

  const cardButton = () => chat.map(message => ({ ...message, update: jest.fn(async update => {
    for (const [key, value] of Object.entries(update)) {
      setPath(message, key, value);
    }
  }) })).reverse().find(message => message.flags?.essence20?.ruleButton);

  test('the Use: 1 Personal Power while Morphed taunts every enemy within 60 ft', async () => {
    const { ranger, foe, far, friend, item } = setUp();
    await runUse(item, pay);
    expect(ranger.system.powers.personal.value).toBe(2);
    expect(Object.keys(foe.flags.essence20.ruleMarks)).toEqual([`standBehindMe--${ranger.id}`]);
    expect(far.flags.essence20.ruleMarks).toBeUndefined();
    expect(friend.flags.essence20.ruleMarks).toBeUndefined();
  });

  test("a taunted enemy's turn start posts the Alertness card; failing it, only attacks at the taunter go ahead", async () => {
    const { ranger, foe, item } = setUp();
    await runUse(item, pay);
    await fireTriggers(foe, 'turnStart');
    const card = cardButton();
    expect(card.flags.essence20.ruleButton).toEqual(expect.objectContaining({ actorUuid: foe.uuid, label: 'Roll DIF 14 Alertness' }));
    rollResult = { success: false };
    expect(await pressRuleButton(card)).toBe(true);
    expect(rolls).toEqual([expect.objectContaining({ name: 'Foe', skill: 'alertness', dif: 14 })]);
    const gun = attack(foe);
    const other = makeActor([], { name: 'Other' });
    for (const [targets, cancelled] of [[[other], true], [[], true], [[ranger], false], [[ranger, other], true]]) {
      target(...targets);
      const dataset = { skill: 'targeting' };
      await runPreRoll(foe, dataset, gun);
      expect([targets.map(t => t.name), !!dataset.cancelRoll]).toEqual([targets.map(t => t.name), cancelled]);
    }

    expect(ui.notifications.warn).toHaveBeenCalledWith('E20.RulesExtConvA18.TauntBlocked');
    // A plain Skill Test isn't an attack.
    target(other);
    const test = { skill: 'alertness' };
    await runPreRoll(foe, test, null);
    expect(test.cancelRoll).toBeUndefined();
    // Tested once: no second card this round.
    chat.length = 0;
    await fireTriggers(foe, 'turnStart');
    expect(cardButton()).toBeUndefined();
    // Two rounds on, the taunt is over.
    global.game.combat.round = 4;
    const later = { skill: 'targeting' };
    await runPreRoll(foe, later, gun);
    expect(later.cancelRoll).toBeUndefined();
  });

  test('passing the test shakes it off; no taunt out of combat', async () => {
    const { ranger, foe, item } = setUp();
    await runUse(item, pay);
    await fireTriggers(foe, 'turnStart');
    rollResult = { success: true };
    await pressRuleButton(cardButton());
    target(makeActor());
    const dataset = { skill: 'targeting' };
    await runPreRoll(foe, dataset, attack(foe));
    expect(dataset.cancelRoll).toBeUndefined();

    global.game.combat = null;
    const calm = makeActor([], { name: 'Calm', x: 20, disposition: -1 });
    placeOnCanvas(ranger, calm);
    await runUse(item, pay);
    chat.length = 0;
    await fireTriggers(calm, 'turnStart');
    expect(cardButton()).toBeUndefined();
  });
});

/* -------------------------------------------- */
/*  Concentrated Fire                            */
/* -------------------------------------------- */

describe('Concentrated Fire', () => {
  const pyroWith = () => {
    const pyro = makeActor([packItem('concentratedFire')], { name: 'Pyro' });
    return { pyro, flamer: attack(pyro, { damageType: 'fire' }) };
  };

  test('focused on a Fire-immune target: a Snag, a d2 Critical Success, and the damage lands ignoring the Immunity', () => {
    const { pyro, flamer } = pyroWith();
    const immune = makeActor([], { name: 'Immune', system: { immunities: { fire: true } } });
    const dataset = { concentratedFire: true };
    expect(ruleRollSources(pyro, immune, { item: flamer, isAttack: true, dataset }).sources).toEqual([expect.objectContaining({ label: 'Concentrated Fire', snag: true })]);
    expect(ruleCritD2(pyro, immune, { item: flamer, dataset })).toBe(true);
    const result = { damageValue: 6, damageType: 'fire' };
    ruleLateHitRiders(pyro, immune, result, { itemUuid: flamer.uuid, damageType: 'fire', dataset });
    expect(result.damageValue).toBeNull();
    expect(result.riderOptions).toEqual([{ key: 'concentratedFire', label: 'Concentrated Fire', damageValue: 6, damageType: 'fire', damageTypeLabel: 'E20.DamageFire', ignoreImmunity: true }]);
  });

  test("not focused, or a target that isn't immune: none of it (the d2 crit only needs the focus)", () => {
    const { pyro, flamer } = pyroWith();
    const immune = makeActor([], { system: { immunities: { fire: true } } });
    const plain = makeActor();
    expect(ruleRollSources(pyro, immune, { item: flamer, isAttack: true, dataset: {} }).sources).toEqual([]);
    expect(ruleCritD2(pyro, immune, { item: flamer, dataset: {} })).toBe(false);
    expect(ruleRollSources(pyro, plain, { item: flamer, isAttack: true, dataset: { concentratedFire: true } }).sources).toEqual([]);
    expect(ruleCritD2(pyro, plain, { item: flamer, dataset: { concentratedFire: true } })).toBe(true);
    for (const [who, dataset] of [[immune, {}], [plain, { concentratedFire: true }]]) {
      const result = { damageValue: 4 };
      ruleLateHitRiders(pyro, who, result, { itemUuid: flamer.uuid, damageType: 'fire', dataset });
      expect(result).toEqual({ damageValue: 4 });
    }
  });
});

/* -------------------------------------------- */
/*  Dominate                                     */
/* -------------------------------------------- */

describe('Dominate', () => {
  test("a Rest leaves one use spent while a victim carries the nanomites, and gives it back once they're recalled", async () => {
    const user = makeActor([packItem('dominate', { system: { usesSpent: 2 } })], { name: 'Infiltrator' });
    const power = user.items.contents[0];
    const victim = makeActor([], { name: 'Victim', flags: { ruleMarks: { [`dominated--${user.id}`]: { by: user.uuid, count: 0 } } } });
    global.game.actors = [user, victim];
    expect(ruleHeldUses(user, power)).toBe(1);
    await resetDailyPowerUses(user);
    expect(power.system.usesSpent).toBe(1);
    delete victim.flags.essence20.ruleMarks;
    expect(ruleHeldUses(user, power)).toBe(0);
    await resetDailyPowerUses(user);
    expect(power.system.usesSpent).toBe(0);
  });
});
