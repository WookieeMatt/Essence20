/**
 * Perform a system migration for the entire World, applying migrations for Actors, Items, and Compendium packs
 * @returns {Promise}      A Promise which resolves once the migration is completed
 */
export const migrateWorld = async function() {
  const version = game.system.version;
  ui.notifications.info(game.i18n.format("MIGRATION.begin", {version}), {permanent: true});

  // Migrate World Actors
  const actors = game.actors.map(a => [a, true])
    .concat(Array.from(game.actors.invalidDocumentIds).map(id => [game.actors.getInvalid(id), false]));
  for (const [actor, valid] of actors) {
    try {
      const source = valid ? actor.toObject() : game.data.actors.find(a => a._id === actor.id);
      const updateData = migrateActorData(source);
      if (!foundry.utils.isEmpty(updateData)) {
        console.log(`Migrating Actor document ${actor.name}`);
        console.log(updateData);
        await actor.update(updateData, {enforceTypes: false, diff: valid});
        await actor.update({"system.skills.-=strength": null});
        await actor.update({"system.skills.-=smarts": null});
        await actor.update({"system.skills.-=social": null});
        await actor.update({"system.skills.-=speed": null});
        await actor.update({"system.skills.-=any": null});
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
      const updateData = migrateItemData(source);
      if (!foundry.utils.isEmpty(updateData)) {
        console.log(`Migrating Item document ${item.name}`);
        console.log(updateData);
        await item.update(updateData, {enforceTypes: false, diff: valid});
        await item.update({"system.-=perkType": null});
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
    if (p.metadata.packageType !== "world") continue;
    if (!["Actor", "Item", "Scene"].includes(p.documentName)) continue;
    await migrateCompendium(p);
  }

  // Set the migration as complete
  // game.settings.set("essence20", "systemMigrationVersion", game.system.version);
  ui.notifications.info(game.i18n.format("MIGRATION.complete", {version}), {permanent: true});
};

/* -------------------------------------------- */
/*  Document Type Migration Helpers             */
/* -------------------------------------------- */

/**
 * Migrate a single Actor document to incorporate latest data model changes
 * Return an Object of updateData to be applied
 * @param {object} actor            The actor data object to update
 * @returns {object}                The updateData to apply
 */
export const migrateActorData = function(actor) {
  const updateData = {};

  // Migrate initiative
  if (typeof actor.system.initiative == "string") {
    updateData[`system.initiative`] = {
      "formula": "", // This will populate after the actor's first initiative roll
      "modifier": 0,
      "shift": actor.system.initiative
    };
  }

  // Migrate Skills
  if (actor.system.skills.strength) {
    const skillsForEssences = actor.system.skills
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
            "shiftUp": fields.shiftUp
          }
        }
      }
    }
    updateData[`system.skills`] = newSkills;
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

  // Migrate Owned Items
  if (!actor.items) {
    return updateData;
  }

  const items = actor.items.reduce((arr, i) => {
    // Migrate the Owned Item
    const itemData = i instanceof CONFIG.Item.documentClass ? i.toObject() : i;
    let itemUpdate = migrateItemData(itemData);

    // Update the Owned Item
    if (!foundry.utils.isEmpty(itemUpdate)) {
      itemUpdate._id = itemData._id;
      arr.push(foundry.utils.expandObject(itemUpdate));
    }

    return arr;
  }, []);

  if (items.length > 0) {
    updateData.items = items;
  }

  return updateData;
};

/**
 * Migrate a single Item document to incorporate latest data model changes
 *
 * @param {object} item             Item data to migrate
 * @returns {object}                The updateData to apply
 */
 export function migrateItemData(item) {
  const updateData = {};

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
  } else if (item.type == "perk") {
    if (item.system.perkType) {
      const perkType = item.system.perkType;
      updateData[`system.type`] = perkType;
    }
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
          updateData = migrateActorData(doc.toObject());
          break;
        case "Item":
          updateData = migrateItemData(doc.toObject());

          break;
        case "Scene":
          // updateData = migrateSceneData(doc.toObject());
          break;
      }

      // Save the entry, if data was changed
      if ( foundry.utils.isEmpty(updateData) ) continue;
      await doc.update(updateData);
      console.log(`Migrated ${documentName} document ${doc.name} in Compendium ${pack.collection}`);
    }

    // Handle migration failures
    catch(err) {
      err.message = `Failed dnd5e system migration for document ${doc.name} in pack ${pack.collection}: ${err.message}`;
      console.error(err);
    }
  }

  // Apply the original locked status for the pack
  await pack.configure({locked: wasLocked});
  console.log(`Migrated all ${documentName} documents from Compendium ${pack.collection}`);
};
