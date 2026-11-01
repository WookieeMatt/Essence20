/**
 * Homebrew game lines (Configure Settings > Game Lines, apps/game-lines-config.mjs): a GM's own line - "M.A.S.K.",
 * "ThunderCats" - built on one of the five book lines' rules (its family). A Role keeps its `version` as the family, so
 * every "is this a GI Joe Role?" check keeps working, and names the homebrew line in its own `gameLine` field.
 *
 * Lines come from two places: the world's `customGameLines` setting, and any active module's manifest
 * (`flags.essence20.gameLines` in module.json - a module ships a line with no code). A world line wins over a module's
 * line with the same id.
 *
 * A line's rules switches (line-profiles.mjs) are its book line's, with any the homebrew line sets in its own `rules` on
 * top; lineRule() / roleRule() read them.
 *
 * Imports only line-terms.mjs, line-look.mjs and line-profiles.mjs, all import-free (game-lines.mjs and the rules' line
 * tags read it, and jest loads it without Foundry).
 */

import { normalizeLineRules, profileRule } from "./line-profiles.mjs";
import { normalizeLook } from "./line-look.mjs";
import { normalizeTerms } from "./line-terms.mjs";

/** The world setting holding the world's own lines (settings.js). */
export const CUSTOM_GAME_LINES_SETTING = 'customGameLines';

/** The book lines a homebrew line can take its rules from, by their game line keys (E20.gameVersions). */
export const LINE_FAMILIES = Object.freeze(['giJoe', 'powerRangers', 'transformers', 'myLittlePony', 'welcomeToNightVale']);

// The book lines' short codes too (game-lines.mjs#LINE_CODES), so a homebrew id never shadows one.
// Lower-cased, as ids are.
const RESERVED = new Set([...LINE_FAMILIES, 'gij', 'pr', 'tf', 'mlp', 'wtnv', 'other', 'all'].map(key => key.toLowerCase()));

let registry = [];

/**
 * An id from a line's name: lower-case letters, digits and hyphens ("M.A.S.K." -> "mask").
 * @param {String} label
 * @returns {String}
 */
