import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Round 17, split2 (docs/rules-batches/slSplit217.md): items that had rules and still had hand-written code for part
 * of their behaviour. Each item is loaded from its pack source; these check the rules validate and do what the removed
 * code did.
 */

global.Hooks = { on: () => {}, once: () => {}, callAll: () => {} };

const rolls = { rows: null };
const rollVsMany = jest.fn(async (actor, skill, others) => (rolls.rows ? rolls.rows(others) : others.map(other => ({ targetUuid: other.uuid, success: true, multiplier: 1 }))));
jest.unstable_mockModule('./mechanics/combat/reaction-engine.mjs', () => ({ rollVsMany }));
jest.unstable_mockModule('./mechanics/world/gm-relay.mjs', () => ({ needsGmRelay: () => false, relayToGm: jest.fn() }));
const applyTimedCondition = jest.fn(async (actor, status) => actor.statuses.add(status));
jest.unstable_mockModule('./mechanics/combat/timed-status.mjs', () => ({ applyTimedCondition }));
const grants = {
  chooseSelect: jest.fn(async () => null), chooseButtons: jest.fn(async () => null), rollTest: jest.fn(async () => ({ success: true })),
  findItems: jest.fn(async () => []), pickOne: jest.fn(async () => null), grantCopy: jest.fn(async (actor, uuid) => ({ name: uuid })),
};
jest.unstable_mockModule('./mechanics/resources/grants.mjs', () => grants);
const allies = { list: [] };
jest.unstable_mockModule('./mechanics/combat/nearby-allies.mjs', () => ({
  getNearbyAllyTokens: jest.fn(() => allies.list.map(actor => actor.token)),
  pickAllyTargets: jest.fn(async (actor, candidates) => candidates.slice(0, 1)),
  getAllNearbyTokens: jest.fn(() => []),
}));
const spend = jest.fn(async () => ({ blocked: false }));
jest.unstable_mockModule('./mechanics/actions/action-economy.mjs', () => ({ spend, setNextTurn: jest.fn(), grantBonusAttack: jest.fn(), getLedger: () => null, isTracking: () => false }));
const storyPoints = { canSpendForActor: jest.fn(() => true), spendForActor: jest.fn(async () => {}) };
const powerCost = jest.fn(async () => {});
jest.unstable_mockModule('./sheet-handlers/power-handler.mjs', () => ({ powerCost }));
jest.unstable_mockModule('./mechanics/resources/story-points.mjs', () => ({
  ...storyPoints, canWriteStoryPoints: () => true, requestStoryPointGrant: jest.fn(), poolFor: () => 'story', hasStoryPointsAvailable: () => true,
}));

await import('./plugins/index.mjs');
const { rebuildIndex } = await import('./index.mjs');
const { validateRule } = await import('./types.mjs');
const { registerCheck, setWorldLookups } = await import('./predicate.mjs');
const { fireItemAdded, fireTriggers, runUse, useAvailable } = await import('./triggers.mjs');
const { ruleConditionImmune, ruleDefenseAdjust, rollRules } = await import('./adapter.mjs');
const { ruleDamageImmune } = await import('./plugins/combat/damage-immunity.mjs');
const { ruleCardResistance, resisted } = await import('./plugins/combat/card-resistance.mjs');
const readers = await import('./plugins/combat/subsystem-readers.mjs');
const { askSubstitution } = await import('./plugins/dialog/dialog-select.mjs');
const { shapeOf } = await import('../items/forms/pony-shape-shifting.mjs');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));

export const FILES = {
  grow: 'fmmcitems/_source/Grow__ZqE7kDEMylFQK6Oa.json',
  basicShapeShifting: 'dsoeitems/_source/Basic_Shape_Shifting_u2fdkjPJZmeLgalz.json',
  ponymorph: 'mlpcrbitems/_source/Ponymorph_3Tm9SWc060Z62e4Q.json',
  personalHeirloom: 'jttitems/_source/Personal_Heirloom_LQGOwXCGvKlL4pzl.json',
  growthBoost: 'jttitems/_source/Growth_Boost_BVrwQKqvOdyNW0KR.json',
  phantomFocus: 'atsitems/_source/Phantom_Focus_aXGMEoVsYSttOSHn.json',
  expandedMysticism: 'mlpcrbitems/_source/Expanded_Mysticism_xL0lmmS7P046RNqO.json',
  sorcery: 'fmmcitems/_source/Sorcery_xUBOE1s5pgVyUrwj.json',
  wordOfUnicron: 'dditems/_source/Word_of_Unicron_liMchvrumE1wB8Rc.json',
  nemesis: 'atsitems/_source/Nemesis__Specific_Threat__bxGgq6PpfxeSRr7Q.json',
  recklessAbandon: 'gijcrbitems/_source/Reckless_Abandon_84d0XTJwKCYMJUgY.json',
  noseForTrouble: 'gijcrbitems/_source/Nose_For_Trouble_MH630UTgsJtbf3Y5.json',
  impenetrableShield: 'gijcrbitems/_source/Impenetrable_Shield_eEUl7OA9yWAk0QD3.json',
  psychologicalSway: 'eocitems/_source/Psychological_Sway_whz44n9XJNJQIVVt.json',
  zordSentience: 'bthitems/_source/Zord_Sentience_idhVrfBIKELsl3OW.json',
  lifeSupporting: 'ccitems/_source/Life_Supporting_VokHpoLjUYTzA3Xk.json',
  energyMastery: 'dditems/_source/Energy_Mastery_bjR8V1BEc3CfrrDu.json',
  toughEnough: 'gijcrbitems/_source/Tough_Enough_RoIa80w6EAZR0uFP.json',
  cruelWarlord: 'fmmcitems/_source/Cruel_Warlord_F3TRKmoaUOtHrlzq.json',
  supremeGuardian: 'ttsgitems/_source/Supreme_Guardian_wrBndkBQoKkn3dLy.json',
  digIn: 'dditems/_source/Dig_In_9tIkV50YiO3xqxvi.json',
  bulwark: 'gijcrbitems/_source/Bulwark_7758n3XWOzhSjdOk.json',
  immovableObject: 'gijcrbitems/_source/Immovable_Object_QSHsA1peMncG196r.json',
  chargeIntoBattle: 'ttsgitems/_source/Charge_Into_Battle_34O7Y77lZpuhng3G.json',
  perfectDisguise: 'gijcrbitems/_source/Perfect_Disguise_ELktMVNYsiBPTX2c.json',
  fearIsUniversal: 'ccitems/_source/Fear_Is_Universal_oGVp2hIxNBT8g1QW.json',
  powerHeal: 'prcrbitems/_source/Power_Heal_eiTUR08GXw03M21m.json',
  timeDisplaced: 'jttitems/_source/Time_Displaced_N4OwC0gTkUtRwBKr.json',
  shinobi: 'iafav2items/_source/Shinobi_of_the_63rd_Hexagram_JFfMXY6aMxhDbKa6.json',
  blazingStrikes: 'atsitems/_source/Blazing_Strikes_hr0SY24JAM7I91qA.json',
  earthDefenseCommand: 'fgtaaitems/_source/Earth_Defense_Command_Benefits_uQQbRbwADVtVwsym.json',
  deceptiveWarfare: 'tf1sitems/_source/Deceptive_Warfare_OJcHMBA3QYgPp5w0.json',
  dozerBlade: 'tfcrbitems/_source/Dozer_Blade_P3t8JOiCH5bR0N5r.json',
  highGear: 'jttitems/_source/High_Gear_KlcZsUUo2jvZhqM3.json',
  armchairGeneral: 'fgtaaitems/_source/Armchair_General_YPzpjKFz1yrwPHN6.json',
  properProtection: 'gijcrbitems/_source/Proper_Protection_CUV2gVVGb7U7yU5J.json',
  unlucky: 'bthitems/_source/Unlucky__For_You__hSzY2uhu3L9nGP6o.json',
  megafauna: 'atsitems/_source/Megafauna_c6plguiUVmJzGNsw.json',
  lightspeedBoost: 'atsitems/_source/Lightspeed_Boost_sap5gMPDrWvjLCCu.json',
  repairProgress: 'ccfitems/_source/Repair_Progress__Bonus_Energon_Point_rPbEnrg7Qx2Lm9Vd.json',
};

