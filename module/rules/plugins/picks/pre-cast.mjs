// Rules-engine plug-ins, round 15 (rest-other - docs/rules-batches/slOther15.md): PreCast and grantSpecialization.
// Registered on import; see module/rules/plugins/index.mjs. Import-light: documents/item.mjs loads it directly (the step
// engine is imported lazily).
import { rulesOf } from "../../index.mjs";
import { registerStep } from "../../steps.mjs";
import { registerRuleType } from "../../types.mjs";

/**
 * `PreCast {steps}` - on a spell: steps run as it is cast (documents/item.mjs's spell branch, after its Casting Cost is
 * worked out and before its area is placed or anything is rolled), where the hand-written per-spell pickers ran. A
 * stopped run (a cancelled `pick`, an empty `askChoiceText`) cancels the cast: nothing is rolled and no Casting Cost
 * lands. Picks are kept on the spell (`{choice.<key>}`) for its own afterRoll Trigger (Enchant, Get To Know, Bestow
 * Expertise). `when` sees the caster and the spell.
 */
registerRuleType('PreCast', {
  params: { steps: { kind: 'object', required: true } },
  scopes: ['self'],
  validate: rule => (Array.isArray(rule.steps) && rule.steps.length ? [] : ['steps must be a list of steps']),
});

/**
 * Run a spell's own PreCast rules for this cast.
 * @param {Actor} actor   The caster.
 * @param {Item} spell
 * @returns {Promise<Boolean>}   false when one stopped (the cast is cancelled).
 */
export async function runPreCast(actor, spell) {
  const rules = rulesOf(spell).filter(rule => rule?.type == 'PreCast' && !rule.disabled);
  if (!rules.length) {
    return true;
  }

  const { runSteps, stepContext } = await import("../../steps.mjs");
  const { contextFor, evaluate } = await import("../../predicate.mjs");
  for (const rule of rules) {
    if (evaluate(rule.when, contextFor({ self: actor, holder: actor, ruleItem: spell, item: spell })) === false) {
      continue;
    }

    const ctx = stepContext({ actor, item: spell, rule });
    if (!(await runSteps(rule.steps, ctx))) {
      return false;
    }
  }

  return true;
}

/* -------------------------------------------- */
/*  grantSpecialization                          */
/* -------------------------------------------- */

const SKILL_TEXT = /^\{(?:var|choice)\.[\w-]+\}$|^[a-zA-Z]+$/;

function fill(text, ctx) {
  const choices = ctx.item?.flags?.essence20?.rules?.choices ?? {};
  return String(text ?? '')
    .replace(/\{var\.([\w-]+)\}/g, (match, key) => String(ctx.vars?.[key] ?? ''))
    .replace(/\{choice\.([\w-]+)\}/g, (match, key) => String(choices[key] ?? ''));
}

/**
 * Step `grantSpecialization {skill, name, to?, until: "scene"}` - each recipient gains a Specialization of that Skill
 * named `name` (`{var.x}` / `{choice.x}` filled; title-cased), at the Skill's own die, for the rest of the scene: it is
 * listed in flags.essence20.bestowedExpertise, which the scene-advance sweep (items/magic/bestow-expertise-scene-expiry.mjs)
 * removes. An empty name or an unknown Skill stops the run.
 */
registerStep('grantSpecialization', async (step, ctx) => {
  const { recipients } = await import("../../steps.mjs");
  const { slugifySpecializationName, titleCaseSpecializationName } = await import("../../../util/utils.mjs");
  const skill = fill(step.skill, ctx);
  const name = fill(step.name, ctx).trim();
  if (!skill || !name) {
    return false;
  }

  for (const actor of recipients(step, ctx)) {
    const fields = actor.system?.skills?.[skill];
    if (!fields) {
      continue;
    }

    const displayName = titleCaseSpecializationName(name);
    const key = slugifySpecializationName(displayName, fields.specializations || {});
    const bestowed = actor.flags?.essence20?.bestowedExpertise ?? [];
    const update = {
      'flags.essence20.bestowedExpertise': [...bestowed, { skill, key }],
      [`system.skills.${skill}.specializations.${key}`]: {
        name: displayName, shift: fields.shift, isSpecialized: true, edge: false, shiftUp: 0, shiftDown: 0, snag: false, granted: true,
      },
    };
    const { needsGmRelay, relayToGm } = await import("../../../mechanics/world/gm-relay.mjs");
    await (needsGmRelay(actor) ? relayToGm(actor, 'update', [update]) : actor.update(update));
  }
}, {
  errors: (step, where) => [
    ...(step.skill && SKILL_TEXT.test(String(step.skill)) ? [] : [`${where}: grantSpecialization needs a skill (a key, {var.x} or {choice.x})`]),
    ...(step.name ? [] : [`${where}: grantSpecialization needs a name`]),
    ...(step.until === undefined || step.until == 'scene' ? [] : [`${where}: grantSpecialization lasts the scene (until: scene)`]),
  ],
});
