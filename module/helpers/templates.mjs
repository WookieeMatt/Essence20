/**
 * Define a set of template paths to pre-load
 * Pre-loaded templates are compiled and cached for fast access when rendering
 * @return {Promise}
 */
 export const preloadHandlebarsTemplates = async function() {
  return loadTemplates([

    // Actor partials.
    "systems/essence20/templates/actor/parts/actor-base-header.hbs",
    "systems/essence20/templates/actor/parts/actor-gijoe-header.hbs",
    "systems/essence20/templates/actor/parts/actor-pr-header.hbs",
    "systems/essence20/templates/actor/parts/actor-tf-header.hbs",
    "systems/essence20/templates/actor/parts/actor-common.hbs",
    "systems/essence20/templates/actor/parts/actor-character.hbs",
    "systems/essence20/templates/actor/parts/actor-defenses.hbs",
    "systems/essence20/templates/actor/parts/actor-powers.hbs",
    "systems/essence20/templates/actor/parts/actor-background.hbs",
    "systems/essence20/templates/actor/parts/actor-notes.hbs",
    "systems/essence20/templates/actor/parts/actor-weapons.hbs",
    "systems/essence20/templates/actor/parts/actor-gear.hbs",
    "systems/essence20/templates/actor/parts/actor-armor.hbs",

    // Item partials.
    "systems/essence20/templates/item/parts/item-description.hbs",
    "systems/essence20/templates/item/parts/item-header.hbs",
  ]);
};
