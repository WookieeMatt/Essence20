/**
 * Power Blast (Power Rangers Core Rulebook, Grid Power, p.100): "While Morphed, you can force
 * Morphin Grid energy to coalesce into an unstable bubble, hurling it toward your enemies to
 * explode. After spending between 1 to 5 Power you can make an Athletics or Targeting (Thrown for
 * either) Skill Test as a Standard action with a range of 40ft/100ft. If it hits, the target
 * suffers 1 Energy damage per Power spent. If it misses, the Power is wasted."
 *
 * A single-target Skill-Test-vs-Defense with a variable, spend-scaled synthetic damage value - the
 * same "trigger a real dialog roll via actor._dice.rollSkill()" shape Duty Of The Graphite/
 * Explosive Morph already established, aimed at whichever ONE enemy the player has targeted. RAW
 * offers a choice of skill (Athletics or Targeting) - Athletics is used as the representative
 * default (it needs no weapon/gear, unlike Targeting), the same "player self-polices the exact
 * fictional framing" idiom already applied to Duty Of The Graphite's own Social-skill default.
 * Evasion is picked as the target Defense (a thrown explosive is dodged, not armored against),
 * matching Explosive Morph's own identical judgment call.
 */
export async function activatePowerBlast(actor, amountSpent) {
  if (!amountSpent) {
    return;
  }

  await actor._dice.rollSkill({
    skill: 'athletics',
    essence: 'strength',
    defenseType: 'evasion',
    isPowerBlast: true,
    powerBlastAmount: amountSpent,
  }, actor);
}
