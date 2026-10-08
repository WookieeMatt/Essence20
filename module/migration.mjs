import { createId, slugifySpecializationName } from "./util/utils.mjs";
import { parseDurationString } from "./data/duration-schema.mjs";
import { legacyChoiceOf } from "./rules/choice-read.mjs";
import { MOVED_ITEM_UUIDS } from "./items/shared/item-lookups.mjs";

/**
 * Perform a system migration for the entire World, applying migrations for Actors, Items, and Compendium packs
 * @returns {Promise}      A Promise which resolves once the migration is completed
 */
export const migrateWorld = async function() {
  resetMigrationCaches();
  const version = game.system.version;
  ui.notifications.info(game.i18n.format("MIGRATION.begin", {version}), {permanent: true});

  // Attempt to fix invalid Actors
  const invalidActorIds = Array.from(game.actors.invalidDocumentIds);
  let reloadNeeded = false;
  for (const invalidId of invalidActorIds) {
    const invalidActor = game.actors.getInvalid(invalidId);
    if (invalidActor.type == "megaformZord") {
      await invalidActor.update({
        "type": "megaform",
      });
      reloadNeeded = true;
    }

    if (["giJoe", "pony", "powerRanger", "transformer"].includes(invalidActor.type)) {
      await invalidActor.update({
        "type": "playerCharacter",
        "system": invalidActor.system,
      }, {recursive: false});
      reloadNeeded = true;
    }
  }

  if (reloadNeeded) {
    foundry.utils.debouncedReload();
    return;
  }

  // One Perk choice report for the whole run (perkChoiceReport), summarised to the GM by migratePerkChoices at the end.
  activePerkReport = null;
  activePerkReport = perkChoiceReport();

  // Migrate World Actors
  const actors = game.actors.map(a => [a, true])
    .concat(Array.from(game.actors.invalidDocumentIds).map(id => [game.actors.getInvalid(id), false]));
  for (const [actor, valid] of actors) {
    try {
      const source = valid ? actor.toObject() : game.data.actors.find(a => a._id === actor.id);
      const updateData = await migrateActorData(source);
      if (!foundry.utils.isEmpty(updateData)) {
        console.log(`Migrating Actor document ${actor.name}`);
        await actor.update(updateData, {enforceTypes: false, diff: valid});
        await actor.update({"system.skills.-=strength": null});
        await actor.update({"system.skills.-=smarts": null});
        await actor.update({"system.skills.-=social": null});
        await actor.update({"system.skills.-=speed": null});
        await actor.update({"system.skills.-=any": null});
      }

      // Perk choice P2: the multi-Skill Perks' copies folded into one item (and anything migrateActorData left).
      if (valid) {
        await migrateActorPerkChoices(actor);
      }
    } catch(err) {
      err.message = `Failed essence20 system migration for Actor ${actor.name}: ${err.message}`;
      console.error(err);
    }
  }

  // Migrate World Items
  const items = game.items.map(i => [i, true])
    .concat(Array.from(game.items.invalidDocumentIds).map(id => [game.items.getInvalid(id), false]));
  for (const [item, valid] of items) {
    try {
      const source = valid ? item.toObject() : game.data.items.find(i => i._id === item.id);

      if (["giJoe", "pony", "powerRanger", "transformer"].includes(item.type)) {
        item.delete();
        continue;
      }

      if (item.type == "contact") {
        item.delete();
        break;
      }

      const updateData = await migrateItemData(source);
      if (!foundry.utils.isEmpty(updateData)) {
        console.log(`Migrating Item document ${item.name}`);
        await item.update(updateData, {enforceTypes: false, diff: valid});
        if (item.type == "origin") {
          await item.update({"system.-=originPerkIds": null});
        } else if (item.type == "influence") {
          await item.update({"system.-=perkIds": null});
          await item.update({"system.-=hangUpIds": null});
        } else if (item.type == "weapon") {
          await item.update({"system.-=upgradeIds": null});
          await item.update({"system.-=weaponEffectIds": null});
        } else if (item.type =="armor") {
          await item.update({"system.-=upgradeIds": null});
        }
      }
    } catch(err) {
      err.message = `Failed essence20 system migration for Item ${item.name}: ${err.message}`;
      console.error(err);
    }
  }

  /* Leaving this here in case we need to migrate Macros later
  // Migrate World Macros
  for ( const m of game.macros ) {
    try {
      const updateData = migrateMacroData(m.toObject(), migrationData);
      if ( !foundry.utils.isEmpty(updateData) ) {
        console.log(`Migrating Macro document ${m.name}`);
        await m.update(updateData, {enforceTypes: false});
      }
    } catch(err) {
      err.message = `Failed dnd5e system migration for Macro ${m.name}: ${err.message}`;
      console.error(err);
    }
  }
  */

  /* Leaving this here in case we need to migrate Actor Override Tokens later
  // Migrate Actor Override Tokens
  for ( let s of game.scenes ) {
    try {
      const updateData = migrateSceneData(s, migrationData);
      if ( !foundry.utils.isEmpty(updateData) ) {
        console.log(`Migrating Scene document ${s.name}`);
        await s.update(updateData, {enforceTypes: false});
        // If we do not do this, then synthetic token actors remain in cache
        // with the un-updated actorData.
        s.tokens.forEach(t => t._actor = null);
      }
    } catch(err) {
      err.message = `Failed dnd5e system migration for Scene ${s.name}: ${err.message}`;
      console.error(err);
    }
  }
  */

  // Migrate World Compendium Packs
  for (let p of game.packs) {
    if (p.metadata.system != "essence20") continue;
    if (!["world", "module"].includes(p.metadata.packageType)) continue;
    if (!["Actor", "Item", "Scene"].includes(p.documentName)) continue;
    await migrateCompendium(p);
  }

  // The Perk choice pass (old picks into rules choices): unlinked token actors too, and the GM told what was left alone.
  // Part of the main migration (user, 2026-10-07) - it runs when needsMigrationVersion says so, like everything here.
  try {
    await migratePerkChoices();
  } finally {
    activePerkReport = null;
  }

  // Set the migration as complete
  game.settings.set("essence20", "systemMigrationVersion", game.system.version);
  ui.notifications.info(game.i18n.format("MIGRATION.complete", {version}), {permanent: true});
};

/* -------------------------------------------- */
/*  Document Type Migration Helpers             */
/* -------------------------------------------- */

/**
 * Migrate a single Actor document to incorporate latest data model changes
 * Return an Object of updateData to be applied
 * @param {object} actor            The actor data object to update
 * @param {object} compendiumActor The full actor from the compendium
 * @returns {object}                The updateData to apply
 */
/** An actor's Role, from a document or from plain data (migrateWorld passes toObject(), whose items are an array). */
export function roleOfActorData(actor) {
  return (actor?.items?.documentsByType?.role ?? [...(actor?.items ?? [])].filter(item => item?.type == 'role'))[0] ?? null;
}

