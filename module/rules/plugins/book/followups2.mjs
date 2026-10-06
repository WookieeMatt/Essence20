import { registerUntilOf } from "../../steps.mjs";
import { crewOf } from "../zords/crew-recipient.mjs";

/**
 * Book check 2026-10-06, follow-ups round 2 (docs/rules-batches/book-followups2.md).
 *
 * untilOf: "user" - a vehicle's Use counts the turns of the crew member using it ("until the start of their next turn",
 * Electronic Countermeasures, Quartermaster's Guide p.59). The vehicle isn't in the turn order; the crew member is:
 * the seated crew member whose turn it is now (a Move action is spent on your own turn), else this user's own
 * character when it is aboard, else the first crew member this user owns (not as GM). Nobody found: the holder.
 */
export function usingCrewMember(vehicle, { combat = globalThis.game?.combat, user = globalThis.game?.user } = {}) {
  const crew = crewOf(vehicle);
  if (!crew.length) {
    return null;
  }

  const same = (a, b) => !!a && !!b && (a === b || (a.id && a.id == b.id));
  const acting = combat?.started ? combat.combatant?.actor ?? combat.turns?.[Number(combat.turn) || 0]?.actor ?? null : null;
  const pick = crew.find(member => same(member, acting))
    ?? crew.find(member => same(member, user?.character))
    ?? (user?.isGM ? null : crew.find(member => member?.isOwner))
    ?? null;
  return pick;
}

registerUntilOf('user', ctx => usingCrewMember(ctx.actor));
