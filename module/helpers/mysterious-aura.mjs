import { getNearbyAllyTokens } from "./allies.mjs";
import { getNearbyEnemyTokens } from "./enemies.mjs";
import { E20 } from "./config.mjs";

/**
 * Mysterious Aura (A Jump Through Time, White Spectrum Modification, replaces Follow Me!, p.45):
 * "As a Move action while Morphed that costs 1 Personal Power, you may emit one of the following
 * auras until you de-Morph. You may only have one aura active at a time, but you can re-activate
 * this Perk to choose a new aura":
 * - Imposing: enemies within 20ft have their Willpower/Cleverness Defenses lowered by 2.
 * - Protective: you and allies within 20ft gain +2 to one Defense of your choice.
 * - Resplendent: ranged Attacks against targets within 20ft of you suffer ↓1.
 *
 * A single {type, defenseChoice} actor flag (defenseChoice only meaningful for 'protective'),
 * cleared automatically on de-Morph the same way Boosted Vigor's own onMorph hook already clears
 * its Temporary Health. Each of the three effects is a live, non-consumed per-target/per-roll
 * check (can't touch _prepareDefenses directly - the user's own pending Health/Defense-math
 * migration) - Imposing/Protective read like Pay It Forward/Stronger Together's own "add to the
 * fully-computed difficulty" shape, just from the enemy or ally side respectively; Resplendent
 * reads like Fight Me!'s own reciprocal downshift, checked in the isAttack-gated per-target block.
 */
const AURA_FLAG = 'mysteriousAuraActive';
const AURA_RADIUS_FEET = 20;

/**
 * @param {Actor} actor
 * @returns {{type: String, defenseChoice: String|null}|null}
 */
export function getMysteriousAura(actor) {
  return actor?.getFlag?.('essence20', AURA_FLAG) ?? null;
}

/**
 * Prompts for which aura to emit (and, for Protective, which Defense to boost).
 * @returns {Promise<{type: String, defenseChoice: String|null}|null>}   null if cancelled.
 */
export async function pickMysteriousAura() {
  const defenseOptions = Object.keys(E20.defenses)
    .map(key => `<option value="${key}">${game.i18n.localize(E20.defenses[key])}</option>`).join('');
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.MysteriousAuraPickTitle') },
    classes: ["window-app", "e20-window"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.MysteriousAuraPickTypeLabel')
    }</label><select name="type">
      <option value="imposing">${game.i18n.localize('E20.MysteriousAuraImposing')}</option>
      <option value="protective">${game.i18n.localize('E20.MysteriousAuraProtective')}</option>
      <option value="resplendent">${game.i18n.localize('E20.MysteriousAuraResplendent')}</option>
    </select></div>
    <div class="form-group"><label>${
  game.i18n.localize('E20.MysteriousAuraPickDefenseLabel')
}</label><select name="defenseChoice">${defenseOptions}</select></div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => ({
          type: button.form.elements.type.value,
          defenseChoice: button.form.elements.defenseChoice.value,
        }),
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  return chosen && chosen != 'cancel' ? chosen : null;
}

/**
 * Spends 1 Personal Power and prompts for (then banks) a new active aura, replacing any prior one.
 * @param {Actor} actor
 * @returns {Promise<Boolean>}
 */
export async function activateMysteriousAura(actor) {
  if (!(actor.system.powers?.personal?.value > 0)) {
    ui.notifications.warn(game.i18n.localize('E20.RolePointsOverSpent'));
    return false;
  }

  const choice = await pickMysteriousAura();
  if (!choice) {
    return false;
  }

  await actor.update({ 'system.powers.personal.value': actor.system.powers.personal.value - 1 });
  await actor.setFlag('essence20', AURA_FLAG, choice);
  return true;
}

/**
 * Clears the active aura - called from sheet-handlers/power-ranger-handler.mjs#onMorph when
 * un-Morphing, the same "grant on Morph, clear on de-Morph" idiom Boosted Vigor already uses.
 * @param {Actor} actor
 */
export async function deactivateMysteriousAura(actor) {
  await actor.unsetFlag?.('essence20', AURA_FLAG);
}

/**
 * Imposing half: the -2 Willpower/Cleverness Defense penalty, checked from the TARGET's own side
 * (is there a nearby Imposing-aura holder who is an enemy of this target).
 * @param {Actor} targetActor
 * @param {String} defenseType
 * @returns {Number}   -2 if it applies, else 0.
 */
export function getMysteriousAuraImposingPenalty(targetActor, defenseType) {
  if (defenseType != 'willpower' && defenseType != 'cleverness') {
    return 0;
  }

  const hasImposingEnemy = getNearbyEnemyTokens(targetActor, AURA_RADIUS_FEET).some(
    token => getMysteriousAura(token.actor)?.type == 'imposing',
  );
  return hasImposingEnemy ? -2 : 0;
}

/**
 * Protective half: the +2 bonus to one chosen Defense, for the holder and nearby allies.
 * @param {Actor} targetActor
 * @param {String} defenseType
 * @returns {Number}   2 if it applies, else 0.
 */
export function getMysteriousAuraProtectiveBonus(targetActor, defenseType) {
  const ownAura = getMysteriousAura(targetActor);
  if (ownAura?.type == 'protective' && ownAura.defenseChoice == defenseType) {
    return 2;
  }

  const hasProtectiveAlly = getNearbyAllyTokens(targetActor, AURA_RADIUS_FEET).some(token => {
    const aura = getMysteriousAura(token.actor);
    return aura?.type == 'protective' && aura.defenseChoice == defenseType;
  });
  return hasProtectiveAlly ? 2 : 0;
}

/**
 * Resplendent half: ranged Attacks against a target within 20ft of the holder suffer ↓1 - checked
 * as a reciprocal downshift the same shape Fight Me!'s own per-target check already uses.
 * Approximated to same-side placements (the holder or a nearby ally of the target) - this
 * codebase has no generic "any nearby token regardless of disposition" scan to check a
 * cross-faction placement with.
 * @param {Actor} targetActor
 * @returns {Boolean}
 */
export function hasNearbyResplendentAura(targetActor) {
  if (getMysteriousAura(targetActor)?.type == 'resplendent') {
    return true;
  }

  return getNearbyAllyTokens(targetActor, AURA_RADIUS_FEET).some(
    token => getMysteriousAura(token.actor)?.type == 'resplendent',
  );
}
