import { RULE_TYPES } from "../../types.mjs";
import { rulesOfType } from "../../index.mjs";
import { recordUse, usesLeft } from "../../limits.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { recipients, runSteps, stepContext } from "../../steps.mjs";

/**
 * Round 18 (convA): Trigger `{event: applyingDamage, redirectTo: <recipient>}` - on the one hit: as the GM presses a
 * check card's Apply Damage, the hit may land on that recipient instead ("redirect attacks targeting you to your
 * vehicle" - Impenetrable Armor: `redirectTo: drivenVehicle`). chat.mjs#onApplyDamage asks it FIRST, before the ally
 * protectors (rules/plugins/combat/applying-damage.mjs `redirect: true`), with the same damage-redirect question; while
 * one is offered the ally protectors aren't asked. Its `when` sees self = the one hit and target = the attacker; a
 * `limit` counts confirmed redirects; `steps` (optional) run when it is taken, the attacker as target. The plain
 * applyingDamage pass skips these rules.
 */

const TRIGGER = RULE_TYPES.Trigger;
if (TRIGGER) {
  TRIGGER.params.redirectTo ??= { kind: 'string' };
}

const same = (a, b) => !!a && !!b && (a === b || (!!a.uuid && a.uuid == b.uuid));

/**
 * The first redirectTo Trigger of the one hit that can take this hit: {protector, holder, rule, item, index}, or null.
 * @param {Actor} target     The actor the hit lands on now.
 * @param {?Actor} attacker
 */
export function ruleSelfRedirect(target, attacker = null) {
  for (const { rule, item, index } of rulesOfType(target, 'Trigger')) {
    if (rule.event != 'applyingDamage' || !rule.redirectTo || rule.disabled || usesLeft(target, rule, item, index) <= 0) {
      continue;
    }

    if (evaluate(rule.when, contextFor({ self: target, holder: target, ruleItem: item, other: attacker })) !== true) {
      continue;
    }

    const ctx = stepContext({ actor: target, item, rule, targets: attacker ? [attacker] : [] });
    const protector = recipients({ to: rule.redirectTo }, ctx).find(actor => actor && !same(actor, target));
    if (protector) {
      return { protector, holder: target, rule, item, index, attacker };
    }
  }

  return null;
}

/** The redirect was confirmed: its steps run (the attacker as target) and its limit counts. */
export async function takeSelfRedirect(redirect) {
  if (!redirect?.rule) {
    return;
  }

  const { holder, rule, item, index, attacker } = redirect;
  if (Array.isArray(rule.steps) && rule.steps.length) {
    const ctx = stepContext({ actor: holder, item, rule, targets: attacker ? [attacker] : [] });
    await runSteps(rule.steps, ctx);
    if (ctx.chat.length && globalThis.ChatMessage?.create) {
      await ChatMessage.create({ speaker: ChatMessage.getSpeaker?.({ actor: holder }), content: ctx.chat.join('<br>') });
    }
  }

  await recordUse(holder, rule, item, index);
}