export const migrateActorData = async function(actor, compendiumActor) {
  const updateData = {};

  //Migration for Weapon and Armor Training and Qualificaitons moving to Actors from Roles
  const currentVersion = game.settings.get("essence20", "systemMigrationVersion");
  if (!currentVersion || foundry.utils.isNewerVersion('4.5.1', currentVersion)) {
    // migrateWorld passes the actor's plain data (toObject), whose items are an array with no documentsByType - the
    // old read threw for every actor, so forcing a migration from an old version (4.1.2) migrated nothing (2026-10-07).
    const role = roleOfActorData(actor);

    if (role) {
      for (const armorType of role.system.armors.qualified) {
        updateData[`system.qualified.armors.${armorType}`] = true;
      }

      for (const armorType of role.system.armors.trained) {
        updateData[`system.trained.armors.${armorType}`] = true;
      }

      for (const armorType of role.system.upgrades.armors.trained) {
        updateData[`system.trained.upgrades.armors.${armorType}`] = true;
      }

      for (const weaponType of role.system.weapons.qualified) {
        updateData[`system.qualified.weapons.${weaponType}`] = true;
      }

      for (const weaponType of role.system.weapons.trained) {
        updateData[`system.trained.weapons.${weaponType}`] = true;
      }

      if (role.system.version =='giJoe') {
        updateData[`system.canQualify`] = true;
      }
    }
  }

  // Migrate initiative
  if (actor.system.initiative.shift) {
    updateData[`system.skills.initiative.modifier`] = actor.system.initiative.modifier;
    updateData[`system.skills.initiative.shift`] = actor.system.initiative.shift;
  }

  /* Seed system.skills.<skill>.isChosen for existing NPC-like actors. The NPC Skill Picker app
     (module/apps/skill-picker.mjs) replaces the old automatic "does this skill deviate from
     default" display heuristic (base-actor-sheet.mjs's now-removed _prepareDisplayedNpcSkills)
     with an explicit GM-controlled isChosen flag - without this one-time seed, every existing
     NPC-like actor would suddenly show zero skills on its sheet the first time this version
     loads. Reuses the exact same heuristic the old code used, so the visible skill list doesn't
     change for anyone on upgrade; the Skill Picker is only needed afterward to change it. */
  if ((!currentVersion || foundry.utils.isNewerVersion('5.2.0', currentVersion))
    && ['npc', 'zord', 'megaform', 'vehicle', 'companion'].includes(actor.type)) {
    const specializedSkills = new Set();
    for (const item of Array.from(actor.items ?? [])) {
      if (item.type === 'specialization') {
        specializedSkills.add(item.system.skill);
      }
    }

    for (const [skill, fields] of Object.entries(actor.system.skills)) {
      if (fields.shift != 'd20' || fields.isSpecialized || fields.modifier || specializedSkills.has(skill)) {
        updateData[`system.skills.${skill}.isChosen`] = true;
      }
    }
  }

  /* Re-decompose an existing Zord's Defenses and Health (zord-base.mjs).
     Those fields used to store the baseline Zord stat block's own PRINTED totals (PR CRB p.134:
     "HEALTH 6 ... TOUGHNESS 17 (1 Plating Armor) | EVASION 14") as the `base` component, but
     _prepareDefenses/_prepareHealth then add the Essence and Conditioning that those printed
     numbers already include - so a Zord actually rendered at Toughness 23 / Evasion 18, and its
     Health max came out as just its Conditioning (3) while its value stayed 6, displaying "6 / 3".
     The schema defaults now decompose properly (base 10 - the same universal base every other
     actor type and Megaform's own derivation already use - plus the Plating Armor and chassis
     Health as their own components), but schema defaults only ever apply to NEWLY created actors,
     so existing Zords keep the old stored numbers until this runs.

     Matched on the exact pre-fix default values rather than overwritten wholesale, so a Zord whose
     GM has already hand-tuned these is left alone and re-running is a no-op (once a field is
     corrected it no longer matches, so this can only ever fire once per field per actor).

     Deliberately NOT version-gated, unlike most one-time seeds in this file. system.json ships
     `"version": "This is auto replaced"` (substituted at release), and migrateWorld() stores
     game.system.version into systemMigrationVersion verbatim - so any world that has ever run a
     migration from a dev/unsubstituted build has that literal string recorded, and
     isNewerVersion(<any semver>, "This is auto replaced") is false. A version gate would silently
     never fire for those worlds. The value-matching above already provides the run-once property a
     gate would, without depending on a parseable stored version.

     Megaform is excluded on purpose - it shares zord-base.mjs but _prepareMegaformData() zeroes
     and recomputes all of these from its participants every derivation, so its stored values never
     reach the sheet. */
  if (actor.type == 'zord') {
    const toughness = actor.system.defenses?.toughness;
    const evasion = actor.system.defenses?.evasion;

    if (toughness?.base === 17) {
      updateData['system.defenses.toughness.base'] = 10;
      // The "(1 Plating Armor)" half of RAW's printed 17, moved out of the base into the armor
      // component _prepareDefenses already adds separately.
      updateData['system.defenses.toughness.armor'] = (toughness.armor ?? 0) + 1;
    }

    if (evasion?.base === 14) {
      updateData['system.defenses.evasion.base'] = 10;
    }

    // 3 chassis Health + the baseline Zord's own Conditioning +3 = RAW's printed Health 6.
    if (actor.system.health?.origin === 0) {
      updateData['system.health.origin'] = 3;
    }
  }

  // Migrate Skills
  if (actor.system.skills.strength) {
    const skillsForEssences = actor.system.skills;
    const essenceList = ["any", "strength", "speed", "smarts", "social"];
    let newSkills = {};
    for (const [essence, skillsForEssence] of Object.entries(skillsForEssences)) {
      if (essenceList.includes(essence)) {
        for (const [skill, fields] of Object.entries(skillsForEssence)) {
          newSkills[skill] = {
            "isSpecialized": fields.isSpecialized,
            "modifier": fields.modifier,
            "shift": fields.shift,
            "shiftDown": fields.shiftDown,
            "shiftUp": fields.shiftUp,
          };
        }
      }
    }

    updateData[`system.skills`] = newSkills;
  }

  if (!actor.system.skills.acrobatics.essences.speed) {
    for (const skill of Object.keys(actor.system.skills)) {
      if (skill != 'roleSkillDie') {
        const essence = CONFIG.E20.skillToEssence[skill];
        if (essence == 'any') {
          updateData[`system.skills.${skill}.essences.smarts`] = true;
          updateData[`system.skills.${skill}.essences.social`] = true;
          updateData[`system.skills.${skill}.essences.speed`] = true;
          updateData[`system.skills.${skill}.essences.strength`] = true;
        } else {
          updateData[`system.skills.${skill}.essences.${essence}`] = true;
        }
      }
    }
  }


  // Migrate to Base Movement
  if (Object.keys(actor.system.movement.aerial).sort() != ['altMode', 'base', 'bonus', 'morphed', 'total']) {
    updateData[`system.movement.aerial.altMode`] = 0;
    updateData[`system.movement.aerial.base`] = 0;
    updateData[`system.movement.aerial.bonus`] = 0;
    updateData[`system.movement.aerial.morphed`] = 0;
    updateData[`system.movement.aerial.total`] = 0;

    updateData[`system.movement.ground.altMode`] = 0;
    updateData[`system.movement.ground.base`] = 0;
    updateData[`system.movement.ground.bonus`] = 0;
    updateData[`system.movement.ground.morphed`] = 0;
    updateData[`system.movement.ground.total`] = 0;

    updateData[`system.movement.swim.altMode`] = 0;
    updateData[`system.movement.swim.base`] = 0;
    updateData[`system.movement.swim.bonus`] = 0;
    updateData[`system.movement.swim.morphed`] = 0;
    updateData[`system.movement.swim.total`] = 0;

    if (["giJoe", "pony", "powerRanger", "transformer"].includes(actor.type)) {
      for (const item of actor.items) {
        if (item.type == 'origin') {
          updateData[`system.movement.aerial.base`] = item.system.baseAerialMovement;
          updateData[`system.movement.ground.base`] = item.system.baseGroundMovement;
          updateData[`system.movement.swim.base`] = item.system.baseAquaticMovement;
          break;
        }
      }
    } else if (typeof actor.system.movement.aerial == 'string') { // Non-PCs
      updateData[`system.movement.aerial.total`] = actor.system.movement.aerial;
      updateData[`system.movement.ground.total`] = actor.system.movement.ground;
      updateData[`system.movement.swim.total`] = actor.system.movement.swim;
    } else { // Non-PCs where movement fields are already objects
      updateData[`system.movement.aerial.total`] = actor.system.movement.aerial.total;
      updateData[`system.movement.ground.total`] = actor.system.movement.ground.total;
      updateData[`system.movement.swim.total`] = actor.system.movement.swim.total;
    }
  }

  // Migrate Zord/MFZ essence
  if (["zord", "megaformZord"].includes(actor.type)) {
    const strength = actor.system.essences.strength;
    if (typeof strength == 'number') {
      updateData[`system.essences.strength`] = {
        usesDrivers: false,
        value: actor.system.essences.strength,
      };
    }

    const speed = actor.system.essences.speed;
    if (typeof speed == 'number') {
      updateData[`system.essences.speed`] = {
        usesDrivers: false,
        value: actor.system.essences.speed,
      };
    }
  }

  // Migrate zordIds to Actor entries
  if (actor.type == "megaform" && actor.system.zordIds.length) {
    const pathPrefix = "system.actors";
    for (const zordId of actor.system.zordIds) {
      const droppedActor = game.actors.get(zordId);
      const entry = {
        uuid: droppedActor.uuid,
        img: droppedActor.img,
        name: droppedActor.name,
        type: droppedActor.type,
      };
      const id = await createId(actor.system.actors);
      updateData[`${pathPrefix}.${id}`] = entry;
    }
  }

  if (["giJoe", "pony", "powerRanger", "transformer"].includes(actor.type)) {
    updateData['type'] = 'playerCharacter';
  }

  // Migrate Owned Items
  if (!actor.items) {
    return updateData;
  }

  /* Release N of the specialization redesign (see essence20-specialization-redesign): a
     `specialization` Item is converted into a system.skills.<skill>.specializations.<id> entry
     (see common.mjs#makeSkillFields) and deleted below, same as `contact`. The DataModel itself
     stays registered this release (data/item/specialization.mjs, its index.mjs entry) so any
     Item a partially-failed migration leaves behind is still valid and gets picked up next load
     - do not delete that registration until a Release N+1 confirms no live world still has any
     `specialization` Items left (a canary check in this function would catch that). Left
     unconditional (not version-gated like most one-time seeds in this file - see the isChosen
     seed above) rather than a one-time pass: the DataModel staying registered this release means
     nothing stops a `specialization` Item turning up again later (an old compendium drag, a
     manual create) even on an actor that already passed whatever version this shipped in - this
     needs to keep converting (and the loop below keeps deleting) any it finds, every pass, until
     Release N+1 finally removes the Item type outright. Naturally a no-op once none remain, so
     the always-run cost is negligible. Accumulated locally (not written straight into
     updateData) so slugifySpecializationName's collision check sees every specialization already
     converted this pass, not just what's already on the actor. Keyed by a slug of the Item's own
     name (not a random id) so a Perk's Active Effect can target it directly - e.g.
     system.skills.science.specializations.medicine.shiftUp - now that a Specialization can no
     longer be renamed after the fact (see util/utils.mjs#slugifySpecializationName). */
  const newSpecializationsBySkill = {};
  for (const item of actor.items) {
    if (item.type == 'specialization') {
      const skill = item.system.skill;
      const existing = {
        ...actor.system.skills[skill]?.specializations,
        ...newSpecializationsBySkill[skill],
      };
      const id = slugifySpecializationName(item.name, existing);
      (newSpecializationsBySkill[skill] ??= {})[id] = {
        name: item.name,
        shift: item.system.shift,
        isSpecialized: item.system.isSpecialized,
        edge: false,
        shiftUp: 0,
        shiftDown: 0,
        snag: false,
        granted: false,
      };
    }
  }

  for (const [skill, specializations] of Object.entries(newSpecializationsBySkill)) {
    for (const [id, specialization] of Object.entries(specializations)) {
      updateData[`system.skills.${skill}.specializations.${id}`] = specialization;
    }
  }

  /* Re-key any Specialization already stored under an old-style random id (written before this
     slug scheme existed - either by an earlier pass of the conversion above, or live before that
     changed over) so it becomes Active-Effect-targetable too, without the player needing to
     delete and re-add it. Reads actor.system.skills directly (not updateData) since the
     conversion above only ever writes already-correctly-keyed entries - this loop only has old,
     already-persisted data to fix. */
  for (const [skill, skillData] of Object.entries(actor.system.skills || {})) {
    if (foundry.utils.isEmpty(skillData.specializations)) {
      continue;
    }

    const rekeyed = {};
    for (const [key, specialization] of Object.entries(skillData.specializations)) {
      const properKey = slugifySpecializationName(specialization.name, rekeyed);
      if (properKey !== key) {
        // A plain key (no "-=" prefix - that's the old, now-deprecated deletion syntax) paired
        // with ForcedDeletion as the value is what actually deletes it.
        updateData[`system.skills.${skill}.specializations.${key}`] = new foundry.data.operators.ForcedDeletion();
        updateData[`system.skills.${skill}.specializations.${properKey}`] = specialization;
      }

      rekeyed[properKey] = specialization;
    }
  }

  const items = [];
  // Running totals of the actor fields migratePerkValue takes a Perk's value back out of (two Fast on Ground).
  const perkValueTotals = {};
  for (const itemData of actor.items) {
    // Migrate the Owned Item
    const fullActor = game.actors.get(actor._id) || compendiumActor;

    const itemToDelete = fullActor.items.get(itemData._id);

    if (itemToDelete.type == "contact" || itemToDelete.type == "specialization") {
      await itemToDelete.delete();
    }

    let itemUpdate = await migrateItemData(itemToDelete, fullActor, { inPack: !!compendiumActor });

    // A Perk's `value` (Fast, Expertise) - a rule now; what its drop wrote onto this actor comes back off.
    const perkValue = await migratePerkValue(itemToDelete, {
      inPack: !!compendiumActor, actorSystem: actor.system, totals: perkValueTotals, rules: itemUpdate['system.rules'],
    });
    Object.assign(itemUpdate, perkValue.update);
    Object.assign(updateData, perkValue.actorUpdate);

    if (itemToDelete.type == "origin") {
      await itemToDelete.update({"system.-=originPerkIds": null});
    } else if (itemToDelete.type == "influence") {
      await itemToDelete.update({"system.-=perkIds": null});
      await itemToDelete.update({"system.-=hangUpIds": null});
    } else if (itemToDelete.type == "weapon") {
      await itemToDelete.update({"system.-=upgradeIds": null});
      await itemToDelete.update({"system.-=weaponEffectIds": null});
    } else if (itemToDelete.type =="armor") {
      await itemToDelete.update({"system.-=upgradeIds": null});
    }

    // Update the Owned Item
    if (!foundry.utils.isEmpty(itemUpdate)) {
      itemUpdate._id = itemData._id;
      items.push(itemUpdate);
    }

  }

  // Perk choice P2 (migratePerkChoices below): the old picks copied into the rules choices, what the old picker baked
  // into the actor taken off (in this same update, with each copy's unbaked flag), sub-Perk children recorded. The
  // fold of the multi-Skill Perks' copies needs deletes, so migrateWorld / migrateCompendium run it after this update.
  const fullActorForChoices = game.actors.get(actor._id) || compendiumActor;
  if (fullActorForChoices) {
    const choices = await planActorPerkChoices(fullActorForChoices, { inPack: !!compendiumActor, actorSystem: actor.system });
    Object.assign(updateData, choices.actorUpdate);
    for (const update of choices.itemUpdates) {
      const existing = items.find(entry => entry._id == update._id);
      if (existing) {
        Object.assign(existing, update);
      } else {
        items.push(update);
      }
    }
  }

  if (items.length > 0) {
    updateData.items = items;
  }

  return updateData;
};

