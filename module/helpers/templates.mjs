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
    "systems/essence20/templates/actor/parts/headers/actor-pony-header.hbs",
    "systems/essence20/templates/actor/parts/headers/actor-npc-header.hbs",
    "systems/essence20/templates/actor/parts/headers/actor-pr-header.hbs",
    "systems/essence20/templates/actor/parts/headers/actor-transformer-header.hbs",
    "systems/essence20/templates/actor/parts/headers/actor-vehicle-header.hbs",
    "systems/essence20/templates/actor/parts/headers/actor-zord-header.hbs",

    // Actor partials - Misc
    "systems/essence20/templates/actor/parts/actor-accordion-skills.hbs",
    "systems/essence20/templates/actor/parts/actor-active-effects.hbs",
    "systems/essence20/templates/actor/parts/actor-alt-mode.hbs",
    "systems/essence20/templates/actor/parts/actor-background.hbs",
    "systems/essence20/templates/actor/parts/actor-collapsible-item-container.hbs",
    "systems/essence20/templates/actor/parts/actor-common.hbs",
    "systems/essence20/templates/actor/parts/actor-defenses.hbs",
    "systems/essence20/templates/actor/parts/actor-defenses-pr.hbs",
    "systems/essence20/templates/actor/parts/actor-essence-skills.hbs",
    "systems/essence20/templates/actor/parts/actor-health.hbs",
    "systems/essence20/templates/actor/parts/actor-initiative.hbs",
    "systems/essence20/templates/actor/parts/actor-mode-selector.hbs",
    "systems/essence20/templates/actor/parts/actor-movement.hbs",
    "systems/essence20/templates/actor/parts/actor-notes.hbs",
    "systems/essence20/templates/actor/parts/actor-npc-defenses.hbs",
    "systems/essence20/templates/actor/parts/actor-npc-essence-scores.hbs",
    "systems/essence20/templates/actor/parts/actor-pc-skills.hbs",
    "systems/essence20/templates/actor/parts/actor-zord-common.hbs",
    "systems/essence20/templates/actor/parts/actor-zordcombiner.hbs",
    "systems/essence20/templates/actor/parts/actor-vehicle-crew.hbs",

    // Actor partials - Items
    "systems/essence20/templates/actor/parts/items/altMode/container.hbs",
    "systems/essence20/templates/actor/parts/items/altMode/details.hbs",
    "systems/essence20/templates/actor/parts/items/armor/container.hbs",
    "systems/essence20/templates/actor/parts/items/armor/details.hbs",
    "systems/essence20/templates/actor/parts/items/bond/container.hbs",
    "systems/essence20/templates/actor/parts/items/bond/details.hbs",
    "systems/essence20/templates/actor/parts/items/classFeature/container.hbs",
    "systems/essence20/templates/actor/parts/items/classFeature/details.hbs",
    "systems/essence20/templates/actor/parts/items/classFeature/selector.hbs",
    "systems/essence20/templates/actor/parts/items/feature/container.hbs",
    "systems/essence20/templates/actor/parts/items/feature/details.hbs",
    "systems/essence20/templates/actor/parts/items/gear/container.hbs",
    "systems/essence20/templates/actor/parts/items/gear/details.hbs",
    "systems/essence20/templates/actor/parts/items/hangUp/container.hbs",
    "systems/essence20/templates/actor/parts/items/hangUp/details.hbs",
    "systems/essence20/templates/actor/parts/items/megaformTrait/container.hbs",
    "systems/essence20/templates/actor/parts/items/megaformTrait/details.hbs",
    "systems/essence20/templates/actor/parts/items/origin/container.hbs",
    "systems/essence20/templates/actor/parts/items/origin/details.hbs",
    "systems/essence20/templates/actor/parts/items/perk/container.hbs",
    "systems/essence20/templates/actor/parts/items/perk/details.hbs",
    "systems/essence20/templates/actor/parts/items/power/container.hbs",
    "systems/essence20/templates/actor/parts/items/power/details.hbs",
    "systems/essence20/templates/actor/parts/items/threatPower/container.hbs",
    "systems/essence20/templates/actor/parts/items/threatPower/details.hbs",
    "systems/essence20/templates/actor/parts/items/trait/container.hbs",
    "systems/essence20/templates/actor/parts/items/trait/details.hbs",
    "systems/essence20/templates/actor/parts/items/weapon/container.hbs",
    "systems/essence20/templates/actor/parts/items/weapon/details.hbs",

    // Item partials.
    "systems/essence20/templates/item/parts/item-description.hbs",
    "systems/essence20/templates/item/parts/item-header.hbs",
    "systems/essence20/templates/item/parts/item-sheet-field.hbs",
    "systems/essence20/templates/item/parts/item-active-effects.hbs",
  ]);
};
