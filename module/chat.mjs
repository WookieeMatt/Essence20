import { E20 } from "./helpers/config.mjs";
import { _isCritIsFumble, applyDamage, buildCheckChatData, grantToughEnoughResistance } from "./helpers/combat.mjs";
import { computeSystemColorVars } from "./helpers/actor.mjs";
import {
  actorHasHangUp, actorHasPerk, hasUsedThisEncounter, hasUsedThisRound, hasUsedThisTurn,
  markUsedThisEncounter, markUsedThisRound, markUsedThisTurn,
} from "./helpers/perks.mjs";
import { isRecklessAbandonActive } from "./helpers/reckless-abandon.mjs";
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

  storyPointRerollConfig,
} from "./helpers/reroll.mjs";
import {
  canSpendForActor, canWriteStoryPoints, defenseBoostAfterRoll, hasStoryPointsAvailable, requestStoryPointSpend,
  spendForActor,
} from "./helpers/story-points.mjs";
import { getGameLine } from "./settings.js";
import { activateIronHide, IRON_HIDE_ID } from "./helpers/iron-hide.mjs";
import { claimConsummatePerformer } from "./helpers/consummate-performer.mjs";
import { activateSpite, hasSpite } from "./helpers/spite.mjs";
import { activateExploitWeakness } from "./helpers/exploit-weakness.mjs";
import { activateSuffer, hasSuffer } from "./helpers/suffer.mjs";
import { CBRN_DEFENDER_HANG_UP_ID, markCbrnDefenderTriggered } from "./helpers/cbrn-defender.mjs";
import { bankHardCorpsDebt, HARD_CORPS_ENCOUNTER_FLAG } from "./helpers/hard-corps.mjs";
import { applyMegaformDamage } from "./helpers/megaform-damage.mjs";
import { handleVehicleZeroHealthTransition } from "./helpers/vehicle-defeat.mjs";

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
const HARD_CORPS_ID = "Compendium.essence20.sgt_slaughter_sourcebook.Item.IR8Rl7IXn0zKBBXV";

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
    const noGmForStoryPoints = config.cost?.worldStoryPoints > 0 && !canWriteStoryPoints();
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
  // Through the same check-card.hbs box every other roll message (skill test or attack) uses,
  // not a bare roll.toMessage() - a reroll used to post Foundry's own plain default roll card,
  // which sat right below the original's own bordered/chamfered e20-check-card and looked like a
  // visually unrelated, plainer message rather than a continuation of the same roll. results is
  // always empty here (a reroll has nothing new to compare against a Difficulty - the original
  // message above it already showed that), which is exactly what makes check-card.hbs render as
  // this same plain flavor+roll box with no results list, rather than pulling in machinery this
  // doesn't need.
  const chatData = await buildCheckChatData(rerolled, {
    flavor: label,
    results: [],
    speaker: message.speaker,
    canCritD2,
    rollContext: { rerollConfig: config },
  });
  ChatMessage.create(chatData);
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
  // The actor's own grants, plus the reroll everyone has: a 1, for a Story Point (see
  // helpers/reroll.mjs#storyPointRerollConfig).
  const configs = [...getRerollConfigs(actor), storyPointRerollConfig()]
    .filter(config => canMeetRerollScope(config, context))
    .filter(config => hasEligibleRerollTarget(roll, config));
  if (!configs.length) {
    return;
  }

  // Placed as a sibling AFTER the whole .dice-roll block (formula + tooltip + total,
  // templates/dice/roll.hbs in Foundry core) rather than appended INSIDE it - appending inside
  // put the button ahead of the total in practice, not below the roll the way it reads in the
  // source. A dedicated .e20-reroll-buttons wrapper holds every eligible config's own button
  // together, so multiple reroll grants on one roll stack under it instead of each finding its
  // own spot.
  const diceRoll = html.querySelector(".dice-roll");
  const container = document.createElement("div");
  container.className = "e20-reroll-buttons";
  if (diceRoll?.parentElement) {
    diceRoll.parentElement.insertBefore(container, diceRoll.nextSibling);
  } else {
    const fallback = html.querySelector(".message-content") ?? html;
    if (!fallback) {
      return;
    }

    fallback.appendChild(container);
  }

  for (const config of configs) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "e20-reroll-button";
    const rerollLabel = `${game.i18n.localize("E20.RerollDice")} (${game.i18n.localize(rerollModeLabel(config.mode))})`;
    // Shows which Perk/effect is actually offering the reroll - "Reroll Dice (Ones)" alone gave
    // no way to tell one grant from another when an actor has more than one (or to recognize an
    // unfamiliar one at all), and this is the one place a player sees the grant before deciding
    // whether to use it.
    button.textContent = config.name
      ? game.i18n.format("E20.RerollDiceFrom", { source: config.name, reroll: rerollLabel })
      : rerollLabel;
    button.title = config.name
      ? game.i18n.format("E20.RerollDiceTitleFrom", { source: config.name })
      : game.i18n.localize("E20.RerollDiceTitle");
    button.addEventListener("click", () => rerollMessage(message, config));
    container.appendChild(button);
  }
};

