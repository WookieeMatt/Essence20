import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Book check, part "limits" (docs/rules-batches/book-limits.md): how often the rulebooks let these items be used
 * (per turn / round / scene / encounter / mission / session / day) and the effects the old rules had narrowed or widened
 * (MLP armor and Initiative, Shield Matrix per copy, Aerodynamic's grenades / thrown weapons, Tossable Vial's Thrown,
 * Penetrating Shot's Personal Power and upshift, Heavy Water Coolant's Specialized test, Weapon Implant as a Use).
 */

global.Hooks = { on: () => {}, once: () => {}, callAll: () => {} };

let picks = [];
const offered = [];
const rollsMade = [];
const CATALOG = [];
const grants = {
  findItems: jest.fn(async ({ type, availabilities, matches }) => CATALOG.filter(entry => entry.type == type
    && (!availabilities || availabilities.includes(entry.system.availability)) && (!matches || matches(entry)))),
  pickOne: jest.fn(async (title, rows) => {
    offered.push(rows.map(row => row.name));
    const name = picks.shift();
    return rows.find(row => row.name == name)?.uuid ?? null;
  }),
  grantCopy: jest.fn(async (actor, uuid, { flags } = {}) => {
    const entry = CATALOG.find(e => e.uuid == uuid);
    const made = { id: `g${rollsMade.length}${entry.name}`, name: entry.name, type: entry.type, system: JSON.parse(JSON.stringify(entry.system)), flags: { essence20: flags ?? {} } };
    made.update = async changes => Object.entries(changes).forEach(([key, value]) => setPath(made, key, value));
    actor.items.contents.push(made);
    return made;
  }),
  rollTest: jest.fn(async (actor, skill, dif, extra) => {
    rollsMade.push({ skill, dif, snag: !!extra?.snag });
    return { success: true, crit: false };
  }),
};
jest.unstable_mockModule('./mechanics/resources/grants.mjs', () => grants);
jest.unstable_mockModule('./mechanics/world/gm-relay.mjs', () => ({ needsGmRelay: () => false, relayToGm: jest.fn() }));

await import('./plugins/index.mjs');
const { rebuildIndex } = await import('./index.mjs');
const { validateRule } = await import('./types.mjs');
const { runUse, useAvailable } = await import('./triggers.mjs');
const { recordUse, usesLeft, restClears } = await import('./limits.mjs');
const { resolveValue } = await import('./formula.mjs');
const { contextFor, evaluate } = await import('./predicate.mjs');
const { applyRuleSwitches, ruleDialogSwitches, ruleDerived, ruleRollSources, ruleWeaponTraits } = await import('./adapter.mjs');
const { diceRefHelpers } = await import('./plugins/tags/dice-refs.mjs');
const { lazy } = await import('./plugins/shared/lazy-helpers-and-targets.mjs');
const { ruleVehicleDefeatSpecialized, ruleVehicleDefeatDif } = await import('./plugins/zords/vehicle-defeat-dif.mjs');
const { isJuryRigBenefitActive } = await import('../items/vehicles/jury-rig.mjs');
const { getCostOptions, recordRuleUse } = await import('../mechanics/actions/action-perks.mjs');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));

