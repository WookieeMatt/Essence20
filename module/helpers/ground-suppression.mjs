import { getAllNearbyTokens } from "./allies.mjs";
import { actorHasPerk, bankPendingBonus, getPendingBonus } from "./perks.mjs";

/**
 * Ground Suppression (Quartermaster's Guide to Gear, Strafer Focus, Vanguard, 3rd level, p.28):
 * "As a Standard action while your vehicle is in motion, you can select an area with a maximum
 * length equal to the vehicle's Aerial Movement and a width found on Table 1-16. You must fly
 * over this part of the battlefield in order to target it. Make a Driving Skill Test against the
 * Toughness or Evasion of all targets—friend and foe—in the strafing area. Success reduces the
 * target's Toughness and Evasion by 5 until the start of your next turn."
 *
 * The length/width geometry (Table 1-16) is dropped in favor of a plain radius scan, this
 * project's usual "drop the geometry, keep the target-based mechanic" approximation - "vehicle in
 * motion" is left to the player to self-police (no in-flight-vs-landed state tracked anywhere).
 *
 * "Friend and foe" is the first AoE in this whole project to deliberately hit BOTH dispositions
 * at once - getAllNearbyTokens (helpers/allies.mjs) is the new disposition-agnostic sibling of
 * getNearbyAllyTokens/getNearbyEnemyTokens this needed. "Against the Toughness or Evasion" reads
 * as one Defense type picked for the whole volley (the same single-defenseType-for-the-whole-AoE
 * shape Absolute Menace/Elemental Storm already establish), not a per-target choice - picked up
 * front via pickGroundSuppressionDefenseType(), the same single-<select> DialogV2 shape as
 * pickElementalStormCondition.
 *
 * "Reduces the target's Toughness AND Evasion by 5" (both, regardless of which was rolled against)
 * is a genuinely new debuff SHAPE for this project: every prior target-difficulty modifier only
 * ever ADDS to what a future attacker must beat (Just The Facts/Trustworthy/Stronger Together) -
 * this is the first one to SUBTRACT, i.e. make the target easier for anyone else to hit too, not
 * just the caster. Banked on the target itself (getGroundSuppressionReduction, read directly in
 * dice.mjs's own per-target difficulty computation) rather than granted to the caster - "until the
 * start of your next turn" approximated at round granularity like every other such window in this
 * project (checked against the round it was banked in, same as Shining Leader/Team Focus).
 */
const RADIUS_FEET = 60; // no printed radius to reuse - a generic "nearby" scan, matching this
// project's own fallback radius for AoE Perks with dropped geometry (e.g. Absolute Menace's own
// "10ft" default before RAW's real radius is known - picked as a reasonable "battlefield-local"
// range for a vehicle strafing run).
const PENDING_FLAG = 'pendingGroundSuppression';

// Danger Close (Quartermaster's Guide to Gear, Strafer Focus, 17th level, p.28): "you can exclude
// a number of targets equal to your Smarts Essence from the area of your explosive weapons and
// Ground Suppression." The Ground Suppression half is concretely checkable - this scan already
// builds its own target list (getAllNearbyTokens) rather than relying on the player's own pre-
// existing canvas targets, so "exclude a target" is read as "the player pre-targets whichever
// tokens (of the ones about to be caught) they want spared, up to their Smarts score" - the same
// "auto-detect off the player's own current targeting" idiom Mark Target/Fight Me! already use,
// rather than a new picker dialog. The explosive-weapons AoE half is NOT built - that scan
// (helpers/aoe-targeting.mjs#getTokensInShape) is shared by every templated attack in this
// codebase, and adding a per-Perk exclusion count to that generic pipeline (rather than this one
// self-contained Focus Perk's own target list) is a far larger change than this single Perk
// warrants; flagged, not built.
const DANGER_CLOSE_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.FpwnwD7Pnl6uvLTZ";

/**
 * Prompts for which Defense (Toughness or Evasion) this volley is rolled against.
 * @returns {Promise<String|null>}   'toughness'/'evasion', or null if cancelled.
 */
export async function pickGroundSuppressionDefenseType() {
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.GroundSuppressionPickTitle') },
    classes: ["window-app", "e20-window"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.GroundSuppressionPickLabel')
    }</label><select name="defenseType">
      <option value="toughness">${game.i18n.localize('E20.DefenseToughness')}</option>
      <option value="evasion">${game.i18n.localize('E20.DefenseEvasion')}</option>
    </select></div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => button.form.elements.defenseType.value,
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  return chosen && chosen != 'cancel' ? chosen : null;
}

/**
 * Targets every nearby token (allies and enemies alike) and kicks off the Driving-vs-chosen-
 * Defense Skill Test, once a Defense type has actually been chosen. Returns false (having spent
 * nothing yet) if the player cancels the picker.
 * @param {Actor} actor
 * @returns {Promise<Boolean>}
 */
export async function activateGroundSuppression(actor) {
  const defenseType = await pickGroundSuppressionDefenseType();
  if (!defenseType) {
    return false;
  }

  let nearby = getAllNearbyTokens(actor, RADIUS_FEET);

  // Danger Close - see DANGER_CLOSE_ID's own comment above. The player's own current targets (set
  // BEFORE clicking the Use button) mark who to spare, capped at the actor's Smarts Essence score.
  if (actorHasPerk(actor, DANGER_CLOSE_ID)) {
    const excludedIds = new Set(
      Array.from(game.user.targets ?? []).slice(0, actor.system.essences?.smarts?.value ?? 0).map(token => token.id),
    );
    nearby = nearby.filter(token => !excludedIds.has(token.id));
  }

  canvas.tokens.setTargets(nearby.map(token => token.id));

  await actor._dice.rollSkill({
    skill: 'driving',
    essence: 'speed',
    shiftUp: 0,
    shiftDown: 0,
    defenseType,
    isGroundSuppression: true,
  }, actor);

  return true;
}

/**
 * Banks the -5 Toughness/Evasion reduction on a just-hit target.
 * @param {Actor} targetActor
 */
export async function markGroundSuppressed(targetActor) {
  await bankPendingBonus(targetActor, PENDING_FLAG, { reduction: 5 });
}

/**
 * How much to reduce the given target's Toughness/Evasion by right now, per a still-active Ground
 * Suppression mark - 0 if none is banked, it's from a stale (prior) combat, or the round has
 * already moved on ("until the start of your next turn" approximated at round granularity, same
 * as Team Focus/Shining Leader's own round-scoped windows - checked against the CURRENT round
 * only, not the +1 grace those windows allow, since this one expires at the START of the very
 * next round rather than lasting through it).
 * @param {Actor} targetActor
 * @returns {Number}
 */
export function getGroundSuppressionReduction(targetActor) {
  const pending = getPendingBonus(targetActor, PENDING_FLAG);
  if (!pending || !game.combat || pending.round != game.combat.round) {
    return 0;
  }

  return pending.reduction;
}
