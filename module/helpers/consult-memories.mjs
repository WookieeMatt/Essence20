import { E20 } from "./config.mjs";
import { hasUsedThisEncounter, markUsedThisEncounter } from "./perks.mjs";

/**
 * Consult Memories (Field Guide to Action & Adventure, Grid Psychic Focus, 10th level, p.68):
 * "you can spend 10 minutes to gain ↑2 and Specialization in the Skill of your choice for one
 * scene. For every Personal Power you spend to consult these memories, the benefits last for
 * another scene."
 *
 * The 10-minute cost is a narrative timing qualifier, not enforced (same "no downtime-action-
 * economy hook" looseness this project already accepts, e.g. Thesis's own "takes longer" clause).
 * The Personal-Power-extension half (multi-scene duration) is NOT built - this codebase has no
 * scene-COUNTING mechanism beyond the single scene-clock epoch, so "extend by N more scenes" has
 * nowhere to store N; only the base single-scene grant is built. Modeled the same
 * "activate, then live-read (not consumed) for the rest of the scene" way Public Television's own
 * flag works, just scoped to a player-picked skill instead of a whole Essence.
 */
export const CONSULT_MEMORIES_ID = "Compendium.essence20.field_guide_action_adventure.Item.YzvU6WpADTfuGVLj";
const CONSULT_MEMORIES_ENCOUNTER_FLAG = 'consultMemoriesUsedThisEncounter';
const CONSULT_MEMORIES_SKILL_FLAG = 'consultMemoriesSkill';

/**
 * @returns {Promise<String|null>}   The chosen skill key, or null if cancelled.
 */
async function pickConsultMemoriesSkill() {
  const skillOptions = Object.keys(E20.skills)
    .map(key => `<option value="${key}">${game.i18n.localize(E20.skills[key])}</option>`).join('');
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.ConsultMemoriesPickSkillTitle') },
    classes: ["window-app", "e20-window"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.ConsultMemoriesPickSkillLabel')
    }</label><select name="skill">${skillOptions}</select></div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => button.form.elements.skill.value,
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
export function canUseConsultMemories(actor) {
  return !hasUsedThisEncounter(actor, CONSULT_MEMORIES_ENCOUNTER_FLAG);
}

/**
 * Prompts for the skill, then activates for the rest of the scene.
 * @param {Actor} actor
 * @returns {Promise<Boolean>}   False (nothing activated) if the picker was cancelled.
 */
export async function activateConsultMemories(actor) {
  const skill = await pickConsultMemoriesSkill();
  if (!skill) {
    return false;
  }

  await actor.setFlag('essence20', CONSULT_MEMORIES_SKILL_FLAG, skill);
  await markUsedThisEncounter(actor, CONSULT_MEMORIES_ENCOUNTER_FLAG);
  return true;
}

/**
 * @param {Actor} actor
 * @param {String} rolledSkill
 * @returns {Boolean}
 */
export function isConsultMemoriesActive(actor, rolledSkill) {
  return hasUsedThisEncounter(actor, CONSULT_MEMORIES_ENCOUNTER_FLAG)
    && actor.getFlag?.('essence20', CONSULT_MEMORIES_SKILL_FLAG) == rolledSkill;
}
