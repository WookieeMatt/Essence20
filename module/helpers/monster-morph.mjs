/**
 * Monster Morph (Finster's Monster-Matic Cookbook, all 6 Psycho Paths, 3rd level, p.284/289/292/
 * 294-295/298/301): "Spend 3 Personal Power as a Standard action to change into your specific
 * Monster Form," granting (per RAW, shared shape across all 6 Paths, just different numbers/named
 * Skills): growth to Large Size, a flat Toughness Defense bonus, +2 max/current Health, an upshift
 * on 2-3 named Skills, and access to that Path's own replacement weaponEffect attacks (already
 * real compendium items in this pack - Focused Rage Flare/Monstrous Talons etc. - a pure
 * content-access grant needing no code, the same "already built" finding this session's own
 * categorization pass made for Psycho Blast). "Can re-assume Ranger form as a Free action" is the
 * toggle-back-off half.
 *
 * A single shared Perk item grants this to all 6 Paths, but each Path's own Monster Form has
 * different numbers - which Path an actor follows is read off whichever `type: "role"` item they
 * hold (the same "read the held Role item's own sourceId" idiom this system already uses to
 * distinguish Role-specific content elsewhere), keying into MONSTER_FORM_BY_PATH below.
 *
 * Size-toggle shape follows this same book's own Monster... Grow! (helpers/monster-grow.mjs) -
 * save the actor's original Size on activation, restore it on deactivation. Health is a flat
 * system.health.bonus add/remove (Boosted Vigor's own established shape - actor.update(), not a
 * change to _prepareHealth itself). The Toughness bonus is deliberately NOT written to
 * system.defenses.toughness.bonus (that field is reserved for the player/GM's own manual Stat
 * Editor entry and compendium Active Effects - see documents/actor.mjs's own doc comment on why
 * runtime code must never write there) - instead it's a live, non-consumed read in dice.mjs's own
 * per-target checkEntries construction, the same shape Powered Plating/Phantom Suite's own
 * Morph-time Toughness/Evasion bonuses already established.
 *
 * NOT built this pass: each Path's own unique 7th bullet (a reactive rider - Cruelty/Frost trigger
 * off TAKING 2+ damage, Flame/Thorns/Venom trigger off successfully LANDING a melee hit, each with
 * its own follow-up attack and effect) and Path of Stone's own "Resistance to all damage types
 * except Psychic/Sonic/Void" clause (this system's `system.resistances` map has no "all except"
 * shorthand, and several of `E20.damageTypes`' own keys are pseudo-types like `frightened`/
 * `grapple`/`intimidate` that a blanket enumeration would nonsensically grant Resistance to) - both
 * flagged as real follow-up work, not silently dropped.
 */
const FMMC = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.";
export const MONSTER_MORPH_ID = `${FMMC}iDbMl3SS6XnyADN2`;

const PATH_CRUELTY_ID = `${FMMC}vWie8Dy4u54sf1hy`;
const PATH_FLAME_ID = `${FMMC}4PbR4S3s83Coa0kL`;
const PATH_FROST_ID = `${FMMC}GQ5aQWbjmaO9y00w`;
const PATH_STONE_ID = `${FMMC}TEjkVjIEFEbRI736`;
const PATH_THORNS_ID = `${FMMC}0ICOTyVDXK1i6l1S`;
const PATH_VENOM_ID = `${FMMC}rWoVOcNc3lXKDbhg`;

const MONSTER_FORM_BY_PATH = {
  [PATH_CRUELTY_ID]: { toughnessBonus: 2, healthBonus: 2, skills: ['alertness', 'intimidation', 'might'] },
  [PATH_FLAME_ID]: { toughnessBonus: 2, healthBonus: 2, skills: ['alertness', 'athletics', 'brawn'] },
  [PATH_FROST_ID]: { toughnessBonus: 2, healthBonus: 2, skills: ['brawn', 'might', 'initiative'] },
  [PATH_STONE_ID]: { toughnessBonus: 4, healthBonus: 2, skills: ['intimidation', 'might', 'survival'] },
  [PATH_THORNS_ID]: { toughnessBonus: 1, healthBonus: 2, skills: ['alertness', 'intimidation', 'survival'] },
  [PATH_VENOM_ID]: { toughnessBonus: 2, healthBonus: 2, skills: ['intimidation', 'survival'] },
};

const MONSTER_FORM_ACTIVE_FLAG = 'monsterFormActive';
const MONSTER_FORM_SIZE_FLAG = 'monsterFormPreviousSize';
const GROWN_SIZE = 'large';
const ACTIVATION_COST = 3;

/**
 * @param {Actor} actor
 * @returns {Object|null}   That actor's own Monster Form config, or null if they don't hold one of
 *   the 6 Psycho Path Role items.
 */
function getMonsterFormConfig(actor) {
  const roleItem = actor?.items?.find(item => item.type == 'role');
  const sourceId = roleItem?.flags?.core?.sourceId ?? roleItem?._stats?.compendiumSource;
  return MONSTER_FORM_BY_PATH[sourceId] ?? null;
}

export function isMonsterFormActive(actor) {
  return !!actor?.getFlag?.('essence20', MONSTER_FORM_ACTIVE_FLAG);
}

/**
 * The live, non-consumed Toughness Defense bonus while in Monster Form - see this file's own doc
 * comment for why it's read here rather than written into system.defenses.toughness.bonus.
 * @param {Actor} actor
 * @returns {Number}
 */
