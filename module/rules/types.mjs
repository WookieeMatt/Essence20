import { formulaError } from "./formula.mjs";
import { unknownTags } from "./predicate.mjs";
import { LIMIT_WINDOWS } from "./limits.mjs";
import { CARD_STEPS, stepErrors } from "./steps.mjs";
import { describeWhen, formulaWords, humanize, itemClauses, itemName, pathName, skillName } from "./describe-when.mjs";

export { describeWhen };

/**
 * What an ActionCost can make cheaper: a named action (E20.namedActions), or a kind of cost the
 * action economy asks about - an attack, using an item, changing mode, raising a shield.
 */
export const ACTION_KEYS = [
  'attack', 'aim', 'contingency', 'defend', 'hide', 'lendAssistance', 'searchTheArea', 'useASkill', 'sprint', 'shove', 'brace', 'drawWeapon',
  'commandPet', 'move', 'item', 'conversion', 'shieldToggle',
];

/** Events a Trigger can run on (rules/triggers.mjs). */
export const TRIGGER_EVENTS = [
  'turnStart', 'turnEnd', 'roundStart', 'rest', 'sceneStart', 'missionStart', 'takesDamage', 'wouldBeDefeated', 'defeated',
  'morph', 'unmorph', 'transform', 'untransform', 'afterRoll', 'hit', 'miss', 'added', 'conditionGained',
  'lendAssistance', 'assisted', 'combatStart', 'combatEnd', 'initiativeRolled', 'storyPointSpent',
  'targeted', 'dealtDamage', 'defeatedEnemy', 'equipped', 'unequipped', 'essenceChanged', 'resourceSpent', 'sessionStart', 'itemAdded', 'movedOnTurn', 'removed', 'droppedToZero',
];

/** Add a Trigger event name (module/rules/ext/*.mjs fire it with fireTriggers). */
export function registerEvent(name) {
  if (!TRIGGER_EVENTS.includes(name)) {
    TRIGGER_EVENTS.push(name);
  }
}

/**
 * Add a rule type: {params, scopes, validate?} as in RULE_TYPES. Its consumer (the code that reads it with
 * rulesOfType) lives beside it.
 */
export function registerRuleType(name, definition) {
  RULE_TYPES[name] = definition;
}

function costErrors(cost) {
  if (cost === undefined) {
    return [];
  }

  if (!cost || typeof cost != 'object') {
    return ['cost must be {action, resource, amount}'];
  }

  const errors = [];
  if (cost.action !== undefined && !['standard', 'move', 'free', 'none'].includes(cost.action)) {
    errors.push('cost.action must be standard, move, free or none');
  }

  // kind: the named action the cost is for (rouse...), handed to the action economy as its context.
  if (cost.kind !== undefined && (typeof cost.kind != 'string' || !cost.action)) {
    errors.push('cost.kind must be a name, with cost.action');
  }

  if (cost.resource && !cost.resource.pool && !cost.resource.path && !cost.resource.storyPoints && !cost.resource.rolePoints) {
    errors.push('cost.resource needs pool, path, storyPoints or rolePoints');
  }

  const amount = formulaError(cost.amount);
  if (amount) {
    errors.push(`cost.amount: ${amount}`);
  }

  return errors;
}

function limitErrors(limit) {
  if (limit === undefined) {
    return [];
  }

  if (!limit || !LIMIT_WINDOWS.includes(limit.per)) {
    return [`limit.per must be one of ${LIMIT_WINDOWS.join(', ')}`];
  }

  if (limit.onlyOnSuccess !== undefined && typeof limit.onlyOnSuccess != 'boolean') {
    return ['limit.onlyOnSuccess must be true or false'];
  }

  const max = formulaError(limit.max);
  return max ? [`limit.max: ${max}`] : [];
}

/**
 * The rule type catalogue (docs/RULES_ENGINE_PLAN.md §4) - what each type takes, how it's checked
 * and how it reads in plain English. One table, several consumers: the validator
 * (scripts/check-rules.mjs and the Rules tab), the summaries, and later the guided editor.
 *
 * Phase 1 types only. A rule of any other type is kept as it is and shown as "not supported yet" -
 * never stripped, so data written by a newer version survives.
 *
 * Param kinds: 'formula' (a number or formula - rules/formula.mjs), 'bool', 'string', 'enum', 'outcome' (an enum
 * value or a list of them)
 * (`options`), 'strings' (an array of strings), 'object' and 'any' (checked by the type's own
 * validate, or by whatever reads it).
 *
 * Plain Node safe.
 */

const SHIFT_PARAMS = {
  stack: { kind: 'string' },
  upshift: { kind: 'formula' },
  downshift: { kind: 'formula' },
  edge: { kind: 'bool' },
  snag: { kind: 'bool' },
  specialize: { kind: 'bool' },
};

export const SCOPES = ['self', 'incoming', 'host', 'crew', 'pilot', 'vehicle', 'driven', 'companion', 'owner', 'party', 'team', 'aura'];

