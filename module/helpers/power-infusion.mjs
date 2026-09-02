import { canUseReroll, consumeRerollUsage } from "./reroll.mjs";

/**
 * PR CRB p.41 "Power Infusion" (Blue Ranger Role Feature): "Once per scene, by spending 1
 * Personal Power and a Free action while Morphed, you and each of your Morphed Power Ranger
 * teammates within 60 feet re-roll natural 1s on your next successful attack. At 18th level,
 * they may also re-roll 2s."
 *
 * Unlike every other reroll grant in this system (see helpers/reroll.mjs), this one is:
 *  - proactively activated (a Free action, not a reactive button on an already-posted roll),
 *  - multi-actor (the activator plus every Morphed ally within a measured 60ft radius), and
 *  - banked - each affected actor gets a one-time charge that sits until their own next attack,
 *    consumed only once that attack actually succeeds (a miss keeps it banked for the next one).
 *
 * That shape doesn't fit the reactive engine at all, so it lives here as its own small module
 * instead of forcing it into reroll.mjs. Activation still reuses reroll.mjs's own usage-tracking
 * for the "once per scene" gate (helpers/reroll.mjs#canUseReroll/consumeRerollUsage) rather than
 * duplicating that bookkeeping - Power Infusion's OWN reactive-button fallback (for a solo
 * Ranger with no allies to reach) already uses the exact same mechanism.
 *
 * Consumption (dice.mjs#_rollSkillHelper) reads/clears the flags.essence20.bankedReroll flag
 * this module writes, directly - see that file for the actual reroll application.
 */

const POWER_INFUSION_PERK_ID = "Compendium.essence20.pr_crb.Item.cuBM706WJjAmhoZO";
const RANGE_FEET = 60;
// A Ranger's own personal Zord isn't a "Morphed Power Ranger teammate" and NPCs/Companions
// aren't Rangers at all - matches the "playerCharacter" type this Perk's own advances-driven
// reactive-button fallback (helpers/reroll.mjs) is scoped to.
const ALLY_ACTOR_TYPES = ["playerCharacter"];

function getPowerInfusionItem(actor) {
  return actor.items.find(item =>
    item.type == "perk" && item._stats?.compendiumSource == POWER_INFUSION_PERK_ID);
}

export function actorHasPowerInfusion(actor) {
  return !!getPowerInfusionItem(actor);
}

// Mirrors helpers/reroll.mjs#getRerollConfigs's own identical advances-fallback logic: the
// Perk's leveling track ADDS a value at each level rather than replacing it - 1st level is
// "reroll 1s" ([1]), 18th level is "...and 2s" ([1, 2]).
function getRerollValues(actor) {
  const currentValue = Number(getPowerInfusionItem(actor)?.system.advances?.currentValue ?? 1);
  return Number.isFinite(currentValue) && currentValue > 0
    ? Array.from({ length: currentValue }, (_, i) => i + 1)
    : [1];
}

/**
 * Filters a flat list of {actor, distance} candidates down to eligible Power Infusion allies.
 * Kept separate from the canvas-querying side (getMorphedAlliesWithinRange) so this actual
 * eligibility rule is unit-testable without a real scene/token graph.
 * @param {Array<{actor: Actor, distance: Number}>} candidates
 * @param {Actor} activatorActor
 * @returns {Array<Actor>}
 */
export function filterMorphedAlliesInRange(candidates, activatorActor) {
  return candidates
    .filter(({ actor, distance }) =>
      actor !== activatorActor
      && ALLY_ACTOR_TYPES.includes(actor.type)
      && actor.system.isMorphed
      && distance <= RANGE_FEET)
    .map(({ actor }) => actor);
}

/**
 * Finds every other Morphed Power Ranger actor with a token on the activator's current scene,
 * within 60 feet, using Foundry's own grid-distance measurement between token centers.
 * Canvas-dependent - needs the activator to have a placed, rendered token on the viewed scene;
 * returns no allies (not an error) if there's nothing to measure from, e.g. outside a scene.
 * @param {Actor} activatorActor
 * @returns {Array<Actor>}
 */
export function getMorphedAlliesWithinRange(activatorActor) {
  const activatorToken = activatorActor.getActiveTokens(false, true)[0];
  if (!activatorToken || !canvas.scene) {
    return [];
  }

  const candidates = [];
  for (const tokenDoc of canvas.scene.tokens) {
    if (!tokenDoc.actor || tokenDoc.actor == activatorActor) {
      continue;
    }

    const distance = canvas.grid.measurePath([
      activatorToken.getCenterPoint(),
      tokenDoc.getCenterPoint(),
    ]).distance;

    candidates.push({ actor: tokenDoc.actor, distance });
  }

  return filterMorphedAlliesInRange(candidates, activatorActor);
}

/**
 * Activates Power Infusion: spends 1 Personal Power to bank a reroll-natural-1s(-and-2s) charge
 * on the activator and every Morphed teammate within range. See this file's own top-of-file doc
 * comment for the full mechanic.
 * @param {Actor} actor   The activating actor.
 * @returns {Promise<Boolean>}   Whether activation succeeded.
 */
export async function activatePowerInfusion(actor) {
  if (!actorHasPowerInfusion(actor)) {
    ui.notifications.error(game.i18n.localize("E20.PowerInfusionMissingPerk"));
    return false;
  }

  if (!actor.system.isMorphed) {
    ui.notifications.warn(game.i18n.localize("E20.PowerInfusionNotMorphed"));
    return false;
  }

  const usageConfig = { maxUses: 1, reset: "scene" };
  const sourceKey = `item:${POWER_INFUSION_PERK_ID}`;
  if (!(await canUseReroll(actor, usageConfig, sourceKey))) {
    ui.notifications.warn(game.i18n.localize("E20.RerollMaxUsesReached"));
    return false;
  }

  if (!(actor.system.powers?.personal?.value > 0)) {
    ui.notifications.warn(game.i18n.localize("E20.RerollInsufficientResource"));
    return false;
  }

  const values = getRerollValues(actor);
  const allies = getMorphedAlliesWithinRange(actor);

  for (const target of [actor, ...allies]) {
    await target.setFlag("essence20", "bankedReroll", { values, source: "Power Infusion" });
  }

  await actor.update({ "system.powers.personal.value": actor.system.powers.personal.value - 1 });
  await consumeRerollUsage(actor, usageConfig, sourceKey);

  const alliesText = allies.length
    ? allies.map(ally => ally.name).join(", ")
    : game.i18n.localize("E20.PowerInfusionNoAllies");
  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: game.i18n.format("E20.PowerInfusionActivated", { actor: actor.name, allies: alliesText }),
  });

  return true;
}
