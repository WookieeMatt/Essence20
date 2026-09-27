import { actorHasPerk, bankPendingBonus } from "./perks.mjs";

/**
 * One-Upping (Across the Stars, Competitive Origin Benefit, p.38): "Anytime one of your allies
 * fails or Fumbles a Skill Test, you may immediately (or on your following action, if in a combat
 * scene) attempt the same Skill Test, if possible, with an upshift 1."
 *
 * RE-CATEGORIZED 2026-09-15 out of a 13-item narrative bucket. Like Spite, the trigger isn't
 * knowable until a roll has already resolved, so this needs the same reactive post-roll chat
 * button rather than a pre-roll checkbox (see chat.mjs#addOneUppingButton). One thing genuinely
 * new here: every other reactive button in this project belongs to the actor who MADE the roll,
 * but One-Upping's beneficiary is someone else entirely - a bystander watching an ally fail. So
 * the claimant is resolved from the viewing user's own character rather than the message speaker,
 * and each viewer only ever sees the button if their own character qualifies.
 *
 * "Attempt the same Skill Test" is the player simply rolling that skill themselves; what needs
 * automating is only the upshift 1 that comes with it, banked scoped to that same skill so it
 * can't leak onto an unrelated roll. The "immediately, or on your following action" timing is the
 * usual "consumed on the next matching roll" approximation this project applies to every banked
 * bonus - there is no turn-boundary enforcement anywhere to hold it to something stricter.
 */
export const ONE_UPPING_ID = "Compendium.essence20.across_the_stars.Item.ztdjBJ7H7WJiIH9i";
export const PENDING_ONE_UPPING_FLAG_KEY = 'pendingOneUpping';

/**
 * The viewing user's own character, if it can claim this particular failed roll - it holds
 * One-Upping and isn't the actor who just failed (RAW scopes this to "one of your ALLIES").
 * Disposition isn't checked: a failed roll posted by a GM-controlled enemy isn't an ally's, but
 * this codebase has no reliable per-message "was this an ally" signal beyond the speaker itself,
 * and the button only ever appears to a player whose own character holds the Perk - the same
 * "the player self-polices the fictional trigger" idiom every other narrative-gated Perk here uses.
 * @param {Actor} rollingActor   The actor whose Skill Test just failed.
 * @returns {Actor|null}
 */
export function findOneUppingClaimant(rollingActor) {
  const claimant = game.user?.character;
  if (!claimant || claimant.id == rollingActor?.id || !actorHasPerk(claimant, ONE_UPPING_ID)) {
    return null;
  }

  return claimant;
}

/**
 * Banks the upshift 1, scoped to the skill the ally just failed.
 * @param {Actor} actor   The One-Upping holder.
 * @param {String} skill
 */
export async function activateOneUpping(actor, skill) {
  await bankPendingBonus(actor, PENDING_ONE_UPPING_FLAG_KEY, { shiftUp: 1, skill });
}
