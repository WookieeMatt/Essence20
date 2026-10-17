import { E20 } from "../../util/config.mjs";
import { canSpendForActor, spendForActor } from "../resources/story-points.mjs";

/**
 * Space Vessel Conditions (Across the Stars, "Special Vessel Damage and Conditions," p.25-26).
 * All eight are ordinary statuses in E20.statusEffects; this file adds what the book layers on top:
 *
 * - A stack count for the six that can be suffered "a second time" (STACKING_VESSEL_CONDITIONS),
 *   kept on the status ActiveEffect itself as `flags.essence20.stacks` (absent = 1) and shown as a
 *   "×N" name suffix, on the token HUD's tooltip and as a badge on the token (canvas/token.mjs).
 *   Applying one the vessel already has adds a stack (Essence20Actor#toggleStatusEffect with
 *   active:true, or a left-click on the HUD); a right-click on the HUD takes one away.
 * - What the stacks do: Compromised lowers max Health (actor.mjs#_prepareHealth) and Defeats at 0;
 *   Sputtering/Spun-Out Immobilize at 2 (syncVesselConditionConsequences); Sputtering makes
 *   non-Ground Movement cost as Rough Terrain (mechanics/world/rough-terrain.mjs); Unstable penalizes and
 *   then disables hardpoint weapons (dice.mjs); Decompressed/Leaking change the interior
 *   environment for anyone aboard (mechanics/world/environment.mjs#getVesselInteriorEnvironment). Blanked
 *   and Jammed stay markers - there's no sensor or communications model for them to switch off.
 * - Zords are special: Vessel Conditions normally can't be inflicted on them -
 *   blocked, with a GM override (shouldBlockZordVesselCondition).
 * - The ↓2 "attack a vessel system" option (canTargetVesselSystem) and its Critical Effect picker.
 * - Repairing a Space Vessel Condition (openVesselRepairDialog / resolveVesselRepair).
 */

export const VESSEL_CONDITIONS = ["blanked", "compromised", "decompressed", "jammed", "leaking", "spunOut", "sputtering", "unstable"];
export const STACKING_VESSEL_CONDITIONS = ["compromised", "decompressed", "leaking", "spunOut", "sputtering", "unstable"];

// Spun-Out / Sputtering: a second stack leaves the vessel Immobilized until repaired.
export const IMMOBILIZING_STACKS = 2;
const IMMOBILIZING_CONDITIONS = ["spunOut", "sputtering"];
// Unstable: ↓1 on hardpoint weapons, ↓2 at the second stack, and the third stack disables them.
export const UNSTABLE_INOPERABLE_STACKS = 3;

// Repair Difficulties (Table 1-14).
export const REPAIR_DIF_INSIDE = 12;
export const REPAIR_DIF_SPACEWALK = 15;
export const REPAIR_STABLE_ORBIT_MODIFIER = -3;
export const REPAIR_DOCKED_MODIFIER = -5;

// Attacking Space Vessel Systems: the declared attempt's own penalty, and the requirements.
export const TARGET_VESSEL_SYSTEM_SHIFT_DOWN = 2;
const MIN_TARGET_VESSEL_DAMAGE = 2;

const AUTO_IMMOBILIZED_FLAG = "autoImmobilizedFromVessel";
// A delta that removes every stack at once (repairs). A finite number, since it may cross the
// socket as JSON, where -Infinity would arrive as null.
export const CLEAR_ALL_STACKS = -1000;

/**
 * @param {String} statusId
 * @returns {Boolean}
 */
export function isVesselCondition(statusId) {
  return VESSEL_CONDITIONS.includes(statusId);
}

/**
 * @param {String} statusId
 * @returns {Boolean}
 */
export function isStackingVesselCondition(statusId) {
  return STACKING_VESSEL_CONDITIONS.includes(statusId);
}

/**
 * The status ActiveEffect carrying a given status on an actor.
 * @param {Actor} actor
 * @param {String} statusId
 * @returns {?ActiveEffect}
 */
function findStatusEffect(actor, statusId) {
  return actor?.effects?.find?.(effect => effect.statuses?.has?.(statusId)) ?? null;
}