/**
 * "+1 to a Defense after dice are rolled" for a Story Point (GI Joe CRB p.127, TF p.105; Power
 * Rangers and My Little Pony have no after-the-roll spend - see
 * helpers/story-points.mjs#defenseBoostAfterRoll). A single point of Defense only changes
 * anything when the attack met the Defense exactly, so that is the only time the button appears:
 * on each target that was hit by a margin of nothing, for whoever can spend for that target.
 * Buying it turns the hit into a miss, which is announced in chat; the damage button above it
 * is then simply not pressed. Called on the renderChatMessageHTML hook, alongside
 * addRerollButtons.
 */
export const addDefenseBoostButton = function (message, html) {
  if (!message.isRoll || !message.isContentVisible || !message.rolls?.length || !defenseBoostAfterRoll(getGameLine())) {
    return;
  }

  const flags = message.flags?.essence20;
  const total = message.rolls[0].total;
  const exactHits = (flags?.checkResults ?? []).filter(result => result.success && result.targetUuid && result.difficulty === total);
  if (!exactHits.length) {
    return;
  }

  const anchor = html.querySelector(".e20-check-results") ?? html.querySelector(".message-content") ?? html;
  for (const result of exactHits) {
    const target = fromUuidSync(result.targetUuid);
    if (!target || !(target.isOwner || game.user.isGM) || !canSpendForActor(target)) {
      continue;
    }

    const claimedKey = `defenseBoostClaimed.${result.targetUuid.replace(/\./g, "-")}`;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "e20-reroll-button e20-defense-boost-button";
    button.textContent = game.i18n.format("E20.SptDefenseBoostAfter", { name: target.name });
    button.disabled = !!foundry.utils.getProperty(flags, claimedKey);
    button.addEventListener("click", async () => {
      button.disabled = true;
      await spendForActor(target, 1, { announce: false });
      await message.setFlag("essence20", claimedKey, true);
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: target }),
        content: game.i18n.format("E20.SptDefenseBoostAfterSpent", { name: target.name }),
      });
    });
    anchor.appendChild(button);
  }
};

// MLP CRB "Consummate Performer" (Laugh Tactic, p.86) - offers to regain 1 Cheer once a
// Consummate Performer attempt (see helpers/consummate-performer.mjs#activateConsummatePerformer)
// has actually posted and its outcome is known, same "only known once the message exists"
// reasoning as rollFailed itself. Called on the renderChatMessageHTML hook, alongside
// addRerollButtons.
export const addConsummatePerformerButton = function (message, html) {
  if (!message.isRoll || !message.isContentVisible || !message.rolls?.length || !message.speaker) {
    return;
  }

  if (!message.flags?.essence20?.consummatePerformer || message.flags?.essence20?.rollFailed !== false) {
    return;
  }

  const target = html.querySelector(".dice-roll") ?? html.querySelector(".message-content") ?? html;
  if (!target) {
    return;
  }

  const button = document.createElement("button");
  button.type = "button";
  button.className = "e20-consummate-performer-button";
  button.textContent = game.i18n.localize("E20.ConsummatePerformerRegain");
  if (message.getFlag("essence20", "consummatePerformerClaimed")) {
    button.disabled = true;
  } else {
    button.addEventListener("click", async () => {
      const actor = ChatMessage.getSpeakerActor(message.speaker);
      if (!actor) {
        return;
      }

      await claimConsummatePerformer(actor);
      await message.setFlag("essence20", "consummatePerformerClaimed", true);
      button.disabled = true;
    });
  }

  target.appendChild(button);
};

