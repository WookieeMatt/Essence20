import { jest } from '@jest/globals';

/**
 * Round 10, group C engine pieces (module/rules/ext/c/): each on its own, with plain doubles. The items converted on
 * them are tested in conv10-slC10.test.js.
 */

const spend = jest.fn(async () => ({ blocked: false }));
const setNextTurn = jest.fn(async () => true);
jest.unstable_mockModule('./mechanics/actions/action-economy.mjs', () => ({ spend, setNextTurn, getLedger: () => null, isTracking: () => true }));
const chooseSelect = jest.fn(async (title, prompt, options) => options[0]?.value ?? null);
jest.unstable_mockModule('./mechanics/resources/grants.mjs', () => ({ chooseSelect, rollTest: jest.fn(async () => ({ success: true })), chooseButtons: jest.fn() }));

const { rebuildIndex } = await import('./index.mjs');
const { linkedEntries } = await import('./links.mjs');
const { ruleRollSources, ruleDialogSwitches, ruleDerived } = await import('./adapter.mjs');
const { evaluateTag, contextFor } = await import('./predicate.mjs');
const { resolveValue } = await import('./formula.mjs');
const { runSteps, stepContext, stepErrors } = await import('./steps.mjs');
const { validateRule } = await import('./types.mjs');
const { runApplyDialog, runPreRoll, runPostRoll, extDialogToggles } = await import('../mechanics/item-hooks.mjs');
await import('./plugins/index.mjs');
const { lazy } = await import('./plugins/shared/lazy-helpers-and-targets.mjs');
const { carriedRules, markedTargetSources, negateRider, movedSince } = await import('./plugins/marks/rule-marks.mjs');
const { bonusDieOf, ask } = await import('./plugins/dialog/dialog-select.mjs');
const { lateDefenseAdjust } = await import('./plugins/combat/defense-modes.mjs');
const { looksLikeContingency, survivalSpecializationMatches, weaponIsType, meleeReach, attackRange } = await import('./plugins/tags/checks-and-refs.mjs');
const { ladderStep, ruleItemLadders } = await import('./plugins/effects/item-ladder.mjs');
const { ruleBrawnBonus } = await import('./plugins/effects/brawn-requirement.mjs');
const { endingThisTurn } = await import('./plugins/combat/blind-roll-end-expiring.mjs');
const { onMoveToken } = await import('./plugins/combat/reach.mjs');
const { ruleActionSkills, spendActionSkill } = await import('./plugins/rolls/action-skills.mjs');
const { availabilityDif } = await import('./plugins/picks/picked-item.mjs');

let nextId = 1;
const byUuid = new Map();
const getPath = (object, key) => key.split('.').reduce((o, k) => o?.[k], object);
function setPath(object, key, value) {
  const keys = key.split('.');
  const last = keys.pop();
  const at = keys.reduce((node, k) => (node[k] ??= {}), object);
  if (last.startsWith('-=')) {
    delete at[last.slice(2)];
  } else {
    at[last] = value;
  }
}

function item(data = {}) {
  const made = {
    id: `i${nextId++}`, name: 'Thing', type: 'perk', system: {}, ...data, flags: { essence20: {}, ...(data.flags ?? {}) },
    async update(changes) {
      Object.entries(changes).forEach(([key, value]) => setPath(this, key, value));
    },
  };
  made.uuid = `Item.${made.id}`;
  byUuid.set(made.uuid, made);
  return made;
}

const withRules = (rules, data = {}) => item({ ...data, system: { ...(data.system ?? {}), rules } });

function actor(items = [], { name = 'Hero', type = 'playerCharacter', system = {}, flags = {}, token = null } = {}) {
  const made = {
    id: `a${nextId++}`, name, type, isOwner: true, statuses: new Set(), flags: { essence20: { ...flags } }, system: { level: 6, ...system },
    getActiveTokens: () => (token ? [token] : []),
    async update(changes) {
      Object.entries(changes).forEach(([key, value]) => setPath(this, key, value));
    },
    getFlag(scope, key) {
      return getPath(this.flags?.[scope] ?? {}, key);
    },
    async setFlag(scope, key, value) {
      setPath(this, `flags.${scope}.${key}`, value);
    },
    async unsetFlag(scope, key) {
      delete this.flags?.[scope]?.[key];
    },
    effects: { filter: () => [] },
  };
  made.uuid = `Actor.${made.id}`;
  made.items = { contents: items, get: id => made.items.contents.find(i => i.id == id), [Symbol.iterator]: () => made.items.contents[Symbol.iterator]() };
  items.forEach(i => (i.parent = made));
  rebuildIndex(made);
  byUuid.set(made.uuid, made);
  game.actors.contents.push(made);
  return made;
}

const markOn = (target, key, setter, extra = {}) => setPath(target, `flags.essence20.ruleMarks.${key}`, { by: setter.uuid, until: null, stamp: null, ...extra });
const targets = (...list) => {
  game.user.targets = new Set(list.map(a => ({ actor: a })));
  game.user.targets.first = () => [...game.user.targets][0];
};