const FILES = {
  interdiction: 'fffav1items/_source/Interdiction_AyKHJdCpdtoZHlER.json',
  orange: 'jttitems/_source/Orange_Ranger_Prime_8s9HHpmk633e6PLM.json',
  relicKey: 'prcrbitems/_source/Relic_Key_uSlClAv3oJjf54pa.json',
  oneForAll: 'prcrbitems/_source/One_For_All_8duLY5PjlpmbNkwK.json',
  shiningLeader: 'prcrbitems/_source/Shining_Leader_woCTg4Lpk3KpsgtF.json',
  honorific: 'jttitems/_source/Honorific_Token_z9NkwgoIx2JRrPBA.json',
  cache: 'dditems/_source/Cache_I_EEGQqqgqZEJkJDHB.json',
  notDeadYet: 'iafav2items/_source/Not_Dead_Yet_mCsw25hT4y4q4ceG.json',
  weaponImplant: 'dditems/_source/Weapon_Implant_j9xrYUKHvLkxdd9e.json',
  sneakAttack: 'fffav1items/_source/Sneak_Attack_FWN6697ESy9ua6VI.json',
  veiledAttacker: 'fffav1items/_source/Veiled_Attacker_6OxGuWzQz0Fiivas.json',
  crash: 'ccitems/_source/Crash_Survivor_5SKezm0w5KQbdSJ4.json',
  hearty: 'ccitems/_source/Hearty_3Jh0J7IxLr6eF1uA.json',
  smolder: 'fmmcitems/_source/Growing_Smolder_4XblFV97cS63ueDM.json',
  juryRig: 'iafav2items/_source/Jury_Rig_PV4QvqJgT1orMm1D.json',
  afterburners: 'qgtgitems/_source/Afterburners_ICqafFtaZbexsl5e.json',
  ecm: 'qgtgitems/_source/Electronic_Countermeasures_oTPW1JHgRPwmZtr8.json',
  smokescreen: 'qgtgitems/_source/Smokescreen_94NUwERfVYs0Tgmh.json',
  mlpLight: 'mlpcrbitems/_source/Light_Armor_4M1CnapdbRIBl3It.json',
  mlpHeavy: 'mlpcrbitems/_source/Heavy_Armor_B8RcQxof4JmlbEHE.json',
  shieldMatrix: 'atsitems/_source/Shield_Matrix_e200PVV1q6a0Us9n.json',
  aeroGij: 'gijcrbitems/_source/Aerodynamics_NoENOcMYq0YkkhAk.json',
  aeroPr: 'prcrbitems/_source/Aerodynamic_NoENOcMYq0YkkhAk.json',
  aeroTf: 'tfcrbitems/_source/Aerodynamics_NoENOcMYq0YkkhAk.json',
  vial: 'ccitems/_source/Tossable_Vial_swnhABvNaKuNY5FI.json',
  penetrating: 'prcrbitems/_source/Penetrating_Shot_6ay8OIRRwZTnQUV8.json',
  heavyWater: 'ocitems/_source/Heavy_Water_Coolant_e8WNnjzWGNWBd2UJ.json',
};
const MLP = 'mlpcrbitems/_source/';
const TALENTS = [
  `${MLP}A_Talent_For_Generosity_W4zuPnXnGsb0EE91.json`, `${MLP}A_Talent_For_Honesty_adqw9O68ByBpwNwQ.json`,
  `${MLP}A_Talent_For_Kindness_SKviFM3gryyTrJV5.json`, `${MLP}A_Talent_For_Laughter_rcaZoNtniTFDklY3.json`,
  `${MLP}A_Talent_for_Loyalty_KB7usfPNxRUGRk5S.json`, `${MLP}A_Talent_for_Magic_0POa5TuUxinLfFBn.json`,
];

function setPath(object, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const node = keys.reduce((at, key) => (at[key] ??= {}), object);
  if (last.startsWith('-=') || (globalThis.foundry?.data?.operators?.ForcedDeletion && value instanceof globalThis.foundry.data.operators.ForcedDeletion)) {
    delete node[last.replace(/^-=/, '')];
  } else {
    node[last] = value;
  }
}

const getPath = (object, path) => path.split('.').reduce((at, key) => at?.[key], object);
const clone = value => JSON.parse(JSON.stringify(value));

let nextId = 1;

function makeItem(actor, data) {
  const item = {
    id: `i${nextId++}`, flags: {}, system: {}, parent: actor, isOwner: true, ...data,
    async update(changes) {
      for (const [key, value] of Object.entries(changes)) {
        setPath(this, key, value);
      }
    },
  };
  item.uuid = `${actor.uuid}.Item.${item.id}`;
  return item;
}

