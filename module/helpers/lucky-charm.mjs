/**
 * Lucky Charm (Finster's Monster-Matic Cookbook, Sorcerous Power, p.276): "DIF 12 Performance
 * (Rituals) Skill Test in a 1-hour ritual to recreate the effects of the Luck General Perk for the
 * rest of the day."
 *
 * The Luck General Perk (PR CRB p.97) is already a real, working `system.reroll` config (reroll
 * 1s on skill dice, unlimited uses, min die faces 4) - "recreate its effects" is built the same way
 * Future Vision's own resource half already establishes: on a SUCCESSFUL cast, write directly to
 * this item's own `system.reroll.enabled` field (added to the compendium item, `disabled` by
 * default, mirroring Luck's own exact config) rather than inventing a second, parallel reroll
 * mechanism. The reroll engine reads its config straight off whichever item carries it, so once
 * enabled, Lucky Charm functions identically to holding Luck itself. "For the rest of the day" has
 * no active turn-off hook (no day-boundary event exists anywhere in this codebase) - left enabled
 * until a GM manually disables it again, the same "approximate an unenforceable duration" idiom
 * this project uses everywhere else.
 */
export async function activateLuckyCharm(actor, item) {
  await actor._dice.rollSkill({
    skill: 'performance', essence: 'social', shiftUp: 0, shiftDown: 0, dif: '12',
    isLuckyCharmAttempt: true, luckyCharmItemUuid: item.uuid,
  }, actor);
}

/**
 * Enables the given Lucky Charm item's own reroll config - called from dice.mjs's own post-roll
 * success handling.
 * @param {Item} item
 */
export async function applyLuckyCharm(item) {
  await item.update({ 'system.reroll.enabled': true });
}
