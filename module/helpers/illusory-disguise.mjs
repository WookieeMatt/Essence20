/**
 * Illusory Disguise (Finster's Monster-Matic Cookbook, Sorcerous Power, p.273): "DIF 12 Culture
 * (Arcane) Skill Test as a Standard action to appear as someone else, gaining Edge on Infiltration
 * and Deception Skill Tests relating to the illusion."
 *
 * RE-CATEGORIZED from an earlier pass's "narrative, low confidence" call - on direct RAW reading
 * this has a real mechanical half (Edge on Infiltration/Deception) alongside the narrative
 * disguise, the same shape Observer (Through the Shattered Grid) already established. Also fixed a
 * real compendium data bug while verifying: this item's own `system.type` was "grid" despite
 * living in this exact same Sorcerous Power table as Bolster Defense/Monster... Grow!/Lucky Charm/
 * Sorcerous Tremors (all correctly "sorcerous") - fixed so its cost draws from the sorcerous pool
 * like its siblings, not the unrelated Grid/personal pool.
 *
 * A real Skill Test (unlike Observer's own free toggle) - on a successful DIF 12 Culture roll, the
 * disguise activates via activateIllusoryDisguise below (called from dice.mjs's own post-roll
 * success handling); while active, an unconditional ↑Edge on Infiltration/Deception ("relating to
 * the illusion" is the same unenforceable narrative qualifier Observer's own identical grant
 * already drops). RAW describes no way to end it early (unlike Observer's own re-clickable
 * toggle) - a one-way activation, the same shape Blazing Strikes/Void Warrior already use for a
 * Power with no stated toggle-off.
 */
const ILLUSORY_DISGUISE_FLAG = 'illusoryDisguiseActive';

export async function activateIllusoryDisguiseRoll(actor) {
  await actor._dice.rollSkill({
    skill: 'culture', essence: 'smarts', shiftUp: 0, shiftDown: 0, dif: '12',
    isIllusoryDisguiseAttempt: true,
  }, actor);
}

export async function activateIllusoryDisguise(actor) {
  await actor.setFlag('essence20', ILLUSORY_DISGUISE_FLAG, true);
}

export function isIllusoryDisguiseActive(actor) {
  return !!actor.getFlag?.('essence20', ILLUSORY_DISGUISE_FLAG);
}
