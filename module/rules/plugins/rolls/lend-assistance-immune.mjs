import { registerPostRoll, registerPreRoll } from "../../../mechanics/item-hooks.mjs";
import { RULE_TYPES } from "../../types.mjs";
import { rollRules } from "../../adapter.mjs";
import { firstTarget, T } from "../shared/lazy-helpers-and-targets.mjs";

/**
 * RollModifier `immune: ["lendAssistance"]` (round 10, group C) - Lend Assistance banked on the roller (the
 * pendingLendAssistanceShift / pendingLendAssistanceEdge flags mechanics/actions/lend-assistance.mjs leaves) is set aside for a
 * roll the rule's `when` matches, and put back afterwards for the next roll that can use it. Weapon Enthusiast's
 * Hang-Up.
 */

const ASSIST_FLAGS = ['pendingLendAssistanceShift', 'pendingLendAssistanceEdge'];
const held = new Map();

{
  const RM = RULE_TYPES.RollModifier;
  const inner = RM.validate;
  RM.validate = rule => {
    const kinds = rule.immune ?? [];
    const errors = inner({ ...rule, immune: kinds.filter(kind => kind != 'lendAssistance') });
    // A rule whose only immunity is lendAssistance changes something too.
    return kinds.includes('lendAssistance') ? errors.filter(error => error != 'changes nothing') : errors;
  };
}

/** Put back what an earlier roll set aside (only where nothing new was banked since). */
export async function restoreAssist(actor) {
  const kept = held.get(actor?.id);
  if (!kept) {
    return;
  }

  held.delete(actor.id);
  for (const [key, value] of Object.entries(kept)) {
    if (!actor.getFlag?.('essence20', key)) {
      await actor.setFlag('essence20', key, value);
    }
  }
}

/** Before the roll: a matching immune lendAssistance rule sets the banked help aside. */
export async function setAssistAside(actor, dataset, item) {
  await restoreAssist(actor);
  const roll = { item, rolledSkill: dataset?.skill, rolledEssence: dataset?.essence, dataset };
  const rule = rollRules(actor, firstTarget(), roll).find(entry => entry.answer === true && (entry.rule.immune ?? []).includes('lendAssistance'));
  if (!rule) {
    return;
  }

  const aside = {};
  for (const key of ASSIST_FLAGS) {
    const value = actor.getFlag?.('essence20', key);
    if (value) {
      aside[key] = value;
      await actor.unsetFlag('essence20', key);
    }
  }

  if (Object.keys(aside).length) {
    held.set(actor.id, aside);
    globalThis.ui?.notifications?.info?.(T('LendAssistanceSetAside', { name: actor.name, item: rule.item?.name ?? '' },
      `${actor.name} can't take Lend Assistance on this roll (${rule.item?.name ?? ''}) - it's kept for a later roll.`));
  }
}

registerPreRoll(setAssistAside);
registerPostRoll(actor => restoreAssist(actor));
