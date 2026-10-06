import { handleRiderButton } from "./mechanics/combat/target-riders.mjs";
import { applyTimedCondition } from "./mechanics/combat/timed-status.mjs";
import { applyEssenceDamage } from "./mechanics/world/environment-hazards.mjs";
import { applyEssenceAttack, describeEssenceAttack, isEssenceDamageType } from "./mechanics/combat/essence-attack.mjs";
import { E20 } from "./util/config.mjs";
import {
  _isCritIsFumble, applyDamage, buildCheckChatData, getSecondaryDamageForButton,
} from "./mechanics/combat/combat.mjs";
import { computeSystemColorVars } from "./util/system-color.mjs";
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
  upshiftFormula,
} from "./mechanics/rolls/reroll.mjs";
import {
  canSpendForActor, canWriteStoryPoints, defenseBoostAfterRoll, spendForActor,
} from "./mechanics/resources/story-points.mjs";
import { getGameLine } from "./settings.js";
import { claimConsummatePerformer } from "./items/resources/consummate-performer.mjs";
import { canOfferHighDensityFollowUp, hasDifferentTarget, rollHighDensityFollowUp } from "./items/attacks/high-density.mjs";
import { findEligibleProtector } from "./items/defenses/interpose-attack.mjs";
import { applyMegaformDamage } from "./mechanics/vehicles/megaform-damage.mjs";
import { handleVehicleZeroHealthTransition } from "./mechanics/vehicles/vehicle-defeat.mjs";

export { _isCritIsFumble };

// (Sudden Death, Fortitude, Extra Plates, Didn't Even Feel It, Hard Corps, Invincibility Through Invisibility and Just a Graze
// are staged applyingDamage Triggers on their items - rules/plugins/combat/applying-damage-stages.mjs.)

// {skill, essence, snag, isPowerWeaponAttack, rollFailed, canCritD2} stashed on the message by
// dice.mjs#rollSkill/combat.mjs#buildCheckChatData - see
// mechanics/rolls/reroll.mjs#canMeetRerollScope/canMeetRerollCondition's own doc comments.
export function getRerollContext(message) {
  return {
    skill: message.flags?.essence20?.skill,
    essence: message.flags?.essence20?.essence,
    snag: message.flags?.essence20?.snag,
    isPowerWeaponAttack: message.flags?.essence20?.isPowerWeaponAttack,
    rollFailed: message.flags?.essence20?.rollFailed,
    canCritD2: message.flags?.essence20?.canCritD2,
    vsPrimaryQuarry: message.flags?.essence20?.vsPrimaryQuarry,
    isMeleeAttack: message.flags?.essence20?.isMeleeAttack,
    // Focused Strike, Homing Shots and Exterminator's conditions - stamped by dice.mjs's rollContext,
    // but never passed on here, so those rerolls could never be offered.
    isUnarmedAttack: message.flags?.essence20?.isUnarmedAttack,
    isConsumableOrWreckerRangedAttack: message.flags?.essence20?.isConsumableOrWreckerRangedAttack,
    smallerTarget: message.flags?.essence20?.smallerTarget,
    // Clip Check's - read from the roll itself, like isCrit/isFumble everywhere else in this file.
    isFumble: _isCritIsFumble(message.rolls?.[0]?.dice ?? [], message.flags?.essence20?.canCritD2)[1],
    // Destiny's own belowSmallestSkillDie condition - the base d20 term's own already-rolled
    // total (not read from flags, since it's the roll itself, not a computed context field).
    d20Result: message.rolls?.[0]?.dice?.find(die => die.faces == 20)?.total,
  };
}

const MATCH_VALUES = { ones: [1], onesAndTwos: [1, 2] };

/**
 * Whether a roll has a Skill Die (any non-d20 die) showing a face the reroll mode matches. Modes
 * without a face rule ('all', 'single') always match.
 * @param {Roll} roll
 * @param {String} mode   E20.rerollModes key.
 * @returns {Boolean}
 */
export function hasMatchingSkillDie(roll, mode) {
  const values = MATCH_VALUES[mode];
  if (!values) {
    return true;
  }

  return (roll?.dice ?? []).some(die => die.faces != 20
    && (die.results ?? []).some(result => result.active !== false && values.includes(result.result)));
}