/** foundry.utils.setProperty, for plain objects. */
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
    id: `i${nextId++}`, flags: {}, system: {}, parent: actor, isOwner: true, effects: [], ...data,
    async update(changes) {
      for (const [key, value] of Object.entries(changes)) {
        setPath(this, key, value);
      }
    },
    async setFlag(scope, key, value) {
      setPath(this.flags[scope] ??= {}, key, value);
    },
    async unsetFlag(scope, key) {
      delete this.flags[scope]?.[key];
    },
    async updateEmbeddedDocuments(type, updates) {
      for (const change of updates) {
        const effect = this.effects.find(e => e.id == change._id);
        Object.assign(effect, change);
      }
    },
    delete: jest.fn(async () => {}),
  };
  item.uuid = `${actor.uuid}.Item.${item.id}`;
  return item;
}

/** A pack item's compendium uuid. */
const sourceOfPack = (file, doc) => {
  const pack = { fmmcitems: 'finster_s_monster_matic_cookbook', dsoeitems: 'dark_skies_over_equestria', mlpcrbitems: 'mlp_crb', jttitems: 'jump_through_time',
    atsitems: 'across_the_stars', dditems: 'decepticon_directive', gijcrbitems: 'gi_joe_crb', eocitems: 'enigma_of_combination', bthitems: 'beneath_the_helmet',
    ccitems: 'cobra_codex', ttsgitems: 'through_the_shattered_grid', prcrbitems: 'pr_crb', ccfitems: 'cobra_con_fusion', tf1sitems: 'transformers_one',
    fgtaaitems: 'field_guide_action_adventure', sssitems: 'sgt_slaughter_sourcebook', iafav2items: 'intercontinental_adventures', tfcrbitems: 'tf_crb' }[file.split('/')[0]] ?? 'test';
  return `Compendium.essence20.${pack}.Item.${doc._id}`;
};

/** An actor holding the pack items `files`, with a token at x (feet) and disposition. */
export function makeActor(name, files = [], { system = {}, x = 0, disposition = 1, type = 'playerCharacter', flags = {} } = {}) {
  const items = [];
  const actor = {
    id: `a${nextId++}`, name, type, isOwner: true, flags: { essence20: { ...flags } }, statuses: new Set(),
    system: {
      level: 12, size: 'common', health: { value: 10, max: 10, bonus: 0 }, powers: { personal: { value: 3, max: 6 } }, skills: {},
      essences: { smarts: { value: 2 } }, isMorphed: false,
      defenses: { toughness: { total: 10 }, evasion: { total: 15 }, willpower: { total: 11 }, cleverness: { total: 12 } }, ...system,
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
    async createEmbeddedDocuments(type, datas) {
      const made = datas.map(data => makeItem(actor, clone(data)));
      items.push(...made);
      rebuildIndex(actor);
      return made;
    },
    async toggleStatusEffect(status, { active } = {}) {
      if (active === false) {
        this.statuses.delete(status);
      } else {
        this.statuses.add(status);
      }
    },
  };
  actor.uuid = `Actor.${actor.id}`;
  for (const file of [files].flat()) {
    const doc = fromPack(file);
    items.push(makeItem(actor, { name: doc.name, type: doc.type, img: doc.img, system: clone(doc.system), effects: clone(doc.effects ?? []), flags: { core: { sourceId: sourceOfPack(file, doc) } } }));
  }

  actor.items = {
    contents: items, get: id => items.find(item => item.id == id), find: fn => items.find(fn), filter: fn => items.filter(fn), some: fn => items.some(fn),
    map: fn => items.map(fn), [Symbol.iterator]: () => items[Symbol.iterator](),
  };
  const token = { actor, document: { disposition, uuid: `Scene.s.Token.t${actor.id}`, elevation: 0 }, center: { x, y: 0 }, id: `t${actor.id}`, name };
  actor.getActiveTokens = () => [token];
  actor.token = token;
  rebuildIndex(actor);
  return actor;
}

/** Give an actor another (non-pack) item. */
export function addItem(actor, data) {
  const item = makeItem(actor, data);
  actor.items.contents.push(item);
  rebuildIndex(actor);
  return item;
}

export const itemNamed = (actor, name) => actor.items.contents.find(item => item.name == name);

export function scene(...actors) {
  const docs = new Map(actors.map(actor => [actor.uuid, actor]));
  global.fromUuidSync = uuid => docs.get(uuid) ?? null;
  global.fromUuid = async uuid => docs.get(uuid) ?? null;
  global.game.actors = { get: id => actors.find(actor => actor.id == id) ?? null, contents: actors, [Symbol.iterator]: () => actors[Symbol.iterator]() };
  global.canvas = { tokens: { placeables: actors.map(actor => actor.token), controlled: [], setTargets: jest.fn() }, grid: { size: 100, measurePath: ([a, b]) => ({ distance: Math.hypot(a.x - b.x, a.y - b.y) }) }, scene: { id: 'sc', tokens: [] }, dimensions: { size: 100, distance: 5 } };
}

export const target = (...actors) => {
  global.game.user.targets = new Set(actors.map(actor => actor.token));
  global.game.user.targets.first = () => actors[0]?.token;
};

const pay = jest.fn(async () => true);
const savedGame = global.game;

beforeEach(() => {
  pay.mockClear();
  rollVsMany.mockClear();
  applyTimedCondition.mockClear();
  Object.values(grants).forEach(fn => fn.mockClear());
  storyPoints.spendForActor.mockClear();
  rolls.rows = null;
  allies.list = [];
  global.game = {
    combat: null, combats: { get: () => null }, user: { id: 'u', isGM: true, targets: new Set() }, users: { contents: [], activeGM: null },
    actors: { contents: [] }, settings: { get: () => 1 }, i18n: { localize: key => key, format: key => key, has: () => false },
  };
  global.ChatMessage = { create: jest.fn(async data => data), getSpeaker: () => ({}), getSpeakerActor: () => null };
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn(), error: jest.fn() } };
  global.CONFIG = { ...(global.CONFIG ?? {}), E20: { ...(global.CONFIG?.E20 ?? {}), skills: { alertness: 'E20.SkillAlertness', streetwise: 'E20.SkillStreetwise', technology: 'E20.SkillTechnology' }, skillToEssence: { alertness: 'smarts', streetwise: 'social', technology: 'smarts' } } };
  global.foundry = {
    ...global.foundry,
    applications: { api: { DialogV2: { wait: jest.fn(async () => null), confirm: jest.fn(async () => true) } } },
    utils: {
      ...(global.foundry?.utils ?? {}), setProperty: setPath, getProperty: getPath, randomID: () => `r${nextId++}`,
      hasProperty: (o, k) => getPath(o, k) !== undefined, escapeHTML: text => String(text), deepClone: clone,
    },
  };
});

afterEach(() => {
  global.canvas = undefined;
  global.game = savedGame;
  jest.restoreAllMocks();
});

/** Pick the choose option whose label starts with `text`. */
const askFor = text => async (step, options) => options.findIndex(option => String(option.label).startsWith(text));
const attackOf = (weapon, style = 'melee') => ({ id: `e${nextId++}`, type: 'weaponEffect', flags: { essence20: { parentId: weapon?.id } }, system: { classification: { style } }, parent: weapon?.parent });
const answerOf = (actor, other, roll, label, type = 'RollModifier') => rollRules(actor, other, roll, [type]).find(entry => String(entry.rule.label).startsWith(label))?.answer;

registerCheck('monsterForm', actor => !!actor?.flags?.essence20?.monsterFormActive);
registerCheck('personalShield', actor => !!actor?.flags?.essence20?.shieldUp);
registerCheck('zordHasDriver', actor => Object.values(actor?.system?.actors ?? {}).some(entry => entry?.vehicleRole == 'driver'));
setWorldLookups({ recklessAbandon: actor => !!actor?.flags?.essence20?.reckless });

