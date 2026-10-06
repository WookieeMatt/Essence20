import { jest } from '@jest/globals';

/**
 * Round 11, group G engine pieces (module/rules/ext/g/): DialogSelect's per-option when / pay and optionsFrom, the
 * {switch.<prefix>} HitRider fill, pickEach and rule:firstCopy, the Hidden state (tags, hide step, brokeHiding),
 * postCard / CardButtons / buttonCount, rollVsAll and OnlyBest. The items converted on them are in conv11-slG11.test.js.
 */

const spend = jest.fn(async () => ({ blocked: false }));
jest.unstable_mockModule('./helpers/action-economy.mjs', () => ({ spend, setNextTurn: jest.fn(), getLedger: () => null, isTracking: () => true }));
const chooseSelect = jest.fn(async (title, prompt, options) => options[0]?.value ?? null);
jest.unstable_mockModule('./helpers/grants.mjs', () => ({ chooseSelect, rollTest: jest.fn(async () => ({ success: true })), chooseButtons: jest.fn() }));
jest.unstable_mockModule('./helpers/gm-relay.mjs', () => ({ needsGmRelay: () => false, relayToGm: jest.fn() }));

const { rebuildIndex } = await import('./index.mjs');
const { contextFor, evaluate } = await import('./predicate.mjs');
const { runSteps, stepContext, stepErrors } = await import('./steps.mjs');
const { validateRule } = await import('./types.mjs');
const { runApplyDialog, extDialogToggles, runDerived } = await import('../helpers/extensions.mjs');
await import('./ext/index.mjs');
const { fillSwitch, selectChoices, pickedValues } = await import('./ext/g/select.mjs');
const { copiesHold } = await import('./ext/g/picks.mjs');
const { isHidden, setHidden, fireBrokeHiding } = await import('./ext/g/hidden.mjs');
const { cardButtons, pressCardButton, decorateCardButtons } = await import('./ext/g/cards.mjs');
const { rolls, bestDefense } = await import('./ext/g/rolls.mjs');
const { onlyBestDerived } = await import('./ext/g/best.mjs');
const { hitRiderOnAttack } = await import('./ext/b/hit-rider.mjs');

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
const sourced = id => ({ core: { sourceId: `Compendium.essence20.test.Item.${id}` }, essence20: {} });

function actor(items = [], { name = 'Hero', type = 'playerCharacter', system = {}, flags = {} } = {}) {
  const made = {
    id: `a${nextId++}`, name, type, isOwner: true, statuses: new Set(), flags: { essence20: { ...flags } }, system: { level: 6, defenses: {}, ...system },
    async update(changes) {
      Object.entries(changes).forEach(([key, value]) => setPath(this, key, value));
    },
    testUserPermission: () => true,
  };
  made.uuid = `Actor.${made.id}`;
  made.getActiveTokens = () => [];
  made.items = { contents: items, get: id => made.items.contents.find(i => i.id == id), [Symbol.iterator]: () => made.items.contents[Symbol.iterator]() };
  items.forEach(i => (i.parent = made));
  rebuildIndex(made);
  byUuid.set(made.uuid, made);
  game.actors.contents.push(made);
  return made;
}

const defenses = (willpower, cleverness, extra = {}) => ({ defenses: { willpower: { total: willpower }, cleverness: { total: cleverness }, ...extra } });

function message(data) {
  const made = {
    ...data, flags: data.flags ?? {},
    async update(changes) {
      Object.entries(changes).forEach(([key, value]) => setPath(this, key, value));
    },
  };
  return made;
}

