import { _isCritIsFumble, applyDamage } from "./helpers/combat.mjs";
import { computeSystemColorVars } from "./helpers/actor.mjs";
import {
  actorHasPerk, hasUsedThisEncounter, hasUsedThisRound, hasUsedThisTurn,
  markUsedThisEncounter, markUsedThisRound, markUsedThisTurn,
} from "./helpers/perks.mjs";
import { isRecklessAbandonActive } from "./helpers/reckless-abandon.mjs";

export { _isCritIsFumble };

const JUST_A_GRAZE_ID = "Compendium.essence20.gi_joe_crb.Item.YXL5dCiLZvzDgZzJ";
const JUST_A_GRAZE_ROUND_FLAG = 'justAGrazeLastRound';
const FORTITUDE_ID = "Compendium.essence20.gi_joe_crb.Item.19odrVUOsp4dCiOV";
const EXTRA_PLATES_ID = "Compendium.essence20.gi_joe_crb.Item.xr0PvYXRNAg9cU42";
const EXTRA_PLATES_TURN_FLAG = 'extraPlatesLastTurn';
const DIDNT_EVEN_FEEL_IT_ID = "Compendium.essence20.gi_joe_crb.Item.y7hyuXOuARcKgahl";
const DIDNT_EVEN_FEEL_IT_ENCOUNTER_FLAG = 'didntEvenFeelItThisEncounter';
const SUDDEN_DEATH_ID = "Compendium.essence20.gi_joe_crb.Item.bfBFQH3sxny3BfEK";
const SUDDEN_DEATH_ENCOUNTER_FLAG = 'suddenDeathThisEncounter';

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
// Exported (only) for unit testing - attachCheckCardListeners above is this function's real
// entry point, wired to the chat card's own DOM button clicks.
export async function onApplyDamage(message, button) {
  if (!game.user.isGM) {
    ui.notifications.warn(game.i18n.localize('E20.CheckApplyDamageGmOnly'));
    return;
  }

  const target = await fromUuid(button.dataset.targetUuid);
  if (!target) {
    return;
  }

  let damage = parseInt(button.dataset.damage);

  // Sudden Death (Blitzer Focus, 20th level, p.98): "once per combat, when you successfully hit
  // with a Might melee attack against a target whose Threat Level is equal to or less than your
  // level, you can choose to defeat them instead of dealing damage." Unlike every other check
  // below, this is the ATTACKER's own Perk and choice, not the target's - resolved off the chat
  // message's own speaker (the same ChatMessage.getSpeaker({actor}) data dice.mjs already stamps
  // onto every check card it creates), not the target being damaged. isMightMelee is a plain fact
  // about the weapon/attack (dice.mjs's own results-building step) - the Perk, once-per-combat
  // gate, and Threat Level compare all happen here instead, once the actual target is known.
  const attacker = game.actors.get(message.speaker?.actor);
  const targetThreatLevel = target.system.threatLevel ?? Infinity; // PCs have no Threat Level
  const attackerLevel = attacker?.system.level ?? -Infinity;
  if (
    button.dataset.isMightMelee == 'true' && attacker && actorHasPerk(attacker, SUDDEN_DEATH_ID)
    && !hasUsedThisEncounter(attacker, SUDDEN_DEATH_ENCOUNTER_FLAG) && targetThreatLevel <= attackerLevel
  ) {
    const confirmation = await foundry.applications.api.DialogV2.wait({
      window: { title: game.i18n.localize('E20.SuddenDeathConfirmTitle') },
      classes: ["window-app"],
      content: `<p>${game.i18n.format('E20.SuddenDeathConfirmContent', { name: target.name })}</p>`,
      modal: true,
      buttons: [
        { label: game.i18n.localize('E20.DialogConfirmButton'), action: 'confirm' },
        { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
      ],
    });

    if (confirmation == 'confirm') {
      await target.update({ 'system.health.value': 0 });
      await markUsedThisEncounter(attacker, SUDDEN_DEATH_ENCOUNTER_FLAG);
      button.disabled = true;
      const appliedKeys = message.getFlag('essence20', 'damageAppliedKeys') || [];
      await message.setFlag('essence20', 'damageAppliedKeys', [...appliedKeys, button.dataset.key]);
      ChatMessage.create({
        content: `${target.name}: ${game.i18n.localize('E20.SuddenDeathApplied')}`,
        speaker: ChatMessage.getSpeaker({ actor: target }),
      });

      return;
    }
  }

  // Fortitude (Renegade base, 15th level): "you reduce the amount of damage you suffer from any
  // source by 1." Unconditional and passive (no once-per-round gate, no GM confirm needed) -
  // applied before Just a Graze's own reduce-to-1 choice below so Just a Graze always sees
  // whatever damage is left after this flat reduction.
  if (actorHasPerk(target, FORTITUDE_ID)) {
    damage = Math.max(0, damage - 1);
  }

  // Extra Plates (Renegade/Juggernaut Focus, 3rd level): "once per turn, reduce the damage from
  // an attack or effect by 1 while wearing heavy or superheavy armor." Same flat -1 shape as
  // Fortitude above, but gated on the target's own equipped armor and limited to once per turn
  // (hasUsedThisTurn/markUsedThisTurn - helpers/perks.mjs - not the once-per-round flags Just a
  // Graze uses below, since a round can span several combatants' own turns).
  if (actorHasPerk(target, EXTRA_PLATES_ID) && !hasUsedThisTurn(target, EXTRA_PLATES_TURN_FLAG)) {
    const wearingHeavyArmor = (target.items.documentsByType?.armor ?? []).some(
      a => a.system.equipped && ['heavy', 'ultraHeavy'].includes(a.system.classification),
    );
    if (wearingHeavyArmor) {
      damage = Math.max(0, damage - 1);
      await markUsedThisTurn(target, EXTRA_PLATES_TURN_FLAG);
    }
  }

  // Didn't Even Feel It (GI Joe CRB p.97, Renegade base, 18th level): "once per encounter while
  // acting with Reckless Abandon, you may reduce the damage you take from a single attack or
  // effect to zero damage." Same "auto-detect eligibility, human confirms" shape as Just a Graze
  // below, checked first since it's strictly stronger - a confirmed negation here drops damage to
  // 0, which makes Just a Graze's own "> 1" eligibility check below moot for this hit rather than
  // prompting twice.
  if (
    damage > 0 && isRecklessAbandonActive(target) && actorHasPerk(target, DIDNT_EVEN_FEEL_IT_ID)
    && !hasUsedThisEncounter(target, DIDNT_EVEN_FEEL_IT_ENCOUNTER_FLAG)
  ) {
    const confirmation = await foundry.applications.api.DialogV2.wait({
      window: { title: game.i18n.localize('E20.DidntEvenFeelItConfirmTitle') },
      classes: ["window-app"],
      content: `<p>${game.i18n.format('E20.DidntEvenFeelItConfirmContent', { name: target.name })}</p>`,
      modal: true,
      buttons: [
        { label: game.i18n.localize('E20.DialogConfirmButton'), action: 'confirm' },
        { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
      ],
    });

    if (confirmation == 'confirm') {
      damage = 0;
      await markUsedThisEncounter(target, DIDNT_EVEN_FEEL_IT_ENCOUNTER_FLAG);
    }
  }

  // Just a Graze (GI Joe CRB p.72, Commando 5th level): "Once per turn, you can reduce the
  // damage of an attack against you to 1." The defender's own choice, not something to apply
  // silently - the GM confirms it here, same "auto-detect eligibility, human confirms" approach
  // as the Sneak Attack Roll Options Dialog checkbox, just via a confirm dialog instead since
  // this is a GM chat-card click rather than a roll dialog.
  if (damage > 1 && actorHasPerk(target, JUST_A_GRAZE_ID) && !hasUsedThisRound(target, JUST_A_GRAZE_ROUND_FLAG)) {
    const confirmation = await foundry.applications.api.DialogV2.wait({
      window: { title: game.i18n.localize('E20.JustAGrazeConfirmTitle') },
      classes: ["window-app"],
      content: `<p>${game.i18n.format('E20.JustAGrazeConfirmContent', { name: target.name })}</p>`,
      modal: true,
      buttons: [
        { label: game.i18n.localize('E20.DialogConfirmButton'), action: 'confirm' },
        { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
      ],
    });

    if (confirmation == 'confirm') {
      damage = 1;
      await markUsedThisRound(target, JUST_A_GRAZE_ROUND_FLAG);
    }
  }

  const amount = await applyDamage(target, damage, button.dataset.damageType);
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
