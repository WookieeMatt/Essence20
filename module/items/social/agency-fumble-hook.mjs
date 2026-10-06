import { suppressesFumbleStoryPoint } from "./agency-hang-up.mjs";

/**
 * Plugs into the small array scratchpad integration/react-patch.cjs adds to a core file: dice.mjs
 * FUMBLE_STORY_POINT_SUPPRESSORS (Agency). Loaded at setup with a dynamic import, so the core file
 * doesn't import this slice - and nothing breaks if the patch hasn't been applied yet.
 */

export async function installHooks() {
  try {
    const dice = await import("../../dice.mjs");
    if (Array.isArray(dice.FUMBLE_STORY_POINT_SUPPRESSORS) && !dice.FUMBLE_STORY_POINT_SUPPRESSORS.includes(suppressesFumbleStoryPoint)) {
      dice.FUMBLE_STORY_POINT_SUPPRESSORS.push(suppressesFumbleStoryPoint);
    }
  } catch (error) {
    console.error('Essence20 | react: Agency hook not installed', error);
  }
}

globalThis.Hooks?.once('setup', () => {
  installHooks();
});
