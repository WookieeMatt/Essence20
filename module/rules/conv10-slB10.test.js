import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Round 10, group B (slB10): items converted from hand-written code to item rules with the group B engine pieces
 * (module/rules/ext/b/). Each item is loaded from its pack source and must do what the removed code did.
 */

const hooks = {};
global.Hooks = { on: (name, fn) => (hooks[name] = [...(hooks[name] ?? []), fn]), once: () => {}, callAll: () => {} };

const timed = [];
jest.unstable_mockModule('./mechanics/combat/timed-status.mjs', () => ({
  applyTimedCondition: jest.fn(async (actor, status, rounds) => {
    timed.push({ name: actor.name, status, rounds });
    actor.statuses.add(status);
  }),
}));
const dealt = [];
jest.unstable_mockModule('./mechanics/combat/combat.mjs', () => ({
  applyDamage: jest.fn(async (actor, amount, type) => dealt.push({ name: actor.name, amount, type })),
}));
const grants = {
  chooseSelect: jest.fn(async () => null),
  rollTest: jest.fn(async () => ({ success: true })),
  findItems: jest.fn(async () => []),
  pickOne: jest.fn(async () => null),
};
jest.unstable_mockModule('./mechanics/resources/grants.mjs', () => grants);
jest.unstable_mockModule('./mechanics/world/gm-relay.mjs', () => ({ needsGmRelay: () => false, relayToGm: jest.fn() }));
let lastApply = null;
const react = {
  lastApplyContext: () => lastApply,
  rollVsMany: jest.fn(async (actor, skill, others) => others.map(other => ({ targetUuid: other.uuid, success: other.name != 'Lucky' }))),
  rollVs: jest.fn(async () => ({ success: true })),
};
jest.unstable_mockModule('./mechanics/combat/reaction-engine.mjs', () => react);
const disarmed = [];
jest.unstable_mockModule('./mechanics/combat/target-riders.mjs', () => ({
  disarm: jest.fn(async (actor, target, options) => {
    disarmed.push({ name: target.name, maxHands: options.maxHands });
    return { name: 'Rifle' };
  }),
}));
const pushed = [];
jest.unstable_mockModule('./mechanics/combat/forced-movement.mjs', () => ({
  pushActor: jest.fn(async (actor, from, feet) => {
    pushed.push({ name: actor.name, from: from.name, feet });
    return true;
  }),
}));
const restored = [];
jest.unstable_mockModule('./items/healing/heal-action-medic-gear.mjs', () => ({
  restoreHealth: jest.fn(async (healer, target, amount) => restored.push({ healer: healer.name, target: target.name, amount })),
}));
const stamped = [];
jest.unstable_mockModule('./mechanics/characters/perks.mjs', () => ({
  markUsedThisTurn: jest.fn(async (actor, key) => stamped.push({ name: actor.name, key })),
  actorHasPerk: () => false,
}));
const granted = [];
const spent = [];
jest.unstable_mockModule('./mechanics/actions/action-economy.mjs', () => ({
  ACT_WHILE_DEFEATED_FLAG: 'actWhileDefeatedThisTurn',
  spend: jest.fn(async (actor, action) => {
    spent.push({ name: actor.name, action });
    return {};
  }),
  grantActionsThisTurn: jest.fn(async (actor, grants) => granted.push({ name: actor.name, ...grants })),
}));
const essenceHits = [];
jest.unstable_mockModule('./mechanics/world/environment-hazards.mjs', () => ({
  applyEssenceDamage: jest.fn(async (actor, essences) => {
    essenceHits.push({ name: actor.name, essences });
    return essences;
  }),
}));

await import('./plugins/index.mjs');
const { rebuildIndex } = await import('./index.mjs');
const { runUse } = await import('./triggers.mjs');
const { pressRuleButton } = await import('./buttons.mjs');
const { ruleDialogSwitches, ruleWeaponTraits } = await import('./adapter.mjs');
const { validateRule } = await import('./types.mjs');
const { runPostRoll, runAfterDamage, registrySnapshot } = await import('../mechanics/item-hooks.mjs');
const { hitRiderOnAttack, hitRiderOnCast } = await import('./plugins/combat/hit-rider.mjs');
const { checkActorUpdate, itemVeto, ruleAllowsArmorPair } = await import('./plugins/effects/veto.mjs');
const { ignoreArmorAdjust, armorShredDerived } = await import('./plugins/combat/ignore-armor.mjs');
const { firePatchedUp } = await import('./plugins/combat/combat-steps.mjs');
const { ruleIgnoresMissEffects, ruleSneakAttackImmune, crashProtectionOf, ruleHideBonus } = await import('./plugins/combat/immunity-readers.mjs');
const { extDialogToggles } = await import('../mechanics/item-hooks.mjs');
const { registerCheck } = await import('./predicate.mjs');
// essence20.mjs registers this check from tf1/common.mjs#favoriteWeaponOf: the Favorite Weapon Perk's choice.
registerCheck('favoriteWeaponRolled', (actor, option, ctx) => {
  const choice = actor.items.contents.find(item => item.name == 'Favorite Weapon')?.system?.choice;
  return !!choice && !!ctx?.item && (ctx.item.id == choice || ctx.item.flags?.essence20?.parentId == choice);
});

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));

const P = {
  takedown: 'gijcrbitems/_source/Takedown_Expert_gO9IixdCX0fhReZk.json',
  seconds: 'gijcrbitems/_source/Seconds_Between_Click___Boom_ofiG5IwlURUwORYV.json',
  trick: 'gijcrbitems/_source/Every_Trick_in_the_Book_HKv38GCtVdSV2qMH.json',
  rollCage: 'gijcrbitems/_source/Roll_Cage_H49a6v04JMtbUpDf.json',
  flames: 'fmmcitems/_source/Flames_of_Hate_Effect_NM8MYrneenCTTaPZ.json',
  flamesAlt: 'fmmcitems/_source/Flames_of_Hate_Alternate_Effect_C2A6ZgisRQBnlXMZ.json',
  comms: 'dditems/_source/Comms_Assault_pKArYQ259zpdsR7o.json',
  antiArmor: 'atsitems/_source/Anti_Armor__Attack__TUilm2lgtUvWyW65.json',
  pitPlate: 'dditems/_source/Pit_Plate_AgWI1lccUBTgj3gT.json',
  junkplate: 'dditems/_source/Junkplate_qhxYoMHmnerakacO.json',
  rust: 'dditems/_source/Rust_Derivatives_h5tkU3gsCoMHGCFJ.json',
  cuffs: 'dditems/_source/Stasis_Cuffs_YEvGNwsxSNGoHY3S.json',
  gluten: 'wtnvcgitems/_source/Gluten_Tolerant_dzYRdi2cSlZSHozs.json',
  matrixLight: 'dditems/_source/Armor_Matrix__Light_z3Nb6mrcAZ1c8R3q.json',
  matrixHeavy: 'dditems/_source/Armor_Matrix__Heavy_Gha7PEUJKSOmLnIx.json',
  bioTech: 'fffav1items/_source/Bio_Tech_Armor_KwLmQNCrkZ1cWM4x.json',
  swat: 'atsitems/_source/S_W_A_T__Upgrade_Ce5f5pQTNTSY6xgF.json',
  solar: 'atsitems/_source/Solar_Power__Form__4ksM4tGqdjuyPSj1.json',
  supersonic: 'atsitems/_source/Supersonic__Form__Ylo4AY4LCHTXjuuE.json',
  shieldFighter: 'ccitems/_source/Shield_Fighter_MRbKuQlNI2tOfpLM.json',
  onslaught: 'ccitems/_source/Onslaught_jtpEn1CAEwCr5J7C.json',
  timeStrike: 'jttitems/_source/Time_Strike_T7nfBj9GjUHz8alo.json',
  solarix: 'ttsgitems/_source/Solarix_Shard_jPqr2DuJMSQgiILp.json',
  construct: 'ttsgitems/_source/Power_Construct_34CRvsE7ncW4kmE8.json',
  sway: 'fgtaaitems/_source/Staggering_Sway_DulMH7OAwrg3G85A.json',
  moreBang: 'kocitems/_source/More_Bang_for_your_Buck_mfS0v8KAhBcLCC9e.json',
  softenblows: 'kocitems/_source/Softenblows_j5qSt58bw2YLeDMq.json',
  lastStand: 'tfcrbitems/_source/Last_Stand_uXX6ZCaHlM4gErua.json',
  rollWithIt: 'tfcrbitems/_source/Roll_With_It_DWlnFrFC8GrjNKVf.json',
  intensive: 'tfcrbitems/_source/Intensive_lupxm8SNDLvbjoDt.json',
  stimDart: 'gijcrbitems/_source/Stim_Dart_5Gx1CuLTEbjFqV8F.json',
  focusedBlast: 'dditems/_source/Focused_Blast_zu38NCr99BFPgEBJ.json',
  toxEn: 'dditems/_source/Tox_En_uJRbkLx1BiXNpo3p.json',
  targetRich: 'dditems/_source/Target_Rich_Environment_BF1fKwzQQb1LFKGP.json',
  sustainedBeam: 'eocitems/_source/Sustained_Beam_BIlS9uwDfZquX9hf.json',
  nowYouDont: 'tfcrbitems/_source/Now_You_Don_t_iW9TjN9X6SsYm2Ql.json',
};

