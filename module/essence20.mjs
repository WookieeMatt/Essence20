// Import data models
import * as data from "./data/index.mjs";
// Import document classes.
import { Essence20Actor } from "./documents/actor.mjs";
import { Essence20Combat } from "./documents/combat.mjs";
import { Essence20Combatant } from "./documents/combatant.mjs";
import { Essence20Item } from "./documents/item.mjs";
// Import sheet classes.
import { Essence20CharacterActorSheet } from "./sheets/character-sheet.mjs";
import { Essence20CompanionActorSheet } from "./sheets/companion-sheet.mjs";
import { Essence20NPCActorSheet } from "./sheets/npc-sheet.mjs";
import { Essence20MegaformActorSheet } from "./sheets/megaform-sheet.mjs";
import { Essence20VehicleActorSheet } from "./sheets/vehicle-sheet.mjs";
import { Essence20ZordActorSheet } from "./sheets/zord-sheet.mjs";
import { Essence20ItemSheet } from "./sheets/item-sheet.mjs";
// Import StoryPoints
import { getPointsName, StoryPoints } from "./apps/story-points.mjs";
// Import Compendium Browser
import Essence20CompendiumBrowser from "./apps/compendium-browser.mjs";
// Import helper/utility classes and constants.
import { addRerollButtons, applyChatMessageSystemColor, attachCheckCardListeners, hideDifficultyForNonGm, highlightCriticalSuccessFailure } from "./chat.mjs";
import { syncSourcebookOwnership } from "./helpers/compendium-browser.mjs";
import { E20 } from "./helpers/config.mjs";
import { enrichCheck, onCheckLinkClick, onCheckSendToChat } from "./helpers/enrichers.mjs";
import { preloadHandlebarsTemplates } from "./helpers/templates.mjs";
import { applyVisionToTokens, getNumActions, syncAutoBlindStatus } from "./helpers/actor.mjs";
import { performPreLocalization } from "./helpers/localize.mjs";
import { migrateWorld } from "./migration.mjs";
import { applyThemeClass, refreshChatMessageThemes, registerSettings, refreshOpenThemeWrappers, setting } from "./settings.js";
import { updateRoleCache } from "./helpers/utils.mjs";

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
  const currentVersion = game.settings.get(
    "essence20",
    "systemMigrationVersion",
  );
  const totalDocuments = game.actors.size + game.scenes.size + game.items.size;
  if (!currentVersion && totalDocuments === 0) {
    console.info("No documents to migrate");
    return game.settings.set(
      "essence20",
      "systemMigrationVersion",
      game.system.version,
    );
  } else if (
    !currentVersion ||
    foundry.utils.isNewerVersion(NEEDS_MIGRATION_VERSION, currentVersion)
  ) {
    // Perform the migration, if needed
    console.warn(
      `Current version ${currentVersion} < ${NEEDS_MIGRATION_VERSION} and requires migration`,
    );
    migrateWorld();
  } else {
    console.log(
      `Current version ${currentVersion} >= ${NEEDS_MIGRATION_VERSION} and doesn't require migration`,
    );
  }
}

/* -------------------------------------------- */
/*  Init Hooks                                  */
/* -------------------------------------------- */