/** Every type's own params; label, when, scope, priority and disabled are common to all. */
export const RULE_TYPES = {
  RollModifier: {
    // late: decided after the Roll Options Dialog, when the attacked Defense is settled (defense: tags).
    params: { ...SHIFT_PARAMS, immune: { kind: 'strings' }, ignoreDownshift: { kind: 'formula' }, limit: { kind: 'object' }, default: { kind: 'bool' }, late: { kind: 'bool' },
      // consumeMark: the roll this applies to uses up that mark (on the roller, or consumeFrom: target).
      consumeMark: { kind: 'string' }, consumeFrom: { kind: 'enum', options: ['self', 'target'] } },
    scopes: ['self', 'incoming', 'host', 'crew', 'pilot', 'vehicle', 'driven', 'companion', 'owner', 'party', 'team', 'aura'],
    validate: rule => [
      ...(['upshift', 'downshift', 'edge', 'snag', 'specialize', 'immune', 'ignoreDownshift'].some(key => rule[key]?.length ?? rule[key]) ? [] : ['changes nothing']),
      ...limitErrors(rule.limit),
      ...(rule.immune ?? []).filter(kind => !['snag', 'downshift', 'untrainedSnag', 'longRangeSnag'].includes(kind)).map(kind => `immune can only list snag, downshift, untrainedSnag and longRangeSnag, not "${kind}"`),
    ],
  },
  // replacesAim: ticked, it stands in for the Aim bonus ("instead of the normal benefits of Aim").
  // cost {resource, amount}: only offered when affordable, paid when the roll is made with it ticked.
  DialogSwitch: {
    // damage: added to the attack's own damage bonus when ticked (multiplied by Degrees of Success).
    // useSkill: roll that Skill's die instead (the shift difference, like "roll Deception instead of Initiative").
    params: { ...SHIFT_PARAMS, default: { kind: 'bool' }, replacesAim: { kind: 'bool' }, cost: { kind: 'object' }, damage: { kind: 'formula' }, useSkill: { kind: 'string' }, forget: { kind: 'bool' }, spend: { kind: 'object' }, clearSnag: { kind: 'bool' }, key: { kind: 'string' }, steps: { kind: 'object' }, defaultWhen: { kind: 'strings' }, limit: { kind: 'object' },
      // noDamage: ticked, the attack deals no damage at all (dice.mjs options.ruleNoDamage - "forgo the damage to ...").
      noDamage: { kind: 'bool' } },
    scopes: ['self', 'host', 'crew', 'pilot', 'vehicle', 'driven', 'companion', 'owner', 'party', 'team', 'aura'],
    validate: rule => [
      ...(['upshift', 'downshift', 'edge', 'snag', 'specialize', 'damage', 'replacesAim', 'useSkill', 'key', 'steps', 'clearSnag', 'noDamage'].some(key => rule[key]) ? [] : ['changes nothing']),
      ...(rule.spend !== undefined && !rule.spend?.resource && rule.spend?.max === undefined ? ['spend needs a resource or a max'] : []),
      ...(rule.spend !== undefined && rule.cost !== undefined ? ['spend and cost can\'t both be set'] : []),
      ...(rule.steps !== undefined ? stepErrors(rule.steps) : []),
      ...(rule.cost !== undefined && !rule.cost?.resource ? ['cost needs a resource'] : []),
      ...(rule.cost !== undefined ? costErrors(rule.cost) : []),
      ...limitErrors(rule.limit),
    ],
  },
  // The same settings as a Perk's own system.reroll (data/reroll-schema.mjs), checked there - so
  // existing reroll data moves into a rule unchanged. mechanics/rolls/reroll.mjs#normalizeRerollConfig
  // fills the defaults. keepBetter: keep the better of the two totals (Backup Planner). upTo: a formula N -
  // reroll results 1 to N (Power Infusion's "@item.system.advances.currentValue"), in place of `values`.
  // A Perk's own system.reroll moved into this rule on 2026-10-07 (docs/rules-batches/details-cleanup.md).
  Reroll: {
    params: {
      ...Object.fromEntries(['mode', 'target', 'reset', 'maxUses', 'values', 'cost', 'condition', 'skills', 'essence',
        'scopeToOriginSkill', 'recursive', 'minDieFaces', 'grantsCanCritD2', 'bonus', 'shiftUp'].map(key => [key, { kind: 'any' }])),
      keepBetter: { kind: 'bool' },
      upTo: { kind: 'formula' },
    },
    scopes: ['self'],
  },
  SkillSubstitution: {
    params: {
      from: { kind: 'string', required: true },
      to: { kind: 'string', required: true },
      mode: { kind: 'enum', options: ['replace', 'bestOf'] },
    },
    // item: the rule sits on the rolled item itself (a weapon effect) and applies to whoever rolls it -
    // its owner, or a crew member / pilot firing a vehicle's or Zord's weapon.
    scopes: ['self', 'host', 'item', 'crew', 'pilot', 'vehicle', 'driven', 'companion', 'owner', 'party', 'team', 'aura'],
  },
  // A Defense. Static (no roll condition): added to the sheet's total. Otherwise decided per attack
  // (dice.mjs, the target's difficulty), where mode can also be: best (use the better of the current
  // value and the `from` Defenses' totals), halve (rounded up) or fail (the roll can't succeed).
  // outgoing: the rule sits on the ATTACKER and changes the Defense of whoever it rolls against.
  Defense: {
    params: {
      defense: { kind: 'enum', required: true, options: ['toughness', 'evasion', 'willpower', 'cleverness', 'any'] },
      amount: { kind: 'formula' },
      stack: { kind: 'string' },
      mode: { kind: 'enum', options: ['add', 'best', 'halve', 'fail'] },
      from: { kind: 'strings' },
      outgoing: { kind: 'bool' },
      limit: { kind: 'object' },
    },
    scopes: ['self', 'crew', 'pilot', 'vehicle', 'driven', 'companion', 'owner', 'party', 'team', 'aura'],
    validate: rule => [
      ...((rule.mode ?? 'add') == 'add' && (rule.amount === undefined || rule.amount === '') ? ['amount is required'] : []),
      ...(rule.mode == 'best' && !(Array.isArray(rule.from) && rule.from.length) ? ['best needs from (the Defenses to compare)'] : []),
      ...(rule.limit !== undefined ? limitErrors(rule.limit) : []),
    ],
  },
  DerivedStat: {
    params: {
      path: { kind: 'string', required: true },
      op: { kind: 'enum', options: ['add', 'set', 'multiply', 'max', 'min'] },
      // A number / formula, or true / false (set as it is). The path may read a pick: system.skills.{choice.skill}.x
      value: { kind: 'any', required: true },
      // early: before the poison training is worked out from system.poisonTraining (rules/plugins/effects/derived-stages.mjs).
      stage: { kind: 'enum', options: ['early'] },
    },
    scopes: ['self', 'host', 'crew', 'pilot', 'vehicle', 'driven', 'companion', 'owner', 'party', 'team', 'aura'],
    validate: rule => [
      ...(String(rule.path ?? '').startsWith('system.') ? [] : ['path must start with "system."']),
      ...(typeof rule.value == 'boolean' || !formulaError(rule.value) ? [] : [`value: ${formulaError(rule.value)}`]),
    ],
  },
  DamageModifier: {
    params: {
      direction: { kind: 'enum', required: true, options: ['dealt', 'taken'] },
      amount: { kind: 'formula' },
      damageType: { kind: 'string' },
      immune: { kind: 'bool' },
      // dealt only: part of the attack's own damage bonus, so Degrees of Success multiply it.
      scaled: { kind: 'bool' },
      // scaled only: once per X, and steps that run when it's applied.
      limit: { kind: 'object' },
      steps: { kind: 'object' },
    },
    scopes: ['self', 'host', 'crew', 'pilot', 'vehicle', 'driven', 'companion', 'owner', 'party', 'team', 'aura'],
    validate: rule => [
      ...(rule.amount || rule.immune ? [] : ['changes nothing']),
      ...(rule.scaled && rule.direction != 'dealt' ? ['scaled only applies to damage dealt'] : []),
      ...((rule.limit !== undefined || rule.steps !== undefined) && !rule.scaled ? ['limit and steps need scaled'] : []),
      ...(rule.limit !== undefined ? limitErrors(rule.limit) : []),
      ...(rule.steps !== undefined ? stepErrors(rule.steps) : []),
    ],
  },
  Grant: {
    params: {
      uuid: { kind: 'string', required: true },
      skipIfOwned: { kind: 'bool' },
    },
    scopes: ['self'],
    validate: rule => (/^Compendium\.|^Item\./.test(String(rule.uuid ?? '')) ? [] : ['uuid must be an Item or Compendium uuid']),
  },
  Toggle: {
    // legacy: where an older version of the item kept this state (rules/legacy-choices.mjs).
    params: { key: { kind: 'string', required: true }, default: { kind: 'bool' }, legacy: { kind: 'string' } },
    scopes: ['self'],
  },
  Pool: {
    params: {
      key: { kind: 'string', required: true },
      max: { kind: 'formula', required: true },
      reset: { kind: 'enum', options: ['none', 'scene', 'mission', 'rest'] },
    },
    scopes: ['self'],
  },
  ChoiceSet: {
    params: {
      key: { kind: 'string', required: true },
      from: { kind: 'enum', required: true, options: ['skill', 'essence', 'defense', 'list', 'text'] },
      options: { kind: 'object' },
      // Where an older version of the item kept this pick (rules/legacy-choices.mjs).
      legacy: { kind: 'string' },
    },
    scopes: ['self'],
    validate: rule => (rule.from != 'list' || (Array.isArray(rule.options) && rule.options.length) ? [] : ['a list choice needs options']),
  },
  Code: {
    params: { helper: { kind: 'string', required: true } },
    scopes: ['self'],
  },
  // Acting in a surprise round (documents/actor.mjs#_prepareActions): "normal" acts as usual,
  // "move" may still take a Move action and Skill Tests (no Standard), "speedAsLevel" acts with Speed
  // treated as the character's level (up to their real Speed).
  // Critical Effects (mechanics/combat/target-riders.mjs#critRiders): an option a Critical Success can pick -
  // damage of a type, Essence damage, a Condition, or a named effect (bonusAttack, blazingStrikes,
  // nextAttackSnag) - or `improve`: every damage option gets that many more points. The condition reads
  // the attack and its target (item:own for "attacks with this weapon", target:within:30...).
  CriticalOption: {
    params: {
      damageValue: { kind: 'formula' }, damageType: { kind: 'string' }, essence: { kind: 'string' }, status: { kind: 'string' },
      effect: { kind: 'enum', options: ['bonusAttack', 'blazingStrikes', 'nextAttackSnag'] }, improve: { kind: 'formula' }, stack: { kind: 'string' },
    },
    scopes: ['self'],
    validate: rule => (rule.improve !== undefined || rule.damageType || rule.essence || rule.status || rule.effect ? [] : ['changes nothing']),
  },
  // Traits on the actor's weapons (mechanics/combat/weapon-traits.mjs#perkGrantedTraits): every weapon the `items`
  // tags match (item:trait:fire, item:name~grenade...; none means every weapon) gains `traits`.
  WeaponTrait: {
    params: { traits: { kind: 'strings', required: true }, items: { kind: 'object' } },
    scopes: ['self'],
    validate: rule => (Array.isArray(rule.items) ? unknownTags(rule.items).map(tag => `unknown tag "${tag}" in items`) : []),
  },
  // Hardpoints (mechanics/combat/weapon-traits.mjs): extra External / Integrated / Non-Weapon slots, more
  // Integrated slots per weapon, and Integrated weapons firing as Reinforced (those the `items` tags
  // match, or all).
  Hardpoints: {
    params: {
      external: { kind: 'formula' }, integrated: { kind: 'formula' }, nonWeapon: { kind: 'formula' }, perWeapon: { kind: 'formula' },
      reinforced: { kind: 'bool' }, items: { kind: 'object' },
    },
    scopes: ['self'],
    validate: rule => (['external', 'integrated', 'nonWeapon', 'perWeapon', 'reinforced'].some(key => rule[key]) ? [] : ['changes nothing']),
  },
  // Several attacks per Attack action (mechanics/actions/action-perks.mjs#getAttacksPerAction): `count` attacks
  // in all (the best one counts), or `additional` on top of whichever count applies. The condition
  // reads the attack: weapon:trait:ballistic, attack:melee...
  AttackCount: {
    params: { count: { kind: 'formula' }, additional: { kind: 'formula' } },
    scopes: ['self', 'crew', 'pilot', 'vehicle', 'driven', 'companion', 'owner', 'party', 'team', 'aura'],
    validate: rule => ((rule.count !== undefined) != (rule.additional !== undefined) ? [] : ['give either count or additional']),
  },
  // The roll can critically succeed on the d2 (dice.mjs's canCritD2), when `when` holds - roll:edge,
  // roll:specialized, weapon: tags... are known by then.
  CritOnD2: {
    params: {},
    scopes: ['self', 'host'],
  },
  // A Movement type's speed, at one stage of documents/actor.mjs#_prepareMovement: base (the base
  // speed, before totals), total (right after innate + bonus + Morphed), adjust (after climb/swim
  // take half of ground), final (after every other change, before gravity). Within a stage: set,
  // then multiply, then add, then max / min. Other speeds: @actor.system.movement.ground.total.
  Movement: {
    params: {
      movement: { kind: 'enum', required: true, options: ['ground', 'aerial', 'climb', 'swim', 'burrow', 'all'] },
      // derived: inside the extensions' derived pass, before afterDerived (rules/plugins/effects/derived-stages.mjs).
      // bonus: the type's `bonus` (what a Perk's drop used to write - Fast), for every type before any total is worked out.
      stage: { kind: 'enum', options: ['bonus', 'base', 'total', 'adjust', 'final', 'afterGravity', 'derived', 'afterDerived'] },
      round: { kind: 'enum', options: ['nearest', 'floor', 'ceil'] },
      op: { kind: 'enum', required: true, options: ['set', 'multiply', 'add', 'max', 'min'] },
      value: { kind: 'formula', required: true },
    },
    scopes: ['self', 'host', 'crew', 'pilot', 'vehicle', 'driven', 'companion', 'owner', 'party', 'team', 'aura'],
  },
  // The damage type this attack deals instead (dice.mjs overriddenDamageType) - "choice" is the rule
  // item's chosen type. `when` sees the roll, after the dialog (roll:switch:, roll:edge...).
  DamageType: {
    params: { to: { kind: 'string', required: true } },
    scopes: ['self', 'host'],
  },
  // The dice themselves, once the final die is known (after the dialog): d20Floor (a d20 never shows
  // less than 10), thirdD20 (roll a third d20 - with an Edge, keep the best), maxDie (the Skill Die is at
  // most this one), stepUp (one or more steps up after everything else). `when` sees roll:edge /
  // roll:snag / roll:specialized as they stand then.
  RollDice: {
    params: {
      d20Floor: { kind: 'formula' },
      thirdD20: { kind: 'bool' },
      maxDie: { kind: 'string' },
      stepUp: { kind: 'formula' },
    },
    scopes: ['self', 'host'],
    validate: rule => [
      ...(rule.d20Floor !== undefined && Number(rule.d20Floor) != 10 ? ['d20Floor can only be 10'] : []),
      ...(['d20Floor', 'thirdD20', 'maxDie', 'stepUp'].some(key => rule[key]) ? [] : ['changes nothing']),
    ],
  },
  // The die a roll starts from, before the dialog (dice.mjs initialShift) - the rolled Skill stays the
  // same. use: that Skill's die; best: the best of the current die and these Skills' dice; floor: at
  // least this die. "choice" in skills means the rule item's chosen Skill. When it applies: specialize
  // makes the roll Specialized, clearSnag removes any Snag, and a limit is used up.
  DieSubstitution: {
    params: {
      mode: { kind: 'enum', required: true, options: ['use', 'best', 'floor'] },
      skills: { kind: 'strings' },
      die: { kind: 'string' },
      specialize: { kind: 'bool' },
      clearSnag: { kind: 'bool' },
      limit: { kind: 'object' },
      // from: only when the roll starts at one of these dice; consumeMark: the roll it applies to uses up that mark.
      from: { kind: 'strings' },
      consumeMark: { kind: 'string' },
    },
    scopes: ['self', 'host'],
    validate: rule => [
      ...(['use', 'best'].includes(rule.mode) && !(Array.isArray(rule.skills) && rule.skills.length) ? [`${rule.mode} needs skills`] : []),
      ...(rule.mode == 'floor' && !rule.die ? ['floor needs a die'] : []),
      ...(rule.limit !== undefined ? limitErrors(rule.limit) : []),
    ],
  },
  // Cover on ranged attacks (dice.mjs, normally ↓2). The holder's own attacks: ignore it, or reduce it
  // (the biggest reduction counts, never below ↓0). Attacks against the holder (against: true): count
  // as in Cover (grant), a bigger base (base: 3 = "↓3 instead of ↓2"), or add on top.
  Cover: {
    params: {
      mode: { kind: 'enum', required: true, options: ['ignore', 'reduce', 'grant', 'base', 'add'] },
      amount: { kind: 'formula' },
      against: { kind: 'bool' },
    },
    scopes: ['self', 'host', 'aura'],
    validate: rule => [
      ...(['reduce', 'base', 'add'].includes(rule.mode) && !rule.amount ? ['needs an amount'] : []),
      ...(['grant', 'base', 'add'].includes(rule.mode) && !rule.against ? [`${rule.mode} only applies to attacks against the holder (against: true)`] : []),
      ...(['ignore', 'reduce'].includes(rule.mode) && rule.against ? [`${rule.mode} only applies to the holder's own attacks`] : []),
    ],
  },
  // The Aim bonus on a ranged attack (dice.mjs's Aiming switch): atLeast raises the base ↑1 ("↑2 instead
  // of ↑1"), extra adds on top. Its limit is spent - and clearToggle switched off - only when the shot is
  // fired aimed. `when` sees the roll (item:, weapon:, target:...).
  AimBonus: {
    params: { atLeast: { kind: 'formula' }, extra: { kind: 'formula' }, limit: { kind: 'object' }, clearToggle: { kind: 'string' } },
    scopes: ['self', 'host', 'crew', 'pilot', 'vehicle', 'driven', 'companion', 'owner', 'party', 'team', 'aura'],
    validate: rule => [
      ...(rule.atLeast !== undefined || rule.extra !== undefined ? [] : ['changes nothing']),
      ...limitErrors(rule.limit),
    ],
  },
  // An alternate effect generated on weapons (items/attacks/weapon-upgrades.mjs#desiredGeneratedEffects): a copy of
  // the weapon's primary effect with `changes` (system paths to values) and `formulas` (system paths to
  // formulas; @base.<path> reads the primary's own value). On an upgrade, scope host: its weapon. On a Perk,
  // scope self: every weapon its `items` tags match. `name`: an i18n key or text, where {primary} is the
  // primary's name and {E20.Key} a localized word. `baseTypes`: only when the primary deals one of these;
  // `unlessType`: not when the weapon already prints an effect of that damage type.
  AlternateEffect: {
    params: {
      key: { kind: 'string', required: true },
      name: { kind: 'string', required: true },
      changes: { kind: 'object' },
      formulas: { kind: 'object' },
      items: { kind: 'object' },
      baseTypes: { kind: 'strings' },
      unlessType: { kind: 'string' },
    },
    scopes: ['self', 'host'],
    validate: rule => [
      ...Object.entries(rule.formulas ?? {}).map(([path, formula]) => formulaError(formula) && `formulas.${path}: ${formulaError(formula)}`).filter(Boolean),
      ...(Array.isArray(rule.items) ? unknownTags(rule.items).map(tag => `unknown tag "${tag}" in items`) : []),
      ...(/^[\w-]+$/.test(rule.key ?? '') ? [] : ['key must be a plain name']),
    ],
  },
  // Who may Lend Assistance to whom (mechanics/actions/lend-assistance.mjs#canAssistWithSkill). side: give (the
  // holder helping) or receive (the holder being helped); effect: refuse, anyRank (no need for as many
  // Skill ranks as the ally), or boost - the help grants at least `atLeast` upshifts, `extra` more on
  // top, and/or an Edge (getAssistShiftUp / getAssistEdge); anyRange (receive: helped from any distance);
  // self (give: may Lend Assistance to themselves). `when` sees the other party as target:, the Skill as skill:, its Essence as essence:.
  Assist: {
    params: {
      side: { kind: 'enum', required: true, options: ['give', 'receive'] },
      effect: { kind: 'enum', required: true, options: ['refuse', 'anyRank', 'anyRange', 'self', 'boost'] },
      atLeast: { kind: 'formula' },
      extra: { kind: 'formula' },
      edge: { kind: 'bool' },
    },
    scopes: ['self'],
  },
  // Immune to Conditions (mechanics/combat/condition-immunity.mjs#isImmuneToCondition): the Condition is refused
  // when something tries to apply it. Status ids from CONFIG.statusEffects (frightened, surprised...).
  ConditionImmunity: {
    params: { conditions: { kind: 'strings', required: true } },
    scopes: ['self', 'crew', 'pilot', 'vehicle', 'driven', 'companion', 'owner', 'party', 'team', 'aura'],
    validate: rule => (Array.isArray(rule.conditions) && rule.conditions.length ? [] : ['conditions must list at least one Condition']),
  },
  // Requisition access (mechanics/resources/requisition.mjs): Trained or Qualified in every item the `items` tags
  // match (item:type:weapon, item:data:system.availability=standard, item:name~microtech...).
  // Only ever widens what the character's Role already gives.
  // `upgrades` (item: tags on each upgrade): Qualified in those upgrades - left out of Table 8-2's
  // stacking, so the item they're on is requisitioned at a lower Availability (item:availability<=...).
  Qualification: {
    params: { items: { kind: 'object' }, upgrades: { kind: 'object' }, access: { kind: 'enum', options: ['qualified', 'trained'] } },
    scopes: ['self', 'companion', 'owner', 'party'],
    validate: rule => [
      ...((Array.isArray(rule.items) && rule.items.length) || (Array.isArray(rule.upgrades) && rule.upgrades.length) ? [] : ['items or upgrades must be a list of item: tags']),
      ...(Array.isArray(rule.items) ? unknownTags(rule.items).map(tag => `unknown tag "${tag}" in items`) : []),
      ...(Array.isArray(rule.upgrades) ? unknownTags(rule.upgrades).map(tag => `unknown tag "${tag}" in upgrades`) : []),
    ],
  },
  // Token movement (mechanics/world/rough-terrain.mjs, mechanics/combat/token-movement.mjs): ignore Rough Terrain, and
  // Push Yourself at more feet per Free action, or with no doubling cap.
  // countSinceTypeChange (round 15, items2 - Third Dimension): a move counts only what was walked since the last
  // change of Movement type against the current type's speed (rules/plugins/combat/since-type-change.mjs).
  MovementAction: {
    params: { ignoreRoughTerrain: { kind: 'bool' }, pushFeet: { kind: 'formula' }, pushUnlimited: { kind: 'bool' }, countSinceTypeChange: { kind: 'bool' } },
    scopes: ['self', 'crew', 'pilot', 'vehicle', 'driven', 'companion', 'owner', 'party', 'team', 'aura'],
    validate: rule => (rule.ignoreRoughTerrain || rule.pushFeet || rule.pushUnlimited || rule.countSinceTypeChange ? [] : ['changes nothing']),
  },
  // A number on other items the actor owns - each item the `items` tags match (tested as the rolled
  // item: item:type:weapon, item:source:<uuid>, item:data:system.x>0...). Never the rule's own item.
  ItemModifier: {
    params: {
      items: { kind: 'object', required: true },
      path: { kind: 'string', required: true },
      op: { kind: 'enum', options: ['add', 'set', 'multiply', 'max', 'min'] },
      value: { kind: 'formula', required: true },
    },
    scopes: ['self'],
    validate: rule => [
      ...(Array.isArray(rule.items) && rule.items.length ? [] : ['items must be a list of item: tags']),
      ...(Array.isArray(rule.items) ? unknownTags(rule.items).map(tag => `unknown tag "${tag}" in items`) : []),
      ...(String(rule.path ?? '').startsWith('system.') ? [] : ['path must start with system.']),
    ],
  },
  // Seeing in the dark (mechanics/characters/vision-grant.mjs): offered alongside items' own visionGrant, best range wins.
  Sense: {
    params: {
      mode: { kind: 'enum', options: ['darkvision', 'monochromatic', 'lightAmplification'] },
      range: { kind: 'formula', required: true },
    },
    scopes: ['self', 'crew', 'pilot', 'vehicle', 'driven', 'companion', 'owner', 'party', 'team', 'aura'],
  },
  SurpriseExemption: {
    params: { mode: { kind: 'enum', options: ['normal', 'move', 'speedAsLevel'] } },
    scopes: ['self', 'crew', 'pilot', 'vehicle', 'driven', 'companion', 'owner', 'party', 'team', 'aura'],
  },
  // A cheaper way to pay for an action (rules/actions.mjs) - offered by the action economy when it applies.
  ActionCost: {
    params: {
      action: { kind: 'enum', required: true, options: ACTION_KEYS },
      to: { kind: 'enum', required: true, options: ['none', 'free', 'twoFree', 'move', 'standard'] },
      limit: { kind: 'object' },
      ask: { kind: 'string' },
    },
    scopes: ['self'],
    // day: counted on the actor until a Rest (mechanics/actions/action-perks.mjs); limit.key names the counter (shared with others).
    // round: the combat round (the Talents' "once per round" - book check 2026-10-06, docs/rules-batches/book-limits.md).
    validate: rule => (rule.limit === undefined || ['turn', 'round', 'scene', 'encounter', 'day'].includes(rule.limit?.per) ? [] : ['limit.per must be turn, round, scene, encounter or day']),
  },
  // A Use button (rules/triggers.mjs): pay the cost, count the limit, run the steps.
  Use: {
    params: { cost: { kind: 'object' }, limit: { kind: 'object' }, steps: { kind: 'object', required: true } },
    scopes: ['self'],
    validate: rule => [...costErrors(rule.cost), ...limitErrors(rule.limit), ...stepErrors(rule.steps), ...cardStepErrors(rule.steps)],
  },
  // A button on a posted check card for whoever may answer it (rules/reactions.mjs); its steps may change the card.
  Reaction: {
    params: {
      who: { kind: 'enum', options: ['target', 'attacker', 'allyOfTarget', 'allyOfAttacker', 'enemyOfAttacker'] },
      within: { kind: 'number' },
      per: { kind: 'enum', options: ['row', 'card'] },
      outcome: { kind: 'enum', options: ['any', 'hit', 'miss'] },
      attackOnly: { kind: 'bool' },
      minMargin: { kind: 'number' },
      maxMargin: { kind: 'number' },
      cost: { kind: 'object' },
      limit: { kind: 'object' },
      steps: { kind: 'object', required: true },
    },
    scopes: ['self'],
    validate: rule => [...costErrors(rule.cost), ...limitErrors(rule.limit), ...stepErrors(rule.steps)],
  },
  // Steps that run on an event (rules/triggers.mjs). `prompt` asks the owner first.
  Trigger: {
    params: {
      event: { kind: 'enum', required: true, options: TRIGGER_EVENTS },
      // A list means every one must hold.
      outcome: { kind: 'outcome', options: ['any', 'success', 'failure', 'double', 'crit', 'fumble', 'x2', 'anyFailed', 'allFailed', 'fumbled', 'plainSuccess', 'plainFailure', 'anySucceeded', 'notDouble'] },
      // Fire when the event happens to another actor of that side (rules/triggers.mjs#fireWatchers).
      watch: { kind: 'enum', options: ['ally', 'enemy', 'any'] },
      within: { kind: 'number' },
      watchTarget: { kind: 'enum', options: ['actor', 'theirTarget'] },
      prompt: { kind: 'bool' },
      limit: { kind: 'object' },
      steps: { kind: 'object', required: true },
    },
    // A linked Trigger fires for the actor it reaches (its steps act on them); its limit counts on the holder.
    scopes: ['self', 'crew', 'pilot', 'vehicle', 'driven', 'companion', 'owner', 'party', 'team', 'aura'],
    validate: rule => [...limitErrors(rule.limit), ...stepErrors(rule.steps), ...cardStepErrors(rule.steps)],
  },
};