/**
 * How many stacks one status ActiveEffect carries - 1 when it has no counter yet (every status
 * applied before this existed, or by core's own toggle).
 * @param {?ActiveEffect} effect
 * @returns {Number}
 */
export function getEffectStacks(effect) {
  if (!effect) {
    return 0;
  }

  const stacks = parseInt(effect.flags?.essence20?.stacks);
  return stacks > 0 ? stacks : 1;
}

/**
 * How many times an actor currently has a Space Vessel Condition - 0 when it doesn't have it.
 * @param {Actor} actor
 * @param {String} statusId
 * @returns {Number}
 */
export function getVesselConditionStacks(actor, statusId) {
  if (!actor?.statuses?.has?.(statusId)) {
    return 0;
  }

  return getEffectStacks(findStatusEffect(actor, statusId));
}

/**
 * The stack count after adding delta, never below 0.
 * @param {Number} current
 * @param {Number} delta
 * @returns {Number}
 */
export function nextStackCount(current, delta) {
  return Math.max(0, (current || 0) + delta);
}

/**
 * A status's display name with its stack count - "Compromised ×2" - unchanged for a single stack.
 * @param {String} baseName
 * @param {Number} stacks
 * @returns {String}
 */
export function stackedName(baseName, stacks) {
  return stacks > 1 ? `${baseName} ×${stacks}` : baseName;
}

/**
 * The localized base name of a status.
 * @param {String} statusId
 * @returns {String}
 * @private
 */
function statusName(statusId) {
  const status = (globalThis.CONFIG?.statusEffects ?? E20.statusEffects).find(s => s.id == statusId);
  return game.i18n.localize(status?.name ?? statusId);
}

/**
 * Adds or removes stacks of a Space Vessel Condition. A non-stacking one is simply toggled on or
 * off. Relayed to the active GM when this user can't edit the vessel (an attacker imposing a
 * Condition on an enemy ship, most often).
 * @param {Actor} actor
 * @param {String} statusId
 * @param {Number} delta   +1 to add a stack, -1 to remove one, CLEAR_ALL_STACKS to clear it.
 * @returns {Promise<Number>}   The new stack count (the requested one, when relayed).
 */
export async function changeVesselConditionStacks(actor, statusId, delta) {
  if (!actor || !isVesselCondition(statusId)) {
    return 0;
  }

  const current = getVesselConditionStacks(actor, statusId);
  const next = isStackingVesselCondition(statusId) ? nextStackCount(current, delta) : (delta > 0 ? 1 : 0);
  if (next == current) {
    return current;
  }

  if (!actor.isOwner) {
    game.socket.emit("system.essence20", { action: "vesselConditionStacks", actorUuid: actor.uuid, statusId, delta });
    return next;
  }

  if (next == 0) {
    await actor.toggleStatusEffect(statusId, { active: false });
  } else {
    if (current == 0) {
      await actor.toggleStatusEffect(statusId, { active: true });
    }

    const effect = findStatusEffect(actor, statusId);
    if (effect && next > 1) {
      await effect.update({ "flags.essence20.stacks": next, name: stackedName(statusName(statusId), next) });
    } else if (effect && current > 1) {
      await effect.update({ "flags.essence20.stacks": next, name: statusName(statusId) });
    }
  }

  await syncVesselConditionConsequences(actor);
  refreshTokenEffects(actor);
  return next;
}

/**
 * GM-side handler for changeVesselConditionStacks' socket relay. Only the active GM acts.
 * @param {{actorUuid: String, statusId: String, delta: Number}} data
 * @returns {Promise<void>}
 */
export async function handleVesselConditionStacksRequest(data) {
  if (!game.user?.isActiveGM) {
    return;
  }

  const actor = await fromUuid(data.actorUuid);
  await changeVesselConditionStacks(actor, data.statusId, data.delta);
}

/**
 * Keeps the Conditions that follow from a vessel's stacks in step: Immobilized while Spun-Out or
 * Sputtering is at IMMOBILIZING_STACKS (only an Immobilized this added is ever removed again), and
 * Defeated once Compromised has taken maximum Health to 0 ("no longer space-worthy and is
 * Defeated"). Called after every stack change and from the ActiveEffect hooks in essence20.mjs,
 * so core's own HUD toggle is covered too.
 * @param {Actor} actor
 * @returns {Promise<void>}
 */