Hooks.once("init", async function () {
  // Add utility classes to the global game object so that they're more easily
  // accessible in global contexts.
  game.essence20 = {
    Essence20Actor,
    Essence20Combat,
    Essence20Combatant,
    Essence20Item,
    CompendiumBrowser: Essence20CompendiumBrowser,
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

  /* Point Foundry's own special-status slots at our matching status IDs, so core's built-in
     automation applies for free instead of needing bespoke code: BLIND disables a token's vision
     entirely (it may still use non-sight detection modes, like tremorsense), and DEFEATED drives
     the Combat Tracker's skull/defeated overlay. Our own "invisible" id already matches Foundry's
     default (no change needed there - confirmed it already gets the token-transparency handling
     other systems rely on this same config for). */
  CONFIG.specialStatusEffects.BLIND = "blinded";
  CONFIG.specialStatusEffects.DEFEATED = "defeated";

  // @Check[skill=... dif=15] / @Check[skill=... defense=toughness] text-enricher links (p.88-89
  // "DIF 15 Sleight of Hand or Technology" style Skill Test references), usable in item/actor
  // descriptions and journal entries. See module/helpers/enrichers.mjs for the GM-only DIF
  // visibility rationale.
  CONFIG.TextEditor.enrichers.push({
    pattern: /@Check\[([^\]]+)\](?:\{([^}]+)\})?/g,
    enricher: enrichCheck,
  });

  // Register System Data Models
  CONFIG.Actor.dataModels = data.actor.config;
  CONFIG.ActiveEffect.dataModels = data.effect.config;
  CONFIG.Item.dataModels = data.item.config;

  // Register System Settings
  registerSystemSettings();

  // Register sheet application classes
  foundry.documents.collections.Actors.unregisterSheet(
    "core",
    foundry.appv1.sheets.ActorSheet,
  );
  foundry.documents.collections.Actors.registerSheet(
    "essence20",
    Essence20CharacterActorSheet,
    {
      types: ["playerCharacter"],
      makeDefault: true,
      label: "Player Character",
    },
  );
  foundry.documents.collections.Actors.registerSheet(
    "essence20",
    Essence20CompanionActorSheet,
    {
      types: ["companion"],
      makeDefault: true,
      label: "Companion",
    },
  );
  foundry.documents.collections.Actors.registerSheet(
    "essence20",
    Essence20MegaformActorSheet,
    {
      types: ["megaform"],
      makeDefault: true,
      label: "Megaform",
    },
  );
  foundry.documents.collections.Actors.registerSheet(
    "essence20",
    Essence20NPCActorSheet,
    {
      types: ["npc"],
      makeDefault: true,
      label: "NPC/Contact",
    },
  );
  foundry.documents.collections.Actors.registerSheet(
    "essence20",
    Essence20VehicleActorSheet,
    {
      types: ["vehicle"],
      makeDefault: true,
      label: "Vehicle",
    },
  );
  foundry.documents.collections.Actors.registerSheet(
    "essence20",
    Essence20ZordActorSheet,
    {
      types: ["zord"],
      makeDefault: true,
      label: "Zord",
    },
  );
  foundry.documents.collections.Items.unregisterSheet(
    "core",
    foundry.appv1.sheets.ItemSheet,
  );
  foundry.documents.collections.Items.registerSheet(
    "essence20",
    Essence20ItemSheet,
    { makeDefault: true },
  );

  registerSettings();

  // Clients (players) listen on the socket to update the UI whenever the GM changes values
  game.socket.on("system.essence20", (data) => {
    game.StoryPointsTracker.handleStoryPointSignal(data);
  });

  // Preload Handlebars templates.
  return preloadHandlebarsTemplates();
});

/* -------------------------------------------- */
/*  Handlebars Helpers                          */
/* -------------------------------------------- */
//#region Handlebars
// If you need to add Handlebars helpers, here are a few useful examples:
Handlebars.registerHelper("concat", function () {
  var outStr = "";
  for (var arg in arguments) {
    if (typeof arguments[arg] != "object") {
      outStr += arguments[arg];
    }
  }

  return outStr;
});

Handlebars.registerHelper("toLowerCase", function (str) {
  return str.toLowerCase();
});

Handlebars.registerHelper("sum", function () {
  var total = 0;
  for (var arg in arguments) {
    let newValue = arguments[arg];
    if (typeof newValue == "number") {
      total += newValue;
    } else if (typeof newValue == "string") {
      total += parseInt(newValue);
    }
  }

  return total;
});

Handlebars.registerHelper("isdefined", function (value) {
  return value !== undefined;
});

Handlebars.registerHelper("inArray", function (array, value, options) {
  return array.includes(value) ? options.fn(this) : options.inverse(this);
});

