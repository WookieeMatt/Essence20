import { companionsOf, isCompanionPair, ownerOf } from "../../../mechanics/companions/companion-link.mjs";
import { isAdjacent, isDocked, rolledAgainst } from "../../../mechanics/companions/companions.mjs";
import { linkedEntries } from "../../links.mjs";
import { registerTag } from "../../predicate.mjs";
import { registerRecipient } from "../../steps.mjs";
import { RULE_TYPES } from "../../types.mjs";
import { HIT_RIDER_SOURCES } from "../combat/hit-rider.mjs";

/**
 * Companions in rules (round 15, uses) - the owner / companion links mechanics/companions/companions.mjs keeps:
 *
 * Recipients
 *   companions[:<type>]       every companion of the actor (of that system.type: pet, drone, miniCon, human)
 *   firstCompanion:<type>     the first such companion ("your drone")
 *   selfOrCompanion:<type>    the actor itself when it is a companion, else its first companion of that type
 *   companionOwner            the actor a companion belongs to
 *   flagActor:<flag>          the actor whose uuid the actor keeps at flags.essence20.<flag>
 *
 * Tags (family `link`, decided at roll time)
 *   link:hasCompanion[:<type>]        self has a companion (of that type)
 *   link:pair                        self and the other party are a companion and its owner, or two companions of one owner
 *   link:ownCompanion[:<type>]        the other party is one of self's companions (of that type)
 *   link:rolledAgainst:partner[:attack]  one of self's partners (a companion: its owner and the owner's other companions;
 *                                     an owner: its companions) rolled (an attack) against the other party this round
 *   link:rolledAgainst:owner[:attack] self's owner did
 *   link:deployedThisRound[:<type>]   the rule's holder has a companion (of that type) out of its dock, deployed this combat round
 *   link:holderDeployed               the rule's holder (a Mini-Con) isn't docked
 *   link:targetAdjacentToHolder       the other party's token is adjacent to the holder's
 *   link:selfAdjacentToHolder         self's token is adjacent to the holder's
 *   "This round" is companions.mjs's own record (flags.essence20.rolledThisRound, per combat round, else per scene).
 *
 * HitRider `scope: "companion"` - an owner's HitRider rule acts on its companions' hits (self: = the companion).
 */

const holderOf = ctx => ctx.holder ?? ctx.self;

function partnersOf(actor) {
  if (actor?.type == 'companion') {
    const owner = ownerOf(actor);
    return [owner, ...companionsOf(owner)].filter(other => other && other.uuid != actor.uuid);
  }

  return companionsOf(actor);
}

function deployedThisRound(owner, type) {
  const combat = globalThis.game?.combat;
  return companionsOf(owner, { type: type || null }).some(companion => {
    const at = companion.flags?.essence20?.miniCon?.deployedRound;
    return !isDocked(companion) && !!at && !!combat && at.combatId == combat.id && at.round == combat.round;
  });
}

registerTag('link', (rest, ctx) => {
  const [what, arg, extra] = String(rest).split(':');
  switch (what) {
  case 'hasCompanion': return companionsOf(ctx.self, { type: arg || null }).length > 0;
  case 'pair': return ctx.other ? isCompanionPair(ctx.self, ctx.other) : false;
  case 'ownCompanion': return ctx.other ? companionsOf(ctx.self, { type: arg || null }).some(companion => companion.uuid == ctx.other.uuid) : false;
  case 'rolledAgainst': {
    if (!ctx.other) {
      return false;
    }

    const who = arg == 'owner' ? [ownerOf(ctx.self)].filter(Boolean) : partnersOf(ctx.self);
    return who.some(partner => rolledAgainst(partner, ctx.other, { attack: extra == 'attack' }));
  }

  case 'deployedThisRound': return deployedThisRound(holderOf(ctx), arg);
  case 'holderDeployed': return !isDocked(holderOf(ctx));
  case 'targetAdjacentToHolder': return ctx.other ? isAdjacent(holderOf(ctx), ctx.other) : false;
  case 'selfAdjacentToHolder': return isAdjacent(holderOf(ctx), ctx.self);
  default: return null;
  }
}, { family: 'roll', param: 'text', phrase: (arg, w) => {
  const [what, kind, extra] = arg.split(':');
  const type = kind ? `${w.humanize(kind)} ` : '';
  return {
    hasCompanion: [`{who} {has} a ${type}companion`, `{who} {has} no ${type}companion`],
    pair: ['you and the target are a companion and its owner', "you and the target aren't a companion and its owner"],
    ownCompanion: [`the target is one of your ${type}companions`, `the target isn't one of your ${type}companions`],
    rolledAgainst: [`your ${kind == 'owner' ? 'owner' : 'partner'} already ${extra == 'attack' ? 'attacked' : 'rolled against'} the target this round`, `your ${kind == 'owner' ? 'owner' : 'partner'} hasn't ${extra == 'attack' ? 'attacked' : 'rolled against'} the target this round`],
    deployedThisRound: [`its owner deployed a ${type}companion this round`, `its owner hasn't deployed a ${type}companion this round`],
    holderDeployed: ["its owner isn't docked", 'its owner is docked'],
    targetAdjacentToHolder: ['the target is next to its owner', "the target isn't next to its owner"],
    selfAdjacentToHolder: ['you are next to its owner', "you aren't next to its owner"],
  }[what] ?? null;
} });

registerRecipient(/^companions(?::(\w+))?$/, (match, ctx) => companionsOf(ctx.actor, { type: match[1] || null }));
registerRecipient(/^firstCompanion:(\w+)$/, (match, ctx) => companionsOf(ctx.actor, { type: match[1] }).slice(0, 1));
registerRecipient(/^selfOrCompanion:(\w+)$/, (match, ctx) => (ctx.actor?.type == 'companion' ? [ctx.actor] : companionsOf(ctx.actor, { type: match[1] }).slice(0, 1)));
registerRecipient('companionOwner', (match, ctx) => [ownerOf(ctx.actor)].filter(Boolean));
registerRecipient(/^flagActor:([\w-]+)$/, (match, ctx) => {
  const uuid = ctx.actor?.flags?.essence20?.[match[1]];
  const actor = typeof uuid == 'string' && uuid ? globalThis.fromUuidSync?.(uuid, { strict: false }) ?? null : null;
  return actor ? [actor] : [];
});

/*
 * HitRider scope companion: the owner's rule on a companion's hit. Assist scope companion: an owner's Assist rule
 * reaches its companions as helpers / helped (rules/adapter.mjs#ruleAssist already walks linked entries).
 */
for (const type of ['HitRider', 'Assist']) {
  if (RULE_TYPES[type] && !RULE_TYPES[type].scopes.includes('companion')) {
    RULE_TYPES[type].scopes.push('companion');
  }
}

HIT_RIDER_SOURCES.push(attacker => linkedEntries(attacker, 'HitRider').filter(({ rule }) => rule.scope == 'companion' && !rule.watch && !rule.marked));
