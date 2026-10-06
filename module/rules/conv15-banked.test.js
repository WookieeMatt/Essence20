import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Round 15, part "banked" (docs/rules-batches/slBanked15.md): the banked-buffs.mjs Use buttons that needed a new engine
 * piece, plus the round-14 leftovers. Each item is loaded from its pack source; these check the rules validate and that the
 * converted Uses do what the removed code did.
 */

global.Hooks = { on: () => {}, once: () => {}, callAll: () => {} };

const rolls = { rows: null };
const rollVsMany = jest.fn(async (actor, skill, others) => (rolls.rows ? rolls.rows(others) : others.map(other => ({ targetUuid: other.uuid, success: true, multiplier: 1 }))));
jest.unstable_mockModule('./mechanics/combat/reaction-engine.mjs', () => ({ rollVsMany }));
const nearby = { tokens: [] };
jest.unstable_mockModule('./mechanics/combat/nearby-enemies.mjs', () => ({ getNearbyEnemyTokens: jest.fn(() => nearby.tokens) }));
jest.unstable_mockModule('./mechanics/world/gm-relay.mjs', () => ({ needsGmRelay: () => false, relayToGm: jest.fn() }));
const applyTimedCondition = jest.fn(async (actor, status) => actor.statuses.add(status));
jest.unstable_mockModule('./mechanics/combat/timed-status.mjs', () => ({ applyTimedCondition }));
const activateLendAssistance = jest.fn(async () => ({ cancelled: false, message: 'Lent a hand.' }));
jest.unstable_mockModule('./mechanics/actions/lend-assistance.mjs', () => ({ activateLendAssistance }));

await import('./plugins/index.mjs');
const { rebuildIndex } = await import('./index.mjs');
const { validateRule } = await import('./types.mjs');
const { runUse, useAvailable } = await import('./triggers.mjs');
const { bankedDefense, bankedDefenseMultiplier, bankedEntries } = await import('./bank.mjs');
const { ruleMovementStages } = await import('./adapter.mjs');
const { resolveValue } = await import('./formula.mjs');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));

const FILES = {
  avalancheStomp: 'fmmcitems/_source/Avalanche_Stomp_NyK58rUo6jiwX5Aq.json',
  yourSafetysOn: 'qgtgitems/_source/Your_Safety_s_On_CLwsh2pCwbrgYGru.json',
  humanBullet: 'ccitems/_source/Human_Bullet_KGdGal1EWQ3m4HTw.json',
  explosiveMorph: 'jttitems/_source/Explosive_Morph_ExplosiveMorphJT.json',
  menace: 'ccitems/_source/Menace_t0QDESiNz7GEDYHL.json',
  tender: 'mlpcrbitems/_source/Tender_xR4z6mV7Ab72TyVs.json',
  takedown: 'gijcrbitems/_source/Takedown_Yev7VrgEKtsTGdrx.json',
  surfaceRead: 'gijcrbitems/_source/Surface_Read_5YfAL40M8FlZvBVb.json',
  hardTarget: 'prcrbitems/_source/Hard_Target_9oFOf0qSLJCwCGmZ.json',
  resilience: 'prcrbitems/_source/Resilience_TomU7e31oHoRsIrT.json',
  rollWithThePunches: 'gijcrbitems/_source/Roll_With_The_Punches_5hBral7hiCPv3GqF.json',
  slammerPunches: 'sssitems/_source/Roll_with_the_Punches_b1MNR5CPCitDTj4n.json',
  planOfAction: 'gijcrbitems/_source/Plan_of_Action_7wsu99k8v620IB2N.json',
  planOfActionWtnv: 'wtnvcgitems/_source/Plan_of_Action_D3uXlXL7jNn0eD8T.json',
  inspiringWords: 'gijcrbitems/_source/Inspiring_Words_0cGhuapOhkdwYC9G.json',
  forwardObservation: 'ghpfitems/_source/Forward_Observation_wOxrMAMHJWFs1DBN.json',
  eltarianMettle: 'ttsgitems/_source/Eltarian_Mettle_bDgQ7jyTgisY42kt.json',
  balanceAndHarmony: 'iafav2items/_source/Balance_and_Harmony_YydXnrEdfZpl6DU6.json',
  talkThemUp: 'fgtaaitems/_source/Talk_Them_Up_H6hSIGrG2zCQa6Kr.json',
  studiousMeasures: 'dditems/_source/Studious_Measures_ADj30QljJZ7iNt52.json',
  studyWeaknesses: 'ccitems/_source/Study_Weaknesses_AIkpuWVylCFyuLuX.json',
  breakingPoint: 'qgtgitems/_source/Breaking_Point_KYgAj14jx4BkjCfl.json',
  engineOverride: 'iafav2items/_source/Engine_Override_rouaWvDWhwCB5XEO.json',
  juryRig: 'iafav2items/_source/Jury_Rig_PV4QvqJgT1orMm1D.json',
  improviseArmor: 'iafav2items/_source/Improvise_Armor_P9JXwQ2991e1Bw1G.json',
  stalwartDefense: 'tfcrbitems/_source/Stalwart_Defense_uhp3JOTYZJfHrz7q.json',
  standFirm: 'tfcrbitems/_source/Stand_Firm_rAxKrR4ObFGeH5yP.json',
  iGotYou: 'eocitems/_source/I_Got_You_h8DuSX4N1buJb6uN.json',
  rouse: 'gijcrbitems/_source/Rouse_AVhNGB1h4e4eeNPD.json',
  timeTraveler: 'jttitems/_source/Time_Traveler_bXkXXr0VMXpoAiv0.json',
  entropicSponge: 'fmmcitems/_source/Entropic_Sponge_dpxjT9eTAKcZuRXs.json',
  bumperCrop: 'wtnvcgitems/_source/Bumper_Crop_5GDpvzG3x2ZgrrQj.json',
  agelessKnowledge: 'atsitems/_source/Ageless_Knowledge_peGPrJKYlx79ybbu.json',
  weaponConversion: 'dditems/_source/Weapon_Conversion_WbXurpieXjFkmS8h.json',
  matured: 'ccitems/_source/Matured_bf4nxa6WKKhuQcEH.json',
  quietOne: 'iafav2items/_source/The_Quiet_One_eKmiGE7NChwZ2E96.json',
  workTheNumbers: 'tfcrbitems/_source/Work_the_Numbers_aFgXXk1gMMb4saVf.json',
  outwit: 'gijcrbitems/_source/Outwit_DVBrtxa9iiXXhDoS.json',
  markTarget: 'tfcrbitems/_source/Mark_Target_T2mm6VmvcUxagsjc.json',
  hup: 'sssitems/_source/Hup__Hup__Hup__Hup__Hup__xsIHUoZaFoadsmma.json',
  distractingOffer: 'ccitems/_source/Distracting_Offer_fUSF6fxRyTniN2wT.json',
  omegaEnhancement: 'atsitems/_source/Omega_Enhancement__Form__8GtRpU81iPJUCBEw.json',
  digDeep: 'wtnvcgitems/_source/Dig_Deep_A2Xay6rHrBK9l8eo.json',
  digDeepGij: 'gijcrbitems/_source/Dig_Deep_QJkcVXT7K4yNWFoT.json',
  digDeepMlp: 'mlpcrbitems/_source/Dig_Deep_geBN3DkixaCXvnSO.json',
  digDeepTf: 'tfcrbitems/_source/Dig_Deep_uPxkVrCLuBdx9kty.json',
  smashmouth: 'ccitems/_source/Smashmouth_Offense_3OPswxxHjsYrQggY.json',
  standBehindMe: 'atsitems/_source/Stand_Behind_Me__PcezfGdjUtNUZHYH.json',
  gridSurge: 'atsitems/_source/Grid_Surge_PEDHPJkoGvvJed5u.json',
  mysteriousAura: 'prcrbitems/_source/Mysterious_Aura_hSu10Kgj9g1LSmyv.json',
};

// Every pack file this part gave rules to.
const ALL = Object.values(FILES);

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
    id: `i${nextId++}`, flags: {}, system: {}, parent: actor, isOwner: true, ...data,
    async update(changes) {
      for (const [key, value] of Object.entries(changes)) {
        setPath(this, key, value);
      }
    },
    delete: jest.fn(async () => {}),
  };
  item.uuid = `${actor.uuid}.Item.${item.id}`;
  return item;
}