// system.items collections (Role/Focus's granted-item lists, among others) are a plain object
// keyed by short random ids, not an array - {{#each}} over them iterates in insertion order, not
// level order, so a Role Perk dragged on after a higher-level one already exists would render
// out of order in the sheet's editable list. This returns them as an array sorted by level
// instead, with each entry's original dict key folded in as `key` (since {{#each}} over an
// array doesn't expose {{@key}} the way iterating the raw object does - templates using this
// need `{{item.key}}` in place of `{{@key}}`). Array#sort is stable (guaranteed since ES2019),
// so entries that share a level (e.g. a Spectrum Modification choiceGroup pair) keep their
// original relative order rather than reshuffling.
Handlebars.registerHelper("sortByLevel", function (items) {
  return Object.entries(items)
    .map(([key, item]) => ({ ...item, key }))
    .sort((a, b) => (a.level ?? 0) - (b.level ?? 0));
});

Handlebars.registerHelper("itemsContainType", function (items, type, options) {
  for (const key in items) {
    if (items[key].type == type) {
      return options.fn(this);
    }
  }

  return options.inverse(this);
});

Handlebars.registerHelper("assign", function (varName, varValue, options) {
  if (!options.data.root) {
    options.data.root = {};
  }

  options.data.root[varName] = varValue;
});

Handlebars.registerHelper(
  "formatBooleanList",
  function (objectToList, friendlyLookup, listType) {
    const unformattedList = [];
    for (const [key, isTrue] of Object.entries(objectToList)) {
      if (isTrue) {
        unformattedList.push(friendlyLookup[key]);
      }
    }

    return game.i18n
      .getListFormatter({ style: "long", type: listType })
      .format(unformattedList);
  },
);

Handlebars.registerHelper('switch', function(value, options) {
  this.switch_value = value;
  this.switch_break = false;
  return options.fn(this);
});

Handlebars.registerHelper('case', function(value, options) {
  if (value == this.switch_value) {
    this.switch_break = true;
    return options.fn(this);
  }
});

Handlebars.registerHelper('default', function(value) {
  if (!this.switch_break) {
    return value;
  }
});
//#endregion

/* -------------------------------------------- */
/*  Misc Hooks                                  */
/* -------------------------------------------- */

// Perform one-time pre-localization and sorting of some configuration objects
Hooks.once("i18nInit", () => performPreLocalization(CONFIG.E20));

// Foundry only re-themes its own core UI (sidebar, HUD, compendium, etc.) when the
// color scheme setting changes; re-theme any open Essence20 sheets/apps in place too.
Hooks.on("clientSettingChanged", (key) => {
  if (key === "core.uiConfig") {
    refreshOpenThemeWrappers();
    refreshChatMessageThemes();
  }
});

Hooks.once("ready", async function () {
  runMigrations();

  // Wait to register hotbar drop hook on ready so that modules could register earlier if they want to
  Hooks.on("hotbarDrop", (bar, data, slot) => {
    if (["Item", "ActiveEffect"].includes(data.type)) {
      createItemMacro(data, slot);
      return false;
    }
  });

  if (
    (setting("sptShow") == "on" ||
      (setting("sptShow") == "toggle" && setting("sptToggleState"))) &&
    (setting("sptAccess") == "everyone" ||
      (setting("sptAccess") == "gm" && game.user.isGM))
  ) {
    game.StoryPointsTracker = await new StoryPoints().render(true);
  }

  await updateRoleCache();

  // Keep real pack ownership in sync with the enabled/disabled sourcebook setting, in
  // case it was changed some other way (e.g. a macro) since the last Source Config
  // save. Only a GM can write pack ownership.
  if (game.user.isGM) {
    await syncSourcebookOwnership();
  }
});

// Init the button in the controls for toggling the dialog
Hooks.on("getSceneControlButtons", (controls) => {
  if (
    setting("sptShow") == "toggle" &&
    (setting("sptAccess") == "everyone" ||
      (setting("sptAccess") == "gm" && game.user.isGM))
  ) {
    const tokenControls = controls.tokens;
    const activeState = game.settings.get("essence20", "sptToggleState");
    tokenControls.tools.sptTracker = {
      active: activeState,
      icon: "fas fa-circle-s",
      name: "sptTracker",
      title: game.i18n.format("E20.SptToggleDialog", {
        name: getPointsName(false),
      }),
      toggle: true,
      visible: true,
      onChange: async (event, toggle) => {
        try {
          if (toggle) {
            if (!game.StoryPointsTracker) {
              StoryPoints.open();
            }
          } else {
            if (game.StoryPointsTracker) {
              game.StoryPointsTracker.close();
            }
          }
        } catch (err) {
          console.error(err);
        }
      },
    };
  }
});