const SOLAR = 'Compendium.essence20.across_the_stars.Item.4ksM4tGqdjuyPSj1';
const SUPERSONIC = 'Compendium.essence20.across_the_stars.Item.Ylo4AY4LCHTXjuuE';

let nextId = 1;
const getPath = (object, key) => String(key).split('.').reduce((o, k) => (o === null || o === undefined ? o : o[k]), object);
const setPath = (object, key, value) => {
  const keys = key.split('.');
  const last = keys.pop();
  keys.reduce((o, k) => (o[k] ??= {}), object)[last] = value;
};

async function applyUpdate(doc, data) {
  for (const [key, value] of Object.entries(data)) {
    const parts = key.split('.');
    if (parts[parts.length - 1].startsWith('-=')) {
      const last = parts.pop().slice(2);
      delete getPath(doc, parts.join('.'))?.[last];
    } else {
      setPath(doc, key, value);
    }
  }
}

function makeItem(data) {
  const item = { flags: {}, system: {}, ...data, async update(changes) {
    await applyUpdate(this, changes);
  } };
  item.id ??= `i${nextId++}`;
  item.uuid ??= `Item.${item.id}`;
  return item;
}

/** An item from a pack source file (its own rules), with its compendium id as its source. */
function packItem(file, extra = {}) {
  const doc = fromPack(file);
  return { name: doc.name, type: doc.type, system: { ...doc.system, ...(extra.system ?? {}) }, flags: { core: { sourceId: `Compendium.x.Item.${doc._id ?? 'none'}` }, ...(extra.flags ?? {}) }, ...(extra.id ? { id: extra.id } : {}) };
}

function makeActor(name, { items = [], x = 0, disposition = 1, system = {}, statuses = [], flags = {}, type = 'playerCharacter' } = {}) {
  const actor = {
    id: `a${nextId++}`, name, type, documentName: 'Actor', isOwner: true, statuses: new Set(statuses), flags: { essence20: { ...flags } },
    system: { level: 5, health: { value: 10, max: 10, bonus: 0 }, defenses: {}, powers: { personal: { value: 3, max: 3 } }, skills: {}, ...system },
    async update(data) {
      await applyUpdate(this, data);
    },
    getFlag(scope, key) {
      return getPath(this.flags?.[scope], key);
    },
    async setFlag(scope, key, value) {
      setPath(this.flags, `${scope}.${key}`, value);
    },
    toggleStatusEffect: jest.fn(async function (status, { active }) {
      if (active) {
        this.statuses.add(status);
      } else {
        this.statuses.delete(status);
      }
    }),
  };
  actor.uuid = `Actor.${actor.id}`;
  const token = { id: `t${actor.id}`, actor, document: { disposition }, center: { x, y: 0 } };
  actor.getActiveTokens = () => [token];
  actor.token = token;
  const list = items.map(data => makeItem(data));
  actor.items = { contents: list, get: id => list.find(item => item.id == id), [Symbol.iterator]: () => list[Symbol.iterator]() };
  list.forEach(item => (item.parent = item.actor = actor));
  actor.addItem = data => {
    const item = makeItem(data);
    item.parent = item.actor = actor;
    list.push(item);
    rebuildIndex(actor);
    return item;
  };

  rebuildIndex(actor);
  game.actors.contents.push(actor);
  canvas.tokens.placeables.push(token);
  return actor;
}

function target(...actors) {
  game.user.targets = new Set(actors.map(actor => actor.token));
  game.user.targets.first = () => actors[0]?.token;
}

const pay = jest.fn(async () => true);
const itemNamed = (actor, name) => actor.items.contents.find(item => item.name == name);
const cards = () => ChatMessage.create.mock.calls.map(([data]) => data);
const buttonCards = () => cards().filter(data => data.flags?.essence20?.ruleButton);
const chatText = () => cards().map(data => String(data.content ?? '')).join('\n');
const tools = () => ({
  damageBonusNote: jest.fn((result, amount) => {
    result.damageValue += amount;
  }),
});

/** Press the last posted rule button card. */
async function pressLast(user = game.user) {
  const card = buttonCards().at(-1);
  card.update = async data => applyUpdate(card, data);
  return pressRuleButton(card, user);
}

/** The post-roll hooks for one roll against these targets (hit / miss per target). */
async function rolled(actor, item, outcomes, { dataset = {}, switches = [], isCrit = false } = {}) {
  const hits = outcomes.map(([other, hit]) => ({ target: other, hit, result: { targetUuid: other.uuid, success: hit, multiplier: 1, total: 15, difficulty: 10 } }));
  await runPostRoll(actor, hits.map(h => h.result), {}, { hits, isCrit, rider: { itemUuid: item?.uuid, skill: item?.system?.classification?.skill, switches, dataset } });
}

beforeEach(() => {
  for (const list of [timed, dealt, disarmed, pushed, restored, stamped, granted, spent, essenceHits]) {
    list.length = 0;
  }

  lastApply = null;
  pay.mockClear();
  grants.chooseSelect.mockReset();
  grants.rollTest.mockReset();
  grants.rollTest.mockImplementation(async () => ({ success: true }));
  global.game = {
    combat: null, user: { id: 'u', isGM: true, targets: new Set() }, users: { contents: [] },
    i18n: { localize: k => k, format: k => k, has: () => false }, settings: { get: () => 1 }, actors: { contents: [] },
  };
  game.user.targets.first = () => undefined;
  global.CONFIG = { E20: { damageTypes: { sharp: 'Sharp', blunt: 'Blunt', fire: 'Fire', stun: 'Stun', sonic: 'Sonic', element: 'Energy' }, skillToEssence: {} } };
  global.canvas = {
    tokens: { placeables: [], controlled: [], setTargets: jest.fn() },
    grid: { measurePath: ([a, b]) => ({ distance: Math.abs(a.x - b.x) }) },
  };
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn() } };
  global.ChatMessage = { create: jest.fn(async data => data), getSpeaker: () => ({}) };
  global.fromUuidSync = uuid => game.actors.contents.find(actor => actor.uuid == uuid)
    ?? game.actors.contents.flatMap(actor => actor.items.contents).find(item => item.uuid == uuid) ?? null;
  global.foundry = {
    utils: { getProperty: getPath, setProperty: setPath, deepClone: v => JSON.parse(JSON.stringify(v)) },
    applications: { api: { DialogV2: { wait: jest.fn(async () => '0'), prompt: jest.fn() } } },
  };
});

test('every rule on the converted items validates', () => {
  for (const file of Object.values(P)) {
    for (const rule of fromPack(file).system.rules ?? []) {
      expect([file, validateRule(rule)]).toEqual([file, []]);
    }
  }
});

test('no hand-written Use or hit rider is left for them', () => {
  const ids = registrySnapshot().uses.map(use => use.id);
  for (const id of ['o2StasisCuffs', 'o1ShieldFighter', 'o3Solarix', 'o2StimDart', 'zord1AntiArmor']) {
    expect(ids).not.toContain(id);
  }
});

