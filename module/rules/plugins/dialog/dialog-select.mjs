import { registerApplyDialog, registerDialogToggles, registerPreRoll } from "../../../mechanics/item-hooks.mjs";
import { RULE_TYPES, registerRuleType } from "../../types.mjs";
import { rulesOf, rulesOfType, ruleId, ruleLabel } from "../../index.mjs";
import { contextFor, evaluate, interpolate, registerTag } from "../../predicate.mjs";
import { resolveValue } from "../../formula.mjs";
import { linkedEntries } from "../../links.mjs";
import { registerStep, runSteps, stepContext, stepErrors } from "../../steps.mjs";
import { rollRules, ruleDialogSwitches, shiftsOf } from "../../adapter.mjs";
import { firstTarget, targetedActors } from "../shared/lazy-helpers-and-targets.mjs";
// Round 11 (group G): per-option when / pay and optionsFrom (generated options).
import { payOption, selectChoices, selectOption } from "./dialog-select-options.mjs";

/**
 * Roll Options Dialog pieces (round 10, group C):
 *
 * - DialogSwitch `scope: "incoming"` - a switch on the ROLLER's dialog that comes from a targeted creature's item
 *   (one per targeted holder): self: = the holder, target: = the roller. Starts at its `default` / `defaultWhen`
 *   every time (never remembered). Its `key` reaches the holder's Defense rules as `roll:incoming:<key>`.
 * - `DialogSelect` {options: [{label, upshift, downshift, edge, snag, key, steps}], default?} - a select of
 *   alternatives (scope self or incoming); the chosen option applies.
 * - DialogSwitch `ignoreDownshift` (ticked: that many downshifts come off, after everything else), `specializeWhen`
 *   (ticked and those tags hold: the roll is Specialized) and `bonusDie` (ticked: a bonus Skill Die joins the roll's
 *   kept-highest pool - a die, or {dice: [...], index: formula}).
 * - RollModifier `forget` (an asked modifier's switch always starts at its default) and `bonus` (a flat +N to the
 *   roll's total, the way a Skill Effect's modifier adds - not a shift).
 * - SkillSubstitution `mode: "ask"` with `options: [skills]` - before the dialog the player picks the rolled Skill
 *   or one of those.
 * - `BeforeRoll` {steps?, cancel?, message?} - before the dialog, when `when` holds: run steps (a cost, a warning),
 *   or refuse the roll with a warning. Scope self, or item (the rule sits on the rolled item).
 */

const localize = text => {
  const value = String(text ?? '');
  const i18n = globalThis.game?.i18n;
  return /^E20\./.test(value) && i18n?.has?.(value) ? i18n.localize(value) : value;
};

function rollFacts(ctx = {}) {
  const isAttack = ctx.isAttack ?? ctx.item?.type == 'weaponEffect';
  return { ...ctx, isAttack, isMelee: ctx.isMelee ?? (isAttack && ctx.item?.system?.classification?.style == 'melee') };
}

/* -------------------------------------------- */
/*  Rule params                                  */
/* -------------------------------------------- */

const SWITCH = RULE_TYPES.DialogSwitch;
if (!SWITCH.scopes.includes('incoming')) {
  SWITCH.scopes.push('incoming');
}

Object.assign(SWITCH.params, {
  ignoreDownshift: { kind: 'formula' }, specializeWhen: { kind: 'strings' }, bonusDie: { kind: 'any' },
});
{
  const inner = SWITCH.validate;
  SWITCH.validate = rule => {
    const extra = ['ignoreDownshift', 'bonusDie'].some(key => rule[key]);
    return [
      ...inner(rule).filter(error => !(extra && error == 'changes nothing')),
      ...(rule.bonusDie !== undefined && !bonusDieValid(rule.bonusDie) ? ['bonusDie must be a die (d4) or {dice: [...], index: formula}'] : []),
    ];
  };
}

Object.assign(RULE_TYPES.RollModifier.params, { forget: { kind: 'bool' }, bonus: { kind: 'formula' } });
{
  const inner = RULE_TYPES.RollModifier.validate;
  RULE_TYPES.RollModifier.validate = rule => inner(rule).filter(error => !(rule.bonus && error == 'changes nothing'));
}