/** An actor holding the pack items `files`, with a token at x (feet) and disposition. */
function makeActor(name, files = [], { system = {}, x = 0, disposition = 1, type = 'playerCharacter' } = {}) {
  const items = [];
  const actor = {
    id: `a${nextId++}`, name, type, isOwner: true, flags: { essence20: {} }, statuses: new Set(),
    system: {
      level: 12, health: { value: 10, max: 10 }, powers: { personal: { value: 3, max: 6 } }, skills: {},
      energon: { normal: { value: 1, max: 4 } },
      defenses: { toughness: { total: 10 }, evasion: { total: 10 }, willpower: { total: 11 }, cleverness: { total: 14 } }, ...system,
    },
    async update(data) {
      for (const [key, value] of Object.entries(data)) {
        setPath(this, key, value);
      }
    },
    async setFlag(scope, key, value) {
      setPath(this.flags[scope] ??= {}, key, value);
    },
    getFlag(scope, key) {
      return getPath(this.flags[scope], key);
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
    items.push(makeItem(actor, { name: doc.name, type: doc.type, system: clone(doc.system), flags: { core: { sourceId: sourceOfPack(file, doc) } } }));
  }

  actor.items = {
    contents: items, get: id => items.find(item => item.id == id), find: fn => items.find(fn), filter: fn => items.filter(fn), some: fn => items.some(fn),
    [Symbol.iterator]: () => items[Symbol.iterator](),
  };
  const token = { actor, document: { disposition }, center: { x, y: 0 }, id: `t${actor.id}` };
  actor.getActiveTokens = () => [token];
  actor.token = token;
  rebuildIndex(actor);
  return actor;
}

/** A pack item's compendium uuid - the real one where a rule names it, else a stand-in. */
const SOURCES = { uhp3JOTYZJfHrz7q: 'Compendium.essence20.tf_crb.Item.uhp3JOTYZJfHrz7q' };
function sourceOfPack(file, doc) {
  return SOURCES[doc._id] ?? `Compendium.essence20.test.Item.${doc._id}`;
}

/** Give an actor another (non-pack) item. */
function addItem(actor, data) {
  const item = makeItem(actor, data);
  actor.items.contents.push(item);
  rebuildIndex(actor);
  return item;
}

const itemNamed = (actor, name) => actor.items.contents.find(item => item.name == name);

function scene(...actors) {
  const docs = new Map(actors.map(actor => [actor.uuid, actor]));
  global.fromUuidSync = uuid => docs.get(uuid) ?? null;
  global.fromUuid = async uuid => docs.get(uuid) ?? null;
  global.game.actors = { get: id => actors.find(actor => actor.id == id) ?? null, contents: actors, [Symbol.iterator]: () => actors[Symbol.iterator]() };
  global.canvas = { tokens: { placeables: actors.map(actor => actor.token), controlled: [], setTargets: jest.fn() }, grid: { size: 100, measurePath: ([a, b]) => ({ distance: Math.hypot(a.x - b.x, a.y - b.y) }) }, scene: { id: 'sc', tokens: [] } };
}

const target = (...actors) => {
  global.game.user.targets = new Set(actors.map(actor => actor.token));
};

const pay = jest.fn(async () => true);
const savedGame = global.game;
const savedFromUuid = global.fromUuid;
const savedFromUuidSync = global.fromUuidSync;

beforeEach(() => {
  pay.mockClear();
  rollVsMany.mockClear();
  applyTimedCondition.mockClear();
  rolls.rows = null;
  nearby.tokens = [];
  global.game = {
    combat: null, combats: { get: () => null }, user: { id: 'u', isGM: true, targets: new Set() }, users: { contents: [], activeGM: null },
    actors: { contents: [] }, settings: { get: () => 1 }, i18n: { localize: key => key, format: key => key, has: () => false },
  };
  global.ChatMessage = { create: jest.fn(async data => data), getSpeaker: () => ({}), getSpeakerActor: () => null };
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn(), error: jest.fn() } };
  global.CONFIG = { ...(global.CONFIG ?? {}), E20: { ...(global.CONFIG?.E20 ?? {}), skillToEssence: { athletics: 'strength', deception: 'social', technology: 'smarts', brawn: 'strength', survival: 'smarts', might: 'strength', finesse: 'speed', science: 'smarts' } } };
  global.foundry = {
    ...global.foundry,
    utils: {
      ...(global.foundry?.utils ?? {}), setProperty: setPath, getProperty: getPath, randomID: () => `r${nextId++}`,
      hasProperty: (o, k) => getPath(o, k) !== undefined, escapeHTML: text => String(text), deepClone: clone,
    },
  };
});

afterEach(() => {
  global.canvas = undefined;
  global.game = savedGame;
  global.fromUuid = savedFromUuid;
  global.fromUuidSync = savedFromUuidSync;
});

/** Pick the choose option whose label starts with `text`. */
const askFor = text => async (step, options) => options.findIndex(option => String(option.label).startsWith(text));

test('every banked-part rule validates', () => {
  for (const file of ALL) {
    const rules = fromPack(file).system.rules ?? [];
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) {
      expect(validateRule(rule)).toEqual([]);
    }
  }
});

describe('rollVsEach area and synthetic-damage Uses', () => {
  // Book check (effects): a hit deals Stun 2 (the damage type), not the Stunned Condition.
  test('Avalanche Stomp: 1 Personal Power, everyone within 30 ft; a hit deals Stun 2, a Critical Success also knocks Prone', async () => {
    const brute = makeActor('Brute', FILES.avalancheStomp);
    const near = makeActor('Near', [], { x: 20, disposition: -1, system: { stun: { value: 0 } } });
    const crit = makeActor('Crit', [], { x: 25, system: { stun: { value: 0 } } });
    const far = makeActor('Far', [], { x: 40, disposition: -1 });
    scene(brute, near, crit, far);
    rolls.rows = others => others.map(other => ({ targetUuid: other.uuid, success: true, multiplier: other === crit ? 2 : 1 }));
    await runUse(itemNamed(brute, 'Avalanche Stomp'), pay);
    expect(rollVsMany).toHaveBeenCalledWith(brute, 'athletics', [near, crit], 'toughness');
    expect(brute.system.powers.personal.value).toBe(2);
    expect([near.system.stun.value, crit.system.stun.value]).toEqual([2, 2]);
    expect(near.statuses.has('prone')).toBe(false);
    expect(crit.statuses.has('prone')).toBe(true);
    expect(far.statuses.size).toBe(0);
  });

  test('Explosive Morph: only while Morphed; every enemy within 20 ft, 1 Energy damage on the card', async () => {
    const ranger = makeActor('Ranger', FILES.explosiveMorph);
    const enemy = makeActor('Enemy', [], { x: 10, disposition: -1 });
    scene(ranger, enemy);
    const item = itemNamed(ranger, 'Explosive Morph');
    const [use] = item.system.rules;
    expect(useAvailable(item, use, 0)).toBe(false);
    ranger.system.isMorphed = true;
    expect(useAvailable(item, use, 0)).toBe(true);
    nearby.tokens = [enemy.token];
    await runUse(item, pay);
    expect(rollVsMany).toHaveBeenCalledWith(ranger, 'technology', [enemy], 'evasion', null, { stepDamage: { value: 1, type: 'element' } });
    expect(ranger.system.powers.personal.value).toBe(2);
  });

  test('Human Bullet: the wide blast is 1 Fire within 30 ft, the tight one 2 Fire within 10 ft', async () => {
    const rocketeer = makeActor('Rocketeer', FILES.humanBullet);
    const enemy = makeActor('Enemy', [], { x: 5, disposition: -1 });
    scene(rocketeer, enemy);
    nearby.tokens = [enemy.token];
    await runUse(itemNamed(rocketeer, 'Human Bullet'), pay, { ask: askFor('Tight') });
    expect(rollVsMany).toHaveBeenLastCalledWith(rocketeer, 'athletics', [enemy], 'evasion', null, { stepDamage: { value: 2, type: 'fire' } });
    await runUse(itemNamed(rocketeer, 'Human Bullet'), pay, { ask: askFor('Wide') });
    expect(rollVsMany).toHaveBeenLastCalledWith(rocketeer, 'athletics', [enemy], 'evasion', null, { stepDamage: { value: 1, type: 'fire' } });
  });

  test('Menace: once per scene, the Origin Skill against Willpower, 1 Stun damage on the card', async () => {
    const bully = makeActor('Bully', FILES.menace);
    const foe = makeActor('Foe', [], { x: 10, disposition: -1 });
    scene(bully, foe);
    const item = itemNamed(bully, 'Menace');
    const [use] = item.system.rules;
    expect(useAvailable(item, use, 0)).toBe(false);
    bully.system.originSkillsIncrease = 'brawn';
    expect(useAvailable(item, use, 0)).toBe(true);
    target(foe);
    await runUse(item, pay);
    expect(rollVsMany).toHaveBeenCalledWith(bully, 'brawn', [foe], 'willpower', null, { stepDamage: { value: 1, type: 'stun' } });
    expect(use.limit).toEqual({ per: 'scene' });
  });
});

describe('Tender: the Empathy Perk\'s chosen Skill against Willpower', () => {
  const EMPATHY = 'Compendium.essence20.mlp_crb.Item.7k1UXzSKyoV8EtXZ';

  test('needs an Empathy pick; a hit banks a downshift on the target', async () => {
    const pony = makeActor('Pony', FILES.tender);
    const foe = makeActor('Foe', [], { x: 10, disposition: -1 });
    scene(pony, foe);
    const item = itemNamed(pony, 'Tender');
    const [use] = item.system.rules;
    expect(useAvailable(item, use, 0)).toBe(false);
    const empathy = addItem(pony, { name: 'Empathy', type: 'perk', flags: { core: { sourceId: EMPATHY } }, system: {} });
    expect(useAvailable(item, use, 0)).toBe(false);
    empathy.system.choice = 'survival';
    expect(useAvailable(item, use, 0)).toBe(true);
    target(foe);
    await runUse(item, pay);
    expect(rollVsMany).toHaveBeenCalledWith(pony, 'survival', [foe], 'willpower');
    expect(foe.flags.essence20.ruleBank).toEqual([expect.objectContaining({ shiftDown: 1, when: ['not:roll:initiative'], until: 'combat' })]);
  });
});

