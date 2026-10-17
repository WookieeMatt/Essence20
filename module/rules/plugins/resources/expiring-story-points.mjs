// Rules-engine plug-ins, round 18 (convB - docs/rules-batches/slConvB18.md): Story Points that expire with the combat.
// Registered on import; see module/rules/plugins/index.mjs. Plain Node safe (story-points.mjs is loaded lazily).
import { changed } from "../../../items/shared/resource-team-lookups.mjs";
import { resolveValue } from "../../formula.mjs";
import { registerStep } from "../../steps.mjs";

/**
 * Step `storyPointsExpire {count?, message?}` - after a `grantStoryPoint`: those `count` (a formula, default 1) points
 * belong to the running combat. The active GM keeps one ledger per combat (`flags.essence20.expiringStoryPoints` on the
 * Combat: {granted, spent, message}) - every such grant, and every Story Point the team's pool loses while the combat
 * runs (spends count against these points first: they're the ones about to go). When the combat is deleted, the points
 * granted and not spent - never more than the pool holds - are taken off it, with `message` (an E20. key, {count})
 * posted. Outside a combat the step does nothing. We Improvise: `[{do: grantStoryPoint}, {do: storyPointsExpire,
 * message: "E20.ResWeImproviseLost"}]`.
 *
 * The step marks the actor (`flags.essence20.expiringStoryPointsGrant` - {combatId, count, message, at}, written by its
 * owner or through the GM relay); the GM's client turns that mark into the ledger entry (a Combat is the GM's to write).
 */

const GRANT_FLAG = 'expiringStoryPointsGrant';
const LEDGER_FLAG = 'expiringStoryPoints';

const isActiveGm = () => {
  const active = globalThis.game?.users?.activeGM;
  return active ? !!active.isSelf : !!globalThis.game?.user?.isGM;
};

/** How many expiring points go when the combat ends. */
export function expiringForfeit({ granted = 0, spent = 0 } = {}, pool = 0) {
  return Math.max(0, Math.min(pool, granted - spent));
}

registerStep('storyPointsExpire', async (step, ctx) => {
  const combat = globalThis.game?.combat;
  const count = Math.max(0, Math.round(resolveValue(step.count ?? 1, { actor: ctx.actor, item: ctx.item, vars: ctx.vars }, 1)));
  if (!combat || !count || !ctx.actor) {
    return;
  }

  const mark = { combatId: combat.id, count, message: step.message ?? null, at: `${Date.now()}-${Math.random()}` };
  const { needsGmRelay, relayToGm } = await import("../../../mechanics/world/gm-relay.mjs");
  const args = ['essence20', GRANT_FLAG, mark];
  await (needsGmRelay(ctx.actor) ? relayToGm(ctx.actor, 'setFlag', args) : ctx.actor.setFlag(...args));
}, {
  errors: (step, where) => (step.message !== undefined && typeof step.message != 'string' ? [`${where}: storyPointsExpire message must be text`] : []),
});

/** Add to the running combat's ledger (the GM's client). */
export async function bumpLedger(combat, changes) {
  if (!combat?.setFlag) {
    return;
  }

  const ledger = { granted: 0, spent: 0, message: null, ...(combat.getFlag?.('essence20', LEDGER_FLAG) ?? {}) };
  ledger.granted += Number(changes.granted) || 0;
  ledger.spent += Number(changes.spent) || 0;
  ledger.message = changes.message ?? ledger.message;
  await combat.setFlag('essence20', LEDGER_FLAG, ledger);
}

/** An actor's grant mark landed: the GM books it on that combat. */
export async function onGrantMarked(actor, changes) {
  const mark = changed(changes, `flags.essence20.${GRANT_FLAG}`);
  const combat = globalThis.game?.combat;
  if (!mark?.count || !isActiveGm() || !combat || mark.combatId != combat.id) {
    return;
  }

  await bumpLedger(combat, { granted: mark.count, message: mark.message });
}

/** The pool went down by `drop` while a combat runs: the GM counts it as spent. */
export async function onPoolDropped(drop) {
  const combat = globalThis.game?.combat;
  if (!(drop > 0) || !isActiveGm() || !combat || !combat.getFlag?.('essence20', LEDGER_FLAG)?.granted) {
    return;
  }

  await bumpLedger(combat, { spent: drop });
}

/** A combat was deleted: its unspent expiring points come off the pool. */
export async function settleCombat(combat) {
  const ledger = combat?.getFlag?.('essence20', LEDGER_FLAG);
  if (!isActiveGm() || !ledger?.granted) {
    return 0;
  }

  const { getStoryPoints, setStoryPoints } = await import("../../../mechanics/resources/story-points.mjs");
  const pool = getStoryPoints();
  const lost = expiringForfeit(ledger, pool);
  if (lost > 0) {
    await setStoryPoints(pool - lost);
    const i18n = globalThis.game?.i18n;
    const key = ledger.message && i18n?.has?.(ledger.message) ? ledger.message : 'E20.RulesExtConvB18.StoryPointsExpired';
    await globalThis.ChatMessage?.create?.({ content: i18n?.format?.(key, { count: lost }) ?? `${lost}` });
  }

  return lost;
}

const hooks = globalThis.Hooks;
hooks?.on?.('updateActor', (actor, changes) => {
  if (changed(changes, `flags.essence20.${GRANT_FLAG}`)) {
    onGrantMarked(actor, changes).catch(error => console.error('Essence20 | storyPointsExpire', error));
  }
});

hooks?.on?.('preUpdateActor', (actor, changes, options) => {
  if (actor?.type == 'party' && changed(changes, 'system.storyPoints') !== undefined) {
    options.essence20PrevStoryPoints = Number(actor.system?.storyPoints) || 0;
  }
});

hooks?.on?.('updateActor', (actor, changes, options) => {
  if (actor?.type != 'party' || options?.essence20PrevStoryPoints === undefined || changed(changes, 'system.storyPoints') === undefined) {
    return;
  }

  const drop = options.essence20PrevStoryPoints - (Number(changed(changes, 'system.storyPoints')) || 0);
  onPoolDropped(drop).catch(error => console.error('Essence20 | storyPointsExpire', error));
});

hooks?.on?.('deleteCombat', combat => {
  settleCombat(combat).catch(error => console.error('Essence20 | storyPointsExpire', error));
});
