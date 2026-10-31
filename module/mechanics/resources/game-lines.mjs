import { customLine, customLineForFolders, lineFamily, roleCustomLine } from "./custom-game-lines.mjs";

/**
 * Which game line a compendium entry belongs to, by its pack: gij, pr, tf, mlp, wtnv, a homebrew line's id or other.
 * Shared by mechanics/resources/grants.mjs (pickPerkFrom's `line`) and the rules' item:line tag
 * (rules/plugins/picks/entry-grants.mjs). A world or module pack in a homebrew line's compendium folder
 * (mechanics/resources/custom-game-lines.mjs) is that line's, whatever its pack is called.
 * Imports only custom-game-lines.mjs, which is import-free.
 * @param {String} uuid   A compendium uuid (Compendium.essence20.<pack>.Item.<id>).
 * @returns {String}
 */
export function lineOf(uuid) {
  const [, packageName = '', pack = ''] = String(uuid ?? '').split('.');
  const homebrew = packageName != 'essence20' ? customLineOfPack(packageName, pack) : null;
  if (homebrew) return homebrew.id;
  if (/^(gi_joe|cobra|quartermaster|general_hawk|intercontinental|ferocious|sgt_slaughter|operation_)/.test(pack)) return 'gij';
  if (/^(pr_|power_rangers|across_the_stars|jump_through|through_the_shattered|finster|beneath)/.test(pack)) return 'pr';
  if (/^(tf_|decepticon|enigma|technorganic|transformers)/.test(pack)) return 'tf';
  if (/^(mlp|knights_of|dark_skies_over_equestria|in_a_jam|story_of_the_seasons)/.test(pack)) return 'mlp';
  if (/^wtnv/.test(pack)) return 'wtnv';
  return 'other';
}

/** The homebrew line a world or module pack belongs to, by the compendium folder it sits in (or one above it). */
function customLineOfPack(packageName, pack) {
  const folder = globalThis.game?.packs?.get?.(`${packageName}.${pack}`)?.folder;
  if (!folder) {
    return null;
  }

  return customLineForFolders([folder, ...(folder.ancestors ?? [])].map(entry => entry?.name));
}

/** The short codes, by the game line keys a Role's `version` and the world's Game Line setting use. */
export const LINE_CODES = Object.freeze({ giJoe: 'gij', powerRangers: 'pr', transformers: 'tf', myLittlePony: 'mlp', welcomeToNightVale: 'wtnv' });

/** A game line as its short code: from a key (giJoe), a short code (gij) or a homebrew line's id (its own code); '' when it's none of those. */
export function lineCode(value) {
  const text = String(value ?? '').trim();
  if (LINE_CODES[text]) {
    return LINE_CODES[text];
  }

  if (customLine(text)) {
    return customLine(text).id;
  }

  return Object.values(LINE_CODES).includes(text.toLowerCase()) ? text.toLowerCase() : '';
}

/**
 * Which game line an actor belongs to, as a short code (the rules' self:line / target:line tags):
 *  1. its Role's line;
 *  2. a Zord is Power Rangers; a Megaform is a Transformers Combiner or a Power Rangers Megazord;
 *  3. the pack it was taken from, then the line most of its compendium items come from (an NPC built from a book);
 *  4. the world's Game Line setting, if one is chosen (a Stat Block Importer NPC has nothing else to go on).
 * '' when nothing says.
 * @param {Actor} actor
 * @param {String} [worldLine]   The world's Game Line setting (giJoe...).
 * @returns {String}
 */
export function actorLineOf(actor, worldLine = '') {
  if (!actor) {
    return '';
  }

  const items = actor.items?.contents ?? (actor.items ? [...actor.items] : []);
  const role = items.find(item => item?.type == 'role' && !item.system?.isAdditive) ?? items.find(item => item?.type == 'role');
  // A Role on a homebrew line names it in gameLine; its version is the book line it's built on.
  const fromRole = roleCustomLine(role)?.id || lineCode(role?.system?.version);
  if (fromRole) {
    return fromRole;
  }

  if (actor.type == 'zord') {
    return 'pr';
  }

  if (actor.type == 'megaform') {
    const subtype = actor.system?.subtype;
    return (Array.isArray(subtype) ? subtype : [subtype]).includes('megaformCombiner') ? 'tf' : 'pr';
  }

  // An actor taken from a compendium (an adventure's NPCs): its own pack.
  const ownSource = actor._stats?.compendiumSource ?? actor.flags?.core?.sourceId;
  if (ownSource && lineOf(ownSource) != 'other') {
    return lineOf(ownSource);
  }

  const counts = {};
  for (const item of items) {
    const source = item?._stats?.compendiumSource ?? item?.flags?.core?.sourceId;
    const line = source ? lineOf(source) : 'other';
    if (line != 'other') {
      counts[line] = (counts[line] ?? 0) + 1;
    }
  }

  const [best] = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return best?.[0] ?? lineCode(worldLine);
}

/**
 * Whether a line counts as the line a rule asks for (self:line / item:line): the same line or - for a homebrew line -
 * the book line it is built on, so a GI Joe-only rule works for a M.A.S.K. agent.
 * @param {String} actual   A short code or homebrew id (lineOf / actorLineOf).
 * @param {String} wanted   A key, short code or homebrew id.
 * @returns {Boolean}
 */
export function lineMatches(actual, wanted) {
  // Exactly what's asked for (item:line:other included) always matches.
  if (actual && actual == wanted) {
    return true;
  }

  const want = lineCode(wanted);
  if (!want || !actual) {
    return false;
  }

  return actual == want || (!!customLine(actual) && lineCode(lineFamily(actual)) == want);
}
