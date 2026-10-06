import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Batch slF11 (docs/rules-batches/slF11.md): the five items group A left as code - Signature Finishing Move, Megaform
 * Advanced Signature Finishing Move, Emotional Strength, Mobile Headquarters (Megaform half) and Megaform Defender.
 * Each is loaded from its pack source and must do what the removed code did (zord1/megaform.mjs, zord1/emotions.mjs,
 * emotional-mastery.mjs's Anger trigger, pr1/jtt.mjs#mobileHqDerived, react/reactions.mjs's Megaform Defender).
 */

global.Hooks = { on: () => 0, once: () => 0, callAll: () => {} };

const chooseSelect = jest.fn();
const rollTest = jest.fn();
jest.unstable_mockModule('./helpers/grants.mjs', () => ({ chooseSelect, rollTest, chooseButtons: jest.fn(), findItems: jest.fn() }));

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));
const FILES = {
  sfm: 'bthitems/_source/Megaform_Signature_Finishing_Move_ETpLoMS5CLTbVONp.json',
  adv: 'bthitems/_source/Megaform_Advanced_Signature_Finishing_Move_ZTFvl0a1KvIyZ87f.json',
  strength: 'jttitems/_source/Emotional_Strength_BODEMNm0GIAsMMm0.json',
  mobileHq: 'jttitems/_source/Mobile_Headquarters_soCSwGBp0AZbEeZC.json',
  defender: 'atsitems/_source/Defender_yx7xdDN9HGoYLQ5n.json',
};

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
const docs = new Map();
const messages = new Map();
global.game = {
  combat: null, user: { id: 'u', isGM: true, targets: new Set() }, users: { activeGM: null, contents: [] },
  settings: { get: (scope, key) => clock[key] ?? 1, set: async () => {} },
  actors: { contents: actors, get: id => actors.find(actor => actor.id == id), [Symbol.iterator]: () => actors[Symbol.iterator]() },
  i18n: { localize: k => k, format: k => k, has: () => false },
  messages: { get: id => messages.get(id) ?? null },
};
global.canvas = undefined;
global.fromUuidSync = uuid => actors.find(actor => actor.uuid == uuid) ?? docs.get(uuid) ?? null;
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
  statusEffects: [{ id: 'frightened' }, { id: 'impaired' }, { id: 'prone' }],
};
global.foundry = {
  ...(global.foundry ?? {}),
  utils: { ...(global.foundry?.utils ?? {}), getProperty: getPath, setProperty: setPath, deepClone: value => JSON.parse(JSON.stringify(value)), escapeHTML: text => String(text) },
};

await import('./ext/index.mjs');
// The megaformPilot lookup registers once rules/reactions.mjs has loaded (lazily).
await (await import('./ext/f/reactors.mjs')).lookupReady;
const { rebuildIndex } = await import('./index.mjs');
const { validateRule } = await import('./types.mjs');
const { fireTriggers, fireItemAdded, runUse, useRulesOf, useAvailable } = await import('./triggers.mjs');
const { ruleDialogSwitches, applyRuleSwitches } = await import('./adapter.mjs');
const { reactionOffers, pressReaction } = await import('./reactions.mjs');
const { cardInfo } = await import('../helpers/extensions/react/core.mjs');
const { registrySnapshot } = await import('../helpers/extensions.mjs');
const watch = await import('./ext/f/watch.mjs');
const { hitMultiplierOnAttack } = await import('./ext/f/finisher.mjs');
const { skillDieDerived } = await import('./ext/f/skill-die.mjs');

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
  docs.set(item.uuid, item);
  return item;
}

function makeActor(type = 'playerCharacter', name = 'Ranger', system = {}, { disposition = 1 } = {}) {
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
  actors.push(actor);
  return actor;
}

function addItem(actor, data) {
  const item = asItem(data, actor);
  actor.items.contents.push(item);
  rebuildIndex(actor);
  return item;
}

function addPackItem(actor, file, extra = {}) {
  const doc = fromPack(file);
  return addItem(actor, {
    name: doc.name, type: doc.type, system: { ...JSON.parse(JSON.stringify(doc.system)), ...(extra.system ?? {}) }, flags: extra.flags ?? {},
    _stats: { compendiumSource: `Compendium.essence20.x.Item.${doc._id}` },
  });
}

const chatLines = () => global.ChatMessage.create.mock.calls.map(call => call[0].content).join(' | ');

