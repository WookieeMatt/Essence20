import { findById, FLAG, has, S2, sameSide } from "../shared/situation-checks.mjs";
import { T } from "../shared/item-lang.mjs";

/**
 * Initiative-time situational rules. dice.mjs#prepareInitiativeRoll calls every INITIATIVE_EXTENSIONS
 * entry once the Roll Options Dialog has closed and before the formula is built
 * (SCRATCH/integration/situational2-patch.cjs), with the dialog's own options to shift.
 *
 * Surprise (GI Joe CRB, Combat, p.199): "The Game Master determines if any combatants would be caught
 * off guard. These creatures are Surprised." - applied before Initiative is rolled, so the rules
 * here read the actor's own `surprised` status.
 */

const MESSAGE_WINDOW_MS = 30 * 60 * 1000;

async function setSurprised(actor, active) {
  if (!!actor.statuses?.has?.('surprised') == active) {
    return;
  }

  const { needsGmRelay, relayToGm } = await import("../../mechanics/world/gm-relay.mjs");
  if (needsGmRelay(actor)) {
    await relayToGm(actor, 'toggleStatusEffect', ['surprised', { active }]);
  } else {
    await actor.toggleStatusEffect('surprised', { active });
  }
}

function say(actor, key, data = {}) {
  return ChatMessage.create({ speaker: ChatMessage.getSpeaker?.({ actor }), content: T(key, { name: actor.name, ...data }) });
}

/**
 * Surprise in stealth (GI Joe CRB p.199): "members of the surprised squad who beat the lowest of the
 * surprising squad characters' Infiltration Skill Test can act in the surprise round." The lowest
 * Infiltration total an opposing creature posted recently, or null when there's none to read.
 * @param {Actor} actor
 * @param {Array<ChatMessage>} [messages]
 * @returns {?Number}
 */
export function lowestHostileInfiltration(actor, messages = null, now = Date.now()) {
  const list = messages ?? (game.messages?.contents ?? []).slice(-100);
  let lowest = null;
  for (const message of list) {
    const total = message?.rolls?.[0]?.total;
    if (message?.flags?.essence20?.skill != 'infiltration' || typeof total != 'number') {
      continue;
    }

    if (message.timestamp && now - message.timestamp > MESSAGE_WINDOW_MS) {
      continue;
    }

    const roller = message.speakerActor ?? (message.speaker?.actor ? game.actors?.get?.(message.speaker.actor) : null);
    if (!roller || roller == actor || sameSide(actor, roller)) {
      continue;
    }

    lowest = lowest === null ? total : Math.min(lowest, total);
  }

  return lowest;
}

/**
 * Take in a Scene / Misplaced Confidence, once the Alertness result is known.
 * @param {Actor} actor
 * @param {Boolean} noticed
 */
export async function resolveTakeInAScene(actor, noticed) {
  if (noticed) {
    await setSurprised(actor, false);
    await say(actor, 'S2TakeInSceneNoticed');
    return;
  }

  // Misplaced Confidence (MLP CRB, Hang-Up, p.64): "When you Take in a Scene, if your Alertness Skill
  // Test fails, you are Surprised for two rounds instead of one." Held on through round 2 by
  // misplacedConfidenceRound below.
  if (has(actor, S2.misplacedConfidence, 'hangUp') && game.combat) {
    const start = Math.max(1, game.combat.round ?? 1);
    await actor.setFlag('essence20', FLAG.misplaced, { combatId: game.combat.id, untilRound: start + 1 });
    await say(actor, 'S2MisplacedConfidence', { hangUp: findById(actor, S2.misplacedConfidence, 'hangUp')?.name ?? 'Misplaced Confidence' });
    return;
  }

  await say(actor, 'S2TakeInSceneMissed');
}

/**
 * Take in a Scene (MLP CRB, Influence Perk, p.64): "When you roll for Initiative, also roll an
 * Alertness Skill Test to notice any creatures trying to Surprise you. If you succeed, you are not
 * Surprised." The Difficulty is the lowest opposing Infiltration roll when there is one on record;
 * otherwise the GM rules on the result from a card.
 * @param {Actor} actor
 */
export async function takeInAScene(actor) {
  const dif = lowestHostileInfiltration(actor);
  if (dif !== null) {
    const { rollTest } = await import("../../mechanics/resources/grants.mjs");
    const { success } = await rollTest(actor, 'alertness', dif + 1);
    await resolveTakeInAScene(actor, success);
    return;
  }

  await actor._dice?.rollSkill({ skill: 'alertness', essence: 'smarts', shiftUp: 0, shiftDown: 0 }, actor);
  const button = (noticed, key) => `<button type="button" class="e20-chat-action-button" data-e20-ext="s2TakeInScene" `
    + `data-actor-uuid="${actor.uuid}" data-noticed="${noticed ? 1 : 0}">${T(key)}</button>`;
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker?.({ actor }),
    content: `<p>${T('S2TakeInSceneAsk', { name: actor.name })}</p>${button(true, 'S2TakeInSceneYes')}${button(false, 'S2TakeInSceneNo')}`,
  });
}

/** The GM's ruling on a Take in a Scene card. */
export async function takeInASceneButton(message, button) {
  if (!game.user?.isGM) {
    ui.notifications?.warn(T('S2GmOnly'));
    return;
  }

  const actor = await fromUuid(button.dataset.actorUuid);
  if (!actor) {
    return;
  }

  for (const sibling of button.parentElement?.querySelectorAll?.('[data-e20-ext="s2TakeInScene"]') ?? []) {
    sibling.disabled = true;
  }

  await resolveTakeInAScene(actor, button.dataset.noticed == '1');
}

/** Misplaced Confidence: keep the Surprise through its second round, then lift it. (GM, round start.) */
export async function misplacedConfidenceRound(combat) {
  for (const combatant of combat?.combatants ?? []) {
    const actor = combatant.actor;
    const stamp = actor?.flags?.essence20?.[FLAG.misplaced];
    if (!stamp || stamp.combatId != combat.id) {
      continue;
    }

    if (combat.round <= stamp.untilRound) {
      await setSurprised(actor, true);
    } else {
      await setSurprised(actor, false);
      await actor.unsetFlag('essence20', FLAG.misplaced);
    }
  }
}

/**
 * Every Initiative-time rule (none of them shifts the roll any more).
 * @param {Actor} actor
 * @param {Object} _options   The Roll Options Dialog result (shiftUp, shiftDown, edge, snag...) - unused now.
 */
export async function situationalInitiative(actor, _options) {
  // Amphibious Assault's and Tracking Outfit's Initiative ↑1 are item rules (rules/conv5-slC5.test.js), and so is
  // Bookworm's Initiative ↓1 (rules/conv7-slC7.test.js).

  // Shark's Fin's Initiative half is an initiativeRolling Trigger on its item (rules/conv10-slD10.test.js).

  if (has(actor, S2.takeInAScene, 'perk') && actor.statuses?.has?.('surprised')) {
    await takeInAScene(actor);
  }
}
