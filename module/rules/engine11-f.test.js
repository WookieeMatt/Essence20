import { jest } from '@jest/globals';

/**
 * Round 11, group F engine pieces (module/rules/ext/f/): the windowUsed tags and markWindow step, the world-wide
 * rollSeen / conditionSeen / rollMessage events with their dialog facts, the sideAlly / sideEnemy / emotion tags and the
 * activeEmotions pick source, the HitMultiplier rule type and the styleChoice / resistsChoice tags, the rollEach step and
 * participantPilots recipient, the SkillDie rule type, and the megaformPilot reactor lookup (rules/reactions.mjs).
 */

global.Hooks = { on: () => 0, once: () => 0, callAll: () => {} };

const chooseSelect = jest.fn();
const rollTest = jest.fn();
jest.unstable_mockModule('./mechanics/resources/grants.mjs', () => ({ chooseSelect, rollTest, chooseButtons: jest.fn(), findItems: jest.fn() }));

let nextId = 1;
const clock = { sceneClockScene: 1, sceneClockEncounter: 1, sceneClockMission: 1 };
const getPath = (object, key) => String(key).split('.').reduce((o, k) => (o === null || o === undefined ? o : o[k]), object);
function setPath(object, key, value) {
  const deletion = key.match(/^(.*)\.-=(.+)$/);
  if (deletion) {
    delete getPath(object, deletion[1])?.[deletion[2]];
    return;
  }

  const keys = key.split('.');
  const last = keys.pop();
  keys.reduce((o, k) => (o[k] ??= {}), object)[last] = value;
}

const actors = [];
const items = new Map();
global.game = {
  combat: null, user: { id: 'u', isGM: true, targets: new Set() }, users: { activeGM: null, contents: [] },
  settings: { get: (scope, key) => clock[key] ?? 1, set: async () => {} },
  actors: { contents: actors, get: id => actors.find(actor => actor.id == id), [Symbol.iterator]: () => actors[Symbol.iterator]() },
  i18n: { localize: k => k, format: k => k, has: () => false },
  messages: { get: () => null },
};
global.canvas = undefined;
global.fromUuidSync = uuid => actors.find(actor => actor.uuid == uuid) ?? items.get(uuid) ?? null;
global.fromUuid = async uuid => global.fromUuidSync(uuid);
global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
global.ui = { notifications: { warn: jest.fn(), info: jest.fn() } };
global.CONFIG = {
  ...(global.CONFIG ?? {}),
  E20: {
    ...(global.CONFIG?.E20 ?? {}),
    skillShiftList: ['3d6', '2d8', 'd12', 'd10', 'd8', 'd6', 'd4', 'd2', 'd20'],
    skills: { might: 'Might', athletics: 'Athletics' }, skillToEssence: { might: 'strength', athletics: 'strength' },
    damageTypes: { fire: 'Fire', blunt: 'Blunt', sonic: 'Sonic' },
  },
  statusEffects: [{ id: 'frightened' }, { id: 'prone' }],
};
global.foundry = {
  ...(global.foundry ?? {}),
  utils: { ...(global.foundry?.utils ?? {}), getProperty: getPath, setProperty: setPath, deepClone: value => JSON.parse(JSON.stringify(value)), escapeHTML: text => String(text) },
};

await import('./plugins/index.mjs');
// The megaformPilot lookup registers once rules/reactions.mjs has loaded (lazily).
await (await import('./plugins/zords/megaform-pilot-reactors.mjs')).lookupReady;
const { rebuildIndex } = await import('./index.mjs');
const { runSteps, stepContext, stepErrors, recipients, pickOptions } = await import('./steps.mjs');
const { validateRule } = await import('./types.mjs');
const { contextFor, evaluate } = await import('./predicate.mjs');
const { reactionOffers, pressReaction, REACTION_WHO } = await import('./reactions.mjs');
const { cardInfo } = await import('../mechanics/combat/reaction-engine.mjs');
const watch = await import('./plugins/tags/world-watch.mjs');
const { hitMultiplierOnAttack } = await import('./plugins/zords/megaform-finisher.mjs');
const { skillDieDerived } = await import('./plugins/rolls/skill-die.mjs');
const { windowUsed } = await import('./plugins/resources/scene-window-counters.mjs');

