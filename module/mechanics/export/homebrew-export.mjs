/**
 * Export Homebrew (Configure Settings > Export Homebrew, apps/homebrew-export.mjs): a world's homebrew as a module anyone
 * can install - its compendiums (with their folders), homebrew game lines, house rules and chosen settings - built in
 * the browser and downloaded as one zip. Unzipped into Data/modules it works with no build step and no code:
 * - each pack is a ready LevelDB database (leveldb-writer.mjs), keyed as the Foundry CLI keys them;
 * - lines, house rules and settings ride in module.json's flags.essence20 ({gameLines, houseRules, settings}), which
 *   the system reads from any active module (settings.js#syncCustomGameLines, rules/house-rules.mjs#syncModuleHouseRules,
 *   mechanics/export/module-settings.mjs);
 * - images and sounds the documents use from the world (not the system's, core's or another module's) are copied into
 *   the module's assets/ and the documents repointed.
 *
 * Import-free apart from its two writers: jest runs it as is.
 */

import { levelDbFiles } from "./leveldb-writer.mjs";

/**
 * Embedded collections per document collection, as the Foundry CLI lays them out: an array is an embedded collection,
 * an object one embedded document. The export reads the running Foundry's own (apps/homebrew-export.mjs#packHierarchy),
 * which knows newer ones such as a Scene's regions and levels; this is the fallback and the tests'.
 */
export const PACK_HIERARCHY = Object.freeze({
  actors: { items: [], effects: [] },
  cards: { cards: [] },
  combats: { combatants: [] },
  delta: { items: [], effects: [] },
  items: { effects: [] },
  journal: { pages: [] },
  playlists: { sounds: [] },
  tables: { results: [] },
  tokens: { delta: {} },
  scenes: { drawings: [], tokens: [], lights: [], notes: [], sounds: [], templates: [], tiles: [], walls: [] },
});

/** A pack's document type to its database collection. */
export const PACK_COLLECTIONS = Object.freeze({
  Actor: 'actors', Adventure: 'adventures', Cards: 'cards', Item: 'items', JournalEntry: 'journal', Macro: 'macros',
  Playlist: 'playlists', RollTable: 'tables', Scene: 'scenes',
});

/** Settings an export may carry (each only when it differs from its default): the ones that shape a game. */
export const EXPORTABLE_SETTINGS = Object.freeze([
  'gameLine', 'vehicleAltModes', 'crossoverTerms', 'episodeTools', 'missionTemplates', 'prerequisiteMode',
  'sptPointsName', 'actionEconomyMode', 'actionEconomyMovement', 'monsterGrowHealthMode', 'enabledSourcebooks', 'houseRules',
]);

/**
 * A module id from a title: lower-case letters, digits and hyphens.
 * @param {String} title
 * @returns {String}
 */
