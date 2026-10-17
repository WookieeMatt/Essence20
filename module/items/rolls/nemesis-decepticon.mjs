/**
 * Nemesis (Decepticon Directive, Influence, p.27) and its Mandatory Hang-Up - the two readers the items' rules ask through
 * the check: tags (essence20.mjs registers them): check:decepticonNemesis (the other party is the declared nemesis) and
 * check:nemesisInScene (the nemesis has a token on the active scene). The Perk's Use rule declares the nemesis (its
 * flag below); its ↑1 and the Hang-Up's ↓1 are RollModifier rules on the items (round 14, rules/conv14-items2.test.js).
 *
 * A different Perk from Across the Stars' identically-named General Perk (items/rolls/nemesis.mjs,
 * NEMESIS_ID bxGgq6PpfxeSRr7Q) - the same flag SHAPE, not the same flag (a Decepticon character could
 * plausibly hold both Nemesis Perks at once). "Involved in a scene with your nemesis" = the nemesis's
 * actor currently has a token on the active scene; "someone openly acting on behalf of" the nemesis is
 * dropped as an unenforceable narrative extension.
 */
const NEMESIS_DD_FLAG = 'decepticonNemesisUuid';

/**
 * @param {Actor} actor
 * @param {Actor} target
 * @returns {Boolean}   Whether target is this actor's declared Decepticon Directive nemesis.
 */
export function isDecepticonNemesis(actor, target) {
  const nemesisUuid = actor.getFlag?.('essence20', NEMESIS_DD_FLAG);
  return !!nemesisUuid && !!target?.uuid && nemesisUuid == target.uuid;
}

/**
 * Whether the declared nemesis currently has a token on the active scene - the "involved in a
 * scene with your nemesis" proxy for the Hang-Up half.
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function isNemesisInScene(actor) {
  const nemesisUuid = actor.getFlag?.('essence20', NEMESIS_DD_FLAG);
  if (!nemesisUuid) {
    return false;
  }

  const nemesisActor = fromUuidSync(nemesisUuid);
  return !!nemesisActor?.getActiveTokens?.()?.length;
}
