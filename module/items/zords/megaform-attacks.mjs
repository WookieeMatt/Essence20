/**
 * Attacks a Megaform gets from its parts, generated as real weapon/weaponEffect items on the
 * Megaform actor so they roll like any other attack:
 *
 * - Enhanced Melee/Ranged Attack (PR CRB, Megaform Traits, p.140): once a scene, triple the damage of
 *   the Zord's strongest melee attack in a chosen damage type, at double Reach (ranged: double Range);
 *   each extra copy of the trait adds one use a scene.
 * - A Combiner form's basic attacks (Enigma of Combination, p.44): at least an unarmed strike and a
 *   ranged attack - the strike from one component's unarmed, ram, fly-by or natural attack, with the
 *   form's Size as reach and damage doubled (duos, trios) or tripled (Gestalts); the ranged one from
 *   a weapon in the Integrated Hardpoints, range and base damage doubled or tripled the same way.
 * - Enhanced Attack (Combiner feature, p.42): one chosen attack deals double damage while merged,
 *   +1 more if it is one of the form's basic attacks.
 * - Titan Hardpoint (Combiner feature, p.42-43): the Combiner gets a chosen Titan-class Weapon and
 *   an External Titan Hardpoint for it; Gigantic forms and up only.
 *
 * The generated items carry flags.essence20.zord2Gen (what made them) and zord2Sig (the inputs), so
 * a resync only replaces what actually changed. Once-per-scene use is enforced by zord2PerScene on
 * the weapon (read by ./unusable.mjs) and counted in a postRoll hook.
 */
import { registerPostRoll, registerUse } from "../../mechanics/item-hooks.mjs";
import { getUses, markUsed } from "../../mechanics/resources/scene-clock.mjs";
import {
  chat, isCombinerForm, isGiganticOrLarger, isResponsible, itemsOf, megaformsContaining, rosterOf, sourceOf, T, traitsOf,
} from "./combiner-roster-helpers.mjs";
import { isUnarmedAttack } from "../shared/unarmed-attacks.mjs";

const GEN = 'zord2Gen';
const SIG = 'zord2Sig';
export const PER_SCENE = 'zord2PerScene';
export const DAMAGE_TYPE_FLAG = 'zord2DamageType';
export const EFFECT_FLAG = 'zord2EffectId';
export const WEAPON_UUID_FLAG = 'zord2WeaponUuid';

const flagOf = (doc, key) => doc?.flags?.essence20?.[key];

export const usesKey = weapon => `zord2Use_${String(flagOf(weapon, GEN) ?? weapon?.id ?? '').replace(/[^A-Za-z0-9_-]/g, '_')}`;

/** Every attack an actor can make: [{effect, weapon}]. */
export function attacksOf(actor) {
  const items = itemsOf(actor);
  return items.filter(item => item.type == 'weaponEffect').map(effect => ({
    effect,
    weapon: items.find(item => item.id == flagOf(effect, 'parentId')) ?? null,
  }));
}

const isMelee = ({ effect }) => effect.system?.classification?.style == 'melee';
const isRanged = ({ effect }) => !!effect.system?.classification?.style && effect.system.classification.style != 'melee';
// The Combiner strike's sources (p.44: "unarmed, ram, fly-by or natural attack"): an unarmed attack in the shared sense
// (items/shared/unarmed-attacks.mjs), plus Ram / Fly-by attacks and integrated (natural) weapons. Ram and Fly-by are
// the book's own separate entries beside "unarmed", so they stay here rather than in the shared definition.
const isUnarmedish = attack => isMelee(attack) && (isUnarmedAttack(attack.effect, null, attack.weapon) || attack.effect.system?.isRam
  || attack.effect.system?.isFlyby || attack.weapon.system?.classification?.size == 'integrated' || (attack.weapon.system?.traits ?? []).includes('integrated'));
const isIntegratedRanged = attack => isRanged(attack) && !!attack.weapon
  && (attack.weapon.system?.hardpoint?.type == 'integrated' || attack.weapon.system?.classification?.size == 'integrated');
const damageOf = attack => Number(attack.effect.system?.damageValue) || 0;

