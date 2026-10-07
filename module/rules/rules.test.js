import { jest } from '@jest/globals';
import { formulaError, resolveValue } from './formula.mjs';
import { contextFor, evaluate, evaluateTag, interpolate, isStatic, unknownTags } from './predicate.mjs';
import { describeWhen, registerRuleType, summarizeRule, validateRule } from './types.mjs';
import { collectRules, isItemActive, rebuildIndex, ruleStacks, rulesIndex } from './index.mjs';
import {
  applyRuleSwitches, applySkillSubstitution, hostMatches, poolResets, ruleDamageDealt, ruleDamageTaken, ruleDefenseAdjust, ruleDerived,
  ruleDialogSwitches, ruleRerollGrants, ruleRollSources, ruleSpecializes,
} from './adapter.mjs';
import { choiceOptions, grantData, grantedBy, initialState } from './lifecycle.mjs';
import { ADD_CHOICES, SKELETONS, effectEntries, parseRulesJson, rulesContext } from './sheet.mjs';
import { registrySnapshot } from '../mechanics/item-hooks.mjs';

/* -------------------------------------------- */
/*  Doubles                                      */
/* -------------------------------------------- */

let nextId = 1;

function makeItem(rules, extra = {}) {
  return { id: `i${nextId++}`, name: extra.name ?? 'Test Item', type: extra.type ?? 'perk', flags: extra.flags ?? {}, system: { rules, ...(extra.system ?? {}) }, uuid: extra.uuid, isOwner: true, ...extra.top };
}

function makeActor(items = [], extra = {}) {
  const actor = {
    id: `a${nextId++}`,
    type: extra.type ?? 'playerCharacter',
    name: extra.name ?? 'Tester',
    statuses: new Set(extra.statuses ?? []),
    system: {
      level: 5,
      isMorphed: false,
      essences: { strength: { value: 3 }, speed: { value: 2 } },
      skills: { might: { shift: 'd6' }, finesse: { shift: 'd10' }, athletics: { shift: 'd4' } },
      health: { value: 10, max: 10, string: '10 (Base)' },
      defenses: {
        toughness: { total: 12, string: '12 (Base)' },
        evasion: { total: 11, string: '11 (Base)' },
        willpower: { total: 10, string: '10' },
        cleverness: { total: 10, string: '10' },
      },
      ...(extra.system ?? {}),
    },
  };
  actor.items = { contents: items, get: id => items.find(item => item.id == id) };
  for (const item of items) {
    item.parent = actor;
  }

  return actor;
}

beforeAll(() => {
  global.CONFIG = {
    E20: {
      skillShiftList: ['d20', 'd12', 'd10', 'd8', 'd6', 'd4', 'd2'],
      skillToEssence: { might: 'strength', finesse: 'speed', athletics: 'strength' },
      skills: { athletics: 'E20.SkillAthletics', might: 'E20.SkillMight' },
      essences: { any: 'E20.EssenceAny', strength: 'E20.EssenceStrength' },
      defenses: { toughness: 'E20.DefenseToughness' },
    },
  };
  global.game = { combat: null, user: { targets: new Set() }, i18n: { localize: key => key } };
  global.foundry = {
    ...(global.foundry ?? {}),
    utils: {
      ...(global.foundry?.utils ?? {}),
      deepClone: value => JSON.parse(JSON.stringify(value)),
      setProperty: (object, key, value) => {
        const keys = key.split('.');
        const last = keys.pop();
        keys.reduce((o, k) => (o[k] ??= {}), object)[last] = value;
      },
      getProperty: (object, key) => key.split('.').reduce((o, k) => o?.[k], object),
    },
  };
});

/* -------------------------------------------- */
/*  Formulas                                     */
/* -------------------------------------------- */

describe('formula', () => {
  const actor = { system: { level: 12, essences: { strength: { value: 4 } } } };
  const item = { flags: { essence20: { rules: { pools: { charge: { value: 2 } }, choices: { n: '3' } } } } };

  test('numbers and arithmetic', () => {
    expect(resolveValue(2)).toBe(2);
    expect(resolveValue('2 + 3 * 4')).toBe(14);
    expect(resolveValue('(2 + 3) * 4')).toBe(20);
    expect(resolveValue('-3 + 1')).toBe(-2);
    expect(resolveValue('7 / 0')).toBe(0);
  });

  test('references and functions', () => {
    expect(resolveValue('1 + floor(@level / 10)', { actor })).toBe(2);
    expect(resolveValue('max(@essence.strength, 2)', { actor })).toBe(4);
    expect(resolveValue('@pool.charge + @choice.n', { actor, item })).toBe(5);
    expect(resolveValue('min(1, 2, 3) + ceil(1.2) + abs(-1)')).toBe(4);
  });

  test('bad input falls back, and the validator says why', () => {
    expect(resolveValue('@nope + 1', {}, 7)).toBe(7);
    expect(resolveValue('', {}, 3)).toBe(3);
    expect(resolveValue(null)).toBe(0);
    expect(resolveValue(Infinity, {}, 1)).toBe(1);
    expect(formulaError('2 +')).toMatch(/end/);
    expect(formulaError('@nope')).toMatch(/Unknown reference/);
    expect(formulaError('sqrt(4)')).toMatch(/Unknown function/);
    expect(formulaError('1 $ 2')).toMatch(/Unexpected/);
    expect(formulaError('@level * 2')).toBeNull();
    expect(formulaError(3)).toBeNull();
  });
});

