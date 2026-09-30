/**
 * Display helpers for a weaponEffect's damage: the chip on the weapon row
 * (actor/parts/items/weapon/weapon-effects.hbs) and the details card / chat card
 * (actor/parts/items/weaponEffect/details.hbs). A weaponEffect can deal two damages - its main
 * damageValue/damageType and its secondaryDamage (weapon-effect.mjs) - and both are shown.
 */

// Font Awesome icon per E20.damageTypes key. Anything not listed falls back to DEFAULT_ICON.
export const DAMAGE_TYPE_ICONS = {
  acid: "fa-flask",
  blindingBlast: "fa-sun",
  blunt: "fa-hammer",
  cold: "fa-snowflake",
  cover: "fa-shield-halved",
  electric: "fa-bolt",
  element: "fa-droplet",
  emp: "fa-bolt-lightning",
  essenceStrength: "fa-dumbbell",
  essenceSpeed: "fa-person-running",
  essenceSmarts: "fa-brain",
  essenceSocial: "fa-comments",
  essenceStrengthSpeed: "fa-dumbbell",
  essenceAny: "fa-heart-crack",
  essenceSwap: "fa-dna",
  fire: "fa-fire",
  frightened: "fa-ghost",
  grapple: "fa-hand-fist",
  impaired: "fa-person-cane",
  deafened: "fa-ear-deaf",
  intimidate: "fa-person-harassing",
  knocProne: "fa-person-falling-burst",
  laser: "fa-wand-magic-sparkles",
  maneuver: "fa-person-falling",
  mesmerized: "fa-eye",
  modelock: "fa-lock",
  poison: "fa-skull-crossbones",
  psychic: "fa-brain",
  restrained: "fa-link",
  sharp: "fa-sword",
  sonic: "fa-volume-high",
  special: "fa-star",
  spot: "fa-crosshairs",
  stun: "fa-face-spiral-eyes",
  unconscious: "fa-bed",
  void: "fa-circle-half-stroke",
};

export const DEFAULT_ICON = "fa-burst";

/**
 * @param {String} damageType   An E20.damageTypes key.
 * @returns {String}            A Font Awesome icon class.
 */
export function getDamageTypeIcon(damageType) {
  return DAMAGE_TYPE_ICONS[damageType] ?? DEFAULT_ICON;
}

/**
 * Every damage a weaponEffect deals, main first. Accepts either the weaponEffect Item itself or the
 * summary entry its parent weapon keeps in system.items - entries written before secondaryDamage
 * was copied into them are filled in from the Item they point at.
 * @param {Item|Object} effect
 * @returns {Array<{value: Number, type: String, icon: String}>}
 */
export function getWeaponEffectDamages(effect) {
  if (!effect) {
    return [];
  }

  const data = effect.system ?? effect;
  const secondary = data.secondaryDamage
    ?? (effect.uuid && typeof fromUuidSync == "function" ? fromUuidSync(effect.uuid)?.system?.secondaryDamage : null);

  return [
    { value: data.damageValue, type: data.damageType },
    { value: secondary?.value, type: secondary?.type },
  ]
    .filter(damage => damage.value > 0)
    .map(damage => ({ ...damage, icon: getDamageTypeIcon(damage.type) }));
}