const DIE = /^(\d*d\d+)$/;
function bonusDieValid(value) {
  if (typeof value == 'string') {
    return DIE.test(value);
  }

  return !!value && Array.isArray(value.dice) && value.dice.every(die => DIE.test(String(die))) && value.index !== undefined;
}

/** The die a bonusDie names, for its actor and item. */
export function bonusDieOf(value, actor, item) {
  if (typeof value == 'string') {
    return value;
  }

  const dice = value?.dice ?? [];
  const index = Math.round(resolveValue(value?.index ?? 0, { actor, item }, 0));
  return dice[Math.max(0, Math.min(dice.length - 1, index))] ?? null;
}

/* -------------------------------------------- */
/*  DialogSelect                                 */
/* -------------------------------------------- */

registerRuleType('DialogSelect', {
  params: { options: { kind: 'object', required: true }, default: { kind: 'formula' } },
  scopes: ['self', 'incoming'],
  validate: rule => [
    ...(Array.isArray(rule.options) && rule.options.length >= 2 ? [] : ['options must list at least two choices']),
    ...(Array.isArray(rule.options) ? rule.options.flatMap((option, i) => [
      ...(option?.label ? [] : [`options[${i}] needs a label`]),
      ...(option?.steps !== undefined ? stepErrors(option.steps, `options[${i}].steps`) : []),
    ]) : []),
  ],
});

/* -------------------------------------------- */
/*  Incoming switches and selects                */
/* -------------------------------------------- */

/** The targeted creatures' incoming DialogSwitch / DialogSelect rules that bear on this roll. */
export function incomingEntries(actor, ctx = {}) {
  const out = [];
  const facts = rollFacts(ctx);
  const seen = new Set();
  for (const holder of targetedActors()) {
    if (!holder || seen.has(holder)) {
      continue;
    }

    seen.add(holder);
    for (const type of ['DialogSwitch', 'DialogSelect']) {
      for (const { rule, item, index } of rulesOfType(holder, type, 'incoming')) {
        const answer = evaluate(rule.when, contextFor({ ...facts, self: holder, holder, other: actor, roller: actor, ruleItem: item }));
        if (answer === false) {
          continue;
        }

        const defaultWhen = Array.isArray(rule.defaultWhen) && rule.defaultWhen.length
          && evaluate(rule.defaultWhen, contextFor({ ...facts, self: holder, holder, other: actor, roller: actor, ruleItem: item })) === true;
        out.push({
          rule, item, index, holder, name: `in-${holder.id ?? 'x'}-${ruleId(item, index)}`, defaultWhen,
          ask: { ...facts, self: holder, holder, other: actor, roller: actor, ruleItem: item },
        });
      }
    }
  }

  return out;
}

/** The roller's own DialogSelect rules (and any reaching it). */
function ownSelects(actor, ctx = {}) {
  const facts = rollFacts(ctx);
  const own = rulesOfType(actor, 'DialogSelect', 'self').map(entry => ({ ...entry, holder: actor }));
  return [...own, ...linkedEntries(actor, 'DialogSelect')]
    .filter(({ rule, item, holder }) => evaluate(rule.when, contextFor({ ...facts, self: actor, holder, other: firstTarget(), ruleItem: item })) !== false)
    .map(entry => ({ ...entry, name: ruleId(entry.item, entry.index), ask: { ...facts, self: actor, holder: entry.holder, other: firstTarget(), ruleItem: entry.item } }));
}

const labelOf = (rule, item, holder) => ruleLabel(rule, item).replace(/\{holder\}/g, holder?.name ?? '');

function control(entry) {
  const { rule, item, holder, name, defaultWhen } = entry;
  if (rule.type == 'DialogSelect') {
    // Options whose `when` holds, plus optionsFrom's (g/select.mjs); fewer than two - no select.
    const choices = selectChoices(entry);
    return choices.length < 2 ? null : {
      name, label: labelOf(rule, item, holder), type: 'select',
      options: choices.map(choice => ({ value: choice.value, label: localize(choice.label).replace(/\{holder\}/g, holder?.name ?? '') })),
      value: String(Math.round(resolveValue(rule.default ?? 0, { actor: holder, item }, 0))),
    };
  }

  return { name, label: labelOf(rule, item, holder), type: 'checkbox', value: !!rule.default || !!defaultWhen };
}