/* -------------------------------------------- */
/*  Predicates                                   */
/* -------------------------------------------- */

describe('predicate', () => {
  const self = makeActor([], { statuses: ['prone'], system: { isMorphed: true, level: 8, health: { value: 3, max: 10 } } });
  const other = makeActor([], { type: 'npc', statuses: ['stunned'], system: { creatureTags: 'robot, minion' } });
  const ruleItem = makeItem([], { flags: { essence20: { rules: { toggles: { stance: true }, choices: { skill: 'might' } } } } });
  const weapon = { id: 'w1', type: 'weaponEffect', system: { traits: ['fire'], classification: { style: 'melee' }, shape: 'circle' }, flags: {} };
  const ctx = contextFor({ self, other, ruleItem, item: weapon, rolledSkill: 'might', rolledEssence: 'strength', isAttack: true, isMelee: true, combat: { started: true, round: 2, combatant: { actor: self } } });

  test('roll tags', () => {
    expect(evaluateTag('skill:might', ctx)).toBe(true);
    expect(evaluateTag('essence:speed', ctx)).toBe(false);
    expect(evaluateTag('attack', ctx)).toBe(true);
    expect(evaluateTag('attack:melee', ctx)).toBe(true);
    expect(evaluateTag('attack:ranged', ctx)).toBe(false);
    expect(evaluateTag('attack:area', ctx)).toBe(true);
    expect(evaluateTag('attack:weird', ctx)).toBeNull();
    expect(evaluateTag('attack', { ...ctx, isAttack: false })).toBe(false);
    expect(evaluateTag('defense:toughness', { ...ctx, defenseType: 'toughness' })).toBe(true);
    expect(evaluateTag('roll:initiative', { ...ctx, rolledSkill: 'initiative' })).toBe(true);
    expect(evaluateTag('roll:specialized', { ...ctx, dataset: { isSpecialized: true } })).toBe(true);
    expect(evaluateTag('roll:other', ctx)).toBeNull();
  });

  test('item tags', () => {
    expect(evaluateTag('item:type:weaponEffect', ctx)).toBe(true);
    expect(evaluateTag('item:trait:Fire', ctx)).toBe(true);
    expect(evaluateTag('item:source:x', ctx)).toBe(false);
    expect(evaluateTag('item:equipped', ctx)).toBe(true);
    expect(evaluateTag('item:what', ctx)).toBeNull();
  });

  test('self and target tags', () => {
    expect(evaluateTag('self:morphed', ctx)).toBe(true);
    expect(evaluateTag('self:transformed', ctx)).toBe(false);
    expect(evaluateTag('self:status:prone', ctx)).toBe(true);
    expect(evaluateTag('self:level>=8', ctx)).toBe(true);
    expect(evaluateTag('self:level<8', ctx)).toBe(false);
    expect(evaluateTag('self:hp<half', ctx)).toBe(true);
    expect(evaluateTag('self:toggle:stance', ctx)).toBe(true);
    expect(evaluateTag('self:type:playerCharacter', ctx)).toBe(true);
    expect(evaluateTag('self:hasItem:Compendium.x', ctx)).toBe(false);
    expect(evaluateTag('self:mystery', ctx)).toBeNull();
    expect(evaluateTag('target:status:stunned', ctx)).toBe(true);
    expect(evaluateTag('target:tag:robot', ctx)).toBe(true);
    expect(evaluateTag('target:type:npc', ctx)).toBe(true);
    expect(evaluateTag('target:tag:robot', { ...ctx, other: null })).toBe(false);
  });

  test('situation, ask and negation', () => {
    expect(evaluateTag('combat', ctx)).toBe(true);
    expect(evaluateTag('combat:round:2', ctx)).toBe(true);
    expect(evaluateTag('combat:other', ctx)).toBeNull();
    expect(evaluateTag('ownTurn', ctx)).toBe(true);
    expect(evaluateTag('ask:protecting someone', ctx)).toBeNull();
    expect(evaluateTag('not:skill:might', ctx)).toBe(false);
    expect(evaluateTag('not:ask:x', ctx)).toBeNull();
    expect(evaluateTag('', ctx)).toBe(true);
    expect(evaluateTag('bogus:thing', ctx)).toBeNull();
  });

  test('choice interpolation', () => {
    expect(interpolate('skill:{choice.skill}', ruleItem)).toBe('skill:might');
    expect(interpolate('skill:{choice.other}', ruleItem)).toBeNull();
    expect(evaluateTag('skill:{choice.skill}', ctx)).toBe(true);
    expect(evaluateTag('skill:{choice.other}', ctx)).toBe(false);
  });

  test('lists: false beats unknown, any-of, empty', () => {
    expect(evaluate(['skill:might', 'self:morphed'], ctx)).toBe(true);
    expect(evaluate(['skill:might', 'ask:x'], ctx)).toBeNull();
    expect(evaluate(['ask:x', 'skill:finesse'], ctx)).toBe(false);
    expect(evaluate([{ any: ['skill:finesse', 'skill:might'] }], ctx)).toBe(true);
    expect(evaluate([{ any: ['skill:finesse', 'ask:x'] }], ctx)).toBeNull();
    expect(evaluate([{ any: ['skill:finesse'] }], ctx)).toBe(false);
    expect(evaluate([], ctx)).toBe(true);
    expect(evaluate(undefined, ctx)).toBe(true);
  });

  test('static and unknown tags', () => {
    expect(isStatic(['self:morphed', { any: ['combat', 'not:self:status:prone'] }])).toBe(true);
    expect(isStatic(['skill:might'])).toBe(false);
    expect(isStatic(['item:equipped'])).toBe(true);
    expect(unknownTags(['skill:might', 'wat:x', { any: ['nope'] }, { all: [] }])).toEqual(['wat:x', 'nope', '{"all":[]}']);
  });
});

