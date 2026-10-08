// Rules-engine plug-ins, round 15 (banked - docs/rules-batches/slBanked15.md). Registered on import; see
// module/rules/plugins/index.mjs.
import { registerRef } from "../../formula.mjs";
import { registerStep } from "../../steps.mjs";
import { itemsOf } from "../../../items/shared/item-lookups.mjs";

const localize = key => globalThis.game?.i18n?.localize?.(key) ?? key;
const format = (key, data) => {
  const full = `E20.RulesExtBanked.${key}`;
  const text = globalThis.game?.i18n?.format?.(full, data);
  return text && text != full ? text : Object.values(data ?? {}).join(' ') || key;
};

const DEFENSES = ['toughness', 'evasion', 'willpower', 'cleverness'];

/** A list of names, or the "none" word. */
const listOrNone = names => (names.length ? names.join(', ') : format('None', {}));

/**
 * What the targetFacts step tells about an actor (and puts in the run's vars):
 *   name, health, healthMax
 *   hangUps / perks / powers   the names of its items of that type, comma-joined ("none")
 *   resistances                its damage Resistances and Immunities, by damage type ("Fire, Blunt (immune)"; "none")
 *   defenses                   "Toughness 10, Evasion 12, Willpower 11, Cleverness 14" (the .total values)
 *   lowestDefense              the name of its lowest Defense (the first of the lowest when tied, in system.defenses order)
 */
export function targetFacts(actor) {
  const system = actor?.system ?? {};
  const named = type => itemsOf(actor).filter(item => item.type == type).map(item => item.name);
  const types = globalThis.CONFIG?.E20?.damageTypes ?? {};
  const resistances = Object.entries(types).filter(([key]) => system.resistances?.[key] || system.immunities?.[key])
    .map(([key, label]) => (system.immunities?.[key] ? format('Immune', { type: localize(label) }) : localize(label)));
  const defenses = system.defenses ?? {};
  const keys = Object.keys(defenses);
  const lowest = keys.reduce((low, key) => (defenses[key]?.total < (defenses[low]?.total ?? Infinity) ? key : low), keys[0]);
  const defenseName = key => localize(globalThis.CONFIG?.E20?.defenses?.[key] ?? key);
  return {
    name: actor?.name ?? '',
    health: Number(system.health?.value) || 0,
    healthMax: Number(system.health?.max) || 0,
    hangUps: listOrNone(named('hangUp')),
    perks: listOrNone(named('perk')),
    powers: listOrNone(named('power')),
    resistances: listOrNone(resistances),
    defenses: DEFENSES.map(key => `${defenseName(key)} ${Number(defenses[key]?.total) || 0}`).join(', '),
    lowestDefense: lowest ? defenseName(lowest) : '?',
  };
}

/**
 * Step `targetFacts {of?: target | self}` - puts the facts above about the run's first target (of: self - the actor) in the
 * run's vars ({var.hangUps}, {var.lowestDefense}, @var.healthMax ...), for a `chat` line to tell: Studious Measures,
 * Breaking Point, Study Weaknesses, Tech Specs. With no target, the run stops (a "needs a target" line).
 */
registerStep('targetFacts', async (step, ctx) => {
  const actor = step.of == 'self' ? ctx.actor : ctx.targets?.[0];
  if (!actor) {
    ctx.chat.push(format('NeedsTarget', { item: ctx.item?.name ?? '' }));
    return false;
  }

  Object.assign(ctx.vars, targetFacts(actor));
}, { errors: (step, where) => (step.of && !['self', 'target'].includes(step.of) ? [`${where}: targetFacts of must be self or target`] : []) });

/** The level the system compares by (mechanics/combat/combat.mjs#getEffectiveLevel): an NPC's / vehicle's Threat Level, else its level. */
export function effectiveLevel(actor) {
  const threat = Number(actor?.system?.threatLevel) || 0;
  if (['npc', 'vehicle'].includes(actor?.type) && threat > 0) {
    return threat;
  }

  return Number(actor?.system?.level ?? actor?.system?.threatLevel ?? 0) || 0;
}

/** @effectiveLevel.self / @effectiveLevel.target - that level for the actor / the run's (or roll's) first target. */
registerRef('effectiveLevel', (key, scope) => effectiveLevel(key == 'target' ? scope.other : scope.actor));