describe("Your Safety's On", () => {
  // Book check follow-ups 2026-10-06: the Critical Success mark lasts until the end of YOUR next turn (QGtG p.31).
  test('a success banks a Snag on the enemy\'s next test; a Critical Success in a combat marks it until the end of your next turn', async () => {
    const officer = makeActor('Officer', FILES.yourSafetysOn);
    const plain = makeActor('Plain', [], { x: 10, disposition: -1 });
    const flustered = makeActor('Flustered', [], { x: 10, disposition: -1 });
    scene(officer, plain, flustered);
    target(plain, flustered);
    global.game.combat = { id: 'c1', started: true, round: 2, turn: 0, turns: [], combatants: { contents: [] } };
    rolls.rows = others => others.map(other => ({ targetUuid: other.uuid, success: true, multiplier: other === flustered ? 2 : 1 }));
    await runUse(itemNamed(officer, "Your Safety's On"), pay);
    expect(rollVsMany).toHaveBeenCalledWith(officer, 'deception', [plain, flustered], 'cleverness');
    expect(plain.flags.essence20.ruleBank).toEqual([expect.objectContaining({ snag: true })]);
    expect(flustered.flags.essence20.ruleBank).toBeUndefined();
    expect(flustered.flags.essence20.ruleMarks.yourSafetysOn).toEqual(expect.objectContaining({ by: officer.uuid, until: 'endOfNextTurn' }));
  });

  test('a Critical Success out of combat is the plain Snag; the mark Snags the marked creature\'s own attacks', async () => {
    const officer = makeActor('Officer', FILES.yourSafetysOn);
    const foe = makeActor('Foe', [], { x: 10, disposition: -1 });
    scene(officer, foe);
    target(foe);
    rolls.rows = others => others.map(other => ({ targetUuid: other.uuid, success: true, multiplier: 3 }));
    await runUse(itemNamed(officer, "Your Safety's On"), pay);
    expect(foe.flags.essence20.ruleBank).toEqual([expect.objectContaining({ snag: true })]);
    expect(foe.flags.essence20.ruleMarks).toBeUndefined();
    const modifier = fromPack(FILES.yourSafetysOn).system.rules.find(rule => rule.type == 'RollModifier');
    expect(modifier).toEqual(expect.objectContaining({ scope: 'marked', mark: 'yourSafetysOn', snag: true, when: ['attack'] }));
  });
});

describe('Takedown: the outcome matrix', () => {
  function setup(levels) {
    const commando = makeActor('Commando', FILES.takedown, { system: { level: 10 } });
    const foes = levels.map((level, i) => makeActor(`Foe${i}`, [], { x: 5, disposition: -1, system: { level } }));
    scene(commando, ...foes);
    target(...foes);
    return { commando, foes, item: itemNamed(commando, 'Takedown') };
  }

  test('a hit on a foe no higher: Restrained + Unconscious; a hit on a higher one: Grappled', async () => {
    const { commando, foes: [low, high], item } = setup([10, 11]);
    await runUse(item, pay, { ask: askFor('Finesse') });
    expect(rollVsMany).toHaveBeenCalledWith(commando, 'finesse', [low, high], 'toughness', null, { isTakedown: true });
    expect([...low.statuses].sort()).toEqual(['restrained', 'unconscious']);
    expect([...high.statuses]).toEqual(['grappled']);
  });

  test('a miss on a foe no higher: Grappled; a miss on a higher one: nothing', async () => {
    const { foes: [low, high], item } = setup([5, 15]);
    rolls.rows = others => others.map(other => ({ targetUuid: other.uuid, success: false, multiplier: 0 }));
    await runUse(item, pay, { ask: askFor('Might') });
    expect([...low.statuses]).toEqual(['grappled']);
    expect(high.statuses.size).toBe(0);
  });

  test('Science is offered only with Science of Subtlety', async () => {
    const { commando, item } = setup([5]);
    const [use] = item.system.rules;
    const scienceOption = use.steps[0].options.find(option => option.label.startsWith('Science'));
    expect(scienceOption.when).toEqual(['self:hasItem:Compendium.essence20.cobra_codex.Item.tqY4YomXkTuFXZLo']);
    const offered = [];
    await runUse(item, pay, { ask: async (step, options) => {
      offered.push(options.map(option => option.label));
      return null;
    } });
    expect(offered[0]).toEqual(['Might', 'Finesse']);
    addItem(commando, { name: 'Science of Subtlety', type: 'perk', flags: { core: { sourceId: 'Compendium.essence20.cobra_codex.Item.tqY4YomXkTuFXZLo' } } });
    await runUse(item, pay, { ask: async (step, options) => {
      offered.push(options.map(option => option.label));
      return null;
    } });
    expect(offered[1]).toHaveLength(3);
  });
});

/** A roll the rules engine's roll step makes (grants.mjs#rollTest reads it): success or not, its total. */
function rollsAs(actor, { success = true, total = 15, multiplier = 1 } = {}) {
  actor._dice = { rollSkill: jest.fn(async () => ({ success, outcomes: [{ roll: { total }, results: [{ success, multiplier, total }] }] })) };
  return actor._dice.rollSkill;
}

/** DialogV2.wait answering with `value` (the select pickers - chooseSelect - and the step pickers). */
function dialogAnswers(...values) {
  const wait = jest.fn(async () => values.shift() ?? null);
  global.foundry.applications = { api: { DialogV2: { wait } } };
  return wait;
}

describe('rolled Skill dice (@skillDie)', () => {
  afterEach(() => jest.restoreAllMocks());

  test('Hard Target banks its Acrobatics die on Evasion, until combat; not again while it is banked', async () => {
    const ranger = makeActor('Ranger', FILES.hardTarget, { system: { skills: { acrobatics: { shift: 'd6' } } } });
    scene(ranger);
    jest.spyOn(Math, 'random').mockReturnValue(0.99);
    const item = itemNamed(ranger, 'Hard Target');
    await runUse(item, pay);
    expect(ranger.flags.essence20.ruleBank).toEqual([expect.objectContaining({ defense: 'evasion', defenseBonus: 6, until: 'combat' })]);
    expect(useAvailable(item, item.system.rules[0], 0)).toBe(false);
    expect(await bankedDefense(ranger, 'toughness')).toBe(0);
    expect(await bankedDefense(ranger, 'evasion')).toBe(6);
    expect(bankedEntries(ranger)).toEqual([]);
  });

  // Book check 2026-10-06 (docs/rules-batches/book-costs.md): only while Morphed.
  // Book check 2026-10-06 (docs/rules-batches/book-durations.md): every incoming attack until the start of your next turn.
  test('Resilience: 1 Personal Power while Morphed, its Athletics die on every Defense against every attack until your next turn', async () => {
    const ranger = makeActor('Ranger', FILES.resilience, { system: { isMorphed: true, skills: { athletics: { shift: '2d8' } } } });
    scene(ranger);
    jest.spyOn(Math, 'random').mockReturnValue(0);
    await runUse(itemNamed(ranger, 'Resilience'), pay);
    expect(ranger.system.powers.personal.value).toBe(2);
    expect(await bankedDefense(ranger, 'willpower')).toBe(2);
    expect(await bankedDefense(ranger, 'toughness')).toBe(2);
    expect(ranger.flags.essence20.ruleBank[0]).toMatchObject({ persist: true, until: 'nextTurnOrScene' });
  });

  test('Surface Read: a Story Point, then its Alertness die says how many questions', async () => {
    const spy = makeActor('Spy', FILES.surfaceRead, { system: { skills: { alertness: { shift: 'd8' } } } });
    scene(spy);
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const card = await runUse(itemNamed(spy, 'Surface Read'), pay);
    expect(itemNamed(spy, 'Surface Read').system.rules[0].cost).toEqual({ resource: { storyPoints: true }, amount: 1 });
    expect(card).toContain('Spy may ask 5 yes-or-no questions.');
  });
});

describe('Roll With The Punches: the chosen Defense doubles against the next attack', () => {
  test('banks a x2 on the picked Defense; the attack against it uses it up', async () => {
    const tank = makeActor('Tank', FILES.rollWithThePunches);
    scene(tank);
    await runUse(itemNamed(tank, 'Roll With The Punches'), pay, { ask: askFor('Willpower') });
    expect(tank.flags.essence20.ruleBank).toEqual([expect.objectContaining({ defense: 'willpower', defenseMultiply: 2 })]);
    expect(await bankedDefense(tank, 'willpower')).toBe(0);
    expect(await bankedDefenseMultiplier(tank, 'toughness')).toBe(1);
    expect(await bankedDefenseMultiplier(tank, 'willpower')).toBe(2);
    expect(bankedEntries(tank)).toEqual([]);
    expect(itemNamed(tank, 'Roll With The Punches').system.rules[0].limit).toEqual({ per: 'encounter' });
  });

  test("the Slammer's printing is twice per encounter from 6th level", () => {
    const [use] = fromPack(FILES.slammerPunches).system.rules;
    expect(resolveValue(use.limit.max, { actor: { system: { level: 5 } } })).toBe(1);
    expect(resolveValue(use.limit.max, { actor: { system: { level: 6 } } })).toBe(2);
    expect(resolveValue(use.limit.max, { actor: { system: { level: 20 } } })).toBe(2);
  });
});

