/**
 * Shinobi of the 63rd Hexagram (Intercontinental Adventures, p.9): "You gain +1 to either
 * Toughness or Evasion and +1 to either Willpower or Cleverness" - the item carries all four as
 * disabled Active Effects; this turns on the chosen two. "Trained in all weapons with the Martial
 * Arts trait" is a plain Active Effect on the item. "You roll Driving Skill Tests to drive
 * motorcycles without a Snag, even if you have no Ranks in the Driving Skill" is not
 * part of this file (it was the old slice's snag.mjs).
 */
import { registerUse } from "../../mechanics/item-hooks.mjs";
import { chat, ZORD2 } from "../zords/combiner-roster-helpers.mjs";
import { T } from "../shared/item-lang.mjs";
import { sourceOf } from "../shared/item-lookups.mjs";

const SHINOBI_KEYS = {
  toughness: 'system.defenses.toughness.bonus',
  evasion: 'system.defenses.evasion.bonus',
  willpower: 'system.defenses.willpower.bonus',
  cleverness: 'system.defenses.cleverness.bonus',
};

export async function pickShinobi(perk) {
  const { chooseButtons } = await import("../../mechanics/resources/grants.mjs");
  const defense = key => game.i18n.localize(CONFIG.E20.defenses[key]);
  const body = await chooseButtons(perk.name, T('Zord2ShinobiPick'), [['toughness', defense('toughness')], ['evasion', defense('evasion')]]);
  if (!body) return null;
  const mind = await chooseButtons(perk.name, T('Zord2ShinobiPick'), [['willpower', defense('willpower')], ['cleverness', defense('cleverness')]]);
  if (!mind) return null;

  const chosen = [SHINOBI_KEYS[body], SHINOBI_KEYS[mind]];
  const updates = Array.from(perk.effects ?? [])
    .filter(e => (e.changes ?? []).some(c => Object.values(SHINOBI_KEYS).includes(c.key)))
    .map(e => ({ _id: e.id, disabled: !(e.changes ?? []).some(c => chosen.includes(c.key)) }));
  if (updates.length) await perk.updateEmbeddedDocuments('ActiveEffect', updates);
  return T('Zord2ShinobiChosen', { a: defense(body), b: defense(mind) });
}

/* -------------------------------------------- */
/*  Wiring                                       */
/* -------------------------------------------- */

registerUse({
  id: 'zord2-shinobi',
  matches: item => sourceOf(item) == ZORD2.shinobi,
  run: async item => pickShinobi(item),
});

if (typeof Hooks != 'undefined') {
  Hooks.on('createItem', async (item, options, userId) => {
    if (userId != game.user?.id || sourceOf(item) != ZORD2.shinobi || !item.parent) return;
    const line = await pickShinobi(item);
    if (line) await chat(item.parent, line);
  });
}
