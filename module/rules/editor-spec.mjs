import { CHECK_NAMES } from "./predicate.mjs";
import { ACTION_KEYS, RULE_TYPES, TRIGGER_EVENTS } from "./types.mjs";
import { LIMIT_WINDOWS } from "./limits.mjs";
import { CARD_STEPS, STEP_TYPES } from "./steps.mjs";

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
export const OPTION_LISTS = ['skills', 'essences', 'defenses', 'damageTypes', 'statuses', 'rerollModes', 'rerollTargets', 'rerollResets', 'rerollConditions'];

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
    { path: 'consumeMark', kind: 'text', label: 'ConsumeMark', advanced: true },
    { path: 'consumeFrom', kind: 'select', label: 'ConsumeFrom', options: [['self', 'ConsumeFromSelf'], ['target', 'ConsumeFromTarget']], advanced: true, showIf: rule => !!rule.consumeMark },
  ],
  DialogSwitch: [...SHIFTS, { path: 'default', kind: 'checkbox', label: 'DefaultOn' }, { path: 'damage', kind: 'formula', label: 'SwitchDamage' }, { path: 'forget', kind: 'checkbox', label: 'SwitchForget', advanced: true }, { path: 'key', kind: 'text', label: 'SwitchKey', hint: 'SwitchKeyHint', advanced: true }, { path: 'defaultWhen', kind: 'tags', label: 'SwitchDefaultWhen', advanced: true }, { path: 'clearSnag', kind: 'checkbox', label: 'SwitchClearSnag', advanced: true }, { path: 'useSkill', kind: 'select', label: 'UseSkillInstead', options: [['', 'NoSkillSwap'], 'skills'], advanced: true }, { path: 'replacesAim', kind: 'checkbox', label: 'ReplacesAim', advanced: true }, { path: 'cost.resource', kind: 'resource', label: 'SwitchCost', advanced: true }, { path: 'cost.amount', kind: 'formula', label: 'Amount', advanced: true }, { path: 'spend.resource', kind: 'resource', label: 'SpendResource', advanced: true }, { path: 'spend.max', kind: 'formula', label: 'SpendMax', advanced: true }],
  Reroll: [
    { path: 'mode', kind: 'select', label: 'RerollMode', options: 'rerollModes' },
    { path: 'target', kind: 'select', label: 'RerollTarget', options: 'rerollTargets' },
    // The results it rerolls, past what mode covers: a list (values) or every result from 1 to N (upTo, a formula).
    { path: 'values', kind: 'strings', label: 'RerollValues', advanced: true },
    { path: 'upTo', kind: 'formula', label: 'RerollUpTo', advanced: true },
    { path: 'condition', kind: 'select', label: 'RerollCondition', options: 'rerollConditions' },
    { path: 'reset', kind: 'select', label: 'RerollReset', options: 'rerollResets' },
    { path: 'maxUses', kind: 'formula', label: 'MaxUses' },
    { path: 'skills', kind: 'skills', label: 'OnlySkills' },
    { path: 'essence', kind: 'select', label: 'RerollEssence', options: [['any', 'RerollEssenceAny'], 'essences'] },
    { path: 'scopeToOriginSkill', kind: 'checkbox', label: 'RerollOriginSkill', advanced: true },
    { path: 'minDieFaces', kind: 'number', label: 'RerollMinDieFaces', advanced: true },
    // On unless set to false, so a yes / no / blank choice rather than a checkbox (which can only write true).
    { path: 'recursive', kind: 'stacks', label: 'RerollRecursive', advanced: true },
    { path: 'keepBetter', kind: 'checkbox', label: 'RerollKeepBetter' },
    { path: 'bonus', kind: 'number', label: 'RerollBonus', advanced: true },
    { path: 'shiftUp', kind: 'number', label: 'RerollShiftUp', advanced: true },
    { path: 'grantsCanCritD2', kind: 'checkbox', label: 'RerollCanCritD2', advanced: true },
    { path: 'cost.worldStoryPoints', kind: 'number', label: 'RerollCostStoryPoints' },
    { path: 'cost.rolePointsName', kind: 'text', label: 'RerollCostRolePoints', advanced: true },
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
    { path: 'op', kind: 'select', label: 'Op', options: [['add', 'OpAdd'], ['set', 'OpSet'], ['multiply', 'OpMultiply'], ['max', 'OpMax'], ['min', 'OpMin'], ['append', 'OpAppend']] },
    { path: 'value', kind: 'formula', label: 'Value', showIf: rule => rule.op != 'append' },
    // append: the entry text, kept as text ({choice.environment}).
    { path: 'value', kind: 'text', label: 'AppendValue', hint: 'AppendValueHint', showIf: rule => rule.op == 'append' },
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
    { path: 'legacy', kind: 'text', label: 'PickLegacy', advanced: true },
  ],
  Pool: [
    { path: 'key', kind: 'text', label: 'Key' },
    { path: 'max', kind: 'formula', label: 'Max' },
    { path: 'reset', kind: 'select', label: 'Reset', options: [['none', 'ResetNone'], ['scene', 'Window.scene'], ['mission', 'Window.mission'], ['rest', 'Window.rest']] },
  ],
  ChoiceSet: [
    { path: 'key', kind: 'text', label: 'Key' },
    { path: 'from', kind: 'select', label: 'ChoiceFrom', options: [['skill', 'FromSkill'], ['essence', 'FromEssence'], ['defense', 'FromDefense'], ['list', 'FromList'], ['text', 'FromText'],
      ['config', 'FromConfig'], ['sense', 'FromSense'], ['environment', 'FromEnvironment'], ['movement', 'FromMovement'], ['damageType', 'FromDamageType'], ['element', 'FromElement']], allowCustom: true },
    { path: 'options', kind: 'strings', label: 'ChoiceOptions', showIf: rule => rule.from == 'list' },
    { path: 'table', kind: 'text', label: 'ChoiceTable', hint: 'ChoiceTableHint', showIf: rule => rule.from == 'config' },
    { path: 'labels', kind: 'text', label: 'ChoiceLabels', advanced: true, showIf: rule => rule.from == 'config' },
    { path: 'exceptAt', kind: 'text', label: 'ChoiceExceptAt', advanced: true, showIf: rule => rule.from == 'config' },
    { path: 'essence', kind: 'select', label: 'PickEssence', options: [['', 'EssenceAny'], ['strength', 'EssenceNames.strength'], ['speed', 'EssenceNames.speed'], ['smarts', 'EssenceNames.smarts'], ['social', 'EssenceNames.social']], showIf: rule => rule.from == 'skill' },
    { path: 'only', kind: 'strings', label: 'ChoiceOnly', hint: 'ChoiceOnlyHint', showIf: rule => rule.from != 'list' && rule.from != 'text' },
    { path: 'notHeld', kind: 'checkbox', label: 'ChoiceNotHeld', showIf: rule => ['sense', 'environment', 'movement'].includes(rule.from) },
    { path: 'held', kind: 'checkbox', label: 'ChoiceHeld', showIf: rule => ['sense', 'environment', 'movement'].includes(rule.from) },
    { path: 'count', kind: 'formula', label: 'ChoiceCount', hint: 'ChoiceCountHint' },
    { path: 'excludeCopies', kind: 'checkbox', label: 'ChoiceExcludeCopies' },
    { path: 'rename', kind: 'checkbox', label: 'ChoiceRename' },
    { path: 'required', kind: 'checkbox', label: 'ChoiceRequired' },
    { path: 'primary', kind: 'checkbox', label: 'ChoicePrimary', advanced: true },
    { path: 'legacy', kind: 'text', label: 'PickLegacy', advanced: true },
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
    { path: 'stage', kind: 'select', label: 'MovementStage', options: ['final', 'bonus', 'base', 'total', 'adjust', 'afterGravity', 'afterDerived'].map(stage => [stage, `MovementStages.${stage}`]), advanced: true },
    { path: 'round', kind: 'select', label: 'MovementRound', options: [['nearest', 'RoundNearest'], ['floor', 'RoundFloor'], ['ceil', 'RoundCeil']], advanced: true },
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
  Reaction: [
    { path: 'who', kind: 'select', label: 'ReactionWho', options: ['target', 'attacker', 'allyOfTarget', 'allyOfAttacker', 'enemyOfAttacker'].map(who => [who, `ReactionWhos.${who}`]) },
    { path: 'within', kind: 'number', label: 'WatchWithin' },
    { path: 'per', kind: 'select', label: 'ReactionPer', options: [['row', 'ReactionPerRow'], ['card', 'ReactionPerCard']] },
    { path: 'outcome', kind: 'select', label: 'OutcomeLabel', options: ['any', 'hit', 'miss'].map(o => [o, `ReactionOutcome.${o}`]) },
    { path: 'attackOnly', kind: 'checkbox', label: 'ReactionAttackOnly' },
    { path: 'minMargin', kind: 'number', label: 'ReactionMinMargin', advanced: true },
    { path: 'maxMargin', kind: 'number', label: 'ReactionMaxMargin', advanced: true },
    { path: 'cost.resource', kind: 'resource', label: 'CostResource' },
    { path: 'cost.amount', kind: 'formula', label: 'CostAmount', showIf: rule => !!rule.cost?.resource },
    ...LIMIT,
    { path: 'steps', kind: 'steps', label: 'Steps' },
  ],
  Trigger: [
    // A getter: plug-ins (rules/ext/) add events after this file loads.
    { path: 'event', kind: 'select', label: 'EventLabel', get options() {
      return TRIGGER_EVENTS.map(event => [event, `Event.${event}`]);
    } },
    { path: 'outcome', kind: 'select', label: 'OutcomeLabel', options: ['any', 'success', 'failure', 'double', 'crit', 'fumble', 'x2', 'anyFailed', 'allFailed', 'fumbled', 'plainSuccess', 'plainFailure', 'anySucceeded', 'notDouble'].map(o => [o, `Outcome.${o}`]), showIf: rule => ['afterRoll', 'hit', 'targeted'].includes(rule.event) },
    { path: 'watch', kind: 'select', label: 'WatchLabel', options: [['', 'WatchSelf'], ['ally', 'WatchAlly'], ['enemy', 'WatchEnemy'], ['any', 'WatchAny']] },
    { path: 'within', kind: 'number', label: 'WatchWithin', showIf: rule => !!rule.watch },
    { path: 'watchTarget', kind: 'select', label: 'WatchTargetLabel', options: [['actor', 'WatchTargetActor'], ['theirTarget', 'WatchTargetTheirs']], showIf: rule => !!rule.watch },
    { path: 'prompt', kind: 'checkbox', label: 'Prompt' },
    ...LIMIT,
    { path: 'steps', kind: 'steps', label: 'Steps' },
  ],
};

