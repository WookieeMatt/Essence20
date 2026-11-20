// Rules-engine tags for riding a creature (mechanics/companions/mounts.mjs). Registered on import; see
// module/rules/plugins/index.mjs.
import { mountOf, riderEntries } from "../../../mechanics/companions/mounts.mjs";
import { registerTag } from "../../predicate.mjs";

/**
 * - self:mounted / target:mounted - that actor is riding a creature (a Perk for fighting from the saddle).
 * - self:ridden / target:ridden - that actor has someone riding it (a mount's own Perk).
 */
const mounted = actor => (actor ? !!mountOf(actor) : null);
const ridden = actor => (actor ? riderEntries(actor).length > 0 : null);

registerTag('self:mounted', (rest, ctx) => mounted(ctx.self), { phrase: ['{who} {is} riding a mount', "{who} {isnt} riding a mount"] });
registerTag('target:mounted', (rest, ctx) => mounted(ctx.other), { phrase: ['{who} {is} riding a mount', "{who} {isnt} riding a mount"] });
registerTag('self:ridden', (rest, ctx) => ridden(ctx.self), { phrase: ['{who} {has} a rider', '{who} {has} no rider'] });
registerTag('target:ridden', (rest, ctx) => ridden(ctx.other), { phrase: ['{who} {has} a rider', '{who} {has} no rider'] });