/**
* Handles search of the Compendiums to find the item
* @param {Item|String} item  Either an ID or an Item to find in the compendium
* @returns {Item}     The Item, if found
*/
/* One index per pack, for the length of one migration run: migrateActorData is called once per
   actor and compendiumActionType once per item, so without it a party of six would re-read the
   same pack index a hundred times.

   Cleared at the start of every run rather than left to live as long as the module, so a GM who
   edits a compendium and migrates again in the same session gets the value they just wrote
   rather than the one cached before their edit. */
const actionTypeIndexCache = new Map();

/**
 * Drops the cached pack indexes. Called at the start of a migration run, and by tests, which
 * would otherwise see one test's fixture through another test's lookup.
 */
export function resetMigrationCaches() {
  actionTypeIndexCache.clear();
}

/**
 * The action cost the compendium currently gives the item this one was dragged from.
 *
 * Embedded items are snapshots: whatever the compendium said the day they were dropped onto a
 * character is what they still say. When a pass adds an action cost to ~280 Perks, every
 * character built before it keeps a copy that costs nothing - so the Perk sits in the Actions
 * tab's "no cost" section forever while the compendium's own copy has said Standard for months.
 * Takedown was the one that surfaced this; it is not remotely alone.
 *
 * Returns null when there is nothing to compare against - no source id, a pack that is not
 * present (a game line the world does not use), or an entry since deleted.
 *
 * @param {Object} item   An item document or its source data.
 * @returns {Promise<String|null>}
 */
async function compendiumActionType(item) {
  const source = item._stats?.compendiumSource ?? item.flags?.core?.sourceId ?? item?.flags?.essence20?.rulesSource;
  if (!source?.startsWith('Compendium.essence20.')) {
    return null;
  }

  return (await compendiumEntryAt(source))?.system?.actionType ?? null;
}

/**
 * A compendium item's index entry (with its action cost and its rules), from the cached pack index.
 * Null when there is nothing to read - not a compendium uuid, a pack that is not present, or an
 * entry since deleted.
 * @param {String} source   Compendium.<package>.<pack>.Item.<id>
 * @returns {Promise<Object|null>}
 */
async function compendiumEntryAt(source) {
  if (!source?.startsWith?.('Compendium.')) {
    return null;
  }

  const [, scope, packName, , id] = source.split('.');
  if (!scope || !packName || !id) {
    return null;
  }

  const key = `${scope}.${packName}`;
  if (!actionTypeIndexCache.has(key)) {
    const pack = game.packs.get(key);
    actionTypeIndexCache.set(key, pack ? await pack.getIndex({ fields: ['system.actionType', 'system.rules'] }) : null);
  }

  return actionTypeIndexCache.get(key)?.get(id) ?? null;
}

export async function searchCompendium(item) {
  const id = item._id || item;
  for (const pack of game.packs) {
    const compendium = game.packs.get(`essence20.${pack.metadata.name}`);
    if (compendium) {
      const compendiumItem = await fromUuid(`Compendium.essence20.${pack.metadata.name}.${id}`);
      if (compendiumItem) {
        return compendiumItem;
      }
    }
  }
}

/**
* Gets an Item from an Id
* @param {Item|String} perkId The id from the parentItem
* @param {object} actor The actor that has the items that are getting updated.
* @returns {Item} attachedItem  The Item, if found
*/
export async function getItem(perkId, actor) {
  let attachedItem = await fromUuid(`Item.${perkId}`);
  if (!attachedItem) {
    attachedItem = await searchCompendium(perkId);
  }

  if (!attachedItem && actor) {
    attachedItem = await actor.items.get(perkId);
  }

  return attachedItem;
}

/**
* Migrate a single Item document to incorporate latest data model changes
*
* @param {object} item             Item data to migrate
* @param {object} [actor]          The actor owning it, when it is an embedded item
* @param {object} [options]        {inPack}: the item lives in a compendium (its rules are its own, never inherited)
* @returns {object}                The updateData to apply
*/
export async function migrateItemData(item, actor, options = {}) {
  const updateData = {};
  const pathPrefix = "system.items";

  // Spell and magicBauble duration free text -> structured {units, value, text}. See
  // module/data/duration-schema.mjs for why this stopped being a plain string. Guarded on the old
  // value actually still BEING a string, so this is a no-op once migrated (the new value is an
  // object) and can't re-parse its own output.
  if (["spell", "magicBauble"].includes(item.type) && typeof item.system?.duration == "string") {
    updateData["system.duration"] = parseDurationString(item.system.duration);
  }

  /* An embedded item whose compendium original has since been given an action cost.

     Only ever `none` -> something. An embedded value that is already set is left alone, because
     that is either a cost this migration has already applied or one a GM chose deliberately, and
     there is no way to tell those apart - whereas `none` is this system's own word for "nobody
     has said yet" (see data/item/templates/activation.mjs), which is exactly what a stale
     snapshot is. Measured before building this: of 149 embedded compendium items in the dev
     world, 18 had drifted and every single one was `none` -> something. Not one was a GM
     disagreeing with the book.

     Value-matched rather than version-gated, same as the migrations below it, and for the same
     reason: this repo ships an unsubstituted `version` string, so worlds exist whose recorded
     migration version a gate would skip forever. Once a field is corrected it no longer matches,
     so this can only fire once per item.

     Deliberately runs for every item type carrying the activation template, not just Perks -
     the same drift hit Spells and Powers in the dev world. */
  if ((item.system?.actionType ?? 'none') == 'none') {
    const authored = await compendiumActionType(item);
    if (authored && authored != 'none') {
      updateData["system.actionType"] = authored;
    }
  }

  /* Weapon effects born with no action cost -> Standard.

     Making an attack is the Attack action, which is a Standard action, and the weapon effect is
     what carries that cost because the weapon effect is what rolls - a weapon has no roll button
     at all. All 676 compendium weapon effects already store `standard`; this is for the ones a GM
     made by hand on an actor, which were born as None under the old schema default and so cost
     nothing however many times they were fired.

     Matched on the old value rather than overwritten wholesale, so this is a no-op the second
     time it runs and an effect already carrying a cost is left alone. It is deliberately NOT
     version-gated, for the reason spelled out on the Zord defenses migration below: this repo
     ships an unsubstituted `version` string, so worlds exist whose recorded migration version is
     not parseable and which a gate would skip forever. The value match gives the run-once
     property a gate would.

     The cost of getting this wrong is one field on an effect a GM had deliberately set to None,
     reset once, and visible on the item's own sheet - against every hand-made weapon silently
     costing nothing for as long as the world lives. */
  /* The compendium answer above wins where there is one - a pack effect already says what it
     costs. This is the fallback for the effect with no compendium original at all, which is the
     case it was written for. */
  if (item.type == "weaponEffect" && (item.system?.actionType ?? 'none') == 'none'
    && !updateData["system.actionType"]) {
    updateData["system.actionType"] = "standard";
  }

  // Area of Effect shape "burst" -> "circle". The shape field originally shipped with a
  // system-flavoured vocabulary of its own; it now stores Foundry's own region shape type names so
  // the value can be handed straight to canvas.regions.placeRegion() with no translation table
  // (see module/data/aoe-schema.mjs). No compendium content ever used "burst", so this only
  // catches weaponEffects a user authored in their own world between the two.
  if (item.system?.shape == "burst") {
    updateData["system.shape"] = "circle";
  }

  if (item.type == "armor") {
    // Armor trait -> traits migration
    const trait = item.system.trait;
    if (trait && !item.system.traits[trait]) {
      updateData[`system.traits`] = [trait];
    }

    // Armor traits string->bool object -> string list migration
    const traits = item.system.traits;
    if (traits && traits.constructor == Object) {
      const traitsArray = [];
      for (let [trait, traitIsEnabled] of Object.entries(traits)) {
        if (traitIsEnabled) {
          traitsArray.push(trait);
        }
      }

      updateData[`system.traits`] = traitsArray;
    }

    // Armor effect -> bonusToughness migration
    const effect = item.system.effect;
    if (effect && !item.system.bonusToughness) {
      updateData[`system.bonusToughness`] = effect;
    }

    //Armor Upgrade Migration to system.items
    if (item.system.upgradeIds) {
      for (const perkId of item.system.upgradeIds) {
        const attachedItem = await getItem(perkId, actor);
        if (attachedItem) {
          attachedItem.setFlag('essence20', 'parentId', item.uuid);

          if (attachedItem.armorBonus) {
            if (attachedItem.armorBonus.defense == 'toughness') {
              const originalArmorBonus = item.system.bonusToughness - attachedItem.armorBonus.value;
              updateData[`system.bonusToughness`] = originalArmorBonus;
            } else if (attachedItem.armorBonus.defense == 'evasion') {
              const originalArmorBonus = item.system.bonusEvasion - attachedItem.armorBonus.value;
              updateData[`system.bonusEvasion`] = originalArmorBonus;
            }
          }

          const entry = {
            uuid: attachedItem.uuid,
            img: attachedItem.img,
            name: attachedItem.name,
            type: attachedItem.type,
            armorBonus: attachedItem.system.armorBonus,
            availability: attachedItem.system.availability,
            benefit: attachedItem.system.benefit,
            description: attachedItem.system.description,
            prerequisite: attachedItem.system.prerequisite,
            source: attachedItem.system.source,
            subtype: attachedItem.system.type,
            traits: attachedItem.system.traits,
          };
          const id = await createId(item.system.items);
          updateData[`${pathPrefix}.${id}`] = entry;
        }
      }

      if (item.system.upgradeTraits) {
        let keptTraits = item.system.traits;
        for (const removedTrait of item.system.upgradeTraits) {
          keptTraits.filter(x => x !== removedTrait);
        }

        updateData[`system.traits`] = keptTraits;
      }
    }
  } else if (item.type == "perk") {
    if (item.system.perkType) {
      const perkType = item.system.perkType;
      updateData[`system.type`] = perkType;
    }
  } else if (item.type == 'origin') {
    if (item.system.originPerkIds) {
      for (const perkId of item.system.originPerkIds) {
        const attachedItem = await getItem(perkId, actor);
        if (attachedItem) {
          const entry = {
            uuid: attachedItem.uuid,
            img: attachedItem.img,
            name: attachedItem.name,
            type: attachedItem.type,
          };
          const id = await createId(item.system.items);
          updateData[`${pathPrefix}.${id}`] = entry;
        }
      }
    }

  } else if (item.type == 'influence') {
    if (item.system.perkIds) {
      for (const perkId of item.system.perkIds) {
        const attachedItem = await getItem(perkId, actor);
        if (attachedItem) {
          const entry = {
            uuid: attachedItem.uuid,
            img: attachedItem.img,
            name: attachedItem.name,
            type: attachedItem.type,
          };
          const id = await createId(item.system.items);
          updateData[`${pathPrefix}.${id}`] = entry;
        }
      }
    }

    if (item.system.hangUpIds) {
      for (const perkId of item.system.hangUpIds) {
        const attachedItem = await getItem(perkId, actor);
        if (attachedItem) {
          const entry = {
            uuid: attachedItem.uuid,
            img: attachedItem.img,
            name: attachedItem.name,
            type: attachedItem.type,
          };
          const id = await createId(item.system.items);
          updateData[`${pathPrefix}.${id}`] = entry;
        }
      }
    }
  } else if (item.type == 'weapon') {
    if (item.system.upgradeIds) {
      for (const perkId of item.system.upgradeIds) {
        const attachedItem = await getItem(perkId, actor);
        if (attachedItem) {
          attachedItem.setFlag('essence20', 'parentId', item.uuid);

          const entry = {
            uuid: attachedItem.uuid,
            img: attachedItem.img,
            name: attachedItem.name,
            type: attachedItem.type,
            availability: attachedItem.system.availability,
            benefit: attachedItem.system.benefit,
            description: attachedItem.system.description,
            prerequisite: attachedItem.system.prerequisite,
            source: attachedItem.system.source,
            subtype: attachedItem.system.type,
            traits: attachedItem.system.traits,
          };
          const id = await createId(item.system.items);
          updateData[`${pathPrefix}.${id}`] = entry;
        }
      }

      if (item.system.upgradeTraits) {
        let keptTraits = item.system.traits;
        for (const removedTrait of item.system.upgradeTraits) {
          keptTraits.filter(x => x !== removedTrait);
        }

        updateData[`system.traits`] = keptTraits;
      }
    }

    if (item.system.weaponEffectIds) {
      for (const perkId of item.system.weaponEffectIds) {
        const attachedItem = await getItem(perkId, actor);
        if (attachedItem) {
          attachedItem.setFlag('essence20', 'parentId', item.uuid);

          const entry = {
            uuid: attachedItem.uuid,
            img: attachedItem.img,
            name: attachedItem.name,
            type: attachedItem.type,
            classification: attachedItem.system.classification,
            damageValue: attachedItem.system.damageValue,
            damageType: attachedItem.system.damageType,
            numHands: attachedItem.system.numHands,
            numTargets: attachedItem.system.numTargets,
            radius: attachedItem.system.radius,
            range: attachedItem.system.range,
            shiftDown: attachedItem.system.shiftDown,
            traits: attachedItem.system.traits,
          };
          const id = await createId(item.system.items);
          updateData[`${pathPrefix}.${id}`] = entry;
        }
      }
    }

    // Legacy transformerMode enum -> structured Hardpoint (TF CRB p.114). Mirrors
    // WeaponItemData.migrateData(), but written through to the database so it persists.
    if (item.system.transformerMode && !item.system.hardpoint?.type) {
      const legacyModeToHardpoint = {
        modeBotMode: { type: 'external' },
        modeAltMode: { type: 'integrated', altModeVisibility: 'hidden' },
        modeAny: { type: 'integrated', altModeVisibility: 'obvious' },
      };
      const mapped = legacyModeToHardpoint[item.system.transformerMode];
      if (mapped) {
        updateData['system.hardpoint.type'] = mapped.type;
        if (mapped.altModeVisibility) {
          updateData['system.hardpoint.altModeVisibility'] = mapped.altModeVisibility;
        }
      }
    }
  }

  // Details-tab fields moved into rules (2026-10-07) - see migrateDetailsFields below. An embedded
  // Perk's `value` is moved by migrateActorData, which also takes it back out of the actor's data.
  Object.assign(updateData, await migrateDetailsFields(item, {
    inPack: options.inPack ?? !!item.pack,
    perkValue: !actor,
  }));

  // The typed prerequisite text retired (2026-10-07) - see migratePrerequisiteText below.
  migratePrerequisiteText(item, { update: updateData });

  // Compendium items moved to another pack (2026-10-07) - see migrateMovedItemSources below.
  migrateMovedItemSources(item, { update: updateData });

  // Perk choice P2: a world / compendium item's old pick into its rules choice (migratePerkChoiceItem below). An
  // embedded one is migrated with its actor (migrateActorData), which also takes the baked value off.
  if (!actor) {
    const choices = await migratePerkChoiceItem(item, null, { inPack: options.inPack ?? !!item.pack });
    if (updateData['system.rules'] !== undefined) {
      delete choices['system.rules'];
    }

    Object.assign(updateData, choices);
  }

  return updateData;
}