export function lineIdFrom(label) {
  // Dots go first, so an acronym stays one word.
  return String(label ?? '').toLowerCase().replace(/\./g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/**
 * A line as stored, tidied: null when it can't be used (no name, an id a book line already uses, an unknown family).
 * @param {Object} raw   {id, label, family, packFolder, specializations: {skill: [names]}, terms: {book word: its own},
 *   canMorph: its characters Morph whatever its book line (He-Man, Jem, SilverHawks), look: line-look.mjs's,
 *   rules: its own rules switches over its book line's (line-profiles.mjs)}
 * @param {String} [source]   Where it came from: 'world', or the module's id.
 * @returns {Object|null}
 */
export function normalizeLine(raw, source = 'world') {
  if (!raw || typeof raw != 'object') {
    return null;
  }

  const label = String(raw.label ?? '').trim();
  const id = lineIdFrom(raw.id || label);
  if (!label || !id || RESERVED.has(id) || !LINE_FAMILIES.includes(raw.family)) {
    return null;
  }

  const specializations = {};
  for (const [skill, names] of Object.entries(raw.specializations ?? {})) {
    const list = (Array.isArray(names) ? names : String(names ?? '').split(','))
      .map(name => String(name ?? '').trim()).filter(Boolean);
    if (list.length) {
      specializations[skill] = [...new Set(list)];
    }
  }

  // The older canMorph tick is the Morph switch turned on.
  const rules = normalizeLineRules(raw.rules);
  if (raw.canMorph === true && rules.canMorph === undefined) {
    rules.canMorph = true;
  }

  return {
    id, label, family: raw.family, packFolder: String(raw.packFolder ?? '').trim(), specializations, terms: normalizeTerms(raw.terms),
    canMorph: raw.canMorph === true, look: normalizeLook(raw.look), rules, source,
  };
}

/**
 * Replace the registry: the world's lines, then the modules' (a module line whose id the world already uses is left out).
 * @param {Array<Object>} worldLines   The customGameLines setting.
 * @param {Array<{id: String, lines: Array<Object>}>} [moduleLines]   Each active module's flags.essence20.gameLines.
 * @returns {Array<Object>}   The new registry.
 */
export function setCustomLines(worldLines = [], moduleLines = []) {
  const out = [];
  const seen = new Set();
  const add = (raw, source) => {
    const line = normalizeLine(raw, source);
    if (line && !seen.has(line.id)) {
      seen.add(line.id);
      out.push(line);
    }
  };

  for (const raw of Array.isArray(worldLines) ? worldLines : []) {
    add(raw, 'world');
  }

  for (const { id, lines } of moduleLines ?? []) {
    for (const raw of Array.isArray(lines) ? lines : []) {
      add(raw, id);
    }
  }

  registry = out;
  return registry;
}

/** Every homebrew line, the world's first. */
export function customLines() {
  return registry;
}

/**
 * A homebrew line by its id; null for a book line or anything unknown.
 * @param {String} id
 * @returns {Object|null}
 */
export function customLine(id) {
  const key = String(id ?? '').trim().toLowerCase();
  return key ? registry.find(line => line.id == key) ?? null : null;
}

/**
 * The book line whose rules a line uses: a homebrew line's family, a book line's own key; '' when it's neither.
 * @param {String} line   A game line key (giJoe), a homebrew id (mask), or ''.
 * @returns {String}
 */
export function lineFamily(line) {
  const text = String(line ?? '').trim();
  if (LINE_FAMILIES.includes(text)) {
    return text;
  }

  return customLine(text)?.family ?? '';
}

/**
 * The homebrew lines built on one book line (a Role sheet offers these once its line is picked).
 * @param {String} family
 * @returns {Array<Object>}
 */
export function customLinesOf(family) {
  return registry.filter(line => line.family == family);
}

/**
 * A Role's homebrew line: the one it names, while that line is still built on the Role's own book line (a Role switched
 * to another book line afterwards keeps the old name stored, and it no longer counts).
 * @param {Item} role
 * @returns {Object|null}
 */
export function roleCustomLine(role) {
  const line = customLine(role?.system?.gameLine);
  return line && line.family == role.system.version ? line : null;
}

/**
 * One of a line's rules switches (line-profiles.mjs#LINE_RULES): a homebrew line's own setting, else its book line's,
 * else the core rules' (no line - an all-lines world).
 * @param {String} line   A game line key (giJoe), a homebrew id (mask), or ''.
 * @param {String} key   A LINE_RULES key.
 * @returns {*}
 */
export function lineRule(line, key) {
  const homebrew = customLine(line);
  return profileRule(homebrew?.family ?? lineFamily(line), key, homebrew?.rules);
}

/**
 * The world's Game Line setting as stored: a book line key, a homebrew id, or '' (every line). '' without Foundry, and
 * for a homebrew line that's gone (deleted, or its module turned off) - it has no rules to apply.
 * @returns {String}
 */
export function worldLineId() {
  let line = '';
  try {
    line = String(globalThis.game?.settings?.get?.('essence20', 'gameLine') ?? '');
  } catch {
    return '';
  }

  return LINE_FAMILIES.includes(line) || customLine(line) ? line : '';
}

/**
 * One rules switch for the world's line ('' - every line - gives the core rules').
 * @param {String} key   A LINE_RULES key.
 * @returns {*}
 */
export function worldRule(key) {
  return lineRule(worldLineId(), key);
}

/**
 * A Role's line for lineRule(): its homebrew line's id, else its book line's key; '' with no Role.
 * @param {Item} role
 * @returns {String}
 */
export function roleLine(role) {
  return roleCustomLine(role)?.id || role?.system?.version || '';
}

/**
 * Whose rules a Role's character plays by: the world's line when one is set - pick G.I. Joe and the G.I. Joe rules
 * apply to everyone - unless the Role is on a homebrew line built on that same book line (a M.A.S.K. Role in a G.I. Joe
 * world keeps M.A.S.K.'s switches). With no world line, the Role's own.
 * @param {Item} role
 * @param {String} [world]   The world's line (worldLineId()).
 * @returns {String}
 */
export function ruleLineFor(role, world = worldLineId()) {
  return lineInWorld(roleLine(role), world);
}

/** Whose rules something on `own`'s line plays by in a world on `world` (ruleLineFor's rule). */
function lineInWorld(own, world) {
  if (!world || own == world || (customLine(own) && customLine(own).family == lineFamily(world))) {
    return own || world;
  }

  return world;
}

/** The actor flag naming the line an actor plays by, when it has no Role to say (a Megaform, Vehicle, Zord or NPC). */
export const RULES_LINE_FLAG = 'rulesLine';

/**
 * An actor's own line: the one the GM picked for it (its rulesLine flag - a book line key or a homebrew id), else its
 * base Role's; '' when neither says.
 * @param {Actor} actor
 * @returns {String}
 */
export function actorLine(actor) {
  const picked = String(actor?.flags?.essence20?.[RULES_LINE_FLAG] ?? '');
  if (picked && (LINE_FAMILIES.includes(picked) || customLine(picked))) {
    return picked;
  }

  const items = actor?.items?.contents ?? [...(actor?.items ?? [])];
  const roles = items.filter(item => item?.type == 'role');
  return roleLine(roles.find(role => !role.system?.isAdditive) ?? roles[0]);
}

/**
 * Whose rules an actor plays by: as ruleLineFor, with the GM's pick for it standing in for a Role. In a Crossover world
 * (no world line) that's the actor's own line - this Megaform forms like Voltron, that one like Bruticus.
 * @param {Actor} actor
 * @param {String} [world]   The world's line (worldLineId()).
 * @returns {String}
 */
export function actorRulesLine(actor, world = worldLineId()) {
  return lineInWorld(actorLine(actor), world);
}

/**
 * One rules switch for an actor (actorRulesLine's line).
 * @param {Actor} actor
 * @param {String} key   A LINE_RULES key.
 * @param {String} [world]   The world's line (worldLineId()).
 * @returns {*}
 */
export function actorRule(actor, key, world = worldLineId()) {
  return lineRule(actorRulesLine(actor, world), key);
}

/**
 * One rules switch for a Role's character (ruleLineFor's line).
 * @param {Item} role
 * @param {String} key   A LINE_RULES key.
 * @param {String} [world]   The world's line (worldLineId()).
 * @returns {*}
 */
export function roleRule(role, key, world = worldLineId()) {
  return lineRule(ruleLineFor(role, world), key);
}

/**
 * Whether a Role lets its character Morph (system.canMorph, set when the Role is added): a Power Rangers Role, or one on
 * a homebrew line that Morphs.
 * @param {Item} role
 * @returns {Boolean}
 */
export function roleGrantsMorph(role) {
  return !!roleRule(role, 'canMorph');
}

/**
 * A Role's suggested Specializations, by Skill: its book line's, plus its homebrew line's own.
 * @param {Item} role
 * @param {Object} standard   CONFIG.E20.standardSpecializations.
 * @returns {Object<String, Array<String>>}
 */
export function specializationsForRole(role, standard = {}) {
  const out = {};
  for (const [skill, names] of Object.entries(standard?.[role?.system?.version] ?? {})) {
    out[skill] = [...names];
  }

  for (const [skill, names] of Object.entries(roleCustomLine(role)?.specializations ?? {})) {
    out[skill] = [...new Set([...(out[skill] ?? []), ...names])];
  }

  return out;
}

/**
 * The homebrew line whose compendium folder this is (the folder or one it sits in); null when none.
 * @param {Array<String>} folderNames   The pack's folder, then the folders it sits in.
 * @returns {Object|null}
 */
export function customLineForFolders(folderNames = []) {
  const names = folderNames.filter(Boolean);
  return registry.find(line => line.packFolder && names.includes(line.packFolder)) ?? null;
}
