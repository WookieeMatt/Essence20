/**
 * Expiry for LINGERING Area of Effect regions - the one piece of the lingering-AoE feature Foundry
 * doesn't do for us.
 *
 * v14's ActiveEffect registry already expires the EFFECT a region applies (duration.expiry plus
 * the core turnStart/turnEnd/roundStart/roundEnd/combatStart/combatEnd events, refreshed by
 * Combat itself). Nothing, however, expires the REGION: left alone, an area placed by a "3 rounds"
 * spell would sit on the scene forever, still catching anyone who walks into it. This file is the
 * pass that deletes it.
 *
 * Every lingering region carries its provenance in flags.essence20.aoe (see
 * helpers/aoe-targeting.mjs) rather than in any in-memory bookkeeping, specifically so expiry
 * survives a reload and works from a client that wasn't the one that placed the area.
 *
 * WHO RUNS IT. Deleting a scene-embedded document needs a GM, and running the same delete on
 * several clients at once would race, so every entry point here is gated on
 * game.users.activeGM?.isSelf - core's own "one designated client" idiom, the same gate
 * ActiveEffectRegistry uses for its own expiry pass. Combat#_onEndRound already only fires for
 * that one user; updateWorldTime and ready fire everywhere, so they need the gate explicitly.
 *
 * isAoeExpired and durationToSeconds are pure and unit tested. The scan/delete around them touches
 * real scenes and is verified live, consistent with the rest of this codebase's canvas layer.
 */

const AOE_FLAG_SCOPE = 'essence20';
const AOE_FLAG_KEY = 'aoe';

/**
 * A duration expressed in seconds of world time, or null for a duration that isn't measured in
 * time at all (rounds, scenes, instant, special).
 *
 * Unit lengths come from the world's own calendar rather than being hardcoded - a world running a
 * custom calendar can define a day that isn't 24 hours, and a "1 day" spell should last one of
 * THAT world's days. Falls back to the ordinary real-world lengths when no calendar is available
 * (notably under unit test).
 * @param {{units: String, value: Number|null}} duration
 * @param {{secondsPerMinute: Number, minutesPerHour: Number, hoursPerDay: Number}} [days]
 *   The calendar's own day structure, i.e. game.time.calendar.days.
 * @returns {Number|null}
 */
export function durationToSeconds(duration, days) {
  if (!duration?.value) {
    return null;
  }

  const secondsPerMinute = days?.secondsPerMinute ?? 60;
  const secondsPerHour = secondsPerMinute * (days?.minutesPerHour ?? 60);
  const secondsPerDay = secondsPerHour * (days?.hoursPerDay ?? 24);

  switch (duration.units) {
    case 'minutes':
      return duration.value * secondsPerMinute;
    case 'hours':
      return duration.value * secondsPerHour;
    case 'days':
      return duration.value * secondsPerDay;
    default:
      return null;
  }
}

/**
 * Whether a lingering area has run out, given whatever just happened.
 *
 * The three measured cases are deliberately independent, because this system's world clock and its
 * combat rounds are not connected: CONFIG.time.roundTime is never set, so advancing a combat round
 * doesn't advance game.time.worldTime at all. A rounds-based area therefore has to count rounds,
 * and a minutes/hours/days one has to watch world time; neither can be expressed in terms of the
 * other.
 *
 *   rounds  - counted inclusively from the round it was placed in. A "3 rounds" area placed during
 *             round 3 covers rounds 3, 4 and 5, and dies at the end of round 5.
 *   scenes  - no clock of its own; ends when the encounter does (see expireAoeRegionsForScene).
 *   special - never expires on its own. The duration couldn't be parsed, so the GM deletes it by
 *             hand rather than this guessing a length for it.
 *
 * @param {Object} aoe   The region's own flags.essence20.aoe payload.
 * @param {Object} context
 * @param {Number} [context.round]        The combat round that just ended, if a round just ended.
 * @param {Number} [context.worldTime]    The current game.time.worldTime.
 * @param {Boolean} [context.sceneEnded]  True when the encounter itself has ended.
 * @param {Object} [context.calendarDays] game.time.calendar.days, for unit lengths.
 * @returns {Boolean}
 */
export function isAoeExpired(aoe, context = {}) {
  const duration = aoe?.duration;
  if (!duration) {
    return false;
  }

  switch (duration.units) {
    case 'instant':
      // Shouldn't ever be on the scene in the first place (an Instant area is never persisted),
      // so if one somehow is, it's stale by definition.
      return true;

    case 'special':
      return false;

    case 'scenes':
      return !!context.sceneEnded;

    case 'rounds': {
      // Placed outside combat, so there are no rounds to count. It stays until the encounter ends
      // or the GM removes it, rather than vanishing on the first round of an unrelated fight.
      if (aoe.placedAtRound == null || context.round == null) {
        return !!context.sceneEnded;
      }

      const roundsElapsed = context.round - aoe.placedAtRound + 1;
      return roundsElapsed >= (duration.value ?? 0);
    }

    case 'minutes':
    case 'hours':
    case 'days': {
      const seconds = durationToSeconds(duration, context.calendarDays);
      if (seconds == null || aoe.placedAtWorldTime == null || context.worldTime == null) {
        return !!context.sceneEnded;
      }

      return context.worldTime >= aoe.placedAtWorldTime + seconds;
    }

    default:
      return false;
  }
}

/**
 * Deletes every lingering AoE region that has run out, across every scene - not just the viewed
 * one, since an area placed on a scene the GM has since navigated away from still has to expire on
 * time. No-ops entirely on any client that isn't the designated GM.
 * @param {Object} context   As isAoeExpired's own context.
 * @returns {Promise<Number>}   How many regions were deleted.
 */
export async function expireAoeRegions(context = {}) {
  if (!game.users.activeGM?.isSelf) {
    return 0;
  }

  const fullContext = {
    worldTime: game.time?.worldTime ?? null,
    calendarDays: game.time?.calendar?.days,
    ...context,
  };

  let deleted = 0;
  for (const scene of game.scenes ?? []) {
    const expiredIds = scene.regions
      .filter(region => {
        const aoe = region.getFlag(AOE_FLAG_SCOPE, AOE_FLAG_KEY);
        return !!aoe && isAoeExpired(aoe, fullContext);
      })
      .map(region => region.id);

    if (expiredIds.length) {
      await scene.deleteEmbeddedDocuments('Region', expiredIds);
      deleted += expiredIds.length;
    }
  }

  return deleted;
}

/**
 * The "the encounter is over" sweep - clears anything whose duration is tied to the scene rather
 * than to a clock ("1 scene"), plus any round-based area that outlived the combat it was counting
 * rounds in. Called from the deleteCombat hook, this codebase's existing "combat has ended" signal.
 * @returns {Promise<Number>}
 */
export async function expireAoeRegionsForScene() {
  return expireAoeRegions({ sceneEnded: true });
}

/**
 * The reload sweep - catches anything that should have expired while nobody was logged in, or
 * whose expiry was missed because no GM was connected at the time. Round-based areas are left
 * alone here (their combat is long gone, and expireAoeRegionsForScene handles that case when the
 * encounter actually ends).
 * @returns {Promise<Number>}
 */
export async function reconcileAoeRegions() {
  return expireAoeRegions({});
}
