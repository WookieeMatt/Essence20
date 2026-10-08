import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Round 17, split1 (docs/rules-batches/slSplit117.md): items that already carried rules but kept hand-written code for
 * part of their behaviour. Each item is loaded from its pack source; these check the rules validate and that the rules
 * now do what the removed code (and its removed tests in dice.test.js, documents/actor.test.js, banked-buffs.test.js,
 * multiple-targets.test.js, nearby-allies.test.js, weapon-upgrades.test.js, weapon-perk-uses.test.js and the deleted
 * no-fighting / metallikato / rise-again / righteous-heart / numbness tests) asserted.
 */

global.Hooks = { on: () => {}, once: () => {}, callAll: () => {} };

const storyPoints = { canWrite: true, granted: [] };
jest.unstable_mockModule('./mechanics/resources/story-points.mjs', () => ({
  canWriteStoryPoints: () => storyPoints.canWrite,
  poolFor: () => 'story',
  requestStoryPointGrant: jest.fn(async (actor, amount, options) => storyPoints.granted.push({ name: actor?.name, amount, pool: options?.pool ?? 'story' })),
  canSpendForActor: () => true,
  spendForActor: jest.fn(async () => true),
  hasStoryPointsAvailable: () => true,
}));
jest.unstable_mockModule('./mechanics/world/gm-relay.mjs', () => ({ needsGmRelay: () => false, relayToGm: jest.fn() }));
const applyTimedCondition = jest.fn(async (actor, status) => actor.statuses.add(status));
jest.unstable_mockModule('./mechanics/combat/timed-status.mjs', () => ({ applyTimedCondition }));
const applyDamage = jest.fn(async () => true);
jest.unstable_mockModule('./mechanics/combat/combat.mjs', () => ({
  applyDamage,
  getDefenseValue: (actor, key) => Number(actor.system?.defenses?.[key]?.total) || 0,
}));
const grants = {
  chooseSelect: jest.fn(async () => null), chooseButtons: jest.fn(async () => null), rollTest: jest.fn(async () => ({ success: true })),
  findItems: jest.fn(async () => []), pickOne: jest.fn(async () => null), grantCopy: jest.fn(async (actor, uuid) => ({ name: uuid })),
  kitAvailability: () => null,
};
jest.unstable_mockModule('./mechanics/resources/grants.mjs', () => grants);
const setEntryAndAddItem = jest.fn(async () => 'entry');
jest.unstable_mockModule('./sheet-handlers/attachment-handler.mjs', () => ({ setEntryAndAddItem }));

await import('./plugins/index.mjs');
const { rebuildIndex } = await import('./index.mjs');
const { validateRule } = await import('./types.mjs');
const { fireTriggers, runUse } = await import('./triggers.mjs');
const {
  applyRuleImmunity, applyRuleSwitches, ruleDamageType, ruleDerived, ruleDialogSwitches, ruleRollSources, ruleScaledDamage,
} = await import('./adapter.mjs');
const { ruleAttackHasTrait } = await import('./plugins/combat/attack-traits.mjs');
const { ruleMultipleTargets } = await import('./plugins/combat/hazard-terrain-targets.mjs');
const { ruleLookupArmorPoints } = await import('./plugins/combat/lookup-armor-points.mjs');
const { ruleSetDie } = await import('./plugins/dialog/switch-set-die.mjs');
const { ruleDownshiftCancel } = await import('./plugins/rolls/downshift-cancel.mjs');
const { ruleResistsAttack } = await import('./plugins/combat/attack-resistance.mjs');
const { applyItemStage } = await import('./plugins/effects/item-modifier-stage.mjs');
const { bankedEntries } = await import('./bank.mjs');
const { costRulesFor } = await import('./actions.mjs');
const { markOf } = await import('./predicate.mjs');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));

const FILES = {
  noFighting: 'kocitems/_source/No_Fighting___ddSnDksWfxPkekda.json',
  pressureCooker: 'ghpfitems/_source/Pressure_Cooker_MMToVGBAkB79DZEW.json',
  airVQ: 'iafav2items/_source/Air_Vehicle_Qualification_GUcQm2RuUIEWzd4X.json',
  landVQ: 'iafav2items/_source/Land_Vehicle_Qualification_xLeoc9xLx06SpK7S.json',
  seaVQ: 'iafav2items/_source/Sea_Vehicle_Qualification_K0UKwjhJlYnGM7yt.json',
  skyward: 'qgtgitems/_source/Skyward_1IlTYXe8k5Aj63Mn.json',
  nuPogodi: 'iafav2items/_source/Nu__Pogodi__sItc8nD7ockbQ1mn.json',
  nothingPersonal: 'iafav2items/_source/Nothing_Personal_WsB4CydGzKF2g7Yi.json',
  promiseOfRiches: 'iafav2items/_source/The_Promise_of_Riches_wW4xugDI7Sea2Btg.json',
  goodToGo: 'iafav2items/_source/Good_To_Go_Yt3muowN1aALcqOj.json',
  forTheSyndicate: 'iafav2items/_source/For_The_Syndicate_opygNwRWgeIyU1mE.json',
  oorah: 'sssitems/_source/Oorah__7CuDik9Vtpou9iDJ.json',
  weakPoint: 'qgtgitems/_source/Weak_Point_opTZmlt97a9TWHSk.json',
  penetratingRounds: 'gijcrbitems/_source/Penetrating_Rounds_JLwbWSlHn5q3rqnH.json',
  roaming: 'fffav1items/_source/Roaming_the_Land_jdQFjlYUHaRze6as.json',
  cryogenicTouch: 'jttitems/_source/Cryogenic_Touch_dDHjUwjLlGJhiQvI.json',
  ninjaPower: 'prcrbitems/_source/Ninja_Power_wN5rjEQIJH68rWCd.json',
  ultimateMagnaDefender: 'ttsgitems/_source/Ultimate_Magna_Defender_ukfZOGZeuyJv6I5M.json',
  metallikato: 'dditems/_source/Metallikato_ouLZnb7j0kAfCrLx.json',
  predacon: 'tsitems/_source/Predacon_jRD6G5Z6eblTvxeO.json',
  onYourFeet: 'sssitems/_source/On_Your_Feet_4qibn7JQ1lHTe9gT.json',
  everythingIsInspiration: 'wtnvcgitems/_source/Everything_is_Inspiration_c1gIi1A6MKHkOwdy.json',
  dogfighter: 'atsitems/_source/Dogfighter_twl2N01FD8XKO0s1.json',
  eltarian: 'ttsgitems/_source/Eltarian_Training_NXxiyoOB60ems444.json',
  savant: 'jttitems/_source/Savant_Skill_ZnuLgh6jdUHi9F75.json',
  silverPrime: 'atsitems/_source/Silver_Ranger_Prime_Bl9G8fgtd30wENkX.json',
  graphitePrime: 'bthitems/_source/Graphite_Ranger_Prime_nVOpdhr6aFnuY0ks.json',
  fightingStyle: 'gijcrbitems/_source/Fighting_Style_2LtDCHxgg9bMvWQK.json',
  colonyChangeling: 'dsoeitems/_source/Colony_Changeling_FRUWPAePJzm7Mlf0.json',
  beatdown: 'ccitems/_source/Beatdown_38zFS75lhzBWiurT.json',
  jackhammer: 'ccitems/_source/Jackhammer_sBoZ2KrzmKlWIlYu.json',
  motorLancer: 'iafav2items/_source/Motor_Lancer_YaFY9NhcpZPXdvv0.json',
  bullpup: 'iafav2items/_source/Bullpup_IU2HkMiwC8hYKQdj.json',
  rust: 'dditems/_source/Rust_Derivatives_h5tkU3gsCoMHGCFJ.json',
  scrambleWave: 'dditems/_source/Scramble_Wave_2ehuQcJ1nwOvxSKl.json',
  fluidMotion: 'iafav2items/_source/Fluid_Motion_TESyOcJFtd9Qn9Tk.json',
  riseAgain: 'ttsgitems/_source/Rise_Again_9DCNlVGfsEgUX6SC.json',
  righteousHeart: 'prcrbitems/_source/Righteous_Heart_mOgEBZIbiaT07eAq.json',
  numbness: 'fmmcitems/_source/Numbness_HB7e3uW1ggYNJVql.json',
};

