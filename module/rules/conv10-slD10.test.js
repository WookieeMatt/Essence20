import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * slD10: the round-10 group D conversions. Each item is loaded from its pack source and must do what the removed code
 * did: Ruthless Points (Play Favorites x2, This, I Command's half, Ruthless Efficiency), Think Fast!, the roll-card offers
 * (Best-Laid Plans, One Last Chance, Sorcerous Support, Do Or Die, Nemesis, Destiny), Quantum Trigger, Savant Skill, the
 * spell-cost options, the Initiative Perks, Whisper Campaign, the smoke items, the team grants and the rest.
 */

const hooks = {};
global.Hooks = { on: (name, fn) => (hooks[name] = [...(hooks[name] ?? []), fn]), once: () => {}, callAll: () => {} };

const applyDamage = jest.fn(async () => {});
jest.unstable_mockModule('./mechanics/combat/combat.mjs', () => ({
  applyDamage, computeMultiplier: (total, dif) => (!dif || total < dif ? 0 : 1 + Math.floor((total - dif) / 5)),
  buildCheckChatData: async (roll, data) => ({ rolls: [roll], speaker: data.speaker, flags: { essence20: { canCritD2: data.canCritD2, ...data.rollContext } }, flavor: data.flavor }),
}));
const economySpend = jest.fn(async () => ({}));
jest.unstable_mockModule('./mechanics/actions/action-economy.mjs', () => ({
  spend: economySpend, isTracking: () => true, grantActionsThisTurn: jest.fn(async () => {}),
}));

const applyReroll = jest.fn(async () => true);
jest.unstable_mockModule('./mechanics/rolls/reroll.mjs', () => ({ applyReroll, normalizeRerollConfig: config => config }));
const storyApi = { getGmPoints: jest.fn(() => 2), requestStoryPointSpend: jest.fn(async () => true) };
jest.unstable_mockModule('./mechanics/resources/story-points.mjs', () => storyApi);
const pickCanvasPoint = jest.fn(async () => null);
jest.unstable_mockModule('./mechanics/combat/forced-movement.mjs', () => ({
  pickCanvasPoint, IMMOVABLE_OBJECT_ID: 'x', resistsForcedMovement: async () => false, pushDestination: () => null, pushActor: async () => {},
  placeActorAt: async () => {}, distanceFeet: () => 0, slowNextTurn: async () => {}, movementPenaltyFor: () => 0,
}));
const explodeVehicle = jest.fn(async () => {});
jest.unstable_mockModule('./mechanics/vehicles/vehicle-defeat.mjs', () => ({ explodeVehicle, crashVehicle: jest.fn(), handleVehicleZeroHealthTransition: jest.fn() }));
const applyTimedCondition = jest.fn(async () => {});
jest.unstable_mockModule('./mechanics/combat/timed-status.mjs', () => ({ applyTimedCondition }));

await import('./plugins/index.mjs');
const { rebuildIndex } = await import('./index.mjs');
const { validateRule } = await import('./types.mjs');
const { fireTriggers, runUse } = await import('./triggers.mjs');
const { setStoryPointHelpers } = await import('./steps.mjs');
const story = await import('./plugins/resources/personal-story-points.mjs');
const cards = await import('./plugins/cards/card-offer.mjs');
const misc = {
  ...(await import('./plugins/combat/spend-actions-and-turn-queue.mjs')), ...(await import('./plugins/rolls/retry-and-recast.mjs')),
  ...(await import('./plugins/rolls/bonus-dice-bank.mjs')), ...(await import('./plugins/tags/team-combatants.mjs')),
  ...(await import('./plugins/effects/hardpoint-use.mjs')), ...(await import('./plugins/combat/stance-switch.mjs')),
};
const { pressRuleButton } = await import('./buttons.mjs');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));

const FILES = {
  playFavorites: 'ccitems/_source/Play_Favorites_5HimuCoEpjYRiOSV.json',
  playFavoritesAgainst: 'ccitems/_source/Play_Favorites_Against_Each_Other_f6hlQSJhLCTSAILh.json',
  thisICommand: 'ccitems/_source/This__I_Command_SUc3emTvPnwB6W93.json',
  ruthlessEfficiency: 'ccitems/_source/Ruthless_Efficiency_KQWE1o3PjguwjAD0.json',
  thinkFast: 'jttitems/_source/Think_Fast__Sjx8BBENyDUTRJvs.json',
  bestLaidPlans: 'dditems/_source/Best_Laid_Plans_qsISoMxGSAu6D2m2.json',
  oneLastChance: 'dditems/_source/One_Last_Chance_7SU3UY5WzOnlOsHM.json',
  sorcerousSupport: 'kocitems/_source/Sorcerous_Support_PhK5KSV4IXpOcTYP.json',
  doOrDie: 'ghpfitems/_source/Do_Or_Die_4NG56r746V7BLt8W.json',
  nemesis: 'atsitems/_source/Nemesis__Specific_Threat__bxGgq6PpfxeSRr7Q.json',
  destiny: 'atsitems/_source/Destiny_PRf5WTMgof11YCeE.json',
  quantumTrigger: 'jttitems/_source/Quantum_Trigger_QuantumTriggerJT.json',
  savantSkill: 'jttitems/_source/Savant_Skill_ZnuLgh6jdUHi9F75.json',
  prospector: 'jttitems/_source/Prospector_Toolkit_anD2xly3g2CS45et.json',
  dangerSenseAts: 'atsitems/_source/Danger_Sense_lwzD2ZvCLLf8PGRF.json',
  illusionCasting: 'kocitems/_source/Illusion_Casting_UadqOmn6aZKAvXT1.json',
  reachOut: 'kocitems/_source/Reach_Out_gu2V2C4aH0fsDYXN.json',
  brilliantSight: 'kocitems/_source/Brilliant_Sight_Oc8NpQa5ylK2Ix0B.json',
  extraEffective: 'mlpcrbitems/_source/Extra_Effective_Spell_NOkMsAryMwYPDzNh.json',
  longLasting: 'mlpcrbitems/_source/Long_Lasting_Spell_TJEbR90lLJYSF51p.json',
  mysticalUnderstanding: 'mlpcrbitems/_source/Mystical_Understanding_23NeoRDRxlo0LpyQ.json',
  sharpcaster: 'kocitems/_source/Sharpcaster_Cnv01qtQwEdrUh8I.json',
  reactionary: 'mlpcrbitems/_source/Reactionary_b4rCpGE6aJuxvoB5.json',
  smokeBomb: 'kocitems/_source/Smoke_Bomb_L5KOGeqX43EdO3b3.json',
  smokeScreen: 'mlpcrbitems/_source/Smoke_Screen_Sm0keScr33nD22aB.json',
  dangerSenseGij: 'gijcrbitems/_source/Danger_Sense_2hwFRZ67xIGt1XTm.json',
  timelineAnomaly: 'wtnvcgitems/_source/Timeline_Anomaly_NQXcQL05DLCs75xb.json',
  sharksFin: 'qgtgitems/_source/Shark_s_Fin_c3tBbGzXDar3DA1E.json',
  followMe: 'prcrbitems/_source/Follow_Me__ALq37Ch25nKvZ454.json',
  preciseChronometrics: 'eocitems/_source/Precise_Chronometrics_Q6G07IGoYXAcoRzF.json',
  whisperCampaign: 'tfcrbitems/_source/Whisper_Campaign_RO7n3LJmKQkcwZg1.json',
  irrefutableOrder: 'tfcrbitems/_source/Irrefutable_Order_fz3s9ay6oOPujwTh.json',
  targetBreakdown: 'tfcrbitems/_source/Target_Breakdown_aLdjHmWG171RCSpA.json',
  waterCannon: 'tfcrbitems/_source/Water_Cannon_FUOOqATSqU6habEt.json',
  allOutAttackTf: 'tfcrbitems/_source/All_Out_Attack_OCQ8ZuC793JHQ4YU.json',
  evasiveFightingTf: 'tfcrbitems/_source/Evasive_Fighting_fQJF7zvHjd39qw99.json',
  togetherWeStand: 'eocitems/_source/Together_We_Stand_oj7vUwpB9EW8stUG.json',
  soundOfAngels: 'qgtgitems/_source/The_Sound_of_Angels_rraj81QR8KEg6nfC.json',
  allForOne: 'prcrbitems/_source/All_For_One_Q5YDt0r21QDmBuDC.json',
  frequencyInterference: 'ghpfitems/_source/Frequency_Interference_HLVof9JCEdRTt2zU.json',
  overload: 'ccitems/_source/Overload_DCgAR3QpfjUspsGU.json',
  geneticSupport: 'ccitems/_source/Genetic_Support_qOQprOVxN5tTwas0.json',
  alterationEmulator: 'ccitems/_source/Advanced_Alteration_Emulator_OVwVXnhWH4QVeVFN.json',
  destructiveOvercharge: 'qgtgitems/_source/Destructive_Overcharge_RpNG4KelUPWm54xv.json',
  cascadingFailure: 'qgtgitems/_source/Cascading_Failure_plJkKBuGrkxIYCnS.json',
  restrainingGear: 'ttsgitems/_source/Restraining_Gear_rc6QWxHf76p5snE0.json',
};

/** foundry.utils.setProperty, for plain objects. */
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
  return {
    id: `i${nextId++}`, flags: {}, system: {}, parent: actor, isOwner: true, ...data,
    async update(changes) {
      for (const [key, value] of Object.entries(changes)) {
        setPath(this, key, value);
      }
    },
  };
}

