// Rules-engine plug-ins, round 16 (part b - docs/rules-batches/slLeftB16.md). Registered on import; see
// module/rules/plugins/index.mjs.
import { registerUntil } from "../../expiry.mjs";

/**
 * Two durations tied to the combat a mark / bank was set in - the readings the old banked-on-target Perks made with a
 * {combatId, round} stamp:
 *
 *  - `until: "combatRound"` - while that combat is the current one and its round is the one it started in. Set out of
 *    combat, it never counts (Ground Suppression's "-5 until the start of your next turn", read at round granularity).
 *  - `until: "combatThroughNextRound"` - while that combat is the current one, through the round after the one it started
 *    in (Tech Specs' "this round and the next"). Set out of combat, it never counts.
 */

const stampOf = combat => ({ combatId: combat?.id ?? null, round: combat ? Number(combat.round) || 0 : null });
const sameCombat = (stamp, combat) => !!combat && !!stamp?.combatId && stamp.combatId == combat.id;

registerUntil('combatRound', {
  stamp: stampOf,
  expired: (stamp, combat) => !sameCombat(stamp, combat) || (Number(combat.round) || 0) != stamp.round,
});

registerUntil('combatThroughNextRound', {
  stamp: stampOf,
  expired: (stamp, combat) => !sameCombat(stamp, combat) || (Number(combat.round) || 0) > (Number(stamp.round) || 0) + 1,
});