function packItem(actor, file, extra = {}) {
  const doc = fromPack(file);
  const item = makeItem(actor, { name: doc.name, type: doc.type, system: clone(doc.system), flags: { core: { sourceId: `Compendium.essence20.test.Item.${doc._id}` } }, ...extra });
  actor.items.contents.push(item);
  return item;
}

function addItem(actor, data) {
  const item = makeItem(actor, data);
  actor.items.contents.push(item);
  return item;
}

function makeActor(name, files = [], { type = 'playerCharacter', system = {} } = {}) {
  const items = [];
  const actor = {
    id: `a${nextId++}`, name, type, isOwner: true, flags: { essence20: {} }, statuses: new Set(),
    system: { level: 20, health: { value: 10, max: 10, bonus: 0 }, powers: { personal: { value: 6, max: 6 } }, skills: {}, traits: {}, defenses: {}, ...system },
    async update(data) {
      for (const [key, value] of Object.entries(data)) {
        setPath(this, key, value);
      }
    },
    async setFlag(scope, key, value) {
      setPath(this.flags[scope] ??= {}, key, value);
    },
    async unsetFlag(scope, key) {
      setPath(this.flags[scope] ??= {}, `-=${key}`);
    },
    getFlag(scope, key) {
      return getPath(this.flags[scope], key);
    },
  };
  actor.uuid = `Actor.${actor.id}`;
  actor.items = {
    contents: items, get: id => items.find(item => item.id == id), find: fn => items.find(fn), filter: fn => items.filter(fn), some: fn => items.some(fn),
    [Symbol.iterator]: () => items[Symbol.iterator](),
  };
  actor.getActiveTokens = () => [];
  for (const file of [files].flat()) {
    packItem(actor, file);
  }

  rebuildIndex(actor);
  return actor;
}

const itemNamed = (actor, name) => actor.items.contents.find(item => item.name == name);
const pay = jest.fn(async () => true);
const askFor = text => async (step, options) => options.findIndex(option => String(option.label).startsWith(text));
const rulesOf = file => fromPack(file).system.rules ?? [];
const savedGame = global.game;
let clock;

beforeEach(() => {
  pay.mockClear();
  picks = [];
  offered.length = 0;
  rollsMade.length = 0;
  CATALOG.length = 0;
  clock = { sceneClockScene: 1, sceneClockEncounter: 1, sceneClockMission: 1, q2SessionEpoch: 1 };
  global.game = {
    combat: null, combats: { get: () => null }, user: { id: 'u', isGM: true, targets: new Set() }, users: { contents: [], activeGM: null },
    actors: { contents: [] }, settings: { get: (scope, key) => clock[key] }, i18n: { localize: key => key, format: key => key, has: () => false },
  };
  global.ChatMessage = { create: jest.fn(async data => data), getSpeaker: () => ({}), getSpeakerActor: () => null };
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn(), error: jest.fn() } };
  global.foundry = {
    ...global.foundry,
    utils: {
      ...(global.foundry?.utils ?? {}), setProperty: setPath, getProperty: getPath, randomID: () => `r${nextId++}`,
      hasProperty: (o, k) => getPath(o, k) !== undefined, escapeHTML: text => String(text), deepClone: clone,
    },
  };
});

afterEach(() => {
  global.game = savedGame;
  diceRefHelpers.getVolleyShots = null;
  lazy.getLedger = null;
});

test('every rule on these items validates', () => {
  for (const file of [...Object.values(FILES), ...TALENTS]) {
    for (const rule of rulesOf(file)) {
      expect([file, validateRule(rule)]).toEqual([file, []]);
    }
  }
});

