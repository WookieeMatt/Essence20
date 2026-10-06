import { registerPickSource } from "../../steps.mjs";
import { contextFor, evaluate, registerTag, sideActorsWithin, SKILL_RANKS } from "../../predicate.mjs";
import { registerRef } from "../../formula.mjs";
import { isExpired } from "../../expiry.mjs";
import { partyMates } from "../../links.mjs";
import { epochFor } from "../../../mechanics/resources/scene-clock.mjs";
import {
  getProperty, holderOf, itemsOf, localize, sameActor, sceneOf, sourceOf, teamMembers, worldActors,
} from "../shared/team-and-availability-helpers.mjs";

/**
 * Group E's tags, @references and pick sources (round 10). Each answers true / false, or null when it can't know.
 */

const lower = text => String(text ?? '').trim().toLowerCase();

/* -------------------------------------------- */
/*  Team / party                                 */
/* -------------------------------------------- */

/**
 * self:inTeamOf:holder[:others] - this actor is on the team of the rule item's holder (the primary Party's roster, or
 * with none every player-owned Player Character - gij3's partyMembers); the holder itself counts unless `:others`.
 * For a button pressed by someone else (runAs: clicker), self is the presser.
 */
registerTag('self:inTeamOf', (rest, ctx) => {
  const [who, mode] = rest.split(':');
  const holder = who == 'holder' ? holderOf(ctx.ruleItem) ?? ctx.holder ?? null : null;
  if (!ctx.self || !holder) {
    return who == 'holder' ? false : null;
  }

  if (sameActor(ctx.self, holder)) {
    return mode != 'others';
  }

  return teamMembers().some(member => sameActor(member, ctx.self));
});

/** self:hasTeammates - someone else is on that team. */
registerTag('self:hasTeammates', (rest, ctx) => teamMembers().some(member => member && !sameActor(member, ctx.self)));

/* -------------------------------------------- */
/*  Recorded picks                               */
/* -------------------------------------------- */

/** A recorded pick's entries (a list, or a lone old {uuid, name}) that haven't run out. */
export function recordedEntries(ruleItem, key) {
  const kept = ruleItem?.flags?.essence20?.rules?.choices?.[key];
  const list = Array.isArray(kept) ? kept : kept && typeof kept == 'object' ? [kept] : [];
  return list.filter(entry => entry && (entry.mission !== undefined ? entry.mission == epochFor('mission') : !isExpired(entry)));
}

const matchesEntry = (item, entry) => !!item && (entry.uuid == sourceOf(item) || entry.uuid == item.uuid || (!!entry.name && lower(entry.name) == lower(item.name)));

/**
 * item:recorded:<key> - the item is one a recording pick (pickActorItem / pickEntry record) kept on the rule's item:
 * its book source, its uuid, or the same name; vehicles recorded there don't count. Null with nothing recorded and no
 * item; entries with an `until` that ran out (or an old mission stamp from another mission) are ignored.
 */
registerTag('item:recorded', (rest, ctx) => {
  const entries = recordedEntries(ctx.ruleItem, rest).filter(entry => entry.kind != 'vehicle');
  if (!ctx.item) {
    return entries.length ? false : null;
  }

  return entries.some(entry => matchesEntry(ctx.item, entry));
});

/** self:crewsRecorded:<key> - this actor crews a vehicle / Zord recorded under that key. */
registerTag('self:crewsRecorded', (rest, ctx) => {
  const entries = recordedEntries(ctx.ruleItem, rest).filter(entry => entry.kind == 'vehicle');
  return entries.some(entry => worldActors().some(vehicle => vehicle?.uuid == entry.uuid
    && Object.values(vehicle.system?.actors ?? {}).some(crew => crew?.uuid == ctx.self?.uuid)));
});

/** var:includes:<key>:<text> - a value the run stored (a list, or comma-joined text) holds that entry (a pick's traits). */
registerTag('var:includes', (rest, ctx) => {
  const [key, ...more] = rest.split(':');
  const value = ctx.vars?.[key];
  if (value === undefined) {
    return ctx.vars ? false : null;
  }

  const list = Array.isArray(value) ? value : String(value).split(',');
  return list.map(lower).includes(lower(more.join(':')));
});

/* -------------------------------------------- */
/*  Damage, turn, scene, effects                 */
/* -------------------------------------------- */

