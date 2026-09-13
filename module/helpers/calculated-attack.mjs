/**
 * Calculated Attack (Transformers CRB, Gunner base, Sharpshooter Focus, 3rd level, p.70): "When
 * you Aim at a target with your Long Range Rifle, you can make a Science Skill Test against their
 * Evasion or Cleverness. On a success, Aiming grants ↑2 instead of ↑1."
 *
 * Dispatched from a sheet "Use" button, the same "trigger a real dialog roll via
 * actor._dice.rollSkill()" shape Absolute Menace/Duty Of The Graphite already established - the
 * player gets the full interactive Roll Options Dialog and picks Evasion or Cleverness themselves
 * via its own existing Defense dropdown (no new picker needed, unlike Duty Of The Graphite's own
 * fixed-Defense shape). No Power cost or frequency cap named in RAW.
 */
export async function activateCalculatedAttack(actor) {
  await actor._dice.rollSkill({
    skill: 'science',
    essence: 'smarts',
    shiftUp: 0,
    shiftDown: 0,
    isCalculatedAttack: true,
  }, actor);
}