/** The strongest of a list of attacks (highest damage), or null. */
export function strongest(attacks) {
  return attacks.reduce((best, attack) => (!best || damageOf(attack) > damageOf(best) ? attack : best), null);
}

/** A weaponEffect's system data scaled - damage times `damage`, reach/range times `reach`. */
export function scaledEffect(effect, { damage = 1, reach = 1, plus = 0, damageType = null } = {}) {
  const s = effect.system ?? {};
  const range = { ...(s.range ?? {}) };
  if (s.classification?.style == 'melee') {
    range.reachMultiplier = Math.max(1, Number(range.reachMultiplier) || 1) * reach;
  } else {
    if (range.value) range.value *= reach;
    if (range.long) range.long *= reach;
  }

  return {
    classification: { ...(s.classification ?? { skill: 'might', style: 'melee' }) },
    damageType: damageType ?? s.damageType ?? 'blunt',
    damageValue: (Number(s.damageValue) || 0) * damage + plus,
    defenseType: s.defenseType ?? 'toughness',
    numTargets: s.numTargets ?? 1,
    range,
  };
}

/** Which of a component's attacks its Enhanced Attack names (its choice, else its strongest). */
function enhancedChoice(component, trait) {
  const attacks = attacksOf(component).filter(a => !flagOf(a.weapon, GEN));
  return attacks.find(a => a.effect.id == flagOf(trait, EFFECT_FLAG)) ?? strongest(attacks);
}

/**
 * What a Megaform should currently have generated. Pure - reads the roster and returns specs:
 * {key, name, effectName, effect (system data), perScene?, copyUuid?}.
 * @param {Actor} megaform
 * @param {Actor[]} [roster]
 */
export function desiredAttacks(megaform, roster = rosterOf(megaform)) {
  const out = [];
  if (isCombinerForm(megaform)) {
    const parts = roster.filter(a => !['zord', 'vehicle', 'megaform'].includes(a.type));
    if (!parts.length) {
      return out;
    }

    const multiplier = parts.length <= 3 ? 2 : 3;
    const enhanced = new Set();
    for (const component of parts) {
      for (const trait of traitsOf(component, 'enhancedAttack')) {
        const attack = enhancedChoice(component, trait);
        if (attack) {
          enhanced.add(attack.effect.id);
          out.push({
            key: `eoc-enh-${component.id}-${attack.effect.id}`,
            name: T('Zord2EnhancedAttackName', { name: attack.weapon?.name ?? attack.effect.name, part: component.name }),
            effect: scaledEffect(attack.effect, { damage: 2 }),
          });
        }
      }
    }

    const pick = (filter, label, damageMultiplier, reach) => {
      const candidates = parts.flatMap(component => attacksOf(component).filter(a => !flagOf(a.weapon, GEN) && filter(a))
        .map(a => ({ ...a, component })));
      const best = strongest(candidates);
      if (best) {
        out.push({
          key: `eoc-basic-${label}`,
          name: T(label == 'strike' ? 'Zord2CombinerStrike' : 'Zord2CombinerBlast', { part: best.component.name }),
          effect: scaledEffect(best.effect, { damage: damageMultiplier, reach, plus: enhanced.has(best.effect.id) ? 1 : 0 }),
        });
      }

      return best;
    };

    // The strike's reach grows to the Combiner form's Size - a reach multiplier
    // of 1 against the form's own (bigger) Size, which weapon-effect.mjs reads for totalReach.
    const strike = pick(isUnarmedish, 'strike', multiplier, 1);
    if (!strike) {
      out.push({
        key: 'eoc-basic-strike',
        name: T('Zord2CombinerStrike', { part: parts[0].name }),
        effect: { classification: { skill: 'might', style: 'melee' }, damageType: 'blunt', damageValue: multiplier, defenseType: 'toughness', numTargets: 1, range: { reachMultiplier: 1 } },
      });
    }

    pick(isIntegratedRanged, 'blast', multiplier, multiplier);

    if (isGiganticOrLarger(megaform.system?.size)) {
      for (const component of parts) {
        for (const trait of traitsOf(component, 'titanHardpoint')) {
          const uuid = flagOf(trait, WEAPON_UUID_FLAG);
          if (uuid) {
            out.push({ key: `eoc-titan-${component.id}-${trait.id}`, copyUuid: uuid });
          }
        }
      }
    }

    return out;
  }

  // Power Rangers Megazord.
  for (const zord of roster.filter(a => a.type == 'zord')) {
    for (const [type, filter, label] of [['enhancedMeleeAttack', isMelee, 'Melee'], ['enhancedRangedAttack', isRanged, 'Ranged']]) {
      const traits = traitsOf(zord, type);
      if (!traits.length) {
        continue;
      }

      const best = strongest(attacksOf(zord).filter(a => !flagOf(a.weapon, GEN) && filter(a)));
      if (!best) {
        continue;
      }

      out.push({
        key: `pr-${label}-${zord.id}`,
        name: T(`Zord2Enhanced${label}Name`, { name: zord.name }),
        effect: scaledEffect(best.effect, { damage: 3, reach: 2, damageType: flagOf(traits[0], DAMAGE_TYPE_FLAG) ?? null }),
        perScene: traits.length,
      });
    }
  }

  return out;
}

