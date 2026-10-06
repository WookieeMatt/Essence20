import { companionsOf } from "../../../mechanics/companions/companion-link.mjs";
import { LINK_HOLDERS } from "../../index.mjs";
import { registerLinkScope } from "../../links.mjs";
import { evaluateTag, registerTag } from "../../predicate.mjs";
import { registerPickSource, registerRecipient } from "../../steps.mjs";
import { RULE_TYPES, SCOPES } from "../../types.mjs";
import {
  crewRows, crewing, driverOf, flagOf, holderOf, isCombinerForm, itemsOf, listsZord, megaformsContaining, ownedZords, ownsZord,
  parentWeaponOf, resolve, rosterOf, sourceOf, worldActors,
} from "../shared/zord-crew-lookups.mjs";

/**
 * Group A: rules that reach between Megaforms and their participants, and between a Ranger and their Zords.
 *
 * Scopes (rules/links.mjs#registerLinkScope):
 *   megaform   on a participant's item - every Megaform it is part of (Accurate Combiner, Roller Drum)
 *   ownZord    on a character's item - every Zord listed on their sheet (Terrorzord Nature, Megaform Expeditor)
 *
 * Tags:
 *   megaform:in[:zord|:combiner]   this actor is part of a Megaform (a Megazord / a Combiner form)
 *   megaform:is[:zord|:combiner]   this actor is a Megaform (of that kind)
 *   megaform:participantAttack     the Megaform's roll uses one of its participants' attacks
 *   megaform:holderAttack          ...the rule holder's own attack (the participant whose item it is)
 *   megaform:generated             the rolled attack (or its weapon) was generated on the Megaform
 *   self:megaformTrait:<type> / target:   holds a Megaform Trait of that type (coreBody, defender...)
 *   vehicle:ownZord                crewing a Zord that is theirs (listed on the sheet, or linked as its owner)
 *   self:ownedByHolder             this Zord is the rule holder's own (listed, or linked as its owner)
 *   self:ownsZordOnCanvas          a Zord listed on this sheet has a token in the viewed scene
 *   self:advancedRole              the actor's Role is an Advanced one
 *   self:commanded / target:       Commanded this round (mechanics/companions/companions.mjs's petCommand stamp)
 *   companion:uncommanded[:<type>] one of this actor's companions (of that companion type - pet, drone...) wasn't Commanded this round
 *
 * Recipients: megaform (the Megaforms the actor is in), participants (the actor's roster - itself a Megaform),
 * ownZords, holder (the actor holding the rule's item), driver (the vehicle's driver), combinerTop (the first target's
 * active components with the most Health).
 * Pick sources: ownedZords (the actor's own Zords, value uuid), crew (a vehicle's seated crew - `filter` tags asked as
 * the target; value uuid).
 */

/* -------------------------------------------- */
/*  Scopes                                       */
/* -------------------------------------------- */

/** Actors that hold a linked rule (cheap - rules/index.mjs keeps the list). */
function linkHolders() {
  const ids = LINK_HOLDERS.keys?.() ?? LINK_HOLDERS;
  return [...ids].map(id => globalThis.game?.actors?.get?.(id)).filter(Boolean);
}

registerLinkScope('megaform', actor => (actor?.type == 'megaform' ? rosterOf(actor) : []));
registerLinkScope('ownZord', actor => (actor?.type == 'zord' ? linkHolders().filter(holder => listsZord(holder, actor)) : []));

for (const scope of ['megaform', 'ownZord']) {
  if (!SCOPES.includes(scope)) {
    SCOPES.push(scope);
  }

  // Every rule type a linked scope can carry today (those taking `vehicle`) takes these too.
  for (const definition of Object.values(RULE_TYPES)) {
    if (definition.scopes?.includes('vehicle') && !definition.scopes.includes(scope)) {
      definition.scopes.push(scope);
    }
  }
}

/* -------------------------------------------- */
/*  Megaform tags                                */
/* -------------------------------------------- */

const MIRROR_FLAG = 'zord1MirrorOf';

/** The participant whose attack a Megaform's rolled item is (null when it can't be told). */
export function attackOwner(megaform, item) {
  const weapon = parentWeaponOf(megaform, item);
  const roster = rosterOf(megaform);
  const mirror = flagOf(weapon, MIRROR_FLAG) ?? flagOf(item, MIRROR_FLAG);
  if (mirror) {
    const uuid = String(mirror).split('|')[0];
    return roster.find(actor => actor.uuid == uuid) ?? null;
  }

  // The attacks zord2/megaform-attacks.mjs builds remember the participant weapon they came from.
  const built = flagOf(weapon, 'zord2WeaponUuid') ?? flagOf(item, 'zord2WeaponUuid');
  if (built) {
    const owner = roster.find(actor => String(built).startsWith(`${actor.uuid}.`));
    if (owner) {
      return owner;
    }
  }

  // Otherwise: the participant holding a weapon of the same compendium source or name.
  const key = sourceOf(weapon) ?? null;
  const name = weapon?.name ?? item?.name;
  return roster.find(actor => itemsOf(actor).some(other => other.type == (weapon ? 'weapon' : 'weaponEffect')
    && ((key && sourceOf(other) == key) || other.name == name))) ?? null;
}

const kindMatches = (form, kind) => !kind || (kind == 'combiner' ? isCombinerForm(form) : kind == 'zord' ? !isCombinerForm(form) : false);

