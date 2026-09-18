// Import data models
import * as data from "./data/index.mjs";
import { createEffectMacro, toggleEffectMacro } from "./helpers/effects.mjs";
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
import { handleStoryPointGrantRequest, handleStoryPointSpendRequest } from "./helpers/story-points.mjs";
import { handleRemoteChoiceRequest, handleRemoteChoiceResponse } from "./helpers/remote-request.mjs";
// Registers the "chooseDefense" remote prompt against remote-request.mjs's own registry -
// imported for this side effect alone (see defense-choice.mjs's own registerRemotePrompt call at
// its bottom), same reason-for-import-with-no-named-use as any other registration-pattern file.
import "./helpers/defense-choice.mjs";
// Import Compendium Browser
import Essence20CompendiumBrowser from "./apps/compendium-browser.mjs";
import StatBlockImporter from "./apps/stat-block-importer.mjs";
import { canSwapTokenForm, swapTokenForm } from "./helpers/monster-grow-swap.mjs";
// Import helper/utility classes and constants.
import { addConsummatePerformerButton, addExploitWeaknessButton, addRerollButtons, addSpiteButton, addSufferButton, applyChatMessageSystemColor, attachCheckCardListeners, hideDifficultyForNonGm, highlightCriticalSuccessFailure } from "./chat.mjs";
import { syncSourcebookOwnership } from "./helpers/compendium-browser.mjs";
import { E20 } from "./helpers/config.mjs";
import { enrichCheck, onCheckLinkClick, onCheckSendToChat } from "./helpers/enrichers.mjs";
import { preloadHandlebarsTemplates } from "./helpers/templates.mjs";
import { applyVisionToTokens, getNumActions, syncAutoBlindStatus } from "./helpers/actor.mjs";
import { canUsePerk } from "./helpers/banked-buffs.mjs";
import { healStunAtTurnStart } from "./helpers/combat.mjs";
import { applyTimeToThinkEdge } from "./helpers/time-to-think.mjs";
import { healRegeneratingShellAtTurnEnd } from "./helpers/power-adaptation.mjs";
import { deactivateRushTheLineAtTurnEnd } from "./helpers/rush-the-line.mjs";
import { deactivateFrictionlessMovementAtTurnEnd } from "./helpers/frictionless-movement.mjs";
import { deactivateSprinterBoostAtTurnEnd } from "./helpers/sprinter-boost.mjs";
import { healUnbeatableAtTurnStart } from "./helpers/unbeatable.mjs";
import { applyBravado } from "./helpers/bravado.mjs";
import { applyHardCorpsDeferredDefeat } from "./helpers/hard-corps.mjs";
import { payMetallicArmorMaintenance } from "./helpers/metallic-armor.mjs";
import { isImmuneToCondition } from "./helpers/condition-immunity.mjs";
import { performPreLocalization } from "./helpers/localize.mjs";
import { migrateWorld } from "./migration.mjs";
import { applyThemeClass, refreshChatMessageThemes, registerSettings, refreshOpenThemeWrappers, setting } from "./settings.js";
import { updateRoleCache } from "./helpers/utils.mjs";
import { registerEssence20Tours, sweepTourDemoContent } from "./tours/index.mjs";
import { activateWelcomeOfferListeners, offerWelcomeTour } from "./tours/welcome-offer.mjs";

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
    toggleEffectMacro,
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

  // Clients (players) listen on the socket to update the UI whenever the GM changes values, and
  // (GI Joe CRB "In My Sights") a GM's own client listens for a PC's Story Point spend request -
  // see helpers/story-points.mjs's own doc comment for why that request has to go over the
  // socket at all. The tracker window being closed (game.StoryPointsTracker is then null) used
  // to crash this handler outright on an ordinary sync message; that's now handled too.
  game.socket.on("system.essence20", (data) => {
    if (data.action === "spendStoryPoints") {
      handleStoryPointSpendRequest(data);
    } else if (data.action === "grantStoryPoints") {
      handleStoryPointGrantRequest(data);
    } else if (data.action === "remoteChoiceRequest") {
      handleRemoteChoiceRequest(data);
    } else if (data.action === "remoteChoiceResponse") {
      handleRemoteChoiceResponse(data);
    } else {
      game.StoryPointsTracker?.handleStoryPointSignal(data);
    }
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

// Whether the Perks list should show a "Use" control for this item - see
// helpers/banked-buffs.mjs for the full registry (Think On It, Plan of Action) and what "Use"
// actually banks for each. A template-level check, the same idiom {{eq item.type "shield"}}
// already uses for the shield-activate icon right next to where this one renders.
Handlebars.registerHelper("canUsePerk", canUsePerk);

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

// Register the system's guided tours. This has to be "setup" rather than "init": game.tours exists
// from the Game constructor, but the Tour constructor reads game.i18n._fallback, which isn't
// populated until i18n.initialize() runs — which core does after "init" and before "setup".
Hooks.once("setup", registerEssence20Tours);

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

  // Remove demo actors from a tour that was interrupted rather than exited (refresh, crash).
  await sweepTourDemoContent();

  // Point first-time users at the guided tours, once per world.
  await offerWelcomeTour();

  // Wait to register hotbar drop hook on ready so that modules could register earlier if they want to
  Hooks.on("hotbarDrop", (bar, data, slot) => {
    // Both branches return false to suppress Foundry's own handling, which would otherwise make a
    // generic "toggle this document's sheet" macro (Hotbar##onDragDrop -> _createDocumentSheetToggle).
    // ActiveEffect was listed here from the start but only ever reached createItemMacro, which
    // returns early for a non-Item - so dropping an effect silently did nothing.
    if (data.type === "Item") {
      createItemMacro(data, slot);
      return false;
    }

    if (data.type === "ActiveEffect") {
      createEffectMacro(data, slot);
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

// The same footer treatment on the Actors tab, for the Stat Block Importer. GM-only: it creates
// world Actors, which a player couldn't do anyway, so showing them the button would just be a
// button that errors.
function addStatBlockImporterFooterButton(app, html) {
  if (!game.user.isGM) {
    return;
  }

  const footer = html.querySelector('[data-application-part="footer"]');
  if (!footer || footer.querySelector(".essence20-open-stat-block-importer")) {
    return;
  }

  const button = document.createElement("button");
  button.type = "button";
  button.classList.add("essence20-open-stat-block-importer");
  button.innerHTML = `<i class="fa-solid fa-file-import" inert></i><span>${game.i18n.localize("E20.StatBlockImportOpenTooltip")}</span>`;
  button.addEventListener("click", () => {
    new StatBlockImporter().render(true);
  });

  footer.appendChild(button);
}

Hooks.on("renderActorDirectory", addStatBlockImporterFooterButton);

/**
 * "Make My Monster Grow" on the token HUD - the in-combat half (mode B). Only offered for a
 * token whose Threat actually has a linked other form, so the HUD stays clean for everything
 * else, and only to a GM, since the swap rewrites a Token and a Combatant.
 */
Hooks.on("renderTokenHUD", (hud, html) => {
  if (!game.user.isGM || !canSwapTokenForm(hud.document)) {
    return;
  }

  const column = html.querySelector(".col.right") ?? html.querySelector(".col.left");
  if (!column || column.querySelector(".essence20-monster-grow")) {
    return;
  }

  const isGrown = Boolean(hud.document.actor?.getFlag("essence20", "normalFormId"));
  const button = document.createElement("button");
  button.type = "button";
  button.classList.add("control-icon", "essence20-monster-grow");
  button.dataset.tooltip = game.i18n.localize(isGrown
    ? "E20.MonsterGrowShrinkTooltip" : "E20.MonsterGrowSwapTooltip");
  button.innerHTML = `<i class="fa-solid fa-${isGrown ? "down-left-and-up-right-to-center" : "up-right-and-down-left-from-center"}"></i>`;
  button.addEventListener("click", async () => {
    const swapped = await swapTokenForm(hud.document);
    if (swapped) {
      ui.notifications.info(game.i18n.format("E20.MonsterGrowSwapped", { name: swapped.name }));
    }
  });

  column.appendChild(button);
});

Hooks.on("renderChatMessageHTML", (app, html, data) => {
  highlightCriticalSuccessFailure(app, html, data);
  addRerollButtons(app, html);
  addConsummatePerformerButton(app, html);
  addSpiteButton(app, html);
  addSufferButton(app, html);
  addExploitWeaknessButton(app, html);
  attachCheckCardListeners(app, html);
  hideDifficultyForNonGm(app, html);
  applyChatMessageSystemColor(app, html);
  activateWelcomeOfferListeners(app, html);
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

/* Condition immunity (e.g. Caution, GI Joe CRB p.110 - see helpers/condition-immunity.mjs for the
   full Perk-to-Conditions table). Statuses (Frightened, Stunned, etc.) apply to an actor as
   ActiveEffects, the same mechanism the createActiveEffect/updateActiveEffect/deleteActiveEffect
   hooks just below already rely on - preCreateActiveEffect fires before that document is actually
   created, and returning false here cancels it outright, so an immune actor's status never
   applies in the first place rather than being reactively stripped back off afterward. */
Hooks.on("preCreateActiveEffect", (effect) => {
  const actor = effect.parent;
  if (!(actor instanceof Actor)) {
    return true;
  }

  for (const statusId of effect.statuses ?? []) {
    if (isImmuneToCondition(actor, statusId)) {
      const statusLabel = CONFIG.statusEffects.find(s => s.id == statusId)?.name ?? statusId;
      ui.notifications.warn(game.i18n.format("E20.ConditionImmuneWarning", {
        actor: actor.name,
        condition: game.i18n.localize(statusLabel),
      }));

      return false;
    }
  }

  return true;
});

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

/* Stun (damage type): "heal 1 per turn" - see healStunAtTurnStart's own doc comment for why this
   reads as the Stunned creature's OWN turn, not a once-per-round tick for everyone. combatTurn
   fires when the turn advances within a round; combatRound fires instead of combatTurn when the
   round itself advances (wrapping back to the first combatant) - both are needed to catch every
   turn change, but combatStart (the very first turn of a brand-new combat) is deliberately not
   hooked, so that one specific first turn doesn't get a heal tick - a minor, documented gap rather
   than a third near-identical hook for an edge case. Both hooks fire BEFORE the Combat document's
   own turn/round properties are updated (confirmed live - combat.turn/combat.combatant still
   reflect the OLD, ending turn at hook-fire-time), so the new combatant has to be looked up via
   updateData.turn against combat.turns instead of the (stale) combat.combatant getter. */
for (const hookName of ["combatTurn", "combatRound"]) {
  Hooks.on(hookName, (combat, updateData) => {
    const actor = combat.turns[updateData.turn]?.actor;
    if (actor) {
      healStunAtTurnStart(actor);

      // Metallic Armor Power Up! (Through the Shattered Grid, Grid Power, p.26) - "costs 1
      // Personal Power at the start of each subsequent turn to maintain" - see
      // payMetallicArmorMaintenance's own doc comment for what this does and doesn't cover.
      payMetallicArmorMaintenance(actor);

      // Unbeatable (GI Joe CRB, Renegade base, 11th level, p.97) - see
      // healUnbeatableAtTurnStart's own doc comment.
      healUnbeatableAtTurnStart(actor);
    }

    // Power Adaptation - Regenerating Shell (Across the Stars, Silver Ranger, 9th/18th level,
    // p.57) - "restore 1 Health at the end of each of your turns." Unlike healStunAtTurnStart
    // above (the NEW turn's own actor), this reads combat.combatant BEFORE the update commits -
    // still the OLD, ENDING turn's actor at hook-fire-time (confirmed live, see the comment
    // above) - exactly the actor whose turn is ending, which is what "at the end of each of
    // your turns" means here.
    const endingActor = combat.combatant?.actor;
    if (endingActor) {
      healRegeneratingShellAtTurnEnd(endingActor);

      // Rush the Line (Factions in Action Vol. 2, Renegade Focus, p.68) - see
      // deactivateRushTheLineAtTurnEnd's own doc comment. Same "read combat.combatant BEFORE the
      // update commits" idiom as Regenerating Shell just above.
      deactivateRushTheLineAtTurnEnd(endingActor);

      // Frictionless Movement (Technorganic Secrets, Mutant Beast Influence Perk, p.47) - see
      // deactivateFrictionlessMovementAtTurnEnd's own doc comment. Same "read combat.combatant
      // BEFORE the update commits" idiom as Rush the Line just above.
      deactivateFrictionlessMovementAtTurnEnd(endingActor);

      // Sprinter (Technorganic Secrets, Hunter's Prowess Quadruped Origin choice, p.44) - see
      // deactivateSprinterBoostAtTurnEnd's own doc comment. Same "read combat.combatant BEFORE the
      // update commits" idiom as Frictionless Movement just above.
      deactivateSprinterBoostAtTurnEnd(endingActor);
    }
  });
}

/* Time To Think (MLP Magic, 3rd level) - see applyTimeToThinkEdge's own doc comment. Checked once,
   when combat actually begins, by which point every combatant's Initiative should already be
   set. */
Hooks.on("combatStart", (combat) => {
  applyTimeToThinkEdge(combat);

  // Bravado (GI Joe CRB, Renegade base, 13th level, p.97) - see applyBravado's own doc comment.
  applyBravado(combat);
});

/* Hard Corps (Sgt Slaughter Sourcebook, Marine Origin Benefit, p.8) - see
   applyHardCorpsDeferredDefeat's own doc comment. deleteCombat (fired when a GM ends/deletes the
   encounter) is this codebase's own first "combat has ended" signal - every other "until the end
   of the scene" clause elsewhere in this project has so far just gone unenforced rather than
   needing this. */
Hooks.on("deleteCombat", (combat) => {
  applyHardCorpsDeferredDefeat(combat);
});

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