export function moduleIdFrom(title) {
  return String(title ?? '').toLowerCase().replace(/\./g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** A module version Foundry accepts: digits and dots. */
export const validVersion = version => /^\d+(\.\d+)*$/.test(String(version ?? '').trim());

/**
 * A pack's database entries: every document and folder under its key, embedded documents under their own, each parent
 * holding its embedded documents' ids - the Foundry CLI's layout.
 * @param {String} collection   'items', 'actors'... (PACK_COLLECTIONS).
 * @param {Array<Object>} documents   Source data (toObject()), embedded documents inline.
 * @param {Array<Object>} [folders]   The pack's folders' source data.
 * @param {Object} [hierarchy]   PACK_HIERARCHY's shape.
 * @returns {Array<[String, String]>}   [key, JSON] pairs.
 */
export function packEntries(collection, documents, folders = [], hierarchy = PACK_HIERARCHY) {
  const entries = [];
  const put = (doc, name, sublevelPrefix = '', idPrefix = '') => {
    const sublevel = [sublevelPrefix, name].filter(Boolean).join('.');
    const id = [idPrefix, doc._id].filter(Boolean).join('.');
    const value = { ...doc };
    for (const [embedded, kind] of Object.entries(hierarchy[name] ?? {})) {
      const inner = doc[embedded];
      if (Array.isArray(kind)) {
        const list = Array.isArray(inner) ? inner : [];
        list.forEach(child => put(child, embedded, sublevel, id));
        value[embedded] = list.map(child => child._id);
      } else if (inner) {
        put(inner, embedded, sublevel, id);
        value[embedded] = inner._id;
      } else {
        value[embedded] = null;
      }
    }

    entries.push([`!${sublevel}!${id}`, JSON.stringify(value)]);
  };

  const folderIds = new Set(folders.map(folder => folder._id));
  for (const folder of folders) {
    put({ ...folder, folder: folderIds.has(folder.folder) ? folder.folder : null }, 'folders');
  }

  for (const doc of documents) {
    put({ ...doc, folder: folderIds.has(doc.folder) ? doc.folder : null }, collection);
  }

  return entries;
}

/**
 * module.json's packFolders for packs sitting in the world's compendium folders, nested as they are (Foundry allows
 * three levels; deeper ones join the third).
 * @param {Array<{name: String, folders: Array<{id: String, name: String, color?: String, sorting?: String}>}>} packs
 *   Each pack's folder chain, outermost first ([] for a pack at the top).
 * @returns {Array<Object>}
 */
export function packFoldersFor(packs) {
  const roots = [];
  const byId = new Map();
  for (const pack of packs) {
    const chain = (pack.folders ?? []).slice(0, 3);
    let siblings = roots;
    let node = null;
    for (const folder of chain) {
      node = byId.get(folder.id);
      if (!node) {
        node = { name: folder.name, sorting: folder.sorting == 'm' ? 'm' : 'a', color: folder.color || null, packs: [], folders: [] };
        byId.set(folder.id, node);
        siblings.push(node);
      }

      siblings = node.folders;
    }

    node?.packs.push(pack.name);
  }

  const tidy = node => {
    node.folders.forEach(tidy);
    if (!node.color) {
      delete node.color;
    }
  };

  roots.forEach(tidy);
  return roots;
}

const MEDIA = /\.(apng|avif|bmp|gif|jpe?g|png|svg|tiff?|webp|flac|m4a|mp3|og[ag]|opus|wav|m4v|mp4|ogv|webm|pdf)$/i;
// Paths a fresh install already has: the system's, core's own art and sounds, other modules', and anything remote.
const SHIPPED = /^(?:[a-z][a-z0-9+.-]*:|systems\/|modules\/|icons\/|ui\/|cards\/|sounds\/|canvas\/|nue\/|#)/i;

/** Whether a document's path is a file of this world's that the module must carry. */
export function isLocalAsset(value) {
  if (typeof value != 'string') {
    return false;
  }

  const path = value.trim().replace(/^\/+/, '');
  return !!path && !/\s{2}|[<>"]/.test(path) && MEDIA.test(path.split(/[?#]/)[0]) && !SHIPPED.test(path);
}

const HTML_REF = /(\b(?:src|href)\s*=\s*")([^"]+)(")/gi;

/** Calls fn(path) for every world file a value names: whole-string paths, and src/href inside HTML. */
function eachRef(value, fn) {
  if (typeof value == 'string') {
    if (isLocalAsset(value)) {
      fn(value);
    } else if (value.includes('<')) {
      for (const match of value.matchAll(HTML_REF)) {
        if (isLocalAsset(match[2])) {
          fn(match[2]);
        }
      }
    }
  } else if (Array.isArray(value)) {
    value.forEach(entry => eachRef(entry, fn));
  } else if (value && typeof value == 'object') {
    Object.values(value).forEach(entry => eachRef(entry, fn));
  }
}

/**
 * Every world file the documents use, in the order found.
 * @param {Array<Object>} documents   Source data, folders and all.
 * @returns {Array<String>}
 */
export function assetRefs(documents) {
  const refs = new Set();
  eachRef(documents, ref => refs.add(ref));
  return [...refs];
}

/**
 * Where each world file goes in the module: assets/ plus its path, a world's own folder (worlds/<id>/) and a leading
 * assets/ dropped, so worlds/x/assets/art/a.png becomes assets/art/a.png.
 * @param {Array<String>} refs
 * @param {String} moduleId
 * @returns {Map<String, {ref: String, zipPath: String}>}   By the original path: the new path, and the file in the zip
 *   (decoded, under the module's folder).
 */
export function assetPlan(refs, moduleId) {
  const plan = new Map();
  const taken = new Set();
  for (const original of refs) {
    let rest = original.trim().replace(/^\/+/, '').replace(/^worlds\/[^/]+\//, '').replace(/^assets\//, '').split(/[?#]/)[0];
    let decoded = rest;
    try {
      decoded = decodeURIComponent(rest);
    } catch {
      // A stray % - keep it as written.
    }

    // Two files ending in the same path (from two worlds): number the later one.
    let n = 1;
    const base = decoded;
    while (taken.has(decoded.toLowerCase())) {
      n += 1;
      decoded = base.replace(/(\.[^./]+)$/, `-${n}$1`);
      rest = decoded;
    }

    taken.add(decoded.toLowerCase());
    plan.set(original, { ref: `modules/${moduleId}/assets/${rest}`, zipPath: `${moduleId}/assets/${decoded}` });
  }

  return plan;
}

/**
 * A copy of a value with every world file repointed by the plan.
 * @param {*} value
 * @param {Map<String, {ref: String}>} plan   assetPlan's.
 * @returns {*}
 */
export function repointAssets(value, plan) {
  if (typeof value == 'string') {
    if (plan.has(value)) {
      return plan.get(value).ref;
    }

    return value.includes('<') ? value.replace(HTML_REF, (all, open, ref, close) => (plan.has(ref) ? `${open}${plan.get(ref).ref}${close}` : all)) : value;
  }

  if (Array.isArray(value)) {
    return value.map(entry => repointAssets(entry, plan));
  }

  if (value && typeof value == 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, repointAssets(entry, plan)]));
  }

  return value;
}

/**
 * A world house rule as a module ships it.
 * @param {{id, label, hint, rules}} rule
 * @returns {Object}
 */
export const moduleHouseRule = rule => ({
  id: String(rule.id), label: String(rule.label ?? rule.id), hint: rule.hint ? String(rule.hint) : '', rules: Array.isArray(rule.rules) ? rule.rules : [],
});

/**
 * The module's manifest.
 * @param {Object} options
 * @param {String} options.id
 * @param {String} options.title
 * @param {String} options.version
 * @param {String} [options.author]
 * @param {String} [options.description]
 * @param {{generation: Number|String, version: String}} options.core   game.release's.
 * @param {String} options.systemVersion   Left out of the requirement when it isn't a version (a development checkout's
 *   system.json placeholder).
 * @param {Array<{name, label, type}>} options.packs
 * @param {Array<Object>} [options.packFolders]
 * @param {Array<Object>} [options.gameLines]
 * @param {Array<Object>} [options.houseRules]
 * @param {Object} [options.settings]   {key: value}.
 * @returns {Object}
 */
export function moduleManifest({ id, title, version, author = '', description = '', core, systemVersion, packs, packFolders = [], gameLines = [], houseRules = [], settings = {} }) {
  const essence20 = {};
  if (gameLines.length) {
    essence20.gameLines = gameLines;
  }

  if (houseRules.length) {
    essence20.houseRules = houseRules;
  }

  if (Object.keys(settings).length) {
    essence20.settings = settings;
  }

  return {
    id, title, description, version,
    authors: author ? [{ name: author }] : [],
    compatibility: { minimum: String(core.generation), verified: String(core.version) },
    relationships: { systems: [{ id: 'essence20', type: 'system', ...(validVersion(systemVersion) ? { compatibility: { minimum: systemVersion } } : {}) }] },
    packs: packs.map(pack => ({
      name: pack.name, label: pack.label, path: `packs/${pack.name}`, type: pack.type,
      ...(['Actor', 'Item', 'Adventure'].includes(pack.type) ? { system: 'essence20' } : {}),
      ownership: { PLAYER: 'OBSERVER', ASSISTANT: 'OWNER' },
    })),
    ...(packFolders.length ? { packFolders } : {}),
    ...(Object.keys(essence20).length ? { flags: { essence20 } } : {}),
  };
}

/**
 * Every file of the module, under its own folder, ready to zip.
 * @param {Object} manifest   moduleManifest's.
 * @param {Array<{name: String, collection: String, documents: Array<Object>, folders: Array<Object>}>} packs
 * @param {Object} [options]
 * @param {Map} [options.plan]   assetPlan's; documents are repointed by it.
 * @param {Array<{zipPath: String, data: Uint8Array}>} [options.assets]   The files it names, fetched.
 * @param {String} [options.readme]
 * @param {Object} [options.hierarchy]   packEntries'.
 * @returns {Array<{path: String, data: Uint8Array|String}>}
 */
export function moduleFiles(manifest, packs, { plan = new Map(), assets = [], readme = '', hierarchy = PACK_HIERARCHY } = {}) {
  const root = manifest.id;
  const files = [{ path: `${root}/module.json`, data: `${JSON.stringify(manifest, null, 2)}\n` }];
  if (readme) {
    files.push({ path: `${root}/README.md`, data: readme });
  }

  for (const pack of packs) {
    const documents = repointAssets(pack.documents, plan);
    const folders = repointAssets(pack.folders ?? [], plan);
    for (const [name, data] of Object.entries(levelDbFiles(packEntries(pack.collection, documents, folders, hierarchy)))) {
      files.push({ path: `${root}/packs/${pack.name}/${name}`, data });
    }
  }

  for (const asset of assets) {
    files.push({ path: asset.zipPath, data: asset.data });
  }

  return files;
}