/* -------------------------------------------- */
/*  Types                                        */
/* -------------------------------------------- */

describe('types', () => {
  test('valid rules pass', () => {
    expect(validateRule({ type: 'RollModifier', when: ['skill:might'], upshift: 1 })).toEqual([]);
    expect(validateRule({ type: 'Defense', defense: 'toughness', amount: '@level' })).toEqual([]);
    expect(validateRule({ type: 'Reroll', mode: 'ones', cost: { amount: 1 } })).toEqual([]);
    // keepBetter (Backup Planner) and upTo (Power Infusion) - settings a Perk's own system.reroll had.
    expect(validateRule({ type: 'Reroll', mode: 'all', keepBetter: true, upTo: '@item.system.advances.currentValue' })).toEqual([]);
    expect(validateRule({ type: 'Reroll', keepBetter: 'yes', upTo: '1 +' })).toHaveLength(2);
    // Movement stage bonus (Fast): the type's bonus, before any total.
    expect(validateRule({ type: 'Movement', movement: 'ground', stage: 'bonus', op: 'add', value: 10 })).toEqual([]);
    expect(validateRule({ type: 'ChoiceSet', key: 'k', from: 'list', options: ['a'] })).toEqual([]);
    expect(validateRule({ type: 'Grant', uuid: 'Compendium.essence20.x.Item.y' })).toEqual([]);
  });

  test('problems are named', () => {
    expect(validateRule(null)).toEqual(['not a rule object']);
    expect(validateRule({ type: 'Aura' })[0]).toMatch(/not supported/);
    expect(validateRule({ type: 'RollModifier' })).toContain('changes nothing');
    expect(validateRule({ type: 'RollModifier', upshift: 1, when: 'skill:might' })).toContain('when must be a list');
    expect(validateRule({ type: 'RollModifier', upshift: 1, when: ['huh'] })).toContain('unknown tag "huh"');
    expect(validateRule({ type: 'Defense', defense: 'luck', amount: 1, scope: 'host' })).toEqual(expect.arrayContaining([
      expect.stringMatching(/scope/), expect.stringMatching(/defense must be one of/),
    ]));
    expect(validateRule({ type: 'Defense', defense: 'toughness' })).toContain('amount is required');
    expect(validateRule({ type: 'Defense', defense: 'toughness', amount: '2 +' })[0]).toMatch(/^amount:/);
    expect(validateRule({ type: 'DialogSwitch', edge: 'yes' })).toContain('edge must be true or false');
    expect(validateRule({ type: 'SkillSubstitution', from: 1, to: 'x' })).toContain('from must be text');
    expect(validateRule({ type: 'RollModifier', upshift: 1, colour: 'red' })).toContain('unknown setting "colour"');
    expect(validateRule({ type: 'DerivedStat', path: 'health.max', value: 1 })).toContain('path must start with "system."');
    expect(validateRule({ type: 'ChoiceSet', key: 'k', from: 'list' })).toContain('a list choice needs options');
    expect(validateRule({ type: 'Grant', uuid: 'nope' })[0]).toMatch(/uuid/);
    expect(validateRule({ type: 'DamageModifier', direction: 'taken' })).toContain('changes nothing');
  });

  test('summaries read in game words', () => {
    expect(summarizeRule({ type: 'RollModifier', when: ['skill:might', 'self:morphed'], upshift: 1 })).toBe('↑1 on Might tests, while you are Morphed');
    expect(summarizeRule({ type: 'RollModifier', scope: 'incoming', when: ['attack'], snag: true })).toBe('Rolls against you: Snag on attacks');
    expect(summarizeRule({ type: 'RollModifier', downshift: '@level', edge: true, specialize: true })).toBe('↓ equal to your level, Edge, Specialized');
    expect(summarizeRule({ type: 'DialogSwitch', label: 'Aim', upshift: 2 })).toBe('Roll option "Aim": ↑2');
    expect(summarizeRule({ type: 'Reroll', mode: 'ones', skills: ['might'], reset: 'scene' })).toBe('Reroll (ones) on Might, once per scene');
    expect(summarizeRule({ type: 'SkillSubstitution', from: 'might', to: 'finesse', mode: 'bestOf' })).toBe('Better of Finesse and Might');
    expect(summarizeRule({ type: 'Defense', defense: 'toughness', amount: 2 })).toBe('+2 Toughness');
    expect(summarizeRule({ type: 'Defense', defense: 'any', amount: -1 })).toBe('-1 every Defense');
    expect(summarizeRule({ type: 'DerivedStat', path: 'system.health.max', value: 2 })).toBe('+2 maximum Health');
    expect(summarizeRule({ type: 'DamageModifier', direction: 'taken', immune: true, damageType: 'fire' })).toBe('Immune to fire damage taken');
    expect(summarizeRule({ type: 'DamageModifier', direction: 'dealt', amount: 1 })).toBe('+1 damage dealt');
    expect(summarizeRule({ type: 'Grant', uuid: 'U' })).toBe('Grants a particular item');
    expect(summarizeRule({ type: 'Grant', uuid: 'U', label: 'Shadow Saber' })).toBe('Grants Shadow Saber');
    expect(summarizeRule({ type: 'Toggle', key: 'k' })).toBe('Toggle: K');
    expect(summarizeRule({ type: 'Pool', key: 'k', max: 3, reset: 'scene' })).toBe('Pool: K (max 3, resets each scene)');
    expect(summarizeRule({ type: 'ChoiceSet', key: 'k', from: 'skill' })).toBe('Choice: K (skill)');
    expect(summarizeRule({ type: 'Code', helper: 'h' })).toBe('Runs H');
    expect(summarizeRule({ type: 'Aura' })).toBe('Aura (not supported yet)');
    // A plug-in type reads its label (or its own summary, or the type in words) - never 'not supported yet'.
    registerRuleType('ZzPluginType', { params: {} });
    expect(summarizeRule({ type: 'ZzPluginType', label: 'Big Rigger' })).toBe('Big Rigger');
    expect(summarizeRule({ type: 'ZzPluginType', when: ['combat'] })).toBe('Zz Plugin Type, in combat');
    registerRuleType('ZzPluginOwn', { params: {}, summary: rule => `Own ${rule.n}` });
    expect(summarizeRule({ type: 'ZzPluginOwn', n: 2 })).toBe('Own 2');
    expect(summarizeRule(null)).toBe('');
  });

  test('describeWhen covers every family', () => {
    expect(describeWhen(['essence:speed', 'attack:melee', 'defense:evasion', 'self:transformed', 'self:status:prone', 'target:status:stunned', 'item:trait:fire',
      'combat', 'ownTurn', 'ask:it rains', 'not:self:morphed', { any: ['skill:might', 'skill:athletics'] }, 'odd'])).toBe(
      'on Speed tests, on melee attacks, against Evasion, while you are in Alt Mode, while you are Prone, while the target is Stunned, if the item has the Fire trait, '
      + "in combat, on your turn, when it rains, while you aren't Morphed, on Might tests or on Athletics tests, if odd");
  });
});

