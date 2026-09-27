/**
 * Nemesis (Decepticon Directive, Influence, p.27): "you have become an expert on the comings,
 * goings, and interactions of your chosen nemesis. All your non-combat Skill Tests that relate to
 * your nemesis gain ↑1." Mandatory Hang-Up: "If you are involved in a scene with your nemesis (or
 * someone openly acting on behalf of your nemesis), you suffer ↓1 on all Skill Tests that don't
 * target that individual or otherwise hinder or harm that individual."
 *
 * A different Perk from Across the Stars' identically-named General Perk (helpers/nemesis.mjs,
 * NEMESIS_ID bxGgq6PpfxeSRr7Q) - two unrelated Perks that happen to share a name, the exact
 * caution that file's own doc comment flags. This one reuses the same "designate, no roll
 * involved" declare-via-current-target idiom (Mark Target/that other Nemesis) rather than a novel
 * actor-identity picker, and the same flag SHAPE (not the same flag - a Decepticon character could
 * plausibly hold both Nemesis Perks at once).
 *
 * "Related to your nemesis" / "involved in a scene with your nemesis" both collapse to the same
 * two proxies this codebase already uses elsewhere: "non-combat" = item?.type != 'weaponEffect'
 * (Cobra Battle School Graduate's own identical proxy, just above in dice.mjs), and "involved in a
 * scene with" = the nemesis's actor currently has a token on the active scene (getActiveTokens
 * length check) - "someone openly acting on behalf of" the nemesis is dropped as an
 * unenforceable narrative extension, the same kind of gap this project already accepts for other
 * "or their agents" clauses.
 */
export const NEMESIS_DD_PERK_ID = "Compendium.essence20.decepticon_directive.Item.Epkm9DVktvFurYDL";
export const NEMESIS_DD_HANGUP_ID = "Compendium.essence20.decepticon_directive.Item.6kqzh6eVugqnSn60";
const NEMESIS_DD_FLAG = 'decepticonNemesisUuid';

/**
 * Designates whichever token is currently targeted as this actor's Decepticon Directive nemesis.
 * @param {Actor} actor
 * @returns {Promise<Boolean>}   True if declared, false (with a warning already shown by the
 *   caller) if nothing was targeted.
 */
export async function declareDecepticonNemesis(actor) {
  const target = game.user.targets.first()?.actor;
  if (!target) {
    ui.notifications.warn(game.i18n.localize('E20.NemesisNoTarget'));
    return false;
  }

  await actor.setFlag('essence20', NEMESIS_DD_FLAG, target.uuid);
  return true;
}

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
