import { registerEvent, registerRuleType, RULE_TYPES } from "../../types.mjs";
import { LINK_HOLDERS, rulesOfType } from "../../index.mjs";
import { contextFor, evaluate, interpolate } from "../../predicate.mjs";
import { linkedEntries, registerLinkScope } from "../../links.mjs";
import { allied, worldActors } from "../shared/team-and-availability-helpers.mjs";

/**
 * Group E's rule types (round 10), each read by a hand-written registry the system already had:
 *   HazardProtection     environment-hazards.mjs ENVIRONMENT_PROTECTORS (Weather Gear, Acclimating)
 *   RoughTerrainImposer  rough-terrain.mjs ROUGH_TERRAIN_IMPOSERS (Misguide)
 *   MultipleTargets      multiple-targets.mjs MULTIPLE_TARGETS_GRANTS (Plow)
 *   KitPrerequisite      the essence20.kitPrerequisite hook (kits.mjs - Good To Go, Training Through Familiarity)
 * plus the `alliesAnywhere` link scope (Inspirational Leader) and the `equipmentBroke` Trigger event (Junker).
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
/*  KitPrerequisite                              */
/* -------------------------------------------- */

registerRuleType('KitPrerequisite', {
  params: { mode: { kind: 'enum', required: true, options: ['lower', 'waive'] }, tiers: { kind: 'strings' }, skipEssenceKits: { kind: 'bool' } },
  scopes: ['self'],
});

/**
 * The essence20.kitPrerequisite hook (kits.mjs#meetsKitPrerequisite: out.need is the Skill die a kit asks for):
 * `lower` takes it one Rank lower, never past d2 (Good To Go); `waive` drops it (d20 - Training Through Familiarity).
 * `tiers` limits it to kits of those tiers; `skipEssenceKits` leaves Essence kits alone.
 */
export function ruleKitPrerequisite(actor, info, out) {
  if (!out?.need) {
    return;
  }

  const list = globalThis.CONFIG?.E20?.skillShiftList ?? [];
  const live = rulesOfType(actor, 'KitPrerequisite', 'self').filter(({ rule, item }) => (!Array.isArray(rule.tiers) || !rule.tiers.length || rule.tiers.includes(info?.tier))
    && !(rule.skipEssenceKits && info?.essence) && evaluate(rule.when, contextFor({ self: actor, ruleItem: item })) === true);
  for (let i = live.filter(entry => entry.rule.mode == 'lower').length; i > 0; i--) {
    const index = list.indexOf(out.need);
    const d2 = list.indexOf('d2');
    if (index >= 0 && (d2 < 0 || index < d2)) {
      out.need = list[index + 1];
    }
  }

  if (live.some(entry => entry.rule.mode == 'waive')) {
    out.need = 'd20';
  }
}

/* -------------------------------------------- */
/*  alliesAnywhere scope                         */
/* -------------------------------------------- */

/**
 * Scope alliesAnywhere: the rule reaches every other actor on the holder's side, anywhere (token dispositions on the
 * canvas, else Player Character or not - react/core.mjs#areAllies), the holder being a world actor.
 */
registerLinkScope('alliesAnywhere', actor => [...LINK_HOLDERS].map(id => globalThis.game?.actors?.get?.(id)).filter(holder => holder && allied(holder, actor)));
for (const type of ['RollModifier']) {
  if (!RULE_TYPES[type].scopes.includes('alliesAnywhere')) {
    RULE_TYPES[type].scopes.push('alliesAnywhere');
  }
}

/* -------------------------------------------- */
/*  equipmentBroke                               */
/* -------------------------------------------- */

registerEvent('equipmentBroke');

/** Run every world actor's equipmentBroke Triggers (a weapon / armor / shield broke, or a vehicle was destroyed). */
export async function equipmentBroke(item = null) {
  const { fireTriggers } = await import("../../triggers.mjs");
  for (const actor of worldActors().filter(other => rulesOfType(other, 'Trigger').some(entry => entry.rule.event == 'equipmentBroke'))) {
    await fireTriggers(actor, 'equipmentBroke', { roll: item ? { item } : {} });
  }
}

/* -------------------------------------------- */
/*  Wiring                                       */
/* -------------------------------------------- */

const HEALTH_BEFORE = 'e20ExtEHealthBefore';

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
  Hooks.on('essence20.kitPrerequisite', ruleKitPrerequisite);

  // equipmentBroke, on the client that made the change: a weapon / armor / shield flagged broken (Desperate Parry),
  // or a vehicle / Zord / Megaform brought to 0 Health.
  Hooks.on('updateItem', (item, changes, options, userId) => {
    if (userId == globalThis.game?.user?.id && globalThis.foundry?.utils?.getProperty?.(changes, 'flags.essence20.broken') === true
      && ['weapon', 'armor', 'shield'].includes(item.type)) {
      equipmentBroke(item).catch(error => console.error('Essence20 | equipmentBroke failed', error));
    }
  });
  Hooks.on('preUpdateActor', (actor, changes, options) => {
    options[HEALTH_BEFORE] = actor.system?.health?.value ?? null;
  });
  Hooks.on('updateActor', (actor, changes, options, userId) => {
    const health = globalThis.foundry?.utils?.getProperty?.(changes, 'system.health.value');
    if (userId == globalThis.game?.user?.id && ['vehicle', 'zord', 'megaform'].includes(actor.type)
      && health !== undefined && Number(health) <= 0 && (options?.[HEALTH_BEFORE] ?? 1) > 0) {
      equipmentBroke().catch(error => console.error('Essence20 | equipmentBroke failed', error));
    }
  });
}

