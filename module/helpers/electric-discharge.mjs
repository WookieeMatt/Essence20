/**
 * Electric Discharge (Quartermaster's Guide to Gear, Grid Power/nanomite power, p.93): "The
 * nanomites within your hand enable you to produce an electrical discharge from your fingers,
 * dealing 1 Electric damage. This weapon has a range of 10 feet, although you may use Finesse or
 * Might in place of Targeting if your target is within your Reach. As an Electric weapon, you gain
 * ↑1 on your attack. You only get one attack for each use of this power."
 *
 * A real Attack Skill Test against whichever token is currently targeted, dealing synthetic
 * Electric damage - same "trigger a real dialog roll via actor._dice.rollSkill()" shape Duty Of
 * The Graphite/Explosive Morph already established. This codebase's own generic "Electric weapons
 * gain an upshift" core rule (see the Damage Types pass elsewhere in this project) is gated on
 * `item?.type == 'weaponEffect'` and so doesn't reach a synthetic, item-less roll like this one -
 * RAW's own "As an Electric weapon, you gain ↑1" is applied directly here instead, via a flat
 * `shiftUp: 1` on the dataset itself. Targeting is used as the default skill (RAW's own primary
 * case); the Finesse/Might substitution
 * "if your target is within your Reach" is a narrative/range judgment call this system has no
 * automatic range check to make for a non-weaponEffect roll - left to the player, the same
 * "self-polices a narrow fictional qualifier" idiom Duty Of The Graphite's own Social-skill default
 * already uses. RAW names no Defense - Evasion is used (a ranged attack, dodged rather than
 * armored against), matching Explosive Morph's own default reasoning for an unspecified Defense.
 */
export async function activateElectricDischarge(actor) {
  await actor._dice.rollSkill({
    skill: 'targeting',
    essence: 'speed',
    shiftUp: 1,
    shiftDown: 0,
    defenseType: 'evasion',
    isElectricDischarge: true,
  }, actor);
}