export function syncVesselConditionConsequences(actor) {
  if (!actor?.isOwner || !actor.effects) {
    return Promise.resolve();
  }

  // Serialized per actor: the explicit call after a stack change and the ActiveEffect hooks that
  // same change fires can overlap, and two concurrent passes would both create Immobilized.
  const run = () => _syncVesselConditionConsequences(actor);
  actor._e20VesselSync = (actor._e20VesselSync ?? Promise.resolve()).then(run, run);
  return actor._e20VesselSync;
}

/**
 * syncVesselConditionConsequences' own pass.
 * @param {Actor} actor
 * @returns {Promise<void>}
 * @private
 */
async function _syncVesselConditionConsequences(actor) {

  const shouldBeImmobilized = IMMOBILIZING_CONDITIONS
    .some(statusId => getVesselConditionStacks(actor, statusId) >= IMMOBILIZING_STACKS);
  const immobilized = findStatusEffect(actor, "immobilized");
  if (shouldBeImmobilized && !immobilized) {
    const effectData = await ActiveEffect.implementation.fromStatusEffect("immobilized");
    effectData.updateSource({ [`flags.essence20.${AUTO_IMMOBILIZED_FLAG}`]: true });
    await actor.createEmbeddedDocuments("ActiveEffect", [effectData]);
  } else if (!shouldBeImmobilized && immobilized?.getFlag?.("essence20", AUTO_IMMOBILIZED_FLAG)) {
    await immobilized.delete();
  }

  if (getVesselConditionStacks(actor, "compromised") && actor.system?.health?.max <= 0
    && !actor.statuses?.has?.("defeated")) {
    await actor.toggleStatusEffect("defeated", { active: true });
  }
}

/**
 * Redraws the status icons on every token of this actor, so the stack badge follows the count.
 * @param {Actor} actor
 * @private
 */
function refreshTokenEffects(actor) {
  for (const token of actor.getActiveTokens?.() ?? []) {
    token.renderFlags?.set?.({ redrawEffects: true });
  }
}

/**
 * Whether an actor is a Zord in any form ("Zords are Special... Zords in all forms") - a Zord, or
 * a Megaform that isn't a Transformers Combiner.
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function isZordLike(actor) {
  return actor?.type == "zord"
    || (actor?.type == "megaform" && !actor.system?.subtype?.includes?.("megaformCombiner"));
}

/**
 * Vessel Conditions don't go on Zords barring special circumstances (Across the Stars p.25) - true when a status about to be created on a Zord is a Space Vessel Condition
 * and nobody chose to override it (the GM's HUD confirmation sets `_e20ZordVesselOverride` for the
 * duration of that one application).
 * @param {Actor} actor
 * @param {Iterable<String>} statusIds
 * @returns {Boolean}
 */
export function shouldBlockZordVesselCondition(actor, statusIds) {
  if (!isZordLike(actor) || actor._e20ZordVesselOverride) {
    return false;
  }

  return [...(statusIds ?? [])].some(isVesselCondition);
}

/**
 * Unstable's penalty on this vessel's hardpoint weapons: ↓1, ↓2 from the second stack.
 * @param {Actor} actor
 * @returns {Number}
 */
export function getUnstablePenalty(actor) {
  return Math.min(getVesselConditionStacks(actor, "unstable"), 2);
}

/**
 * Whether Unstable has made this vessel's hardpoint weapons inoperable (third stack).
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function areHardpointWeaponsInoperable(actor) {
  return getVesselConditionStacks(actor, "unstable") >= UNSTABLE_INOPERABLE_STACKS;
}

/**
 * The vessel (a Vehicle) this actor is aboard, as crew or passenger - null when none. Zords are
 * skipped: they never carry these Conditions.
 * @param {?Actor} actor
 * @returns {?Actor}
 */