let posted = [];
beforeEach(() => {
  byUuid.clear();
  posted = [];
  global.game = {
    combat: null, user: { id: 'u', isGM: true, targets: new Set() }, users: { contents: [] },
    actors: { contents: [] }, i18n: { localize: k => k, format: k => k, has: () => false }, settings: { get: () => 3 },
  };
  global.canvas = { tokens: { placeables: [], setTargets: jest.fn() } };
  global.CONFIG = { E20: { damageTypes: { fire: 'Fire', cold: 'Cold', acid: 'Acid', sonic: 'Sonic', blunt: 'Blunt' }, skillToEssence: { infiltration: 'speed' } } };
  global.ChatMessage = {
    create: jest.fn(async data => {
      const made = message(data);
      posted.push(made);
      return made;
    }),
    getSpeaker: () => ({}),
  };
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn() } };
  global.fromUuidSync = uuid => byUuid.get(uuid) ?? null;
  global.foundry = { utils: { setProperty: setPath, getProperty: getPath } };
  spend.mockReset();
  spend.mockImplementation(async () => ({ blocked: false }));
  chooseSelect.mockClear();
});

/* -------------------------------------------- */
/*  DialogSelect extras                          */
/* -------------------------------------------- */

describe('DialogSelect: per-option when / pay, optionsFrom', () => {
  test('an option with a when is offered only while it holds; fewer than two options - no select', async () => {
    const hero = actor([withRules([{ type: 'DialogSelect', label: 'Pick', options: [{ label: 'None' }, { label: 'Up', upshift: 1, when: ['skill:athletics'] }] }])]);
    expect(extDialogToggles(hero, { rolledSkill: 'persuasion' }).filter(t => t.type == 'select')).toEqual([]);
    const [select] = extDialogToggles(hero, { rolledSkill: 'athletics' }).filter(t => t.type == 'select');
    expect(select.options).toEqual([{ value: '0', label: 'None' }, { value: '1', label: 'Up' }]);
    const options = { shiftUp: 0, ext: { [select.name]: '1' } };
    await runApplyDialog(hero, options, { rolledSkill: 'athletics' });
    expect(options.shiftUp).toBe(1);
  });

  test('optionsFrom: one option per picked value (this copy and the others, an old flag too), labelled, keyed and paid', async () => {
    const rule = {
      type: 'DialogSelect', label: 'Ammo', when: ['rule:firstCopy'], options: [{ label: 'Plain' }],
      optionsFrom: { picked: 'types', legacy: 'flags.essence20.oldTypes', copies: true, labels: 'damageType', key: 'ammo:{value}', pay: [{ do: 'spendAction', action: 'free' }] },
    };
    const first = withRules([rule], { flags: sourced('ammo') });
    first.flags.essence20.rules = { choices: { types: ['fire', 'cold'] } };
    const second = withRules([rule], { flags: sourced('ammo') });
    second.flags.essence20.oldTypes = ['acid', 'fire'];
    const zord = actor([first, second], { type: 'zord' });
    expect(pickedValues(first, rule.optionsFrom)).toEqual(['fire', 'cold', 'acid']);
    // Only the first copy shows a select (rule:firstCopy).
    const selects = extDialogToggles(zord, {}).filter(t => t.type == 'select');
    expect(selects).toHaveLength(1);
    expect(selects[0].options).toEqual([
      { value: '0', label: 'Plain' }, { value: 'v:fire', label: 'Fire' }, { value: 'v:cold', label: 'Cold' }, { value: 'v:acid', label: 'Acid' },
    ]);

    const chosen = { ext: { [selects[0].name]: 'v:cold' } };
    await runApplyDialog(zord, chosen, {});
    expect(spend).toHaveBeenCalledWith(zord, 'free', expect.anything());
    expect(chosen.ruleKeys).toEqual(['ammo:cold']);

    // The action can't be spent: the option doesn't apply.
    spend.mockImplementation(async () => ({ blocked: true }));
    const refused = { ext: { [selects[0].name]: 'v:fire' } };
    await runApplyDialog(zord, refused, {});
    expect(refused.ruleKeys).toBeUndefined();

    // The authored option: nothing to pay, nothing keyed.
    spend.mockClear();
    const plain = { ext: { [selects[0].name]: '0' } };
    await runApplyDialog(zord, plain, {});
    expect(spend).not.toHaveBeenCalled();
    expect(plain.ruleKeys).toBeUndefined();
  });

  test('no picks - no select; validation', () => {
    const rule = { type: 'DialogSelect', label: 'Ammo', options: [{ label: 'Plain' }], optionsFrom: { picked: 'types' } };
    const zord = actor([withRules([rule])], { type: 'zord' });
    expect(selectChoices({ rule, item: zord.items.contents[0], holder: zord })).toHaveLength(1);
    expect(extDialogToggles(zord, {}).filter(t => t.type == 'select')).toEqual([]);
    expect(validateRule(rule)).toEqual([]);
    expect(validateRule({ ...rule, optionsFrom: { key: 'x' } })).toContain('optionsFrom needs picked (the pick key)');
    expect(validateRule({ ...rule, options: [] })).toContain('optionsFrom needs at least one authored option (the first is the default)');
    expect(validateRule({ ...rule, options: [{ label: 'a', when: 'x' }] })).toContain('options[0].when must be a list of tags');
    expect(validateRule({ ...rule, optionsFrom: { picked: 'types', labels: 'x' } })).toContain('optionsFrom.labels must be damageType');
    expect(validateRule({ type: 'DialogSelect', options: [{ label: 'x' }] })).toEqual(['options must list at least two choices']);
  });

  test('{switch.<prefix>} - a HitRider option takes its damage type from the chosen option\'s key', () => {
    expect(fillSwitch('{switch.ammo}', ['other', 'ammo:sonic'])).toBe('sonic');
    expect(fillSwitch('{switch.ammo}', [])).toBe('');
    const effect = item({ type: 'weaponEffect', name: 'Missiles', system: { damageValue: 3, damageType: 'blunt' } });
    const zord = actor([effect, withRules([{ type: 'HitRider', label: 'Ammo', option: { damage: '@var.damage', damageType: '{switch.ammo}', key: 'ammo' } }])], { type: 'zord' });
    const tools = { damageBonusNote: jest.fn() };
    const hit = { damageValue: 3, damageType: 'blunt' };
    hitRiderOnAttack(zord, null, hit, { itemUuid: effect.uuid, switches: ['ammo:sonic'] }, tools);
    expect(hit.riderOptions).toEqual([expect.objectContaining({ key: 'ammo', label: 'Ammo', damageValue: 3, damageType: 'sonic' })]);
    const plain = { damageValue: 3, damageType: 'blunt' };
    hitRiderOnAttack(zord, null, plain, { itemUuid: effect.uuid, switches: [] }, tools);
    expect(plain.riderOptions).toBeUndefined();
  });
});

