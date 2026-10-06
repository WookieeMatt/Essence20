import { CHECK_NAMES, evaluateTag as evaluate, registerCheck, registerTag } from "../../predicate.mjs";
import { registerRef } from "../../formula.mjs";
import { getPath, itemsOf, lazy, lower, sourceOf, targetedActors } from "../shared/lazy-helpers-and-targets.mjs";

/**
 * Tags, checks and formula refs (round 10, group C).
 *
 * Checks (`check:<name>`):
 *   contingencyLikely       off this actor's own turn in a combat, with a Contingency logged (the action-economy ledger)
 *   survivalSpecialization  a Survival Specialization's name matches the scene's terrain / environment (null: the
 *                           scene says nothing)
 * Tags:
 *   roll:save / roll:poisonSave       a save card's roll (mechanics/combat/save-riders.mjs) / one against poison or illness
 *   skill:of:<essence>                the rolled Skill belongs to that Essence (its own, whatever the roll uses)
 *   target:creature:<word|word...>    the other party's creature tags or name hold one of the words (plurals too)
 *   target:tagStarts:<text>           one of its creature tags starts with the text
 *   target:threatVsLevel:<op><n>      its Threat Level minus this actor's level (false for a creature with none)
 *   roll:anyTarget:<tags joined by &> some targeted creature meets them (asked as the target)
 *   item:weaponType:<type>            the weapon (or the rolled attack's weapon) is of a CONFIG.E20.weaponTypes type
 * Refs:
 *   @rolled.<path>   the item the roll is made with (a RollModifier's shifts)
 *   @other.<path>    the item an ItemModifier is changing
 *   @reach.size / @reach.<size> / @reach.melee / @reach.attack   Reach by Size, the longest melee Reach of the
 *                    actor's equipped attacks, its longest range or Reach
 *   @altMode.<path>  the Alt Mode the actor is in
 *   @owned.<_id>     how many of the actor's items come from that compendium entry
 */

const addCheck = (name, fn) => {
  if (!CHECK_NAMES.includes(name)) {
    CHECK_NAMES.push(name);
  }

  registerCheck(name, fn);
};

/* -------------------------------------------- */
/*  Checks                                       */
/* -------------------------------------------- */

/** Off the actor's own turn in a combat, with a Contingency in its action-economy log. */
export function looksLikeContingency(actor) {
  const combat = globalThis.game?.combat;
  if (!combat || combat.combatant?.actor?.id == actor?.id) {
    return false;
  }

  const ledger = lazy.getLedger?.(actor);
  return !!(ledger?.log ?? []).some(entry => entry?.namedKey == 'contingency');
}

addCheck('contingencyLikely', actor => looksLikeContingency(actor));

// Survival Specializations are free text ("Deserts", "Forests", "Arctic"), so each terrain / environment is matched
// by keyword against their names.
const TERRAIN_WORDS = {
  arctic: ['arctic', 'snow', 'tundra', 'polar', 'ice', 'cold'],
  desert: ['desert', 'sand', 'dune'],
  grasslands: ['grass', 'plain', 'prairie', 'savanna', 'steppe'],
  mountains: ['mountain', 'alpine', 'cliff', 'climb'],
  sea: ['sea', 'ocean', 'aquatic', 'water', 'marine', 'naval', 'coast'],
  urban: ['urban', 'city', 'street'],
  wetlands: ['wetland', 'swamp', 'marsh', 'bog'],
  woodlands: ['wood', 'forest', 'jungle'],
};
const ENVIRONMENT_WORDS = {
  underwater: ['underwater', 'aquatic', 'ocean', 'sea', 'water', 'diving'],
  zeroGravity: ['space', 'zero', 'gravity', 'orbit'],
  lowGravity: ['space', 'gravity', 'lunar', 'moon'],
  vacuum: ['space', 'vacuum', 'void'],
  extremeCold: ['arctic', 'cold', 'snow', 'tundra', 'polar'],
  extremeHeat: ['desert', 'heat', 'volcan'],
};