/* -------------------------------------------- */
/*  The index                                    */
/* -------------------------------------------- */

describe('index', () => {
  test('buckets live rules by type, sorted by priority', () => {
    const a = makeItem([{ type: 'RollModifier', upshift: 1, priority: 5 }, { type: 'RollModifier', upshift: 2, disabled: true }, { type: 'Nope' }]);
    const b = makeItem([{ type: 'RollModifier', upshift: 3, priority: 1 }]);
    const actor = makeActor([a, b]);
    const index = collectRules(actor);
    expect(index.RollModifier.map(e => e.rule.upshift)).toEqual([3, 1]);
    expect(index.Nope).toBeUndefined();
    expect(rulesIndex(null)).toEqual({});
    expect(rebuildIndex(null)).toEqual({});
  });

  test('copies of one item count once unless the item or rule stacks', () => {
    const src = { _stats: { compendiumSource: 'Compendium.e.p.Item.w' } };
    const once = () => ({ ...makeItem([{ type: 'RollModifier', downshift: 1 }]), ...src });
    const multi = () => ({ ...makeItem([{ type: 'Defense', defense: 'toughness', amount: 1 }], { system: { selectionLimit: 3 } }), ...src });
    const forced = () => ({ ...makeItem([{ type: 'DerivedStat', path: 'system.health.max', value: 1, stacks: true }]), ...src });
    const unsourced = () => makeItem([{ type: 'DamageModifier', direction: 'taken', amount: -1 }]);
    const chose = skill => ({ ...makeItem([{ type: 'RollModifier', upshift: 1 }], { flags: { essence20: { rules: { choices: { skill } } } } }), _stats: { compendiumSource: 'Compendium.e.p.Item.c' } });
    const index = collectRules(makeActor([once(), once(), multi(), multi(), forced(), forced(), unsourced(), unsourced(), chose('might'), chose('might'), chose('finesse')]));
    expect(index.RollModifier).toHaveLength(3);
    expect(index.Defense).toHaveLength(2);
    expect(index.DerivedStat).toHaveLength(2);
    expect(index.DamageModifier).toHaveLength(2);
    expect(ruleStacks({ stacks: false }, { system: { selectionLimit: 5 } })).toBe(false);
    expect(ruleStacks({}, { system: {} })).toBe(false);
    expect(validateRule({ type: 'RollModifier', upshift: 1, stacks: 'yes' })).toContain('stacks must be true or false');
  });

  test('equipment counts only while equipped; upgrades follow their host', () => {
    const armor = makeItem([], { type: 'armor', system: { equipped: false } });
    const powerArmor = makeItem([], { type: 'armor', system: { equipped: false, isPowerArmor: true } });
    const upgrade = makeItem([], { type: 'upgrade', flags: { essence20: { parentId: armor.id } } });
    makeActor([armor, powerArmor, upgrade]);
    expect(isItemActive(armor)).toBe(false);
    expect(isItemActive(powerArmor)).toBe(true);
    expect(isItemActive(upgrade)).toBe(false);
    armor.system.equipped = true;
    expect(isItemActive(upgrade)).toBe(true);
    expect(isItemActive(null)).toBe(false);
  });
});

/* -------------------------------------------- */
/*  The adapter                                  */
/* -------------------------------------------- */

