import { registerRuleType } from "../../types.mjs";
import { rulesOfType } from "../../index.mjs";
import { contextFor, evaluate, interpolate } from "../../predicate.mjs";
import { linkedEntries } from "../../links.mjs";
import { worldActors } from "../shared/team-and-availability-helpers.mjs";

/**
 * Group E's rule types (round 10) read by a hand-written registry the system already had, joined at `setup`
 * (installTypes, called from picks/picks-and-grants-setup.mjs):
 *   HazardProtection     environment-hazards.mjs ENVIRONMENT_PROTECTORS (Weather Gear, Acclimating)
 *   RoughTerrainImposer  rough-terrain.mjs ROUGH_TERRAIN_IMPOSERS (Misguide)
 *   MultipleTargets      multiple-targets.mjs MULTIPLE_TARGETS_GRANTS (Plow)
 * Group E's other hand-wired pieces are resources/kit-prerequisite.mjs (KitPrerequisite), rolls/allies-anywhere-scope.mjs
 * (the alliesAnywhere link scope) and ./equipment-broke.mjs (the equipmentBroke Trigger event).
 */

/* -------------------------------------------- */
/*  HazardProtection                             */
/* -------------------------------------------- */

registerRuleType('HazardProtection', {
  params: { categories: { kind: 'strings' }, environments: { kind: 'strings' } },
  scopes: ['self'],
});

/**
 * ENVIRONMENT_PROTECTORS entry: the first HazardProtection rule that covers this hazard - its `categories` (the
 * hazard's category: temperature, breathing...) and `environments` (the environment key; "{choice.environment}" reads
 * a pick, and an unmade pick covers nothing) - labelled with its item's name.
 */
export function ruleHazardProtection(actor, environment, hazard) {
  for (const { rule, item } of rulesOfType(actor, 'HazardProtection', 'self')) {
    if (Array.isArray(rule.categories) && rule.categories.length && !rule.categories.includes(hazard?.category)) {
      continue;
    }

    if (Array.isArray(rule.environments) && rule.environments.length
      && !rule.environments.map(entry => interpolate(String(entry), item)).includes(environment)) {
      continue;
    }

    if (evaluate(rule.when, contextFor({ self: actor, ruleItem: item })) === true) {
      return item.name;
    }
  }

  return null;
}

/* -------------------------------------------- */
/*  RoughTerrainImposer                          */
/* -------------------------------------------- */

registerRuleType('RoughTerrainImposer', { params: {}, scopes: ['self'] });

/** Actors that may hold an imposer: the world's and the canvas's (unlinked tokens). */
function possibleHolders() {
  const seen = new Set(worldActors());
  for (const token of globalThis.canvas?.tokens?.placeables ?? []) {
    if (token.actor) {
      seen.add(token.actor);
    }
  }

  return [...seen];
}

/**
 * ROUGH_TERRAIN_IMPOSERS entry: someone's RoughTerrainImposer rule makes this token move as though through Rough
 * Terrain - its `when` read with self = the holder and target = the one moving (target:marked:misguided, target:ownTurn).
 */
export function ruleImposesRoughTerrain(tokenDoc) {
  const mover = tokenDoc?.actor;
  if (!mover) {
    return false;
  }

  return possibleHolders().some(holder => rulesOfType(holder, 'RoughTerrainImposer', 'self')
    .some(({ rule, item }) => evaluate(rule.when, contextFor({ self: holder, holder, ruleItem: item, other: mover })) === true));
}

/* -------------------------------------------- */
/*  MultipleTargets                              */
/* -------------------------------------------- */

registerRuleType('MultipleTargets', { params: {}, scopes: ['self', 'driven'] });

/**
 * MULTIPLE_TARGETS_GRANTS entry: the attack (a weapon effect) has Multiple Targets through a rule - the actor's own,
 * or (scope driven) its driver's for the vehicle being driven. `when` sees the attack (attack:ram).
 */
export function ruleMultipleTargets(actor, item) {
  if (item?.type != 'weaponEffect') {
    return false;
  }

  const entries = [...rulesOfType(actor, 'MultipleTargets', 'self').map(entry => ({ ...entry, holder: actor })), ...linkedEntries(actor, 'MultipleTargets')];
  const facts = { item, isAttack: true, isMelee: item.system?.classification?.style == 'melee' };
  return entries.some(({ rule, item: ruleItem, holder }) => evaluate(rule.when, contextFor({ ...facts, self: actor, holder, ruleItem })) === true);
}

/* -------------------------------------------- */
/*  Wiring                                       */
/* -------------------------------------------- */

export function installTypes() {
  const Hooks = globalThis.Hooks;
  if (!Hooks?.on) {
    return;
  }

  Hooks.once('setup', async () => {
    const hazards = await import("../../../mechanics/world/environment-hazards.mjs");
    hazards.ENVIRONMENT_PROTECTORS?.push(ruleHazardProtection);
    const rough = await import("../../../mechanics/world/rough-terrain.mjs");
    rough.ROUGH_TERRAIN_IMPOSERS?.push(ruleImposesRoughTerrain);
    const multiple = await import("../../../mechanics/combat/multiple-targets.mjs");
    multiple.MULTIPLE_TARGETS_GRANTS?.push(ruleMultipleTargets);
  });
}