/**
 * Apply migration rules to all Documents within a single Compendium pack
 * @param {CompendiumCollection} pack  Pack to be migrated.
 * @returns {Promise}
 */
export const migrateCompendium = async function(pack) {
  const documentName = pack.documentName;
  if ( !["Actor", "Item", "Scene"].includes(documentName) ) return;

  // Unlock the pack for editing
  const wasLocked = pack.locked;
  await pack.configure({locked: false});

  // Begin by requesting server-side data model migration and get the migrated content
  await pack.migrate();
  const documents = await pack.getDocuments();

  // Iterate over compendium entries - applying fine-tuned migration functions
  for ( let doc of documents ) {
    let updateData = {};
    try {
      switch (documentName) {
      case "Actor":
        updateData = await migrateActorData(doc.toObject(), doc);
        break;
      case "Item":
        updateData = await migrateItemData(doc.toObject(), undefined, { inPack: true });
        if (doc.type == "origin") {
          await doc.update({"system.-=originPerkIds": null});
        } else if (doc.type == "influence") {
          await doc.update({"system.-=perkIds": null});
          await doc.update({"system.-=hangUpIds": null});
        } else if (doc.type == "weapon") {
          await doc.update({"system.-=upgradeIds": null});
          await doc.update({"system.-=weaponEffectIds": null});
        } else if (doc.type =="armor") {
          await doc.update({"system.-=upgradeIds": null});
        }

        break;
      case "Scene":
        // updateData = migrateSceneData(doc.toObject());
        break;
      }

      // Save the entry, if data was changed
      if ( foundry.utils.isEmpty(updateData) ) {
        if (documentName == "Actor") await migrateActorPerkChoices(doc, { inPack: true });
        continue;
      }

      await doc.update(updateData);
      // Perk choice P2: the multi-Skill Perks' copies folded (migrateActorPerkChoices).
      if (documentName == "Actor") await migrateActorPerkChoices(doc, { inPack: true });
      console.log(`Migrated ${documentName} document ${doc.name} in Compendium ${pack.collection}`);
    } catch(err) { // Handle migration failures
      err.message = `Failed essence20 system migration for document ${doc.name} in pack ${pack.collection}: ${err.message}`;
      console.error(err);
    }
  }

  // Apply the original locked status for the pack
  await pack.configure({locked: wasLocked});
  console.log(`Migrated all ${documentName} documents from Compendium ${pack.collection}`);
};

/* -------------------------------------------- */
/*  Details-tab fields moved into rules          */
/* -------------------------------------------- */

/* 2026-10-07 (docs/rules-batches/details-cleanup.md). Five item fields stopped being authored on the
   item sheet's Details tab: a Perk's canActivate (read by nothing), a Perk's or Power's reroll block,
   a Perk's hasMorphedToughnessBonus and value, and a weapon Upgrade's aimShiftBonus. The compendium
   items carry rules for them now; these functions give world and actor copies the same rules and
   delete the old stored value. The schema fields themselves stay until 6.1.

   Value-matched like the migrations above, never version-gated: each one fires only while the old
   field still holds a value the drop / sheet wrote, and deletes it as it goes, so a second run finds
   nothing to do. A rule is added only when the item's rules don't already have one of its kind
   (matched by type and its settings, never by position), so a re-run can't add it twice.

   Rules and inheritance (rules/inherit.mjs): a copy of a compendium item with no rules of its own
   runs its original's rules, live. Such a copy is left alone when its original already has the rule
   (the compendium is updated in the same release). When the original lacks it (a module or world
   pack's copy, a pack not rebuilt yet), the copy is given the original's rules plus the new one as
   its own - adding just the new rule would stop it inheriting the rest. */

const COMPENDIUM_EMOTIONAL_MASTERY = 'Compendium.essence20.jump_through_time.Item.bWAncoQxwfCLtn2v';
const COMPENDIUM_LUCKY_CHARM = 'Compendium.essence20.finster_s_monster_matic_cookbook.Item.Rv3Bhyeo4XBxHLpX';
const COMPENDIUM_FUTURE_VISION = 'Compendium.essence20.jump_through_time.Item.z9ZMxCd5DZDHlDYL';

/* Items whose system.reroll was switched on in play rather than authored: Emotional Mastery's Guilt
   (now a reroll grant read from the active options - items/resources/emotional-mastery.mjs), Lucky
   Charm's and Future Vision's Use (their Reroll rules now wait for a rule toggle). Their reroll is
   state, not a setting: it becomes that state, never a rule of its own. */
const REROLL_STATE = {
  [COMPENDIUM_EMOTIONAL_MASTERY]: () => ({}),
  [COMPENDIUM_LUCKY_CHARM]: () => ({ 'flags.essence20.rules.toggles.luckyCharm': true }),
  [COMPENDIUM_FUTURE_VISION]: reroll => ({
    'flags.essence20.rules.toggles.futureVision': true,
    'flags.essence20.futureVisionUses': Number(reroll.maxUses) || 0,
  }),
};

/** The item's stored system data - a document's source, or the source object itself. */
function storedSystem(item) {
  return (item?._source ?? item)?.system ?? {};
}

/** Where a copy's rules come from (rules/inherit.mjs#rulesSourceOf). */
function rulesSourceUuid(item) {
  return item?.flags?.essence20?.rulesSource ?? item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? null;
}

/**
 * Deletes a stored key. v14's ForcedDeletion operator does it; the older "-=key" form is deprecated
 * there and no longer applied, so it is only the fallback for a Foundry without the operator.
 * @param {Object} update
 * @param {String} path
 */
function unset(update, path, item = null) {
  // A field still in the data model (kept until 6.1) can't be deleted - v14 rejects the update ("may not be
  // undefined", live test 2026-10-07) - so it goes back to its default instead; 6.1 drops the field itself.
  const field = path.startsWith('system.') ? item?.system?.schema?.getField?.(path.slice(7)) : null;
  if (path in RESET_TO) {
    update[path] = typeof RESET_TO[path] == 'function' ? RESET_TO[path](field) : RESET_TO[path];
    return;
  }

  const ForcedDeletion = globalThis.foundry?.data?.operators?.ForcedDeletion;
  if (ForcedDeletion) {
    update[path] = new ForcedDeletion();
    return;
  }

  const dot = path.lastIndexOf('.');
  update[`${path.slice(0, dot)}.-=${path.slice(dot + 1)}`] = null;
}