describe('adapter: rolls', () => {
  test('registers into the extension registry', () => {
    const registry = registrySnapshot();
    expect(registry.rollSources).toContain(ruleRollSources);
    expect(registry.derived).toContain(ruleDerived);
    expect(registry.defenseAdjust).toContain(ruleDefenseAdjust);
    expect(registry.hitRiders).toContain(ruleDamageDealt);
  });

  test('known conditions become labelled roll sources; unknown ones become switches', () => {
    const perk = makeItem([
      { type: 'RollModifier', label: 'Strong', when: ['skill:might'], upshift: '1 + floor(@level / 5)' },
      { type: 'RollModifier', when: ['skill:finesse'], edge: true },
      { type: 'RollModifier', when: ['skill:might', 'ask:protecting someone'], snag: true },
      { type: 'RollModifier', when: ['skill:might'] },
    ], { name: 'Mighty' });
    const actor = makeActor([perk]);
    rebuildIndex(actor);
    const { sources } = ruleRollSources(actor, null, { rolledSkill: 'might' });
    expect(sources).toEqual([{ id: `rule-${perk.id}-0`, label: 'Strong', shiftUp: 2, shiftDown: 0, edge: false, snag: false, specialize: false }]);

    const switches = ruleDialogSwitches(actor, { rolledSkill: 'might' });
    expect(switches.map(s => s.name)).toEqual([`rule-${perk.id}-2`]);
    expect(switches[0]).toMatchObject({ label: 'Mighty', type: 'checkbox', value: false });

    const options = { ext: { [`rule-${perk.id}-2`]: true } };
    applyRuleSwitches(actor, options, { rolledSkill: 'might' });
    expect(options).toMatchObject({ snag: true, shiftUp: 0, shiftDown: 0 });
  });

  test('DialogSwitch offers its switch with its default, and applies when ticked', () => {
    const perk = makeItem([{ type: 'DialogSwitch', label: 'Aim', default: true, upshift: 1, specialize: true, when: ['attack'] }]);
    const actor = makeActor([perk]);
    rebuildIndex(actor);
    const weapon = { type: 'weaponEffect', system: { classification: { style: 'ranged' } }, flags: {} };
    expect(ruleDialogSwitches(actor, { item: weapon })[0]).toMatchObject({ label: 'Aim', value: true });
    expect(ruleDialogSwitches(actor, {})).toEqual([]);
    const options = { shiftUp: 1, ext: { [`rule-${perk.id}-0`]: true } };
    applyRuleSwitches(actor, options, { item: weapon });
    expect(options).toMatchObject({ shiftUp: 2, isSpecialized: true });
    const untouched = { ext: {} };
    applyRuleSwitches(actor, untouched, { item: weapon });
    expect(untouched.shiftUp).toBeUndefined();
  });

  test('incoming rules on the target change the roller', () => {
    const evasive = makeItem([{ type: 'RollModifier', scope: 'incoming', when: ['attack', 'target:status:prone'], downshift: 1 }], { name: 'Evasive' });
    const defender = makeActor([evasive]);
    const attacker = makeActor([], { statuses: ['prone'] });
    rebuildIndex(defender);
    rebuildIndex(attacker);
    const weapon = { type: 'weaponEffect', system: { classification: { style: 'melee' } }, flags: {} };
    expect(ruleRollSources(attacker, defender, { item: weapon, isAttack: true }).sources[0]).toMatchObject({ label: 'Evasive', shiftDown: 1 });
    expect(ruleRollSources(attacker, null, { item: weapon, isAttack: true }).sources).toEqual([]);
    attacker.statuses.clear();
    expect(ruleRollSources(attacker, defender, { item: weapon, isAttack: true }).sources).toEqual([]);
  });

  test('host-scoped upgrade rules apply only to their own weapon', () => {
    const weapon = makeItem([], { type: 'weapon' });
    const effect = { id: 'fx', type: 'weaponEffect', system: { classification: { style: 'ranged' } }, flags: { essence20: { parentId: weapon.id } } };
    const otherEffect = { id: 'fx2', type: 'weaponEffect', system: {}, flags: { essence20: { parentId: 'elsewhere' } } };
    const scope = makeItem([{ type: 'RollModifier', scope: 'host', when: ['attack'], edge: true }], { type: 'upgrade', flags: { essence20: { parentId: weapon.id } } });
    const actor = makeActor([weapon, scope]);
    rebuildIndex(actor);
    expect(hostMatches(scope, effect)).toBe(true);
    expect(hostMatches(scope, weapon)).toBe(true);
    expect(hostMatches(scope, otherEffect)).toBe(false);
    expect(hostMatches(scope, null)).toBe(false);
    expect(ruleRollSources(actor, null, { item: effect, isAttack: true }).sources).toHaveLength(1);
    expect(ruleRollSources(actor, null, { item: otherEffect, isAttack: true }).sources).toHaveLength(0);
  });

  test('specialize', () => {
    const perk = makeItem([{ type: 'RollModifier', when: ['skill:might'], specialize: true }]);
    const actor = makeActor([perk]);
    rebuildIndex(actor);
    expect(ruleSpecializes(actor, 'might', null, {})).toBe(true);
    expect(ruleSpecializes(actor, 'finesse', null, {})).toBe(false);
  });

  test('skill substitution: replace, best-of, chosen skill', () => {
    const swap = makeItem([{ type: 'SkillSubstitution', from: 'athletics', to: 'might' }]);
    const best = makeItem([{ type: 'SkillSubstitution', from: 'might', to: 'finesse', mode: 'bestOf' }]);
    const chosen = makeItem([{ type: 'SkillSubstitution', from: '*', to: '{choice.skill}', when: ['skill:athletics'] }], { flags: { essence20: { rules: { choices: { skill: 'finesse' } } } } });

    const a = makeActor([swap]);
    rebuildIndex(a);
    const dataset = { skill: 'athletics', essence: 'strength', shift: 'd4' };
    expect(applySkillSubstitution(a, dataset, null)).toBe('might');
    expect(dataset).toEqual({ skill: 'might', essence: 'strength', shift: 'd6' });

    const b = makeActor([best]);
    rebuildIndex(b);
    const ds = { skill: 'might' };
    expect(applySkillSubstitution(b, ds, null)).toBe('finesse');
    b.system.skills.finesse.shift = 'd4';
    expect(applySkillSubstitution(b, { skill: 'might' }, null)).toBeNull();

    const c = makeActor([chosen]);
    rebuildIndex(c);
    expect(applySkillSubstitution(c, { skill: 'athletics' }, null)).toBe('finesse');
    expect(applySkillSubstitution(c, { skill: 'might' }, null)).toBeNull();
    expect(applySkillSubstitution(c, {}, null)).toBeNull();
  });
});