export function findVesselAboard(actor) {
  const actors = globalThis.game?.actors;
  if (!actor?.uuid || typeof actors?.[Symbol.iterator] != "function") {
    return null;
  }

  for (const candidate of actors) {
    if (candidate.type != "vehicle") {
      continue;
    }

    if (Object.values(candidate.system?.actors ?? {}).some(crew => crew?.uuid == actor.uuid)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Whether an attack may take the ↓2 to target a vessel system ("Attacking Space Vessel Systems,"
 * p.25). Checks every requirement the data can answer; "within Reach or normal Range" and "cannot
 * be a Superstructure" (no Superstructure size or trait exists in this system) are left to the
 * player.
 * @param {Object} params
 * @param {Item} params.item   The weaponEffect being rolled.
 * @param {String} params.attackerShift   The attacker's shift in the rolled Skill.
 * @param {Array<Actor>} params.targets   The actors currently targeted.
 * @returns {Boolean}
 */
export function canTargetVesselSystem({ item, attackerShift, targets }) {
  if (item?.type != "weaponEffect" || item.system?.shape || (item.system?.numTargets ?? 1) > 1) {
    return false;
  }

  if ((item.system?.damageValue ?? 0) < MIN_TARGET_VESSEL_DAMAGE || targets?.length != 1) {
    return false;
  }

  // "At least +d4 or higher" - skillShiftList runs best to worst.
  const shiftIndex = E20.skillShiftList.indexOf(attackerShift);
  if (shiftIndex < 0 || shiftIndex > E20.skillShiftList.indexOf("d4")) {
    return false;
  }

  return isVesselSystemTarget(targets[0]);
}

/**
 * The target has to be a Huge-or-bigger aeronautical or zero-G vehicle - a Vehicle (never a
 * Zord) with an air/aerospace/zero-G trait or Aerial Movement, Huge or larger.
 * @param {Actor} target
 * @returns {Boolean}
 */
export function isVesselSystemTarget(target) {
  if (target?.type != "vehicle") {
    return false;
  }

  const sizes = Object.keys(E20.actorSizes);
  if (sizes.indexOf(target.system?.size) < sizes.indexOf("huge")) {
    return false;
  }

  const traits = target.system?.traits ?? {};
  return !!(traits.air || traits.aerospace || traits.zeroG || target.system?.movement?.aerial?.base > 0);
}

/**
 * Asks which Space Vessel Condition to impose - the targeted-system attack's Critical Effect, and
 * the extra Conditions a well-rolled repair clears.
 * @param {String} titleKey
 * @param {Array<String>} [choices]   Status ids to offer (default: all eight).
 * @returns {Promise<?String>}
 */
export async function pickVesselCondition(titleKey, choices = VESSEL_CONDITIONS) {
  if (!choices.length) {
    return null;
  }

  const options = choices.map(id => `<option value="${id}">${statusName(id)}</option>`).join("");
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize(titleKey) },
    classes: ["window-app", "e20-window"],
    content: `<div class="form-group"><label>${game.i18n.localize("E20.VesselConditionPickLabel")}</label>`
      + `<select name="condition">${options}</select></div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize("E20.DialogConfirmButton"),
        action: "confirm",
        callback: (event, button) => button.form.elements.condition.value,
      },
      { label: game.i18n.localize("E20.DialogCancelButton"), action: "cancel" },
    ],
  });

  return chosen && chosen != "cancel" ? chosen : null;
}

/**
 * The targeted-system attack's Critical Effect: "Impose Space Vessel Condition of attacker's
 * choice on Target until repaired." Called from dice.mjs's post-roll processing for each Critical
 * Success against a target.
 * @param {Actor} attacker
 * @param {Actor} target
 * @returns {Promise<?String>}   The Condition imposed.
 */
export async function imposeVesselConditionOnCrit(attacker, target) {
  const statusId = await pickVesselCondition("E20.VesselConditionCritTitle");
  if (!statusId) {
    return null;
  }

  await changeVesselConditionStacks(target, statusId, 1);
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: attacker }),
    content: game.i18n.format("E20.VesselConditionCritImposed", { target: target.name, condition: statusName(statusId) }),
  });
  return statusId;
}

/**
 * Repair DIF from Table 1-14: DIF 12 inside the vessel or 15 on a spacewalk, -3 in a stable orbit,
 * -5 docked at a repair facility.
 * @param {Object} params
 * @param {Boolean} params.spacewalk
 * @param {Boolean} params.stableOrbit
 * @param {Boolean} params.docked
 * @returns {Number}
 */
export function getRepairDifficulty({ spacewalk = false, stableOrbit = false, docked = false } = {}) {
  return (spacewalk ? REPAIR_DIF_SPACEWALK : REPAIR_DIF_INSIDE)
    + (stableOrbit ? REPAIR_STABLE_ORBIT_MODIFIER : 0)
    + (docked ? REPAIR_DOCKED_MODIFIER : 0);
}

/**
 * How many Condition types a repair clears: one on a success, plus one per additional Degree of
 * Success and one more for a Critical Success (each extra degree, or a Critical, repairs one more
 * Condition).
 * @param {{success: Boolean, multiplier: Number, isCrit: Boolean}} outcome
 * @returns {Number}
 */
export function countRepairedConditions({ success, multiplier = 0, isCrit = false }) {
  if (!success) {
    return 0;
  }

  return Math.max(1, multiplier) + (isCrit ? 1 : 0);
}

/**
 * The Space Vessel Conditions a vessel currently has.
 * @param {Actor} vessel
 * @returns {Array<String>}
 */
export function getActiveVesselConditions(vessel) {
  return VESSEL_CONDITIONS.filter(statusId => vessel?.statuses?.has?.(statusId));
}

/**
 * Whether an actor has any Technology Specialization - "the repairing character(s) must be
 * relevantly Specialized". Which Specialization is relevant to this ship is the table's call.
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function hasTechnologySpecialization(actor) {
  const technology = actor?.system?.skills?.technology;
  return !!technology?.isSpecialized || Object.keys(technology?.specializations ?? {}).length > 0;
}

/**
 * The vessel sheet's "Repair Condition" action: pick who repairs, which Condition, and where
 * (Table 1-14), then roll Technology against that DIF through the normal roll pipeline.
 * dice.mjs's post-roll processing calls resolveVesselRepair with the outcome.
 * @param {Actor} vessel
 * @returns {Promise<void>}
 */
export async function openVesselRepairDialog(vessel) {
  const conditions = getActiveVesselConditions(vessel);
  if (!conditions.length) {
    ui.notifications.info(game.i18n.format("E20.VesselRepairNothing", { vessel: vessel.name }));
    return;
  }

  const repairers = getRepairCandidates(vessel);
  if (!repairers.length) {
    ui.notifications.warn(game.i18n.localize("E20.VesselRepairNoRepairer"));
    return;
  }

  const repairerOptions = repairers.map(actor => `<option value="${actor.uuid}">${actor.name}</option>`).join("");
  const conditionOptions = conditions.map(id => `<option value="${id}">${statusName(id)}</option>`).join("");
  const choice = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.format("E20.VesselRepairTitle", { vessel: vessel.name }) },
    classes: ["window-app", "e20-window"],
    // A fixed width, so the hint at the bottom wraps instead of stretching the dialog to its length.
    position: { width: 480 },
    content: `
      <div class="form-group"><label>${game.i18n.localize("E20.VesselRepairRepairer")}</label>
        <select name="repairer">${repairerOptions}</select></div>
      <div class="form-group"><label>${game.i18n.localize("E20.VesselRepairCondition")}</label>
        <select name="condition">${conditionOptions}</select></div>
      <div class="form-group"><label>${game.i18n.localize("E20.VesselRepairLocation")}</label>
        <select name="location">
          <option value="inside">${game.i18n.format("E20.VesselRepairInside", { dif: REPAIR_DIF_INSIDE })}</option>
          <option value="spacewalk">${game.i18n.format("E20.VesselRepairSpacewalk", { dif: REPAIR_DIF_SPACEWALK })}</option>
        </select></div>
      <div class="form-group"><label>${game.i18n.format("E20.VesselRepairStableOrbit", { modifier: REPAIR_STABLE_ORBIT_MODIFIER })}</label>
        <input type="checkbox" name="stableOrbit"></div>
      <div class="form-group"><label>${game.i18n.format("E20.VesselRepairDocked", { modifier: REPAIR_DOCKED_MODIFIER })}</label>
        <input type="checkbox" name="docked"></div>
      <p class="hint">${game.i18n.localize("E20.VesselRepairHint")}</p>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize("E20.VesselRepairRoll"),
        action: "roll",
        callback: (event, button) => {
          const form = button.form.elements;
          return {
            repairerUuid: form.repairer.value,
            condition: form.condition.value,
            spacewalk: form.location.value == "spacewalk",
            stableOrbit: form.stableOrbit.checked,
            docked: form.docked.checked,
          };
        },
      },
      { label: game.i18n.localize("E20.DialogCancelButton"), action: "cancel" },
    ],
  });
  if (!choice || choice == "cancel") {
    return;
  }

  const repairer = repairers.find(actor => actor.uuid == choice.repairerUuid);
  if (!repairer || !(await ensureRepairSpecialized(repairer))) {
    return;
  }

  // Repairing is a Standard action; Quick Fix makes it a Free one (mechanics/actions/action-perks.mjs).
  const { spend } = await import("../actions/action-economy.mjs");
  const paid = await spend(repairer, 'standard', { source: game.i18n.localize('E20.VesselRepair'), context: { kind: 'vehicleRepair' } });
  if (paid.blocked) {
    return;
  }

  await repairer._dice.rollSkill({
    skill: "technology",
    shiftUp: 0,
    shiftDown: 0,
    dif: String(getRepairDifficulty(choice)),
    isSpecialized: true,
    repairVesselUuid: vessel.uuid,
    repairVesselCondition: choice.condition,
  }, repairer);
}