/* -------------------------------------------- */
/*  pickEach, rule:firstCopy                     */
/* -------------------------------------------- */

describe('pickEach and rule:firstCopy', () => {
  const step = { do: 'pickEach', key: 'types', count: 3, from: 'list', options: ['fire', 'cold', 'acid', 'sonic', 'blunt'], only: ['fire', 'cold', 'acid', 'sonic'], excludeCopies: true, prompt: 'Type {n} of 3', legacy: 'flags.essence20.oldTypes' };

  test('three different values one at a time, leaving out the other copies\' picks; @var.picked / pickedLabels', async () => {
    const old = item({ flags: { ...sourced('ammo'), essence20: { oldTypes: ['fire'] } } });
    const fresh = item({ flags: sourced('ammo') });
    const zord = actor([old, fresh], { type: 'zord' });
    expect(copiesHold(fresh, 'types', 'flags.essence20.oldTypes')).toEqual(['fire']);
    const asked = [];
    const ctx = { ...stepContext({ actor: zord, item: fresh, targets: [] }), askPick: async (s, options) => {
      asked.push({ n: s.n, values: options.map(o => o.value) });
      return options[0].value;
    } };
    expect(await runSteps([step], ctx)).toBe(true);
    expect(asked).toEqual([
      { n: 1, values: ['cold', 'acid', 'sonic'] }, { n: 2, values: ['acid', 'sonic'] }, { n: 3, values: ['sonic'] },
    ]);
    expect(fresh.flags.essence20.rules.choices.types).toEqual(['cold', 'acid', 'sonic']);
    expect(ctx.vars.pickedLabels).toBe('cold, acid, sonic');
  });

  test('running out ends early and keeps the picks; a cancelled pick keeps nothing and stops; the select prompt fills {n}', async () => {
    const other = item({ flags: sourced('ammo') });
    other.flags.essence20.rules = { choices: { types: ['fire', 'cold', 'acid'] } };
    const fresh = item({ flags: sourced('ammo') });
    actor([other, fresh], { type: 'zord' });
    await runSteps([step], stepContext({ actor: fresh.parent, item: fresh, targets: [] }));
    expect(chooseSelect).toHaveBeenCalledWith('Thing', 'Type 1 of 3', [{ value: 'sonic', label: 'sonic' }]);
    expect(fresh.flags.essence20.rules.choices.types).toEqual(['sonic']);

    const third = item({ flags: sourced('ammo') });
    actor([third], { type: 'zord' });
    const ctx = { ...stepContext({ actor: third.parent, item: third, targets: [] }), askPick: async (s, options) => (s.n == 2 ? null : options[0].value) };
    expect(await runSteps([step, { do: 'chat', text: 'after' }], ctx)).toBe(false);
    expect(third.flags.essence20.rules).toBeUndefined();
    expect(stepErrors([{ do: 'pickEach' }])).toEqual(['steps[0]: pickEach needs a key and from']);
  });

  test('rule:firstCopy holds for the first copy of a book item only (and for an item with no book source)', () => {
    const a = item({ flags: sourced('x') });
    const b = item({ flags: sourced('x') });
    const loose = item();
    const hero = actor([a, b, loose]);
    expect(evaluate(['rule:firstCopy'], contextFor({ self: hero, ruleItem: a }))).toBe(true);
    expect(evaluate(['rule:firstCopy'], contextFor({ self: hero, ruleItem: b }))).toBe(false);
    expect(evaluate(['rule:firstCopy'], contextFor({ self: hero, ruleItem: loose }))).toBe(true);
  });
});

