import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Round 14, items2 (docs/rules-batches/slItems214.md): per-item files under module/items/ whose code is now each item's own
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
};
jest.unstable_mockModule('./mechanics/resources/grants.mjs', () => grants);
jest.unstable_mockModule('./mechanics/world/gm-relay.mjs', () => ({ needsGmRelay: () => false, relayToGm: jest.fn() }));
const react = {
  rollVsMany: jest.fn(async (actor, skill, others, defense) => others.map(other => ({ targetUuid: other.uuid, success: !other.flags.essence20.resists, skill, defense }))),
};
jest.unstable_mockModule('./mechanics/combat/reaction-engine.mjs', () => react);
const spent = [];
const actionsGranted = [];
jest.unstable_mockModule('./mechanics/actions/action-economy.mjs', () => ({
  spend: jest.fn(async (actor, action) => {
    spent.push({ name: actor.name, action });
    return {};
  }),
  grantActionsThisTurn: jest.fn(async (actor, grant, source, options) => actionsGranted.push({ name: actor.name, ...grant, granter: options?.granter?.name })),
  isTracking: () => true,
  getLedger: () => null,
}));
// Allies the system way (getNearbyAllyTokens): same disposition, within range on the test canvas.
const nearby = {
  getNearbyAllyTokens: jest.fn((actor, feet) => canvas.tokens.placeables.filter(token => token.actor !== actor
    && token.document.disposition == actor.token?.document?.disposition && Math.abs(token.center.x - actor.token.center.x) <= feet)),
  getAllNearbyTokens: jest.fn(() => []),
  pickAllyTargets: jest.fn(async (actor, candidates, title, max) => candidates.slice(0, max)),
};
jest.unstable_mockModule('./mechanics/combat/nearby-allies.mjs', () => nearby);

await import('./plugins/index.mjs');
const { rebuildIndex } = await import('./index.mjs');
const { fireItemAdded, fireTriggers, runUse, useAvailable, useRulesOf } = await import('./triggers.mjs');
const { pressRuleButton } = await import('./buttons.mjs');
const { ruleAssist, ruleMovement, ruleRollSources, ruleScaledDamage, ruleSpecializes } = await import('./adapter.mjs');
const { validateRule } = await import('./types.mjs');
const { registerCheck, setWorldLookups } = await import('./predicate.mjs');
const { askSubstitution, ask: substitutionAsk, beforeRoll } = await import('./plugins/dialog/dialog-select.mjs');
const { isDecepticonNemesis, isNemesisInScene } = await import('../items/rolls/nemesis-decepticon.mjs');
const { isRecklessAbandonActive } = await import('../items/rolls/reckless-abandon.mjs');
const { registrySnapshot } = await import('../mechanics/item-hooks.mjs');

