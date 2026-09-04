import { actorHasPerk } from "./perks.mjs";
import { getNearbyAllyTokens } from "./allies.mjs";

/**
 * Got To Get Tough (Officer base, 2nd level, p.85): "When you roll Initiative, each ally who can
 * see or hear you gains a temporary Health. This temporary Health lasts for the entire scene,
 * until they take damage, or until you are Defeated. This Health can exceed their normal maximum
 * Health."
 *
 * "Can see or hear you" is approximated as a radius, same idiom as every other aura/ally-facing
 * Perk in this codebase (Battlefield Titan, Shield Upgrade, Enemy Number One) - this system has
 * no line-of-sight/hearing-range concept to check against. Temporary Health has no dedicated
 * schema field (only health.bonus/max/origin/value) - matches PR CRB's "You Got This!" precedent
 * (a flat health.bonus ADD, "can exceed... normal maximum" being exactly what bumping .bonus
 * already does), extended here to also bump .value by the same amount so the ally actually gains
 * usable Health right now, not just headroom. The "until you take damage, or until you are
 * Defeated" removal triggers have no hook - nothing in this codebase intercepts "this actor's
 * Health just decreased" to trigger a side effect on a DIFFERENT bonus, and Defeat has no
 * matching hook either - same accepted duration-approximation as every other "until X" clause
 * already left unenforced throughout this dossier (You Got This!'s own 10-round approximation of
 * "until you unmorph," etc.).
 */
const GOT_TO_GET_TOUGH_ID = "Compendium.essence20.gi_joe_crb.Item.bIoMrn9aP9x6QYVL";
const ALLY_RADIUS_FEET = 30;

/**
 * Grants +1 temporary Health to every nearby ally, if the given actor has Got To Get Tough.
 * Called right before an Initiative roll actually happens (documents/combat.mjs#rollInitiative).
 * @param {Actor} actor   The actor about to roll Initiative.
 */
export async function applyGotToGetTough(actor) {
  if (!actor || !actorHasPerk(actor, GOT_TO_GET_TOUGH_ID)) {
    return;
  }

  const allies = getNearbyAllyTokens(actor, ALLY_RADIUS_FEET);
  for (const token of allies) {
    const ally = token.actor;
    if (!ally) {
      continue;
    }

    await ally.update({
      "system.health.bonus": ally.system.health.bonus + 1,
      "system.health.value": ally.system.health.value + 1,
    });
  }
}