/** The deprecated Details fields' defaults (the data models), set in place of a deletion until 6.1. */
const RESET_TO = {
  'system.canActivate': false,
  'system.hasMorphedToughnessBonus': false,
  'system.value': 0,
  'system.aimShiftBonus': 0,
  // The old Perk / Hang-Up picker (Perk choice P2 - deprecated until 6.1).
  'system.hasChoice': false,
  // A Perk's, Power's or Upgrade's old typed prerequisite text (makeStr(null): nullable, initial null).
  'system.prerequisite': field => field?.initial ?? null,
  // The whole reroll block back to its initial value (switched off) - the schema's own default when there is one.
  'system.reroll': field => field?.getInitialValue?.({}) ?? { enabled: false },
};

/**
 * The rules this item runs today: its own, or its compendium original's when it has none of its own
 * and isn't in a pack (rules/inherit.mjs#inheritedRules).
 * @returns {Promise<Array<Object>>}
 */
async function effectiveRules(item, inPack) {
  const own = storedSystem(item).rules;
  if (Array.isArray(own) && own.length) {
    return own;
  }

  if (!inPack) {
    const original = (await compendiumEntryAt(rulesSourceUuid(item)))?.system?.rules;
    if (Array.isArray(original) && original.length) {
      return original;
    }
  }

  return [];
}

/**
 * Adds the wanted rules the item doesn't have yet to update['system.rules'].
 * @param {Object} update   The item's pending update; its system.rules, when set, is the starting point.
 * @param {Object} item
 * @param {Array<{rule: Object, has: Function}>} wanted   has(rule): an existing rule already doing this.
 * @param {Boolean} inPack
 */
async function addRules(update, item, wanted, inPack) {
  const current = update['system.rules'] ?? await effectiveRules(item, inPack);
  const missing = wanted.filter(({ has }) => !current.some(rule => rule && has(rule))).map(({ rule }) => rule);
  if (missing.length) {
    update['system.rules'] = [...current, ...missing];
  }
}

const REROLL_DEFAULTS = {
  condition: 'none', essence: 'any', scopeToOriginSkill: false, recursive: true, minDieFaces: 0, grantsCanCritD2: false,
  bonus: 0, shiftUp: 0, keepBetter: false,
};

const REROLL_KEYS = ['mode', 'target', 'reset', 'maxUses', 'values', 'condition', 'skills', 'essence', 'scopeToOriginSkill',
  'recursive', 'minDieFaces', 'grantsCanCritD2', 'bonus', 'shiftUp', 'keepBetter'];

/** A reroll cost's set parts only, or null when it costs nothing. */
function rerollCost(cost) {
  const out = {};
  if (cost?.resourcePath) {
    out.resourcePath = cost.resourcePath;
  }

  for (const key of ['amount', 'worldStoryPoints']) {
    if (Number(cost?.[key])) {
      out[key] = Number(cost[key]);
    }
  }

  if (cost?.rolePointsName) {
    out.rolePointsName = cost.rolePointsName;
  }

  return Object.keys(out).length ? out : null;
}

/**
 * The Reroll rule (rules/types.mjs) that does what an item's system.reroll did in
 * mechanics/rolls/reroll.mjs#getRerollConfigs: the same settings, less the defaults
 * normalizeRerollConfig fills in anyway. A Perk with the `rerolls` advance type and no switched-on
 * reroll (Power Infusion) rerolled 1 to its advance value once per scene, with its reroll block's cost
 * and condition - the same rule with upTo.
 * @param {Object} system   The item's stored system data.
 * @returns {Object|null}
 */
export function legacyRerollRule(system) {
  const reroll = system?.reroll ?? {};
  if (reroll.enabled !== true) {
    if (system?.advances?.type != 'rerolls') {
      return null;
    }

    const cost = rerollCost(reroll.cost);
    return {
      type: 'Reroll', mode: 'all', target: 'allDice', reset: 'scene', maxUses: 1, upTo: '@item.system.advances.currentValue',
      ...(cost ? { cost } : {}),
      ...((reroll.condition ?? 'none') != 'none' ? { condition: reroll.condition } : {}),
    };
  }

  const rule = { type: 'Reroll' };
  for (const key of REROLL_KEYS) {
    const value = reroll[key];
    if (value === undefined || value === null || value === '' || value === REROLL_DEFAULTS[key]
      || (Array.isArray(value) && !value.length)) {
      continue;
    }

    rule[key] = value;
  }

  const cost = rerollCost(reroll.cost);
  if (cost) {
    rule.cost = cost;
  }

  return rule;
}

/** Whether a system.reroll still holds something the item used to run on. */
function hasLegacyReroll(system) {
  const reroll = system?.reroll;
  if (!reroll) {
    return false;
  }

  return reroll.enabled === true
    || (system.advances?.type == 'rerolls' && (!!rerollCost(reroll.cost) || (reroll.condition ?? 'none') != 'none'));
}

/** The Morphed Toughness bonus a hasMorphedToughnessBonus Perk set on its drop and took off on its delete. */
export const MORPHED_TOUGHNESS_RULES = [
  {
    rule: { type: 'Trigger', event: 'added', label: 'Morphed Toughness from Armor Training', steps: [{ do: 'refreshMorphedToughness' }] },
    has: rule => rule.type == 'Trigger' && rule.event == 'added' && (rule.steps ?? []).some(step => step?.do == 'refreshMorphedToughness'),
  },
  {
    rule: {
      type: 'Trigger', event: 'removed', label: 'Morphed Toughness off',
      steps: [{ do: 'updateActor', set: { 'system.canSetToughnessBonus': false, 'system.defenses.toughness.morphed': 0 } }],
    },
    has: rule => rule.type == 'Trigger' && rule.event == 'removed'
      && (rule.steps ?? []).some(step => step?.do == 'updateActor' && step.set?.['system.canSetToughnessBonus'] === false),
  },
];

const MOVEMENT_TYPES = ['aerial', 'burrow', 'climb', 'ground', 'swim'];

/**
 * The rules for a Perk's value (choiceType movement: +value ft to the picked Movement's bonus; skills:
 * +value upshifts on the picked Skill), for copies flagged perkValueRule only - a copy dropped before
 * this had the value written straight into its actor instead (sheet-handlers/perk-handler.mjs).
 * @param {String} choiceType
 * @param {Number} value
 * @returns {Array<{rule: Object, has: Function}>}
 */
export function perkValueRules(choiceType, value) {
  const flagged = 'rule:data:flags.essence20.perkValueRule';
  if (choiceType == 'movement') {
    return MOVEMENT_TYPES.map(movement => ({
      rule: {
        type: 'Movement', label: `+${value} ft ${movement}`, movement, stage: 'bonus', op: 'add', value,
        when: [`rule:data:system.choice=${movement}`, flagged],
      },
      has: rule => rule.type == 'Movement' && rule.stage == 'bonus' && rule.movement == movement,
    }));
  }

  if (choiceType == 'skills') {
    return [{
      rule: { type: 'DerivedStat', label: `Up ${value} on the picked Skill`, path: 'system.skills.{item.choice}.shiftUp', op: 'add', value, when: [flagged] },
      // The converted pack rule reads the ChoiceSet's {choice.skill} (Perk choice P2) - the same rule.
      has: rule => rule.type == 'DerivedStat' && /^system\.skills\.\{(item\.choice|choice\.skill)\}\.shiftUp$/.test(String(rule.path ?? '')),
    }];
  }

  return [];
}

/**
 * A Perk's canActivate: nothing reads it for a Perk (the Use rule gives a Perk its button), so the
 * stored value goes.
 * @param {Object} item
 * @returns {Object}   Update data.
 */
export function migratePerkCanActivate(item) {
  const update = {};
  if (item?.type == 'perk' && storedSystem(item).canActivate === true) {
    unset(update, 'system.canActivate', item);
  }

  return update;
}

/**
 * A Perk's or Power's system.reroll -> a Reroll rule (legacyRerollRule), unless the item already has
 * one; the run-time-switched ones (REROLL_STATE) keep their state instead.
 * @param {Object} item
 * @param {Object} [options]   {inPack, update}: update is the item's pending update (its system.rules is built on).
 * @returns {Promise<Object>}   Update data.
 */
export async function migrateRerollFields(item, { inPack = false, update = {} } = {}) {
  if (!['perk', 'power'].includes(item?.type)) {
    return update;
  }

  const system = storedSystem(item);
  const state = REROLL_STATE[rulesSourceUuid(item)];
  if (state) {
    if (system.reroll?.enabled === true) {
      Object.assign(update, state(system.reroll));
      unset(update, 'system.reroll', item);
    }

    return update;
  }

  const rule = legacyRerollRule(system);
  if (rule) {
    await addRules(update, item, [{ rule, has: other => other.type == 'Reroll' && (other.scope ?? 'self') == 'self' }], inPack);
  }

  if (hasLegacyReroll(system)) {
    unset(update, 'system.reroll', item);
  }

  return update;
}

/**
 * A Perk's hasMorphedToughnessBonus -> its added / removed Triggers (MORPHED_TOUGHNESS_RULES).
 * @returns {Promise<Object>}   Update data.
 */
export async function migrateMorphedToughness(item, { inPack = false, update = {} } = {}) {
  if (item?.type != 'perk' || storedSystem(item).hasMorphedToughnessBonus !== true) {
    return update;
  }

  await addRules(update, item, MORPHED_TOUGHNESS_RULES, inPack);
  unset(update, 'system.hasMorphedToughnessBonus', item);
  return update;
}

/**
 * A weapon Upgrade's aimShiftBonus -> an AimBonus rule on the weapon it's attached to (scope host).
 * @returns {Promise<Object>}   Update data.
 */
export async function migrateUpgradeAimBonus(item, { inPack = false, update = {} } = {}) {
  const value = Number(storedSystem(item).aimShiftBonus) || 0;
  if (item?.type != 'upgrade' || !value) {
    return update;
  }

  await addRules(update, item, [{
    rule: { type: 'AimBonus', label: `Aim +${value}`, scope: 'host', extra: value },
    has: rule => rule.type == 'AimBonus' && rule.scope == 'host',
  }], inPack);
  unset(update, 'system.aimShiftBonus', item);
  return update;
}

/**
 * A weapon's attachment entries (system.items.<id>) used to carry a snapshot of the upgrade's aimShiftBonus
 * (attachment-handler.mjs, before 2026-10-07). Nothing reads it any more, so the key goes. The entries are an
 * ObjectField's contents, not schema fields, so ForcedDeletion really deletes the key here (unlike the Details
 * fields above, which the data model still has). Value-matched: only an entry that still has the key is touched.
 * @returns {Object}   Update data.
 */