registerDialogToggles((actor, ctx) => [...ownSelects(actor, ctx), ...incomingEntries(actor, ctx)].map(control).filter(Boolean));

/** What one ticked switch / chosen option does to the roll options. */
async function applyEffect(effect, { rule, item, holder }, options, actor) {
  const shifts = shiftsOf(effect, holder, item, undefined, actor);
  options.shiftUp = (Number(options.shiftUp) || 0) + shifts.shiftUp;
  options.shiftDown = (Number(options.shiftDown) || 0) + shifts.shiftDown;
  options.edge ||= shifts.edge;
  options.snag ||= shifts.snag;
  if (effect.clearSnag) {
    options.snag = false;
  }

  if (effect.key) {
    options.ruleKeys = [...new Set([...(options.ruleKeys ?? []), effect.key])];
    // An incoming switch's key reaches the holder's Defense rules (roll:incoming:<key>).
    if (rule.scope == 'incoming' && holder?.uuid) {
      options.ext[`inKey:${effect.key}:${holder.uuid}`] = true;
    }
  }

  if (Array.isArray(effect.steps) && effect.steps.length) {
    // Steps run as the rule's holder, aimed at the roller (a holder striking back) - or the roller's targets.
    const stepCtx = stepContext({ actor: holder, item, rule, targets: rule.scope == 'incoming' ? [actor] : targetedActors() });
    await runSteps(effect.steps, stepCtx);
    if (stepCtx.chat.length) {
      await globalThis.ChatMessage?.create?.({ speaker: globalThis.ChatMessage.getSpeaker?.({ actor: holder }), content: stepCtx.chat.join('<br>') });
    }
  }
}

registerApplyDialog(async (actor, options, ctx = {}) => {
  options.ext ??= {};
  for (const entry of [...ownSelects(actor, ctx), ...incomingEntries(actor, ctx)]) {
    const chosen = options.ext[entry.name];
    if (entry.rule.type == 'DialogSelect') {
      const fallback = String(Math.round(resolveValue(entry.rule.default ?? 0, { actor: entry.holder, item: entry.item }, 0)));
      // An option's `pay` steps run first; stopped (an action that can't be spent), the option doesn't apply.
      const option = selectOption(entry, chosen ?? fallback);
      if (option && (await payOption(option, entry))) {
        await applyEffect(option, entry, options, actor);
      }

      continue;
    }

    if (chosen === undefined ? control(entry).value : !!chosen) {
      await applyEffect(entry.rule, entry, options, actor);
    }
  }
});

// roll:incoming:<key> - a switch from this actor's own item was ticked on the roll against it (Something Is Off).
registerTag('roll:incoming', (rest, ctx) => {
  if (!ctx.ext || !ctx.self?.uuid) {
    return null;
  }

  return !!ctx.ext[`inKey:${rest}:${ctx.self.uuid}`];
});

/* -------------------------------------------- */
/*  Switch extras: ignoreDownshift, specializeWhen, bonusDie; RollModifier bonus */
/* -------------------------------------------- */

registerApplyDialog(async (actor, options, ctx = {}) => {
  const ticked = options.ext ?? {};
  const target = firstTarget();
  let ignore = 0;
  for (const { name, entry } of ruleDialogSwitches(actor, ctx)) {
    const { rule, item, owner } = entry;
    if (rule.type != 'DialogSwitch' || !ticked[name]) {
      continue;
    }

    if (rule.ignoreDownshift) {
      ignore += Math.max(0, Math.round(resolveValue(rule.ignoreDownshift, { actor: owner, item }, 0)));
    }

    if (Array.isArray(rule.specializeWhen) && rule.specializeWhen.length
      && evaluate(rule.specializeWhen, contextFor({ ...rollFacts(ctx), self: actor, ruleItem: item, other: target })) === true) {
      options.isSpecialized = true;
    }

    if (rule.bonusDie) {
      options.extBonusPoolDie = bonusDieOf(rule.bonusDie, owner ?? actor, item) ?? options.extBonusPoolDie;
    }
  }

  // "Ignore the first ↓1" - after every other source has added its downshifts.
  if (ignore > 0) {
    options.shiftDown = Math.max(0, (Number(options.shiftDown) || 0) - ignore);
  }

  // RollModifier bonus: a flat number on the roll's total (dice.mjs's skillEffectModifierBonus).
  for (const { rule, item, owner, answer } of rollRules(actor, target, rollFacts(ctx))) {
    if (rule.bonus && answer === true) {
      options.skillEffectModifierBonus = (Number(options.skillEffectModifierBonus) || 0) + Math.round(resolveValue(rule.bonus, { actor: owner, item }, 0));
    }
  }
});

