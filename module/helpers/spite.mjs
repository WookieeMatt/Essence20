import { actorHasPerk, bankPendingBonus } from "./perks.mjs";

/**
 * Spite (Beneath the Helmet, Dark Ranger, 2nd level, p.39): "Whenever you miss your Attack Skill
 * Test against a creature, you can spend 1 Personal Power to manifest your ire, providing Edge to
 * the next Attack against your target. This effect ends at the start of your next turn or the
 * first time the target is successfully attacked."
 *
 * Unlike every other declared-intent Perk in this project (a Roll Options Dialog checkbox checked
 * BEFORE rolling), Spite's own trigger is genuinely reactive - you only know you've missed AFTER
 * the roll resolves, so there's nothing to check ahead of time. The actual matching precedent is
 * chat.mjs#addConsummatePerformerButton: a button posted onto the roll's own chat message after
 * the fact, gated on the roll's outcome (there, a success; here, a miss) - see
 * chat.mjs#addSpiteButton for the button/click wiring itself, this file just holds the actual
 * grant.
 *
 * The banked Edge is scoped to the specific target (by uuid, matching how targets are already
 * resolved via fromUuid elsewhere in this codebase) rather than any Attack - the same "self-Edge
 * scoped to one other actor" shape Menacing Glare's own Edge effect already established, just
 * Attack-gated (RAW says "next Attack," not "next Skill Test") rather than unscoped. "Ends at the
 * start of your next turn or the first time the target is successfully attacked [by anyone]"
 * isn't actively enforced beyond the actor's own next qualifying Attack consuming it - the same
 * "approximate, don't hard-enforce every clause" idiom this project already accepts elsewhere.
 */
const SPITE_ID = "Compendium.essence20.beneath_the_helmet.Item.Gadtv1eSeFgNotSw";
export const SPITE_EDGE_FLAG = 'pendingSpiteEdge';

export function hasSpite(actor) {
  return actorHasPerk(actor, SPITE_ID);
}

/**
 * Spends 1 Personal Power and banks the target-scoped Edge grant - called once the chat button's
 * own affordability/claimed checks have already passed.
 * @param {Actor} actor   The Dark Ranger who missed.
 * @param {String} targetUuid   The target they missed against.
 */
export async function activateSpite(actor, targetUuid) {
  await actor.update({ 'system.powers.personal.value': actor.system.powers.personal.value - 1 });
  await bankPendingBonus(actor, SPITE_EDGE_FLAG, { targetUuid });
}