export function getMonsterFormToughnessBonus(actor) {
  if (!isMonsterFormActive(actor)) {
    return 0;
  }

  return getMonsterFormConfig(actor)?.toughnessBonus ?? 0;
}

/**
 * The Skill upshift granted by Monster Form for the actor's own Path, if `rolledSkill` is one of
 * that Path's 2-3 named Skills.
 * @param {Actor} actor
 * @param {String} rolledSkill
 * @returns {Number}
 */
export function getMonsterFormSkillBonus(actor, rolledSkill) {
  if (!isMonsterFormActive(actor)) {
    return 0;
  }

  return getMonsterFormConfig(actor)?.skills.includes(rolledSkill) ? 1 : 0;
}

/**
 * Flips the actor's own Monster Form. Turning it ON spends 3 Personal Power and requires the actor
 * to actually follow one of the 6 recognized Psycho Paths (returns null, spending nothing, if
 * either isn't true); turning it back OFF is free.
 * @param {Actor} actor
 * @returns {Promise<Boolean|null>}   The new state (true = now active), or null if activation
 *   couldn't proceed (unaffordable, or no recognized Path).
 */
export async function toggleMonsterMorph(actor) {
  const nowActive = !isMonsterFormActive(actor);
  if (nowActive) {
    const config = getMonsterFormConfig(actor);
    if (!config || (actor.system.powers?.personal?.value ?? 0) < ACTIVATION_COST) {
      return null;
    }

    await actor.setFlag('essence20', MONSTER_FORM_SIZE_FLAG, actor.system.size);
    await actor.update({
      'system.powers.personal.value': actor.system.powers.personal.value - ACTIVATION_COST,
      'system.size': GROWN_SIZE,
      'system.health.bonus': actor.system.health.bonus + config.healthBonus,
    });
  } else {
    const config = getMonsterFormConfig(actor);
    const previousSize = actor.getFlag('essence20', MONSTER_FORM_SIZE_FLAG) ?? 'common';
    await actor.update({
      'system.size': previousSize,
      'system.health.bonus': actor.system.health.bonus - (config?.healthBonus ?? 0),
    });
    await actor.unsetFlag('essence20', MONSTER_FORM_SIZE_FLAG);
  }

  await actor.setFlag('essence20', MONSTER_FORM_ACTIVE_FLAG, nowActive);
  return nowActive;
}

/**
 * Grow! (Finster's Monster-Matic Cookbook, all 6 Psycho Paths, 10th level, p.285 etc.): "Spend a
 * Standard action while in Monster Form to enlarge yourself. Your Size becomes Towering, which
 * grants +1 damage to all attacks, and you gain +2 to your Toughness and Evasion." Unlike Monster
 * Morph, this Perk names no Personal Power cost at all - the only gate is already being in Monster
 * Form. Same save/restore Size-toggle shape as Monster Morph itself and this book's own Monster...
 * Grow! (helpers/monster-grow.mjs), and the same "live, non-consumed checkEntries read, not written
 * to system.defenses.<type>.bonus" shape for the Toughness/Evasion half. The +1 damage is an
 * ordinary flat damage-bonus term (any attack, not attack-type-scoped) alongside Warfighter/Power
 * Boost/etc. in dice.mjs's own damageBonusValue accumulator.
 *
 * `isGrowActive` is ALSO gated on Monster Form still being active (not just its own flag) - if the
 * actor reverts out of Monster Form entirely while Grow is still flagged on, this re-checks at
 * consumption time rather than trusting a flag that could now be stale, the same "re-check the
 * broader toggle at read time" idiom Phase Defense's own Phantom-Suite-dependency already
 * established.
 */
export const GROW_ID = `${FMMC}ZqE7kDEMylFQK6Oa`;
const GROW_ACTIVE_FLAG = 'monsterGrowSelfActive';
const GROW_SIZE_FLAG = 'monsterGrowSelfPreviousSize';
const TOWERING_SIZE = 'towering';
const GROW_DAMAGE_BONUS = 1;
const GROW_DEFENSE_BONUS = 2;

function hasGrowFlag(actor) {
  return !!actor?.getFlag?.('essence20', GROW_ACTIVE_FLAG);
}

export function isGrowActive(actor) {
  return isMonsterFormActive(actor) && hasGrowFlag(actor);
}

export function getGrowDamageBonus(actor) {
  return isGrowActive(actor) ? GROW_DAMAGE_BONUS : 0;
}

export function getGrowDefenseBonus(actor) {
  return isGrowActive(actor) ? GROW_DEFENSE_BONUS : 0;
}

/**
 * Flips the actor's own Grow state. Turning it ON requires already being in Monster Form (returns
 * null if not); turning it back OFF is always allowed.
 * @param {Actor} actor
 * @returns {Promise<Boolean|null>}   The new state (true = now active), or null if activation
 *   couldn't proceed (not in Monster Form).
 */
export async function toggleGrow(actor) {
  const nowActive = !hasGrowFlag(actor);
  if (nowActive) {
    if (!isMonsterFormActive(actor)) {
      return null;
    }

    await actor.setFlag('essence20', GROW_SIZE_FLAG, actor.system.size);
    await actor.update({ 'system.size': TOWERING_SIZE });
  } else {
    const previousSize = actor.getFlag('essence20', GROW_SIZE_FLAG) ?? 'large';
    await actor.update({ 'system.size': previousSize });
    await actor.unsetFlag('essence20', GROW_SIZE_FLAG);
  }

  await actor.setFlag('essence20', GROW_ACTIVE_FLAG, nowActive);
  return nowActive;
}