function asItem(data, actor) {
  const item = {
    id: data.id ?? `i${nextId++}`, flags: {}, system: {}, effects: [], isOwner: true, ...data, parent: actor,
    async update(changes) {
      for (const [key, value] of Object.entries(changes)) {
        setPath(this, key, value);
      }
    },
  };
  item.uuid = `${actor.uuid}.Item.${item.id}`;
  items.set(item.uuid, item);
  return item;
}

function makeActor(type = 'playerCharacter', name = 'Ranger', system = {}, { disposition = 1, world = true } = {}) {
  const list = [];
  const actor = {
    id: `a${nextId++}`, name, type, isOwner: true, statuses: new Set(), flags: { essence20: {} }, effects: [],
    system: { health: { value: 5, max: 10 }, powers: { personal: { value: 1, max: 6 } }, ...system },
    prototypeToken: { disposition },
    getActiveTokens: () => [],
    update: jest.fn(async function (data) {
      for (const [key, value] of Object.entries(data)) {
        setPath(this, key, value);
      }
    }),
    async setFlag(scope, key, value) {
      setPath(this, `flags.${scope}.${key}`, value);
    },
    async unsetFlag(scope, key) {
      delete this.flags?.[scope]?.[key];
    },
    getFlag(scope, key) {
      return getPath(this.flags?.[scope], key);
    },
  };
  actor.uuid = `Actor.${actor.id}`;
  actor.items = { contents: list, get: id => list.find(item => item.id == id), [Symbol.iterator]: () => list[Symbol.iterator]() };
  if (world) {
    actors.push(actor);
  }

  return actor;
}

function addItem(actor, data) {
  const item = asItem(data, actor);
  actor.items.contents.push(item);
  rebuildIndex(actor);
  return item;
}

const withRules = (actor, rules, extra = {}) => addItem(actor, { name: extra.name ?? 'Thing', type: extra.type ?? 'perk', system: { rules, ...(extra.system ?? {}) }, ...extra.data });

beforeEach(() => {
  actors.length = 0;
  items.clear();
  Object.assign(clock, { sceneClockScene: 1, sceneClockEncounter: 1, sceneClockMission: 1 });
  global.game.user.targets = new Set();
  global.ChatMessage.create.mockClear();
  chooseSelect.mockReset();
  rollTest.mockReset();
});

/* -------------------------------------------- */
/*  Window counters                              */
/* -------------------------------------------- */

describe('windowUsed / markWindow', () => {
  test('counts on the named flag in its window, a new window starts over, clear forgets it', async () => {
    const actor = makeActor();
    const item = withRules(actor, []);
    const ctx = stepContext({ actor, item, rule: {} });
    expect(windowUsed(actor, 'sharedFlag:scene')).toBe(false);
    await runSteps([{ do: 'markWindow', flag: 'sharedFlag', window: 'scene' }], ctx);
    expect(actor.flags.essence20.sharedFlag).toEqual({ epoch: 1, window: 'scene', count: 1 });
    await runSteps([{ do: 'markWindow', flag: 'sharedFlag', window: 'scene' }], ctx);
    expect(evaluate(['self:windowUsed:sharedFlag:scene:2'], contextFor({ self: actor }))).toBe(true);
    expect(evaluate(['self:windowUsed:sharedFlag:scene:3'], contextFor({ self: actor }))).toBe(false);
    clock.sceneClockScene = 2;
    expect(evaluate(['self:windowUsed:sharedFlag:scene'], contextFor({ self: actor }))).toBe(false);
    clock.sceneClockScene = 1;
    await runSteps([{ do: 'markWindow', flag: 'sharedFlag', clear: true }], ctx);
    expect(actor.flags.essence20.sharedFlag).toBeUndefined();
  });

  test('target: and holder: read the other party / the holder; no other party is false', () => {
    const holder = makeActor();
    const other = makeActor();
    other.flags.essence20.f = { epoch: 1, window: 'mission', count: 1 };
    expect(evaluate(['target:windowUsed:f:mission'], contextFor({ self: holder, other }))).toBe(true);
    expect(evaluate(['target:windowUsed:f:mission'], contextFor({ self: holder }))).toBe(false);
    expect(evaluate(['holder:windowUsed:f:mission'], contextFor({ self: holder, holder: other }))).toBe(true);
  });

  test('validation', () => {
    expect(stepErrors([{ do: 'markWindow', window: 'scene' }])).toHaveLength(1);
    expect(stepErrors([{ do: 'markWindow', flag: 'x', window: 'turn' }])).toHaveLength(1);
    expect(stepErrors([{ do: 'markWindow', flag: 'x', clear: true }])).toEqual([]);
  });
});

