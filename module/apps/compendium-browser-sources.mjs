import { applyThemeClass } from "../settings.js";
import { getGroupedItemPacks, syncSourcebookOwnership } from "../helpers/compendium-browser.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * GM-only screen for choosing which sourcebooks (compendium packs) are available in
 * the Compendium Browser. Reachable both from Foundry's Configure Settings menu and
 * from a button inside the Compendium Browser itself.
 */
export default class CompendiumBrowserSourceConfig extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "compendium-browser-sources",
    classes: ["essence20", "theme-wrapper", "compendium-browser-sources"],
    tag: "form",
    window: {
      icon: "fa-solid fa-book-atlas",
      title: "E20.CompendiumBrowserSourceConfigTitle",
    },
    position: {
      width: 480,
      height: "auto",
    },
    form: {
      handler: CompendiumBrowserSourceConfig.#onSubmit,
      submitOnChange: false,
      closeOnSubmit: true,
    },
  };

  static PARTS = {
    form: {
      template: "systems/essence20/templates/app/compendium-browser-sources.hbs",
      scrollable: [".compendium-browser-sources-groups"],
    },
    footer: {
      template: "templates/generic/form-footer.hbs",
    },
  };

  async _prepareContext() {
    const disabled = game.settings.get("essence20", "enabledSourcebooks") ?? {};
    const groups = getGroupedItemPacks().map(group => ({
      name: group.name,
      packs: group.packs.map(pack => ({
        id: pack.metadata.id,
        label: pack.metadata.label,
        enabled: disabled[pack.metadata.id] !== false,
      })),
    }));

    return {
      groups,
      buttons: [
        { type: "submit", icon: "fa-solid fa-save", label: "SETTINGS.Save" },
      ],
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);

    applyThemeClass(this.element);
  }

  static async #onSubmit(event, form) {
    const disabled = {};
    for (const checkbox of form.querySelectorAll("[data-pack-id]")) {
      if (!checkbox.checked) {
        disabled[checkbox.dataset.packId] = false;
      }
    }

    await game.settings.set("essence20", "enabledSourcebooks", disabled);
    await syncSourcebookOwnership();

    const browser = foundry.applications.instances.get("essence20-compendium-browser");
    browser?.refresh();
  }
}
