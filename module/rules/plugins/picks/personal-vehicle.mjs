import { companionsOf } from "../../../mechanics/companions/companion-link.mjs";
import { registerTag } from "../../predicate.mjs";
import { registerRecipient } from "../../steps.mjs";

/**
 * Personal vehicles in rules (round 15, systems - docs/rules-batches/slSystems15.md) - the vehicles
 * mechanics/companions/summons.mjs builds for their owner (flags.essence20.personalVehicle: jetPack, sharkCycle, ridingRig...):
 *   recipient personalVehicle:<key>   the actor's first personal vehicle of that kind
 *   tag self:personalVehicle:<key>    the actor has one
 * Crashing From The Skies (the Jet Pack's upgrade).
 */

const personalVehicles = (owner, key) => companionsOf(owner).filter(actor => actor.type == 'vehicle' && actor.flags?.essence20?.personalVehicle == key);

registerRecipient(/^personalVehicle:([\w-]+)$/, (match, ctx) => personalVehicles(ctx.actor, match[1]).slice(0, 1));

registerTag('self:personalVehicle', (rest, ctx) => (ctx.self && rest ? personalVehicles(ctx.self, rest).length > 0 : null), { phrase: ['{who} {has} a personal {arg}', '{who} {has} no personal {arg}'] });