beforeEach(() => {
  byUuid.clear();
  global.game = {
    combat: null, user: { id: 'u', isGM: true, targets: new Set() }, users: { contents: [], filter: () => [], activeGM: { id: 'u' } },
    actors: { contents: [] }, i18n: { localize: k => k, format: k => k, has: () => false }, settings: { get: () => 1 },
  };
  game.user.targets.first = () => undefined;
  global.canvas = { tokens: { placeables: [] } };
  global.CONFIG = { E20: {
    skillShiftList: ['d12', 'd10', 'd8', 'd6', 'd4', 'd2', 'd20'],
    skillToEssence: { persuasion: 'social', science: 'smarts', athletics: 'strength', culture: 'smarts' },
    actorReach: { small: 2, common: 5, large: 5, huge: 10 },
    weaponRequirementShiftLadder: ['none', 'd2', 'd4', 'd6', 'd8', 'd10', 'd12', '2d8', '3d6'],
    availabilityDifficulties: { standard: 0, limited: 10, restricted: 15 },
  } };
  global.ChatMessage = { create: jest.fn(async data => data), getSpeaker: () => ({}) };
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn() } };
  global.fromUuidSync = uuid => byUuid.get(uuid) ?? null;
  global.fromUuid = async uuid => byUuid.get(uuid) ?? null;
  global.foundry = { ...(global.foundry ?? {}), utils: { ...(global.foundry?.utils ?? {}), setProperty: setPath, getProperty: getPath } };
  spend.mockClear();
  setNextTurn.mockClear();
});

/* -------------------------------------------- */
/*  Marks that carry rules                       */
/* -------------------------------------------- */

