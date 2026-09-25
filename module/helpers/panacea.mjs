/**
 * Panacea (MLP CRB, Virtuoso Aid spell, p.140): "You cure a creature of all ills. Target any
 * creature within range. All conditions affecting the target creature end, including Defeated,
 * and the creature returns to their full Health."
 *
 * This project's own generic "clear every active status" sweep doesn't exist yet (see the
 * Automation Ledger's own tracked gap - only fixed, named-Condition removal lists exist so far,
 * e.g. Purple Ranger Prime's 3-Condition sweep) - the Condition-clearing half of this spell stays
 * blocked pending that. The heal-to-full and un-Defeat halves need no such sweep though: both are
 * already-established idioms (Self-Revive's own `toggleStatusEffect('defeated', {active: false})`,
 * the generic `system.health.value` restore Healing Bandages/Humanitarian already use), so they're
 * built directly, leaving only the Condition sweep itself as the remaining, correctly-scoped gap.
 */
export async function applyPanaceaHeal(targetActor) {
  await targetActor.update({ 'system.health.value': targetActor.system.health.max });
  await targetActor.toggleStatusEffect('defeated', { active: false });
}