const pending = new Map();

/** Bring a Megaform's generated attacks in line with desiredAttacks(). Debounced per actor. */
export function queueSync(megaform) {
  if (!megaform?.id || !isResponsible(megaform)) {
    return;
  }

  clearTimeout(pending.get(megaform.id));
  pending.set(megaform.id, setTimeout(() => {
    pending.delete(megaform.id);
    syncMegaformAttacks(megaform).catch(error => console.error('Essence20 | zord2 megaform attack sync', error));
  }, 150));
}

export async function syncMegaformAttacks(megaform) {
  const desired = desiredAttacks(megaform);
  const items = itemsOf(megaform);
  const generated = items.filter(item => flagOf(item, GEN) && item.type != 'weaponEffect');
  const keep = new Set();
  const toCreate = [];
  for (const spec of desired) {
    const sig = JSON.stringify(spec);
    const existing = generated.find(item => flagOf(item, GEN) == spec.key && flagOf(item, SIG) == sig);
    if (existing) {
      keep.add(existing.id);
    } else {
      toCreate.push({ spec, sig });
    }
  }

  const stale = generated.filter(item => !keep.has(item.id));
  const staleIds = [
    ...stale.map(item => item.id),
    ...items.filter(item => stale.some(w => flagOf(item, 'parentId') == w.id)).map(item => item.id),
    // Effects whose own weapon is already gone.
    ...items.filter(item => item.type == 'weaponEffect' && flagOf(item, GEN) && !items.some(w => w.id == flagOf(item, 'parentId'))).map(item => item.id),
  ];
  if (staleIds.length) {
    await megaform.deleteEmbeddedDocuments('Item', [...new Set(staleIds)]);
  }

  for (const { spec, sig } of toCreate) {
    const stamp = { [GEN]: spec.key, [SIG]: sig, ...(spec.perScene ? { [PER_SCENE]: spec.perScene } : {}) };
    if (spec.copyUuid) {
      const { grantCopy } = await import("../../mechanics/resources/grants.mjs");
      await grantCopy(megaform, spec.copyUuid, { flags: stamp, system: { 'hardpoint.type': 'external' } });
      continue;
    }

    const [weapon] = await megaform.createEmbeddedDocuments('Item', [{
      name: spec.name,
      type: 'weapon',
      system: { classification: { size: 'integrated' }, traits: [] },
      flags: { essence20: stamp },
    }]);
    if (weapon) {
      await megaform.createEmbeddedDocuments('Item', [{
        name: spec.name,
        type: 'weaponEffect',
        system: spec.effect,
        flags: { essence20: { parentId: weapon.id, [GEN]: spec.key } },
      }]);
    }
  }
}

/** Resync every Megaform an actor is part of. */
export function syncFor(actor) {
  if (actor?.type == 'megaform') {
    queueSync(actor);
  }

  for (const megaform of megaformsContaining(actor)) {
    queueSync(megaform);
  }
}