describe('Plan of Action', () => {
  const INSPIRATION = 'Compendium.essence20.gi_joe_crb.Item.j05tN97KZNzl5jTF';

  test('banks its advance value of ↑ on the targeted ally (1 with none), offering This, I Command its double', async () => {
    const officer = makeActor('Officer', FILES.planOfAction);
    const ally = makeActor('Duke', [], { x: 10 });
    scene(officer, ally);
    target(ally);
    const item = itemNamed(officer, 'Plan of Action');
    item.system.advances = { currentValue: 3 };
    await runUse(item, pay);
    expect(ally.flags.essence20.ruleBank).toEqual([expect.objectContaining({ shiftUp: 3, label: 'Plan of Action', when: ['not:roll:initiative'], until: 'combat' })]);
    const wtnv = makeActor('Citizen', FILES.planOfActionWtnv);
    scene(wtnv, ally);
    target(ally);
    await runUse(itemNamed(wtnv, 'Plan of Action'), pay);
    expect(ally.flags.essence20.ruleBank.at(-1)).toEqual(expect.objectContaining({ shiftUp: 1 }));
    item.system.rules.concat(itemNamed(wtnv, 'Plan of Action').system.rules).forEach(rule => {
      expect(rule.steps.find(step => step.do == 'bank').grantDouble).toBe(true);
    });
  });

  test('with Inspiration: one more ↑, up to two targeted allies', async () => {
    const officer = makeActor('Officer', FILES.planOfAction);
    addItem(officer, { name: 'Inspiration', type: 'perk', flags: { core: { sourceId: INSPIRATION } } });
    const a = makeActor('Duke', [], { x: 10 });
    const b = makeActor('Scarlett', [], { x: 15 });
    scene(officer, a, b);
    target(a, b);
    const item = itemNamed(officer, 'Plan of Action');
    item.system.advances = { currentValue: 2 };
    const available = item.system.rules.map((rule, index) => useAvailable(item, rule, index));
    expect(available).toEqual([false, true]);
    await runUse(item, pay);
    expect(a.flags.essence20.ruleBank).toEqual([expect.objectContaining({ shiftUp: 3 })]);
    expect(b.flags.essence20.ruleBank).toEqual([expect.objectContaining({ shiftUp: 3 })]);
  });

  test("Split: from ↑2, a button moves part of the ally's ↑ to a second ally (the old Split card button)", async () => {
    const officer = makeActor('Officer', FILES.planOfAction);
    const duke = makeActor('Duke', [], { x: 10 });
    const flint = makeActor('Flint', [], { x: 20 });
    scene(officer, duke, flint);
    target(duke);
    const item = itemNamed(officer, 'Plan of Action');
    item.system.advances = { currentValue: 3 };
    await runUse(item, pay);
    const button = ChatMessage.create.mock.calls.map(([data]) => data.flags?.essence20?.ruleButton).find(Boolean);
    expect(button).toEqual(expect.objectContaining({ label: 'Split Plan of Action', once: false, targets: [duke.uuid] }));
    const { runSteps, stepContext } = await import('./steps.mjs');
    const ctx = stepContext({ actor: officer, item, targets: [duke] });
    dialogAnswers(flint.uuid, '2');
    expect(await runSteps(button.steps, ctx)).toBe(true);
    expect(bankedEntries(duke).map(bank => bank.shiftUp)).toEqual([1]);
    expect(bankedEntries(flint)).toEqual([expect.objectContaining({ shiftUp: 2, label: 'Plan of Action', source: item.id, until: 'combat' })]);
  });

  test('no Split button below ↑2', async () => {
    const officer = makeActor('Officer', FILES.planOfAction);
    const duke = makeActor('Duke', [], { x: 10 });
    scene(officer, duke);
    target(duke);
    await runUse(itemNamed(officer, 'Plan of Action'), pay);
    expect(ChatMessage.create.mock.calls.some(([data]) => data.flags?.essence20?.ruleButton)).toBe(false);
  });
});

describe('Inspiring Words: twice per combat, once a turn', () => {
  test('only in a combat and while fewer than two uses are marked; each use adds to the count', async () => {
    const vanguard = makeActor('Vanguard', FILES.inspiringWords);
    const ally = makeActor('Ally', [], { x: 10 });
    scene(vanguard, ally);
    const item = itemNamed(vanguard, 'Inspiring Words');
    const [use] = item.system.rules;
    expect(useAvailable(item, use, 0)).toBe(false);
    global.game.combat = { id: 'c1', started: true, round: 1, turn: 0, turns: [] };
    global.game.combats = { get: id => (id == 'c1' ? global.game.combat : null) };
    expect(useAvailable(item, use, 0)).toBe(true);
    target(ally);
    await runUse(item, pay, { ask: askFor('1 Temporary') });
    expect(ally.system.health.bonus).toBe(1);
    expect(vanguard.flags.essence20.ruleMarks.inspiringWords).toEqual(expect.objectContaining({ count: 1, until: 'combat' }));
    global.game.combat.turn = 1;
    await runUse(item, pay, { ask: askFor('↑2') });
    expect(ally.flags.essence20.ruleBank).toEqual([expect.objectContaining({ shiftUp: 2 })]);
    expect(vanguard.flags.essence20.ruleMarks.inspiringWords.count).toBe(2);
    global.game.combat.turn = 2;
    expect(useAvailable(item, use, 0)).toBe(false);
  });

  test("Remove a Condition picks one of the ally's Conditions (not Defeated); none - nothing used", async () => {
    const vanguard = makeActor('Vanguard', FILES.inspiringWords);
    const ally = makeActor('Ally', [], { x: 10 });
    scene(vanguard, ally);
    global.CONFIG.E20.statusEffects = [{ id: 'defeated', name: 'Defeated' }, { id: 'stunned', name: 'Stunned' }];
    global.game.combat = { id: 'c1', started: true, round: 1, turn: 0, turns: [] };
    target(ally);
    ally.statuses.add('defeated');
    await runUse(itemNamed(vanguard, 'Inspiring Words'), pay, { ask: askFor('Remove') });
    expect(vanguard.flags.essence20.ruleMarks).toBeUndefined();
    ally.statuses.add('stunned');
    const wait = dialogAnswers('stunned');
    await runUse(itemNamed(vanguard, 'Inspiring Words'), pay, { ask: askFor('Remove') });
    expect(wait.mock.calls[0][0].content).not.toContain('Defeated');
    expect([...ally.statuses]).toEqual(['defeated']);
    expect(vanguard.flags.essence20.ruleMarks.inspiringWords.count).toBe(1);
  });
});

describe('Forward Observation', () => {
  test('a DIF 15 Alertness success banks ↑1 on the observer and every ally within 30 ft', async () => {
    const scout = makeActor('Scout', FILES.forwardObservation);
    const near = makeActor('Near', [], { x: 25 });
    const far = makeActor('Far', [], { x: 40 });
    scene(scout, near, far);
    const roll = rollsAs(scout);
    await runUse(itemNamed(scout, 'Forward Observation'), pay);
    expect(roll).toHaveBeenCalledWith(expect.objectContaining({ skill: 'alertness', dif: '15' }), scout);
    expect(bankedEntries(scout)).toEqual([expect.objectContaining({ shiftUp: 1 })]);
    expect(bankedEntries(near)).toEqual([expect.objectContaining({ shiftUp: 1 })]);
    expect(bankedEntries(far)).toEqual([]);
  });

  test('a failure banks nothing', async () => {
    const scout = makeActor('Scout', FILES.forwardObservation);
    scene(scout);
    rollsAs(scout, { success: false });
    await runUse(itemNamed(scout, 'Forward Observation'), pay);
    expect(bankedEntries(scout)).toEqual([]);
  });
});

describe('Condition removal (pick from: conditions)', () => {
  beforeEach(() => {
    global.CONFIG.E20.statusEffects = [{ id: 'defeated', name: 'Defeated' }, { id: 'unconscious', name: 'Unconscious' }, { id: 'stunned', name: 'Stunned' }];
  });

  test('Eltarian Mettle: picks before paying; nothing to remove costs nothing', async () => {
    const guardian = makeActor('Guardian', FILES.eltarianMettle);
    scene(guardian);
    guardian.statuses.add('defeated');
    await runUse(itemNamed(guardian, 'Eltarian Mettle'), pay);
    expect(guardian.system.powers.personal.value).toBe(3);
    guardian.statuses.add('stunned');
    dialogAnswers('stunned');
    await runUse(itemNamed(guardian, 'Eltarian Mettle'), pay);
    expect(guardian.system.powers.personal.value).toBe(2);
    expect([...guardian.statuses]).toEqual(['defeated']);
  });

  test('Balance and Harmony leaves out Defeated and Unconscious, once per scene', async () => {
    const ninja = makeActor('Ninja', FILES.balanceAndHarmony);
    scene(ninja);
    ninja.statuses.add('unconscious');
    ninja.statuses.add('stunned');
    const wait = dialogAnswers('stunned');
    await runUse(itemNamed(ninja, 'Balance and Harmony'), pay);
    expect(wait.mock.calls[0][0].content).not.toContain('Unconscious');
    expect([...ninja.statuses]).toEqual(['unconscious']);
    expect(itemNamed(ninja, 'Balance and Harmony').system.rules[0].limit).toEqual({ per: 'scene' });
  });

  test("Talk Them Up: DIF 10 Persuasion, then any of the target's statuses but Defeated", async () => {
    const envoy = makeActor('Envoy', FILES.talkThemUp);
    const friend = makeActor('Friend', [], { x: 10 });
    scene(envoy, friend);
    target(friend);
    friend.statuses.add('defeated');
    friend.statuses.add('invisible');
    rollsAs(envoy);
    dialogAnswers('invisible');
    await runUse(itemNamed(envoy, 'Talk Them Up'), pay);
    expect(envoy._dice.rollSkill).toHaveBeenCalledWith(expect.objectContaining({ skill: 'persuasion', dif: '10' }), envoy);
    expect([...friend.statuses]).toEqual(['defeated']);
  });
});

