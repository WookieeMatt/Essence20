import { E20 } from "./config.mjs";
import { getNearbyEnemyTokens } from "./enemies.mjs";

/**
 * Elemental Storm (Beneath the Helmet, Aqua Ranger, 10th level, p.42, replaces Power Burst):
 * "Once per scene, you can spend 1 Personal Power and a Free action to cover an area of up to 100
 * yards with bad weather. Choose either Blinded, Deafened, or Prone. Make a single Survival
 * (Weather Prediction) Skill Test against the Toughness of each enemy in the area. Those you beat
 * are afflicted with the condition until the end of their next turn."
 *
 * Same Absolute-Menace-style shape (auto-target every nearby enemy via canvas.tokens.setTargets(),
 * then trigger a real interactive roll via actor._dice.rollSkill() with a synthetic dataset) - see
 * helpers/absolute-menace.mjs's own doc comment for why "a single Skill Test against every enemy"
 * needed no new roll-comparison logic at all. The one genuinely new piece here: RAW's 3-way
 * Condition choice, made ONCE up front (unlike Menacing Glare's own per-target post-hit picker)
 * and applied uniformly to every enemy the roll beats - picked BEFORE the roll (and before
 * anything is spent, unlike Menacing Glare/Hobble's own post-hit pickers - see this function's own
 * cancel handling), then threaded through the roll's own dataset/checkContext so
 * _rollSkillHelper's post-hit processing (dice.mjs) knows which status to toggle. "Until the end
 * of their next turn" isn't actively expired (no such hook exists anywhere in this codebase) - the
 * same "grant, don't auto-revoke" idiom every other Perk-applied status this project has built
 * uses (a GM clears it manually, same as Lock Down's Immobilized, Absolute Menace's Frightened,
 * etc.).
 */
const RADIUS_FEET = 300; // RAW's "100 yards"

/**
 * Prompts for which of the 3 named Conditions this cast should inflict - the same single-<select>
 * DialogV2 shape as helpers/banked-buffs.mjs#pickHobbleCondition.
 * @returns {Promise<String|null>}   'blinded'/'deafened'/'prone', or null if cancelled.
 */
export async function pickElementalStormCondition() {
  const options = ['blinded', 'deafened', 'prone']
    .map(key => `<option value="${key}">${game.i18n.localize(E20.statusEffects.find(s => s.id == key).name)}</option>`)
    .join('');
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.ElementalStormPickConditionTitle') },
    classes: ["window-app"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.ElementalStormPickConditionLabel')
    }</label><select name="condition">${options}</select></div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => button.form.elements.condition.value,
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  return chosen && chosen != 'cancel' ? chosen : null;
}

/**
 * Targets every enemy within 100 yards and kicks off the Survival-vs-Toughness Skill Test, once a
 * Condition has actually been chosen. Returns false (having spent/marked nothing yet) if the
 * player cancels the picker - the caller (banked-buffs.mjs) only spends the Power cost/marks the
 * once-per-scene flag once this returns true, so a cancelled cast doesn't waste the resource.
 * @param {Actor} actor
 * @returns {Promise<Boolean>}
 */
export async function activateElementalStorm(actor) {
  const condition = await pickElementalStormCondition();
  if (!condition) {
    return false;
  }

  const enemies = getNearbyEnemyTokens(actor, RADIUS_FEET);
  canvas.tokens.setTargets(enemies.map(token => token.id));

  await actor._dice.rollSkill({
    skill: 'survival',
    essence: 'smarts',
    shiftUp: 0,
    shiftDown: 0,
    defenseType: 'toughness',
    isElementalStorm: true,
    elementalStormCondition: condition,
  }, actor);

  return true;
}
