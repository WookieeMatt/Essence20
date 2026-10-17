import { getSceneEpoch } from "../../../mechanics/resources/scene-clock.mjs";
import { registerRef } from "../../formula.mjs";
import { rulesOfType } from "../../index.mjs";
import { registerTag } from "../../predicate.mjs";
import { registerEvent } from "../../types.mjs";
import { listOf } from "../shared/card-text-helpers.mjs";

/**
 * Round 15 (items2): recent-roll memory - Skill Test cards posted in chat, compared with each other.
 *
 * - Trigger event `skillTestPosted` - a chat card for a Skill Test arrived (flags.essence20.skill and a numeric roll
 *   total), on the active GM's client. It reaches the actor it speaks for and every other world actor holding such a
 *   Trigger; `target` is the roller (`target:self` - the holder posted it); `@var.skill`, `@var.total`. The card joins the
 *   memory only after every Trigger has run, so tags read the rolls before it.
 * - Tag `recent:sideHigher:<minutes>` (the holder posted the card) - another actor on the holder's side rolled the same
 *   Skill within that many real minutes, in this scene, and got a higher total.
 * - Tag `recent:selfLower:<minutes>` (someone on the holder's side posted it) - the holder rolled the same Skill within
 *   that many minutes, this scene, and got a lower total than this card.
 * - Tag `recent:hostile:<skill>` / ref `@recent.lowestHostile.<skill>` - a creature not on the actor's side posted that
 *   Skill in the last 30 minutes of chat (the latest 100 messages) / the lowest such total (0 with none) - "the lowest
 *   of the surprising side's Infiltration".
 * Sides: both tokens' dispositions (the active token, else one on the viewed scene), else both Player Characters.
 */
registerEvent('skillTestPosted');

const MESSAGE_WINDOW_MS = 30 * 60 * 1000;
const memory = [];

/** For tests. */
export function resetRecentRolls() {
  memory.length = 0;
}

export function recentRolls() {
  return memory;
}

function tokenDocOf(actor) {
  const active = actor?.getActiveTokens?.(false, true)?.[0];
  if (active) {
    return active;
  }

  const scene = globalThis.canvas?.scene ?? globalThis.game?.scenes?.viewed ?? null;
  return scene?.tokens?.find?.(token => token.actorId == actor?.id || token.actor == actor) ?? null;
}

/** Same side: both tokens share a disposition, or (no tokens) both are Player Characters. */
export function sameSide(a, b) {
  const ta = tokenDocOf(a);
  const tb = tokenDocOf(b);
  if (ta && tb && ta.disposition !== undefined && tb.disposition !== undefined) {
    return ta.disposition === tb.disposition;
  }

  return a?.type == 'playerCharacter' && b?.type == 'playerCharacter';
}

const live = (roll, minutes, now) => now - roll.time <= minutes * 60 * 1000 && roll.epoch == getSceneEpoch();

registerTag('recent', (rest, ctx) => {
  const [kind, arg] = String(rest ?? '').split(':');
  const holder = ctx?.self;
  if (kind == 'hostile') {
    return lowestHostile(holder, arg) !== null;
  }

  const skill = ctx?.vars?.skill;
  const total = Number(ctx?.vars?.total);
  const poster = ctx?.other;
  const minutes = Number(arg) || 5;
  const now = ctx?.vars?.now ?? Date.now();
  if (!holder || !poster || !skill || !Number.isFinite(total)) {
    return false;
  }

  const same = roll => roll.skill == skill && live(roll, minutes, now);
  if (kind == 'sideHigher') {
    return poster === holder && memory.some(roll => same(roll) && roll.actor !== holder && sameSide(holder, roll.actor) && roll.total > total);
  }

  if (kind == 'selfLower') {
    return poster !== holder && sameSide(poster, holder) && memory.some(roll => same(roll) && roll.actor === holder && total > roll.total);
  }

  return null;
}, { family: 'situation', param: 'text', phrase: (arg, w) => {
  const [kind, value] = arg.split(':');
  return {
    sideHigher: [`an ally rolled higher on the same Skill in the last ${value || 5} minutes`, `no ally rolled higher on the same Skill in the last ${value || 5} minutes`],
    selfLower: [`you rolled lower on the same Skill in the last ${value || 5} minutes`, `you didn't roll lower on the same Skill in the last ${value || 5} minutes`],
    hostile: [`someone not on your side rolled ${w.skillName(value)} recently`, `nobody against you rolled ${w.skillName(value)} recently`],
  }[kind] ?? null;
} });

/** The lowest total an opposing creature posted for that Skill recently (latest 100 messages, 30 minutes), or null. */
export function lowestHostile(actor, skill, messages = null, now = Date.now()) {
  const list = messages ?? listOf(globalThis.game?.messages).slice(-100);
  let lowest = null;
  for (const message of list) {
    const total = message?.rolls?.[0]?.total;
    if (message?.flags?.essence20?.skill != skill || typeof total != 'number') {
      continue;
    }

    if (message.timestamp && now - message.timestamp > MESSAGE_WINDOW_MS) {
      continue;
    }

    const roller = message.speakerActor ?? (message.speaker?.actor ? globalThis.game?.actors?.get?.(message.speaker.actor) : null);
    if (!roller || roller == actor || sameSide(actor, roller)) {
      continue;
    }

    lowest = lowest === null ? total : Math.min(lowest, total);
  }

  return lowest;
}

registerRef('recent', (key, scope) => {
  const [kind, skill] = String(key ?? '').split('.');
  return kind == 'lowestHostile' ? lowestHostile(scope.actor, skill) ?? 0 : 0;
});

/** A posted Skill Test card: its skillTestPosted Triggers, then it joins the memory. */
export async function onSkillTestPosted(message, now = Date.now()) {
  const skill = message?.flags?.essence20?.skill;
  const total = message?.rolls?.[0]?.total;
  const actor = message?.speakerActor ?? (message?.speaker?.actor ? globalThis.game?.actors?.get?.(message.speaker.actor) : null);
  if (!skill || typeof total != 'number' || !actor) {
    return;
  }

  const epoch = getSceneEpoch();
  for (let i = memory.length - 1; i >= 0; i--) {
    if (now - memory[i].time > MESSAGE_WINDOW_MS || memory[i].epoch != epoch) {
      memory.splice(i, 1);
    }
  }

  const holds = other => rulesOfType(other, 'Trigger').some(({ rule }) => rule.event == 'skillTestPosted');
  const heard = [actor, ...listOf(globalThis.game?.actors).filter(other => other && other !== actor)].filter(holds);
  if (heard.length) {
    const { fireTriggers } = await import("../../triggers.mjs");
    for (const listener of heard) {
      await fireTriggers(listener, 'skillTestPosted', { targets: [actor], vars: { skill, total, now } });
    }
  }

  memory.push({ actor, skill, total, time: now, epoch });
}

globalThis.Hooks?.on?.('createChatMessage', message => {
  if (!globalThis.game?.user?.isActiveGM) {
    return;
  }

  onSkillTestPosted(message).catch(error => console.error('Essence20 | skillTestPosted Triggers failed', error));
});
