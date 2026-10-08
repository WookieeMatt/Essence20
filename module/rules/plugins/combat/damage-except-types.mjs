import { RULE_TYPES } from "../../types.mjs";

/**
 * Round 15 (dice part): DamageModifier `exceptTypes: [types]` (direction taken) - applies to damage of any type but
 * those (rules/adapter.mjs#ruleDamageTaken). Flame Warlord's "-1 to non-Energy damage while in Monster Form":
 * `{direction: "taken", amount: -1, exceptTypes: [the Energy types], when: ["check:monsterForm"]}`.
 */

const DAMAGE_MODIFIER = RULE_TYPES.DamageModifier;
if (DAMAGE_MODIFIER && !DAMAGE_MODIFIER.params.exceptTypes) {
  DAMAGE_MODIFIER.params.exceptTypes = { kind: 'strings' };
}