test('each limit counts in the window the book gives it', () => {
  const BOOK = {
    interdiction: ['DialogSwitch', 'encounter'], // "once per combat scene"
    orange: ['Use', 'scene'], relicKey: ['Use', 'scene'], oneForAll: ['Use', 'rest'], shiningLeader: ['Use', 'scene'],
    honorific: ['Use', 'rest'], cache: ['Use', 'session'], notDeadYet: ['Use', 'scene'], weaponImplant: ['Use', 'mission'],
    sneakAttack: ['DialogSwitch', 'encounter'], crash: ['Use', 'mission'], hearty: ['Use', 'mission'], smolder: ['Use', 'turn'],
    juryRig: ['Use', 'turn'], afterburners: ['Use', 'encounter'], ecm: ['Use', 'encounter'], smokescreen: ['Use', 'encounter'],
  };
  for (const [key, [type, per]] of Object.entries(BOOK)) {
    const rule = rulesOf(FILES[key]).find(r => r.type == type && r.limit);
    expect([key, rule?.limit?.per]).toEqual([key, per]);
  }

  for (const file of TALENTS) {
    expect([file, rulesOf(file)[0].limit]).toEqual([file, { per: 'round', max: 1, freeIsUnlimited: true }]);
  }

  // Weapon Implant is a Use now, not a Trigger on any Technology roll.
  expect(rulesOf(FILES.weaponImplant).map(rule => rule.type)).toEqual(['Use']);
  // Not Dead Yet's 2-Health version: once per mission (the book's "adventure").
  expect(JSON.stringify(rulesOf(FILES.notDeadYet))).toContain('"not:self:windowUsed:notDeadYetEnhancedUsedThisMission:mission"');
  expect(JSON.stringify(rulesOf(FILES.notDeadYet))).toContain('"markWindow","flag":"notDeadYetEnhancedUsedThisMission","window":"mission"');
});

