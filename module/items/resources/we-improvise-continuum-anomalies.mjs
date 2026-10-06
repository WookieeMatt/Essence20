/**
 * Story Point riders. (Think Fast!'s Story Point refund is a storyPointNarrative Trigger on its item -
 * rules/conv10-slD10.test.js.)
 *
 * We Improvise (Transformers One Sourcebook, p.15): "The first time you roll an Initiative Skill
 * Test in combat, add a Story Point to the team's pool. At the end of combat, any unspent Story
 * Points gained from this Perk are lost." The item's own rule adds the point and marks
 * flags.essence20.weImproviseUsedThisEncounter; this counts those grants and the pool's spends on
 * the Combat, and at the combat's end takes back the ones not spent (spends count against these
 * points first - they're the ones about to expire).
 *
 * (The Continuum Anomaly checks - History Buff's one die smaller, Time Displaced's one die larger - are their items' own
 * Use rules: rules/conv10-slC10.test.js, rules/conv17-split2.test.js.)
 */
import { changed, IDS } from "../shared/resource-team-lookups.mjs";
import { isActiveGm, onHook } from "../shared/hooks-and-clients.mjs";
import { T } from "../shared/item-lang.mjs";
import { has } from "../shared/item-lookups.mjs";
import { num } from "../shared/numbers.mjs";

/* -------------------------------------------- */
/*  We Improvise                                 */
/* -------------------------------------------- */

const WE_IMPROVISE_FLAG = 'weImproviseUsedThisEncounter';
const COMBAT_FLAG = 'weImproviseLedger';

/** How many We Improvise points go at the end of combat. */
export function weImproviseForfeit({ granted = 0, spent = 0 } = {}, pool = 0) {
  return Math.max(0, Math.min(pool, granted - spent));
}

async function bump(key) {
  const combat = game.combat;
  if (!combat) {
    return;
  }

  const ledger = { granted: 0, spent: 0, ...(combat.getFlag('essence20', COMBAT_FLAG) ?? {}) };
  ledger[key] += 1;
  await combat.setFlag('essence20', COMBAT_FLAG, ledger);
}

onHook('updateActor', (actor, changes) => {
  if (!isActiveGm() || !game.combat) {
    return;
  }

  if (changed(changes, `flags.essence20.${WE_IMPROVISE_FLAG}`) !== undefined && has(actor, IDS.weImprovise)) {
    bump('granted').catch(error => console.error('Essence20 | We Improvise', error));
  }
});

onHook('preUpdateActor', (actor, changes, options) => {
  if (actor.type == 'party' && changed(changes, 'system.storyPoints') !== undefined) {
    options.essence20PrevStoryPoints = num(actor.system?.storyPoints);
  }
});

onHook('updateActor', (actor, changes, options) => {
  if (!isActiveGm() || !game.combat || actor.type != 'party' || options?.essence20PrevStoryPoints === undefined) {
    return;
  }

  const next = num(changed(changes, 'system.storyPoints'));
  const drop = options.essence20PrevStoryPoints - next;
  for (let i = 0; i < drop; i++) {
    bump('spent').catch(error => console.error('Essence20 | We Improvise', error));
  }
});

onHook('deleteCombat', async (combat) => {
  if (!isActiveGm()) {
    return;
  }

  const ledger = combat.getFlag?.('essence20', COMBAT_FLAG);
  if (!ledger?.granted) {
    return;
  }

  const { getStoryPoints, setStoryPoints } = await import("../../mechanics/resources/story-points.mjs");
  const pool = getStoryPoints();
  const lost = weImproviseForfeit(ledger, pool);
  if (lost > 0) {
    await setStoryPoints(pool - lost);
    await ChatMessage.create({ content: T('ResWeImproviseLost', { count: lost }) });
  }
});
