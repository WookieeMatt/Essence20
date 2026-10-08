import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Round 15, items2 (docs/rules-batches/slItems215.md): the survey's "piece" items of the items2 part, now each item's own
 * rules. Each item is loaded from its pack source and must do what the removed code (and its old tests) did.
 */

global.Hooks = { on: () => 0, once: () => 0, callAll: () => {} };

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
  computeMultiplier: (total, dif) => (total >= dif ? 1 + Math.floor((total - dif) / 10) : 0),
  getDefenseValue: (actor, type) => Number(actor.system?.defenses?.[type]?.total) || 0,
  buildCheckChatData: jest.fn(async (roll, data) => ({ ...data, rolls: [roll] })),
}));
const rerolls = [];
jest.unstable_mockModule('./mechanics/rolls/reroll.mjs', () => ({
  applyReroll: jest.fn(async (roll, config) => {
    rerolls.push(config.target);
    return true;
  }),
}));
let picks = [];
const grants = {
  chooseSelect: jest.fn(async (title, prompt, options) => {
    const answer = picks.shift();
    return options.find(option => option.label == answer || option.value == answer)?.value ?? null;
  }),
  chooseButtons: jest.fn(async (title, prompt, choices) => {
    const answer = picks.shift();
    return choices.find(([value, label]) => label == answer || value == answer)?.[0] ?? null;
  }),
  rollTest: jest.fn(async () => ({ success: true })),
  findItems: jest.fn(async () => []),
  pickOne: jest.fn(async () => null),
  essenceRedirect: (actor, role, essence) => essence,
  // A compendium copy on the actor (pickGrant) - the test's fromUuid entries.
  grantCopy: jest.fn(async (actor, uuid, { grantedBy = null, flags = {} } = {}) => {
    const source = await global.fromUuid(uuid);
    if (!source) {
      return null;
    }

    const data = source.toObject ? source.toObject() : { name: source.name, type: source.type, system: source.system ?? {} };
    data.flags = { core: { sourceId: uuid }, essence20: { ...(data.flags?.essence20 ?? {}), ...flags, grantedBy: grantedBy?.id ?? null } };
    const [created] = await actor.createEmbeddedDocuments('Item', [data]);
    return created;
  }),
};
jest.unstable_mockModule('./mechanics/resources/grants.mjs', () => grants);
jest.unstable_mockModule('./mechanics/world/gm-relay.mjs', () => ({ needsGmRelay: () => false, relayToGm: jest.fn() }));
const spent = [];
jest.unstable_mockModule('./mechanics/actions/action-economy.mjs', () => ({
  spend: jest.fn(async (actor, action) => {
    spent.push({ name: actor.name, action });
    return {};
  }),
  grantActionsThisTurn: jest.fn(async () => {}),
  isTracking: () => true,
  getLedger: () => null,
}));
// Allies the system way (getNearbyAllyTokens): same disposition, within range on the test canvas.
const nearby = {
  getNearbyAllyTokens: jest.fn((actor, feet) => canvas.tokens.placeables.filter(token => token.actor !== actor
    && token.document.disposition == actor.token?.document?.disposition && Math.abs(token.center.x - actor.token.center.x) <= feet)),
  getAllNearbyTokens: jest.fn(() => []),
  pickAllyTargets: jest.fn(async (actor, candidates, title, max) => {
    const targeted = [...(game.user.targets ?? [])].map(token => token.actor).filter(a => a && a !== actor);
    return targeted.length ? targeted : candidates.slice(0, max);
  }),
};
jest.unstable_mockModule('./mechanics/combat/nearby-allies.mjs', () => nearby);
const storyPointSpends = [];
jest.unstable_mockModule('./mechanics/resources/story-points.mjs', () => ({
  spendForActor: jest.fn(async (actor, amount, options) => storyPointSpends.push({ name: actor.name, amount, options })),
}));

// A granted copy's children (rules/lifecycle.mjs#attachGrantedChildren) - none in these tests.
jest.unstable_mockModule('./sheet-handlers/attachment-handler.mjs', () => ({ createItemCopies: jest.fn(async () => {}), setEntryAndAddItem: jest.fn(async () => {}) }));
let points = [];
jest.unstable_mockModule('./mechanics/combat/forced-movement.mjs', () => ({
  pickCanvasPoint: jest.fn(async () => points.shift() ?? null),
  distanceFeet: (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
  placeActorAt: jest.fn(async () => true),
}));

const lendAssist = { lendAssistanceSkill: jest.fn(async () => true), activateLendAssistance: jest.fn(async () => ({ message: 'assisted' })) };
jest.unstable_mockModule('./mechanics/actions/lend-assistance.mjs', () => lendAssist);

await import('./plugins/index.mjs');
const { rebuildIndex } = await import('./index.mjs');
const { fireTriggers, runUse, useAvailable } = await import('./triggers.mjs');
const { pressRuleButton } = await import('./buttons.mjs');
const { validateRule } = await import('./types.mjs');
const { costRulesFor } = await import('./actions.mjs');
const { ruleAssist, ruleDialogSwitches, ruleRollSources, ruleSpecializes } = await import('./adapter.mjs');
const { recordUse } = await import('./limits.mjs');
const { pickHelpers, payForAssist, ruleAssistPayment } = await import('./plugins/picks/cross-item-picks.mjs');
const { rollSeen } = await import('./plugins/tags/world-watch.mjs');
const { onSkillTestPosted, resetRecentRolls } = await import('./plugins/rolls/recent-rolls.mjs');
const { expertiseHelpers, ruleEnvironmentalExpertise, sharedExpertiseEnvironments } = await import('./plugins/effects/environmental-expertise-rule.mjs');
const { lazy } = await import('./plugins/shared/lazy-helpers-and-targets.mjs');
const { consumeDamageShield, damageShieldsOf } = await import('./plugins/combat/damage-shield.mjs');
const { markedTargetSources } = await import('./plugins/marks/rule-marks.mjs');
const { setStoryPointHelpers } = await import('./steps.mjs');
const { setWorldLookups } = await import('./predicate.mjs');
const { bankedSources } = await import('./bank.mjs');
const { offersFor, pressOffer } = await import('./plugins/cards/card-offer.mjs');
const { onStoryPointsPaid } = await import('./plugins/resources/story-points-paid-event.mjs');
const { ruleNaturalTwentyMultiplier } = await import('./plugins/rolls/natural-twenty.mjs');
const { ruleSuppressesFumbleStoryPoint } = await import('./plugins/rolls/no-fumble-story-point.mjs');
const { versusHelpers } = await import('./plugins/cards/names-and-whisper.mjs');
const { onRolePointsToggled } = await import('./plugins/resources/role-points-events.mjs');
const { pressCardButton } = await import('./plugins/cards/card-buttons.mjs');
const { immunityHelpers } = await import('./plugins/tags/condition-immune-tag.mjs');
const { chassisHelpers, mimicrySizeOk, sizeClass } = await import('./plugins/picks/chassis-picks.mjs');

// Allies for ally:/allies: recipients - the mocked getNearbyAllyTokens above.
setWorldLookups({ alliesWithin: (actor, feet) => nearby.getNearbyAllyTokens(actor, feet).map(token => token.actor) });

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));
const P = {
  toughItOut: 'tfcrbitems/_source/Tough_It_Out_B6b8dRybHodMv8aC.json',
  standTogether: 'tfcrbitems/_source/Stand_Together_IXJYw6NYiVv32krl.json',
  preventative: 'tfcrbitems/_source/Preventative_Measures_vFuXVVp6vIDFNbci.json',
  battleHardened: 'gijcrbitems/_source/Battle_Hardened_fbmfn6iNGjlm3voE.json',
  battleHardenedDd: 'dditems/_source/Battle_Hardened_iA8J97GmKb51oumg.json',
  timeToThink: 'mlpcrbitems/_source/Time_To_Think_aoqbVibH10pj8rn7.json',
  betterThanTheBest: 'ghpfitems/_source/Better_than_the_Best_1Xy3GpglIFAq3sqc.json',
  agency: 'atsitems/_source/Agency_QZpWbKjMxMdahpoL.json',
  oneUpping: 'atsitems/_source/One_Upping_ztdjBJ7H7WJiIH9i.json',
  touchMove: 'gijcrbitems/_source/Touch_Move_wv5vpbiCZXiwTpdm.json',
  martialArtist: 'gijcrbitems/_source/Martial_Artist_9Elbb94OPCPVSTxL.json',
  queensGambit: 'gijcrbitems/_source/Queen_s_Gambit_Frf5wHlBS2Tn24yB.json',
  notLikeThat: 'eocitems/_source/Not_Like_That__Like_This__OrK3XyNIyJcorMxp.json',
  influential: 'gijcrbitems/_source/Influential_TyQoZb2RTZWUwbpu.json',
  funExhaustion: 'mlpcrbitems/_source/Fun_Exhaustion_FDd42qmdJBx0eTbE.json',
  beAnExample: 'atsitems/_source/Be_An_Example_zkxPG5mwAQl1vZOT.json',
  elementalShield: 'bthitems/_source/Elemental_Shield_3kcNR23zhInxqKQp.json',
  scramble: 'tsitems/_source/Scramble_Field_Generator_cIki3qTlr4gZed5f.json',
  helpYourself: 'mlpcrbitems/_source/Help_Yourself_EKCz40TU8BYtcSkN.json',
  temperTempest: 'kocitems/_source/Temper_Tempest_qwUMlRGUBOSoZJEI.json',
  moreBang: 'kocitems/_source/More_Bang_for_your_Buck_mfS0v8KAhBcLCC9e.json',
  terror: 'bthitems/_source/Terror_yBBB0Mi6fr84YcSd.json',
  anonymous: 'ccitems/_source/Anonymous_yFikSROr3NzaEoaL.json',
  solidEnergon: 'dditems/_source/Solid_State_Energon_aUxtcuKUb40JYoqx.json',
  glitch: 'dditems/_source/They_Called_It_A_Glitch__IKPWMfs5ZSp6ijiv.json',
  mimicry: 'dditems/_source/Alt_Mode_Mimicry_ARtFFscnVBo183hV.json',
  drone: 'dditems/_source/Drone_ZdvE8MB35jg1A8wK.json',
  artillery: 'gijcrbitems/_source/Artillery_Support_MrDZK2ifJWpiH24D.json',
  selfImprovement: 'mlpcrbitems/_source/Self_Improvement_COOAlcYNeoScFiAE.json',
  guardianBlast: 'ttsgitems/_source/Guardian_Blast_GuardianBlast000.json',
  perfectPlacement: 'eocitems/_source/Perfect_Placement_wueeFv0eN8eh7RbS.json',
  elementalFury: 'ttsgitems/_source/Elemental_Fury_larsGRE5U4ZOVxzw.json',
  motorPool: 'qgtgitems/_source/Motor_Pool_Connections_Lyb8wPzI0XUuwF3o.json',
  thirdDimension: 'tfcrbitems/_source/Third_Dimension_4pyOcetfAuXZlXmH.json',
  unexpectedAlternative: 'tfcrbitems/_source/Unexpected_Alternative_UNe8N1eZWjWxDTIz.json',
  delegate: 'ghpfitems/_source/Delegate_DQFDOrYUZmZZxmi1.json',
  secretHelper: 'mlpcrbitems/_source/Secret_Helper_Vb3CAaAj9d1a63p7.json',
  rapidRescue: 'atsitems/_source/Rapid_Rescue_Response_pcavWqFi6FZ8QBAf.json',
  relicKey: 'prcrbitems/_source/Relic_Key_uSlClAv3oJjf54pa.json',
  flyInTheFuture: 'gijcrbitems/_source/Fly_In_The_Future_rFeczlniKUs8Rk3q.json',
  zordFeatureSlot: 'prcrbitems/_source/Zord_Feature_Zd2ZordFeatSlot1.json',
  zordUltraMode: 'fgtaaitems/_source/Zord_Ultra_Mode_LoLucUviYKvUq5XR.json',
  versatileCombiner: 'ttsgitems/_source/Versatile_Combiner_XbRfajp9KwfzDG5c.json',
  megaWeapon: 'prcrbitems/_source/Zord_Mega_Weapon_System_Wc1FJ5YDeTQS6XoE.json',
  timeslide: 'jttitems/_source/Timeslide_e70Jm3uH5A3mKmSM.json',
  friendshipIsMystical: 'mlpcrbitems/_source/Friendship_Is_Mystical_jCh9Z1Nhb6SeiapO.json',
  reckless: 'gijcrbitems/_source/Reckless_Abandon_84d0XTJwKCYMJUgY.json',
  aegis: 'gijcrbitems/_source/Aegis_0ZTjZ36gN74889am.json',
  bff: 'mlpcrbitems/_source/BFF_b7qT0W4L9Ito2EB2.json',
  cooler: 'mlpcrbitems/_source/About_Twenty_Percent_Cooler_IeOmY0keh5oD2n3l.json',
  leaveItToMe: 'mlpcrbitems/_source/Leave_It_To_Me_DzxvaaVz47CVyKhF.json',
  bestFriends: 'mlpcrbitems/_source/That_s_What_Best_Friends_Are_For_WVcMWLcsMX4u9pY3.json',
  betterTogether: 'ttsgitems/_source/Better_Together_tOoyMHVtV6wjvlxd.json',
  betterTogetherHangUp: 'ttsgitems/_source/Better_Together_7WzxxG6T7kF6daMY.json',
  competitive: 'mlpcrbitems/_source/Competitive_Vk2EFSSBfmunP5fk.json',
  takeInAScene: 'mlpcrbitems/_source/Take_in_a_Scene_gT6SEHJIK6ob0v7T.json',
  misplaced: 'mlpcrbitems/_source/Misplaced_Confidence_LcKUw5rQd19ovk4I.json',
  environmentalExpertise: 'gijcrbitems/_source/Environmental_Expertise_EbbSUA2vSHyv3MjQ.json',
  readTheLand: 'iafav2items/_source/Read_the_Land_j8wVLLK4XvVEuP6F.json',
  inTheirElement: 'gijcrbitems/_source/In_Their_Element_UkAgppAPli6yrImr.json',
  guidance: 'gijcrbitems/_source/Guidance_yVxdYbSfMWfaDQZR.json',
  adaptedVehicle: 'gijcrbitems/_source/Adapted_Vehicle__Environmental__ht26M90320SgdhMK.json',
  enforcer: 'ghpfitems/_source/Environmental_Enforcer_eZuijWvAUzOXD8DR.json',
};
// The items the rules read by book source.
const BOOK = {
  agencyPerk: 'Compendium.essence20.across_the_stars.Item.bGKG7artYs7uHHz4',
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
    const parts = key.split('.');
    if (parts[parts.length - 1].startsWith('-=')) {
      const last = parts.pop().slice(2);
      delete getPath(doc, parts.join('.'))?.[last];
    } else {
      setPath(doc, key, value);
    }
  }

  if (doc.documentName == 'Actor') {
    rebuildIndex(doc);
  } else if (doc.parent?.items) {
    rebuildIndex(doc.parent);
  }
}

function makeItem(data) {
  const item = { flags: {}, system: {}, effects: [], ...data, async update(changes) {
    await applyUpdate(this, changes);
  } };
  item.id ??= `i${nextId++}`;
  item.uuid ??= `Item.${item.id}`;
  item.flags.essence20 ??= {};
  return item;
}

/** An item from a pack source file (its own rules), with its compendium id as its source. */
function packItem(key, extra = {}) {
  const doc = fromPack(P[key]);
  return { name: doc.name, type: doc.type, system: JSON.parse(JSON.stringify(doc.system)), flags: { core: { sourceId: `Compendium.essence20.x.Item.${doc._id}` }, essence20: {} }, ...extra };
}

/** A plain item standing for a book entry the rules ask about by source. */
const bookItem = (uuid, extra = {}) => ({ name: extra.name ?? 'Thing', type: extra.type ?? 'perk', system: extra.system ?? {}, flags: { core: { sourceId: uuid }, essence20: { ...(extra.flags ?? {}) } } });