describe('adapter: Defenses, numbers, damage', () => {
  test('always-on Defenses land in derived data with a breakdown; conditional ones per attack', () => {
    const perk = makeItem([
      { type: 'Defense', label: 'Tough', defense: 'toughness', amount: 2 },
      { type: 'Defense', label: 'Morphed', defense: 'any', amount: 1, when: ['self:morphed'] },
      { type: 'Defense', label: 'Vs melee', defense: 'evasion', amount: 3, when: ['attack:melee'] },
    ]);
    const actor = makeActor([perk]);
    ruleDerived(actor);
    expect(actor.system.defenses.toughness).toEqual({ total: 14, string: '12 (Base) + 2 (Tough)' });
    expect(actor.system.defenses.evasion.total).toBe(11);

    actor.system.isMorphed = true;
    ruleDerived(actor);
    expect(actor.system.defenses.toughness.total).toBe(17);
    expect(actor.system.defenses.willpower.total).toBe(11);

    const melee = { type: 'weaponEffect', system: { classification: { style: 'melee' } }, flags: {} };
    expect(ruleDefenseAdjust(makeActor(), actor, 'evasion', { item: melee })).toBe(3);
    expect(ruleDefenseAdjust(makeActor(), actor, 'evasion', { item: { type: 'weaponEffect', system: { classification: { style: 'ranged' } } } })).toBe(0);
    expect(ruleDefenseAdjust(makeActor(), actor, 'toughness', { item: melee })).toBe(0);
  });

  test('DerivedStat: ops, the host item, and roll-dependent rules skipped', () => {
    const weapon = makeItem([], { type: 'weapon', system: { range: { max: 30 } } });
    const items = [
      makeItem([{ type: 'DerivedStat', label: 'Hardy', path: 'system.health.max', value: '@essence.strength' }]),
      makeItem([{ type: 'DerivedStat', path: 'system.movement.ground', op: 'set', value: 40 }]),
      makeItem([{ type: 'DerivedStat', path: 'system.level', op: 'multiply', value: 2 }]),
      makeItem([{ type: 'DerivedStat', path: 'system.health.value', op: 'max', value: 12 }]),
      makeItem([{ type: 'DerivedStat', path: 'system.defenses', op: 'add', value: 1 }]),
      makeItem([{ type: 'DerivedStat', path: 'system.health.max', value: 100, when: ['skill:might'] }]),
      makeItem([{ type: 'DerivedStat', path: 'system.range.max', op: 'min', value: 20, scope: 'host' }], { type: 'upgrade', flags: { essence20: { parentId: weapon.id } } }),
      makeItem([{ type: 'DerivedStat', path: 'system.range.max', value: 1, scope: 'host' }], { type: 'upgrade' }),
    ];
    const actor = makeActor([weapon, ...items]);
    ruleDerived(actor);
    expect(actor.system.health).toEqual({ value: 12, max: 13, string: '10 (Base) + 3 (Hardy)' });
    expect(actor.system.movement.ground).toBe(40);
    expect(actor.system.level).toBe(10);
    expect(typeof actor.system.defenses).toBe('object');
    expect(weapon.system.range.max).toBe(20);
  });

  test('damage taken: reduction, type filter, immunity, never below 0', () => {
    const actor = makeActor([makeItem([
      { type: 'DamageModifier', direction: 'taken', amount: -1 },
      { type: 'DamageModifier', direction: 'taken', damageType: 'fire', immune: true },
      { type: 'DamageModifier', direction: 'taken', amount: -5, when: ['self:morphed'] },
      { type: 'DamageModifier', direction: 'dealt', amount: 9 },
    ])]);
    rebuildIndex(actor);
    expect(ruleDamageTaken(actor, 3, 'blunt')).toBe(2);
    expect(ruleDamageTaken(actor, 3, 'fire')).toBe(0);
    actor.system.isMorphed = true;
    expect(ruleDamageTaken(actor, 3, 'blunt')).toBe(0);
  });

  test('damage dealt: added on the card, filtered by type and condition', () => {
    const actor = makeActor([makeItem([
      { type: 'DamageModifier', label: 'Brutal', direction: 'dealt', amount: 1, when: ['attack:melee'] },
      { type: 'DamageModifier', direction: 'dealt', amount: 2, damageType: 'fire' },
      { type: 'DamageModifier', direction: 'taken', amount: 2 },
    ])]);
    rebuildIndex(actor);
    const damageBonusNote = jest.fn((result, amount) => {
      result.damageValue += amount;
    });
    const result = { damageValue: 2, damageType: 'blunt' };
    ruleDamageDealt(actor, makeActor(), result, { style: 'melee' }, { damageBonusNote });
    expect(result.damageValue).toBe(3);
    expect(damageBonusNote).toHaveBeenCalledWith(result, 1, 'Brutal');

    ruleDamageDealt(actor, makeActor(), { damageValue: 0 }, {}, { damageBonusNote });
    ruleDamageDealt(actor, makeActor(), { damageValue: 1 }, {}, {});
    expect(damageBonusNote).toHaveBeenCalledTimes(1);
  });
});

