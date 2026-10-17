import { rulesOf, rulesOfType } from "../../index.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { registerEvent, registerRuleType } from "../../types.mjs";

/**
 * Powers as rules (round 15, systems - docs/rules-batches/slSystems15.md).
 *
 * A Power has no Use button of its own: its activation (sheet-handlers/power-handler.mjs#powerCost) spends the cost and
 * then calls mechanics/characters/power-use.mjs#onPowerUse. That call fires the `powerUsed` Trigger event on the actor,
 * the Power as the roll item - so a Power's own effect is
 * `{type: "Trigger", event: "powerUsed", when: ["item:own"], steps: [...]}` - with `@var.spent` = the Personal Power
 * actually spent (the fixed cost, the amount confirmed for a variable cost, 0 for a free or nanomite Power). The
 * user's targets are the Trigger's targets (`to: "target"`, `target:` tags).
 *
 * A Power used straight from a compendium (nanomite equipment, items/gear/nanomite-gear.mjs) isn't on the actor: its own
 * powerUsed Triggers run for the holder.
 *
 * `FreeUse {}` + `when` (on a nanomite Power): its activation spends no daily use while `when` holds - "switching the
 * boost back off costs nothing" (mechanics/resources/nanomite-uses.mjs#spendDailyUse asks `ruleUseIsFree`).
 */

registerEvent('powerUsed');

registerRuleType('FreeUse', { params: {}, scopes: ['self'] });

function targetsOf() {
  const targets = globalThis.game?.user?.targets;
  const tokens = targets?.[Symbol.iterator] ? [...targets] : [targets?.first?.()].filter(Boolean);
  return tokens.map(token => token?.actor).filter(Boolean);
}

/**
 * Fire the Power's powerUsed Triggers (after its cost is paid).
 * @param {Actor} actor
 * @param {Item} power
 * @param {Number} spent
 */
export async function firePowerUsed(actor, power, spent = 0) {
  if (!actor || !power) {
    return;
  }

  const vars = { spent: Number(spent) || 0 };
  const targets = targetsOf();
  const { fireTriggers } = await import("../../triggers.mjs");
  const owned = power.parent === actor || (power.parent?.uuid && power.parent.uuid == actor.uuid);
  if (owned) {
    await fireTriggers(actor, 'powerUsed', { roll: { item: power }, targets, vars });
    return;
  }

  // Not on the actor (a compendium Power run by nanomite gear): its own powerUsed Triggers, for the holder. Their steps
  // act on the gear that holds it (toggles, marks), whose rules carry the Power's lasting ones (book check, effects -
  // rules/plugins/book/effects.mjs#gearPowerRules).
  const { runSteps, stepContext } = await import("../../steps.mjs");
  const { gearHolding } = await import("../book/effects.mjs");
  const gear = gearHolding(actor, power);
  for (const rule of rulesOf(power)) {
    if (rule?.type != 'Trigger' || rule.event != 'powerUsed' || rule.disabled) {
      continue;
    }

    if (evaluate(rule.when, contextFor({ item: power, self: actor, holder: actor, ruleItem: power, other: targets[0] ?? null, vars })) !== true) {
      continue;
    }

    const ctx = stepContext({ actor, item: gear ?? power, rule, targets });
    Object.assign(ctx.vars, vars);
    await runSteps(rule.steps, ctx);
    if (ctx.chat.length && globalThis.ChatMessage?.create) {
      await ChatMessage.create({ speaker: ChatMessage.getSpeaker?.({ actor }), content: [`<strong>${power.name}</strong>`, ...ctx.chat].join('<br>') });
    }
  }
}

/** Whether a FreeUse rule on this Power holds now - its activation spends no daily use. */
export function ruleUseIsFree(actor, power) {
  return rulesOfType(actor, 'FreeUse').some(({ rule, item }) => item === power
    && evaluate(rule.when, contextFor({ self: actor, holder: actor, ruleItem: item })) === true);
}