/**
 * Copies the original roll's d20 results onto a re-rolled test so only its Skill Dice change, then
 * recomputes the total.
 * @param {Roll} original
 * @param {Roll} rerolled   Already evaluated.
 */
export function keepOriginalD20(original, rerolled) {
  const from = original?.dice?.find(die => die.faces == 20);
  const to = rerolled?.dice?.find(die => die.faces == 20);
  if (!from || !to || from.number != to.number) {
    return;
  }

  to.results = from.results.map(result => ({ ...result }));
  rerolled._total = rerolled._evaluateTotal();
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
    // all, distinct from there not being enough left. See mechanics/resources/story-points.mjs.
    const noGmForStoryPoints = config.cost?.worldStoryPoints > 0 && !canWriteStoryPoints();
    ui.notifications.warn(game.i18n.localize(noGmForStoryPoints ? "E20.RerollNoGmConnected" : "E20.RerollInsufficientResource"));
    return;
  }

  // Reconstructed from the original roll's own serialized data (not Roll#clone(), which
  // discards all dice results and starts a fresh, independently-random, unevaluated roll) so the
  // reroll starts as an exact copy of what was actually rolled, ready for applyReroll() to
  // selectively mutate only the targeted dice in place.
  //
  // A grant that upshifts the re-rolled test (Mending the Grid) can't be done in place - the skill
  // die's own size changes - so it re-rolls the whole test from its formula instead, with the
  // shift applied. See mechanics/rolls/reroll.mjs#upshiftFormula.
  //
  // A skill-dice-only upshift grant (I've Done this Before?: "when you roll a 1 on a Skill Die you
  // may reroll the Skill Die and gain ↑1") needs a matching Skill Die first, and keeps the original
  // d20 - only the Skill Die is re-rolled, one size up.
  let rerolled;
  if (config.shiftUp > 0) {
    const original = message.rolls[0];
    const skillDiceOnly = config.target == 'skillDice';
    if (skillDiceOnly && !hasMatchingSkillDie(original, config.mode)) {
      ui.notifications.warn(game.i18n.localize("E20.RerollScopeNotMet"));
      return;
    }

    rerolled = await new Roll(upshiftFormula(original.formula, config.shiftUp), original.data).evaluate();
    if (skillDiceOnly) {
      keepOriginalD20(original, rerolled);
    }
  } else {
    rerolled = Roll.fromData(message.rolls[0].toJSON());
    if (!(await applyReroll(rerolled, config))) {
      return;
    }
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
  // mechanics/rolls/reroll.mjs#storyPointRerollConfig).
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
 * mechanics/resources/story-points.mjs#defenseBoostAfterRoll). A single point of Defense only changes
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

/**
 * Puts a post-roll button (Spite, High-Density, Frenzied Attack...) below the roll, the same spot
 * addRerollButtons uses: appended INSIDE .dice-roll it landed above the formula and total, where
 * it read as part of the roll rather than a button. Buttons from several add*Button calls share
 * one .e20-chat-action-buttons row under the roll.
 * @param {HTMLElement} html   The rendered chat message.
 * @param {HTMLButtonElement} button
 */
function placeActionButton(html, button) {
  let container = html.querySelector(".e20-chat-action-buttons");
  if (!container) {
    container = document.createElement("div");
    container.className = "e20-chat-action-buttons";
    const diceRoll = html.querySelector(".dice-roll");
    if (diceRoll?.parentElement) {
      diceRoll.parentElement.insertBefore(container, diceRoll.nextSibling);
    } else {
      (html.querySelector(".message-content") ?? html).appendChild(container);
    }
  }

  container.appendChild(button);
}

// MLP CRB "Consummate Performer" (Laugh Tactic, p.86) - offers to regain 1 Cheer once a
// Consummate Performer attempt (see items/resources/consummate-performer.mjs#activateConsummatePerformer)
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
  button.className = "e20-chat-action-button e20-consummate-performer-button";
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

  placeActionButton(html, button);
};

// (Secret Helper is a CardOffer rule on its Perk - rules/conv15-items2.test.js.)