/* -------------------------------------------- */
/*  World-wide events                            */
/* -------------------------------------------- */

const trigger = (event, when, text = 'heard {target}') => ({ type: 'Trigger', event, when, steps: [{ do: 'chat', text }] });
const chatLines = () => global.ChatMessage.create.mock.calls.map(call => call[0].content).join(' | ');

describe('rollSeen', () => {
  test('reaches an off-canvas world holder, the roller as target, with the roll\'s facts', async () => {
    const holder = makeActor('playerCharacter', 'Holder', {}, { disposition: 1 });
    withRules(holder, [trigger('rollSeen', ['var:crit', 'target:sideEnemy'], 'enemy crit by {target}'), trigger('rollSeen', ['var:crit', 'target:sideAlly'], 'ally crit by {target}')]);
    const ally = makeActor('playerCharacter', 'Ally', {}, { disposition: 1 });
    const enemy = makeActor('npc', 'Enemy', {}, { disposition: -1 });
    await watch.rollSeen(enemy, [{ success: true, total: 22 }], {}, { isCrit: true });
    await watch.rollSeen(ally, [{ success: true, total: 21 }], {}, { isCrit: true });
    await watch.rollSeen(ally, [{ success: true }], {}, {});
    expect(chatLines()).toBe('<strong>Thing</strong><br>enemy crit by Enemy | <strong>Thing</strong><br>ally crit by Ally');
  });

  test('the roller hears its own roll; failed / fumble and the dialog\'s upshift and Lend Assistance facts', async () => {
    const roller = makeActor();
    withRules(roller, [trigger('rollSeen', ['target:self', 'var:failed', 'var:upshifted'], 'shame'), trigger('rollSeen', ['target:self', 'var:failed', 'var:assisted'], 'shy'),
      trigger('rollSeen', ['target:self', 'var:fumble'], 'fumbled')]);
    watch.noteDialog(roller, { shiftUp: 2, shiftDown: 1 });
    await watch.rollSeen(roller, [{ success: false }, { success: false }], {}, {});
    expect(chatLines()).toContain('shame');
    expect(chatLines()).not.toContain('shy');
    global.ChatMessage.create.mockClear();
    // The note is used up by the roll it was taken for.
    await watch.rollSeen(roller, [{ success: false }], {}, { isFumble: true });
    expect(chatLines()).toBe('<strong>Thing</strong><br>fumbled');
    global.ChatMessage.create.mockClear();
    roller.flags.essence20.pendingLendAssistanceEdge = true;
    watch.noteDialog(roller, { shiftUp: 1, shiftDown: 1 });
    await watch.rollSeen(roller, [{ success: true }, { success: false }], {}, {});
    expect(chatLines()).toBe('');
    watch.noteDialog(roller, {});
    await watch.rollSeen(roller, [{ success: false }], {}, {});
    expect(chatLines()).toContain('shy');
  });
});