const SHOTGUN = 'Compendium.essence20.gi_joe_crb.Item.2qW1YLopvjKyezNQ';
const STONE_WARLORD = 'Compendium.essence20.finster_s_monster_matic_cookbook.Item.QlFNI9fQZXqO5N2J';
const COLONY_CHANGELING = 'Compendium.essence20.dark_skies_over_equestria.Item.FRUWPAePJzm7Mlf0';

function setPath(object, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const node = keys.reduce((at, key) => (at[key] ??= {}), object);
  if (last.startsWith('-=')) {
    delete node[last.slice(2)];
  } else {
    node[last] = value;
  }
}

const getPath = (object, path) => path.split('.').reduce((at, key) => at?.[key], object);
const clone = value => JSON.parse(JSON.stringify(value));

let nextId = 1;

function makeItem(actor, data) {
  const item = {
    id: `i${nextId++}`, flags: {}, system: {}, parent: actor, actor, isOwner: true, ...data,
    async update(changes) {
      for (const [key, value] of Object.entries(changes)) {
        setPath(this, key, value);
      }
    },
    async setFlag(scope, key, value) {
      setPath(this.flags[scope] ??= {}, key, value);
    },
    getFlag(scope, key) {
      return getPath(this.flags[scope], key);
    },
  };
  item.uuid = `${actor.uuid}.Item.${item.id}`;
  return item;
}

const sourceOfPack = doc => `Compendium.essence20.test.Item.${doc._id}`;

/** An actor holding the pack items `files` (a file or [file, {sourceId, system, flags}]), with a token at x feet. */
function makeActor(name, files = [], { system = {}, x = 0, disposition = 1, type = 'playerCharacter', flags = {} } = {}) {
  const items = [];
  const actor = {
    id: `a${nextId++}`, name, type, isOwner: true, flags: { essence20: { ...flags } }, statuses: new Set(),
    system: {
      level: 12, health: { value: 10, max: 10 }, powers: { personal: { value: 3, max: 6 } }, isMorphed: false, isTransformed: false,
      essences: { smarts: { value: 2 } }, size: 'common',
      skills: { driving: { shift: 'd20' }, finesse: { shift: 'd6' }, initiative: { shift: 'd6' } },
      defenses: { toughness: { total: 10, string: '' }, evasion: { total: 15, string: '' }, willpower: { total: 11, string: '' }, cleverness: { total: 12, string: '' } },
      ...system,
    },
    async update(data) {
      for (const [key, value] of Object.entries(data)) {
        setPath(this, key, value);
      }
    },
    async setFlag(scope, key, value) {
      setPath(this.flags[scope] ??= {}, key, value);
    },
    async unsetFlag(scope, key) {
      delete this.flags[scope]?.[key];
    },
    getFlag(scope, key) {
      return getPath(this.flags[scope], key);
    },
    async createEmbeddedDocuments(kind, datas) {
      const made = datas.map(data => makeItem(actor, clone(data)));
      items.push(...made);
      rebuildIndex(actor);
      return made;
    },
    toggleStatusEffect: jest.fn(async function (status, { active } = {}) {
      if (active === false) {
        this.statuses.delete(status);
      } else {
        this.statuses.add(status);
      }
    }),
  };
  actor.uuid = `Actor.${actor.id}`;
  for (const entry of [files].flat()) {
    const [file, extra = {}] = Array.isArray(entry) ? entry : [entry];
    const doc = fromPack(file);
    items.push(makeItem(actor, {
      name: doc.name, type: doc.type, system: { ...clone(doc.system), ...(extra.system ?? {}) },
      flags: { core: { sourceId: extra.sourceId ?? sourceOfPack(doc) }, ...(extra.flags ?? {}) },
    }));
  }

  actor.items = {
    contents: items, get: id => items.find(item => item.id == id), find: fn => items.find(fn), filter: fn => items.filter(fn),
    some: fn => items.some(fn), map: fn => items.map(fn), [Symbol.iterator]: () => items[Symbol.iterator](),
  };
  const token = { actor, document: { disposition, uuid: `Scene.s.Token.t${actor.id}` }, center: { x, y: 0 }, id: `t${actor.id}`, name };
  actor.getActiveTokens = () => [token];
  actor.token = token;
  rebuildIndex(actor);
  return actor;
}