describe('the windows behave', () => {
  const spendOnce = async (file, name, ruleIndex = 0) => {
    const actor = makeActor('Hero', file, { type: file == FILES.relicKey ? 'zord' : 'playerCharacter' });
    const item = itemNamed(actor, name);
    const rule = item.system.rules[ruleIndex];
    await recordUse(actor, rule, item, ruleIndex);
    return { actor, item, rule, left: () => usesLeft(actor, rule, item, ruleIndex) };
  };

  test('once per scene: a combat ending (a new encounter) does not bring it back, a new scene does', async () => {
    for (const [file, name, index] of [[FILES.orange, 'Orange Ranger Prime', 1], [FILES.relicKey, 'Relic Key', 0], [FILES.shiningLeader, 'Shining Leader', 0]]) {
      clock.sceneClockScene = 1;
      clock.sceneClockEncounter = 1;
      const { left } = await spendOnce(file, name, index);
      expect([name, left()]).toEqual([name, 0]);
      clock.sceneClockEncounter = 2;
      expect([name, left()]).toEqual([name, 0]);
      clock.sceneClockScene = 2;
      expect([name, left()]).toEqual([name, 1]);
    }
  });

  test('once per day: back only after a Rest', async () => {
    for (const [file, name] of [[FILES.oneForAll, 'One For All'], [FILES.honorific, 'Honorific Token']]) {
      const { actor, left } = await spendOnce(file, name);
      expect([name, left()]).toEqual([name, 0]);
      clock.sceneClockScene = 5;
      clock.sceneClockMission = 5;
      expect([name, left()]).toEqual([name, 0]);
      for (const key of restClears(actor)) {
        setPath(actor, key, undefined);
      }

      expect([name, left()]).toEqual([name, 1]);
    }
  });

  test('once per mission: a new scene keeps it spent, a new mission brings it back', async () => {
    for (const [file, name] of [[FILES.crash, 'Crash Survivor'], [FILES.hearty, 'Hearty'], [FILES.weaponImplant, 'Weapon Implant']]) {
      clock.sceneClockMission = 1;
      const { left } = await spendOnce(file, name);
      clock.sceneClockScene = 7;
      expect([name, left()]).toEqual([name, 0]);
      clock.sceneClockMission = 2;
      expect([name, left()]).toEqual([name, 1]);
    }
  });

  test('Cache I: once per game session (three with Cache III); Private Barter once per session inside it', async () => {
    const raider = makeActor('Raider', FILES.cache);
    addItem(raider, { name: 'Private Barter', type: 'perk', flags: { core: { sourceId: 'Compendium.essence20.test.Item.mzOtnEnXRhCM0v9O' } }, system: {} });
    rebuildIndex(raider);
    const cache = itemNamed(raider, 'Cache I');
    expect(await runUse(cache, pay)).toContain('Private Barter applies');
    expect(raider.flags.essence20.privateBarterSession).toBe(1);
    expect(useAvailable(cache, cache.system.rules[0], 0)).toBe(false);
    clock.sceneClockScene = 4;
    clock.sceneClockEncounter = 4;
    expect(useAvailable(cache, cache.system.rules[0], 0)).toBe(false);

    addItem(raider, { name: 'Cache III', type: 'perk', flags: { core: { sourceId: 'Compendium.essence20.test.Item.VMd10Qb4ByeCla5q' } }, system: {} });
    rebuildIndex(raider);
    expect(usesLeft(raider, cache.system.rules[0], cache, 0)).toBe(2);
    expect(await runUse(cache, pay)).not.toContain('Private Barter applies');
    clock.q2SessionEpoch = 2;
    expect(usesLeft(raider, cache.system.rules[0], cache, 0)).toBe(3);
    expect(await runUse(cache, pay)).toContain('Private Barter applies');
    expect(raider.flags.essence20.privateBarterSession).toBe(2);
  });

  test('Force Recon Sneak Attack: once per combat, twice with Veiled Attacker; spent when ticked', async () => {
    const one = makeActor('Recon', FILES.sneakAttack);
    const two = makeActor('Veteran', [FILES.sneakAttack, FILES.veiledAttacker]);
    for (const [actor, uses] of [[one, 1], [two, 2]]) {
      const item = itemNamed(actor, 'Sneak Attack');
      expect(usesLeft(actor, item.system.rules[0], item, 0)).toBe(uses);
      const shot = addItem(actor, { name: 'Shot', type: 'weaponEffect', system: { classification: { style: 'ranged', skill: 'targeting' } } });
      rebuildIndex(actor);
      for (let i = 0; i < uses; i++) {
        const sw = ruleDialogSwitches(actor, { item: shot, isAttack: true }).find(s => /Sneak Attack/.test(s.label));
        expect(sw).toBeTruthy();
        await applyRuleSwitches(actor, { ext: { [sw.name]: true } }, { item: shot, isAttack: true });
      }

      expect(ruleDialogSwitches(actor, { item: shot, isAttack: true }).find(s => /Sneak Attack/.test(s.label))).toBeUndefined();
      clock.sceneClockEncounter += 1;
      expect(ruleDialogSwitches(actor, { item: shot, isAttack: true }).find(s => /Sneak Attack/.test(s.label))).toBeTruthy();
    }
  });
});

