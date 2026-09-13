/**
 * Perfect Disguise (GI Joe CRB, Spy Focus, 10th level, p.76): "Once per Mission, you can perfectly
 * imitate the appearance, speech, and mannerisms of any one person, gaining an Edge on all social
 * interactions as that person. You retain an Edge as long as you act more-or-less in character
 * with the person you are imitating." "All social interactions" is read as the same 4 Social
 * Essence skills this book's own Presence Perk already enumerates (Deception, Persuasion,
 * Intimidation, Streetwise) - see PERFECT_DISGUISE_ID's own comment in dice.mjs.
 *
 * A single-purpose on/off toggle, the same "activation costs a limited use, free to switch back
 * off" shape as Observer/Power Boost, but gated on hasUsedThisEncounter instead of a Power spend -
 * "once per Mission" has no matching frequency bucket anywhere in this codebase (no session/
 * mission-scoped resets exist, only scene/encounter/turn/round), so it's approximated down to
 * once per encounter, the same "each session" -> once/encounter idiom Educated/Curb Your
 * Enthusiasm's identical Story-Point grants already established. "Acting in character" and the
 * two ways the disguise breaks (a significant physical mismatch, or being witnessed attacking an
 * ally without justification) are both unenforceable narrative conditions - the same "player/GM
 * self-polices, no hook to verify the fiction" idiom this project already accepts everywhere else -
 * so the toggle stays on until the player switches it off themselves. Same caveat already flagged
 * on Specialist's own once-per-encounter gate: hasUsedThisEncounter/markUsedThisEncounter both
 * no-op outside an active game.combat, the opposite of what a Perk about social interactions
 * (mostly a non-combat activity) actually needs - accepted here for the same reason, rather than
 * left unbuilt.
 */
import { hasUsedThisEncounter, markUsedThisEncounter } from "./perks.mjs";

const PERFECT_DISGUISE_FLAG = 'perfectDisguiseActive';
const PERFECT_DISGUISE_ENCOUNTER_FLAG = 'perfectDisguiseUsedThisEncounter';

/**
 * Whether the actor's disguise is currently switched on.
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function isPerfectDisguiseActive(actor) {
  return !!actor.getFlag?.('essence20', PERFECT_DISGUISE_FLAG);
}

/**
 * Flips the disguise on/off. Turning it ON costs the once-per-encounter use (returns null,
 * spending nothing, if already used this encounter); turning it back OFF is free and doesn't
 * consume another use.
 * @param {Actor} actor
 * @returns {Promise<Boolean|null>}   The new state (true = now active), or null if activation
 *   couldn't be used again this encounter.
 */
export async function togglePerfectDisguise(actor) {
  const nowActive = !isPerfectDisguiseActive(actor);

  if (nowActive) {
    if (hasUsedThisEncounter(actor, PERFECT_DISGUISE_ENCOUNTER_FLAG)) {
      return null;
    }

    await markUsedThisEncounter(actor, PERFECT_DISGUISE_ENCOUNTER_FLAG);
  }

  await actor.setFlag('essence20', PERFECT_DISGUISE_FLAG, nowActive);
  return nowActive;
}
