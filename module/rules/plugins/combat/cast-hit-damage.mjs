import { hitRiderOnCast } from "./hit-rider.mjs";

/**
 * A spell's later damage counted as one of its cast hits (round 12, group I): a storm's strike, a lingering
 * effect's tick. The caster's `on: "cast"` HitRider rules whose `when` holds for that spell (item:id:..., the
 * damage type...) change it the way they change a successful cast row - More Bang for your Buck's +1 on Temper
 * Tempest's lightning. No spell (the caster doesn't hold it) - the damage as it is.
 * @param {Actor} caster
 * @param {Item} spell          The caster's spell the damage comes from.
 * @param {Number} damage       Its damage before the riders.
 * @param {String} damageType
 * @returns {Promise<Number>}
 */
export async function castHitDamage(caster, spell, damage, damageType = null) {
  const row = { success: true, damageValue: Number(damage) || 0 };
  if (caster && spell) {
    await hitRiderOnCast(caster, [row], { damageType }, { rider: { item: spell, itemUuid: spell.uuid, damageType } });
  }

  return row.damageValue;
}
