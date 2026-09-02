import { E20 } from "./helpers/config.mjs";
import { _isCritIsFumble, applyDamage } from "./helpers/combat.mjs";
import { computeSystemColorVars } from "./helpers/actor.mjs";
import {
  applyReroll,
  canMeetRerollCondition,
  canMeetRerollScope,
  canUseReroll,
  consumeRerollUsage,
  getRerollConfigs,
  hasEligibleRerollTarget,
  hasRerollCost,
  payRerollCost,
  rerollModeLabel,
} from "./helpers/reroll.mjs";
import { isGmConnected } from "./helpers/story-points.mjs";

// {skill, essence, snag, isPowerWeaponAttack, rollFailed, canCritD2} stashed on the message by
// dice.mjs#rollSkill/combat.mjs#buildCheckChatData - see
// helpers/reroll.mjs#canMeetRerollScope/canMeetRerollCondition's own doc comments.
function getRerollContext(message) {
  return {
    skill: message.flags?.essence20?.skill,
    essence: message.flags?.essence20?.essence,
    snag: message.flags?.essence20?.snag,
    isPowerWeaponAttack: message.flags?.essence20?.isPowerWeaponAttack,
    rollFailed: message.flags?.essence20?.rollFailed,
    canCritD2: message.flags?.essence20?.canCritD2,
  };
}

export { _isCritIsFumble };

async function rerollMessage(message, config) {
  const actor = ChatMessage.getSpeakerActor(message.speaker);
  if (!actor || !message.rolls?.length) {
    return;
  }

  // Every gate is checked BEFORE anything is consumed, so cancelling the die-picker dialog (or
  // failing a precondition) never burns a limited-use reroll or spends its resource cost.
  const context = getRerollContext(message);
  const sourceKey = `${config.sourceType}:${config.source}`;
  if (!(await canUseReroll(actor, config, sourceKey))) {
    ui.notifications.warn(game.i18n.localize("E20.RerollMaxUsesReached"));
    return;
  }

  if (!canMeetRerollScope(config, context)) {
    ui.notifications.warn(game.i18n.localize("E20.RerollScopeNotMet"));
    return;
  }

  if (!canMeetRerollCondition(actor, config, context)) {
    const conditionName = game.i18n.localize(E20.rerollConditions[config.condition] ?? config.condition);
    ui.notifications.warn(game.i18n.format("E20.RerollConditionNotMet", { condition: conditionName }));
    return;
  }

  if (!hasRerollCost(actor, config)) {
    // A world-level Story Point cost (GI Joe CRB "In My Sights") can fail for a reason more
    // specific than "insufficient resource" - nobody able to actually spend it is connected at
    // all, distinct from there not being enough left. See helpers/story-points.mjs.
    const noGmForStoryPoints = config.cost?.worldStoryPoints > 0 && !isGmConnected();
    ui.notifications.warn(game.i18n.localize(noGmForStoryPoints ? "E20.RerollNoGmConnected" : "E20.RerollInsufficientResource"));
    return;
  }

  // Reconstructed from the original roll's own serialized data (not Roll#clone(), which
  // discards all dice results and starts a fresh, independently-random, unevaluated roll) so the
  // reroll starts as an exact copy of what was actually rolled, ready for applyReroll() to
  // selectively mutate only the targeted dice in place.
  const rerolled = Roll.fromData(message.rolls[0].toJSON());
  if (!(await applyReroll(rerolled, config))) {
    return;
  }

  await consumeRerollUsage(actor, config, sourceKey);
  await payRerollCost(actor, config);

  const mode = config.mode ?? "all";
  const label = `${actor.name}: ${game.i18n.localize("E20.RerollDice")} (${game.i18n.localize(rerollModeLabel(mode))})`;
  // Preserves the original roll's own canCritD2 (e.g. a Perk that auto-set crit-on-d2 on the
  // attack roll), which otherwise silently vanished on every reroll's own posted message - and
  // forces it on for a grant that adds it itself (GI Joe CRB "In My Sights").
  const canCritD2 = !!context.canCritD2 || !!config.grantsCanCritD2;
  rerolled.toMessage({
    speaker: message.speaker,
    flavor: label,
    rollMode: game.settings.get("core", "rollMode"),
    flags: { essence20: { canCritD2, rerollConfig: config } },
  });
}

export const addRerollButtons = function (message, html) {
  if (!message.isRoll || !message.isContentVisible || !message.rolls?.length || !message.speaker) {
    return;
  }

  const actor = ChatMessage.getSpeakerActor(message.speaker);
  // Scope (skill/Essence) mismatch and having nothing eligible to reroll (e.g. a "reroll 1s"
  // grant when nothing on this roll shows a 1) are both permanent, structural facts about this
  // specific chat message - unlike usage/cost/condition (checked at click-time in
  // rerollMessage, since those can be transient), showing a button that could never do anything
  // here would just be confusing, so both are filtered out at render time instead.
  const context = getRerollContext(message);
  const roll = message.rolls[0];
  const configs = getRerollConfigs(actor)
    .filter(config => canMeetRerollScope(config, context))
    .filter(config => hasEligibleRerollTarget(roll, config));
  if (!configs.length) {
    return;
  }

  const target = html.querySelector(".dice-roll") ?? html.querySelector(".message-content") ?? html;
  if (!target) {
    return;
  }

  for (const config of configs) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "e20-reroll-button";
    button.textContent = `${game.i18n.localize("E20.RerollDice")} (${game.i18n.localize(rerollModeLabel(config.mode))})`;
    button.title = game.i18n.localize("E20.RerollDiceTitle");
    button.addEventListener("click", () => rerollMessage(message, config));
    target.appendChild(button);
  }
};

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