const safely = (fn, fallback) => {
  try {
    return fn() ?? fallback;
  } catch (error) {
    return fallback;
  }
};

/** true / false, or null when the scene sets no terrain or environment to match against. */
export function survivalSpecializationMatches(actor) {
  const names = Object.values(actor?.system?.skills?.survival?.specializations ?? {}).map(spec => lower(spec?.name)).filter(Boolean);
  const environment = safely(() => lazy.getEnvironment?.(actor) || 'normal', 'normal');
  const terrain = safely(() => lazy.getTerrain?.(actor) || null, null);
  const words = [...(TERRAIN_WORDS[terrain] ?? []), ...(ENVIRONMENT_WORDS[environment] ?? [])];
  if (!words.length) {
    return null;
  }

  return names.some(name => words.some(word => name.includes(word)));
}

addCheck('survivalSpecialization', actor => survivalSpecializationMatches(actor));

/* -------------------------------------------- */
/*  Roll tags                                    */
/* -------------------------------------------- */

const POISON = /poison|venom|toxi|disease|illness|sick|plague|infect/i;

/** The save card spec a roll was made from (mechanics/combat/save-riders.mjs), or null. */
function saveSpec(dataset) {
  const spec = dataset?.riderSpec;
  if (!spec) {
    return null;
  }

  try {
    const rider = typeof spec == 'string' ? JSON.parse(spec) : spec;
    return rider?.kind == 'save' ? rider.spec ?? {} : null;
  } catch (error) {
    return String(spec).includes('"save"') ? {} : null;
  }
}

registerTag('roll:save', (rest, ctx) => (ctx.dataset ? !!saveSpec(ctx.dataset) : null), { phrase: ['on a save', 'except on a save'] });
registerTag('roll:poisonSave', (rest, ctx) => {
  if (!ctx.dataset) {
    return null;
  }

  const spec = saveSpec(ctx.dataset);
  return !!spec && (spec.damage?.type == 'poison' || spec.damageAlways?.type == 'poison' || spec.status == 'poisoned' || POISON.test(spec.title ?? ''));
}, { phrase: ['on a save against poison or illness', 'except on a save against poison or illness'] });

registerTag('skill:of', (rest, ctx) => (ctx.rolledSkill ? globalThis.CONFIG?.E20?.skillToEssence?.[ctx.rolledSkill] == rest : false), { phrase: ['on {arg} Skill tests', 'except on {arg} Skill tests'] });

/** roll:anyTarget:<tags joined by &> - some targeted creature meets them all, asked as the target. */
registerTag('roll:anyTarget', (rest, ctx) => {
  const tags = rest.split('&');
  return targetedActors().some(other => tags.every(tag => evaluate(tag, { ...ctx, other }) === true));
}, { phrase: (arg, w) => [w.facts(arg.split('&'), 'one of your targets'), `no target qualifies (${w.facts(arg.split('&'), 'a target')})`] });

/* -------------------------------------------- */
/*  Creatures                                    */
/* -------------------------------------------- */

function creatureTags(actor) {
  const typed = actor?.system?.creatureTags;
  return (Array.isArray(typed) ? typed : String(typed ?? '').split(',')).map(tag => lower(tag).trim()).filter(Boolean);
}

registerTag('target:creature', (rest, ctx) => {
  if (!ctx.other) {
    return false;
  }

  const words = rest.split('|').map(word => word.trim().toLowerCase().replace(/[^\w-]/g, '')).filter(Boolean);
  const text = `${creatureTags(ctx.other).join(' ')} ${lower(ctx.other.name)}`;
  return words.some(word => new RegExp(`\\b${word}s?\\b`).test(text));
}, { phrase: arg => [`{who} {is} a ${arg.split('|').join(' or ')}`, `{who} {isnt} a ${arg.split('|').join(' or ')}`] });

