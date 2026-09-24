import { getEffectiveLevel } from "./combat.mjs";

/**
 * Breaking Point (Quartermaster's Guide to Gear, Disruptor Focus, Ranger, 1st level, p.23):
 * "Whenever you attack a piece of equipment with a blade or bludgeon, you can roll a Technology
 * Skill Test against a DIF equal to 10 + the vehicle's Threat Level. On a success, choose which of
 * the following details you learn: one of the vehicle's Defense scores, its current Health, a
 * Perk, a Power, or a Hang-Up. If the vehicle doesn't have the information you are looking for,
 * that still counts as the detail you learn."
 *
 * "Whenever you attack... with a blade or bludgeon" is dropped as an unenforceable narrative
 * trigger (this project's usual "trust the player to use it at the right narrative moment" idiom
 * - the same simplification Frightening Display's own two-handed-ballistic precondition already
 * uses) - dispatched as its own "Use" button instead, gated only on the target being a vehicle
 * ("a piece of equipment," the same `targetActor.type == 'vehicle'` proxy Raze and Ruin/Plate
 * Piercing already establish).
 *
 * The Skill Test itself is the first Perk in this project to use a flat numeric DIF (10 + Threat
 * Level) rather than a target's own named Defense - dice.mjs's own `dataset.dif` fallback path
 * (already exercised by Watchful Eyes, auto-detected there rather than triggered) builds exactly
 * this kind of single synthetic checkEntries entry with no targetUuid of its own, so the target's
 * uuid is threaded through separately (breakingPointTargetUuid) for the post-success picker to
 * resolve who to reveal info about.
 *
 * "Choose which of the following details" is a single-select DialogV2, offering the 4 concrete
 * options with something real to show ("Defense scores" reveals all 4 at once, matching Tech
 * Specs/Chrono File Access's own "show every Defense" idiom rather than forcing a second nested
 * pick of which one) - "a Perk"/"a Power"/"a Hang-Up" each list every matching item the target
 * actually has, or explicitly say it has none, satisfying RAW's own "that still counts as the
 * detail you learn" clause without needing a separate no-item branch.
 */

const DEFENSE_TYPES = ['toughness', 'evasion', 'willpower', 'cleverness'];

/**
 * Triggers the actual Technology-vs-flat-DIF Skill Test against whichever token is currently
 * targeted.
 * @param {Actor} actor
 */
export async function activateBreakingPoint(actor) {
  const targetActor = game.user.targets.first()?.actor;
  if (!targetActor || targetActor.type != 'vehicle') {
    ui.notifications.warn(game.i18n.localize('E20.BreakingPointNoTarget'));
    return;
  }

  await actor._dice.rollSkill({
    skill: 'technology',
    essence: 'smarts',
    shiftUp: 0,
    shiftDown: 0,
    dif: 10 + getEffectiveLevel(targetActor),
    isBreakingPoint: true,
    breakingPointTargetUuid: targetActor.uuid,
  }, actor);
}

/**
 * Prompts for which detail to learn about the target.
 * @returns {Promise<String|null>}   'defenses', 'health', 'perk', 'power', or 'hangUp' - or null
 *   if the picker was cancelled.
 */
export async function pickBreakingPointDetail() {
  const options = ['defenses', 'health', 'perk', 'power', 'hangUp']
    .map(key => `<option value="${key}">${game.i18n.localize(`E20.BreakingPointDetail_${key}`)}</option>`)
    .join('');

  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.BreakingPointPickTitle') },
    classes: ["window-app", "e20-window"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.BreakingPointPickLabel')
    }</label><select name="detail">${options}</select></div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => button.form.elements.detail.value,
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  return chosen && chosen != 'cancel' ? chosen : null;
}

/**
 * Builds the chat content revealing whichever detail was chosen about the target.
 * @param {Actor} targetActor
 * @param {String} detail   pickBreakingPointDetail()'s own return value.
 * @returns {String}
 */
export function buildBreakingPointResult(targetActor, detail) {
  if (detail == 'defenses') {
    const defenseNames = { toughness: 'Toughness', evasion: 'Evasion', willpower: 'Willpower', cleverness: 'Cleverness' };
    const defenses = DEFENSE_TYPES
      .map(type => `${defenseNames[type]} ${targetActor.system.defenses?.[type]?.total ?? 0}`)
      .join(', ');
    return game.i18n.format('E20.BreakingPointResultDefenses', { target: targetActor.name, defenses });
  }

  if (detail == 'health') {
    return game.i18n.format('E20.BreakingPointResultHealth', {
      target: targetActor.name, value: targetActor.system.health?.value ?? 0, max: targetActor.system.health?.max ?? 0,
    });
  }

  const itemTypesByDetail = { perk: 'perk', power: 'power', hangUp: 'hangUp' };
  const items = (targetActor.items?.filter(item => item.type == itemTypesByDetail[detail]) ?? []).map(item => item.name);
  return game.i18n.format('E20.BreakingPointResultItems', {
    target: targetActor.name,
    detailLabel: game.i18n.localize(`E20.BreakingPointDetail_${detail}`),
    items: items.length ? items.join(', ') : game.i18n.localize('E20.BreakingPointResultNoneKnown'),
  });
}