/** The card-changing steps only work in a Reaction (they need the card). */
function cardStepErrors(steps) {
  const used = CARD_STEPS.filter(type => JSON.stringify(steps ?? []).includes(`"do":"${type}"`));
  return used.length ? [`${used.join(', ')} only work in a Reaction rule`] : [];
}

// always: the rule counts even while its item doesn't (an unequipped weapon's upgrade - rules/index.mjs#collectRules).
const COMMON = ['type', 'label', 'when', 'scope', 'priority', 'disabled', 'stacks', 'radius', 'affects', 'always'];

/**
 * Everything wrong with one rule.
 * @param {Object} rule
 * @returns {Array<String>}   Empty when the rule is fine. An unsupported type is one message.
 */
export function validateRule(rule) {
  if (!rule || typeof rule != 'object' || Array.isArray(rule)) {
    return ['not a rule object'];
  }

  const definition = RULE_TYPES[rule.type];
  if (!definition) {
    return [`type "${rule.type ?? ''}" is not supported yet`];
  }

  const errors = [];
  if (rule.when !== undefined && !Array.isArray(rule.when)) {
    errors.push('when must be a list');
  }

  for (const tag of unknownTags(rule.when)) {
    errors.push(`unknown tag "${tag}"`);
  }

  if (rule.stacks !== undefined && typeof rule.stacks != 'boolean') {
    errors.push('stacks must be true or false');
  }

  if (rule.scope == 'aura') {
    if (rule.radius === undefined) {
      errors.push('an aura needs a radius (feet)');
    }

    const radius = formulaError(rule.radius);
    if (radius) {
      errors.push(`radius: ${radius}`);
    }

    if (rule.affects !== undefined && !['allies', 'enemies', 'all'].includes(rule.affects)) {
      errors.push('affects must be allies, enemies or all');
    }
  }

  if (rule.scope !== undefined && !definition.scopes.includes(rule.scope)) {
    errors.push(`scope "${rule.scope}" can't be used with ${rule.type}`);
  }

  for (const [key, param] of Object.entries(definition.params)) {
    const value = rule[key];
    if (value === undefined || value === null || value === '') {
      if (param.required) {
        errors.push(`${key} is required`);
      }

      continue;
    }

    if (param.kind == 'formula') {
      const error = formulaError(value);
      if (error) {
        errors.push(`${key}: ${error}`);
      }
    } else if (param.kind == 'bool' && typeof value != 'boolean') {
      errors.push(`${key} must be true or false`);
    } else if (param.kind == 'outcome' && ![value].flat().every(one => param.options.includes(one))) {
      errors.push(`${key} must be one (or a list) of ${param.options.join(', ')}`);
    } else if (param.kind == 'enum' && !param.options.includes(value)) {
      errors.push(`${key} must be one of ${param.options.join(', ')}`);
    } else if (param.kind == 'strings' && !(Array.isArray(value) && value.every(v => typeof v == 'string'))) {
      errors.push(`${key} must be a list of names`);
    } else if (param.kind == 'string' && typeof value != 'string') {
      errors.push(`${key} must be text`);
    }
  }

  // A Code rule may carry any settings of its own - its helper reads them.
  for (const key of rule.type == 'Code' ? [] : Object.keys(rule)) {
    if (!COMMON.includes(key) && !definition.params[key]) {
      errors.push(`unknown setting "${key}"`);
    }
  }

  errors.push(...(definition.validate?.(rule) ?? []));
  return errors;
}