/* -------------------------------------------- */
/*  Hidden                                       */
/* -------------------------------------------- */

describe('Hidden: tags, hide step, brokeHiding', () => {
  test('Hidden lasts for the scene it was set in; the hide step sets and ends it; self: / target:hidden', async () => {
    const sneak = actor();
    const foe = actor([], { name: 'Foe', flags: { o3Hidden: { epoch: 2 } } });
    expect(isHidden(foe)).toBe(false);
    await runSteps([{ do: 'hide' }], stepContext({ actor: sneak, targets: [] }));
    expect(sneak.flags.essence20.o3Hidden).toMatchObject({ epoch: 3 });
    expect(evaluate(['self:hidden', 'not:target:hidden'], contextFor({ self: sneak, other: foe }))).toBe(true);
    await runSteps([{ do: 'hide', value: false }], stepContext({ actor: sneak, targets: [] }));
    expect(isHidden(sneak)).toBe(false);
    await setHidden(sneak, true);
    expect(isHidden(sneak)).toBe(true);
  });

  test('brokeHiding Triggers get the attack\'s targets (once each) and @var.targets', async () => {
    const foe = actor([], { name: 'Foe' });
    const sneak = actor([withRules([{ type: 'Trigger', event: 'brokeHiding', when: ['var:targets>0'], steps: [{ do: 'chat', text: 'seen by {target} ({var.targets})' }] }])]);
    await fireBrokeHiding(sneak, [foe, foe]);
    expect(posted.map(m => m.content).join()).toContain('seen by Foe (1)');
    posted.length = 0;
    await fireBrokeHiding(sneak, []);
    expect(posted).toEqual([]);
  });
});

/* -------------------------------------------- */
/*  postCard, CardButtons, buttonCount           */
/* -------------------------------------------- */

