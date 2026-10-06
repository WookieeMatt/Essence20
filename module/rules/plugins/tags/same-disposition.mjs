import { registerTag } from "../../predicate.mjs";

/**
 * Tag `target:sameDisposition` (round 15, systems - docs/rules-batches/slSystems15.md): both this actor and the other
 * party have a token on the canvas and those tokens share a disposition (neutral with neutral counts). False off the
 * canvas or with no other party - unlike `target:ally` / `target:sideAlly`, which fall back to Player Character or
 * prototype tokens. Chronomantic Pulse's "a willing creature" (yourself, or a token on your side).
 */
registerTag('target:sameDisposition', (rest, ctx) => {
  const mine = ctx.self?.getActiveTokens?.()?.[0];
  const theirs = ctx.other?.getActiveTokens?.()?.[0];
  return !!mine && !!theirs && mine.document?.disposition === theirs.document?.disposition;
});

/**
 * Tag `self:roleName:<text>` (round 15, systems): one of the actor's Role items has that text in its name (any case) -
 * a Ranger's colour ("black", "pink"), the way items/attacks/weapon-upgrades.mjs read it for Power Weapon Element Damage
 * Assignment. (`self:hasItem:name~<text>` asks every item, not only Roles.)
 */
registerTag('self:roleName', (rest, ctx) => {
  const items = ctx.self?.items?.contents ?? (ctx.self?.items ? [...ctx.self.items] : []);
  const text = String(rest ?? '').toLowerCase();
  return !!text && items.some(item => item?.type == 'role' && String(item.name ?? '').toLowerCase().includes(text));
});
