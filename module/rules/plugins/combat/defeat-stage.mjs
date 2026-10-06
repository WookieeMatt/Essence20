// Rules-engine plug-ins, round 15 (rest-other - docs/rules-batches/slOther15.md): the Defeat-save chain's stages, the
// Racer Abandon redirect scope, and the Essence-to-0 event.
// Registered on import; see module/rules/plugins/index.mjs. Import-light (mechanics/combat/combat.mjs and
// mechanics/world/environment-hazards.mjs load it directly; the trigger engine is imported lazily).
import { rulesOfType } from "../../index.mjs";
import { registerLinkScope } from "../../links.mjs";
import { registerTag } from "../../predicate.mjs";
import { registerEvent, RULE_TYPES, SCOPES } from "../../types.mjs";

/**
 * wouldBeDefeated `stage` - where in combat.mjs#applyDamage's Defeat-save chain a Trigger runs:
 *   first        (default) at the head of the chain, as before;
 *   beforeAegis  after the first stage, where Immortal Rebel Soul, Life Supporting and Not Done Yet sat (ahead of Aegis);
 *   last         at the very end, after Aegis (We are the Coinless - a teammate's resource, spent only when nothing else
 *                saved the victim).
 * Within a stage Triggers run in `priority` order (the actor's own, then linked ones); each runs only while the hit
 * still would Defeat.
 */
export const DEFEAT_STAGES = ['first', 'beforeAegis', 'last'];
if (RULE_TYPES.Trigger?.params && !RULE_TYPES.Trigger.params.stage) {
  RULE_TYPES.Trigger.params.stage = { kind: 'enum', options: DEFEAT_STAGES };
}

/* -------------------------------------------- */
/*  Racer Abandon's redirect                     */
/* -------------------------------------------- */

// mechanics/companions/summons.mjs#renegadeHolderFor, handed in when that file loads (it reads the world's vehicles).
let renegadeLookup = null;

/** summons.mjs registers renegadeHolderFor here: (actor) => the actor whose Renegade Perks protect it, or null. */
export function registerRenegadeLookup(fn) {
  renegadeLookup = typeof fn == 'function' ? fn : null;
}

function renegadeOf(actor) {
  try {
    return renegadeLookup ? renegadeLookup(actor) ?? null : actor ?? null;
  } catch (error) {
    return null;
  }
}

/**
 * Scope `renegadeVehicle` - on a Renegade Perk: reaches the vehicle its holder drives while Racer Abandon moves the Perk
 * onto it ("If your vehicle is Defeated..."). Pair the Perk's `self` rule with `self:ownRenegade`, so the driver isn't
 * protected too unless Rigged Rider keeps it on them.
 */
registerLinkScope('renegadeVehicle', actor => {
  if (actor?.type != 'vehicle') {
    return [];
  }

  const holder = renegadeOf(actor);
  return holder && holder !== actor ? [holder] : [];
});
if (!SCOPES.includes('renegadeVehicle')) {
  SCOPES.push('renegadeVehicle');
}

for (const definition of Object.values(RULE_TYPES)) {
  if (definition.scopes?.includes('vehicle') && !definition.scopes.includes('renegadeVehicle')) {
    definition.scopes.push('renegadeVehicle');
  }
}

/** self:ownRenegade - the actor's own Renegade Perks protect it (renegadeHolderFor gives the actor itself). */
export function ownRenegadeTag(rest, ctx) {
  const actor = ctx?.self;
  if (!actor) {
    return false;
  }

  return renegadeOf(actor) === actor;
}

registerTag('self:ownRenegade', ownRenegadeTag, { phrase: ['{who} {is} {its} own Renegade', '{who} {isnt} {its} own Renegade'] });

/* -------------------------------------------- */
/*  An Essence about to drop to 0                */
/* -------------------------------------------- */

/**
 * Event `essenceWouldEmpty` - an Essence point's damage (mechanics/world/environment-hazards.mjs#applyEssenceDamage) would
 * take that Essence to 0. `@var.essence` names it; a `negateDamage` step keeps the point (Immortal Rebel Soul's Essence
 * half, sharing its Health half's limit through `limit.key`).
 */
registerEvent('essenceWouldEmpty');

/**
 * Whether the actor's essenceWouldEmpty Triggers keep this Essence from dropping to 0.
 * @param {Actor} actor
 * @param {String} essence
 * @returns {Promise<Boolean>}
 */
export async function essenceWouldEmpty(actor, essence) {
  if (!rulesOfType(actor, 'Trigger').some(entry => entry.rule.event == 'essenceWouldEmpty')) {
    return false;
  }

  const { fireTriggers } = await import("../../triggers.mjs");
  const damage = { amount: 1, essence };
  await fireTriggers(actor, 'essenceWouldEmpty', { damage, vars: { essence }, only: () => damage.amount > 0 });
  return damage.amount <= 0;
}