// Add a button to the bottom of the Compendium and Items sidebar tabs to open the
// Compendium Browser. The footer part is a flexcol "action-buttons" container (same
// one core uses for things like the Actor directory's Import button), so a plain
// button dropped in there already stretches to the tab's full width for free.
function addCompendiumBrowserFooterButton(app, html) {
  const footer = html.querySelector('[data-application-part="footer"]');
  if (!footer || footer.querySelector(".essence20-open-compendium-browser")) {
    return;
  }

  const button = document.createElement("button");
  button.type = "button";
  button.classList.add("essence20-open-compendium-browser");
  button.innerHTML = `<i class="fa-solid fa-book-atlas" inert></i><span>${game.i18n.localize("E20.CompendiumBrowserOpenTooltip")}</span>`;
  button.addEventListener("click", () => {
    new Essence20CompendiumBrowser().render(true);
  });

  footer.appendChild(button);
}

Hooks.on("renderCompendiumDirectory", addCompendiumBrowserFooterButton);
Hooks.on("renderItemDirectory", addCompendiumBrowserFooterButton);

Hooks.on("renderChatMessageHTML", (app, html, data) => {
  highlightCriticalSuccessFailure(app, html, data);
  addRerollButtons(app, html);
  attachCheckCardListeners(app, html);
  hideDifficultyForNonGm(app, html);
  applyChatMessageSystemColor(app, html);
  applyThemeClass(html);
});

// @Check[...] links (module/helpers/enrichers.mjs) can appear in item/actor descriptions and
// journal entries alike, not just chat, so this is a plain document-level delegated listener
// rather than something scoped to the renderChatMessageHTML hook above.
document.addEventListener("click", (event) => {
  const sendToChat = event.target.closest('.e20-check-send-to-chat');
  if (sendToChat) {
    onCheckSendToChat(event, sendToChat);
    return;
  }

  const link = event.target.closest('.e20-check-link');
  if (link) {
    onCheckLinkClick(event, link);
  }
});

/* A Megaform's combined stats are computed from its linked component actors (system.actors -
   Zords for a Zord-subtype Megazord, or PC/NPC actors for a Combiner-subtype Gestalt/Matched
   Combiner) in Essence20Actor#_prepareMegaformData(), but that only reruns when the
   Megaform's own document changes - Foundry doesn't automatically invalidate it when a linked
   component (or one of its Megaform Trait/Combiner Feature items) changes elsewhere.
   Explicitly refresh any Megaform that has the changed actor linked so its sheet doesn't show
   stale combined stats. Deliberately not filtered by actor type, since a Combiner's
   components can be any actor type (unlike a Megazord, which is Zord-only). */
function refreshMegaformsLinkedToActor(actorUuid) {
  if (!actorUuid) {
    return;
  }

  for (const megaform of game.actors.filter(actor => actor.type == 'megaform')) {
    const isLinked = Object.values(megaform.system.actors).some(entry => entry.uuid == actorUuid);
    if (isLinked) {
      megaform.prepareData();
      megaform.sheet.render(false);
    }
  }
}

Hooks.on("updateActor", (actor) => {
  refreshMegaformsLinkedToActor(actor.uuid);
});

for (const hookName of ["createItem", "updateItem", "deleteItem"]) {
  Hooks.on(hookName, (item) => {
    if (item.type == 'megaformTrait') {
      refreshMegaformsLinkedToActor(item.parent?.uuid);
    }

    /* Gear/Perk items can carry a visionGrant (Night Vision Goggles, etc.) - whenever one is
       added, changed, or removed, push the actor's freshly recomputed system.visionGrant
       (see Essence20Actor#_prepareVision()) onto its tokens so the token's actual Foundry
       vision updates to match. */
    if (item.parent instanceof Actor && (item.type == 'gear' || item.type == 'perk')) {
      applyVisionToTokens(item.parent);
    }
  });
}

