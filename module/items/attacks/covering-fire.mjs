/**
 * Covering Fire (Transformers CRB, Gunner base, 2nd level, p.68): "Even when your shots miss,
 * they come close enough to make your target nervous. If you attack and miss, the target of your
 * attack suffers a Snag if they attack on their next turn."
 *
 * Fully automatic - no cost, no player choice - so this is banked directly in dice.mjs's own
 * post-roll processing on a genuine miss, rather than a reactive chat button (contrast Spite,
 * which needs a button because ITS grant is a player-chosen spend). The Snag is banked on the
 * TARGET (unscoped to any specific attacker, matching RAW's own "if THEY attack" with no
 * restriction on against whom) but gated on the target's OWN next Attack specifically, not any
 * roll - the one difference from every other unscoped-Snag bank in this project (Menacing Glare,
 * Through the Arches, etc.), which apply to any Skill Test.
 */
export const COVERING_FIRE_SNAG_FLAG = 'pendingCoveringFireSnag';