describe('cards other items add buttons to', () => {
  test('postCard: the text and one button per CardButtons rule (each: target - one per target); pressing runs its steps', async () => {
    const a = actor([], { name: 'A' });
    const b = actor([], { name: 'B' });
    const hero = actor([
      withRules([{ type: 'CardButtons', card: 'shout', each: 'target', label: 'Scare {target}', steps: [{ do: 'chat', text: '{name} scares {target}' }] }], { name: 'Scare' }),
      withRules([{ type: 'CardButtons', card: 'shout', label: 'Wave', steps: [{ do: 'chat', text: 'waves' }] }]),
      withRules([{ type: 'CardButtons', card: 'other', label: 'No', steps: [{ do: 'chat', text: 'no' }] }]),
    ]);
    expect(cardButtons(hero, 'shout', [a, b]).map(button => button.label)).toEqual(['Scare A', 'Scare B', 'Wave']);
    await runSteps([{ do: 'postCard', key: 'shout', text: '{name} shouts' }], stepContext({ actor: hero, targets: [a, b] }));
    const card = posted[0];
    expect(card.content).toContain('Hero shouts');
    expect(card.content).toContain('data-e20-rule-buttons="2"');
    expect(await pressCardButton(card, 1)).toBe(true);
    expect(posted[1].content).toBe('Hero scares B');
    expect(validateRule({ type: 'CardButtons', card: 'x' })).toContain('needs steps');
    expect(stepErrors([{ do: 'postCard' }])).toEqual(['steps[0]: postCard needs a key or text']);
  });

  test('buttonCount: counts per button, check / max refuse with the message, @var.<key> reads it', async () => {
    const a = actor([], { name: 'A' });
    const b = actor([], { name: 'B' });
    const hero = actor([withRules([{ type: 'CardButtons', card: 'k', each: 'target', label: '{target}', steps: [
      { do: 'buttonCount', key: 'n', max: 2, check: true, message: 'Too many' },
      { do: 'buttonCount', key: 'n' },
      { do: 'chat', text: '{target} #{var.n}' },
    ] }])]);
    await runSteps([{ do: 'postCard', key: 'k' }], stepContext({ actor: hero, targets: [a, b] }));
    const card = posted[0];
    await pressCardButton(card, 0);
    await pressCardButton(card, 0);
    await pressCardButton(card, 0);
    await pressCardButton(card, 1);
    expect(posted.slice(1).map(m => m.content)).toEqual(['A #1', 'A #2', 'B #1']);
    expect(ui.notifications.warn).toHaveBeenCalledWith('Too many');
    expect(card.flags.essence20.ruleButtons.buttons.map(button => button.vars.n)).toEqual([2, 1]);

    // On a `button` step's card the counter lives on the card.
    const single = message({ flags: { essence20: { ruleButton: {} } } });
    const ctx = { ...stepContext({ actor: hero, targets: [] }), buttonMessage: single };
    await runSteps([{ do: 'buttonCount', key: 'used', add: 2 }], ctx);
    expect(single.flags.essence20.ruleButton.vars.used).toBe(2);
    expect(ctx.vars.used).toBe(2);
    expect(await runSteps([{ do: 'buttonCount', key: 'used' }], stepContext({ actor: hero, targets: [] }))).toBe(false);
    expect(stepErrors([{ do: 'buttonCount' }])).toEqual(['steps[0]: buttonCount needs a plain key']);
  });

  test('who may press; the decorator wires each button', async () => {
    const hero = actor([withRules([{ type: 'CardButtons', card: 'k', who: 'gm', label: 'GM only', steps: [{ do: 'chat', text: 'ran' }] }])]);
    await runSteps([{ do: 'postCard', key: 'k' }], stepContext({ actor: hero, targets: [] }));
    const card = posted[0];
    game.user.isGM = false;
    expect(await pressCardButton(card, 0)).toBe(false);
    game.user.isGM = true;
    const listeners = [];
    const button = { dataset: { e20RuleButtons: '0' }, disabled: true, addEventListener: (type, fn) => listeners.push(fn) };
    decorateCardButtons(card, { querySelectorAll: () => [button] });
    expect(button.disabled).toBe(false);
    await listeners[0]({ preventDefault: () => {} });
    expect(posted.at(-1).content).toBe('ran');
  });
});

/* -------------------------------------------- */
/*  rollVsAll                                    */
/* -------------------------------------------- */

