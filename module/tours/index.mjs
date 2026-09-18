import { Essence20Tour } from "./essence20-tour.mjs";
import { cleanupDemoActors } from "./demo-content.mjs";

/**
 * The tours this system registers, in the order they appear in Manage Tours.
 *
 * `file` is the JSON basename under `tours/`; `id` is the machine id the tour is registered and
 * stores its progress under, so renaming a file is safe but renaming an id resets every user's
 * progress for that tour.
 * @type {Array<{file: string, id: string, cls: typeof Essence20Tour}>}
 */
const TOURS = [
  { file: "welcome", id: "welcome", cls: Essence20Tour },
  { file: "character-sheet", id: "characterSheet", cls: Essence20Tour },
  { file: "skills-and-essences", id: "skillsAndEssences", cls: Essence20Tour },
  { file: "making-a-roll", id: "makingARoll", cls: Essence20Tour },
  { file: "gear-and-weapons", id: "gearAndWeapons", cls: Essence20Tour },
  { file: "perks-and-roles", id: "perksAndRoles", cls: Essence20Tour },
  { file: "powers-and-morphing", id: "powersAndMorphing", cls: Essence20Tour },
  { file: "transformers", id: "transformers", cls: Essence20Tour },
  { file: "active-effects", id: "activeEffects", cls: Essence20Tour },
  { file: "npcs-and-combat", id: "npcsAndCombat", cls: Essence20Tour },
  { file: "vehicles-zords-megaforms", id: "vehiclesZordsMegaforms", cls: Essence20Tour },
  { file: "story-points", id: "storyPoints", cls: Essence20Tour },
  { file: "item-authoring", id: "itemAuthoring", cls: Essence20Tour },
  { file: "enrichers-and-macros", id: "enrichersAndMacros", cls: Essence20Tour },
];

/**
 * Register the Essence20 tours.
 *
 * Called on "setup": `game.tours` is built in the Game constructor, but `foundry.nue.registerTours`
 * runs after `i18n.initialize()` and before the setup hook, so setup is the first moment at which
 * both the collection exists and i18n is live. The Tour constructor touches `game.i18n._fallback`,
 * so registering any earlier throws.
 *
 * Each tour is registered independently so one malformed JSON file can't take the whole suite down
 * with it - a broken tour should cost us that tour, not all of them.
 * @returns {Promise<void>}
 */
export async function registerEssence20Tours() {
  for (const { file, id, cls } of TOURS) {
    try {
      const tour = await cls.fromJSON(`systems/essence20/tours/${file}.json`);
      game.tours.register("essence20", id, tour);
    } catch (err) {
      console.error(`Essence20 | Failed to register tour "${file}"`, err);
    }
  }
}

/**
 * Sweep up demo actors left behind by a tour that didn't exit cleanly.
 *
 * Tours delete their own demo content on exit and on completion, but a refresh, a disconnect or a
 * crash mid-tour skips both. Without this the actors would sit in the user's world permanently,
 * and the next run would find them and reuse them in whatever half-edited state they were left in.
 * Safe to call unconditionally: it only ever deletes documents carrying the tour's own flag, and
 * it no-ops for non-GMs.
 * @returns {Promise<void>}
 */
export async function sweepTourDemoContent() {
  if (foundry.nue.Tour.tourInProgress) return;

  try {
    await cleanupDemoActors();
  } catch (err) {
    console.error("Essence20 | Failed to sweep leftover tour demo content", err);
  }
}
