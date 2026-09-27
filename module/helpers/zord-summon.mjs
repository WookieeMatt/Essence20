import { actorHasPerk } from "./perks.mjs";

/**
 * Call to Action (PR CRB, Zord Feature, p.136-137, auto-added to every Zord actor - see
 * documents/actor.mjs#_preCreate): "In 3d2 game rounds, the Zord arrives to the border of the
 * conflict, awaiting to be piloted by the Ranger that summoned it." This existed nowhere in the
 * codebase - a Zord dropped onto a Ranger's sheet was immediately pilotable, with no arrival delay
 * at all - which also left Enhanced Summoner (below) with nothing to reduce.
 *
 * Same "roll a timer, store the ready round, GM/table enforces it" advisory shape
 * helpers/combiner-timer.mjs#rollCombineTimer already establishes for the sibling "Zords won't
 * combine without a worthy foe" rule - not a hard block (this project has no action-economy gate
 * that could refuse "use the Zord" outright), just a rolled, announced, and sheet-visible number.
 */
const SUMMON_READY_ROUND_FLAG = 'zordSummonReadyRound';

// Enhanced Summoner (PR CRB, Grid Tech I, p.38): "You and your Power Ranger team reduce the number
// of rounds it takes to summon your Zords by -1 (minimum of 1)." A flat reduction to the ROLLED
// TOTAL (unlike Fast Modulation's own die-step-down for the Combiner timer) - RAW gives no die to
// downgrade here, just "-1 round." "You and your team" is read the same way every other
// team-wide grant in this codebase reads it (We All Go Home, We Are the Coinless): held by the
// summoning Ranger themselves, OR any nearby ally (same token disposition) - it doesn't stack
// with multiple holders, since RAW states a flat -1, not -1 per holder.
const ENHANCED_SUMMONER_ID = "Compendium.essence20.pr_crb.Item.pmA5wQDbc5oQk5Ak";

/**
 * Whether the summoning Ranger (or a nearby ally) holds Enhanced Summoner - see
 * ENHANCED_SUMMONER_ID's own comment above. Same nearby-ally disposition scan
 * helpers/combat.mjs#findWeAllGoHomeHolder already establishes for a different team-wide grant.
 * @param {Actor} pilotActor
 * @returns {Boolean}
 */
function hasEnhancedSummoner(pilotActor) {
  if (actorHasPerk(pilotActor, ENHANCED_SUMMONER_ID)) {
    return true;
  }

  const pilotToken = pilotActor?.getActiveTokens?.()?.[0];
  if (!pilotToken || !canvas?.tokens) {
    return false;
  }

  return canvas.tokens.placeables.some(token =>
    token !== pilotToken && token.actor && token.document.disposition === pilotToken.document.disposition
    && actorHasPerk(token.actor, ENHANCED_SUMMONER_ID));
}

/**
 * Rolls the Zord's own arrival timer (3d2, minus 1 with Enhanced Summoner, minimum 1) and stores it
 * as an absolute round number on the Zord actor. With no combat running there's no round to count
 * from, so the timer is cleared instead - the same "not in a combat scene" fallback
 * rollCombineTimer already uses.
 * @param {Actor} pilotActor   The Ranger summoning the Zord (checked for Enhanced Summoner).
 * @param {Actor} zordActor   The Zord being summoned.
 * @returns {Promise<Number|null>}   The round the Zord arrives, or null if not in combat.
 */
export async function rollSummonTimer(pilotActor, zordActor) {
  if (!zordActor || zordActor.type != 'zord') {
    return null;
  }

  if (!game.combat?.started) {
    await zordActor.unsetFlag('essence20', SUMMON_READY_ROUND_FLAG);
    return null;
  }

  const roll = await new Roll('3d2').evaluate();
  const reduction = hasEnhancedSummoner(pilotActor) ? 1 : 0;
  const rounds = Math.max(1, roll.total - reduction);
  const readyRound = game.combat.round + rounds;
  await zordActor.setFlag('essence20', SUMMON_READY_ROUND_FLAG, readyRound);

  ChatMessage.create({
    content: game.i18n.format('E20.ZordSummonTimerRolled', {
      name: zordActor.name,
      rounds,
      round: readyRound,
    }),
    speaker: ChatMessage.getSpeaker({ actor: pilotActor ?? zordActor }),
  });

  return readyRound;
}

/**
 * The round this Zord's summon becomes available, or null if no timer is running.
 * @param {Actor} zordActor
 * @returns {Number|null}
 */
export function getSummonReadyRound(zordActor) {
  return zordActor?.getFlag?.('essence20', SUMMON_READY_ROUND_FLAG) ?? null;
}

/**
 * Whether the Zord's summon timer has elapsed. True when no timer is running at all (no combat, or
 * never rolled), matching rollCombineTimer's own sibling isCombineReady advisory default.
 * @param {Actor} zordActor
 * @returns {Boolean}
 */
export function isSummonReady(zordActor) {
  const readyRound = getSummonReadyRound(zordActor);
  if (readyRound === null) {
    return true;
  }

  return (game.combat?.round ?? 0) >= readyRound;
}

/**
 * Sheet-action entry point for the "Summon" control added to a zordActors card in
 * system-actors.hbs (the piloting actor's own Zords tab, not a Megaform's read-only participant
 * list - see that template's own comment). Resolves the clicked card's own attached-actor uuid the
 * same way onSystemActorOpen/onSystemActorsDelete already do.
 * @param {HTMLElement} target   The clicked control, carrying the Zord's uuid in
 *   data-system-Actors-uuid.
 * @param {Actor} pilotActor   The sheet's own document - the Ranger doing the summoning.
 */
export async function onSummonZord(target, pilotActor) {
  const zordUuid = target?.dataset?.systemActorsUuid;
  if (!zordUuid) {
    return;
  }

  const zordActor = await fromUuid(zordUuid);
  await rollSummonTimer(pilotActor, zordActor);
}

export { ENHANCED_SUMMONER_ID };
