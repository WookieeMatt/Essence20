import { bankPendingBonus } from "./perks.mjs";

/**
 * Megazord Link (A Jump Through Time, Grid Power, p.58): "While piloting a component Zord within a
 * combined Megazord, you can spend 1 Personal Power to gain an upshift 2 bonus to your Driving
 * Skill Tests until the end of the scene. Additionally, and not contingent on activating the first
 * part of this Grid Power, anyone participating in a Driving Skill Group Test with you as part of
 * piloting your Megazord may re-roll any single die involved once per turn and accept the second
 * result."
 *
 * Only the pilot-scoped +2 Driving shiftUp half is built - same bank-now/consume-on-next-matching-
 * roll shape Rev Your Engines' own Driving-scoped bank already established, just a fixed +2 instead
 * of a variable amount. "Piloting a component Zord within a combined Megazord" is approximated as
 * "piloting any Zord" (via dice.mjs's own _getPilotedVehicle(actor, 'driver')) rather than also
 * confirming that Zord is currently merged into a specific Megaform actor's own zordIds list - the
 * same "player self-polices the narrower fictional trigger" idiom Long Shot/Rescue Response's own
 * narrower RAW wording already accepts. The "Driving Skill GROUP Test reroll" half needs this
 * project's still-missing Group Skill Test mechanic (the same gap already blocking Prior
 * Experience/Beneath the Helmet's Megazord Link-adjacent Perks) and isn't built.
 */
export const PENDING_MEGAZORD_LINK_FLAG_KEY = 'pendingMegazordLinkShiftUp';
const MEGAZORD_LINK_SHIFT_UP = 2;

/**
 * @param {Actor} actor
 */
export async function activateMegazordLink(actor) {
  await bankPendingBonus(actor, PENDING_MEGAZORD_LINK_FLAG_KEY, { shiftUp: MEGAZORD_LINK_SHIFT_UP });
}
