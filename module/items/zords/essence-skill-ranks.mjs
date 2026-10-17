/**
 * Zord Features that raise Strength "with associated skill ranks" (PR CRB p.136: Auxiliary Zord and Carrier, +2;
 * Across the Stars p.104: Warzord, +3): each point of Strength comes with a rank in one of the Zord's Strength Skills
 * (Athletics, Brawn, Intimidation, Might). The Strength itself is the Feature's own Active Effect.
 *
 * When the Feature lands on a Zord, its owner places the ranks; they are kept as an Active Effect on the Feature (a ↑ per
 * rank on the chosen Skills - shiftUp, as a rank reads on a roll), so they go when the Feature goes. The Feature's Use
 * button places them again.
 */
import { registerUse } from "../../mechanics/item-hooks.mjs";
import { sourceOf } from "../shared/item-lookups.mjs";

const C = (pack, id) => `Compendium.essence20.${pack}.Item.${id}`;
export const RANK_FEATURES = {
  [C('pr_crb', 'QO0kY1y359tSnPTS')]: { essence: 'strength', ranks: 2 }, // Auxiliary Zord
  [C('pr_crb', 'h1b0cjGJP1xqtfVv')]: { essence: 'strength', ranks: 2 }, // Carrier
  [C('across_the_stars', 'jX5IHpydHimdjbGb')]: { essence: 'strength', ranks: 3 }, // Warzord
};
export const RANKS_FLAG = 'zordSkillRanks';
const EFFECT_NAME = 'Skill Ranks';

const T = (key, data) => (data ? game.i18n.format(`E20.${key}`, data) : game.i18n.localize(`E20.${key}`));

/** What this Feature gives, or null. */
export const rankSpecOf = item => (item?.parent?.type == 'zord' ? RANK_FEATURES[sourceOf(item)] ?? null : null);

/** The Active Effect data for placed ranks ({skill: count}). Exported for tests. */
export function rankEffectData(item, picks) {
  return {
    name: `${item.name}: ${EFFECT_NAME}`,
    img: item.img ?? 'icons/svg/upgrade.svg',
    transfer: true,
    disabled: false,
    type: 'base',
    changes: Object.entries(picks).filter(([, count]) => count > 0)
      .map(([skill, count]) => ({ key: `system.skills.${skill}.shiftUp`, mode: 2, value: String(count), priority: null })),
  };
}

/** Ask where the ranks go: {skill: count}, or null when cancelled. */
async function askRanks(item, spec) {
  const skills = CONFIG.E20.skillsByEssence[spec.essence] ?? [];
  const options = skills.map(skill => `<option value="${skill}">${game.i18n.localize(CONFIG.E20.skills?.[skill] ?? skill)}</option>`).join('');
  const rows = Array.from({ length: spec.ranks }, (_, i) => `<div class="form-group"><label>${T('ZordSkillRankN', { n: i + 1 })}</label><select name="rank${i}">${options}</select></div>`).join('');
  const picked = await foundry.applications.api.DialogV2.wait({
    window: { title: item.name },
    classes: ['window-app', 'e20-window'],
    content: `<p>${T('ZordSkillRanksPrompt', { name: item.parent.name, item: item.name, ranks: spec.ranks, essence: game.i18n.localize(CONFIG.E20.essences[spec.essence] ?? spec.essence) })}</p>${rows}`,
    buttons: [
      { action: 'ok', label: T('ZordGrowthChoose'), default: true, callback: (event, button) => Array.from({ length: spec.ranks }, (_, i) => button.form.elements[`rank${i}`].value) },
      { action: 'later', label: T('ZordGrowthLater') },
    ],
    rejectClose: false,
  });
  if (!Array.isArray(picked)) {
    return null;
  }

  return picked.reduce((counts, skill) => ({ ...counts, [skill]: (counts[skill] ?? 0) + 1 }), {});
}

/** Place (or place again) the Feature's ranks. */
export async function placeRanks(item) {
  const spec = rankSpecOf(item);
  if (!spec) {
    return false;
  }

  const picks = await askRanks(item, spec);
  if (!picks) {
    return false;
  }

  const old = item.effects.filter(effect => effect.name?.endsWith(`: ${EFFECT_NAME}`)).map(effect => effect.id);
  if (old.length) {
    await item.deleteEmbeddedDocuments('ActiveEffect', old);
  }

  await item.createEmbeddedDocuments('ActiveEffect', [rankEffectData(item, picks)]);
  await item.setFlag('essence20', RANKS_FLAG, picks);
  return true;
}

if (typeof Hooks != 'undefined') {
  Hooks.on('createItem', (item, options, userId) => {
    if (userId == game.user?.id && rankSpecOf(item) && !item.flags?.essence20?.[RANKS_FLAG]) {
      placeRanks(item).catch(error => console.error('Essence20 | Zord skill ranks', error));
    }
  });
}

registerUse({
  id: 'zord-essence-skill-ranks',
  matches: item => !!rankSpecOf(item),
  run: async item => {
    await placeRanks(item);
    return null;
  },
});