/**
 * Who this user can have attempt a repair: the vessel's own crew and passengers this user owns, their
 * assigned character, the actors of any tokens they have selected, and - for a GM, who has no
 * assigned character - every player character with a token on the current scene.
 * @param {Actor} vessel
 * @returns {Array<Actor>}
 */
export function getRepairCandidates(vessel) {
  const candidates = Object.values(vessel.system?.actors ?? {})
    .map(crew => fromUuidSync(crew.uuid))
    .filter(actor => actor?.isOwner);
  const add = (actor) => {
    if (actor && actor !== vessel && actor.isOwner && !candidates.includes(actor)) {
      candidates.push(actor);
    }
  };

  add(game.user?.character);
  for (const token of canvas?.tokens?.controlled ?? []) {
    add(token.actor);
  }

  if (game.user?.isGM) {
    for (const token of canvas?.scene?.tokens ?? []) {
      if (token.actor?.type == 'playerCharacter') {
        add(token.actor);
      }
    }
  }

  return candidates.filter(actor => actor?._dice);
}

/**
 * Repairers need a relevant Specialization, which a Story Point can supply temporarily - warns when the repairer has
 * no Technology Specialization and offers the Story Point.
 * @param {Actor} repairer
 * @returns {Promise<Boolean>}   Whether the repair may go ahead.
 */