/* -------------------------------------------- */
/*  Plain-English summaries                      */
/* -------------------------------------------- */

const loc = key => {
  const text = globalThis.game?.i18n?.localize?.(key);
  return text && text != key ? text : null;
};

/** A localized word, or the fallback when there's no game (tests, the CI script). */
const word = (key, fallback) => loc(key) ?? fallback;

function shiftPhrase(rule) {
  const parts = [];
  const number = value => (isPlainNumber(value) ? String(value).trim() : ` equal to ${amountWords(value)}`);
  if (rule.type == 'DialogSwitch' && rule.damage) {
    parts.push(`${signed(rule.damage)} damage`);
  }

  if (rule.type == 'DialogSwitch' && rule.useSkill) {
    parts.push(`roll ${skillName(rule.useSkill)} instead`);
  }

  if (rule.upshift) {
    parts.push(`↑${number(rule.upshift)}`);
  }

  if (rule.downshift) {
    parts.push(`↓${number(rule.downshift)}`);
  }

  if (rule.edge) {
    parts.push('Edge');
  }

  if (rule.snag) {
    parts.push('Snag');
  }

  if (rule.specialize) {
    parts.push('Specialized');
  }

  if (rule.ignoreDownshift) {
    parts.push(`ignores ${rule.ignoreDownshift} ↓`);
  }

  if (rule.immune?.length) {
    parts.push(`ignores ${rule.immune.map(kind => (kind == 'snag' ? 'Snags' : 'downshifts')).join(' and ')}`);
  }

  return parts.join(', ');
}