describe('What you learn about a target (targetFacts)', () => {
  function foe() {
    const actor = makeActor('Foe', [], { x: 10, disposition: -1, system: { health: { value: 4, max: 9 }, resistances: { fire: true }, immunities: { psychic: true },
      defenses: { toughness: { total: 12 }, evasion: { total: 9 }, willpower: { total: 11 }, cleverness: { total: 9 } } } });
    addItem(actor, { name: 'Greedy', type: 'hangUp' });
    return actor;
  }

  beforeEach(() => {
    global.CONFIG.E20.damageTypes = { fire: 'Fire', psychic: 'Psychic', blunt: 'Blunt' };
    global.CONFIG.E20.defenses = { toughness: 'Toughness', evasion: 'Evasion', willpower: 'Willpower', cleverness: 'Cleverness' };
  });

  test("Studious Measures tells the target's max Health, Hang-Ups and Resistances", async () => {
    const bot = makeActor('Bot', FILES.studiousMeasures);
    const target1 = foe();
    scene(bot, target1);
    target(target1);
    const card = await runUse(itemNamed(bot, 'Studious Measures'), pay);
    expect(card).toContain('Foe: max Health 9; Hang-Ups: Greedy; Resistances: Fire, Psychic');
  });

  test('Study Weaknesses: needs a target before the Story Point; tells the lowest Defense', async () => {
    const tech = makeActor('Tech', FILES.studyWeaknesses);
    const target1 = foe();
    scene(tech, target1);
    const steps = itemNamed(tech, 'Study Weaknesses').system.rules[0].steps;
    expect(steps[0]).toEqual({ do: 'target', max: 1, beforeCost: true });
    target(target1);
    const card = await runUse(itemNamed(tech, 'Study Weaknesses'), pay);
    expect(card).toContain('Foe&#39;s lowest Defense: Evasion.');
  });

  test('Breaking Point: a targeted vehicle only, DIF 10 + its Threat Level, then the chosen detail', async () => {
    const disruptor = makeActor('Disruptor', FILES.breakingPoint);
    const vehicle = makeActor('Truck', [], { x: 5, disposition: -1, type: 'vehicle', system: { threatLevel: 4, health: { value: 6, max: 8 } } });
    scene(disruptor, vehicle);
    target(vehicle);
    rollsAs(disruptor);
    const card = await runUse(itemNamed(disruptor, 'Breaking Point'), pay, { ask: askFor('Its Health') });
    expect(disruptor._dice.rollSkill).toHaveBeenCalledWith(expect.objectContaining({ skill: 'technology', dif: '14' }), disruptor);
    expect(card).toContain('Truck&#39;s Health: 6 / 8.');
    const person = foe();
    scene(disruptor, person);
    target(person);
    disruptor._dice.rollSkill.mockClear();
    await runUse(itemNamed(disruptor, 'Breaking Point'), pay);
    expect(disruptor._dice.rollSkill).not.toHaveBeenCalled();
  });
});

describe('Vehicle Perks (pilotedVehicleOrTarget)', () => {
  function rigged(file) {
    const engineer = makeActor('Engineer', file);
    const crewed = makeActor('Jeep', [], { x: 0, type: 'vehicle', system: { threatLevel: 2, health: { value: 10, max: 10, bonus: 1 } } });
    const other = makeActor('Truck', [], { x: 5, type: 'vehicle', system: { threatLevel: 6, health: { value: 10, max: 10, bonus: 0 } } });
    return { engineer, crewed, other };
  }

  test('Engine Override marks the crewed vehicle for this round; the mark gives +15 ft Ground Movement at stage final', async () => {
    const { engineer, crewed, other } = rigged(FILES.engineOverride);
    crewed.system.actors = { a: { uuid: engineer.uuid, vehicleRole: 'driver' } };
    scene(engineer, crewed, other);
    target(other);
    global.game.combat = { id: 'c1', started: true, round: 3, turn: 0, turns: [] };
    await runUse(itemNamed(engineer, 'Engine Override'), pay);
    expect(crewed.flags.essence20.ruleMarks.engineOverride).toEqual(expect.objectContaining({ by: engineer.uuid, until: 'thisRound' }));
    expect(other.flags.essence20.ruleMarks).toBeUndefined();
    rebuildIndex(crewed);
    expect(ruleMovementStages(crewed)('final', 'ground', 35)).toBe(50);
    expect(ruleMovementStages(crewed)('final', 'aerial', 0)).toBe(null);
    global.game.combat.round = 4;
    expect(ruleMovementStages(crewed)('final', 'ground', 35)).toBe(null);
  });

  test('not crewing: the targeted vehicle; a targeted non-vehicle - nothing', async () => {
    const { engineer, other } = rigged(FILES.engineOverride);
    const person = makeActor('Person', [], { x: 5 });
    scene(engineer, other, person);
    target(person);
    await runUse(itemNamed(engineer, 'Engine Override'), pay);
    expect(person.flags.essence20.ruleMarks).toBeUndefined();
    target(other);
    await runUse(itemNamed(engineer, 'Engine Override'), pay);
    expect(other.flags.essence20.ruleMarks.engineOverride.by).toBe(engineer.uuid);
  });

  test('Jury Rig: Free - the picked benefit through next round; Standard (once per scene) - for the scene', async () => {
    const { engineer, other } = rigged(FILES.juryRig);
    scene(engineer, other);
    target(other);
    global.game.combat = { id: 'c1', started: true, round: 2, turn: 0, turns: [] };
    rollsAs(engineer);
    let asked = 0;
    const ask = async (step, options) => (asked++ == 0 ? options.findIndex(o => o.label.startsWith('Free')) : options.findIndex(o => o.label == 'Harden Armor'));
    await runUse(itemNamed(engineer, 'Jury Rig'), pay, { ask });
    expect(engineer._dice.rollSkill).toHaveBeenCalledWith(expect.objectContaining({ skill: 'technology', dif: '16' }), engineer);
    // Book check 2026-10-06 (docs/rules-batches/book-limits.md): once per turn; the Standard version once per scene and
    // stamped with the scene it ends with.
    expect(other.flags.essence20.pendingJuryRigBenefit).toEqual({ option: 'hardenArmor', expiresRound: 3, scene: 0 });
    global.game.combat = { id: 'c1', started: true, round: 2, turn: 1, turns: [] };
    asked = 0;
    const standard = async (step, options) => (asked++ == 0 ? options.findIndex(o => o.label.startsWith('Standard')) : options.findIndex(o => o.label == 'Clean Barrels'));
    await runUse(itemNamed(engineer, 'Jury Rig'), pay, { ask: standard });
    expect(other.flags.essence20.pendingJuryRigBenefit).toEqual({ option: 'cleanBarrels', expiresRound: 999999, scene: expect.any(Number) });
    expect(other.flags.essence20.pendingJuryRigBenefit.scene).toBeGreaterThan(0);
    expect(engineer.flags.essence20.juryRigUsedThisSceneAsStandardAction).toEqual(expect.objectContaining({ window: 'scene', count: 1 }));
  });

  test('Improvise Armor: temporary Health = (total - 10) / 5 rounded down, never below 0; once per scene', async () => {
    const { engineer, crewed } = rigged(FILES.improviseArmor);
    crewed.system.actors = { a: { uuid: engineer.uuid, vehicleRole: 'passenger' } };
    scene(engineer, crewed);
    rollsAs(engineer, { total: 24 });
    await runUse(itemNamed(engineer, 'Improvise Armor'), pay);
    expect(crewed.system.health.bonus).toBe(3);
    rollsAs(engineer, { total: 7 });
    await runUse(itemNamed(engineer, 'Improvise Armor'), pay);
    expect(crewed.system.health.bonus).toBe(3);
    expect(itemNamed(engineer, 'Improvise Armor').system.rules[0].limit).toEqual({ per: 'encounter' });
  });
});

describe('Stalwart Defense and Stand Firm', () => {
  test('in a combat the bonus lasts to the next turn for every attack; Stand Firm doubles it', async () => {
    const sentinel = makeActor('Sentinel', [FILES.stalwartDefense, FILES.standFirm]);
    scene(sentinel);
    global.game.combat = { id: 'c1', started: true, round: 2, turn: 0, turns: [{ actor: sentinel }] };
    global.game.combats = { get: () => global.game.combat };
    const stand = itemNamed(sentinel, 'Stand Firm');
    expect(useAvailable(stand, stand.system.rules[0], 0)).toBe(false);
    await runUse(itemNamed(sentinel, 'Stalwart Defense'), pay, { ask: askFor('+1 Toughness and Evasion') });
    expect(bankedEntries(sentinel)).toEqual([expect.objectContaining({ defense: ['toughness', 'evasion'], defenseBonus: 1, persist: true, until: 'nextTurn' })]);
    expect(useAvailable(stand, stand.system.rules[0], 0)).toBe(true);
    await runUse(stand, pay);
    expect(await bankedDefense(sentinel, 'toughness')).toBe(2);
    expect(await bankedDefense(sentinel, 'evasion')).toBe(2);
    global.game.combat.round = 3;
    expect(await bankedDefense(sentinel, 'evasion')).toBe(0);
  });

  test('out of combat the bonus is used up by the first attack', async () => {
    const sentinel = makeActor('Sentinel', FILES.stalwartDefense);
    scene(sentinel);
    await runUse(itemNamed(sentinel, 'Stalwart Defense'), pay, { ask: askFor('+2 Evasion') });
    expect(await bankedDefense(sentinel, 'toughness')).toBe(0);
    expect(await bankedDefense(sentinel, 'evasion')).toBe(2);
    expect(await bankedDefense(sentinel, 'evasion')).toBe(0);
  });
});

