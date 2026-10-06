import { rulesOfType } from "../../index.mjs";
import { linkedEntries } from "../../links.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { resolveValue } from "../../formula.mjs";
import { registerRuleType } from "../../types.mjs";

/**
 * Group A: rule hooks in the hand-written Zord / vehicle timing helpers.
 *
 * - Rule type `JoinTime` {amount, min?} (scope ownZord, on a Ranger's item): their Zord is ready to combine `amount`
 *   rounds sooner (dice allowed: "1d4"), at least `min` (default 1) - mechanics/vehicles/combiner-timer.mjs. One rule counts.
 * - Rule type `SummonTime` {mode: halve | subtract, amount?, min?}: the summoned Zord arrives sooner -
 *   mechanics/vehicles/zord-summon.mjs, the summoner's rules first (Unique Weapon (Small Melee): halve, rounded up), then the
 *   Zord's own (Genetic Resonance: 2 rounds sooner). Never below `min` (default 1).
 * - Rule type `AutoDisembark` {who?: driver | pilots}: the holder passes the emergency disembark test without rolling
 *   (mechanics/vehicles/vehicle-defeat.mjs) - from a vehicle they drive (driver), or (pilots) one they drive or, when nobody
 *   drives it, any vehicle they crew.
 *
 * The rest of group A's hook pieces, registered right around this file (see ../index.mjs): the beforeRoll /
 * groupTestResult events (rolls/before-roll-and-group-test-events.mjs), KnownOptions (picks/known-options.mjs), the
 * Movement stage derivedHook (effects/derived-hook-stage.mjs), the team re-prepare at ready
 * (effects/team-rules-ready-reset.mjs) and the team:holds / scene:tokenWithin tags (tags/team-holds-and-token-within.mjs).
 */

/* -------------------------------------------- */
/*  Combining and summoning                      */
/* -------------------------------------------- */

registerRuleType('JoinTime', {
  params: { amount: { kind: 'formula', required: true }, min: { kind: 'formula' } },
  scopes: ['self', 'ownZord'],
});

/** A Zord's rolled join time, after its owner's JoinTime rule (mechanics/vehicles/combiner-timer.mjs). */
export function ruleJoinTime(zord, total, random = undefined) {
  const entry = [...rulesOfType(zord, 'JoinTime', 'self').map(e => ({ ...e, holder: zord })), ...linkedEntries(zord, 'JoinTime')]
    .find(({ rule, item, holder }) => evaluate(rule.when, contextFor({ self: zord, holder, ruleItem: item })) === true);
  if (!entry) {
    return total;
  }

  const scope = { actor: entry.holder, item: entry.item, random };
  return Math.max(Math.round(resolveValue(entry.rule.min ?? 1, scope, 1)), total - Math.round(resolveValue(entry.rule.amount, scope, 0)));
}

registerRuleType('SummonTime', {
  params: { mode: { kind: 'enum', required: true, options: ['halve', 'subtract'] }, amount: { kind: 'formula' }, min: { kind: 'formula' } },
  scopes: ['self'],
  validate: rule => (rule.mode == 'subtract' && rule.amount === undefined ? ['subtract needs an amount'] : []),
});

/** The rounds a summoned Zord takes to arrive, after the summoner's and the Zord's SummonTime rules. */
export function ruleSummonRounds(summoner, zord, rounds) {
  let out = rounds;
  for (const actor of [summoner, zord].filter(Boolean)) {
    for (const { rule, item } of rulesOfType(actor, 'SummonTime')) {
      if (evaluate(rule.when, contextFor({ self: actor, ruleItem: item })) !== true) {
        continue;
      }

      const min = Math.round(resolveValue(rule.min ?? 1, { actor, item }, 1));
      out = rule.mode == 'halve' ? Math.max(min, Math.ceil(out / 2)) : Math.max(min, out - Math.round(resolveValue(rule.amount ?? 0, { actor, item }, 0)));
    }
  }

  return out;
}

registerRuleType('AutoDisembark', {
  params: { who: { kind: 'enum', options: ['driver', 'pilots'] } },
  scopes: ['self'],
});

/**
 * Whether a crew member passes the emergency disembark test outright (mechanics/vehicles/vehicle-defeat.mjs).
 * @param {Actor} crewMember
 * @param {Object} entry    Their crew row ({uuid, vehicleRole}).
 * @param {Actor} vehicle
 */
export function ruleAutoDisembark(crewMember, entry, vehicle = null) {
  const rows = Object.values(vehicle?.system?.actors ?? {});
  const someoneDrives = rows.some(row => row?.vehicleRole == 'driver');
  return rulesOfType(crewMember, 'AutoDisembark').some(({ rule, item }) => {
    const pilots = entry?.vehicleRole == 'driver' || ((rule.who ?? 'driver') == 'pilots' && !someoneDrives);
    return pilots && evaluate(rule.when, contextFor({ self: crewMember, ruleItem: item })) === true;
  });
}
