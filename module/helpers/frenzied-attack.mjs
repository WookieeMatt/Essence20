import { actorHasPerk } from "./perks.mjs";
import { grantActionsThisTurn } from "./action-economy.mjs";

/**
 * Frenzied Attack (Decepticon Directive, Shredder Focus, 10th level, p.58): "When you open
 * yourself up to the animalistic side of your Spark, you become a whirl of teeth, claws, or other
 * sharp points. At 10th level, you can spend an Energon Point and a Free action once per turn to
 * make an additional unarmed combat attack. If this additional attack inflicts damage on a target,
 * you can spend another Energon Point and a Free action to make another unarmed combat attack. You
 * can continue this pattern until you no longer wish to spend or run out of Energon Points or Free
 * actions or fail to inflict damage on a target."
 *
 * Genuinely reactive - "if this additional attack inflicts damage" is only knowable once a roll
 * has resolved - so this is a post-roll chat button (chat.mjs#addFrenziedAttackButton), the same
 * shape as Spite/Suffer (helpers/spite.mjs, helpers/suffer.mjs). Unlike those two, the payoff here
 * is a genuinely NEW Attack Skill Test rather than a banked bonus, so clicking the button rolls
 * the SAME unarmed weaponEffect Item again (an empty dataset is safe: item.mjs's own weaponEffect
 * branch always recomputes shift/skill/shiftUp/shiftDown/isSpecialized itself rather than trusting
 * whatever the caller passed in) - if THAT roll also hits, chat.mjs's own renderChatMessageHTML
 * hook re-evaluates the button against its new chat message exactly the way it does for every
 * other message, continuing the chain for as long as it keeps connecting, with no extra plumbing.
 *
 * "Unarmed combat attack" is recognized the same way Cryogenic Touch/Zeo Crystal Boost already do
 * - a weaponEffect with no parent weapon Item (flags.essence20.parentId unset) - rather than
 * hardcoding a specific compendium Item id, since Cybertronians roll their innate unarmed attack
 * from several different sources across books.
 *
 * The Free action spend is the same self-policed, unenforced action-economy cost every other
 * declared-intent Perk in this project already accepts (In My Sights' own comment on
 * inMySightsAimEdgeAvailable is the canonical statement of that idiom) - grantActionsThisTurn logs
 * the grant for the action-economy ledger's own tracking, but nothing here blocks the re-roll if
 * the actor is out of tracked Free actions. Likewise, RAW's "once per turn" cap on STARTING the
 * chain isn't separately tracked from an ordinary later unarmed attack that turn - the same
 * "self-policed, not hard-enforced" idiom Disarming Shot's own unenforced "a 1-handed weapon"
 * declaration already uses (dice.mjs's own DISARMING_SHOT_ID comment).
 */
const DECEPTICON_DIRECTIVE = "Compendium.essence20.decepticon_directive.Item.";
export const FRENZIED_ATTACK_ID = `${DECEPTICON_DIRECTIVE}74X6WTVVP1cfnOpI`;

function getParentWeapon(actor, weaponEffect) {
  const parentId = weaponEffect?.flags?.essence20?.parentId;
  return parentId ? actor.items?.get(parentId) : null;
}

/**
 * @param {Actor} actor
 * @param {Item} item   The weaponEffect that was just rolled.
 * @returns {Boolean}   Whether this actor could spend an Energon Point right now to make another
 *   unarmed combat attack with this same weaponEffect.
 */
export function canActivateFrenziedAttack(actor, item) {
  if (!actor || !item || item.type != 'weaponEffect' || getParentWeapon(actor, item)) {
    return false;
  }

  return actorHasPerk(actor, FRENZIED_ATTACK_ID) && (actor.system.energon?.normal?.value ?? 0) > 0;
}

/**
 * Spends the Energon Point, grants the Free action, and rolls the same unarmed weaponEffect again
 * - called once the chat button's own affordability/claimed checks have already passed.
 * @param {Actor} actor   The Shredder making the additional attack.
 * @param {Item} item   The unarmed weaponEffect to roll again.
 * @returns {Promise<*>}   Whatever the follow-up roll returned.
 */
export async function activateFrenziedAttack(actor, item) {
  await actor.update({ 'system.energon.normal.value': actor.system.energon.normal.value - 1 });
  await grantActionsThisTurn(actor, { free: 1 }, item.name);
  return item.roll({}, actor);
}