describe('conditionSeen / rollMessage', () => {
  test('conditionSeen: the statuses gained and whether one is a Condition, heard by the subject (even a token actor) and the world', async () => {
    const holder = makeActor('playerCharacter', 'Holder');
    withRules(holder, [trigger('conditionSeen', ['var:condition', 'target:sideAlly'], 'ally got one'), trigger('conditionSeen', ['target:self', 'var:includes:statuses:frightened'], 'scared')]);
    const tokenActor = makeActor('npc', 'Token Ally', {}, { world: false });
    await watch.conditionSeen(tokenActor, ['prone']);
    expect(chatLines()).toContain('ally got one');
    global.ChatMessage.create.mockClear();
    await watch.conditionSeen(tokenActor, ['notACondition']);
    expect(chatLines()).toBe('');
    await watch.conditionSeen(holder, ['frightened']);
    expect(chatLines()).toBe('<strong>Thing</strong><br>scared');
  });

  test('rollMessage: a d20 roll message fires on its speaker\'s world actor with the total', async () => {
    const actor = makeActor();
    withRules(actor, [trigger('rollMessage', [{ any: ['var:total=2', 'var:total>=25'] }], 'surprise')]);
    await watch.rollMessage({ speaker: { actor: actor.id }, rolls: [{ total: 25, dice: [{ faces: 20 }] }] });
    expect(chatLines()).toContain('surprise');
    global.ChatMessage.create.mockClear();
    await watch.rollMessage({ speaker: { actor: actor.id }, rolls: [{ total: 30, dice: [{ faces: 6 }] }] });
    await watch.rollMessage({ speaker: { actor: actor.id }, rolls: [{ total: 12, dice: [{ faces: 20 }] }] });
    expect(chatLines()).toBe('');
  });
});

describe('emotion tags', () => {
  test('self:emotion reads the actor\'s own options and a Team Spirit grant while the lender keeps it', () => {
    const lender = makeActor();
    lender.flags.essence20.activeEmotionalMastery = ['joy'];
    const actor = makeActor();
    actor.flags.essence20 = { activeEmotionalMastery: ['anger'], teamSpiritOption: { option: 'joy', casterUuid: lender.uuid } };
    const ask = tag => evaluate([tag], contextFor({ self: actor }));
    expect([ask('self:emotion:anger'), ask('self:emotion:joy'), ask('self:emotion:fear'), ask('self:emotion')]).toEqual([true, true, false, true]);
    lender.flags.essence20.activeEmotionalMastery = [];
    expect(ask('self:emotion:joy')).toBe(false);
    expect(pickOptions({ from: 'activeEmotions' }, { actor, targets: [] })).toEqual([{ value: 'anger', label: 'E20.EmotionalMasteryAnger' }]);
    expect(evaluate(['self:emotion'], contextFor({ self: makeActor() }))).toBe(false);
  });

  test('sideAlly / sideEnemy by disposition, never itself; a neutral is nobody\'s enemy', () => {
    const a = makeActor('playerCharacter', 'A', {}, { disposition: 1 });
    const b = makeActor('playerCharacter', 'B', {}, { disposition: 1 });
    const c = makeActor('npc', 'C', {}, { disposition: -1 });
    const n = makeActor('npc', 'N', {}, { disposition: 0 });
    const ask = (tag, self, other) => evaluate([tag], contextFor({ self, other }));
    expect([ask('target:sideAlly', a, b), ask('target:sideAlly', a, a), ask('target:sideEnemy', a, c), ask('target:sideEnemy', a, n), ask('target:sideAlly', a, null)])
      .toEqual([true, false, true, false, false]);
  });
});

/* -------------------------------------------- */
/*  HitMultiplier and the finishing-move tags    */
/* -------------------------------------------- */

const tools = () => ({
  damageBonusNote: jest.fn((result, amount) => {
    result.damageValue += amount;
  }),
});