describe('I Got You', () => {
  test('two Uses: Lend Assistance, or 1 Energon for ↑1 on a teammate once a round', async () => {
    const leader = makeActor('Leader', FILES.iGotYou);
    const mate = makeActor('Mate', [], { x: 10 });
    scene(leader, mate);
    global.game.combat = { id: 'c1', started: true, round: 1, turn: 0, turns: [] };
    const item = itemNamed(leader, 'I Got You');
    const card = await runUse(item, pay, { pick: async (it, available) => available[0] });
    expect(activateLendAssistance).toHaveBeenCalledWith(leader);
    expect(card).toContain('Lent a hand.');
    target(mate);
    await runUse(item, pay, { pick: async (it, available) => available[1] });
    expect(leader.system.energon.normal.value).toBe(0);
    expect(bankedEntries(mate)).toEqual([expect.objectContaining({ shiftUp: 1, when: [] })]);
    expect(item.system.rules[1].limit).toEqual({ per: 'round' });
    expect(useAvailable(item, item.system.rules[1], 1)).toBe(false);
  });
});

describe('Rouse', () => {
  test("a Standard action named rouse (Rousing Presence's discount), in a combat; a DIF 15 success grants a Story Point", async () => {
    const [use] = fromPack(FILES.rouse).system.rules;
    expect(use.cost).toEqual({ action: 'standard', kind: 'rouse' });
    expect(use.when).toEqual(['combat:exists']);
    const officer = makeActor('Officer', FILES.rouse);
    scene(officer);
    global.game.combat = { id: 'c1', started: true, round: 1, turn: 0, turns: [] };
    const roll = rollsAs(officer);
    const paid = jest.fn(async () => true);
    await runUse(itemNamed(officer, 'Rouse'), paid);
    expect(paid).toHaveBeenCalledWith('standard', { kind: 'rouse' });
    // Brutal Verbalities reads the attempt flag (roll:dataset:isRouseAttempt).
    expect(roll).toHaveBeenCalledWith(expect.objectContaining({ skill: 'persuasion', dif: '15', isRouseAttempt: true }), officer);
    expect(use.steps[0].onSuccess).toEqual([{ do: 'grantStoryPoint' }]);
  });
});

describe('Time Traveler: a Skill that cannot suffer Snag', () => {
  test('on: a Story Point and a picked Skill; the SnagImmunity rule reads both; off is free', async () => {
    const traveler = makeActor('Traveler', FILES.timeTraveler, { system: { skills: { technology: {}, culture: {} } } });
    scene(traveler);
    const item = itemNamed(traveler, 'Time Traveler');
    const { ruleSnagImmune } = await import('./plugins/rolls/snag-immunity.mjs');
    dialogAnswers('technology');
    await runUse(item, pay, { pick: async (it, available) => available[0] });
    expect(item.flags.essence20.rules.choices.skill).toBe('technology');
    expect(ruleSnagImmune(traveler, { rolledSkill: 'technology' })).toBe(true);
    expect(ruleSnagImmune(traveler, { rolledSkill: 'culture' })).toBe(false);
    expect(item.system.rules[0].cost).toEqual({ resource: { storyPoints: true }, amount: 1 });
    await runUse(item, pay, { pick: async (it, available) => available[0] });
    expect(ruleSnagImmune(traveler, { rolledSkill: 'technology' })).toBe(false);
  });
});

describe('Entropic Sponge: Personal Power for Initiative, round 1', () => {
  test('+2 to its own Initiative and -2 to that many enemies (in token order) per point spent', async () => {
    const sponge = makeActor('Sponge', FILES.entropicSponge);
    const a = makeActor('A', [], { x: 10, disposition: -1 });
    const b = makeActor('B', [], { x: 20, disposition: -1 });
    const c = makeActor('C', [], { x: 30, disposition: -1 });
    scene(sponge, a, b, c);
    const combatants = [sponge, a, b, c].map((actor, i) => ({
      actor, actorId: actor.id, initiative: actor === c ? null : 10 + i,
      async update(data) {
        Object.assign(this, data);
      },
    }));
    global.game.combat = { id: 'c1', started: true, round: 1, turn: 0, turns: combatants, combatants: { contents: combatants } };
    nearby.tokens = [a.token, b.token, c.token];
    const item = itemNamed(sponge, 'Entropic Sponge');
    expect(useAvailable(item, item.system.rules[0], 0)).toBe(true);
    const askNumber = jest.fn(async (step, min, max) => {
      expect([min, max]).toEqual([1, 2]);
      return 1;
    });
    const { runSteps, stepContext } = await import('./steps.mjs');
    const ctx = stepContext({ actor: sponge, item, rule: item.system.rules[0], askNumber });
    expect(await runSteps(item.system.rules[0].steps, ctx)).toBe(true);
    expect(sponge.system.powers.personal.value).toBe(2);
    expect(combatants.map(combatant => combatant.initiative)).toEqual([12, 9, 12, null]);
    global.game.combat.round = 2;
    expect(useAvailable(item, item.system.rules[0], 0)).toBe(false);
  });
});

describe('Bumper Crop', () => {
  test('DIF 10 Intimidation: a Snag on the first 1 + (margin / 5) enemies within 30 ft', async () => {
    const farmer = makeActor('Farmer', FILES.bumperCrop);
    const foes = [1, 2, 3, 4].map(i => makeActor(`Foe${i}`, [], { x: i * 5, disposition: -1 }));
    scene(farmer, ...foes);
    nearby.tokens = foes.map(foe => foe.token);
    const roll = rollsAs(farmer, { total: 21 });
    await runUse(itemNamed(farmer, 'Bumper Crop'), pay);
    expect(roll).toHaveBeenCalledWith(expect.objectContaining({ skill: 'intimidation', dif: '10' }), farmer);
    expect(foes.map(foe => bankedEntries(foe).length)).toEqual([1, 1, 1, 0]);
    expect(bankedEntries(foes[0])).toEqual([expect.objectContaining({ snag: true, until: 'combat' })]);
  });
});

describe('Ageless Knowledge', () => {
  test("a Power and a picked Skill; that Skill's next d2 roll starts at d4 instead, using it up", async () => {
    const ranger = makeActor('Ranger', FILES.agelessKnowledge, { system: { skills: { science: { shift: 'd2' }, culture: { shift: 'd2' } } } });
    scene(ranger);
    global.CONFIG.E20.skillShiftList = ['3d6', '2d8', 'd12', 'd10', 'd8', 'd6', 'd4', 'd2', 'd20'];
    dialogAnswers('science');
    await runUse(itemNamed(ranger, 'Ageless Knowledge'), pay);
    expect(ranger.system.powers.personal.value).toBe(2);
    expect(ranger.flags.essence20.ruleMarks.agelessKnowledge).toEqual(expect.objectContaining({ until: 'combat' }));
    const { ruleDieSubstitution } = await import('./adapter.mjs');
    expect(ruleDieSubstitution(ranger, null, { rolledSkill: 'culture' }, 'd2').shift).toBe('d2');
    expect(ruleDieSubstitution(ranger, null, { rolledSkill: 'science' }, 'd20').shift).toBe('d20');
    const result = ruleDieSubstitution(ranger, null, { rolledSkill: 'science' }, 'd2');
    expect(result.shift).toBe('d4');
    await result.spend();
    expect(ranger.flags.essence20.ruleMarks.agelessKnowledge).toBeUndefined();
  });
});

describe('Weapon Conversion', () => {
  test('a two-handed ranged weapon becomes one-handed: half range, a downshift, and its weapon gains Inaccurate', async () => {
    const raider = makeActor('Raider', FILES.weaponConversion);
    scene(raider);
    const item = itemNamed(raider, 'Weapon Conversion');
    const [use] = item.system.rules;
    expect(useAvailable(item, use, 0)).toBe(false);
    const weapon = addItem(raider, { name: 'Rifle', type: 'weapon', system: { traits: ['loud'] } });
    const effect = addItem(raider, {
      name: 'Rifle Shot', type: 'weaponEffect', flags: { essence20: { parentId: weapon.id } },
      system: { numHands: 2, shiftDown: 0, range: { value: 50, long: 101 }, classification: { style: 'ranged' } },
    });
    expect(useAvailable(item, use, 0)).toBe(true);
    await runUse(item, pay);
    expect(effect.system).toEqual(expect.objectContaining({ numHands: 1, shiftDown: 1, range: { value: 25, long: 50 } }));
    expect(weapon.system.traits).toEqual(['loud', 'inaccurate']);
    expect(useAvailable(item, use, 0)).toBe(false);
  });
});

describe('Matured', () => {
  test('one ignored Hang-Up at a time: the flag moves, and the lone Active Effect switches off and back on', async () => {
    const elder = makeActor('Elder', FILES.matured);
    scene(elder);
    const item = itemNamed(elder, 'Matured');
    expect(useAvailable(item, item.system.rules[0], 0)).toBe(false);
    const effectOf = () => ({ disabled: false, async update(data) {
      Object.assign(this, data);
    } });
    const first = addItem(elder, { name: 'Vain', type: 'hangUp', effects: { contents: [effectOf()] } });
    const second = addItem(elder, { name: 'Grudge', type: 'hangUp', effects: { contents: [effectOf()] } });
    expect(useAvailable(item, item.system.rules[0], 0)).toBe(true);
    dialogAnswers(first.id, second.id);
    await runUse(item, pay);
    expect(first.flags.essence20.maturedIgnored).toBe(true);
    expect(first.effects.contents[0].disabled).toBe(true);
    await runUse(item, pay);
    expect(first.flags.essence20.maturedIgnored).toBeUndefined();
    expect(first.effects.contents[0].disabled).toBe(false);
    expect(second.flags.essence20.maturedIgnored).toBe(true);
    expect(second.effects.contents[0].disabled).toBe(true);
  });
});

