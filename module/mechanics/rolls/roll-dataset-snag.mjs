import { registerApplyDialog } from "../item-hooks.mjs";

/**
 * A Snag asked for by the roll's own dataset - the rules engine's `roll` step with `snag: true`
 * (Point-Defense Reflexes' rules at close range). rollSkill's dataset has no snag of its own, so it
 * is set once the dialog closes.
 *
 * (This is what is left of the old card-reactions file. Desperate Parry, Point-Defense Reflexes, Counterstrike (DD),
 * Projectile Deflector, Steady Footing, Shoot Out and both Defenders - the PR CRB General Perk and the Megaform Trait,
 * whose pilot rules/plugins/zords/megaform-pilot-reactors.mjs finds - are their items' own Reaction rules
 * (rules/reactions.mjs); the card-reaction engine is ../combat/reaction-engine.mjs.)
 */
registerApplyDialog((actor, options, ctx) => {
  if (ctx?.dataset?.snag === true) {
    options.snag = true;
  }
});