// High-Density (Factions in Action Vol. 2, p.92) - see items/attacks/high-density.mjs's own doc comment.
// Same reactive post-roll button shape as addFrenziedAttackButton just above, gated on an Attack
// with a High-Density weapon that hit something. The player targets the second creature first;
// clicking with only the original target still selected just warns, without claiming the button.
export const addHighDensityButton = function (message, html) {
  if (!message.isRoll || !message.isContentVisible || !message.rolls?.length || !message.speaker) {
    return;
  }

  const flags = message.flags?.essence20;
  if (!canOfferHighDensityFollowUp(flags)) {
    return;
  }

  const actor = ChatMessage.getSpeakerActor(message.speaker);
  const item = fromUuidSync(flags.itemUuid);
  // Only the attacker's own players get the button - the follow-up rolls on their behalf.
  if (!actor?.isOwner || !item) {
    return;
  }

  const target = html.querySelector(".dice-roll") ?? html.querySelector(".message-content") ?? html;
  if (!target) {
    return;
  }

  const button = document.createElement("button");
  button.type = "button";
  button.className = "e20-chat-action-button e20-high-density-button";
  button.textContent = game.i18n.localize("E20.HighDensityFollowUp");
  if (message.getFlag("essence20", "highDensityClaimed")) {
    button.disabled = true;
  } else {
    button.addEventListener("click", async () => {
      if (!hasDifferentTarget(game.user.targets, flags.targetUuid)) {
        ui.notifications.warn(game.i18n.localize("E20.HighDensityNeedsNewTarget"));
        return;
      }

      button.disabled = true;
      await message.setFlag("essence20", "highDensityClaimed", true);
      await rollHighDensityFollowUp(actor, item);
    });
  }

  placeActionButton(html, button);
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

    // A weaponEffect's second damage component (e.g. "1 Blunt and 1 Stun") rides on the same
    // button - check-card.hbs only prints the main one, so its label is extended here.
    const secondary = getSecondaryDamageForButton(message.flags?.essence20, button.dataset.key, button.dataset.targetUuid);
    if (secondary?.value > 0) {
      button.append(` + ${secondary.value} ${game.i18n.localize(E20.damageTypes[secondary.type] ?? secondary.type)}`);
    }

    button.addEventListener('click', () => onApplyDamage(message, button));
  }
};

/**
 * An Apply Damage button whose type is an Essence damage type. Sludge/V.E.N.O.M.: "If Science is
 * used for the Skill Test, the attacker chooses" - read off the posted roll's own skill; the GM
 * clicking the button makes the pick for them. The effect's second damage, if any, still lands.
 * @param {ChatMessage} message
 * @param {HTMLElement} button
 * @param {Actor} target
 * @param {Number} damage
 */
async function applyEssenceDamageButton(message, button, target, damage) {
  const result = await applyEssenceAttack(target, damage, button.dataset.damageType, {
    attackerChooses: message.flags?.essence20?.skill == 'science',
    ignoreImmunity: button.dataset.ignoreImmunity == 'true',
  });
  if (result.cancelled) {
    return;
  }

  const lines = [describeEssenceAttack(target, result)];
  const secondary = getSecondaryDamageForButton(message.flags?.essence20, button.dataset.key, button.dataset.targetUuid);
  if (secondary?.value > 0) {
    const [isCrit] = _isCritIsFumble(message.rolls?.[0]?.dice ?? [], message.flags?.essence20?.canCritD2);
    const amount = await applyDamage(target, secondary.value, secondary.type, isCrit);
    lines.push(`${target.name}: ${amount} ${game.i18n.localize('E20.CheckDamageApplied')}`);
  }

  button.disabled = true;
  const appliedKeys = message.getFlag('essence20', 'damageAppliedKeys') || [];
  await message.setFlag('essence20', 'damageAppliedKeys', [...appliedKeys, button.dataset.key]);
  ChatMessage.create({
    content: lines.join('<br>'),
    speaker: ChatMessage.getSpeaker({ actor: target }),
  });
}

