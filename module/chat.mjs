import { _isCritIsFumble, applyDamage } from "./helpers/combat.mjs";
import { computeSystemColorVars } from "./helpers/actor.mjs";

export { _isCritIsFumble };

// Wires up the check-card.hbs "Apply Damage"/critical-effect buttons. Called on the
// renderChatMessageHTML hook. Each button carries its own data-key (e.g. "<uuid>:base" or
// "<uuid>:crit:<effectId>") so the base effect and any critical-hit bonus effect (p.205 - "the
// attacker chooses to stack on an additional attack effect") can be applied independently rather
// than one click disabling every button on the card. damageApplied (a plain boolean) is the
// pre-Critical-Hit-feature flag format - still honored so chat messages created before this
// change don't let their (single) button be re-clicked after a reload.
export const attachCheckCardListeners = function (message, html) {
  const buttons = html.querySelectorAll('[data-action="apply-damage"]');
  if (!buttons.length) {
    return;
  }

  const legacyApplied = message.getFlag('essence20', 'damageApplied');
  const appliedKeys = message.getFlag('essence20', 'damageAppliedKeys') || [];
  for (const button of buttons) {
    if (legacyApplied || appliedKeys.includes(button.dataset.key)) {
      button.disabled = true;
      continue;
    }

    button.addEventListener('click', () => onApplyDamage(message, button));
  }
};

// Cross-actor Health changes stay GM-gated, since there's no existing precedent anywhere in this
// codebase for a player mutating another actor's document.
async function onApplyDamage(message, button) {
  if (!game.user.isGM) {
    ui.notifications.warn(game.i18n.localize('E20.CheckApplyDamageGmOnly'));
    return;
  }

  const target = await fromUuid(button.dataset.targetUuid);
  if (!target) {
    return;
  }

  const amount = await applyDamage(target, parseInt(button.dataset.damage), button.dataset.damageType);
  button.disabled = true;
  const appliedKeys = message.getFlag('essence20', 'damageAppliedKeys') || [];
  await message.setFlag('essence20', 'damageAppliedKeys', [...appliedKeys, button.dataset.key]);
  ChatMessage.create({
    content: `${target.name}: ${amount} ${game.i18n.localize('E20.CheckDamageApplied')}`,
    speaker: ChatMessage.getSpeaker({ actor: target }),
  });
}

// Changes the color of the roll total for crits and fumbles
// Called on the renderChatMessageHTML hook
export const highlightCriticalSuccessFailure = function (message, html) {
  if (!message.isRoll || !message.isContentVisible || !message.rolls.length) {
    return;
  }

  const [isCrit, isFumble] = _isCritIsFumble(message.rolls[0].dice, message.flags.essence20?.canCritD2);

  // Set roll total class to alter its color
  const diceTotalElement = html.getElementsByClassName('dice-total')[0];

  if (isCrit && isFumble) {
    diceTotalElement.classList.add('crumble');
  } else if (isCrit) {
    diceTotalElement.classList.add('critical');
  } else if (isFumble) {
    diceTotalElement.classList.add('fumble');
  }
};

// Hides the Targeting Difficulty ("DIF n") shown next to each target on a resolved-check chat
// card (check-card.hbs) from non-GM viewers, the same GM-only treatment the @Check[dif=...]
// enricher already gives a flat Difficulty value (helpers/enrichers.mjs). Unlike that enricher,
// this card's HTML is baked once into the ChatMessage's content and shared verbatim to every
// client, so there's no re-enrichment point to hook into - concealment has to happen by pruning
// the DOM on render instead. This is display-only: a player could still recover the value from
// the message's stored content via the console, same caveat as the enricher.
// Called on the renderChatMessageHTML hook.
export const hideDifficultyForNonGm = function (message, html) {
  if (game.user.isGM) {
    return;
  }

  for (const el of html.querySelectorAll('.e20-check-difficulty')) {
    el.remove();
  }
};

// Outlines a chat card in the speaking Actor's own system.color, the same
// --e20-system-color mechanism the actor sheet's e20-border-accent trim already uses
// (helpers/actor.mjs) - unset when the actor has no color chosen (or there's no actor at all,
// e.g. a GM-only message), leaving the card on its default themed border.
// Called on the renderChatMessageHTML hook.
export const applyChatMessageSystemColor = function (message, html) {
  const actor = ChatMessage.getSpeakerActor(message.speaker);
  const color = actor?.system?.color;
  if (!color) {
    return;
  }

  const { normalizedColor, alphaColor } = computeSystemColorVars(color);
  html.style.setProperty('--e20-system-color', normalizedColor);
  html.style.setProperty('--e20-system-color-50', alphaColor);
};
