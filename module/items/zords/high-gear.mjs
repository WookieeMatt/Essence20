/**
 * High Gear (A Jump Through Time, Zord Feature, p.83, prerequisite Ground Movement 40ft+). Its once-per-scene 1 Personal
 * Power switch (paid by the Zord's pilot) and switching it off are Use rules on the Feature, the doubled Ground Movement a
 * Movement rule, the Snag on Ranged Attacks against the Zord an incoming RollModifier (rules/conv17-split2.test.js). This
 * keeps the reader of its flag for check:highGear.
 */
const HIGH_GEAR_FLAG = 'highGearActive';

/**
 * @param {Actor} zordActor
 * @returns {Boolean}
 */
export function isHighGearActive(zordActor) {
  return !!zordActor?.getFlag?.('essence20', HIGH_GEAR_FLAG);
}
