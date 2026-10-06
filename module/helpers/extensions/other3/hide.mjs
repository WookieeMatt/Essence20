/**
 * Hiding (Transformers CRB) - the generic Hide action's Hidden state. Pop Out and Telltale Sign are their items' own
 * rules (a brokeHiding Trigger, rollVsAll, a postCard / CardButtons card - module/rules/ext/g/), and Now You Don't's
 * +5 is a HideBonus rule.
 *
 * The Hide action (GI Joe CRB p.196, helpers/named-actions.mjs#hide) is an Infiltration Skill Test
 * and nothing more - no "Hidden" state existed. This file adds a light one: an Infiltration roll the
 * player declares as the Hide action (prechecked when the action economy's last spend was Hide)
 * marks the actor Hidden for the scene (flags.essence20.o3Hidden - rules/ext/g/hidden.mjs); attacking
 * ends it ("your Hide benefit ends if you attack") and fires the brokeHiding event (Pop Out).
 */
import { registerApplyDialog, registerDialogToggles, registerPostRoll } from "../../extensions.mjs";
import { T, num } from "./shared.mjs";
import { ruleHideBonus } from "../../../rules/ext/b/readers.mjs";
import { fireBrokeHiding, isHidden, setHidden } from "../../../rules/ext/g/hidden.mjs";

export { isHidden };

/** Whether the action economy's most recent spend this turn was the Hide action. */
export function justTookHide(actor) {
  const combat = game?.combat;
  const combatant = combat?.getCombatantsByActor?.(actor)?.[0];
  const log = combatant?.getFlag?.('essence20', 'actions')?.log ?? [];
  return log.length ? log[log.length - 1]?.namedKey == 'hide' : false;
}

registerDialogToggles((actor, ctx) => (ctx?.rolledSkill == 'infiltration'
  ? [{ name: 'o3Hide', label: T('O3HideToggle'), type: 'checkbox', value: justTookHide(actor) }]
  : []));

// A Hide roll's result bonuses are HideBonus rules (Now You Don't's +5 in Alt Mode - rules/ext/b/readers.mjs).
registerApplyDialog(async (actor, options, ctx = {}) => {
  if (!options.ext?.o3Hide) {
    return;
  }

  const bonus = ruleHideBonus(actor, { rolledSkill: ctx.rolledSkill, item: ctx.item });
  if (bonus) {
    options.skillEffectModifierBonus = num(options.skillEffectModifierBonus) + bonus;
  }

  await setHidden(actor, true);
});

/*
 * Hidden In Plain Sight (Transformers CRB, Infiltrator Focus, 5th level, p.85): "you can Hide, even
 * if you do not have cover, darkness, or another effect that limits the vision of observers." The
 * Hide action above never checks for cover, so this is always satisfied; nothing to gate.
 *
 * Attacking while Hidden ends it, then fires brokeHiding with the attack's targets - Pop Out's Trigger
 * (its button rolls Infiltration against them all and hides again on a success).
 */
registerPostRoll(async (actor, results, checkContext, extra) => {
  if (!checkContext?.isAttack || !isHidden(actor) || !actor.isOwner) {
    return;
  }

  await setHidden(actor, false);
  await fireBrokeHiding(actor, (extra?.hits ?? []).map(hit => hit.target).filter(Boolean));
});