export function migrateWeaponEntryAimBonus(item, { update = {} } = {}) {
  const entries = storedSystem(item).items;
  if (item?.type != 'weapon' || !entries || typeof entries != 'object') {
    return update;
  }

  for (const [id, entry] of Object.entries(entries)) {
    if (entry && typeof entry == 'object' && Object.hasOwn(entry, 'aimShiftBonus')) {
      unset(update, `system.items.${id}.aimShiftBonus`);
    }
  }

  return update;
}

/**
 * A Perk's value (Fast: +10 ft to a picked Movement; GI Joe Expertise: up 2 on a picked Skill) -> its
 * rules (perkValueRules), and the copy flagged perkValueRule so they apply to it. Its drop wrote the
 * value straight into the actor (system.movement.<pick>.bonus / system.skills.<pick>.shiftUp), so on
 * an actor that much comes back off (never below 0), or the rule would count it twice.
 *
 * Value-matched: a flagged copy is done, and the value is deleted as it goes.
 * @param {Object} item
 * @param {Object} [options]   {inPack, rules: the item's pending system.rules, actorSystem: the owning
 *   actor's stored system data (for an embedded copy), totals: running values of the actor fields already
 *   changed this pass, shared across its items}
 * @returns {Promise<{update: Object, actorUpdate: Object}>}
 */
export async function migratePerkValue(item, { inPack = false, rules, actorSystem = null, totals = {} } = {}) {
  const result = { update: {}, actorUpdate: {} };
  const system = storedSystem(item);
  const value = Number(system.value) || 0;
  if (item?.type != 'perk' || !['movement', 'skills'].includes(system.choiceType) || !value
    || item.flags?.essence20?.perkValueRule) {
    return result;
  }

  const update = rules ? { 'system.rules': rules } : {};
  await addRules(update, item, perkValueRules(system.choiceType, value), inPack);
  if (update['system.rules'] === rules) {
    delete update['system.rules'];
  }

  update['flags.essence20.perkValueRule'] = true;
  unset(update, 'system.value', item);
  result.update = update;

  // The pick the drop baked into the actor: the old picker's value (rules/choice-read.mjs#legacyChoiceOf), from stored data.
  const choice = legacyChoiceOf({ system, flags: (item?._source ?? item)?.flags });
  if (actorSystem && choice) {
    const path = system.choiceType == 'movement' ? `system.movement.${choice}.bonus` : `system.skills.${choice}.shiftUp`;
    const stored = path.split('.').slice(1).reduce((at, key) => at?.[key], actorSystem);
    if (stored !== undefined) {
      const current = totals[path] ?? (Number(stored) || 0);
      totals[path] = Math.max(0, current - value);
      result.actorUpdate[path] = totals[path];
    }
  }

  return result;
}

/**
 * Every Details-tab field above, on one item (migrateItemData). Embedded Perks' value is moved by
 * migrateActorData instead (perkValue false), since it changes the actor too.
 * @param {Object} item
 * @param {Object} [options]   {inPack, perkValue}
 * @returns {Promise<Object>}   Update data.
 */
export async function migrateDetailsFields(item, { inPack = false, perkValue = true } = {}) {
  const update = migratePerkCanActivate(item);
  await migrateRerollFields(item, { inPack, update });
  await migrateMorphedToughness(item, { inPack, update });
  await migrateUpgradeAimBonus(item, { inPack, update });
  migrateWeaponEntryAimBonus(item, { update });
  if (perkValue) {
    const moved = await migratePerkValue(item, { inPack, rules: update['system.rules'] });
    Object.assign(update, moved.update);
  }

  return update;
}

/* -------------------------------------------- */
/*  Compendium items moved to another pack       */
/* -------------------------------------------- */

/**
 * Items that moved pack with their _id kept (item-lookups.mjs#MOVED_ITEM_UUIDS - the A Jump Through Time Spectrum
 * Modification Perks out of the PR core pack, the PR Pre Gen weapons into their own pack; 2026-10-07,
 * docs/rules-batches/pr-followups.md). A copy's source fields (flags.core.sourceId, _stats.compendiumSource,
 * flags.essence20.rulesSource), any item's system.items entries (a copied Role's level list, a weapon's effects) and
 * its rules picks (flags.essence20.rules.choices - a pickSubPerk's uuid list) that name an old uuid get the new one.
 * Value-matched: only an old uuid is rewritten, so a second run finds nothing to do.
 * @param {Object} item   A document or its plain data.
 * @param {Object} [options]   {update: update data to add to}
 * @returns {Object}   Update data.
 */
export function migrateMovedItemSources(item, { update = {} } = {}) {
  const data = item?._source ?? item ?? {};
  const at = path => path.split('.').reduce((value, key) => (value === null || value === undefined ? value : value[key]), data);
  const moved = uuid => (typeof uuid == 'string' && MOVED_ITEM_UUIDS[uuid]) || null;
  for (const path of ['flags.core.sourceId', '_stats.compendiumSource', 'flags.essence20.rulesSource']) {
    const to = moved(at(path));
    if (to) {
      update[path] = to;
    }
  }

  const entries = at('system.items');
  for (const [key, entry] of Object.entries(entries && typeof entries == 'object' ? entries : {})) {
    const to = moved(entry?.uuid);
    if (to) {
      update[`system.items.${key}.uuid`] = to;
    }
  }

  const choices = at('flags.essence20.rules.choices');
  for (const [key, value] of Object.entries(choices && typeof choices == 'object' ? choices : {})) {
    if (Array.isArray(value) ? value.some(moved) : moved(value)) {
      update[`flags.essence20.rules.choices.${key}`] = Array.isArray(value) ? value.map(entry => moved(entry) ?? entry) : moved(value);
    }
  }

  return update;
}

/* -------------------------------------------- */
/*  Typed prerequisite text retired              */
/* -------------------------------------------- */

/* Compendium items whose old text was a note, not a prerequisite: a copy's text just goes, no `ask:` tag.
   Welcome to Night Vale's Acute Senses (Citizens' Guide) - its text described its own choice. */
const NOT_A_PREREQUISITE = new Set(['Compendium.essence20.wtnv_citizens_guide.Item.ygxNBnUhFIfqg349']);

/** The longest old prerequisite text kept as an `ask:` tag; longer text is cut at a word with an ellipsis. */
export const PREREQUISITE_ASK_MAX = 200;

/**
 * An item's old typed `system.prerequisite` text (2026-10-07, docs/rules-batches/prereq-text-retired.md).
 * Prerequisites are shown from their `system.prerequisites.when` tags now. An item with text and no tags
 * keeps it as one `ask:<text>` tag (a GM question: never blocks, the GM is told); then the text goes back
 * to the schema's default - not deleted, the field stays in the data model until 6.1 (see unset).
 *
 * Value-matched: it fires only while the text is a non-empty string, and empties it as it goes, so a
 * second run finds nothing to do. An item that already has tags is never given another.
 * @param {Object} item
 * @param {Object} [options]   {update: update data to add to}
 * @returns {Object}   Update data.
 */
export function migratePrerequisiteText(item, { update = {} } = {}) {
  const system = storedSystem(item);
  if (typeof system.prerequisite != 'string' || system.prerequisite === '') {
    return update;
  }

  const text = system.prerequisite.replace(/\s+/g, ' ').trim();
  const prerequisites = system.prerequisites && typeof system.prerequisites == 'object' ? system.prerequisites : {};
  const when = Array.isArray(prerequisites.when) ? prerequisites.when : [];
  if (text && !when.length && !NOT_A_PREREQUISITE.has(rulesSourceUuid(item))) {
    update['system.prerequisites'] = { ...prerequisites, when: [`ask:${clipAsk(text)}`] };
  }

  unset(update, 'system.prerequisite', item);
  return update;
}

