import { CHECK_NAMES } from "./predicate.mjs";
import { ACTION_KEYS, RULE_TYPES, TRIGGER_EVENTS } from "./types.mjs";
import { LIMIT_WINDOWS } from "./limits.mjs";
import { STEP_TYPES } from "./steps.mjs";

/**
 * What the guided rule editor (apps/rule-editor.mjs) shows for each rule type and each step - a
 * plain description of fields, read by editor-render.mjs. Kept apart from the catalogue
 * (rules/types.mjs) on purpose: the catalogue says what is valid, this says how to ask for it in
 * game words. A test checks they cover the same settings, so neither drifts.
 *
 * Field: {path, kind, label, options?, showIf?, hint?}
 *   path     where the value lives in the rule (dots for nesting: "cost.action")
 *   kind     text | number | formula | checkbox | select | tags | resource | steps | choices | strings
 *            | skills | stacks
 *   label    i18n key under E20.Rules.Field (falls back to the path)
 *   options  for select: a list of [value, labelKey], or the name of a list from OPTION_LISTS
 *   showIf   (rule) => Boolean - the field is only shown when this holds
 *
 * Plain Node safe.
 */

/** Lists filled from CONFIG.E20 at render time (editor-render.mjs#optionList). */
export const OPTION_LISTS = ['skills', 'essences', 'defenses', 'damageTypes', 'statuses', 'rerollModes', 'rerollTargets', 'rerollResets'];

const SHIFTS = [
  { path: 'upshift', kind: 'formula', label: 'Upshift' },
  { path: 'downshift', kind: 'formula', label: 'Downshift' },
  { path: 'edge', kind: 'checkbox', label: 'Edge' },
  { path: 'snag', kind: 'checkbox', label: 'Snag' },
  { path: 'specialize', kind: 'checkbox', label: 'Specialize' },
];

const LIMIT = [
  { path: 'limit.per', kind: 'select', label: 'LimitPer', options: [['', 'LimitNone'], ...LIMIT_WINDOWS.map(w => [w, `Window.${w}`])] },
  { path: 'limit.max', kind: 'formula', label: 'LimitMax', showIf: rule => !!rule.limit?.per },
  { path: 'limit.key', kind: 'text', label: 'LimitKey', showIf: rule => !!rule.limit?.per, advanced: true },
  { path: 'limit.onlyOnSuccess', kind: 'checkbox', label: 'LimitOnSuccess', showIf: rule => !!rule.limit?.per && rule.type == 'Use', advanced: true },
];

/** Fields every rule has, shown after its own. */
export const COMMON_FIELDS = [
  { path: 'label', kind: 'text', label: 'Label' },
  { path: 'when', kind: 'tags', label: 'When' },
  { path: 'scope', kind: 'select', label: 'ScopeLabel', options: 'scopes', showIf: rule => (RULE_TYPES[rule.type]?.scopes?.length ?? 0) > 1 },
  { path: 'radius', kind: 'formula', label: 'AuraRadius', showIf: rule => rule.scope == 'aura' },
  { path: 'affects', kind: 'select', label: 'AuraAffects', options: [['allies', 'AffectsAllies'], ['enemies', 'AffectsEnemies'], ['all', 'AffectsAll']], showIf: rule => rule.scope == 'aura' },
  { path: 'stacks', kind: 'stacks', label: 'Stacks', advanced: true },
  { path: 'priority', kind: 'number', label: 'Priority', advanced: true },
  { path: 'disabled', kind: 'checkbox', label: 'Disabled' },
];

