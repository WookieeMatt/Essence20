/**
 * Which game line a compendium entry belongs to, by its pack: gij, pr, tf, mlp, wtnv or other. Shared by
 * mechanics/resources/grants.mjs (pickPerkFrom's `line`) and the rules' item:line tag (rules/plugins/picks/entry-grants.mjs).
 * Import-free.
 * @param {String} uuid   A compendium uuid (Compendium.essence20.<pack>.Item.<id>).
 * @returns {String}
 */
export function lineOf(uuid) {
  const pack = String(uuid ?? '').split('.')[2] ?? '';
  if (/^(gi_joe|cobra|quartermaster|general_hawk|intercontinental|ferocious|sgt_slaughter|operation_)/.test(pack)) return 'gij';
  if (/^(pr_|power_rangers|across_the_stars|jump_through|through_the_shattered|finster|beneath)/.test(pack)) return 'pr';
  if (/^(tf_|decepticon|enigma|technorganic|transformers)/.test(pack)) return 'tf';
  if (/^(mlp|knights_of|dark_skies_over_equestria|in_a_jam|story_of_the_seasons)/.test(pack)) return 'mlp';
  if (/^wtnv/.test(pack)) return 'wtnv';
  return 'other';
}
