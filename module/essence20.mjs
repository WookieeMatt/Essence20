// Import document classes.
import { Essence20Actor } from "./documents/actor.mjs";
import { Essence20Combat } from "./documents/combat.mjs";
import { Essence20Combatant } from "./documents/combatant.mjs";
import { Essence20Item } from "./documents/item.mjs";
// Import sheet classes.
import { Essence20ActorSheet } from "./sheets/actor-sheet.mjs";
import { Essence20ItemSheet } from "./sheets/item-sheet.mjs";
// Import helper/utility classes and constants.
import { highlightCriticalSuccessFailure } from "./chat.mjs";
import { E20 } from "./helpers/config.mjs";
import { preloadHandlebarsTemplates } from "./helpers/templates.mjs";
import { performPreLocalization, setOptGroup } from "./helpers/utils.mjs";
import { migrateWorld } from "./migration.mjs";

function registerSystemSettings() {
  game.settings.register("essence20", "systemMigrationVersion", {
    config: false,
    scope: "world",
    type: String,
    default: "",
  });
}

/**
 * Runs a system migration if required
 * @type {String}
 */
function runMigrations() {
  if (!game.user.isGM) {
    return;
  }

  const NEEDS_MIGRATION_VERSION = game.system.flags.needsMigrationVersion;

  // Get the current version, or set it if not present
  const currentVersion = game.settings.get("essence20", "systemMigrationVersion");
  const totalDocuments = game.actors.size + game.scenes.size + game.items.size;
  if (!currentVersion && totalDocuments === 0) {
    console.log("No documents to migrate");
    return game.settings.set("essence20", "systemMigrationVersion", game.system.version);
  } else if (!currentVersion || isNewerVersion(NEEDS_MIGRATION_VERSION, currentVersion)) {
    // Perform the migration, if needed
    console.log(`Current version ${currentVersion} < ${NEEDS_MIGRATION_VERSION} and requires migration`);
    migrateWorld();
  } else {
    console.log(`Current version ${currentVersion} >= ${NEEDS_MIGRATION_VERSION} and doesn't require migration`);
  }
}

/* -------------------------------------------- */
/*  Init Hook                                   */
/* -------------------------------------------- */

Hooks.once('init', async function () {
  // Add utility classes to the global game object so that they're more easily
  // accessible in global contexts.
  game.essence20 = {
    Essence20Actor,
    Essence20Combat,
    Essence20Combatant,
    Essence20Item,
    rollItemMacro,
  };

  // Add custom constants for configuration.
  CONFIG.E20 = E20;

  /**
   * Set an initiative formula for the system
   * @type {String}
   */
  CONFIG.Combat.initiative = {
    formula: "@initiative.formula",
  };

  // Define custom Document classes
  CONFIG.Actor.documentClass = Essence20Actor;
  CONFIG.Combat.documentClass = Essence20Combat;
  CONFIG.Combatant.documentClass = Essence20Combatant;
  CONFIG.Item.documentClass = Essence20Item;
  CONFIG.statusEffects = foundry.utils.deepClone(E20.statusEffects);

  // Register System Settings
  registerSystemSettings();

  // Register sheet application classes
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("essence20", Essence20ActorSheet, { makeDefault: true });
  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("essence20", Essence20ItemSheet, { makeDefault: true });

  // Preload Handlebars templates.
  return preloadHandlebarsTemplates();
});

/* -------------------------------------------- */
/*  Handlebars Helpers                          */
/* -------------------------------------------- */

// If you need to add Handlebars helpers, here are a few useful examples:
Handlebars.registerHelper('concat', function () {
  var outStr = '';
  for (var arg in arguments) {
    if (typeof arguments[arg] != 'object') {
      outStr += arguments[arg];
    }
  }

  return outStr;
});

Handlebars.registerHelper('toLowerCase', function (str) {
  return str.toLowerCase();
});

Handlebars.registerHelper('sum', function () {
  var total = 0;
  for (var arg in arguments) {
    let newValue = arguments[arg];
    if (typeof newValue == 'number') {
      total += newValue;
    } else if (typeof newValue == 'string') {
      total += parseInt(newValue);
    }
  }

  return total;
});

Handlebars.registerHelper('isdefined', function (value) {
  return value !== undefined;
});

Handlebars.registerHelper('ifEquals', function (arg1, arg2, options) {
  return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
});

Handlebars.registerHelper('inArray', function (array, value, options) {
  return (array.includes(value)) ? options.fn(this) : options.inverse(this);
});

Handlebars.registerHelper('ifNotEquals', function (arg1, arg2, options) {
  return (arg1 != arg2) ? options.fn(this) : options.inverse(this);
});

/* -------------------------------------------- */
/*  Misc Hooks                                  */
/* -------------------------------------------- */

// Perform one-time pre-localization and sorting of some configuration objects
Hooks.once("i18nInit", () => performPreLocalization(CONFIG.E20));

Hooks.once("ready", async function () {
  runMigrations();

  // Wait to register hotbar drop hook on ready so that modules could register earlier if they want to
  Hooks.on("hotbarDrop", (bar, data, slot) => {
    if (["Item", "ActiveEffect"].includes(data.type)) {
      createItemMacro(data, slot);
      return false;
    }
  });
});

/* eslint-disable no-unused-vars */
Hooks.on("renderChatMessage", (app, html, data) => {
  highlightCriticalSuccessFailure(app, html);
});

/* Hook to organize the item options by type */
Hooks.on("renderDialog", (dialog, html) => {
  if (html[0].innerText.includes('Create New Item')) {
    const select = html[0].querySelector("select[name='type']");
    const threatPowerOption = select.querySelector("option[value='threatPower']");
    if (threatPowerOption) {
      threatPowerOption.style.display = 'none';
    }

    if (select) {
      select.append(setOptGroup(select, "Equipment", CONFIG.E20.equipmentTypes));
      select.append(setOptGroup(select, "Background", CONFIG.E20.backgroundTypes));
      select.append(setOptGroup(select, "Character Options", CONFIG.E20.characterTypes));
      select.append(setOptGroup(select, "Other", CONFIG.E20.otherTypes));
    }
  }
});

/* -------------------------------------------- */
/*  Hotbar Macros                               */
/* -------------------------------------------- */

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {Object} data     The dropped data
 * @param {number} slot     The hotbar slot to use
 * @returns {Promise}
 */
async function createItemMacro(data, slot) {
  if (data.type !== "Item") return;
  if (!("uuid" in data)) return ui.notifications.warn("You can only create macro buttons for owned Items");
  const item = await fromUuid(data.uuid);

  // Create the macro command
  const command = `game.essence20.rollItemMacro("${item._id}", "${item.name}");`;
  let macro = game.macros.find(m => (m.name === item.name) && (m.command === command));
  if (!macro) {
    macro = await Macro.create({
      name: item.name,
      type: "script",
      img: item.img,
      command: command,
      flags: { "essence20.itemMacro": true },
    });
  }

  game.user.assignHotbarMacro(macro, slot);
  return false;
}

/**
 * Roll and Item Macro.
 * @param {string} itemId
 * @param {string} itemName
 * @return {Promise}
 */
async function rollItemMacro(itemId, itemName) {
  const speaker = ChatMessage.getSpeaker();
  let actor;
  if (speaker.token) actor = game.actors.tokens[speaker.token];
  if (!actor) actor = game.actors.get(speaker.actor);
  const item = actor ? actor.items.get(itemId) : null;
  if (!item) return ui.notifications.warn(`Your controlled Actor does not have an item named ${itemName}`);

  // Trigger the item roll
  return item.roll();
}
