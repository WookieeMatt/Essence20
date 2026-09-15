/**
 * One-time back-solve for the Health/Defense/Movement unification (npc/companion/vehicle/zord
 * actors used to store a flat, GM-typed total per field - system.defenses.<type>.value,
 * system.health.max, system.movement.<type>.total - with no derived computation behind it; now
 * every actor type computes these the same way a playerCharacter always has, via Essence20Actor#
 * _prepareHealth/_prepareDefenses/_prepareMovement). Called from each affected ActorData class's
 * own static migrateData(source) (the same idiom character.mjs#migrateCharacterData already
 * establishes) - that hook receives the true raw database record, before any schema field
 * defaults apply, unlike the async app-level migration.mjs#migrateActorData, which only ever
 * sees already-schema-cleaned data and so can't see the old flat shape at all by the time it
 * runs. Rewrites each field so the exact same number comes back out once the new formula runs;
 * from then on it only changes because of a real edit, equipped armor, a Perk, an Active Effect,
 * etc.
 *
 * Gated entirely on Defenses still having its old flat {usesDrivers, value} shape (no .base) -
 * the one field here with a genuine, permanent shape signature to detect "not yet migrated" by.
 * Health and Movement's own schemas didn't change shape (system.health and
 * system.movement.<type> already had every field the new formula needs), so they have nothing
 * to reliably distinguish old-but-never-computed from already-migrated on their own - they ride
 * along on Defenses' own one-time signal instead, since all three ship as one migration.
 *
 * Perk-conditional Defense bonuses (Armor Expert/The Heavy/Fighting Style - see Essence20Actor#
 * _prepareDefenses) are deliberately NOT reproduced here to avoid a second, drift-prone copy of
 * that logic outside a live Actor Document (this runs against a plain source object, without
 * findPerk/actorHasPerk's Document-collection machinery). Non-PC actors essentially never hold
 * those PC Role Perks; the rare one that does just has its computed total shift by the same 1-2
 * points the Perk itself explains once re-rendered, not a silently wrong number.
 * @param {Object} source   Raw actor source data, mutated in place.
 */
export function migrateNonPcStats(source) {
  const system = source.system;
  const defenses = system?.defenses;
  if (!defenses) {
    return;
  }

  const alreadyMigrated = Object.values(defenses).every(defense => defense?.base !== undefined);
  if (alreadyMigrated) {
    return;
  }

  const ESSENCE_BY_DEFENSE = { toughness: 'strength', evasion: 'speed', willpower: 'smarts', cleverness: 'social' };
  for (const [defenseType, defense] of Object.entries(defenses)) {
    if (!defense || typeof defense.value != 'number') {
      continue;
    }

    const essence = system.essences?.[ESSENCE_BY_DEFENSE[defenseType]];
    const essenceValue = (essence?.max ?? essence?.value) || 0;
    defense.base = defense.value - essenceValue;
    delete defense.value;

    if (defenseType == 'toughness' || defenseType == 'evasion') {
      // Only Willpower/Cleverness keep a real usesDrivers field on the new schema (the driver/
      // pilot Defense substitution - see templates/machine.mjs#makeDefensesFields).
      delete defense.usesDrivers;
    }
  }

  if (system.health && typeof system.health.max == 'number') {
    const conditioning = system.conditioning ?? 0;
    const bonus = system.health.bonus ?? 0;
    system.health.origin = system.health.max - conditioning - bonus;
  }

  if (system.movement) {
    for (const movement of Object.values(system.movement)) {
      if (movement && typeof movement.total == 'number') {
        movement.base = movement.total - (movement.bonus ?? 0);
      }
    }
  }
}
