import { CHECK_NAMES, registerCheck } from "../../predicate.mjs";

/**
 * Round 15 (dice part): more `check:<name>` tags (rules/predicate.mjs#CHECK_NAMES) - state the system's own helpers keep,
 * named for the state rather than an item. The helpers are loaded at `setup` (plain Node can't load them at import
 * time); until then - and in tests that don't fill `diceChecks` - each check answers false.
 *
 *   inAppraisedArea   the actor stands in the 20x20 ft area its Eye for Appraisal picked against the other party
 *                     (its `appraisal` mark's kept point - rules/plugins/marks/counted-marks.mjs#inMarkedArea; Vantage Point)
 *   attackedByAlly    the other party was attacked this round by one of this actor's allies (same token disposition,
 *                     not this actor - items/attacks/team-focus.mjs#attackedByAllyThisRound; Team Focus, Withering Fire)
 */

/** The helpers the checks read, filled at setup (tests set them directly). */
export const diceChecks = {
  isInAppraisedArea: null,
  attackedByAllyThisRound: null,
};

export async function loadDiceChecks() {
  const [appraisal, teamFocus] = await Promise.all([
    import("../marks/counted-marks.mjs"),
    import("../../../items/attacks/team-focus.mjs"),
  ]);
  // Eye For Appraisal's spot: its appraisal mark's kept point (round 16, part b).
  diceChecks.isInAppraisedArea = (attacker, target, token) => appraisal.inMarkedArea(attacker, target, token, 'appraisal');
  diceChecks.attackedByAllyThisRound = teamFocus.attackedByAllyThisRound;
}

const CHECKS = {
  inAppraisedArea: (actor, option, ctx) => !!(diceChecks.isInAppraisedArea && ctx?.other
    && diceChecks.isInAppraisedArea(actor, ctx.other, actor?.getActiveTokens?.()?.[0] ?? null)),
  attackedByAlly: (actor, option, ctx) => !!(diceChecks.attackedByAllyThisRound && ctx?.other && diceChecks.attackedByAllyThisRound(actor, ctx.other)),
};

for (const [name, fn] of Object.entries(CHECKS)) {
  if (!CHECK_NAMES.includes(name)) {
    CHECK_NAMES.push(name);
  }

  registerCheck(name, fn);
}

globalThis.Hooks?.once?.('setup', () => {
  loadDiceChecks().catch(error => console.error('Essence20 | round 15 dice checks failed to load', error));
});