describe('adapter: rerolls and pools', () => {
  test('Reroll rules become reroll configs', () => {
    const perk = makeItem([
      { type: 'Reroll', label: 'Lucky', mode: 'ones', maxUses: '1 + floor(@level / 5)', reset: 'scene' },
      { type: 'Reroll', mode: 'all', when: ['self:morphed'] },
      { type: 'Reroll', mode: 'all', when: ['skill:might'] },
    ], { uuid: 'Actor.a.Item.p' });
    const actor = makeActor([perk]);
    rebuildIndex(actor);
    // An item's first Reroll rule counts its uses under the item (item:<uuid>), as its old system.reroll did.
    expect(ruleRerollGrants(actor)).toEqual([{ mode: 'ones', maxUses: 2, reset: 'scene', source: 'Actor.a.Item.p', sourceType: 'item', name: 'Lucky' }]);
  });

  test('a later Reroll rule on the same item keeps a count of its own', () => {
    const perk = makeItem([{ type: 'Reroll', mode: 'ones' }, { type: 'Reroll', mode: 'all', maxUses: 1 }], { uuid: 'Actor.a.Item.q' });
    const actor = makeActor([perk]);
    rebuildIndex(actor);
    expect(ruleRerollGrants(actor).map(config => [config.source, config.sourceType])).toEqual([['Actor.a.Item.q', 'item'], ['Actor.a.Item.q#rule1', undefined]]);
  });

  // Power Infusion: 1s, then 1s and 2s from its advance - what the advances.type 'rerolls' path in
  // mechanics/rolls/reroll.mjs worked out before the rule took it over.
  test('upTo rerolls the results 1 to its formula', () => {
    const rule = { type: 'Reroll', mode: 'all', reset: 'scene', maxUses: 1, upTo: '@item.system.advances.currentValue' };
    const perk = makeItem([rule], { uuid: 'Actor.a.Item.r', system: { advances: { currentValue: 2 } } });
    const actor = makeActor([perk]);
    rebuildIndex(actor);
    const [config] = ruleRerollGrants(actor);
    expect(config.values).toEqual([1, 2]);
    expect(config.upTo).toBeUndefined();

    perk.system.advances.currentValue = 0;
    expect(ruleRerollGrants(actor)[0].values).toEqual([1]);
  });

  // Expertise / Trade Experience / Aptitude Augmenter: a rule naming no Skills covers the picked one.
  test('a skills-pick Perk scopes a Skills-less Reroll rule to its pick', () => {
    const perk = makeItem([{ type: 'Reroll', mode: 'ones' }], { uuid: 'Actor.a.Item.s', system: { choiceType: 'skills', choice: 'athletics' } });
    const named = makeItem([{ type: 'Reroll', mode: 'ones', skills: ['might'] }], { uuid: 'Actor.a.Item.t', system: { choiceType: 'skills', choice: 'athletics' } });
    const unpicked = makeItem([{ type: 'Reroll', mode: 'ones' }], { uuid: 'Actor.a.Item.u', system: { choiceType: 'skills', choice: null } });
    const actor = makeActor([perk, named, unpicked]);
    rebuildIndex(actor);
    expect(ruleRerollGrants(actor).map(config => config.skills)).toEqual([['athletics'], ['might'], undefined]);
  });

  test('a toggle-gated Reroll rule (Lucky Charm) is offered only once its toggle is on', () => {
    const power = makeItem([{ type: 'Reroll', when: ['self:toggle:luckyCharm'], mode: 'ones', maxUses: 0 }], { uuid: 'Actor.a.Item.v', type: 'power' });
    const actor = makeActor([power]);
    rebuildIndex(actor);
    expect(ruleRerollGrants(actor)).toEqual([]);
    power.flags = { essence20: { rules: { toggles: { luckyCharm: true } } } };
    expect(ruleRerollGrants(actor)).toHaveLength(1);
  });

  test('pools refill on their own reset only', () => {
    const item = makeItem([{ type: 'Pool', key: 'cheer', max: '@level', reset: 'scene' }, { type: 'Pool', key: 'other', max: 1, reset: 'rest' }]);
    const actor = makeActor([item]);
    rebuildIndex(actor);
    expect(poolResets(actor, 'scene')).toEqual([{ _id: item.id, 'flags.essence20.rules.pools.cheer.value': 5 }]);
    expect(poolResets(actor, 'mission')).toEqual([]);
  });
});

/* -------------------------------------------- */
/*  Lifecycle and sheet                          */
/* -------------------------------------------- */

