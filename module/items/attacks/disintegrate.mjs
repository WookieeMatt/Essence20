/**
 * Disintegrate (Quartermaster's Guide to Gear, Grid Power/nanomite power, p.94): "When you
 * activate this power, you may affect one structure or vehicle within 60 feet of you. If you
 * succeed with a Targeting attack, then you release nanomites that cause 1 Acid damage. The
 * nanomites roll a d8* attack against the target again every round at the end of the target's turn
 * for 12 rounds, or until the attack fails two attacks in a row."
 *
 * Only the INITIAL hit is built - a real Targeting Attack against whichever token is currently
 * targeted, gated to the actual `vehicle` actor type (the only mechanical proxy this system has
 * for RAW's own "structure or vehicle" - a freestanding "structure" isn't a classified actor type
 * anywhere in this codebase, so it's left to a GM narrating that half manually), dealing synthetic
 * Acid damage via the same `actor._dice.rollSkill()` shape Duty Of The Graphite/Explosive Morph/
 * Electric Discharge already established. The recurring "every round for 12 rounds, until 2
 * consecutive misses" half is deliberately NOT built - it needs the same "recurring/tick-based
 * aura damage" infrastructure this project's own gap list already tracks for Aura of Decay (no
 * precedent anywhere in this codebase for an attack that automatically re-fires itself on a timer,
 * independent of anything the roller does) - flagged as Needs new infrastructure, not forced into
 * a shape that would misrepresent the actual RAW mechanic.
 */
export async function activateDisintegrate(actor) {
  const targetActor = game.user.targets.first()?.actor;
  if (!targetActor || targetActor.type != 'vehicle') {
    return false;
  }

  await actor._dice.rollSkill({
    skill: 'targeting',
    essence: 'speed',
    shiftUp: 0,
    shiftDown: 0,
    defenseType: 'toughness',
    isDisintegrate: true,
  }, actor);
  return true;
}