test('every split2 rule validates', () => {
  for (const file of Object.values(FILES)) {
    const rules = fromPack(file).system.rules ?? [];
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) {
      expect([file, validateRule(rule)]).toEqual([file, []]);
    }
  }
});

describe('Grow!', () => {
  test('only in Monster Form; grows to Towering (keeping the old Size) at no cost, and shrinks back', async () => {
    const actor = makeActor('Ranger', FILES.grow, { system: { size: 'large' } });
    const grow = itemNamed(actor, 'Grow!');
    expect(useAvailable(grow, grow.system.rules[1], 1)).toBe(false);
    actor.flags.essence20.monsterFormActive = true;
    expect(useAvailable(grow, grow.system.rules[1], 1)).toBe(true);
    await runUse(grow, pay);
    expect(actor.system.size).toBe('towering');
    expect(actor.flags.essence20.monsterGrowSelfActive).toBe(true);
    expect(actor.system.powers.personal.value).toBe(3);
    await runUse(grow, pay);
    expect(actor.system.size).toBe('large');
    expect(actor.flags.essence20.monsterGrowSelfActive).toBe(false);
  });

  test('+2 Toughness and Evasion per attack while grown in Monster Form - not on a stale flag', () => {
    const actor = makeActor('Ranger', FILES.grow, { flags: { monsterFormActive: true, monsterGrowSelfActive: true } });
    const foe = makeActor('Foe');
    expect(ruleDefenseAdjust(foe, actor, 'toughness', { difficulty: 10 })).toBe(2);
    expect(ruleDefenseAdjust(foe, actor, 'evasion', { difficulty: 15 })).toBe(2);
    expect(ruleDefenseAdjust(foe, actor, 'willpower', { difficulty: 11 })).toBe(0);
    actor.flags.essence20.monsterFormActive = false;
    expect(ruleDefenseAdjust(foe, actor, 'toughness', { difficulty: 10 })).toBe(0);
  });
});

describe('Basic Shape-Shifting and Ponymorph', () => {
  test('a successful cast keeps the spell on this scene\'s shape; a failed one does not', async () => {
    for (const [file, name, uuid] of [[FILES.basicShapeShifting, 'Basic Shape-Shifting', 'Compendium.essence20.dark_skies_over_equestria.Item.u2fdkjPJZmeLgalz'], [FILES.ponymorph, 'Ponymorph', 'Compendium.essence20.mlp_crb.Item.3Tm9SWc060Z62e4Q']]) {
      const actor = makeActor('Pony', file, { flags: { mlpShape: { scene: 1, faceSkill: 'persuasion' } } });
      const spell = itemNamed(actor, name);
      await fireTriggers(actor, 'afterRoll', { roll: { item: spell }, outcome: 'failure', facts: { results: [{ success: false }] } });
      expect(shapeOf(actor).spell).toBeUndefined();
      await fireTriggers(actor, 'afterRoll', { roll: { item: spell }, outcome: 'success', facts: { results: [{ success: true }] } });
      expect(shapeOf(actor)).toEqual({ scene: 1, faceSkill: 'persuasion', spell: uuid });
      // Another item's roll doesn't count.
      actor.flags.essence20.mlpShape = { scene: 1 };
      await fireTriggers(actor, 'afterRoll', { roll: { item: { id: 'other', type: 'spell' } }, outcome: 'success', facts: { results: [{ success: true }] } });
      expect(shapeOf(actor).spell).toBeUndefined();
    }
  });

  test('a shape from an earlier scene is dropped first', async () => {
    const actor = makeActor('Pony', FILES.basicShapeShifting, { flags: { mlpShape: { scene: 0, faceSkill: 'persuasion' } } });
    await fireTriggers(actor, 'afterRoll', { roll: { item: itemNamed(actor, 'Basic Shape-Shifting') }, outcome: 'success', facts: { results: [{ success: true }] } });
    expect(shapeOf(actor)).toEqual({ scene: 1, spell: 'Compendium.essence20.dark_skies_over_equestria.Item.u2fdkjPJZmeLgalz' });
  });
});

describe('Personal Heirloom', () => {
  test('the Use picks a non-Power weapon; its attacks get ↑1 and the before-designation switch goes', async () => {
    const actor = makeActor('Hero', FILES.personalHeirloom);
    const sword = addItem(actor, { name: 'Sword', type: 'weapon', system: { traits: [] } });
    addItem(actor, { name: 'Power Sword', type: 'weapon', system: { traits: ['powerWeapon'] } });
    const perk = itemNamed(actor, 'Personal Heirloom');
    expect(answerOf(actor, null, { rolledSkill: 'athletics' }, 'Using your Heirloom', 'DialogSwitch')).toBe(true);
    grants.chooseSelect.mockImplementationOnce(async (title, prompt, options) => {
      expect(options.map(o => o.label)).toEqual(['Sword']);
      return options[0].value;
    });
    await runUse(perk, pay);
    expect(perk.flags.essence20.rules.choices.heirloom).toBe(sword.id);
    expect(answerOf(actor, null, { rolledSkill: 'athletics' }, 'Using your Heirloom', 'DialogSwitch')).toBe(false);
    expect(answerOf(actor, null, { item: attackOf(sword) }, 'Your Heirloom')).toBe(true);
    expect(answerOf(actor, null, { item: attackOf({ id: 'other' }) }, 'Your Heirloom')).toBe(false);
  });

  test('a cancelled pick designates nothing', async () => {
    const actor = makeActor('Hero', FILES.personalHeirloom);
    addItem(actor, { name: 'Sword', type: 'weapon', system: { traits: [] } });
    await runUse(itemNamed(actor, 'Personal Heirloom'), pay);
    expect(itemNamed(actor, 'Personal Heirloom').flags.essence20?.rules?.choices?.heirloom).toBeUndefined();
  });
});

describe('Growth Boost', () => {
  test('+2 temporary Health on Morphing, taken back on leaving Morph; carrying doubled while Morphed', async () => {
    const actor = makeActor('Orange', FILES.growthBoost);
    actor.system.isMorphed = true;
    await fireTriggers(actor, 'morph');
    expect(actor.system.health.bonus).toBe(2);
    expect(readers.ruleCarryMultiplier(actor)).toBe(2);
    actor.system.isMorphed = false;
    await fireTriggers(actor, 'unmorph');
    expect(actor.system.health.bonus).toBe(0);
    expect(readers.ruleCarryMultiplier(actor)).toBe(1);
  });
});

describe('Phantom Focus', () => {
  const focus = (choice) => {
    const actor = makeActor('Phantom', FILES.phantomFocus);
    itemNamed(actor, 'Phantom Focus').system.choice = choice;
    rebuildIndex(actor);
    return actor;
  };

  test('Boosted Vigor: +3 temporary Health while Morphed; other choices nothing', async () => {
    const vigor = focus('boostedVigor');
    await fireTriggers(vigor, 'morph');
    expect(vigor.system.health.bonus).toBe(3);
    await fireTriggers(vigor, 'unmorph');
    expect(vigor.system.health.bonus).toBe(0);
    const other = focus('phaseDefense');
    await fireTriggers(other, 'morph');
    expect(other.system.health.bonus).toBe(0);
  });

  test('Healing Light: 1 Health and 1 Personal Power to heal an ally 2d2, up to their maximum', async () => {
    const healer = focus('healingLight');
    const ally = makeActor('Ally', [], { system: { health: { value: 3, max: 5 } } });
    allies.list = [ally];
    scene(healer, ally);
    jest.spyOn(Math, 'random').mockReturnValue(0.99);
    const item = itemNamed(healer, 'Phantom Focus');
    const use = item.system.rules.findIndex(rule => rule.label == 'Healing Light');
    expect(useAvailable(item, item.system.rules[use], use)).toBe(true);
    await runUse(item, pay, { pick: async (it, available) => available.find(entry => entry.rule.label == 'Healing Light') });
    expect(healer.system.health.value).toBe(9);
    expect(healer.system.powers.personal.value).toBe(2);
    expect(ally.system.health.value).toBe(5);
    // Not for any other choice.
    const other = focus('boostedVigor');
    const otherItem = itemNamed(other, 'Phantom Focus');
    expect(useAvailable(otherItem, otherItem.system.rules[use], use)).toBe(false);
  });
});

