/**
 * Homebrew: the episode tools - the Mission Generator (mechanics/campaign/mission.mjs) and the Race and Chase Tracker
 * (mechanics/campaign/race.mjs). Off, their buttons stay hidden (the Journal tab's footer, the Token controls), as in a
 * book game; game.essence20.episode opens them either way.
 */
export const EPISODE_TOOLS_SETTING = 'episodeTools';

/** The world's mission write-ups, by source: {[source key]: {title, outline}}, and the last source used (`_last`). */
export const MISSION_TEMPLATES_SETTING = 'missionTemplates';

/** Whether the GM sees the episode tools' buttons. */
export function episodeToolsOn() {
  try {
    return !!globalThis.game?.user?.isGM && !!globalThis.game.settings.get('essence20', EPISODE_TOOLS_SETTING);
  } catch {
    return false;
  }
}