function clipAsk(text) {
  if (text.length <= PREREQUISITE_ASK_MAX) {
    return text;
  }

  const cut = text.slice(0, PREREQUISITE_ASK_MAX - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > PREREQUISITE_ASK_MAX / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/* -------------------------------------------- */
/*  Perk choice P2: old picks -> rules choices   */
/* -------------------------------------------- */

/* docs/PERK_CHOICE_MIGRATION_PLAN.md §3. The 116 pack items that used the old Perk / Hang-Up picker (hasChoice,
   choiceType, system.choice) ask their pick through rules now: a ChoiceSet carrying `legacy: "system.choice"`, a Use
   rule's `pick` step carrying it (Favorite Weapon, Mode Attachment), or a pickSubPerk step in an `added` Trigger (the
   46 sub-Perk lists). A character's copy made before that keeps its old pick; this moves it over.

   - M1 copy: the old pick (system.choice, or the 6.1 legacyChoice flag) goes into flags.essence20.rules.choices.<key> -
     only into an empty slot, and only when it is one of the rule's option values (a list ChoiceSet gets a one-entry
     list). Anything else is left where it is and reported, so nothing is guessed. system.choice itself stays as a backup
     until 6.1 (the old fields stay in the data model, deprecated); hasChoice goes back to its default so the old picker
     never asks for the copy again.
   - M2 unbake: what the old picker wrote into the actor - an acute sense, an environment, All-Terrain Alt Mode's enabled
     Active Effect - comes back off once, since the rules derive it now. The actor change and the copy's
     flags.essence20.choiceMigration.unbaked go in ONE actor update, so it can't be undone twice. Fast's and GI Joe
     Expertise's baked value is the Details cleanup's migratePerkValue (reused, not redone).
   - Sub-Perk lists: the children already on the actor (flags.essence20.parentId) stay attached; their book uuids are
     recorded under the pickSubPerk key so the Rules tab shows them.
   - Fold: the multi-Skill Perks (a ChoiceSet with `count` - GI Joe Expertise, I've Done My Research, Low Tech
     Priorities) are ONE item holding a list (user decision 2026-10-07); the old picker made one copy per Skill. Copies of
     one grant (same book item, parent and collection key) are folded into the first: every picked value, no value twice,
     the other copies' rule state kept where the first has none; the rest are deleted after the update.

   Value-matched and idempotent: every step only fills what is missing or undoes what is still flagged as baked, so a
   second run does nothing. Run from migrateItemData (an item on its own) / migrateActorData (M1, M2, the sub-Perk record),
   and in full - fold included - by migrateActorPerkChoices, which migratePerkChoices runs (from migrateWorld) for every
   world actor, every unlinked token actor and every world item. */

/** A made pick: not undefined / null / '' / an empty list. */
const madePick = value => value !== undefined && value !== null && value !== '' && (!Array.isArray(value) || value.some(madePick));

/** A pick as a list of strings. */
const pickList = value => (Array.isArray(value) ? value : [value]).filter(madePick).map(String);

/** Every step in a step list, nested ones too. */
function stepsWithin(steps, out = []) {
  for (const step of Array.isArray(steps) ? steps : []) {
    out.push(step);
    for (const nested of [step?.steps, step?.onSuccess, step?.onFail, step?.onCrit, ...(Array.isArray(step?.options) ? step.options.map(o => o?.steps) : [])]) {
      stepsWithin(nested, out);
    }
  }

  return out;
}

/** Old values a converted pick takes besides its options, by book item id: Mode Attachment's Bot Mode. */
const EXTRA_LEGACY_VALUES = {
  SgofEgBVvg4josSR: { mode: ['botMode'] },
};

/** The rules picks of an item that carry the old system.choice over: [{rule, key, kind: 'set' | 'step'}]. */
function legacyChoicePicks(rules) {
  const picks = [];
  for (const rule of Array.isArray(rules) ? rules : []) {
    if (rule?.disabled) {
      continue;
    }

    if (rule?.type == 'ChoiceSet' && rule.key && rule.legacy == 'system.choice') {
      picks.push({ rule, key: rule.key, kind: 'set' });
    }

    for (const step of stepsWithin(rule?.steps)) {
      if (step?.key && step.legacy == 'system.choice' && !picks.some(pick => pick.key == step.key)) {
        picks.push({ rule: step, key: step.key, kind: 'step' });
      }
    }
  }

  return picks;
}

/** The pickSubPerk steps of an item's `added` Triggers. */
function subPerkSteps(rules) {
  return (Array.isArray(rules) ? rules : []).filter(rule => rule?.type == 'Trigger' && rule.event == 'added' && !rule.disabled)
    .flatMap(rule => stepsWithin(rule.steps)).filter(step => step?.do == 'pickSubPerk');
}

/** Whether an item's rules ask its pick through rules (converted from the old picker). */
function isConvertedPick(rules) {
  return legacyChoicePicks(rules).length > 0 || subPerkSteps(rules).length > 0;
}

/** A copy's own rules that are only what the Details cleanup wrote onto it (perkValueRules) - stale once its book item is converted. */
function onlyPerkValueRules(item) {
  const own = storedSystem(item).rules;
  const wanted = perkValueRules(storedSystem(item).choiceType, 1);
  return Array.isArray(own) && own.length > 0 && wanted.length > 0
    && own.every(rule => rule?.type == 'UniqueChoice' || wanted.some(({ has }) => has(rule)));
}

/**
 * The rules a copy runs for this migration: its prepared rules (a document's are its original's), else its own, else
 * its compendium original's. A copy whose own rules are only the Details cleanup's perkValueRules reads its original's
 * (and `reset` says so: its own rules go, so it inherits the converted ones).
 * @returns {Promise<{rules: Array, reset: Boolean}>}
 */
async function perkChoiceRulesOf(item, inPack = false) {
  if (!inPack && onlyPerkValueRules(item) && String(rulesSourceUuid(item) ?? '').startsWith('Compendium.')) {
    const original = (await compendiumEntryAt(rulesSourceUuid(item)))?.system?.rules;
    if (Array.isArray(original) && isConvertedPick(original)) {
      return { rules: original, reset: true };
    }
  }

  const prepared = item?._source ? item.system?.rules : null;
  if (Array.isArray(prepared) && prepared.length) {
    return { rules: prepared, reset: false };
  }

  return { rules: await effectiveRules(item, inPack), reset: false };
}

/** The book item id a copy came from (its 16-char compendium id), or ''. */
function bookIdOf(item) {
  return String(rulesSourceUuid(item) ?? '').split('.').pop();
}

/**
 * The values an old pick may take for one converted rule: a ChoiceSet's options (every one - held / notHeld left off),
 * a pick step's (an ownedItem pick: the actor's items of that type), plus EXTRA_LEGACY_VALUES.
 * @returns {Promise<Set<String>>}
 */
async function legacyOptionValues(pick, item, actor, rules) {
  const values = new Set(EXTRA_LEGACY_VALUES[bookIdOf(item)]?.[pick.key] ?? []);
  const view = { id: item?.id ?? item?._id, name: item?.name, type: item?.type, parent: actor, _stats: item?._stats, flags: (item?._source ?? item)?.flags ?? {}, system: { ...storedSystem(item), rules } };
  if (pick.kind == 'set') {
    const { choiceOptions } = await import("./rules/lifecycle.mjs");
    for (const option of choiceOptions(pick.rule, { actor, item: view, allOptions: true })) {
      values.add(String(option.value));
    }
  } else if (pick.rule.from == 'ownedItem') {
    for (const owned of [...(actor?.items ?? [])]) {
      if (!pick.rule.itemType || owned?.type == pick.rule.itemType) {
        values.add(String(owned?.id ?? owned?._id));
      }
    }
  } else {
    const { pickOptions } = await import("./rules/steps.mjs");
    try {
      for (const option of pickOptions(pick.rule, { actor, item: view, targets: [], vars: {}, chat: [], allOptions: true })) {
        values.add(String(option.value));
      }
    } catch (error) {
      // A source that needs a live run (targets, the canvas): nothing to match against - reported.
    }
  }

  return values;
}

/** A new, empty Perk choice report - or, during a migrateWorld run, the run's shared one (so the GM summary counts what
 *  the main actor pass did as well as the final sweep; live test 2026-10-07 showed 0s for work that had happened). */
export function perkChoiceReport() {
  return activePerkReport ?? { copied: [], recorded: [], unbaked: [], folded: [], unmatched: [], unpicked: [], clamped: [] };
}

/** The report shared across one migrateWorld run (null otherwise). */
let activePerkReport = null;

const reportLine = (actor, item, extra = {}) => ({ actor: actor?.name ?? '', item: item?.name ?? '', ...extra });

/**
 * M1 for one item: its old pick into the rules choices (value-matched, empty slots only), hasChoice back to its default.
 * Also the sub-Perk record when the actor is known. Pure apart from reading the compendium index.
 * @param {Object} item     A document or its source data.
 * @param {Actor|Object} [actor]   The owning actor (its items: an ownedItem pick's options, a sub-Perk's children).
 * @param {Object} [options]   {inPack, report, rules: the rules to read (default: perkChoiceRulesOf)}
 * @returns {Promise<Object>}   The item's update data.
 */
export async function migratePerkChoiceItem(item, actor = null, { inPack = false, report = perkChoiceReport(), rules: given = null } = {}) {
  const update = {};
  const source = item?._source ?? item;
  if (!['perk', 'hangUp'].includes(item?.type)) {
    return update;
  }

  const { rules, reset } = given ? { rules: given, reset: false } : await perkChoiceRulesOf(item, inPack);
  if (!isConvertedPick(rules)) {
    return update;
  }

  if (reset) {
    update['system.rules'] = [];
  }

  const have = source?.flags?.essence20?.rules?.choices ?? {};
  const old = legacyChoiceOf({ system: storedSystem(item), flags: source?.flags });
  let open = false;
  for (const pick of legacyChoicePicks(rules)) {
    if (madePick(have[pick.key])) {
      continue;
    }

    const values = pickList(old);
    if (!values.length) {
      open = true;
      report.unpicked.push(reportLine(actor, item, { key: pick.key }));
      continue;
    }

    const known = await legacyOptionValues(pick, item, actor, rules);
    if (!values.every(value => known.has(value))) {
      open = true;
      report.unmatched.push(reportLine(actor, item, { key: pick.key, value: old }));
      continue;
    }

    const listed = pick.kind == 'set' && pick.rule.count !== undefined && pick.rule.count !== null && pick.rule.count !== '';
    update[`flags.essence20.rules.choices.${pick.key}`] = listed ? [...new Set(values)] : Array.isArray(old) ? values[0] : old;
    report.copied.push(reportLine(actor, item, { key: pick.key, value: old }));
  }

  // The sub-Perk lists: the children already made under this copy, recorded under the step's key.
  for (const step of subPerkSteps(rules)) {
    const key = String(step.key ?? 'perks');
    if (madePick(have[key]) || !actor) {
      continue;
    }

    const id = item?.id ?? item?._id;
    const children = [...(actor.items ?? [])].filter(other => (other?.flags?.essence20?.parentId) == id && other?.type == 'perk')
      .map(child => rulesSourceUuid(child)).filter(Boolean);
    if (children.length) {
      update[`flags.essence20.rules.choices.${key}`] = [...new Set(children)];
      report.recorded.push(reportLine(actor, item, { key, value: children }));
    } else {
      report.unpicked.push(reportLine(actor, item, { key }));
    }
  }

  // The old picker never asks for this copy again (hasChoice to its default; 6.1 drops the field). An old pick left
  // unmatched keeps it, so the GM can see the legacy pick on the Details tab.
  if (storedSystem(item).hasChoice === true && !open) {
    unset(update, 'system.hasChoice', item);
  }

  if (Object.keys(update).length) {
    update['flags.essence20.choiceMigration.copied'] = true;
  }

  return update;
}

/** The value at a dotted path of a plain object. */
const valueAt = (object, path) => path.split('.').reduce((at, key) => (at === null || at === undefined ? at : at[key]), object);

/**
 * M2 for one copy: the change taking off what the old picker baked into the actor, and the copy's own part (its
 * unbaked flag; All-Terrain Alt Mode's Active Effect switched off). `state` carries the actor's running stored values
 * across its items (two copies taking from the same list).
 * @returns {{actorUpdate: Object, itemUpdate: Object}}
 */
export function unbakePerkChoice(item, actor, state, { report = perkChoiceReport(), rules = [] } = {}) {
  const result = { actorUpdate: {}, itemUpdate: {} };
  const source = item?._source ?? item;
  const system = storedSystem(item);
  if (source?.flags?.essence20?.choiceMigration?.unbaked || !legacyChoicePicks(rules).length
    || !['senses', 'environments', 'altModeMovement'].includes(system.choiceType)) {
    return result;
  }

  const baked = pickList(legacyChoiceOf({ system, flags: source?.flags }))[0];
  result.itemUpdate['flags.essence20.choiceMigration.unbaked'] = true;
  if (!baked) {
    return result;
  }

  if (system.choiceType == 'senses') {
    const path = `system.senses.${baked}.acute`;
    const current = path in state ? state[path] : valueAt(state.system, path.slice(7));
    if (current === true) {
      state[path] = false;
      result.actorUpdate[path] = false;
      report.unbaked.push(reportLine(actor, item, { value: baked }));
    } else {
      report.clamped.push(reportLine(actor, item, { value: baked }));
    }
  } else if (system.choiceType == 'environments') {
    const list = state['system.environments'] ?? [...(Array.isArray(state.system?.environments) ? state.system.environments : [])];
    const index = list.indexOf(baked);
    if (index >= 0) {
      list.splice(index, 1);
      state['system.environments'] = list;
      result.actorUpdate['system.environments'] = [...list];
      report.unbaked.push(reportLine(actor, item, { value: baked }));
    } else {
      report.clamped.push(reportLine(actor, item, { value: baked }));
    }
  } else {
    // All-Terrain Alt Mode: the one bundled Active Effect the drop switched on.
    const key = `system.movement.${baked}.altMode`;
    const effects = [...(source?.effects ?? item?.effects ?? [])];
    const on = effects.filter(effect => !effect?.disabled && (effect?.changes ?? effect?.system?.changes ?? []).some(change => change?.key == key));
    if (on.length) {
      result.itemUpdate.effects = on.map(effect => ({ _id: effect._id ?? effect.id, disabled: true }));
      report.unbaked.push(reportLine(actor, item, { value: baked }));
    } else if (effects.length) {
      report.clamped.push(reportLine(actor, item, { value: baked }));
    }
  }

  return result;
}

/** A list ChoiceSet (`count`) carrying the old pick over, or null. */
function listChoiceSet(rules) {
  return legacyChoicePicks(rules).find(pick => pick.kind == 'set' && pick.rule.count !== undefined && pick.rule.count !== null && pick.rule.count !== '') ?? null;
}

/**
 * Everything M1 / M2 / the sub-Perk record change on one actor, as data: {actorUpdate, itemUpdates: [{_id, ...}]}.
 * Pure apart from reading the compendium index. `perkValue` also runs the Details cleanup's migratePerkValue for each
 * copy (migrateActorData does that itself).
 * @param {Actor|Object} actor   A document (its items' prepared rules are read) or source data with items.
 * @param {Object} [options]   {inPack, report, perkValue, actorSystem (default: the actor's stored system)}
 * @returns {Promise<{actorUpdate: Object, itemUpdates: Array<Object>, rulesById: Map}>}
 */
export async function planActorPerkChoices(actor, { inPack = false, report = perkChoiceReport(), perkValue = false, actorSystem = null } = {}) {
  const system = actorSystem ?? (actor?._source ?? actor)?.system ?? {};
  const state = { system };
  const totals = {};
  const actorUpdate = {};
  const itemUpdates = [];
  const rulesById = new Map();
  for (const item of [...(actor?.items ?? [])]) {
    const id = item?.id ?? item?._id;
    const update = {};
    if (perkValue) {
      const moved = await migratePerkValue(item, { inPack, actorSystem: system, totals });
      Object.assign(update, moved.update);
      Object.assign(actorUpdate, moved.actorUpdate);
    }

    const { rules, reset } = await perkChoiceRulesOf(item, inPack);
    rulesById.set(id, rules);
    if (!isConvertedPick(rules)) {
      if (Object.keys(update).length) {
        itemUpdates.push({ _id: id, ...update });
      }

      continue;
    }

    Object.assign(update, await migratePerkChoiceItem(item, actor, { inPack, report, rules }));
    if (reset && !update['system.rules']) {
      update['system.rules'] = [];
    }

    const unbaked = unbakePerkChoice(item, actor, state, { report, rules });
    Object.assign(actorUpdate, unbaked.actorUpdate);
    Object.assign(update, unbaked.itemUpdate);
    if (Object.keys(update).length) {
      itemUpdates.push({ _id: id, ...update });
    }
  }

  return { actorUpdate, itemUpdates, rulesById };
}

/** The flags.essence20.rules state keys (other than choices) a folded copy brings along where the kept copy has none. */
const FOLD_STATE_KEYS = ['toggles', 'pools', 'limits', 'uses', 'banked', 'counters'];

/**
 * The fold of the multi-Skill Perks' copies (one copy per Skill, the old picker's shape) into one item per grant, as
 * data: {itemUpdates, deleteIds}. Copies are grouped by book item, parent, collection key and granting item; the first of
 * each group keeps every value of the group (its own first, no value twice), named "Name (A, B)", and the other copies'
 * rule state where it has none. A copy whose pick is unmatched (not a Skill) is left out of the fold and reported.
 * Reads each copy's pick after `pending` (this run's item updates, by id).
 * @returns {Promise<{itemUpdates: Array<Object>, deleteIds: Array<String>}>}
 */
export async function planPerkCopyFold(actor, rulesById, pending = new Map(), { report = perkChoiceReport() } = {}) {
  const groups = new Map();
  for (const item of [...(actor?.items ?? [])]) {
    const id = item?.id ?? item?._id;
    const rules = rulesById.get(id) ?? [];
    const pick = listChoiceSet(rules);
    const book = rulesSourceUuid(item);
    if (!pick || !book) {
      continue;
    }

    const flags = (item?._source ?? item)?.flags?.essence20 ?? {};
    const stored = pending.get(id)?.[`flags.essence20.rules.choices.${pick.key}`] ?? flags.rules?.choices?.[pick.key];
    const values = pickList(stored);
    if (!values.length) {
      continue;
    }

    const group = [book, flags.parentId ?? '', flags.collectionId ?? '', flags.grantedBy ?? '', pick.key].join('|');
    groups.set(group, [...(groups.get(group) ?? []), { item, id, values, pick, rules, flags }]);
  }

  const itemUpdates = [];
  const deleteIds = [];
  const { renameUpdate } = await import("./rules/lifecycle.mjs");
  for (const copies of groups.values()) {
    if (copies.length < 2) {
      continue;
    }

    const [keep, ...rest] = copies;
    const merged = [...new Set(copies.flatMap(copy => copy.values))];
    const update = { _id: keep.id, ...(pending.get(keep.id) ?? {}), [`flags.essence20.rules.choices.${keep.pick.key}`]: merged };
    // The other copies' rule state (toggles, pools, limits...) where the kept copy has none.
    for (const copy of rest) {
      for (const stateKey of FOLD_STATE_KEYS) {
        for (const [key, value] of Object.entries(copy.flags.rules?.[stateKey] ?? {})) {
          const path = `flags.essence20.rules.${stateKey}.${key}`;
          if (keep.flags.rules?.[stateKey]?.[key] === undefined && update[path] === undefined) {
            update[path] = value;
          }
        }
      }

      if (copy.flags.perkValueRule) {
        update['flags.essence20.perkValueRule'] = true;
      }
    }

    const view = { id: keep.id, name: keep.item.name, type: keep.item.type, parent: actor, _stats: keep.item._stats, flags: (keep.item._source ?? keep.item).flags ?? {}, system: { ...storedSystem(keep.item), rules: keep.rules } };
    Object.assign(update, renameUpdate(view, { ...(keep.flags.rules?.choices ?? {}), [keep.pick.key]: merged }) ?? {});
    update['flags.essence20.choiceMigration.folded'] = rest.map(copy => copy.id);
    update['flags.essence20.choiceMigration.copied'] = true;
    itemUpdates.push(update);
    deleteIds.push(...rest.map(copy => copy.id));
    report.folded.push(reportLine(actor, keep.item, { value: merged, copies: copies.length }));
  }

  return { itemUpdates, deleteIds };
}

/**
 * The whole Perk choice migration for one live actor (a world actor or an unlinked token's): M1, M2, the sub-Perk
 * record, Fast's / GI Joe Expertise's value (migratePerkValue) and the fold - written as ONE actor update (the actor's
 * changes with its items' flags), then the folded copies deleted. Safe to run again.
 * @param {Actor} actor
 * @param {Object} [options]   {report, inPack}
 * @returns {Promise<Object>}   The report.
 */
export async function migrateActorPerkChoices(actor, { report = perkChoiceReport(), inPack = false } = {}) {
  const { actorUpdate, itemUpdates, rulesById } = await planActorPerkChoices(actor, { inPack, report, perkValue: true });
  const pending = new Map(itemUpdates.map(update => [update._id, update]));
  const fold = await planPerkCopyFold(actor, rulesById, pending, { report });
  for (const update of fold.itemUpdates) {
    pending.set(update._id, update);
  }

  const items = [...pending.values()].filter(update => !fold.deleteIds.includes(update._id));
  if (items.length || Object.keys(actorUpdate).length) {
    await actor.update({ ...actorUpdate, ...(items.length ? { items } : {}) });
  }

  const gone = fold.deleteIds.filter(id => actor.items?.get?.(id));
  if (gone.length) {
    await actor.deleteEmbeddedDocuments('Item', gone);
  }

  return report;
}

/** Every unlinked token actor in the world's scenes. */
function unlinkedTokenActors() {
  const actors = [];
  for (const scene of globalThis.game?.scenes ?? []) {
    for (const token of scene.tokens ?? []) {
      if (!token.actorLink && token.actor) {
        actors.push(token.actor);
      }
    }
  }

  return actors;
}

/** The GM-facing lines of a report: what was left alone, and counts. */
export function perkChoiceReportText(report) {
  const value = entry => (Array.isArray(entry.value) ? entry.value.join(', ') : entry.value ?? '');
  // One run passes items twice (the actor pass, then the sweep): each actor + item + value is counted once.
  const once = list => [...new Map((list ?? []).map(entry => [`${entry.actor}|${entry.item}|${JSON.stringify(entry.value ?? '')}`, entry])).values()];
  report = Object.fromEntries(Object.entries(report).map(([key, list]) => [key, once(list)]));
  const lines = [];
  for (const entry of report.unmatched) {
    lines.push(`${entry.actor ? `${entry.actor}: ` : ''}${entry.item} - old pick "${value(entry)}" matches no option (left as it was; pick it on the Rules tab)`);
  }

  for (const entry of report.unpicked) {
    lines.push(`${entry.actor ? `${entry.actor}: ` : ''}${entry.item} - nothing picked yet (pick it on the Rules tab)`);
  }

  for (const entry of report.clamped) {
    lines.push(`${entry.actor ? `${entry.actor}: ` : ''}${entry.item} - "${value(entry)}" was no longer on the character (nothing taken off)`);
  }

  return {
    summary: `copied ${report.copied.length}, sub-Perks recorded ${report.recorded.length}, unbaked ${report.unbaked.length}, `
      + `folded ${report.folded.length}, unmatched ${report.unmatched.length}, unpicked ${report.unpicked.length}, clamped ${report.clamped.length}`,
    lines,
  };
}

/**
 * From migrateWorld (the main migration, run when needsMigrationVersion says so - user, 2026-10-07), GM only: the Perk
 * choice migration for every world actor, every unlinked token actor and every world item. Safe to run again (every step
 * is value-matched). A console summary, and a GM whisper listing what was left alone. User compendia go through the
 * "migrate compendium" action (migrateCompendium).
 * @returns {Promise<Object|null>}   The report, or null when nothing ran.
 */
export async function migratePerkChoices() {
  if (!globalThis.game?.user?.isGM) {
    return null;
  }

  resetMigrationCaches();
  const report = perkChoiceReport();
  for (const actor of [...(game.actors ?? []), ...unlinkedTokenActors()]) {
    try {
      await migrateActorPerkChoices(actor, { report });
    } catch (error) {
      console.error(`Essence20 | Perk choice migration failed for ${actor?.name}`, error);
    }
  }

  for (const item of game.items ?? []) {
    try {
      const update = await migratePerkChoiceItem(item, null, { report });
      if (Object.keys(update).length) {
        await item.update(update);
      }
    } catch (error) {
      console.error(`Essence20 | Perk choice migration failed for ${item?.name}`, error);
    }
  }

  const { summary, lines } = perkChoiceReportText(report);
  console.info(`Essence20 | Perk choice migration: ${summary}`, report);
  if (lines.length && globalThis.ChatMessage?.create) {
    const escape = text => String(text).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
    await ChatMessage.create({
      content: `<p><strong>Essence20: Perk choice migration</strong> (${escape(summary)})</p><ul>${lines.map(line => `<li>${escape(line)}</li>`).join('')}</ul>`,
      whisper: ChatMessage.getWhisperRecipients?.('GM')?.map(user => user.id) ?? [],
    });
  }

  return report;
}