// Spite (Beneath the Helmet, Dark Ranger, 2nd level, p.39) - see helpers/spite.mjs's own doc
// comment for why this needs its own reactive, post-roll button rather than a pre-roll checkbox:
// the trigger ("whenever you MISS your Attack") isn't knowable until the roll has already
// resolved. Same overall shape as addConsummatePerformerButton just above (a button appended to
// the roll's own chat message, gated on that roll's outcome, disabled once claimed) - here gated
// on a miss (rollFailed === true, the mirror of Consummate Performer's own === false check)
// against a single resolved target, rather than a success.
export const addSpiteButton = function (message, html) {
  if (!message.isRoll || !message.isContentVisible || !message.rolls?.length || !message.speaker) {
    return;
  }

  const flags = message.flags?.essence20;
  if (!flags?.isAttack || flags?.rollFailed !== true || !flags?.targetUuid) {
    return;
  }

  const actor = ChatMessage.getSpeakerActor(message.speaker);
  if (!actor || !hasSpite(actor)) {
    return;
  }

  const target = html.querySelector(".dice-roll") ?? html.querySelector(".message-content") ?? html;
  if (!target) {
    return;
  }

  const button = document.createElement("button");
  button.type = "button";
  button.className = "e20-spite-button";
  button.textContent = game.i18n.localize("E20.SpiteActivate");
  if (message.getFlag("essence20", "spiteClaimed")) {
    button.disabled = true;
  } else if (actor.system.powers.personal.value < 1) {
    button.disabled = true;
  } else {
    button.addEventListener("click", async () => {
      await activateSpite(actor, flags.targetUuid);
      await message.setFlag("essence20", "spiteClaimed", true);
      button.disabled = true;
    });
  }

  target.appendChild(button);
};

// Suffer! (Finster's Monster-Matic Cookbook, Path of Thorns, 15th level, p.300) - see
// helpers/suffer.mjs's own doc comment. Same overall shape as addSpiteButton above, but gated on
// dealtDamage === true (the mirror of Spite's own rollFailed === true) rather than a miss, and the
// spend amount is chosen by the player at click time (helpers/suffer.mjs#pickSufferAmount) rather
// than a fixed cost, so there's no single "can afford it" number to disable on beyond having any
// Personal Power at all.
export const addSufferButton = function (message, html) {
  if (!message.isRoll || !message.isContentVisible || !message.rolls?.length || !message.speaker) {
    return;
  }

  const flags = message.flags?.essence20;
  if (!flags?.isAttack || flags?.dealtDamage !== true || !flags?.targetUuid) {
    return;
  }

  const actor = ChatMessage.getSpeakerActor(message.speaker);
  if (!actor || !hasSuffer(actor)) {
    return;
  }

  const target = html.querySelector(".dice-roll") ?? html.querySelector(".message-content") ?? html;
  if (!target) {
    return;
  }

  const button = document.createElement("button");
  button.type = "button";
  button.className = "e20-suffer-button";
  button.textContent = game.i18n.localize("E20.SufferActivate");
  if (message.getFlag("essence20", "sufferClaimed")) {
    button.disabled = true;
  } else if (actor.system.powers.personal.value < 1) {
    button.disabled = true;
  } else {
    button.addEventListener("click", async () => {
      const activated = await activateSuffer(actor, flags.targetUuid);
      if (activated) {
        await message.setFlag("essence20", "sufferClaimed", true);
        button.disabled = true;
      }
    });
  }

  target.appendChild(button);
};

const EXPLOIT_WEAKNESS_ID = "Compendium.essence20.pr_crb.Item.BTSdvgvfKHWeV07C";

