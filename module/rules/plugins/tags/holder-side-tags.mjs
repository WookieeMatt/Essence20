import { registerTag } from "../../predicate.mjs";

/**
 * Round 15 (items2): `self:sameSideAsHolder` / `target:sameSideAsHolder` - that actor is the rule's holder, or on its side
 * (the active token's disposition, else the prototype token's - items/shared/sides.mjs#sameSide). For rules a mark
 * carries to someone else (scope marked / markedTarget): "the user and allies in the same faction". `self:allyOfHolder`
 * leaves the holder out.
 */
const dispositionOf = actor => actor?.getActiveTokens?.()?.[0]?.document?.disposition ?? actor?.prototypeToken?.disposition ?? null;

export function sameSideAsHolder(actor, ctx) {
  const holder = ctx?.holder ?? ctx?.ruleItem?.parent ?? null;
  if (!actor || !holder) {
    return false;
  }

  if (actor === holder || (!!actor.uuid && actor.uuid == holder.uuid)) {
    return true;
  }

  const mine = dispositionOf(actor);
  return mine !== null && mine == dispositionOf(holder);
}

registerTag('self:sameSideAsHolder', (rest, ctx) => sameSideAsHolder(ctx?.self, ctx));
registerTag('target:sameSideAsHolder', (rest, ctx) => sameSideAsHolder(ctx?.other, ctx));
