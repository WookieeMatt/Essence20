/**
 * Fitting a freshly granted weapon to what gave it - the Transformers Alt Mode special attacks: the
 * chassis prints its own damage for the Blunt hit, and may offer "1 Blunt or Sharp" or "Finesse or
 * Might", asked when the weapon arrives. The rules engine's `fitAttack` step (rules/steps.mjs) uses it.
 */

/**
 * The updates that fit a freshly granted special-attack weapon to its chassis: the Blunt hit's
 * damage and type (the alternate effects are left alone) and the rolled Skill of every effect using
 * one of the offered Skills. `effects` are the weapon's embedded weaponEffect items.
 */
export function specialAttackUpdates(weapon, effects, { damage = null, type = null, skill = null, skills = [] } = {}) {
  const patch = system => {
    const out = {};
    if (system?.damageType == 'blunt') {
      if (damage != null && damage != system.damageValue) {
        out.damageValue = damage;
      }

      if (type && type != 'blunt') {
        out.damageType = type;
      }
    }

    if (skill && skills.includes(system?.classification?.skill) && system.classification.skill != skill) {
      out['classification.skill'] = skill;
    }

    return out;
  };

  const effectUpdates = effects.map(effect => ({ _id: effect.id, ...Object.fromEntries(Object.entries(patch(effect.system)).map(([k, v]) => [`system.${k}`, v])) }))
    .filter(update => Object.keys(update).length > 1);
  const weaponUpdate = {};
  for (const [key, entry] of Object.entries(weapon?.system?.items ?? {})) {
    if (entry?.type == 'weaponEffect') {
      for (const [path, value] of Object.entries(patch(entry))) {
        weaponUpdate[`system.items.${key}.${path}`] = value;
      }
    }
  }

  const traits = weapon?.system?.traits;
  if (type && type != 'blunt' && Array.isArray(traits) && traits.includes('blunt')) {
    weaponUpdate['system.traits'] = [...new Set(traits.map(trait => (trait == 'blunt' ? type : trait)))];
  }

  return { effectUpdates, weaponUpdate };
}

const LABELS = { blunt: 'E20.DamageBlunt', sharp: 'E20.DamageSharp', finesse: 'E20.SkillFinesse', might: 'E20.SkillMight' };

/**
 * Ask the offered choices and fit the weapon (and its attack items) to them.
 * @param {Actor} actor
 * @param {Item} weapon   The granted weapon.
 * @param {{title: String, damage?: Number, types?: Array<String>, skills?: Array<String>}} spec
 * @returns {Promise<void>}
 */
export async function fitGrantedWeapon(actor, weapon, { title = '', damage = null, types = [], skills = [] } = {}) {
  const { chooseButtons } = await import("./grants.mjs");
  const ask = async (key, values) => {
    if (!values?.length) {
      return null;
    }

    const choice = await chooseButtons(title, game.i18n.format(key, { mode: title, weapon: weapon.name }),
      values.map(value => [value, game.i18n.localize(LABELS[value] ?? value)]));
    return values.includes(choice) ? choice : null;
  };

  const type = await ask('E20.Tf2SpecialAttackType', types);
  const skill = await ask('E20.Tf2SpecialAttackSkill', skills);
  const effects = (actor.items?.contents ?? [...(actor.items ?? [])]).filter(item => item.type == 'weaponEffect' && item.flags?.essence20?.parentId == weapon.id);
  const { effectUpdates, weaponUpdate } = specialAttackUpdates(weapon, effects, { damage, type, skill, skills });
  if (effectUpdates.length) {
    await actor.updateEmbeddedDocuments('Item', effectUpdates);
  }

  if (Object.keys(weaponUpdate).length) {
    await weapon.update(weaponUpdate);
  }
}
