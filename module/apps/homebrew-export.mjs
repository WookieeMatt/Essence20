import { applyThemeClass } from "../settings.js";
import { CUSTOM_GAME_LINES_SETTING } from "../mechanics/resources/custom-game-lines.mjs";
import { WORLD_HOUSE_RULES_SETTING } from "../rules/house-rules.mjs";
import {
  EXPORTABLE_SETTINGS, PACK_HIERARCHY, assetPlan, assetRefs, moduleFiles, moduleHouseRule, moduleIdFrom, moduleManifest,
  packFoldersFor, validVersion,
} from "../mechanics/export/homebrew-export.mjs";
import { zipFiles } from "../mechanics/export/zip-writer.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** The world setting remembering the last export's name, id, version, author and description. */
export const HOMEBREW_EXPORT_SETTING = "homebrewExport";

/**
 * The running Foundry's document hierarchy in the CLI's shape (homebrew-export.mjs#PACK_HIERARCHY): each collection's
 * embedded collections ([]) and embedded documents ({}), read from the document classes, so newer ones (a Scene's
 * regions and levels, a Region's behaviors) are packed the way this Foundry reads them.
 * @returns {Object}
 */
export function packHierarchy() {
  const out = {};
  const { EmbeddedCollectionField, EmbeddedDocumentField } = foundry.data.fields;
  const visit = (cls, name) => {
    if (!cls || out[name]) {
      return;
    }

    const shape = {};
    out[name] = shape;
    for (const [documentName, field] of Object.entries(cls.metadata?.embedded ?? {})) {
      const schemaField = cls.schema?.fields?.[field];
      if (schemaField instanceof EmbeddedCollectionField) {
        shape[field] = [];
      } else if (schemaField instanceof EmbeddedDocumentField) {
        shape[field] = {};
      } else {
        continue;
      }

      visit(foundry.utils.getDocumentClass(documentName), field);
    }
  };

  for (const type of Object.keys(CONFIG)) {
    const cls = CONFIG[type]?.documentClass;
    if (cls?.metadata?.collection && CONST.COMPENDIUM_DOCUMENT_TYPES?.includes(type)) {
      visit(cls, cls.metadata.collection);
    }
  }

  // Drop the empty ones, as the CLI's table has none.
  for (const [name, shape] of Object.entries(out)) {
    if (!Object.keys(shape).length) {
      delete out[name];
    }
  }

  return Object.keys(out).length ? out : PACK_HIERARCHY;
}

/** A pack's compendium folders, outermost first. */
function folderChain(pack) {
  const chain = [];
  for (let folder = pack.folder; folder; folder = folder.folder) {
    chain.unshift({ id: folder.id, name: folder.name, color: folder.color?.css ?? folder.color ?? null, sorting: folder.sorting });
  }

  return chain;
}

/**
 * GM-only Export Homebrew screen (Configure Settings > Export Homebrew): picks the world's compendiums, homebrew game
 * lines, house rules and settings, and downloads them as a module zip (mechanics/export/homebrew-export.mjs).
 */
