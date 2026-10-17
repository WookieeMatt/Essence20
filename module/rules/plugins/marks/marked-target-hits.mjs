import { rulesOfType } from "../../index.mjs";
import { RULE_TYPES } from "../../types.mjs";
import { HIT_RIDER_SOURCES } from "../combat/hit-rider.mjs";
import { marksOf, resolve, sourceOf } from "../shared/hit-rider-lookups.mjs";

/**
 * HitRider `scope: "markedTarget"` + `mark: "<key>"` (round 15, uses) - the rule acts on hits by ANYONE (the holder too)
 * against a creature carrying the holder's mark `<key>` (Reveal Weakness: "attacks that successfully target them deal +1
 * damage"). One book item counts once per hit, however many holders marked the creature.
 */

if (RULE_TYPES.HitRider) {
  if (!RULE_TYPES.HitRider.scopes.includes('markedTarget')) {
    RULE_TYPES.HitRider.scopes.push('markedTarget');
  }

  RULE_TYPES.HitRider.params.mark ??= { kind: 'string' };
}

HIT_RIDER_SOURCES.push((attacker, target) => {
  if (!target) {
    return [];
  }

  const out = [];
  const seen = new Set();
  for (const { key, mark } of marksOf(target)) {
    const setter = resolve(mark?.by);
    for (const entry of setter ? rulesOfType(setter, 'HitRider', 'markedTarget') : []) {
      const once = `${sourceOf(entry.item) ?? entry.item?.name}#${entry.index}`;
      if (entry.rule.mark == key && !seen.has(once)) {
        seen.add(once);
        out.push({ ...entry, holder: setter });
      }
    }
  }

  return out;
});