describe('HitMultiplier', () => {
  test('self: multiplies the hit\'s damage and retypes it to a pick, only while `when` holds', () => {
    const actor = makeActor();
    addItem(actor, { name: 'Big Hit', type: 'perk', flags: { essence20: { rules: { choices: { type: 'fire' } } } }, system: { rules: [{ type: 'HitMultiplier', multiply: 3, damageType: '{choice.type}', when: ['roll:switch:big'] }] } });
    const t = tools();
    const result = { damageValue: 4, damageType: 'blunt' };
    hitMultiplierOnAttack(actor, null, result, { switches: ['big'] }, t);
    expect(t.damageBonusNote).toHaveBeenCalledWith(result, 8, 'Big Hit');
    expect(result).toMatchObject({ damageValue: 12, damageType: 'fire', damageTypeLabel: 'Fire' });
    const off = { damageValue: 4, damageType: 'blunt' };
    hitMultiplierOnAttack(actor, null, off, { switches: [] }, t);
    expect(off).toEqual({ damageValue: 4, damageType: 'blunt' });
    const none = { damageValue: 0 };
    hitMultiplierOnAttack(actor, null, none, { switches: ['big'] }, t);
    expect(none.damageValue).toBe(0);
  });

  test('runs ahead of the rules\' flat damage bonuses (registerHitRider before), so they aren\'t multiplied', async () => {
    const { registrySnapshot } = await import('../mechanics/item-hooks.mjs');
    const { ruleDamageDealt } = await import('./adapter.mjs');
    const riders = registrySnapshot().hitRiders;
    expect(riders.indexOf(hitMultiplierOnAttack)).toBeGreaterThanOrEqual(0);
    expect(riders.indexOf(hitMultiplierOnAttack)).toBeLessThan(riders.indexOf(ruleDamageDealt));
  });

  test('scope megaform: a participant\'s rule acts on the Megaform\'s hits, once per book item; choiceFrom reads the sibling\'s pick', () => {
    const one = makeActor('zord', 'One');
    const two = makeActor('zord', 'Two');
    const rule = { type: 'HitMultiplier', scope: 'megaform', multiply: 2, damageType: '{choice.damageType}', choiceFrom: 'SIBLINGxxxxxxxxx' };
    for (const zord of [one, two]) {
      addItem(zord, { name: 'Sib', type: 'feature', _stats: { compendiumSource: 'Compendium.x.Item.SIBLINGxxxxxxxxx' }, flags: { essence20: { rules: { choices: { damageType: zord === one ? 'sonic' : 'fire' } } } } });
      addItem(zord, { name: 'Mult', type: 'feature', _stats: { compendiumSource: 'Compendium.x.Item.MULTxxxxxxxxxxxx' }, system: { rules: [rule] } });
    }

    const mega = makeActor('megaform', 'Mega', { actors: { a: { uuid: one.uuid }, b: { uuid: two.uuid } } });
    rebuildIndex(mega);
    const t = tools();
    const result = { damageValue: 3, damageType: 'blunt' };
    hitMultiplierOnAttack(mega, null, result, {}, t);
    expect(t.damageBonusNote).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ damageValue: 6, damageType: 'sonic' });
    expect(validateRule(rule)).toEqual([]);
    expect(validateRule({ type: 'HitMultiplier', multiply: 2, choiceFrom: 'short' })).toHaveLength(1);
    expect(validateRule({ type: 'HitMultiplier' })).toHaveLength(1);
  });

  test('item:styleChoice and target:resistsChoice: own pick, else the sibling\'s, else any / the attack\'s own type', () => {
    const zord = makeActor('zord');
    const sibling = addItem(zord, { name: 'Sib', type: 'feature', _stats: { compendiumSource: 'Compendium.x.Item.SIBLINGxxxxxxxxx' }, flags: { essence20: { rules: { choices: { style: 'melee', damageType: 'fire' } } } } });
    const own = addItem(zord, { name: 'Own', type: 'feature' });
    const melee = { type: 'weaponEffect', system: { classification: { style: 'melee' }, damageType: 'blunt' } };
    const ranged = { type: 'weaponEffect', system: { classification: { style: 'projectile' }, damageType: 'blunt' } };
    const resists = makeActor('npc', 'Foe', { resistances: { fire: true } });
    const blunt = makeActor('npc', 'Rock', { resistances: { blunt: true } });
    const ask = (tag, ruleItem, item, other = null) => evaluate([tag], contextFor({ self: zord, ruleItem, item, other }));
    expect([ask('item:styleChoice:style', own, ranged), ask('item:styleChoice:style:SIBLINGxxxxxxxxx', own, ranged), ask('item:styleChoice:style:SIBLINGxxxxxxxxx', own, melee)])
      .toEqual([true, false, true]);
    sibling.flags.essence20.rules.choices.style = 'ranged';
    expect(ask('item:styleChoice:style:SIBLINGxxxxxxxxx', own, ranged)).toBe(true);
    expect([ask('target:resistsChoice:damageType:SIBLINGxxxxxxxxx', own, melee, resists), ask('target:resistsChoice:damageType', own, melee, resists),
      ask('target:resistsChoice:damageType', own, melee, blunt), ask('target:resistsChoice:damageType', own, melee)]).toEqual([true, false, true, false]);
  });
});