describe('Takedown Expert', () => {
  test('a failed Takedown on a target of no higher level offers Disarmed / Immobilized / Silenced', async () => {
    const hero = makeActor('Hero', { items: [packItem(P.takedown)] });
    const thug = makeActor('Thug', { disposition: -1, system: { level: 5 } });
    foundry.applications.api.DialogV2.wait.mockResolvedValueOnce('0');
    await rolled(hero, null, [[thug, false]], { dataset: { isTakedown: true } });
    expect(disarmed).toEqual([{ name: 'Thug', maxHands: 2 }]);
    foundry.applications.api.DialogV2.wait.mockResolvedValueOnce('2');
    await rolled(hero, null, [[thug, false]], { dataset: { isTakedown: true } });
    expect(timed).toEqual([{ name: 'Thug', status: 'silenced', rounds: 0 }]);
    expect(chatText()).toContain('failed Takedown also leaves Thug silenced.');
  });

  test('nothing against a higher-level target, on a hit, or on another roll', async () => {
    const hero = makeActor('Hero', { items: [packItem(P.takedown)] });
    const boss = makeActor('Boss', { disposition: -1, type: 'npc', system: { threatLevel: 9 } });
    const thug = makeActor('Thug', { disposition: -1, system: { level: 3 } });
    await rolled(hero, null, [[boss, false]], { dataset: { isTakedown: true } });
    await rolled(hero, null, [[thug, true]], { dataset: { isTakedown: true } });
    await rolled(hero, null, [[thug, false]], { dataset: {} });
    expect(foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
  });
});

test('Seconds Between Click & Boom, Every Trick in the Book, Roll Cage: their reader rules', () => {
  const holder = makeActor('Joe', { items: [packItem(P.seconds), packItem(P.trick), packItem(P.rollCage)] });
  expect(ruleIgnoresMissEffects(holder, 'evasion')).toBe(true);
  expect(ruleIgnoresMissEffects(holder, 'toughness')).toBe(false);
  expect(ruleSneakAttackImmune(holder)).toBe(true);
  expect(crashProtectionOf(holder)?.name).toBe('Roll Cage');
  const plain = makeActor('Plain');
  expect([ruleIgnoresMissEffects(plain, 'evasion'), ruleSneakAttackImmune(plain), crashProtectionOf(plain)]).toEqual([false, false, null]);
});

describe('armor', () => {
  test('Flames of Hate: its attacks ignore the armor share of the Defense', () => {
    const monster = makeActor('Monster', { items: [{ id: 'w', type: 'weapon', name: 'Flames of Hate' }, packItem(P.flames, { id: 'fx' }), packItem(P.flamesAlt, { id: 'fx2' })] });
    const fx = monster.items.get('fx');
    const ranger = makeActor('Ranger', { system: { isMorphed: true, defenses: { cleverness: { armor: 0, morphed: 2 } } } });
    expect(ignoreArmorAdjust(monster, ranger, 'cleverness', { item: fx })).toBe(-2);
    expect(ignoreArmorAdjust(monster, ranger, 'cleverness', { item: monster.items.get('fx2') })).toBe(-2);
    ranger.statuses.add('armorStripped');
    expect(ignoreArmorAdjust(monster, ranger, 'cleverness', { item: fx })).toBe(0);
    expect(ignoreArmorAdjust(monster, makeActor('Thug', { system: { defenses: { cleverness: { armor: 1 } } } }), 'cleverness', { item: { type: 'weaponEffect', id: 'x' } })).toBe(0);
  });

  test('Comms Assault: Toughness without armor only while its roll mark is on', () => {
    const hero = makeActor('Hero', { items: [packItem(P.comms)] });
    const foe = makeActor('Foe', { system: { defenses: { toughness: { armor: 1 } } }, items: [{ type: 'armor', system: { equipped: true, totalBonusToughness: 2 } }] });
    expect(ignoreArmorAdjust(hero, foe, 'toughness', {})).toBe(0);
    hero.flags.essence20.ruleMarks = { tf1CommsAssault: { by: hero.uuid } };
    expect(ignoreArmorAdjust(hero, foe, 'toughness', {})).toBe(-3);
    expect(ignoreArmorAdjust(hero, foe, 'willpower', {})).toBe(0);
  });

  test('Anti-Armor: the lone weapon is picked on drop, gains Anti-Tank and Wrecker, and its crits shred 2 armor per hit for the scene', async () => {
    const zord = makeActor('Zord', { type: 'zord', items: [{ id: 'cannon', type: 'weapon', name: 'Cannon' }, { id: 'shot', type: 'weaponEffect', name: 'Shot', flags: { essence20: { parentId: 'cannon' } } }] });
    const feature = zord.addItem(packItem(P.antiArmor));
    const { fireItemAdded } = await import('./triggers.mjs');
    await fireItemAdded(zord, feature);
    expect(feature.flags.essence20.rules.choices.weapon).toBe('cannon');
    expect(ruleWeaponTraits(zord, zord.items.get('cannon'), [])).toEqual(expect.arrayContaining(['antiTank', 'wrecker']));
    const foe = makeActor('Foe', { disposition: -1, system: { defenses: { toughness: { total: 16, armor: 3 } } } });
    await rolled(zord, zord.items.get('shot'), [[foe, true]], { isCrit: true });
    await rolled(zord, zord.items.get('shot'), [[foe, true]], { isCrit: true });
    expect(foe.flags.essence20.ruleMarks.armorShred.count).toBe(4);
    armorShredDerived(foe);
    expect(foe.system.defenses.toughness.total).toBe(13);
    // A plain hit, or a crit with another weapon, does nothing.
    const other = makeActor('Other', { disposition: -1 });
    await rolled(zord, zord.items.get('shot'), [[other, true]]);
    expect(other.flags.essence20.ruleMarks).toBeUndefined();
  });

  test('Anti-Armor: an old pick carries over', () => {
    const rule = fromPack(P.antiArmor).system.rules[0];
    expect(rule.steps[0].legacy).toBe('flags.essence20.zord1AntiArmorWeapon');
  });
});

describe('Decepticon Directive gear', () => {
  test('Pit Plate / Junkplate: unarmed Blunt hits (and their double crit) become Sharp while worn', () => {
    const brute = makeActor('Brute', { items: [{ id: 'arm', type: 'armor', system: { equipped: true } }, packItem(P.junkplate, { flags: { essence20: { parentId: 'arm' } } }), { id: 'fist', type: 'weaponEffect', name: 'Fist', system: {} }] });
    const result = { damageValue: 2, damageType: 'blunt', criticalOptions: [{ key: 'double', damageType: 'blunt' }] };
    hitRiderOnAttack(brute, null, result, { itemUuid: 'Item.fist' }, tools());
    expect(result).toMatchObject({ damageType: 'sharp', criticalOptions: [{ damageType: 'sharp' }] });
    const fire = { damageValue: 2, damageType: 'fire' };
    hitRiderOnAttack(brute, null, fire, { itemUuid: 'Item.fist' }, tools());
    expect(fire.damageType).toBe('fire');
    brute.items.get('arm').system.equipped = false;
    rebuildIndex(brute);
    const off = { damageValue: 2, damageType: 'blunt' };
    hitRiderOnAttack(brute, null, off, { itemUuid: 'Item.fist' }, tools());
    expect(off.damageType).toBe('blunt');
    const pit = makeActor('Pit', { items: [packItem(P.pitPlate), { id: 'claw', type: 'weaponEffect', name: 'Claw' }] });
    const hit = { damageValue: 1, damageType: 'blunt' };
    hitRiderOnAttack(pit, null, hit, { itemUuid: 'Item.claw' }, tools());
    expect(hit.damageType).toBe('sharp');
  });

  test('Rust Derivatives: a hit corrodes the target once; no healing until a DIF 20 treatment', async () => {
    const hero = makeActor('Hero', { items: [{ id: 'gun', type: 'weapon', system: { equipped: true } }, { id: 'shot', type: 'weaponEffect', name: 'Shot', flags: { essence20: { parentId: 'gun' } } }, packItem(P.rust, { flags: { essence20: { parentId: 'gun' } } })] });
    const foe = makeActor('Foe', { disposition: -1, system: { health: { value: 3, max: 10 } } });
    await rolled(hero, hero.items.get('shot'), [[foe, true]]);
    expect(foe.flags.essence20.ruleMarks.o2Rusted.by).toBe(hero.uuid);
    expect(buttonCards()).toHaveLength(1);
    await rolled(hero, hero.items.get('shot'), [[foe, true]]);
    expect(buttonCards()).toHaveLength(1);
    const heal = { system: { health: { value: 6 } } };
    expect(checkActorUpdate(foe, heal)).toBe(true);
    expect(heal.system.health.value).toBe(3);
    // The treatment: a failed roll leaves it, a success clears it (the presser's own character rolls).
    const medic = makeActor('Medic');
    game.user.character = medic;
    game.user.isGM = false;
    grants.rollTest.mockResolvedValueOnce({ success: false });
    foundry.applications.api.DialogV2.wait.mockResolvedValue('1');
    await pressLast();
    expect(grants.rollTest).toHaveBeenLastCalledWith(medic, 'technology', 20, expect.anything());
    expect(foe.flags.essence20.ruleMarks.o2Rusted).toBeDefined();
    await pressLast();
    expect(foe.flags.essence20.ruleMarks.o2Rusted).toBeUndefined();
    const later = { system: { health: { value: 6 } } };
    checkActorUpdate(foe, later);
    expect(later.system.health.value).toBe(6);
  });

  test('Stasis Cuffs: a Standard action with d2 Technology; no converting or Energon spending, Impaired; break free or release', async () => {
    const hero = makeActor('Hero', { items: [packItem(P.cuffs)], system: { skills: { technology: { shift: 'd20' } } } });
    const bot = makeActor('Bot', { disposition: -1, system: { isTransformed: false, energon: { normal: { value: 3 }, dark: { value: 1 } } } });
    const cuffs = itemNamed(hero, 'Stasis Cuffs');
    await runUse(cuffs, pay);
    expect(pay).not.toHaveBeenCalled();
    target(bot);
    expect(await runUse(cuffs, pay)).toContain('Stasis Cuffs need at least d2 Technology to use.');
    expect(pay).not.toHaveBeenCalled();
    hero.system.skills.technology.shift = 'd2';
    await runUse(cuffs, pay);
    expect(pay).toHaveBeenCalledWith('standard');
    expect(bot.flags.essence20.ruleMarks.o2StasisCuffs.by).toBe(hero.uuid);
    expect(bot.statuses.has('impaired')).toBe(true);
    expect(checkActorUpdate(bot, { system: { isTransformed: true } })).toBe(false);
    expect(checkActorUpdate(bot, { system: { energon: { normal: { value: 2 } } } })).toBe(false);
    expect(checkActorUpdate(bot, { system: { energon: { dark: { value: 0 } } } })).toBe(false);
    expect(checkActorUpdate(bot, { system: { energon: { normal: { value: 4 } } } })).toBe(true);
    const [breakCard, releaseCard] = buttonCards().slice(-2);
    // Break Free: the cuffed one rolls Brawn DIF 19.
    breakCard.update = async data => applyUpdate(breakCard, data);
    grants.rollTest.mockResolvedValueOnce({ success: false });
    await pressRuleButton(breakCard);
    expect(grants.rollTest).toHaveBeenLastCalledWith(bot, 'brawn', 19, expect.anything());
    expect(bot.flags.essence20.ruleMarks.o2StasisCuffs).toBeDefined();
    await pressRuleButton(breakCard);
    expect(bot.flags.essence20.ruleMarks.o2StasisCuffs).toBeUndefined();
    expect(bot.statuses.has('impaired')).toBe(false);
    expect(checkActorUpdate(bot, { system: { isTransformed: true } })).toBe(true);
    expect(releaseCard.flags.essence20.ruleButton.who).toBe('anyone');
  });

  test('Stasis Cuffs: nobody targeted, or the user themselves - nothing spent', async () => {
    const hero = makeActor('Hero', { items: [packItem(P.cuffs)], system: { skills: { technology: { shift: 'd4' } } } });
    target(hero);
    await runUse(itemNamed(hero, 'Stasis Cuffs'), pay);
    expect(pay).not.toHaveBeenCalled();
  });
});

describe('vetoes and armor pairs', () => {
  test('Gluten-Tolerant: the Weird Perk can\'t be added', () => {
    const actor = makeActor('Citizen', { items: [packItem(P.gluten)] });
    expect(itemVeto(actor, { name: 'Weird', type: 'perk', flags: { core: { sourceId: 'Compendium.essence20.wtnv_citizens_guide.Item.RO0a3eX8MIo5g1Tv' } } }, 'create')).not.toBeNull();
    expect(itemVeto(actor, { name: 'Other', type: 'perk', flags: { core: { sourceId: 'Compendium.x.Item.other' } } }, 'create')).toBeNull();
    expect(itemVeto(makeActor('Plain'), { name: 'Weird', type: 'perk', flags: { core: { sourceId: 'Compendium.x.Item.RO0a3eX8MIo5g1Tv' } } }, 'create')).toBeNull();
  });

  test('Armor Matrix: a second loose matrix can\'t be added', () => {
    const bot = makeActor('Bot', { items: [packItem(P.matrixLight)] });
    const heavy = { name: 'Armor Matrix (Heavy)', type: 'upgrade', flags: { core: { sourceId: 'Compendium.essence20.decepticon_directive.Item.Gha7PEUJKSOmLnIx' } } };
    expect(itemVeto(bot, heavy, 'create')).not.toBeNull();
    expect(itemVeto(bot, { ...heavy, flags: { ...heavy.flags, essence20: { parentId: 'h' } } }, 'create')).toBeNull();
    expect(itemVeto(makeActor('Fresh'), heavy, 'create')).toBeNull();
    const attached = makeActor('Attached', { items: [{ id: 'h', type: 'weapon', system: { equipped: true } }, packItem(P.matrixHeavy, { flags: { essence20: { parentId: 'h' } } })] });
    expect(itemVeto(attached, heavy, 'create')).toBeNull();
  });

  test('Bio-Tech Armor: an Organic Battledress set with a Computerized one', () => {
    const marine = makeActor('Marine', { items: [packItem(P.bioTech), { id: 'o', type: 'armor', name: 'Suit' }, { type: 'upgrade', name: 'Organic Battledress', flags: { essence20: { parentId: 'o' } } }, { id: 'c', type: 'armor', name: 'Rig', system: { traits: ['computerized'] } }] });
    expect(ruleAllowsArmorPair(marine, marine.items.get('o'), marine.items.get('c'))).toBe(true);
    expect(ruleAllowsArmorPair(marine, marine.items.get('c'), marine.items.get('c'))).toBe(false);
  });
});

describe('hit-card riders', () => {
  test('S.W.A.T. Upgrade: Incapacitation Ammo switch on a Zord\'s ranged attacks, a Stun option one higher', () => {
    const zord = makeActor('Zord', { type: 'zord', items: [packItem(P.swat), { id: 'bolt', type: 'weaponEffect', name: 'Bolt', system: { classification: { style: 'ranged' } } }, { id: 'ram', type: 'weaponEffect', name: 'Ram', system: { classification: { style: 'melee' } } }] });
    const label = 'Incapacitation Ammo (Stun, 1 higher than the damage)';
    expect(ruleDialogSwitches(zord, { item: zord.items.get('bolt') }).map(s => s.label)).toContain(label);
    expect(ruleDialogSwitches(zord, { item: zord.items.get('ram') }).map(s => s.label)).not.toContain(label);
    const result = { damageValue: 3 };
    hitRiderOnAttack(zord, null, result, { itemUuid: 'Item.bolt', switches: ['pr1SwatStun'] }, tools());
    expect(result.riderOptions).toEqual([expect.objectContaining({ damageValue: 4, damageType: 'stun', label: 'Incapacitation Ammo' })]);
    const plain = { damageValue: 3 };
    hitRiderOnAttack(zord, null, plain, { itemUuid: 'Item.bolt', switches: [] }, tools());
    expect(plain.riderOptions).toBeUndefined();
  });

  test('Solar Power: Power Weapon +1 and the chosen Element; Blaster / Targeting weapons a 1 Fire option', () => {
    const ranger = makeActor('Ranger', {
      system: { isMorphed: true }, flags: { zord1Form: { uuid: SOLAR, element: 'cold' } },
      items: [
        packItem(P.solar),
        { id: 'pw', type: 'weapon', name: 'Power Sword', system: { traits: ['powerWeapon'] } },
        { id: 'slash', type: 'weaponEffect', name: 'Slash', flags: { essence20: { parentId: 'pw' } } },
        { id: 'bb', type: 'weapon', name: 'Blade Blaster', system: { traits: ['powerWeapon'] } },
        { id: 'pew', type: 'weaponEffect', name: 'Pew', flags: { essence20: { parentId: 'bb' } } },
        { id: 'rifle', type: 'weapon', name: 'Rifle' },
        { id: 'aim', type: 'weaponEffect', name: 'Aimed', flags: { essence20: { parentId: 'rifle' } } },
        { id: 'fist', type: 'weaponEffect', name: 'Fist' },
      ],
    });
    const sword = { damageValue: 2, damageType: 'sharp' };
    hitRiderOnAttack(ranger, null, sword, { itemUuid: 'Item.slash', skill: 'might' }, tools());
    expect(sword).toMatchObject({ damageValue: 3, damageType: 'cold' });
    expect(sword.riderOptions).toBeUndefined();
    const blaster = { damageValue: 2, damageType: 'energy' };
    hitRiderOnAttack(ranger, null, blaster, { itemUuid: 'Item.pew', skill: 'targeting' }, tools());
    expect(blaster).toMatchObject({ damageValue: 2, damageType: 'energy', riderOptions: [expect.objectContaining({ damageValue: 1, damageType: 'fire' })] });
    const rifle = { damageValue: 2 };
    hitRiderOnAttack(ranger, null, rifle, { itemUuid: 'Item.aim', skill: 'targeting' }, tools());
    expect(rifle.riderOptions).toHaveLength(1);
    const rifleMelee = { damageValue: 2 };
    hitRiderOnAttack(ranger, null, rifleMelee, { itemUuid: 'Item.aim', skill: 'might' }, tools());
    expect(rifleMelee.riderOptions).toBeUndefined();
    const fist = { damageValue: 1 };
    hitRiderOnAttack(ranger, null, fist, { itemUuid: 'Item.fist', skill: 'targeting' }, tools());
    expect(fist.riderOptions).toBeUndefined();
    // Not Morphed, or another Form: nothing.
    ranger.system.isMorphed = false;
    const off = { damageValue: 2, damageType: 'sharp' };
    hitRiderOnAttack(ranger, null, off, { itemUuid: 'Item.slash' }, tools());
    expect(off).toEqual({ damageValue: 2, damageType: 'sharp' });
  });

  test('Supersonic: the Blade Blaster deals Sonic; an unarmed attack Energy when its switch is ticked', () => {
    const ranger = makeActor('Ranger', {
      system: { isMorphed: true }, flags: { zord1Form: { uuid: SUPERSONIC } },
      items: [packItem(P.supersonic), { id: 'bb', type: 'weapon', name: 'Blade Blaster' }, { id: 'pew', type: 'weaponEffect', name: 'Pew', flags: { essence20: { parentId: 'bb' } } }, { id: 'fist', type: 'weaponEffect', name: 'Fist' }],
    });
    const pew = { damageValue: 2, damageType: 'energy' };
    hitRiderOnAttack(ranger, null, pew, { itemUuid: 'Item.pew' }, tools());
    expect(pew.damageType).toBe('sonic');
    expect(ruleDialogSwitches(ranger, { item: ranger.items.get('fist') }).map(s => s.label)).toContain('Deal Energy damage (Supersonic)');
    expect(ruleDialogSwitches(ranger, { item: ranger.items.get('pew') }).map(s => s.label)).not.toContain('Deal Energy damage (Supersonic)');
    const punch = { damageValue: 1, damageType: 'blunt' };
    hitRiderOnAttack(ranger, null, punch, { itemUuid: 'Item.fist', switches: ['zord1SupersonicEnergy'] }, tools());
    expect(punch.damageType).toBe('element');
    const plain = { damageValue: 1, damageType: 'blunt' };
    hitRiderOnAttack(ranger, null, plain, { itemUuid: 'Item.fist', switches: [] }, tools());
    expect(plain.damageType).toBe('blunt');
  });

  test('Shield Fighter: a Free action and a Personal Shield use give the shield an Element; its blade / bludgeon hits offer it', async () => {
    const viper = makeActor('Viper', { items: [
      packItem(P.shieldFighter), { type: 'rolePoints', name: 'Personal Shield', system: { resource: { value: 2, max: 3 } } },
      { id: 'blade', type: 'weapon', name: 'Shield (blade)', flags: { core: { sourceId: 'Compendium.essence20.gi_joe_crb.Item.8lNIijY5XompKHH7' } } },
      { id: 'cut', type: 'weaponEffect', name: 'Cut', flags: { essence20: { parentId: 'blade' } } },
      { id: 'gun', type: 'weapon', name: 'Gun' }, { id: 'shot', type: 'weaponEffect', name: 'Shot', flags: { essence20: { parentId: 'gun' } } },
    ] });
    grants.chooseSelect.mockResolvedValueOnce(null);
    await runUse(itemNamed(viper, 'Shield Fighter'), pay);
    expect(pay).not.toHaveBeenCalled();
    grants.chooseSelect.mockResolvedValueOnce('fire');
    await runUse(itemNamed(viper, 'Shield Fighter'), pay);
    expect(pay).toHaveBeenCalledWith('free');
    expect(itemNamed(viper, 'Personal Shield').system.resource.value).toBe(1);
    expect(viper.flags.essence20.ruleMarks.o1ShieldElement).toMatchObject({ until: 'rounds:10' });
    const cut = { damageValue: 3, damageType: 'sharp' };
    hitRiderOnAttack(viper, null, cut, { itemUuid: 'Item.cut' }, tools());
    expect(cut.riderOptions).toEqual([expect.objectContaining({ damageValue: 3, damageType: 'fire', label: 'Shield Fighter: as Element' })]);
    const shot = { damageValue: 3 };
    hitRiderOnAttack(viper, null, shot, { itemUuid: 'Item.shot' }, tools());
    expect(shot.riderOptions).toBeUndefined();
  });

  test('Onslaught: a melee hit offers the weapon\'s other effects, or a Maneuver', () => {
    const brute = makeActor('Brute', { items: [
      packItem(P.onslaught), { id: 'w', type: 'weapon', name: 'Club' },
      { id: 'e1', type: 'weaponEffect', name: 'Smash', flags: { essence20: { parentId: 'w' } }, system: { damageValue: 2, damageType: 'blunt', classification: { style: 'melee' } } },
      { id: 'fist', type: 'weaponEffect', name: 'Fist', system: { classification: { style: 'melee' } } },
    ] });
    const lone = { damageValue: 2 };
    hitRiderOnAttack(brute, null, lone, { itemUuid: 'Item.e1', style: 'melee' }, tools());
    expect(lone.riderOptions.map(o => [o.label, o.damageType, o.damageValue])).toEqual([['Onslaught: Maneuver', 'maneuver', 1]]);
    brute.addItem({ id: 'e2', type: 'weaponEffect', name: 'Stun Hit', flags: { essence20: { parentId: 'w' } }, system: { damageValue: 1, damageType: 'stun' } });
    const two = { damageValue: 2 };
    hitRiderOnAttack(brute, null, two, { itemUuid: 'Item.e1', style: 'melee' }, tools());
    expect(two.riderOptions.map(o => [o.label, o.damageType, o.damageValue])).toEqual([['Onslaught: Stun Hit', 'stun', 1]]);
  });

  test('Time Strike: 1 Personal Power on a Chrono Saber attack while Morphed; the second saber\'s damage and its other effects', () => {
    const ranger = makeActor('Ranger', { system: { isMorphed: true, powers: { personal: { value: 1 } } }, items: [
      packItem(P.timeStrike), { id: 'cs', type: 'weapon', name: 'Chrono Sabers' },
      { id: 'slash', type: 'weaponEffect', name: 'Slash', flags: { essence20: { parentId: 'cs' } }, system: { damageValue: 2, damageType: 'sharp' } },
      { id: 'freeze', type: 'weaponEffect', name: 'Time Freeze', flags: { essence20: { parentId: 'cs' } }, system: { damageValue: 0, damageType: 'immobilized' } },
    ] });
    const label = 'Time Strike (1 Personal Power)';
    expect(ruleDialogSwitches(ranger, { item: ranger.items.get('slash') }).map(s => s.label)).toContain(label);
    ranger.system.powers.personal.value = 0;
    expect(ruleDialogSwitches(ranger, { item: ranger.items.get('slash') }).map(s => s.label)).not.toContain(label);
    const result = { damageValue: 2 };
    const t = tools();
    hitRiderOnAttack(ranger, null, result, { itemUuid: 'Item.slash', switches: ['o1TimeStrike'] }, t);
    expect(t.damageBonusNote).toHaveBeenCalledWith(result, 2, 'Time Strike (second Chrono Saber)');
    expect(result.riderOptions).toEqual([expect.objectContaining({ label: 'Time Strike: Time Freeze', damageType: 'immobilized' })]);
  });

  test('Solarix Shard: set into a Power Weapon; that weapon\'s hits get a 1 Fire option', async () => {
    const ranger = makeActor('Ranger', { items: [
      packItem(P.solarix), { id: 'pw', type: 'weapon', name: 'Power Bow', system: { traits: ['powerWeapon'] } },
      { id: 'arrow', type: 'weaponEffect', name: 'Arrow', flags: { essence20: { parentId: 'pw' } } },
      { id: 'gun', type: 'weapon', name: 'Gun' }, { id: 'shot', type: 'weaponEffect', name: 'Shot', flags: { essence20: { parentId: 'gun' } } },
    ] });
    grants.chooseSelect.mockImplementationOnce(async (title, prompt, options) => {
      expect(options.map(o => o.value)).toEqual(['pw']);
      return 'pw';
    });
    await runUse(itemNamed(ranger, 'Solarix Shard'), pay);
    const arrow = { damageValue: 2 };
    hitRiderOnAttack(ranger, null, arrow, { itemUuid: 'Item.arrow' }, tools());
    expect(arrow.riderOptions).toEqual([expect.objectContaining({ damageValue: 1, damageType: 'fire', label: 'Solarix Shard' })]);
    const shot = { damageValue: 2 };
    hitRiderOnAttack(ranger, null, shot, { itemUuid: 'Item.shot' }, tools());
    expect(shot.riderOptions).toBeUndefined();
  });

  test('Power Construct: melee hits offer 2 Energy; a melee attacker gets a GM button for 1 Energy; it vanishes at 0 Health', async () => {
    const zord = makeActor('Zord', { type: 'zord', items: [packItem(P.construct), { id: 'claw', type: 'weaponEffect', name: 'Claw', system: { classification: { style: 'melee' } } }] });
    const hit = { damageValue: 3 };
    hitRiderOnAttack(zord, null, hit, { itemUuid: 'Item.claw', style: 'melee' }, tools());
    expect(hit.riderOptions).toEqual([expect.objectContaining({ damageValue: 2, damageType: 'element' })]);
    const ranged = { damageValue: 3 };
    hitRiderOnAttack(zord, null, ranged, { itemUuid: 'Item.claw', style: 'ranged' }, tools());
    expect(ranged.riderOptions).toBeUndefined();
    const brute = makeActor('Brute', { disposition: -1 });
    lastApply = { isAttack: true, isMelee: true, targetUuid: zord.uuid, attackerUuid: brute.uuid };
    zord.system.health.value = 6;
    await runAfterDamage(zord, 4, 'blunt', { newValue: 6, previousValue: 10, wasAlreadyDefeated: false, source: brute });
    const card = buttonCards().at(-1);
    expect(card.flags.essence20.ruleButton).toMatchObject({ who: 'gm', targets: [brute.uuid] });
    await pressLast();
    expect(dealt).toEqual([{ name: 'Brute', amount: 1, type: 'element' }]);
    lastApply = { isAttack: true, isMelee: false, targetUuid: zord.uuid };
    await runAfterDamage(zord, 1, 'blunt', { newValue: 5, previousValue: 6, wasAlreadyDefeated: false, source: brute });
    expect(buttonCards()).toHaveLength(1);
  });

  test('Staggering Sway: an ally\'s Stun hits deal 1 more, the holder anywhere', () => {
    makeActor('Face', { items: [packItem(P.sway)] });
    const ally = makeActor('Ally', { items: [{ id: 'taser', type: 'weaponEffect', name: 'Taser', system: { damageType: 'stun' } }] });
    const foe = makeActor('Foe', { disposition: -1 });
    const stun = { damageValue: 2, damageType: 'stun' };
    hitRiderOnAttack(ally, foe, stun, { itemUuid: 'Item.taser', damageType: 'stun' }, tools());
    expect(stun.damageValue).toBe(3);
    const blunt = { damageValue: 2, damageType: 'blunt' };
    hitRiderOnAttack(ally, foe, blunt, { damageType: 'blunt' }, tools());
    expect(blunt.damageValue).toBe(2);
    const enemy = { damageValue: 2, damageType: 'stun' };
    hitRiderOnAttack(foe, ally, enemy, { damageType: 'stun' }, tools());
    expect(enemy.damageValue).toBe(2);
  });

  test('More Bang for your Buck: +1 on a successful Fireball, Temper Tempest or Fire spell', async () => {
    const mage = makeActor('Mage', { items: [
      packItem(P.moreBang),
      { id: 'fb', type: 'spell', name: 'Fireball', flags: { core: { sourceId: 'Compendium.essence20.knights_of_canterlot.Item.zlERIywyKQNBQzs6' } } },
      { id: 'zap', type: 'spell', name: 'Zap', system: { damageType: 'electric' } },
    ] });
    const rows = [{ success: true, damageValue: 3 }, { success: false, damageValue: 3 }];
    await hitRiderOnCast(mage, rows, {}, { rider: { itemUuid: 'Item.fb' } });
    expect(rows.map(r => r.damageValue)).toEqual([4, 3]);
    expect(rows[0].damageBonusLabel).toBe('+1 (More Bang for your Buck)');
    const zap = [{ success: true, damageValue: 3 }];
    await hitRiderOnCast(mage, zap, {}, { rider: { itemUuid: 'Item.zap' } });
    expect(zap[0].damageValue).toBe(3);
    const burning = [{ success: true, damageValue: 3 }];
    await hitRiderOnCast(mage, burning, { damageType: 'fire' }, { rider: { itemUuid: 'Item.zap' } });
    expect(burning[0].damageValue).toBe(4);
  });

  test('Softenblows: a successful cast leaves the target unable to deal damage until the end of its next turn', async () => {
    const pony = makeActor('Pony', { items: [packItem(P.softenblows, { id: 'soft' })] });
    const brute = makeActor('Brute', { disposition: -1 });
    target(brute);
    await rolled(pony, pony.items.get('soft'), [[brute, true]]);
    expect(brute.flags.essence20.ruleMarks.softenblows).toMatchObject({ by: pony.uuid, until: 'endOfNextTurn' });
    const hit = { damageValue: 4 };
    hitRiderOnAttack(brute, pony, hit, {}, tools());
    expect(hit.damageValue).toBe(0);
    const other = makeActor('Other', { disposition: -1 });
    const fine = { damageValue: 4 };
    hitRiderOnAttack(other, pony, fine, {}, tools());
    expect(fine.damageValue).toBe(4);
  });
});

describe('Transformers reactions', () => {
  test('Last Stand: Defeated in a combat - a whispered button; pressing acts while Defeated with a full turn at whoever did it', async () => {
    const warrior = makeActor('Warrior', { items: [packItem(P.lastStand)] });
    const foe = makeActor('Foe', { disposition: -1 });
    await runAfterDamage(warrior, 12, 'blunt', { newValue: 0, previousValue: 10, wasAlreadyDefeated: false, source: foe });
    expect(buttonCards()).toHaveLength(0);
    game.combat = { id: 'c', started: true, round: 1, turn: 0, combatants: [] };
    await runAfterDamage(warrior, 12, 'blunt', { newValue: 0, previousValue: 10, wasAlreadyDefeated: false, source: foe });
    expect(buttonCards()).toHaveLength(1);
    expect(buttonCards()[0].whisper).toBeDefined();
    await pressLast();
    expect(stamped).toEqual([{ name: 'Warrior', key: 'actWhileDefeatedThisTurn' }]);
    expect(granted).toEqual([expect.objectContaining({ name: 'Warrior', standard: 1, move: 1 })]);
    expect(canvas.tokens.setTargets).toHaveBeenCalledWith([foe.token.id]);
    expect(chatText()).toContain('Warrior takes one last full turn against Foe.');
  });

  test('Roll With It: damage that leaves you standing offers a 10 ft push away from the source, once per turn', async () => {
    game.combat = { id: 'c', started: true, round: 1, turn: 0, combatants: [] };
    const scout = makeActor('Scout', { items: [packItem(P.rollWithIt)], system: { health: { value: 6, max: 10 } } });
    const foe = makeActor('Foe', { disposition: -1 });
    await runAfterDamage(scout, 2, 'blunt', { newValue: 6, previousValue: 8, source: foe });
    expect(buttonCards()).toHaveLength(1);
    await pressLast();
    expect(pushed).toEqual([{ name: 'Scout', from: 'Foe', feet: 10 }]);
    await runAfterDamage(scout, 1, 'blunt', { newValue: 5, previousValue: 6, source: foe });
    expect(buttonCards()).toHaveLength(1);
    game.combat.turn = 1;
    await runAfterDamage(scout, 1, 'blunt', { newValue: 4, previousValue: 5, source: foe });
    expect(buttonCards()).toHaveLength(2);
    scout.system.health.value = 0;
    await runAfterDamage(scout, 4, 'blunt', { newValue: 0, previousValue: 4, source: foe });
    expect(buttonCards()).toHaveLength(2);
  });

  test('Intensive: a successful Technology Patch Up offers the same Repair to every other injured ally within 30 ft', async () => {
    const medic = makeActor('Medic', { items: [packItem(P.intensive)], system: { health: { value: 7, max: 10 } } });
    const patched = makeActor('Patched', { x: 5, system: { health: { value: 2, max: 10 } } });
    const hurt = makeActor('Hurt', { x: 20, system: { health: { value: 4, max: 10 } } });
    makeActor('Fine', { x: 10 });
    makeActor('Far', { x: 60, system: { health: { value: 1, max: 10 } } });
    makeActor('Enemy', { x: 10, disposition: -1, system: { health: { value: 1, max: 10 } } });
    target(patched);
    await firePatchedUp(medic, [{ success: true }], { isPatchUpAttempt: true, patchUpAmount: 3 }, { rider: { skill: 'technology' } });
    const card = buttonCards().at(-1);
    expect(card.flags.essence20.ruleButton.targets.sort()).toEqual([medic.uuid, hurt.uuid].sort());
    await pressLast();
    expect([medic.system.health.value, hurt.system.health.value, patched.system.health.value]).toEqual([10, 7, 2]);
    ChatMessage.create.mockClear();
    await firePatchedUp(medic, [{ success: true }], { isPatchUpAttempt: true, patchUpAmount: 3 }, { rider: { skill: 'science' } });
    expect(buttonCards()).toHaveLength(0);
  });
});

describe('Stim Dart', () => {
  test('one dart per mission plus each carried dart; an ally in reach gets 2 Temporary Health, a Defeated one is revived', async () => {
    const medic = makeActor('Medic', { items: [packItem(P.stimDart)] });
    const ally = makeActor('Ally', { x: 5 });
    const down = makeActor('Down', { x: 5, statuses: ['defeated'] });
    const dart = itemNamed(medic, 'Stim Dart');
    target(ally);
    await runUse(dart, pay);
    expect(pay).toHaveBeenCalledWith('standard');
    expect(ally.system.health.bonus).toBe(2);
    expect(grants.rollTest).not.toHaveBeenCalled();
    target(down);
    expect(await runUse(dart, pay)).toBeNull();
    medic.addItem({ name: 'Stim Dart (spare)', type: 'gear' });
    await runUse(dart, pay);
    expect(restored).toEqual([{ healer: 'Medic', target: 'Down', amount: 2 }]);
  });

  test('a dart at range needs a Targeting roll against Evasion (a miss still uses it); out of 20 ft is refused', async () => {
    const medic = makeActor('Medic', { items: [packItem(P.stimDart), { name: 'Stim Dart (spare)', type: 'gear' }] });
    const ally = makeActor('Ally', { x: 15, system: { defenses: { evasion: { total: 13 } } } });
    const far = makeActor('Far', { x: 30 });
    const dart = itemNamed(medic, 'Stim Dart');
    target(far);
    expect(await runUse(dart, pay)).toContain('Out of range (20 ft).');
    expect(pay).not.toHaveBeenCalled();
    target(ally);
    grants.rollTest.mockResolvedValueOnce({ success: false });
    expect(await runUse(dart, pay)).toContain('stim dart misses Ally.');
    expect(grants.rollTest).toHaveBeenCalledWith(medic, 'targeting', 13, expect.anything());
    expect(ally.system.health.bonus).toBe(0);
    await runUse(dart, pay);
    expect(ally.system.health.bonus).toBe(2);
    expect(await runUse(dart, pay)).toBeNull();
  });

  test('with nobody targeted, the medic darts themselves', async () => {
    const medic = makeActor('Medic', { items: [packItem(P.stimDart)] });
    await runUse(itemNamed(medic, 'Stim Dart'), pay);
    expect(medic.system.health.bonus).toBe(2);
  });
});

describe('more attacks', () => {
  test('Focused Blast: a select on area attacks; "+1 damage" notes 1 on each hit', () => {
    const bot = makeActor('Bot', { items: [packItem(P.focusedBlast), { id: 'blast', type: 'weaponEffect', name: 'Blast', system: { radius: 10 } }, { id: 'shot', type: 'weaponEffect', name: 'Shot', system: {} }] });
    const select = extDialogToggles(bot, { item: bot.items.get('blast'), rolledSkill: 'targeting' }).find(toggle => toggle.label == 'Focused Blast');
    expect(select).toMatchObject({ type: 'select' });
    expect(select.options.map(option => option.label)).toEqual(['Keep the blast', 'Forgo the blast: ↑1', 'Forgo the blast: +1 damage']);
    expect(extDialogToggles(bot, { item: bot.items.get('shot'), rolledSkill: 'targeting' }).some(toggle => toggle.label == 'Focused Blast')).toBe(false);
    const t = tools();
    const result = { damageValue: 2 };
    hitRiderOnAttack(bot, null, result, { itemUuid: 'Item.blast', switches: ['tf1FocusedDamage'] }, t);
    expect(t.damageBonusNote).toHaveBeenCalledWith(result, 1, 'Focused Blast');
  });

  test('Tox-En: one 1d20 + 1d8 roll (2d20kh + 1d8 touching) against each target\'s Toughness; a hit is 1 Strength and 1 Speed Essence damage and Impaired 10 rounds', async () => {
    const formulas = [];
    const totals = [14, 6];
    global.Roll = class {
      constructor(formula) {
        formulas.push(formula);
      }

      async evaluate() {
        this.total = totals.shift();
        return this;
      }
    };
    const gm = makeActor('GM', { items: [packItem(P.toxEn)] });
    const a = makeActor('A', { system: { defenses: { toughness: { total: 12 } }, essences: { strength: { value: 2 }, speed: { value: 2 } } } });
    const b = makeActor('B', { system: { defenses: { toughness: { total: 12 } }, essences: { strength: { value: 2 }, speed: { value: 2 } } } });
    expect(await runUse(itemNamed(gm, 'Tox-En'), pay)).toContain('NeedsTarget');
    target(a, b);
    foundry.applications.api.DialogV2.wait.mockResolvedValueOnce('1');
    await runUse(itemNamed(gm, 'Tox-En'), pay);
    expect(formulas).toEqual(['2d20kh + 1d8', '2d20kh + 1d8']);
    expect(essenceHits).toEqual([{ name: 'A', essences: ['strength'] }, { name: 'A', essences: ['speed'] }]);
    expect(timed).toEqual([{ name: 'A', status: 'impaired', rounds: 10 }]);
  });

  test('Target-Rich Environment: once per scene, a Story Point and a whole turn - the favorite weapon\'s attack at every standing enemy in its range', async () => {
    const quake = makeActor('Quake', { items: [
      packItem(P.targetRich), { name: 'Favorite Weapon', type: 'perk', system: { choice: 'gun' } },
      { id: 'gun', type: 'weapon', name: 'Cannon' }, { id: 'boom', type: 'weaponEffect', name: 'Boom', flags: { essence20: { parentId: 'gun' } }, system: { range: { value: 40 } } },
    ] });
    const boom = quake.items.get('boom');
    boom.roll = jest.fn(async () => ({}));
    const near = makeActor('Near', { x: 30, disposition: -1 });
    makeActor('Far', { x: 60, disposition: -1 });
    makeActor('Friend', { x: 10, disposition: 1 });
    makeActor('Down', { x: 20, disposition: -1, statuses: ['defeated'] });
    const neutral = makeActor('Neutral', { x: 20, disposition: 0 });
    await runUse(itemNamed(quake, 'Target-Rich Environment'), pay);
    expect(spent).toEqual([{ name: 'Quake', action: 'wholeTurn' }]);
    expect(canvas.tokens.setTargets).toHaveBeenLastCalledWith([near.token.id, neutral.token.id]);
    expect(boom.roll).toHaveBeenCalledWith({ bypassEconomy: true });
    // Once per scene.
    expect(await runUse(itemNamed(quake, 'Target-Rich Environment'), pay)).toBeNull();
  });

  test('Target-Rich Environment: nobody in range - nothing spent', async () => {
    const quake = makeActor('Quake', { items: [
      packItem(P.targetRich), { name: 'Favorite Weapon', type: 'perk', system: { choice: 'gun' } },
      { id: 'gun', type: 'weapon', name: 'Cannon' }, { id: 'boom', type: 'weaponEffect', name: 'Boom', flags: { essence20: { parentId: 'gun' } }, system: { range: { value: 10 } } },
    ] });
    quake.items.get('boom').roll = jest.fn();
    makeActor('Far', { x: 60, disposition: -1 });
    expect(await runUse(itemNamed(quake, 'Target-Rich Environment'), pay)).toContain('No enemies within the weapon');
    expect(spent).toEqual([]);
    expect(quake.items.get('boom').roll).not.toHaveBeenCalled();
  });

  test('Sustained Beam: a hit offers one follow-up per round - 1 Energon and a Free action, the same attack at the same target with Edge', async () => {
    game.combat = { id: 'c', started: true, round: 1, turn: 0, combatants: [] };
    const bot = makeActor('Bot', { system: { energon: { normal: { value: 2 } } }, items: [
      { id: 'gun', type: 'weapon', name: 'Beam Gun', system: { equipped: true } },
      { id: 'beam', type: 'weaponEffect', name: 'Beam', flags: { essence20: { parentId: 'gun' } } },
      packItem(P.sustainedBeam, { flags: { essence20: { parentId: 'gun' } } }),
    ] });
    const beam = bot.items.get('beam');
    beam.roll = jest.fn(async () => ({}));
    const foe = makeActor('Foe', { disposition: -1 });
    await rolled(bot, beam, [[foe, true]]);
    expect(buttonCards()).toHaveLength(1);
    await pressLast();
    expect(spent).toEqual([{ name: 'Bot', action: 'free' }]);
    expect(bot.system.energon.normal.value).toBe(1);
    expect(bot.flags.essence20.ruleBank).toEqual([expect.objectContaining({ edge: true, uses: 1, label: 'Sustained Beam' })]);
    expect(canvas.tokens.setTargets).toHaveBeenLastCalledWith([foe.token.id]);
    expect(beam.roll).toHaveBeenCalledWith({ bypassEconomy: true, rulesFollowUp: 'sustainedBeam' });
    // The follow-up's own hit offers nothing, nor does another hit this round.
    await rolled(bot, beam, [[foe, true]], { dataset: { rulesFollowUp: 'sustainedBeam' } });
    await rolled(bot, beam, [[foe, true]]);
    expect(buttonCards()).toHaveLength(1);
    game.combat.round = 2;
    await rolled(bot, beam, [[foe, true]]);
    expect(buttonCards()).toHaveLength(2);
  });

  test('Sustained Beam: no Energon - the button stays and nothing is spent', async () => {
    const bot = makeActor('Bot', { system: { energon: { normal: { value: 0 } } }, items: [
      { id: 'gun', type: 'weapon', name: 'Beam Gun', system: { equipped: true } },
      { id: 'beam', type: 'weaponEffect', name: 'Beam', flags: { essence20: { parentId: 'gun' } } },
      packItem(P.sustainedBeam, { flags: { essence20: { parentId: 'gun' } } }),
    ] });
    bot.items.get('beam').roll = jest.fn();
    const foe = makeActor('Foe', { disposition: -1 });
    await rolled(bot, bot.items.get('beam'), [[foe, true]]);
    await pressLast();
    expect(spent).toEqual([]);
    expect(bot.items.get('beam').roll).not.toHaveBeenCalled();
    expect(buttonCards()[0].flags.essence20.ruleButton.used).toBe(false);
  });

  test('Now You Don\'t: +5 to a Hide roll while in Alt Mode', () => {
    const bot = makeActor('Bot', { items: [packItem(P.nowYouDont)], system: { isTransformed: true } });
    expect(ruleHideBonus(bot, { rolledSkill: 'infiltration' })).toBe(5);
    bot.system.isTransformed = false;
    expect(ruleHideBonus(bot, { rolledSkill: 'infiltration' })).toBe(0);
    expect(ruleHideBonus(makeActor('Plain', { system: { isTransformed: true } }), {})).toBe(0);
  });
});

describe('Monster Morph (the Path Roles)', () => {
  const PATHS = {
    cruelty: 'fmmcitems/_source/Path_Of_Cruelty_vWie8Dy4u54sf1hy.json',
    frost: 'fmmcitems/_source/Path_of_Frost_GQ5aQWbjmaO9y00w.json',
    flame: 'fmmcitems/_source/Path_of_Flame_4PbR4S3s83Coa0kL.json',
    thorns: 'fmmcitems/_source/Path_of_Thorns_0ICOTyVDXK1i6l1S.json',
    venom: 'fmmcitems/_source/Path_of_Venom_rWoVOcNc3lXKDbhg.json',
  };

  test('every rule validates', () => {
    for (const file of Object.values(PATHS)) {
      for (const rule of fromPack(file).system.rules ?? []) {
        expect([file, validateRule(rule)]).toEqual([file, []]);
      }
    }
  });

  test('Cruelty: 2+ damage from an attack in Monster Form offers an Intimidation burst once per round; hits get a GM Void button', async () => {
    game.combat = { id: 'c', started: true, round: 1, turn: 0, combatants: [] };
    const monster = makeActor('Monster', { items: [packItem(PATHS.cruelty)], flags: { monsterFormActive: true } });
    const near = makeActor('Near', { x: 5, disposition: -1 });
    makeActor('Lucky', { x: 10, disposition: -1 });
    makeActor('Far', { x: 30, disposition: -1 });
    lastApply = { isAttack: true, targetUuid: monster.uuid };
    await runAfterDamage(monster, 1, 'blunt', { newValue: 9, previousValue: 10 });
    expect(buttonCards()).toHaveLength(0);
    await runAfterDamage(monster, 2, 'blunt', { newValue: 7, previousValue: 9 });
    expect(buttonCards()).toHaveLength(1);
    await pressLast();
    expect(react.rollVsMany).toHaveBeenLastCalledWith(monster, 'intimidation', expect.arrayContaining([near]), 'willpower');
    expect(react.rollVsMany.mock.calls.at(-1)[2].map(a => a.name).sort()).toEqual(['Lucky', 'Near']);
    const voids = buttonCards().slice(1);
    expect(voids.map(card => card.flags.essence20.ruleButton)).toEqual([expect.objectContaining({ who: 'gm', targets: [near.uuid] })]);
    // Used this round: no new offer until the next.
    await runAfterDamage(monster, 3, 'blunt', { newValue: 4, previousValue: 7 });
    expect(buttonCards()).toHaveLength(2);
    // Not from an attack, or out of Monster Form: nothing.
    game.combat.round = 2;
    lastApply = null;
    await runAfterDamage(monster, 3, 'blunt', { newValue: 1, previousValue: 4 });
    expect(buttonCards()).toHaveLength(2);
  });

  test('Frost: each burst hit is Immobilized for a round (no once-per-round)', async () => {
    const monster = makeActor('Monster', { items: [packItem(PATHS.frost)], flags: { monsterFormActive: true } });
    makeActor('Near', { x: 5, disposition: -1 });
    lastApply = { isAttack: true, targetUuid: monster.uuid };
    await runAfterDamage(monster, 2, 'blunt', { newValue: 8, previousValue: 10 });
    await pressLast();
    expect(react.rollVsMany).toHaveBeenLastCalledWith(monster, 'brawn', expect.any(Array), 'toughness');
    expect(timed).toEqual([{ name: 'Near', status: 'immobilized', rounds: 1 }]);
    await runAfterDamage(monster, 2, 'blunt', { newValue: 6, previousValue: 8 });
    expect(buttonCards().length).toBeGreaterThan(1);
  });

  test('Frost: nobody within 10 ft - the button stays', async () => {
    const monster = makeActor('Monster', { items: [packItem(PATHS.frost)], flags: { monsterFormActive: true } });
    lastApply = { isAttack: true, targetUuid: monster.uuid };
    await runAfterDamage(monster, 2, 'blunt', { newValue: 8, previousValue: 10 });
    await pressLast();
    expect(buttonCards()[0].flags.essence20.ruleButton.used).toBe(false);
  });

  test('Flame / Thorns / Venom: a melee hit in Monster Form offers a follow-up against the better of Toughness and Evasion', async () => {
    const monster = makeActor('Monster', { items: [packItem(PATHS.thorns), { id: 'claw', type: 'weaponEffect', name: 'Claw', system: { classification: { style: 'melee' } } }], flags: { monsterFormActive: true } });
    const foe = makeActor('Foe', { disposition: -1, system: { defenses: { toughness: { total: 13 }, evasion: { total: 16 } } } });
    const hits = [{ target: foe, hit: true, result: { targetUuid: foe.uuid, success: true } }];
    await runPostRoll(monster, hits.map(h => h.result), {}, { hits, rider: { itemUuid: 'Item.claw', style: 'ranged' } });
    expect(buttonCards()).toHaveLength(0);
    await runPostRoll(monster, hits.map(h => h.result), {}, { hits, rider: { itemUuid: 'Item.claw', style: 'melee' } });
    expect(buttonCards()).toHaveLength(1);
    foundry.applications.api.DialogV2.wait.mockResolvedValueOnce('1');
    await pressLast();
    expect(react.rollVs).toHaveBeenLastCalledWith(monster, 'finesse', 16, expect.anything());
    expect(buttonCards().at(-1).flags.essence20.ruleButton.steps[0]).toMatchObject({ do: 'damage', amount: 1, damageType: 'acid' });
    monster.flags.essence20.monsterFormActive = false;
    await runPostRoll(monster, hits.map(h => h.result), {}, { hits, rider: { itemUuid: 'Item.claw', style: 'melee' } });
    expect(buttonCards()).toHaveLength(2);
  });

  test('Venom: a Survival follow-up for 1 Poison', async () => {
    const monster = makeActor('Monster', { items: [packItem(PATHS.venom), { id: 'bite', type: 'weaponEffect', name: 'Bite' }], flags: { monsterFormActive: true } });
    const foe = makeActor('Foe', { disposition: -1, system: { defenses: { toughness: { total: 13 }, evasion: { total: 11 } } } });
    const hits = [{ target: foe, hit: true, result: { targetUuid: foe.uuid, success: true } }];
    await runPostRoll(monster, hits.map(h => h.result), {}, { hits, rider: { itemUuid: 'Item.bite', style: 'melee' } });
    react.rollVs.mockResolvedValueOnce({ success: false });
    await pressLast();
    expect(react.rollVs).toHaveBeenLastCalledWith(monster, 'survival', 13, expect.anything());
    expect(buttonCards()).toHaveLength(1);
  });
});

describe('Fearsome Presence', () => {
  const FILE = 'gijcrbitems/_source/Fearsome_Presence_Jbx3ei70ZsoabVuL.json';

  test('only in Reckless Abandon; the first three hits within 20 ft are Frightened until the Renegade\'s next turn', async () => {
    const { setWorldLookups } = await import('./predicate.mjs');
    let reckless = false;
    setWorldLookups({ recklessAbandon: () => reckless });
    const renegade = makeActor('Renegade', { items: [packItem(FILE)] });
    const foes = ['One', 'Two', 'Lucky', 'Three', 'Four'].map((name, i) => makeActor(name, { x: 5 + i, disposition: -1 }));
    const far = makeActor('Far', { x: 40, disposition: -1 });
    target(far, ...foes);
    const { useAvailable, useRulesOf } = await import('./triggers.mjs');
    const perk = itemNamed(renegade, 'Fearsome Presence');
    const [{ rule, index }] = useRulesOf(perk);
    expect(useAvailable(perk, rule, index)).toBe(false);
    reckless = true;
    expect(useAvailable(perk, rule, index)).toBe(true);
    await runUse(perk, pay);
    expect(react.rollVsMany).toHaveBeenLastCalledWith(renegade, 'intimidation', expect.any(Array), 'willpower');
    // Far is the first hit but out of range; Lucky missed; the 4th hit (Four) is over the cap.
    expect(timed.map(t => t.name)).toEqual(['One', 'Two']);
    expect(Object.keys(foes[3].flags.essence20.ruleMarks ?? {})).toEqual([]);
    expect(foes[0].flags.essence20.ruleMarks[`gij2FearsomeFrightened--${renegade.id}`].by).toBe(renegade.uuid);
    // The Renegade's next turn: the Frightened it gave are lifted.
    const { fireTriggers } = await import('./triggers.mjs');
    await fireTriggers(renegade, 'turnStart');
    expect(foes[0].statuses.has('frightened')).toBe(false);
    expect(foes[0].flags.essence20.ruleMarks[`gij2FearsomeFrightened--${renegade.id}`]).toBeUndefined();
    setWorldLookups({ recklessAbandon: null });
  });
});
