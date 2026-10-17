import { registerStep } from "../../steps.mjs";
import { ruleIgnoresMissEffects } from "./immunity-readers.mjs";

/**
 * Round 16 (part a): step `targetRowsBeating {defense, required?}` - in an afterRoll Trigger, the run's targets become
 * the creatures the roll was made against whose `defense` (toughness | evasion | willpower | cleverness - the plain
 * Defense value, mechanics/combat/combat.mjs#getDefenseValue) the roll's total also meets: a second compare of the same
 * total, beside the Defense the roll was made against ("compare your test total to their Toughness" - Explosive
 * Aftershock). A row that missed a creature whose misses have no effect (MissImmunity - Seconds Between Click & Boom) is
 * left out, as is a row with no creature. With none left the run stops (`required: false`: it goes on with no targets).
 * Reads the roll's rows (ctx.facts.results, with the check entries' Defense in ctx.facts.entries - rules/triggers.mjs).
 */

const DEFENSES = ['toughness', 'evasion', 'willpower', 'cleverness'];

registerStep('targetRowsBeating', async (step, ctx) => {
  const results = Array.isArray(ctx.facts?.results) ? ctx.facts.results : [];
  const entries = Array.isArray(ctx.facts?.entries) ? ctx.facts.entries : [];
  const { getDefenseValue } = await import("../../../mechanics/combat/combat.mjs");
  const found = [];
  for (const [index, result] of results.entries()) {
    if (!result?.targetUuid) {
      continue;
    }

    const target = globalThis.fromUuidSync?.(result.targetUuid, { strict: false }) ?? null;
    if (!target) {
      continue;
    }

    const entry = entries[index] ?? entries.find(e => e?.targetUuid == result.targetUuid) ?? null;
    if (!result.success && ruleIgnoresMissEffects(target, entry?.defenseType ?? 'evasion')) {
      continue;
    }

    const dif = Number(getDefenseValue(target, step.defense));
    if (dif && Number(result.total) >= dif && !found.includes(target)) {
      found.push(target);
    }
  }

  ctx.targets = found;
  return found.length || step.required === false ? undefined : false;
}, { errors: (step, where) => (DEFENSES.includes(step.defense) ? [] : [`${where}: targetRowsBeating needs a defense (${DEFENSES.join(', ')})`]) });