const TO = { path: 'to', kind: 'select', label: 'Recipient', options: [['self', 'ToSelf'], ['target', 'ToTarget'], ['targets', 'ToTargets'], ['targetOrSelf', 'ToTargetOrSelf'],
  ['party', 'ToParty'], ['party+others', 'ToPartyOthers'], ['team', 'ToTeam'], ['team+others', 'ToTeamOthers'], ['partyActor', 'ToPartyActor']] };

// Which Essence an Essence step works on (blank on healEssence: the most-damaged first).
const ESSENCE_FIELD = { path: 'essence', kind: 'select', label: 'Essence', options: [['', 'EssenceAny'], ['strength', 'EssenceNames.strength'], ['speed', 'EssenceNames.speed'],
  ['smarts', 'EssenceNames.smarts'], ['social', 'EssenceNames.social'], ['choose', 'EssenceChoose']] };

// Which rows of the check card a card step acts on (Reaction rules).
const CARD_ROWS = { path: 'rows', kind: 'select', label: 'CardRows', options: [['this', 'CardRowsThis'], ['all', 'CardRowsAll']] };

// How long a step's effect lasts (rules/expiry.mjs), and whose turns count.
const UNTIL_FIELD = { path: 'until', kind: 'select', label: 'Until', options: [['', 'UntilUsed'], ['endOfTurn', 'UntilEndOfTurn'], ['endOfRound', 'UntilEndOfRound'],
  ['endOfNextRound', 'UntilEndOfNextRound'], ['nextTurn', 'UntilNextTurn'], ['endOfNextTurn', 'UntilEndOfNextTurn'], ['turnOrScene', 'UntilTurnOrScene'],
  ['roundOrScene', 'UntilRoundOrScene'], ['nextTurnOrScene', 'UntilNextTurnOrScene'], ['endOfNextTurnOrScene', 'UntilEndOfNextTurnOrScene'], ['turnOrUntilCombat', 'UntilTurnOrUntilCombat'], ['combat', 'UntilCombat'], ['mission', 'UntilMission'], ...[1, 2, 3, 5, 10].map(n => [`rounds:${n}`, `UntilRounds.${n}`]), ['encounter', 'UntilEncounter'], ['scene', 'UntilScene']] };