describe('scope marked / markedTarget', () => {
  test('a mark carries the setter\'s marked rules onto the marked creature, equipped or not, while it lasts', () => {
    const cage = withRules([{ type: 'RollModifier', label: 'Caged', scope: 'marked', mark: 'caged', downshift: 2, when: ['skill:brawn'] }], { type: 'gear', system: { equipped: false } });
    const captor = actor([cage]);
    const prisoner = actor();
    expect(ruleRollSources(prisoner, null, { rolledSkill: 'brawn' }).sources).toEqual([]);
    markOn(prisoner, 'caged', captor);
    expect(carriedRules(prisoner, 'RollModifier')).toHaveLength(1);
    expect(ruleRollSources(prisoner, null, { rolledSkill: 'brawn' }).sources).toEqual([expect.objectContaining({ label: 'Caged', shiftDown: 2 })]);
    // The setter itself never gets it, nor does a mark it set on itself.
    expect(ruleRollSources(captor, null, { rolledSkill: 'brawn' }).sources).toEqual([]);
    markOn(captor, 'caged', captor);
    expect(carriedRules(captor, 'RollModifier')).toEqual([]);
    // An expired mark carries nothing; another key carries nothing.
    markOn(prisoner, 'caged', captor, { until: 'scene', stamp: { epoch: 0 } });
    expect(linkedEntries(prisoner, 'RollModifier')).toEqual([]);
  });

  test('consumeFrom roller: the marked creature\'s roll uses the mark up', () => {
    const focus = withRules([{ type: 'RollModifier', label: 'Focus', scope: 'marked', mark: 'focus', snag: true, consumeMark: 'focus', consumeFrom: 'roller' }]);
    const setter = actor([focus]);
    const marked = actor();
    markOn(marked, 'focus', setter);
    expect(ruleRollSources(marked, null, { rolledSkill: 'brawn' }).consumes).toEqual([{ ext: 'rulesMark', actorUuid: marked.uuid, key: 'focus' }]);
  });

  test('markedTarget: rolls against the marked creature by anyone else', () => {
    const designator = withRules([{ type: 'RollModifier', label: 'Designated', scope: 'markedTarget', mark: 'designated', upshift: 2, when: ['skill:targeting'], consumeMark: 'designated' }]);
    const spotter = actor([designator]);
    const tank = actor();
    markOn(tank, 'designated', spotter);
    const gunner = actor();
    expect(markedTargetSources(gunner, tank, { rolledSkill: 'targeting' })).toMatchObject({
      sources: [{ label: 'Designated', shiftUp: 2 }], consumes: [{ ext: 'rulesMark', actorUuid: tank.uuid, key: 'designated' }],
    });
    expect(markedTargetSources(gunner, tank, { rolledSkill: 'might' }).sources).toEqual([]);
    expect(markedTargetSources(tank, tank, { rolledSkill: 'targeting' }).sources).toEqual([]);
    expect(validateRule({ type: 'RollModifier', scope: 'markedTarget', upshift: 1 })).toContain('scope markedTarget needs mark (the mark\'s key)');
    expect(validateRule({ type: 'RollModifier', mark: 'x', upshift: 1 })).toContain('mark only goes with scope marked or markedTarget');
  });

  test('a carried Trigger fires for the marked creature; holderRoll rolls as the setter', async () => {
    const rolls = [];
    const fire = withRules([{ type: 'Trigger', scope: 'marked', mark: 'burning', event: 'turnEnd', steps: [
      { do: 'holderRoll', skill: 'science', dif: '@actor.system.defenses.evasion.total', downshift: '@mark.burning', onFail: [{ do: 'unmark', key: 'burning', to: 'self' }] },
    ] }]);
    const setter = actor([fire]);
    setter._dice = { rollSkill: async dataset => (rolls.push(dataset), { success: false }) };
    const marked = actor([], { system: { defenses: { evasion: { total: 12 } } } });
    markOn(marked, 'burning', setter, { count: 1 });
    const { fireTriggers } = await import('./triggers.mjs');
    await fireTriggers(marked, 'turnEnd');
    expect(rolls).toEqual([expect.objectContaining({ skill: 'science', dif: '12', shiftDown: 1, edge: false })]);
    expect(marked.flags.essence20.ruleMarks.burning).toBeUndefined();
  });

  test('DamageModifier negate: a hit\'s damage is taken back to 0', () => {
    const soft = withRules([{ type: 'DamageModifier', direction: 'dealt', negate: true, label: 'Soft' }]);
    const brute = actor([soft]);
    const notes = [];
    negateRider(brute, actor(), { damageValue: 3 }, {}, { damageBonusNote: (result, amount, label) => notes.push([amount, label]) });
    expect(notes).toEqual([[-3, 'Soft']]);
    expect(validateRule({ type: 'DamageModifier', direction: 'dealt', negate: true })).toEqual([]);
    expect(validateRule({ type: 'DamageModifier', direction: 'taken', negate: true })).toEqual(['negate only applies to damage dealt']);
  });

  test('pickMarked, @marking, self:marking, markHere and movedSince', async () => {
    const setter = actor([withRules([{ type: 'Use', steps: [] }])]);
    const one = actor([], { name: 'One' });
    const two = actor([], { name: 'Two' });
    markOn(one, 'caged', setter);
    markOn(two, 'caged', setter);
    expect(resolveValue('@marking.caged', { actor: setter })).toBe(2);
    expect(evaluateTag('self:marking:caged', contextFor({ self: setter }))).toBe(true);
    expect(evaluateTag('self:marking:caged', contextFor({ self: one }))).toBe(false);
    const ctx = stepContext({ actor: setter, item: setter.items.contents[0], targets: [] });
    ctx.askPick = async (step, options) => options[1].value;
    await runSteps([{ do: 'pickMarked', key: 'caged' }], ctx);
    expect(ctx.targets).toEqual([two]);

    let center = { x: 0, y: 0 };
    const mover = actor([], { token: { get center() {
      return center;
    } } });
    await runSteps([{ do: 'markHere', key: 'spot' }], stepContext({ actor: mover, item: {}, targets: [] }));
    center = { x: 3, y: 4 };
    expect(movedSince(mover, 'spot')).toBe(5);
    expect(evaluateTag('self:movedSince:spot<10', contextFor({ self: mover }))).toBe(true);
    expect(evaluateTag('self:movedSince:spot>=10', contextFor({ self: mover }))).toBe(false);
    expect(stepErrors([{ do: 'pickMarked' }, { do: 'markHere' }])).toHaveLength(2);
  });

  test('target:ruleHolder and self:allyOfHolder', () => {
    const tok = disposition => ({ document: { disposition } });
    const holder = actor([withRules([{ type: 'Use', steps: [] }])], { token: tok(1) });
    const ruleItem = holder.items.contents[0];
    expect(evaluateTag('target:ruleHolder', contextFor({ self: actor(), other: holder, ruleItem }))).toBe(true);
    expect(evaluateTag('target:ruleHolder', contextFor({ self: actor(), other: actor(), ruleItem }))).toBe(false);
    expect(evaluateTag('self:allyOfHolder', contextFor({ self: actor([], { token: tok(1) }), ruleItem }))).toBe(true);
    expect(evaluateTag('self:allyOfHolder', contextFor({ self: actor([], { token: tok(-1) }), ruleItem }))).toBe(false);
    expect(evaluateTag('self:allyOfHolder', contextFor({ self: holder, ruleItem }))).toBe(false);
  });
});

/* -------------------------------------------- */
/*  Dialog pieces                                */
/* -------------------------------------------- */

