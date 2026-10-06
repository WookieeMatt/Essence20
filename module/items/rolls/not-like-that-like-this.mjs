/**
 * Not Like That, Like This! (Enigma of Combination, 6th level, p.30): "when a teammate within 60
 * feet rolls a Skill Test, you can ask them to reroll any or all the dice involved, though they must
 * accept the second result. If you do this, you must attempt a Skill Test using the same Skill that
 * was re-rolled on your following turn, if possible. If it isn't possible, you lose your Move action
 * for that turn."
 *
 * We Are One!'s team reroll is a picked-scope Reroll rule on the Perk (rules/conv12-slI12.test.js). Roller Drum's
 * Combined Mode Health and Scramble Modulator's Combiner-form Sonic are their items' own rules (MegaformHealth, a hit
 * Trigger - module/rules/ext/a/).
 */
import {
  registerChatButton, registerChatDecorator, registerPostRoll, registerTurnEnd, registerTurnStart,
} from "../../mechanics/item-hooks.mjs";
import { T } from "../shared/item-lang.mjs";
import { TF2 } from "../shared/tf-technorganic-enigma-item-ids.mjs";
import { feetBetween } from "../shared/sides.mjs";
import { has, nameOf } from "../shared/item-lookups.mjs";
import { say } from "../shared/chat-lines.mjs";
import { worldActors } from "../../mechanics/companions/companion-link.mjs";
import { buttonCard, payAction, resolveSync } from "../shared/button-cards-and-action-pay.mjs";

const OWED_FLAG = 'tf2NotLikeThatOwed';

/** The actors this user plays that could call for the reroll on this roller's test. */
export function notLikeThatHolders(roller) {
  // A player's character offers it to that player; the GM only sees it for characters no player has.
  const isGm = !!globalThis.game?.user?.isGM;
  return worldActors().filter(actor => actor?.uuid != roller?.uuid && actor.isOwner && (!isGm || !actor.hasPlayerOwner)
    && has(actor, TF2.notLikeThat) && (feetBetween(actor, roller) ?? 0) <= 60);
}

export function notLikeThatDecorator(message, element) {
  const flags = message?.flags?.essence20;
  if (!flags?.skill || flags.tf2NotLikeThat || !message.rolls?.length || element?.querySelector?.('[data-e20-ext="tf2NotLikeThat"]')) {
    return;
  }

  const roller = ChatMessage.getSpeakerActor?.(message.speaker);
  if (!roller) {
    return;
  }

  const holders = notLikeThatHolders(roller);
  if (!holders.length) {
    return;
  }

  const wrap = document.createElement('div');
  wrap.className = 'e20-reroll-buttons';
  for (const holder of holders) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.e20Ext = 'tf2NotLikeThat';
    button.dataset.holderUuid = holder.uuid;
    button.textContent = T('Tf2NotLikeThatButton', { name: holder.name, perk: nameOf(holder, TF2.notLikeThat, 'Not Like That, Like This!') });
    wrap.append(button);
  }

  const diceRoll = element.querySelector?.('.dice-roll');
  if (diceRoll?.parentElement) {
    diceRoll.parentElement.insertBefore(wrap, diceRoll.nextSibling);
  } else {
    (element.querySelector?.('.message-content') ?? element).append(wrap);
  }
}

registerChatDecorator(notLikeThatDecorator);

registerChatButton('tf2NotLikeThat', async (message, button) => {
  const holder = resolveSync(button.dataset.holderUuid);
  const roller = ChatMessage.getSpeakerActor?.(message.speaker);
  if (!holder?.isOwner || !roller) {
    return;
  }

  const used = holder.flags?.essence20?.tf2NotLikeThatUsed ?? [];
  if (used.includes(message.id)) {
    ui.notifications.warn(T('Tf2AlreadyRerolled'));
    return;
  }

  const { applyReroll } = await import("../../mechanics/rolls/reroll.mjs");
  const roll = Roll.fromData(message.rolls[0].toJSON());
  if (!(await applyReroll(roll, { mode: 'all', target: 'allDice', values: [], recursive: false }))) {
    return;
  }

  const { buildCheckChatData } = await import("../../mechanics/combat/combat.mjs");
  const chatData = await buildCheckChatData(roll, {
    flavor: T('Tf2NotLikeThatFlavor', { name: roller.name, holder: holder.name }),
    results: [], speaker: message.speaker, canCritD2: !!message.flags?.essence20?.canCritD2,
  });
  foundry.utils.setProperty(chatData, 'flags.essence20.tf2NotLikeThat', true);
  await ChatMessage.create(chatData);

  const skill = message.flags.essence20.skill;
  const update = { 'flags.essence20.tf2NotLikeThatUsed': [...used.slice(-20), message.id] };
  if (game.combat) {
    update[`flags.essence20.${OWED_FLAG}`] = { skill, combatId: game.combat.id, reminded: false };
  }

  await holder.update(update);
});

registerChatButton('tf2NotLikeThatForfeit', async (message, button) => {
  const actor = resolveSync(button.dataset.actorUuid);
  if (!actor?.isOwner || !actor.flags?.essence20?.[OWED_FLAG]) {
    return;
  }

  await payAction(actor, 'move', T('Tf2NotLikeThatForfeitSource'));
  await actor.unsetFlag('essence20', OWED_FLAG);
  await say(actor, T('Tf2NotLikeThatForfeited', { name: actor.name }));
});

registerTurnStart(async (actor, combat) => {
  // Not Like That, Like This!: the reminder of what's owed this turn.
  const owed = actor?.flags?.essence20?.[OWED_FLAG];
  if (owed && owed.combatId == combat?.id && !owed.reminded) {
    await actor.update({ [`flags.essence20.${OWED_FLAG}.reminded`]: true });
    const skill = game.i18n.localize(CONFIG.E20?.skills?.[owed.skill] ?? owed.skill);
    await buttonCard(actor, T('Tf2NotLikeThatOwed', { name: actor.name, skill }), {
      key: 'tf2NotLikeThatForfeit', label: T('Tf2NotLikeThatForfeit'), data: { 'actor-uuid': actor.uuid },
    });
  } else if (owed && owed.combatId != combat?.id) {
    await actor.unsetFlag('essence20', OWED_FLAG);
  }
});

registerTurnEnd(async actor => {
  const owed = actor?.flags?.essence20?.[OWED_FLAG];
  if (owed?.reminded) {
    await actor.unsetFlag('essence20', OWED_FLAG);
  }
});

/* -------------------------------------------- */
/*  After a roll                                 */
/* -------------------------------------------- */

export async function tf2PostRoll(actor, results, checkContext, { rider = {} } = {}) {
  // Not Like That, Like This!: the owed Skill Test was made.
  const owed = actor?.flags?.essence20?.[OWED_FLAG];
  const skill = rider?.skill ?? checkContext?.skill;
  if (owed && skill && skill == owed.skill) {
    await actor.unsetFlag('essence20', OWED_FLAG);
  }

  // (Sustained Beam's once-per-round follow-up attack is a hit Trigger on the upgrade - rules/plugins/combat/rule-attacks.mjs.)
}

registerPostRoll(tf2PostRoll);