describe('Expanded Mysticism', () => {
  const mystic = ({ points = 3, health = 6 } = {}) => {
    const actor = makeActor('Mystic', FILES.expandedMysticism, { system: { health: { value: health, max: 10, bonus: 0 } } });
    const rolePoints = addItem(actor, { name: 'Mystical Points', type: 'rolePoints', system: { resource: { value: points, max: 5 } } });
    actor._getBaseRolePoints = () => rolePoints;
    return { actor, rolePoints, item: itemNamed(actor, 'Expanded Mysticism') };
  };

  const useNamed = label => async (item, available) => available.find(entry => entry.rule.label == label) ?? null;

  test('nothing to use without Mystical Points', () => {
    const { item } = mystic({ points: 0 });
    expect(item.system.rules.map((rule, index) => rule.type == 'Use' && useAvailable(item, rule, index)).filter(Boolean)).toEqual([]);
  });

  test('Heal: the points chosen (at most the missing Health) come back as Health, once per scene', async () => {
    const { actor, rolePoints, item } = mystic();
    foundry.applications.api.DialogV2.prompt = jest.fn(async () => 9);
    await runUse(item, pay, { pick: useNamed('Heal') });
    expect(rolePoints.system.resource.value).toBe(0);
    expect(actor.system.health.value).toBe(9);
    const heal = item.system.rules.findIndex(rule => rule.label == 'Heal');
    expect(useAvailable(item, item.system.rules[heal], heal)).toBe(false);
  });

  test('Heal at full Health does nothing', async () => {
    const { actor, rolePoints, item } = mystic({ health: 10 });
    await runUse(item, pay, { pick: useNamed('Heal') });
    expect(rolePoints.system.resource.value).toBe(3);
    expect(actor.system.health.value).toBe(10);
  });

  test('Fortify: 1 point, +1 to the chosen Defense per attack until the scene ends', async () => {
    const { actor, rolePoints, item } = mystic();
    const foe = makeActor('Foe');
    await runUse(item, pay, { pick: useNamed('Fortify'), ask: askFor('E20.DefenseEvasion') });
    expect(rolePoints.system.resource.value).toBe(2);
    expect(ruleDefenseAdjust(foe, actor, 'evasion', { difficulty: 15 })).toBe(1);
    expect(ruleDefenseAdjust(foe, actor, 'toughness', { difficulty: 10 })).toBe(0);
    global.game.settings = { get: () => 2 };
    expect(ruleDefenseAdjust(foe, actor, 'evasion', { difficulty: 15 })).toBe(0);
  });

  test('Quicken: 1 point doubles the chosen Movement until the end of the turn', async () => {
    const { actor, rolePoints, item } = mystic();
    await runUse(item, pay, { pick: useNamed('Quicken'), ask: askFor('E20.MovementTypeAerial') });
    expect(rolePoints.system.resource.value).toBe(2);
    expect(actor.flags.essence20.expandedMysticismQuickenType).toBe('aerial');
    await fireTriggers(actor, 'turnEnd');
    expect(actor.flags.essence20.expandedMysticismQuickenType).toBe('');
  });

  test('a cancelled pick spends nothing', async () => {
    const { rolePoints, item } = mystic();
    await runUse(item, pay, { pick: useNamed('Fortify'), ask: async () => null });
    expect(rolePoints.system.resource.value).toBe(3);
  });
});

describe('Sorcery', () => {
  test('added: the level it was taken at; removed: 0', async () => {
    const actor = makeActor('Sorcerer', FILES.sorcery, { system: { level: 6, powers: { personal: { value: 0, max: 0 }, sorcerous: { levelTaken: 0 } } } });
    const perk = itemNamed(actor, 'Sorcery');
    await fireItemAdded(actor, perk);
    expect(actor.system.powers.sorcerous.levelTaken).toBe(6);
    await fireItemAdded(actor, perk, { event: 'removed' });
    expect(actor.system.powers.sorcerous.levelTaken).toBe(0);
  });
});

describe('Word of Unicron', () => {
  test('the holder\'s Dark Energon addiction attacks suffer Snag', () => {
    expect(readers.ruleAddictionSnag(makeActor('Addict', FILES.wordOfUnicron))).toBe(true);
    expect(readers.ruleAddictionSnag(makeActor('Other'))).toBe(false);
  });
});

describe('Nemesis (Specific Threat)', () => {
  test('the Use declares the targeted creature; ↑2 on rolls against it only', async () => {
    const hero = makeActor('Hero', FILES.nemesis);
    const villain = makeActor('Villain', [], { disposition: -1 });
    const other = makeActor('Other', [], { disposition: -1 });
    scene(hero, villain, other);
    await runUse(itemNamed(hero, 'Nemesis (Specific Threat)'), pay);
    expect(hero.flags.essence20.nemesisUuid).toBeUndefined();
    target(villain);
    await runUse(itemNamed(hero, 'Nemesis (Specific Threat)'), pay);
    expect(hero.flags.essence20.nemesisUuid).toBe(villain.uuid);
    expect(answerOf(hero, villain, { rolledSkill: 'persuasion' }, 'Facing your Nemesis')).toBe(true);
    expect(answerOf(hero, other, { rolledSkill: 'persuasion' }, 'Facing your Nemesis')).toBe(false);
    expect(answerOf(hero, null, { rolledSkill: 'persuasion' }, 'Facing your Nemesis')).toBe(false);
  });
});

describe('Reckless Abandon', () => {
  const renegade = (armor = null) => {
    const actor = makeActor('Renegade', FILES.recklessAbandon, { flags: { reckless: true } });
    if (armor) {
      addItem(actor, { name: 'Armor', type: 'armor', system: { equipped: true, classification: armor } });
    }

    return actor;
  };

  test('↑2 on Strength Skill Tests while active, in light or no armor', () => {
    expect(answerOf(renegade(), null, { rolledSkill: 'athletics', rolledEssence: 'strength' }, 'Reckless Abandon (')).toBe(true);
    expect(answerOf(renegade('light'), null, { rolledSkill: 'athletics', rolledEssence: 'strength' }, 'Reckless Abandon (')).toBe(true);
    expect(answerOf(renegade('medium'), null, { rolledSkill: 'athletics', rolledEssence: 'strength' }, 'Reckless Abandon (')).toBe(false);
    expect(answerOf(renegade('heavy'), null, { rolledSkill: 'athletics', rolledEssence: 'strength' }, 'Reckless Abandon (')).toBe(false);
    expect(answerOf(renegade(), null, { rolledSkill: 'alertness', rolledEssence: 'smarts' }, 'Reckless Abandon (')).toBe(false);
    const inactive = renegade();
    inactive.flags.essence20.reckless = false;
    expect(answerOf(inactive, null, { rolledSkill: 'athletics', rolledEssence: 'strength' }, 'Reckless Abandon (')).toBe(false);
  });

  test('not at Initiative', () => {
    expect(answerOf(renegade(), null, { rolledSkill: 'athletics', rolledEssence: 'strength', dataset: { isInitiative: true } }, 'Reckless Abandon (')).toBe(false);
  });
});

describe('Nose For Trouble', () => {
  test('a plain Alertness test offers Streetwise when it is the better die', async () => {
    const actor = makeActor('Joe', FILES.noseForTrouble, { system: { skills: { streetwise: { shift: 'd6' }, alertness: { shift: 'd20' } } } });
    grants.chooseButtons.mockImplementationOnce(async (title, prompt, options) => {
      expect(options.map(([value]) => value)).toEqual(['alertness', 'streetwise']);
      return 'streetwise';
    });
    const dataset = { skill: 'alertness', essence: 'smarts', isSpecialized: true };
    await askSubstitution(actor, dataset, null);
    expect(dataset).toEqual({ skill: 'streetwise', essence: 'social', isSpecialized: false });
  });

  test('not with an item, nor when Streetwise is no better', async () => {
    const better = makeActor('Joe', FILES.noseForTrouble, { system: { skills: { streetwise: { shift: 'd6' }, alertness: { shift: 'd20' } } } });
    await askSubstitution(better, { skill: 'alertness' }, { type: 'weaponEffect', system: {} });
    const worse = makeActor('Joe', FILES.noseForTrouble, { system: { skills: { streetwise: { shift: 'd4' }, alertness: { shift: 'd6' } } } });
    await askSubstitution(worse, { skill: 'alertness' }, null);
    expect(grants.chooseButtons).not.toHaveBeenCalled();
  });
});