test('Weapon Implant: a once-per-mission Use rolling Technology at the tier\'s DIF; Snag on yourself; the weapon lasts the mission', async () => {
  const oneHand = { k: { type: 'weaponEffect', numHands: '1' } };
  const twoHands = { k: { type: 'weaponEffect', numHands: '2' } };
  CATALOG.push(
    { uuid: 'Compendium.essence20.x.Item.blade', name: 'Arm Blade', type: 'weapon', system: { availability: 'standard', traits: [], items: oneHand } },
    { uuid: 'Compendium.essence20.x.Item.cannon', name: 'Arm Cannon', type: 'weapon', system: { availability: 'standard', traits: [], items: twoHands } },
    { uuid: 'Compendium.essence20.x.Item.nade', name: 'Grenade', type: 'weapon', system: { availability: 'standard', traits: ['consumable'], items: oneHand } },
    { uuid: 'Compendium.essence20.x.Item.gun', name: 'Arm Gun', type: 'weapon', system: { availability: 'limited', traits: [], items: oneHand } },
    { uuid: 'Compendium.essence20.x.Item.rail', name: 'Rail Gun', type: 'weapon', system: { availability: 'restricted', traits: [], items: twoHands } },
  );
  const medic = makeActor('Knock Out', FILES.weaponImplant);
  const implant = itemNamed(medic, 'Weapon Implant');
  const seen = [];
  const watch = text => async (step, options) => {
    seen.push(options.map(option => option.label));
    return askFor(text)(step, options);
  };

  // On yourself only with Self-Adjustment: refused before anything is rolled or spent.
  expect(await runUse(implant, pay, { ask: watch('A Standard one-handed') })).toContain('needs a targeted ally');
  expect(rollsMade).toEqual([]);
  expect(useAvailable(implant, implant.system.rules[0], 0)).toBe(true);
  addItem(medic, { name: 'Self-Adjustment', type: 'perk', flags: { core: { sourceId: 'Compendium.essence20.test.Item.cjST9YIuihCug1Gl' } }, system: {} });
  rebuildIndex(medic);

  picks = ['Arm Blade'];
  await runUse(implant, pay, { ask: watch('A Standard one-handed') });
  expect(seen[0]).toEqual(['A Standard one-handed weapon (DIF 14)', 'A Standard two-handed weapon (DIF 16)']);
  expect(rollsMade).toEqual([{ skill: 'technology', dif: 14, snag: true }]);
  expect(offered[0]).toEqual(['Arm Blade']);
  const blade = itemNamed(medic, 'Arm Blade');
  expect(blade.flags.essence20.rulesExpiry.until).toBe('mission');
  expect(useAvailable(implant, implant.system.rules[0], 0)).toBe(false);

  // A new mission, a targeted ally, and Extensive Enhancements: a Restricted weapon that gains Accurate, no Snag.
  clock.sceneClockMission = 2;
  const ally = makeActor('Ally');
  global.game.user.targets = new Set([{ actor: ally }]);
  addItem(medic, { name: 'Major Augments', type: 'perk', flags: { core: { sourceId: 'Compendium.essence20.test.Item.0XjyYHChhc0VStRn' } }, system: {} });
  addItem(medic, { name: 'Extensive Enhancements', type: 'perk', flags: { core: { sourceId: 'Compendium.essence20.test.Item.UavRPwxwYnLr4BHA' } }, system: {} });
  rebuildIndex(medic);
  picks = ['Rail Gun'];
  await runUse(implant, pay, { ask: watch('A Restricted') });
  expect(seen[1]).toHaveLength(4);
  expect(rollsMade[1]).toEqual({ skill: 'technology', dif: 20, snag: false });
  expect(itemNamed(ally, 'Rail Gun').system.traits).toEqual(['accurate']);
});

test('Growing Smolder: once per turn, and not on a turn the holder has already attacked', async () => {
  const monster = makeActor('Monster', FILES.smolder);
  const smolder = itemNamed(monster, 'Growing Smolder');
  const rule = smolder.system.rules[0];
  let ledger = { log: [] };
  lazy.getLedger = () => ledger;
  expect(useAvailable(smolder, rule, 0)).toBe(true);
  ledger = { log: [{ actionType: 'standard', cost: { standard: 1 }, attack: true }] };
  expect(useAvailable(smolder, rule, 0)).toBe(false);
  ledger = { log: [] };
  global.game.combat = { id: 'c1', started: true, round: 1, turn: 0 };
  await recordUse(monster, rule, smolder, 0);
  expect(useAvailable(smolder, rule, 0)).toBe(false);
  global.game.combat = { id: 'c1', started: true, round: 1, turn: 1 };
  expect(useAvailable(smolder, rule, 0)).toBe(true);
});