describe('rollEach / participantPilots', () => {
  function megaformWithPilots() {
    const pilot = makeActor('playerCharacter', 'Pilot');
    const driven = makeActor('zord', 'Driven', { actors: { d: { uuid: pilot.uuid, vehicleRole: 'driver' } } });
    const empty = makeActor('zord', 'Empty');
    const bot = makeActor('playerCharacter', 'Bot');
    const mega = makeActor('megaform', 'Mega', { actors: { a: { uuid: driven.uuid }, b: { uuid: empty.uuid }, c: { uuid: bot.uuid } } });
    return { pilot, empty, mega };
  }

  test('participantPilots: each Zord participant\'s driver, else the Zord', () => {
    const { pilot, empty, mega } = megaformWithPilots();
    expect(recipients({ to: 'participantPilots' }, { actor: empty, targets: [mega] })).toEqual([pilot, empty]);
    expect(recipients({ to: 'participantPilots' }, { actor: empty, targets: [] })).toEqual([]);
  });

  test('each recipient picks a Skill and rolls; any failure (or a cancelled pick) runs onAnyFailed with the names', async () => {
    const { pilot, empty, mega } = megaformWithPilots();
    const item = withRules(empty, [], { name: 'Finisher' });
    const step = { do: 'rollEach', to: 'participantPilots', skills: ['might', 'athletics'], dif: 15, prompt: '{name}: which?',
      onAllSucceeded: [{ do: 'chat', text: 'ready' }], onAnyFailed: [{ do: 'chat', text: 'failed: {var.failedNames}' }] };
    chooseSelect.mockResolvedValue('might');
    rollTest.mockResolvedValue({ success: true });
    let ctx = stepContext({ actor: empty, item, rule: {}, targets: [mega] });
    expect(await runSteps([step], ctx)).toBe(true);
    expect(ctx.chat).toEqual(['ready']);
    expect(chooseSelect).toHaveBeenCalledWith('Finisher', 'Pilot: which?', [{ value: 'might', label: 'Might' }, { value: 'athletics', label: 'Athletics' }]);
    expect(rollTest.mock.calls.map(call => [call[0].name, call[1], call[2]])).toEqual([['Pilot', 'might', 15], ['Empty', 'might', 15]]);
    chooseSelect.mockReset();
    chooseSelect.mockResolvedValueOnce('might').mockResolvedValueOnce(null);
    ctx = stepContext({ actor: empty, item, rule: {}, targets: [mega] });
    await runSteps([step], ctx);
    expect(ctx.chat).toEqual(['failed: Empty']);
    expect(ctx.vars.failures).toBe(1);
    expect(stepErrors([{ do: 'rollEach', dif: 10 }])).toHaveLength(1);
    expect(pilot).toBeTruthy();
  });
});

/* -------------------------------------------- */
/*  SkillDie                                     */
/* -------------------------------------------- */

describe('SkillDie', () => {
  test('self: a standing Edge on the actor\'s Initiative Skill; megaform: the best participant die, with Edge', () => {
    const rules = [{ type: 'SkillDie', skill: 'initiative', edge: true }, { type: 'SkillDie', scope: 'megaform', skill: 'initiative', bestOf: 'participants', edge: true }];
    const hq = makeActor('zord', 'HQ', { skills: { driving: { shift: 'd4', edge: false } }, initiative: { skill: 'driving' } });
    withRules(hq, rules, { type: 'feature' });
    const other = makeActor('zord', 'Other', { skills: { initiative: { shift: 'd8' } }, initiative: { skill: 'initiative' } });
    skillDieDerived(hq);
    expect(hq.system.skills.driving.edge).toBe(true);
    const mega = makeActor('megaform', 'Mega', { actors: { a: { uuid: hq.uuid }, b: { uuid: other.uuid } }, skills: { initiative: { shift: 'd20', edge: false } } });
    rebuildIndex(mega);
    skillDieDerived(mega);
    expect(mega.system.skills.initiative).toEqual({ shift: 'd8', edge: true });
    const plain = makeActor('megaform', 'Plain', { actors: { b: { uuid: other.uuid } }, skills: { initiative: { shift: 'd20', edge: false } } });
    rebuildIndex(plain);
    skillDieDerived(plain);
    expect(plain.system.skills.initiative).toEqual({ shift: 'd20', edge: false });
    expect(validateRule({ type: 'SkillDie', skill: 'initiative' })).toEqual(['changes nothing']);
    expect(validateRule({ type: 'SkillDie', skill: 'initiative', bestOf: 'participants' })).toHaveLength(1);
  });
});

