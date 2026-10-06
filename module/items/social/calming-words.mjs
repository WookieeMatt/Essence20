/**
 * Calming Words (Enigma of Combination, Counselor Focus, Scientist, 3rd level, p.34): "If you
 * spend at least 30 minutes with a sentient being and succeed at a Persuasion Skill Test versus
 * their Willpower or Cleverness Defense, the target receives Resistance to Psychic damage and any
 * attacks that would impose the Frightened or Mesmerized conditions for the next 24 hours. In
 * addition, you can spend a Free action and an Energon Point to attempt the same Skill Test to
 * remove the Frightened or Mesmerized Conditions from a target."
 *
 * Two distinct triggers sharing one roll (Persuasion vs. a chosen Defense), resolved via a single
 * up-front picker (action + Defense) rather than two separate "Use" buttons: "Soothe" (the 30-
 * minute ritual, no cost, grants the buff) or "Cure" (Free action + 1 Energon, removes the
 * Conditions outright). "Spend 30 minutes" is dropped as an unenforceable narrative precondition,
 * the same idiom this project already applies to every other real-time-cost clause.
 *
 * The buff's Frightened/Mesmerized-immunity half is wired into condition-immunity.mjs's own
 * `checkFn` escape hatch (a roll-granted temporary flag, not a permanently-held Perk - same shape
 * Greased Lightning's identical flag-based immunity already established) rather than a permanent
 * Perk-driven entry. "For the next 24 hours" has no active expiry hook - the same "GM manages the
 * edges" duration idiom this project already uses for every other printed-duration grant.
 */
const BUFF_FLAG = 'calmingWordsBuffActive';

export function isCalmingWordsBuffActive(actor) {
  return !!actor?.getFlag?.('essence20', BUFF_FLAG);
}