function addItem(actor, data) {
  const item = makeItem(actor, data);
  actor.items.contents.push(item);
  rebuildIndex(actor);
  return item;
}

const itemNamed = (actor, name) => actor.items.contents.find(item => item.name == name);

/** A weapon effect on the actor: unarmed (no weapon), or on a weapon with the given source and traits. */
function attack(actor, { style = 'melee', skill = 'might', damageType = 'blunt', weaponSource = null, traits = [], secondary = null } = {}) {
  let parentId = null;
  if (weaponSource || traits.length) {
    const weapon = addItem(actor, { name: 'Weapon', type: 'weapon', system: { equipped: true, traits }, flags: { core: { sourceId: weaponSource } } });
    parentId = weapon.id;
  }

  return addItem(actor, {
    name: 'Strike', type: 'weaponEffect',
    system: { classification: { style, skill }, damageType, damageValue: 1, secondaryDamage: secondary ?? { type: null, value: 0 } },
    flags: { essence20: parentId ? { parentId } : {} },
  });
}

function scene(...actors) {
  const docs = new Map(actors.map(actor => [actor.uuid, actor]));
  global.fromUuidSync = uuid => docs.get(uuid) ?? null;
  global.fromUuid = async uuid => docs.get(uuid) ?? null;
  global.game.actors = { get: id => actors.find(actor => actor.id == id) ?? null, contents: actors, [Symbol.iterator]: () => actors[Symbol.iterator]() };
  global.canvas = {
    tokens: { placeables: actors.filter(actor => actor.token).map(actor => actor.token), controlled: [], setTargets: jest.fn() },
    grid: { size: 100, measurePath: ([a, b]) => ({ distance: Math.hypot(a.x - b.x, a.y - b.y) }) }, scene: { id: 'sc', tokens: [] },
    dimensions: { size: 100, distance: 5 },
  };
}

/** A vehicle the actor drives, with the given movement types and size. */
function drive(actor, moves = ['aerial'], size = 'huge') {
  const movement = Object.fromEntries(['aerial', 'ground', 'swim'].map(kind => [kind, { base: moves.includes(kind) ? 30 : 0 }]));
  const vehicle = makeActor('Vehicle', [], { type: 'vehicle', system: { movement, size, actors: { a: { uuid: actor.uuid, vehicleRole: 'driver' } } } });
  return vehicle;
}

const pay = jest.fn(async () => true);
const firstUse = (item, available) => available[0];
const useNamed = text => (item, available) => available.find(({ rule }) => String(rule.label).includes(text));
const askFor = text => async (step, options) => options.findIndex(option => String(option.label).startsWith(text));
const switchNamed = (actor, ctx, label) => ruleDialogSwitches(actor, ctx).find(entry => entry.label.startsWith(label));
const savedGame = global.game;

beforeEach(() => {
  pay.mockClear();
  applyTimedCondition.mockClear();
  applyDamage.mockClear();
  storyPoints.granted = [];
  storyPoints.canWrite = true;
  global.game = {
    combat: null, combats: { get: () => null }, user: { id: 'u', isGM: true, targets: new Set() }, users: { contents: [], activeGM: null },
    actors: { contents: [] }, settings: { get: () => 1 }, i18n: { localize: key => key, format: key => key, has: () => false },
  };
  global.ChatMessage = { create: jest.fn(async data => data), getSpeaker: () => ({}), getSpeakerActor: () => null };
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn(), error: jest.fn() } };
  global.CONFIG = {
    ...(global.CONFIG ?? {}),
    E20: {
      ...(global.CONFIG?.E20 ?? {}), skillShiftList: ['autoSuccess', '3d6', '2d8', 'd12', 'd10', 'd8', 'd6', 'd4', 'd2', 'd20', 'autoFail'],
      damageTypes: { fire: 'E20.DamageFire', stun: 'E20.DamageStun' }, skillToEssence: { driving: 'speed', finesse: 'speed', initiative: 'speed' },
    },
  };
  global.foundry = {
    ...global.foundry,
    applications: { api: { DialogV2: { wait: jest.fn(async () => null), confirm: jest.fn(async () => true) } } },
    utils: { ...(global.foundry?.utils ?? {}), setProperty: setPath, getProperty: getPath, randomID: () => `r${nextId++}`, deepClone: clone, escapeHTML: text => String(text) },
  };
  scene();
});

afterEach(() => {
  global.canvas = undefined;
  global.game = savedGame;
});

test('every split1 rule validates', () => {
  for (const file of Object.values(FILES)) {
    const rules = fromPack(file).system.rules ?? [];
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) {
      expect(validateRule(rule)).toEqual([]);
    }
  }
});

describe('No Fighting?! (was items/rolls/no-fighting.mjs + dice.mjs)', () => {
  test('a combat ending banks a Snag for the next Social test, which uses it up', async () => {
    const actor = makeActor('Fighter', [FILES.noFighting]);
    expect(ruleRollSources(actor, null, { rolledEssence: 'social' }).sources).toEqual([]);
    await fireTriggers(actor, 'combatEnd', { vars: { combatId: 'c1' } });
    expect(markOf(actor, 'noFighting')).toBeTruthy();
    const social = ruleRollSources(actor, null, { rolledEssence: 'social' });
    expect(social.sources).toEqual([expect.objectContaining({ snag: true, label: 'No Fighting?!' })]);
    expect(social.consumes).toEqual([expect.objectContaining({ ext: 'rulesMark', key: 'noFighting', actorUuid: actor.uuid })]);
    expect(ruleRollSources(actor, null, { rolledEssence: 'strength' }).sources).toEqual([]);
  });
});

