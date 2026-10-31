import { canConvert, canHoldAltModes } from "../mechanics/vehicles/vehicle-alt-modes.mjs";

/**
 * The Alt Modes tab Vehicle and Zord sheets share (mechanics/vehicles/vehicle-alt-modes.mjs - a world setting): the
 * Transformers' Alt Mode list, shown while the actor can hold Alt Modes or is in one.
 */

/** The tab, for a sheet's TABS.primary.tabs. */
export const ALT_MODE_TAB = { id: "altmode", group: "primary", label: "E20.TabAltMode" };

/** Its part, for a sheet's PARTS. */
export const ALT_MODE_PART = {
  template: "systems/essence20/templates/actor/parts/main/machine-altmode.hbs",
  scrollable: [""],
};

/**
 * The sheet context's Alt Mode flags: whether it has a Transform button, and whether the tab shows.
 * @param {Actor} actor
 * @returns {{canConvert: Boolean, showAltModes: Boolean}}
 */
export function altModeContext(actor) {
  return {
    canConvert: canConvert(actor),
    showAltModes: canHoldAltModes(actor) || !!actor.system?.isTransformed,
  };
}

/**
 * Show or hide the tab's link, and leave the tab if it was open and is hidden now (the setting just turned off).
 * @param {ApplicationV2} sheet
 */
export function applyAltModeTab(sheet) {
  const { showAltModes } = altModeContext(sheet.actor);
  const link = sheet.element.querySelector('nav.tabs a[data-tab="altmode"]');
  if (link) {
    link.style.display = showAltModes ? "" : "none";
  }

  if (!showAltModes && sheet.tabGroups?.primary == "altmode") {
    sheet.changeTab("main", "primary");
  }
}