/** Each rule type's own fields, in the order they are asked. */
export const RULE_FORMS = {
  RollModifier: [
    ...SHIFTS,
    { path: 'ignoreDownshift', kind: 'formula', label: 'IgnoreDownshift' },
    { path: 'immune', kind: 'strings', label: 'Immune', hint: 'ImmuneHint' },
    { path: 'late', kind: 'checkbox', label: 'LateModifier', advanced: true },
    ...LIMIT,
    { path: 'stack', kind: 'text', label: 'StackGroup', advanced: true },
  ],
  DialogSwitch: [...SHIFTS, { path: 'default', kind: 'checkbox', label: 'DefaultOn' }, { path: 'damage', kind: 'formula', label: 'SwitchDamage' }, { path: 'forget', kind: 'checkbox', label: 'SwitchForget', advanced: true }, { path: 'key', kind: 'text', label: 'SwitchKey', hint: 'SwitchKeyHint', advanced: true }, { path: 'clearSnag', kind: 'checkbox', label: 'SwitchClearSnag', advanced: true }, { path: 'useSkill', kind: 'select', label: 'UseSkillInstead', options: [['', 'NoSkillSwap'], 'skills'], advanced: true }, { path: 'replacesAim', kind: 'checkbox', label: 'ReplacesAim', advanced: true }, { path: 'cost.resource', kind: 'resource', label: 'SwitchCost', advanced: true }, { path: 'cost.amount', kind: 'formula', label: 'Amount', advanced: true }, { path: 'spend.resource', kind: 'resource', label: 'SpendResource', advanced: true }, { path: 'spend.max', kind: 'formula', label: 'SpendMax', advanced: true }],
  Reroll: [
    { path: 'mode', kind: 'select', label: 'RerollMode', options: 'rerollModes' },
    { path: 'target', kind: 'select', label: 'RerollTarget', options: 'rerollTargets' },
    { path: 'reset', kind: 'select', label: 'RerollReset', options: 'rerollResets' },
    { path: 'maxUses', kind: 'formula', label: 'MaxUses' },
    { path: 'skills', kind: 'skills', label: 'OnlySkills' },
    { path: 'cost.resourcePath', kind: 'text', label: 'CostPath', advanced: true },
    { path: 'cost.amount', kind: 'number', label: 'CostAmount', advanced: true },
  ],
  SkillSubstitution: [
    { path: 'from', kind: 'select', label: 'From', options: [['*', 'AnySkill'], 'skills'] },
    { path: 'to', kind: 'select', label: 'To', options: 'skills' },
    { path: 'mode', kind: 'select', label: 'SubstitutionMode', options: [['replace', 'ModeReplace'], ['bestOf', 'ModeBestOf']] },
  ],
  Defense: [
    { path: 'defense', kind: 'select', label: 'Defense', options: [['any', 'EveryDefense'], 'defenses'] },
    { path: 'mode', kind: 'select', label: 'DefenseMode', options: ['add', 'best', 'halve', 'fail'].map(mode => [mode, `DefenseModes.${mode}`]) },
    { path: 'amount', kind: 'formula', label: 'Amount', showIf: rule => (rule.mode ?? 'add') == 'add' },
    { path: 'from', kind: 'strings', label: 'DefenseFrom', showIf: rule => rule.mode == 'best' },
    { path: 'outgoing', kind: 'checkbox', label: 'DefenseOutgoing', advanced: true },
    { path: 'stack', kind: 'text', label: 'StackGroup', advanced: true },
  ],
  DerivedStat: [
    { path: 'path', kind: 'select', label: 'Stat', options: 'derivedPaths', allowCustom: true },
    { path: 'op', kind: 'select', label: 'Op', options: [['add', 'OpAdd'], ['set', 'OpSet'], ['multiply', 'OpMultiply'], ['max', 'OpMax'], ['min', 'OpMin']] },
    { path: 'value', kind: 'formula', label: 'Value' },
  ],
  DamageModifier: [
    { path: 'direction', kind: 'select', label: 'Direction', options: [['taken', 'DamageTaken'], ['dealt', 'DamageDealt']] },
    { path: 'damageType', kind: 'select', label: 'DamageType', options: [['', 'AnyDamage'], 'damageTypes'] },
    { path: 'amount', kind: 'formula', label: 'Amount' },
    { path: 'immune', kind: 'checkbox', label: 'Immune', showIf: rule => rule.direction != 'dealt' },
    { path: 'scaled', kind: 'checkbox', label: 'ScaledDamage', showIf: rule => rule.direction == 'dealt' },
  ],
  Grant: [
    { path: 'uuid', kind: 'text', label: 'ItemUuid', hint: 'DropHint' },
    { path: 'skipIfOwned', kind: 'checkbox', label: 'SkipIfOwned' },
  ],
  Toggle: [
    { path: 'key', kind: 'text', label: 'Key' },
    { path: 'default', kind: 'checkbox', label: 'DefaultOn' },
  ],
  Pool: [
    { path: 'key', kind: 'text', label: 'Key' },
    { path: 'max', kind: 'formula', label: 'Max' },
    { path: 'reset', kind: 'select', label: 'Reset', options: [['none', 'ResetNone'], ['scene', 'Window.scene'], ['mission', 'Window.mission'], ['rest', 'Window.rest']] },
  ],
  ChoiceSet: [
    { path: 'key', kind: 'text', label: 'Key' },
    { path: 'from', kind: 'select', label: 'ChoiceFrom', options: [['skill', 'FromSkill'], ['essence', 'FromEssence'], ['defense', 'FromDefense'], ['list', 'FromList'], ['text', 'FromText']] },
    { path: 'options', kind: 'strings', label: 'ChoiceOptions', showIf: rule => rule.from == 'list' },
  ],
  Code: [
    { path: 'helper', kind: 'select', label: 'Helper', options: 'helpers', allowCustom: true },
  ],
  Qualification: [
    { path: 'items', kind: 'tags', label: 'WhichItems' },
    { path: 'access', kind: 'select', label: 'Access', options: [['qualified', 'AccessQualified'], ['trained', 'AccessTrained']] },
  ],
  CriticalOption: [
    { path: 'damageValue', kind: 'formula', label: 'CritAmount' },
    { path: 'damageType', kind: 'select', label: 'DamageType', options: 'damageTypes' },
    { path: 'essence', kind: 'select', label: 'CritEssence', options: [['', 'CritNone'], 'essences'] },
    { path: 'status', kind: 'select', label: 'CritStatus', options: [['', 'CritNone'], 'statuses'] },
    { path: 'effect', kind: 'select', label: 'CritEffect', options: [['', 'CritNone'], ['bonusAttack', 'CritBonusAttack'], ['blazingStrikes', 'CritBlazing'], ['nextAttackSnag', 'CritNextSnag']], advanced: true },
    { path: 'improve', kind: 'formula', label: 'CritImprove' },
  ],
  WeaponTrait: [
    { path: 'traits', kind: 'strings', label: 'TraitsGiven' },
    { path: 'items', kind: 'tags', label: 'WhichItems' },
  ],
  Hardpoints: [
    { path: 'external', kind: 'formula', label: 'HardpointsExternal' },
    { path: 'integrated', kind: 'formula', label: 'HardpointsIntegrated' },
    { path: 'nonWeapon', kind: 'formula', label: 'HardpointsNonWeapon' },
    { path: 'perWeapon', kind: 'formula', label: 'HardpointsPerWeapon', advanced: true },
    { path: 'reinforced', kind: 'checkbox', label: 'HardpointsReinforced' },
    { path: 'items', kind: 'tags', label: 'WhichItems', showIf: rule => !!rule.reinforced },
  ],
  AttackCount: [
    { path: 'count', kind: 'formula', label: 'AttacksTotal' },
    { path: 'additional', kind: 'formula', label: 'AttacksAdditional' },
  ],
  CritOnD2: [],
  Movement: [
    { path: 'movement', kind: 'select', label: 'MovementType', options: ['ground', 'aerial', 'climb', 'swim', 'burrow', 'all'].map(type => [type, `MovementTypes.${type}`]) },
    { path: 'op', kind: 'select', label: 'Op', options: [['add', 'OpAdd'], ['set', 'OpSet'], ['multiply', 'OpMultiply'], ['max', 'OpMax'], ['min', 'OpMin']] },
    { path: 'value', kind: 'formula', label: 'Amount' },
    { path: 'stage', kind: 'select', label: 'MovementStage', options: ['final', 'base', 'total', 'adjust'].map(stage => [stage, `MovementStages.${stage}`]), advanced: true },
  ],
  DamageType: [
    { path: 'to', kind: 'select', label: 'DamageTypeTo', options: [['choice', 'DamageTypeChoice'], 'damageTypes'] },
  ],
  RollDice: [
    { path: 'thirdD20', kind: 'checkbox', label: 'ThirdD20' },
    { path: 'd20Floor', kind: 'formula', label: 'D20Floor' },
    { path: 'maxDie', kind: 'text', label: 'MaxDie' },
    { path: 'stepUp', kind: 'formula', label: 'StepUp' },
  ],
  DieSubstitution: [
    { path: 'mode', kind: 'select', label: 'DieMode', options: ['use', 'best', 'floor'].map(mode => [mode, `DieModes.${mode}`]) },
    { path: 'skills', kind: 'strings', label: 'DieSkills', hint: 'DieSkillsHint', showIf: rule => rule.mode != 'floor' },
    { path: 'die', kind: 'text', label: 'DieFloor', showIf: rule => rule.mode == 'floor' },
    { path: 'specialize', kind: 'checkbox', label: 'Specialize' },
    { path: 'clearSnag', kind: 'checkbox', label: 'SwitchClearSnag' },
  ],
  Cover: [
    { path: 'mode', kind: 'select', label: 'CoverMode', options: ['ignore', 'reduce', 'grant', 'base', 'add'].map(mode => [mode, `CoverModes.${mode}`]) },
    { path: 'amount', kind: 'formula', label: 'Amount', showIf: rule => ['reduce', 'base', 'add'].includes(rule.mode) },
    { path: 'against', kind: 'checkbox', label: 'CoverAgainst' },
  ],
  AimBonus: [
    { path: 'atLeast', kind: 'formula', label: 'AimAtLeast' },
    { path: 'extra', kind: 'formula', label: 'AimExtra' },
    { path: 'clearToggle', kind: 'text', label: 'AimClearToggle', advanced: true },
  ],
  AlternateEffect: [
    { path: 'key', kind: 'text', label: 'Key' },
    { path: 'name', kind: 'text', label: 'AltEffectName' },
    { path: 'items', kind: 'tags', label: 'AltEffectItems' },
    { path: 'baseTypes', kind: 'strings', label: 'AltEffectBaseTypes', advanced: true },
    { path: 'unlessType', kind: 'text', label: 'AltEffectUnlessType', advanced: true },
  ],
  Assist: [
    { path: 'side', kind: 'select', label: 'AssistSide', options: [['give', 'AssistGive'], ['receive', 'AssistReceive']] },
    { path: 'effect', kind: 'select', label: 'AssistEffect', options: [['refuse', 'AssistRefuse'], ['anyRank', 'AssistAnyRank'], ['anyRange', 'AssistAnyRange'], ['self', 'AssistSelf'], ['boost', 'AssistBoost']] },
    { path: 'atLeast', kind: 'formula', label: 'AssistAtLeast' },
    { path: 'extra', kind: 'formula', label: 'AssistExtra' },
    { path: 'edge', kind: 'checkbox', label: 'AssistEdge' },
  ],
  ConditionImmunity: [
    { path: 'conditions', kind: 'strings', label: 'ConditionsList', hint: 'ConditionsHint' },
  ],
  MovementAction: [
    { path: 'ignoreRoughTerrain', kind: 'checkbox', label: 'IgnoreRoughTerrain' },
    { path: 'pushFeet', kind: 'formula', label: 'PushFeet' },
    { path: 'pushUnlimited', kind: 'checkbox', label: 'PushUnlimited' },
  ],
  ItemModifier: [
    { path: 'items', kind: 'tags', label: 'WhichItems' },
    { path: 'path', kind: 'text', label: 'Stat' },
    { path: 'op', kind: 'select', label: 'Op', options: [['add', 'OpAdd'], ['set', 'OpSet'], ['multiply', 'OpMultiply'], ['max', 'OpMax'], ['min', 'OpMin']] },
    { path: 'value', kind: 'formula', label: 'Value' },
  ],
  Sense: [
    { path: 'mode', kind: 'select', label: 'VisionMode', options: 'visionModes' },
    { path: 'range', kind: 'formula', label: 'RangeFeet' },
  ],
  SurpriseExemption: [
    { path: 'mode', kind: 'select', label: 'SurpriseMode', options: [['normal', 'SurpriseNormal'], ['move', 'SurpriseMove'], ['speedAsLevel', 'SurpriseSpeedAsLevel']] },
  ],
  ActionCost: [
    { path: 'action', kind: 'select', label: 'ActionName', options: ACTION_KEYS.map(key => [key, `Action.${key}`]) },
    { path: 'to', kind: 'select', label: 'CostsInstead', options: [['none', 'CostNone'], ['free', 'ActionFree'], ['twoFree', 'ActionTwoFree'], ['move', 'ActionMove'], ['standard', 'ActionStandard']] },
    { path: 'limit.per', kind: 'select', label: 'LimitPer', options: [['', 'LimitNone'], ['turn', 'Window.turn'], ['scene', 'Window.scene'], ['encounter', 'Window.encounter']] },
    { path: 'limit.max', kind: 'formula', label: 'LimitMax', showIf: rule => !!rule.limit?.per },
    { path: 'ask', kind: 'text', label: 'AskQuestion' },
  ],
  Use: [
    { path: 'cost.action', kind: 'select', label: 'CostAction', options: [['none', 'ActionNone'], ['free', 'ActionFree'], ['move', 'ActionMove'], ['standard', 'ActionStandard']] },
    { path: 'cost.resource', kind: 'resource', label: 'CostResource' },
    { path: 'cost.amount', kind: 'formula', label: 'CostAmount', showIf: rule => !!rule.cost?.resource },
    ...LIMIT,
    { path: 'steps', kind: 'steps', label: 'Steps' },
  ],
  Trigger: [
    { path: 'event', kind: 'select', label: 'EventLabel', options: TRIGGER_EVENTS.map(event => [event, `Event.${event}`]) },
    { path: 'outcome', kind: 'select', label: 'OutcomeLabel', options: ['any', 'success', 'failure', 'double', 'crit', 'fumble', 'x2', 'anyFailed', 'allFailed', 'fumbled'].map(o => [o, `Outcome.${o}`]), showIf: rule => ['afterRoll', 'hit'].includes(rule.event) },
    { path: 'prompt', kind: 'checkbox', label: 'Prompt' },
    ...LIMIT,
    { path: 'steps', kind: 'steps', label: 'Steps' },
  ],
};