registerTag('megaform', (rest, ctx) => {
  const [what, kind] = rest.split(':');
  const self = ctx.self;
  switch (what) {
  case 'in': return megaformsContaining(self).some(form => kindMatches(form, kind));
  case 'is': return self?.type == 'megaform' && kindMatches(self, kind);
  case 'participantAttack':
    return self?.type == 'megaform' && ctx.item ? !!attackOwner(self, ctx.item) : false;
  case 'holderAttack': {
    const holder = ctx.holder && ctx.holder !== self ? ctx.holder : holderOf(ctx.ruleItem);
    const owner = self?.type == 'megaform' && ctx.item ? attackOwner(self, ctx.item) : null;
    return !!owner && !!holder && (owner === holder || owner.uuid == holder.uuid);
  }

  case 'generated': {
    const item = ctx.item;
    return !!item && (!!flagOf(item, 'zord2Gen') || !!flagOf(parentWeaponOf(self, item), 'zord2Gen'));
  }
  }

  return null;
}, { family: 'situation', param: 'megaformTag' });

const holdsTrait = (actor, type) => itemsOf(actor).some(item => item.type == 'megaformTrait' && item.system?.type == type);
registerTag('self:megaformTrait', (rest, ctx) => holdsTrait(ctx.self, rest));
registerTag('target:megaformTrait', (rest, ctx) => (ctx.other ? holdsTrait(ctx.other, rest) : false));

/* -------------------------------------------- */
/*  Zord ownership tags                          */
/* -------------------------------------------- */

registerTag('vehicle:ownZord', (rest, ctx) => {
  const crewed = crewing(ctx.self);
  return !!crewed && crewed.vehicle.type == 'zord' && ownsZord(ctx.self, crewed.vehicle);
});

registerTag('self:ownedByHolder', (rest, ctx) => {
  const holder = ctx.holder && ctx.holder !== ctx.self ? ctx.holder : holderOf(ctx.ruleItem);
  return !!holder && ownsZord(holder, ctx.self);
});

registerTag('self:ownsZordOnCanvas', (rest, ctx) => ownedZords(ctx.self).some(zord => (zord.getActiveTokens?.() ?? []).length > 0));

registerTag('self:advancedRole', (rest, ctx) => !!itemsOf(ctx.self).find(item => item.type == 'role')?.system?.isAdvanced);

/* -------------------------------------------- */
/*  Companions                                   */
/* -------------------------------------------- */

/** Whether a companion was Commanded this round (mechanics/companions/companions.mjs#commandPet stamps flags.essence20.petCommand). */
export function commandedThisRound(actor, combat = globalThis.game?.combat) {
  const command = flagOf(actor, 'petCommand');
  return !!command && !!combat && command.combatId == combat.id && command.round == combat.round;
}

registerTag('self:commanded', (rest, ctx) => commandedThisRound(ctx.self, ctx.combat ?? undefined));
registerTag('target:commanded', (rest, ctx) => (ctx.other ? commandedThisRound(ctx.other, ctx.combat ?? undefined) : false));
registerTag('holder:commanded', (rest, ctx) => commandedThisRound(ctx.holder ?? ctx.self, ctx.combat ?? undefined));

registerTag('companion', (rest, ctx) => {
  const [what, type] = rest.split(':');
  if (what == 'uncommanded') {
    return companionsOf(ctx.self, { type: type || null }).some(companion => !commandedThisRound(companion, ctx.combat ?? undefined));
  }

  return null;
}, { family: 'situation', param: 'companionTag' });

/* -------------------------------------------- */
/*  Recipients and pick sources                  */
/* -------------------------------------------- */

registerRecipient('megaform', (match, ctx) => megaformsContaining(ctx.actor));
registerRecipient('participants', (match, ctx) => rosterOf(ctx.actor));
registerRecipient('ownZords', (match, ctx) => ownedZords(ctx.actor));
registerRecipient('holder', (match, ctx) => [holderOf(ctx.item) ?? ctx.actor].filter(Boolean));
registerRecipient('driver', (match, ctx) => [driverOf(ctx.actor)].filter(Boolean));
/** A Combiner form's active components (Health above 0) with the most Health - ties all count. */
export function topComponents(form) {
  const components = rosterOf(form).filter(member => !['zord', 'vehicle', 'megaform'].includes(member.type));
  const active = components.filter(member => (Number(member.system?.health?.value) || 0) > 0);
  const top = Math.max(...active.map(member => Number(member.system.health.value) || 0));
  return active.filter(member => (Number(member.system.health.value) || 0) == top);
}

registerRecipient('combinerTop', (match, ctx) => (isCombinerForm(ctx.targets[0]) ? topComponents(ctx.targets[0]) : []));

registerPickSource('ownedZords', (step, ctx) => ownedZords(ctx.actor).map(zord => ({ value: zord.uuid, label: zord.name })));

// crew: the vehicle's seated crew (this actor's own crew), `filter` tags asked of each as the target.
registerPickSource('crew', (step, ctx) => crewRows(ctx.actor).map(entry => entry.actor)
  .filter(actor => !Array.isArray(step.filter) || !step.filter.length
    || step.filter.every(tag => evaluateTag(tag, { self: ctx.actor, ruleItem: ctx.item, other: actor, combat: globalThis.game?.combat ?? null }) === true))
  .map(actor => ({ value: actor.uuid, label: actor.name })));

export { resolve, worldActors };