/* -------------------------------------------- */
/*  SkillSubstitution mode: ask                  */
/* -------------------------------------------- */

const SUBSTITUTION = RULE_TYPES.SkillSubstitution;
SUBSTITUTION.params.mode.options.push('ask');
SUBSTITUTION.params.options = { kind: 'strings' };
SUBSTITUTION.params.prompt = { kind: 'string' };
// carryShifts (round 14): the picked Skill brings its own sheet shifts (system.skills.<skill>.shiftUp / shiftDown) onto the
// roll - for a roll made without them (a Requisition Test re-pointed at Wealth: Money Talks, Capable Freelancer).
SUBSTITUTION.params.carryShifts = { kind: 'bool' };
// clearSpecialized (round 17, split2): the picked Skill is rolled without the rolled one's Specialization (Nose For Trouble).
SUBSTITUTION.params.clearSpecialized = { kind: 'bool' };
SUBSTITUTION.params.to ={ ...SUBSTITUTION.params.to, required: false };
SUBSTITUTION.validate = rule => (rule.mode == 'ask'
  ? (Array.isArray(rule.options) && rule.options.length ? [] : ['ask needs options (the Skills offered)'])
  : (rule.to ? [] : ['to is required']));

/** The player's pick: the rolled Skill or one of `options`. Tests replace it. */
export const ask = {
  async skill(title, prompt, skills) {
    const { chooseButtons } = await import("../../../mechanics/resources/grants.mjs");
    return chooseButtons(title, prompt, skills.map(skill => [skill, globalThis.game?.i18n?.localize?.(globalThis.CONFIG?.E20?.skills?.[skill] ?? skill) ?? skill]));
  },
};

export async function askSubstitution(actor, dataset, item) {
  if (!dataset?.skill) {
    return;
  }

  const own = rulesOfType(actor, 'SkillSubstitution', 'self');
  for (const { rule, item: ruleItem } of own) {
    const from = interpolate(String(rule.from ?? ''), ruleItem);
    if (rule.mode != 'ask' || (from != '*' && from != dataset.skill)) {
      continue;
    }

    const ctx = contextFor({ ...rollFacts({ item }), item, rolledSkill: dataset.skill, dataset, self: actor, ruleItem, other: firstTarget() });
    if (evaluate(rule.when, ctx) !== true) {
      continue;
    }

    const skills = [dataset.skill, ...rule.options.filter(skill => skill != dataset.skill)];
    const picked = await ask.skill(ruleItem?.name ?? '', localize(rule.prompt ?? ''), skills);
    if (picked && picked != dataset.skill) {
      dataset.skill = picked;
      dataset.essence = globalThis.CONFIG?.E20?.skillToEssence?.[picked] ?? dataset.essence;
      if (rule.clearSpecialized) {
        dataset.isSpecialized = false;
      }

      if (rule.carryShifts) {
        const fields = actor.system?.skills?.[picked] ?? {};
        dataset.shiftUp = (Number(dataset.shiftUp) || 0) + (Number(fields.shiftUp) || 0);
        dataset.shiftDown = (Number(dataset.shiftDown) || 0) + (Number(fields.shiftDown) || 0);
      }
    }

    return;
  }
}

registerPreRoll(askSubstitution);

/* -------------------------------------------- */
/*  BeforeRoll                                   */
/* -------------------------------------------- */