describe('Impenetrable Shield and Energy Mastery: Immunity', () => {
  test('EMP Immunity only while the Personal Shield is up', () => {
    const vanguard = makeActor('Vanguard', FILES.impenetrableShield, { flags: { shieldUp: true } });
    expect(ruleDamageImmune(vanguard, 'emp')).toBe(true);
    expect(ruleDamageImmune(vanguard, 'fire')).toBe(false);
    vanguard.flags.essence20.shieldUp = false;
    expect(ruleDamageImmune(vanguard, 'emp')).toBe(false);
    expect(ruleDamageImmune(makeActor('Other'), 'emp')).toBe(false);
  });

  test('Energy Mastery: Immunity to the Element chosen for Energy Affinity', () => {
    const master = makeActor('Master', FILES.energyMastery);
    addItem(master, { name: 'Energy Affinity', type: 'perk', system: { choice: 'fire' }, flags: { core: { sourceId: 'Compendium.essence20.decepticon_directive.Item.DgFY0ZmAtClAobiA' } } });
    expect(ruleDamageImmune(master, 'fire')).toBe(true);
    expect(ruleDamageImmune(master, 'cold')).toBe(false);
    expect(ruleDamageImmune(makeActor('No Affinity', FILES.energyMastery), 'fire')).toBe(false);
  });
});

describe('Tough Enough', () => {
  const card = flags => ({ flags: { essence20: flags } });
  test('a non-attack effect against Toughness: its damage halved, rounded up', () => {
    const tank = makeActor('Tank', FILES.toughEnough);
    expect(ruleCardResistance(tank, card({ isAttack: false, defenseType: 'toughness' }))).toBe(true);
    expect(ruleCardResistance(tank, card({ isAttack: true, defenseType: 'toughness' }))).toBe(false);
    expect(ruleCardResistance(tank, card({ isAttack: false, defenseType: 'evasion' }))).toBe(false);
    expect(ruleCardResistance(tank, card({ defenseType: 'toughness' }))).toBe(false);
    expect(ruleCardResistance(makeActor('Other'), card({ isAttack: false, defenseType: 'toughness' }))).toBe(false);
    expect([5, 4, 1, 0].map(resisted)).toEqual([3, 2, 1, 0]);
  });
});

describe('Cruel Warlord and Supreme Guardian: taking damage', () => {
  test('Cruel Warlord: 2 Personal Power on Psychic damage, up to the maximum', async () => {
    const warlord = makeActor('Warlord', FILES.cruelWarlord, { system: { powers: { personal: { value: 5, max: 6 } } } });
    await fireTriggers(warlord, 'takesDamage', { damage: { amount: 2, damageType: 'fire' }, roll: { damageType: 'fire', damageAmount: 2 } });
    expect(warlord.system.powers.personal.value).toBe(5);
    await fireTriggers(warlord, 'takesDamage', { damage: { amount: 2, damageType: 'psychic' }, roll: { damageType: 'psychic', damageAmount: 2 } });
    expect(warlord.system.powers.personal.value).toBe(6);
  });

  test('Supreme Guardian: Energy damage rolls a d20 - 10 or more regains 1 Eltarian Tech', async () => {
    const guardian = makeActor('Guardian', FILES.supremeGuardian);
    const tech = addItem(guardian, { name: 'Eltarian Tech', type: 'rolePoints', system: { resource: { value: 1, max: 2 } } });
    guardian._getBaseRolePoints = () => tech;
    const random = jest.spyOn(Math, 'random').mockReturnValue(0.99);
    await fireTriggers(guardian, 'takesDamage', { damage: { amount: 3, damageType: 'laser' }, roll: { damageType: 'laser', damageAmount: 3 } });
    expect(tech.system.resource.value).toBe(2);
    await fireTriggers(guardian, 'takesDamage', { damage: { amount: 3, damageType: 'laser' }, roll: { damageType: 'laser', damageAmount: 3 } });
    expect(tech.system.resource.value).toBe(2);
    tech.system.resource.value = 0;
    random.mockReturnValue(0.1);
    await fireTriggers(guardian, 'takesDamage', { damage: { amount: 3, damageType: 'fire' }, roll: { damageType: 'fire', damageAmount: 3 } });
    expect(tech.system.resource.value).toBe(0);
    random.mockReturnValue(0.99);
    await fireTriggers(guardian, 'takesDamage', { damage: { amount: 3, damageType: 'blunt' }, roll: { damageType: 'blunt', damageAmount: 3 } });
    expect(tech.system.resource.value).toBe(0);
  });

  test('Supreme Guardian: while Morphed, Technology against the Toughness of enemies within 20 ft; a hit Blinds', async () => {
    const guardian = makeActor('Guardian', FILES.supremeGuardian, { system: { isMorphed: true } });
    const near = makeActor('Near', [], { x: 15, disposition: -1 });
    const far = makeActor('Far', [], { x: 40, disposition: -1 });
    scene(guardian, near, far);
    const item = itemNamed(guardian, 'Supreme Guardian');
    await runUse(item, pay);
    expect(rollVsMany).toHaveBeenCalledWith(guardian, 'technology', [near], 'toughness');
    expect(applyTimedCondition).toHaveBeenCalled();
    guardian.system.isMorphed = false;
    const use = item.system.rules.findIndex(rule => rule.type == 'Use');
    expect(useAvailable(item, item.system.rules[use], use)).toBe(false);
  });
});

describe('Dig In and Bulwark: stances', () => {
  test('Dig In toggles; Prone immunity only while dug in', async () => {
    const actor = makeActor('Raider', FILES.digIn);
    expect(ruleConditionImmune(actor, 'prone')).toBe(false);
    await runUse(itemNamed(actor, 'Dig In'), pay);
    expect(actor.flags.essence20.digInActive).toBe(true);
    expect(ruleConditionImmune(actor, 'prone')).toBe(true);
    expect(ruleConditionImmune(actor, 'frightened')).toBe(false);
    await runUse(itemNamed(actor, 'Dig In'), pay);
    expect(actor.flags.essence20.digInActive).toBe(false);
    expect(ruleConditionImmune(actor, 'prone')).toBe(false);
    expect(pay).not.toHaveBeenCalled();
  });

  test('Bulwark toggles; Frightened immunity only while planted', async () => {
    const actor = makeActor('Tank', FILES.bulwark);
    await runUse(itemNamed(actor, 'Bulwark'), pay);
    expect(actor.flags.essence20.bulwarkActive).toBe(true);
    expect(ruleConditionImmune(actor, 'frightened')).toBe(true);
    await runUse(itemNamed(actor, 'Bulwark'), pay);
    expect(actor.flags.essence20.bulwarkActive).toBe(false);
    expect(ruleConditionImmune(actor, 'frightened')).toBe(false);
  });
});

describe('Psychological Sway', () => {
  test('banks ↓1 on the targeted foe\'s next Skill Test; nothing without a target', async () => {
    const counselor = makeActor('Counselor', FILES.psychologicalSway);
    const foe = makeActor('Foe', [], { disposition: -1 });
    scene(counselor, foe);
    await runUse(itemNamed(counselor, 'Psychological Sway'), pay);
    expect(foe.flags.essence20.ruleBank).toBeUndefined();
    target(foe);
    await runUse(itemNamed(counselor, 'Psychological Sway'), pay);
    expect(foe.flags.essence20.ruleBank).toEqual([expect.objectContaining({ shiftDown: 1 })]);
  });
});

