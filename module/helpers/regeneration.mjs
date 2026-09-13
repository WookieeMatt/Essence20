/**
 * Regeneration (Quartermaster's Guide to Gear, Grid Power/nanomite power, p.94): "When you
 * activate this power, the nanomites within your body repair 1 Health. This takes a Standard
 * action, but no roll is necessary. You may activate this power in tandem with a Science Skill
 * Test for normal healing. If you do so, then rather than gaining an automatic 1 Health you
 * instead gain Edge on the Science Skill Test. You may also use nanomites to aid another
 * character. This is resolved with a Science Skill Test as above."
 *
 * Only the plain, automatic self-heal is built ("the nanomites within YOUR body repair 1 Health" -
 * no target choice, no roll). The other two clauses both require a generic "heal an amount tied to
 * a Skill Test's own success" mechanism this codebase doesn't have anywhere (confirmed via grep -
 * every other healing Perk/Power in this project heals either a flat amount on activation, like
 * this one, or a flat amount per turn, like Regenerating Shell - none of them read a Skill Test's
 * own outcome to determine the amount healed) - flagged as Needs new infrastructure, not forced;
 * this also blocks "aid another character," which RAW explicitly routes through that same
 * Science-Skill-Test mechanic rather than the automatic 1-Health grant.
 */
const REGENERATION_HEAL_AMOUNT = 1;

export async function activateRegeneration(actor) {
  await actor.update({
    'system.health.value': Math.min(actor.system.health.max, actor.system.health.value + REGENERATION_HEAL_AMOUNT),
  });
}