// Cross-actor Health changes stay GM-gated, since there's no existing precedent anywhere in this
// codebase for a player mutating another actor's document.
// Exported (only) for unit testing - attachCheckCardListeners above is this function's real
// entry point, wired to the chat card's own DOM button clicks.
export async function onApplyDamage(message, button) {
  if (!game.user.isGM) {
    ui.notifications.warn(game.i18n.localize('E20.CheckApplyDamageGmOnly'));
    return;
  }

  let target = await fromUuid(button.dataset.targetUuid);
  if (!target) {
    return;
  }

  // A crit option that applies a Condition instead - Scramble Wave's Stunned "until the end of their
  // next turn" (mechanics/combat/timed-status.mjs counts that one round).
  if (button.dataset.status) {
    await applyTimedCondition(target, button.dataset.status, 1);
    button.disabled = true;
    const appliedKeys = message.getFlag('essence20', 'damageAppliedKeys') || [];
    await message.setFlag('essence20', 'damageAppliedKeys', [...appliedKeys, button.dataset.key]);
    return;
  }

  // A crit option that damages an Essence instead (Bewildering, Traumatic, Maiming, Surgical).
  if (button.dataset.essence) {
    const damaged = await applyEssenceDamage(target, [button.dataset.essence]);
    button.disabled = true;
    const appliedKeys = message.getFlag('essence20', 'damageAppliedKeys') || [];
    await message.setFlag('essence20', 'damageAppliedKeys', [...appliedKeys, button.dataset.key]);
    ChatMessage.create({
      content: game.i18n.format(damaged.length ? 'E20.CheckEssenceDamageApplied' : 'E20.CheckEssenceDamageNone', {
        name: target.name, essence: game.i18n.localize(CONFIG.E20.essences?.[button.dataset.essence] ?? button.dataset.essence),
      }),
      speaker: ChatMessage.getSpeaker({ actor: target }),
    });
    return;
  }

  // Defense damage, marks and bonus attacks from a Critical Effect - mechanics/combat/target-riders.mjs.
  if (button.dataset.defense || button.dataset.rider) {
    await handleRiderButton(message, button, target);
    button.disabled = true;
    const appliedKeys = message.getFlag('essence20', 'damageAppliedKeys') || [];
    await message.setFlag('essence20', 'damageAppliedKeys', [...appliedKeys, button.dataset.key]);
    return;
  }

  let damage = parseInt(button.dataset.damage);

  // Essence damage (mechanics/combat/essence-attack.mjs) - it comes off an Essence score, not Health, so
  // none of the Health-side reductions and reactions below apply.
  if (isEssenceDamageType(button.dataset.damageType)) {
    await applyEssenceDamageButton(message, button, target, damage);
    return;
  }

  // (Active Protection System / Slat Armor / Reactive Armor are DamageReduction rules on the vehicle's upgrades, read
  // in applyDamage - rules/plugins/tags/damage-source.mjs.)

  // The weaponEffect's own second damage component on this same hit, if it has one - see
  // combat.mjs#getSecondaryDamageForButton. Dropped only when the whole attack is negated
  // (Didn't Even Feel It, Hard Corps); the flat per-hit reductions below trim the main damage.
  let secondary = getSecondaryDamageForButton(message.flags?.essence20, button.dataset.key, button.dataset.targetUuid);

  // A Megaform doesn't take damage against a single pooled Health the way every other actor type
  // does - RAW (PR CRB p.142) distributes it across its linked participants instead (see
  // mechanics/vehicles/megaform-damage.mjs's own doc comment). None of the checks below this point (all
  // PC/NPC Perk-driven mitigations) apply to a Megaform anyway, so this routes to the dedicated
  // distribution helper and skips straight to the same tail bookkeeping (button disable,
  // applied-amount chat message) the ordinary path performs after applyDamage() below.
  if (target.type == 'megaform') {
    let amount = await applyMegaformDamage(target, damage, button.dataset.damageType);
    if (secondary?.value > 0) {
      amount += await applyMegaformDamage(target, secondary.value, secondary.type);
    }

    button.disabled = true;
    const appliedKeys = message.getFlag('essence20', 'damageAppliedKeys') || [];
    await message.setFlag('essence20', 'damageAppliedKeys', [...appliedKeys, button.dataset.key]);
    ChatMessage.create({
      content: `${target.name}: ${amount} ${game.i18n.localize('E20.CheckDamageApplied')}`,
      speaker: ChatMessage.getSpeaker({ actor: target }),
    });

    return;
  }

  // The attacker's own staged applyingDamage Triggers (Sudden Death - rules/plugins/combat/applying-damage-stages.mjs):
  // the hit may be taken over outright (a Defeat instead of damage), spending the card's button.
  const attacker = game.actors.get(message.speaker?.actor);
  const { applyingDamageStage } = await import("./rules/plugins/combat/applying-damage-stages.mjs");
  const takenOver = await applyingDamageStage(attacker, damage, {
    stage: 'attacker', other: target, hit: target, damageType: button.dataset.damageType, dataset: { ...button.dataset },
  });
  if (takenOver.handled) {
    button.disabled = true;
    const appliedKeys = message.getFlag('essence20', 'damageAppliedKeys') || [];
    await message.setFlag('essence20', 'damageAppliedKeys', [...appliedKeys, button.dataset.key]);
    return;
  }

  // Taking the hit for someone - Impenetrable Armor (items/defenses/interpose-attack.mjs) first, else the item rules'
  // applyingDamage protectors (Interpose, Body Shield, Heroic Sacrifice, Golden Guardian, Stand By Me -
  // rules/plugins/combat/applying-damage.mjs); only one is offered. Same "auto-detect eligibility, human confirms" shape
  // as Just a Graze/Didn't Even Feel It/Hard Corps below, but resolved FIRST and against the redirect, not a reduction -
  // a confirmed swap here reassigns `target` itself, so every check below (including applyDamage() itself) naturally runs
  // against the protector instead. Then the applyingDamage Triggers of whoever it lands on (Fe-BURN!) may change the damage.
  if (damage > 0) {
    const redirect = findEligibleProtector(target);
    if (redirect) {
      const confirmation = await foundry.applications.api.DialogV2.wait({
        window: { title: game.i18n.localize('E20.DamageRedirectConfirmTitle') },
        classes: ["window-app"],
        content: `<p>${game.i18n.format('E20.DamageRedirectConfirmContent', { protector: redirect.protector.name, target: target.name })}</p>`,
        modal: true,
        buttons: [
          { label: game.i18n.localize('E20.DialogConfirmButton'), action: 'confirm' },
          { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
        ],
      });

      if (confirmation == 'confirm') {
        target = redirect.protector;
      }
    }

    const { applyingDamage } = await import("./rules/plugins/combat/applying-damage.mjs");
    const landing = await applyingDamage(target, damage, { attacker, damageType: button.dataset.damageType, redirect: !redirect });
    target = landing.target;
    damage = landing.damage;
    if (landing.dropSecondary) {
      secondary = null;
    }
  }

  // Staged applyingDamage Triggers of whoever it lands on (rules/plugins/combat/applying-damage-stages.mjs): Fortitude,
  // Extra Plates, Didn't Even Feel It (Racer Abandon moves the Renegade's onto the driven vehicle - scope renegadeVehicle).
  if (damage > 0) {
    const reduced = await applyingDamageStage(target, damage, { stage: 'reductions', other: attacker, hit: target, damageType: button.dataset.damageType });
    damage = reduced.damage;
    if (reduced.dropSecondary) {
      secondary = null;
    }
  }

  // The late staged applyingDamage Triggers (Hard Corps first - its debt is a mark settled at the combat's end -, then
  // Invincibility Through Invisibility, Just a Graze).
  if (damage > 0) {
    const late = await applyingDamageStage(target, damage, { stage: 'lateReductions', other: attacker, hit: target, damageType: button.dataset.damageType });
    damage = late.damage;
    if (late.dropSecondary) {
      secondary = null;
    }
  }

  const previousHealth = target.system.health.value;
  const wasAlreadyDefeated = !!target.statuses?.has?.('defeated');
  // Rise Again (its wouldBeDefeated Trigger rule reads damage:crit) - the only caller that ever has a
  // real crit/fumble result to thread through (a synthetic damage source, e.g. Psychoanalyst's own
  // psychoanalystDamage, has no underlying d20 roll to check and correctly defaults to false).
  const [isCrit] = _isCritIsFumble(message.rolls?.[0]?.dice ?? [], message.flags?.essence20?.canCritD2);

  // A Critical Success landing: the target's criticallyHit Triggers (Imperial Machine Mantle "falls to pieces" -
  // rules/plugins/combat/critically-hit-event.mjs).
  if (isCrit) {
    const { criticallyHit } = await import("./rules/plugins/combat/critically-hit-event.mjs");
    await criticallyHit(target, attacker);
  }

  // CardResistance rules of whoever it lands on (Tough Enough: a non-attack effect against Toughness that still hit - the
  // posted roll's own isAttack / defenseType flags): its damage, and its second damage, halved (rounded up).
  const { resisted, ruleCardResistance } = await import("./rules/plugins/combat/card-resistance.mjs");
  if (ruleCardResistance(target, message, attacker)) {
    damage = resisted(damage);
    if (secondary?.value > 0) {
      secondary = { ...secondary, value: resisted(secondary.value) };
    }
  }

  // Concentrated Fire "treats Fire Immunity as Fire Resistance" (mechanics/combat/target-riders.mjs) - its
  // button carries data-ignore-immunity.
  const source = game.actors?.get?.(message.speaker?.actor) ?? null;
  const amount = await applyDamage(target, damage, button.dataset.damageType, isCrit, { ignoreImmunity: button.dataset.ignoreImmunity == 'true', source });
  const secondaryAmount = secondary?.value > 0 ? await applyDamage(target, secondary.value, secondary.type, isCrit, { source }) : 0;
  // Health actually lost to this hit - Stun never reduces Health (see applyDamage), and nor does a
  // second damage that is Essence damage.
  const secondaryHitsHealth = !!secondary && secondary.type != 'stun' && !isEssenceDamageType(secondary.type);
  const healthLost = (button.dataset.damageType != 'stun' ? amount : 0)
    + (secondaryHitsHealth ? secondaryAmount : 0);
  const hitsHealth = button.dataset.damageType != 'stun' || (secondaryAmount > 0 && secondaryHitsHealth);

  // The target's Health reaching 0 from this hit (an ordinary damage type - computed from applyDamage's own
  // returned amount, since a Stun hit's returned "amount" is Stun dealt, not Health lost).
  const isDefeatedByHealthLoss = hitsHealth && (previousHealth - healthLost) <= 0;

  // Defeat of a Vehicle / Recall for Repairs - see mechanics/vehicles/vehicle-defeat.mjs's own doc comment.
  // Scoped to isDefeatedByHealthLoss (excludes Stun) since RAW's own trigger is "reaches 0 Health," which
  // Stun damage never touches.
  if (isDefeatedByHealthLoss && !wasAlreadyDefeated && (target.type == 'vehicle' || target.type == 'zord')) {
    await handleVehicleZeroHealthTransition(target);
  }

  button.disabled = true;
  const appliedKeys = message.getFlag('essence20', 'damageAppliedKeys') || [];
  await message.setFlag('essence20', 'damageAppliedKeys', [...appliedKeys, button.dataset.key]);
  ChatMessage.create({
    content: `${target.name}: ${amount}${secondaryAmount ? ` + ${secondaryAmount}` : ''} ${game.i18n.localize('E20.CheckDamageApplied')}`,
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
// enricher already gives a flat Difficulty value (util/enrichers.mjs). Unlike that enricher,
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
// (mechanics/world/token-sync.mjs) - unset when the actor has no color chosen (or there's no actor at all,
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

/**
 * Runs each renderChatMessageHTML decorator (crit highlighting, every post-roll button, the check
 * card listeners...) on its own, so one that throws - or rejects, for an async one - is logged and
 * the rest still run. Called in sequence they shared one fate: an error in, say, Spite's button
 * stopped High-Density's and everything after it from ever being added to that card.
 * @param {Array<Function>} decorators   Each called as decorator(message, html).
 * @param {ChatMessage} message
 * @param {HTMLElement} html
 */
export function runChatDecorators(decorators, message, html) {
  for (const decorator of decorators) {
    const report = (error) => console.error(
      `Essence20 | ${decorator.name || 'chat decorator'} failed on chat message ${message?.id}`, error,
    );
    try {
      const result = decorator(message, html);
      if (typeof result?.then == 'function') {
        result.catch(report);
      }
    } catch (error) {
      report(error);
    }
  }
}