describe('Pressure Cooker (was a dice.mjs dialog checkbox)', () => {
  const moxie = actor => addItem(actor, { name: 'Moxie', type: 'rolePoints', system: { resource: { value: 2, max: 3 } } });

  test('at 1 Health with a Moxie Point: an Edge that beats a Snag, for 1 Moxie', async () => {
    const actor = makeActor('Old Hand', [FILES.pressureCooker], { system: { health: { value: 1, max: 10 } } });
    const points = moxie(actor);
    const entry = switchNamed(actor, {}, 'Pressure Cooker');
    expect(entry).toBeTruthy();
    const options = { edge: false, snag: true, shiftUp: 0, shiftDown: 0, ext: { [entry.name]: true } };
    await applyRuleSwitches(actor, options, {});
    expect(options.edge).toBe(true);
    expect(options.snag).toBe(false);
    expect(points.system.resource.value).toBe(1);
  });

  test('not offered above 1 Health or without Moxie', () => {
    const healthy = makeActor('Old Hand', [FILES.pressureCooker], { system: { health: { value: 2, max: 10 } } });
    moxie(healthy);
    expect(switchNamed(healthy, {}, 'Pressure Cooker')).toBeUndefined();
    const broke = makeActor('Old Hand', [FILES.pressureCooker], { system: { health: { value: 1, max: 10 } } });
    expect(switchNamed(broke, {}, 'Pressure Cooker')).toBeUndefined();
  });
});

describe('vehicle Qualification Perks: ↑1 on Driving with Ranks (was the dice.mjs movement-type table)', () => {
  const upshift = actor => ruleRollSources(actor, null, { rolledSkill: 'driving' }).sources.reduce((sum, source) => sum + (Number(source.shiftUp) || 0), 0);
  const trained = { skills: { driving: { shift: 'd4' } } };

  test.each([
    ['airVQ', ['aerial'], ['ground']], ['landVQ', ['ground'], ['swim']], ['seaVQ', ['swim'], ['aerial']], ['skyward', ['aerial'], ['ground']],
    ['nuPogodi', ['ground'], ['swim']], ['nuPogodi', ['aerial'], ['swim']], ['nothingPersonal', ['ground'], ['aerial']],
    ['promiseOfRiches', ['swim'], []], ['oorah', ['ground'], ['aerial']],
  ])('%s: ↑1 driving a %s vehicle, nothing driving a %s one', (key, yes, no) => {
    const actor = makeActor('Driver', [FILES[key]], { system: trained });
    scene(actor, drive(actor, yes));
    expect(upshift(actor)).toBe(1);
    if (no.length) {
      scene(actor, drive(actor, no));
      expect(upshift(actor)).toBe(0);
    }
  });

  test('no Ranks in Driving (untrained, not Specialized): nothing; a Specialization counts as a Rank', () => {
    const actor = makeActor('Driver', [FILES.airVQ]);
    scene(actor, drive(actor, ['aerial']));
    expect(upshift(actor)).toBe(0);
    actor.system.skills.driving.isSpecialized = true;
    expect(upshift(actor)).toBe(1);
  });

  test('not while not driving, and several such Perks still give one ↑1', () => {
    const actor = makeActor('Driver', [FILES.airVQ, FILES.skyward, FILES.promiseOfRiches], { system: trained });
    scene(actor);
    expect(upshift(actor)).toBe(0);
    scene(actor, drive(actor, ['aerial']));
    expect(upshift(actor)).toBe(1);
  });

  test.each(['goodToGo', 'forTheSyndicate'])('%s: only the chosen movement type', key => {
    const actor = makeActor('Driver', [[FILES[key], { system: { choice: 'ground' } }]], { system: trained });
    scene(actor, drive(actor, ['ground']));
    expect(upshift(actor)).toBe(1);
    scene(actor, drive(actor, ['aerial']));
    expect(upshift(actor)).toBe(0);
  });
});

describe('Weak Point and Penetrating Rounds (were dice.mjs Armor Piercing / Anti-Tank checks)', () => {
  test('Weak Point: melee attacks have Armor Piercing and Anti-Tank, ranged ones neither', () => {
    const actor = makeActor('Bruiser', [FILES.weakPoint]);
    const melee = attack(actor);
    const ranged = attack(actor, { style: 'projectile', skill: 'targeting' });
    expect(ruleAttackHasTrait(actor, melee, 'armorPiercing')).toBe(true);
    expect(ruleAttackHasTrait(actor, melee, 'antiTank')).toBe(true);
    expect(ruleAttackHasTrait(actor, ranged, 'armorPiercing')).toBe(false);
    expect(ruleAttackHasTrait(actor, ranged, 'antiTank')).toBe(false);
  });

  test('Penetrating Rounds: Armor Piercing with the shotgun (or SMG) only', () => {
    const actor = makeActor('Door-Kicker', [FILES.penetratingRounds]);
    const shotgun = attack(actor, { style: 'projectile', weaponSource: SHOTGUN });
    const rifle = attack(actor, { style: 'projectile', weaponSource: 'Compendium.essence20.gi_joe_crb.Item.rifle' });
    expect(ruleAttackHasTrait(actor, shotgun, 'armorPiercing')).toBe(true);
    expect(ruleAttackHasTrait(actor, shotgun, 'antiTank')).toBe(false);
    expect(ruleAttackHasTrait(actor, rifle, 'armorPiercing')).toBe(false);
    expect(ruleAttackHasTrait(actor, attack(actor), 'armorPiercing')).toBe(false);
  });
});

describe('Roaming the Land: Larger Creatures (was dice.mjs post-hit Stun)', () => {
  test('a melee hit on a larger creature deals 1 Stun; not a same-size one, a miss, or the other choice', async () => {
    const actor = makeActor('Monster', [[FILES.roaming, { system: { choice: 'largerStun' } }]]);
    const big = makeActor('Big', [], { system: { size: 'large' } });
    const same = makeActor('Same', []);
    const melee = attack(actor);
    const hit = (who, outcome = 'success') => fireTriggers(actor, outcome == 'failure' ? 'miss' : 'hit', {
      roll: { item: melee, isAttack: true, isMelee: true }, outcome, targets: [who], facts: { results: [{ success: outcome != 'failure' }] },
    });
    await hit(big);
    expect(applyDamage).toHaveBeenCalledWith(big, 1, 'stun');
    applyDamage.mockClear();
    await hit(same);
    await hit(big, 'failure');
    expect(applyDamage).not.toHaveBeenCalled();
    const other = makeActor('Monster', [[FILES.roaming, { system: { choice: 'smallerDamage' } }]]);
    await fireTriggers(other, 'hit', { roll: { item: attack(other), isAttack: true, isMelee: true }, outcome: 'success', targets: [big] });
    expect(applyDamage).not.toHaveBeenCalled();
  });
});