registerRuleType('BeforeRoll', {
  params: { steps: { kind: 'object' }, cancel: { kind: 'bool' }, message: { kind: 'string' } },
  scopes: ['self', 'item'],
  validate: rule => [
    ...(rule.steps === undefined && !rule.cancel ? ['needs steps or cancel'] : []),
    ...(rule.steps !== undefined ? stepErrors(rule.steps) : []),
  ],
});

/**
 * BeforeRoll rules for this roll: the roller's own, and (scope item) the rolled item's own, whoever rolls it.
 * Steps run first (a stopped run cancels nothing - the old "warn, roll anyway" costs); then a `cancel` rule
 * whose condition holds refuses the roll with its message.
 */
export async function beforeRoll(actor, dataset, item) {
  const onItem = rulesOf(item).map((rule, index) => ({ rule, index, item })).filter(({ rule }) => rule?.type == 'BeforeRoll' && rule.scope == 'item' && !rule.disabled);
  const own = rulesOfType(actor, 'BeforeRoll', 'self');
  for (const { rule, item: ruleItem } of [...own, ...onItem]) {
    const ctx = contextFor({ ...rollFacts({ item }), item, rolledSkill: dataset?.skill, dataset, self: actor, ruleItem, other: firstTarget(), targetCount: targetedActors().length });
    if (evaluate(rule.when, ctx) !== true) {
      continue;
    }

    if (Array.isArray(rule.steps)) {
      const stepCtx = stepContext({ actor, item: ruleItem, rule, targets: targetedActors() });
      // The rolled item: {rolled.<path>} in step text, @rolled.<path> in amounts, @var.rolledItem (its uuid).
      stepCtx.rolled = item ?? null;
      stepCtx.vars.rolledItem = item?.uuid ?? '';
      // The roll's own dataset, for setDataset steps (rules/plugins/rolls/before-roll-rolled-item.mjs).
      stepCtx.dataset = dataset;
      await runSteps(rule.steps, stepCtx);
      if (stepCtx.chat.length) {
        await globalThis.ChatMessage?.create?.({ speaker: globalThis.ChatMessage.getSpeaker?.({ actor }), content: stepCtx.chat.join('<br>') });
      }
    }

    if (rule.cancel) {
      globalThis.ui?.notifications?.warn?.(localize(rule.message ?? '').replace(/\{name\}/g, ruleItem?.name ?? ''));
      dataset.cancelRoll = true;
      return;
    }
  }
}

registerPreRoll(beforeRoll);

/* -------------------------------------------- */
/*  Steps and a tag for the pieces above          */
/* -------------------------------------------- */

/** warn {text, stop?} - a notification for the user ({name} the actor); stop: the run ends here. */
registerStep('warn', async (step, ctx) => {
  globalThis.ui?.notifications?.warn?.(localize(step.text ?? '').replace(/\{name\}/g, ctx.actor?.name ?? ''));
  return step.stop ? false : undefined;
}, { errors: (step, where) => (step.text ? [] : [`${where}: warn needs text`]) });

/**
 * clearTargets {} - the user's own targets are cleared, so a following `roll` is compared with its own DIF rather
 * than a targeted token's Defense (the run's own targets are kept for @target and `to: target`).
 */
registerStep('clearTargets', async () => {
  try {
    if (globalThis.game?.user?.targets?.size) {
      globalThis.canvas?.tokens?.setTargets?.([]);
      globalThis.game.user.updateTokenTargets?.([]);
    }
  } catch (error) {
    // Targets are a convenience only.
  }
});

/**
 * roll:plainReach - a melee attack whose range is plain Reach: no Reach multiplier above 1 and no more Reach than the
 * roller's Size gives (an incoming rule's roller - Energized, Spiked, Energy Field).
 */
registerTag('roll:plainReach', (rest, ctx) => {
  const item = ctx.item;
  if (item?.type != 'weaponEffect' || item.system?.classification?.style != 'melee' || Number(item.system?.range?.reachMultiplier) > 1) {
    return false;
  }

  const roller = ctx.roller ?? ctx.self;
  const reach = globalThis.CONFIG?.E20?.actorReach?.[roller?.system?.size];
  return !reach || !item.system?.totalReach || item.system.totalReach <= reach;
});
