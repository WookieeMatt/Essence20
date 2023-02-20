/**
 * Define a set of template paths to pre-load
 * Pre-loaded templates are compiled and cached for fast access when rendering
 * @return {Promise}
 */
export const preloadHandlebarsTemplates = async function () {
  return loadTemplates([

    // Actor partials - Headers
    "systems/essence20/templates/actor/parts/headers/actor-gijoe-header.hbs",
    "systems/essence20/templates/actor/parts/headers/actor-header.hbs",
    "systems/essence20/templates/actor/parts/headers/actor-megaformZord-header.hbs",
    "systems/essence20/templates/actor/parts/headers/actor-npc-header.hbs",
    "systems/essence20/templates/actor/parts/headers/actor-pr-header.hbs",
    "systems/essence20/templates/actor/parts/headers/actor-transformer-header.hbs",
    "systems/essence20/templates/actor/parts/headers/actor-vehicle-header.hbs",
    "systems/essence20/templates/actor/parts/headers/actor-zord-header.hbs",

    // Actor partials - Misc
    "systems/essence20/templates/actor/parts/actor-accordion-skills.hbs",
    "systems/essence20/templates/actor/parts/altMode/container.hbs",
    "systems/essence20/templates/actor/parts/altMode/details.hbs",
    "systems/essence20/templates/actor/parts/armor/container.hbs",
    "systems/essence20/templates/actor/parts/armor/details.hbs",
    "systems/essence20/templates/actor/parts/actor-background.hbs",
    "systems/essence20/templates/actor/parts/classFeature/selector.hbs",
    "systems/essence20/templates/actor/parts/classFeature/container.hbs",
    "systems/essence20/templates/actor/parts/classFeature/details.hbs",
    "systems/essence20/templates/actor/parts/actor-collapsible-item-container.hbs",
    "systems/essence20/templates/actor/parts/actor-common.hbs",
    "systems/essence20/templates/actor/parts/actor-defenses.hbs",
    "systems/essence20/templates/actor/parts/actor-defenses-pr.hbs",
    "systems/essence20/templates/actor/parts/actor-essence-skills.hbs",
    "systems/essence20/templates/actor/parts/gear/details.hbs",
    "systems/essence20/templates/actor/parts/gear/container.hbs",
    "systems/essence20/templates/actor/parts/actor-hang-ups.hbs",
    "systems/essence20/templates/actor/parts/actor-health.hbs",
    "systems/essence20/templates/actor/parts/actor-initiative.hbs",
    "systems/essence20/templates/actor/parts/actor-mode-selector.hbs",
    "systems/essence20/templates/actor/parts/actor-movement.hbs",
    "systems/essence20/templates/actor/parts/actor-notes.hbs",
    "systems/essence20/templates/actor/parts/actor-npc-defenses.hbs",
    "systems/essence20/templates/actor/parts/actor-npc-essence-scores.hbs",
    "systems/essence20/templates/actor/parts/actor-pc-skills.hbs",
    "systems/essence20/templates/actor/parts/actor-perks.hbs",
    "systems/essence20/templates/actor/parts/actor-powers.hbs",
    "systems/essence20/templates/actor/parts/actor-traits.hbs",
    "systems/essence20/templates/actor/parts/actor-threat-powers.hbs",
    "systems/essence20/templates/actor/parts/actor-weapons.hbs",
    "systems/essence20/templates/actor/parts/actor-zord-common.hbs",
    "systems/essence20/templates/actor/parts/actor-zord-skills.hbs",
    "systems/essence20/templates/actor/parts/actor-zordcombiner.hbs",
    "systems/essence20/templates/actor/parts/actor-vehicle-crew.hbs",

    // Item partials.
    "systems/essence20/templates/item/parts/item-description.hbs",
    "systems/essence20/templates/item/parts/item-header.hbs",
    "systems/essence20/templates/item/parts/item-sheet-field.hbs",
  ]);
};