describe('Cryogenic Touch and Ninja Power damage types (were dice.mjs overrides)', () => {
  test('Cryogenic Touch: unarmed attacks deal Cold, armed ones are untouched', () => {
    const actor = makeActor('Ranger', [FILES.cryogenicTouch]);
    expect(ruleDamageType(actor, null, { item: attack(actor), rolledSkill: 'might' })).toBe('cold');
    expect(ruleDamageType(actor, null, { item: attack(actor, { weaponSource: 'Compendium.essence20.x.Item.sword' }), rolledSkill: 'might' })).toBeNull();
  });

  test('Ninja Power: an unarmed Finesse attack deals the chosen element while Morphed with it on; Cryogenic Touch still wins', () => {
    const actor = makeActor('Ranger', [[FILES.ninjaPower, { system: { choice: 'fire' } }]], { system: { isMorphed: true }, flags: { ninjaPowerActive: true } });
    const strike = attack(actor, { skill: 'finesse' });
    expect(ruleDamageType(actor, null, { item: strike, rolledSkill: 'finesse' })).toBe('fire');
    expect(ruleDamageType(actor, null, { item: strike, rolledSkill: 'might' })).toBeNull();
    actor.flags.essence20.ninjaPowerActive = false;
    expect(ruleDamageType(actor, null, { item: strike, rolledSkill: 'finesse' })).toBeNull();
    actor.flags.essence20.ninjaPowerActive = true;
    actor.system.isMorphed = false;
    expect(ruleDamageType(actor, null, { item: strike, rolledSkill: 'finesse' })).toBeNull();
    actor.system.isMorphed = true;
    const both = makeActor('Ranger', [[FILES.ninjaPower, { system: { choice: 'fire' } }], FILES.cryogenicTouch], { system: { isMorphed: true }, flags: { ninjaPowerActive: true } });
    expect(ruleDamageType(both, null, { item: attack(both, { skill: 'finesse' }), rolledSkill: 'finesse' })).toBe('cold');
  });
});

describe('Ultimate Magna Defender: the Defender Torozord (was dice.mjs)', () => {
  test('the Megaform the Magna Defender formed gets +1 on melee attacks; ranged ones and other Megaforms don\'t', () => {
    const ranger = makeActor('Magna Defender', [FILES.ultimateMagnaDefender]);
    const torozord = makeActor('Defender Torozord', [], { type: 'megaform', flags: { zord2DefenderTorozord: ranger.uuid } });
    const other = makeActor('Other Megaform', [], { type: 'megaform' });
    scene(ranger, torozord, other);
    const melee = ruleScaledDamage(torozord, null, { item: attack(torozord) });
    expect(melee.amount).toBe(1);
    expect(melee.sources).toEqual(['Ultimate Magna Defender']);
    expect(ruleScaledDamage(torozord, null, { item: attack(torozord, { style: 'projectile' }) }).amount).toBe(0);
    expect(ruleScaledDamage(other, null, { item: attack(other) }).amount).toBe(0);
    // The Ranger's own melee +1 is its self rule, as before.
    expect(ruleScaledDamage(ranger, makeActor('Foe', []), { item: attack(ranger) }).amount).toBe(1);
  });
});

describe('Metallikato (was metallikato.mjs, multiple-targets.mjs, banked-buffs.mjs and a dice.mjs checkbox)', () => {
  test('the Use switches Multiple Targets on and off; Bot Mode melee attacks have it while it is on', async () => {
    const actor = makeActor('Bot', [FILES.metallikato]);
    const melee = attack(actor);
    const perk = itemNamed(actor, 'Metallikato');
    expect(ruleMultipleTargets(actor, melee)).toBe(false);
    await runUse(perk, pay, { pick: useNamed('on') });
    expect(actor.flags.essence20.metallikatoMultipleTargetsActive).toBe(true);
    expect(ruleMultipleTargets(actor, melee)).toBe(true);
    expect(ruleMultipleTargets(actor, attack(actor, { style: 'projectile' }))).toBe(false);
    actor.system.isTransformed = true;
    expect(ruleMultipleTargets(actor, melee)).toBe(false);
    actor.system.isTransformed = false;
    await runUse(perk, pay, { pick: useNamed('off') });
    expect(actor.flags.essence20.metallikatoMultipleTargetsActive).toBe(false);
  });

  test('the ignore-armor switch: Bot Mode melee only; ticked, up to Smarts points of a Toughness armor share', async () => {
    const actor = makeActor('Bot', [FILES.metallikato]);
    const melee = attack(actor);
    const ctx = { item: melee, rolledSkill: 'might' };
    const entry = switchNamed(actor, ctx, 'Metallikato: ignore armor');
    expect(entry).toBeTruthy();
    expect(switchNamed(actor, { item: attack(actor, { style: 'projectile' }) }, 'Metallikato: ignore armor')).toBeUndefined();
    actor.system.isTransformed = true;
    expect(switchNamed(actor, ctx, 'Metallikato: ignore armor')).toBeUndefined();
    actor.system.isTransformed = false;
    const options = { edge: false, snag: false, shiftUp: 0, shiftDown: 0, ext: { [entry.name]: true } };
    await applyRuleSwitches(actor, options, ctx);
    expect(options.ruleKeys).toContain('metallikatoIgnoreArmor');
    const foe = makeActor('Foe', []);
    expect(ruleLookupArmorPoints(actor, foe, 'toughness', { ...ctx, switches: options.ruleKeys })).toBe(2);
    expect(ruleLookupArmorPoints(actor, foe, 'evasion', { ...ctx, switches: options.ruleKeys })).toBe(0);
    expect(ruleLookupArmorPoints(actor, foe, 'toughness', { ...ctx, switches: [] })).toBe(0);
  });
});

