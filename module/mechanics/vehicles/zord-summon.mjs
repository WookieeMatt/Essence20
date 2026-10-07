import { ruleSummonTimeBonus } from "../../rules/plugins/zords/summon-time-bonus.mjs";

/**
 * Call to Action (PR CRB, Zord Feature, p.136-137, auto-added to every Zord actor - see
 * documents/actor.mjs#_preCreate): the Zord reaches the edge of the fight in 3d2 rounds, ready for
 * its Ranger to pilot. This existed nowhere in the
 * codebase - a Zord dropped onto a Ranger's sheet was immediately pilotable, with no arrival delay
 * at all - which also left Enhanced Summoner (a SummonTimeBonus rule) with nothing to reduce.
 *
 * Same "roll a timer, store the ready round, GM/table enforces it" advisory shape
 * mechanics/vehicles/combiner-timer.mjs#rollCombineTimer already establishes for the sibling "Zords won't
 * combine without a worthy foe" rule - not a hard block (this project has no action-economy gate
 * that could refuse "use the Zord" outright), just a rolled, announced, and sheet-visible number.
 */
const SUMMON_READY_ROUND_FLAG = 'zordSummonReadyRound';

// Enhanced Summoner (PR CRB, Grid Tech I, p.38) - "you and your team": a SummonTimeBonus {amount: 1, sceneAllies: true}
// rule (rules/plugins/zords/summon-time-bonus.mjs): the summoner's own, or any same-Disposition token's on the scene;
// it doesn't stack.

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

  // A faster arrival the summoner picks instead of the roll - SummonOption rules (Manifested Zord, Q-Rex Portal,
  // Assisted Summoning): rules/plugins/zords/summon-option.mjs.
  const { pickSummonOption } = await import("../../rules/plugins/zords/summon-option.mjs");
  const fast = await pickSummonOption(pilotActor, zordActor);
  if (fast === false) {
    return null;
  }

  let rounds = fast;
  if (rounds === null) {
    const roll = await new Roll('3d2').evaluate();
    const reduction = ruleSummonTimeBonus(pilotActor);
    // SummonTime rules - the summoner's (Unique Weapon (Small Melee) halves it), then the Zord's (Genetic Resonance) -
    // rules/plugins/zords/zord-timing-hooks.mjs.
    const { ruleSummonRounds } = await import("../../rules/plugins/zords/zord-timing-hooks.mjs");
    rounds = ruleSummonRounds(pilotActor, zordActor, Math.max(1, roll.total - reduction));
  }

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
  if (zordActor?.type == 'zord') {
    // Recalled for repairs in this scene: it stays in its lair until the scene is over (PR CRB p.136).
    const { recalledThisScene, returnFromRepairs } = await import("./zord-recall.mjs");
    if (recalledThisScene(zordActor)) {
      ui.notifications.warn(game.i18n.format('E20.ZordStillRepairing', { name: zordActor.name }));
      return;
    }

    // The call itself is a Standard action (PR CRB p.135) - mechanics/actions/action-economy.mjs.
    const { spend } = await import("../actions/action-economy.mjs");
    const paid = await spend(pilotActor, 'standard', { source: zordActor.name });
    if (paid?.blocked) {
      return;
    }

    // Back from an earlier scene's repairs: full Health, no lingering Conditions.
    await returnFromRepairs(zordActor);
  }

  await rollSummonTimer(pilotActor, zordActor);
}