describe('dialog pieces', () => {
  test('incoming DialogSwitch: on the roller\'s dialog from a targeted holder, never remembered; its key reaches the holder\'s Defense', async () => {
    const holder = actor([withRules([
      { type: 'DialogSwitch', scope: 'incoming', label: 'Detect {holder}', downshift: 2, key: 'spotted', defaultWhen: ['skill:alertness'] },
      { type: 'Defense', defense: 'cleverness', mode: 'addAfter', amount: 3, when: ['roll:incoming:spotted'] },
    ])], { name: 'Snake' });
    const roller = actor();
    expect(extDialogToggles(roller, { rolledSkill: 'alertness' }).filter(t => /Detect/.test(t.label))).toEqual([]);
    targets(holder);
    const [toggle] = extDialogToggles(roller, { rolledSkill: 'alertness' }).filter(t => /Detect/.test(t.label));
    expect(toggle).toMatchObject({ label: 'Detect Snake', value: true });
    expect(extDialogToggles(roller, { rolledSkill: 'culture' }).find(t => /Detect/.test(t.label)).value).toBe(false);
    const options = { shiftDown: 0, ext: { [toggle.name]: true } };
    await runApplyDialog(roller, options, { rolledSkill: 'alertness' });
    expect(options).toMatchObject({ shiftDown: 2, ruleKeys: ['spotted'] });
    expect(lateDefenseAdjust(roller, holder, 'cleverness', { ext: options.ext })).toBe(3);
    expect(lateDefenseAdjust(roller, holder, 'cleverness', { ext: {} })).toBe(0);
  });

  test('DialogSelect: a select of alternatives, the chosen one applies', async () => {
    const holder = actor([withRules([{ type: 'DialogSelect', label: 'Pick', options: [{ label: 'None' }, { label: 'Down', downshift: 1 }, { label: 'Snag', snag: true }] }])]);
    const [select] = extDialogToggles(holder, { rolledSkill: 'persuasion' }).filter(t => t.type == 'select');
    expect(select.options.map(o => o.label)).toEqual(['None', 'Down', 'Snag']);
    const options = { shiftDown: 0, ext: { [select.name]: '2' } };
    await runApplyDialog(holder, options, { rolledSkill: 'persuasion' });
    expect(options.snag).toBe(true);
    expect(validateRule({ type: 'DialogSelect', options: [{ label: 'x' }] })).toEqual(['options must list at least two choices']);
  });

  test('DialogSwitch ignoreDownshift, specializeWhen and bonusDie; RollModifier bonus and forget', async () => {
    const holder = actor([withRules([
      { type: 'DialogSwitch', label: 'Ignore', ignoreDownshift: 1, forget: true },
      { type: 'DialogSwitch', label: 'Spec', upshift: 1, specializeWhen: ['skill:persuasion'] },
      { type: 'DialogSwitch', label: 'Die', bonusDie: { dice: ['d2', 'd4'], index: 'min(1, floor(@level / 5))' } },
      { type: 'RollModifier', label: 'Flat', bonus: 2, when: ['skill:persuasion'] },
      { type: 'RollModifier', label: 'Asked', upshift: 1, forget: true, when: ['ask:situation'] },
    ])]);
    holder.flags.essence20.ruleSwitches = Object.fromEntries(ruleDialogSwitches(holder, { rolledSkill: 'persuasion' }).map(s => [s.name, true]));
    const switches = ruleDialogSwitches(holder, { rolledSkill: 'persuasion' });
    expect(switches.find(s => s.label == 'Asked').value).toBe(false);
    expect(switches.find(s => s.label == 'Ignore').value).toBe(false);
    const ext = Object.fromEntries(switches.filter(s => s.label != 'Asked').map(s => [s.name, true]));
    const options = { shiftDown: 2, shiftUp: 0, ext };
    await runApplyDialog(holder, options, { rolledSkill: 'persuasion' });
    expect(options).toMatchObject({ shiftDown: 1, isSpecialized: true, extBonusPoolDie: 'd4', skillEffectModifierBonus: 2 });
    expect(bonusDieOf('d6')).toBe('d6');
    expect(validateRule({ type: 'DialogSwitch', bonusDie: 'x' })).toContain('bonusDie must be a die (d4) or {dice: [...], index: formula}');
    expect(validateRule({ type: 'RollModifier', bonus: 1 })).toEqual([]);
  });

  test('SkillSubstitution ask: the rolled Skill or one of the options, before the dialog', async () => {
    const holder = actor([withRules([{ type: 'SkillSubstitution', from: 'athletics', mode: 'ask', options: ['science'], when: ['roll:dataset:requisition'] }])]);
    ask.skill = jest.fn(async () => 'science');
    const dataset = { skill: 'athletics', requisition: true };
    await runPreRoll(holder, dataset, null);
    expect(dataset).toMatchObject({ skill: 'science', essence: 'smarts' });
    expect(ask.skill).toHaveBeenCalledWith('Thing', '', ['athletics', 'science']);
    const plain = { skill: 'athletics' };
    await runPreRoll(holder, plain, null);
    expect(plain.skill).toBe('athletics');
    expect(validateRule({ type: 'SkillSubstitution', from: 'athletics', mode: 'ask' })).toEqual(['ask needs options (the Skills offered)']);
  });

  test('BeforeRoll: steps before the dialog (scope item: on the rolled item), and cancel', async () => {
    const effect = withRules([{ type: 'BeforeRoll', scope: 'item', steps: [{ do: 'warn', text: 'Careful, {name}' }, { do: 'chat', text: 'paid' }] }], { type: 'weaponEffect' });
    const holder = actor([withRules([{ type: 'BeforeRoll', cancel: true, message: 'No, {name}', when: ['skill:culture'] }]), effect], { name: 'Hero' });
    const dataset = { skill: 'athletics' };
    await runPreRoll(holder, dataset, effect);
    expect(ui.notifications.warn).toHaveBeenCalledWith('Careful, Hero');
    expect(dataset.cancelRoll).toBeUndefined();
    const refused = { skill: 'culture' };
    await runPreRoll(holder, refused, null);
    expect(refused.cancelRoll).toBe(true);
    expect(validateRule({ type: 'BeforeRoll' })).toEqual(['needs steps or cancel']);
  });

  test('clearTargets and roll:plainReach', async () => {
    const setTargets = jest.fn();
    canvas.tokens.setTargets = setTargets;
    targets(actor());
    await runSteps([{ do: 'clearTargets' }], stepContext({ actor: actor(), item: {}, targets: [] }));
    expect(setTargets).toHaveBeenCalledWith([]);
    const roller = actor([], { system: { size: 'common' } });
    const melee = extra => ({ type: 'weaponEffect', system: { classification: { style: 'melee' }, range: {}, ...extra } });
    expect(evaluateTag('roll:plainReach', contextFor({ item: melee({ totalReach: 5 }), roller }))).toBe(true);
    expect(evaluateTag('roll:plainReach', contextFor({ item: melee({ totalReach: 10 }), roller }))).toBe(false);
    expect(evaluateTag('roll:plainReach', contextFor({ item: melee({ range: { reachMultiplier: 2 } }), roller }))).toBe(false);
  });
});

