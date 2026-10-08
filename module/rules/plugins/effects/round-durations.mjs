// Rules-engine plug-ins, round 15 (banked - docs/rules-batches/slBanked15.md). Registered on import; see
// module/rules/plugins/index.mjs.
import { registerUntil } from "../../expiry.mjs";
import { registerRef } from "../../formula.mjs";

/** @combat.round / @combat.turn - the current combat's round / turn (0 with no combat). */
registerRef('combat', key => {
  const combat = globalThis.game?.combat;
  if (key == 'round') {
    return Number(combat?.round) || 0;
  }

  return key == 'turn' ? Number(combat?.turn) || 0 : 0;
});

const roundOf = combat => (combat ? Number(combat.round) || 0 : null);

/**
 * `until: "thisRound"` - while the combat round stays the one it started in; out of combat, until a combat round is
 * running (the stamp's round is null then). The round-only check Engine Override's boost made (whichever combat).
 */
registerUntil('thisRound', {
  stamp: combat => ({ round: combat?.round ?? null }),
  expired: (stamp, combat) => (combat?.round ?? null) !== (stamp.round ?? null),
});

/**
 * `until: "throughNextRound"` - through the round after the one it started in (round 0 out of combat); never runs out out
 * of combat. The `expiresRound: round + 1` reading Hup! Hup! Hup! Hup! Hup! and Jury Rig's Free mode made (whichever
 * combat: a bonus given out of combat counts in a later combat's first round too).
 */
registerUntil('throughNextRound', {
  stamp: combat => ({ round: roundOf(combat) ?? 0 }),
  expired: (stamp, combat) => (combat ? (Number(combat.round) || 0) > (Number(stamp.round) || 0) + 1 : false),
});

/**
 * `until: "mapScene"` - while the scene being viewed is the one it started on (game.scenes.current): Distracting Offer's
 * "this scene", which keyed on the map rather than the Scene Clock.
 */
registerUntil('mapScene', {
  stamp: () => ({ sceneId: globalThis.game?.scenes?.current?.id ?? null }),
  expired: stamp => (globalThis.game?.scenes?.current?.id ?? null) !== (stamp.sceneId ?? null),
});
