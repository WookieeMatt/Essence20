import { applyThemeClass, refreshChatMessageThemes, refreshOpenThemeWrappers } from "../settings.js";
import { CUSTOM_GAME_LINES_SETTING, LINE_FAMILIES, customLines, lineIdFrom, normalizeLine } from "../mechanics/resources/custom-game-lines.mjs";
import { SUGGESTED_TERMS, normalizeTerms, parseTermLines } from "../mechanics/resources/line-terms.mjs";
import { LOOK_FRAMES, hasLook, normalizeLook } from "../mechanics/resources/line-look.mjs";
import { serializeFormSubmits } from "./serialize-form-submits.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * GM-only Game Lines screen (Configure Settings > Game Lines): the world's own homebrew lines - "M.A.S.K.",
 * "ThunderCats" - each built on one of the book lines' rules (mechanics/resources/custom-game-lines.mjs). Add, rename,
 * pick the book line, the compendium folder its content sits in, whether its characters Morph, any extra Specializations,
 * its own words for the book's (mechanics/resources/line-terms.mjs) and its look (mechanics/resources/line-look.mjs); delete. Lines a module
 * ships (its module.json's flags.essence20.gameLines) are listed too, read-only.
 */
export default class GameLinesConfig extends serializeFormSubmits(HandlebarsApplicationMixin(ApplicationV2)) {
  static DEFAULT_OPTIONS = {
    id: "essence20-game-lines",
    classes: ["essence20", "theme-wrapper", "e20-window", "game-lines-config"],
    tag: "form",
    window: {
      icon: "fa-solid fa-tv",
      title: "E20.GameLinesTitle",
      resizable: true,
    },
    position: {
      width: 600,
      height: "auto",
    },
    form: {
      handler: GameLinesConfig.#onSubmit,
      submitOnChange: false,
      closeOnSubmit: true,
    },
    actions: {
      addLine: GameLinesConfig.#onAdd,
      deleteLine: GameLinesConfig.#onDelete,
    },
  };

  static PARTS = {
    form: {
      template: "systems/essence20/templates/app/game-lines.hbs",
      scrollable: [".house-rules-groups"],
    },
    footer: {
      template: "templates/generic/form-footer.hbs",
    },
  };

  // The world's lines as edited and not saved yet; null until first drawn.
  #draft = null;

  async _prepareContext() {
    this.#draft ??= foundry.utils.deepClone(game.settings.get("essence20", CUSTOM_GAME_LINES_SETTING) ?? []);
    const families = Object.fromEntries(LINE_FAMILIES.map(key => [key, game.i18n.localize(CONFIG.E20.gameVersions[key])]));
    const folders = { "": game.i18n.localize("E20.GameLinesNoFolder") };
    for (const folder of game.folders.filter(entry => entry.type == "Compendium").sort((a, b) => a.name.localeCompare(b.name))) {
      folders[folder.name] = folder.name;
    }

    // A line's frame: blank keeps each player's own Sheet Theme; else the Sheet Theme setting's own names.
    const frameNames = { default: "E20.ThemeDefault", pony: "E20.ThemePony" };
    const frames = { "": game.i18n.localize("E20.GameLinesLookFramePlayer") };
    for (const frame of LOOK_FRAMES) {
      frames[frame] = game.i18n.localize(frameNames[frame]);
    }

    const skills = Object.entries(CONFIG.E20.originSkills).map(([key, label]) => ({ key, label: game.i18n.localize(label) }));
    return {
      lines: this.#draft.map((line, index) => {
        // A folder named here but since renamed or deleted stays on the list, so saving doesn't drop it.
        const lineFolders = line.packFolder && !folders[line.packFolder] ? { ...folders, [line.packFolder]: line.packFolder } : folders;
        return {
          index,
          label: line.label ?? "",
          family: line.family ?? "giJoe",
          packFolder: line.packFolder ?? "",
          canMorph: !!line.canMorph,
          folders: lineFolders,
          skills: skills.map(skill => ({ ...skill, value: [].concat(line.specializations?.[skill.key] ?? []).join(", ") })),
          extras: Object.values(line.specializations ?? {}).flat().length,
          // Its words: a box for each suggested one, any others as "Book word = Your word" lines.
          terms: SUGGESTED_TERMS.map(word => ({ word, value: line.terms?.[word] ?? "" })),
          otherTerms: Object.entries(line.terms ?? {}).filter(([word]) => !SUGGESTED_TERMS.includes(word))
            .map(([word, own]) => `${word} = ${own}`).join("\n"),
          termCount: Object.keys(line.terms ?? {}).length,
          look: normalizeLook(line.look),
          hasLook: hasLook(normalizeLook(line.look)),
        };
      }),
      families,
      frames,
      // Lines from modules, read-only; a world line with the same id replaces one.
      moduleLines: customLines().filter(line => line.source != "world").map(line => ({
        label: line.label,
        family: families[line.family],
        module: game.modules.get(line.source)?.title ?? line.source,
      })),
      buttons: [{ type: "submit", icon: "fa-solid fa-save", label: "SETTINGS.Save" }],
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    applyThemeClass(this.element);
  }

  /** The form's current values into the draft, so adding or deleting a line keeps what was typed. */
  #capture() {
    if (!this.form) {
      return;
    }

    const data = foundry.utils.expandObject(new foundry.applications.ux.FormDataExtended(this.form).object);
    for (const [index, values] of Object.entries(data.lines ?? {})) {
      const line = this.#draft[Number(index)];
      if (line) {
        Object.assign(line, {
          label: values.label, family: values.family, packFolder: values.packFolder, canMorph: !!values.canMorph, specializations: values.specializations ?? {},
          terms: { ...normalizeTerms(values.terms), ...parseTermLines(values.otherTerms) },
          look: normalizeLook(values.look),
        });
      }
    }
  }

  static async #onAdd() {
    this.#capture();
    this.#draft.push({ label: "", family: "giJoe", packFolder: "", canMorph: false, specializations: {}, terms: {}, look: {} });
    this.render();
  }

  static async #onDelete(event, target) {
    this.#capture();
    this.#draft.splice(Number(target.dataset.index), 1);
    this.render();
  }

  static async #onSubmit() {
    this.#capture();
    const saved = [];
    const ids = new Set();
    for (const raw of this.#draft) {
      if (!String(raw.label ?? "").trim()) {
        continue;
      }

      // A line keeps its id once saved (Roles name it); a new one takes it from its name, made unique.
      let id = raw.id || lineIdFrom(raw.label);
      for (let n = 2; ids.has(id); n++) {
        id = `${lineIdFrom(raw.id || raw.label)}-${n}`;
      }

      const line = normalizeLine({ ...raw, id });
      if (!line) {
        ui.notifications.warn(game.i18n.format("E20.GameLinesBadName", { name: raw.label }));
        continue;
      }

      ids.add(line.id);
      saved.push({ id: line.id, label: line.label, family: line.family, packFolder: line.packFolder, canMorph: line.canMorph, specializations: line.specializations, terms: line.terms, look: line.look });
    }

    this.#draft = null;
    const wordsOf = lines => JSON.stringify(Object.fromEntries((lines ?? []).map(line => [line.id, line.terms ?? {}])));
    const wordsChanged = wordsOf(game.settings.get("essence20", CUSTOM_GAME_LINES_SETTING)) != wordsOf(saved);
    await game.settings.set("essence20", CUSTOM_GAME_LINES_SETTING, saved);
    // Looks show at once on what's open (settings.js#applyThemeClass reads them).
    refreshOpenThemeWrappers();
    refreshChatMessageThemes();
    // The system's own text takes the world line's words when it loads (mechanics/resources/line-terms-hooks.mjs).
    if (wordsChanged) {
      await foundry.applications.settings.SettingsConfig.reloadConfirm({ world: true });
    }
  }
}