/* -------------------------------------------- */
/*  Defenses                                     */
/* -------------------------------------------- */

describe('Defense addAfter / instead; grantNextTurn', () => {
  test('addAfter sums by stack group (the biggest of a group); instead uses another Defense\'s total; outgoing too', () => {
    const defender = actor([withRules([
      { type: 'Defense', defense: 'toughness', mode: 'addAfter', amount: 2, stack: 'g' },
      { type: 'Defense', defense: 'toughness', mode: 'addAfter', amount: 1, stack: 'g' },
      { type: 'Defense', defense: 'toughness', mode: 'addAfter', amount: 1 },
      { type: 'Defense', defense: 'evasion', mode: 'instead', from: ['willpower'] },
    ])], { system: { defenses: { evasion: { total: 10 }, willpower: { total: 14 }, toughness: { total: 12 } } } });
    expect(lateDefenseAdjust(actor(), defender, 'toughness', {})).toBe(3);
    expect(lateDefenseAdjust(actor(), defender, 'evasion', {})).toBe(4);
    const attacker = actor([withRules([{ type: 'Defense', defense: 'toughness', mode: 'instead', from: ['evasion'], outgoing: true }])]);
    const plain = actor([], { system: { defenses: { evasion: { total: 9 }, toughness: { total: 15 } } } });
    expect(lateDefenseAdjust(attacker, plain, 'toughness', {})).toBe(-6);
    // Never on the sheet.
    plain.system.defenses.toughness.string = '15';
    ruleDerived(defender);
    expect(defender.system.defenses.toughness.total).toBe(12);
    expect(validateRule({ type: 'Defense', defense: 'evasion', mode: 'instead' })).toContain('instead needs from (the one Defense to use)');
  });

  test('grantNextTurn: actions on the recipients\' next turn', async () => {
    const ally = actor();
    await runSteps([{ do: 'grantNextTurn', free: '1 + 1', to: 'target' }], stepContext({ actor: actor(), item: { name: 'Stand Tall' }, targets: [ally] }));
    expect(setNextTurn).toHaveBeenCalledWith(ally, { grant: { free: 2 } }, 'Stand Tall');
    expect(stepErrors([{ do: 'grantNextTurn' }])).toEqual(['steps[0]: grantNextTurn needs free, move or standard']);
  });
});

/* -------------------------------------------- */
/*  Tags, checks and refs                        */
/* -------------------------------------------- */

