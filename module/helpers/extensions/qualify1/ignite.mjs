import { registerChatButton, registerHitRider, registerTurnEnd } from "../../extensions.mjs";
import { escape, has, itemFrom, Q1, T } from "./common.mjs";

/**
 * Ignite (Cobra Codex, Firestarter Ranger, 10th level, p.58): "when you deal Fire damage to a
 * target, the target catches fire. Every round, at the end of the target's turn, the fire attacks
 * them. Roll a Science Skill Test against the target's Evasion. On a success, the fire deals 1 Fire
 * Damage. This happens every turn until the fire misses its attack, or until the target is subject
 * to something that would extinguish a flame, such as being fully immersed in water. On their turn,
 * the target can fight the fire. They can give the fire ↓1 on its attack as a Free action or put
 * out the fire by dropping prone and rolling in place as a Move action."
 *
 * Fireball (same Focus, 20th level, p.59): "When you set a target on fire, the fire rolls with Edge."
 *
 * A fire-damage hit from the Perk's holder marks the target (flags.essence20.q1Burning) and posts a
 * card with the target's two ways to fight it. At the end of the burning creature's turn (GM client)
 * the igniter's Science is rolled against its Evasion: a hit burns for 1, a miss puts it out.
 */

const FLAG = 'q1Burning';
const FIREBALL = 'Compendium.essence20.cobra_codex.Item.20lv1ecNs4ORVwWu';

export function burningOf(actor) {
  const burning = actor?.flags?.essence20?.[FLAG];
  if (!burning) {
    return null;
  }

  // Out of the fight it was lit in, it's the GM's to narrate.
  if (burning.combatId && game.combat?.id != burning.combatId) {
    return null;
  }

  return burning;
}

async function writeBurning(actor, value) {
  const { needsGmRelay, relayToGm } = await import("../../gm-relay.mjs");
  if (needsGmRelay(actor)) {
    return value ? relayToGm(actor, 'setFlag', ['essence20', FLAG, value]) : relayToGm(actor, 'unsetFlag', ['essence20', FLAG]);
  }

  return value ? actor.setFlag('essence20', FLAG, value) : actor.unsetFlag('essence20', FLAG);
}

/** Hit rider: a Fire-damage hit from an Ignite holder sets the target alight. */
export async function igniteHitRider(actor, target, result, rider) {
  if (!target || rider?.damageType != 'fire' || result?.damageValue == null || !has(actor, Q1.ignite)) {
    return false;
  }

  if (burningOf(target)) {
    return false;
  }

  await writeBurning(target, { by: actor.uuid, byName: actor.name, combatId: game.combat?.id ?? null, fought: 0 });
  const perk = itemFrom(actor, Q1.ignite)?.name ?? 'Ignite';
  result.riderNote = [result.riderNote, T('E20.Q1IgniteCaught', { name: target.name })].filter(Boolean).join(' ');
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<p><strong>${escape(perk)}</strong> - ${escape(T('E20.Q1IgniteCaught', { name: target.name }))}</p>
      <button type="button" class="e20-chat-action-button" data-e20-ext="q1FightFire" data-target-uuid="${target.uuid}">${escape(T('E20.Q1IgniteFight'))}</button>
      <button type="button" class="e20-chat-action-button" data-e20-ext="q1DropAndRoll" data-target-uuid="${target.uuid}">${escape(T('E20.Q1IgniteDrop'))}</button>`,
  });
  return true;
}

/** End of the burning creature's turn: the fire attacks. */
export async function igniteTurnEnd(actor) {
  const burning = burningOf(actor);
  if (!burning) {
    return null;
  }

  const igniter = await fromUuid(burning.by);
  const evasion = actor.system?.defenses?.evasion?.total ?? 10;
  let success = false;
  if (igniter?._dice) {
    const result = await igniter._dice.rollSkill({
      skill: 'science', essence: 'smarts', dif: String(evasion),
      shiftUp: 0, shiftDown: burning.fought ?? 0, edge: has(igniter, FIREBALL),
    }, igniter);
    if (result?.cancelled) {
      return null;
    }

    success = !!result?.success;
  }

  if (success) {
    const { applyDamage } = await import("../../combat.mjs");
    await applyDamage(actor, 1, 'fire');
    await writeBurning(actor, { ...burning, fought: 0 });
    return 'burned';
  }

  await writeBurning(actor, null);
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<p>${escape(T('E20.Q1IgniteOut', { name: actor.name }))}</p>` });
  return 'out';
}

async function targetFrom(button) {
  const doc = await fromUuid(button.dataset.targetUuid);
  const actor = doc?.actor ?? doc;
  if (!actor || !(actor.isOwner || game.user?.isGM)) {
    ui.notifications.warn(T('E20.Q1NotYours'));
    return null;
  }

  if (!burningOf(actor)) {
    ui.notifications.info(T('E20.Q1IgniteNotBurning', { name: actor.name }));
    return null;
  }

  return actor;
}

async function pay(actor, cost, source) {
  if (!game.combat) {
    return true;
  }

  const { spend } = await import("../../action-economy.mjs");
  return !(await spend(actor, cost, { source }))?.blocked;
}

/** "give the fire ↓1 on its attack as a Free action" */
export async function onFightFire(message, button) {
  const actor = await targetFrom(button);
  if (!actor || !(await pay(actor, 'free', T('E20.Q1IgniteFight')))) {
    return;
  }

  const burning = burningOf(actor);
  await writeBurning(actor, { ...burning, fought: (burning.fought ?? 0) + 1 });
  ui.notifications.info(T('E20.Q1IgniteFought', { name: actor.name }));
}

/** "put out the fire by dropping prone and rolling in place as a Move action" */
export async function onDropAndRoll(message, button) {
  const actor = await targetFrom(button);
  if (!actor || !(await pay(actor, 'move', T('E20.Q1IgniteDrop')))) {
    return;
  }

  await actor.toggleStatusEffect?.('prone', { active: true });
  await writeBurning(actor, null);
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<p>${escape(T('E20.Q1IgniteOut', { name: actor.name }))}</p>` });
}

export function registerIgnite() {
  registerHitRider(igniteHitRider);
  registerTurnEnd(igniteTurnEnd);
  registerChatButton('q1FightFire', onFightFire);
  registerChatButton('q1DropAndRoll', onDropAndRoll);
}
