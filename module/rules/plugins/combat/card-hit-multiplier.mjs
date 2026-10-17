// Round 14 (dice): HitMultiplier `stage: "card"` - multiplied while the check card's rows are built (dice.mjs
// _rollSkillHelper, right after the Critical Success multiplier and the crit immunity), where the hand-written
// "double / triple damage against X" Perks multiplied: before the post-pass flat adds (Flame Warlord, Nowhere is Safe)
// and before every hit rider (Reveal Weakness, the slices', the rules' flat bonuses). The row's damage is simply
// multiplied - no note, as the old code did. Plate Piercing, Raze And Ruin.
import { registerRuleType, RULE_TYPES } from "../../types.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { resolveValue } from "../../formula.mjs";
import { multiplierEntries } from "../zords/megaform-finisher.mjs";
import { rulesOfType } from "../../index.mjs";
import { sourceOf } from "../../../items/shared/item-lookups.mjs";

// Round 15 (dice): CardDamage {add} - a flat amount added to the row's own damage while the card is built, right after
// the stage-card multipliers (no note - the number on the row changes, so later doublings such as Empty the Mag count it).
// `when` sees the row like a stage-card HitMultiplier, plus @var.multiplier / var:multiplier (the row's Degrees of
// Success); `add` reads @target.<path> (the row's target). Smash! (+1 per Size Class larger), Flame Warlord (+1 on a
// Critical Success row).
registerRuleType('CardDamage', {
  params: { add: { kind: 'formula', required: true } },
  scopes: ['self'],
});

const HIT_MULTIPLIER = RULE_TYPES.HitMultiplier;
if (HIT_MULTIPLIER && !HIT_MULTIPLIER.params.stage) {
  HIT_MULTIPLIER.params.stage = { kind: 'enum', options: ['card'] };
}

/**
 * Multiply the damage of each damaging row with a target by the roller's `stage: "card"` HitMultiplier rules whose
 * `when` holds (self = the roller, target = the row's target; the roll's item, Skill, melee / ranged, switches and
 * damage type as a HitRider sees them). One book item's rule counts once per row.
 * @param {Actor} actor
 * @param {Array<Object>} results   The card's rows (mutated).
 * @param {Object} checkContext
 */
export async function applyCardHitMultipliers(actor, results, checkContext = {}) {
  const entries = multiplierEntries(actor).filter(entry => entry.rule.stage == 'card');
  const adds = rulesOfType(actor, 'CardDamage');
  if (!entries.length && !adds.length) {
    return;
  }

  const rider = checkContext?.riderContext ?? {};
  const rolled = rider.itemUuid ? globalThis.fromUuidSync?.(rider.itemUuid) ?? null : null;
  const isAttack = rolled?.type == 'weaponEffect';
  const facts = {
    item: rolled, rolledSkill: rider.skill, isAttack, isMelee: isAttack && rider.style == 'melee', switches: rider.switches ?? [],
    dataset: rider.dataset, damageType: checkContext?.damageType ?? rider.damageType,
  };
  for (const result of Array.isArray(results) ? results : []) {
    if (!result?.damageValue || !result.targetUuid) {
      continue;
    }

    const target = await globalThis.fromUuid?.(result.targetUuid) ?? null;
    const seen = new Set();
    for (const { rule, item, index, holder } of entries) {
      const key = `${sourceOf(item) ?? item?.id}#${index}`;
      if (seen.has(key) || evaluate(rule.when, contextFor({ ...facts, self: actor, holder, ruleItem: item, other: target })) !== true) {
        continue;
      }

      seen.add(key);
      const times = Number(resolveValue(rule.multiply, { actor: holder, item }, 1));
      if (Number.isFinite(times) && times > 0) {
        result.damageValue *= times;
      }
    }

    // CardDamage: flat adds, after the multipliers (one book item's rule once per row).
    const vars = { multiplier: Number(result.multiplier) || 0 };
    for (const { rule, item, index } of adds) {
      const key = `add:${sourceOf(item) ?? item?.id}#${index}`;
      if (seen.has(key) || evaluate(rule.when, contextFor({ ...facts, self: actor, holder: actor, ruleItem: item, other: target, vars })) !== true) {
        continue;
      }

      seen.add(key);
      const amount = Math.round(resolveValue(rule.add, { actor, item, other: target, vars }, 0));
      if (amount) {
        result.damageValue = Math.max(0, result.damageValue + amount);
      }
    }
  }
}

// Round 15 (dice): HitMultiplier `stage: "late"` - multiplied once the card's rows are otherwise done (dice.mjs
// _rollSkillHelper, after the trait riders, Blinding Blast, Deafening and Mode Lock - where Empty the Mag doubled), so
// everything added to a row before it (CardDamage, the riders' flat bonuses) is multiplied too. Every damaging row
// counts, with or without a target. `when` as for stage "card" (roll:switch:<key> - Empty the Mag's switch).
if (HIT_MULTIPLIER && !HIT_MULTIPLIER.params.stage.options.includes('late')) {
  HIT_MULTIPLIER.params.stage.options.push('late');
}

/**
 * Multiply the damage of each damaging row by the roller's `stage: "late"` HitMultiplier rules whose `when` holds.
 * @param {Actor} actor
 * @param {Array<Object>} results   The card's rows (mutated).
 * @param {Object} checkContext
 */
export async function applyLateHitMultipliers(actor, results, checkContext = {}) {
  const entries = multiplierEntries(actor).filter(entry => entry.rule.stage == 'late');
  if (!entries.length) {
    return;
  }

  const rider = checkContext?.riderContext ?? {};
  const rolled = rider.itemUuid ? globalThis.fromUuidSync?.(rider.itemUuid) ?? null : null;
  const isAttack = rolled?.type == 'weaponEffect';
  const facts = {
    item: rolled, rolledSkill: rider.skill, isAttack, isMelee: isAttack && rider.style == 'melee', switches: rider.switches ?? [],
    dataset: rider.dataset, damageType: checkContext?.damageType ?? rider.damageType,
  };
  for (const result of Array.isArray(results) ? results : []) {
    if (!result?.damageValue) {
      continue;
    }

    const target = result.targetUuid ? await globalThis.fromUuid?.(result.targetUuid) ?? null : null;
    const seen = new Set();
    for (const { rule, item, index, holder } of entries) {
      const key = `${sourceOf(item) ?? item?.id}#${index}`;
      if (seen.has(key) || evaluate(rule.when, contextFor({ ...facts, self: actor, holder, ruleItem: item, other: target })) !== true) {
        continue;
      }

      seen.add(key);
      const times = Number(resolveValue(rule.multiply, { actor: holder, item }, 1));
      if (Number.isFinite(times) && times > 0) {
        result.damageValue *= times;
      }
    }
  }
}