beforeEach(() => {
  actors.length = 0;
  docs.clear();
  messages.clear();
  Object.assign(clock, { sceneClockScene: 1, sceneClockEncounter: 1, sceneClockMission: 1 });
  global.game.user.targets = new Set();
  global.ChatMessage.create.mockClear();
  chooseSelect.mockReset();
  rollTest.mockReset();
  jest.spyOn(Math, 'random').mockReturnValue(0.99);
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('every converted item\'s rules validate', () => {
  for (const file of Object.values(FILES)) {
    for (const rule of fromPack(file).system.rules) {
      expect([file, validateRule(rule)]).toEqual([file, []]);
    }
  }
});

test('the removed hand-written registrations are gone', () => {
  const uses = registrySnapshot().uses.map(use => use.id);
  for (const id of ['zord1Sfm', 'zord1AdvSfm', 'zord1EmotionalStrength']) {
    expect(uses).not.toContain(id);
  }
});

/* -------------------------------------------- */
/*  Signature Finishing Moves                    */
/* -------------------------------------------- */

const meleeAttack = mega => addItem(mega, { name: 'Saber Strike', type: 'weaponEffect', system: { classification: { style: 'melee' }, damageType: 'blunt', damageValue: 3 } });
const rangedAttack = mega => addItem(mega, { name: 'Cannon', type: 'weaponEffect', system: { classification: { style: 'projectile' }, damageType: 'blunt', damageValue: 3 } });
const tools = () => ({
  damageBonusNote: jest.fn((result, amount) => {
    result.damageValue += amount;
  }),
});
const switchesFor = (mega, item) => ruleDialogSwitches(mega, { item, isAttack: true, isMelee: item.system.classification.style == 'melee' });

function megazord(...participants) {
  return makeActor('megaform', 'Megazord', { actors: Object.fromEntries(participants.map((actor, i) => [`p${i}`, { uuid: actor.uuid }])) });
}

describe('Signature Finishing Move', () => {
  test('picks melee / ranged and a damage type when it lands, unless an older pick is there', async () => {
    const zord = makeActor('zord', 'Saber Zord');
    const feature = addPackItem(zord, FILES.sfm);
    chooseSelect.mockResolvedValueOnce('melee').mockResolvedValueOnce('fire');
    await fireItemAdded(zord, feature);
    expect(feature.flags.essence20.rules.choices).toEqual({ style: 'melee', damageType: 'fire' });
    // A copy picked before the conversion keeps its pick (zord1Finisher), and isn't asked.
    chooseSelect.mockClear();
    const old = addPackItem(makeActor('zord'), FILES.sfm, { flags: { essence20: { zord1Finisher: { style: 'ranged', damageType: 'sonic' } } } });
    await fireItemAdded(old.parent, old);
    expect(chooseSelect).not.toHaveBeenCalled();
    // The Use picks again.
    chooseSelect.mockResolvedValueOnce('ranged').mockResolvedValueOnce('sonic');
    await runUse(feature, async () => true);
    expect(feature.flags.essence20.rules.choices).toEqual({ style: 'ranged', damageType: 'sonic' });
  });

  test('a once-per-scene switch on the Megaform\'s attack of that style; ×4 damage of the picked type; the Reach line', async () => {
    const zord = makeActor('zord', 'Saber Zord');
    addPackItem(zord, FILES.sfm, { flags: { essence20: { rules: { choices: { style: 'melee', damageType: 'fire' } } } } });
    const mega = megazord(zord, makeActor('zord', 'Other'));
    const melee = meleeAttack(mega);
    expect(switchesFor(mega, rangedAttack(mega))).toEqual([]);
    const [toggle] = switchesFor(mega, melee);
    expect(toggle).toMatchObject({ label: 'Signature Finishing Move (×4 damage, once per scene)', type: 'checkbox', value: false });

    const options = { ext: { [toggle.name]: true } };
    await applyRuleSwitches(mega, options, { item: melee, isAttack: true, isMelee: true });
    expect(options.ruleKeys).toEqual(['signatureFinish']);
    expect(mega.flags.essence20.zord1SfmUsed).toEqual({ epoch: 1, window: 'scene', count: 1 });
    expect(switchesFor(mega, melee)).toEqual([]);

    const t = tools();
    const result = { damageValue: 3, damageType: 'blunt' };
    hitMultiplierOnAttack(mega, null, result, { switches: options.ruleKeys, itemUuid: melee.uuid, style: 'melee' }, t);
    expect(t.damageBonusNote).toHaveBeenCalledWith(result, 9, 'Megaform Signature Finishing Move');
    expect(result).toMatchObject({ damageValue: 12, damageType: 'fire' });
    // Without the switch, nothing.
    const plain = { damageValue: 3, damageType: 'blunt' };
    hitMultiplierOnAttack(mega, null, plain, { switches: [] }, t);
    expect(plain).toEqual({ damageValue: 3, damageType: 'blunt' });

    await fireTriggers(mega, 'afterRoll', { roll: { switches: ['signatureFinish'] }, outcome: 'success', facts: { results: [{ success: true }] } });
    expect(chatLines()).toContain('Reach ×3 / Range tripled for this attack.');

    // A new scene: offered again.
    clock.sceneClockScene = 2;
    expect(switchesFor(mega, melee)).toHaveLength(1);
  });

  test('no style picked yet: any attack', () => {
    const zord = makeActor('zord');
    addPackItem(zord, FILES.sfm);
    const mega = megazord(zord);
    expect(switchesFor(mega, rangedAttack(mega))).toHaveLength(1);
  });
});

describe('Megaform Advanced Signature Finishing Move', () => {
  function setup() {
    const pilot = makeActor('playerCharacter', 'Red');
    const zord = makeActor('zord', 'Tyranno', { actors: { d: { uuid: pilot.uuid, vehicleRole: 'driver' } } });
    addPackItem(zord, FILES.sfm, { flags: { essence20: { rules: { choices: { style: 'melee', damageType: 'fire' } } } } });
    const feature = addPackItem(zord, FILES.adv);
    const bare = makeActor('zord', 'Mastodon');
    const mega = megazord(zord, bare);
    return { pilot, zord, bare, feature, mega };
  }

  test('the Use: not in a Megaform - nothing; every pilot (or pilotless Zord) rolls DIF 15; all succeed - ready this scene; once a mission', async () => {
    const lone = makeActor('zord', 'Lone');
    const loneFeature = addPackItem(lone, FILES.adv);
    expect(await runUse(loneFeature, async () => true)).toContain('This Zord isn&#39;t part of a Megaform.');
    expect(rollTest).not.toHaveBeenCalled();

    const { feature, mega } = setup();
    chooseSelect.mockResolvedValue('might');
    rollTest.mockResolvedValue({ success: true });
    const line = await runUse(feature, async () => true);
    expect(rollTest.mock.calls.map(call => [call[0].name, call[1], call[2]])).toEqual([['Red', 'might', 15], ['Mastodon', 'might', 15]]);
    expect(chooseSelect.mock.calls[0][1]).toBe('E20.Zord1AdvSfmSkill');
    expect(line).toContain('Megazord is ready to unleash its Advanced Signature Finishing Move!');
    expect(mega.flags.essence20.zord1AdvSfmReady).toMatchObject({ window: 'scene', count: 1 });
    expect(mega.flags.essence20.zord1AdvSfmUsed).toMatchObject({ window: 'mission', count: 1 });
    rollTest.mockClear();
    expect(await runUse(feature, async () => true)).toContain('has been used today');
    expect(rollTest).not.toHaveBeenCalled();
  });

  test('one failure fizzles (and still spends the day\'s use)', async () => {
    const { feature, mega } = setup();
    chooseSelect.mockResolvedValue('might');
    rollTest.mockResolvedValueOnce({ success: true }).mockResolvedValueOnce({ success: false });
    expect(await runUse(feature, async () => true)).toContain('fizzles - Mastodon failed.');
    expect(mega.flags.essence20.zord1AdvSfmReady).toBeUndefined();
    expect(mega.flags.essence20.zord1AdvSfmUsed).toBeTruthy();
  });

  test('ready: a switch on by default; Edge against a target resisting the finisher\'s type; ticked, it is used up; ×5 of the SFM\'s type', async () => {
    const { mega } = setup();
    const melee = meleeAttack(mega);
    expect(switchesFor(mega, melee).filter(t => t.label.startsWith('Advanced'))).toEqual([]);
    mega.flags.essence20.zord1AdvSfmReady = { epoch: 1, window: 'scene', count: 1 };
    const [plainToggle] = switchesFor(mega, melee).filter(t => t.label.startsWith('Advanced'));
    expect(plainToggle).toMatchObject({ value: true });
    const foe = makeActor('npc', 'Foe', { resistances: { fire: true } });
    global.game.user.targets = new Set([{ actor: foe }]);
    const [edgeToggle] = switchesFor(mega, melee).filter(t => t.label.startsWith('Advanced'));
    expect(edgeToggle.name).not.toBe(plainToggle.name);
    const options = { ext: { [edgeToggle.name]: true } };
    await applyRuleSwitches(mega, options, { item: melee, isAttack: true, isMelee: true });
    expect(options.edge).toBe(true);
    expect(options.ruleKeys).toEqual(['advancedFinish']);
    expect(mega.flags.essence20.zord1AdvSfmReady).toBeUndefined();
    // A target without the Resistance: no Edge.
    mega.flags.essence20.zord1AdvSfmReady = { epoch: 1, window: 'scene', count: 1 };
    global.game.user.targets = new Set([{ actor: makeActor('npc', 'Plain') }]);
    const [noEdge] = switchesFor(mega, melee).filter(t => t.label.startsWith('Advanced'));
    const plainOptions = { ext: { [noEdge.name]: true } };
    await applyRuleSwitches(mega, plainOptions, { item: melee, isAttack: true, isMelee: true });
    expect(plainOptions.edge).toBeFalsy();

    const t = tools();
    const result = { damageValue: 3, damageType: 'blunt' };
    hitMultiplierOnAttack(mega, foe, result, { switches: ['advancedFinish'] }, t);
    expect(result).toMatchObject({ damageValue: 15, damageType: 'fire' });
    // Ticked with the plain finisher too: only ×5.
    const both = { damageValue: 3, damageType: 'blunt' };
    hitMultiplierOnAttack(mega, foe, both, { switches: ['advancedFinish', 'signatureFinish'] }, t);
    expect(both.damageValue).toBe(15);
  });
});

/* -------------------------------------------- */
/*  Emotional Strength                           */
/* -------------------------------------------- */

describe('Emotional Strength', () => {
  function holderWith(options, { disposition = 1, power = 1 } = {}) {
    const actor = makeActor('playerCharacter', 'Purple', { powers: { personal: { value: power, max: 6 } } }, { disposition });
    actor.flags.essence20.activeEmotionalMastery = options;
    addPackItem(actor, FILES.strength);
    return actor;
  }

  const power = actor => actor.system.powers.personal.value;

  test('Distress: their own Fumble - 1d2 Personal Power, once per encounter (shared flag)', async () => {
    const holder = holderWith(['distress']);
    await watch.rollSeen(holder, [{ success: false }], {}, { isFumble: true });
    expect(power(holder)).toBe(3);
    expect(holder.flags.essence20.emotionalStrengthUsedThisEncounter).toEqual({ epoch: 1, window: 'encounter', count: 1 });
    await watch.rollSeen(holder, [{ success: false }], {}, { isFumble: true });
    expect(power(holder)).toBe(3);
    clock.sceneClockEncounter = 2;
    await watch.rollSeen(holder, [{ success: false }], {}, { isFumble: true });
    expect(power(holder)).toBe(5);
  });

  test('a use already counted by the old code (the same flag) blocks it', async () => {
    const holder = holderWith(['distress']);
    holder.flags.essence20.emotionalStrengthUsedThisEncounter = { epoch: 1, window: 'encounter', count: 1 };
    await watch.rollSeen(holder, [{ success: false }], {}, { isFumble: true });
    expect(power(holder)).toBe(1);
  });

  test('Contempt fires on an enemy Critical Success, Joy on an ally\'s, Disgust on an ally\'s Fumble - off the canvas', async () => {
    const holder = holderWith(['contempt']);
    const ally = makeActor('playerCharacter', 'Ally', {}, { disposition: 1 });
    const enemy = makeActor('npc', 'Enemy', {}, { disposition: -1 });
    await watch.rollSeen(ally, [], {}, { isCrit: true });
    expect(power(holder)).toBe(1);
    await watch.rollSeen(enemy, [], {}, { isCrit: true });
    expect(power(holder)).toBe(3);

    const joyful = holderWith(['joy']);
    await watch.rollSeen(enemy, [], {}, { isCrit: true });
    await watch.rollSeen(joyful, [], {}, { isCrit: true });
    expect(power(joyful)).toBe(1);
    await watch.rollSeen(ally, [], {}, { isCrit: true });
    expect(power(joyful)).toBe(3);

    const disgusted = holderWith(['disgust']);
    await watch.rollSeen(ally, [{ success: false }], {}, { isFumble: true });
    expect(power(disgusted)).toBe(3);
  });

  test('an option that isn\'t active does nothing; a Team Spirit grant counts', async () => {
    const holder = holderWith(['fear']);
    await watch.rollSeen(holder, [{ success: false }], {}, { isFumble: true });
    expect(power(holder)).toBe(1);
    const lender = makeActor();
    lender.flags.essence20.activeEmotionalMastery = ['distress'];
    holder.flags.essence20.teamSpiritOption = { option: 'distress', casterUuid: lender.uuid };
    await watch.rollSeen(holder, [{ success: false }], {}, { isFumble: true });
    expect(power(holder)).toBe(3);
  });

  test('Shame: a failed roll with ↑1 or better; Shyness: a failed roll Lend Assistance helped', async () => {
    const shamed = holderWith(['shame']);
    watch.noteDialog(shamed, { shiftUp: 1 });
    await watch.rollSeen(shamed, [{ success: true }], {}, {});
    expect(power(shamed)).toBe(1);
    watch.noteDialog(shamed, { shiftUp: 1 });
    await watch.rollSeen(shamed, [{ success: false }], {}, {});
    expect(power(shamed)).toBe(3);

    const shy = holderWith(['shyness']);
    watch.noteDialog(shy, {});
    await watch.rollSeen(shy, [{ success: false }], {}, {});
    expect(power(shy)).toBe(1);
    shy.flags.essence20.pendingLendAssistanceShift = 1;
    watch.noteDialog(shy, {});
    await watch.rollSeen(shy, [{ success: false }], {}, {});
    expect(power(shy)).toBe(3);
  });

  test('Anger: taking damage', async () => {
    const holder = holderWith(['anger']);
    await fireTriggers(holder, 'takesDamage', { damage: { amount: 2, damageType: 'blunt' } });
    expect(power(holder)).toBe(3);
    expect(holder.flags.essence20.emotionalStrengthUsedThisEncounter).toBeTruthy();
  });

  test('Surprise: a d20 roll totalling exactly 2 or 25+', async () => {
    const holder = holderWith(['surprise']);
    await watch.rollMessage({ speaker: { actor: holder.id }, rolls: [{ total: 24, dice: [{ faces: 20 }] }] });
    expect(power(holder)).toBe(1);
    await watch.rollMessage({ speaker: { actor: holder.id }, rolls: [{ total: 2, dice: [{ faces: 20 }] }] });
    expect(power(holder)).toBe(3);
  });

  test('Fear: they gain Frightened or Impaired; Sadness: an ally gains any Condition', async () => {
    const scared = holderWith(['fear']);
    await watch.conditionSeen(scared, ['prone']);
    expect(power(scared)).toBe(1);
    await watch.conditionSeen(scared, ['impaired']);
    expect(power(scared)).toBe(3);

    const sad = holderWith(['sadness']);
    await watch.conditionSeen(sad, ['prone']);
    expect(power(sad)).toBe(1);
    const ally = makeActor('playerCharacter', 'Ally');
    await watch.conditionSeen(ally, ['notACondition']);
    expect(power(sad)).toBe(1);
    await watch.conditionSeen(ally, ['prone']);
    expect(power(sad)).toBe(3);
  });

  test('Guilt: part of a Group Test that fails', async () => {
    const holder = holderWith(['guilt']);
    await fireTriggers(holder, 'groupTestResult', { vars: { success: 1, successes: 2, participants: 2 } });
    expect(power(holder)).toBe(1);
    await fireTriggers(holder, 'groupTestResult', { vars: { success: 0, successes: 0, participants: 2 } });
    expect(power(holder)).toBe(3);
  });

  test('the Use claims an active option\'s trigger (Interest); not with none active, not once used', async () => {
    const holder = holderWith(['interest']);
    const item = holder.items.contents[0];
    const [{ rule, index }] = useRulesOf(item);
    expect(useAvailable(item, rule, index)).toBe(true);
    const line = await runUse(item, async () => true);
    expect(power(holder)).toBe(3);
    expect(line).toContain('Purple regains 2 Personal Power.');
    expect(useAvailable(item, rule, index)).toBe(false);
    const idle = holderWith([]);
    const idleItem = idle.items.contents[0];
    expect(useAvailable(idleItem, useRulesOf(idleItem)[0].rule, useRulesOf(idleItem)[0].index)).toBe(false);
  });
});

/* -------------------------------------------- */
/*  Mobile Headquarters                          */
/* -------------------------------------------- */

describe('Mobile Headquarters', () => {
  test('the holder\'s own Initiative Edge; its Megaform uses the best component Initiative, with Edge', () => {
    const ranger = makeActor('playerCharacter');
    const zord = makeActor('zord', 'HQ', { actors: { x: { uuid: ranger.uuid, vehicleRole: 'passenger' } }, skills: { initiative: { shift: 'd4', edge: false } }, initiative: { skill: 'initiative' } });
    addPackItem(zord, FILES.mobileHq);
    skillDieDerived(zord);
    expect(zord.system.skills.initiative.edge).toBe(true);

    const other = makeActor('zord', 'Other', { skills: { initiative: { shift: 'd8' } }, initiative: { skill: 'initiative' } });
    const mega = makeActor('megaform', 'Mega', { actors: { a: { uuid: zord.uuid }, b: { uuid: other.uuid } }, skills: { initiative: { shift: 'd20', edge: false } }, initiative: { skill: 'initiative' } });
    rebuildIndex(mega);
    skillDieDerived(mega);
    expect(mega.system.skills.initiative).toMatchObject({ shift: 'd8', edge: true });

    // Not the other allied vehicles' derived data (that stays at Initiative - pr1/jtt.mjs).
    const ally = makeActor('vehicle', 'Ally', { skills: { initiative: { edge: false } }, initiative: { skill: 'initiative' } });
    skillDieDerived(ally);
    expect(ally.system.skills.initiative.edge).toBe(false);
  });
});

/* -------------------------------------------- */
/*  Megaform Defender                            */
/* -------------------------------------------- */

describe('Megaform Defender', () => {
  function cardOn(attacker, target, success, total = 14) {
    const store = {};
    const message = {
      id: `m${nextId++}`, speaker: { actor: attacker.id }, content: '',
      flags: { essence20: { checkResults: [{ targetUuid: target.uuid, difficulty: 12, success }], isAttack: true } },
      rolls: [{ total, formula: '1d20 + 2', dice: [{ faces: 20, results: [{ result: total - 2, active: true }] }] }],
      getFlag: (scope, key) => store[key],
      async setFlag(scope, key, value) {
        store[key] = value;
      },
    };
    messages.set(message.id, message);
    return cardInfo(message);
  }

  function setup({ homebrew = false, power = 3 } = {}) {
    const attacker = makeActor('npc', 'Foe', {}, { disposition: -1 });
    const zord = makeActor('zord', 'Shield Zord');
    if (homebrew) {
      addItem(zord, { name: 'Shield Wall', type: 'megaformTrait', system: { type: 'defender' } });
      docs.set('Compendium.essence20.across_the_stars.Item.yx7xdDN9HGoYLQ5n', fromPack(FILES.defender));
    } else {
      addPackItem(zord, FILES.defender);
    }

    const pilot = makeActor('playerCharacter', 'Pilot', { actors: { a: { uuid: zord.uuid } }, powers: { personal: { value: power, max: 3 } } });
    const mega = megazord(zord, makeActor('zord', 'Other'));
    return { attacker, zord, pilot, mega };
  }

  test('offered to the participant\'s piloting Ranger on a hit against the Megaform - not a miss, not without Power', () => {
    const { attacker, pilot, mega } = setup();
    expect(reactionOffers(cardOn(attacker, mega, true), []).map(offer => offer.actor)).toEqual([pilot]);
    expect(reactionOffers(cardOn(attacker, mega, false, 8), [])).toEqual([]);
    const broke = setup({ power: 0 });
    expect(reactionOffers(cardOn(broke.attacker, broke.mega, true), [])).toEqual([]);
  });

  test('a homebrew Defender Trait works too', () => {
    const { attacker, pilot, mega } = setup({ homebrew: true });
    expect(reactionOffers(cardOn(attacker, mega, true), []).map(offer => offer.actor)).toEqual([pilot]);
  });

  test('pressed: 1 Personal Power, a late Snag; a lower d20 can turn the hit into a miss', async () => {
    const { attacker, pilot, mega } = setup();
    const OldRoll = global.Roll;
    global.Roll = class {
      async evaluate() {
        this.total = 3;
        return this;
      }
    };
    try {
      const info = cardOn(attacker, mega, true);
      const [offer] = reactionOffers(info, []);
      expect(offer.rule.label).toBe('Defender: Snag the attack (1 Personal Power)');
      expect(await pressReaction(info, offer)).toBe(true);
      expect(pilot.system.powers.personal.value).toBe(2);
      // 14 with a 12 on the d20; the extra d20 shows 3: 14 - 9 = 5 against 12.
      expect(chatLines()).toContain('CardNowMisses');
      expect(info.message.getFlag('essence20', 'reactNegated')).toEqual([mega.uuid]);
    } finally {
      global.Roll = OldRoll;
    }
  });
});