const TO = { path: 'to', kind: 'select', label: 'Recipient', options: [['self', 'ToSelf'], ['target', 'ToTarget'], ['targets', 'ToTargets'], ['targetOrSelf', 'ToTargetOrSelf']] };

/** Each step's fields. */
export const STEP_FORMS = {
  chat: [{ path: 'text', kind: 'text', label: 'Text', hint: 'ChatHint' }],
  spend: [{ path: 'resource', kind: 'resource', label: 'Resource' }, { path: 'amount', kind: 'formula', label: 'Amount' }, { path: 'onFail', kind: 'steps', label: 'OnFail' }],
  gainResource: [{ path: 'resource', kind: 'resource', label: 'Resource' }, { path: 'amount', kind: 'formula', label: 'Amount' }],
  heal: [TO, { path: 'amount', kind: 'formula', label: 'Amount' }, { path: 'temporary', kind: 'checkbox', label: 'HealTemporary' }],
  loseHealth: [TO, { path: 'amount', kind: 'formula', label: 'Amount' }],
  damage: [TO, { path: 'amount', kind: 'formula', label: 'Amount' }, { path: 'damageType', kind: 'select', label: 'DamageType', options: 'damageTypes' }],
  applyCondition: [TO, { path: 'condition', kind: 'select', label: 'Condition', options: 'statuses' }, { path: 'rounds', kind: 'formula', label: 'Rounds' }],
  removeCondition: [TO, { path: 'condition', kind: 'select', label: 'Condition', options: 'statuses' }],
  roll: [
    { path: 'skill', kind: 'select', label: 'Skill', options: 'skills' },
    { path: 'dif', kind: 'formula', label: 'Difficulty' },
    { path: 'difDefense', kind: 'select', label: 'DifDefense', options: [['', 'DifFixed'], 'defenses'] },
    { path: 'edge', kind: 'checkbox', label: 'RollEdge', advanced: true },
    { path: 'edgeWhen', kind: 'tags', label: 'RollEdgeWhen', advanced: true },
    { path: 'onSuccess', kind: 'steps', label: 'OnSuccess' },
    { path: 'onFail', kind: 'steps', label: 'OnFail' },
    { path: 'onCrit', kind: 'steps', label: 'OnCrit' },
  ],
  grant: [TO, { path: 'uuid', kind: 'text', label: 'ItemUuid', hint: 'DropHint' }, { path: 'until', kind: 'select', label: 'Until', options: [['', 'UntilUsed'], ['endOfTurn', 'UntilEndOfTurn'], ['endOfRound', 'UntilEndOfRound'], ['endOfNextRound', 'UntilEndOfNextRound'], ['nextTurn', 'UntilNextTurn'], ['encounter', 'UntilEncounter'], ['scene', 'UntilScene']] }],
  bank: [
    TO,
    { path: 'label', kind: 'text', label: 'Label' },
    ...SHIFTS,
    { path: 'appliesWhen', kind: 'tags', label: 'AppliesWhen' },
    { path: 'damage', kind: 'formula', label: 'BankDamage', advanced: true },
    { path: 'defense', kind: 'select', label: 'BankDefense', options: [['', 'BankDefenseNone'], ['any', 'BankDefenseAny'], 'defenses'], advanced: true },
    { path: 'defenseBonus', kind: 'formula', label: 'BankDefenseBonus', advanced: true },
    { path: 'persist', kind: 'checkbox', label: 'BankDefensePersist', advanced: true },
    { path: 'uses', kind: 'formula', label: 'Uses' },
    { path: 'until', kind: 'select', label: 'Until', options: [['', 'UntilUsed'], ['endOfTurn', 'UntilEndOfTurn'], ['endOfRound', 'UntilEndOfRound'], ['endOfNextRound', 'UntilEndOfNextRound'], ['nextTurn', 'UntilNextTurn'], ['encounter', 'UntilEncounter'], ['scene', 'UntilScene']] },
  ],
  grantActions: [TO, { path: 'free', kind: 'number', label: 'ActionFree' }, { path: 'move', kind: 'number', label: 'ActionMove' }, { path: 'standard', kind: 'number', label: 'ActionStandard' }],
  setToggle: [{ path: 'key', kind: 'text', label: 'Key' }, { path: 'value', kind: 'select', label: 'ToggleValue', options: [['toggle', 'ToggleFlip'], ['true', 'ToggleOn'], ['false', 'ToggleOff']] }, { path: 'until', kind: 'select', label: 'Until', options: [['', 'UntilUsed'], ['endOfTurn', 'UntilEndOfTurn'], ['endOfRound', 'UntilEndOfRound'], ['endOfNextRound', 'UntilEndOfNextRound'], ['nextTurn', 'UntilNextTurn'], ['encounter', 'UntilEncounter'], ['scene', 'UntilScene']] }],
  choose: [{ path: 'prompt', kind: 'text', label: 'Prompt' }, { path: 'options', kind: 'choices', label: 'ChooseOptions' }],
  target: [{ path: 'min', kind: 'number', label: 'MinTargets' }, { path: 'max', kind: 'number', label: 'MaxTargets' }],
  pickPerk: [
    { path: 'from', kind: 'select', label: 'PickPerkFrom', options: [['role', 'PickPerkRole'], ['focus', 'PickPerkFocus'], ['branch', 'PickPerkBranch']] },
    { path: 'line', kind: 'text', label: 'PickPerkLine' },
    { path: 'notOwn', kind: 'checkbox', label: 'PickPerkNotOwn' },
    { path: 'maxLevel', kind: 'formula', label: 'PickPerkMaxLevel' },
    { path: 'minLevel', kind: 'formula', label: 'PickPerkMinLevel', advanced: true },
    { path: 'ofOwnRole', kind: 'checkbox', label: 'PickPerkOfOwnRole', advanced: true },
    { path: 'notAdvanced', kind: 'checkbox', label: 'PickPerkNotAdvanced', advanced: true },
    { path: 'notOwnPerkNames', kind: 'checkbox', label: 'PickPerkNotOwnNames', advanced: true },
    { path: 'excludeName', kind: 'text', label: 'PickPerkExcludeName', advanced: true },
  ],
  fitAttack: [
    { path: 'damage', kind: 'number', label: 'FitDamage' },
    { path: 'types', kind: 'strings', label: 'FitTypes' },
    { path: 'skills', kind: 'skills', label: 'FitSkills' },
  ],
  pickAlly: [{ path: 'all', kind: 'checkbox', label: 'PickAllyAll' }, { path: 'includeSelf', kind: 'checkbox', label: 'PickAllyIncludeSelf' }, { path: 'within', kind: 'formula', label: 'PickAllyWithin' }, { path: 'filter', kind: 'tags', label: 'PickAllyFilter' }, { path: 'max', kind: 'number', label: 'MaxTargets' }],
  negateDamage: [],
  leaveAt: [{ path: 'value', kind: 'formula', label: 'LeaveAt' }],
  save: [
    { path: 'to', kind: 'text', label: 'Recipient' },
    { path: 'skills', kind: 'skills', label: 'SaveSkills' },
    { path: 'dif', kind: 'formula', label: 'Difficulty' },
    { path: 'status', kind: 'select', label: 'Condition', options: 'statuses' },
    { path: 'rounds', kind: 'formula', label: 'Rounds' },
    { path: 'damage.value', kind: 'formula', label: 'SaveDamage', advanced: true },
    { path: 'damage.type', kind: 'select', label: 'DamageType', options: 'damageTypes', advanced: true },
    { path: 'removeOnSuccess', kind: 'checkbox', label: 'SaveEscape', advanced: true },
  ],
  setForm: [TO, { path: 'form', kind: 'select', label: 'Form', options: [['morphed', 'FormMorphed'], ['transformed', 'FormTransformed']] }, { path: 'value', kind: 'select', label: 'ToggleValue', options: [['false', 'ToggleOff'], ['true', 'ToggleOn']] }],
  mark: [TO, { path: 'key', kind: 'text', label: 'Key' }, { path: 'until', kind: 'select', label: 'Until', options: [['', 'UntilUsed'], ['endOfTurn', 'UntilEndOfTurn'], ['endOfRound', 'UntilEndOfRound'], ['endOfNextRound', 'UntilEndOfNextRound'], ['nextTurn', 'UntilNextTurn'], ['encounter', 'UntilEncounter'], ['scene', 'UntilScene']] }],
  unmark: [TO, { path: 'key', kind: 'text', label: 'Key' }],
  bonusAttack: [
    TO,
    { path: 'count', kind: 'formula', label: 'BonusAttacks' },
    { path: 'cost', kind: 'select', label: 'BonusAttackCost', options: [['free', 'ActionFree'], ['none', 'ActionNone'], ['move', 'ActionMove'], ['standard', 'ActionStandard']] },
    { path: 'psychicOnMiss', kind: 'number', label: 'PsychicOnMiss', advanced: true },
  ],
  pickGrant: [
    TO,
    { path: 'from.type', kind: 'select', label: 'ItemType', options: [['weapon', 'TypeWeapon'], ['armor', 'TypeArmor'], ['gear', 'TypeGear'], ['upgrade', 'TypeUpgrade'], ['perk', 'TypePerk'], ['power', 'TypePower']] },
    { path: 'from.availabilities', kind: 'strings', label: 'Availabilities', hint: 'AvailabilitiesHint' },
    { path: 'from.tags', kind: 'tags', label: 'PickWhere' },
    { path: 'integrated', kind: 'checkbox', label: 'Integrated' },
    { path: 'until', kind: 'select', label: 'Until', options: [['', 'UntilUsed'], ['endOfTurn', 'UntilEndOfTurn'], ['endOfRound', 'UntilEndOfRound'], ['endOfNextRound', 'UntilEndOfNextRound'], ['nextTurn', 'UntilNextTurn'], ['encounter', 'UntilEncounter'], ['scene', 'UntilScene']] },
  ],
  askNumber: [{ path: 'prompt', kind: 'text', label: 'Prompt' }, { path: 'var', kind: 'text', label: 'VarName' }, { path: 'min', kind: 'formula', label: 'Min' }, { path: 'max', kind: 'formula', label: 'Max' }],
};

