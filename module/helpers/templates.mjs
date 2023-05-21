/**
 * Define a set of template paths to pre-load
 * Pre-loaded templates are compiled and cached for fast access when rendering
 * @return {Promise}
 */
export const preloadHandlebarsTemplates = async function () {
  return loadTemplates([

    // Actor partials - Headers
    "systems/essence20/templates/actor/parts/headers/companion.hbs",
    "systems/essence20/templates/actor/parts/headers/gijoe.hbs",
    "systems/essence20/templates/actor/parts/headers/common.hbs",
    "systems/essence20/templates/actor/parts/headers/megaformZord.hbs",
    "systems/essence20/templates/actor/parts/headers/pony.hbs",
    "systems/essence20/templates/actor/parts/headers/npc.hbs",
    "systems/essence20/templates/actor/parts/headers/pr.hbs",
    "systems/essence20/templates/actor/parts/headers/transformer.hbs",
    "systems/essence20/templates/actor/parts/headers/vehicle.hbs",
    "systems/essence20/templates/actor/parts/headers/zord.hbs",

    // Actor partials - Misc
    "systems/essence20/templates/actor/parts/misc/accordion-skills.hbs",
    "systems/essence20/templates/actor/parts/misc/active-effects.hbs",
    "systems/essence20/templates/actor/parts/misc/background.hbs",
    "systems/essence20/templates/actor/parts/misc/collapsible-item-container.hbs",
    "systems/essence20/templates/actor/parts/misc/common.hbs",
    "systems/essence20/templates/actor/parts/misc/defenses.hbs",
    "systems/essence20/templates/actor/parts/misc/essence-skills.hbs",
    "systems/essence20/templates/actor/parts/misc/health.hbs",
    "systems/essence20/templates/actor/parts/misc/initiative.hbs",
    "systems/essence20/templates/actor/parts/misc/mode-selector.hbs",
    "systems/essence20/templates/actor/parts/misc/movement.hbs",
    "systems/essence20/templates/actor/parts/misc/notes.hbs",
    "systems/essence20/templates/actor/parts/misc/npc-defenses.hbs",
    "systems/essence20/templates/actor/parts/misc/npc-essence-scores.hbs",
    "systems/essence20/templates/actor/parts/misc/pc-skills.hbs",
    "systems/essence20/templates/actor/parts/misc/spells.hbs",
    "systems/essence20/templates/actor/parts/misc/stun.hbs",
    "systems/essence20/templates/actor/parts/misc/zord-common.hbs",
    "systems/essence20/templates/actor/parts/misc/zordcombiner.hbs",
    "systems/essence20/templates/actor/parts/misc/vehicle-crew.hbs",

    // Actor partials - Items
    "systems/essence20/templates/actor/parts/items/altMode/container.hbs",
    "systems/essence20/templates/actor/parts/items/altMode/details.hbs",
    "systems/essence20/templates/actor/parts/items/armor/container.hbs",
    "systems/essence20/templates/actor/parts/items/armor/details.hbs",
    "systems/essence20/templates/actor/parts/items/bond/container.hbs",
    "systems/essence20/templates/actor/parts/items/bond/details.hbs",
    "systems/essence20/templates/actor/parts/items/contact/container.hbs",
    "systems/essence20/templates/actor/parts/items/contact/details.hbs",
    "systems/essence20/templates/actor/parts/items/classFeature/container.hbs",
    "systems/essence20/templates/actor/parts/items/classFeature/details.hbs",
    "systems/essence20/templates/actor/parts/items/classFeature/selector.hbs",
    "systems/essence20/templates/actor/parts/items/feature/container.hbs",
    "systems/essence20/templates/actor/parts/items/feature/details.hbs",
    "systems/essence20/templates/actor/parts/items/gear/container.hbs",
    "systems/essence20/templates/actor/parts/items/gear/details.hbs",
    "systems/essence20/templates/actor/parts/items/hangUp/container.hbs",
    "systems/essence20/templates/actor/parts/items/hangUp/details.hbs",
    "systems/essence20/templates/actor/parts/items/influence/container.hbs",
    "systems/essence20/templates/actor/parts/items/influence/details.hbs",
    "systems/essence20/templates/actor/parts/items/magicBauble/container.hbs",
    "systems/essence20/templates/actor/parts/items/magicBauble/details.hbs",
    "systems/essence20/templates/actor/parts/items/megaformTrait/container.hbs",
    "systems/essence20/templates/actor/parts/items/megaformTrait/details.hbs",
    "systems/essence20/templates/actor/parts/items/origin/container.hbs",
    "systems/essence20/templates/actor/parts/items/origin/details.hbs",
    "systems/essence20/templates/actor/parts/items/perk/container.hbs",
    "systems/essence20/templates/actor/parts/items/perk/details.hbs",
    "systems/essence20/templates/actor/parts/items/power/container.hbs",
    "systems/essence20/templates/actor/parts/items/power/details.hbs",
    "systems/essence20/templates/actor/parts/items/spell/container.hbs",
    "systems/essence20/templates/actor/parts/items/spell/details.hbs",
    "systems/essence20/templates/actor/parts/items/threatPower/container.hbs",
    "systems/essence20/templates/actor/parts/items/threatPower/details.hbs",
    "systems/essence20/templates/actor/parts/items/upgrade/container.hbs",
    "systems/essence20/templates/actor/parts/items/upgrade/details.hbs",
    "systems/essence20/templates/actor/parts/items/weapon/container.hbs",
    "systems/essence20/templates/actor/parts/items/weapon/details.hbs",

    // Item partials.
    "systems/essence20/templates/item/parts/description.hbs",
    "systems/essence20/templates/item/parts/header.hbs",
    "systems/essence20/templates/item/parts/sheet-field.hbs",
    "systems/essence20/templates/item/parts/active-effects.hbs",
    "systems/essence20/templates/item/parts/upgrades.hbs",
  ]);
};