describe('tags, checks and refs', () => {
  test('checks: angrySnag, contingencyLikely, survivalSpecialization', () => {
    const angry = actor();
    lazy.angrySnagSkill = () => 'deception';
    expect(evaluateTag('check:angrySnag', contextFor({ self: angry, rolledSkill: 'deception' }))).toBe(true);
    expect(evaluateTag('check:angrySnag', contextFor({ self: angry, rolledSkill: 'culture' }))).toBe(false);
    lazy.getLedger = () => ({ log: [{ namedKey: 'contingency' }] });
    game.combat = { combatant: { actor: { id: 'other' } } };
    expect(looksLikeContingency(angry)).toBe(true);
    game.combat = null;
    expect(looksLikeContingency(angry)).toBe(false);
    const ranger = actor([], { system: { skills: { survival: { specializations: { a: { name: 'Arctic' } } } } } });
    lazy.getTerrain = () => null;
    lazy.getEnvironment = () => 'normal';
    expect(survivalSpecializationMatches(ranger)).toBeNull();
    lazy.getEnvironment = () => 'extremeCold';
    expect(survivalSpecializationMatches(ranger)).toBe(true);
    lazy.getTerrain = () => 'desert';
    lazy.getEnvironment = () => 'normal';
    expect(survivalSpecializationMatches(ranger)).toBe(false);
  });

  test('roll:save, roll:poisonSave, skill:of, roll:anyTarget', () => {
    const save = spec => ({ riderSpec: JSON.stringify({ kind: 'save', spec }) });
    expect(evaluateTag('roll:save', contextFor({ dataset: save({}) }))).toBe(true);
    expect(evaluateTag('roll:save', contextFor({ dataset: {} }))).toBe(false);
    expect(evaluateTag('roll:poisonSave', contextFor({ dataset: save({ status: 'poisoned' }) }))).toBe(true);
    expect(evaluateTag('roll:poisonSave', contextFor({ dataset: save({ title: 'Rockslide' }) }))).toBe(false);
    expect(evaluateTag('skill:of:social', contextFor({ rolledSkill: 'persuasion' }))).toBe(true);
    expect(evaluateTag('skill:of:social', contextFor({ rolledSkill: 'science' }))).toBe(false);
    targets(actor([], { system: { threatLevel: 1 } }), actor([], { system: { threatLevel: 9 } }));
    expect(evaluateTag('roll:anyTarget:target:threatVsLevel:>=0', contextFor({ self: actor() }))).toBe(true);
    expect(evaluateTag('roll:anyTarget:target:threatVsLevel:>5', contextFor({ self: actor() }))).toBe(false);
  });

  test('target:creature, target:tagStarts, target:threatVsLevel', () => {
    const self = actor([], { system: { level: 5 } });
    const dog = actor([], { name: 'Feral Dogs' });
    const agent = actor([], { name: 'Kevin', system: { creatureTags: 'strexcorp, human', threatLevel: 3 } });
    expect(evaluateTag('target:creature:dog|coyote', contextFor({ self, other: dog }))).toBe(true);
    expect(evaluateTag('target:creature:dog|coyote', contextFor({ self, other: agent }))).toBe(false);
    expect(evaluateTag('target:tagStarts:strex', contextFor({ self, other: agent }))).toBe(true);
    expect(evaluateTag('target:threatVsLevel:<0', contextFor({ self, other: agent }))).toBe(true);
    expect(evaluateTag('target:threatVsLevel:-2', contextFor({ self, other: agent }))).toBe(true);
    expect(evaluateTag('target:threatVsLevel:<0', contextFor({ self, other: dog }))).toBe(false);
  });

  test('item:weaponType (and flagOf:<_id>)', () => {
    const shotgun = item({ type: 'weapon', name: 'Combat Shotgun' });
    const blast = item({ type: 'weaponEffect', flags: { essence20: { parentId: shotgun.id } } });
    const perk = item({ name: 'Enthusiast', flags: { core: { sourceId: 'Compendium.x.Item.abcdefghijklmnop' }, essence20: { q2WeaponType: 'shotguns' } } });
    const owner = actor([shotgun, blast, perk]);
    expect(evaluateTag('item:weaponType:shotguns', contextFor({ self: owner, item: blast }))).toBe(true);
    expect(evaluateTag('item:weaponType:flagOf:abcdefghijklmnop', contextFor({ self: owner, item: blast }))).toBe(true);
    expect(evaluateTag('item:weaponType:grenades', contextFor({ self: owner, item: blast }))).toBe(false);
    expect(weaponIsType({ name: 'Bat', system: { traits: ['thrown'] } }, 'thrown')).toBe(true);
    expect(weaponIsType({ name: 'Pistol', system: { items: { a: { type: 'weaponEffect', numHands: 1 } } } }, 'oneHanded')).toBe(true);
  });

  test('refs: @rolled, @other, @reach, @altMode, @owned', () => {
    expect(resolveValue('@rolled.system.shiftDown', { rolled: { system: { shiftDown: 2 } } })).toBe(2);
    expect(resolveValue('@other.system.range.reachMultiplier', { otherItem: { system: { range: { reachMultiplier: 3 } } } })).toBe(3);
    const fist = item({ type: 'weaponEffect', system: { classification: { style: 'melee' }, totalReach: 10 } });
    const gun = item({ type: 'weaponEffect', system: { range: { long: 60 } } });
    const bot = actor([fist, gun, item({ flags: { core: { sourceId: 'Compendium.x.Item.zzzzzzzzzzzzzzzz' } } })], { system: { size: 'small' } });
    expect(resolveValue('@reach.size', { actor: bot })).toBe(2);
    expect(resolveValue('@reach.huge', { actor: bot })).toBe(10);
    expect(meleeReach(bot)).toBe(10);
    expect(attackRange(bot)).toBe(60);
    expect(resolveValue('@reach.melee + @reach.attack', { actor: bot })).toBe(70);
    expect(resolveValue('@owned.zzzzzzzzzzzzzzzz', { actor: bot })).toBe(1);
    const mode = item({ type: 'altMode', system: { altModeCrew: 4 } });
    const truck = actor([mode], { system: { isTransformed: true } });
    truck.system.altModeId = mode.id;
    expect(resolveValue('@altMode.system.altModeCrew', { actor: truck })).toBe(4);
    truck.system.isTransformed = false;
    expect(resolveValue('@altMode.system.altModeCrew', { actor: truck })).toBe(0);
  });

  test('ItemModifier values per item (@other); ItemLadder', () => {
    const claw = item({ type: 'weaponEffect', system: { totalReach: 2, range: { reachMultiplier: 2 } } });
    const holder = actor([withRules([{ type: 'ItemModifier', items: ['item:type:weaponEffect'], path: 'system.totalReach', op: 'max', value: '5 * @other.system.range.reachMultiplier' }]), claw]);
    ruleDerived(holder);
    expect(claw.system.totalReach).toBe(10);
    expect([ladderStep('d8', -2, 'd2'), ladderStep('d4', -2, 'd2'), ladderStep('d2', -2, 'd2'), ladderStep('none', -2, 'd2'), ladderStep('d6', 1)]).toEqual(['d4', 'd2', 'd2', 'none', 'd8']);
    const weapon = item({ type: 'weapon', system: { requirements: { shift: 'd10' } } });
    ruleItemLadders(actor([withRules([{ type: 'ItemLadder', items: ['item:type:weapon'], path: 'system.effectiveBrawnReq', from: 'system.requirements.shift', by: -2, floor: 'd2' }]), weapon]));
    expect(weapon.system.effectiveBrawnReq).toBe('d6');
  });

  test('BrawnRequirement: amounts add, a stack group counts once, ignore beats them all, carrying only when said', () => {
    const rule = extra => withRules([{ type: 'BrawnRequirement', ...extra }]);
    expect(ruleBrawnBonus(actor([rule({ amount: 2 }), rule({ amount: 1 })]))).toBe(3);
    expect(ruleBrawnBonus(actor([rule({ amount: 2, stack: 's' }), rule({ amount: 2, stack: 's' })]))).toBe(2);
    expect(ruleBrawnBonus(actor([rule({ amount: 2 }), rule({ ignore: true })]))).toBe(Infinity);
    expect(ruleBrawnBonus(actor([rule({ amount: 2 }), rule({ amount: 2, carrying: true })]), 'carrying')).toBe(2);
    expect(validateRule({ type: 'BrawnRequirement' })).toEqual(['give an amount or ignore']);
  });
});