/**
 * One line for the Rules tab: "↑1 on Might tests, while Morphed".
 * @param {Object} rule
 * @returns {String}
 */
export function summarizeRule(rule) {
  if (!rule || typeof rule != 'object') {
    return '';
  }

  const when = describeWhen(rule.when);
  const tail = when ? ` ${when}` : '';
  const who = {
    incoming: 'Rolls against you: ', host: 'Attached item: ', item: 'Rolling this: ', crew: 'Its crew: ', pilot: 'Its driver: ', vehicle: 'Their vehicle: ', driven: 'The vehicle they drive: ', companion: 'Their companions: ', owner: 'Its owner: ', party: 'Their Party: ',
    aura: `${{ enemies: 'Enemies', all: 'Everyone' }[rule.affects] ?? 'Allies'} within ${rule.radius ?? '?'} ft: `,
  }[rule.scope] ?? '';
  switch (rule.type) {
  case 'RollModifier': return `${who}${shiftPhrase(rule)}${tail}${limitPhrase(rule.limit)}`;
  case 'DialogSwitch': return `Roll option "${rule.label ?? ''}": ${shiftPhrase(rule)}${tail}${limitPhrase(rule.limit)}`;
  case 'Reroll': return `Reroll (${rule.mode ?? 'all'})${rule.skills?.length ? ` on ${rule.skills.map(skillName).join(', ')}` : ''}${rule.reset && rule.reset != 'none' ? `, once per ${rule.reset}` : ''}`;
  case 'SkillSubstitution': return `${who}${rule.mode == 'bestOf' ? 'Better of' : 'Use'} ${skillName(rule.to)} ${rule.mode == 'bestOf' ? 'and' : 'for'} ${skillName(rule.from)}${tail}`;
  case 'Defense': {
    const name = rule.defense == 'any' ? 'every Defense' : word(`E20.Defense${capital(rule.defense)}`, capital(rule.defense));
    const lead = rule.outgoing ? "Target's " : who;
    switch (rule.mode ?? 'add') {
    case 'best': return `${lead}${name}: the better of it and ${(rule.from ?? []).join(' / ')}${tail}`;
    case 'halve': return `${lead}${name} halved${tail}`;
    case 'fail': return `${lead}${name} can't be beaten${tail}`;
    }

    return `${lead}${signed(rule.amount)} ${isPlainNumber(rule.amount ?? 0) ? '' : 'to '}${name}${tail}`;
  }

  case 'DerivedStat': return `${who}${statChange(rule.op, rule.value, pathName(rule.path))}${tail}`;
  case 'DamageModifier': return `${who}${rule.immune ? 'Immune to' : `${signed(rule.amount)}`} ${rule.damageType ? `${rule.damageType} ` : ''}damage ${rule.direction == 'dealt' ? 'dealt' : 'taken'}${tail}`;
  case 'Grant': return `Grants ${rule.label ?? itemName(rule.uuid)}`;
  case 'Toggle': return `Toggle: ${rule.label ?? humanize(rule.key)}`;
  case 'Pool': return `Pool: ${rule.label ?? humanize(rule.key)} (max ${rule.max}${rule.reset && rule.reset != 'none' ? `, resets each ${rule.reset}` : ''})`;
  case 'ChoiceSet': return `Choice: ${rule.label ?? humanize(rule.key)} (${rule.from})`;
  case 'Code': return `Runs ${humanize(rule.helper)}`;
  case 'CriticalOption': return rule.improve !== undefined
    ? `Critical Effects +${rule.improve} step${tail}`
    : `Critical Effect: ${rule.essence ? `1 ${humanize(rule.essence)} Essence damage` : rule.status ? humanize(rule.status) : rule.effect ? humanize(rule.effect) : `${rule.damageValue ?? 1}${rule.damageType ? ` ${rule.damageType}` : ''} damage`}${tail}`;
  case 'WeaponTrait': return `Weapons${rule.items?.length ? ` where ${itemClauses(rule.items)}` : ''} gain ${(rule.traits ?? []).map(humanize).join(', ')}${tail}`;
  case 'Hardpoints': return `Hardpoints: ${[
    rule.external && `+${rule.external} External`, rule.integrated && `+${rule.integrated} Integrated`,
    rule.nonWeapon && `+${rule.nonWeapon} Non-Weapon`, rule.perWeapon && `+${rule.perWeapon} per Integrated weapon`,
    rule.reinforced && 'Integrated weapons fire as Reinforced',
  ].filter(Boolean).join('; ')}${tail}`;
  case 'AttackCount': return `${who}${rule.additional !== undefined ? (isPlainNumber(rule.additional) ? `+${rule.additional} attack(s)` : `extra attacks equal to ${amountWords(rule.additional)}`) : isPlainNumber(rule.count) ? `${rule.count} attacks` : `attacks equal to ${amountWords(rule.count)}`} per Attack action${tail}`;
  case 'CritOnD2': return `${who}Can critically succeed on the d2${tail}`;
  case 'Movement': return `${who}${statChange(rule.op, rule.value, rule.movement == 'all' ? 'Every Movement' : `${humanize(rule.movement ?? '')} Movement`, true)}${tail}`;
  case 'DamageType': return `${who}Deals ${rule.to == 'choice' ? 'the chosen' : rule.to} damage${tail}`;
  case 'RollDice': return `${who}${[
    rule.d20Floor && `d20s show at least ${rule.d20Floor}`,
    rule.thirdD20 && 'a third d20',
    rule.maxDie && `Skill Die at most ${rule.maxDie}`,
    rule.stepUp && `one step up (${rule.stepUp})`,
  ].filter(Boolean).join(', ')}${tail}`;
  case 'DieSubstitution': return `${who}${{
    use: `Roll the ${(rule.skills ?? []).map(skillName).join('/')} die`,
    best: `Best die of ${['rolled', ...(rule.skills ?? []).map(skillName)].join(' / ')}`,
    floor: `At least a ${rule.die} die`,
  }[rule.mode] ?? 'Die'}${rule.specialize ? ', Specialized' : ''}${rule.clearSnag ? ', no Snag' : ''}${tail}`;
  case 'Cover': return `${who}${{
    ignore: 'Ignores Cover',
    reduce: `Cover ↓${rule.amount} less on its attacks`,
    grant: 'Counts as in Cover',
    base: `Cover is ↓${rule.amount} against it`,
    add: `Cover ↓${rule.amount} more against it`,
  }[rule.mode] ?? 'Cover'}${tail}`;
  case 'AimBonus': return `${who}Aiming gives ${[rule.atLeast !== undefined && `at least ↑${rule.atLeast}`, rule.extra !== undefined && `+↑${rule.extra}`].filter(Boolean).join(', ')}${tail}${limitPhrase(rule.limit)}`;
  case 'AlternateEffect': return `${who}${rule.scope == 'host' ? 'This weapon' : 'Matching weapons'} gain an alternate effect (${humanize(rule.key)})${tail}`;
  case 'Assist': return `${who}${rule.side == 'receive' ? 'Being helped' : 'Helping'}: ${{ refuse: "can't Lend Assistance", anyRank: 'Lend Assistance at any Skill rank', anyRange: 'from any distance', self: 'can help themselves' }[rule.effect] ?? [
    rule.atLeast !== undefined && `at least ↑${rule.atLeast}`, rule.extra !== undefined && `+↑${rule.extra}`, rule.edge && 'Edge',
  ].filter(Boolean).join(', ')}${tail}`;
  case 'ConditionImmunity': return `${who}Immune to ${(rule.conditions ?? []).join(', ')}${tail}`;
  case 'Qualification': return `${who}${rule.access == 'trained' ? 'Trained' : 'Qualified'} in ${[
    rule.items?.length && `items where ${itemClauses(rule.items)}`,
    rule.upgrades?.length && `upgrades where ${itemClauses(rule.upgrades)}`,
  ].filter(Boolean).join('; ')}${tail}`;
  case 'MovementAction': return `${who}${[
    rule.ignoreRoughTerrain && 'Ignores Rough Terrain',
    rule.pushFeet && `Push Yourself adds ${rule.pushFeet} ft per Free action`,
    rule.pushUnlimited && 'Push Yourself has no limit',
  ].filter(Boolean).join('; ')}${tail}`;
  case 'ItemModifier': return `${statChange(rule.op, rule.value, pathName(rule.path))} on items${rule.items?.length ? ` where ${itemClauses(rule.items)}` : ''}${tail}`;
  case 'Sense': return `${who}Sees in the dark to ${rule.range} ft${rule.mode && rule.mode != 'darkvision' ? ` (${rule.mode})` : ''}${tail}`;
  case 'SurpriseExemption': return `${who}${{ move: 'When Surprised, can still Move and make Skill Tests', speedAsLevel: 'When Surprised, acts with Speed equal to level' }[rule.mode] ?? 'Acts normally when Surprised'}${tail}`;
  case 'ActionCost': return `${word(`E20.Rules.Field.Action.${rule.action}`, humanize(rule.action))} costs ${rule.to == 'none' ? 'no action' : `a ${capital(rule.to)} action`}${limitPhrase(rule.limit)}${tail ? `,${tail}` : ''}`;
  case 'Reaction': return `Card button for ${{ attacker: 'the attacker', allyOfTarget: "the target's allies", allyOfAttacker: "the attacker's allies", enemyOfAttacker: "the attacker's enemies" }[rule.who] ?? 'the target'}${Number(rule.within) > 0 ? ` within ${rule.within} ft` : ''}${rule.outcome && rule.outcome != 'any' ? ` (on a ${rule.outcome})` : ''}${rule.attackOnly ? ', attacks only' : ''}${costPhrase(rule.cost)}${limitPhrase(rule.limit)}${tail ? `,${tail}` : ''}: ${stepWords(rule.steps)}`;
  case 'Use': return `Use: ${rule.label ?? ''}${costPhrase(rule.cost)}${limitPhrase(rule.limit)}${tail ? `,${tail}` : ''}`;
  case 'Trigger': return `When ${rule.watch ? `${{ ally: 'an ally', enemy: 'an enemy', any: 'someone else' }[rule.watch] ?? humanize(rule.watch).toLowerCase()}${Number(rule.within) > 0 ? ` within ${rule.within} ft` : ''} - ` : ''}${EVENT_WORDS[rule.event] ?? humanize(rule.event).toLowerCase()}${['afterRoll', 'hit'].includes(rule.event) && rule.outcome && rule.outcome != 'any' ? ` (${humanize(rule.outcome).toLowerCase()})` : ''}${tail ? `,${tail}` : ''}: ${stepWords(rule.steps)}${limitPhrase(rule.limit)}`;
  }

  // A plug-in type: its own summary if it gives one, else the rule's label (or the type in words).
  const plugin = RULE_TYPES[rule.type];
  if (plugin) {
    const own = typeof plugin.summary == 'function' ? plugin.summary(rule, { who, tail }) : null;
    if (own) {
      return own;
    }

    const label = rule.label ? String(rule.label) : '';
    const text = label.startsWith('E20.') ? word(label, humanize(rule.type)) : label || humanize(rule.type);
    return `${who}${text}${tail ? `,${tail}` : ''}`;
  }

  return `${rule.type ?? 'Rule'} (not supported yet)`;
}