/** An actor holding the pack items `files` and any extra item data, with a token at x (feet) and disposition. */
function makeActor(name, files = [], { system = {}, extra = [], type = 'playerCharacter', x = 0, disposition = 1 } = {}) {
  const items = [];
  const actor = {
    id: `a${nextId++}`, name, type, isOwner: true, flags: { essence20: {} }, statuses: new Set(),
    system: {
      level: 12, health: { value: 10, max: 10 }, powers: { personal: { value: 3, max: 6 } }, skills: {},
      energon: { normal: { value: 1, max: 4 } }, movement: { ground: { total: 30 } },
      essences: { strength: { value: 4, max: 4 }, speed: { value: 4, max: 4 }, smarts: { value: 4, max: 4 }, social: { value: 4, max: 4 } },
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
  };
  actor.uuid = `Actor.${actor.id}`;
  for (const file of [files].flat()) {
    const doc = fromPack(file);
    items.push(makeItem(actor, { name: doc.name, type: doc.type, system: clone(doc.system) }));
  }

  for (const data of extra) {
    items.push(makeItem(actor, data));
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

const itemNamed = (actor, name) => actor.items.contents.find(item => item.name == name);

let docs = new Map();

function scene(...actors) {
  docs = new Map(actors.map(actor => [actor.uuid, actor]));
  for (const actor of actors) {
    for (const item of actor.items.contents) {
      item.uuid = `${actor.uuid}.Item.${item.id}`;
      docs.set(item.uuid, item);
    }
  }

  global.fromUuidSync = uuid => docs.get(uuid) ?? null;
  global.fromUuid = async uuid => docs.get(uuid) ?? null;
  global.game.actors = { get: id => actors.find(actor => actor.id == id) ?? null, contents: actors, [Symbol.iterator]: () => actors[Symbol.iterator]() };
  global.canvas = { tokens: { placeables: actors.map(actor => actor.token), controlled: [], setTargets: jest.fn() }, grid: { size: 100, measurePath: ([a, b]) => ({ distance: Math.hypot(a.x - b.x, a.y - b.y) }) }, scene: { id: 'sc', tokens: [] } };
}

const target = (...actors) => {
  global.game.user.targets = new Set(actors.map(actor => actor.token));
};

const createCalls = () => global.ChatMessage.create.mock.calls.map(call => call[0]);
const allChat = () => createCalls().map(data => data?.content ?? '').join(' ');

const savedGame = global.game;
const savedConfig = global.CONFIG;
const savedFromUuid = global.fromUuid;
const savedFromUuidSync = global.fromUuidSync;

beforeEach(() => {
  applyDamage.mockClear();
  economySpend.mockClear();
  applyTimedCondition.mockClear();
  global.game = {
    combat: null, combats: { get: () => null }, user: { id: 'u', isGM: true, targets: new Set() }, users: { contents: [], activeGM: null },
    actors: { contents: [] }, settings: { get: () => 1 }, i18n: { localize: key => key, format: key => key, has: () => false },
  };
  global.ChatMessage = { create: jest.fn(async data => data), getSpeaker: () => ({}), getSpeakerActor: () => null };
  global.foundry = {
    ...global.foundry,
    utils: {
      ...(global.foundry?.utils ?? {}), setProperty: setPath, getProperty: getPath, randomID: () => `r${nextId++}`,
      hasProperty: (o, k) => getPath(o, k) !== undefined, escapeHTML: text => String(text), deepClone: clone,
    },
  };
});

afterEach(() => {
  jest.restoreAllMocks();
  global.canvas = undefined;
  global.game = savedGame;
  global.CONFIG = savedConfig;
  global.fromUuid = savedFromUuid;
  global.fromUuidSync = savedFromUuidSync;
  setStoryPointHelpers(null);
});

test('every slD10 rule validates', () => {
  for (const file of Object.values(FILES)) {
    for (const rule of fromPack(file).system.rules ?? []) {
      expect(validateRule(rule)).toEqual([]);
    }
  }
});

/* -------------------------------------------- */
/*  Ruthless Points                              */
/* -------------------------------------------- */

describe('Play Favorites: a Ruthless Point for yourself or the targeted ally', () => {
  const pay = jest.fn(async () => true);
  beforeEach(() => pay.mockClear());

  test('a Standard action gives the first target one point (yourself with no target)', async () => {
    const officer = makeActor('Officer', FILES.playFavorites);
    const ally = makeActor('Ally');
    scene(officer, ally);
    target(ally);
    const line = await runUse(itemNamed(officer, 'Play Favorites'), pay);
    expect(pay).toHaveBeenCalledWith('standard');
    expect(story.personalStoryPoints(ally)).toBe(1);
    expect(story.pointsOf(ally)[0].turnEndsLeft).toBe(1);
    expect(line).toContain('PersonalPointsGiven');
    target();
    await runUse(itemNamed(officer, 'Play Favorites'), pay);
    expect(story.personalStoryPoints(officer)).toBe(1);
    expect(applyDamage).not.toHaveBeenCalled();
  });

  test('This, I Command: 1 Psychic to the ally doubles it - only when asked, and never on yourself', async () => {
    const officer = makeActor('Officer', [FILES.playFavorites, FILES.thisICommand]);
    const ally = makeActor('Ally');
    scene(officer, ally);
    target(ally);
    const ask = jest.fn(async () => 0);
    await runUse(itemNamed(officer, 'Play Favorites'), pay, { ask });
    expect(ask).toHaveBeenCalledTimes(1);
    expect(applyDamage).toHaveBeenCalledWith(ally, 1, 'psychic');
    expect(story.personalStoryPoints(ally)).toBe(2);
    // "Just give 1".
    await runUse(itemNamed(officer, 'Play Favorites'), pay, { ask: async () => 1 });
    expect(story.personalStoryPoints(ally)).toBe(3);
    expect(applyDamage).toHaveBeenCalledTimes(1);
    // A cancelled choice costs nothing.
    pay.mockClear();
    expect(await runUse(itemNamed(officer, 'Play Favorites'), pay, { ask: async () => null })).toBeNull();
    expect(pay).not.toHaveBeenCalled();
    // No question when it's for yourself.
    target();
    const quiet = jest.fn(async () => 0);
    await runUse(itemNamed(officer, 'Play Favorites'), pay, { ask: quiet });
    expect(quiet).not.toHaveBeenCalled();
    expect(story.personalStoryPoints(officer)).toBe(1);
  });

  test('Play Favorites Against Each Other: a Move action, and one point shared by the first two targets', async () => {
    const officer = makeActor('Officer', [FILES.playFavorites, FILES.playFavoritesAgainst]);
    const a = makeActor('A');
    const b = makeActor('B');
    const c = makeActor('C');
    scene(officer, a, b, c);
    target(a, b, c);
    // Only the Move version is offered (on both items).
    await runUse(itemNamed(officer, 'Play Favorites'), pay, { ask: async () => 0 });
    expect(pay).toHaveBeenCalledWith('move');
    expect(story.personalStoryPoints(a)).toBe(1);
    expect(story.personalStoryPoints(b)).toBe(1);
    expect(story.personalStoryPoints(c)).toBe(0);
    expect(story.pointsOf(a)[0].shareId).toBe(story.pointsOf(b)[0].shareId);
    expect(await story.spendPersonalStoryPoint(a, 1, false)).toBe(true);
    expect(story.personalStoryPoints(b)).toBe(0);
    // "Give one to the first target".
    await runUse(itemNamed(officer, 'Play Favorites Against Each Other'), pay, { ask: async () => 1 });
    expect(story.personalStoryPoints(a)).toBe(1);
    expect(story.pointsOf(a)[0].shareId).toBeNull();
  });
});

describe('Ruthless Points last until the end of the holder\'s next turn', () => {
  test('points expire after their turn ends; Ruthless Efficiency starts its holder\'s next turn with one', async () => {
    const taskmaster = makeActor('Taskmaster', FILES.ruthlessEfficiency);
    const ally = makeActor('Ally');
    const foe = makeActor('Foe', [], { type: 'npc' });
    scene(taskmaster, ally, foe);
    ally.flags.essence20.personalPoints = [{ id: 'p', turnEndsLeft: 1 }, { id: 'q', turnEndsLeft: 2 }];
    expect(story.afterTurnEnd(ally.flags.essence20.personalPoints).kept.map(p => p.id)).toEqual(['q']);
    await story.personalPointsTurnEnd(ally);
    expect(story.pointsOf(ally).map(p => p.id)).toEqual(['q']);
    expect(taskmaster.flags.essence20.ruleMarks.ruthlessEfficiency).toBeTruthy();
    await fireTriggers(taskmaster, 'turnStart');
    expect(story.personalStoryPoints(taskmaster)).toBe(1);
    expect(story.pointsOf(taskmaster)[0].turnEndsLeft).toBe(2);
    expect(taskmaster.flags.essence20.ruleMarks.ruthlessEfficiency).toBeUndefined();
    await fireTriggers(taskmaster, 'turnStart');
    expect(story.personalStoryPoints(taskmaster)).toBe(1);
    // Another kind of actor ending its turn with a point doesn't count.
    foe.flags.essence20.personalPoints = [{ id: 'f', turnEndsLeft: 1 }];
    await story.personalPointsTurnEnd(foe);
    expect(taskmaster.flags.essence20.ruleMarks?.ruthlessEfficiency).toBeUndefined();
  });
});

describe('Think Fast!: a Story Point spent on equipment comes back on a 5 or 6', () => {
  test('the tracker\'s equipment spend rolls a d6', async () => {
    const inventor = makeActor('Inventor', FILES.thinkFast);
    scene(inventor);
    const requestStoryPointGrant = jest.fn(async () => {});
    setStoryPointHelpers({ canSpendForActor: () => true, spendForActor: jest.fn(), requestStoryPointGrant, poolFor: () => 'story', canWriteStoryPoints: () => true });
    jest.spyOn(Math, 'random').mockReturnValue(0.8);
    await story.onNarrativeSpend(inventor, 'equipment');
    expect(requestStoryPointGrant).toHaveBeenCalledWith(inventor, 1, { pool: 'story' });
    expect(allChat()).toContain('improvises');
    Math.random.mockReturnValue(0.5);
    await story.onNarrativeSpend(inventor, 'equipment');
    await story.onNarrativeSpend(inventor, 'other');
    expect(requestStoryPointGrant).toHaveBeenCalledTimes(1);
  });
});


/* -------------------------------------------- */
/*  Roll-card offers                             */
/* -------------------------------------------- */

/** A stand-in Roll: `totals` are what evaluate() gives, in order. */
function rollClass(...totals) {
  return class FakeRoll {
    constructor(formula) {
      this.formula = formula;
      this.dice = [];
    }

    static fromData(data) {
      const roll = new FakeRoll(data.formula);
      roll.total = data.total;
      return roll;
    }

    async evaluate() {
      this.total = totals.shift() ?? 1;
      return this;
    }

    toJSON() {
      return { formula: this.formula, total: this.total };
    }

    async toMessage(data) {
      global.ChatMessage.create({ ...data, rolls: [this] });
      return data;
    }
  };
}

/** A posted roll card spoken by `actor`. */
function card(actor, { d20 = 8, total = 12, flags = {} } = {}) {
  const roll = { formula: '1d20 + 1d6', total, dice: [{ faces: 20, total: d20 }, { faces: 6, total: total - d20 }], toJSON: () => ({ formula: '1d20 + 1d6', total }) };
  return {
    id: `m${nextId++}`, rolls: [roll], speaker: { actor: actor.id }, flags: { essence20: { ...flags } }, isAuthor: false,
    update: jest.fn(async function (changes) {
      for (const [key, value] of Object.entries(changes)) {
        setPath(this, key, value);
      }
    }),
  };
}

const press = (message, offer) => cards.pressOffer(message, { holderUuid: offer.holder.uuid, itemId: offer.item.id, index: offer.index });

describe('roll-card offers', () => {
  beforeEach(() => {
    applyReroll.mockClear();
    global.ChatMessage.getSpeakerActor = speaker => global.game.actors.get(speaker.actor);
    global.game.user.isGM = false;
  });

  test("Best-Laid Plans: the planner's DIF 10 test opens a pool for the scene; the Party rerolls d20s from it", async () => {
    const planner = makeActor('Planner', FILES.bestLaidPlans);
    const mate = makeActor('Mate');
    const stranger = makeActor('Stranger');
    scene(planner, mate, stranger);
    global.game.actors.party = { members: [mate] };
    planner._dice = { rollSkill: jest.fn(async () => ({ success: true, outcomes: [{ roll: { total: 21 }, results: [{ total: 21, multiplier: 2 }] }] })) };
    await runUse(itemNamed(planner, 'Best Laid Plans'), async () => true, { ask: async () => 1 });
    expect(planner._dice.rollSkill.mock.calls[0][0]).toMatchObject({ skill: 'culture', dif: '10' });
    expect(planner.flags.essence20.ruleMarks.bestLaidPlans.count).toBe(3);
    const message = card(mate);
    const offers = cards.offersFor(message);
    expect(offers).toHaveLength(1);
    expect(offers[0].label).toBe('Best-Laid Plans: reroll the d20 (3 left)');
    expect(cards.offersFor(card(stranger))).toHaveLength(0);
    global.Roll = rollClass();
    expect(await press(message, offers[0])).toBe(true);
    expect(applyReroll.mock.calls[0][1]).toMatchObject({ mode: 'all', target: 'd20' });
    expect(createCalls().at(-1).flags.essence20.q1Reroll).toBe(true);
    expect(planner.flags.essence20.ruleMarks.bestLaidPlans.count).toBe(2);
    // A failed test opens nothing.
    planner.flags.essence20.ruleMarks = {};
    planner._dice.rollSkill.mockResolvedValue({ success: false, outcomes: [{ roll: { total: 7 }, results: [{ total: 7 }] }] });
    await runUse(itemNamed(planner, 'Best Laid Plans'), async () => true, { ask: async () => 0 });
    expect(planner.flags.essence20.ruleMarks.bestLaidPlans).toBeUndefined();
    expect(cards.offersFor(card(mate))).toHaveLength(0);
  });

  test("One Last Chance: an ally's failed Skill Test (not a reroll), once per scene, a die the roller picks", async () => {
    const holder = makeActor('Holder', FILES.oneLastChance);
    const ally = makeActor('Ally');
    const foe = makeActor('Foe', [], { type: 'npc' });
    scene(holder, ally, foe);
    global.canvas.scene.tokens = [{ actorId: holder.id }, { actorId: ally.id }];
    const failed = card(ally, { flags: { rollFailed: true, skill: 'athletics' } });
    expect(cards.offersFor(failed)).toHaveLength(1);
    expect(cards.offersFor(card(ally, { flags: { rollFailed: false, skill: 'athletics' } }))).toHaveLength(0);
    expect(cards.offersFor(card(ally, { flags: { rollFailed: true, skill: 'athletics', q1Reroll: true } }))).toHaveLength(0);
    expect(cards.offersFor(card(holder, { flags: { rollFailed: true, skill: 'athletics' } }))).toHaveLength(0);
    expect(cards.offersFor(card(foe, { flags: { rollFailed: true, skill: 'athletics' } }))).toHaveLength(0);
    global.canvas.scene.tokens = [{ actorId: ally.id }];
    expect(cards.offersFor(failed)).toHaveLength(0);
    global.canvas.scene.tokens = [];
    const [offer] = cards.offersFor(failed);
    global.Roll = rollClass();
    // Closing the die picker: nothing happens and the scene's use isn't spent.
    applyReroll.mockImplementationOnce(async () => false);
    expect(await press(failed, offer)).toBe(false);
    expect(cards.offersFor(failed)).toHaveLength(1);
    await press(failed, offer);
    expect(applyReroll.mock.calls.at(-1)[1]).toMatchObject({ mode: 'all', target: 'anyDie' });
    expect(cards.offersFor(failed)).toHaveLength(0);
  });

  test("Sorcerous Support: readied, its holder's owner can re-roll anyone's Fumble once per mission", async () => {
    const helper = makeActor('Helper', FILES.sorcerousSupport);
    const ally = makeActor('Ally');
    scene(helper, ally);
    const fumble = card(ally, { d20: 1 });
    expect(cards.offersFor(fumble)).toHaveLength(0);
    await runUse(itemNamed(helper, 'Sorcerous Support'), async () => true);
    expect(cards.offersFor(card(ally, { d20: 2 }))).toHaveLength(0);
    helper.isOwner = false;
    expect(cards.offersFor(fumble)).toHaveLength(0);
    helper.isOwner = true;
    const [offer] = cards.offersFor(fumble);
    global.Roll = rollClass(17);
    await press(fumble, offer);
    expect(createCalls().some(data => data.rolls?.[0]?.total == 17 && data.rolls[0].formula == '1d20 + 1d6')).toBe(true);
    expect(cards.offersFor(card(ally, { d20: 1 }))).toHaveLength(0);
    // Used: the Use can't ready it again this mission.
    expect(await runUse(itemNamed(helper, 'Sorcerous Support'), async () => true)).toBeNull();
  });

  test('Do Or Die: a Moxie for the Old Hand die on your own check card; a second use this scene costs 2', async () => {
    const moxie = { name: 'Moxie', type: 'rolePoints', system: { resource: { value: 3, max: 5 } } };
    const hand = makeActor('Hand', FILES.doOrDie, { extra: [moxie], system: { level: 15, oldHandTransitionLevel: 5 } });
    const other = makeActor('Other');
    scene(hand, other);
    const message = card(hand, { total: 12, flags: { checkResults: [{ targetUuid: other.uuid, difficulty: 14 }] } });
    let [offer] = cards.offersFor(message);
    expect(offer.label).toBe('Do Or Die: add a d6 (1 Moxie)');
    expect(cards.offersFor(card(other, { flags: { checkResults: [{ difficulty: 10 }] } }))).toHaveLength(0);
    global.Roll = rollClass(4, 2);
    await press(message, offer);
    const moxieItem = itemNamed(hand, 'Moxie');
    expect(moxieItem.system.resource.value).toBe(2);
    expect(createCalls().at(-1).content).toContain('E20.CheckSuccess');
    [offer] = cards.offersFor(message);
    expect(offer.label).toBe('Do Or Die: add a d6 (2 Moxie)');
    await press(message, offer);
    expect(moxieItem.system.resource.value).toBe(0);
    expect(cards.offersFor(message)).toHaveLength(0);
    // The die by Old Hand level: d2 at 1-5, d4 at 6-10, d8 at 16+; unlimited Moxie never runs out.
    for (const [level, die] of [[5, 'd2'], [10, 'd4'], [20, 'd8']]) {
      const one = makeActor('One', FILES.doOrDie, { system: { level, oldHandTransitionLevel: 0, useUnlimitedResource: true } });
      scene(one);
      expect(cards.offersFor(card(one, { flags: { checkResults: [{ difficulty: 10 }] } }))[0].label).toContain(die);
    }
  });

  test('Nemesis: reroll a test involving your Nemesis and see both results against each DIF, once per scene', async () => {
    const hero = makeActor('Hero', FILES.nemesis);
    const boss = makeActor('Boss', [], { type: 'npc' });
    scene(hero, boss);
    global.canvas.tokens.placeables = [hero.token];
    hero.flags.essence20.nemesisUuid = boss.uuid;
    const vsBoss = card(hero, { total: 13, flags: { checkResults: [{ targetUuid: boss.uuid, difficulty: 14 }] } });
    expect(cards.offersFor(card(hero, { flags: { checkResults: [{ difficulty: 10 }] } }))).toHaveLength(0);
    const [offer] = cards.offersFor(vsBoss);
    global.Roll = rollClass(16);
    await press(vsBoss, offer);
    const posted = createCalls().at(-1);
    expect(posted.flavor).toContain('ChooseFlavor');
    expect(posted.flavor).toContain('Boss (14): Success');
    expect(cards.offersFor(vsBoss)).toHaveLength(0);
    // On the canvas counts too (a new scene).
    hero.flags.essence20.ruleUses = {};
    global.canvas.tokens.placeables = [hero.token, boss.token];
    expect(cards.offersFor(card(hero, { flags: { checkResults: [{ difficulty: 10 }] } }))).toHaveLength(1);
  });

  test('Destiny: the GM spends a GM Story Point to make a plain failure a Fumble; the team gains a Story Point', async () => {
    const hero = makeActor('Hero', FILES.destiny);
    scene(hero);
    const requestStoryPointGrant = jest.fn(async () => {});
    setStoryPointHelpers({ canSpendForActor: () => true, spendForActor: jest.fn(), requestStoryPointGrant, poolFor: () => 'story', canWriteStoryPoints: () => true });
    const failed = card(hero, { flags: { rollFailed: true } });
    expect(cards.offersFor(failed)).toHaveLength(0);
    global.game.user.isGM = true;
    expect(cards.offersFor(card(hero, { flags: { rollFailed: true, isFumble: true } }))).toHaveLength(0);
    const [offer] = cards.offersFor(failed);
    storyApi.requestStoryPointSpend.mockClear();
    await press(failed, offer);
    expect(storyApi.requestStoryPointSpend).toHaveBeenCalledWith(null, 1, { pool: 'gm', announce: false });
    expect(failed.flags.essence20.ruleCardMarks.pr1DestinyFumbled).toBe(true);
    expect(requestStoryPointGrant).toHaveBeenCalledWith(hero, 1, { pool: 'story' });
    expect(cards.offersFor(failed)).toHaveLength(0);
    // Once per scene; and never with no GM Story Points.
    expect(cards.offersFor(card(hero, { flags: { rollFailed: true } }))).toHaveLength(0);
    hero.flags.essence20.ruleUses = {};
    storyApi.getGmPoints.mockReturnValue(0);
    expect(await press(card(hero, { flags: { rollFailed: true } }), offer)).toBe(false);
    storyApi.getGmPoints.mockReturnValue(2);
  });
});

describe('Quantum Trigger and Savant Skill', () => {
  test('Quantum Trigger: a failed test with Personal Power left offers a retry with a cumulative ↓', async () => {
    const ranger = makeActor('Ranger', FILES.quantumTrigger);
    scene(ranger);
    misc.LAST_ROLL.set(ranger.uuid, { dataset: { skill: 'athletics', shiftDown: 1 }, itemUuid: null });
    await fireTriggers(ranger, 'afterRoll', { outcome: 'failure', facts: { results: [{ success: false }] } });
    const posted = createCalls().find(data => data.flags?.essence20?.ruleButton);
    expect(posted.flags.essence20.ruleButton.label).toBe('Try again with ↓1 (1 Personal Power)');
    ranger._dice = { rollSkill: jest.fn(async () => ({})) };
    await pressRuleButton({ flags: posted.flags, update: jest.fn() });
    expect(ranger.system.powers.personal.value).toBe(2);
    expect(ranger._dice.rollSkill.mock.calls[0][0]).toMatchObject({ skill: 'athletics', shiftDown: 2, e20RetryChain: 1, e20RetryBase: 1 });
    // The retry fails too: ↓2 from the same base.
    misc.LAST_ROLL.set(ranger.uuid, { dataset: ranger._dice.rollSkill.mock.calls[0][0], itemUuid: null });
    global.ChatMessage.create.mockClear();
    await fireTriggers(ranger, 'afterRoll', { outcome: 'failure', facts: { results: [{ success: false }] } });
    const again = createCalls().find(data => data.flags?.essence20?.ruleButton);
    await pressRuleButton({ flags: again.flags, update: jest.fn() });
    expect(ranger._dice.rollSkill.mock.calls[1][0]).toMatchObject({ shiftDown: 3, e20RetryChain: 2 });
    // No Power, or a success: nothing.
    global.ChatMessage.create.mockClear();
    ranger.system.powers.personal.value = 0;
    await fireTriggers(ranger, 'afterRoll', { outcome: 'failure', facts: { results: [{ success: false }] } });
    ranger.system.powers.personal.value = 3;
    await fireTriggers(ranger, 'afterRoll', { outcome: 'success', facts: { results: [{ success: true }] } });
    expect(createCalls()).toHaveLength(0);
  });

  test('Savant Skill: a Story Point reroll of the chosen Skill that still fails gives the point back', async () => {
    const savant = makeActor('Savant', FILES.savantSkill);
    itemNamed(savant, 'Savant Skill').system.choice = 'science';
    scene(savant);
    global.ChatMessage.getSpeakerActor = speaker => global.game.actors.get(speaker.actor);
    const requestStoryPointGrant = jest.fn(async () => {});
    setStoryPointHelpers({ canSpendForActor: () => true, spendForActor: jest.fn(), requestStoryPointGrant, poolFor: () => 'story', canWriteStoryPoints: () => true });
    const original = { id: 'o', speaker: { actor: savant.id }, flags: { essence20: { skill: 'science', checkResults: [{ difficulty: 15 }] } } };
    const reroll = total => ({ id: `r${total}`, author: { id: 'u' }, speaker: { actor: savant.id }, rolls: [{ total }], flags: { essence20: { rerollConfig: { source: 'storyPoint' } } } });
    await cards.onRerollMessage(reroll(12), [original, reroll(12)]);
    expect(requestStoryPointGrant).toHaveBeenCalledWith(savant, 1, { pool: 'story' });
    await cards.onRerollMessage(reroll(16), [original, reroll(16)]);
    original.flags.essence20.skill = 'culture';
    await cards.onRerollMessage(reroll(11), [original, reroll(11)]);
    expect(requestStoryPointGrant).toHaveBeenCalledTimes(1);
  });
});

describe('Prospector Toolkit: a banked Wealth die', () => {
  test('the Use banks 1d4 (or 1d8 with a DIF 16 Survival success) once per mission; the next Wealth Test takes it', async () => {
    const prospector = makeActor('Prospector', FILES.prospector);
    scene(prospector);
    const toolkit = itemNamed(prospector, 'Prospector Toolkit');
    prospector._dice = { rollSkill: jest.fn(async () => ({ success: true, outcomes: [{ results: [{ total: 17, multiplier: 1 }] }] })) };
    await runUse(toolkit, async () => true, { ask: async () => 1 });
    expect(prospector._dice.rollSkill.mock.calls[0][0]).toMatchObject({ skill: 'survival', dif: '16' });
    expect(misc.bankedDice(prospector).map(entry => entry.die)).toEqual(['1d8']);
    // Banked (and the mission's use spent): no second one.
    expect(await runUse(toolkit, async () => true, { ask: async () => 0 })).toBeNull();
    // Another roll first leaves it banked; a Wealth Test takes it into the bonus-die slot, and a cancelled one gives it back.
    await misc.bonusDicePreRoll(prospector, { skill: 'athletics' });
    expect(prospector.flags.essence20.pendingMoreHeads).toBeUndefined();
    await misc.bonusDicePreRoll(prospector, { skill: 'wealth' });
    expect(prospector.flags.essence20.pendingMoreHeads).toMatchObject({ bonusDie: '1d8' });
    expect(misc.bankedDice(prospector)).toEqual([]);
    await misc.bonusDicePreRoll(prospector, { skill: 'athletics' });
    expect(prospector.flags.essence20.pendingMoreHeads).toBeNull();
    expect(misc.bankedDice(prospector).map(entry => entry.die)).toEqual(['1d8']);
    // A die banked the old way still counts.
    const old = makeActor('Old');
    old.flags.essence20.pr1ProspectorDie = '1d4';
    await misc.bonusDicePreRoll(old, { skill: 'wealth' });
    expect(old.flags.essence20.pendingMoreHeads).toMatchObject({ bonusDie: '1d4' });
    expect(old.flags.essence20.pr1ProspectorDie).toBeUndefined();
  });
});

describe('Danger Sense (Across the Stars): Initiative rerolls 1s and 2s on Skill dice', () => {
  test('the formula gains r<=2 on each Skill die, once', async () => {
    const { withInitiativeRerolls, initiativeRerollDerived } = await import('./plugins/rolls/initiative.mjs');
    expect(withInitiativeRerolls('2d20kl + d6 + 0')).toBe('2d20kl + d6r<=2 + 0');
    expect(withInitiativeRerolls('d20 + {d2,d4,d6}kh + 1')).toBe('d20 + {d2,d4r<=2,d6r<=2}kh + 1');
    const ranger = makeActor('Ranger', FILES.dangerSenseAts, { system: { initiative: { formula: 'd20 + d8 + 0' } } });
    initiativeRerollDerived(ranger);
    initiativeRerollDerived(ranger);
    expect(ranger.system.initiative.formula).toBe('d20 + d8r<=2 + 0');
    const other = makeActor('Other', [], { system: { initiative: { formula: 'd20 + d8 + 0' } } });
    initiativeRerollDerived(other);
    expect(other.system.initiative.formula).toBe('d20 + d8 + 0');
  });
});

/* -------------------------------------------- */
/*  Spell costs, Sharpcaster, Reactionary, smoke */
/* -------------------------------------------- */

describe('spell-cost options: one dialog, set then add then multiply then spend', () => {
  const spellcost = () => import('./plugins/resources/spell-cost.mjs');

  function caster(files) {
    const points = { name: 'Mystical Points', type: 'rolePoints', system: { resource: { value: 3, max: 5 } } };
    const actor = makeActor('Caster', files, { extra: [points], system: { skills: { spellcasting: { shift: 'd6', shiftDown: 0 } } } });
    actor._getBaseRolePoints = () => itemNamed(actor, 'Mystical Points');
    return actor;
  }

  test('Illusion Casting, Reach Out and Extra Effective Spell: 1, +1, x2; the notes are posted', async () => {
    const { ruleSpellCost, spellCostRows } = await spellcost();
    const actor = caster([FILES.illusionCasting, FILES.reachOut, FILES.extraEffective, FILES.longLasting]);
    const spell = makeItem(actor, { name: 'Zap', type: 'spell', system: { cost: 3 } });
    scene(actor);
    const rows = spellCostRows(actor, spell);
    expect(rows.map(row => row.rule.op)).toEqual(['set', 'add', 'multiply', 'multiply']);
    const tick = names => async () => Object.fromEntries(rows.map(row => [row.name, names.includes(row.item.name)]));
    expect(await ruleSpellCost(spell, 3, {}, tick(['Illusion Casting', 'Reach Out', 'Extra Effective Spell']))).toBe(4);
    expect(allChat()).toContain('An illusion');
    expect(allChat()).toContain('Its range is doubled.');
    expect(allChat()).toContain('Extra Effective: the effect is doubled.');
    expect(await ruleSpellCost(spell, 3, {}, tick(['Extra Effective Spell', 'Long Lasting Spell']))).toBe(12);
    expect(await ruleSpellCost(spell, 3, {}, tick([]))).toBe(3);
    // Cancelling cancels the cast; a free re-cast costs nothing and asks nothing.
    expect(await ruleSpellCost(spell, 3, {}, async () => null)).toBeNull();
    const ask = jest.fn();
    expect(await ruleSpellCost(spell, 3, { freeCast: true }, ask)).toBe(0);
    expect(ask).not.toHaveBeenCalled();
  });

  test('Mystical Understanding: Mystical Points spent come off the Cost (offered only with points left)', async () => {
    const { ruleSpellCost, spellCostRows } = await spellcost();
    const actor = caster([FILES.mysticalUnderstanding, FILES.reachOut]);
    const spell = makeItem(actor, { name: 'Zap', type: 'spell', system: { cost: 3 } });
    scene(actor);
    const rows = spellCostRows(actor, spell);
    const spendRow = rows.find(row => row.rule.op == 'spend');
    expect(spendRow.max).toBe(3);
    const reachRow = rows.find(row => row.rule.op == 'add');
    expect(await ruleSpellCost(spell, 3, {}, async () => ({ [spendRow.name]: 2, [reachRow.name]: true }))).toBe(2);
    expect(itemNamed(actor, 'Mystical Points').system.resource.value).toBe(1);
    expect(allChat()).toContain('Spellcosting: 2 Mystical Point(s) spent');
    // More than the Cost floors at 0; none left: the box isn't offered.
    expect(await ruleSpellCost(spell, 1, {}, async () => ({ [spendRow.name]: 1 }))).toBe(0);
    expect(spellCostRows(actor, spell).some(row => row.rule.op == 'spend')).toBe(false);
  });

  test("Brilliant Sight's fog option is on that spell only, +1, silent", async () => {
    const { ruleSpellCost, spellCostRows } = await spellcost();
    const actor = caster([FILES.brilliantSight]);
    const sight = itemNamed(actor, 'Brilliant Sight');
    const other = makeItem(actor, { name: 'Zap', type: 'spell', system: { cost: 3 } });
    scene(actor);
    expect(spellCostRows(actor, other)).toHaveLength(0);
    const [row] = spellCostRows(actor, sight);
    expect(await ruleSpellCost(sight, 2, {}, async () => ({ [row.name]: true }))).toBe(3);
    expect(actor.flags.essence20.brilliantSightFog).toBe(true);
    expect(createCalls()).toHaveLength(0);
  });

  test('Sharpcaster: a spell that misses every target offers a free re-cast', async () => {
    const actor = makeActor('Caster', FILES.sharpcaster);
    const spell = makeItem(actor, { name: 'Zap', type: 'spell', roll: jest.fn(async () => {}) });
    actor.items.contents.push(spell);
    rebuildIndex(actor);
    scene(actor);
    const missed = { outcome: 'failure', facts: { results: [{ success: false, targetUuid: 'x' }] }, roll: { item: spell, targetCount: 1 }, vars: { itemUuid: spell.uuid } };
    await fireTriggers(actor, 'afterRoll', missed);
    const posted = createCalls().find(data => data.flags?.essence20?.ruleButton);
    expect(posted.flags.essence20.ruleButton.label).toBe('Sharpcaster: attack again at no cost');
    await pressRuleButton({ flags: posted.flags, update: jest.fn() });
    expect(spell.roll).toHaveBeenCalledWith({ rollType: 'spell', freeCast: true });
    // A hit, no target, or not a spell: no offer.
    global.ChatMessage.create.mockClear();
    await fireTriggers(actor, 'afterRoll', { ...missed, outcome: 'success', facts: { results: [{ success: true, targetUuid: 'x' }] } });
    await fireTriggers(actor, 'afterRoll', { ...missed, roll: { item: spell, targetCount: 0 } });
    await fireTriggers(actor, 'afterRoll', { ...missed, roll: { item: makeItem(actor, { type: 'weaponEffect' }), targetCount: 1 } });
    expect(createCalls()).toHaveLength(0);
  });
});

describe('Reactionary: a new Initiative, once a round, when not first', () => {
  test('rolls Initiative again for a Free action; refused when first', async () => {
    const pony = makeActor('Pony', FILES.reactionary);
    const other = makeActor('Other');
    scene(pony, other);
    const mine = { id: 'c1', actor: pony, initiative: 8 };
    const theirs = { id: 'c2', actor: other, initiative: 15 };
    const rollInitiative = jest.fn(async () => {});
    global.game.combat = { id: 'cb', started: true, round: 2, turn: 0, combatant: theirs, combatants: { contents: [mine, theirs] }, turns: [theirs, mine], rollInitiative };
    const pay = jest.fn(async () => true);
    await runUse(itemNamed(pony, 'Reactionary'), pay);
    expect(pay).toHaveBeenCalledWith('free');
    expect(rollInitiative).toHaveBeenCalledWith(['c1']);
    // Once a round.
    expect(await runUse(itemNamed(pony, 'Reactionary'), pay)).toBeNull();
    global.game.combat.round = 3;
    global.game.combat.turns = [mine, theirs];
    pay.mockClear();
    const line = await runUse(itemNamed(pony, 'Reactionary'), pay);
    expect(line).toContain('already first');
    expect(pay).not.toHaveBeenCalled();
    expect(rollInitiative).toHaveBeenCalledTimes(1);
  });
});

describe('smoke: Smoke Screen blinds a 20 ft radius, Smoke Bomb leaves an Alertness ↓1 cloud', () => {
  test('Smoke Screen: a Standard action, a clicked point, Blinded for a round within 20 ft, one used up', async () => {
    const pony = makeActor('Pony', FILES.smokeScreen);
    const near = makeActor('Near', [], { x: 10 });
    const far = makeActor('Far', [], { x: 50 });
    scene(pony, near, far);
    pickCanvasPoint.mockResolvedValueOnce({ x: 0, y: 0 });
    const bauble = itemNamed(pony, 'Smoke Screen');
    bauble.system.quantity = 2;
    const pay = jest.fn(async () => true);
    await runUse(bauble, pay);
    expect(pay).toHaveBeenCalledWith('standard');
    expect(applyTimedCondition.mock.calls.map(call => [call[0].name, call[1], call[2]])).toEqual([['Pony', 'blinded', 1], ['Near', 'blinded', 1]]);
    expect(bauble.system.quantity).toBe(1);
    // A cancelled point: nothing more happens.
    pickCanvasPoint.mockResolvedValueOnce(null);
    await runUse(bauble, pay);
    expect(bauble.system.quantity).toBe(1);
    bauble.system.quantity = 0;
    rebuildIndex(pony);
    expect(await runUse(bauble, pay)).toBeNull();
  });

  test('Smoke Bomb: the point is picked first; anyone rolling Alertness inside the square for the scene takes ↓1', async () => {
    const { zoneSources } = await import('./plugins/combat/canvas-points.mjs');
    const pony = makeActor('Pony', FILES.smokeBomb);
    const inside = makeActor('Inside', [], { x: 90 });
    const outside = makeActor('Outside', [], { x: 250 });
    scene(pony, inside, outside);
    pickCanvasPoint.mockResolvedValueOnce({ x: 50, y: 0 });
    itemNamed(pony, 'Smoke Bomb').system.quantity = 2;
    const pay = jest.fn(async () => true);
    await runUse(itemNamed(pony, 'Smoke Bomb'), pay);
    expect(pay).toHaveBeenCalledWith('standard');
    expect(pony.items.contents.some(item => item.name == 'Smoke Bomb')).toBe(true);
    expect(zoneSources(inside, null, { rolledSkill: 'alertness' }).sources).toEqual([expect.objectContaining({ shiftDown: 1, label: 'Smoke Bomb' })]);
    expect(zoneSources(inside, null, { rolledSkill: 'athletics' }).sources).toEqual([]);
    expect(zoneSources(outside, null, { rolledSkill: 'alertness' }).sources).toEqual([]);
    // A cancelled pick costs nothing.
    pay.mockClear();
    pickCanvasPoint.mockResolvedValueOnce(null);
    await runUse(itemNamed(pony, 'Smoke Bomb'), pay);
    expect(pay).not.toHaveBeenCalled();
  });
});

/* -------------------------------------------- */
/*  Initiative                                   */
/* -------------------------------------------- */

/** A running combat over these [actor, initiative] pairs (in turn order). */
function combatOf(pairs, extra = {}) {
  const combatants = pairs.map(([actor, initiative], i) => ({
    id: `c${i}`, actor, actorId: actor.id, initiative, flags: {},
    async update(changes) {
      Object.assign(this, changes);
    },
  }));
  global.game.combat = { id: 'cb', started: true, round: 1, turn: 0, combatant: combatants[0], combatants: { contents: combatants }, turns: combatants, rollInitiative: jest.fn(async () => {}), ...extra };
  global.game.combats = { get: id => (id == global.game.combat?.id ? global.game.combat : null) };
  return combatants;
}

describe('Danger Sense (GI Joe): the Protected Target within 10 ft is not Surprised; it can take the Bodyguard\'s Initiative', () => {
  test('an aura ConditionImmunity that only reaches the Protected Target', async () => {
    const { ruleConditionImmune } = await import('./adapter.mjs');
    const bodyguard = makeActor('Bodyguard', FILES.dangerSenseGij, { x: 5 });
    const ward = makeActor('Ward', [], { x: 0 });
    const other = makeActor('Other', [], { x: 3 });
    scene(bodyguard, ward, other);
    bodyguard.flags.essence20.protectedTargetUuid = ward.uuid;
    rebuildIndex(bodyguard);
    expect(ruleConditionImmune(bodyguard, 'surprised')).toBe(true);
    expect(ruleConditionImmune(ward, 'surprised')).toBe(true);
    expect(ruleConditionImmune(ward, 'prone')).toBe(false);
    expect(ruleConditionImmune(other, 'surprised')).toBe(false);
    bodyguard.token.center.x = 15;
    expect(ruleConditionImmune(ward, 'surprised')).toBe(false);
  });

  test('the Use copies the Bodyguard\'s Initiative onto the Protected Target', async () => {
    const bodyguard = makeActor('Bodyguard', FILES.dangerSenseGij);
    const ward = makeActor('Ward');
    scene(bodyguard, ward);
    const item = itemNamed(bodyguard, 'Danger Sense');
    // No Protected Target, or not rolled yet: nothing.
    const [mine, theirs] = combatOf([[bodyguard, null], [ward, 5]]);
    expect(await runUse(item, async () => true)).toContain('No Protected Target');
    bodyguard.flags.essence20.protectedTargetUuid = ward.uuid;
    expect(await runUse(item, async () => true)).toContain('Roll your own Initiative');
    mine.initiative = 15;
    await runUse(item, async () => true);
    expect(theirs.initiative).toBe(15);
  });
});

describe('Timeline Anomaly: swap Initiative with your target once a session', () => {
  test('swaps the two Initiatives; needs a target in the combat', async () => {
    const citizen = makeActor('Citizen', FILES.timelineAnomaly);
    const other = makeActor('Other');
    const stranger = makeActor('Stranger');
    scene(citizen, other, stranger);
    const [mine, theirs] = combatOf([[citizen, 5], [other, 15]]);
    global.ui = { notifications: { warn: jest.fn() } };
    const item = itemNamed(citizen, 'Timeline Anomaly');
    target(stranger);
    await runUse(item, async () => true);
    expect(mine.initiative).toBe(5);
    target(other);
    await runUse(item, async () => true);
    expect([mine.initiative, theirs.initiative]).toEqual([15, 5]);
    expect(await runUse(item, async () => true)).toBeNull();
    expect(mine.initiative).toBe(15);
  });
});

describe("Shark's Fin: at sea or in the wetlands, Initiative lifts Surprise and says how far you can move", () => {
  test('fired from the Initiative roll itself', async () => {
    const { initiativeRolling } = await import('./plugins/rolls/initiative.mjs');
    const { registerCheck } = await import('./predicate.mjs');
    let wet = true;
    registerCheck('seaOrWetlands', () => wet);
    const sailor = makeActor('Sailor', FILES.sharksFin, { system: { movement: { ground: { total: 30 }, swim: { total: 60 } } } });
    sailor.statuses = new Set(['surprised']);
    sailor.toggleStatusEffect = jest.fn(async () => sailor.statuses.delete('surprised'));
    scene(sailor);
    await initiativeRolling(sailor);
    expect(sailor.toggleStatusEffect).toHaveBeenCalledWith('surprised', { active: false });
    expect(allChat()).toContain('can move up to 60 ft');
    wet = false;
    global.ChatMessage.create.mockClear();
    await initiativeRolling(sailor);
    expect(createCalls()).toHaveLength(0);
  });
});

describe('Follow Me!: teammates who follow take the leader\'s Initiative less 1d4; the leader +1 each', () => {
  test('the call, the follow buttons, then the leader\'s roll', async () => {
    const leader = makeActor('Red', FILES.followMe);
    const a = makeActor('Blue');
    const b = makeActor('Pink');
    scene(leader, a, b);
    const [lead, fa, fb] = combatOf([[leader, null], [a, null], [b, null]]);
    await runUse(itemNamed(leader, 'Follow Me!'), async () => true);
    const posted = createCalls().find(data => data.flags?.essence20?.ruleButton);
    expect(posted.flags.essence20.ruleButton.targets).toEqual([leader.uuid]);
    for (const follower of [a, b]) {
      global.game.user.character = follower;
      await pressRuleButton({ flags: posted.flags, update: jest.fn() }, global.game.user);
    }

    expect(Object.keys(leader.flags.essence20.ruleMarks)).toHaveLength(2);
    jest.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValueOnce(0.99);
    lead.initiative = 13;
    await fireTriggers(leader, 'initiativeRolled');
    expect([lead.initiative, fa.initiative, fb.initiative]).toEqual([15, 14, 11]);
    expect(Object.keys(leader.flags.essence20.ruleMarks ?? {})).toHaveLength(0);
    // Its own write fires the event again: nothing more happens.
    await fireTriggers(leader, 'initiativeRolled');
    expect(lead.initiative).toBe(15);
    // Too late to follow once the leader rolled.
    global.game.user.character = a;
    fa.initiative = null;
    await pressRuleButton({ flags: posted.flags, update: jest.fn() }, global.game.user);
    expect(leader.flags.essence20.ruleMarks?.[`followMe--${a.id}`]).toBeUndefined();
  });
});

describe('Precise Chronometrics: share Initiative bonuses up to Smarts, once a combat', () => {
  test('bonuses land on same-side combatants who rolled; too many refused', async () => {
    const combiner = makeActor('Combiner', FILES.preciseChronometrics, { system: { essences: { smarts: { value: 3, max: 4 } } } });
    const ally = makeActor('Ally');
    const foe = makeActor('Foe', [], { type: 'npc', disposition: -1 });
    scene(combiner, ally, foe);
    const [mine, theirs, enemy] = combatOf([[combiner, 10], [ally, 12], [foe, 8]]);
    global.ui = { notifications: { warn: jest.fn() } };
    const { DialogV2 } = { DialogV2: { wait: jest.fn(async () => null) } };
    global.foundry.applications = { api: { DialogV2 } };
    // Too many: refused, the combat's use is kept.
    DialogV2.wait.mockImplementationOnce(async ({ buttons }) => buttons[0].callback(null, { form: { elements: { r0: { value: 3 }, r1: { value: 2 } } } }));
    expect(await runUse(itemNamed(combiner, 'Precise Chronometrics'), async () => true)).toBeNull();
    expect(global.ui.notifications.warn).toHaveBeenCalled();
    DialogV2.wait.mockImplementationOnce(async ({ buttons }) => buttons[0].callback(null, { form: { elements: { r0: { value: 1 }, r1: { value: 3 } } } }));
    await runUse(itemNamed(combiner, 'Precise Chronometrics'), async () => true);
    expect([mine.initiative, theirs.initiative, enemy.initiative]).toEqual([11, 15, 8]);
    expect(await runUse(itemNamed(combiner, 'Precise Chronometrics'), async () => true)).toBeNull();
  });
});

/* -------------------------------------------- */
/*  Transformers: contests, orders, analysis     */
/* -------------------------------------------- */

/** A _dice.rollSkill stand-in that totals each call from `totals`, in order. */
const rollsTotalling = (...totals) => jest.fn(async () => {
  const total = totals.shift() ?? 10;
  return { success: true, total, outcomes: [{ roll: { total }, results: [{ total, multiplier: 1 }] }] };
});

describe('Whisper Campaign: Deception with Edge against the target\'s own Persuasion', () => {
  test('rolled at once when this user can roll for the target; a tie goes to the target', async () => {
    const infiltrator = makeActor('Infiltrator', FILES.whisperCampaign);
    const mark = makeActor('Mark');
    scene(infiltrator, mark);
    target(mark);
    infiltrator._dice = { rollSkill: rollsTotalling(15, 12) };
    mark._dice = { rollSkill: rollsTotalling(14, 12) };
    const line = await runUse(itemNamed(infiltrator, 'Whisper Campaign'), async () => true);
    expect(infiltrator._dice.rollSkill.mock.calls[0][0]).toMatchObject({ skill: 'deception', edge: true, shiftUp: 0, shiftDown: 0 });
    expect(mark._dice.rollSkill.mock.calls[0][0]).toMatchObject({ skill: 'persuasion' });
    expect(line).toContain('ContestWon');
    expect(await runUse(itemNamed(infiltrator, 'Whisper Campaign'), async () => true)).toContain('ContestLost');
  });

  test("someone else's creature: its owner rolls from a card", async () => {
    const infiltrator = makeActor('Infiltrator', FILES.whisperCampaign);
    const mark = makeActor('Mark');
    mark.isOwner = false;
    scene(infiltrator, mark);
    target(mark);
    infiltrator._dice = { rollSkill: rollsTotalling(11) };
    mark._dice = { rollSkill: rollsTotalling(16) };
    await runUse(itemNamed(infiltrator, 'Whisper Campaign'), async () => true);
    expect(mark._dice.rollSkill).not.toHaveBeenCalled();
    const posted = createCalls().find(data => data.flags?.essence20?.ruleButton);
    expect(posted.flags.essence20.ruleButton).toMatchObject({ who: 'targets', vars: { contestMine: 11 } });
    await pressRuleButton({ flags: posted.flags, update: jest.fn() });
    expect(mark._dice.rollSkill).toHaveBeenCalled();
    expect(allChat()).toContain('ContestLost');
  });
});

describe('Irrefutable Order: a one-word order the target spends its next Move action on', () => {
  test('Persuasion against the chosen Defense; at the target\'s next turn start, its Move goes and its owners are told', async () => {
    const { runTurnQueue } = misc;
    const commander = makeActor('Commander', FILES.irrefutableOrder, { system: { level: 5 } });
    const grunt = makeActor('Grunt', [], { system: { level: 5 } });
    const boss = makeActor('Boss', [], { system: { level: 9 } });
    scene(commander, grunt, boss);
    global.foundry.applications = { api: { DialogV2: { prompt: jest.fn(async () => 'Retreat now'), wait: jest.fn() } } };
    commander._dice = { rollSkill: jest.fn(async () => ({ success: true, outcomes: [{ results: [{ total: 15 }] }] })) };
    const pay = jest.fn(async () => true);
    target(boss);
    expect(await runUse(itemNamed(commander, 'Irrefutable Order'), pay, { ask: async () => 1 })).toContain("level is higher");
    expect(pay).not.toHaveBeenCalled();
    target(grunt);
    await runUse(itemNamed(commander, 'Irrefutable Order'), pay, { ask: async () => 1 });
    expect(pay).toHaveBeenCalledWith('standard');
    expect(commander._dice.rollSkill.mock.calls[0][0]).toMatchObject({ skill: 'persuasion', dif: '14' });
    expect(grunt.flags.essence20.ruleTurnQueue).toEqual([expect.objectContaining({ action: 'move', text: "Follow Commander's order: Retreat" })]);
    global.game.users = { contents: [{ id: 'gm', isGM: true }] };
    economySpend.mockClear();
    await runTurnQueue(grunt, null);
    expect(economySpend).toHaveBeenCalledWith(grunt, 'move', { source: 'Irrefutable Order' });
    expect(createCalls().at(-1)).toMatchObject({ whisper: ['gm'] });
    expect(grunt.flags.essence20.ruleTurnQueue).toEqual([]);
    // A failed test gives no order.
    commander._dice.rollSkill.mockResolvedValue({ success: false, outcomes: [{ results: [{ total: 3 }] }] });
    await runUse(itemNamed(commander, 'Irrefutable Order'), pay, { ask: async () => 0 });
    expect(grunt.flags.essence20.ruleTurnQueue).toEqual([]);
  });
});

describe('Target Breakdown: Free actions for each Analyze Target, banked as ↑ for an ally against that target', () => {
  test('the count, the ally, the actions and the bank', async () => {
    const { bankedSources } = await import('./bank.mjs');
    const analyst = makeActor('Analyst', FILES.targetBreakdown);
    const ally = makeActor('Ally');
    const foe = makeActor('Foe', [], { type: 'npc', disposition: -1 });
    const other = makeActor('Other', [], { type: 'npc', disposition: -1 });
    scene(analyst, ally, foe, other);
    combatOf([[analyst, 10], [ally, 9], [foe, 8], [other, 7]]);
    target(foe);
    global.foundry.applications = { api: { DialogV2: { wait: jest.fn(async () => ally.uuid) } } };
    expect(await runUse(itemNamed(analyst, 'Target Breakdown'), async () => true)).toContain('Analyze Target on that target');
    analyst.flags.essence20.analyzeTargetCounts = { [foe.uuid.replace(/\./g, '-')]: 2 };
    economySpend.mockClear();
    await runUse(itemNamed(analyst, 'Target Breakdown'), async () => true);
    expect(economySpend.mock.calls.map(call => call[1])).toEqual(['free', 'free']);
    expect(bankedSources(ally, foe, { isAttack: true }).sources).toEqual([expect.objectContaining({ shiftUp: 2 })]);
    expect(bankedSources(ally, other, { isAttack: true }).sources).toEqual([]);
    expect(bankedSources(ally, foe, { isAttack: false }).sources).toEqual([]);
  });
});

describe('Water Cannon: its Bot Mode weapon takes one hardpoint', () => {
  test('a two-handed granted weapon uses one hardpoint, other weapons are untouched', async () => {
    const { hardpointUseDerived } = misc;
    const bot = makeActor('Bot', FILES.waterCannon, { system: { hardpoints: { external: { used: 4, max: 3, over: true } } } });
    const cannon = itemNamed(bot, 'Water Cannon');
    bot.items.contents.push(
      makeItem(bot, { name: 'Cannon', type: 'weapon', system: { equipped: true, derivedHands: 2, hardpoint: { type: 'external' } }, flags: { essence20: { grantedBy: cannon.id } } }),
      makeItem(bot, { name: 'Rifle', type: 'weapon', system: { equipped: true, derivedHands: 2, hardpoint: { type: 'external' } } }),
    );
    rebuildIndex(bot);
    hardpointUseDerived(bot);
    expect(bot.system.hardpoints.external).toMatchObject({ used: 3, over: false });
  });
});

describe('All Out Attack / Evasive Fighting (Transformers): a number of downshifts on the attack that sets the stance', () => {
  test('offered on your own turn (or out of combat) for Might, Finesse and Targeting attacks; not with the G.I. JOE printing', async () => {
    const { stanceToggles, stanceApply } = misc;
    const bot = makeActor('Bot', [FILES.allOutAttackTf, FILES.evasiveFightingTf]);
    scene(bot);
    const attack = skill => ({ item: { type: 'weaponEffect', system: { classification: { skill } } } });
    const toggles = stanceToggles(bot, attack('might'));
    expect(toggles.map(t => [t.type, t.max])).toEqual([['number', 5], ['number', 5]]);
    expect(stanceToggles(bot, attack('persuasion'))).toEqual([]);
    expect(stanceToggles(bot, { item: { type: 'spell' } })).toEqual([]);
    combatOf([[makeActor('Other'), 10], [bot, 8]]);
    expect(stanceToggles(bot, attack('might'))).toEqual([]);
    global.game.combat.combatant = global.game.combat.combatants.contents[1];
    expect(stanceToggles(bot, attack('targeting'))).toHaveLength(2);
    // Applied: ↓ for both, the All Out Attack damage, and the stance until the next turn starts.
    const options = { shiftDown: 1, ext: { [toggles[0].name]: 2, [toggles[1].name]: 1 } };
    delete bot.flags.essence20.riderStance;
    await stanceApply(bot, options);
    expect(options).toMatchObject({ shiftDown: 4, allOutAttackShifts: 2 });
    expect(bot.flags.essence20.riderStance).toMatchObject({ allOutAttack: 2, evasiveFighting: 1 });
    const gij = makeActor('Joe', FILES.allOutAttackTf, { extra: [{ name: 'All Out Attack', type: 'perk', flags: { core: { sourceId: 'Compendium.essence20.gi_joe_crb.Item.Rhz1k6gTl2XTs8Nk' } } }] });
    global.game.combat = null;
    expect(stanceToggles(gij, attack('might'))).toEqual([]);
  });
});

/* -------------------------------------------- */
/*  Team grants                                  */
/* -------------------------------------------- */

describe('Together We Stand: 1d2 temporary Health and Energon for every teammate in the fight, once', () => {
  test('round 1 with two or more team members in the combat; one grant per member even with two holders', async () => {
    const leader = makeActor('Leader', FILES.togetherWeStand);
    const second = makeActor('Second', FILES.togetherWeStand);
    const mate = makeActor('Mate', [], { system: { energon: undefined } });
    const outsider = makeActor('Outsider');
    scene(leader, second, mate, outsider);
    const party = { id: 'p', type: 'party', system: { actors: { a: { uuid: leader.uuid }, b: { uuid: second.uuid }, c: { uuid: mate.uuid } } }, members: [leader, second, mate] };
    global.game.actors.contents.push(party);
    combatOf([[leader, 10], [second, 9], [mate, 8], [outsider, 7]]);
    jest.spyOn(Math, 'random').mockReturnValue(0.99);
    await fireTriggers(leader, 'roundStart');
    await fireTriggers(second, 'roundStart');
    for (const member of [leader, second]) {
      expect(member.flags.essence20.resTempGrants.map(g => [g.kind, g.amount])).toEqual([['health', 2], ['energon', 2]]);
      expect(member.system.health.bonus).toBe(2);
    }

    expect(mate.flags.essence20.resTempGrants.map(g => g.kind)).toEqual(['health']);
    expect(outsider.flags.essence20.resTempGrants).toBeUndefined();
    // Not in round 2; and not with a team of one in the fight.
    global.game.combat.round = 2;
    await fireTriggers(leader, 'roundStart');
    expect(leader.flags.essence20.resTempGrants).toHaveLength(2);
    const loner = makeActor('Loner', FILES.togetherWeStand);
    scene(loner, outsider);
    combatOf([[loner, 10], [outsider, 9]]);
    await fireTriggers(loner, 'roundStart');
    expect(loner.flags.essence20.resTempGrants).toBeUndefined();
  });
});

describe('The Sound of Angels: after a qualifying attack, ticked allies within 50 ft get Lend Assistance\'s Edge against the target', () => {
  test('two-handed ballistic, explosive or air-vehicle attacks; a Free action per ally', async () => {
    const strafer = makeActor('Strafer', FILES.soundOfAngels, { x: 0 });
    const near = makeActor('Near', [], { x: 30 });
    const far = makeActor('Far', [], { x: 90 });
    const foe = makeActor('Foe', [], { type: 'npc', x: 20, disposition: -1 });
    const rifle = makeItem(strafer, { name: 'Rifle', type: 'weapon', system: { traits: ['ballistic'], derivedHands: 2 } });
    const pistol = makeItem(strafer, { name: 'Pistol', type: 'weapon', system: { traits: ['ballistic'], derivedHands: 1 } });
    strafer.items.contents.push(rifle, pistol);
    const shot = parent => makeItem(strafer, { type: 'weaponEffect', system: { classification: { style: 'projectile' } }, flags: { essence20: { parentId: parent.id } } });
    rebuildIndex(strafer);
    scene(strafer, near, far, foe);
    global.game.combat = { id: 'cb', round: 3, combatants: { contents: [] } };
    target(foe);
    const asked = [];
    const { getNearbyAllyTokens } = await import('../mechanics/combat/nearby-allies.mjs');
    expect(typeof getNearbyAllyTokens).toBe('function');
    global.foundry.applications = { api: { DialogV2: { wait: jest.fn(async ({ content }) => {
      asked.push(content);
      return [near];
    }) } } };
    const attack = item => ({ outcome: 'failure', facts: { results: [{ success: false }] }, roll: { item, isAttack: true } });
    economySpend.mockClear();
    await fireTriggers(strafer, 'afterRoll', attack(shot(rifle)));
    expect(asked[0]).toContain('Near');
    expect(asked[0]).not.toContain('Far');
    expect(economySpend).toHaveBeenCalledWith(strafer, 'free', { source: 'The Sound of Angels' });
    expect(near.flags.essence20.pendingLendAssistanceEdge).toEqual({ targetId: foe.id, edge: true, combatId: 'cb', round: 3 });
    delete near.flags.essence20.pendingLendAssistanceEdge;
    await fireTriggers(strafer, 'afterRoll', attack(shot(pistol)));
    expect(near.flags.essence20.pendingLendAssistanceEdge).toBeUndefined();
    await fireTriggers(strafer, 'afterRoll', attack(makeItem(strafer, { type: 'weaponEffect', system: { classification: { style: 'explosive' } }, flags: {} })));
    expect(near.flags.essence20.pendingLendAssistanceEdge).toBeTruthy();
    // A jet's guns.
    delete near.flags.essence20.pendingLendAssistanceEdge;
    const jet = { type: 'vehicle', system: { movement: { aerial: { base: 300 } } } };
    await fireTriggers(strafer, 'afterRoll', attack({ type: 'weaponEffect', parent: jet, system: { classification: { style: 'energy' } }, flags: {} }));
    expect(near.flags.essence20.pendingLendAssistanceEdge).toBeTruthy();
  });
});

describe('All For One: at 0 Health or Power, each teammate may give 1 Health and 1d2 Personal Power, once a day', () => {
  test('two answer cards; each teammate once per card; once a Rest', async () => {
    const black = makeActor('Black', FILES.allForOne, { system: { health: { value: 0, max: 10 }, powers: { personal: { value: 2, max: 6 } } } });
    const blue = makeActor('Blue', [], { x: 10 });
    const yellow = makeActor('Yellow', [], { x: 20, system: { health: { value: 0, max: 10 } } });
    scene(black, blue, yellow);
    await fireTriggers(black, 'droppedToZero', { vars: { resource: 'health' } });
    const posted = createCalls().filter(data => data.flags?.essence20?.ruleButton);
    expect(posted.map(data => data.flags.essence20.ruleButton.label)).toEqual(['Give Black 1 Health', 'Give Black 1d2 Personal Power']);
    expect(posted[0].flags.essence20.ruleButton).toMatchObject({ who: 'others', runAs: 'clicker', once: false, targets: [black.uuid] });
    const card = data => ({ flags: clone(data.flags), update: jest.fn(async function (changes) {
      for (const [key, value] of Object.entries(changes)) {
        setPath(this, key, value);
      }
    }) });
    const health = card(posted[0]);
    const power = card(posted[1]);
    global.game.user = { id: 'p', isGM: false, character: blue, targets: new Set() };
    black.testUserPermission = () => false;
    global.ui = { notifications: { warn: jest.fn() } };
    await pressRuleButton(health, global.game.user);
    expect([blue.system.health.value, black.system.health.value]).toEqual([9, 1]);
    await pressRuleButton(health, global.game.user);
    expect([blue.system.health.value, black.system.health.value]).toEqual([9, 1]);
    jest.spyOn(Math, 'random').mockReturnValue(0.99);
    await pressRuleButton(power, global.game.user);
    expect([blue.system.powers.personal.value, black.system.powers.personal.value]).toEqual([1, 4]);
    // Yellow has no Health to give.
    global.game.user.character = yellow;
    await pressRuleButton(health, global.game.user);
    expect(black.system.health.value).toBe(1);
    // Once a Rest.
    global.ChatMessage.create.mockClear();
    await fireTriggers(black, 'droppedToZero', { vars: { resource: 'power' } });
    expect(createCalls()).toHaveLength(0);
  });
});

/* -------------------------------------------- */
/*  Frequency Interference                       */
/* -------------------------------------------- */

describe('Frequency Interference: jam a piece of computerized equipment until its owner reboots it', () => {
  test('a contested Technology test against its operator; a jammed weapon cannot attack, jammed armor gives no Defense', async () => {
    const items = await import('./plugins/marks/item-marks.mjs');
    const hacker = makeActor('Hacker', FILES.frequencyInterference);
    const trooper = makeActor('Trooper', [], { type: 'npc', x: 30, disposition: -1, system: { skills: { technology: { shift: 'd6' } }, defenses: { toughness: { total: 14, string: '14' }, evasion: { total: 12, string: '12' } } } });
    const visor = makeItem(trooper, { name: 'Visor', type: 'armor', system: { traits: ['computerized'], equipped: true, totalBonusToughness: 2, totalBonusEvasion: 1, availability: 'standard' } });
    const rifle = makeItem(trooper, { name: 'Rifle', type: 'weapon', system: { traits: ['computerized'] } });
    const shot = makeItem(trooper, { name: 'Shot', type: 'weaponEffect', flags: { essence20: { parentId: rifle.id } } });
    trooper.items.contents.push(visor, rifle, shot);
    scene(hacker, trooper);
    target(trooper);
    global.Roll = rollClass(13);
    global.foundry.applications = { api: { DialogV2: { wait: jest.fn(async () => visor.uuid) } } };
    hacker._dice = { rollSkill: jest.fn(async () => ({ success: true, outcomes: [{ results: [{ total: 15 }] }] })) };
    const pay = jest.fn(async () => true);
    await runUse(itemNamed(hacker, 'Frequency Interference'), pay);
    expect(pay).toHaveBeenCalledWith('standard');
    expect(hacker._dice.rollSkill.mock.calls[0][0]).toMatchObject({ skill: 'technology', dif: '13' });
    expect(visor.flags.essence20.ruleItemMarks.jammed.effects).toEqual({ blockRolls: true, noArmorDefense: true });
    items.markedArmorDerived(trooper);
    expect(trooper.system.defenses.toughness.total).toBe(12);
    expect(trooper.system.defenses.evasion.total).toBe(11);
    // The reboot card, pressed by the target's owner (the GM here), lifts it.
    const posted = createCalls().find(data => data.flags?.essence20?.ruleButton);
    expect(posted.flags.essence20.ruleButton).toMatchObject({ who: 'targets', label: 'Reboot Visor (a Move action)' });
    await pressRuleButton({ flags: posted.flags, update: jest.fn() });
    expect(visor.flags.essence20.ruleItemMarks.jammed).toBeUndefined();
    // Already jammed items aren't offered; a jammed weapon's attack can't be rolled.
    await items.blockMarkedRoll(trooper, {}, shot);
    rifle.flags.essence20 = { ruleItemMarks: { jammed: { effects: { blockRolls: true } } } };
    global.ui = { notifications: { warn: jest.fn() } };
    const dataset = {};
    items.blockMarkedRoll(trooper, dataset, shot);
    expect(dataset.cancelRoll).toBe(true);
    // Too far, or yourself: refused before the action is spent.
    pay.mockClear();
    trooper.token.center.x = 150;
    expect(await runUse(itemNamed(hacker, 'Frequency Interference'), pay)).toContain('within 100 ft');
    expect(pay).not.toHaveBeenCalled();
  });

  test('an unmanned vehicle: the DIF is the item\'s Availability; an old jammed list still counts', async () => {
    const items = await import('./plugins/marks/item-marks.mjs');
    const hacker = makeActor('Hacker', FILES.frequencyInterference);
    const truck = makeActor('Truck', [], { type: 'vehicle', x: 30, disposition: -1, system: { actors: {} } });
    const radio = makeItem(truck, { name: 'Radio', type: 'gear', system: { traits: ['computerized'], availability: 'limited' } });
    truck.items.contents.push(radio);
    scene(hacker, truck);
    target(truck);
    global.foundry.applications = { api: { DialogV2: { wait: jest.fn(async () => radio.uuid) } } };
    hacker._dice = { rollSkill: jest.fn(async () => ({ success: false, outcomes: [{ results: [{ total: 5 }] }] })) };
    await runUse(itemNamed(hacker, 'Frequency Interference'), async () => true);
    expect(hacker._dice.rollSkill.mock.calls[0][0].dif).toBe(String(global.CONFIG.E20.availabilityDifficulties.limited));
    expect(radio.flags.essence20?.ruleItemMarks).toBeUndefined();
    truck.flags.essence20.o2Jammed = [radio.id];
    expect(items.itemMarks(radio).jammed).toBeTruthy();
  });
});

/* -------------------------------------------- */
/*  Lent Alterations                             */
/* -------------------------------------------- */

describe('Overload, Genetic Support and the Advanced Alteration Emulator lend Alterations', () => {
  const wing = () => ({ name: 'Wings', type: 'alteration', system: { type: 'movement', bonusMovementType: 'aerial', bonusMovement: 20, costMovementType: 'ground', costMovement: 10, benefit: '<p>Fly.</p>', cost: '<p>Slow.</p>' } });

  test('Overload: the benefit for a Free action until the lender\'s turn, or the cost after a test against Evasion', async () => {
    const alt = await import('../mechanics/characters/alteration-adjustments.mjs');
    const viper = makeActor('Viper', FILES.overload, { extra: [wing()] });
    const foe = makeActor('Foe', [], { type: 'npc', disposition: -1 });
    scene(viper, foe);
    target(foe);
    const wings = itemNamed(viper, 'Wings');
    global.foundry.applications = { api: { DialogV2: { wait: jest.fn(async () => wings.id) } } };
    economySpend.mockClear();
    global.game.combat = { id: 'cb', round: 1, combatants: { contents: [] } };
    const line = await runUse(itemNamed(viper, 'Overload'), async () => true, { ask: async () => 0 });
    expect(economySpend).toHaveBeenCalledWith(viper, 'free', { source: 'Overload' });
    expect(alt.activeLends(foe)).toEqual([expect.objectContaining({ label: 'Overload: Wings', movement: { aerial: 20 }, expire: expect.objectContaining({ kind: 'startOfTurnOf', by: viper.uuid }) })]);
    expect(line).toContain('Fly.');
    // The cost: a Skill, a Move action, a test against Evasion.
    foe.flags.essence20.o1Lends = [];
    global.foundry.applications.api.DialogV2.wait = jest.fn().mockResolvedValueOnce(wings.id).mockResolvedValueOnce('science');
    viper._dice = { rollSkill: jest.fn(async () => ({ success: true, outcomes: [{ results: [{ total: 14 }] }] })) };
    economySpend.mockClear();
    await runUse(itemNamed(viper, 'Overload'), async () => true, { ask: async () => 1 });
    expect(economySpend).toHaveBeenCalledWith(viper, 'move', { source: 'Overload' });
    expect(viper._dice.rollSkill.mock.calls[0][0]).toMatchObject({ skill: 'science', dif: '10' });
    expect(alt.activeLends(foe)).toEqual([expect.objectContaining({ movement: { ground: -10 }, expire: expect.objectContaining({ kind: 'endOfNextTurn' }) })]);
    // No Alteration of your own: no button.
    const plain = makeActor('Plain', FILES.overload);
    scene(plain, foe);
    expect(await runUse(itemNamed(plain, 'Overload'), async () => true)).toBeNull();
  });

  test('Genetic Support offers the tiers its level allows; a cancelled choice costs nothing', async () => {
    const tech = makeActor('Tech', FILES.geneticSupport, { system: { level: 10 } });
    scene(tech);
    const offered = [];
    const pay = jest.fn(async () => true);
    await runUse(itemNamed(tech, 'Genetic Support'), pay, { ask: async (step, options) => {
      offered.push(options.map(option => option.label));
      return null;
    } });
    expect(offered).toEqual([['Standard', 'Limited']]);
    expect(pay).not.toHaveBeenCalled();
    const novice = makeActor('Novice', FILES.geneticSupport, { system: { level: 2 } });
    scene(novice);
    expect(await runUse(itemNamed(novice, 'Genetic Support'), pay)).toBeNull();
  });

  test('the Emulator: the kept Limited Alteration for a minute, then a DIF 20 Technology test to recharge', async () => {
    const alt = await import('../mechanics/characters/alteration-adjustments.mjs');
    const trooper = makeActor('Trooper', FILES.alterationEmulator);
    scene(trooper);
    const emulator = itemNamed(trooper, 'Advanced Alteration Emulator');
    emulator.flags.essence20 = { o1EmulatedUuid: 'Compendium.x.Item.wings' };
    docs.set('Compendium.x.Item.wings', wing());
    global.game.combat = { id: 'cb', round: 2, combatants: { contents: [] } };
    const pay = jest.fn(async () => true);
    await runUse(emulator, pay);
    expect(pay).toHaveBeenCalledWith('standard');
    expect(alt.activeLends(trooper)).toEqual([expect.objectContaining({ movement: { aerial: 20, ground: -10 }, expire: expect.objectContaining({ kind: 'rounds', rounds: 10 }) })]);
    expect(emulator.flags.essence20.o1EmulatorSpent).toBe(true);
    rebuildIndex(trooper);
    trooper._dice = { rollSkill: jest.fn(async () => ({ success: true, outcomes: [{ results: [{ total: 22 }] }] })) };
    pay.mockClear();
    await runUse(emulator, pay);
    expect(trooper._dice.rollSkill.mock.calls[0][0]).toMatchObject({ skill: 'technology', dif: '20' });
    expect(pay).not.toHaveBeenCalled();
    expect(emulator.flags.essence20.o1EmulatorSpent).toBe(false);
  });
});

/* -------------------------------------------- */
/*  Rigged explosions                            */
/* -------------------------------------------- */

describe('Destructive Overcharge and Cascading Failure: rigged equipment, delayed cards and blasts', () => {
  const press = data => pressRuleButton({ flags: clone(data.flags), update: jest.fn() });
  const buttonCards = () => createCalls().filter(data => data.flags?.essence20?.ruleButton);

  test('Destructive Overcharge: due at the end of the rigger\'s next turn; a Technology test against the chosen Defense of everyone within 20 ft', async () => {
    const { scheduledTurnEnd } = await import('./plugins/combat/rigs-and-blasts.mjs');
    const rigger = makeActor('Rigger', FILES.destructiveOvercharge, { extra: [{ name: 'Radio', type: 'gear', system: { traits: ['computerized'] } }] });
    const foe = makeActor('Foe', [], { type: 'npc', x: 10, disposition: -1 });
    const far = makeActor('Far', [], { type: 'npc', x: 60, disposition: -1 });
    scene(rigger, foe, far);
    const radio = itemNamed(rigger, 'Radio');
    global.foundry.applications = { api: { DialogV2: { wait: jest.fn(async () => radio.id) } } };
    const [mine] = combatOf([[rigger, 10], [foe, 5]]);
    const pay = jest.fn(async () => true);
    await runUse(itemNamed(rigger, 'Destructive Overcharge'), pay);
    expect(pay).toHaveBeenCalledWith('standard');
    expect(buttonCards()).toHaveLength(0);
    await scheduledTurnEnd(rigger, global.game.combat);
    expect(buttonCards()).toHaveLength(0);
    await scheduledTurnEnd(rigger, global.game.combat);
    const [explode] = buttonCards();
    expect(explode.flags.essence20.ruleButton.label).toBe('Explode');
    // Pressed: Evasion, the blast catches the rigger and the foe within 20 ft, not the far one.
    global.foundry.applications.api.DialogV2.wait = jest.fn(async () => '1');
    rigger._dice = { rollSkill: jest.fn(async () => ({ outcomes: [{ results: [{ targetUuid: foe.uuid, success: true, multiplier: 2 }, { targetUuid: rigger.uuid, success: false }] }] })) };
    await press(explode);
    expect(rigger._dice.rollSkill.mock.calls[0][0]).toMatchObject({ skill: 'technology', defenseType: 'evasion' });
    expect(global.canvas.tokens.setTargets).toHaveBeenCalledWith([rigger.token.id, foe.token.id]);
    const blast = createCalls().at(-1).content;
    expect(blast).toContain(`data-target-uuid="${foe.uuid}" data-damage="2" data-damage-type="fire"`);
    expect(blast).not.toContain(rigger.uuid);
    expect(mine).toBeTruthy();
  });

  test('Destructive Overcharge out of combat, on what a target holds: the card comes at once, and the holder takes 3 Fire', async () => {
    const rigger = makeActor('Rigger', FILES.destructiveOvercharge);
    const holder = makeActor('Holder', [], { type: 'npc', x: 15, disposition: -1 });
    scene(rigger, holder);
    target(holder);
    await runUse(itemNamed(rigger, 'Destructive Overcharge'), async () => true);
    const [explode] = buttonCards();
    global.foundry.applications = { api: { DialogV2: { wait: jest.fn(async () => '0') } } };
    rigger._dice = { rollSkill: jest.fn(async () => ({ outcomes: [{ results: [] }] })) };
    holder.token.center.x = 200;
    await press(explode);
    expect(createCalls().some(data => String(data.content).includes(`data-target-uuid="${holder.uuid}" data-damage="3" data-damage-type="fire"`))).toBe(true);
    expect(rigger._dice.rollSkill.mock.calls[0][0].defenseType).toBe('toughness');
  });

  test('Cascading Failure: disable or explode from the cards; a timer ends the rig', async () => {
    const { scheduledRoundStart } = await import('./plugins/combat/rigs-and-blasts.mjs');
    const tech = makeActor('Tech', FILES.cascadingFailure, { system: { skills: {} } });
    const near = makeActor('Near', [], { x: 10, system: { skills: { athletics: { shift: 'd6', modifier: 0 } } } });
    scene(tech, near);
    global.foundry.applications = { api: { DialogV2: { prompt: jest.fn(async () => 0) } } };
    // A large device (30 ft), no timer: Explode rolls 2d4 and each creature saves for half.
    await runUse(itemNamed(tech, 'Cascading Failure'), async () => true, { ask: async () => 2 });
    let [disable, explode] = buttonCards();
    expect([disable.flags.essence20.ruleButton.label, explode.flags.essence20.ruleButton.label]).toEqual(['Disable it (Free action)', 'Explode (Standard action)']);
    global.Roll = rollClass(6, 20);
    await press(explode);
    const card = createCalls().at(-1);
    expect(card.content).toContain('It explodes: 6 Fire damage within 30 ft');
    expect(card.content).toContain(`data-target-uuid="${near.uuid}" data-damage="3" data-damage-type="fire"`);
    // That rig is gone now: the Disable card does nothing.
    global.ChatMessage.create.mockClear();
    await press(disable);
    expect(allChat()).toContain('That rig is gone.');
    // A timed rig in combat stops working when its round comes.
    global.ChatMessage.create.mockClear();
    combatOf([[tech, 10], [near, 5]]);
    global.foundry.applications.api.DialogV2.prompt = jest.fn(async () => 2);
    await runUse(itemNamed(tech, 'Cascading Failure'), async () => true, { ask: async () => 0 });
    [disable, explode] = buttonCards();
    global.game.combat.round = 3;
    await scheduledRoundStart(global.game.combat, [tech]);
    expect(allChat()).toContain('Its time is up');
    global.ChatMessage.create.mockClear();
    await press(explode);
    expect(allChat()).toContain('That rig is gone.');
  });

  test('Cascading Failure on a targeted vehicle: it explodes as itself', async () => {
    const tech = makeActor('Tech', FILES.cascadingFailure);
    const truck = makeActor('Truck', [], { type: 'vehicle', x: 10 });
    scene(tech, truck);
    target(truck);
    global.foundry.applications = { api: { DialogV2: { prompt: jest.fn(async () => 0) } } };
    await runUse(itemNamed(tech, 'Cascading Failure'), async () => true);
    const [, explode] = buttonCards();
    await press(explode);
    expect(explodeVehicle).toHaveBeenCalledWith(truck);
  });
});

/* -------------------------------------------- */
/*  Restraining Gear                             */
/* -------------------------------------------- */

describe('Restraining Gear: after a melee hit, 1 Personal Power from the pilot for an opposed Brawn or Might roll to restrain', () => {
  const melee = { isAttack: true, isMelee: true, item: { type: 'weaponEffect', system: { classification: { style: 'melee' } } } };
  const hit = (actor, foe) => fireTriggers(actor, 'hit', { roll: melee, outcome: 'success', targets: [foe], facts: { results: [{ success: true }] } });

  test('the Zord\'s own hit; the driver pays; the target is Restrained when the Zord rolls higher', async () => {
    const pilot = makeActor('Pilot', [], { system: { powers: { personal: { value: 2, max: 4 } } } });
    const zord = makeActor('Zord', FILES.restrainingGear, { type: 'zord', system: { skills: { might: { shift: 'd8' }, brawn: { shift: 'd4' } } } });
    zord.system.actors = { p: { uuid: pilot.uuid, vehicleRole: 'driver' } };
    const foe = makeActor('Foe', [], { type: 'npc', disposition: -1, system: { skills: { brawn: { shift: 'd6' } } } });
    scene(pilot, zord, foe);
    await hit(zord, foe);
    const posted = createCalls().find(data => data.flags?.essence20?.ruleButton);
    expect(posted.flags.essence20.ruleButton).toMatchObject({ label: 'Restrain Foe? (1 Personal Power)', who: 'anyone' });
    global.Roll = rollClass(15, 12);
    const formulas = [];
    const Base = global.Roll;
    global.Roll = class extends Base {
      constructor(formula) {
        super(formula);
        formulas.push(formula);
      }
    };
    await pressRuleButton({ flags: clone(posted.flags), update: jest.fn() });
    expect(formulas).toEqual(['1d20 + 1d8', '1d20 + 1d6']);
    expect(pilot.system.powers.personal.value).toBe(1);
    expect(zord.system.powers.personal.value).toBe(3);
    expect(applyTimedCondition).toHaveBeenCalledWith(foe, 'restrained', 0);
    // A tie goes to the target; no Power, no roll.
    applyTimedCondition.mockClear();
    global.Roll = rollClass(12, 12);
    await pressRuleButton({ flags: clone(posted.flags), update: jest.fn() });
    expect(applyTimedCondition).not.toHaveBeenCalled();
    pilot.system.powers.personal.value = 0;
    global.ui = { notifications: { warn: jest.fn() } };
    await pressRuleButton({ flags: clone(posted.flags), update: jest.fn() });
    expect(global.ui.notifications.warn).toHaveBeenCalled();
    // A ranged hit offers nothing.
    global.ChatMessage.create.mockClear();
    await fireTriggers(zord, 'hit', { roll: { isAttack: true, isMelee: false, item: { type: 'weaponEffect', system: { classification: { style: 'ranged' } } } }, outcome: 'success', targets: [foe], facts: { results: [{ success: true }] } });
    expect(createCalls()).toHaveLength(0);
  });
});