/* -------------------------------------------- */
/*  Steps                                        */
/* -------------------------------------------- */

describe('steps', () => {
  test('blindRoll: a GM-only roll with the band its total reaches', async () => {
    const made = [];
    global.Roll = class {
      constructor(formula) {
        this.formula = formula;
      }

      async evaluate() {
        this.total = 4;
        made.push(this);
        return this;
      }

      async toMessage(data, options) {
        this.sent = { data, options };
      }
    };
    const ctx = stepContext({ actor: actor(), item: {}, targets: [] });
    await runSteps([{ do: 'blindRoll', formula: '1d6', flavor: '{formula}: {band}', rows: [{ min: 0, text: 'low' }, { min: 3, text: 'mid' }, { min: 6, text: 'high' }] }], ctx);
    expect(made[0].sent).toEqual({ data: expect.objectContaining({ flavor: '1d6: mid' }), options: { rollMode: 'blindroll' } });
    expect(ctx.vars.rolled).toBe(4);
    delete global.Roll;
  });

  test('endExpiring: what runs out at the end of this turn - offered on a card, or ended at once', async () => {
    const mark = { combatId: 'c', untilRound: 2, untilTurn: 0, by: 'Actor.other', kind: 'k' };
    const stuck = actor([], { flags: { riderMarks: [mark, { ...mark, untilRound: 3 }] } });
    game.combat = { id: 'c', round: 2, turn: 0 };
    expect(endingThisTurn(stuck).marks).toHaveLength(1);
    await runSteps([{ do: 'endExpiring', offer: true, to: 'self' }], stepContext({ actor: stuck, item: { name: 'Tenacity' }, targets: [] }));
    expect(ChatMessage.create.mock.calls[0][0].content).toContain('rulesEndExpiring');
    await runSteps([{ do: 'endExpiring', to: 'self' }], stepContext({ actor: stuck, item: {}, targets: [] }));
    expect(stuck.flags.essence20.riderMarks).toHaveLength(1);
  });

  test('spendActionOf: the recipients pay in a combat; nothing out of combat', async () => {
    const other = actor();
    await runSteps([{ do: 'spendActionOf', action: 'move', to: 'target' }], stepContext({ actor: actor(), item: {}, targets: [other] }));
    expect(spend).not.toHaveBeenCalled();
    game.combat = { id: 'c' };
    await runSteps([{ do: 'spendActionOf', action: 'move', to: 'target' }], stepContext({ actor: actor(), item: {}, targets: [other] }));
    expect(spend).toHaveBeenCalledWith(other, 'move', expect.anything());
  });

  test('ActionSkills: more Skills for the heal action while `when` holds and the limit lasts', async () => {
    const cook = actor([withRules([{ type: 'ActionSkills', action: 'heal', skills: ['culture'], limit: { per: 'mission' }, when: ['not:combat:exists'] }])]);
    expect(ruleActionSkills(cook, 'heal').map(entry => entry.skills)).toEqual([['culture']]);
    expect(ruleActionSkills(cook, 'heal', { combat: { id: 'c' } })).toEqual([]);
    await spendActionSkill(cook, 'heal', 'culture');
    expect(ruleActionSkills(cook, 'heal')).toEqual([]);
  });

  test('@availDif and rule:pickedItem read the picked item', () => {
    const gun = item({ type: 'weapon', name: 'Blaster', system: { availability: 'restricted' } });
    const kit = item({ type: 'gear', name: 'Limited Medical Kit', system: {} });
    actor([gun, kit]);
    const perk = item({ flags: { essence20: { rules: { choices: { victim: gun.uuid } } } } });
    expect(resolveValue('@availDif.victim', { item: perk })).toBe(15);
    expect(availabilityDif(kit)).toBe(10);
    expect(evaluateTag('rule:pickedItem:victim:item:type:weapon', contextFor({ ruleItem: perk }))).toBe(true);
    expect(evaluateTag('rule:pickedItem:victim:item:type:gear&item:word:kit', contextFor({ ruleItem: perk }))).toBe(false);
  });
});