describe('Predacon (was dice.mjs post-hit Frightened)', () => {
  test('an Intimidation hit in a combat Frightens the target; not out of combat or with another Skill', async () => {
    const predacon = makeActor('Predacon', [FILES.predacon]);
    const foe = makeActor('Foe', [], { disposition: -1 });
    const hit = skill => fireTriggers(predacon, 'hit', { roll: { rolledSkill: skill }, outcome: 'success', targets: [foe] });
    await hit('intimidation');
    expect(applyTimedCondition).not.toHaveBeenCalled();
    game.combat = { id: 'c', started: true };
    await hit('persuasion');
    expect(applyTimedCondition).not.toHaveBeenCalled();
    await hit('intimidation');
    expect(applyTimedCondition).toHaveBeenCalledWith(foe, 'frightened', 0);
  });
});

describe('On Your Feet: allies (was dice.mjs#prepareInitiativeRoll)', () => {
  test('an ally holding it gives the roller Edge on Initiative; an enemy holding it doesn\'t', () => {
    const roller = makeActor('Roller', [], { x: 0 });
    const sergeant = makeActor('Sergeant', [FILES.onYourFeet], { x: 3000 });
    const enemy = makeActor('Enemy', [FILES.onYourFeet], { x: 100, disposition: -1 });
    scene(roller, sergeant);
    const initiative = { rolledSkill: 'initiative', dataset: { isInitiative: true } };
    expect(ruleRollSources(roller, null, initiative).sources).toEqual([expect.objectContaining({ edge: true })]);
    expect(ruleRollSources(roller, null, { rolledSkill: 'athletics', dataset: {} }).sources).toEqual([]);
    // The holder's own Edge is its self rule (one source, not two).
    expect(ruleRollSources(sergeant, null, initiative).sources).toHaveLength(1);
    scene(roller, enemy);
    expect(ruleRollSources(roller, null, initiative).sources).toEqual([]);
  });
});

describe('Everything is Inspiration: a failed Skill Test (was dice.mjs)', () => {
  const afterRoll = (actor, results) => fireTriggers(actor, 'afterRoll', { roll: { rolledSkill: 'culture' }, outcome: results.some(r => r.success) ? 'success' : 'failure', facts: { results } });

  test('a Story Point the first time a roll has a failed row, once a scene; nothing on a success', async () => {
    const actor = makeActor('Hobbyist', [FILES.everythingIsInspiration]);
    await afterRoll(actor, [{ success: true }]);
    expect(storyPoints.granted).toEqual([]);
    await afterRoll(actor, [{ success: true }, { success: false }]);
    expect(storyPoints.granted).toEqual([{ name: 'Hobbyist', amount: 1, pool: 'story' }]);
    await afterRoll(actor, [{ success: false }]);
    expect(storyPoints.granted).toHaveLength(1);
  });

  test('with nobody able to write the pool nothing is granted and the scene\'s use is kept', async () => {
    const actor = makeActor('Hobbyist', [FILES.everythingIsInspiration]);
    storyPoints.canWrite = false;
    await afterRoll(actor, [{ success: false }]);
    storyPoints.canWrite = true;
    await afterRoll(actor, [{ success: false }]);
    expect(storyPoints.granted).toHaveLength(1);
  });
});

describe('Dogfighter: the Edge (was dice.mjs)', () => {
  const air = () => makeActor('Jet', [], { type: 'vehicle', system: { movement: { aerial: { base: 60 } } } });
  test('Driving / Targeting against an aerial vehicle while driving an aerial vehicle up to Extended II', () => {
    const pilot = makeActor('Pilot', [FILES.dogfighter]);
    const target = air();
    scene(pilot, drive(pilot, ['aerial'], 'extended2'), target);
    expect(ruleRollSources(pilot, target, { rolledSkill: 'targeting' }).sources).toEqual([expect.objectContaining({ edge: true })]);
    expect(ruleRollSources(pilot, target, { rolledSkill: 'athletics' }).sources).toEqual([]);
    expect(ruleRollSources(pilot, makeActor('Tank', [], { type: 'vehicle', system: { movement: { aerial: { base: 0 } } } }), { rolledSkill: 'driving' }).sources).toEqual([]);
    expect(ruleRollSources(pilot, makeActor('Bird', []), { rolledSkill: 'driving' }).sources).toEqual([]);
    scene(pilot, drive(pilot, ['aerial'], 'towering'), target);
    expect(ruleRollSources(pilot, target, { rolledSkill: 'driving' }).sources).toEqual([]);
    scene(pilot, drive(pilot, ['ground'], 'huge'), target);
    expect(ruleRollSources(pilot, target, { rolledSkill: 'driving' }).sources).toEqual([]);
  });
});

test('Eltarian Training: the first ↓1 on Finesse goes (was dice.mjs)', async () => {
  const actor = makeActor('Eltarian', [FILES.eltarian]);
  expect(await ruleDownshiftCancel(actor, 2, { rolledSkill: 'finesse' })).toBe(1);
  expect(await ruleDownshiftCancel(actor, 0, { rolledSkill: 'finesse' })).toBe(0);
  expect(await ruleDownshiftCancel(actor, 2, { rolledSkill: 'athletics' })).toBe(2);
});

test('Savant Skill: a d4 switch on the chosen Skill only (was a dice.mjs checkbox)', () => {
  const actor = makeActor('Savant', [[FILES.savant, { system: { choice: 'science' } }]]);
  const entry = switchNamed(actor, { rolledSkill: 'science' }, 'Savant Skill');
  expect(entry).toBeTruthy();
  expect(switchNamed(actor, { rolledSkill: 'culture' }, 'Savant Skill')).toBeUndefined();
  expect(ruleSetDie(actor, { ext: { [entry.name]: true } })).toBe('d4');
  expect(ruleSetDie(actor, { ext: {} })).toBeNull();
});

describe('Silver / Graphite Ranger Prime: the Defense Snags (were dice.mjs post-dialog)', () => {
  const after = (attacker, defenseType) => {
    const options = { edge: false, snag: false, shiftUp: 0, shiftDown: 0, defenseType };
    applyRuleImmunity(attacker, options, {});
    return options.snag;
  };

  test.each([['silverPrime', 'willpower', 'cleverness'], ['graphitePrime', 'cleverness', 'willpower']])('%s: a Snag against %s only', (key, yes, no) => {
    const attacker = makeActor('Foe', []);
    const prime = makeActor('Prime', [FILES[key]]);
    global.game.user.targets = new Set([prime.token]);
    global.game.user.targets.first = () => prime.token;
    expect(after(attacker, yes)).toBe(true);
    expect(after(attacker, no)).toBe(false);
    global.game.user.targets = new Set();
    expect(after(attacker, yes)).toBe(false);
  });
});