export default class HomebrewExport extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "essence20-homebrew-export",
    classes: ["essence20", "theme-wrapper", "e20-window", "homebrew-export"],
    tag: "form",
    window: {
      icon: "fa-solid fa-file-zipper",
      title: "E20.HomebrewExportTitle",
      resizable: true,
    },
    position: {
      width: 600,
      height: "auto",
    },
    form: {
      handler: HomebrewExport.#onSubmit,
      submitOnChange: false,
      closeOnSubmit: false,
    },
  };

  static PARTS = {
    form: {
      template: "systems/essence20/templates/app/homebrew-export.hbs",
      scrollable: [".house-rules-groups"],
    },
    footer: {
      template: "templates/generic/form-footer.hbs",
    },
  };

  #busy = false;

  async _prepareContext() {
    const last = game.settings.get("essence20", HOMEBREW_EXPORT_SETTING) ?? {};
    const worldTitle = game.world.title;
    const packs = game.packs.filter(pack => pack.metadata.packageType == "world")
      .map(pack => ({
        collection: pack.collection,
        // Form names can't hold a pack id's dot.
        key: pack.collection.replaceAll(".", "~"),
        label: pack.metadata.label,
        type: game.i18n.localize(CONFIG[pack.documentName]?.documentClass?.metadata?.label ?? pack.documentName),
        count: pack.index.size,
        folder: folderChain(pack).map(folder => folder.name).join(" / "),
      }))
      .sort((a, b) => (a.folder || "").localeCompare(b.folder || "") || a.label.localeCompare(b.label));

    const settings = EXPORTABLE_SETTINGS.filter(key => game.settings.settings.has(`essence20.${key}`))
      .map(key => {
        const config = game.settings.settings.get(`essence20.${key}`);
        const value = game.settings.get("essence20", key);
        const isDefault = JSON.stringify(value ?? null) == JSON.stringify(config.default ?? null);
        return { key, label: config.name ? game.i18n.localize(config.name) : key, isDefault };
      })
      .filter(setting => !setting.isDefault);

    return {
      title: last.title ?? `${worldTitle} Homebrew`,
      id: last.id ?? "",
      idPlaceholder: moduleIdFrom(last.title ?? `${worldTitle} Homebrew`),
      version: last.version ?? "1.0.0",
      author: last.author ?? game.user.name,
      description: last.description ?? "",
      packs,
      lines: (game.settings.get("essence20", CUSTOM_GAME_LINES_SETTING) ?? []).map(line => ({ id: line.id, label: line.label })),
      houseRules: (game.settings.get("essence20", WORLD_HOUSE_RULES_SETTING) ?? []).map(rule => ({ id: rule.id, label: rule.label })),
      settings,
      buttons: [{ type: "submit", icon: "fa-solid fa-file-zipper", label: "E20.HomebrewExportButton" }],
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    applyThemeClass(this.element);
  }

  static async #onSubmit(event, form, formData) {
    if (this.#busy) {
      return;
    }

    const data = foundry.utils.expandObject(formData.object);
    const title = String(data.title ?? "").trim();
    const id = moduleIdFrom(data.id || title);
    const version = String(data.version ?? "").trim();
    if (!title || !id) {
      ui.notifications.warn("E20.HomebrewExportNeedsTitle", { localize: true });
      return;
    }

    if (!validVersion(version)) {
      ui.notifications.warn("E20.HomebrewExportBadVersion", { localize: true });
      return;
    }

    if (id == "essence20" || game.system.id == id) {
      ui.notifications.warn("E20.HomebrewExportBadId", { localize: true });
      return;
    }

    const chosen = group => Object.entries(data[group] ?? {}).filter(([, on]) => on).map(([key]) => key);
    const packIds = chosen("packs").map(key => key.replaceAll("~", "."));
    const lineIds = chosen("lines");
    const ruleIds = chosen("houseRules");
    const settingKeys = chosen("settings");
    if (!packIds.length && !lineIds.length && !ruleIds.length && !settingKeys.length) {
      ui.notifications.warn("E20.HomebrewExportNothing", { localize: true });
      return;
    }

    this.#busy = true;
    try {
      await game.settings.set("essence20", HOMEBREW_EXPORT_SETTING, {
        title, id: data.id ? id : "", version, author: String(data.author ?? "").trim(), description: String(data.description ?? "").trim(),
      });
      const progress = ui.notifications.info("E20.HomebrewExportBuilding", { localize: true, progress: true });
      const zip = await buildHomebrewZip({
        title, id, version, author: String(data.author ?? "").trim(), description: String(data.description ?? "").trim(),
        packIds, lineIds, ruleIds, settingKeys, bundleAssets: !!data.bundleAssets,
        onProgress: pct => progress?.update?.({ pct }),
      });
      progress?.update?.({ pct: 1 });
      foundry.utils.saveDataToFile(zip.bytes, "application/zip", `${id}.zip`);
      ui.notifications.info(game.i18n.format("E20.HomebrewExportDone", { file: `${id}.zip`, packs: zip.packs, assets: zip.assets }));
      if (zip.missing.length) {
        ui.notifications.warn(game.i18n.format("E20.HomebrewExportMissing", { count: zip.missing.length }));
        console.warn("Essence20 | Export Homebrew: files that could not be fetched (left pointing at the world)", zip.missing);
      }
    } catch (error) {
      console.error("Essence20 | Export Homebrew failed", error);
      ui.notifications.error(game.i18n.format("E20.HomebrewExportFailed", { error: error.message }));
    } finally {
      this.#busy = false;
    }
  }
}