/* -------------------------------------------- */
/*  Reach events and Lend Assistance             */
/* -------------------------------------------- */

describe('enemyEnteredReach, target:inRange, immune lendAssistance', () => {
  test('enemyEnteredReach fires once the move ends inside the melee Reach', async () => {
    canvas.grid = { size: 100, measurePath: ([a, b]) => ({ distance: Math.abs(b.x - a.x) / 20 }) };
    const token = { document: { disposition: 1 }, center: { x: 50, y: 50 } };
    const holder = actor([withRules([{ type: 'Trigger', event: 'enemyEnteredReach', steps: [{ do: 'chat', text: '{target} came close' }] }])], { token, system: { size: 'common' } });
    token.actor = holder;
    canvas.tokens.placeables = [token];
    game.combat = { id: 'c' };
    const foe = actor([], { name: 'Foe', token: { document: { disposition: -1 } } });
    await onMoveToken({ actor: foe }, { origin: { x: 900, y: 0 }, destination: { x: 100, y: 0 } });
    expect(ChatMessage.create.mock.calls[0][0].content).toContain('Foe came close');
    ChatMessage.create.mockClear();
    const friend = actor([], { token: { document: { disposition: 1 } } });
    await onMoveToken({ actor: friend }, { origin: { x: 900, y: 0 }, destination: { x: 100, y: 0 } });
    expect(ChatMessage.create).not.toHaveBeenCalled();
    const gun = item({ type: 'weaponEffect', system: { range: { long: 60 } } });
    const self = actor([gun], { token: { center: { x: 0, y: 0 } }, system: { size: 'common' } });
    const near = actor([], { token: { center: { x: 200, y: 0 } } });
    expect(evaluateTag('target:inRange:melee', contextFor({ self, other: near }))).toBe(false);
    expect(evaluateTag('target:inRange:attack', contextFor({ self, other: near }))).toBe(true);
    expect(evaluateTag('target:inRange:attack', contextFor({ self, other: actor() }))).toBe(false);
  });

  test('immune lendAssistance sets banked Lend Assistance aside for that roll', async () => {
    const holder = actor([withRules([{ type: 'RollModifier', immune: ['lendAssistance'], when: ['skill:athletics'] }])], { flags: { pendingLendAssistanceEdge: { skill: 'athletics' } } });
    await runPreRoll(holder, { skill: 'science' }, null);
    expect(holder.flags.essence20.pendingLendAssistanceEdge).toBeTruthy();
    await runPreRoll(holder, { skill: 'athletics' }, null);
    expect(holder.flags.essence20.pendingLendAssistanceEdge).toBeUndefined();
    await runPostRoll(holder, [], {}, {});
    expect(holder.flags.essence20.pendingLendAssistanceEdge).toEqual({ skill: 'athletics' });
    expect(validateRule({ type: 'RollModifier', immune: ['lendAssistance'] })).toEqual([]);
  });
});