export async function ensureRepairSpecialized(repairer) {
  if (hasTechnologySpecialization(repairer)) {
    return true;
  }

  if (!canSpendForActor(repairer)) {
    ui.notifications.warn(game.i18n.format("E20.VesselRepairNotSpecialized", { name: repairer.name }));
    return false;
  }

  const confirmed = await foundry.applications.api.DialogV2.confirm({
    window: { title: game.i18n.localize("E20.VesselRepairSpecializedTitle") },
    content: `<p>${game.i18n.format("E20.VesselRepairSpendStoryPoint", { name: repairer.name })}</p>`,
    rejectClose: false,
  });
  if (!confirmed) {
    return false;
  }

  await spendForActor(repairer, 1);
  return true;
}

/**
 * Applies a repair roll's outcome: a success clears every stack of the chosen Condition and each
 * further Degree of Success (or a Critical Success) one more Condition of the repairer's choice; a
 * Fumble "inflicts the Compromised Condition on the vessel instead."
 * @param {Actor} repairer
 * @param {Object} checkContext   Carries repairVesselUuid and repairVesselCondition.
 * @param {{success: Boolean, multiplier: Number, isCrit: Boolean, isFumble: Boolean}} outcome
 * @returns {Promise<Array<String>>}   The Conditions cleared.
 */