// essence20.mjs hands these in at start-up.
registerCheck('decepticonNemesis', (actor, option, ctx) => (ctx?.other ? isDecepticonNemesis(actor, ctx.other) : null));
registerCheck('nemesisInScene', actor => isNemesisInScene(actor));
let terrain = null;
setWorldLookups({ recklessAbandon: actor => isRecklessAbandonActive(actor), terrain: () => terrain });

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));
const P = {
  snortle: 'mlpcrbitems/_source/Snortle_At_The_Spooky_4AoqHc1WgMOtKlNO.json',
  survival: 'bthitems/_source/Survival_Training_xOhVWGL1lHJaVdqI.json',
  unbeatable: 'gijcrbitems/_source/Unbeatable_cyiPxpwROFcBZZkm.json',
  primal: 'tsitems/_source/Primal_Movement_y4dfWDqQQt6V5Sk6.json',
  bravado: 'gijcrbitems/_source/Bravado_dB5C6frDKWJKXVay.json',
  parasite: 'tsitems/_source/Energon_Parasite_6myBQHifgs2IHGsC.json',
  avast: 'qgtgitems/_source/Avast__Dw5KmScLetUz6Ugg.json',
  consult: 'fgtaaitems/_source/Consult_Memories_YzvU6WpADTfuGVLj.json',
  nemesis: 'dditems/_source/Nemesis_Epkm9DVktvFurYDL.json',
  nemesisHangUp: 'dditems/_source/Nemesis_6kqzh6eVugqnSn60.json',
  onTarget: 'mlpcrbitems/_source/On_Target_sTEcpoI5UTnGn01U.json',
  hardened: 'gijcrbitems/_source/Hardened_f7d5bkyxVpbR4dAe.json',
  resourceful: 'tfcrbitems/_source/Resourceful_aE2gaLPtMZYkeZ6D.json',
  infiltrator: 'tfcrbitems/_source/Infiltrator_CHkXJNjrvZUPxV7J.json',
  chatter: 'mlpcrbitems/_source/Chatter_Flashback_L18ewA90Q1MqaQlC.json',
  muscle: 'mlpcrbitems/_source/Muscle_Over_Panache_JxScHzozoGYU6P46.json',
  reverse: 'mlpcrbitems/_source/Reverse_Engineer_ESXOYPJ6FSPGeNHb.json',
  thesis: 'tfcrbitems/_source/Thesis_4AyMZ0h6YkKv8vbj.json',
  acting: 'mlpcrbitems/_source/Acting__oA8DrnUOOqc1mrd0.json',
  tactical: 'ttsgitems/_source/Tactical_Meditation_TacticalMedit8ns.json',
  returned: 'ttsgitems/_source/The_Returned_DC0cXGGBm4J8OXvL.json',
  respect: 'dditems/_source/Show_Respect_oowLckrIBcn1Zff3.json',
  again: 'eocitems/_source/Again_and_Again_and_Again_EmL1IgnaX55NTMve.json',
  moneyTalks: 'ccitems/_source/Money_Talks_sAY8uesn2NTTcDqi.json',
  freelancer: 'iafav2items/_source/Capable_Freelancer_PTEnW3QDpejzj27c.json',
  urban: 'ccitems/_source/Urban_Adaptation_zdCIZOr6JOPGKUmL.json',
  izuna: 'iafav2items/_source/Izuna_Drop_jaUwQUvv1rXlXQUA.json',
  augment: 'tfcrbitems/_source/Augment_Power_tByP34McuTkaTQWZ.json',
  enemyNumberOne: 'gijcrbitems/_source/Enemy_Number_One_zvzta73A3ROyxv0J.json',
  exemplary: 'gijcrbitems/_source/Exemplary_jpu756uKYfydTu16.json',
  faceMe: 'eocitems/_source/Face_Me__JQE2rcrT4GSEHJCD.json',
  remoteOps: 'fffav1items/_source/Remote_Operations_HTQEaadz9eZ5ZkC1.json',
  oneForAll: 'prcrbitems/_source/One_For_All_8duLY5PjlpmbNkwK.json',
  powerBurst: 'prcrbitems/_source/Power_Burst_XfLsm5inPHekj6rY.json',
  shiningLeader: 'prcrbitems/_source/Shining_Leader_woCTg4Lpk3KpsgtF.json',
  rallyingCry: 'gijcrbitems/_source/Rallying_Cry_cBbQVq9ZqcVUpAQs.json',
  heart: 'gijcrbitems/_source/Heart_Of_The_Team_ME4xFG31XvT6q6Qp.json',
  nanoMed: 'gijcrbitems/_source/Nano_Med_Mastery_7hMe2hYONR6wBMFv.json',
  vainglorious: 'tfcrbitems/_source/Vainglorious_ztsvCKdnaDZzBR8Q.json',
  bioEnergy: 'bthitems/_source/Bio_Energy_Conversion_W1fwCDu7FOmg0yaQ.json',
  zordAlterations: 'atsitems/_source/Zord_Alterations_j7VFi84N56KqKsFe.json',
};
// The items the rules read by book source.
const BOOK = {
  playToTheCrowd: 'Compendium.essence20.mlp_crb.Item.2LZ9H8bmrMECGHjA',
  extremelyResourceful: 'Compendium.essence20.tf_crb.Item.1mTCwsgnscEreieW',
  technobabble: 'Compendium.essence20.tf_crb.Item.efrhpDsdXPUKVEWt',
  multiplication: 'Compendium.essence20.tf_crb.Item.K3FNcAMjjek1UaJk',
  laypony: 'Compendium.essence20.mlp_crb.Item.ZD7uEmKIlQbyoFz7',
  recklessAbandon: 'Compendium.essence20.gi_joe_crb.Item.84d0XTJwKCYMJUgY',
  puissance: 'Compendium.essence20.enigma_of_combination.Item.N8nkrj2hSrLv9NFP',
  racerAbandon: 'Compendium.essence20.cobra_codex.Item.rNESO3bo1apEjd6p',
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
    if (parts[parts.length - 1].startsWith('-=') || (globalThis.foundry?.data?.operators?.ForcedDeletion && value instanceof globalThis.foundry.data.operators.ForcedDeletion)) {
      const last = parts.pop().replace(/^-=/, '');
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
      level: 5, health: { value: 10, max: 10, bonus: 0 }, defenses: { willpower: { total: 12 }, toughness: { total: 13 } },
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
const sources = (actor, other = null, roll = {}) => ruleRollSources(actor, other, roll).sources;
const shifts = list => list.reduce((sum, s) => ({ up: sum.up + (Number(s.shiftUp) || 0), down: sum.down + (Number(s.shiftDown) || 0), edge: sum.edge || !!s.edge, snag: sum.snag || !!s.snag }), { up: 0, down: 0, edge: false, snag: false });
const cards = () => ChatMessage.create.mock.calls.map(([data]) => data);
const buttonCards = () => cards().filter(data => data.flags?.essence20?.ruleButton);
const startCombat = (round = 1, turn = 0, combatants = []) => {
  game.combat = { id: 'c1', started: true, round, turn, combatants, turns: combatants };
  game.combats = { get: id => (id == 'c1' ? game.combat : null) };
  return game.combat;
};

async function pressLast(user = game.user) {
  const card = buttonCards().at(-1);
  card.update = async data => applyUpdate(card, data);
  return pressRuleButton(card, user);
}

let numbers = [];
beforeEach(() => {
  for (const list of [timed, dealt, spent, actionsGranted]) {
    list.length = 0;
  }

  picks = [];
  numbers = [];
  terrain = null;
  pay.mockClear();
  grants.rollTest.mockReset();
  grants.rollTest.mockImplementation(async () => ({ success: true }));
  react.rollVsMany.mockClear();
  global.game = {
    combat: null, combats: null, user: { id: 'u', isGM: true, isActiveGM: true, targets: new Set() }, users: { contents: [] },
    i18n: { localize: k => k, format: (k, d) => `${k}${d ? ` ${JSON.stringify(d)}` : ''}`, has: () => false },
    settings: { get: () => 1, set: async () => {} }, actors: { contents: [], get: id => game.actors.contents.find(a => a.id == id) },
    scenes: { active: null },
  };
  game.user.targets.first = () => undefined;
  global.CONFIG = {
    E20: {
      damageTypes: { blunt: 'Blunt', fire: 'Fire' }, elementDamageTypes: { acid: 'E20.DamageAcid', fire: 'E20.DamageFire' },
      skillToEssence: { targeting: 'speed', intimidation: 'strength', alertness: 'smarts', athletics: 'strength', acrobatics: 'speed', wealth: 'social', technology: 'smarts' },
      skills: { athletics: 'A', technology: 'T', wealth: 'W' },
      actorSizes: { small: 's', common: 'c', large: 'l', long: 'lo', huge: 'h', extended: 'e', gigantic: 'g', extended2: 'e2', towering: 't', extended3: 'e3', titanic: 'ti' },
    },
  };
  global.canvas = {
    scene: null, tokens: { placeables: [], controlled: [], setTargets: jest.fn() },
    grid: { measurePath: ([a, b]) => ({ distance: Math.abs(a.x - b.x) }) },
  };
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn(), error: jest.fn() } };
  global.ChatMessage = { create: jest.fn(async data => data), getSpeaker: () => ({}) };
  global.fromUuidSync = uuid => game.actors.contents.find(actor => actor.uuid == uuid)
    ?? game.actors.contents.flatMap(actor => actor.items.contents).find(item => item.uuid == uuid) ?? null;
  global.fromUuid = async uuid => global.fromUuidSync(uuid);
  global.foundry = {
    data: { operators: { ForcedDeletion: globalThis.foundry?.data?.operators?.ForcedDeletion ?? class ForcedDeletion {} } }, utils: { getProperty: getPath, setProperty: setPath, hasProperty: (o, k) => getPath(o, k) !== undefined, deepClone: v => JSON.parse(JSON.stringify(v)), randomID: () => `r${nextId++}` },
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

test('no hand-written Use is left for them', () => {
  const ids = registrySnapshot().uses.map(entry => entry.id);
  for (const id of ['s1-izunaDrop', 's1-urbanAdaptation']) {
    expect(ids).not.toContain(id);
  }

  expect(registrySnapshot().chatButtons.o3Again).toBeUndefined();
});

/* -------------------------------------------- */
/*  Healing, movement, resources                 */
/* -------------------------------------------- */

describe('Snortle at the Spooky (+ Play to the Crowd)', () => {
  const cheer = value => ({ name: 'Cheer Points', type: 'rolePoints', system: { resource: { value, max: 5 } } });
  const friend = (name, statuses) => makeActor(name, { statuses });

  test('cures the first eligible friend only, for 1 Cheer, without Play to the Crowd', async () => {
    const pony = makeActor('Pony', { items: [packItem('snortle'), cheer(3)] });
    const a = friend('A', ['frightened']);
    const b = friend('B', ['mesmerized']);
    target(a, b);
    await use(itemNamed(pony, 'Snortle At The Spooky'));
    expect(a.statuses.has('frightened')).toBe(false);
    expect(b.statuses.has('mesmerized')).toBe(true);
    expect(itemNamed(pony, 'Cheer Points').system.resource.value).toBe(2);
  });

  test('cures every eligible target with Play to the Crowd, 1 Cheer each - Frightened first, else Mesmerized', async () => {
    const pony = makeActor('Pony', { items: [packItem('snortle'), bookItem(BOOK.playToTheCrowd, { name: 'Play To The Crowd' }), cheer(3)] });
    const a = friend('A', ['frightened', 'mesmerized']);
    const b = friend('B', ['mesmerized']);
    const c = friend('C', []);
    target(a, b, c);
    await use(itemNamed(pony, 'Snortle At The Spooky'));
    expect([...a.statuses]).toEqual(['mesmerized']);
    expect(b.statuses.size).toBe(0);
    expect(itemNamed(pony, 'Cheer Points').system.resource.value).toBe(1);
  });

  test('nothing to cure: warns and spends nothing; not enough Cheer: cures nothing', async () => {
    const pony = makeActor('Pony', { items: [packItem('snortle'), bookItem(BOOK.playToTheCrowd, { name: 'Play To The Crowd' }), cheer(1)] });
    target(friend('C', []));
    await use(itemNamed(pony, 'Snortle At The Spooky'));
    expect(ui.notifications.warn).toHaveBeenCalledWith('E20.SnortleNothingToCure');
    const a = friend('A', ['frightened']);
    const b = friend('B', ['frightened']);
    target(a, b);
    await use(itemNamed(pony, 'Snortle At The Spooky'));
    expect(a.statuses.has('frightened')).toBe(true);
    expect(itemNamed(pony, 'Cheer Points').system.resource.value).toBe(1);
  });
});

describe('Survival Training', () => {
  test('on being added, +1 Health to yourself or the teammate picked; nothing when cancelled', async () => {
    const ranger = makeActor('Ranger');
    const mate = makeActor('Mate');
    picks = ['Mate'];
    await fireItemAdded(ranger, ranger.addItem(packItem('survival')));
    expect(mate.system.health.bonus).toBe(1);
    expect(ranger.system.health.bonus).toBe(0);
    picks = ['Ranger'];
    await fireItemAdded(ranger, ranger.addItem(packItem('survival')));
    expect(ranger.system.health.bonus).toBe(1);
    picks = [null];
    await fireItemAdded(ranger, ranger.addItem(packItem('survival')));
    expect(ranger.system.health.bonus + mate.system.health.bonus).toBe(2);
  });
});

describe('Unbeatable', () => {
  const at = (value, max = 10, statuses = []) => makeActor('Joe', { items: [packItem('unbeatable')], system: { health: { value, max, bonus: 0 } }, statuses });

  test('heals 1 at the start of the turn at half Health or less (the threshold too), never while Defeated or at 0', async () => {
    for (const [value, expected] of [[4, 5], [5, 6], [6, 6]]) {
      const joe = at(value);
      await fireTriggers(joe, 'turnStart');
      expect(joe.system.health.value).toBe(expected);
    }

    const down = at(3, 10, ['defeated']);
    await fireTriggers(down, 'turnStart');
    expect(down.system.health.value).toBe(3);
    const zero = at(0);
    await fireTriggers(zero, 'turnStart');
    expect(zero.system.health.value).toBe(0);
  });
});

describe('Primal Movement', () => {
  const movement = (bases = {}) => Object.fromEntries(['aerial', 'burrow', 'climb', 'ground', 'swim'].map(type => [type, { base: bases[type] ?? 0, bonus: 0 }]));

  test('grants 20 ft of a Movement type the actor lacks (onto any existing bonus); the picker leaves out owned types', async () => {
    const bot = makeActor('Bot', { system: { movement: movement({ ground: 30 }) } });
    bot.system.movement.climb.bonus = 5;
    let offered = null;
    await fireItemAdded(bot, bot.addItem(packItem('primal')), { ask: async (step, options) => {
      offered = options.map(option => option.label);
      return offered.indexOf('Climb');
    } });
    expect(offered).toEqual(['Aerial', 'Burrow', 'Climb', 'Swim']);
    expect(bot.system.movement.climb.bonus).toBe(25);
  });

  test('warns when every type is owned; a cancelled pick grants nothing', async () => {
    const full = makeActor('Full', { system: { movement: movement({ aerial: 1, burrow: 1, climb: 1, ground: 1, swim: 1 }) } });
    await fireItemAdded(full, full.addItem(packItem('primal')), { ask: async () => 0 });
    expect(ui.notifications.warn).toHaveBeenCalledWith('E20.PrimalMovementNoNewType');
    const bot = makeActor('Bot', { system: { movement: movement() } });
    await fireItemAdded(bot, bot.addItem(packItem('primal')), { ask: async () => null });
    expect(Object.values(bot.system.movement).every(type => type.bonus == 0)).toBe(true);
  });
});

describe('Bravado', () => {
  const renegade = (value, extra = []) => makeActor('Renegade', {
    items: [packItem('bravado'), bookItem(BOOK.recklessAbandon, { name: 'Reckless Abandon', type: 'rolePoints', system: { resource: { value, max: 3 } } }), ...extra],
  });

  test('a combatant starting combat with no Reckless Abandon uses left regains one; not when some remain', async () => {
    const empty = renegade(0);
    const some = renegade(2);
    await fireTriggers(empty, 'combatStart');
    await fireTriggers(some, 'combatStart');
    expect(itemNamed(empty, 'Reckless Abandon').system.resource.value).toBe(1);
    expect(itemNamed(some, 'Reckless Abandon').system.resource.value).toBe(2);
  });

  test('nothing without a Reckless Abandon Role Points item', async () => {
    const lone = makeActor('Lone', { items: [packItem('bravado')] });
    await expect(fireTriggers(lone, 'combatStart')).resolves.not.toThrow();
  });
});

describe('Energon Parasite', () => {
  const drainer = (energon = 0, max = 4, essence = 4) => makeActor('Drainer', {
    items: [packItem('parasite')], system: { energon: { normal: { value: energon, max } }, essences: { strength: { value: essence }, speed: { value: 9 }, smarts: { value: 9 }, social: { value: 9 } } },
  });
  const victim = (energon = 4, defeated = true) => makeActor('Victim', { disposition: -1, system: { energon: { normal: { value: energon, max: 9 } } }, statuses: defeated ? ['defeated'] : [] });

  test('drains the least of the target\'s Energon, the lowest Essence and the room left', async () => {
    for (const [actor, other, expected, left] of [[drainer(0, 9, 9), victim(3), 3, 0], [drainer(0, 9, 2), victim(5), 2, 3], [drainer(3, 4, 9), victim(5), 1, 4]]) {
      const before = actor.system.energon.normal.value;
      target(other);
      await use(itemNamed(actor, 'Energon Parasite'));
      expect(actor.system.energon.normal.value - before).toBe(expected);
      expect(other.system.energon.normal.value).toBe(left);
    }
  });

  test('warns and drains nothing without a Defeated target; nothing at capacity', async () => {
    const actor = drainer(0);
    const standing = victim(4, false);
    target(standing);
    await use(itemNamed(actor, 'Energon Parasite'));
    expect(ui.notifications.warn).toHaveBeenCalledWith('E20.EnergonParasiteNoTarget');
    expect(standing.system.energon.normal.value).toBe(4);
    const full = drainer(4, 4);
    const down = victim(4);
    target(down);
    await use(itemNamed(full, 'Energon Parasite'));
    expect(down.system.energon.normal.value).toBe(4);
  });
});

/* -------------------------------------------- */
/*  Rolls                                        */
/* -------------------------------------------- */

describe('Avast!', () => {
  function seat(actor, initiative) {
    return { id: `cb${actor.id}`, actor, actorId: actor.id, initiative, update: jest.fn(async function (data) {
      Object.assign(this, data);
    }) };
  }

  test('Intimidation vs the target\'s Willpower; on a success the target rerolls Initiative and keeps the lower', async () => {
    const pirate = makeActor('Pirate', { items: [packItem('avast')] });
    const foe = makeActor('Foe', { disposition: -1 });
    const foeSeat = seat(foe, 15);
    const combat = startCombat(1, 0, [seat(pirate, 12), foeSeat]);
    combat.rollInitiative = jest.fn(async () => {
      foeSeat.initiative = 18;
    });
    target(foe);
    await use(itemNamed(pirate, 'Avast!'));
    expect(react.rollVsMany.mock.calls[0].slice(0, 4)).toEqual([pirate, 'intimidation', [foe], 'willpower']);
    expect(combat.rollInitiative).toHaveBeenCalledWith([foeSeat.id]);
    expect(foeSeat.initiative).toBe(15);

    // A lower reroll stands. Once per encounter.
    const pirate2 = makeActor('Pirate2', { items: [packItem('avast')] });
    combat.rollInitiative = jest.fn(async () => {
      foeSeat.initiative = 9;
    });
    target(foe);
    await use(itemNamed(pirate2, 'Avast!'));
    expect(foeSeat.initiative).toBe(9);
    expect(useAvailable(itemNamed(pirate2, 'Avast!'), useRulesOf(itemNamed(pirate2, 'Avast!'))[0].rule, 0)).toBe(false);
  });

  test('a failed roll, no combat or an unseated target changes no Initiative; no target rolls nothing', async () => {
    const pirate = makeActor('Pirate', { items: [packItem('avast')] });
    const foe = makeActor('Foe', { disposition: -1, flags: { resists: true } });
    const combat = startCombat(1, 0, [seat(foe, 15)]);
    combat.rollInitiative = jest.fn();
    target(foe);
    await use(itemNamed(pirate, 'Avast!'));
    expect(combat.rollInitiative).not.toHaveBeenCalled();
    const loner = makeActor('Loner', { items: [packItem('avast')] });
    game.user.targets = new Set();
    game.user.targets.first = () => undefined;
    await use(itemNamed(loner, 'Avast!'));
    expect(react.rollVsMany).toHaveBeenCalledTimes(1);
  });
});

describe('Consult Memories', () => {
  test('pick a Skill: ↑2 and Specialized on it for the encounter, once per encounter', async () => {
    const psychic = makeActor('Psychic', { items: [packItem('consult')], system: { skills: { athletics: {}, technology: {} } } });
    picks = ['technology'];
    await use(itemNamed(psychic, 'Consult Memories'));
    expect(shifts(sources(psychic, null, { rolledSkill: 'technology' })).up).toBe(2);
    expect(ruleSpecializes(psychic, 'technology', null, {})).toBe(true);
    expect(shifts(sources(psychic, null, { rolledSkill: 'athletics' })).up).toBe(0);
    expect(useAvailable(itemNamed(psychic, 'Consult Memories'), useRulesOf(itemNamed(psychic, 'Consult Memories'))[0].rule, 0)).toBe(false);
  });

  test('a cancelled pick grants nothing and uses nothing', async () => {
    const psychic = makeActor('Psychic', { items: [packItem('consult')], system: { skills: { athletics: {} } } });
    picks = [null];
    await use(itemNamed(psychic, 'Consult Memories'));
    expect(shifts(sources(psychic, null, { rolledSkill: 'athletics' })).up).toBe(0);
    expect(useAvailable(itemNamed(psychic, 'Consult Memories'), useRulesOf(itemNamed(psychic, 'Consult Memories'))[0].rule, 0)).toBe(true);
  });
});

describe('Nemesis (Decepticon Directive) and its Hang-Up', () => {
  test('declaring keeps the targeted actor\'s uuid; ↑1 on non-attack tests aimed at the nemesis', async () => {
    const con = makeActor('Con', { items: [packItem('nemesis')] });
    const foe = makeActor('Foe', { disposition: -1 });
    const other = makeActor('Other', { disposition: -1 });
    target(foe);
    await use(itemNamed(con, 'Nemesis'));
    expect(con.flags.essence20.decepticonNemesisUuid).toBe(foe.uuid);
    expect(shifts(sources(con, foe, { rolledSkill: 'technology' })).up).toBe(1);
    expect(shifts(sources(con, other, { rolledSkill: 'technology' })).up).toBe(0);
    expect(shifts(sources(con, foe, { item: { type: 'weaponEffect', system: {} } })).up).toBe(0);
    // No target: no ↑ and no switch to ask.
    expect(ruleRollSources(con, null, { rolledSkill: 'technology' }).sources).toEqual([]);
  });

  test('the Hang-Up: ↓1 while the nemesis has a token in the scene, unless the test is aimed at them (and not on Initiative)', () => {
    const foe = makeActor('Foe', { disposition: -1 });
    const con = makeActor('Con', { items: [packItem('nemesisHangUp', { type: 'hangUp' })], flags: { decepticonNemesisUuid: foe.uuid } });
    const other = makeActor('Other', { disposition: -1 });
    expect(shifts(sources(con, null, { rolledSkill: 'technology' })).down).toBe(1);
    expect(shifts(sources(con, other, { rolledSkill: 'technology' })).down).toBe(1);
    expect(shifts(sources(con, foe, { rolledSkill: 'technology' })).down).toBe(0);
    expect(shifts(sources(con, null, { rolledSkill: 'alertness', dataset: { isInitiative: true } })).down).toBe(0);
    foe.getActiveTokens = () => [];
    expect(shifts(sources(con, null, { rolledSkill: 'technology' })).down).toBe(0);
  });
});

describe('On Target', () => {
  test('rolls Targeting (Speed, no sheet shifts) once per round', async () => {
    const pony = makeActor('Pony', { items: [packItem('onTarget')], system: { skills: { targeting: { shift: 'd6', shiftUp: 2, shiftDown: 1 } } } });
    startCombat(2, 0);
    await use(itemNamed(pony, 'On Target'));
    const [dataset] = pony._dice.rollSkill.mock.calls[0];
    expect(dataset).toMatchObject({ skill: 'targeting', essence: 'speed', shiftUp: 0, shiftDown: 0 });
    expect(dataset.shift).toBeUndefined();
    const item = itemNamed(pony, 'On Target');
    expect(useAvailable(item, useRulesOf(item)[0].rule, 0)).toBe(false);
    game.combat.round = 3;
    expect(useAvailable(item, useRulesOf(item)[0].rule, 0)).toBe(true);
  });
});

describe('Hardened (with Reckless Abandon)', () => {
  const renegade = (classification, extra = []) => makeActor('Tank', {
    items: [
      packItem('hardened'),
      bookItem(BOOK.recklessAbandon, { name: 'Reckless Abandon', type: 'rolePoints', system: { isActive: true, resource: { value: 1 } } }),
      ...(classification ? [{ name: 'Armor', type: 'armor', system: { classification, equipped: true } }] : []),
      ...extra,
    ],
  });

  test('↑2 on Strength tests in Medium armor while acting with Reckless Abandon; not in light / no armor (RA\'s own code), not in heavy', () => {
    const medium = renegade('medium');
    medium._getBaseRolePoints = () => itemNamed(medium, 'Reckless Abandon');
    expect(shifts(sources(medium, null, { rolledSkill: 'athletics', rolledEssence: 'strength' })).up).toBe(2);
    expect(shifts(sources(medium, null, { rolledSkill: 'technology', rolledEssence: 'smarts' })).up).toBe(0);
    for (const kind of ['light', null, 'heavy']) {
      const other = renegade(kind);
      other._getBaseRolePoints = () => itemNamed(other, 'Reckless Abandon');
      expect([kind, shifts(sources(other, null, { rolledSkill: 'athletics', rolledEssence: 'strength' })).up]).toEqual([kind, 0]);
    }

    itemNamed(medium, 'Reckless Abandon').system.isActive = false;
    expect(shifts(sources(medium, null, { rolledSkill: 'athletics', rolledEssence: 'strength' })).up).toBe(0);
  });
});

describe('Resourceful / Extremely Resourceful', () => {
  test('pick Edge on Initiative (for the combat) or 1 Temporary Health; once per encounter', async () => {
    const scout = makeActor('Scout', { items: [packItem('resourceful')] });
    startCombat(1, 0);
    await use(itemNamed(scout, 'Resourceful'), { option: 0 });
    expect(shifts(sources(scout, null, { rolledSkill: 'alertness', dataset: { isInitiative: true } })).edge).toBe(true);
    expect(shifts(sources(scout, null, { rolledSkill: 'alertness' })).edge).toBe(false);
    expect(scout.system.health.bonus).toBe(0);
    const item = itemNamed(scout, 'Resourceful');
    expect(useAvailable(item, useRulesOf(item)[0].rule, 0)).toBe(false);

    const other = makeActor('Other', { items: [packItem('resourceful')] });
    await use(itemNamed(other, 'Resourceful'), { option: 1 });
    expect(other.system.health.bonus).toBe(1);
    expect(shifts(sources(other, null, { dataset: { isInitiative: true } })).edge).toBe(false);
  });

  test('Extremely Resourceful takes both without asking', async () => {
    const scout = makeActor('Scout', { items: [packItem('resourceful'), bookItem(BOOK.extremelyResourceful, { name: 'Extremely Resourceful' })] });
    const ask = jest.fn(async () => 0);
    await runUse(itemNamed(scout, 'Resourceful'), pay, { ask });
    expect(ask).not.toHaveBeenCalled();
    expect(scout.system.health.bonus).toBe(1);
    expect(shifts(sources(scout, null, { dataset: { isInitiative: true } })).edge).toBe(true);
  });
});

describe('Skill substitution Perks', () => {
  const left = item => {
    const [{ rule, index }] = useRulesOf(item);
    return useAvailable(item, rule, index);
  };

  test('Infiltrator once per scene, Chatter Flashback and Muscle Over Panache three times', async () => {
    for (const [key, name, max] of [['infiltrator', 'Infiltrator', 1], ['chatter', 'Chatter Flashback', 3], ['muscle', 'Muscle Over Panache', 3]]) {
      const actor = makeActor('Sub', { items: [packItem(key)] });
      const item = itemNamed(actor, name);
      for (let i = 0; i < max; i++) {
        expect([name, i, left(item)]).toEqual([name, i, true]);
        expect(await use(item)).toContain(name);
      }

      expect([name, left(item)]).toEqual([name, false]);
    }
  });

  test('Thesis: once per scene, 3 with Technobabble, doubled by Multiplication', async () => {
    for (const [extra, max] of [[[], 1], [[BOOK.technobabble], 3], [[BOOK.multiplication], 2], [[BOOK.technobabble, BOOK.multiplication], 6]]) {
      const actor = makeActor('Scientist', { items: [packItem('thesis'), ...extra.map(uuid => bookItem(uuid))] });
      const item = itemNamed(actor, 'Thesis');
      let used = 0;
      while (left(item) && used < 10) {
        await use(item);
        used++;
      }

      expect([extra.length, used]).toEqual([extra.length, max]);
    }
  });

  test('Reverse Engineer three times; with Laypony Terms it asks, and "a Social Skill" banks a Snag on the next Technology test', async () => {
    const plain = makeActor('Plain', { items: [packItem('reverse')] });
    const ask = jest.fn(async () => 0);
    await runUse(itemNamed(plain, 'Reverse Engineer'), pay, { ask });
    expect(ask).not.toHaveBeenCalled();

    const pony = makeActor('Pony', { items: [packItem('reverse'), bookItem(BOOK.laypony, { name: 'Laypony Terms', type: 'hangUp' })] });
    await use(itemNamed(pony, 'Reverse Engineer'), { option: 1 });
    expect(shifts(sources(pony, null, { rolledSkill: 'technology' })).snag).toBe(false);
    await use(itemNamed(pony, 'Reverse Engineer'), { option: 0 });
    expect(shifts(sources(pony, null, { rolledSkill: 'athletics' })).snag).toBe(false);
    const snag = sources(pony, null, { rolledSkill: 'technology' });
    expect(snag).toEqual([expect.objectContaining({ label: 'Laypony Terms', snag: true })]);

    // A Hang-Up a Matured Perk ignores asks nothing.
    const matured = makeActor('Matured', { items: [packItem('reverse'), bookItem(BOOK.laypony, { name: 'Laypony Terms', type: 'hangUp', flags: { maturedIgnored: true } })] });
    const ask2 = jest.fn(async () => 0);
    await runUse(itemNamed(matured, 'Reverse Engineer'), pay, { ask: ask2 });
    expect(ask2).not.toHaveBeenCalled();
  });

  // (Acting! is a Roll Options Dialog switch now - book check, effects: rules/book-effects.test.js.)
});

describe('Tactical Meditation', () => {
  test('↑2 on Alertness and Initiative for the holder and allies within 10 ft - once, however many hold it', () => {
    const guardian = makeActor('Guardian', { items: [packItem('tactical')], x: 0 });
    const near = makeActor('Near', { x: 10 });
    const far = makeActor('Far', { x: 15 });
    const foe = makeActor('Foe', { x: 5, disposition: -1 });
    for (const actor of [guardian, near]) {
      expect([actor.name, shifts(sources(actor, null, { rolledSkill: 'alertness' })).up]).toEqual([actor.name, 2]);
      expect([actor.name, shifts(sources(actor, null, { rolledSkill: 'agility', dataset: { isInitiative: true } })).up]).toEqual([actor.name, 2]);
      expect([actor.name, shifts(sources(actor, null, { rolledSkill: 'athletics' })).up]).toEqual([actor.name, 0]);
    }

    for (const actor of [far, foe]) {
      expect([actor.name, shifts(sources(actor, null, { rolledSkill: 'alertness' })).up]).toEqual([actor.name, 0]);
    }

    near.addItem(packItem('tactical'));
    expect(shifts(sources(near, null, { rolledSkill: 'alertness' })).up).toBe(2);
  });
});

describe('The Returned', () => {
  test('pick a Skill once per scene: an Edge on the next test of it (not other Skills, not Initiative), used up by that test', async () => {
    const ranger = makeActor('Ranger', { items: [packItem('returned')], system: { skills: { athletics: {}, technology: {} } } });
    picks = ['athletics'];
    await use(itemNamed(ranger, 'The Returned'));
    expect(shifts(sources(ranger, null, { rolledSkill: 'technology' })).edge).toBe(false);
    expect(shifts(sources(ranger, null, { rolledSkill: 'athletics', dataset: { isInitiative: true } })).edge).toBe(false);
    const roll = ruleRollSources(ranger, null, { rolledSkill: 'athletics' });
    expect(shifts(roll.sources).edge).toBe(true);
    expect(roll.consumes).toEqual([expect.objectContaining({ ext: 'rulesBank' })]);
    const item = itemNamed(ranger, 'The Returned');
    expect(useAvailable(item, useRulesOf(item)[0].rule, 0)).toBe(false);
  });
});

/* -------------------------------------------- */
/*  Attacks and the shared-lookup items          */
/* -------------------------------------------- */

describe('Show Respect', () => {
  const crit = attacker => fireTriggers(attacker, 'afterRoll', {
    roll: { isAttack: true, item: { type: 'weaponEffect', system: {} }, targetCount: 1 }, outcome: 'crit', facts: { results: [], isCrit: true },
    vars: { targets: 1 },
  });

  test('a foe\'s Critical Success on an attack: respect owed on the holder\'s next turn, active only through that turn', async () => {
    const holder = makeActor('Holder', { items: [packItem('respect', { type: 'hangUp' })] });
    const foe = makeActor('Foe', { disposition: -1, x: 20 });
    const friend = makeActor('Friend', { x: 5 });
    const holderSeat = { actor: holder, id: 'h' };
    startCombat(1, 0, [holderSeat, { actor: foe, id: 'f' }, { actor: friend, id: 'r' }]);
    await crit(foe);
    await crit(friend);
    expect(foe.flags.essence20.ruleMarks?.respectOwed?.by).toBe(holder.uuid);
    expect(friend.flags.essence20.ruleMarks?.respectOwed).toBeUndefined();

    // Not yet active this turn: no warning.
    target(foe);
    const attack = { type: 'weaponEffect', system: {} };
    await beforeRoll(holder, { skill: 'targeting' }, attack);
    expect(ui.notifications.warn).not.toHaveBeenCalled();

    // The holder's next turn: owed -> active, and attacking that foe with another foe present warns.
    game.combat.round = 2;
    makeActor('Second Foe', { disposition: -1, x: 30 });
    await fireTriggers(holder, 'turnStart');
    expect(foe.flags.essence20.ruleMarks.respectOwed).toBeUndefined();
    await beforeRoll(holder, { skill: 'targeting' }, attack);
    expect(ui.notifications.warn).toHaveBeenCalledWith('E20.RulesExtItems2.RespectWarn');

    // The turn after: no longer.
    ui.notifications.warn.mockClear();
    game.combat.turn = 1;
    await beforeRoll(holder, { skill: 'targeting' }, attack);
    expect(ui.notifications.warn).not.toHaveBeenCalled();
  });

  test('no warning when the owed foe is the only foe present, nor outside combat', async () => {
    const holder = makeActor('Holder', { items: [packItem('respect', { type: 'hangUp' })] });
    const foe = makeActor('Foe', { disposition: -1, x: 20 });
    startCombat(1, 0, [{ actor: holder }, { actor: foe }]);
    await crit(foe);
    game.combat.round = 2;
    await fireTriggers(holder, 'turnStart');
    target(foe);
    await beforeRoll(holder, { skill: 'targeting' }, { type: 'weaponEffect', system: {} });
    expect(ui.notifications.warn).not.toHaveBeenCalled();

    const calm = makeActor('Calm', { items: [packItem('respect', { type: 'hangUp' })] });
    game.combat = null;
    await crit(foe);
    expect(foe.flags.essence20.ruleMarks?.respectOwed?.by).not.toBe(calm.uuid);
  });
});

describe('Again and Again and Again', () => {
  const puncher = () => {
    const actor = makeActor('Pugilist', { items: [packItem('again'), bookItem(BOOK.puissance, { name: 'Puissance' })] });
    const fist = actor.addItem({ name: 'Punch', type: 'weaponEffect', system: { classification: { skill: 'might', style: 'melee' } }, roll: jest.fn(async () => ({})) });
    return { actor, fist };
  };

  const hit = (actor, item, other, dataset = {}) => fireTriggers(actor, 'hit', {
    roll: { item, isAttack: true, dataset }, outcome: 'success', targets: [other], facts: { results: [{ success: true }] }, vars: { rolledItem: item.uuid },
  });

  test('a hit with a weaponless attack offers a follow-up at ↓1, then one at ↓3 - two a turn', async () => {
    const { actor, fist } = puncher();
    const foe = makeActor('Foe', { disposition: -1 });
    startCombat(1, 0);
    await hit(actor, fist, foe);
    expect(buttonCards()).toHaveLength(1);
    await pressLast();
    expect(fist.roll).toHaveBeenCalledWith(expect.objectContaining({ bypassEconomy: true, o3AgainStep: 1 }));
    expect(shifts(sources(actor, foe, { item: fist, dataset: { o3AgainStep: 1 } })).down).toBe(1);

    await hit(actor, fist, foe, { o3AgainStep: 1 });
    expect(buttonCards()).toHaveLength(2);
    await pressLast();
    expect(fist.roll).toHaveBeenLastCalledWith(expect.objectContaining({ o3AgainStep: 2 }));
    expect(shifts(sources(actor, foe, { item: fist, dataset: { o3AgainStep: 2 } })).down).toBe(3);

    // The ↓3 attack offers nothing more; and the two-a-turn count is spent.
    await hit(actor, fist, foe, { o3AgainStep: 2 });
    expect(buttonCards()).toHaveLength(2);
    await hit(actor, fist, foe);
    await pressLast();
    expect(fist.roll).toHaveBeenCalledTimes(2);
  });

  test('no follow-up for an attack with a weapon behind it, or without Puissance', async () => {
    const { actor } = puncher();
    const rifle = actor.addItem({ name: 'Rifle', type: 'weapon', system: {} });
    const shot = actor.addItem({ name: 'Shot', type: 'weaponEffect', system: {}, flags: { essence20: { parentId: rifle.id } } });
    const foe = makeActor('Foe', { disposition: -1 });
    await hit(actor, shot, foe);
    const plain = makeActor('Plain', { items: [packItem('again')] });
    const jab = plain.addItem({ name: 'Jab', type: 'weaponEffect', system: {} });
    await hit(plain, jab, foe);
    expect(buttonCards()).toHaveLength(0);
  });
});

describe('Money Talks / Capable Freelancer', () => {
  test('a Requisition roll may become a Wealth Test, carrying the Wealth Skill\'s own shifts - asked once with both', async () => {
    const mercenary = makeActor('Merc', { items: [packItem('moneyTalks'), packItem('freelancer')], system: { skills: { wealth: { shiftUp: 1, shiftDown: 2 } } } });
    const ask = jest.spyOn(substitutionAsk, 'skill').mockImplementation(async () => 'wealth');
    const dataset = { skill: 'targeting', essence: 'speed', shiftUp: 1, shiftDown: 0, requisitionItemName: 'Rifle' };
    await askSubstitution(mercenary, dataset, null);
    expect(ask).toHaveBeenCalledTimes(1);
    expect(ask.mock.calls[0][2]).toEqual(['targeting', 'wealth']);
    expect(dataset).toMatchObject({ skill: 'wealth', essence: 'social', shiftUp: 2, shiftDown: 2 });
  });

  test('keeping the Skill changes nothing; an ordinary roll (or a Wealth one) isn\'t asked', async () => {
    const mercenary = makeActor('Merc', { items: [packItem('moneyTalks')] });
    const ask = jest.spyOn(substitutionAsk, 'skill').mockImplementation(async () => 'targeting');
    const dataset = { skill: 'targeting', shiftUp: 0, shiftDown: 0, requisitionItemName: 'Rifle' };
    await askSubstitution(mercenary, dataset, null);
    expect(dataset.skill).toBe('targeting');
    await askSubstitution(mercenary, { skill: 'targeting' }, null);
    await askSubstitution(mercenary, { skill: 'wealth', requisitionItemName: 'Rifle' }, null);
    expect(ask).toHaveBeenCalledTimes(1);
  });
});

describe('Urban Adaptation', () => {
  test('a pool of Ranger-of-half-your-level Adaptation Points (2 at 10th, 4 at 20th), back at a rest', async () => {
    for (const [level, max] of [[10, 2], [20, 4], [3, 1], [2, 0]]) {
      const actor = makeActor('City', { items: [packItem('urban')], system: { level } });
      const item = itemNamed(actor, 'Urban Adaptation');
      let used = 0;
      while (useAvailable(item, useRulesOf(item)[0].rule, 0) && used < 9) {
        await use(item, { option: used % 3 });
        game.settings.get = () => 1 + used;
        used++;
      }

      game.settings.get = () => 1;
      expect([level, used]).toEqual([level, max]);
    }
  });

  test('outside a city for the scene: Edge on non-attack tests, Specialized attacks, ignoring Rough Terrain - each bought once', async () => {
    const actor = makeActor('City', { items: [packItem('urban')], system: { level: 20 } });
    const item = itemNamed(actor, 'Urban Adaptation');
    startCombat(1, 0);
    await use(item, { option: 0 });
    expect(pay).toHaveBeenCalledWith('free');
    terrain = 'woodlands';
    expect(shifts(sources(actor, null, { rolledSkill: 'culture' })).edge).toBe(true);
    expect(shifts(sources(actor, null, { item: { type: 'weaponEffect', system: {} } })).edge).toBe(false);
    terrain = null;
    expect(shifts(sources(actor, null, { rolledSkill: 'culture' })).edge).toBe(true);
    terrain = 'urban';
    expect(shifts(sources(actor, null, { rolledSkill: 'culture' })).edge).toBe(false);

    // Edge is bought: the next pick offers the other two.
    let offered = null;
    await runUse(item, pay, { ask: async (step, options) => {
      offered = options.map(option => option.label);
      return offered.findIndex(label => label.includes('Rough'));
    } });
    expect(offered).toHaveLength(2);
    terrain = 'woodlands';
    expect(ruleMovement(actor).ignoreRoughTerrain).toBe(true);
    expect(ruleSpecializes(actor, 'might', { type: 'weaponEffect', system: {} }, {})).toBe(false);

    // A cancelled pick costs nothing.
    pay.mockClear();
    await runUse(item, pay, { ask: async () => null });
    expect(pay).not.toHaveBeenCalled();
  });
});

describe('Izuna Drop', () => {
  const grappler = (skills = {}) => makeActor('Faller', { items: [packItem('izuna')], system: { skills } });

  test('on a Grapple vs Toughness the target takes the fall (and lands Prone), any overflow past its Health comes back', async () => {
    const actor = grappler({ acrobatics: { shift: 'd8' }, athletics: { shift: 'd4' } });
    const foe = makeActor('Foe', { disposition: -1, system: { health: { value: 2, max: 10 }, defenses: { toughness: { total: 14 } } } });
    target(foe);
    numbers = [45];
    await use(itemNamed(actor, 'Izuna Drop'));
    expect(pay).toHaveBeenCalledWith('free');
    expect(grants.rollTest).toHaveBeenCalledWith(actor, 'acrobatics', 14, expect.anything());
    expect(dealt).toEqual([{ name: 'Foe', amount: 4, type: 'blunt' }, { name: 'Faller', amount: 2, type: 'blunt' }]);
    expect(timed).toEqual([{ name: 'Foe', status: 'prone', rounds: 0 }]);
  });

  test('a miss: the faller takes it and lands Prone; Athletics unless Acrobatics is better; 20 damage at most', async () => {
    grants.rollTest.mockImplementation(async () => ({ success: false }));
    const actor = grappler({ acrobatics: { shift: 'd4' }, athletics: { shift: 'd4' } });
    const foe = makeActor('Foe', { disposition: -1 });
    target(foe);
    numbers = [500];
    await use(itemNamed(actor, 'Izuna Drop'));
    expect(grants.rollTest).toHaveBeenCalledWith(actor, 'athletics', 13, expect.anything());
    expect(dealt).toEqual([{ name: 'Faller', amount: 20, type: 'blunt' }]);
    expect(timed).toEqual([{ name: 'Faller', status: 'prone', rounds: 0 }]);
  });

  test('a target this user can\'t act for gets a GM button instead; no target, or yourself, does nothing', async () => {
    const actor = grappler();
    const foe = makeActor('Foe', { disposition: -1 });
    foe.isOwner = false;
    game.user.isGM = false;
    target(foe);
    numbers = [30];
    await use(itemNamed(actor, 'Izuna Drop'));
    expect(dealt).toEqual([]);
    expect(buttonCards()).toHaveLength(1);
    expect(buttonCards()[0].flags.essence20.ruleButton.who).toBe('gm');

    target(actor);
    await use(itemNamed(actor, 'Izuna Drop'));
    expect(ui.notifications.warn).toHaveBeenCalledWith('E20.S1IzunaNoTarget');
    expect(grants.rollTest).toHaveBeenCalledTimes(1);
  });
});

/* -------------------------------------------- */
/*  Social, team and Zord items                  */
/* -------------------------------------------- */

describe('Augment Power', () => {
  const scientist = (extra = []) => makeActor('Scientist', { items: [packItem('augment'), ...extra], x: 0 });

  test('↑1 to an ally once per turn and ↑2 once per combat - the button offers only what\'s left', async () => {
    const actor = scientist();
    const ally = makeActor('Ally', { x: 30 });
    startCombat(1, 0);
    const item = itemNamed(actor, 'Augment Power');
    await use(item, { which: '↑1 to an ally (once per turn)' });
    expect(shifts(sources(ally, null, { rolledSkill: 'athletics' })).up).toBe(1);
    expect(shifts(sources(ally, null, { rolledSkill: 'athletics', dataset: { isInitiative: true } })).up).toBe(0);
    expect(useRulesOf(item).filter(({ rule, index }) => useAvailable(item, rule, index)).map(({ rule }) => rule.label)).toEqual(['↑2 to an ally (once per combat)']);
    await use(item, { which: '↑2 to an ally (once per combat)' });
    // One banked bonus per ally: the ↑2 takes the ↑1's place.
    expect(shifts(sources(ally, null, { rolledSkill: 'athletics' })).up).toBe(2);
    expect(useRulesOf(item).filter(({ rule, index }) => useAvailable(item, rule, index))).toEqual([]);
    game.combat.turn = 1;
    expect(useRulesOf(item).filter(({ rule, index }) => useAvailable(item, rule, index)).map(({ rule }) => rule.label)).toEqual(['↑1 to an ally (once per turn)']);
  });

  test('Multiplication: twice each, at ↑2 / ↑4', async () => {
    const actor = scientist([bookItem(BOOK.multiplication)]);
    const ally = makeActor('Ally', { x: 30 });
    startCombat(1, 0);
    const item = itemNamed(actor, 'Augment Power');
    await use(item, { which: '↑1 to an ally (once per turn)' });
    expect(shifts(sources(ally, null, { rolledSkill: 'athletics' })).up).toBe(2);
    await use(item, { which: '↑1 to an ally (once per turn)' });
    expect(useRulesOf(item).filter(({ rule, index }) => useAvailable(item, rule, index)).map(({ rule }) => rule.label)).toEqual(['↑2 to an ally (once per combat)']);
    await use(item, { which: '↑2 to an ally (once per combat)' });
    expect(shifts(sources(ally, null, { rolledSkill: 'athletics' })).up).toBe(4);
  });

  test('a GrantDouble holder is offered to double the ↑ it grants', async () => {
    startCombat(1, 0);
    const doubler = scientist([{ name: 'Doubler', type: 'perk', system: { rules: [{ type: 'GrantDouble', grants: ['upshift'] }] } }]);
    const friend = makeActor('Friend', { x: 20 });
    foundry.applications.api.DialogV2.confirm.mockResolvedValueOnce(true);
    await use(itemNamed(doubler, 'Augment Power'), { which: '↑1 to an ally (once per turn)' });
    expect(shifts(sources(friend, null, { rolledSkill: 'athletics' })).up).toBe(2);
  });
});

describe('Enemy Number One', () => {
  test('enemies within 30 ft suffer a Snag on attacks that leave the Tank out, unless they attacked it this turn', async () => {
    const tank = makeActor('Tank', { items: [packItem('enemyNumberOne')], x: 0 });
    const friend = makeActor('Friend', { x: 5 });
    const foe = makeActor('Foe', { disposition: -1, x: 20 });
    const far = makeActor('Far', { disposition: -1, x: 50 });
    const attack = { type: 'weaponEffect', system: {} };
    startCombat(1, 0);
    expect(shifts(sources(foe, friend, { item: attack })).snag).toBe(true);
    expect(shifts(sources(foe, tank, { item: attack })).snag).toBe(false);
    expect(shifts(sources(far, friend, { item: attack })).snag).toBe(false);
    expect(shifts(sources(foe, friend, { rolledSkill: 'persuasion' })).snag).toBe(false);
    expect(shifts(sources(foe, null, { item: attack })).snag).toBe(false);

    // Attacking the Tank exempts the foe for the rest of its turn.
    await fireTriggers(tank, 'targeted', { roll: { item: attack, isAttack: true }, outcome: 'failure', targets: [foe], facts: { results: [{ success: false }] } });
    expect(shifts(sources(foe, friend, { item: attack })).snag).toBe(false);
    game.combat.turn = 1;
    expect(shifts(sources(foe, friend, { item: attack })).snag).toBe(true);

    game.combat = null;
    expect(shifts(sources(foe, friend, { item: attack })).snag).toBe(false);
  });
});

describe('Exemplary', () => {
  test('a teammate gains an Edge on a test of the Skill the leader last rolled', async () => {
    const leader = makeActor('Leader', { items: [packItem('exemplary')], x: 0 });
    const ally = makeActor('Ally', { x: 40 });
    const foe = makeActor('Foe', { disposition: -1, x: 10 });
    await fireTriggers(leader, 'afterRoll', { roll: { rolledSkill: 'athletics' }, outcome: 'failure', facts: { results: [{ success: false }] }, vars: { skill: 'athletics' } });
    expect(shifts(sources(ally, null, { rolledSkill: 'athletics' })).edge).toBe(true);
    expect(shifts(sources(ally, null, { rolledSkill: 'technology' })).edge).toBe(false);
    expect(shifts(sources(foe, null, { rolledSkill: 'athletics' })).edge).toBe(false);
    expect(shifts(sources(leader, null, { rolledSkill: 'athletics' })).edge).toBe(false);
    await fireTriggers(leader, 'afterRoll', { roll: { rolledSkill: 'technology' }, outcome: null, facts: { results: [], open: true }, vars: { skill: 'technology' } });
    expect(shifts(sources(ally, null, { rolledSkill: 'athletics' })).edge).toBe(false);
    expect(shifts(sources(ally, null, { rolledSkill: 'technology' })).edge).toBe(true);
  });
});

describe('Face Me!', () => {
  test('a successful Intimidation vs Willpower: the foe\'s next attack at anyone but the holder is at ↓2; any attack ends it', async () => {
    const pillar = makeActor('Pillar', { items: [packItem('faceMe')] });
    const foe = makeActor('Foe', { disposition: -1 });
    const friend = makeActor('Friend');
    const attack = { type: 'weaponEffect', system: {} };
    target(foe);
    await use(itemNamed(pillar, 'Face Me!'));
    expect(react.rollVsMany.mock.calls[0].slice(1, 4)).toEqual(['intimidation', [foe], 'willpower']);
    expect(shifts(sources(foe, friend, { item: attack })).down).toBe(2);
    expect(shifts(sources(foe, pillar, { item: attack })).down).toBe(0);
    expect(shifts(sources(foe, friend, { rolledSkill: 'persuasion' })).down).toBe(0);
    await fireTriggers(foe, 'afterRoll', { roll: { item: attack, isAttack: true, targetCount: 1 }, outcome: 'success', facts: { results: [{ success: true }] }, vars: { targets: 1 } });
    expect(shifts(sources(foe, friend, { item: attack })).down).toBe(0);
  });

  test('a failed roll, or no target, compels nothing', async () => {
    const pillar = makeActor('Pillar', { items: [packItem('faceMe')] });
    const foe = makeActor('Foe', { disposition: -1, flags: { resists: true } });
    target(foe);
    await use(itemNamed(pillar, 'Face Me!'));
    expect(shifts(sources(foe, makeActor('Friend'), { item: { type: 'weaponEffect', system: {} } })).down).toBe(0);
  });
});

describe('Remote Operations', () => {
  // Book check 2026-10-06 (docs/rules-batches/book-durations.md): for the rest of this turn only.
  test('a DIF 10 Alertness success lets the holder Lend Assistance at any rank for the rest of the turn', async () => {
    const recon = makeActor('Recon', { items: [packItem('remoteOps')] });
    const ally = makeActor('Ally');
    startCombat(1, 0);
    expect(ruleAssist(recon, ally, 'athletics').anyRank).toBe(false);
    await use(itemNamed(recon, 'Remote Operations'));
    expect(grants.rollTest).toHaveBeenCalledWith(recon, 'alertness', 10, expect.anything());
    expect(ruleAssist(recon, ally, 'athletics').anyRank).toBe(true);
    game.combat.turn = 1;
    expect(ruleAssist(recon, ally, 'athletics').anyRank).toBe(false);
  });

  test('a failed test grants nothing', async () => {
    grants.rollTest.mockImplementation(async () => ({ success: false }));
    const recon = makeActor('Recon', { items: [packItem('remoteOps')] });
    await use(itemNamed(recon, 'Remote Operations'));
    expect(ruleAssist(recon, makeActor('Ally'), 'athletics').anyRank).toBe(false);
  });
});

describe('Team broadcasts (One For All, Power Burst, Shining Leader, Rallying Cry, Heart Of The Team, Nano-Med Mastery)', () => {
  const ranger = (key, extra = {}) => makeActor('Leader', { items: [packItem(key, extra)], x: 0, system: { powers: { personal: { value: 3, max: 3 } } } });
  const teammate = (name, x, isMorphed = true, power = 0) => makeActor(name, { x, system: { isMorphed, powers: { personal: { value: power, max: 2 } } } });

  // Book check 2026-10-06 (docs/rules-batches/book-costs.md): the user must be Morphed; every teammate regains, Morphed or not.
  test('One For All: 3 Power while Morphed, every teammate regains 1d2 (past their maximum); once per encounter', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.99);
    const leader = ranger('oneForAll');
    leader.system.isMorphed = true;
    const a = teammate('A', 500, true, 2);
    const b = teammate('B', 10, false);
    const item = itemNamed(leader, 'One For All');
    await use(item);
    expect(leader.system.powers.personal.value).toBe(0);
    expect(a.system.powers.personal.value).toBe(4);
    expect(b.system.powers.personal.value).toBe(2);
    expect(useAvailable(item, useRulesOf(item)[0].rule, 0)).toBe(false);
    expect(useAvailable(itemNamed(ranger('oneForAll'), 'One For All'), useRulesOf(item)[0].rule, 0)).toBe(true);
  });

  test('One For All isn\'t offered without 3 Power; Power Burst costs nothing and rolls the Perk\'s die', async () => {
    const poor = makeActor('Poor', { items: [packItem('oneForAll')], system: { powers: { personal: { value: 2, max: 3 } } } });
    expect(useAvailable(itemNamed(poor, 'One For All'), useRulesOf(itemNamed(poor, 'One For All'))[0].rule, 0)).toBe(false);
    jest.spyOn(Math, 'random').mockReturnValue(0.99);
    const leader = ranger('powerBurst');
    itemNamed(leader, 'Power Burst').system.advances = { currentValue: 4 };
    const a = teammate('A', 20);
    await use(itemNamed(leader, 'Power Burst'));
    expect(leader.system.powers.personal.value).toBe(3);
    expect(a.system.powers.personal.value).toBe(4);
  });

  // Book check 2026-10-06 (docs/rules-batches/book-costs.md): the user must be Morphed; every ally gets it, Morphed or not.
  test('Shining Leader: 1 Power while Morphed, allies get Edge on attacks this round and the next (in combat only)', async () => {
    const leader = ranger('shiningLeader');
    leader.system.isMorphed = true;
    const a = teammate('A', 300);
    const b = teammate('B', 5, false);
    const attack = { type: 'weaponEffect', system: {} };
    startCombat(3, 0);
    await use(itemNamed(leader, 'Shining Leader'));
    expect(leader.system.powers.personal.value).toBe(2);
    expect(shifts(sources(a, null, { item: attack })).edge).toBe(true);
    expect(shifts(sources(a, null, { rolledSkill: 'athletics' })).edge).toBe(false);
    expect(shifts(sources(b, null, { item: attack })).edge).toBe(true);
    expect(shifts(sources(leader, null, { item: attack })).edge).toBe(false);
    game.combat.round = 4;
    expect(shifts(sources(a, null, { item: attack })).edge).toBe(true);
    game.combat.round = 5;
    expect(shifts(sources(a, null, { item: attack })).edge).toBe(false);

    // Outside combat the window never opens.
    const other = ranger('shiningLeader');
    other.system.isMorphed = true;
    const c = teammate('C', 10);
    game.combat = null;
    await use(itemNamed(other, 'Shining Leader'));
    startCombat(1, 0);
    expect(shifts(sources(c, null, { item: attack })).edge).toBe(false);
  });

  test('Rallying Cry: allies within 60 ft, Morphed or not, get Edge on attacks for two rounds; no cost or limit', async () => {
    const tank = makeActor('Tank', { items: [packItem('rallyingCry')], x: 0 });
    const near = teammate('Near', 60, false);
    const far = teammate('Far', 61, false);
    const attack = { type: 'weaponEffect', system: {} };
    startCombat(1, 0);
    await use(itemNamed(tank, 'Rallying Cry'));
    expect(shifts(sources(near, null, { item: attack })).edge).toBe(true);
    expect(shifts(sources(far, null, { item: attack })).edge).toBe(false);
    const item = itemNamed(tank, 'Rallying Cry');
    expect(useAvailable(item, useRulesOf(item)[0].rule, 0)).toBe(true);
  });

  test('Heart Of The Team: allies within 30 ft gain 1 Temporary Health and a Move action (granted by the holder); once per encounter', async () => {
    const leader = makeActor('Leader', { items: [packItem('heart')], x: 0 });
    const near = teammate('Near', 30, false);
    const far = teammate('Far', 40, false);
    await use(itemNamed(leader, 'Heart Of The Team'));
    expect(near.system.health.bonus).toBe(1);
    expect(far.system.health.bonus).toBe(0);
    expect(leader.system.health.bonus).toBe(0);
    expect(actionsGranted).toEqual([expect.objectContaining({ name: 'Near', move: 1, granter: 'Leader' })]);
    const item = itemNamed(leader, 'Heart Of The Team');
    expect(useAvailable(item, useRulesOf(item)[0].rule, 0)).toBe(false);
  });

  test('Nano-Med Mastery: the holder and allies within 60 ft heal 2 (to their maximum) and get Edge on every test for two rounds', async () => {
    const medic = makeActor('Medic', { items: [packItem('nanoMed')], x: 0, system: { health: { value: 9, max: 10, bonus: 0 } } });
    const near = makeActor('Near', { x: 60, system: { health: { value: 3, max: 10, bonus: 0 } } });
    const far = makeActor('Far', { x: 61, system: { health: { value: 3, max: 10, bonus: 0 } } });
    startCombat(2, 0);
    await use(itemNamed(medic, 'Nano-Med Mastery'));
    expect([medic.system.health.value, near.system.health.value, far.system.health.value]).toEqual([10, 5, 3]);
    for (const actor of [medic, near]) {
      expect([actor.name, shifts(sources(actor, null, { rolledSkill: 'athletics' })).edge]).toEqual([actor.name, true]);
      expect([actor.name, shifts(sources(actor, null, { rolledSkill: 'athletics', dataset: { isInitiative: true } })).edge]).toEqual([actor.name, false]);
    }

    expect(shifts(sources(far, null, { rolledSkill: 'athletics' })).edge).toBe(false);
    game.combat.round = 4;
    expect(shifts(sources(near, null, { rolledSkill: 'athletics' })).edge).toBe(false);
  });
});

describe('Vainglorious', () => {
  test('the first turn of each combat costs the Standard action, once', async () => {
    const bot = makeActor('Bot', { items: [packItem('vainglorious', { type: 'hangUp' })] });
    startCombat(1, 0);
    await fireTriggers(bot, 'turnStart');
    await fireTriggers(bot, 'turnStart');
    expect(spent).toEqual([{ name: 'Bot', action: 'standard' }]);
    game.combat = { ...game.combat, id: 'c2' };
    game.combats = { get: id => (id == 'c2' ? game.combat : null) };
    await fireTriggers(bot, 'turnStart');
    expect(spent).toHaveLength(2);
  });
});

describe('Bio-Energy Conversion', () => {
  test('↑2 and +2 damage on attacks during the round after it\'s used - not the round itself, not the one after', async () => {
    const zord = makeActor('Zord', { type: 'zord', items: [packItem('bioEnergy', { type: 'feature' })] });
    const attack = { type: 'weaponEffect', system: {} };
    startCombat(3, 0);
    await use(itemNamed(zord, 'Bio-Energy Conversion'));
    const now = () => [shifts(sources(zord, null, { item: attack })).up, ruleScaledDamage(zord, null, { item: attack }).amount];
    expect(now()).toEqual([0, 0]);
    game.combat.round = 4;
    expect(now()).toEqual([2, 2]);
    expect(shifts(sources(zord, null, { rolledSkill: 'athletics' })).up).toBe(0);
    game.combat.round = 5;
    expect(now()).toEqual([0, 0]);
  });

  test('used outside combat it never applies', async () => {
    const zord = makeActor('Zord', { type: 'zord', items: [packItem('bioEnergy', { type: 'feature' })] });
    await use(itemNamed(zord, 'Bio-Energy Conversion'));
    startCombat(1, 0);
    expect(shifts(sources(zord, null, { item: { type: 'weaponEffect', system: {} } })).up).toBe(0);
  });
});

describe('Zord Alterations', () => {
  const pilotWith = zordSystem => {
    const zord = makeActor('Zord', { type: 'zord', system: {
      size: 'huge', health: { value: 20, max: 20 }, resistances: {}, essences: { strength: { value: 3 }, speed: { value: 2 } },
      movement: { aerial: { base: 0 }, climb: { base: 10 }, ground: { base: 40 }, swim: { base: 0 }, burrow: { base: 0 } }, ...zordSystem,
    } });
    const pilot = makeActor('Pilot', { system: { actors: { z: { type: 'zord', uuid: zord.uuid } } } });
    return { pilot, zord };
  };

  const alter = (pilot, option) => fireItemAdded(pilot, pilot.addItem(packItem('zordAlterations')), { ask: async () => option });

  test('Strength +2, Speed +2, or both +1 on the pilot\'s own Zord', async () => {
    const { pilot, zord } = pilotWith();
    await alter(pilot, 0);
    await alter(pilot, 1);
    await alter(pilot, 2);
    expect([zord.system.essences.strength.value, zord.system.essences.speed.value]).toEqual([6, 5]);
  });

  test('size up with +1 Health; size down (Huge at least) with +10 ft to every Movement type', async () => {
    const { pilot, zord } = pilotWith({ size: 'gigantic' });
    await alter(pilot, 3);
    expect(zord.system.size).toBe('extended2');
    expect([zord.system.health.max, zord.system.health.value]).toEqual([21, 21]);
    await alter(pilot, 4);
    expect(zord.system.size).toBe('gigantic');
    expect(['aerial', 'climb', 'ground', 'swim', 'burrow'].map(type => zord.system.movement[type].base)).toEqual([10, 20, 50, 10, 0]);
    const small = pilotWith({ size: 'huge' });
    await alter(small.pilot, 4);
    expect(small.zord.system.size).toBe('huge');
  });

  test('Resistance to a chosen Element; a cancelled pick or no Zord changes nothing', async () => {
    const { pilot, zord } = pilotWith();
    picks = ['fire'];
    await alter(pilot, 5);
    expect(zord.system.resistances).toEqual({ fire: true });
    picks = [null];
    await alter(pilot, 5);
    expect(zord.system.resistances).toEqual({ fire: true });
    const lone = makeActor('Lone');
    await alter(lone, 0);
    expect(ui.notifications.warn).toHaveBeenCalledWith('E20.ZordAlterationNoZord');
  });
});