test('Jury Rig: the Standard version\'s benefit ends with the scene it was granted in', () => {
  const vehicle = makeActor('Truck', [], { type: 'vehicle' });
  vehicle.flags.essence20.pendingJuryRigBenefit = { option: 'hardenArmor', expiresRound: 999999, scene: 1 };
  expect(isJuryRigBenefitActive(vehicle, 'hardenArmor')).toBe(true);
  clock.sceneClockScene = 2;
  expect(isJuryRigBenefitActive(vehicle, 'hardenArmor')).toBe(false);
  // The Free version carries no scene (0): only its round counts.
  vehicle.flags.essence20.pendingJuryRigBenefit = { option: 'hardenArmor', expiresRound: 3, scene: 0 };
  expect(isJuryRigBenefitActive(vehicle, 'hardenArmor')).toBe(true);
});

test('the Talents: once per ROUND - a new turn in the same round does not bring the cheaper action back', async () => {
  const pony = makeActor('Pony', TALENTS[2]);
  global.game.combat = { id: 'c1', started: true, round: 1, turn: 0 };
  const first = getCostOptions(pony, 'standard', { kind: 'item' }, {}).offers;
  expect(first[0]?.actionType).toBe('move');
  await recordRuleUse(pony, first[0], {});
  // A fresh ledger (another turn), same round: spent.
  global.game.combat = { id: 'c1', started: true, round: 1, turn: 3 };
  expect(getCostOptions(pony, 'standard', { kind: 'item' }, {}).offers).toHaveLength(0);
  // Free actions related to it cost nothing every time.
  expect(getCostOptions(pony, 'free', { kind: 'item' }, {}).offers[0]?.actionType).toBe('none');
  global.game.combat = { id: 'c1', started: true, round: 2, turn: 0 };
  expect(getCostOptions(pony, 'standard', { kind: 'item' }, {}).offers[0]?.actionType).toBe('move');
});

test('MLP Light / Heavy Armor: the penalty reaches Initiative too', () => {
  for (const [file, down] of [[FILES.mlpLight, 1], [FILES.mlpHeavy, 2]]) {
    const pony = makeActor('Pony');
    packItem(pony, file, {}).system.equipped = true;
    rebuildIndex(pony);
    for (const rolledSkill of ['athletics', 'acrobatics', 'infiltration', 'initiative']) {
      expect([rolledSkill, ruleRollSources(pony, null, { rolledSkill }).sources]).toEqual([rolledSkill, [expect.objectContaining({ shiftDown: down })]]);
    }

    expect(ruleRollSources(pony, null, { rolledSkill: 'might' }).sources).toEqual([]);
  }
});

test('Shield Matrix: Shielded 2 per copy, up to 6', () => {
  for (const [copies, rating] of [[1, 2], [2, 4], [3, 6], [4, 6]]) {
    const zord = makeActor('Zord', Array(copies).fill(FILES.shieldMatrix), { type: 'zord' });
    ruleDerived(zord);
    expect([copies, zord.system.shieldedRating]).toEqual([copies, rating]);
  }
});

