import TraitSelector from "./trait-selector.js";

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
    allowCustom: false
  };
  switch (a.dataset.options) {
    case "armor":
      options.choices = CONFIG.E20.armorTraits;
      options.valueKey = null;
      break;
  }
  new TraitSelector(owner, options).render(true);
}