registerTag('target:tagStarts', (rest, ctx) => !!ctx.other && creatureTags(ctx.other).some(tag => tag.startsWith(lower(rest))), { phrase: ['{who} {has} a creature tag starting "{raw}"', '{who} {has} no creature tag starting "{raw}"'] });

/** A Threat's Threat Level minus this actor's level; false for a creature with no Threat Level. */
registerTag('target:threatVsLevel', (rest, ctx) => {
  const match = /^(>=|<=|>|<|=)?(-?\d+)$/.exec(rest);
  const threat = ctx.other?.system?.threatLevel;
  if (!match || !ctx.other || threat === undefined || threat === null || threat === '' || !Number.isFinite(Number(threat))) {
    return false;
  }

  return compare(Number(threat) - (Number(ctx.self?.system?.level) || 0), match[1] ?? '=', Number(match[2]));
}, { phrase: (arg, w) => {
  const match = /^(>=|<=|>|<|=)?(-?\d+)$/.exec(arg);
  if (!match) {
    return null;
  }

  const n = Number(match[2]);
  const op = match[1] ?? '=';
  const words = n == 0 ? { '>=': 'at least', '<=': 'at most', '>': 'above', '<': 'below', '=': 'equal to' }[op] : `${w.comparison(op, n)} levels against`;
  return [`{poss} Threat Level is ${words} your level`, `{poss} Threat Level isn't ${words} your level`];
} });

function compare(a, op, b) {
  return { '>=': a >= b, '<=': a <= b, '>': a > b, '<': a < b, '=': a == b }[op] ?? false;
}

/* -------------------------------------------- */
/*  Weapon types                                 */
/* -------------------------------------------- */

// The flag Weapon Enthusiast's Use button tags a weapon with (and the qualified copies it grants carry).
export const TYPE_FLAG = 'q2WeaponType';
// Words a weapon's name uses for each CONFIG.E20.weaponTypes key, where no trait carries the type.
const TYPE_WORDS = {
  assaultRifle: /assault rifle|carbine/i,
  blunt: /bludgeon|club|baton|hammer|mace/i,
  closeCombatHeavyBlade: /heavy blade|machete|axe|sword/i,
  explosives: /explosive|c-4|charge|mine|bomb/i,
  finesse: /finesse|knife|dagger|rapier/i,
  grenades: /grenade/i,
  mightMelee: /might/i,
  shotguns: /shotgun/i,
  submachineGun: /submachine|smg/i,
  thrown: /thrown|javelin|shuriken/i,
};
const TYPE_TRAITS = ['ballistic', 'element', 'martialArts', 'silent', 'stun', 'thrown'];

function weaponTraits(weapon) {
  return [...(weapon?.system?.traits ?? []), ...(weapon?.system?.itemAndUpgradeTraits ?? [])].map(String);
}

function attacksOf(weapon) {
  const owned = itemsOf(weapon?.parent).filter(item => item.type == 'weaponEffect' && item.flags?.essence20?.parentId == weapon?.id);
  if (owned.length) {
    return owned.map(item => item.system ?? {});
  }

  return Object.values(weapon?.system?.items ?? {}).filter(entry => entry?.type == 'weaponEffect');
}

/** Whether a weapon is of a CONFIG.E20.weaponTypes type: tagged so, the same-named trait, one-handed, or its name. */
export function weaponIsType(weapon, type) {
  if (!type || !weapon) {
    return false;
  }

  if (weapon.flags?.essence20?.[TYPE_FLAG] == type) {
    return true;
  }

  if (TYPE_TRAITS.includes(type) && weaponTraits(weapon).includes(type)) {
    return true;
  }

  if (type == 'oneHanded') {
    const attacks = attacksOf(weapon);
    return attacks.length > 0 && attacks.every(attack => String(attack?.numHands ?? '1') == '1');
  }

  return !!TYPE_WORDS[type]?.test(weapon.name ?? '');
}