function makeActor(name, { items = [], x = 0, disposition = 1, system = {}, statuses = [], flags = {}, type = 'playerCharacter', token = true } = {}) {
  const actor = {
    id: `a${nextId++}`, name, type, documentName: 'Actor', isOwner: true, statuses: new Set(statuses), flags: { essence20: { ...flags } },
    system: {
      level: 5, health: { value: 10, max: 10, bonus: 0 }, defenses: { willpower: { total: 12 }, toughness: { total: 13 }, evasion: { total: 11 } },
      powers: { personal: { value: 3, max: 3 } }, skills: {}, essences: { strength: { value: 4 }, speed: { value: 4 }, smarts: { value: 4 }, social: { value: 4 } },
      ...system,
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
    testUserPermission: () => true,
    toggleStatusEffect: jest.fn(async function (status, { active }) {
      if (active) {
        this.statuses.add(status);
      } else {
        this.statuses.delete(status);
      }
    }),
    createEmbeddedDocuments: jest.fn(async (kind, datas) => datas.map(data => actor.addItem(data))),
    deleteEmbeddedDocuments: jest.fn(async (kind, ids) => {
      for (const id of ids) {
        const at = list.findIndex(item => item.id == id);
        if (at >= 0) {
          list.splice(at, 1);
        }
      }

      rebuildIndex(actor);
    }),
    _dice: { rollSkill: jest.fn(async () => ({ success: true, outcomes: [] })) },
  };
  actor.uuid = `Actor.${actor.id}`;
  const tokenDoc = { id: `t${actor.id}`, actor, document: { disposition }, center: { x, y: 0 } };
  actor.getActiveTokens = () => (token ? [tokenDoc] : []);
  actor.token = token ? tokenDoc : null;
  const list = [];
  actor.items = {
    contents: list, get: id => list.find(item => item.id == id), find: fn => list.find(fn), some: fn => list.some(fn), filter: fn => list.filter(fn),
    [Symbol.iterator]: () => list[Symbol.iterator](),
  };
  actor.addItem = data => {
    const item = makeItem(data);
    item.parent = item.actor = actor;
    list.push(item);
    rebuildIndex(actor);
    return item;
  };

  items.forEach(data => actor.addItem(data));
  rebuildIndex(actor);
  game.actors.contents.push(actor);
  if (token) {
    canvas.tokens.placeables.push(tokenDoc);
  }

  return actor;
}

function target(...actors) {
  game.user.targets = new Set(actors.map(actor => actor.token));
  game.user.targets.first = () => actors[0]?.token;
}

const pay = jest.fn(async () => true);
const itemNamed = (actor, name) => actor.items.contents.find(item => item.name == name);
const use = (item, { option = 0, which = null } = {}) => runUse(item, pay, {
  ask: async () => option,
  ...(which === null ? {} : { pick: async (it, available) => available.find(({ rule }) => rule.label == which) ?? null }),
});
const cards = () => ChatMessage.create.mock.calls.map(([data]) => data);
const buttonCards = () => cards().filter(data => data.flags?.essence20?.ruleButton);
const startCombat = (round = 1, turn = 0, combatants = []) => {
  game.combat = { id: 'c1', started: true, round, turn, combatants, turns: combatants, get combatant() {
    return this.turns[this.turn] ?? null;
  } };
  game.combats = { get: id => (id == 'c1' ? game.combat : null) };
  return game.combat;
};

const combatant =(actor, initiative, extra = {}) => ({
  id: `cb${nextId++}`, actor, actorId: actor.id, name: actor.name, initiative, ...extra,
  async update(data) {
    Object.assign(this, data);
  },
});

async function pressLast(user = game.user) {
  const card = buttonCards().at(-1);
  card.update = async data => applyUpdate(card, data);
  return pressRuleButton(card, user);
}

/** A posted check card spoken by `roller`. */
function checkCard(roller, flags = {}, total = 8) {
  const message = {
    id: `m${nextId++}`, speaker: { actor: roller.id }, rolls: [{ total, formula: '1d20', dice: [{ faces: 20, total }], toJSON() {
      return this;
    } }],
    flags: { essence20: { checkResults: [], ...flags } },
    async update(data) {
      await applyUpdate(this, data);
    },
  };
  return message;
}

let numbers = [];
const storyHelpers = { canWriteStoryPoints: () => true, requestStoryPointGrant: jest.fn(async () => {}), poolFor: () => 'story', canSpendForActor: () => true, spendForActor: jest.fn() };
beforeEach(() => {
  for (const list of [timed, dealt, spent]) {
    list.length = 0;
  }

  picks = [];
  points = [];
  numbers = [];
  pay.mockClear();
  storyHelpers.requestStoryPointGrant.mockClear();
  setStoryPointHelpers(storyHelpers);
  resetRecentRolls();
  grants.rollTest.mockReset();
  grants.rollTest.mockImplementation(async () => ({ success: true, multiplier: 1 }));
  global.game = {
    combat: null, combats: null, user: { id: 'u', isGM: true, isActiveGM: true, targets: new Set() }, users: { contents: [{ id: 'u', isGM: true }, { id: 'p', isGM: false }] },
    i18n: { localize: k => k, format: (k, d) => `${k}${d ? ` ${JSON.stringify(d)}` : ''}`, has: () => false },
    settings: { get: () => 1, set: async () => {} }, actors: { contents: [], get: id => game.actors.contents.find(a => a.id == id) },
    scenes: { active: null },
  };
  game.user.targets.first = () => undefined;
  global.CONFIG = {
    E20: {
      damageTypes: { blunt: 'Blunt', fire: 'Fire' },
      skillToEssence: { targeting: 'speed', athletics: 'strength', brawn: 'strength', persuasion: 'social', science: 'smarts', technology: 'smarts' },
      skills: { athletics: 'A', technology: 'T' },
    },
  };
  global.canvas = {
    scene: null, tokens: { placeables: [], controlled: [], setTargets: jest.fn() },
    grid: { measurePath: ([a, b]) => ({ distance: Math.abs(a.x - b.x) }) },
  };
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn(), error: jest.fn() } };
  global.ChatMessage = { create: jest.fn(async data => data), getSpeaker: () => ({}), getSpeakerActor: speaker => game.actors.get(speaker?.actor) ?? null };
  global.fromUuidSync = uuid => game.actors.contents.find(actor => actor.uuid == uuid)
    ?? game.actors.contents.flatMap(actor => actor.items.contents).find(item => item.uuid == uuid) ?? null;
  global.fromUuid = async uuid => global.fromUuidSync(uuid);
  global.Roll = { fromData: data => ({ ...data, total: 15 }) };
  global.foundry = {
    utils: { getProperty: getPath, setProperty: setPath, hasProperty: (o, k) => getPath(o, k) !== undefined, deepClone: v => JSON.parse(JSON.stringify(v)), randomID: () => `r${nextId++}` },
    applications: { api: { DialogV2: { wait: jest.fn(async () => null), prompt: jest.fn(async () => numbers.shift() ?? null), confirm: jest.fn(async () => true) } } },
  };
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('every rule on the converted items validates', () => {
  for (const [key, file] of Object.entries(P)) {
    const rules = fromPack(file).system.rules ?? [];
    expect([key, rules.length > 0]).toEqual([key, true]);
    for (const rule of rules) {
      expect([key, rule.label, validateRule(rule)]).toEqual([key, rule.label, []]);
    }
  }
});

/* -------------------------------------------- */
/*  Healing                                      */
/* -------------------------------------------- */

describe('Tough It Out', () => {
  test('once per encounter: picks an amount, rolls Brawn at 5 + 5 x amount, repairs that much on a success', async () => {
    const bot = makeActor('Bot', { items: [packItem('toughItOut')], system: { health: { value: 3, max: 10, bonus: 0 } } });
    numbers = [3];
    await use(itemNamed(bot, 'Tough It Out'));
    expect(grants.rollTest).toHaveBeenCalledWith(bot, 'brawn', 20, expect.any(Object));
    expect(bot.system.health.value).toBe(6);
    // Used up for the encounter.
    numbers = [1];
    expect(await use(itemNamed(bot, 'Tough It Out'))).toBeNull();
    expect(grants.rollTest).toHaveBeenCalledTimes(1);
  });

  test('a failed roll repairs nothing (the use is still spent); a cancelled amount rolls nothing and costs nothing', async () => {
    const bot = makeActor('Bot', { items: [packItem('toughItOut')], system: { health: { value: 3, max: 10, bonus: 0 } } });
    numbers = [null];
    await use(itemNamed(bot, 'Tough It Out'));
    expect(grants.rollTest).not.toHaveBeenCalled();
    grants.rollTest.mockImplementation(async () => ({ success: false, multiplier: 0 }));
    numbers = [2];
    await use(itemNamed(bot, 'Tough It Out'));
    expect(bot.system.health.value).toBe(3);
    numbers = [2];
    expect(await use(itemNamed(bot, 'Tough It Out'))).toBeNull();
  });

  test('a Defeated actor brought above 0 is no longer Defeated (as applyHealSkillTestResult did)', async () => {
    const bot = makeActor('Bot', { items: [packItem('toughItOut')], system: { health: { value: 0, max: 10, bonus: 0 } }, statuses: ['defeated'] });
    numbers = [2];
    await use(itemNamed(bot, 'Tough It Out'));
    expect(bot.system.health.value).toBe(2);
    expect(bot.statuses.has('defeated')).toBe(false);
  });
});

describe('Stand Together', () => {
  test('once per scene: Persuasion DIF 15; every ally repairs 1 x the Degrees of Success', async () => {
    const leader = makeActor('Leader', { items: [packItem('standTogether')] });
    const near = makeActor('Near', { x: 30, system: { health: { value: 2, max: 10, bonus: 0 } } });
    const far = makeActor('Far', { x: 500, system: { health: { value: 2, max: 10, bonus: 0 } } });
    const foe = makeActor('Foe', { x: 10, disposition: -1, system: { health: { value: 2, max: 10, bonus: 0 } } });
    grants.rollTest.mockImplementation(async () => ({ success: true, multiplier: 3 }));
    await use(itemNamed(leader, 'Stand Together'));
    expect(grants.rollTest).toHaveBeenCalledWith(leader, 'persuasion', 15, expect.any(Object));
    expect([near.system.health.value, far.system.health.value, foe.system.health.value]).toEqual([5, 5, 2]);
    expect(await use(itemNamed(leader, 'Stand Together'))).toBeNull();
  });

  test('a failure heals nobody', async () => {
    const leader = makeActor('Leader', { items: [packItem('standTogether')] });
    const near = makeActor('Near', { x: 30, system: { health: { value: 2, max: 10, bonus: 0 } } });
    grants.rollTest.mockImplementation(async () => ({ success: false, multiplier: 0 }));
    await use(itemNamed(leader, 'Stand Together'));
    expect(near.system.health.value).toBe(2);
  });
});

describe('Preventative Measures', () => {
  test('a healthy, untreated ally: Science or Technology at 5 + 5 x amount, Temporary Health on a success, once a day each', async () => {
    const medic = makeActor('Medic', { items: [packItem('preventative')] });
    const ally = makeActor('Ally', { x: 10 });
    numbers = [2, 1];
    await use(itemNamed(medic, 'Preventative Measures'), { option: 1 });
    expect(grants.rollTest).toHaveBeenCalledWith(medic, 'technology', 15, expect.any(Object));
    expect(ally.system.health.bonus).toBe(2);
    // Treated today (and now holding Temporary Health): not offered again.
    ally.system.health.bonus = 0;
    nearby.pickAllyTargets.mockClear();
    await use(itemNamed(medic, 'Preventative Measures'));
    expect(nearby.pickAllyTargets.mock.calls[0][1]).toEqual([]);
  });

  test('an ally with damage or Temporary Health is refused, warned, nothing rolled', async () => {
    const medic = makeActor('Medic', { items: [packItem('preventative')] });
    const hurt = makeActor('Hurt', { x: 10, system: { health: { value: 4, max: 10, bonus: 0 } } });
    target(hurt);
    await use(itemNamed(medic, 'Preventative Measures'));
    expect(ui.notifications.warn).toHaveBeenCalledWith('E20.PreventativeMeasuresNoEligibleTarget');
    expect(grants.rollTest).not.toHaveBeenCalled();
    const temp = makeActor('Temp', { x: 10, system: { health: { value: 10, max: 10, bonus: 1 } } });
    target(temp);
    await use(itemNamed(medic, 'Preventative Measures'));
    expect(grants.rollTest).not.toHaveBeenCalled();
  });

  test('the once-a-day mark runs out when the calendar date changes, and is per Medic', async () => {
    const medic = makeActor('Medic', { items: [packItem('preventative')] });
    const other = makeActor('Other', { items: [packItem('preventative')] });
    const ally = makeActor('Ally', { x: 10 });
    target(ally);
    numbers = [1];
    await use(itemNamed(medic, 'Preventative Measures'));
    ally.system.health.bonus = 0;
    const mark = Object.entries(ally.flags.essence20.ruleMarks).find(([key]) => key.startsWith('preventativeMeasures'))[1];
    expect(mark.until).toBe('calendarDay');
    // Another Medic may still treat them today.
    numbers = [1];
    grants.rollTest.mockClear();
    await use(itemNamed(other, 'Preventative Measures'));
    expect(grants.rollTest).toHaveBeenCalledTimes(1);
    // Yesterday's mark doesn't count.
    ally.system.health.bonus = 0;
    mark.stamp.day = '2000-01-01';
    numbers = [1];
    grants.rollTest.mockClear();
    await use(itemNamed(medic, 'Preventative Measures'));
    expect(grants.rollTest).toHaveBeenCalledTimes(1);
  });
});

/* -------------------------------------------- */
/*  Resources, rolls                             */
/* -------------------------------------------- */

describe('Battle Hardened (both)', () => {
  test.each(['battleHardened', 'battleHardenedDd'])('%s: a shared-pool spend gets its points back on a d4 roll of 4, never otherwise', async key => {
    const joe = makeActor('Joe', { items: [packItem(key)] });
    jest.spyOn(Math, 'random').mockReturnValue(0.99);
    await onStoryPointsPaid(joe, 2, 'story');
    expect(storyHelpers.requestStoryPointGrant).toHaveBeenCalledWith(joe, 2, { pool: 'story' });
    Math.random.mockReturnValue(0.5);
    storyHelpers.requestStoryPointGrant.mockClear();
    await onStoryPointsPaid(joe, 1, 'story');
    expect(storyHelpers.requestStoryPointGrant).not.toHaveBeenCalled();
    // The GM's pool is never refunded.
    Math.random.mockReturnValue(0.99);
    await onStoryPointsPaid(joe, 1, 'gm');
    expect(storyHelpers.requestStoryPointGrant).not.toHaveBeenCalled();
  });

  test('without the Perk nothing is rolled', async () => {
    const joe = makeActor('Joe');
    jest.spyOn(Math, 'random').mockReturnValue(0.99);
    await onStoryPointsPaid(joe, 1, 'story');
    expect(storyHelpers.requestStoryPointGrant).not.toHaveBeenCalled();
  });
});

describe('Time To Think', () => {
  test('at combat start, the holder last in Initiative (ties count) banks an Edge for the next roll', async () => {
    const pony = makeActor('Pony', { items: [packItem('timeToThink')] });
    const tied = makeActor('Tied', { items: [packItem('timeToThink')] });
    const fast = makeActor('Fast', { items: [packItem('timeToThink')] });
    const noRoll = makeActor('NoRoll');
    startCombat(1, 0, [combatant(fast, 18), combatant(pony, 4), combatant(tied, 4), combatant(noRoll, null)]);
    for (const actor of [pony, tied, fast]) {
      await fireTriggers(actor, 'combatStart');
    }

    expect(bankedSources(pony, null, {}).sources.map(s => s.edge)).toEqual([true]);
    expect(bankedSources(tied, null, {}).sources.map(s => s.edge)).toEqual([true]);
    expect(bankedSources(fast, null, {}).sources).toEqual([]);
  });

  test('the bank goes stale when that combat ends; without the Perk nothing is banked', async () => {
    const pony = makeActor('Pony', { items: [packItem('timeToThink')] });
    const plain = makeActor('Plain');
    startCombat(1, 0, [combatant(pony, 4), combatant(plain, 2)]);
    await fireTriggers(plain, 'combatStart');
    expect(bankedSources(plain, null, {}).sources).toEqual([]);
    startCombat(1, 0, [combatant(pony, 4)]);
    await fireTriggers(pony, 'combatStart');
    expect(bankedSources(pony, null, {}).sources.length).toBe(1);
    game.combats = { get: () => null };
    expect(bankedSources(pony, null, {}).sources).toEqual([]);
  });
});

describe('Better than the Best', () => {
  const roll = value => ({ dice: [{ faces: 20, values: [value] }] });
  test('a kept natural 20 succeeds, or makes a success a Critical Success; anything else is left alone', () => {
    const joe = makeActor('Joe', { items: [packItem('betterThanTheBest')] });
    expect(ruleNaturalTwentyMultiplier(joe, roll(20), 0)).toBe(1);
    expect(ruleNaturalTwentyMultiplier(joe, roll(20), 1)).toBe(2);
    expect(ruleNaturalTwentyMultiplier(joe, roll(20), 3)).toBe(3);
    expect(ruleNaturalTwentyMultiplier(joe, roll(19), 0)).toBe(0);
    expect(ruleNaturalTwentyMultiplier(makeActor('Plain'), roll(20), 0)).toBe(0);
    // The kept die only (an Edge's discarded 20 doesn't count).
    expect(ruleNaturalTwentyMultiplier(joe, { dice: [{ faces: 20, results: [{ result: 20, active: false }, { result: 7, active: true }] }] }, 0)).toBe(0);
  });
});

describe('Agency (Hang-Up)', () => {
  test('a Fumble in the agency Skill (the Agency Perk\'s choice) gives no Story Point; other Skills still do', () => {
    const agent = makeActor('Agent', { items: [packItem('agency'), bookItem(BOOK.agencyPerk, { system: { choice: 'technology' } })] });
    expect(ruleSuppressesFumbleStoryPoint(agent, 'technology')).toBe(true);
    expect(ruleSuppressesFumbleStoryPoint(agent, 'might')).toBe(false);
    expect(ruleSuppressesFumbleStoryPoint(agent, null)).toBe(false);
    expect(ruleSuppressesFumbleStoryPoint(makeActor('Plain', { items: [bookItem(BOOK.agencyPerk, { system: { choice: 'technology' } })] }), 'technology')).toBe(false);
  });
});

describe('One-Upping', () => {
  test('on an ally\'s failed Skill Test card: a button for the holder that banks ↑1 on that same Skill, once per card', async () => {
    const holder = makeActor('Holder', { items: [packItem('oneUpping')] });
    const ally = makeActor('Ally');
    const card = checkCard(ally, { rollFailed: true, skill: 'athletics' });
    const offers = offersFor(card, [holder]);
    expect(offers.length).toBe(1);
    await pressOffer(card, { holderUuid: holder.uuid, itemId: offers[0].item.id, index: offers[0].index });
    expect(bankedSources(holder, null, { rolledSkill: 'athletics' }).sources.map(s => s.shiftUp)).toEqual([1]);
    expect(bankedSources(holder, null, { rolledSkill: 'deception' }).sources).toEqual([]);
    // Answered: not offered again on that card.
    expect(offersFor(card, [holder])).toEqual([]);
  });

  test('not on the holder\'s own failures, successes, or cards without a Skill', () => {
    const holder = makeActor('Holder', { items: [packItem('oneUpping')] });
    const ally = makeActor('Ally');
    expect(offersFor(checkCard(holder, { rollFailed: true, skill: 'athletics' }), [holder])).toEqual([]);
    expect(offersFor(checkCard(ally, { rollFailed: false, skill: 'athletics' }), [holder])).toEqual([]);
    expect(offersFor(checkCard(ally, { rollFailed: true }), [holder])).toEqual([]);
  });
});

/* -------------------------------------------- */
/*  GI Joe CRB                                   */
/* -------------------------------------------- */

describe('Touch Move', () => {
  test('rolling Initiative posts the teammates in the combat who aren\'t Surprised, once per encounter', async () => {
    const master = makeActor('Master', { items: [packItem('touchMove')] });
    const a = makeActor('A');
    const b = makeActor('B', { statuses: ['surprised'] });
    const foe = makeActor('Foe', { disposition: -1 });
    startCombat(1, 0, [combatant(master, 15), combatant(a, 10), combatant(b, 9), combatant(foe, 8)]);
    await fireTriggers(master, 'initiativeRolled');
    expect(cards().at(-1).content).toContain('Master rolls Initiative: A may immediately make a Move action.');
    ChatMessage.create.mockClear();
    await fireTriggers(master, 'initiativeRolled');
    expect(ChatMessage.create).not.toHaveBeenCalled();
  });

  test('nobody to move: says so', async () => {
    const master = makeActor('Master', { items: [packItem('touchMove')] });
    startCombat(1, 0, [combatant(master, 15)]);
    await fireTriggers(master, 'initiativeRolled');
    expect(cards().at(-1).content).toContain('E20.RulesExtItems2.Nobody may immediately');
  });
});

describe('Martial Artist', () => {
  test('whispers how the target compares in Threat Level, Toughness and Evasion to the user and the GMs', async () => {
    versusHelpers.getDefenseValue = (actor, type) => Number(actor.system.defenses[type].total);
    const joe = makeActor('Joe', { system: { level: 5, defenses: { toughness: { total: 13 }, evasion: { total: 11 } } }, items: [packItem('martialArtist')] });
    const foe = makeActor('Foe', { disposition: -1, system: { threatLevel: 7, defenses: { toughness: { total: 13 }, evasion: { total: 9 } } } });
    target(foe);
    await use(itemNamed(joe, 'Martial Artist'));
    const whisper = cards().find(data => data.whisper);
    expect(whisper.content).toBe('<p>Foe is your superior in Threat Level, your equal in Toughness and your inferior in Evasion.</p>');
    expect(whisper.whisper.sort()).toEqual(['u']);
  });

  test('no target, or only yourself: nothing is whispered', async () => {
    const joe = makeActor('Joe', { items: [packItem('martialArtist')] });
    await use(itemNamed(joe, 'Martial Artist'));
    target(joe);
    await use(itemNamed(joe, 'Martial Artist'));
    expect(cards().filter(data => data.whisper)).toEqual([]);
    expect(ui.notifications.warn).toHaveBeenCalledWith('E20.RulesExtItems2.NotYourself');
  });
});

describe('Queen\'s Gambit', () => {
  test('an ally (or the holder) taking damage in combat offers a card; the pick moves right after the current turn, once per encounter', async () => {
    const queen = makeActor('Queen', { items: [packItem('queensGambit')] });
    const ally = makeActor('Ally', { x: 10 });
    const foe = makeActor('Foe', { x: 20, disposition: -1 });
    const [q, a, f] = [combatant(queen, 20), combatant(ally, 5), combatant(foe, 12)];
    startCombat(1, 0, [q, f, a]);
    await fireTriggers(ally, 'takesDamage', { damage: { amount: 3 } });
    expect(buttonCards().length).toBe(1);
    picks = ['Ally'];
    await pressLast();
    // Halfway between the acting Queen (20) and the next (Foe, 12).
    expect(a.initiative).toBe(16);
    // Used for the encounter: no more offers.
    await fireTriggers(queen, 'takesDamage', { damage: { amount: 3 } });
    expect(buttonCards().length).toBe(1);
  });

  test('the holder\'s own damage offers it too; an enemy\'s doesn\'t; out of combat nothing', async () => {
    const queen = makeActor('Queen', { items: [packItem('queensGambit')] });
    const foe = makeActor('Foe', { x: 20, disposition: -1 });
    await fireTriggers(queen, 'takesDamage', { damage: { amount: 3 } });
    expect(buttonCards().length).toBe(0);
    startCombat(1, 1, [combatant(foe, 12), combatant(queen, 20)]);
    await fireTriggers(foe, 'takesDamage', { damage: { amount: 3 } });
    expect(buttonCards().length).toBe(0);
    await fireTriggers(queen, 'takesDamage', { damage: { amount: 3 } });
    expect(buttonCards().length).toBe(1);
    picks = ['Queen'];
    await pressLast();
    // Last in the order: 1 below the acting one.
    expect(game.combat.combatants[1].initiative).toBe(19);
  });
});

/* -------------------------------------------- */
/*  Reckless Abandon, Aegis, The Beat Goes On    */
/* -------------------------------------------- */

describe('Reckless Abandon (+ The Beat Goes On, Aegis)', () => {
  const BGO = 'Compendium.essence20.gi_joe_crb.Item.yNHekVUMoKALrAWH';
  const AEGIS = 'Compendium.essence20.gi_joe_crb.Item.0ZTjZ36gN74889am';
  const renegade = (extra = [], options = {}) => {
    const actor = makeActor('Renegade', { items: [packItem('reckless', { system: { ...fromPack(P.reckless).system, isActive: false } }), ...extra], ...options });
    return [actor, itemNamed(actor, 'Reckless Abandon')];
  };

  async function switchOn(item) {
    await item.update({ 'system.isActive': true });
    await onRolePointsToggled(item, true);
  }

  test('a minute (10 rounds) after it was switched on in a combat, it ends at the turn start', async () => {
    const [actor, ra] = renegade();
    makeActor('Foe', { disposition: -1, x: 30 });
    startCombat(2, 0, [combatant(actor, 10)]);
    await switchOn(ra);
    game.combat.round = 11;
    await fireTriggers(actor, 'turnStart');
    expect(ra.system.isActive).toBe(true);
    game.combat.round = 12;
    await fireTriggers(actor, 'turnStart');
    expect(ra.system.isActive).toBe(false);
    expect(cards().at(-1).content).toContain('Renegade&#39;s Reckless Abandon has lasted a minute and ends.');
  });

  test('switched on outside a combat, the minute never runs out', async () => {
    const [actor, ra] = renegade();
    makeActor('Foe', { disposition: -1, x: 30 });
    await switchOn(ra);
    startCombat(40, 0, [combatant(actor, 10)]);
    await fireTriggers(actor, 'turnStart');
    expect(ra.system.isActive).toBe(true);
  });

  test('no enemy left standing in sight ends it - not with The Beat Goes On', async () => {
    const [actor, ra] = renegade();
    const foe = makeActor('Foe', { disposition: -1, x: 30, statuses: ['defeated'] });
    const hidden = makeActor('Hidden', { disposition: -1, x: 30 });
    hidden.token.document.hidden = true;
    startCombat(1, 0, [combatant(actor, 10)]);
    await switchOn(ra);
    await fireTriggers(actor, 'turnStart');
    expect(ra.system.isActive).toBe(false);
    void foe;
    const [keeper, kept] = renegade([bookItem(BGO, { name: 'The Beat Goes On' })]);
    await switchOn(kept);
    await fireTriggers(keeper, 'turnStart');
    expect(kept.system.isActive).toBe(true);
  });

  test('being brought to 0 Health ends it - not with Aegis or The Beat Goes On', async () => {
    const [actor, ra] = renegade();
    makeActor('Foe', { disposition: -1, x: 30 });
    await switchOn(ra);
    actor.system.health.value = 0;
    await fireTriggers(actor, 'takesDamage', { damage: { amount: 4 } });
    expect(ra.system.isActive).toBe(false);
    for (const uuid of [AEGIS, BGO]) {
      const [other, item] = renegade([bookItem(uuid, { name: 'Keeper' })]);
      await switchOn(item);
      other.system.health.value = 0;
      await fireTriggers(other, 'takesDamage', { damage: { amount: 4 } });
      expect(item.system.isActive).toBe(true);
    }
  });

  test('no kits while it is on', async () => {
    const { kitUseVetoed } = await import('./plugins/effects/veto.mjs');
    const [actor, ra] = renegade();
    expect(kitUseVetoed(actor, { name: 'Kit' })).toBe(false);
    await switchOn(ra);
    expect(kitUseVetoed(actor, { name: 'Kit' })).toBe(true);
    expect(ui.notifications.warn).toHaveBeenCalledWith('E20.Gij2RecklessNoKits');
  });

  test('Aegis: a hit that would Defeat leaves 1 Health while acting with Reckless Abandon; when it ends at 1 Health, Defeated', async () => {
    const { wouldBeDefeated } = await import('./triggers.mjs');
    const [actor, ra] = renegade([packItem('aegis')], { system: { health: { value: 3, max: 10, bonus: 0 } } });
    setWorldLookups({ recklessAbandon: who => !!itemNamed(who, 'Reckless Abandon')?.system?.isActive });
    expect(await wouldBeDefeated(actor, 5, 'sharp', { stage: 'aegis' })).toBe(5);
    await switchOn(ra);
    expect(await wouldBeDefeated(actor, 5, 'sharp', { stage: 'aegis' })).toBe(2);
    expect(await wouldBeDefeated(actor, 5, 'sharp')).toBe(5);
    actor.system.health.value = 1;
    await ra.update({ 'system.isActive': false });
    await onRolePointsToggled(ra, false);
    expect(actor.statuses.has('defeated')).toBe(true);
    expect(actor.flags.essence20.ruleMarks.aegisClamped).toBeUndefined();
  });

  test('Aegis: healed above 1 by then, or never kept up, no Defeat', async () => {
    const { wouldBeDefeated } = await import('./triggers.mjs');
    const [actor, ra] = renegade([packItem('aegis')], { system: { health: { value: 3, max: 10, bonus: 0 } } });
    setWorldLookups({ recklessAbandon: who => !!itemNamed(who, 'Reckless Abandon')?.system?.isActive });
    await switchOn(ra);
    await wouldBeDefeated(actor, 5, 'sharp', { stage: 'aegis' });
    actor.system.health.value = 5;
    await ra.update({ 'system.isActive': false });
    await onRolePointsToggled(ra, false);
    expect(actor.statuses.has('defeated')).toBe(false);
    const [quiet, item] = renegade([packItem('aegis')], { system: { health: { value: 1, max: 10, bonus: 0 } } });
    await switchOn(item);
    await item.update({ 'system.isActive': false });
    await onRolePointsToggled(item, false);
    expect(quiet.statuses.has('defeated')).toBe(false);
  });
});

/* -------------------------------------------- */
/*  BFF family, Better Together                  */
/* -------------------------------------------- */

const shiftsOf = list => list.reduce((sum, s) => ({ up: sum.up + (Number(s.shiftUp) || 0), down: sum.down + (Number(s.shiftDown) || 0), edge: sum.edge || !!s.edge }), { up: 0, down: 0, edge: false });

describe('BFF and the BFF Perks', () => {
  /** A pony whose BFF Perk picked these friends. */
  function pony(friends, extra = [], options = {}) {
    const actor = makeActor('Pony', { items: [packItem('bff'), ...extra], ...options });
    itemNamed(actor, 'BFF').flags.essence20.rules = { choices: { bffs: friends.map(friend => friend.uuid) } };
    return actor;
  }

  test('BFF: the Use picks up to Social Essence teammates (not yourself); the pick is kept on the Perk', async () => {
    const actor = makeActor('Pony', { items: [packItem('bff')], system: { essences: { social: { value: 2, max: 2 } } } });
    const a = makeActor('A');
    const b = makeActor('B');
    const c = makeActor('C');
    foundry.applications.api.DialogV2.wait.mockResolvedValueOnce([a.uuid, b.uuid, c.uuid, actor.uuid]);
    await use(itemNamed(actor, 'BFF'));
    expect(itemNamed(actor, 'BFF').flags.essence20.rules.choices.bffs).toEqual([a.uuid, b.uuid]);
  });

  test('BFF: Lend Assistance as a Free action once a turn (asked), only with BFFs picked', () => {
    const friend = makeActor('Friend');
    const none = makeActor('Lonely', { items: [packItem('bff')] });
    expect(costRulesFor(none)[0].matches({ key: 'lendAssistance' })).toBe(false);
    const [rule] = costRulesFor(pony([friend]));
    expect(rule).toMatchObject({ id: 'bffAssist', ask: 'E20.ActionPerkAskBff', limit: { window: 'turn', max: 1 } });
    expect(rule.to()).toBe('free');
    expect(rule.matches({ key: 'lendAssistance' })).toBe(true);
    expect(rule.matches({ key: 'sprint' })).toBe(false);
  });

  test('BFF: unqualified, a Friendship Point lets you assist a BFF anyway (asked, spent quietly); not anyone else', async () => {
    const friend = makeActor('Friend');
    const other = makeActor('Other');
    const actor = pony([friend]);
    expect(ruleAssistPayment(actor, other, 'might')).toBeNull();
    const payment = ruleAssistPayment(actor, friend, 'might');
    expect(payment).toMatchObject({ amount: 1 });
    expect(await payForAssist(actor, friend, payment, async () => false)).toBe(false);
    expect(storyPointSpends).toEqual([]);
    expect(await payForAssist(actor, friend, payment, async text => text == 'E20.BffSpendToAssist {"ally":"Friend"}')).toBe(true);
    expect(storyPointSpends).toEqual([{ name: 'Pony', amount: 1, options: { announce: false } }]);
  });

  test('About Twenty-Percent Cooler: ↑1 offered when a BFF has the rolled Skill at d4 or better, three times a Rest', async () => {
    const friend = makeActor('Friend', { system: { skills: { might: { shift: 'd4' }, alertness: { shift: 'd2' } } } });
    const actor = pony([friend], [packItem('cooler')]);
    const offered = skill => ruleDialogSwitches(actor, { rolledSkill: skill }).filter(s => s.label.includes('Twenty-Percent'));
    expect(offered('might').length).toBe(1);
    expect(offered('alertness')).toEqual([]);
    expect(offered('athletics')).toEqual([]);
    const cooler = itemNamed(actor, 'About Twenty-Percent Cooler');
    for (let i = 0; i < 3; i++) {
      await recordUse(actor, cooler.system.rules[0], cooler, 0);
    }

    expect(offered('might')).toEqual([]);
  });

  test('Leave It To Me: a BFF failing a Skill Test on their own turn banks an Edge on that Skill for this round and the next', async () => {
    const friend = makeActor('Friend');
    const actor = pony([friend], [packItem('leaveItToMe')]);
    startCombat(3, 0, [combatant(friend, 12), combatant(actor, 8)]);
    await rollSeen(friend, [{ success: false }], {}, { rider: { skill: 'might' } });
    expect(bankedSources(actor, null, { rolledSkill: 'might' }).sources.map(s => s.edge)).toEqual([true]);
    expect(bankedSources(actor, null, { rolledSkill: 'alertness' }).sources).toEqual([]);
    game.combat.round = 4;
    expect(bankedSources(actor, null, { rolledSkill: 'might' }).sources.length).toBe(1);
    game.combat.round = 5;
    expect(bankedSources(actor, null, { rolledSkill: 'might' }).sources).toEqual([]);
  });

  test('Leave It To Me: not off their turn, not on a success, not for someone else', async () => {
    const friend = makeActor('Friend');
    const other = makeActor('Other');
    const actor = pony([friend], [packItem('leaveItToMe')]);
    startCombat(3, 1, [combatant(friend, 12), combatant(actor, 8)]);
    await rollSeen(friend, [{ success: false }], {}, { rider: { skill: 'might' } });
    game.combat.turn = 0;
    await rollSeen(friend, [{ success: true }], {}, { rider: { skill: 'might' } });
    await rollSeen(other, [{ success: false }], {}, { rider: { skill: 'might' } });
    expect(bankedSources(actor, null, { rolledSkill: 'might' }).sources).toEqual([]);
    // Out of combat any failure counts, for the scene.
    game.combat = null;
    await rollSeen(friend, [{ success: false }], {}, { rider: { skill: 'might' } });
    expect(bankedSources(actor, null, { rolledSkill: 'might' }).sources.length).toBe(1);
  });

  test('That\'s What Best Friends Are For: a Friendship Point for a Skill assist to a BFF, not for the Free-action one', async () => {
    const friend = makeActor('Friend');
    const other = makeActor('Other');
    const actor = pony([friend], [packItem('bestFriends')]);
    let ledger = { perkUses: {} };
    pickHelpers.getLedger = () => ledger;
    await fireTriggers(actor, 'lendAssistance', { roll: { assistKind: 'skill' }, targets: [friend] });
    expect(storyHelpers.requestStoryPointGrant).toHaveBeenCalledTimes(1);
    await fireTriggers(actor, 'lendAssistance', { roll: { assistKind: 'skill' }, targets: [other] });
    await fireTriggers(actor, 'lendAssistance', { roll: { assistKind: 'attack' }, targets: [friend] });
    ledger = { perkUses: { bffAssist: 1 } };
    await fireTriggers(actor, 'lendAssistance', { roll: { assistKind: 'skill' }, targets: [friend] });
    expect(storyHelpers.requestStoryPointGrant).toHaveBeenCalledTimes(1);
  });
});

describe('Better Together (Influence and Hang-Up)', () => {
  test('the Use picks the partner; assisting each other gives both ↑1 and an Edge until the end of the assister\'s next turn', async () => {
    const ranger = makeActor('Ranger', { items: [packItem('betterTogether')] });
    const partner = makeActor('Partner');
    picks = ['Partner'];
    await use(itemNamed(ranger, 'Better Together'), { which: 'Choose your partner' });
    expect(itemNamed(ranger, 'Better Together').flags.essence20.rules.choices.partner).toBe(partner.uuid);
    const combat = startCombat(1, 0, [combatant(ranger, 15), combatant(partner, 10)]);
    // The partner assists the Ranger (on the partner's turn): counted on the partner's turns.
    combat.turn = 1;
    await fireTriggers(ranger, 'assisted', { roll: { assistKind: 'skill' }, targets: [partner] });
    const bonus = actor => shiftsOf(ruleRollSources(actor, null, {}).sources.filter(s => /Better Together/.test(s.label)));
    expect(bonus(ranger)).toEqual({ up: 1, down: 0, edge: true });
    expect(bonus(partner)).toEqual({ up: 1, down: 0, edge: true });
    combat.round = 2;
    combat.turn = 1;
    expect(bonus(ranger)).toEqual({ up: 1, down: 0, edge: true });
    combat.round = 3;
    combat.turn = 0;
    expect(bonus(partner)).toEqual({ up: 0, down: 0, edge: false });
    expect(bonus(ranger)).toEqual({ up: 0, down: 0, edge: false });
  });

  test('assisting someone else does nothing; both holding it still give one ↑1', async () => {
    const ranger = makeActor('Ranger', { items: [packItem('betterTogether')] });
    const partner = makeActor('Partner', { items: [packItem('betterTogether')] });
    const other = makeActor('Other');
    itemNamed(ranger, 'Better Together').flags.essence20.rules = { choices: { partner: partner.uuid } };
    itemNamed(partner, 'Better Together').flags.essence20.rules = { choices: { partner: ranger.uuid } };
    await fireTriggers(ranger, 'lendAssistance', { roll: { assistKind: 'skill' }, targets: [other] });
    expect(ruleRollSources(other, null, {}).sources).toEqual([]);
    await fireTriggers(ranger, 'lendAssistance', { roll: { assistKind: 'skill' }, targets: [partner] });
    await fireTriggers(partner, 'assisted', { roll: { assistKind: 'skill' }, targets: [ranger] });
    expect(shiftsOf(ruleRollSources(partner, null, {}).sources)).toEqual({ up: 1, down: 0, edge: true });
  });

  test('Hang-Up: ↓1 while on the scene without the partner; nothing with no partner, or with them on the scene', () => {
    const partner = makeActor('Partner', { token: false });
    const ranger = makeActor('Ranger', { items: [packItem('betterTogether'), packItem('betterTogetherHangUp')] });
    const down = () => shiftsOf(ruleRollSources(ranger, null, {}).sources).down;
    expect(down()).toBe(0);
    itemNamed(ranger, 'Better Together').flags.essence20.rules = { choices: { partner: partner.uuid } };
    expect(down()).toBe(1);
    canvas.tokens.placeables.push({ id: 'tp', actor: partner, document: { disposition: 1 }, center: { x: 0, y: 0 } });
    expect(down()).toBe(0);
  });
});

/* -------------------------------------------- */
/*  Recent rolls                                 */
/* -------------------------------------------- */

describe('Competitive (Hang-Up)', () => {
  const card = (actor, total, skill = 'athletics') => ({ speakerActor: actor, flags: { essence20: { skill } }, rolls: [{ total }] });

  test('an ally out-rolling you on the same Skill (within 5 minutes, this scene) gives Snag on your next Skill Test this scene', async () => {
    const holder = makeActor('Rainbow', { items: [packItem('competitive')] });
    const ally = makeActor('Applejack');
    await onSkillTestPosted(card(holder, 12), 1000);
    await onSkillTestPosted(card(ally, 15), 2000);
    const snag = () => ruleRollSources(holder, null, { rolledSkill: 'brawn' }).sources.filter(s => s.snag).length;
    expect(snag()).toBe(1);
    // A new scene: gone.
    game.settings.get = () => 2;
    expect(snag()).toBe(0);
  });

  test('also when you roll lower after them; not when lower than you, another Skill, an enemy, or 5 minutes later', async () => {
    const holder = makeActor('Rainbow', { items: [packItem('competitive')] });
    const ally = makeActor('Applejack');
    const foe = makeActor('Foe', { disposition: -1, type: 'npc' });
    const snag = () => ruleRollSources(holder, null, { rolledSkill: 'brawn' }).sources.filter(s => s.snag).length;
    await onSkillTestPosted(card(ally, 9), 1000);
    await onSkillTestPosted(card(holder, 12), 1100);
    await onSkillTestPosted(card(ally, 20, 'brawn'), 1200);
    await onSkillTestPosted(card(foe, 20), 1300);
    expect(snag()).toBe(0);
    await onSkillTestPosted(card(ally, 19), 1100 + 6 * 60 * 1000);
    expect(snag()).toBe(0);
    await onSkillTestPosted(card(holder, 15), 1200 + 6 * 60 * 1000);
    expect(snag()).toBe(1);
  });
});

describe('Take in a Scene (+ Misplaced Confidence)', () => {
  const infiltration = (actor, total) => ({ speakerActor: actor, flags: { essence20: { skill: 'infiltration' } }, rolls: [{ total }], timestamp: Date.now() });

  test('Surprised at Initiative: Alertness against the lowest hostile Infiltration + 1; a success lifts Surprise', async () => {
    const pony = makeActor('Pony', { items: [packItem('takeInAScene')], statuses: ['surprised'] });
    const enemy = makeActor('Enemy', { disposition: -1, type: 'npc' });
    const friend = makeActor('Friend');
    game.messages = { contents: [infiltration(enemy, 18), infiltration(enemy, 13), infiltration(friend, 5)] };
    await fireTriggers(pony, 'initiativeRolling');
    expect(grants.rollTest).toHaveBeenCalledWith(pony, 'alertness', 14, expect.any(Object));
    expect(pony.statuses.has('surprised')).toBe(false);
    // Not Surprised: nothing rolled.
    grants.rollTest.mockClear();
    await fireTriggers(pony, 'initiativeRolling');
    expect(grants.rollTest).not.toHaveBeenCalled();
  });

  test('no hostile Infiltration on record: an open Alertness roll and a GM card; missed with Misplaced Confidence holds Surprise two rounds', async () => {
    const misplaced = packItem('misplaced', { flags: { core: { sourceId: 'Compendium.essence20.mlp_crb.Item.LcKUw5rQd19ovk4I' }, essence20: {} } });
    const pony = makeActor('Pony', { items: [packItem('takeInAScene'), misplaced], statuses: ['surprised'] });
    game.messages = { contents: [] };
    startCombat(1, 0, [combatant(pony, 10)]);
    await fireTriggers(pony, 'initiativeRolling');
    expect(pony._dice.rollSkill).toHaveBeenCalledWith(expect.objectContaining({ skill: 'alertness', shiftUp: 0, shiftDown: 0 }), pony);
    expect(buttonCards().at(-1).flags.essence20.ruleButton.who).toBe('gm');
    foundry.applications.api.DialogV2.wait.mockResolvedValueOnce('1');
    await pressLast();
    expect(pony.flags.essence20.ruleMarks.misplacedConfidence.count).toBe(2);
    pony.statuses.delete('surprised');
    game.combat.round = 2;
    await fireTriggers(pony, 'roundStart');
    expect(pony.statuses.has('surprised')).toBe(true);
    game.combat.round = 3;
    await fireTriggers(pony, 'roundStart');
    expect(pony.statuses.has('surprised')).toBe(false);
    expect(pony.flags.essence20.ruleMarks.misplacedConfidence).toBeUndefined();
  });

  test('the GM says it was noticed: Surprise lifted; without Misplaced Confidence a miss only stays Surprised', async () => {
    const pony = makeActor('Pony', { items: [packItem('takeInAScene')], statuses: ['surprised'] });
    game.messages = { contents: [] };
    await fireTriggers(pony, 'initiativeRolling');
    foundry.applications.api.DialogV2.wait.mockResolvedValueOnce('0');
    await pressLast();
    expect(pony.statuses.has('surprised')).toBe(false);
    const other = makeActor('Other', { items: [packItem('takeInAScene')], statuses: ['surprised'] });
    startCombat(1, 0, [combatant(other, 10)]);
    grants.rollTest.mockImplementation(async () => ({ success: false, multiplier: 0 }));
    game.messages = { contents: [infiltration(makeActor('Foe', { disposition: -1, type: 'npc' }), 9)] };
    await fireTriggers(other, 'initiativeRolling');
    expect(other.statuses.has('surprised')).toBe(true);
    expect(other.flags.essence20.ruleMarks?.misplacedConfidence).toBeUndefined();
  });
});

/* -------------------------------------------- */
/*  Environmental Expertise family               */
/* -------------------------------------------- */

describe('Environmental Expertise, Read The Land, In Their Element, Guidance', () => {
  const EE_UUID = 'Compendium.essence20.gi_joe_crb.Item.EbbSUA2vSHyv3MjQ';
  let terrainOf;
  beforeEach(() => {
    terrainOf = () => null;
    expertiseHelpers.inEnvironment = actor => {
      const terrain = terrainOf(actor);
      return terrain ? (actor.system.environments ?? []).concat(sharedExpertiseEnvironments(actor)).includes(terrain) : null;
    };
  });

  const ranger = (items = [], options = {}) => makeActor('Ranger', { items, system: { environments: ['woodlands'], health: { value: 10, max: 10, bonus: 0 } }, ...options });

  test('the Perk: the benefits in an environment of expertise, or switched on; the Use switches them on and off', async () => {
    const actor = ranger([packItem('environmentalExpertise')]);
    expect(ruleEnvironmentalExpertise(actor)).toBeNull();
    terrainOf = () => 'woodlands';
    expect(ruleEnvironmentalExpertise(actor)?.item.name).toBe('Environmental Expertise');
    terrainOf = () => 'desert';
    expect(ruleEnvironmentalExpertise(actor)).toBeNull();
    await use(itemNamed(actor, 'Environmental Expertise'));
    expect(actor.flags.essence20.environmentalExpertiseActive).toBe(true);
    expect(ruleEnvironmentalExpertise(actor)).not.toBeNull();
    await use(itemNamed(actor, 'Environmental Expertise'));
    expect(actor.flags.essence20.environmentalExpertiseActive).toBe(false);
    expect(ruleEnvironmentalExpertise(actor)).toBeNull();
  });

  test('Read The Land gives the same benefits through its own switch, without the Perk', () => {
    const actor = ranger([packItem('readTheLand')]);
    expect(ruleEnvironmentalExpertise(actor)).toBeNull();
    actor.flags.essence20.environmentalExpertiseActive = true;
    expect(ruleEnvironmentalExpertise(actor)).not.toBeNull();
    expect(ruleEnvironmentalExpertise(ranger())).toBeNull();
  });

  test('In Their Element: the pet shares the owner\'s environments and has the benefits there, or while the owner\'s switch is on - only with the owner\'s Perk', () => {
    const owner = ranger([packItem('inTheirElement'), bookItem(EE_UUID, { name: 'Environmental Expertise' })]);
    const pet = makeActor('Pet', { type: 'companion', system: { environments: [] }, flags: { companionOf: owner.uuid } });
    expect(sharedExpertiseEnvironments(pet)).toEqual(['woodlands']);
    expect(ruleEnvironmentalExpertise(pet)).toBeNull();
    terrainOf = () => 'woodlands';
    expect(ruleEnvironmentalExpertise(pet)).not.toBeNull();
    terrainOf = () => 'desert';
    expect(ruleEnvironmentalExpertise(pet)).toBeNull();
    owner.flags.essence20.environmentalExpertiseActive = true;
    expect(ruleEnvironmentalExpertise(pet)).not.toBeNull();
    // Without the owner's Environmental Expertise, the environments are still shared but no benefits.
    const plain = ranger([packItem('inTheirElement')], { flags: { environmentalExpertiseActive: true } });
    const other = makeActor('Other Pet', { type: 'companion', system: { environments: [] }, flags: { companionOf: plain.uuid } });
    terrainOf = () => 'woodlands';
    expect(sharedExpertiseEnvironments(other)).toEqual(['woodlands']);
    expect(ruleEnvironmentalExpertise(other)).toBeNull();
  });

  test('Guidance: an Adaptation Point gives an ally an Edge on their next non-attack test, or Specialized on their next attack', async () => {
    const points = { name: 'Adaptation Points', type: 'rolePoints', system: { resource: { value: 1, max: 3 } } };
    const scout = ranger([packItem('guidance'), points]);
    const ally = makeActor('Ally', { x: 10 });
    target(ally);
    await use(itemNamed(scout, 'Guidance'));
    expect(itemNamed(scout, 'Adaptation Points').system.resource.value).toBe(0);
    const edge = ruleRollSources(ally, null, { rolledSkill: 'alertness' });
    expect(edge.sources.filter(s => s.label == 'Guidance').map(s => s.edge)).toEqual([true]);
    expect(edge.consumes).toContainEqual({ ext: 'rulesMark', actorUuid: ally.uuid, key: 'guidance' });
    const attack = { type: 'weaponEffect', system: { classification: { style: 'melee' } } };
    expect(ruleRollSources(ally, null, { item: attack, isAttack: true }).sources.filter(s => s.label == 'Guidance')).toEqual([]);
    expect(ruleSpecializes(ally, 'might', attack, {})).toBe(true);
    expect(ruleRollSources(ally, null, { item: attack, isAttack: true }).consumes).toContainEqual({ ext: 'rulesMark', actorUuid: ally.uuid, key: 'guidance' });
    // No points left: no Use.
    expect(useAvailable(itemNamed(scout, 'Guidance'), itemNamed(scout, 'Guidance').system.rules[0], 0)).toBe(false);
  });
});

describe('Adapted Vehicles, Environmental Enforcer', () => {
  const EE_UUID = 'Compendium.essence20.gi_joe_crb.Item.EbbSUA2vSHyv3MjQ';
  let terrain;
  beforeEach(() => {
    terrain = null;
    expertiseHelpers.terrainOf = () => terrain;
    expertiseHelpers.inEnvironment = (actor, at = terrain) => (at ? (actor.system.environments ?? []).includes(at) : null);
    setWorldLookups({ terrain: () => terrain });
    lazy.getTerrain = () => terrain;
  });

  test('Adapted Vehicles: the vehicle its Environmental Expertise driver drives has the benefits on the driver\'s terrain, or by the driver\'s switch on an untagged scene', () => {
    const driver = makeActor('Driver', { items: [packItem('adaptedVehicle'), bookItem(EE_UUID, { name: 'Environmental Expertise' })], system: { environments: ['arctic'] } });
    const vehicle = makeActor('Truck', { type: 'vehicle', system: { actors: { x: { uuid: driver.uuid, vehicleRole: 'driver' } } } });
    expect(ruleEnvironmentalExpertise(vehicle)).toBeNull();
    terrain = 'arctic';
    expect(ruleEnvironmentalExpertise(vehicle)?.item.name).toBe('Adapted Vehicle (Environmental)');
    terrain = 'desert';
    driver.flags.essence20.environmentalExpertiseActive = true;
    expect(ruleEnvironmentalExpertise(vehicle)).toBeNull();
    terrain = null;
    expect(ruleEnvironmentalExpertise(vehicle)).not.toBeNull();
    // Without Environmental Expertise, or only riding along: nothing.
    const rider = makeActor('Rider', { items: [packItem('adaptedVehicle'), bookItem(EE_UUID)], system: { environments: ['arctic'] } });
    const cart = makeActor('Cart', { type: 'vehicle', system: { actors: { y: { uuid: rider.uuid, vehicleRole: 'passenger' } } } });
    terrain = 'arctic';
    expect(ruleEnvironmentalExpertise(cart)).toBeNull();
    const plain = makeActor('Plain', { items: [packItem('adaptedVehicle')], system: { environments: ['arctic'] } });
    const van = makeActor('Van', { type: 'vehicle', system: { actors: { z: { uuid: plain.uuid, vehicleRole: 'driver' } } } });
    expect(ruleEnvironmentalExpertise(van)).toBeNull();
  });

  test('Environmental Enforcer: the Use picks one environment per Survival rank; Edge on Maneuver attacks in one; a switch on an untagged scene', async () => {
    CONFIG.E20.environments = { arctic: 'Arctic', desert: 'Desert', woodlands: 'Woodlands' };
    const holder = makeActor('Hawk', { items: [packItem('enforcer')], system: { skills: { survival: { shift: 'd2' } } } });
    foundry.applications.api.DialogV2.wait.mockResolvedValueOnce(['arctic', 'desert']);
    await use(itemNamed(holder, 'Environmental Enforcer'));
    expect(itemNamed(holder, 'Environmental Enforcer').flags.essence20.rules.choices.environments).toEqual(['arctic']);
    const maneuver = { type: 'weaponEffect', system: { damageType: 'maneuver', classification: { style: 'melee' } } };
    const edge = () => ruleRollSources(holder, null, { item: maneuver, isAttack: true }).sources.filter(s => s.label == 'Environmental Enforcer').length;
    terrain = 'arctic';
    expect(edge()).toBe(1);
    terrain = 'desert';
    expect(edge()).toBe(0);
    expect(ruleDialogSwitches(holder, { item: maneuver, isAttack: true }).filter(s => /Enforcer/.test(s.label))).toEqual([]);
    terrain = null;
    expect(ruleDialogSwitches(holder, { item: maneuver, isAttack: true }).filter(s => /Enforcer/.test(s.label)).length).toBe(1);
  });
});

describe('Not Like That, Like This!', () => {
  test('a teammate\'s Skill Test card within 60 ft: a reroll button for the holder, once a card; in a combat the Skill is owed', async () => {
    const holder = makeActor('Hub', { items: [packItem('notLikeThat')] });
    const mate = makeActor('Mate', { x: 50 });
    const far = makeActor('Far', { x: 500 });
    CONFIG.E20.skills = { athletics: 'E20.SkillAthletics' };
    expect(offersFor(checkCard(far, { skill: 'athletics' }), [holder])).toEqual([]);
    expect(offersFor(checkCard(holder, { skill: 'athletics' }), [holder])).toEqual([]);
    expect(offersFor(checkCard(mate, { q1Reroll: true, skill: 'athletics' }), [holder])).toEqual([]);
    const card = checkCard(mate, { skill: 'athletics' });
    const [offer] = offersFor(card, [holder]);
    expect(offer.label).toBe('Hub: Not Like That, Like This! (reroll)');
    startCombat(1, 0, [combatant(holder, 10), combatant(mate, 8)]);
    rerolls.length = 0;
    await pressOffer(card, { holderUuid: holder.uuid, itemId: offer.item.id, index: offer.index });
    expect(rerolls).toEqual(['allDice']);
    expect(offersFor(card, [holder])).toEqual([]);
    expect(holder.flags.essence20.ruleMarks.notLikeThat.text).toBe('athletics');
  });

  test('the owed Skill: reminded (with a lose-the-Move button) at the next turn start, gone once rolled or when that turn ends', async () => {
    const holder = makeActor('Hub', { items: [packItem('notLikeThat')] });
    CONFIG.E20.skills = { athletics: 'E20.SkillAthletics' };
    startCombat(1, 0, [combatant(holder, 10)]);
    await holder.update({ 'flags.essence20.ruleMarks.notLikeThat': { by: holder.uuid, until: 'combat', stamp: { combatId: 'c1', combat: true }, text: 'athletics' } });
    await fireTriggers(holder, 'turnStart');
    const card = buttonCards().at(-1);
    expect(card.content).toContain('Hub must attempt a E20.SkillAthletics Skill Test this turn');
    // Rolling another Skill doesn't settle it; rolling Athletics does.
    await fireTriggers(holder, 'afterRoll', { roll: { rolledSkill: 'might' }, outcome: 'success' });
    expect(holder.flags.essence20.ruleMarks.notLikeThat).toBeDefined();
    await fireTriggers(holder, 'afterRoll', { roll: { rolledSkill: 'athletics' }, outcome: 'failure' });
    expect(holder.flags.essence20.ruleMarks.notLikeThat).toBeUndefined();
    // Not rolled: the turn's end clears it; the button spends the Move action.
    await holder.update({ 'flags.essence20.ruleMarks.notLikeThat': { by: holder.uuid, until: 'combat', stamp: { combatId: 'c1', combat: true }, text: 'athletics' } });
    await fireTriggers(holder, 'turnStart');
    await pressLast();
    expect(spent).toContainEqual({ name: 'Hub', action: 'move' });
    expect(holder.flags.essence20.ruleMarks.notLikeThat).toBeUndefined();
    await holder.update({ 'flags.essence20.ruleMarks.notLikeThat': { by: holder.uuid, until: 'combat', stamp: { combatId: 'c1', combat: true }, text: 'athletics' } });
    await fireTriggers(holder, 'turnStart');
    await fireTriggers(holder, 'turnEnd');
    expect(holder.flags.essence20.ruleMarks.notLikeThat).toBeUndefined();
  });
});

describe('Influential', () => {
  const FIELD = 'Compendium.essence20.gi_joe_crb.Item.qHLeKSMin2F19O3C';
  const expert = (name, x, field = 'science') => makeActor(name, { x, items: [packItem('influential'), bookItem(FIELD, { name: 'Field', system: { choice: field } })] });
  const up = (actor, skill) => shiftsOf(ruleRollSources(actor, null, { rolledSkill: skill }).sources).up;

  test('allies within 30 ft gain ↑1 on the holder\'s Field Skill, once however many hold it; not the holder, not beyond 30 ft', () => {
    const roller = makeActor('Roller', { x: 0 });
    const first = expert('Expert', 20);
    expert('Other Expert', 25);
    expect(up(roller, 'science')).toBe(1);
    expect(up(roller, 'technology')).toBe(0);
    // The other Expert's aura reaches the first; a lone Expert's own doesn't reach themselves.
    expect(up(first, 'science')).toBe(1);
    expect(up(expert('Solo', 900), 'science')).toBe(0);
    const lonely = makeActor('Lonely', { x: 300 });
    expect(up(lonely, 'science')).toBe(0);
  });
});

describe('Fun Exhaustion (Hang-Up)', () => {
  test('once Party Power has blocked it this scene: can\'t Lend Assistance (its own warning) nor be helped; a new scene lifts it', () => {
    const pony = makeActor('Pinkie', { items: [packItem('funExhaustion')] });
    const friend = makeActor('Rarity');
    expect(ruleAssist(pony, null, null).refused).toBe(false);
    pony.flags.essence20.funExhaustionBlocked = { epoch: 1, window: 'scene', count: 1 };
    expect(ruleAssist(pony, null, null)).toMatchObject({ refused: true, message: 'E20.LendAssistanceFunExhaustion' });
    expect(ruleAssist(friend, pony, 'might').refused).toBe(true);
    game.settings.get = () => 2;
    expect(ruleAssist(pony, null, null).refused).toBe(false);
  });
});

describe('Be an Example', () => {
  test('a Free action banks ↑1 on the Origin\'s chosen Skill for its next test; not again while it waits', async () => {
    const noble = makeActor('Noble', { items: [packItem('beAnExample')], system: { originSkillsIncrease: 'culture', skills: { culture: {}, might: {} } } });
    pay.mockClear();
    await use(itemNamed(noble, 'Be An Example'));
    expect(pay).toHaveBeenCalledWith('free');
    expect(bankedSources(noble, null, { rolledSkill: 'culture' }).sources.map(s => s.shiftUp)).toEqual([1]);
    expect(bankedSources(noble, null, { rolledSkill: 'might' }).sources).toEqual([]);
    const item = itemNamed(noble, 'Be An Example');
    expect(useAvailable(item, item.system.rules[0], 0)).toBe(false);
  });

  test('with no Origin Skill on the sheet the Skill is picked first (a cancelled pick costs nothing)', async () => {
    CONFIG.E20.skills = { culture: 'Culture', might: 'Might' };
    const noble = makeActor('Noble', { items: [packItem('beAnExample')], system: { skills: { culture: {}, might: {} } } });
    pay.mockClear();
    picks = [null];
    await use(itemNamed(noble, 'Be An Example'));
    expect(pay).not.toHaveBeenCalled();
    picks = ['Might'];
    await use(itemNamed(noble, 'Be An Example'));
    expect(bankedSources(noble, null, { rolledSkill: 'might' }).sources.map(s => s.shiftUp)).toEqual([1]);
  });
});

describe('Elemental Shield', () => {
  const ranger = (name, extra = {}) => makeActor(name, { system: { isMorphed: true, powers: { personal: { value: 2, max: 3 } }, health: { value: 10, max: 10, bonus: 0 } }, ...extra });

  test('1 Personal Power, once per encounter: the holder and every Morphed ally get a shield against the next Energy hit', async () => {
    const aqua = ranger('Aqua', { items: [packItem('elementalShield', { system: { ...fromPack(P.elementalShield).system, advances: { currentValue: 2 } } })] });
    const morphed = ranger('Morphed', { x: 500 });
    const plain = makeActor('Plain', { x: 10, system: { isMorphed: false } });
    await use(itemNamed(aqua, 'Elemental Shield'));
    expect(aqua.system.powers.personal.value).toBe(1);
    expect(damageShieldsOf(aqua).map(s => s.amount)).toEqual([2]);
    expect(damageShieldsOf(morphed).length).toBe(1);
    expect(damageShieldsOf(plain)).toEqual([]);
    expect(await use(itemNamed(aqua, 'Elemental Shield'))).toBeNull();
  });

  test('the shield lowers the next Energy hit (any Element sub-type), never below 0, then it is gone; other types and 0 hits leave it', async () => {
    const aqua = ranger('Aqua', { items: [packItem('elementalShield', { system: { ...fromPack(P.elementalShield).system, advances: { currentValue: 2 } } })] });
    await use(itemNamed(aqua, 'Elemental Shield'));
    expect(await consumeDamageShield(aqua, 'sharp', 5)).toBe(5);
    expect(await consumeDamageShield(aqua, 'fire', 0)).toBe(0);
    expect(damageShieldsOf(aqua).length).toBe(1);
    expect(await consumeDamageShield(aqua, 'electric', 5)).toBe(3);
    expect(damageShieldsOf(aqua)).toEqual([]);
    expect(await consumeDamageShield(aqua, 'fire', 5)).toBe(5);
    aqua.flags.essence20.ruleDamageShields = [{ id: 'x', amount: 5, damageTypes: ['element'] }];
    expect(await consumeDamageShield(aqua, 'element', 2)).toBe(0);
  });

  test('a shield raised in a combat goes when that combat ends', async () => {
    const aqua = ranger('Aqua', { items: [packItem('elementalShield')] });
    startCombat(1, 0, [combatant(aqua, 10)]);
    await use(itemNamed(aqua, 'Elemental Shield'));
    expect(damageShieldsOf(aqua).length).toBe(1);
    game.combats = { get: () => null };
    expect(damageShieldsOf(aqua)).toEqual([]);
  });
});

describe('Scramble Field Generator', () => {
  const answers = [];
  const useWith = (item, ...choices) => {
    answers.length = 0;
    answers.push(...choices);
    return runUse(item, pay, { ask: async () => answers.shift() ?? null });
  };

  const holderWith = (quantity = 2) => makeActor('Spy', { items: [packItem('scramble', { system: { ...fromPack(P.scramble).system, quantity } })] });

  test('attached against Evasion with the picked Skill: the target\'s Alertness ↓2; a miss uses the device up', async () => {
    const spy = holderWith();
    const foe = makeActor('Foe', { disposition: -1, x: 20 });
    target(foe);
    grants.rollTest.mockImplementation(async () => ({ success: false, multiplier: 0 }));
    await useWith(itemNamed(spy, 'Scramble Field Generator'), 1);
    expect(grants.rollTest).toHaveBeenCalledWith(spy, 'infiltration', 11, expect.objectContaining({ rollType: 'skill' }));
    expect(itemNamed(spy, 'Scramble Field Generator').system.quantity).toBe(1);
    grants.rollTest.mockImplementation(async () => ({ success: true, multiplier: 1 }));
    await useWith(itemNamed(spy, 'Scramble Field Generator'), 2, 0);
    expect(spent).toContainEqual({ name: 'Spy', action: 'standard' });
    expect(shiftsOf(ruleRollSources(foe, null, { rolledSkill: 'alertness' }).sources).down).toBe(2);
    expect(shiftsOf(ruleRollSources(foe, null, { rolledSkill: 'might' }).sources).down).toBe(0);
  });

  test('invisibility (Technology 16): the target\'s attacks on the user\'s side are Snagged, that side\'s attacks on it gain Edge; using it again removes it (Free) and uses it up', async () => {
    const spy = holderWith(1);
    const friend = makeActor('Friend', { x: 5 });
    const foe = makeActor('Foe', { disposition: -1, x: 20 });
    target(foe);
    await useWith(itemNamed(spy, 'Scramble Field Generator'), 0, 1);
    expect(grants.rollTest).toHaveBeenLastCalledWith(spy, 'technology', 16, expect.any(Object));
    const attack = { type: 'weaponEffect', system: { classification: { style: 'melee' } } };
    expect(ruleRollSources(foe, friend, { item: attack, isAttack: true }).sources.some(s => s.snag)).toBe(true);
    // Rolls against the marked creature (scope markedTarget - rule-marks.mjs#markedTargetSources, a roll source dice.mjs asks).
    expect(shiftsOf(markedTargetSources(friend, foe, { item: attack, isAttack: true }).sources).edge).toBe(true);
    expect(shiftsOf(markedTargetSources(spy, foe, { item: attack, isAttack: true }).sources).edge).toBe(true);
    expect(shiftsOf(markedTargetSources(makeActor('Other Foe', { disposition: -1 }), foe, { item: attack, isAttack: true }).sources).edge).toBe(false);
    await useWith(itemNamed(spy, 'Scramble Field Generator'));
    expect(spent).toContainEqual({ name: 'Spy', action: 'free' });
    expect(foe.flags.essence20.ruleMarks.scramble).toBeUndefined();
    expect(foe.flags.essence20.ruleMarks.scrambleInvisible).toBeUndefined();
    expect(itemNamed(spy, 'Scramble Field Generator')).toBeUndefined();
  });
});

describe('Timeslide', () => {
  const slider = () => {
    const actor = makeActor('Ranger', { items: [packItem('timeslide')] });
    const token = actor.getActiveTokens()[0];
    Object.assign(token, { w: 100, h: 100 });
    token.document.getSnappedPosition = ({ x, y }) => ({ x: Math.round(x / 100) * 100, y: Math.round(y / 100) * 100 });
    token.document.update = jest.fn(async () => {});
    return { actor, token };
  };

  test('the clicked spot within 200 feet: the Move action is spent and the token is placed there, snapped to the grid', async () => {
    const { actor, token } = slider();
    points = [{ x: 180, y: 40 }];
    const out = await use(itemNamed(actor, 'Timeslide'));
    expect(pay).toHaveBeenCalled();
    expect(token.document.update).toHaveBeenCalledWith({ x: 100, y: expect.anything() });
    expect(token.document.update.mock.calls[0][0].y + 0).toBe(0);
    expect(out).toContain('slides through time');
  });

  test('farther than 200 feet: a warning, nothing paid, no move; no spot clicked: nothing', async () => {
    const { actor, token } = slider();
    points = [{ x: 250, y: 0 }];
    await use(itemNamed(actor, 'Timeslide'));
    expect(ui.notifications.warn).toHaveBeenCalledWith('E20.RulesExtItems2.TimeslideTooFar');
    await use(itemNamed(actor, 'Timeslide'));
    expect(pay).not.toHaveBeenCalled();
    expect(token.document.update).not.toHaveBeenCalled();
  });

  test('no token on the canvas: not available', () => {
    const actor = makeActor('Off', { items: [packItem('timeslide')], token: false });
    const item = itemNamed(actor, 'Timeslide');
    expect(useAvailable(item, item.system.rules[0], 0)).toBe(false);
  });
});

describe('Friendship Is Mystical', () => {
  const pony = (value = 3) => makeActor('Twilight', { system: { skills: { athletics: { shift: 'd4' }, technology: { shift: 'd6' } } }, items: [packItem('friendshipIsMystical'), { name: 'Mystical Points', type: 'rolePoints', system: { resource: { value, max: 5 } } }] });
  const points = actor => itemNamed(actor, 'Mystical Points').system.resource.value;

  test('Magically Fit In: 1 Mystical Point, the targeted friend gets 1 rank (↑1) in the picked Skill this scene', async () => {
    const twilight = pony();
    const friend = makeActor('Spike', { x: 10 });
    target(friend);
    picks = ['athletics'];
    await use(itemNamed(twilight, 'Friendship Is Mystical'), { option: 0 });
    expect(points(twilight)).toBe(2);
    expect(shiftsOf(ruleRollSources(friend, null, { rolledSkill: 'athletics' }).sources).up).toBe(1);
    expect(shiftsOf(ruleRollSources(friend, null, { rolledSkill: 'technology' }).sources).up).toBe(0);
    expect(shiftsOf(ruleRollSources(twilight, null, { rolledSkill: 'athletics' }).sources).up).toBe(0);
  });

  test('Fortify: a Free action and 1 point write the friend\'s Fortify Defense; Heal: a Standard action, points up to the missing Health', async () => {
    const twilight = pony();
    const friend = makeActor('Spike', { x: 10, system: { health: { value: 8, max: 10, bonus: 0 } } });
    target(friend);
    await use(itemNamed(twilight, 'Friendship Is Mystical'), { option: 1 });
    expect(friend.flags.essence20.expandedMysticismFortifyType).toBe('evasion');
    expect(spent).toContainEqual({ name: 'Twilight', action: 'free' });
    expect(points(twilight)).toBe(2);
    await use(itemNamed(twilight, 'Friendship Is Mystical'), { option: 2 });
    expect(friend.system.health.value).toBe(10);
    expect(points(twilight)).toBe(0);
    expect(spent).toContainEqual({ name: 'Twilight', action: 'standard' });
  });

  test('no Mystical Points: refused with a warning; nobody targeted, or yourself: refused', async () => {
    const twilight = pony(0);
    const friend = makeActor('Spike', { x: 10 });
    target(friend);
    picks = ['athletics'];
    await use(itemNamed(twilight, 'Friendship Is Mystical'), { option: 0 });
    expect(ui.notifications.warn).toHaveBeenCalledWith('E20.Mlp2NoMystical');
    expect(friend.flags.essence20.ruleMarks?.fimFitIn).toBeUndefined();
    target(twilight);
    await use(itemNamed(twilight, 'Friendship Is Mystical'), { option: 1 });
    expect(twilight.flags.essence20.expandedMysticismFortifyType).toBeUndefined();
  });
});

describe('Help Yourself', () => {
  test('a successful cast summons the clone for this scene; then once a round it Lends Assistance (the Skill half, 15 ft)', async () => {
    canvas.scene = { id: 's1', name: 'Ponyville' };
    const caster = makeActor('Twilight', { items: [{ ...packItem('helpYourself'), type: 'spell' }] });
    const spell = itemNamed(caster, 'Help Yourself');
    const button = () => useAvailable(spell, spell.system.rules[1], 1);
    expect(button()).toBe(false);
    await fireTriggers(caster, 'afterRoll', { roll: { item: spell }, outcome: 'failure', facts: {} });
    expect(button()).toBe(false);
    await fireTriggers(caster, 'afterRoll', { roll: { item: spell }, outcome: 'success', facts: {} });
    expect(caster.flags.essence20.helpYourselfClone.sceneId).toBe('s1');
    expect(button()).toBe(true);
    startCombat(1, 0, [combatant(caster, 10)]);
    lendAssist.lendAssistanceSkill.mockClear();
    await use(spell, { which: 'The clone Lends Assistance (15 ft)' });
    expect(lendAssist.lendAssistanceSkill).toHaveBeenCalledWith(caster, { radiusFeet: 15 });
    expect(button()).toBe(false);
    game.combat.round = 2;
    expect(button()).toBe(true);
    // A cancelled assist doesn't use the round up; another scene - the clone is gone.
    lendAssist.lendAssistanceSkill.mockImplementationOnce(async () => false);
    await use(spell, { which: 'The clone Lends Assistance (15 ft)' });
    expect(button()).toBe(true);
    canvas.scene = { id: 's2', name: 'Canterlot' };
    expect(button()).toBe(false);
  });
});

describe('Temper Tempest', () => {
  const stormCards = () => cards().filter(data => data.flags?.essence20?.ruleButtons);
  const press = async (label, user = game.user) => {
    const card = stormCards().at(-1);
    card.update = async data => applyUpdate(card, data);
    const index = card.flags.essence20.ruleButtons.buttons.findIndex(button => button.label == label);
    return pressCardButton(card, index, user);
  };

  const mage = (extra = []) => {
    const actor = makeActor('Rarity', { items: [{ ...packItem('temperTempest'), type: 'spell' }, ...extra] });
    return { actor, spell: itemNamed(actor, 'Temper Tempest') };
  };

  test('a successful cast raises the storm and posts its card; Strike hits up to 3 targets for 3 Energy (4 with More Bang), once a card', async () => {
    const { actor, spell } = mage([packItem('moreBang')]);
    const foes = ['A', 'B', 'C', 'D'].map((name, i) => makeActor(name, { disposition: -1, x: 20 + i }));
    await fireTriggers(actor, 'afterRoll', { roll: { item: spell }, outcome: 'failure', facts: {} });
    expect(actor.flags.essence20.ruleMarks?.temperTempest).toBeUndefined();
    await fireTriggers(actor, 'afterRoll', { roll: { item: spell }, outcome: 'success', facts: {} });
    expect(actor.flags.essence20.ruleMarks.temperTempest).toBeDefined();
    expect(stormCards().at(-1).flags.essence20.ruleButtons.buttons.map(button => button.label)).toEqual(['Strike targeted (3 Energy)', 'Take 1 Stress (Health)', 'Calm Down (DIF 20 Alertness)']);
    target(...foes);
    await press('Strike targeted (3 Energy)');
    expect(dealt).toEqual(['A', 'B', 'C'].map(name => ({ name, amount: 4, type: 'element' })));
    await press('Strike targeted (3 Energy)');
    expect(dealt).toHaveLength(3);
    await press('Take 1 Stress (Health)');
    expect(dealt.at(-1)).toEqual({ name: 'Rarity', amount: 1, type: 'special' });
    // A second success while it rages starts nothing new.
    const before = stormCards().length;
    await fireTriggers(actor, 'afterRoll', { roll: { item: spell }, outcome: 'success', facts: {} });
    expect(stormCards()).toHaveLength(before);
  });

  test('each turn start posts the card again; Defeated or Unconscious, the storm dissipates; Calm Down on DIF 20 Alertness ends it', async () => {
    const { actor, spell } = mage();
    await fireTriggers(actor, 'afterRoll', { roll: { item: spell }, outcome: 'success', facts: {} });
    const before = stormCards().length;
    await fireTriggers(actor, 'turnStart');
    expect(stormCards()).toHaveLength(before + 1);
    grants.rollTest.mockImplementationOnce(async () => ({ success: false, multiplier: 0 }));
    await press('Calm Down (DIF 20 Alertness)');
    expect(grants.rollTest).toHaveBeenCalledWith(actor, 'alertness', 20, expect.any(Object));
    expect(actor.flags.essence20.ruleMarks.temperTempest).toBeDefined();
    await press('Calm Down (DIF 20 Alertness)');
    expect(actor.flags.essence20.ruleMarks.temperTempest).toBeUndefined();
    // Gone: the old card's buttons do nothing.
    await press('Take 1 Stress (Health)');
    expect(dealt).toHaveLength(0);
    await fireTriggers(actor, 'afterRoll', { roll: { item: spell }, outcome: 'success', facts: {} });
    actor.statuses.add('unconscious');
    const count = stormCards().length;
    await fireTriggers(actor, 'turnStart');
    expect(stormCards()).toHaveLength(count);
    expect(actor.flags.essence20.ruleMarks.temperTempest).toBeUndefined();
  });
});

describe('Terror / Apex Dark Ranger', () => {
  const APEX = 'Compendium.essence20.beneath_the_helmet.Item.GJCOxtuot74Jnfs4';
  const ranger = (extra = []) => makeActor('Dark Ranger', { items: [packItem('terror'), { name: 'Terror Capacity', type: 'rolePoints', system: { resource: { value: 0, max: 2 } } }, ...extra] });
  const terror = actor => itemNamed(actor, 'Terror Capacity').system.resource.value;
  const hit = (actor, foe, { edge = true, damage = 2, outcome = 'success' } = {}) => fireTriggers(actor, 'hit', { roll: { edge }, outcome, targets: [foe], facts: { results: [{ success: outcome == 'success', damageValue: damage }] } });

  test('a damaging hit rolled with Edge gains 1 Terror, up to the Capacity; no Edge, no damage, a miss or a Frightened-immune target: none', async () => {
    const actor = ranger();
    const foe = makeActor('Foe', { disposition: -1 });
    const fearless = makeActor('Fearless', { disposition: -1 });
    immunityHelpers.isImmune = (who, condition) => who === fearless && condition == 'frightened';
    await hit(actor, foe, { edge: false });
    await hit(actor, foe, { damage: 0 });
    await hit(actor, fearless);
    expect(terror(actor)).toBe(0);
    await hit(actor, foe);
    expect(terror(actor)).toBe(1);
    await hit(actor, foe);
    await hit(actor, foe);
    expect(terror(actor)).toBe(2);
    immunityHelpers.isImmune = null;
  });

  test('with Apex Dark Ranger, no Edge is needed', async () => {
    const actor = ranger([bookItem(APEX, { name: 'Apex Dark Ranger', type: 'perk' })]);
    await hit(actor, makeActor('Foe', { disposition: -1 }), { edge: false });
    expect(terror(actor)).toBe(1);
  });
});

describe('Anonymous', () => {
  const INUNDATION = 'Compendium.essence20.gi_joe_crb.Item.Q09tkHIaVX65lokl';
  const INFORMED = 'Compendium.essence20.tf_crb.Item.JtWhjDRI0HDewaKe';
  const wearer = (equipped = true) => {
    const actor = makeActor('Agent', { disposition: -1 });
    const armor = actor.addItem({ name: 'Battledress', type: 'armor', system: { equipped } });
    actor.addItem({ ...packItem('anonymous'), flags: { ...packItem('anonymous').flags, essence20: { parentId: armor.id } } });
    return actor;
  };

  const snagged = (roller, target, facts) => ruleRollSources(roller, target, facts).sources.some(source => source.snag);

  test('a repeat Outwit (Deception / Intimidation) from an Inundation holder who has outwitted the wearer is Snagged', async () => {
    const agent = wearer();
    const psych = makeActor('Psych', { items: [bookItem(INUNDATION, { name: 'Inundation' })] });
    expect(snagged(psych, agent, { rolledSkill: 'deception' })).toBeFalsy();
    await agent.update({ [`flags.essence20.ruleMarks.outwitted--${psych.id}`]: { by: psych.uuid, until: null, stamp: null } });
    expect(snagged(psych, agent, { rolledSkill: 'deception' })).toBe(true);
    expect(snagged(psych, agent, { rolledSkill: 'intimidation' })).toBe(true);
    expect(snagged(psych, agent, { rolledSkill: 'athletics' })).toBeFalsy();
    // Without Inundation, or with the armor off: no Snag.
    const plain = makeActor('Plain');
    await agent.update({ [`flags.essence20.ruleMarks.outwitted--${plain.id}`]: { by: plain.uuid, until: null, stamp: null } });
    expect(snagged(plain, agent, { rolledSkill: 'deception' })).toBeFalsy();
    const off = wearer(false);
    await off.update({ [`flags.essence20.ruleMarks.outwitted--${psych.id}`]: { by: psych.uuid, until: null, stamp: null } });
    expect(snagged(psych, off, { rolledSkill: 'deception' })).toBeFalsy();
  });

  test('attacks from an Informed Accuracy holder who has analyzed the wearer twice or more are Snagged', async () => {
    const agent = wearer();
    const key = agent.uuid.replace(/\./g, '-');
    const bot = makeActor('Bot', { items: [bookItem(INFORMED, { name: 'Informed Accuracy' })], flags: { analyzeTargetCounts: { [key]: 1 } } });
    const attack = { isAttack: true, item: { type: 'weaponEffect', system: { classification: { style: 'ranged' } } } };
    expect(snagged(bot, agent, attack)).toBeFalsy();
    bot.flags.essence20.analyzeTargetCounts[key] = 2;
    expect(snagged(bot, agent, attack)).toBe(true);
    expect(snagged(bot, agent, { rolledSkill: 'athletics' })).toBeFalsy();
    expect(ruleRollSources(bot, agent, attack).sources.filter(source => source.snag)).toHaveLength(1);
  });
});

/** Active Effects on a test actor: createEmbeddedDocuments / deleteEmbeddedDocuments of 'ActiveEffect' land in actor.effects. */
function withEffects(actor) {
  actor.effects = [];
  const createItems = actor.createEmbeddedDocuments;
  const deleteItems = actor.deleteEmbeddedDocuments;
  actor.createEmbeddedDocuments = jest.fn(async (kind, datas) => (kind == 'ActiveEffect'
    ? datas.map(data => {
      const effect = { id: `e${nextId++}`, ...data };
      actor.effects.push(effect);
      return effect;
    })
    : createItems(kind, datas)));
  actor.deleteEmbeddedDocuments = jest.fn(async (kind, ids) => {
    if (kind == 'ActiveEffect') {
      actor.effects = actor.effects.filter(effect => !ids.includes(effect.id));
      return;
    }

    return deleteItems(kind, ids);
  });
  return actor;
}

/** fromUuid for compendium entries in a test: the entries given, each with toObject(). */
function compendium(entries) {
  const lookup = global.fromUuid;
  global.fromUuid = async uuid => {
    const entry = entries.find(e => e.uuid == uuid);
    return entry ? { ...entry, toObject: () => JSON.parse(JSON.stringify({ name: entry.name, type: entry.type, system: entry.system ?? {}, flags: {} })) } : lookup(uuid);
  };
}

describe('Solid-State Energon', () => {
  const crystal = (quantity = 2, points = 0) => {
    const actor = makeActor('Bot', { x: 0 });
    const base = packItem('solidEnergon');
    actor.addItem({ ...base, system: { ...base.system, quantity }, flags: { ...base.flags, essence20: points ? { tf1Points: points } : {} } });
    return { actor, item: itemNamed(actor, 'Solid-State Energon') };
  };

  const answers = [];
  const run = (item, option, ...values) => {
    answers.length = 0;
    answers.push(...values);
    return runUse(item, pay, { ask: async () => option });
  };

  beforeEach(() => {
    foundry.applications.api.DialogV2.prompt.mockImplementation(async ({ content }) => {
      const value = answers.shift();
      return value === undefined ? Number(/value="(\d+)"/.exec(content)?.[1]) : value;
    });
  });

  test('damaged: 1d2 + the damage at least the stored points - it explodes, used up, an Apply Damage card for everyone within 10 ft per point', async () => {
    const { item } = crystal();
    const near = makeActor('Near', { x: 15 });
    makeActor('Far', { x: 40 });
    await run(item, 0, 2, 1);
    expect(item.flags.essence20.tf1Points).toBe(2);
    expect(item.system.quantity).toBe(1);
    const card = cards().find(data => String(data.content).includes('detonates'));
    expect(card.content).toContain('within 20 ft');
    expect((card.content.match(/data-action="apply-damage"/g) ?? []).length).toBe(2);
    expect(card.content).toContain(near.uuid);
    // The stored points are the next dialog's starting value.
    await run(item, 0, undefined, 0);
    const prompts = foundry.applications.api.DialogV2.prompt.mock.calls;
    expect(prompts.at(-2)[0].content).toContain('value="2"');
  });

  test('damaged below the stored points: it holds; refine: a Standard action and DIF 14 Science, used up on a success', async () => {
    const { actor, item } = crystal(2, 5);
    expect(await run(item, 0, 5, 0)).toContain('The crystal holds');
    expect(item.system.quantity).toBe(2);
    grants.rollTest.mockImplementationOnce(async () => ({ success: false, multiplier: 0 }));
    await run(item, 1, 5);
    expect(item.system.quantity).toBe(2);
    await run(item, 1, 5);
    expect(grants.rollTest).toHaveBeenLastCalledWith(actor, 'science', 14, expect.any(Object));
    expect(spent).toContainEqual({ name: 'Bot', action: 'standard' });
    expect(item.system.quantity).toBe(1);
    item.system.quantity = 0;
    expect(useAvailable(item, item.system.rules[0], 0)).toBe(false);
  });
});

describe('They Called It a Glitch!', () => {
  const PERK = { uuid: 'Compendium.essence20.gi_joe_crb.Item.generalPerk', name: 'Brawler', type: 'perk', system: { type: 'general' } };
  const surgeon = () => makeActor('Knock Out', { items: [packItem('glitch')] });

  afterEach(() => {
    grants.findItems.mockReset();
    grants.findItems.mockImplementation(async () => []);
    grants.pickOne.mockReset();
    grants.pickOne.mockImplementation(async () => null);
  });

  test('operate: a General Perk picked, DIF 20 Technology; on a success the ally gains it and an Active Effect of -2 maximum Health; reverse removes both', async () => {
    const doc = surgeon();
    const ally = withEffects(makeActor('Breakdown', { x: 5, system: { health: { value: 10, max: 10, bonus: 0 } } }));
    target(ally);
    compendium([PERK]);
    grants.findItems.mockImplementation(async ({ type, matches }) => [PERK].filter(entry => entry.type == type && (!matches || matches(entry))));
    grants.pickOne.mockImplementation(async (title, rows) => rows[0]?.uuid ?? null);
    await use(itemNamed(doc, 'They Called It A Glitch!'));
    expect(grants.rollTest).toHaveBeenCalledWith(doc, 'technology', 20, expect.any(Object));
    const perk = itemNamed(ally, 'Brawler');
    expect(perk.flags.essence20.tf1GlitchPerk).toBe(true);
    expect(ally.effects).toHaveLength(1);
    expect(ally.effects[0]).toMatchObject({ name: 'They Called It A Glitch!: Brawler', changes: [{ key: 'system.health.bonus', mode: 2, value: '-2' }] });
    expect(ally.effects[0].flags.essence20.tf1Glitch).toEqual({ itemId: perk.id, by: doc.uuid });
    await use(itemNamed(doc, 'They Called It A Glitch!'), { option: 1 });
    expect(ally.effects).toHaveLength(0);
    expect(itemNamed(ally, 'Brawler')).toBeUndefined();
  });

  test('refused: yourself, one left at 1 maximum Health or lower, or in combat', async () => {
    const doc = surgeon();
    target(doc);
    await use(itemNamed(doc, 'They Called It A Glitch!'));
    expect(ui.notifications.warn).toHaveBeenLastCalledWith('E20.Tf1PickAlly');
    const frail = withEffects(makeActor('Frail', { system: { health: { value: 3, max: 3, bonus: 0 } } }));
    target(frail);
    await use(itemNamed(doc, 'They Called It A Glitch!'));
    expect(ui.notifications.warn).toHaveBeenLastCalledWith('E20.RulesExtItems2.GlitchTooFrail');
    expect(grants.rollTest).not.toHaveBeenCalled();
    startCombat();
    const glitch = itemNamed(doc, 'They Called It A Glitch!');
    expect(useAvailable(glitch, glitch.system.rules[0], 0)).toBe(false);
  });
});

describe('Alt Mode Mimicry / Drone', () => {
  const mode = (id, name, altModesize, extra = {}) => ({ uuid: `Compendium.essence20.tf_crb.Item.${id}`, name, type: 'altMode', system: { altModesize, ...extra } });
  const JET = mode('jet', 'Jet', 'common');
  const TANK = mode('tank', 'Tank', 'large', { botModeSize: 'large' });
  const SHIP = mode('ship', 'Ship', 'huge');
  const CAR = mode('car', 'Car', 'common');
  const origin = (id, name, modes, system = {}) => ({
    uuid: `Compendium.essence20.tf_crb.Item.${id}`, name, type: 'origin',
    system: { items: Object.fromEntries(modes.map(m => [m.uuid, { uuid: m.uuid, type: 'altMode' }])), ...system },
  });
  const SEEKER = origin('seeker', 'Seeker', [JET]);
  const WARRIOR = origin('warrior', 'Warrior', [TANK, SHIP], { baseGroundMovement: 30, baseAerialMovement: 0, baseAquaticMovement: 10 });
  const SCOUT = origin('scout', 'Scout', [CAR]);
  const offered = [];
  beforeEach(() => {
    offered.length = 0;
    chassisHelpers.index = async () => ({ origins: [SEEKER, WARRIOR, SCOUT], altModes: new Map([JET, TANK, SHIP, CAR].map(m => [m.uuid, m])) });
    chassisHelpers.choose = async (title, prompt, options) => {
      offered.push(options.map(option => option.label));
      const answer = picks.shift();
      return options.find(option => option.value == answer || option.label == answer)?.value ?? null;
    };

    compendium([JET, TANK, SHIP, CAR]);
  });

  test('size classes: Long / Extended share Large / Huge; under two classes larger only', () => {
    expect(sizeClass('long')).toBe(sizeClass('large'));
    expect(mimicrySizeOk('common', 'large')).toBe(true);
    expect(mimicrySizeOk('common', 'huge')).toBe(false);
    expect(mimicrySizeOk('large', 'extended')).toBe(true);
    expect(mimicrySizeOk('huge', 'small')).toBe(true);
  });

  test('Mimicry: chassis of Origins not yet drawn from, within the size window; two picks, four with Alt Mode Mastery', async () => {
    const bot = makeActor('Modemaster', { items: [packItem('mimicry')] });
    bot.addItem({ name: 'Jet', type: 'altMode', system: { altModesize: 'common' }, flags: { core: { sourceId: JET.uuid }, essence20: { parentId: 'origin1' } } });
    const perk = itemNamed(bot, 'Alt Mode Mimicry');
    picks = [TANK.uuid];
    await use(perk);
    expect(offered[0]).toEqual(['Car (Scout)', 'Tank (Warrior)']);
    expect(itemNamed(bot, 'Tank').flags.essence20.tf1Mimicry).toBe(true);
    expect(bot.system.canTransform).toBe(true);
    picks = [CAR.uuid];
    await use(perk);
    expect(offered[1]).toEqual(['Car (Scout)']);
    expect(useAvailable(perk, perk.system.rules[0], 0)).toBe(false);
    bot.addItem(bookItem('Compendium.essence20.decepticon_directive.Item.pVpAdlWmS3psTgIp', { name: 'Alt Mode Mastery' }));
    expect(useAvailable(perk, perk.system.rules[0], 0)).toBe(true);
  });

  test('Mimicry with no Alt Mode of your own: refused with a warning', async () => {
    const bot = makeActor('Modemaster', { items: [packItem('mimicry')] });
    await use(itemNamed(bot, 'Alt Mode Mimicry'));
    expect(ui.notifications.warn).toHaveBeenCalledWith('E20.Tf1NoOriginalAltMode');
  });

  test('Drone: pick another Origin, then its chassis - the Alt Mode (on the Origin), its Movements and Bot Mode Size; once', async () => {
    const drone = makeActor('Drone', { system: { movement: { ground: { base: 0 }, aerial: { base: 0 }, swim: { base: 0 } }, size: 'common' } });
    drone.addItem({ ...packItem('drone'), type: 'origin' });
    const own = itemNamed(drone, 'Drone');
    picks = [WARRIOR.uuid, TANK.uuid];
    await use(own);
    const tank = itemNamed(drone, 'Tank');
    expect(tank.flags.essence20.parentId).toBe(own.id);
    expect(tank.flags.essence20.grantedBy).toBeUndefined();
    expect(drone.system).toMatchObject({ canTransform: true, size: 'large', movement: { ground: { base: 30 }, aerial: { base: 0 }, swim: { base: 10 } } });
    expect(own.flags.essence20.copiedOrigin).toBe(WARRIOR.uuid);
    expect(useAvailable(own, own.system.rules[0], 0)).toBe(false);
  });
});

describe('Artillery Support', () => {
  const caller = () => makeActor('Flint', { items: [{ ...packItem('artillery'), type: 'gear' }] });
  const damageButtons = content => [...String(content).matchAll(/data-target-uuid="([^"]+)" data-damage="(\d+)" data-damage-type="(\w+)"/g)].map(([, uuid, amount, type]) => `${uuid}:${amount}:${type}`);

  test('High Explosive out of combat: a point, the Full Action, the landing card at once; Bring it in rolls Targeting against everyone within 40 ft - 2 Fire + 2 Blunt on a hit, 1 + 1 for those who Defend', async () => {
    const flint = caller();
    const near = makeActor('Viper', { disposition: -1, x: 30 });
    const other = makeActor('Trooper', { disposition: -1, x: 35 });
    makeActor('Far', { disposition: -1, x: 90 });
    points = [{ x: 0, y: 0 }];
    flint._dice.rollSkill.mockResolvedValueOnce({ outcomes: [{ results: [{ targetUuid: near.uuid, success: true }, { targetUuid: other.uuid, success: false }] }] });
    const out = await use(itemNamed(flint, 'Artillery Support'), { option: 1 });
    expect(out).toContain('High Explosive');
    expect(spent).toContainEqual({ name: 'Flint', action: 'fullAction' });
    await pressLast();
    expect(flint._dice.rollSkill).toHaveBeenCalledWith(expect.objectContaining({ skill: 'targeting', defenseType: 'evasion' }), flint);
    expect(canvas.tokens.setTargets).toHaveBeenLastCalledWith(expect.arrayContaining([near.token.id, other.token.id, flint.token.id]));
    const card = cards().at(-1);
    expect(damageButtons(card.content)).toEqual([`${near.uuid}:2:fire`, `${near.uuid}:2:blunt`, `${other.uuid}:1:fire`, `${other.uuid}:1:blunt`]);
    expect(card.content).toContain('Trooper (E20.RulesExtItems2.Defended)');
  });

  test('in combat the strike lands at the start of the caller\'s next turn; HEAT hits the targeted vehicle (Toughness), then 2 Fire around it (Evasion)', async () => {
    const flint = caller();
    const tank = makeActor('HISS', { disposition: -1, x: 50, type: 'vehicle' });
    const crew = makeActor('Driver', { disposition: -1, x: 55 });
    target(tank);
    const combat = startCombat(1, 0, [combatant(flint, 10)]);
    await use(itemNamed(flint, 'Artillery Support'), { option: 2 });
    expect(buttonCards()).toHaveLength(0);
    const { scheduledTurnStart } = await import('./plugins/combat/rigs-and-blasts.mjs');
    await scheduledTurnStart(flint, combat);
    expect(buttonCards()).toHaveLength(1);
    flint._dice.rollSkill
      .mockResolvedValueOnce({ outcomes: [{ results: [{ targetUuid: tank.uuid, success: true }] }] })
      .mockResolvedValueOnce({ outcomes: [{ results: [{ targetUuid: crew.uuid, success: true }] }] });
    await pressLast();
    expect(flint._dice.rollSkill.mock.calls.map(([data]) => data.defenseType)).toEqual(['toughness', 'evasion']);
    const [primary, splash] = cards().slice(-2);
    expect(damageButtons(primary.content)).toEqual([`${tank.uuid}:4:blunt`, `${tank.uuid}:4:fire`]);
    expect(damageButtons(splash.content)).toEqual([`${crew.uuid}:2:fire`]);
  });

  test('Flare and Smoke do no damage - the landing card says what covers the area', async () => {
    const flint = caller();
    points = [{ x: 0, y: 0 }];
    await use(itemNamed(flint, 'Artillery Support'), { option: 4 });
    await pressLast();
    expect(flint._dice.rollSkill).not.toHaveBeenCalled();
    expect(cards().at(-1).content).toContain('Smoke heavily obscures a 60 foot radius');
  });
});

describe('Self Improvement', () => {
  const STRENGTH = { strength: { value: 2, max: 2 }, speed: { value: 3, max: 3 }, smarts: { value: 1, max: 1 }, social: { value: 1, max: 1 } };
  const caster = () => makeActor('Twilight', { items: [{ ...packItem('selfImprovement'), type: 'spell' }], system: { essences: JSON.parse(JSON.stringify(STRENGTH)), skills: { might: {}, athletics: {}, alertness: {} } } });
  const derived = async actor => {
    const { ruleDerived } = await import('./adapter.mjs');
    ruleDerived(actor);
  };

  test('on a targeted friend: one Essence +1 (and its maximum), its Defense +1 and ↑1 on the picked Skill of that Essence, for the scene', async () => {
    CONFIG.E20.skillToEssence = { ...CONFIG.E20.skillToEssence, might: 'strength', athletics: 'strength', alertness: 'smarts' };
    const twilight = caster();
    const friend = makeActor('Spike', { system: { essences: JSON.parse(JSON.stringify(STRENGTH)), defenses: { toughness: { total: 13 }, evasion: { total: 11 }, willpower: { total: 12 }, cleverness: { total: 10 } } } });
    target(friend);
    picks = ['might'];
    await use(itemNamed(twilight, 'Self Improvement'), { option: 0 });
    expect(friend.flags.essence20.ruleMarks.selfImprovementStrength).toMatchObject({ by: twilight.uuid, text: 'might', until: 'scene' });
    await derived(friend);
    expect(friend.system.essences.strength).toMatchObject({ value: 3, max: 3 });
    expect(friend.system.defenses.toughness.total).toBe(14);
    expect(friend.system.defenses.evasion.total).toBe(11);
    expect(shiftsOf(ruleRollSources(friend, null, { rolledSkill: 'might' }).sources).up).toBe(1);
    expect(shiftsOf(ruleRollSources(friend, null, { rolledSkill: 'athletics' }).sources).up).toBe(0);
    // The caster isn't improved.
    await derived(twilight);
    expect(twilight.system.essences.strength.value).toBe(2);
  });

  test('with nobody targeted it improves the caster; an Essence already improved is not offered again', async () => {
    CONFIG.E20.skillToEssence = { ...CONFIG.E20.skillToEssence, might: 'strength', alertness: 'smarts' };
    const twilight = caster();
    twilight.system.defenses = { toughness: { total: 13 }, evasion: { total: 11 }, willpower: { total: 12 }, cleverness: { total: 10 } };
    picks = ['might'];
    await use(itemNamed(twilight, 'Self Improvement'), { option: 0 });
    await derived(twilight);
    expect(twilight.system.essences.strength).toMatchObject({ value: 3, max: 3 });
    expect(twilight.system.defenses.toughness.total).toBe(14);
    expect(shiftsOf(ruleRollSources(twilight, null, { rolledSkill: 'might' }).sources).up).toBe(1);
    // Strength is taken: the first option offered now is Speed.
    let offered = null;
    picks = ['alertness'];
    await runUse(itemNamed(twilight, 'Self Improvement'), pay, { ask: async (step, options) => {
      offered = offered ?? options.map(option => option.label);
      return 0;
    } });
    expect(offered).not.toContain('Strength');
  });
});

describe('Guardian Blast', () => {
  const groupCard = () => cards().filter(data => data.flags?.essence20?.groupTest).at(-1);
  const rollFor = async (actor, success) => {
    const { onGroupButton } = await import('../mechanics/rolls/group-tests.mjs');
    actor._dice.rollSkill.mockResolvedValueOnce({ success });
    await onGroupButton(groupCard(), { dataset: { e20Social: 'groupRoll', actor: actor.uuid } });
  };

  test('the leader picks who joins and spends a Standard action; a Group Targeting test against the target\'s Evasion; Resolve deals 5 Energy when half or more hit', async () => {
    CONFIG.E20.skills = { ...CONFIG.E20.skills, targeting: 'E20.SkillTargeting' };
    foundry.utils.escapeHTML = text => String(text);
    const leader = makeActor('Eltarian', { items: [packItem('guardianBlast')] });
    const ally = makeActor('Ally', { x: 10 });
    const other = makeActor('Other', { x: 20 });
    const foe = makeActor('Foe', { disposition: -1, x: 30, system: { defenses: { evasion: { total: 14 } } } });
    target(foe);
    foundry.applications.api.DialogV2.wait.mockImplementationOnce(async () => [ally, other]);
    startCombat(1, 0, [combatant(leader, 10), combatant(ally, 8), combatant(other, 6)]);
    await use(itemNamed(leader, 'Guardian Blast'));
    expect(spent).toEqual([{ name: 'Eltarian', action: 'standard' }]);
    const test = groupCard().flags.essence20.groupTest;
    expect(test).toMatchObject({ skill: 'targeting', dif: 14, leader: leader.uuid, participants: [leader.uuid, ally.uuid, other.uuid], cost: 'standard' });
    await rollFor(leader, true);
    await rollFor(ally, false);
    // The leader rolls for free; every other participant spends their Standard action.
    expect(spent).toEqual([{ name: 'Eltarian', action: 'standard' }, { name: 'Ally', action: 'standard' }]);
    expect(leader._dice.rollSkill).toHaveBeenCalledWith(expect.objectContaining({ skill: 'targeting', dif: '14' }), leader);
    await pressLast();
    expect(dealt).toEqual([]);
    await rollFor(other, true);
    buttonCards().at(-1).flags.essence20.ruleButton.used = false;
    await pressLast();
    expect(dealt).toEqual([{ name: 'Foe', amount: 5, type: 'energy' }]);
  });
});

describe('Perfect Placement', () => {
  const place = (actor, x, y) => Object.assign(actor.getActiveTokens()[0].document, { x, y, width: 1, height: 1 });
  const ranged = { isAttack: true, item: { type: 'weaponEffect', system: { classification: { style: 'ranged' } } } };
  const setup = async () => {
    canvas.scene = { id: 's1', name: 'Map' };
    canvas.grid.size = 100;
    canvas.grid.distance = 5;
    const surveyor = makeActor('Surveyor', { items: [packItem('perfectPlacement')] });
    place(surveyor, 300, 300);
    points = [{ x: 500, y: 500 }];
    await use(itemNamed(surveyor, 'Perfect Placement'));
    return surveyor;
  };

  test('the Use places a 25 ft square for the scene; wholly inside it: +2 Evasion (per attack), ↑1 on the first test each combat round', async () => {
    const surveyor = await setup();
    expect(surveyor.flags.essence20.ruleZones).toEqual([expect.objectContaining({ key: 'perfectPlacement', x: 500, y: 500, half: 2.5, sceneId: 's1', until: 'scene' })]);
    const { ruleDefenseAdjust } = await import('./adapter.mjs');
    const foe = makeActor('Foe', { disposition: -1 });
    expect(ruleDefenseAdjust(foe, surveyor, 'evasion')).toBe(2);
    expect(ruleDefenseAdjust(foe, surveyor, 'toughness')).toBe(0);
    expect(shiftsOf(ruleRollSources(surveyor, null, { rolledSkill: 'athletics' }).sources).up).toBe(0);
    startCombat();
    const first = ruleRollSources(surveyor, null, { rolledSkill: 'athletics' });
    expect(shiftsOf(first.sources).up).toBe(1);
    expect(first.consumes).toContainEqual(expect.objectContaining({ ext: 'rulesLimit' }));
    // Half outside the square: nothing.
    place(surveyor, 700, 300);
    expect(ruleDefenseAdjust(foe, surveyor, 'evasion')).toBe(0);
    expect(shiftsOf(ruleRollSources(surveyor, null, { rolledSkill: 'athletics' }).sources).up).toBe(0);
    // Placing it again moves it (one square).
    points = [{ x: 900, y: 900 }];
    await use(itemNamed(surveyor, 'Perfect Placement'));
    expect(surveyor.flags.essence20.ruleZones).toHaveLength(1);
  });

  test('ranged attacks from inside cancel the Cover of a target inside (↑2); ranged attacks at the holder take ↓2 unless it already has Cover', async () => {
    const surveyor = await setup();
    const foe = makeActor('Foe', { disposition: -1, statuses: ['cover'] });
    place(foe, 500, 500);
    expect(shiftsOf(ruleRollSources(surveyor, foe, ranged).sources).up).toBe(2);
    place(foe, 900, 500);
    expect(shiftsOf(ruleRollSources(surveyor, foe, ranged).sources).up).toBe(0);
    const shooter = makeActor('Shooter', { disposition: -1 });
    place(shooter, 1500, 1500);
    expect(shiftsOf(ruleRollSources(shooter, surveyor, ranged).sources).down).toBe(2);
    surveyor.statuses.add('cover');
    expect(shiftsOf(ruleRollSources(shooter, surveyor, ranged).sources).down).toBe(0);
  });
});

describe('Elemental Fury', () => {
  const zordWith = () => {
    const zord = makeActor('Zord', { type: 'zord', items: [{ ...packItem('elementalFury'), type: 'feature' }] });
    zord.addItem({ name: 'Cannon', type: 'weaponEffect', system: { damageValue: 3, defenseType: 'evasion', classification: { style: 'energy' }, range: { min: 0, max: 60 } } });
    zord.addItem({ name: 'Fist', type: 'weaponEffect', system: { damageValue: 5, classification: { style: 'melee' } } });
    zord.addItem({ name: 'Blaster', type: 'weaponEffect', system: { damageValue: 4, defenseType: 'toughness', classification: { style: 'ranged' }, range: { min: 0, max: 100 } } });
    return { zord, feature: itemNamed(zord, 'Elemental Fury') };
  };

  const furyAttack = zord => zord.items.contents.find(item => item.type == 'weaponEffect' && item.flags.essence20.furyElement);

  test('once per scene: the element picked the first time (kept), an attack at double the strongest ranged one\'s damage, with its range and the element\'s type, gone once rolled', async () => {
    const { zord, feature } = zordWith();
    picks = ['air'];
    await use(feature);
    const attack = furyAttack(zord);
    expect(attack).toMatchObject({ name: 'Elemental Fury (Air)', system: { damageValue: 8, damageType: 'sonic', defenseType: 'toughness', range: { min: 0, max: 100 }, classification: { style: 'ranged' } } });
    expect(feature.flags.essence20.rules.choices.element).toBe('air');
    const weapon = zord.items.get(attack.flags.essence20.parentId);
    expect(weapon).toMatchObject({ type: 'weapon', flags: { essence20: { grantedBy: feature.id, rulesExpiry: expect.objectContaining({ until: 'scene' }) } } });
    expect(useAvailable(feature, feature.system.rules[0], 0)).toBe(false);
    await fireTriggers(zord, 'afterRoll', { roll: { item: attack }, outcome: 'success', facts: {} });
    expect(furyAttack(zord)).toBeUndefined();
    expect(zord.items.get(weapon.id)).toBeUndefined();
  });

  test('the Critical Success riders: Air Impaired for a round, Fire +2 damage; no ranged attack - refused', async () => {
    const { zord, feature } = zordWith();
    picks = ['air'];
    await use(feature);
    const attack = furyAttack(zord);
    const foe = makeActor('Foe', { disposition: -1 });
    await fireTriggers(zord, 'hit', { roll: { item: attack }, outcome: 'success', targets: [foe], facts: { results: [{ success: true }] } });
    expect(timed).toEqual([]);
    await fireTriggers(zord, 'hit', { roll: { item: attack }, outcome: 'crit', targets: [foe], facts: { results: [{ success: true }] } });
    expect(timed).toEqual([{ name: 'Foe', status: 'impaired', rounds: 1 }]);
    const { hitRiderOnAttack } = await import('./plugins/combat/hit-rider.mjs');
    const fireZord = zordWith();
    fireZord.feature.flags.essence20.rules = { choices: { element: 'fire' } };
    await use(fireZord.feature);
    const fire = furyAttack(fireZord.zord);
    expect(fire.system.damageType).toBe('fire');
    const notes = [];
    const result = { damageValue: 8 };
    hitRiderOnAttack(fireZord.zord, foe, result, { itemUuid: fire.uuid }, { isCrit: true, damageBonusNote: (row, amount) => notes.push(amount) });
    hitRiderOnAttack(fireZord.zord, foe, result, { itemUuid: fire.uuid }, { isCrit: false, damageBonusNote: (row, amount) => notes.push(amount) });
    expect(notes).toEqual([2]);
    const bare = makeActor('Bare Zord', { type: 'zord', items: [{ ...packItem('elementalFury'), type: 'feature' }] });
    picks = ['earth'];
    await use(itemNamed(bare, 'Elemental Fury'));
    expect(ui.notifications.warn).toHaveBeenCalledWith('E20.Pr3FuryNoRanged');
  });
});

describe('Motor Pool Connections', () => {
  const UPGRADES = [
    { uuid: 'Compendium.essence20.qgtg.Item.armor', name: 'Plating', type: 'upgrade', system: { type: 'vehicle', availability: 'limited' } },
    { uuid: 'Compendium.essence20.qgtg.Item.rocket', name: 'Rockets', type: 'upgrade', system: { type: 'vehicle', availability: 'restricted' } },
    { uuid: 'Compendium.essence20.qgtg.Item.paint', name: 'Paint', type: 'upgrade', system: { type: 'vehicle', availability: 'standard' } },
    { uuid: 'Compendium.essence20.qgtg.Item.scope', name: 'Scope', type: 'upgrade', system: { type: 'weapon', availability: 'standard' } },
  ];
  afterEach(() => {
    grants.findItems.mockReset();
    grants.findItems.mockImplementation(async () => []);
    grants.pickOne.mockReset();
    grants.pickOne.mockImplementation(async () => null);
  });

  test('a vehicle, an upgrade within its 3 points this mission (the cost by Availability), Driving or Technology against its DIF; installed on a success', async () => {
    CONFIG.E20.availabilityDifficulties = { standard: 0, limited: 10, restricted: 15 };
    const driver = makeActor('Clutch', { items: [packItem('motorPool')] });
    const jeep = makeActor('VAMP', { type: 'vehicle' });
    compendium(UPGRADES);
    let offered = [];
    grants.findItems.mockImplementation(async ({ type, matches }) => UPGRADES.filter(entry => entry.type == type && (!matches || matches(entry))));
    grants.pickOne.mockImplementation(async (title, rows) => {
      offered = rows.map(row => row.name);
      return rows.find(row => row.name == picks[0])?.uuid ?? null;
    });
    picks = ['Plating'];
    await use(itemNamed(driver, 'Motor Pool Connections'), { option: 1 });
    expect(offered).toEqual(['Plating', 'Paint']);
    expect(grants.rollTest).toHaveBeenCalledWith(driver, 'driving', 10, expect.any(Object));
    expect(itemNamed(jeep, 'Plating').flags.essence20.motorPool).toBe(true);
    // 1 point left: only a Standard upgrade, which needs no roll.
    grants.rollTest.mockClear();
    picks = ['Paint'];
    await use(itemNamed(driver, 'Motor Pool Connections'));
    expect(offered).toEqual(['Paint']);
    expect(grants.rollTest).not.toHaveBeenCalled();
    expect(itemNamed(jeep, 'Paint')).toBeDefined();
    // Spent: refused.
    await use(itemNamed(driver, 'Motor Pool Connections'));
    expect(ui.notifications.warn).toHaveBeenCalledWith('E20.RulesExtItems2.MotorPoolSpent');
  });

  test('a failed roll still spends the budget and installs nothing', async () => {
    CONFIG.E20.availabilityDifficulties = { standard: 0, limited: 10, restricted: 15 };
    const driver = makeActor('Clutch', { items: [packItem('motorPool')] });
    const jeep = makeActor('VAMP', { type: 'vehicle' });
    compendium(UPGRADES);
    grants.findItems.mockImplementation(async ({ type, matches }) => UPGRADES.filter(entry => entry.type == type && (!matches || matches(entry))));
    grants.pickOne.mockImplementation(async (title, rows) => rows.find(row => row.name == 'Plating')?.uuid ?? null);
    grants.rollTest.mockImplementationOnce(async () => ({ success: false, multiplier: 0 }));
    expect(await use(itemNamed(driver, 'Motor Pool Connections'))).toContain('denied');
    expect(itemNamed(jeep, 'Plating')).toBeUndefined();
    expect(driver.flags.essence20[`motorPool-${jeep.uuid.replace(/\./g, '-')}`]).toMatchObject({ window: 'mission', count: 2 });
  });
});

describe('Third Dimension', () => {
  test('a move counts only the distance since the last change of Movement type', async () => {
    const { onMovementUsed, usedSinceTypeChange } = await import('./plugins/combat/since-type-change.mjs');
    const movement = {
      history: { recorded: { waypoints: [{ action: 'walk', cost: 0 }, { action: 'walk', cost: 20 }] } },
      passed: { waypoints: [{ action: 'fly', cost: 15 }] }, pending: { waypoints: [] },
    };
    expect(usedSinceTypeChange(movement)).toBe(15);
    const out = { used: 35 };
    onMovementUsed(makeActor('Triple', { items: [packItem('thirdDimension')] }), movement, out);
    expect(out.used).toBe(15);
    const plain = { used: 35 };
    onMovementUsed(makeActor('Plain'), movement, plain);
    expect(plain.used).toBe(35);
  });
});

describe('Unexpected Alternative', () => {
  test('converting into an Alt Mode an enemy has only seen the other of: Edge on Skill Tests targeting it until the end of the next turn', async () => {
    const { convertedChange } = await import('./plugins/zords/converted-event-and-seen.mjs');
    const triple = makeActor('Blitzwing', { items: [packItem('unexpectedAlternative')], system: { isTransformed: true, altModeId: 'jet' } });
    const seenCar = makeActor('Seen Car', { disposition: -1, x: 10 });
    const seenJet = makeActor('Seen Jet', { disposition: -1, x: 20 });
    const fresh = makeActor('Fresh', { disposition: -1, x: 30 });
    const friend = makeActor('Friend', { x: 15 });
    const key = actor => actor.uuid.replace(/\./g, '-');
    triple.flags.essence20.tf3SeenModes = { [key(seenCar)]: ['car'], [key(seenJet)]: ['jet'] };
    expect(convertedChange(triple, { system: { altModeId: 'jet' } })).toBe('jet');
    expect(convertedChange(triple, { name: 'x' })).toBeNull();
    startCombat(1, 0, [combatant(triple, 10)]);
    await fireTriggers(triple, 'converted', { vars: { altMode: 'jet' } });
    expect(Object.keys(seenCar.flags.essence20.ruleMarks ?? {})).toEqual([`unexpectedAlternative--${triple.id}`]);
    expect(seenJet.flags.essence20.ruleMarks?.[`unexpectedAlternative--${triple.id}`]).toBeUndefined();
    expect(fresh.flags.essence20.ruleMarks?.[`unexpectedAlternative--${triple.id}`]).toBeUndefined();
    expect(triple.flags.essence20.tf3SeenModes).toEqual({ [key(seenCar)]: ['car', 'jet'], [key(seenJet)]: ['jet'], [key(fresh)]: ['jet'] });
    expect(triple.flags.essence20.tf3SeenModes[key(friend)]).toBeUndefined();
    expect(ruleRollSources(triple, seenCar, { rolledSkill: 'targeting' }).sources.map(source => source.edge)).toEqual([true]);
    expect(ruleRollSources(triple, fresh, { rolledSkill: 'targeting' }).sources).toEqual([]);
  });
});

describe('Delegate', () => {
  const oldHand = (moxie = 2) => makeActor('Hawk', { items: [packItem('delegate'), { name: 'Moxie', type: 'rolePoints', system: { resource: { value: moxie, max: 3 } } }] });

  test('1 Moxie Point: the targeted ally picks a spent use - a Scene Clock count goes down by one, a rule limit or a turn stamp goes', async () => {
    const { refundableUses } = await import('./plugins/resources/refund-use.mjs');
    const hawk = oldHand();
    const ally = makeActor('Duke', { x: 5 });
    const perk = ally.addItem({ name: 'Leadership', type: 'perk', system: { rules: [{ type: 'Use', label: 'Rally', steps: [] }] } });
    startCombat(2, 1, [combatant(hawk, 10), combatant(ally, 8)]);
    await ally.update({
      'flags.essence20.luckUsed': { epoch: 1, window: 'scene', count: 2 },
      'flags.essence20.oldUse': { epoch: 0, window: 'scene', count: 1 },
      'flags.essence20.turnUse': { combatId: 'c1', round: 2, turn: 1 },
      'flags.essence20.other': 'x',
      [`flags.essence20.ruleUses.${perk.id}-0`]: { combatId: 'c1', round: 2, turn: 1, count: 1 },
      'flags.essence20.ruleUses.stale': { combatId: 'c0', round: 1, turn: 0, count: 1 },
    });
    expect(refundableUses(ally).map(row => row.label)).toEqual(['Luck Used', 'Turn Use', 'Leadership: Rally']);
    target(ally);
    picks = ['Luck Used'];
    expect(await use(itemNamed(hawk, 'Delegate'))).toContain('Duke gets another use (Luck Used)');
    expect(ally.flags.essence20.luckUsed.count).toBe(1);
    expect(itemNamed(hawk, 'Moxie').system.resource.value).toBe(1);
    picks = ['Leadership: Rally'];
    await use(itemNamed(hawk, 'Delegate'));
    expect(ally.flags.essence20.ruleUses[`${perk.id}-0`]).toBeUndefined();
    expect(itemNamed(hawk, 'Moxie').system.resource.value).toBe(0);
  });

  test('refused: no Moxie, yourself, or nothing spent to give back', async () => {
    const broke = oldHand(0);
    const ally = makeActor('Duke', { x: 5 });
    target(ally);
    await use(itemNamed(broke, 'Delegate'));
    expect(ui.notifications.warn).toHaveBeenLastCalledWith('E20.O2NoMoxie');
    const hawk = oldHand();
    target(hawk);
    await use(itemNamed(hawk, 'Delegate'));
    expect(ui.notifications.warn).toHaveBeenLastCalledWith('E20.O2NeedAlly');
    target(ally);
    await use(itemNamed(hawk, 'Delegate'));
    expect(ui.notifications.warn).toHaveBeenLastCalledWith('E20.O2DelegateNothing');
    expect(itemNamed(hawk, 'Moxie').system.resource.value).toBe(2);
  });
});

describe('Secret Helper', () => {
  const STEALTH = 'Compendium.essence20.mlp_crb.Item.iJPzTlcS5A9pjy25';
  const SUBTLE = 'Compendium.essence20.mlp_crb.Item.kepGfqwF3OgkVgap';
  let nextTurn;
  beforeEach(() => {
    nextTurn = jest.fn(async () => {});
    lazy.setNextTurn = nextTurn;
    global.Roll = class {
      constructor(formula) {
        this.formula = formula;
      }

      async evaluate() {
        this.total = 3;
        return this;
      }

      static fromData(data) {
        return { ...data, total: 15 };
      }
    };
  });
  afterEach(() => {
    lazy.setNextTurn = null;
  });

  const helper = (extra = []) => makeActor('Fluttershy', { items: [packItem('secretHelper'), ...extra], system: { skills: { athletics: { shift: 'd4' } } } });

  test('a friend\'s failed Skill Test: the helper adds their Skill Die for that Skill to the total (once a card) and can\'t take a Standard action next turn', async () => {
    const shy = helper();
    const friend = makeActor('Rainbow');
    const card = checkCard(friend, { rollFailed: true, skill: 'athletics', checkResults: [{ difficulty: 10, success: false }] }, 8);
    const offers = offersFor(card, [shy]);
    expect(offers.map(offer => offer.label ?? offer.rule?.label)).toHaveLength(1);
    await pressOffer(card, { holderUuid: shy.uuid, itemId: offers[0].item.id, index: offers[0].index });
    expect(cards().at(-1).content).toContain('E20.CheckSuccess');
    expect(nextTurn).toHaveBeenCalledWith(shy, { grant: {}, block: ['standard'] }, 'Secret Helper');
    expect(offersFor(card, [shy])).toEqual([]);
  });

  test('Subtle Helper: no Move action instead; Stealth Helper: a Free action used up; no Skill Die, your own roll or a success: not offered', async () => {
    const subtle = helper([bookItem(SUBTLE, { name: 'Subtle Helper' })]);
    const friend = makeActor('Rainbow');
    let card = checkCard(friend, { rollFailed: true, skill: 'athletics', checkResults: [{ difficulty: 10, success: false }] }, 8);
    let [offer] = offersFor(card, [subtle]);
    await pressOffer(card, { holderUuid: subtle.uuid, itemId: offer.item.id, index: offer.index });
    expect(nextTurn).toHaveBeenLastCalledWith(subtle, { grant: {}, block: ['move'] }, 'Secret Helper');
    const stealth = helper([bookItem(SUBTLE, { name: 'Subtle Helper' }), bookItem(STEALTH, { name: 'Stealth Helper' })]);
    card = checkCard(friend, { rollFailed: true, skill: 'athletics', checkResults: [{ difficulty: 10, success: false }] }, 8);
    [offer] = offersFor(card, [stealth]);
    await pressOffer(card, { holderUuid: stealth.uuid, itemId: offer.item.id, index: offer.index });
    expect(nextTurn).toHaveBeenLastCalledWith(stealth, { grant: {}, prespend: { free: 1 } }, 'Secret Helper');
    expect(offersFor(checkCard(friend, { rollFailed: true, skill: 'technology' }), [helper()])).toEqual([]);
    const own = helper();
    expect(offersFor(checkCard(own, { rollFailed: true, skill: 'athletics' }), [own])).toEqual([]);
    expect(offersFor(checkCard(friend, { rollFailed: false, skill: 'athletics' }), [helper()])).toEqual([]);
  });
});

describe('R.R.R. (Rapid Rescue Response)', () => {
  test('at each round start in combat, every damaged being aboard rolls a d2 and regains 1 Health on a 2', async () => {
    const pilot = makeActor('Pilot', { system: { health: { value: 4, max: 10, bonus: 0 } } });
    const rider = makeActor('Rider', { system: { health: { value: 6, max: 10, bonus: 0 } } });
    const healthy = makeActor('Healthy', { system: { health: { value: 10, max: 10, bonus: 0 } } });
    const zord = makeActor('Zord', { type: 'zord', items: [{ ...packItem('rapidRescue'), type: 'feature' }], system: { actors: { a: { uuid: pilot.uuid }, b: { uuid: rider.uuid }, c: { uuid: healthy.uuid } } } });
    const random = jest.spyOn(Math, 'random');
    random.mockReturnValueOnce(0.9).mockReturnValueOnce(0.1);
    await fireTriggers(zord, 'roundStart');
    expect(pilot.system.health.value).toBe(4);
    startCombat(2, 0, [combatant(zord, 10)]);
    await fireTriggers(zord, 'roundStart');
    expect([pilot.system.health.value, rider.system.health.value, healthy.system.health.value]).toEqual([5, 6, 10]);
    random.mockRestore();
  });
});

describe('Relic Key', () => {
  test('once per encounter, a banked Edge for the Zord\'s next roll; with no one driving, Smarts and Social count as 3 for its Defenses', async () => {
    const zord = makeActor('Zord', { type: 'zord', items: [{ ...packItem('relicKey'), type: 'feature' }] });
    const key = itemNamed(zord, 'Relic Key');
    await use(key);
    expect(bankedSources(zord, null, { rolledSkill: 'athletics' }).sources.map(source => source.edge)).toEqual([true]);
    expect(useAvailable(key, key.system.rules[0], 0)).toBe(false);
    const { ruleDriverlessEssence } = await import('./plugins/zords/driverless-essence.mjs');
    expect(ruleDriverlessEssence(zord)).toBe(3);
    expect(ruleDriverlessEssence(makeActor('Plain Zord', { type: 'zord' }))).toBeNull();
  });
});

describe('Fly In The Future', () => {
  test('aboard an Aerial vehicle the Use switches evasive flying on and off: its Aerial speed halves and attacks against it target Evasion', async () => {
    const { ruleEvasiveManeuvers } = await import('./plugins/combat/evasive-maneuvers-rule.mjs');
    const pilot = makeActor('Ace', { items: [packItem('flyInTheFuture')] });
    const perk = itemNamed(pilot, 'Fly In The Future');
    expect(useAvailable(perk, perk.system.rules[1], 1)).toBe(false);
    const jet = makeActor('Skystriker', { type: 'vehicle', system: { movement: { aerial: { base: 80 } }, actors: { d: { uuid: pilot.uuid, vehicleRole: 'driver' } } } });
    rebuildIndex(pilot);
    rebuildIndex(jet);
    expect(useAvailable(perk, perk.system.rules[1], 1)).toBe(true);
    expect(ruleEvasiveManeuvers(jet)).toBe(false);
    // Book check 2026-10-06 (docs/rules-batches/book-durations.md): on until your next turn; a second button ends it early.
    await use(perk, { which: "Evasive maneuvers until your next turn (halves your Aerial vehicle's speed)" });
    expect(ruleEvasiveManeuvers(jet)).toBe(true);
    expect(perk.flags.essence20.rules.toggleUntil.evasive.until).toBe('nextTurnOrScene');
    await use(perk, { which: 'Stop evasive maneuvers' });
    expect(ruleEvasiveManeuvers(jet)).toBe(false);
    // Evasive Handling's own flag on a vehicle counts too.
    expect(ruleEvasiveManeuvers(makeActor('Truck', { type: 'vehicle', flags: { evasiveManeuversActive: true } }))).toBe(true);
  });
});

describe('Zord Feature / Zord Ultra Mode / Versatile Combiner', () => {
  const FEATURE = { uuid: 'Compendium.essence20.pr_crb.Item.armorPlating', name: 'Armor Plating', type: 'feature', system: {} };
  const OWNED = { uuid: 'Compendium.essence20.pr_crb.Item.heldFeature', name: 'Held Feature', type: 'feature', system: {} };
  afterEach(() => {
    grants.findItems.mockReset();
    grants.findItems.mockImplementation(async () => []);
    grants.pickOne.mockReset();
    grants.pickOne.mockImplementation(async () => null);
  });
  const offerFeatures = () => {
    compendium([FEATURE, OWNED]);
    grants.findItems.mockImplementation(async ({ type, matches }) => [FEATURE, OWNED].filter(entry => entry.type == type && (!matches || matches(entry))));
    grants.pickOne.mockImplementation(async (title, rows) => rows[0]?.uuid ?? null);
  };

  test('a Zord Feature pick: a Feature the Ranger\'s Zord doesn\'t hold yet, onto that Zord - or onto the character with Zord Ultra Mode', async () => {
    const { fireItemAdded } = await import('./triggers.mjs');
    offerFeatures();
    const zord = makeActor('Zord', { type: 'zord' });
    zord.addItem({ name: 'Held Feature', type: 'feature', flags: { core: { sourceId: OWNED.uuid }, essence20: {} } });
    const ranger = makeActor('Red', { type: 'playerCharacter', system: { actors: { z: { uuid: zord.uuid, type: 'zord' } } } });
    const slot = ranger.addItem(packItem('zordFeatureSlot'));
    await fireItemAdded(ranger, slot);
    expect(itemNamed(zord, 'Armor Plating')).toBeDefined();
    expect(grants.pickOne.mock.calls.at(-1)[1].map(row => row.name)).toEqual(['Armor Plating']);
    const ultra = makeActor('Ultra', { items: [{ ...packItem('zordUltraMode'), flags: { core: { sourceId: 'Compendium.essence20.field_guide_action_adventure.Item.LoLucUviYKvUq5XR' }, essence20: {} } }] });
    const slot2 = ultra.addItem(packItem('zordFeatureSlot'));
    await fireItemAdded(ultra, slot2);
    expect(itemNamed(ultra, 'Armor Plating')).toBeDefined();
  });

  test('Zord Ultra Mode: while Morphed, once a scene, a Standard action and 1 Personal Power turn its Zord Features\' Active Effects on; Defeat ends it', async () => {
    const ranger = makeActor('Ultra', { items: [packItem('zordUltraMode')], system: { isMorphed: true } });
    const effect = { id: 'e1', name: 'Armor', disabled: true, changes: [{ key: 'system.defenses.toughness.bonus', value: 2 }] };
    const feature = ranger.addItem({ name: 'Armor Plating', type: 'feature', effects: [effect] });
    feature.updateEmbeddedDocuments = jest.fn(async (kind, updates) => updates.forEach(update => Object.assign(feature.effects.find(e => e.id == update._id), update)));
    const mode = itemNamed(ranger, 'Zord Ultra Mode');
    await use(mode, { which: 'Convert to Zord Ultra Mode (Standard action, 1 Personal Power)' });
    expect(pay).toHaveBeenCalledWith('standard');
    expect(ranger.system.powers.personal.value).toBe(2);
    expect(effect.disabled).toBe(false);
    expect(useAvailable(mode, mode.system.rules[0], 0)).toBe(false);
    await ranger.update({ 'system.health.value': 0 });
    await fireTriggers(ranger, 'droppedToZero', { vars: { resource: 'health' } });
    expect(effect.disabled).toBe(true);
    expect(ranger.flags.essence20.ruleMarks?.zordUltraMode).toBeUndefined();
    ranger.system.isMorphed = false;
    const fresh = makeActor('Unmorphed', { items: [packItem('zordUltraMode')] });
    const freshMode = itemNamed(fresh, 'Zord Ultra Mode');
    expect(useAvailable(freshMode, freshMode.system.rules[0], 0)).toBe(false);
  });

  test('Versatile Combiner: the Megaform Trait for its Ranger\'s spectrum, or a pick for other spectrums', async () => {
    const { fireItemAdded } = await import('./triggers.mjs');
    const CORE_DEFENSES = { uuid: 'Compendium.essence20.pr_crb.Item.YcqEl6Q6QkoXhuTH', name: 'Core Defenses', type: 'megaformTrait', system: {} };
    const MOVE = { uuid: 'Compendium.essence20.pr_crb.Item.3TeQStgfP5kQZmeL', name: 'Move', type: 'megaformTrait', system: {} };
    compendium([CORE_DEFENSES, MOVE]);
    const zord = makeActor('Black Zord', { type: 'zord' });
    makeActor('Zack', { items: [{ name: 'Black Ranger', type: 'role' }], system: { actors: { z: { uuid: zord.uuid } } } });
    await fireItemAdded(zord, zord.addItem({ ...packItem('versatileCombiner'), type: 'feature' }));
    expect(itemNamed(zord, 'Core Defenses')).toBeDefined();
    const loner = makeActor('Loner Zord', { type: 'zord' });
    await fireItemAdded(loner, loner.addItem({ ...packItem('versatileCombiner'), type: 'feature' }), { ask: async () => 3 });
    expect(itemNamed(loner, 'Move')).toBeDefined();
    expect(itemNamed(loner, 'Core Defenses')).toBeUndefined();
  });
});

describe('Zord Mega-Weapon System', () => {
  test('the crew pay 5 Personal Power between them; the weapon lasts 1d2+1 of its own attacks, hit or miss', async () => {
    const jason = makeActor('Jason', { system: { powers: { personal: { value: 3, max: 5 } } } });
    const trini = makeActor('Trini', { system: { powers: { personal: { value: 4, max: 5 } } } });
    const zord = makeActor('Megazord', { type: 'zord', items: [{ ...packItem('megaWeapon'), type: 'feature' }], system: { actors: { a: { uuid: jason.uuid }, b: { uuid: trini.uuid } } } });
    const feature = itemNamed(zord, 'Zord Mega-Weapon System');
    const sword = zord.addItem({ name: 'Zord Mega-Weapon Effect', type: 'weaponEffect', flags: { essence20: { isMegaWeapon: true } }, system: { damageValue: 5 } });
    const fist = zord.addItem({ name: 'Fist', type: 'weaponEffect', system: { damageValue: 2 } });
    const random = jest.spyOn(Math, 'random').mockReturnValue(0.9);
    expect(await use(feature)).toContain('for 3 attacks, paid by Jason (3), Trini (2)');
    random.mockRestore();
    expect([jason.system.powers.personal.value, trini.system.powers.personal.value]).toEqual([0, 2]);
    expect(zord.flags.essence20.ruleMarks.megaWeapon.count).toBe(3);
    expect(useAvailable(feature, feature.system.rules[0], 0)).toBe(false);
    await fireTriggers(zord, 'afterRoll', { roll: { item: fist }, outcome: 'success', facts: {} });
    expect(zord.flags.essence20.ruleMarks.megaWeapon.count).toBe(3);
    for (const outcome of ['failure', 'success']) {
      await fireTriggers(zord, 'afterRoll', { roll: { item: sword }, outcome, facts: {} });
    }

    expect(zord.flags.essence20.ruleMarks.megaWeapon.count).toBe(1);
    await fireTriggers(zord, 'afterRoll', { roll: { item: sword }, outcome: 'success', facts: {} });
    expect(zord.flags.essence20.ruleMarks.megaWeapon).toBeUndefined();
    // 2 Power left between them: refused, nothing spent.
    await use(feature);
    expect(ui.notifications.warn).toHaveBeenCalledWith('E20.MegaWeaponCannotAfford');
    expect(trini.system.powers.personal.value).toBe(2);
  });
});
