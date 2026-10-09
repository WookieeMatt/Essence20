/**
 * Upscaling weapons (The Enigma of Combination p.47-48, Table 3-1): a weapon for a Gigantic or larger wielder - a
 * Combiner form, a Titan - is made for its size. Large to Extended wielders keep weapons as they are. Category,
 * classification, most traits and any special costs never change.
 *
 *   Size Class                Availability                Requirement            Range*  Effects  Alt. effects  Area of effect            Traits
 *   Gigantic / Extended II    up 1 level                  that Size or Brawn d6  +30%    +1 dmg   -             +50%                      -
 *   Towering / Extended III   up 2 (at most Prototype)    that Size              +60%    +2 dmg   Trip          +100%, or Blast 5ft radius  -
 *   Titanic                   up 2 (at most Unique)       that Size              -       +4 dmg   Trip          +200%, or Blast 15ft radius Titan-Class, Wrecker
 *   * ranged weapons only. Distances round up to the nearest 5 feet.
 *
 * An upscaled weapon remembers what it was (flags.essence20.upscaled) - its size, and the prerequisites of its normal
 * size, which a Combiner form's components are checked against (EoC p.44: at least one must be Qualified to use the
 * normal size). Trip is added as the weapon's Trip trait.
 *
 * Also: hands / Hardpoints by size (EoC p.48), read by Essence20Item#_prepareWeaponHands - weaponSizeGap.
 */
import { sizeClassIndex, sizeClassOf } from "../../mechanics/combat/size-classes.mjs";

export const UPSCALE_FLAG = 'upscaled';
const AVAILABILITY_ORDER = ['automatic', 'standard', 'limited', 'restricted', 'prototype', 'unique'];

export const UPSCALE_TABLE = {
  gigantic: { levels: 1, max: null, range: 0.3, damage: 1, trip: false, area: 0.5, addBlast: 0, traits: [] },
  towering: { levels: 2, max: 'prototype', range: 0.6, damage: 2, trip: true, area: 1, addBlast: 5, traits: [] },
  titanic: { levels: 2, max: 'unique', range: 0, damage: 4, trip: true, area: 2, addBlast: 15, traits: ['titanClass', 'wrecker'] },
};

const roundUp5 = feet => Math.ceil(feet / 5) * 5;

/** The Table 3-1 row a wielder's size uses, or null below Gigantic. */
export function upscaleSizeFor(size) {
  const cls = sizeClassOf(size);
  return UPSCALE_TABLE[cls] ? cls : null;
}

/** The size class a weapon is made for: its upscaled size, else a normal (Common) weapon. */
export const weaponSizeClass = weapon => weapon?.flags?.essence20?.[UPSCALE_FLAG]?.size ?? 'common';

/**
 * The size classes of the wielder's Modes: its Bot Mode (system.size) and every Alt Mode it has (altModesize).
 * @returns {Number[]}   Indexes into SIZE_CLASSES
 */
export function modeSizeIndexes(wielder) {
  const items = wielder?.items?.contents ?? (Array.isArray(wielder?.items) ? wielder.items : [...(wielder?.items ?? [])]);
  return [wielder?.system?.size, ...items.filter(item => item?.type == 'altMode').map(item => item.system?.altModesize)]
    .map(sizeClassIndex).filter(index => index >= 0);
}

/**
 * How many Size Classes the weapon is above (+) or below (-) its wielder (EoC p.48): above its Modes' LARGEST size, or
 * below their SMALLEST - 0 when it sits within the Modes' range.
 */
export function weaponSizeGap(weapon, wielder) {
  const modes = modeSizeIndexes(wielder);
  const weaponIndex = sizeClassIndex(weaponSizeClass(weapon));
  if (!modes.length || weaponIndex < 0) {
    return 0;
  }

  const largest = Math.max(...modes);
  const smallest = Math.min(...modes);
  return weaponIndex > largest ? weaponIndex - largest : weaponIndex < smallest ? weaponIndex - smallest : 0;
}

/**
 * Hands / Hardpoints by size (EoC p.48): three or more classes smaller than the wielder takes 1, three larger takes 2,
 * four or more larger can't be wielded normally ({tooLarge}). Null when the size makes no difference.
 */
