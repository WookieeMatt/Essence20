/**
 * Define a set of template paths to pre-load
 * Pre-loaded templates are compiled and cached for fast access when rendering
 * @return {Promise}
 */
export const preloadHandlebarsTemplates = async function () {
  return loadTemplates([

    // Actor partials - Headers
    "systems/essence20/templates/actor/parts/actor-base-header.hbs",
    "systems/essence20/templates/actor/parts/actor-gijoe-header.hbs",
    "systems/essence20/templates/actor/parts/actor-pr-header.hbs",
    "systems/essence20/templates/actor/parts/actor-tf-header.hbs",

    // Actor partials - Misc
    "systems/essence20/templates/actor/parts/actor-accordion-skills.hbs",
    "systems/essence20/templates/actor/parts/actor-armor.hbs",
    "systems/essence20/templates/actor/parts/actor-background.hbs",
    "systems/essence20/templates/actor/parts/actor-pc-skills.hbs",
    "systems/essence20/templates/actor/parts/actor-collapsible-item-container.hbs",
    "systems/essence20/templates/actor/parts/actor-common.hbs",
    "systems/essence20/templates/actor/parts/actor-defenses.hbs",
    "systems/essence20/templates/actor/parts/actor-essence-skills.hbs",
    "systems/essence20/templates/actor/parts/actor-gear.hbs",
    "systems/essence20/templates/actor/parts/actor-health.hbs",
    "systems/essence20/templates/actor/parts/actor-initiative.hbs",
    "systems/essence20/templates/actor/parts/actor-perks.hbs",
    "systems/essence20/templates/actor/parts/actor-movement.hbs",
    "systems/essence20/templates/actor/parts/actor-notes.hbs",
    "systems/essence20/templates/actor/parts/actor-npc-defenses.hbs",
    "systems/essence20/templates/actor/parts/actor-powers.hbs",
    "systems/essence20/templates/actor/parts/actor-traits.hbs",
    "systems/essence20/templates/actor/parts/actor-weapons.hbs",
    "systems/essence20/templates/actor/parts/actor-zord-skills.hbs",
    "systems/essence20/templates/actor/parts/actor-zordcombiner.hbs",

    // Item partials.
    "systems/essence20/templates/item/parts/item-description.hbs",
    "systems/essence20/templates/item/parts/item-header.hbs",
  ]);
};
