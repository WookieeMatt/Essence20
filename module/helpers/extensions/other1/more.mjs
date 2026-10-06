import { registerUse } from "../../extensions.mjs";
import { DSOE, T, isFrom, itemsOf } from "./shared.mjs";

/**
 * Dark Skies over Equestria (Multimorph). Armor Matrix's one-matrix limit is its items' own rules (a create Veto
 * and an OnlyBest Toughness rule - module/rules/ext/b/veto.mjs, ext/g/best.mjs). Distill His Essence and Eat the
 * Weak are Use rules on their pack items, and Champion His Way a Defense rule on its.
 */
export const O1_MORE = {
  multimorph: DSOE('HGKHAbwZ43I564vd'),
};

/* -------------------------------------------- */
/*  Rites of the All-Consuming                   */
/* -------------------------------------------- */

// Rites of the All-Consuming (Decepticon Directive, p.111): "For every Skill Rank in the Culture
// skill, a Follower with the Word of Unicron General Perk... gains the Rite associated with the die
// of that Skill Rank." Each Rite is its own Perk (prerequisite: Word of Unicron and the Culture die).
// Champion His Way (+d10, +2 to all Defenses while holding Dark Energon) is a Defense rule on its
// pack item.

// Eat the Weak (+d2) is its own Use rule: a Culture test against the target's (or, with no target, its own) Willpower
// that removes an Addicted (Dark Energon) Hang-Up. The removed duplicate printing is linked to it by name
// (rules/inherit.mjs#linkExistingCopies).

/* -------------------------------------------- */
/*  Multimorph                                   */
/* -------------------------------------------- */

// Multimorph (Dark Skies over Equestria, General Perk, p.21): "When you change your shape, you
// temporarily gain the benefits of two Origin Perks of your choice from two different Origins.
// Alternatively, you can gain the benefits of one of the other Origin's Origin Perks of your choice
// and keep the benefits of your Natural Shape." The Use button is the shape change: it grants the
// chosen Origin Perks as temporary copies for the scene; pressed again it changes back.
const MLP_PACKS = /\.(mlp_crb|knights_of_canterlot|dark_skies_over_equestria|in_a_jam|story_of_the_seasons)\./;
const morphCopies = actor => itemsOf(actor).filter(item => item.flags?.essence20?.o1Multimorph);

export function otherOrigins(rows, actor) {
  const own = new Set(itemsOf(actor).filter(item => item.type == 'origin').map(item => item.name));
  return rows.filter(row => MLP_PACKS.test(row.uuid ?? '') && !own.has(row.name)
    && Object.values(row.system?.items ?? {}).some(entry => entry?.type == 'perk'));
}

async function pickOriginPerk(title, origins, excludeOrigin) {
  const { chooseSelect } = await import("../../grants.mjs");
  const options = [];
  for (const origin of origins) {
    if (origin.uuid == excludeOrigin) {
      continue;
    }

    for (const entry of Object.values(origin.system?.items ?? {})) {
      if (entry?.type == 'perk' && entry.uuid) {
        options.push({ value: `${origin.uuid}|${entry.uuid}`, label: `${origin.name}: ${entry.name}` });
      }
    }
  }

  options.sort((a, b) => a.label.localeCompare(b.label));
  const choice = await chooseSelect(title, T('O1MultimorphPick'), options);
  return choice ? choice.split('|') : null;
}

registerUse({
  id: 'o1Multimorph',
  matches: isFrom(O1_MORE.multimorph),
  run: async (item) => {
    const actor = item.parent;
    const current = morphCopies(actor);
    if (current.length) {
      await actor.deleteEmbeddedDocuments('Item', current.map(copy => copy.id));
      return T('O1MultimorphEnd', { name: actor.name });
    }

    const { chooseButtons, findItems, grantCopy, temporary } = await import("../../grants.mjs");
    const mode = await chooseButtons(item.name, T('O1MultimorphMode'), [['two', T('O1MultimorphTwo')], ['one', T('O1MultimorphOne')]]);
    if (!['two', 'one'].includes(mode)) {
      return null;
    }

    const origins = otherOrigins(await findItems({ type: 'origin' }), actor);
    const first = await pickOriginPerk(item.name, origins, null);
    if (!first) {
      return null;
    }

    const picks = [first[1]];
    if (mode == 'two') {
      const second = await pickOriginPerk(item.name, origins, first[0]);
      if (!second) {
        return null;
      }

      picks.push(second[1]);
    }

    const names = [];
    for (const uuid of picks) {
      const created = await grantCopy(actor, uuid, { grantedBy: item, temporary: temporary('scene'), flags: { o1Multimorph: true } });
      if (created) {
        names.push(created.name);
      }
    }

    return T(mode == 'two' ? 'O1MultimorphTwoDone' : 'O1MultimorphOneDone', { name: actor.name, perks: names.join(', ') });
  },
});