const capital = text => String(text ?? '').charAt(0).toUpperCase() + String(text ?? '').slice(1);
const lowerFirstWord = text => (/^[A-Z][a-z]+$/.test(String(text)) ? String(text).toLowerCase() : String(text));

function signed(value) {
  if (typeof value == 'number') {
    return value < 0 ? `${value}` : `+${value}`;
  }

  if (!value) {
    return '+0';
  }

  if (isPlainNumber(value)) {
    return signed(Number(value));
  }

  const { text, negative } = formulaWords(value);
  return `${negative ? '-' : '+'} ${text}`;
}

const isPlainNumber = value => typeof value == 'number' || /^-?\d+(\.\d+)?$/.test(String(value ?? '').trim());

/** A stored object set by a rule: {type: 'sharp', value: 1} -> "1 Sharp"; {inhaled: true} -> "Inhaled". */
function objectWords(value) {
  if (value.type !== undefined && value.value !== undefined && Object.keys(value).length == 2) {
    return `${amountWords(value.value)} ${humanize(String(value.type))}`;
  }

  const parts = Object.entries(value).filter(([, v]) => v !== false && v !== null && v !== '')
    .map(([key, v]) => (v === true ? humanize(key) : `${humanize(key).toLowerCase()} ${typeof v == 'object' ? 'set' : humanize(String(v))}`));
  return parts.length ? parts.join(', ') : 'nothing';
}

