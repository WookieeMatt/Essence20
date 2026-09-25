import { bankPendingBonus, getUsesThisScene, markUsedThisScene } from "./perks.mjs";
import { E20 } from "./config.mjs";

/**
 * The Returned (Through the Shattered Grid, Influence Perk, p.112): "Once per session, choose a
 * Skill. You gain an Edge on Skill Tests with that Skill when you call upon memories to aid you."
 *
 * RE-CATEGORIZED - previously bucketed as pure narrative backstory flavor alongside 15 other
 * unverified items in this same book. A real, buildable "Use" button + fresh-pick-each-time
 * picker - same shape as Grid Surge's own Temporary Construct/Time To Think, banking an Edge
 * scoped to whichever Skill is picked THIS use (not a fixed choice made once at grant time, unlike
 * Awesome/Eltarian Observer's own choiceType:'skills' shape) - consumed on the actor's own next
 * roll of that Skill, the same "bank now, consume on the next matching roll" idiom Ageless
 * Knowledge/Paradox already establish. "Once per session" is approximated as "once per scene" via
 * getUsesThisScene/markUsedThisScene (Dependable's own established idiom for this exact reading -
 * "just as usable outside combat as during it," unlike the combat-scoped hasUsedThisEncounter
 * pair). "When you call upon memories to aid you" is an unenforceable narrative-trigger qualifier,
 * dropped the same way Bits To Spare/Truthseeker's own qualifiers already are. The Hang-Up half
 * ("Snag on Social/Smarts Skill Tests about your past/how you returned") needs actual
 * topic-detection this codebase has no hook for and stays unbuilt.
 */
export const THE_RETURNED_ID = "Compendium.essence20.through_the_shattered_grid.Item.DC0cXGGBm4J8OXvL";
export const THE_RETURNED_FLAG = 'pendingTheReturned';
const THE_RETURNED_SCENE_FLAG = 'theReturnedUsesThisScene';

/**
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function canUseTheReturned(actor) {
  return getUsesThisScene(actor, THE_RETURNED_SCENE_FLAG) == 0;
}

/**
 * Prompts for which Skill to bank an Edge on - same single-dropdown DialogV2 shape as
 * pickAgelessKnowledgeSkill.
 * @returns {Promise<String|null>}
 */
async function pickTheReturnedSkill() {
  const skillOptions = Object.keys(E20.skills)
    .map(key => `<option value="${key}">${game.i18n.localize(E20.skills[key])}</option>`).join('');
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.TheReturnedPickSkillTitle') },
    classes: ["window-app"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.TheReturnedPickSkillLabel')
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
 * Prompts for a Skill and banks an Edge scoped to it, marking the scene used.
 * @param {Actor} actor
 */
export async function activateTheReturned(actor) {
  if (!canUseTheReturned(actor)) {
    return;
  }

  const skill = await pickTheReturnedSkill();
  if (!skill) {
    return;
  }

  await bankPendingBonus(actor, THE_RETURNED_FLAG, { skill });
  await markUsedThisScene(actor, THE_RETURNED_SCENE_FLAG);
}
