// Greased Lightning (Knights of Canterlot, Elementary Enchantment spell, p.43): "This spell makes
// the target creature slippery to the touch and unable to be held or restrained... All
// Speed-related Skill Tests to go fast are upshift-1 for the duration." A flat on/off flag on
// whichever actor was targeted by the cast (read directly in dice.mjs, the same generic per-actor
// flag shape Hot To Trot/Fluttery Wings/Lightning Speed already established), covering 2 of the
// spell's own 4 clauses:
// - "Unable to be held or restrained" -> immunity to the Restrained/Grappled Conditions, wired
//   into helpers/condition-immunity.mjs's own CONDITION_IMMUNITY_PERKS table via its `checkFn`
//   escape hatch (a spell-granted temporary flag rather than a permanently-held Perk, so it can't
//   use that table's default actorHasPerk(id) shape).
// - "Speed-related Skill Tests... upshift-1" -> read directly in dice.mjs#rollSkill's own
//   essence-scoped shift computation, the same shape as Crushing Strength/Pack Mule.
// NOT built: "if already restrained or grappled, gains Edge to escape" (this system has no
// distinct "escape a grapple" Skill Test classification to hook - the immunity half already
// prevents becoming newly held while active, covering the common case) and "attempts to stop
// suffer a Snag" (no "stopping" Skill Test classification either) - both flagged as gaps, not
// forced into an inaccurate shape.

const GREASED_LIGHTNING_FLAG = 'greasedLightningActive';

export function isGreasedLightningActive(actor) {
  return !!actor?.getFlag?.('essence20', GREASED_LIGHTNING_FLAG);
}

export async function applyGreasedLightning(actor) {
  await actor.setFlag('essence20', GREASED_LIGHTNING_FLAG, true);
}

export async function removeGreasedLightning(actor) {
  await actor.unsetFlag('essence20', GREASED_LIGHTNING_FLAG);
}
