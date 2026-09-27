import { actorHasPerk, bankPendingBonus, getPendingBonus, hasUsedThisEncounter, markUsedThisEncounter } from "./perks.mjs";

/**
 * Resourceful (Transformers CRB, Scout, 12th level, p.85): "before rolling for Initiative, choose
 * one of the following benefits, which last until the end of Combat (where applicable): Roll
 * Initiative Skill Tests with an Edge; Gain 1 Temporary Health; +10ft to one type of Movement; Act
 * normally if you would be surprised; An ally who can hear you gains the benefits of Mark Target
 * for the creature you designated."
 *
 * Only the first two benefits are built - a Use button (once/combat; "before rolling for
 * Initiative" is left unenforced, same narrative-timing looseness this project already accepts
 * elsewhere, e.g. Thesis) offering a 2-option picker. The other three are NOT built:
 * - "+10ft to one type of Movement" would need a real "which Movement type, lasting until end of
 *   Combat" bank threaded into actor.mjs's own movement preparation, a bigger surface than a
 *   dice.mjs roll-time check touches.
 * - "Act normally if you would be surprised" has no "would be surprised" check anywhere in this
 *   codebase to intercept (Surprise itself is the `statuses.has('surprised')` status, applied
 *   before any Perk could react to it).
 * - The Mark Target share needs a second actor (the ally) as the designee, which
 *   helpers/mark-target.mjs's own single-flag-per-actor shape doesn't distinguish from that
 *   actor's own independently-designated target.
 *
 * Extremely Resourceful (Transformers CRB, Scout, 16th level, p.85): "choose two of Resourceful's
 * benefits instead of one." Of the 2 benefits actually built above (of RAW's 5), "choose two"
 * degenerates to "get both" - so Extremely Resourceful just grants both the Edge-on-Initiative and
 * the Temporary Health outright, skipping the picker dialog entirely.
 */
export const RESOURCEFUL_ID = "Compendium.essence20.tf_crb.Item.aE2gaLPtMZYkeZ6D";
export const EXTREMELY_RESOURCEFUL_ID = "Compendium.essence20.tf_crb.Item.1mTCwsgnscEreieW";
const RESOURCEFUL_ENCOUNTER_FLAG = 'resourcefulUsedThisEncounter';
const PENDING_RESOURCEFUL_EDGE_FLAG = 'pendingResourcefulEdge';

/**
 * @returns {Promise<String|null>}   'edge', 'temphealth', or null if cancelled.
 */
async function pickResourcefulBenefit() {
  const options = [
    ['edge', game.i18n.localize('E20.ResourcefulBenefitEdge')],
    ['temphealth', game.i18n.localize('E20.ResourcefulBenefitTempHealth')],
  ];
  const benefitOptions = options.map(([value, label]) => `<option value="${value}">${label}</option>`).join('');
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.ResourcefulPickBenefitTitle') },
    classes: ["window-app"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.ResourcefulPickBenefitLabel')
    }</label><select name="benefit">${benefitOptions}</select></div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => button.form.elements.benefit.value,
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  return chosen && chosen != 'cancel' ? chosen : null;
}

/**
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function canUseResourceful(actor) {
  return !hasUsedThisEncounter(actor, RESOURCEFUL_ENCOUNTER_FLAG);
}

/**
 * @param {Actor} actor
 * @returns {Promise<Boolean>}   Whether a benefit was actually chosen and applied.
 */
export async function activateResourceful(actor) {
  // Extremely Resourceful - see EXTREMELY_RESOURCEFUL_ID's own comment above. Both built benefits,
  // no picker needed.
  if (actorHasPerk(actor, EXTREMELY_RESOURCEFUL_ID)) {
    await bankPendingBonus(actor, PENDING_RESOURCEFUL_EDGE_FLAG, {});
    await actor.update({ 'system.health.bonus': (actor.system.health.bonus ?? 0) + 1 });
    await markUsedThisEncounter(actor, RESOURCEFUL_ENCOUNTER_FLAG);
    return true;
  }

  const benefit = await pickResourcefulBenefit();
  if (!benefit) {
    return false;
  }

  if (benefit == 'edge') {
    // bankPendingBonus stamps the CURRENT combat's id, and getPendingBonus's own read only ever
    // checks that id matches - no round check - so this naturally lasts the whole combat (RAW's
    // "until the end of Combat") and self-expires the moment a new one starts, with no explicit
    // per-encounter reset needed (unlike a plain setFlag boolean, which would stay stale true
    // forever once chosen, wrongly reporting active in a LATER combat where temphealth was
    // chosen instead).
    await bankPendingBonus(actor, PENDING_RESOURCEFUL_EDGE_FLAG, {});
  } else if (benefit == 'temphealth') {
    await actor.update({ 'system.health.bonus': (actor.system.health.bonus ?? 0) + 1 });
  }

  await markUsedThisEncounter(actor, RESOURCEFUL_ENCOUNTER_FLAG);
  return true;
}

/**
 * Whether the actor's banked Edge-on-Initiative is currently active - lasts until end of Combat,
 * via bankPendingBonus's own combatId stamp (see activateResourceful's own comment), not
 * explicitly cleared since Initiative is typically rolled only once per combat.
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function isResourcefulEdgeActive(actor) {
  return !!getPendingBonus(actor, PENDING_RESOURCEFUL_EDGE_FLAG);
}
