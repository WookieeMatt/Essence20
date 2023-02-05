
/**
 * Perform a system migration for the entire World, applying migrations for Actors, Items, and Compendium packs
 * @returns {Promise}      A Promise which resolves once the migration is completed
 */
export const migrateWorld = async function() {
  const version = game.system.version;
  ui.notifications.info(game.i18n.format("MIGRATION.begin", {version}), {permanent: true});

  /* Leaving this here in case we need to migrate Actors later
  // Migrate World Actors
  const actors = game.actors.map(a => [a, true])
    .concat(Array.from(game.actors.invalidDocumentIds).map(id => [game.actors.getInvalid(id), false]));
  for ( const [actor, valid] of actors ) {
    try {
      const source = valid ? actor.toObject() : game.data.actors.find(a => a._id === actor.id);
      const updateData = migrateActorData(source, migrationData);
      if ( !foundry.utils.isEmpty(updateData) ) {
        console.log(`Migrating Actor document ${actor.name}`);
        await actor.update(updateData, {enforceTypes: false, diff: valid});
      }
    } catch(err) {
      err.message = `Failed dnd5e system migration for Actor ${actor.name}: ${err.message}`;
      console.error(err);
    }
  }
  */

  // Migrate World Items
  const items = game.items.map(i => [i, true])
    .concat(Array.from(game.items.invalidDocumentIds).map(id => [game.items.getInvalid(id), false]));
  for (const [item, valid] of items) {
    try {
      const source = valid ? item.toObject() : game.data.items.find(i => i._id === item.id);
      const updateData = migrateItemData(source);
      if (!foundry.utils.isEmpty(updateData)) {
        console.log(`Migrating Item document ${item.name}`);
        await item.update(updateData, {enforceTypes: false, diff: valid});
      }
    } catch(err) {
      err.message = `Failed essence20 system migration for Item ${item.name}: ${err.message}`;
      console.error(err);
    }
  }

  /* Leaving this here in case we need to migrate Actors later
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

  /* Leaving this here in case we need to migrate Actors later
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
  // for ( let p of game.packs ) {
  //   if ( p.metadata.packageType !== "world" ) continue;
  //   if ( !["Actor", "Item", "Scene"].includes(p.documentName) ) continue;
  //   await migrateCompendium(p);
  // }

  // Set the migration as complete
  game.settings.set("essence20", "systemMigrationVersion", game.system.version);
  ui.notifications.info(game.i18n.format("MIGRATION.complete", {version}), {permanent: true});
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
    const trait = item.system.trait;
    if (trait && !item.system.traits[trait]) {
      updateData[`item.system.traits.${trait}`] = true;
    }
  }

  return updateData;
}