// Exploit Weakness (Power Rangers CRB, Yellow Ranger, 7th/15th level, p.57) - see
// helpers/exploit-weakness.mjs's own doc comment for why this needs its own reactive, post-roll
// button rather than a pre-roll checkbox: the trigger ("after making a melee attack") isn't a
// choice made before the roll, and RAW doesn't require the attack to have hit. Same overall shape
// as addSpiteButton just above, but gated on a melee Attack regardless of outcome, with no cost to
// afford (a free Skill Test, not a Power spend) and no target-scoped rollFailed check.
export const addExploitWeaknessButton = function (message, html) {
  if (!message.isRoll || !message.isContentVisible || !message.rolls?.length || !message.speaker) {
    return;
  }

  const flags = message.flags?.essence20;
  if (!flags?.isMelee || !flags?.targetUuid) {
    return;
  }

  const actor = ChatMessage.getSpeakerActor(message.speaker);
  if (!actor || !actorHasPerk(actor, EXPLOIT_WEAKNESS_ID)) {
    return;
  }

  const target = html.querySelector(".dice-roll") ?? html.querySelector(".message-content") ?? html;
  if (!target) {
    return;
  }

  const button = document.createElement("button");
  button.type = "button";
  button.className = "e20-exploit-weakness-button";
  button.textContent = game.i18n.localize("E20.ExploitWeaknessActivate");
  if (message.getFlag("essence20", "exploitWeaknessClaimed")) {
    button.disabled = true;
  } else {
    button.addEventListener("click", async () => {
      await activateExploitWeakness(actor, flags.targetUuid);
      await message.setFlag("essence20", "exploitWeaknessClaimed", true);
      button.disabled = true;
    });
  }

  target.appendChild(button);
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

  // A Megaform doesn't take damage against a single pooled Health the way every other actor type
  // does - RAW (PR CRB p.142) distributes it across its linked participants instead (see
  // helpers/megaform-damage.mjs's own doc comment). None of the checks below this point (all
  // PC/NPC Perk-driven mitigations) apply to a Megaform anyway, so this routes to the dedicated
  // distribution helper and skips straight to the same tail bookkeeping (button disable,
  // applied-amount chat message) the ordinary path performs after applyDamage() below.
  if (target.type == 'megaform') {
    const amount = await applyMegaformDamage(target, damage, button.dataset.damageType);
    button.disabled = true;
    const appliedKeys = message.getFlag('essence20', 'damageAppliedKeys') || [];
    await message.setFlag('essence20', 'damageAppliedKeys', [...appliedKeys, button.dataset.key]);
    ChatMessage.create({
      content: `${target.name}: ${amount} ${game.i18n.localize('E20.CheckDamageApplied')}`,
      speaker: ChatMessage.getSpeaker({ actor: target }),
    });

    return;
  }

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
      classes: ["window-app", "e20-window"],
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
      classes: ["window-app", "e20-window"],
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

  // Hard Corps (Sgt Slaughter Sourcebook, Marine Origin Benefit, p.8) - see
  // helpers/hard-corps.mjs's own doc comment. Checked before Didn't Even Feel It/Just a Graze
  // below since a confirmed ignore here banks a debt rather than just discarding the damage - if
  // both this and one of those were somehow available on the same hit, prompting for Hard Corps
  // first avoids a moot second prompt once damage is already at 0.
  if (damage > 0 && actorHasPerk(target, HARD_CORPS_ID) && !hasUsedThisEncounter(target, HARD_CORPS_ENCOUNTER_FLAG)) {
    const confirmation = await foundry.applications.api.DialogV2.wait({
      window: { title: game.i18n.localize('E20.HardCorpsConfirmTitle') },
      classes: ["window-app", "e20-window"],
      content: `<p>${game.i18n.format('E20.HardCorpsConfirmContent', { name: target.name })}</p>`,
      modal: true,
      buttons: [
        { label: game.i18n.localize('E20.DialogConfirmButton'), action: 'confirm' },
        { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
      ],
    });

    if (confirmation == 'confirm') {
      await bankHardCorpsDebt(target, damage);
      damage = 0;
      await markUsedThisEncounter(target, HARD_CORPS_ENCOUNTER_FLAG);
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
      classes: ["window-app", "e20-window"],
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

  const previousHealth = target.system.health.value;
  const wasAlreadyDefeated = !!target.statuses?.has?.('defeated');
  const amount = await applyDamage(target, damage, button.dataset.damageType);

  // CBRN Defender's own Hang-Up - see helpers/cbrn-defender.mjs's own doc comment. "Defeats a
  // living creature through damage" - either the target's own Health reaching 0 from this hit (an
  // ordinary damage type, which never auto-toggles the Defeated status itself - computed from
  // applyDamage's own returned amount rather than re-reading target.system.health.value, since a
  // Stun hit's returned "amount" is Stun dealt, not Health lost, and never reduces Health at all)
  // or the Defeated status actually getting toggled on (applyDamage's own Stun-crosses-remaining-
  // Health branch) - covers both real Defeat paths this codebase has. Guarded on not already being
  // Defeated beforehand, so re-hitting an already-downed target doesn't keep re-triggering this.
  const isDefeatedByHealthLoss = button.dataset.damageType != 'stun' && (previousHealth - amount) <= 0;
  const isNowDefeated = isDefeatedByHealthLoss || !!target.statuses?.has?.('defeated');
  if (attacker && !wasAlreadyDefeated && isNowDefeated && actorHasHangUp(attacker, CBRN_DEFENDER_HANG_UP_ID)) {
    await markCbrnDefenderTriggered(attacker);
  }

  // Defeat of a Vehicle / Recall for Repairs - see helpers/vehicle-defeat.mjs's own doc comment.
  // Scoped to isDefeatedByHealthLoss (excludes Stun, same as CBRN Defender's own check just
  // above) since RAW's own trigger is "reaches 0 Health," which Stun damage never touches.
  if (isDefeatedByHealthLoss && !wasAlreadyDefeated && (target.type == 'vehicle' || target.type == 'zord')) {
    await handleVehicleZeroHealthTransition(target);
  }

  // Iron Hide (GI Joe CRB, Vanguard base, 1st level, p.107) - see helpers/iron-hide.mjs's own doc
  // comment. The damage has already landed above (its own roll's outcome isn't known
  // synchronously) - a confirmed attempt here spends the Story Point and triggers the real Brawn
  // DIF 15 Skill Test, which restores the Health on a success via its own post-hit consumption in
  // dice.mjs. Scoped to isDefeatedByHealthLoss (excludes Stun, same as CBRN Defender's own check
  // just above) since RAW's own "an attack would make you Defeated" reads as ordinary damage.
  if (isDefeatedByHealthLoss && actorHasPerk(target, IRON_HIDE_ID) && canWriteStoryPoints() && hasStoryPointsAvailable(1)) {
    const confirmation = await foundry.applications.api.DialogV2.wait({
      window: { title: game.i18n.localize('E20.IronHideConfirmTitle') },
      classes: ["window-app", "e20-window"],
      content: `<p>${game.i18n.format('E20.IronHideConfirmContent', { name: target.name })}</p>`,
      modal: true,
      buttons: [
        { label: game.i18n.localize('E20.DialogConfirmButton'), action: 'confirm' },
        { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
      ],
    });

    if (confirmation == 'confirm') {
      requestStoryPointSpend(target, 1);
      await activateIronHide(target, amount);
    }
  }

  // Tough Enough (GI Joe CRB, Tank Focus, 6th level, p.99) - see
  // helpers/combat.mjs#grantToughEnoughResistance's own doc comment. Scoped to "a non-attack
  // effect against your Toughness" specifically, via the posted roll's own isAttack/defenseType
  // flags (dice.mjs#rollSkill's own rollContext) - an ordinary weapon Attack against Toughness
  // does NOT trigger this.
  if (message.getFlag('essence20', 'isAttack') === false && message.getFlag('essence20', 'defenseType') == 'toughness') {
    await grantToughEnoughResistance(target, button.dataset.damageType, amount);
  }

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