describe('Aerodynamic and Tossable Vial', () => {
  const arm = (actor, name, traits = []) => {
    const weapon = addItem(actor, { name, type: 'weapon', system: { traits, equipped: true } });
    const range = { value: 20, long: 50 };
    const effect = addItem(actor, { name: `${name} Effect`, type: 'weaponEffect', flags: { essence20: { parentId: weapon.id } }, system: { range: clone(range), classification: { style: 'ranged' } }, _source: { system: { range: clone(range) } } });
    return { weapon, effect };
  };

  test.each([['aeroGij'], ['aeroPr'], ['aeroTf']])('%s doubles a grenade\'s or a thrown weapon\'s ranges, nothing else\'s', key => {
    for (const [name, traits, doubled] of [['Frag Grenade', [], true], ['Knife', ['thrown'], true], ['Rifle', [], false]]) {
      const actor = makeActor('Joe');
      const { weapon, effect } = arm(actor, name, traits);
      packItem(actor, FILES[key], { flags: { core: { sourceId: 'Compendium.essence20.test.Item.NoENOcMYq0YkkhAk' }, essence20: { parentId: weapon.id } } });
      rebuildIndex(actor);
      ruleDerived(actor);
      expect([name, effect.system.range]).toEqual([name, doubled ? { value: 40, long: 100 } : { value: 20, long: 50 }]);
    }
  });

  test('Tossable Vial: its poison counts as a thrown weapon (the Thrown trait); other weapons don\'t', () => {
    const actor = makeActor('Cobra');
    const vial = addItem(actor, { name: 'Vial', type: 'weapon', system: { traits: [], equipped: true } });
    const knife = addItem(actor, { name: 'Knife', type: 'weapon', system: { traits: [], equipped: true } });
    packItem(actor, FILES.vial, { flags: { core: { sourceId: 'Compendium.essence20.test.Item.swnhABvNaKuNY5FI' }, essence20: { parentId: vial.id } } });
    rebuildIndex(actor);
    expect(ruleWeaponTraits(actor, vial, [])).toEqual(['thrown']);
    expect(ruleWeaponTraits(actor, knife, [])).toEqual([]);
  });
});

test('Penetrating Shot: 1 Personal Power for one Volley roll at ↑1 per extra shot, every shot\'s damage landing', async () => {
  const ranger = makeActor('Pink', FILES.penetrating);
  ranger.flags.essence20.volleyActive = true;
  diceRefHelpers.getVolleyShots = () => 4;
  const shot = addItem(ranger, { name: 'Blaster', type: 'weaponEffect', system: { damageValue: 2, classification: { style: 'ranged', skill: 'targeting' } } });
  rebuildIndex(ranger);
  const ctx = { item: shot, isAttack: true };
  const sw = ruleDialogSwitches(ranger, ctx).find(s => /Penetrating Shot/.test(s.label));
  expect(sw).toBeTruthy();
  const options = { ext: { [sw.name]: true } };
  await applyRuleSwitches(ranger, options, ctx);
  expect(options.shiftUp).toBe(3);
  expect(options.ruleDamage).toBe(6);
  expect(ranger.system.powers.personal.value).toBe(5);

  ranger.system.powers.personal.value = 0;
  expect(ruleDialogSwitches(ranger, ctx).find(s => /Penetrating Shot/.test(s.label))).toBeUndefined();
});

test('Heavy Water Coolant: DIF 10 and a Specialized explosion test', () => {
  const vehicle = makeActor('Hiss', FILES.heavyWater, { type: 'vehicle' });
  expect(ruleVehicleDefeatDif(vehicle)).toBe(10);
  expect(ruleVehicleDefeatSpecialized(vehicle)).toBe(true);
  expect(ruleVehicleDefeatSpecialized(makeActor('Plain', [], { type: 'vehicle' }))).toBe(false);
});

test('@clock reads the windows\' current counts (0 for anything else)', () => {
  Object.assign(clock, { sceneClockScene: 3, sceneClockEncounter: 4, sceneClockMission: 2, q2SessionEpoch: 5 });
  const values = ['scene', 'encounter', 'mission', 'session', 'round'].map(key => resolveValue(`@clock.${key}`, {}, -1));
  expect(values).toEqual([3, 4, 2, 5, 0]);
  const actor = makeActor('Raider');
  actor.flags.essence20.privateBarterSession = 5;
  expect(evaluate(['calc:@clock.session - @actor.flags.essence20.privateBarterSession>0'], contextFor({ self: actor }))).toBe(false);
});