const healthDamaged = actor => Math.max(0, (Number(actor?.system?.health?.max) || 0) - (Number(actor?.system?.health?.value) || 0)) > 0;
const essenceDamaged = actor => Object.values(actor?.system?.essences ?? {})
  .some(essence => Math.max(0, (Number(essence?.max) || 0) - (Number(essence?.value) || 0)) > 0);

// self: / target:healthDamaged - below maximum Health; essenceDamaged - some Essence below its maximum (resource/mlp.mjs).
registerTag('self:healthDamaged', (rest, ctx) => healthDamaged(ctx.self));
registerTag('target:healthDamaged', (rest, ctx) => (ctx.other ? healthDamaged(ctx.other) : false));
registerTag('self:essenceDamaged', (rest, ctx) => essenceDamaged(ctx.self));
registerTag('target:essenceDamaged', (rest, ctx) => (ctx.other ? essenceDamaged(ctx.other) : false));

/** target:ownTurn - the other party is the creature whose turn it is (a started combat). */
registerTag('target:ownTurn', (rest, ctx) => !!ctx.combat?.started && !!ctx.other
  && (ctx.combat.combatant?.actor === ctx.other || (!!ctx.other.id && ctx.combat.combatant?.actor?.id == ctx.other.id)));

/** roll:damaging - the roll's (first) row came with damage (a hit / targeted Trigger: results[0].damageValue). */
registerTag('roll:damaging', (rest, ctx) => (Array.isArray(ctx.results) ? (Number(ctx.results[0]?.damageValue) || 0) > 0 : null));

/**
 * self:onRecordedScene:<path> (also holder:) - the {sceneId} a recordScene step wrote at that path on the actor is
 * the scene it is on now (Cartography Suite's survey).
 */
const onRecordedScene = (actor, path) => {
  const record = getProperty(actor, path);
  const scene = sceneOf(actor);
  return !!record?.sceneId && !!scene && record.sceneId == scene.id;
};

registerTag('self:onRecordedScene', (rest, ctx) => (ctx.self ? onRecordedScene(ctx.self, rest) : false));
registerTag('holder:onRecordedScene', (rest, ctx) => {
  const holder = ctx.holder ?? ctx.self;
  return holder ? onRecordedScene(holder, rest) : false;
});

/**
 * self:itemEffect:<uuid>:<change key> - the actor's copy of that book item has an Active Effect, switched on, that
 * changes that key (the Assassin Origin's poison training).
 */
registerTag('self:itemEffect', (rest, ctx) => {
  const at = rest.lastIndexOf(':');
  const [uuid, key] = [rest.slice(0, at), rest.slice(at + 1)];
  const item = itemsOf(ctx.self).find(other => sourceOf(other) == uuid);
  const effects = item?.effects?.contents ?? (item?.effects ? [...item.effects] : []);
  return effects.some(effect => !effect.disabled && (effect.changes ?? effect.system?.changes ?? []).some(change => change.key == key));
});

/* -------------------------------------------- */
/*  @references                                  */
/* -------------------------------------------- */

/** A worn copy of an upgrade: loose on the actor, or on something not unequipped (gij1's wornUpgrade). */
function wearsUpgrade(actor, id) {
  return itemsOf(actor).some(item => item.type == 'upgrade' && String(sourceOf(item) ?? '').split('.').pop() == id && (() => {
    const parentId = item.flags?.essence20?.parentId;
    return !parentId || itemsOf(actor).find(other => other.id == parentId)?.system?.equipped !== false;
  })());
}

/**
 * @alliesWearing.<compendium id>.<ft> - allied tokens within that many feet (mechanics/combat/nearby-allies.mjs, as @count.allies)
 * wearing that upgrade (Uniform). 0 off the canvas.
 */
registerRef('alliesWearing', (key, scope, parts) => {
  const [id, feet] = parts;
  if (!id || !Number.isFinite(Number(feet))) {
    return 0;
  }

  return sideActorsWithin(scope.actor, Number(feet), 'ally').filter(ally => wearsUpgrade(ally, id)).length;
});

/* -------------------------------------------- */
/*  Pick sources                                 */
/* -------------------------------------------- */

const skillLabel = key => localize(globalThis.CONFIG?.E20?.skills?.[key] ?? key);
const essenceOf = key => globalThis.CONFIG?.E20?.skillToEssence?.[key] ?? null;
const rankOf = (actor, key) => SKILL_RANKS.indexOf(actor?.system?.skills?.[key]?.shift ?? 'd20');