/* -------------------------------------------- */
/*  megaformPilot reactor lookup                 */
/* -------------------------------------------- */

describe('megaformPilot', () => {
  const reaction = { type: 'Reaction', who: 'megaformPilot', attackOnly: true, outcome: 'hit', label: 'Snag it', cost: { resource: { path: 'system.powers.personal.value' }, amount: 1 }, steps: [{ do: 'chat', text: 'snagged {target}' }] };

  function card(attacker, target, success) {
    const store = {};
    return cardInfo({
      id: `m${nextId++}`, speaker: { actor: attacker.id }, content: '',
      flags: { essence20: { checkResults: [{ targetUuid: target.uuid, difficulty: 10, success }], isAttack: true } },
      rolls: [{ total: success ? 12 : 8, formula: '1d20', dice: [{ faces: 20, results: [{ result: 8, active: true }] }] }],
      getFlag: (scope, key) => store[key],
      async setFlag(scope, key, value) {
        store[key] = value;
      },
    });
  }

  test('the participant\'s rule is answered by the characters listing it, once each; never on a miss or when they can\'t pay', async () => {
    expect(REACTION_WHO).toContain('megaformPilot');
    expect(validateRule(reaction)).toEqual([]);
    const attacker = makeActor('npc', 'Foe', {}, { disposition: -1 });
    const zord = makeActor('zord', 'Shield Zord');
    addItem(zord, { name: 'Defender', type: 'megaformTrait', system: { type: 'defender', rules: [reaction] } });
    const second = makeActor('zord', 'Second');
    addItem(second, { name: 'Defender', type: 'megaformTrait', system: { type: 'defender', rules: [reaction] } });
    const pilot = makeActor('playerCharacter', 'Pilot', { actors: { a: { uuid: zord.uuid }, b: { uuid: second.uuid } } });
    const mega = makeActor('megaform', 'Mega', { actors: { a: { uuid: zord.uuid }, b: { uuid: second.uuid } } });
    // The Zord itself (on the canvas) never answers as a token.
    const offers = reactionOffers(card(attacker, mega, true), [zord]);
    expect(offers.map(offer => offer.actor)).toEqual([pilot]);
    expect(offers[0].other).toBe(attacker);
    expect(reactionOffers(card(attacker, mega, false), [])).toEqual([]);
    expect(reactionOffers(card(attacker, zord, true), [])).toEqual([]);
    const info = card(attacker, mega, true);
    expect(await pressReaction(info, reactionOffers(info, [])[0])).toBe(true);
    expect(pilot.system.powers.personal.value).toBe(0);
    expect(chatLines()).toContain('snagged Foe');
    expect(reactionOffers(card(attacker, mega, true), [])).toEqual([]);
  });

  test('a Megaform Trait with no rules of its own answers with its book twin\'s', () => {
    const attacker = makeActor('npc', 'Foe', {}, { disposition: -1 });
    const book = { uuid: 'Compendium.essence20.across_the_stars.Item.yx7xdDN9HGoYLQ5n', system: { rules: [reaction] } };
    items.set(book.uuid, book);
    const zord = makeActor('zord', 'Homebrew Zord');
    const trait = addItem(zord, { name: 'My Defender', type: 'megaformTrait', system: { type: 'defender' } });
    const pilot = makeActor('playerCharacter', 'Pilot', { actors: { a: { uuid: zord.uuid } } });
    const mega = makeActor('megaform', 'Mega', { actors: { a: { uuid: zord.uuid } } });
    const [offer] = reactionOffers(card(attacker, mega, true), []);
    expect(offer).toMatchObject({ actor: pilot, item: trait, rule: reaction });
    trait.system.type = 'coreBody';
    rebuildIndex(zord);
    expect(reactionOffers(card(attacker, mega, true), [])).toEqual([]);
  });
});
