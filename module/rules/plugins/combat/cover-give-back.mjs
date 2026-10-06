import { RULE_TYPES } from "../../types.mjs";

/**
 * Cover `mode: "giveBack"` (round 15, systems - docs/rules-batches/slSystems15.md), the holder's own ranged attacks (a
 * scope host rule: an upgrade's weapon): when the target's Cover puts its ↓ on the attack, a matching ↑ source "Scope:
 * firing through smoke or darkness" hands it back - a source the player unticks when the Cover is solid (dice.mjs's
 * Cover block, read through rules/adapter.mjs#ruleCover's `giveBack`). Several such rules give one source. Thermal Scope,
 * Smart Scope.
 */
const COVER = RULE_TYPES.Cover;
if (!COVER.params.mode.options.includes('giveBack')) {
  COVER.params.mode.options.push('giveBack');
}

{
  const inner = COVER.validate;
  COVER.validate = rule => [
    ...(inner?.(rule) ?? []),
    ...(rule.mode == 'giveBack' && rule.against ? ['giveBack only applies to the holder\'s own attacks'] : []),
  ];
}