describe('The Quiet One', () => {
  test("offered while an ally made noise this round; then an Edge on Infiltration until the turn's end", async () => {
    const sneak = makeActor('Sneak', FILES.quietOne);
    const ally = makeActor('Ally', [], { x: 10 });
    const enemy = makeActor('Enemy', [], { x: 20, disposition: -1 });
    scene(sneak, ally, enemy);
    const combatants = [sneak, ally, enemy].map(actor => ({ actor, actorId: actor.id }));
    global.game.combat = { id: 'c1', started: true, round: 2, turn: 0, turns: combatants, combatants: { contents: combatants } };
    const item = itemNamed(sneak, 'The Quiet One');
    const [use] = item.system.rules;
    expect(useAvailable(item, use, 0)).toBe(false);
    enemy.flags.essence20.quietOneNoisyActionThisRound = { combatId: 'c1', round: 2 };
    expect(useAvailable(item, use, 0)).toBe(false);
    ally.flags.essence20.quietOneNoisyActionThisRound = { combatId: 'c1', round: 1 };
    expect(useAvailable(item, use, 0)).toBe(false);
    ally.flags.essence20.quietOneNoisyActionThisRound = { combatId: 'c1', round: 2 };
    expect(useAvailable(item, use, 0)).toBe(true);
    await runUse(item, pay);
    expect(sneak.flags.essence20.ruleMarks.quietOne).toEqual(expect.objectContaining({ until: 'endOfTurn' }));
    const { ruleRollSources } = await import('./adapter.mjs');
    expect(ruleRollSources(sneak, null, { rolledSkill: 'infiltration' }).sources).toEqual([expect.objectContaining({ edge: true })]);
    expect(ruleRollSources(sneak, null, { rolledSkill: 'athletics' }).sources).toEqual([]);
  });
});

describe('Work the Numbers', () => {
  function initiativeCombat(...actors) {
    const combatants = actors.map((actor, i) => ({
      actor, actorId: actor.id, initiative: 30 - i * 10,
      async update(data) {
        Object.assign(this, data);
      },
    }));
    global.game.combat = { id: 'c1', started: true, round: 2, turn: 0, turns: combatants, combatants: { contents: combatants } };
    return combatants;
  }

  test('1 Energon from round 2: the target moves one place up or down the Initiative order', async () => {
    const scout = makeActor('Scout', FILES.workTheNumbers);
    const a = makeActor('A', [], { x: 10, disposition: -1 });
    const b = makeActor('B', [], { x: 20, disposition: -1 });
    scene(scout, a, b);
    const combatants = initiativeCombat(scout, a, b);
    const item = itemNamed(scout, 'Work the Numbers');
    global.game.combat.round = 1;
    expect(useAvailable(item, item.system.rules[0], 0)).toBe(false);
    global.game.combat.round = 2;
    expect(useAvailable(item, item.system.rules[0], 0)).toBe(true);
    target(a);
    await runUse(item, pay, { ask: askFor('Up') });
    expect(combatants[1].initiative).toBeCloseTo(30.01);
    expect(scout.system.energon.normal.value).toBe(0);
  });

  test('down: just below the next one; with no one that way it stops before the Energon is spent', async () => {
    const scout = makeActor('Scout', FILES.workTheNumbers);
    const a = makeActor('A', [], { x: 10, disposition: -1 });
    const b = makeActor('B', [], { x: 20, disposition: -1 });
    scene(scout, a, b);
    const combatants = initiativeCombat(scout, a, b);
    target(a);
    await runUse(itemNamed(scout, 'Work the Numbers'), pay, { ask: askFor('Down') });
    expect(combatants[1].initiative).toBeCloseTo(9.99);
    scout.system.energon.normal.value = 1;
    // A is now last in the order.
    target(a);
    combatants.sort((x, y) => y.initiative - x.initiative);
    global.game.combat.turns = combatants;
    await runUse(itemNamed(scout, 'Work the Numbers'), pay, { ask: askFor('Down') });
    expect(scout.system.energon.normal.value).toBe(1);
  });
});

describe('Outwit', () => {
  test('Deception against Cleverness Stuns; Intimidation against Willpower Frightens', async () => {
    const psych = makeActor('Psych', FILES.outwit);
    const foe = makeActor('Foe', [], { x: 10, disposition: -1 });
    scene(psych, foe);
    target(foe);
    await runUse(itemNamed(psych, 'Outwit'), pay, { ask: askFor('Deception') });
    expect(rollVsMany).toHaveBeenLastCalledWith(psych, 'deception', [foe], 'cleverness', 'social', { isOutwit: true });
    expect(applyTimedCondition).toHaveBeenLastCalledWith(foe, 'stunned', expect.anything());
    await runUse(itemNamed(psych, 'Outwit'), pay, { ask: askFor('Intimidation') });
    expect(rollVsMany).toHaveBeenLastCalledWith(psych, 'intimidation', [foe], 'willpower', 'social', { isOutwit: true });
  });
});

describe('Mark Target', () => {
  test("a per-Scout scene mark; one at a time, five with Additional Marks; the roll reader sees it", async () => {
    const scout = makeActor('Scout', FILES.markTarget);
    const others = [1, 2, 3, 4, 5, 6].map(i => makeActor(`T${i}`, [], { x: i * 10, disposition: -1 }));
    scene(scout, ...others);
    const { checkMarkTarget } = await import('../items/rolls/mark-target.mjs');
    const item = itemNamed(scout, 'Mark Target');
    const key = `markTarget--${scout.id}`;
    target(others[0]);
    await runUse(item, pay);
    expect(others[0].flags.essence20.ruleMarks[key]).toEqual(expect.objectContaining({ by: scout.uuid, until: 'scene' }));
    expect(checkMarkTarget(scout, others[0])).toBe(true);
    target(others[1]);
    await runUse(item, pay);
    expect(others[0].flags.essence20.ruleMarks?.[key]).toBeUndefined();
    expect(checkMarkTarget(scout, others[1])).toBe(true);

    addItem(scout, { name: 'Additional Marks', type: 'perk', flags: { core: { sourceId: 'Compendium.essence20.tf_crb.Item.sapOdu2VHIJLeZdE' } }, system: {} });
    for (const other of others.slice(2)) {
      target(other);
      await runUse(item, pay);
    }

    expect(others.map(other => checkMarkTarget(scout, other))).toEqual([false, true, true, true, true, true]);
  });
});

describe('Hup! Hup! Hup! Hup! Hup!', () => {
  test('an Intimidation total of 5+ gives every ally +5 ft of ground movement per 5, through the next round', async () => {
    const sarge = makeActor('Sarge', FILES.hup);
    const ally = makeActor('Ally', [], { x: 10 });
    const enemy = makeActor('Enemy', [], { x: 10, disposition: -1 });
    scene(sarge, ally, enemy);
    global.game.combat = { id: 'c1', started: true, round: 3, turn: 0, turns: [], combatants: { contents: [] } };
    rollsAs(sarge, { total: 12 });
    await runUse(itemNamed(sarge, 'Hup! Hup! Hup! Hup! Hup!'), pay);
    expect(ally.flags.essence20.ruleMarks.hupHup).toEqual(expect.objectContaining({ count: 10, until: 'throughNextRound' }));
    expect(enemy.flags.essence20.ruleMarks?.hupHup).toBeUndefined();
    expect(ruleMovementStages(ally)('final', 'ground', 30)).toBe(40);
    global.game.combat.round = 5;
    expect(ruleMovementStages(ally)('final', 'ground', 30)).toBe(null);
  });

  test('under 5, nothing', async () => {
    const sarge = makeActor('Sarge', FILES.hup);
    const ally = makeActor('Ally', [], { x: 10 });
    scene(sarge, ally);
    rollsAs(sarge, { total: 4 });
    await runUse(itemNamed(sarge, 'Hup! Hup! Hup! Hup! Hup!'), pay);
    expect(ally.flags.essence20.ruleMarks?.hupHup).toBeUndefined();
  });
});

describe('Distracting Offer', () => {
  test('the Origin Skill against Cleverness: a hit banks a downshift and marks the target for the map scene; a miss locks it', async () => {
    const crook = makeActor('Crook', FILES.distractingOffer, { system: { originSkillsIncrease: 'deception' } });
    const mark = makeActor('Mark', [], { x: 10, disposition: -1 });
    const other = makeActor('Other', [], { x: 10, disposition: -1 });
    scene(crook, mark, other);
    global.game.scenes = { current: { id: 'map1' } };
    const item = itemNamed(crook, 'Distracting Offer');
    target(mark);
    await runUse(item, pay);
    expect(rollVsMany).toHaveBeenLastCalledWith(crook, 'deception', [mark], 'cleverness');
    expect(bankedEntries(mark)).toEqual([expect.objectContaining({ shiftDown: 1, until: 'combat' })]);
    // Only the creature it already worked on, this scene.
    target(other);
    await runUse(item, pay);
    expect(rollVsMany).toHaveBeenCalledTimes(1);
    rolls.rows = others => others.map(o => ({ targetUuid: o.uuid, success: true, multiplier: 2 }));
    target(mark);
    await runUse(item, pay);
    expect(bankedEntries(mark).map(entry => entry.shiftDown)).toEqual([1, 2]);
    rolls.rows = others => others.map(o => ({ targetUuid: o.uuid, success: false, multiplier: 0 }));
    await runUse(item, pay);
    expect(useAvailable(item, item.system.rules[0], 0)).toBe(false);
    global.game.scenes.current = { id: 'map2' };
    expect(useAvailable(item, item.system.rules[0], 0)).toBe(true);
  });
});

