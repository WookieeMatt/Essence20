import { registerUse } from "../../mechanics/item-hooks.mjs";
import { chooseSelect, TF1 } from "../shared/condition-damage-buttons.mjs";
import { T } from "../shared/item-lang.mjs";
import { has, itemsOf, sourceOfOrUndefined as sourceOf } from "../shared/item-lookups.mjs";
import { altModeUuidsOf, originIndex } from "../shared/origin-chassis-index.mjs";

/**
 * Alt Mode Mimicry (Decepticon Directive, Modemaster, 1st level, p.48) and Alt Mode Mastery (10th level): extra Alt
 * Modes copied from other Origins' chassis, picked with the Perk's Use button.
 */

/* -------------------------------------------- */
/*  Alt Mode size classes                        */
/* -------------------------------------------- */

// Long and Extended sizes are the elongated forms of Large and Huge and share their Size Class.
const SIZE_CLASS = { small: 0, common: 1, large: 2, long: 2, huge: 3, extended: 3, gigantic: 4, extended2: 4, towering: 5, extended3: 5, titanic: 6 };

export function sizeClass(size) {
  return SIZE_CLASS[size] ?? 1;
}

/**
 * Alt Mode Mimicry (Decepticon Directive, Modemaster, 1st level, p.48): "Choose two chassis tied to
 * different Origins ... You cannot choose a chassis whose Alt Mode Size is two Size Classes larger
 * than the Alt Mode Size of your original chassis."
 * @param {String} originalSize
 * @param {String} candidateSize
 */
export function mimicrySizeOk(originalSize, candidateSize) {
  return sizeClass(candidateSize) - sizeClass(originalSize) < 2;
}

function originalAltMode(actor) {
  const modes = itemsOf(actor).filter(i => i.type == 'altMode' && !i.flags?.essence20?.tf1Mimicry);
  return modes.find(i => i.flags?.essence20?.parentId) ?? modes[0] ?? null;
}

function mimicryLeft(actor) {
  const allowed = 2 + (has(actor, 'Compendium.essence20.decepticon_directive.Item.pVpAdlWmS3psTgIp') ? 2 : 0);
  return allowed - itemsOf(actor).filter(i => i.flags?.essence20?.tf1Mimicry).length;
}

/* -------------------------------------------- */
/*  Use button                                   */
/* -------------------------------------------- */

export const MIMICRY_USE = {
  // Alt Mode Mimicry: "You gain two additional Alt Modes. Choose two chassis tied to different
  // Origins." Alt Mode Mastery (10th level, p.48): "selecting a fourth and a fifth Alt Mode. This
  // follows all the same rules and limitations".
  id: 'tf1Mimicry', matches: item => sourceOf(item) == TF1.altModeMimicry,
  canUse: item => mimicryLeft(item.parent) > 0,
  async run(item) {
    const actor = item.parent;
    const original = originalAltMode(actor);
    if (!original) {
      ui.notifications.warn(T('Tf1NoOriginalAltMode'));
      return null;
    }

    const { origins, altModes } = await originIndex();
    const originOf = uuid => origins.find(o => altModeUuidsOf(o).includes(uuid));
    const taken = [original, ...itemsOf(actor).filter(i => i.flags?.essence20?.tf1Mimicry)]
      .map(i => originOf(sourceOf(i))?.uuid).filter(Boolean);
    const rows = [...altModes.values()]
      .filter(entry => {
        const origin = originOf(entry.uuid);
        return origin && !taken.includes(origin.uuid) && mimicrySizeOk(original.system?.altModesize, entry.system?.altModesize);
      })
      .map(entry => ({ value: entry.uuid, label: `${entry.name} (${originOf(entry.uuid).name})` }))
      .sort((a, b) => a.label.localeCompare(b.label));
    const uuid = await chooseSelect(item.name, T('Tf1PickChassis'), rows);
    if (!uuid) {
      return null;
    }

    const { grantCopy } = await import("../../mechanics/resources/grants.mjs");
    const created = await grantCopy(actor, uuid, { grantedBy: item, flags: { tf1Mimicry: true } });
    if (created) {
      await actor.update({ 'system.canTransform': true });
    }

    return T('Tf1MimicryGained', { name: actor.name, mode: created?.name ?? '' });
  },
};

registerUse(MIMICRY_USE);
