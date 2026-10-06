/**
 * Skier (General Hawk's Personnel Files, General Perk, p.175): "You gain a Limited Athletics
 * (Skiing), a Limited Survival (Arctic) Kit, and a pair of skis... You gain +10ft Ground Movement
 * and +1 Evasion while skiing." RAW pulled fresh from the actual PDF (no cached extraction existed
 * for this book) - it does NOT match Diver/Rock Climber's own always-on shape despite the surface
 * similarity: those two grant a bonus to a Movement TYPE that's only ever exercised in the matching
 * activity anyway (Swim/Climb Movement), so an unconditional compendium Active Effect is correct
 * for them. Skier's own bonus is to GROUND Movement (this system's default, constantly-used
 * Movement type) and Evasion - applying those unconditionally would grant a permanent bonus even
 * when not skiing at all, which RAW's own "while skiing" qualifier doesn't support. Built instead
 * as a plain on/off actor-flag toggle, the same shape as Dig In (a Perk-item toggle with no cost,
 * flipped by the sheet's own "Use" button) - "while skiing" is exactly the kind of narrative
 * activity this project already treats as a manually-toggled stance rather than something to
 * detect automatically (no terrain/snow tracking exists anywhere in this codebase).
 *
 * The kit/ski-equipment possession precondition is unenforced, the same item-possession idiom
 * every other such clause in this project already treats as narrative.
 */
const SKIING_FLAG = 'isSkiingActive';

export function isSkiing(actor) {
  return !!actor.getFlag?.('essence20', SKIING_FLAG);
}

/**
 * Flips the actor's own skiing stance. Returns the new state (true = now skiing).
 * @param {Actor} actor
 * @returns {Promise<Boolean>}
 */
export async function toggleSkiing(actor) {
  const nowSkiing = !isSkiing(actor);
  await actor.setFlag('essence20', SKIING_FLAG, nowSkiing);
  return nowSkiing;
}