describe('Fighting Style: Careful and Defense (were documents/actor.mjs#_prepareDefenses)', () => {
  test('Careful: +2 Toughness and Evasion in cover', () => {
    const actor = makeActor('Infantry', [[FILES.fightingStyle, { system: { choice: 'careful' } }]]);
    ruleDerived(actor);
    expect(actor.system.defenses.toughness.total).toBe(10);
    actor.statuses.add('cover');
    ruleDerived(actor);
    expect(actor.system.defenses.toughness.total).toBe(12);
    expect(actor.system.defenses.evasion.total).toBe(17);
    expect(actor.system.defenses.willpower.total).toBe(11);
  });

  test('Defense: +1 Toughness and Evasion while wearing armor', () => {
    const actor = makeActor('Infantry', [[FILES.fightingStyle, { system: { choice: 'defense' } }]]);
    ruleDerived(actor);
    expect(actor.system.defenses.toughness.total).toBe(10);
    addItem(actor, { name: 'Vest', type: 'armor', system: { equipped: true, classification: 'light' } });
    ruleDerived(actor);
    expect(actor.system.defenses.toughness.total).toBe(11);
    expect(actor.system.defenses.evasion.total).toBe(16);
  });
});

test('Colony Changeling: +1 Evasion per adjacent colony changeling, up to +3 (was nearby-allies.mjs)', () => {
  const changeling = () => [FILES.colonyChangeling, { sourceId: COLONY_CHANGELING }];
  const actor = makeActor('Changeling', [changeling()], { x: 0 });
  const near = [1, 2, 3, 4].map(n => makeActor(`Near ${n}`, [changeling()], { x: 5, disposition: -1 }));
  const far = makeActor('Far', [changeling()], { x: 10 });
  const stranger = makeActor('Stranger', [], { x: 5 });
  scene(actor, near[0], far, stranger);
  ruleDerived(actor);
  expect(actor.system.defenses.evasion.total).toBe(16);
  actor.system.defenses.evasion.total = 15;
  scene(actor, ...near, far);
  ruleDerived(actor);
  expect(actor.system.defenses.evasion.total).toBe(18);
});

describe('Beatdown / Jackhammer / Motor Lancer (were weapon-perk-uses.mjs Use buttons)', () => {
  test.each([['beatdown', 5, ['standard']], ['jackhammer', 12, ['standard', 'limited']], ['beatdown', 17, ['standard', 'limited', 'restricted']]])(
    '%s at level %i: a Free action, a weapon upgrade of up to %j until the end of the turn', async (key, level, availabilities) => {
      game.combat = { id: 'c', round: 1, turn: 0, started: true, turns: [] };
      const actor = makeActor('Heavy', [FILES[key]], { system: { level } });
      const club = addItem(actor, { name: 'Club', type: 'weapon', system: { equipped: true, items: {} } });
      const upgradeUuid = 'Compendium.essence20.x.Item.upgrade';
      const upgradeDoc = { name: 'Upgrade', uuid: upgradeUuid, type: 'upgrade', system: {}, toObject: () => ({ name: 'Upgrade', type: 'upgrade', system: {}, flags: {} }) };
      const docs = new Map([[actor.uuid, actor], [upgradeUuid, upgradeDoc]]);
      global.fromUuid = async uuid => docs.get(uuid) ?? null;
      grants.chooseSelect.mockImplementationOnce(async () => club.id);
      grants.findItems.mockImplementationOnce(async () => [{ uuid: upgradeUuid, name: 'Upgrade', type: 'upgrade', system: { availability: 'standard', type: 'weapon' } }]);
      grants.pickOne.mockImplementationOnce(async () => upgradeUuid);
      await runUse(itemNamed(actor, fromPack(FILES[key]).name), pay, { pick: firstUse });
      expect(grants.findItems).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'upgrade', availabilities }));
      expect(pay).toHaveBeenCalledWith('free');
      const made = actor.items.contents.find(item => item.name == 'Upgrade');
      expect(made.flags.essence20.parentId).toBe(club.id);
      expect(made.flags.essence20.temporary).toEqual(expect.objectContaining({ kind: 'turn' }));
    });

  test('the upgrade Uses only in combat', () => {
    const actor = makeActor('Heavy', [FILES.beatdown]);
    const perk = itemNamed(actor, 'Beatdown');
    return runUse(perk, pay, { pick: firstUse }).then(result => expect(result).toBeNull());
  });

  test('Motor Lancer: a Free action marks the turn; a two-handed weapon then needs one hand', async () => {
    game.combat = { id: 'c', round: 1, turn: 0, started: true, turns: [] };
    const actor = makeActor('Lancer', [FILES.motorLancer]);
    const lance = addItem(actor, { name: 'Lance', type: 'weapon', system: { derivedHands: 2 } });
    applyItemStage(lance.system, lance);
    expect(lance.system.derivedHands).toBe(2);
    await runUse(itemNamed(actor, 'Motor Lancer'), pay, { pick: firstUse });
    expect(pay).toHaveBeenCalledWith('free');
    expect(markOf(actor, 'motorLancer')).toBeTruthy();
    applyItemStage(lance.system, lance);
    expect(lance.system.derivedHands).toBe(1);
    const knife = addItem(actor, { name: 'Knife', type: 'weapon', system: { derivedHands: 1 } });
    applyItemStage(knife.system, knife);
    expect(knife.system.derivedHands).toBe(1);
  });
});

test('Bullpup: once a scene, its own weapon reloads as a Free action (was reload-trait.mjs)', () => {
  const actor = makeActor('Soldier', []);
  const rifle = addItem(actor, { name: 'Rifle', type: 'weapon', system: { equipped: true, traits: ['reload'] } });
  const pistol = addItem(actor, { name: 'Pistol', type: 'weapon', system: { equipped: true, traits: ['reload'] } });
  const doc = fromPack(FILES.bullpup);
  addItem(actor, { name: doc.name, type: doc.type, system: clone(doc.system), flags: { core: { sourceId: 'x' }, essence20: { parentId: rifle.id } } });
  const rule = costRulesFor(actor).find(entry => entry.label?.startsWith('Bullpup'));
  expect(rule.matches({ kind: 'reload', item: rifle })).toBe(true);
  expect(rule.matches({ kind: 'reload', item: pistol })).toBe(false);
  expect(rule.to()).toBe('free');
  expect(rule.limit).toEqual({ window: 'scene', max: 1 });
});

