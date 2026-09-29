/**
 * Story Point riders.
 *
 * Think Fast! (A Jump Through Time, Inventor, 2nd level, p.33): "when you use Story Points to gain
 * access to a tool or piece of equipment in a scene, roll 1d6. When you roll 5 or 6, you
 * successfully fabricate an improvised version of the item in question and regain the spent Story
 * Point." The Story Points tracker's "equipment" spend calls the `essence20.storyPointNarrative`
 * hook (integration patch); the Initiative Edge half is the pack's own Active Effect.
 *
 * We Improvise (Transformers One Sourcebook, p.15): "The first time you roll an Initiative Skill
 * Test in combat, add a Story Point to the team's pool. At the end of combat, any unspent Story
 * Points gained from this Perk are lost." dice.mjs adds the point and marks
 * flags.essence20.weImproviseUsedThisEncounter; this counts those grants and the pool's spends on
 * the Combat, and at the combat's end takes back the ones not spent (spends count against these
 * points first - they're the ones about to expire).
 *
 * History Buff (A Jump Through Time, Influence Perk, p.54): "You gain a ↑2 bonus on Culture
 * (History) Skill Tests. ... Your actions and activities roll one die smaller (minimum of d2) when
 * determining if they create Continuum Anomalies (see page 113)." The ↑2 is a roll-dialog checkbox
 * on Culture tests (ticked when the History Specialization is rolled); the anomaly half is a Use
 * button that rolls the Continuum Anomaly risk die (Table 4-7) one size smaller and reads the
 * result band (p.113).
 */
import { registerApplyDialog, registerDialogToggles, registerUse } from "../../extensions.mjs";
import { IDS, onHook, T, changed, has, isActiveGm, isItem, num, say } from "./common.mjs";

/* -------------------------------------------- */
/*  Think Fast!                                  */
/* -------------------------------------------- */

onHook('essence20.storyPointNarrative', async (who, kind) => {
  if (kind != 'equipment' || !who?.items || !has(who, IDS.thinkFast)) {
    return;
  }

  const roll = await new Roll('1d6').evaluate();
  await roll.toMessage?.({ speaker: ChatMessage.getSpeaker({ actor: who }), flavor: T('ResThinkFast') });
  if (roll.total >= 5) {
    const { requestStoryPointGrant } = await import("../../story-points.mjs");
    await requestStoryPointGrant(who, 1);
    await say(who, T('ResThinkFastLine', { name: who.name }));
  }
});

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

  const { getStoryPoints, setStoryPoints } = await import("../../story-points.mjs");
  const pool = getStoryPoints();
  const lost = weImproviseForfeit(ledger, pool);
  if (lost > 0) {
    await setStoryPoints(pool - lost);
    await ChatMessage.create({ content: T('ResWeImproviseLost', { count: lost }) });
  }
});

/* -------------------------------------------- */
/*  History Buff                                 */
/* -------------------------------------------- */

registerDialogToggles((actor, { rolledSkill, dataset }) => {
  if (rolledSkill != 'culture' || !has(actor, IDS.historyBuff)) {
    return [];
  }

  const spec = String(dataset?.specializationName ?? dataset?.specialization ?? dataset?.specializationKey ?? '').toLowerCase();
  return [{ name: 'resHistoryBuff', label: T('ResHistoryBuffToggle'), type: 'checkbox', value: spec.includes('history') }];
});

registerApplyDialog((actor, options) => {
  if (options.ext?.resHistoryBuff) {
    options.shiftUp = num(options.shiftUp) + 2;
  }
});

// Table 4-7: Risk Severity for Anomaly.
export const RISK_DICE = { trivial: '1d2', small: '1d4', modest: '1d6', average: '1d8', high: '1d10', serious: '1d12', catastrophic: '2d8' };
const LADDER = ['1d2', '1d4', '1d6', '1d8', '1d10', '1d12', '2d8'];

/** One die smaller, minimum d2. */
export function smallerDie(formula) {
  const i = LADDER.indexOf(formula);
  return i <= 0 ? '1d2' : LADDER[i - 1];
}

/** "2-5 Minor, 6-8 Lasting, 9-14 Major, 15-16 Cataclysmic" (a 1 creates none). */
export function anomalyBand(total) {
  if (total >= 15) return 'cataclysmic';
  if (total >= 9) return 'major';
  if (total >= 6) return 'lasting';
  if (total >= 2) return 'minor';
  return 'none';
}

registerUse({
  id: 'resHistoryBuff',
  matches: item => isItem(item, IDS.historyBuff),
  run: async (item) => {
    const { chooseSelect } = await import("../../grants.mjs");
    const risk = await chooseSelect(item.name, T('ResAnomalyPrompt'),
      Object.keys(RISK_DICE).map(key => ({ value: key, label: T(`ResAnomalyRisk.${key}`) })));
    if (!risk) {
      return null;
    }

    const formula = smallerDie(RISK_DICE[risk]);
    const roll = await new Roll(formula).evaluate();
    // The GM rolls this in secret (p.113), so the result goes to the GM only.
    await roll.toMessage?.({
      speaker: ChatMessage.getSpeaker({ actor: item.parent }),
      flavor: T('ResAnomalyFlavor', { formula, band: T(`ResAnomalyBand.${anomalyBand(roll.total)}`) }),
    }, { rollMode: 'blindroll' });
    return T('ResAnomalyLine', { name: item.parent?.name ?? '' });
  },
});
