import { applyThemeClass } from "../settings.js";
import { serializeFormSubmits } from "./serialize-form-submits.mjs";
import { formingSummary, subtypeChangeBlockers } from "../mechanics/vehicles/megaform-participants.mjs";
import { RULES_LINE_FLAG, lineRule, worldLineId } from "../mechanics/resources/custom-game-lines.mjs";
import { rulesLineChoices } from "./sheet-options.mjs";

const { DocumentSheetV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * GM-only Forming Rules window for one Megaform (mechanics/vehicles/megaform-participants.mjs): which rules it forms
 * under (Megazord or Combiner), which kinds of actor may join it - none ticked keeps the book's rules - and which
 * members must be on the scene before it can Join. In a Crossover world (no world line) it also picks the line the
 * Megaform plays by - Voltron, Bruticus, the Dinozord - whose switches give its default rules and who may join.
 * Opened from the Combiners tab, the sheet's ⋮ menu and the Actors directory's right-click menu; it saves as it
 * changes, like the sheet.
 */
export default class MegaformFormingConfig extends serializeFormSubmits(HandlebarsApplicationMixin(DocumentSheetV2)) {
  static DEFAULT_OPTIONS = {
    classes: ["essence20", "theme-wrapper", "e20-window", "megaform-forming-config"],
    sheetConfig: false,
    ownershipConfig: false,
    canImport: false,
    window: {
      icon: "fa-solid fa-puzzle-piece",
      resizable: true,
    },
    position: {
      width: 460,
      height: "auto",
    },
    form: {
      submitOnChange: true,
    },
  };

  static PARTS = {
    form: {
      template: "systems/essence20/templates/app/megaform-forming.hbs",
    },
  };

  /** Open (or bring forward) a Megaform's Forming Rules window - GMs only. */
  static open(actor) {
    if (!game.user.isGM || actor?.type != 'megaform') {
      return null;
    }

    const id = `${this.name}-${actor.uuid.replaceAll(".", "-")}`;
    const app = foundry.applications.instances.get(id) ?? new this({ document: actor });
    app.render({ force: true });
    return app;
  }

  /**
   * A new line picked brings its Megaform type along (its megaformSubtype switch) - unless its members can't form that
   * way, when the type stays and the GM is told by the refusal as usual.
   */
  _prepareSubmitData(event, form, formData, updateData) {
    const data = super._prepareSubmitData(event, form, formData, updateData);
    const picked = foundry.utils.getProperty(data, `flags.essence20.${RULES_LINE_FLAG}`);
    if (picked !== undefined && picked != (this.document.getFlag("essence20", RULES_LINE_FLAG) ?? "")) {
      const subtype = lineRule(picked, "megaformSubtype");
      if (!subtypeChangeBlockers(this.document, subtype).length) {
        foundry.utils.setProperty(data, "system.subtype", [subtype]);
      }
    }

    return data;
  }

  /** Redrawn after every save: a refused change (a type its members can't form under) puts the form back as it is. */
  async _processSubmitData(event, form, submitData, options) {
    await super._processSubmitData(event, form, submitData, options);
    this.render();
  }

  _onRender(context, options) {
    super._onRender(context, options);
    applyThemeClass(this.element);
  }

  get title() {
    return game.i18n.format("E20.MegaformFormingTitle", { name: this.document.name });
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const system = this.document.system;
    const roster = Object.values(system.actors ?? {}).filter(entry => entry?.uuid);
    const summary = formingSummary(this.document, {
      subtypes: CONFIG.E20.megaformSubtypes, types: CONFIG.E20.megaformJoinTypes, localize: key => game.i18n.localize(key),
    });
    return {
      ...context,
      system,
      subtype: system.subtype?.[0] ?? 'megaformZord',
      // Crossover only: with a world line, the world's rules apply to every Megaform.
      rulesLine: worldLineId() ? null : {
        name: `flags.essence20.${RULES_LINE_FLAG}`, value: this.document.getFlag("essence20", RULES_LINE_FLAG) ?? "", choices: rulesLineChoices(),
      },
      subtypes: CONFIG.E20.megaformSubtypes,
      types: CONFIG.E20.megaformJoinTypes,
      roster: roster.length ? Object.fromEntries(roster.map(entry => [entry.uuid, entry.name])) : null,
      summary,
      joinsText: summary.joins.join(", "),
    };
  }
}