export async function resolveVesselRepair(repairer, checkContext, outcome) {
  const vessel = await fromUuid(checkContext.repairVesselUuid);
  if (!vessel) {
    return [];
  }

  const speaker = ChatMessage.getSpeaker({ actor: repairer });
  if (outcome.isFumble) {
    await changeVesselConditionStacks(vessel, "compromised", 1);
    await ChatMessage.create({ speaker, content: game.i18n.format("E20.VesselRepairFumble", { vessel: vessel.name }) });
    return [];
  }

  let remaining = countRepairedConditions(outcome);
  const cleared = [];
  let next = checkContext.repairVesselCondition;
  while (remaining > 0 && next) {
    await changeVesselConditionStacks(vessel, next, CLEAR_ALL_STACKS);
    cleared.push(next);
    remaining--;

    const left = getActiveVesselConditions(vessel).filter(id => !cleared.includes(id));
    next = remaining > 0 && left.length ? await pickVesselCondition("E20.VesselRepairExtraTitle", left) : null;
  }

  await ChatMessage.create({
    speaker,
    content: cleared.length
      ? game.i18n.format("E20.VesselRepairSuccess", { vessel: vessel.name, conditions: cleared.map(statusName).join(", ") })
      : game.i18n.format("E20.VesselRepairFailure", { vessel: vessel.name }),
  });
  return cleared;
}

/**
 * Token HUD support (a renderTokenHUD hook in essence20.mjs): on a stacking vessel Condition that's
 * already active, left-click adds a stack and right-click removes one instead of core's on/off
 * toggle, and the tooltip shows the count. On a Zord, every vessel Condition asks the GM to
 * override (and is refused for a player) before core applies it.
 * @param {TokenHUD} hud
 * @param {HTMLElement} html
 */
export function decorateTokenHudVesselConditions(hud, html) {
  const actor = hud.actor ?? hud.document?.actor;
  if (!actor) {
    return;
  }

  for (const statusId of VESSEL_CONDITIONS) {
    const control = html.querySelector(`.effect-control[data-status-id="${statusId}"]`);
    if (!control) {
      continue;
    }

    const stacks = getVesselConditionStacks(actor, statusId);
    if (stacks && isStackingVesselCondition(statusId)) {
      control.dataset.tooltipText = game.i18n.format("E20.VesselConditionHudTooltip", {
        name: stackedName(statusName(statusId), stacks),
      });
    }

    // Core's HUD dispatches its left click as "click" and its right click as "auxclick" (button 2).
    const onClick = async (event) => {
      if (event.type == "auxclick" && event.button != 2) {
        return;
      }

      const active = actor.statuses?.has?.(statusId);
      const zordNeedsOverride = !active && isZordLike(actor);
      if (!zordNeedsOverride && !(active && isStackingVesselCondition(statusId))) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      if (zordNeedsOverride) {
        await applyZordVesselConditionOverride(actor, statusId);
        return;
      }

      await changeVesselConditionStacks(actor, statusId, event.type == "auxclick" ? -1 : 1);
      hud.render?.();
    };

    control.addEventListener("click", onClick, { capture: true });
    control.addEventListener("auxclick", onClick, { capture: true });
  }
}

/**
 * A Zord can only be given a vessel Condition by the GM, on confirmation.
 * @param {Actor} actor
 * @param {String} statusId
 * @returns {Promise<Boolean>}
 * @private
 */
async function applyZordVesselConditionOverride(actor, statusId) {
  if (!game.user?.isGM) {
    ui.notifications.warn(game.i18n.localize("E20.VesselConditionZordBlocked"));
    return false;
  }

  const confirmed = await foundry.applications.api.DialogV2.confirm({
    window: { title: statusName(statusId) },
    content: `<p>${game.i18n.localize("E20.VesselConditionZordOverridePrompt")}</p>`,
    rejectClose: false,
  });
  if (!confirmed) {
    return false;
  }

  actor._e20ZordVesselOverride = true;
  try {
    await actor.toggleStatusEffect(statusId, { active: true });
  } finally {
    delete actor._e20ZordVesselOverride;
  }

  return true;
}