describe('Rust Derivatives and Scramble Wave (were weapon-upgrades.mjs#applyToEffect)', () => {
  test('Rust Derivatives: its weapon\'s attacks deal 1 Acid too, unless they already have a second damage', () => {
    const actor = makeActor('Bot', []);
    const gun = addItem(actor, { name: 'Gun', type: 'weapon', system: {} });
    const doc = fromPack(FILES.rust);
    addItem(actor, { name: doc.name, type: doc.type, system: clone(doc.system), flags: { core: { sourceId: 'x' }, essence20: { parentId: gun.id } } });
    const shot = addItem(actor, { name: 'Shot', type: 'weaponEffect', system: { damageType: 'stun', secondaryDamage: { type: null, value: 0 } }, flags: { essence20: { parentId: gun.id } } });
    applyItemStage(shot.system, shot, 'end');
    expect(shot.system.secondaryDamage).toEqual({ type: 'acid', value: 1 });
    const fire = addItem(actor, { name: 'Fire', type: 'weaponEffect', system: { secondaryDamage: { type: 'fire', value: 2 } }, flags: { essence20: { parentId: gun.id } } });
    applyItemStage(fire.system, fire, 'end');
    expect(fire.system.secondaryDamage).toEqual({ type: 'fire', value: 2 });
    const other = addItem(actor, { name: 'Other', type: 'weaponEffect', system: { secondaryDamage: { type: null, value: 0 } } });
    applyItemStage(other.system, other, 'end');
    expect(other.system.secondaryDamage).toEqual({ type: null, value: 0 });
  });

  test('Scramble Wave: 1 Electromagnetic on every damaging attack (unarmed too), first in the change order', () => {
    const actor = makeActor('Inquisitor', [FILES.scrambleWave]);
    const fist = attack(actor);
    applyItemStage(fist.system, fist, 'start');
    expect(fist.system.secondaryDamage).toEqual({ type: 'emp', value: 1 });
    const stun = attack(actor, { damageType: 'stun' });
    applyItemStage(stun.system, stun, 'start');
    expect(stun.system.secondaryDamage).toEqual({ type: null, value: 0 });
    const doubled = attack(actor, { secondary: { type: 'fire', value: 1 } });
    applyItemStage(doubled.system, doubled, 'start');
    expect(doubled.system.secondaryDamage).toEqual({ type: 'fire', value: 1 });
  });
});

describe('Rise Again: +5 Defense (was rise-again.mjs + banked-buffs.mjs)', () => {
  test('banks +5 on the picked Defense for the next attack, once a scene', async () => {
    const actor = makeActor('Ranger', [FILES.riseAgain]);
    const perk = itemNamed(actor, 'Rise Again');
    await runUse(perk, pay, { pick: firstUse, ask: askFor('E20.DefenseWillpower') });
    expect(bankedEntries(actor)).toEqual([expect.objectContaining({ defense: 'willpower', defenseBonus: 5 })]);
    expect(await runUse(perk, pay, { pick: firstUse, ask: askFor('E20.DefenseToughness') })).toBeNull();
  });

  test('a cancelled pick banks nothing and keeps the use', async () => {
    const actor = makeActor('Ranger', [FILES.riseAgain]);
    const perk = itemNamed(actor, 'Rise Again');
    await runUse(perk, pay, { pick: firstUse, ask: async () => null });
    expect(bankedEntries(actor)).toEqual([]);
    await runUse(perk, pay, { pick: firstUse, ask: askFor('E20.DefenseToughness') });
    expect(bankedEntries(actor)).toEqual([expect.objectContaining({ defense: 'toughness', defenseBonus: 5 })]);
  });
});

describe('Righteous Heart and Numbness: Resistance for the Snag (were righteous-heart.mjs, numbness.mjs and dice.mjs)', () => {
  test('Righteous Heart: while Morphed, bank a chosen type; the first attack of that type weighed against it uses it up', async () => {
    const actor = makeActor('Ranger', [FILES.righteousHeart]);
    const perk = itemNamed(actor, 'Righteous Heart');
    expect(await runUse(perk, pay, { pick: firstUse })).toBeNull();
    actor.system.isMorphed = true;
    rebuildIndex(actor);
    grants.chooseSelect.mockImplementationOnce(async () => 'fire');
    await runUse(perk, pay, { pick: firstUse });
    expect(actor.flags.essence20.ruleMarks.righteousHeart).toEqual(expect.objectContaining({ text: 'fire' }));
    expect(ruleResistsAttack(actor, 'cold')).toBe(false);
    expect(markOf(actor, 'righteousHeart')).toBeTruthy();
    expect(ruleResistsAttack(actor, 'fire')).toBe(true);
    await Promise.resolve();
    expect(markOf(actor, 'righteousHeart')).toBeFalsy();
    expect(ruleResistsAttack(actor, 'fire')).toBe(false);
  });

  test('Numbness: Stone Warlord\'s chosen type counts ("energy" = every Energy type); not without Numbness', () => {
    const stoneWarlord = choice => ({ name: 'Stone Warlord', type: 'perk', system: { choice }, flags: { core: { sourceId: STONE_WARLORD } } });
    const actor = makeActor('Warlord', [FILES.numbness]);
    addItem(actor, stoneWarlord('psychic'));
    expect(ruleResistsAttack(actor, 'psychic')).toBe(true);
    expect(ruleResistsAttack(actor, 'fire')).toBe(false);
    const energy = makeActor('Warlord', [FILES.numbness]);
    addItem(energy, stoneWarlord('energy'));
    expect(ruleResistsAttack(energy, 'fire')).toBe(true);
    expect(ruleResistsAttack(energy, 'blunt')).toBe(false);
    const plain = makeActor('Warlord', []);
    addItem(plain, stoneWarlord('psychic'));
    expect(ruleResistsAttack(plain, 'psychic')).toBe(false);
  });
});