describe('rollVsAll', () => {
  test('one roll against each recipient\'s best listed Defense; a success only when it meets them all', async () => {
    const hero = actor();
    const a = actor([], { name: 'A', system: defenses(12, 14) });
    const b = actor([], { name: 'B', system: defenses(16, 10) });
    expect(bestDefense(a, ['willpower', 'cleverness'])).toBe(14);
    rolls.total = jest.fn(async () => 15);
    const step = { do: 'rollVsAll', skill: 'infiltration', defense: ['willpower', 'cleverness'], onSuccess: [{ do: 'chat', text: 'unseen' }], onFail: [{ do: 'chat', text: 'seen {var.beaten}' }] };
    let ctx = stepContext({ actor: hero, targets: [a, b] });
    await runSteps([step], ctx);
    expect(ctx.chat).toEqual(['seen 1']);
    expect(rolls.total).toHaveBeenCalledTimes(1);
    rolls.total = jest.fn(async () => 16);
    ctx = stepContext({ actor: hero, targets: [a, b] });
    await runSteps([step], ctx);
    expect(ctx.chat).toEqual(['unseen']);
    expect(ctx.vars).toMatchObject({ rollTotal: 16, beaten: 2 });
  });

  test('a cancelled roll stops (or, cancelFails, fails); no recipients stops', async () => {
    const hero = actor();
    const a = actor([], { name: 'A', system: defenses(1, 1) });
    rolls.total = jest.fn(async () => null);
    const step = { do: 'rollVsAll', skill: 'infiltration', defense: 'willpower', to: 'target', onFail: [{ do: 'chat', text: 'missed' }] };
    let ctx = stepContext({ actor: hero, targets: [a] });
    expect(await runSteps([step], ctx)).toBe(false);
    ctx = stepContext({ actor: hero, targets: [a] });
    expect(await runSteps([{ ...step, cancelFails: true }], ctx)).toBe(true);
    expect(ctx.chat).toEqual(['missed']);
    expect(await runSteps([step], stepContext({ actor: hero, targets: [] }))).toBe(false);
    expect(stepErrors([{ do: 'rollVsAll', skill: 'x', defense: 'speed' }])).toHaveLength(1);
  });
});

/* -------------------------------------------- */
/*  OnlyBest                                     */
/* -------------------------------------------- */

describe('OnlyBest', () => {
  const rule = { type: 'OnlyBest', label: 'One plate', key: 'plate', defense: 'toughness', when: ['self:canTransform'], items: ['item:name~plate', 'not:item:data:flags.essence20.parentId'] };
  const plate = (value, extra = {}) => withRules([rule], { name: 'Plate', type: 'upgrade', system: { armorBonus: { defense: 'toughness', value } }, ...extra });

  test('every matching item but the best comes off the Defense, once per key, noted on the breakdown', () => {
    const bot = actor([plate(1), plate(3), plate(2), plate(5, { flags: { essence20: { parentId: 'x' } } })], { system: { canTransform: true, defenses: { toughness: { total: 20, string: '20' } } } });
    onlyBestDerived(bot);
    expect(bot.system.defenses.toughness).toEqual({ total: 17, string: '20 - 3 (One plate)' });
  });

  test('its when; one item - nothing; runs in the derived pass; validation', () => {
    const grounded = actor([plate(1), plate(3)], { system: { defenses: { toughness: { total: 20 } } } });
    onlyBestDerived(grounded);
    expect(grounded.system.defenses.toughness.total).toBe(20);
    const single = actor([plate(3)], { system: { canTransform: true, defenses: { toughness: { total: 20 } } } });
    runDerived(single);
    expect(single.system.defenses.toughness.total).toBe(20);
    const pair = actor([plate(2), plate(2)], { system: { canTransform: true, defenses: { toughness: { total: 20 } } } });
    runDerived(pair);
    expect(pair.system.defenses.toughness.total).toBe(18);
    expect(validateRule({ type: 'OnlyBest', defense: 'toughness', items: [] })).toContain('items must be a list of item tags');
  });
});