describe('lifecycle', () => {
  test('choice options from config and lists', () => {
    expect(choiceOptions({ from: 'skill' })).toEqual([{ value: 'athletics', label: 'E20.SkillAthletics' }, { value: 'might', label: 'E20.SkillMight' }]);
    expect(choiceOptions({ from: 'essence' })).toEqual([{ value: 'strength', label: 'E20.EssenceStrength' }]);
    expect(choiceOptions({ from: 'defense' })).toHaveLength(1);
    expect(choiceOptions({ from: 'list', options: ['a', { value: 'b', label: 'Bee' }] })).toEqual([{ value: 'a', label: 'a' }, { value: 'b', label: 'Bee' }]);
    expect(choiceOptions({ from: 'list' })).toEqual([]);
    expect(choiceOptions({ from: 'x' })).toEqual([]);
  });

  test('initial state: asks unset choices, toggles default, pools start full', async () => {
    const item = makeItem([
      { type: 'ChoiceSet', key: 'skill', from: 'skill' },
      { type: 'ChoiceSet', key: 'done', from: 'skill' },
      { type: 'ChoiceSet', key: 'skip', from: 'skill' },
      { type: 'Toggle', key: 'stance', default: true },
      { type: 'Pool', key: 'uses', max: 3 },
      { type: 'Pool', key: 'off', max: 3, disabled: true },
    ], { flags: { essence20: { rules: { choices: { done: 'might' } } } } });
    const actor = makeActor([item]);
    const ask = jest.fn(async rule => (rule.key == 'skip' ? null : 'athletics'));
    expect(await initialState(item, actor, { ask })).toEqual({
      'flags.essence20.rules.choices.skill': 'athletics',
      'flags.essence20.rules.toggles.stance': true,
      'flags.essence20.rules.pools.uses.value': 3,
    });
    expect(ask).toHaveBeenCalledTimes(2);
  });

  test('grants: copies marked with the granter, skipping what is owned', async () => {
    const owned = makeItem([], { flags: { core: { sourceId: 'Compendium.a' } } });
    const granter = makeItem([
      { type: 'Grant', uuid: 'Compendium.a', skipIfOwned: true },
      { type: 'Grant', uuid: 'Compendium.b' },
      { type: 'Grant', uuid: 'Compendium.missing' },
    ]);
    const actor = makeActor([owned, granter]);
    const load = async uuid => (uuid == 'Compendium.missing' ? null : { toObject: () => ({ _id: 'x', name: uuid }) });
    const data = await grantData(granter, actor, { load });
    expect(data).toEqual([{ name: 'Compendium.b', _stats: { compendiumSource: 'Compendium.b' }, flags: { essence20: { grantedBy: granter.id } } }]);

    const given = makeItem([], { flags: { essence20: { grantedBy: granter.id } } });
    const later = makeActor([granter, given]);
    expect(grantedBy(later, granter)).toEqual([given.id]);
  });
});

describe('sheet', () => {
  test('Add offers an Active Effect first, then every rule type, each with a valid starting rule', () => {
    expect(ADD_CHOICES[0].key).toBe('effect');
    const ruleKinds = ADD_CHOICES.slice(1).map(choice => choice.key);
    expect(ruleKinds.sort()).toEqual(Object.keys(SKELETONS).sort());
    for (const kind of ruleKinds.filter(k => !['Grant', 'Code'].includes(k))) {
      expect(validateRule(SKELETONS[kind])).toEqual([]);
    }

    // A Defense or number change starts with a condition - with none it belongs in an Active Effect.
    expect(SKELETONS.Defense.when).toBeTruthy();
    expect(SKELETONS.DerivedStat.when).toBeTruthy();
  });

  test('Active Effects become entries tagged on, off or temporary', () => {
    const entries = effectEntries([
      { id: 'e1', disabled: false, isTemporary: false, e20Summaries: ['Toughness +2'] },
      { id: 'e2', disabled: true },
      { id: 'e3', disabled: false, isTemporary: true },
    ]);
    expect(entries.map(e => e.state)).toEqual(['on', 'off', 'temporary']);
    expect(entries[0].summaries).toEqual(['Toughness +2']);
    expect(entries[1].summaries).toEqual([]);
    expect(effectEntries(null)).toEqual([]);
  });

  test('JSON parsing', () => {
    expect(parseRulesJson('[{"type":"RollModifier"}]')).toEqual({ rules: [{ type: 'RollModifier' }] });
    expect(parseRulesJson('')).toEqual({ rules: [] });
    expect(parseRulesJson('{').error).toBeTruthy();
    expect(parseRulesJson('{}').error).toMatch(/list/);
    expect(parseRulesJson('[1]').error).toMatch(/object/);
  });

  test('context: summaries, errors and live state', () => {
    const item = makeItem([
      { type: 'RollModifier', when: ['skill:might'], upshift: 1 },
      { type: 'Toggle', key: 'stance' },
      { type: 'Pool', key: 'uses', max: 2 },
      { type: 'ChoiceSet', key: 'skill', from: 'skill' },
      { type: 'Aura' },
    ], { flags: { essence20: { rules: { pools: { uses: { value: 1 } }, choices: { skill: 'might' } } } } });
    const actor = makeActor([item]);
    item.parent = { ...actor, documentName: 'Actor' };
    const context = rulesContext(item);
    expect(context.rules.map(r => r.summary)[0]).toBe('↑1 on Might tests');
    expect(context.rules[1].toggle).toEqual({ value: false });
    expect(context.rules[2].pool).toEqual({ value: 1, max: 2 });
    expect(context.rules[3].choice).toEqual({ value: 'might', label: 'E20.SkillMight' });
    expect(context.rules[4].errors[0]).toMatch(/not supported/);
    expect(context.rulesOwned).toBe(true);
    expect(context.ruleTypes).toContain('ChoiceSet');
    expect(JSON.parse(context.rulesJson)).toHaveLength(5);
  });
});