/**
 * The Skills a `skills` spec allows, for this actor. {essence?, essences?: [..], minShift?, maxShift?, exclude?: [..], also?: [..] (these
 * count whatever their Essence), sameEssenceAs?: <choice key> | {skill}, differentEssenceFrom?: <choice key>,
 * notChoice?: <choice key>, partner?: {the same spec, with sameEssence: true meaning the candidate's own Essence}} -
 * a candidate needs at least one partner Skill other than itself.
 */
export function skillsFor(spec, actor, ruleItem, relativeTo = null) {
  const choice = key => ruleItem?.flags?.essence20?.rules?.choices?.[key];
  const sameAs = spec.sameEssence && relativeTo ? relativeTo : spec.sameEssenceAs ? choice(spec.sameEssenceAs) : null;
  const differentFrom = spec.differentEssenceFrom ? choice(spec.differentEssenceFrom) : null;
  const also = Array.isArray(spec.also) ? spec.also : [];
  return Object.keys(actor?.system?.skills ?? {}).filter(key => {
    if ((spec.exclude ?? []).includes(key) || (spec.notChoice && choice(spec.notChoice) == key) || (relativeTo && key == relativeTo)) {
      return false;
    }

    if (spec.minShift && rankOf(actor, key) < SKILL_RANKS.indexOf(spec.minShift)) {
      return false;
    }

    if (spec.maxShift && rankOf(actor, key) > SKILL_RANKS.indexOf(spec.maxShift)) {
      return false;
    }

    // notShift: leave out Skills whose die is exactly one of these (Fast Learner: never a d2 to give up).
    if (Array.isArray(spec.notShift) && spec.notShift.includes(actor?.system?.skills?.[key]?.shift ?? 'd20')) {
      return false;
    }

    if (!also.includes(key)) {
      if (spec.essence && essenceOf(key) != spec.essence) {
        return false;
      }

      // essences: one of several Essences (round 16, part a - Angry's Smarts- or Social-based Skill).
      if (Array.isArray(spec.essences) && !spec.essences.includes(essenceOf(key))) {
        return false;
      }

      if ((spec.sameEssenceAs || spec.sameEssence) && (!sameAs || essenceOf(key) != essenceOf(sameAs))) {
        return false;
      }
    }

    if (spec.differentEssenceFrom && (!differentFrom || key == differentFrom || essenceOf(key) == essenceOf(differentFrom))) {
      return false;
    }

    return !spec.partner || skillsFor(spec.partner, actor, ruleItem, key).length > 0;
  });
}

registerPickSource('skills', (step, ctx) => skillsFor(step, ctx.actor, ctx.item).map(key => ({ value: key, label: skillLabel(key) })));

/** defense: the four Defenses, without `exclude` and the ones picked under `notChoices`. */
registerPickSource('defense', (step, ctx) => {
  const taken = (step.notChoices ?? []).map(key => ctx.item?.flags?.essence20?.rules?.choices?.[key]).filter(Boolean);
  return ['toughness', 'evasion', 'willpower', 'cleverness'].filter(key => !(step.exclude ?? []).includes(key) && !taken.includes(key))
    .map(key => ({ value: key, label: localize(globalThis.CONFIG?.E20?.defenses?.[key] ?? key) }));
});

/**
 * partyMates: everyone on a Party roster with the actor (rules/links.mjs#partyMates); with none and `orTargets`, the
 * user's targeted creatures (not the actor). Stored as uuids.
 */
registerPickSource('partyMates', (step, ctx) => {
  const mates = partyMates(ctx.actor);
  const pool = mates.length || !step.orTargets ? mates : ctx.targets.filter(other => other && !sameActor(other, ctx.actor));
  return pool.map(other => ({ value: other.uuid, label: other.name }));
});

/**
 * ownedItems: the actor's items of `itemType`, narrowed to those meeting `prefer` (item tags) when any does - else all
 * of them (Nothing Personal's "your pistol"). Stored as the item id.
 */
registerPickSource('ownedItems', (step, ctx) => {
  const types = [step.itemType ?? []].flat();
  const items = itemsOf(ctx.actor).filter(item => !types.length || types.includes(item.type));
  const tags = Array.isArray(step.prefer) ? step.prefer : [];
  const preferred = tags.length ? items.filter(item => evaluate(tags, contextFor({ self: ctx.actor, ruleItem: ctx.item, item })) === true) : [];
  return (preferred.length ? preferred : items).map(item => ({ value: item.id, label: item.name }));
});
