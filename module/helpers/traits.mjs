import { TraitSelector } from "../apps/trait-selector.mjs";

/**
 * Handle spawning the TraitSelector application for selection various options.
 * @param {Event} event   The click event which originated the selection.
 * @param {Actor|Item} owner      The owning document which manages this effect
 * @private
 */
export function onManageSelectTrait(event, owner) {
  event.preventDefault();
  const a = event.currentTarget;
  const options = {
    name: a.dataset.target,
    title: a.parentElement.innerText,
    choices: [],
    allowCustom: false,
  };

  switch (a.dataset.options) {
  case "actorLevels":
    options.choices = CONFIG.E20.actorLevels;
    options.valueKey = null;
    break;
  case "armor":
    options.choices = CONFIG.E20.armorTraits;
    options.valueKey = null;
    break;
  case "armorType":
    options.choices = CONFIG.E20.armorTypes;
    options.valueKey = null;
    break;
  case "availabilities":
    options.choices = CONFIG.E20.availabilities;
    options.valueKey = null;
    break;
  case "damageType":
    options.choices = CONFIG.E20.damageTypes;
    options.valueKey = null;
    break;
  case "focusEssences":
    options.choices = CONFIG.E20.originEssences;
    options.valueKey = null;
    break;
  case "focusSkills":
    options.choices = CONFIG.E20.originSkills;
    options.valueKey = null;
    break;
  case "influenceSkill":
    options.choices = CONFIG.E20.originSkills;
    options.valueKey = null;
    break;
  case "originEssences":
    options.choices = CONFIG.E20.originEssences;
    options.valueKey = null;
    break;
  case "originSkills":
    options.choices = CONFIG.E20.originSkills;
    options.valueKey = null;
    break;
  case "weapon":
    options.choices = CONFIG.E20.weaponTraits;
    options.valueKey = null;
    break;
  case "weaponType":
    options.choices = CONFIG.E20.weaponTypes;
    options.valueKey = null;
    break;
  }

  new TraitSelector(owner, options).render(true);
}