const UNTIL_OF_FIELD = { path: 'untilOf', kind: 'select', label: 'UntilOf', options: [['holder', 'UntilOfHolder'], ['recipient', 'UntilOfRecipient']] };

/** Each step's fields. */
export const STEP_FORMS = {
  chat: [{ path: 'text', kind: 'text', label: 'Text', hint: 'ChatHint' }],
  spend: [{ path: 'resource', kind: 'resource', label: 'Resource' }, { path: 'amount', kind: 'formula', label: 'Amount' }, { path: 'onFail', kind: 'steps', label: 'OnFail' }],
  gainResource: [{ path: 'resource', kind: 'resource', label: 'Resource' }, { path: 'amount', kind: 'formula', label: 'Amount' }],
  heal: [TO, { path: 'amount', kind: 'formula', label: 'Amount' }, { path: 'temporary', kind: 'checkbox', label: 'HealTemporary' },
    { path: 'tracked', kind: 'checkbox', label: 'HealTracked', advanced: true, showIf: step => !!step.temporary },
    { path: 'untilDamage', kind: 'checkbox', label: 'HealUntilDamage', advanced: true, showIf: step => !!step.tracked }],
  loseHealth: [TO, { path: 'amount', kind: 'formula', label: 'Amount' }],
  damage: [TO, { path: 'amount', kind: 'formula', label: 'Amount' }, { path: 'damageType', kind: 'select', label: 'DamageType', options: 'damageTypes' }],
  applyCondition: [TO, { path: 'condition', kind: 'select', label: 'Condition', options: 'statuses' }, { path: 'rounds', kind: 'formula', label: 'Rounds' }],
  removeCondition: [TO, { path: 'condition', kind: 'select', label: 'Condition', options: 'statuses' }],
  roll: [
    { path: 'skill', kind: 'select', label: 'Skill', options: 'skills' },
    { path: 'dif', kind: 'formula', label: 'Difficulty' },
    { path: 'difDefense', kind: 'select', label: 'DifDefense', options: [['', 'DifFixed'], 'defenses'] },
    { path: 'difDefenseSelf', kind: 'checkbox', label: 'DifDefenseSelf', advanced: true, showIf: step => !!step.difDefense },
    { path: 'edge', kind: 'checkbox', label: 'RollEdge', advanced: true },
    { path: 'edgeWhen', kind: 'tags', label: 'RollEdgeWhen', advanced: true },
    { path: 'snag', kind: 'checkbox', label: 'RollSnag', advanced: true },
    { path: 'beforeCost', kind: 'checkbox', label: 'BeforeCost', advanced: true },
    { path: 'open', kind: 'checkbox', label: 'RollOpen', advanced: true },
    { path: 'then', kind: 'steps', label: 'RollThen', showIf: step => !!step.open },
    { path: 'onSuccess', kind: 'steps', label: 'OnSuccess' },
    { path: 'onFail', kind: 'steps', label: 'OnFail' },
    { path: 'onCrit', kind: 'steps', label: 'OnCrit' },
  ],
  button: [
    { path: 'label', kind: 'text', label: 'ButtonLabel' },
    { path: 'intro', kind: 'text', label: 'ButtonIntro' },
    { path: 'who', kind: 'select', label: 'ButtonWho', options: ['owner', 'gm', 'anyone', 'targets', 'others'].map(who => [who, `ButtonWhos.${who}`]) },
    { path: 'runAs', kind: 'select', label: 'ButtonRunAs', options: [['holder', 'ButtonRunAsHolder'], ['clicker', 'ButtonRunAsClicker']] },
    { path: 'once', kind: 'stacks', label: 'ButtonOnce' },
    { path: 'usedWhenDone', kind: 'checkbox', label: 'ButtonUsedWhenDone', advanced: true },
    { path: 'whisper', kind: 'select', label: 'ButtonWhisper', options: [['', 'ButtonWhisperAll'], ['owners', 'ButtonWhisperOwners']], advanced: true },
    ...LIMIT.slice(0, 3),
    { path: 'steps', kind: 'steps', label: 'ButtonSteps' },
  ],
  pick: [
    { path: 'key', kind: 'text', label: 'PickKey' },
    { path: 'from', kind: 'select', label: 'PickFrom', options: ['skill', 'essence', 'damageType', 'ownedItem', 'ally', 'enemy', 'target', 'list', 'team', 'actors'].map(from => [from, `PickFroms.${from}`]) },
    { path: 'actorType', kind: 'select', label: 'PickActorType', options: [['', 'AnyActor'], ['playerCharacter', 'TypePC'], ['npc', 'TypeNpc'], ['zord', 'TypeZord'], ['vehicle', 'TypeVehicle'], ['companion', 'TypeCompanion']], advanced: true, showIf: step => step.from == 'actors' },
    { path: 'essence', kind: 'select', label: 'PickEssence', options: [['', 'EssenceAny'], ['strength', 'EssenceNames.strength'], ['speed', 'EssenceNames.speed'], ['smarts', 'EssenceNames.smarts'], ['social', 'EssenceNames.social']], advanced: true, showIf: step => step.from == 'skill' },
    { path: 'specializedOnly', kind: 'checkbox', label: 'PickSpecializedOnly', advanced: true, showIf: step => step.from == 'skill' },
    { path: 'filter', kind: 'tags', label: 'PickFilter', advanced: true, showIf: step => step.from == 'ownedItem' },
    { path: 'auto', kind: 'checkbox', label: 'PickAuto', advanced: true },
    { path: 'notSelf', kind: 'checkbox', label: 'PickNotSelf', advanced: true, showIf: step => ['team', 'actors'].includes(step.from) },
    { path: 'itemType', kind: 'text', label: 'PickItemType' },
    { path: 'equipped', kind: 'checkbox', label: 'PickEquipped' },
    { path: 'within', kind: 'number', label: 'AuraRadius' },
    { path: 'prompt', kind: 'text', label: 'PickQuestion' },
    { path: 'ifUnset', kind: 'checkbox', label: 'PickIfUnset' },
    { path: 'legacy', kind: 'text', label: 'PickLegacy', advanced: true },
  ],
  createItem: [TO, { path: 'data', kind: 'json', label: 'ItemData' }, { path: 'children', kind: 'json', label: 'ItemChildren', advanced: true }, UNTIL_FIELD, UNTIL_OF_FIELD],
  deleteItem: [TO, { path: 'item', kind: 'text', label: 'ItemSelector', hint: 'ItemSelectorHint' }, { path: 'all', kind: 'checkbox', label: 'AllMatches' }],
  updateItem: [TO, { path: 'item', kind: 'text', label: 'ItemSelector', hint: 'ItemSelectorHint' }, { path: 'all', kind: 'checkbox', label: 'AllMatches' }, { path: 'set', kind: 'json', label: 'SetValues' }, { path: 'add', kind: 'json', label: 'AddValues' }],
  spendQuantity: [TO, { path: 'item', kind: 'text', label: 'ItemSelector', hint: 'ItemSelectorHint' }, { path: 'amount', kind: 'formula', label: 'Amount' }, { path: 'deleteAtZero', kind: 'checkbox', label: 'DeleteAtZero' }],
  grant: [
    TO, { path: 'uuid', kind: 'text', label: 'ItemUuid', hint: 'DropHint' }, UNTIL_FIELD, UNTIL_OF_FIELD,
    { path: 'name', kind: 'text', label: 'GrantName', advanced: true },
    { path: 'integrated', kind: 'checkbox', label: 'Integrated', advanced: true },
    { path: 'appendTraits', kind: 'strings', label: 'AppendTraits', advanced: true },
    { path: 'systemFormulas', kind: 'json', label: 'GrantSystemFormulas', advanced: true },
  ],
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
    UNTIL_FIELD, UNTIL_OF_FIELD,
  ],
  grantActions: [TO, { path: 'free', kind: 'number', label: 'ActionFree' }, { path: 'move', kind: 'number', label: 'ActionMove' }, { path: 'standard', kind: 'number', label: 'ActionStandard' }],
  setToggle: [{ path: 'key', kind: 'text', label: 'Key' }, { path: 'value', kind: 'select', label: 'ToggleValue', options: [['toggle', 'ToggleFlip'], ['true', 'ToggleOn'], ['false', 'ToggleOff']] }, UNTIL_FIELD],
  choose: [{ path: 'prompt', kind: 'text', label: 'Prompt' }, { path: 'options', kind: 'choices', label: 'ChooseOptions' }, { path: 'auto', kind: 'checkbox', label: 'PickAuto', advanced: true }],
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
  negateHit: [CARD_ROWS],
  lowerTotal: [{ path: 'amount', kind: 'formula', label: 'Amount' }, CARD_ROWS],
  lateSnag: [CARD_ROWS],
  convertRows: [{ path: 'crit', kind: 'checkbox', label: 'CardCrit' }, CARD_ROWS],
  rerollCard: [
    { path: 'target', kind: 'select', label: 'RerollTarget', options: 'rerollTargets' },
    { path: 'mode', kind: 'select', label: 'RerollMode', options: 'rerollModes' },
    { path: 'keepBetter', kind: 'checkbox', label: 'RerollKeepBetter' },
    CARD_ROWS,
  ],
  essenceDamage: [TO, ESSENCE_FIELD, { path: 'amount', kind: 'formula', label: 'Amount' }],
  healEssence: [TO, ESSENCE_FIELD, { path: 'amount', kind: 'formula', label: 'Amount' }],
  extendCondition: [TO, { path: 'condition', kind: 'select', label: 'Condition', options: 'statuses' }, { path: 'rounds', kind: 'formula', label: 'Rounds' }],
  updateActor: [TO, { path: 'set', kind: 'json', label: 'UpdateSet' }, { path: 'add', kind: 'json', label: 'UpdateAdd' }, { path: 'ladder', kind: 'json', label: 'UpdateLadder', advanced: true }, { path: 'ladderMax', kind: 'select', label: 'LadderMax', options: [['', 'NoLimit'], ...['d2', 'd4', 'd6', 'd8', 'd10', 'd12', '2d8', '3d6'].map(d => [d, d])], advanced: true }, { path: 'min', kind: 'number', label: 'Min', advanced: true }, { path: 'max', kind: 'number', label: 'Max', advanced: true }],
  require: [{ path: 'check', kind: 'tags', label: 'RequireCheck' }, { path: 'message', kind: 'text', label: 'RequireMessage' }, { path: 'beforeCost', kind: 'checkbox', label: 'BeforeCost' }],
  setTargets: [TO],
  writeInitiative: [TO, { path: 'value', kind: 'formula', label: 'InitiativeValue' }],
  table: [{ path: 'formula', kind: 'formula', label: 'TableFormula' }, { path: 'rows', kind: 'json', label: 'TableRows' }],
  setVar: [{ path: 'key', kind: 'text', label: 'VarName' }, { path: 'value', kind: 'formula', label: 'SetVarValue' }],
  spendAction: [{ path: 'action', kind: 'select', label: 'CostAction', options: [['free', 'ActionFree'], ['move', 'ActionMove'], ['standard', 'ActionStandard']] }],
  rollVsEach: [TO, { path: 'skill', kind: 'select', label: 'Skill', options: 'skills' }, { path: 'defense', kind: 'select', label: 'DifDefense', options: ['defenses'] }, { path: 'onHit', kind: 'steps', label: 'OnSuccess' }, { path: 'onMiss', kind: 'steps', label: 'OnFail' }],
  disarm: [TO, { path: 'maxHands', kind: 'formula', label: 'DisarmMaxHands' }, { path: 'optional', kind: 'checkbox', label: 'DisarmOptional' }, { path: 'required', kind: 'checkbox', label: 'DisarmRequired', advanced: true }],
  takeItem: [{ path: 'item', kind: 'text', label: 'ItemSelector' }],
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
  mark: [
    TO, { path: 'key', kind: 'text', label: 'Key' }, UNTIL_FIELD, UNTIL_OF_FIELD,
    { path: 'count', kind: 'formula', label: 'MarkCount', advanced: true },
    { path: 'add', kind: 'checkbox', label: 'MarkAdd', advanced: true, showIf: step => step.count !== undefined },
    { path: 'perSetter', kind: 'checkbox', label: 'MarkPerSetter', advanced: true },
  ],
  unmark: [TO, { path: 'key', kind: 'text', label: 'Key' }, { path: 'perSetter', kind: 'checkbox', label: 'MarkPerSetter', advanced: true }],
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
    { path: 'from.fields', kind: 'strings', label: 'PickGrantFields', advanced: true },
    { path: 'replace', kind: 'checkbox', label: 'PickGrantReplace', advanced: true },
    { path: 'record', kind: 'checkbox', label: 'PickGrantRecord', advanced: true },
    { path: 'key', kind: 'text', label: 'PickKey', advanced: true, showIf: step => !!step.record },
    { path: 'max', kind: 'number', label: 'PickGrantMax', advanced: true, showIf: step => !!step.record },
    UNTIL_FIELD, UNTIL_OF_FIELD,
  ],
  askNumber: [{ path: 'prompt', kind: 'text', label: 'Prompt' }, { path: 'var', kind: 'text', label: 'VarName' }, { path: 'min', kind: 'formula', label: 'Min' }, { path: 'max', kind: 'formula', label: 'Max' }],
};

/**
 * A plug-in step's form (rules/plugins/<topic>/, beside its registerStep): the same field list as STEP_FORMS. Only
 * plug-ins loaded through plugins/index.mjs add one, so the core forms still match the core STEP_TYPES.
 */
export function registerStepForm(name, fields) {
  STEP_FORMS[name] = fields;
}

/** Every step also takes a condition. */
export const STEP_COMMON = [{ path: 'when', kind: 'tags', label: 'StepWhen' }, { path: 'filter', kind: 'tags', label: 'StepFilter', advanced: true }, { path: 'quiet', kind: 'checkbox', label: 'StepQuiet', advanced: true }];

/** Which steps make sense where: the damage steps only inside the damage Trigger events. */
export function stepChoices(rule) {
  const damageEvent = rule?.type == 'Trigger' && ['wouldBeDefeated', 'takesDamage'].includes(rule.event);
  const reaction = rule?.type == 'Reaction';
  return STEP_TYPES.filter(type => (damageEvent || !['negateDamage', 'leaveAt'].includes(type)) && (reaction || !CARD_STEPS.includes(type)));
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