describe('Perfect Disguise', () => {
  test('switched on once per encounter (free to switch off); Edge on attacks; ended by being seen attacking', async () => {
    const spy = makeActor('Spy', FILES.perfectDisguise);
    global.game.combat = { id: 'c1', started: true, round: 1, turn: 0, turns: [], combatants: { contents: [] } };
    const perk = itemNamed(spy, 'Perfect Disguise');
    await runUse(perk, pay);
    expect(spy.flags.essence20.perfectDisguiseActive).toBe(true);
    expect(answerOf(spy, null, { item: attackOf({ id: 'w' }) }, 'Attacking in disguise')).toBe(true);
    await runUse(perk, pay);
    expect(spy.flags.essence20.perfectDisguiseActive).toBe(false);
    const on = perk.system.rules.findIndex(rule => rule.label == 'Take on a disguise');
    expect(useAvailable(perk, perk.system.rules[on], on)).toBe(false);
    spy.flags.essence20.perfectDisguiseActive = true;
    const foe = makeActor('Foe', [], { disposition: -1 });
    await fireTriggers(spy, 'afterRoll', { roll: { item: attackOf({ id: 'w' }), isAttack: true, targetCount: 1 }, outcome: 'success', facts: { results: [{ success: true, targetUuid: foe.uuid }] } });
    expect(spy.flags.essence20.perfectDisguiseActive).toBe(false);
  });
});

describe('Zord Sentience, Life Supporting, Charge Into Battle, Immovable Object, Fear Is Universal', () => {
  test('Life Supporting: the recharge Use is there only while spent; DIF 20 Technology clears it on a success', async () => {
    const trooper = makeActor('Trooper', FILES.lifeSupporting);
    const upgrade = itemNamed(trooper, 'Life Supporting');
    const use = upgrade.system.rules.findIndex(rule => rule.type == 'Use');
    expect(useAvailable(upgrade, upgrade.system.rules[use], use)).toBe(false);
    upgrade.flags.essence20 = { lifeSupportingSpent: true };
    expect(useAvailable(upgrade, upgrade.system.rules[use], use)).toBe(true);
    grants.rollTest.mockImplementationOnce(async () => ({ success: false }));
    await runUse(upgrade, pay);
    expect(grants.rollTest).toHaveBeenCalledWith(trooper, 'technology', 20, expect.anything());
    expect(upgrade.flags.essence20.lifeSupportingSpent).toBe(true);
    await runUse(upgrade, pay);
    expect(upgrade.flags.essence20.lifeSupportingSpent).toBeFalsy();
  });

  test('Zord Sentience: a DriverlessEssence of 2 on a Zord', async () => {
    const { ruleDriverlessEssence } = await import('./plugins/zords/driverless-essence.mjs');
    expect(ruleDriverlessEssence(makeActor('Zord', FILES.zordSentience, { type: 'zord' }))).toBe(2);
    expect(ruleDriverlessEssence(makeActor('Not a Zord', FILES.zordSentience))).toBeNull();
  });

  test('Charge Into Battle: Multiple Targets on a melee Power Weapon attack only', async () => {
    const { ruleMultipleTargets } = await import('./plugins/combat/hazard-terrain-targets.mjs');
    const guardian = makeActor('Guardian', FILES.chargeIntoBattle);
    const power = addItem(guardian, { name: 'Power Sword', type: 'weapon', system: { traits: ['powerWeapon'] } });
    const plain = addItem(guardian, { name: 'Sword', type: 'weapon', system: { traits: [] } });
    expect(ruleMultipleTargets(guardian, { ...attackOf(power), parent: guardian })).toBe(true);
    expect(ruleMultipleTargets(guardian, { ...attackOf(power, 'projectile'), parent: guardian })).toBe(false);
    expect(ruleMultipleTargets(guardian, { ...attackOf(plain), parent: guardian })).toBe(false);
  });

  test('Immovable Object: may refuse forced movement; Fear Is Universal: a Story Point to affect the Skill-immune', () => {
    expect(readers.forcedMovementChoiceOf(makeActor('Juggernaut', FILES.immovableObject))?.name).toBe('Immovable Object');
    expect(readers.forcedMovementChoiceOf(makeActor('Other'))).toBeNull();
    expect(readers.skillImmunityOverrideOf(makeActor('Taskmaster', FILES.fearIsUniversal))).toEqual({ item: expect.objectContaining({ name: 'Fear Is Universal' }), storyPoints: 1 });
    expect(readers.skillImmunityOverrideOf(makeActor('Other'))).toBeNull();
  });
});

/* -------------------------------------------- */
/*  Uses that were registerUse / sheet buttons   */
/* -------------------------------------------- */

class FakeRoll {
  static made = [];
  static next = 1;
  constructor(formula) {
    this.formula = formula;
  }

  async evaluate() {
    this.total = FakeRoll.next;
    return this;
  }

  async toMessage(data, options) {
    FakeRoll.made.push({ formula: this.formula, total: this.total, data, options });
  }
}

describe('Power Heal', () => {
  test("heal: the Power's own activation; a Condition: 1 Power and a negative Condition off a creature within 5 ft", async () => {
    const ranger = makeActor('Ranger', FILES.powerHeal, { system: { isMorphed: true } });
    const hurt = makeActor('Hurt', [], { x: 5 });
    hurt.statuses = new Set(['morphed', 'prone']);
    allies.list = [hurt];
    scene(ranger, hurt);
    const power = itemNamed(ranger, 'Power Heal');
    await runUse(power, pay, { ask: askFor('E20.Pr3PowerHealHeal') });
    expect(powerCost).toHaveBeenCalledWith(ranger, power);
    grants.chooseSelect.mockImplementationOnce(async (title, prompt, options) => {
      expect(options.map(o => o.value)).toEqual(['prone']);
      return 'prone';
    });
    await runUse(power, pay, { ask: askFor('E20.Pr3PowerHealCondition') });
    expect(hurt.statuses.has('prone')).toBe(false);
    expect(hurt.statuses.has('morphed')).toBe(true);
    expect(ranger.system.powers.personal.value).toBe(2);
    // Not while unMorphed.
    ranger.system.isMorphed = false;
    const use = power.system.rules.findIndex(rule => rule.type == 'Use');
    expect(useAvailable(power, power.system.rules[use], use)).toBe(false);
  });
});

describe('Time Displaced', () => {
  test('the Continuum Anomaly check rolls one die larger, blind', async () => {
    global.Roll = FakeRoll;
    FakeRoll.made = [];
    FakeRoll.next = 7;
    const actor = makeActor('Traveller', FILES.timeDisplaced);
    await runUse(itemNamed(actor, 'Time Displaced'), pay, { ask: askFor('E20.ResAnomalyRisk.average') });
    expect(FakeRoll.made).toEqual([expect.objectContaining({ formula: '1d10', options: { rollMode: 'blindroll' } })]);
    await runUse(itemNamed(actor, 'Time Displaced'), pay, { ask: askFor('E20.ResAnomalyRisk.catastrophic') });
    expect(FakeRoll.made[1].formula).toBe('2d8');
  });
});

describe('Shinobi of the 63rd Hexagram', () => {
  test('on arrival (and with its Use) switches on the two chosen Defense bonuses only', async () => {
    const actor = makeActor('Shinobi', FILES.shinobi);
    const perk = itemNamed(actor, 'Shinobi of the 63rd Hexagram');
    perk.effects = perk.effects.map((effect, i) => ({ ...effect, id: `e${i}` }));
    const picks = ['E20.DefenseEvasion', 'E20.DefenseWillpower'];
    const ask = async (step, options) => {
      const want = picks.shift();
      return options.findIndex(option => option.label == want);
    };

    await runUse(perk, pay, { ask });
    expect(perk.effects.filter(e => !e.disabled).map(e => e.name).sort()).toEqual(['Evasion Bonus', 'Martial Arts Training', 'Willpower Bonus']);
    picks.push('E20.DefenseToughness', 'E20.DefenseCleverness');
    await runUse(perk, pay, { ask });
    expect(perk.effects.filter(e => !e.disabled).map(e => e.name).sort()).toEqual(['Cleverness Bonus', 'Martial Arts Training', 'Toughness Bonus']);
    // Arriving on an actor asks too (its added Trigger).
    expect(perk.system.rules.some(rule => rule.type == 'Trigger' && rule.event == 'added')).toBe(true);
  });
});