/** Once-per-scene: count a generated attack's use (postRoll). */
export async function countGeneratedUse(actor, results, checkContext, extra) {
  const weapon = extra?.rider?.weaponId ? itemsOf(actor).find(item => item.id == extra.rider.weaponId) : null;
  if (weapon && flagOf(weapon, PER_SCENE)) {
    await markUsed(actor, usesKey(weapon), { window: 'scene' });
  }
}

export function perSceneExhausted(weapon) {
  const max = flagOf(weapon, PER_SCENE);
  return !!max && getUses(weapon.parent, usesKey(weapon), 'scene') >= max;
}

/* -------------------------------------------- */
/*  Use buttons on the traits                    */
/* -------------------------------------------- */

const TRAIT_TYPES = ['enhancedMeleeAttack', 'enhancedRangedAttack', 'enhancedAttack', 'titanHardpoint'];

async function chooseForTrait(item) {
  const actor = item.parent;
  const { chooseSelect, findItems, pickOne } = await import("../../mechanics/resources/grants.mjs");
  const type = item.system?.type;
  if (type == 'enhancedMeleeAttack' || type == 'enhancedRangedAttack') {
    const options = Object.entries(CONFIG.E20.damageTypes).map(([value, label]) => ({ value, label: game.i18n.localize(label) }));
    const choice = await chooseSelect(item.name, T('Zord2PickDamageType'), options);
    if (!choice) return null;
    await item.setFlag('essence20', DAMAGE_TYPE_FLAG, choice);
    return T('Zord2TraitChoice', { name: item.name, choice: game.i18n.localize(CONFIG.E20.damageTypes[choice]) });
  }

  if (type == 'enhancedAttack') {
    const options = attacksOf(actor).filter(a => !flagOf(a.weapon, GEN))
      .map(a => ({ value: a.effect.id, label: a.weapon ? `${a.weapon.name} - ${a.effect.name}` : a.effect.name }));
    const choice = await chooseSelect(item.name, T('Zord2PickAttack'), options);
    if (!choice) return null;
    await item.setFlag('essence20', EFFECT_FLAG, choice);
    return T('Zord2TraitChoice', { name: item.name, choice: options.find(o => o.value == choice)?.label ?? choice });
  }

  // Titan Hardpoint: any Titan-class Weapon.
  const rows = await findItems({ type: 'weapon', matches: entry => (entry.system?.traits ?? []).includes('titanClass') });
  const uuid = await pickOne(item.name, rows);
  if (!uuid) return null;
  await item.setFlag('essence20', WEAPON_UUID_FLAG, uuid);
  return T('Zord2TraitChoice', { name: item.name, choice: rows.find(r => r.uuid == uuid)?.name ?? uuid });
}

registerUse({
  id: 'zord2-megaform-trait',
  matches: item => item?.type == 'megaformTrait' && TRAIT_TYPES.includes(item.system?.type),
  run: async (item) => {
    const line = await chooseForTrait(item);
    if (line) {
      syncFor(item.parent);
      await chat(item.parent, line);
    }

    return null;
  },
});

registerPostRoll(countGeneratedUse);

const RELEVANT_ITEM_TYPES = ['megaformTrait', 'weapon', 'weaponEffect'];
function onItemChange(item) {
  const actor = item?.parent;
  if (!actor || actor.type == 'megaform' || !RELEVANT_ITEM_TYPES.includes(item.type)) {
    return;
  }

  for (const megaform of megaformsContaining(actor)) {
    queueSync(megaform);
  }
}

if (typeof Hooks != 'undefined') {
  Hooks.on('updateActor', (actor, changes) => {
    if (actor.type == 'megaform' && (changes?.system?.actors !== undefined || changes?.system?.size !== undefined)) {
      queueSync(actor);
    }
  });
  Hooks.on('createItem', onItemChange);
  Hooks.on('updateItem', (item, changes) => {
    if (changes?.flags?.essence20?.[GEN] === undefined) {
      onItemChange(item);
    }
  });
  Hooks.on('deleteItem', onItemChange);
}

export { GEN, SIG, sourceOf };