/** An amount as words: 2, or "your level" for a formula. */
const amountWords = value => (isPlainNumber(value) ? String(value).trim() : formulaWords(value).text);

/** A stat changed by a rule: "+2 maximum Health", "Ground Movement +10", "Size becomes Huge". */
function statChange(op, value, label, after = false) {
  const shown = isPlainNumber(value) ? value : typeof value == 'string' && !/[@(]/.test(value) ? humanize(value)
    : value && typeof value == 'object' ? objectWords(value) : formulaWords(value).text;
  const formula = !isPlainNumber(value);
  if (typeof value == 'boolean') {
    return value ? `Gains ${label}` : `Loses ${label}`;
  }

  switch (op ?? 'add') {
  case 'add': return after ? `${label} ${signed(value)}` : formula ? `${signed(value)} to ${label}` : `${signed(Number(value))} ${label}`;
  case 'set': return value === true ? `Gains ${label}` : value === false ? `Loses ${label}` : `${capital(label)} becomes ${shown}`;
  case 'multiply': return `${capital(label)} ×${shown}`;
  case 'max': return `${capital(label)} at least ${shown}`;
  case 'min': return `${capital(label)} at most ${shown}`;
  }

  return `${capital(label)}: ${humanize(op).toLowerCase()} ${shown}`;
}

/** A Trigger's / Reaction's steps as words: "apply condition, chat". */
const stepWords = steps => (steps ?? []).map(step => humanize(step?.do).toLowerCase()).join(', ');

const EVENT_WORDS = {
  targeted: 'you are attacked or rolled against', dealtDamage: 'your damage lands on someone', defeatedEnemy: 'your damage Defeats someone',
  turnStart: 'your turn starts', turnEnd: 'your turn ends', roundStart: 'a round starts', rest: 'you rest',
  sceneStart: 'a scene starts', missionStart: 'a mission starts', takesDamage: 'you take damage',
  wouldBeDefeated: 'you would be Defeated', defeated: 'you are Defeated', morph: 'you Morph', unmorph: 'you un-Morph',
  transform: 'you change to Alt Mode', untransform: 'you change to Bot Mode', afterRoll: 'you roll', hit: 'an attack or spell hits', miss: 'an attack or spell misses', added: 'this item is added', conditionGained: 'you gain a Condition',
  lendAssistance: 'you Lend Assistance', assisted: 'someone Lends you Assistance',
  combatStart: 'combat starts', combatEnd: 'combat ends', initiativeRolled: 'you roll Initiative', storyPointSpent: 'you spend a Story Point',
  equipped: 'this item is equipped', unequipped: 'this item is unequipped', essenceChanged: 'an Essence goes up or down',
  resourceSpent: 'you spend Power, Energon or Health', sessionStart: 'a new game session starts', itemAdded: 'another item is added', movedOnTurn: 'you move on your turn', removed: 'this item is removed',
  droppedToZero: 'your Health or Power drops to 0',
};

function costPhrase(cost) {
  if (!cost) {
    return '';
  }

  const parts = [];
  if (cost.action && cost.action != 'none') {
    parts.push(`${capital(cost.action)} action`);
  }

  if (cost.resource) {
    parts.push(`${isPlainNumber(cost.amount ?? 1) ? cost.amount ?? 1 : amountWords(cost.amount)} ${cost.resource.storyPoints ? 'Story Point' : cost.resource.rolePoints ? 'Role Point' : cost.resource.pool ? lowerFirstWord(humanize(cost.resource.pool)) : pathName(cost.resource.path)}`);
  }

  return parts.length ? ` (${parts.join(', ')})` : '';
}

function limitPhrase(limit) {
  const most = isPlainNumber(limit?.max ?? 1) ? `${limit?.max ?? 1}/${limit?.per}` : `up to ${amountWords(limit.max)} per ${limit.per}`;
  return limit?.per ? `, ${most}${limit.onlyOnSuccess ? ' (on a success)' : ''}` : '';
}