describe('Omega Enhancement (Form)', () => {
  test('1 Personal Power per mode: the attack modes roll Targeting with their damage; the self modes switch on until the turn ends', async () => {
    const ranger = makeActor('Ranger', FILES.omegaEnhancement);
    const foe = makeActor('Foe', [], { x: 10, disposition: -1 });
    scene(ranger, foe);
    target(foe);
    const item = itemNamed(ranger, 'Omega Enhancement (Form)');
    await runUse(item, pay, { ask: askFor('Electro') });
    expect(rollVsMany).toHaveBeenLastCalledWith(ranger, 'targeting', [foe], 'evasion', null, { stepDamage: { value: 1, type: 'electric' }, omegaEnhancementMode: 'electro' });
    await runUse(item, pay, { ask: askFor('Light Beam') });
    expect(applyTimedCondition).toHaveBeenLastCalledWith(foe, 'blinded', expect.anything());
    expect(ranger.system.powers.personal.value).toBe(1);
    await runUse(item, pay, { ask: askFor('Power') });
    const { ruleRollSources } = await import('./adapter.mjs');
    expect(ruleRollSources(ranger, null, { rolledSkill: 'might' }).sources).toEqual([expect.objectContaining({ edge: true })]);
    expect(ranger.system.powers.personal.value).toBe(0);
  });
});

describe('Dig Deep', () => {
  test('once per scene: the next damage is 1 lower, and a Snag on Skill Tests through the end of the next turn', async () => {
    const tough = makeActor('Tough', FILES.digDeep);
    const other = makeActor('Other', [], { x: 10 });
    scene(tough, other);
    const turns = [other, tough].map(actor => ({ actor, actorId: actor.id }));
    global.game.combat = { id: 'c1', started: true, round: 2, turn: 0, turns, combatants: { contents: turns } };
    global.game.combats = { get: id => (id == 'c1' ? global.game.combat : null) };
    const item = itemNamed(tough, 'Dig Deep');
    await runUse(item, pay);
    expect(useAvailable(item, item.system.rules[0], 0)).toBe(false);
    // The same one-shot reduction as the PR CRB printing's (mark digDeep, used up by a DamageReduction).
    const { damageReduction } = await import('./plugins/combat/damage-reduction.mjs');
    expect(await damageReduction(tough, 0, 'fire')).toBe(0);
    expect(await damageReduction(tough, 5, 'sharp')).toBe(4);
    expect(await damageReduction(tough, 5, 'sharp')).toBe(5);
    const { ruleRollSources } = await import('./adapter.mjs');
    const snags = () => ruleRollSources(tough, null, { rolledSkill: 'athletics' });
    expect(snags().sources).toEqual([expect.objectContaining({ snag: true })]);
    expect(snags().consumes).toEqual([]);
    // Its next turn is this round (turn 1); the turn after it ends the Snag.
    global.game.combat.turn = 1;
    expect(snags().sources).toHaveLength(1);
    global.game.combat.round = 3;
    global.game.combat.turn = 0;
    expect(snags().sources).toEqual([]);
  });

  test('out of combat the Snag is spent by the next Skill Test; the Transformers printing is once per combat', async () => {
    const tough = makeActor('Tough', FILES.digDeepGij);
    scene(tough);
    const [gij] = tough.items.contents;
    const tf = fromPack(FILES.digDeepTf);
    await runUse(gij, pay);
    expect(tough.flags.essence20.ruleMarks.digDeepSnagOnce).toBeDefined();
    const { ruleRollSources } = await import('./adapter.mjs');
    expect(ruleRollSources(tough, null, { rolledSkill: 'athletics' }).consumes).toEqual([expect.objectContaining({ ext: 'rulesMark', key: 'digDeepSnagOnce' })]);
    expect(tf.system.rules[0].limit).toEqual({ per: 'encounter' });
    expect(fromPack(FILES.digDeepMlp).system.rules).toEqual(gij.system.rules);
  });
});

describe('Smashmouth Offense', () => {
  test('a Story Point, once per combat: +1 damage on the next damaging hit only, kept through misses', async () => {
    const brawler = makeActor('Brawler', FILES.smashmouth);
    const foe = makeActor('Foe', [], { x: 5, disposition: -1 });
    scene(brawler, foe);
    const item = itemNamed(brawler, 'Smashmouth Offense');
    const [use] = item.system.rules;
    expect(use.cost).toEqual({ resource: { storyPoints: true }, amount: 1 });
    expect(use.limit).toEqual({ per: 'encounter' });
    // Spend the cost as runUse's resource payer would; the mark is what the rule leaves.
    const { runSteps, stepContext } = await import('./steps.mjs');
    await runSteps(use.steps, stepContext({ actor: brawler, item, rule: use, targets: [] }));
    expect(brawler.flags.essence20.ruleMarks.smashmouth).toBeDefined();
    const { hitRiderOnAttack } = await import('./plugins/combat/hit-rider.mjs');
    const tools = () => ({ damageBonusNote: (result, amount) => {
      result.damageValue += amount;
    } });
    // A hit with no damage (or none at all) reads no rule and keeps the mark.
    const blank = { damageValue: 0 };
    await hitRiderOnAttack(brawler, foe, blank, {}, tools());
    expect(blank.damageValue).toBe(0);
    expect(brawler.flags.essence20.ruleMarks.smashmouth).toBeDefined();
    const first = { damageValue: 2 };
    await hitRiderOnAttack(brawler, foe, first, {}, tools());
    expect(first.damageValue).toBe(3);
    expect(brawler.flags.essence20.ruleMarks.smashmouth).toBeUndefined();
    const second = { damageValue: 2 };
    await hitRiderOnAttack(brawler, foe, second, {}, tools());
    expect(second.damageValue).toBe(2);
  });
});

// Stand Behind Me!'s Use, taunt card and attack block: module/rules/conv18-convA.test.js.

describe('Grid Surge', () => {
  test('Temporary Construct: Edge on the next roll of a picked Skill, a newer one replacing it', async () => {
    const ranger = makeActor('Ranger', FILES.gridSurge, { system: { skills: { alertness: {}, athletics: {} } } });
    scene(ranger);
    const surges = addItem(ranger, { name: 'Grid Surges', type: 'rolePoints', system: { resource: { value: 9 } } });
    const item = itemNamed(ranger, 'Grid Surge');
    expect(item.system.rules[0].cost).toEqual({ resource: { rolePoints: true }, amount: 1 });
    dialogAnswers('alertness', 'athletics');
    await runUse(item, pay, { ask: askFor('Temporary') });
    expect(bankedEntries(ranger)).toEqual([expect.objectContaining({ edge: true, when: ['skill:alertness'], key: 'construct' })]);
    await runUse(item, pay, { ask: askFor('Temporary') });
    expect(bankedEntries(ranger)).toEqual([expect.objectContaining({ edge: true, when: ['skill:athletics'] })]);
    expect(surges.system.resource.value).toBe(7);
  });

  test('Toughness Boost: +1 Toughness against the next attack while Morphed, stacking to +3, beside a Construct', async () => {
    const ranger = makeActor('Ranger', FILES.gridSurge, { system: { skills: { alertness: {} } } });
    scene(ranger);
    const surges = addItem(ranger, { name: 'Grid Surges', type: 'rolePoints', system: { resource: { value: 9 } } });
    const item = itemNamed(ranger, 'Grid Surge');
    dialogAnswers('alertness');
    await runUse(item, pay, { ask: askFor('Temporary') });
    for (let i = 0; i < 4; i++) {
      await runUse(item, pay, { ask: askFor('Toughness') });
    }

    expect(bankedEntries(ranger).map(entry => entry.key)).toEqual(['construct', 'toughness']);
    expect(await bankedDefense(ranger, 'toughness')).toBe(0);
    ranger.system.isMorphed = true;
    expect(await bankedDefense(ranger, 'evasion')).toBe(0);
    expect(await bankedDefense(ranger, 'toughness')).toBe(3);
    expect(await bankedDefense(ranger, 'toughness')).toBe(0);
    expect(surges.system.resource.value).toBe(4);
  });

  test('Reshape spends the use and banks nothing', async () => {
    const ranger = makeActor('Ranger', FILES.gridSurge);
    scene(ranger);
    const surges = addItem(ranger, { name: 'Grid Surges', type: 'rolePoints', system: { resource: { value: 9 } } });
    const paid = jest.fn(async () => true);
    await runUse(itemNamed(ranger, 'Grid Surge'), paid, { ask: askFor('Reshape') });
    expect(bankedEntries(ranger)).toEqual([]);
    expect(surges.system.resource.value).toBe(8);
  });
});

describe('Mysterious Aura', () => {
  test('1 Personal Power: the picked aura (and, for Protective, its Defense) goes in the flag the aura readers use', async () => {
    const ranger = makeActor('Ranger', FILES.mysteriousAura, { system: { isMorphed: true } });
    scene(ranger);
    const item = itemNamed(ranger, 'Mysterious Aura');
    dialogAnswers('evasion');
    await runUse(item, pay, { ask: askFor('Protective') });
    expect(ranger.system.powers.personal.value).toBe(2);
    expect(ranger.flags.essence20.mysteriousAuraActive).toEqual({ type: 'protective', defenseChoice: 'evasion' });
    const { getMysteriousAuraProtectiveBonus } = await import('../items/defenses/mysterious-aura.mjs');
    expect(getMysteriousAuraProtectiveBonus(ranger, 'evasion')).toBe(2);
    await runUse(item, pay, { ask: askFor('Imposing') });
    expect(ranger.flags.essence20.mysteriousAuraActive.type).toBe('imposing');
    expect(getMysteriousAuraProtectiveBonus(ranger, 'evasion')).toBe(0);
    ranger.system.powers.personal.value = 0;
    expect(useAvailable(item, item.system.rules[0], 0)).toBe(false);
  });
});