registerTag('item:weaponType', (rest, ctx) => {
  const item = ctx.item;
  if (!item) {
    return null;
  }

  // flagOf:<_id> - the type the actor's copy of that compendium entry was tagged with (Weapon Enthusiast's pick).
  let type = rest;
  const flagOf = /^flagOf:(\w+)$/.exec(rest);
  if (flagOf) {
    const holder = itemsOf(ctx.self).find(other => String(sourceOf(other) ?? '').split('.').pop() == flagOf[1]);
    type = holder?.flags?.essence20?.[TYPE_FLAG] ?? null;
    if (!type) {
      return false;
    }
  }

  const parentId = item.type == 'weaponEffect' ? item.flags?.essence20?.parentId : null;
  const weapon = parentId ? (item.parent ?? item.actor)?.items?.get?.(parentId) ?? null : item;
  return !!weapon && weapon.type == 'weapon' && weaponIsType(weapon, type);
}, { phrase: (arg, w) => (arg.startsWith('flagOf:') ? [`{who} {is} the weapon type you picked for ${w.itemName(arg.slice(7))}`, `{who} {isnt} the weapon type you picked for ${w.itemName(arg.slice(7))}`] : ['{who} {is} a {arg} weapon', "{who} {isnt} a {arg} weapon"]) });

/* -------------------------------------------- */
/*  Refs                                         */
/* -------------------------------------------- */

registerRef('rolled', (key, scope) => Number(getPath(scope.rolled, key)) || 0);
registerRef('other', (key, scope) => Number(getPath(scope.otherItem, key)) || 0);

const reachOfSize = size => Number(globalThis.CONFIG?.E20?.actorReach?.[size]) || 5;

/** The longest melee Reach among the actor's attacks (unarmed, or with an equipped weapon), at least its size's. */
export function meleeReach(actor) {
  const items = itemsOf(actor);
  const equipped = new Set(items.filter(item => item.type == 'weapon' && item.system?.equipped !== false).map(item => item.id));
  let best = reachOfSize(actor?.system?.size);
  for (const effect of items.filter(item => item.type == 'weaponEffect' && item.system?.classification?.style == 'melee')) {
    const parent = effect.flags?.essence20?.parentId;
    if (!parent || equipped.has(parent)) {
      best = Math.max(best, Number(effect.system?.totalReach ?? 0) || 0);
    }
  }

  return best;
}

/** How far the actor can attack: its size's Reach, or the longest range / Reach of its usable attacks. */
export function attackRange(actor) {
  const items = itemsOf(actor);
  const equipped = new Set(items.filter(item => item.type == 'weapon' && item.system?.equipped !== false).map(item => item.id));
  let best = reachOfSize(actor?.system?.size);
  for (const effect of items.filter(item => item.type == 'weaponEffect')) {
    const parent = effect.flags?.essence20?.parentId;
    if (parent && !equipped.has(parent)) {
      continue;
    }

    const range = effect.system?.range ?? {};
    best = Math.max(best, Number(range.long ?? 0) || 0, Number(range.value ?? 0) || 0, Number(effect.system?.totalReach ?? 0) || 0);
  }

  return best;
}

registerRef('reach', (key, scope) => {
  const actor = scope.actor;
  switch (key) {
  case 'size': return reachOfSize(actor?.system?.size);
  case 'melee': return meleeReach(actor);
  case 'attack': return attackRange(actor);
  }

  return reachOfSize(key);
});

registerRef('altMode', (key, scope) => {
  const actor = scope.actor;
  if (!actor?.system?.isTransformed) {
    return 0;
  }

  const mode = itemsOf(actor).find(item => item.id == actor.system.altModeId);
  return Number(getPath(mode, key)) || 0;
});

registerRef('owned', (key, scope) => itemsOf(scope.actor).filter(item => String(sourceOf(item) ?? '').split('.').pop() == key).length);