/**
 * Build the module zip.
 * @param {Object} options
 * @returns {Promise<{bytes: Uint8Array, packs: Number, assets: Number, missing: Array<String>}>}
 */
export async function buildHomebrewZip({ title, id, version, author, description, packIds, lineIds, ruleIds, settingKeys, bundleAssets, onProgress }) {
  const hierarchy = packHierarchy();
  const packs = [];
  const packMeta = [];
  const steps = packIds.length + 1;
  for (const [index, collection] of packIds.entries()) {
    const pack = game.packs.get(collection);
    if (!pack) {
      continue;
    }

    const documents = (await pack.getDocuments()).map(doc => doc.toObject());
    const folders = [...(pack.folders ?? [])].map(folder => folder.toObject());
    const name = pack.metadata.name;
    packs.push({ name, collection: pack.documentClass.metadata.collection, documents, folders });
    packMeta.push({ name, label: pack.metadata.label, type: pack.documentName, folders: folderChain(pack) });
    onProgress?.((index + 1) / steps * 0.6);
  }

  // The world's files the documents use, copied in.
  let plan = new Map();
  const assets = [];
  const missing = [];
  if (bundleAssets) {
    plan = assetPlan(assetRefs(packs.flatMap(pack => [...pack.documents, ...pack.folders])), id);
    const total = plan.size;
    let done = 0;
    for (const [original, target] of plan) {
      try {
        const response = await fetch(foundry.utils.getRoute(original.replace(/^\/+/, "")));
        if (!response.ok) {
          throw new Error(String(response.status));
        }

        assets.push({ zipPath: target.zipPath, data: new Uint8Array(await response.arrayBuffer()) });
      } catch {
        missing.push(original);
        plan.delete(original);
      }

      onProgress?.(0.6 + (++done / total) * 0.3);
    }
  }

  const lines = (game.settings.get("essence20", CUSTOM_GAME_LINES_SETTING) ?? []).filter(line => lineIds.includes(line.id));
  const rules = (game.settings.get("essence20", WORLD_HOUSE_RULES_SETTING) ?? []).filter(rule => ruleIds.includes(rule.id)).map(moduleHouseRule);
  const settings = Object.fromEntries(settingKeys.filter(key => EXPORTABLE_SETTINGS.includes(key)).map(key => [key, game.settings.get("essence20", key)]));

  const manifest = moduleManifest({
    id, title, version, author, description: description ? `<p>${foundry.utils.escapeHTML(description)}</p>` : "",
    core: { generation: game.release.generation, version: game.version },
    systemVersion: game.system.version,
    packs: packMeta, packFolders: packFoldersFor(packMeta), gameLines: lines, houseRules: rules, settings,
  });
  const readme = game.i18n.format("E20.HomebrewExportReadme", { title, id, world: game.world.title, system: game.system.version });
  const files = moduleFiles(manifest, packs, { plan, assets, readme, hierarchy });
  return { bytes: zipFiles(files), packs: packs.length, assets: assets.length, missing };
}