export function handsForSize(weapon, wielder) {
  const gap = weaponSizeGap(weapon, wielder);
  if (gap <= -3) {
    return { hands: 1 };
  }

  if (gap >= 4) {
    return { tooLarge: true };
  }

  return gap == 3 ? { hands: 2 } : null;
}

/** The weapon's update for upscaling to `size` (a Table 3-1 row key). */
export function upscaledWeaponUpdate(weapon, size) {
  const row = UPSCALE_TABLE[size];
  const system = weapon.system ?? {};
  const from = AVAILABILITY_ORDER.indexOf(system.availability);
  let availability = system.availability;
  if (from >= 0) {
    const cap = row.max ? AVAILABILITY_ORDER.indexOf(row.max) : AVAILABILITY_ORDER.length - 1;
    availability = AVAILABILITY_ORDER[Math.max(from, Math.min(from + row.levels, cap))];
  }

  const traits = [...new Set([...(system.traits ?? []), ...row.traits, ...(row.trip ? ['trip'] : [])])];
  const prerequisites = { when: size == 'gigantic'
    ? [{ any: [`self:size>=${size}`, 'self:skill:brawn>=d6'] }]
    : [`self:size>=${size}`] };
  const sizeLabel = globalThis.game?.i18n?.localize?.(globalThis.CONFIG?.E20?.actorSizes?.[size] ?? size) ?? size;
  return {
    name: `${weapon.name} (${sizeLabel})`,
    'system.availability': availability,
    'system.traits': traits,
    'system.prerequisites': prerequisites,
    'system.requirements.custom': size == 'gigantic' ? `${sizeLabel} or Brawn d6` : sizeLabel,
    [`flags.essence20.${UPSCALE_FLAG}`]: {
      size, prerequisites: foundry.utils.deepClone(system.prerequisites ?? {}), requirements: foundry.utils.deepClone(system.requirements ?? null), name: weapon.name,
    },
  };
}

/** A weapon effect's update for upscaling to `size`. */
export function upscaledEffectUpdate(effect, size) {
  const row = UPSCALE_TABLE[size];
  const system = effect.system ?? {};
  const update = { 'system.damageValue': (Number(system.damageValue) || 0) + row.damage };
  if (row.range && system.classification?.style != 'melee') {
    for (const key of ['value', 'long']) {
      const feet = Number(system.range?.[key]);
      if (feet > 0) {
        update[`system.range.${key}`] = roundUp5(feet * (1 + row.range));
      }
    }
  }

  const radius = Number(system.radius) || 0;
  if (radius > 0) {
    update['system.radius'] = roundUp5(radius * (1 + row.area));
  } else if (row.addBlast) {
    update['system.shape'] = 'circle';
    update['system.radius'] = row.addBlast;
  }

  return update;
}

/**
 * Upscale an owned weapon and its attacks to `size` (default: the wielder's own). Returns whether it was done.
 * @param {Actor} actor
 * @param {Item} weapon
 * @param {String} [size]
 */
export async function upscaleWeapon(actor, weapon, size = upscaleSizeFor(actor?.system?.size)) {
  if (!size || !weapon || weapon.flags?.essence20?.[UPSCALE_FLAG]) {
    return false;
  }

  await weapon.update(upscaledWeaponUpdate(weapon, size));
  const effects = actor.items.filter(item => item.type == 'weaponEffect' && item.flags?.essence20?.parentId == weapon.id);
  if (effects.length) {
    await actor.updateEmbeddedDocuments('Item', effects.map(effect => ({ _id: effect.id, ...upscaledEffectUpdate(effect, size) })));
  }

  return true;
}

/** A weapon has just been added to a Gigantic or larger actor: offer to make it for that size. */
export async function offerUpscale(actor, weapon) {
  const size = upscaleSizeFor(actor?.system?.size);
  if (!size || weapon?.flags?.essence20?.[UPSCALE_FLAG]) {
    return false;
  }

  const sizeLabel = game.i18n.localize(CONFIG.E20.actorSizes[size] ?? size);
  const yes = await foundry.applications.api.DialogV2.confirm({
    window: { title: weapon.name },
    content: `<p>${game.i18n.format('E20.UpscaleOffer', { weapon: weapon.name, actor: actor.name, size: sizeLabel })}</p>`,
    rejectClose: false,
  });
  return yes ? upscaleWeapon(actor, weapon, size) : false;
}
