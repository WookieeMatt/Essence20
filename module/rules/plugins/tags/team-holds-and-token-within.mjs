import { evaluate, feetBetween, registerTag } from "../../predicate.mjs";
import { itemsOf, sourceOf, worldActors } from "../shared/zord-crew-lookups.mjs";

/**
 * Group A (round 10): tags `team:holds:<item uuid>` (another Player Character holds that compendium item) and
 * `scene:tokenWithin:<ft>:<tags joined by &>` (some other token within that many feet meets them, asked as the target).
 */

registerTag('team', (rest, ctx) => {
  const held = /^holds:(.+)$/.exec(rest);
  if (!held) {
    return null;
  }

  return worldActors().some(actor => actor?.type == 'playerCharacter' && actor !== ctx.self && actor.uuid != ctx.self?.uuid
    && itemsOf(actor).some(item => sourceOf(item) == held[1] || item.uuid == held[1]));
}, { family: 'situation', param: 'teamTag' });

registerTag('scene:tokenWithin', (rest, ctx) => {
  const match = /^(\d+):(.+)$/.exec(rest);
  const tokens = globalThis.canvas?.tokens?.placeables;
  if (!match || !Array.isArray(tokens)) {
    return null;
  }

  const tags = match[2].split('&');
  return tokens.some(token => {
    const other = token.actor;
    if (!other || other === ctx.self || (ctx.self?.id && other.id == ctx.self.id)) {
      return false;
    }

    const feet = feetBetween(ctx.self, other);
    return feet !== null && feet !== undefined && feet <= Number(match[1]) && tags.every(tag => evaluate([tag], { ...ctx, other }) === true);
  });
});
