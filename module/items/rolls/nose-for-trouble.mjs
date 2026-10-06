import { registerPreRoll } from "../../mechanics/item-hooks.mjs";
import { G2 } from "../shared/gij-crb-item-lookups.mjs";
import { TFull as T } from "../shared/item-lang.mjs";
import { findSourced, has as hasItem } from "../shared/item-lookups.mjs";

/**
 * Nose For Trouble (GI JOE CRB, General Perk, p.132): "You may use Streetwise in place of Alertness to search for
 * clues or look for traps." Offered on a plain Alertness test when Streetwise is the better die (the Initiative
 * bullet is dice.mjs's own checkbox).
 */

const SHIFTS = () => CONFIG.E20?.skillShiftList ?? [];

export function streetwiseIsBetter(actor) {
  const list = SHIFTS();
  const street = list.indexOf(actor?.system?.skills?.streetwise?.shift);
  const alert = list.indexOf(actor?.system?.skills?.alertness?.shift);
  return street >= 0 && (alert < 0 || street < alert);
}

registerPreRoll(async (actor, dataset, item) => {
  if (item || dataset?.skill != 'alertness' || !hasItem(actor, G2.noseForTrouble) || !streetwiseIsBetter(actor)) {
    return;
  }

  const perk = findSourced(actor, G2.noseForTrouble);
  const swap = await foundry.applications.api.DialogV2.confirm({
    window: { title: perk.name },
    content: `<p>${T('E20.Gij2NoseStreetwisePrompt')}</p>`,
    rejectClose: false,
  });
  if (swap) {
    dataset.skill = 'streetwise';
    dataset.essence = CONFIG.E20.skillToEssence.streetwise;
    dataset.isSpecialized = false;
  }
});
