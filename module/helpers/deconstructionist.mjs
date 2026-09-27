import { bankPendingBonus } from "./perks.mjs";

/**
 * Deconstructionist (Quartermaster's Guide to Gear, Neutralizer Focus, 1st level, p.26): "As a
 * Standard action, you can target a piece of enemy Computerized equipment within 100ft. If the
 * equipment is operated by one or more creatures, roll a Technology Skill Contest against one of
 * the creatures operating the equipment. If no one operates the equipment, roll against the
 * equipment's availability DIF. On a success, any Skill Tests using the equipment or that the
 * equipment makes gain Snag for 1 turn. Additionally, you do not suffer automatic Downshifts for
 * distraction when you make a Technology Skill Test to disrupt a piece of equipment in combat."
 *
 * Same "plain Skill Test, only the checkbox and post-success effect live here" shape as Menacing
 * Glare/Instill Weakness's own doc comments - whether this resolves as a Skill Contest against an
 * operator or a flat DIF against the equipment's own availability is left to the player/GM to set
 * up manually (a Skill Contest concept doesn't exist anywhere else in this codebase either, so
 * there's nothing generic to build for it - same "the roll itself needs no new code" finding). The
 * Snag itself reuses Brute Force Works Best's own identical "equipment gains Snag" bank
 * (helpers/brute-force-works-best.mjs) - approximated as this project's own "piece of equipment" =
 * `target.type == 'vehicle'` proxy that Brute Force Works Best/Stick In The Spokes already
 * establish, banked here as a plain Snag with no accompanying downshift (RAW grants only Snag, not
 * Brute Force Works Best's own extra ↓1). The "no automatic Downshifts for distraction" clause
 * isn't built - no generic "distracted while using Technology in combat" downshift exists anywhere
 * in this codebase for it to suppress.
 */
export const DECONSTRUCTIONIST_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.2qb5dV11qvWsN4xJ";

const PENDING_FLAG = 'pendingDeconstructionist';

/**
 * Banks a 1-turn Snag on the targeted equipment - see DECONSTRUCTIONIST_ID's own comment above for
 * why "1 turn" is approximated the same "target's own next Skill Test" way Brute Force Works
 * Best's identical duration already is.
 * @param {Actor} targetActor
 */
export async function markDeconstructionist(targetActor) {
  await bankPendingBonus(targetActor, PENDING_FLAG, { snag: true });
}

export { PENDING_FLAG as DECONSTRUCTIONIST_FLAG };
