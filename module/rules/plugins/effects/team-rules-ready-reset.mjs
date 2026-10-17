import { rulesOfType } from "../../index.mjs";
import { worldActors } from "../shared/zord-crew-lookups.mjs";

/**
 * Group A (round 10): rules reaching the whole team (scope team) change a teammate's derived data, and the team scan
 * can miss a holder prepared before the world finished loading - prepare the Player Characters again once everyone
 * exists.
 */

globalThis.Hooks?.once?.('ready', () => {
  const team = worldActors().filter(actor => actor?.type == 'playerCharacter');
  if (team.some(actor => ['Movement', 'DerivedStat', 'Defense'].some(type => rulesOfType(actor, type, 'team').length))) {
    for (const member of team) {
      member.reset?.();
    }
  }
});
