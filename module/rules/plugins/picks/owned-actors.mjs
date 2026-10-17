import { registerPickSource } from "../../steps.mjs";
import { worldActors } from "../shared/chat-speaker-helpers.mjs";

/**
 * pick from: ownedActors {actorType?} (round 14, systems - docs/rules-batches/slSystems14.md): every world actor this user
 * may act for (its owner, or the GM), of that actor type - Organic Zord's "your or another Power Ranger's Zord", the
 * same list mechanics/companions/summons.mjs offered (world Zords the user owns). The value is the actor's uuid
 * (to: picked:<key> reaches it).
 */
registerPickSource('ownedActors', step => [...new Set(worldActors())]
  .filter(actor => actor && actor.isOwner && (!step.actorType || actor.type == step.actorType))
  .map(actor => ({ value: actor.uuid, label: actor.name })));