for (const hookName of ["createActiveEffect", "updateActiveEffect", "deleteActiveEffect"]) {
  Hooks.on(hookName, (effect) => {
    /* Status toggles (Asleep, Unconscious, etc.) apply as ActiveEffects on the actor rather than
       Item changes, so they need their own hook to trigger the vision-grant push. syncAutoBlindStatus
       additionally keeps the real "blinded" status in sync with Asleep/Unconscious, reusing
       Foundry's own working Blind vision-block instead of reinventing it (see helpers/actor.mjs
       for why sight.enabled=false alone doesn't actually block a token's perception). This create/
       delete's its own ActiveEffect, which re-fires this same hook - safe since both functions are
       idempotent no-ops once the actor's state already matches. */
    const parent = effect.parent;
    if (parent instanceof Actor) {
      applyVisionToTokens(parent);
      syncAutoBlindStatus(parent);
    }
  });
}

/* Every DialogV2 (ours or Foundry core's own, e.g. the item-creation dialog) gets the same
   theme-wrapper light/dark theming as the system's actor/item sheets and apps. */
Hooks.on("renderDialogV2", (dialog, html) => {
  html.classList.add("essence20", "theme-wrapper", "window-app");
  applyThemeClass(html);
});

/* Hook to organize the item options by type */
Hooks.on("renderDialogV2", (dialog, html) => {
  if (html.innerText.includes("Create Item")) {
    const select = html.querySelector("select[name='type']");
    if (select) {
      const classFeatureOption = select.querySelector(
        "option[value='classFeature']",
      );
      if (classFeatureOption) {
        classFeatureOption.style.display = "none";
      }

      if (select) {
        select.append(
          setOptGroup(select, "Equipment", CONFIG.E20.equipmentTypes),
        );
        select.append(
          setOptGroup(select, "Background", CONFIG.E20.backgroundTypes),
        );
        select.append(
          setOptGroup(select, "Character Options", CONFIG.E20.characterTypes),
        );
        select.append(setOptGroup(select, "Other", CONFIG.E20.otherTypes));
      }
    }
  }
});

/* Hook to support Drag Rule module */
Hooks.once("dragRuler.ready", (SpeedProvider) => {
  class Essence20SystemSpeedProvider extends SpeedProvider {
    get colors() {
      return [
        { id: "ground", default: 0x00ff00, name: "essence20.speeds.ground" },
        { id: "sprint", default: 0xffff00, name: "essence20.speeds.sprint" },
      ];
    }

    getRanges(token) {
      const groundSpeed = token.actor.system.movement.ground.total;
      const ranges = [];
      const actor = game.actors.get(token.document.actorId);
      const numActions = getNumActions(actor);

      if (numActions.movement) {
        ranges.push({ range: groundSpeed, color: "ground" });
      }

      if (numActions.standard) {
        ranges.push({ range: groundSpeed * 2, color: "sprint" });
      }

      return ranges;
    }
  }

  dragRuler.registerSystem("essence20", Essence20SystemSpeedProvider);
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
  if (!("uuid" in data)) {
    return ui.notifications.warn(
      "You can only create macro buttons for owned Items",
    );
  }

  const item = await fromUuid(data.uuid);

  // Create the macro command
  const command = `game.essence20.rollItemMacro("${item._id}", "${item.name}");`;
  let macro = game.macros.find(
    (m) => m.name === item.name && m.command === command,
  );
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
  if (!item) {
    return ui.notifications.warn(
      `Your controlled Actor does not have an item named ${itemName}`,
    );
  }

  // Trigger the item roll
  return item.roll();
}

/*
 * Handle organizing selects by adding optGroups
 * @param {Select} select The select that you are organizing
 * @param {Category} category The category that we are adding to the options
 * @param {Items} items The types that you are putting in the category
 */
export function setOptGroup(select, category, items) {
  const options = select.querySelectorAll(":scope > option");
  const optGroup = document.createElement("optgroup");
  optGroup.label = category;

  for (const option of options) {
    if (items[option.value]) {
      optGroup.appendChild(option);
    }
  }

  return optGroup;
}
