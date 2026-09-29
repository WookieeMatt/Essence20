import { actorHasPerk } from "../../perks.mjs";
import { suppressesFumbleStoryPoint, TRIG } from "./triggers.mjs";

/**
 * Plugs into the two small arrays scratchpad integration/react-patch.cjs adds to core files:
 * dice.mjs FUMBLE_STORY_POINT_SUPPRESSORS (Agency) and lend-assistance.mjs ASSIST_RANK_BYPASSES
 * (Inspirational Leader). Loaded at setup with a dynamic import, so neither core file imports this
 * slice - and nothing breaks if the patch hasn't been applied yet.
 */

/**
 * Inspirational Leader (Across the Stars p.69): "Outside of combat, you can Lend Assistance to any
 * individual who considers you a leader even if you don't have any Ranks in the Skill." Whether
 * they consider you their leader is the table's call; out of combat, the rank gate is lifted.
 */
export function inspirationalLeaderAssist(actor) {
  return !game.combat && actorHasPerk(actor, TRIG.inspirationalLeader);
}

export async function installHooks() {
  try {
    const dice = await import("../../../dice.mjs");
    if (Array.isArray(dice.FUMBLE_STORY_POINT_SUPPRESSORS) && !dice.FUMBLE_STORY_POINT_SUPPRESSORS.includes(suppressesFumbleStoryPoint)) {
      dice.FUMBLE_STORY_POINT_SUPPRESSORS.push(suppressesFumbleStoryPoint);
    }
  } catch (error) {
    console.error('Essence20 | react: Agency hook not installed', error);
  }

  try {
    const lend = await import("../../lend-assistance.mjs");
    if (Array.isArray(lend.ASSIST_RANK_BYPASSES) && !lend.ASSIST_RANK_BYPASSES.includes(inspirationalLeaderAssist)) {
      lend.ASSIST_RANK_BYPASSES.push(inspirationalLeaderAssist);
    }
  } catch (error) {
    console.error('Essence20 | react: Inspirational Leader hook not installed', error);
  }
}

globalThis.Hooks?.once('setup', () => {
  installHooks();
});