/** Every step also takes a condition. */
export const STEP_COMMON = [{ path: 'when', kind: 'tags', label: 'StepWhen' }];

/** Which steps make sense where: the damage steps only inside the damage Trigger events. */
export function stepChoices(rule) {
  const damageEvent = rule?.type == 'Trigger' && ['wouldBeDefeated', 'takesDamage'].includes(rule.event);
  return STEP_TYPES.filter(type => damageEvent || !['negateDamage', 'leaveAt'].includes(type));
}

/** Tag families the "when" editor offers, each with what its argument is. */
export const TAG_FAMILIES = [
  ['skill', 'skills'],
  ['essence', 'essences'],
  ['attack', ['', 'melee', 'ranged', 'area', 'unarmed', 'ram']],
  ['defense', 'defenses'],
  ['roll', ['initiative', 'specialized', 'specialization~', 'untrained', 'outranks', 'aimed', 'edge', 'snag', 'dataset:']],
  ['item', ['equipped', 'type:', 'trait:', 'element:', 'source:', 'id:', 'availability<=standard', 'data:', 'name~', 'isHost', 'onHost', 'own']],
  ['weapon', ['trait:', 'data:', 'name~']],
  ['rule', ['data:', 'banked', 'altMode']],
  ['self', ['morphed', 'transformed', 'canTransform', 'status:', 'toggle:', 'level>=', 'hp<half', 'type:', 'hasItem:', 'tag:', 'marked:', 'data:', 'recklessAbandon', 'skill:', 'essence:', 'size>=', 'has:', 'count:', 'trained:', 'wearing:', 'wearing>=', 'specializedIn:', 'sizeDiff>=1', 'levelDiff>=1', 'notActed']],
  ['target', ['status:', 'tag:', 'type:', 'hasItem:', 'level>=', 'hp<half', 'marked:', 'within:30', 'sizeDiff>=1', 'specializedIn:', 'levelDiff>=1', 'notActed']],
  ['combat', ['', 'round:', 'first', 'aheadOfTarget', 'highestInitiative']],
  ['vehicle', ['crew', 'driving', 'moves:aerial', 'moves:ground', 'moves:swim', 'type:zord', 'type:vehicle']],
  ['ally', ['within:5', 'within:10', 'within:30']],
  ['enemy', ['within:5', 'within:10', 'within:30']],
  ['scene', ['name~']],
  ['terrain', 'terrains'],
  ['environment', 'sceneEnvironments'],
  ['check', CHECK_NAMES],
  ['ownTurn', ['']],
  ['markedBy', ['']],
  ['markedByMe', ['']],
  ['assist', ['skill', 'attack']],
  ['damage', ['stun', 'sharp', 'blunt', 'crit', '>=1']],
  ['ask', 'text'],
];

/** The fields a rule type's form shows, own first then common - or [] for an unknown type. */
export function formFor(type) {
  return RULE_TYPES[type] ? [...(RULE_FORMS[type] ?? []), ...COMMON_FIELDS] : [];
}