describe('Blazing Strikes', () => {
  test('activating sets it (once); its unarmed attacks deal Fire - before the other overrides - until the scene ends', async () => {
    const { ruleDamageType } = await import('./adapter.mjs');
    const ranger = makeActor('Ranger', FILES.blazingStrikes);
    const power = itemNamed(ranger, 'Blazing Strikes');
    const { firePowerUsed } = await import('./plugins/resources/power-used.mjs');
    await firePowerUsed(ranger, power, 1);
    expect(ranger.flags.essence20.blazingStrikesActive).toBe(true);
    // Cryogenic Touch's own DamageType rule comes after it.
    addItem(ranger, { name: 'Cold Touch', type: 'power', system: { rules: [{ type: 'DamageType', to: 'cold', when: ['attack:barehanded'] }] } });
    const unarmed = { type: 'weaponEffect', flags: {}, system: { classification: { style: 'melee' } }, parent: ranger };
    expect(ruleDamageType(ranger, null, { item: unarmed })).toBe('fire');
    await fireTriggers(ranger, 'sceneStart');
    expect(ranger.flags.essence20.blazingStrikesActive).toBe(false);
    expect(ruleDamageType(ranger, null, { item: unarmed })).toBe('cold');
  });
});

describe('Earth Defense Command Benefits: the Space Kit', () => {
  test('once a mission: a free Limited Kit for one of its Driving / Culture / Science / Technology Specializations', async () => {
    const actor = makeActor('Officer', FILES.earthDefenseCommand, { system: { skills: { science: { specializations: { a: { name: 'Astronomy' } } }, might: { specializations: { b: { name: 'Lifting' } } } } } });
    grants.chooseSelect.mockImplementationOnce(async (title, prompt, options) => {
      expect(options.map(o => o.value)).toEqual(['science|Astronomy']);
      return 'science|Astronomy';
    });
    const perk = itemNamed(actor, 'Earth Defense Command Benefits');
    await runUse(perk, pay);
    const kit = actor.items.contents.at(-1);
    expect(kit.flags.essence20.kit).toEqual({ tier: 'limited', skill: 'science', spec: 'Astronomy', essence: null });
    expect(kit.flags.essence20.grantedBy).toBe(perk.id);
    const use = perk.system.rules.findIndex(rule => rule.type == 'Use');
    expect(useAvailable(perk, perk.system.rules[use], use)).toBe(false);
  });

  test('no such Specialization: a warning, nothing used up', async () => {
    const actor = makeActor('Officer', FILES.earthDefenseCommand);
    const perk = itemNamed(actor, 'Earth Defense Command Benefits');
    await runUse(perk, pay);
    expect(ui.notifications.warn).toHaveBeenCalledWith('E20.S1SpaceKitNoSpec');
    const use = perk.system.rules.findIndex(rule => rule.type == 'Use');
    expect(useAvailable(perk, perk.system.rules[use], use)).toBe(true);
  });
});

describe('Deceptive Warfare', () => {
  const combatFor = (actor, round, initiative, rolled) => {
    const combatant = {
      id: 'c1', actor, actorId: actor.id, initiative, isOwner: true,
      async update(data) {
        Object.assign(this, data);
      },
    };
    return {
      id: 'cb', started: true, round, combatants: { contents: [combatant], get: () => combatant, [Symbol.iterator]: () => [combatant][Symbol.iterator]() },
      rollInitiative: jest.fn(async () => {
        combatant.initiative = rolled;
      }),
    };
  };

  test('after the first round, two Free actions (or a Move) reroll Initiative; a lower result keeps the old place', async () => {
    const actor = makeActor('Seeker', FILES.deceptiveWarfare);
    global.game.combat = combatFor(actor, 2, 15, 9);
    spend.mockClear();
    await runUse(itemNamed(actor, 'Deceptive Warfare'), pay, { ask: askFor('E20.Tf3ResetTwoFree') });
    expect(spend).toHaveBeenCalledTimes(2);
    expect(spend.mock.calls.map(call => call[1])).toEqual(['free', 'free']);
    expect(global.game.combat.combatants.get().initiative).toBe(15);
    spend.mockClear();
    global.game.combat = combatFor(actor, 3, 10, 18);
    await runUse(itemNamed(actor, 'Deceptive Warfare'), pay, { ask: askFor('E20.Tf3ResetMove') });
    expect(spend.mock.calls.map(call => call[1])).toEqual(['move']);
    expect(global.game.combat.combatants.get().initiative).toBe(18);
  });

  test('not in the first round', async () => {
    const actor = makeActor('Seeker', FILES.deceptiveWarfare);
    global.game.combat = combatFor(actor, 1, 15, 20);
    spend.mockClear();
    await runUse(itemNamed(actor, 'Deceptive Warfare'), pay, { ask: askFor('E20.Tf3ResetMove') });
    expect(spend).not.toHaveBeenCalled();
    expect(global.game.combat.rollInitiative).not.toHaveBeenCalled();
  });
});

describe('Dozer Blade', () => {
  test('in Alt Mode, a Free action clears the one-square Rough Terrain under the token (the GM straight away)', async () => {
    const bot = makeActor('Bot', FILES.dozerBlade, { system: { isTransformed: true } });
    scene(bot);
    const small = { id: 'r1', behaviors: [{ system: { roughTerrain: true } }], shapes: [{ type: 'rectangle', x: -50, y: -50, width: 100, height: 100 }] };
    const big = { id: 'r2', behaviors: [{ system: { roughTerrain: true } }], shapes: [{ type: 'rectangle', x: -500, y: -500, width: 1000, height: 1000 }] };
    const sceneDoc = { id: 'sc', grid: { size: 100 }, regions: [small, big], deleteEmbeddedDocuments: jest.fn(async () => {}) };
    bot.token.scene = sceneDoc;
    const item = itemNamed(bot, 'Dozer Blade');
    await runUse(item, pay);
    expect(pay).toHaveBeenCalledWith('free');
    expect(sceneDoc.deleteEmbeddedDocuments).toHaveBeenCalledWith('Region', ['r1']);
    bot.system.isTransformed = false;
    const use = item.system.rules.findIndex(rule => rule.type == 'Use');
    expect(useAvailable(item, item.system.rules[use], use)).toBe(false);
  });

  test("a player's click posts the GM a button instead", async () => {
    const bot = makeActor('Bot', FILES.dozerBlade, { system: { isTransformed: true } });
    scene(bot);
    global.game.user.isGM = false;
    await runUse(itemNamed(bot, 'Dozer Blade'), pay);
    expect(ChatMessage.create).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('data-e20-ext="clearRoughTerrain"') }));
  });
});

describe('High Gear', () => {
  test('once a scene the pilot pays 1 Personal Power to switch it on (free off); Ground Movement doubled meanwhile', async () => {
    const { ruleMovementStages } = await import('./adapter.mjs');
    const pilot = makeActor('Pilot', [], { system: { powers: { personal: { value: 1, max: 3 } } } });
    const zord = makeActor('Zord', FILES.highGear, { type: 'zord', system: { actors: { d: { vehicleRole: 'driver', uuid: pilot.uuid } }, movement: { ground: { base: 40, total: 40 } } } });
    scene(zord, pilot);
    const feature = itemNamed(zord, 'High Gear');
    await runUse(feature, pay);
    expect(pilot.system.powers.personal.value).toBe(0);
    expect(zord.flags.essence20.highGearActive).toBe(true);
    expect(ruleMovementStages(zord)('adjust', 'ground', 40)).toBe(80);
    await runUse(feature, pay);
    expect(zord.flags.essence20.highGearActive).toBe(false);
    const on = feature.system.rules.findIndex(rule => String(rule.label).startsWith('High Gear ('));
    expect(useAvailable(feature, feature.system.rules[on], on)).toBe(false);
  });

  test('no pilot: nothing spent, not switched on', async () => {
    const zord = makeActor('Zord', FILES.highGear, { type: 'zord', system: { actors: {} } });
    scene(zord);
    await runUse(itemNamed(zord, 'High Gear'), pay);
    expect(zord.flags.essence20.highGearActive).toBeUndefined();
  });
});

describe('Armchair General', () => {
  test("until picked, a Use Qualifies the actor in a weapon type they aren't Qualified in yet", async () => {
    global.CONFIG.E20.weaponTypes = { blunt: 'E20.WeaponTypeBlunt', shotguns: 'E20.WeaponTypeShotguns' };
    const envoy = makeActor('Envoy', FILES.armchairGeneral, { system: { qualified: { weapons: { blunt: true } } } });
    grants.chooseSelect.mockImplementationOnce(async (title, prompt, options) => {
      expect(options.map(o => o.value)).toEqual(['shotguns']);
      return 'shotguns';
    });
    const perk = itemNamed(envoy, 'Armchair General');
    await runUse(perk, pay);
    expect(envoy.system.qualified.weapons.shotguns).toBe(true);
    const use = perk.system.rules.findIndex(rule => rule.type == 'Use');
    expect(useAvailable(perk, perk.system.rules[use], use)).toBe(false);
  });
});

describe('Proper Protection', () => {
  test('curing poison or disease: the critical-success note', () => {
    expect(readers.ruleCureNotes(makeActor('Medic', FILES.properProtection))).toBe('E20.O2ProperProtectionCrit');
    expect(readers.ruleCureNotes(makeActor('Other'))).toBe('');
  });
});

describe('Unlucky (For You)', () => {
  const setup = ({ terrorPerk = true } = {}) => {
    const ranger = makeActor('Dark Ranger', FILES.unlucky);
    if (terrorPerk) {
      addItem(ranger, { name: 'Terror', type: 'perk', flags: { core: { sourceId: 'Compendium.essence20.beneath_the_helmet.Item.yBBB0Mi6fr84YcSd' } } });
    }

    const terror = addItem(ranger, { name: 'Terror Capacity', type: 'rolePoints', system: { resource: { value: 0, max: 3 } } });
    ranger._getBaseRolePoints = () => terror;
    const foe = makeActor('Foe', [], { x: 20, disposition: -1 });
    scene(ranger, foe);
    global.game.combat = { id: 'c1', started: true, round: 1, turn: 0, turns: [], combatants: { contents: [] } };
    return { ranger, terror, foe };
  };

  const hit = (ranger, foe) => fireTriggers(ranger, 'hit', { roll: { item: attackOf({ id: 'w' }), isAttack: true }, outcome: 'success', targets: [foe], facts: { results: [{ success: true }] } });
  const theirRoll = (foe, success) => fireTriggers(foe, 'afterRoll', { roll: { rolledSkill: 'athletics' }, outcome: success ? 'success' : 'failure', facts: { results: [{ success }] } });

  test("a hit target's next Skill Test, failed before the Ranger's next turn, gives the Ranger 1 Terror - once", async () => {
    const { ranger, terror, foe } = setup();
    await hit(ranger, foe);
    await theirRoll(foe, false);
    expect(terror.system.resource.value).toBe(1);
    await theirRoll(foe, false);
    expect(terror.system.resource.value).toBe(1);
  });

  test('a success ends the watch with no Terror; nothing without the Terror Perk', async () => {
    const first = setup();
    await hit(first.ranger, first.foe);
    await theirRoll(first.foe, true);
    await theirRoll(first.foe, false);
    expect(first.terror.system.resource.value).toBe(0);
    const second = setup({ terrorPerk: false });
    await hit(second.ranger, second.foe);
    await theirRoll(second.foe, false);
    expect(second.terror.system.resource.value).toBe(0);
  });
});

describe('Megafauna', () => {
  test('arrives in Megafauna Form; a Standard action switches forms; Smarts and Social 3 there; the pilot drives with Animal Handling', async () => {
    const { ruleDerived, applySkillSubstitution } = await import('./adapter.mjs');
    global.CONFIG.E20.skillToEssence.animalHandling = 'social';
    const pilot = makeActor('Pilot');
    const zord = makeActor('Zord', FILES.megafauna, { type: 'zord', system: { essences: { smarts: { value: 1 }, social: { value: 1 } }, actors: { d: { vehicleRole: 'driver', uuid: pilot.uuid } } } });
    scene(zord, pilot);
    const feature = itemNamed(zord, 'Megafauna');
    await fireItemAdded(zord, feature);
    expect(zord.flags.essence20.zord1Megafauna).toBe(true);
    ruleDerived(zord);
    expect(zord.system.essences.smarts.value).toBe(3);
    expect(zord.system.essences.social.value).toBe(3);
    rebuildIndex(pilot);
    const dataset = { skill: 'driving', essence: 'speed' };
    applySkillSubstitution(pilot, dataset, null);
    expect(dataset).toEqual({ skill: 'animalHandling', essence: 'social' });
    await runUse(feature, pay);
    expect(pay).toHaveBeenCalledWith('standard');
    expect(zord.flags.essence20.zord1Megafauna).toBe(false);
    const other = { skill: 'driving', essence: 'speed' };
    applySkillSubstitution(pilot, other, null);
    expect(other.skill).toBe('driving');
  });
});

describe('Lightspeed Boost', () => {
  test("its pick - HAZMAT's two different Resistances - and nothing more to pick after", async () => {
    const zord = makeActor('Zord', FILES.lightspeedBoost, { type: 'zord' });
    const feature = itemNamed(zord, 'Lightspeed Boost');
    const picks = ['E20.Pr1Lightspeed.hazmat', 'E20.Pr1HazmatResist', 'E20.DamageCold', 'E20.DamageSonic'];
    let secondChoice = null;
    const ask = async (step, options) => {
      if (picks[0] == 'E20.DamageSonic') {
        secondChoice = options.map(option => option.label);
      }

      const want = picks.shift();
      return options.findIndex(option => option.label == want);
    };

    await runUse(feature, pay, { ask });
    expect(secondChoice).not.toContain('E20.DamageCold');
    expect(feature.flags.essence20.pr1LightspeedBoost).toEqual({ option: 'hazmat', how: 'resist', types: { 0: 'cold', 1: 'sonic' } });
    const use = feature.system.rules.findIndex(rule => rule.type == 'Use' && rule.label == 'Choose the Lightspeed Boost');
    expect(useAvailable(feature, feature.system.rules[use], use)).toBe(false);
  });

  test('Aeronautic: +2 Evasion while flying; Aquatic: while submerged', () => {
    const foe = makeActor('Foe');
    const zord = makeActor('Zord', FILES.lightspeedBoost, { type: 'zord' });
    const feature = itemNamed(zord, 'Lightspeed Boost');
    feature.flags.essence20 = { pr1LightspeedBoost: { option: 'aeronautic' } };
    expect(ruleDefenseAdjust(foe, zord, 'evasion', { difficulty: 10 })).toBe(0);
    zord.token.document.elevation = 30;
    expect(ruleDefenseAdjust(foe, zord, 'evasion', { difficulty: 10 })).toBe(2);
    expect(ruleDefenseAdjust(foe, zord, 'toughness', { difficulty: 10 })).toBe(0);
    feature.flags.essence20 = { pr1LightspeedBoost: { option: 'aquatic' } };
    expect(ruleDefenseAdjust(foe, zord, 'evasion', { difficulty: 10 })).toBe(0);
    zord.token.document.elevation = -10;
    expect(ruleDefenseAdjust(foe, zord, 'evasion', { difficulty: 10 })).toBe(2);
  });
});

describe('Repair Progress: Bonus Energon Point', () => {
  test('its BonusEnergon rule: the point above the maximum is held until the Perk is marked spent', async () => {
    const { repairBonusHeld } = await import('../items/resources/repair-progress-bonus-energon.mjs');
    const actor = makeActor('Joe', FILES.repairProgress);
    expect(repairBonusHeld(actor)).toBe(1);
    itemNamed(actor, 'Repair Progress: Bonus Energon Point').flags.essence20 = { repairBonusSpent: true };
    expect(repairBonusHeld(actor)).toBe(0);
    expect(repairBonusHeld(makeActor('Other'))).toBe(0);
  });
});
