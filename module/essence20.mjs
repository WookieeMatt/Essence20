import { runChatDecorators as runExtChatDecorators, runMissionAdvanced, runSceneAdvanced } from "./mechanics/item-hooks.mjs";
// Every extension module registers itself on import (items/index.mjs).
import "./items/index.mjs";
// Item rules (system.rules) - one more extension, plus their add/remove lifecycle (docs/RULES_ENGINE_PLAN.md).
import "./rules/adapter.mjs";
import "./rules/lifecycle.mjs";
import "./rules/triggers.mjs";
import "./rules/buttons.mjs";
import "./rules/reactions.mjs";
import "./rules/actions.mjs";
import { linkExistingCopies, loadSourceIndexes } from "./rules/inherit.mjs";
import { registerRuleHelper } from "./rules/code.mjs";
import { registerCheck, setWorldLookups } from "./rules/predicate.mjs";
import { useAllyLookup } from "./rules/links.mjs";
import { hasActiveEnvironmentalExpertise, isKnownOutsideEnvironmentOfExpertise } from "./mechanics/world/environmental-expertise.mjs";
import { isCannoneerDugIn } from "./items/defenses/cannoneer-dig-in.mjs";
import { isBulwarkActive } from "./items/defenses/bulwark.mjs";
import { isSkiing } from "./items/movement/skier.mjs";
import { hasNearbyDefeatedAlly } from "./items/movement/field-aid.mjs";
import { isGravityOptionalActive } from "./items/movement/gravity-optional.mjs";
import { isWisdomOfTheEldersActive } from "./items/forms/wisdom-of-the-elders.mjs";
import { isMonsterFormActive } from "./items/forms/monster-morph.mjs";
import { isWarriorModeActive } from "./items/zords/warrior-mode.mjs";
import { isHighGearActive } from "./items/zords/high-gear.mjs";
import { isTheToughGetGoingActive } from "./items/movement/the-tough-get-going.mjs";
import { isEnergyAffinityElementAttack } from "./items/attacks/energy-affinity.mjs";
import { hasDefeatedAllyInReach } from "./items/defenses/not-on-my-watch.mjs";
import { isDecepticonNemesis, isNemesisInScene } from "./items/rolls/nemesis-decepticon.mjs";
import { isMultipleTargetsWeapon } from "./mechanics/combat/multiple-targets.mjs";
import { favoriteWeaponOf } from "./items/shared/condition-damage-buttons.mjs";
import { isPersonalShieldActive } from "./items/defenses/personal-shield.mjs";
import { hasComputerizedGear } from "./items/attacks/electromagnetic-vs-computerized.mjs";
import { isNonMystical } from "./items/magic/mystic-non-mystical.mjs";
import { hasMedicineKit } from "./items/healing/medicine-kit.mjs";
import { shapeOf as mlpShapeOf } from "./items/forms/pony-shape-shifting.mjs";
import { isDsoeDisguiseActive } from "./items/magic/disguise-spell.mjs";
import { grappleEscapeSkills } from "./mechanics/combat/grappled-snag.mjs";
import { isInfiltrating } from "./items/senses/infiltrating.mjs";
import { prerequisiteText } from "./rules/prerequisites.mjs";
import { isRecklessAbandonActive } from "./items/rolls/reckless-abandon.mjs";
import { noticeEssenceBases } from "./mechanics/vehicles/machine-essences.mjs";
import "./rules/plugins/index.mjs";
import { setStoryPointHelpers } from "./rules/steps.mjs";
import { canSpendForActor, canWriteStoryPoints, poolFor, requestStoryPointGrant, spendForActor } from "./mechanics/resources/story-points.mjs";
import { getEnvironment, getTerrain } from "./mechanics/world/environment.mjs";
import { getNearbyAllyTokens } from "./mechanics/combat/nearby-allies.mjs";
import { getLedger } from "./mechanics/actions/action-economy.mjs";
import * as sit2 from "./items/shared/situation-checks.mjs";

// The rules engine's terrain: and environment: tags read where an actor is through these.
setWorldLookups({
  terrain: actor => getTerrain(actor),
  environment: actor => getEnvironment(actor),
  environmentOutside: actor => getEnvironment(actor, { includeInterior: false }),
  recklessAbandon: actor => isRecklessAbandonActive(actor),
  isAiming: actor => isAiming(actor),
  alliesWithin: (actor, feet) => getNearbyAllyTokens(actor, feet).map(token => token.actor),
  actionLedger: actor => getLedger(actor),
});
useAllyLookup();

// The rules engine's `check:<name>` tags - state the system's own helpers keep (rules/predicate.mjs#CHECK_NAMES).
for (const [name, fn] of Object.entries({
  environmentalExpertise: actor => hasActiveEnvironmentalExpertise(actor),
  cannoneerDugIn: actor => isCannoneerDugIn(actor),
  bulwark: actor => isBulwarkActive(actor),
  rushTheLine: actor => isRushTheLineActive(actor),
  sprinterBoost: actor => isSprinterBoostActive(actor),
  skiing: actor => isSkiing(actor),
  nearbyDefeatedAlly: actor => hasNearbyDefeatedAlly(actor),
  frictionlessMovement: actor => isFrictionlessMovementActive(actor),
  gravityOptional: actor => isGravityOptionalActive(actor),
  wisdomOfTheElders: (actor, option) => isWisdomOfTheEldersActive(actor, option),
  monsterForm: actor => isMonsterFormActive(actor),
  warriorMode: actor => isWarriorModeActive(actor),
  powerAdaptation: (actor, option) => isPowerAdaptationActive(actor, option),
  highGear: actor => isHighGearActive(actor),
  theToughGetGoing: actor => isTheToughGetGoingActive(actor),
  energyAffinityAttack: (actor, option, ctx) => isEnergyAffinityElementAttack(actor, ctx?.item),
  // An equipped weapon with the Fire trait ("wielding" - Wildfire).
  equippedFireWeapon: actor => !!actor?.items?.find(item => item.type == 'weapon' && item.system.equipped && item.system.traits?.includes('fire')),
  defeatedAllyInReach: actor => hasDefeatedAllyInReach(actor),
  // The other party is this actor's Decepticon Nemesis (Nemesis Perk / Hang-Up).
  decepticonNemesis: (actor, option, ctx) => (ctx?.other ? isDecepticonNemesis(actor, ctx.other) : null),
  nemesisInScene: actor => isNemesisInScene(actor),
  multipleTargetsWeapon: (actor, option, ctx) => (ctx?.item ? isMultipleTargetsWeapon(actor, ctx.item) : null),
  // The Favorite Weapon (Transformers One): equipped, or the weapon this roll's effect belongs to.
  favoriteWeaponEquipped: actor => !!favoriteWeaponOf(actor)?.system?.equipped,
  favoriteWeaponRolled: (actor, option, ctx) => {
    const weapon = favoriteWeaponOf(actor);
    return !!weapon && !!ctx?.item && (ctx.item.id == weapon.id || ctx.item.flags?.essence20?.parentId == weapon.id);
  },
  // A Zord / vehicle with someone in the driver's seat.
  zordHasDriver: actor => !!getVehicleDriver(actor),
  personalShield: actor => isPersonalShieldActive(actor),
  // Robot, part Perks, or worn computerized gear (Machinesmith, Dielectric, Insulator).
  computerizedGear: actor => hasComputerizedGear(actor),
  // Known to be outside the environment of expertise (Stalk).
  outsideEnvironmentOfExpertise: actor => isKnownOutsideEnvironmentOfExpertise(actor),
  nonMystical: actor => isNonMystical(actor),
  // Carries a Science (Medicine) kit (Proper Protection).
  medicineKit: actor => hasMedicineKit(actor),
  // A changed shape this scene (MLP shape-shifting) / a disguise (Identity Crisis).
  shapeShifted: actor => !!mlpShapeOf(actor),
  disguised: actor => isDsoeDisguiseActive(actor),
  // The rolled Skill is one this actor uses to break free of a grapple (its game line's list).
  grappleEscape: (actor, option, ctx) => (ctx?.rolledSkill ? grappleEscapeSkills(actor).includes(ctx.rolledSkill) : null),
  // The Infiltrating toggle is on (Shadow / Silent Strider).
  infiltrating: actor => isInfiltrating(actor),
  // Where the actor is (situational2's readings): in the water (underwater or swimming), on land, at sea or in wetlands
  // (or aboard an aquatic vessel), aboard one, in complete darkness (unknown below full scene darkness).
  inWater: actor => sit2.isInWater(actor),
  onLand: actor => sit2.isOnLand(actor),
  seaOrWetlands: actor => sit2.isSeaOrWetlands(actor),
  aboardAquaticVessel: actor => sit2.isAboardAquaticVessel(actor),
  completeDarkness: actor => sit2.isCompleteDarkness(actor),
})) {
  registerCheck(name, fn);
}

// Story Point costs and gains in rule steps go through the same helpers as the hand-written ones.
setStoryPointHelpers({ canSpendForActor, canWriteStoryPoints, poolFor, requestStoryPointGrant, spendForActor });
import { decorateSocialCard, onGroupResultChanged } from "./items/social/social-cards.mjs";
import { onMorphChanged } from "./mechanics/actions/team-actions.mjs";
import { onInitiativeRolled } from "./mechanics/actions/commands.mjs";
import { allegianceLeft, isContactAvailable } from "./mechanics/companions/contacts.mjs";
import { dismissSceneSummons } from "./mechanics/companions/summons.mjs";
import { startGroupTest } from "./mechanics/rolls/group-tests.mjs";
import { onKitCreated } from "./mechanics/resources/kits.mjs";
import { sweepTemporary } from "./items/attacks/weapon-perk-uses.mjs";
import { checkSuppressingEntry, decorateRiderCard, decorateSuppressCard, stampConditionSource } from "./mechanics/combat/target-riders.mjs";
import { decorateSaveCard } from "./mechanics/combat/save-riders.mjs";
import { decorateCombinedCard } from "./mechanics/actions/combined-weapons.mjs";
import { checkProximityBombs, decorateBombCard } from "./items/attacks/planted-bombs.mjs";
// Import data models
import EffectWizard from "./apps/effect-wizard.mjs";
import { addEffectKeyWarnings } from "./mechanics/characters/effect-key-warnings.mjs";
import { auditEffectCatalog, probeClobberedKeys } from "./mechanics/characters/effect-catalog-audit.mjs";
import * as data from "./data/index.mjs";
import { createEffectMacro, toggleEffectMacro } from "./mechanics/characters/active-effect-controls.mjs";
// Import document classes.
import { Essence20Actor } from "./documents/actor.mjs";
import { Essence20Actors } from "./documents/actors.mjs";
import { Essence20ActorDirectory } from "./apps/essence20-actor-directory.mjs";
import { registerBlindsightDetectionMode } from "./items/senses/blindsight.mjs";
import { Essence20Combat } from "./documents/combat.mjs";
import { Essence20TokenDocument } from "./documents/token.mjs";
import { Essence20CombatTracker } from "./apps/combat-tracker.mjs";
import { Essence20TokenRuler } from "./canvas/token-ruler.mjs";
import { Essence20Combatant } from "./documents/combatant.mjs";
import { Essence20Item } from "./documents/item.mjs";
// Import sheet classes.
import { Essence20CharacterActorSheet } from "./sheets/character-sheet.mjs";
import { Essence20CompanionActorSheet } from "./sheets/companion-sheet.mjs";
import { Essence20NPCActorSheet } from "./sheets/npc-sheet.mjs";
import { Essence20MegaformActorSheet } from "./sheets/megaform-sheet.mjs";
import { Essence20PartyActorSheet } from "./sheets/party-sheet.mjs";
import { Essence20VehicleActorSheet } from "./sheets/vehicle-sheet.mjs";
import { Essence20ZordActorSheet } from "./sheets/zord-sheet.mjs";
import { Essence20ItemSheet } from "./sheets/item-sheet.mjs";
// Import StoryPoints
import { getPointsName, StoryPoints } from "./apps/story-points.mjs";
import { handleStoryPointGrantRequest, handleStoryPointSpendRequest } from "./mechanics/resources/story-points.mjs";
import { ensurePrimaryParty } from "./mechanics/resources/party.mjs";
import { expireCircleAtTurnEnd } from "./items/social/friendship-circle.mjs";
import { handleRemoteChoiceRequest, handleRemoteChoiceResponse } from "./mechanics/world/remote-request.mjs";
import { handleSetActionLedger, isAiming } from "./mechanics/actions/action-economy.mjs";
// Registers the "chooseDefense" remote prompt against remote-request.mjs's own registry -
// imported for this side effect alone (see defense-choice.mjs's own registerRemotePrompt call at
// its bottom), same reason-for-import-with-no-named-use as any other registration-pattern file.
import "./mechanics/combat/defense-choice.mjs";
// Import Compendium Browser
import Essence20CompendiumBrowser from "./apps/compendium-browser.mjs";
import StartingEssences from "./apps/starting-essences.mjs";
import StatBlockImporter from "./apps/stat-block-importer.mjs";
import ThreatBuilder from "./apps/threat-builder.mjs";
import { canSwapTokenForm, swapTokenForm } from "./mechanics/characters/monster-grow-swap.mjs";
// Import helper/utility classes and constants.
import { addConsummatePerformerButton, addDefenseBoostButton, addHighDensityButton, addRerollButtons, applyChatMessageSystemColor, attachCheckCardListeners, hideDifficultyForNonGm, highlightCriticalSuccessFailure, runChatDecorators } from "./chat.mjs";
import { syncSourcebookOwnership } from "./util/compendium-browser.mjs";
import { E20 } from "./util/config.mjs";
import { enrichCheck, onCheckLinkClick, onCheckSendToChat } from "./util/enrichers.mjs";
import { preloadHandlebarsTemplates } from "./util/templates.mjs";
import { applyVisionToTokens } from "./mechanics/world/token-sync.mjs";
import { getNumActions } from "./mechanics/actions/action-counts.mjs";
import { syncAutoBlindStatus, syncAutoImmobilizedStatus } from "./mechanics/combat/linked-status-sync.mjs";
import { canUsePerk, hasItemUse } from "./mechanics/resources/banked-buffs.mjs";
import { canUsePower } from "./mechanics/characters/power-use.mjs";
import { getWeaponEffectDamages } from "./mechanics/combat/damage-display.mjs";
import { getSummonReadyRound, isSummonReady } from "./mechanics/vehicles/zord-summon.mjs";
import { getVehicleDriver, healStunAtTurnStart } from "./mechanics/combat/combat.mjs";
import { healRegeneratingShellAtTurnEnd, isPowerAdaptationActive } from "./items/forms/power-adaptation.mjs";
import { isRushTheLineActive } from "./items/movement/rush-the-line.mjs";
import { isFrictionlessMovementActive } from "./items/movement/frictionless-movement.mjs";
import { applyOngoingEffectsAtTurnEnd } from "./mechanics/combat/ongoing-effects.mjs";
import { isSprinterBoostActive } from "./items/movement/sprinter-boost.mjs";
import { isImmuneToCondition } from "./mechanics/combat/condition-immunity.mjs";
import { performPreLocalization } from "./util/localize.mjs";
import { migrateWorld } from "./migration.mjs";
import { expireAoeRegions, expireAoeRegionsForScene, reconcileAoeRegions } from "./mechanics/combat/aoe-expiry.mjs";
import { applyThemeClass, insertSettingGroupHeadings, migrateSheetThemeSetting, refreshChatMessageThemes, registerSettings, refreshOpenThemeWrappers, setting } from "./settings.js";
import { updateRoleCache } from "./util/utils.mjs";
import { registerEssence20Tours, sweepTourDemoContent } from "./tours/index.mjs";
import { activateWelcomeOfferListeners, offerWelcomeTour } from "./tours/welcome-offer.mjs";
import { registerExoFrameHooks } from "./items/defenses/exo-frame.mjs";
import {
  ENVIRONMENT_REGION_BEHAVIOR_TYPE, EnvironmentRegionBehaviorType, injectEnvironmentSceneConfigField,
  refreshTerrainDependentActor,
} from "./mechanics/world/environment.mjs";
import { handleCreateRoughTerrainRequest, makeEssence20TerrainData } from "./mechanics/world/rough-terrain.mjs";
import { configureMovementActions } from "./mechanics/combat/token-movement.mjs";
import { applyEnvironmentAtSceneEnd } from "./mechanics/world/environment-hazards.mjs";
import { wireEnvironmentLevelSelects } from "./mechanics/world/environment-levels.mjs";
import { handleGmCreateRequest, handleGmRelayDone, handleGmRelayRequest } from "./mechanics/world/gm-relay.mjs";
import { formatDailyUses } from "./mechanics/resources/nanomite-uses.mjs";
import { getGearNanomitePowerName, getGearNanomiteUsesLeft, isGearNanomiteInert } from "./items/gear/nanomite-gear.mjs";
import {
  decorateTokenHudVesselConditions, handleVesselConditionStacksRequest, isVesselCondition,
  shouldBlockZordVesselCondition, syncVesselConditionConsequences,
} from "./mechanics/vehicles/vessel-conditions.mjs";
import { makeEssence20Token } from "./canvas/token.mjs";

function registerSystemSettings() {
  game.settings.register("essence20", "systemMigrationVersion", {
    config: false,
    scope: "world",
    type: String,
    default: "",
  });

  // Whether the GMs have been told which Zords / Vehicles have Features changing an Essence, since their Essences
  // gained a typed base (mechanics/vehicles/machine-essences.mjs).
  game.settings.register("essence20", "machineEssenceBaseNotice", {
    config: false,
    scope: "world",
    type: Boolean,
    default: false,
  });

  // Which compendium items carried rules the last time existing copies were linked to them
  // (rules/inherit.mjs#linkExistingCopies) - the pass re-runs only when that set changes.
  game.settings.register("essence20", "rulesLinkSignature", {
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
  // Item automation notes ride in the compendium index, so a copy on an actor can show its
  // original's current notes without loading the compendium document (documents/item.mjs).
  CONFIG.Item.compendiumIndexFields = [...new Set([...(CONFIG.Item.compendiumIndexFields ?? []), 'system.automation', 'system.rules', 'system.prerequisites'])];

  // Blindsight needs its detection mode to exist before any token is drawn - see
  // items/senses/blindsight.mjs's own doc comment.
  registerBlindsightDetectionMode();

  // Add utility classes to the global game object so that they're more easily
  // accessible in global contexts.
  game.essence20 = {
    // Item rules' Code helpers - any module or world script can add one (rules/code.mjs).
    registerRuleHelper,
    // A Group Skill Test for the selected tokens (or the given actors) - mechanics/rolls/group-tests.mjs.
    groupSkillTest: (actors = null) => startGroupTest(actors),
    Essence20Actor,
    Essence20Combat,
    Essence20Combatant,
    Essence20Item,
    CompendiumBrowser: Essence20CompendiumBrowser,
    rollItemMacro,
    // Developer tooling: cross-checks the Effect Wizard's catalog against the actor DataModels it
    // claims to describe, in both directions. See mechanics/characters/effect-catalog-audit.mjs.
    auditEffectCatalog,
    // Live counterpart: applies each numeric key to a throwaway actor to catch fields derived
    // data silently overwrites, which no static check can see. Creates and deletes an Actor.
    probeClobberedKeys,
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
  CONFIG.Actor.collection = Essence20Actors;
  CONFIG.ui.actors = Essence20ActorDirectory;
  CONFIG.Combat.documentClass = Essence20Combat;
  CONFIG.Combatant.documentClass = Essence20Combatant;
  // Charges token movement against the action economy - see documents/token.mjs and
  // mechanics/combat/token-movement.mjs. Inert unless the world opts in to movement tracking.
  CONFIG.Token.documentClass = Essence20TokenDocument;
  // Remaining-action marks per combatant - see apps/combat-tracker.mjs. Draws nothing unless the
  // world is tracking the action economy.
  CONFIG.ui.combat = Essence20CombatTracker;
  // Live "this move will cost you N Free actions" on the drag ruler - see canvas/token-ruler.mjs.
  CONFIG.Token.rulerClass = Essence20TokenRuler;
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
  // descriptions and journal entries. See module/util/enrichers.mjs for the GM-only DIF
  // visibility rationale.
  CONFIG.TextEditor.enrichers.push({
    pattern: /@Check\[([^\]]+)\](?:\{([^}]+)\})?/g,
    enricher: enrichCheck,
  });

  // Register System Data Models
  CONFIG.Actor.dataModels = data.actor.config;
  CONFIG.ActiveEffect.dataModels = data.effect.config;
  CONFIG.Item.dataModels = data.item.config;

  /* Custom "Environment" Region Behavior - lets a GM override the scene's own default
     environment (Scene Config's "Basics" tab, see injectEnvironmentSceneConfigField below) for
     just part of a scene (e.g. a beach map's water) by drawing a Region over it. See
     mechanics/world/environment.mjs's own doc comment for the full precedence rules getEnvironment()
     reads back. */
  CONFIG.RegionBehavior.dataModels[ENVIRONMENT_REGION_BEHAVIOR_TYPE] = EnvironmentRegionBehaviorType;
  CONFIG.RegionBehavior.typeLabels[ENVIRONMENT_REGION_BEHAVIOR_TYPE] = "E20.RegionBehaviorEnvironmentLabel";
  CONFIG.RegionBehavior.typeHints[ENVIRONMENT_REGION_BEHAVIOR_TYPE] = "E20.RegionBehaviorEnvironmentHint";
  CONFIG.RegionBehavior.typeIcons[ENVIRONMENT_REGION_BEHAVIOR_TYPE] = "fa-solid fa-water";
  // Rough Terrain's doubled Movement cost - see mechanics/world/rough-terrain.mjs's own doc comment.
  CONFIG.Token.movement.TerrainData = makeEssence20TerrainData(CONFIG.Token.movement.TerrainData);
  // Climb/Jump costs and which actors can pick Fly/Burrow - see mechanics/combat/token-movement.mjs.
  configureMovementActions(CONFIG.Token.movement.actions);
  // Stack counts on status icons (Space Vessel Conditions) - see canvas/token.mjs.
  CONFIG.Token.objectClass = makeEssence20Token(CONFIG.Token.objectClass);

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
    Essence20PartyActorSheet,
    {
      types: ["party"],
      makeDefault: true,
      label: "Party",
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

  // A client that cannot write the primary Party itself asks the GM's client to spend or grant
  // a Story Point for it - see mechanics/resources/story-points.mjs. The totals themselves are no longer
  // broadcast here: they live on an Actor now, and reach every client through updateActor.
  game.socket.on("system.essence20", (data) => {
    if (data.action === "spendStoryPoints") {
      handleStoryPointSpendRequest(data);
    } else if (data.action === "grantStoryPoints") {
      handleStoryPointGrantRequest(data);
    } else if (data.action === "remoteChoiceRequest") {
      handleRemoteChoiceRequest(data);
    } else if (data.action === "remoteChoiceResponse") {
      handleRemoteChoiceResponse(data);
    } else if (data.action === "setActionLedger") {
      handleSetActionLedger(data);
    } else if (data.action === "createRoughTerrain") {
      handleCreateRoughTerrainRequest(data);
    } else if (data.action === "vesselConditionStacks") {
      handleVesselConditionStacksRequest(data);
    } else if (data.action === "gmRelay") {
      // Writes to a target the player doesn't own - see mechanics/world/gm-relay.mjs.
      handleGmRelayRequest(data);
    } else if (data.action === "gmCreate") {
      // Companion actors and tokens a player may not make - see mechanics/world/gm-relay.mjs.
      handleGmCreateRequest(data);
    } else if (data.action === "gmRelayDone") {
      handleGmRelayDone(data);
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
// mechanics/resources/banked-buffs.mjs for the full registry (Think On It, Plan of Action) and what "Use"
// actually banks for each. A template-level check, the same idiom {{eq item.type "shield"}}
// already uses for the shield-activate icon right next to where this one renders.
Handlebars.registerHelper("canUsePerk", canUsePerk);
Handlebars.registerHelper("hasItemUse", hasItemUse);
Handlebars.registerHelper("canUsePower", canUsePower);

// Call to Action (PR CRB, Zord Feature, p.136-137) - see mechanics/vehicles/zord-summon.mjs's own doc
// comment. Template-level checks (same idiom as canUsePerk/canUsePower just above) so
// system-actors.hbs can show a Summon control per zordActors row without pre-computing readiness
// for every attached actor in prepareSystemActors.
Handlebars.registerHelper("isZordSummonReady", isSummonReady);
Handlebars.registerHelper("zordSummonReadyRound", getSummonReadyRound);
// A Contact's Allegiance Points left this mission - mechanics/companions/contacts.mjs.
Handlebars.registerHelper("contactAllegiance", allegianceLeft);

// Both damages a weaponEffect deals (main + secondaryDamage) with an icon each - see
// mechanics/combat/damage-display.mjs. Used by the weapon row chips and the weaponEffect details card.
Handlebars.registerHelper("weaponEffectDamages", getWeaponEffectDamages);

// "1/2 today" for a power with a per-day limit (nanomite powers) - see mechanics/resources/nanomite-uses.mjs.
Handlebars.registerHelper("powerDailyUses", formatDailyUses);

// An item's (or an attached Upgrade entry's) prerequisites in words, from its tags - see rules/prerequisites.mjs.
Handlebars.registerHelper("prerequisiteText", item => prerequisiteText(item));

// Nanomite equipment's uses left and inert state - see items/gear/nanomite-gear.mjs.
Handlebars.registerHelper("gearNanomiteUsesLeft", getGearNanomiteUsesLeft);
Handlebars.registerHelper("isGearNanomiteInert", isGearNanomiteInert);
Handlebars.registerHelper("gearNanomitePowerName", getGearNanomitePowerName);

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
  // Compendium copies inherit their original's rules - load the indexes that carry them (rules/inherit.mjs).
  try {
    await loadSourceIndexes();
    await linkExistingCopies();
  } catch (error) {
    console.error("Essence20 | Loading compendium rules failed", error);
  }

  runMigrations();

  /* Client-scoped, so it cannot ride along with runMigrations() (which is the world-data pass a
     GM runs once for everyone) - every browser has its own copy to carry across. */
  await migrateSheetThemeSetting();

  /* Catch any lingering Area of Effect region that should have expired while nobody was logged in,
     or whose expiry was missed because no GM was connected at the time. */
  reconcileAoeRegions();

  /* Opt-in developer check that the Effect Wizard's catalog still matches the actor schemas -
     off by default, since it is noise for a player. Set CONFIG.debug.essence20Catalog = true (or
     call game.essence20.auditEffectCatalog() from the console at any time). */
  if (CONFIG.debug?.essence20Catalog) {
    auditEffectCatalog();
  }

  // Once per world: which Zords / Vehicles have Features changing an Essence (their base is the old stored number).
  try {
    await noticeEssenceBases();
  } catch (error) {
    console.error("Essence20 | Zord Essence notice failed", error);
  }

  // Remove demo actors from a tour that was interrupted rather than exited (refresh, crash).
  await sweepTourDemoContent();

  // Point first-time users at the guided tours, once per world.
  await offerWelcomeTour();

  /* The Story Point pool lives on the primary Party, so one has to exist before the tracker
     below opens. A new world gets its Party here; an older one gets its points moved over. */
  await ensurePrimaryParty();

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

  // The Threat Builder beside it - the books' threat creation rules as a step-by-step window.
  const builder = document.createElement("button");
  builder.type = "button";
  builder.classList.add("essence20-open-threat-builder");
  builder.innerHTML = `<i class="fa-solid fa-dragon" inert></i><span>${game.i18n.localize("E20.ThreatBuilderOpen")}</span>`;
  builder.addEventListener("click", () => ThreatBuilder.open());
  footer.appendChild(builder);
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

Hooks.on("renderChatMessageHTML", (app, html) => {
  // Each one runs on its own, so an error in one can't stop the rest - see chat.mjs#runChatDecorators.
  runChatDecorators([
    highlightCriticalSuccessFailure,
    addRerollButtons,
    addDefenseBoostButton,
    addConsummatePerformerButton,
    addHighDensityButton,
    decorateBombCard,
    decorateCombinedCard,
    decorateSaveCard,
    decorateRiderCard,
    // Group Skill Tests, Contacts, Issue Command, team cards - items/social/social-cards.mjs.
    decorateSocialCard,
    // Extension chat decorators and data-e20-ext buttons (mechanics/item-hooks.mjs).
    runExtChatDecorators,
    decorateSuppressCard,
    attachCheckCardListeners,
    hideDifficultyForNonGm,
    applyChatMessageSystemColor,
    activateWelcomeOfferListeners,
    // Namespaces the message so _chat.scss can scope its envelope rules to our own cards
    // rather than styling every message in a shared chat log.
    function namespaceChatMessage(message, element) {
      element.classList.add("essence20");
      applyThemeClass(element);
    },
  ], app, html);
});

// @Check[...] links (module/util/enrichers.mjs) can appear in item/actor descriptions and
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

Hooks.on("updateActor", (actor, changed, options, userId) => {
  refreshMegaformsLinkedToActor(actor.uuid);
  refreshStoryPointsTracker(actor);
  // A Group Skill Test result landed - redraw its card (items/social/social-cards.mjs).
  onGroupResultChanged(changed);
  // Team Player's lent Boons and Morphin Pet follow the Morph (mechanics/actions/team-actions.mjs).
  if (userId == game.user.id && foundry.utils.hasProperty(changed ?? {}, 'system.isMorphed')) {
    onMorphChanged(actor, !!actor.system?.isMorphed);
  }
});

// The First Rule Of Soldiering: a free Issue Command on the Initiative roll
// (mechanics/actions/commands.mjs).
Hooks.on("updateCombatant", (combatant, changed, options, userId) => {
  if (userId == game.user.id && changed?.initiative != null && combatant.actor) {
    onInitiativeRolled(combatant.actor);
  }
});

// A new mission: Contacts' Allegiance Points are fresh (they read the mission), and temporary Contacts
// leave (mechanics/companions/contacts.mjs).
Hooks.on("essence20.missionAdvanced", async (epoch) => {
  if (!game.users.activeGM?.isSelf) {
    return;
  }

  await runMissionAdvanced(epoch);

  for (const actor of game.actors ?? []) {
    if (actor.flags?.essence20?.temporaryContact && !isContactAvailable(actor)) {
      await actor.delete();
    }
  }
});

/**
 * The Story Points tracker shows the primary Party's points, so it follows that Party: any
 * change to it, from any client, re-renders the window everywhere. Creation and deletion are
 * included because a new world's first Party, or a reassigned primary, changes what it shows.
 * @param {Actor} actor
 */
function refreshStoryPointsTracker(actor) {
  if (actor.type == "party") {
    game.StoryPointsTracker?.render(false);
  }
}

Hooks.on("createActor", refreshStoryPointsTracker);

/**
 * A new player character opens straight onto spending its 12 starting Essence points, for the
 * user who made it only. Not for the guided tours' demo characters, which arrive fully built,
 * nor for a copy of a character that had already spent them (a duplicate keeps that).
 */
Hooks.on("createActor", (actor, options, userId) => {
  if (userId !== game.user.id || actor.type !== "playerCharacter") return;
  if (actor.system.essencesAssigned || actor.getFlag("essence20", "tourDemo")) return;

  StartingEssences.open(actor);
});
Hooks.on("deleteActor", refreshStoryPointsTracker);

for (const hookName of ["createItem", "updateItem", "deleteItem"]) {
  // userId is always the hook's last argument (createItem/updateItem carry an extra data/changes).
  Hooks.on(hookName, (item, ...args) => {
    const userId = args.at(-1);
    if (item.type == 'megaformTrait') {
      refreshMegaformsLinkedToActor(item.parent?.uuid);
    }

    /* Gear/Perk items can carry a visionGrant (Night Vision Goggles, etc.) - whenever one is
       added, changed, or removed, push the actor's freshly recomputed system.visionGrant
       (see Essence20Actor#_prepareVision()) onto its tokens so the token's actual Foundry
       vision updates to match. */
    // Only on the client that made the change - every client hears this hook, and a player's
    // client can't write an NPC's tokens.
    if (userId == game.user.id && item.parent instanceof Actor && (item.type == 'gear' || item.type == 'perk')) {
      applyVisionToTokens(item.parent);
    }

    // Who handed a consumable over (Take Mine) - mechanics/resources/kits.mjs.
    if (hookName == 'createItem' && userId == game.user.id && item.parent instanceof Actor && item.type == 'gear') {
      onKitCreated(item);
    }
  });
}

/* Condition immunity (e.g. Caution, GI Joe CRB p.110 - see mechanics/combat/condition-immunity.mjs for the
   full Perk-to-Conditions table). Statuses (Frightened, Stunned, etc.) apply to an actor as
   ActiveEffects, the same mechanism the createActiveEffect/updateActiveEffect/deleteActiveEffect
   hooks just below already rely on - preCreateActiveEffect fires before that document is actually
   created, and returning false here cancels it outright, so an immune actor's status never
   applies in the first place rather than being reactively stripped back off afterward. */
Hooks.on("preCreateActiveEffect", (effect, data) => {
  const actor = effect.parent;
  if (!(actor instanceof Actor)) {
    return true;
  }

  // Who caused a Frightened/Mesmerized - Worst Nightmare's "Frightened of you" and the mesmerizer's
  // Social Edge (mechanics/combat/target-riders.mjs).
  stampConditionSource(effect, data);

  // Zords can't be given Space Vessel Conditions (Across the Stars p.26) - see
  // mechanics/vehicles/vessel-conditions.mjs#shouldBlockZordVesselCondition for the GM's override.
  if (shouldBlockZordVesselCondition(actor, effect.statuses)) {
    ui.notifications.warn(game.i18n.localize("E20.VesselConditionZordBlocked"));
    return false;
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
       Foundry's own working Blind vision-block instead of reinventing it (see mechanics/world/token-sync.mjs
       for why sight.enabled=false alone doesn't actually block a token's perception). This create/
       delete's its own ActiveEffect, which re-fires this same hook - safe since both functions are
       idempotent no-ops once the actor's state already matches. */
    const parent = effect.parent;
    if (parent instanceof Actor) {
      applyVisionToTokens(parent);
      syncAutoBlindStatus(parent);
      // Restrained implies Immobilized (GI Joe CRB, Conditions, p.226) - see
      // syncAutoImmobilizedStatus's own doc comment.
      syncAutoImmobilizedStatus(parent);
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

      // (Metallic Armor Power Up!'s 1 Personal Power upkeep is a turnStart Trigger on the Power.)
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

      // (Rush the Line, Frictionless Movement and Sprinter end with turnEnd Triggers on their items.)

      // (Expanded Mysticism's Quicken ends with a turnEnd Trigger on its Perk.)

      // Friendship Circle (MLP CRB) - lasts to the end of its former's next turn. Same ending-actor idiom; items/social/friendship-circle.mjs decides.
      expireCircleAtTurnEnd(endingActor, combat);

      // Ongoing / Poison / Toxin (Cobra Codex, New Weapon Effects and Traits, p.93-94) - see
      // mechanics/combat/ongoing-effects.mjs's own doc comment. Same "read combat.combatant BEFORE the
      // update commits" idiom as Regenerating Shell/Rush the Line/Frictionless Movement above -
      // here, endingActor is sometimes the AFFECTED creature itself, which is exactly the "end of
      // their turn" RAW asks for.
      applyOngoingEffectsAtTurnEnd(endingActor);
    }
  });
}

/* (R.R.R. (Rapid Rescue Response)'s round-end heal for the Zord's crew is a roundStart Trigger on the Feature.) */

/* Action economy: repaint every open actor sheet when the turn changes, so the header pip row
   reflects the new turn's budget.

   combatTurnChange is Foundry v14's own post-update, all-clients companion to the GM-only
   Combat#_onStartTurn that does the authoritative ledger reset (see documents/combat.mjs). That
   split is the whole point: one client writes, every client re-renders. A plain re-render is
   enough because the pip row is built from the combatant's flags at render time, which the GM's
   write has already propagated by the time this fires. */
Hooks.on("combatTurnChange", () => {
  // foundry.applications.instances is v14's own ApplicationV2 registry, which is what every sheet
  // in this system is (the legacy ui.windows map only ever held AppV1 windows). Walking it rather
  // than game.actors also catches the sheet of an unlinked token's synthetic actor, which never
  // appears in the world collection - and unlinked tokens are exactly the combatants most likely
  // to be in an encounter.
  for (const app of foundry.applications.instances.values()) {
    if (app.rendered && app.document instanceof Actor) {
      app.render();
    }
  }
});

/* deleteCombat (fired when a GM ends/deletes the encounter): things that end with the combat. (Hard Corps' debt is a
   combatEnd Trigger on its item.) */
Hooks.on("deleteCombat", (combat) => {
  // Every client hears the combat end; the active GM alone writes the results below, so no player
  // client tries (and fails) to update an actor it doesn't own, and nothing is written twice.
  if (!game.users.activeGM?.isSelf) {
    return;
  }

  // Things that last "until the end of combat" (Manifest Melee Weapon, Riot Gear) go now.
  for (const combatant of combat.combatants ?? []) {
    if (combatant.actor) {
      sweepTemporary(combatant.actor);
    }
  }

  // (No Fighting?!'s Snag for the next Social test is a combatEnd Trigger rule on the Hang-Up.)

  /* Lingering Area of Effect regions whose duration is tied to the encounter rather than to a
     clock - "1 scene", plus any round-counting area that outlived the combat it was counting
     rounds in. See mechanics/combat/aoe-expiry.mjs. */
  expireAoeRegionsForScene();
});

/* World time moved, so a minutes/hours/days area may have run out. Fires on every client, but
   expireAoeRegions gates itself to the one designated GM - see mechanics/combat/aoe-expiry.mjs. */
Hooks.on("updateWorldTime", () => {
  expireAoeRegions();
});

/* Reaches the Effect Wizard from an effect that already exists, for adding another change to it
   later. Deliberately a header-control entry on Foundry's own ActiveEffectConfig rather than a
   subclassed sheet: the normal editor stays exactly as core renders it, for everyone who already
   knows the key vocabulary. ApplicationV2 dispatches getHeaderControls{ClassName} up the whole
   inheritance chain (client/applications/api/application.mjs#_headerControlButtons), and each
   entry may carry its own onClick - see docs/ACTIVE_EFFECTS_UI_PLAN.md §3. */
Hooks.on("getHeaderControlsActiveEffectConfig", (app, controls) => {
  controls.push({
    icon: "fa-solid fa-wand-magic-sparkles",
    label: "E20.EffectWizardTitle",
    action: "essence20EffectWizard",
    visible: () => app.isEditable,
    onClick: () => new EffectWizard(app.document).render(true),
  });
});

/* Flags a change key that will never apply, inline on Foundry's own effect sheet - see
   mechanics/characters/effect-key-warnings.mjs. Decoration only; the sheet itself is untouched. */
/* Draws the group headings over this system's own settings - see settings.js#SETTING_GROUPS.
   Decoration only: every setting still renders and behaves exactly as Foundry rendered it, so
   if this ever stops matching core's markup the settings list simply goes back to being flat. */
Hooks.on("renderSettingsConfig", (app, html) => {
  insertSettingGroupHeadings(html);
});

Hooks.on("renderActiveEffectConfig", (app, html) => {
  addEffectKeyWarnings(app, html);
});

// Scene-default-environment picker - see mechanics/world/environment.mjs's own doc comment.
Hooks.on("renderSceneConfig", (app, html) => {
  injectEnvironmentSceneConfigField(app, html);
  wireEnvironmentLevelSelects(html);
});

// Exo-Frame armor's Driving test prompt (Across the Stars p.85) - see items/defenses/exo-frame.mjs.
registerExoFrameHooks();

/* Space Vessel Conditions (Across the Stars p.25-26): Immobilized at two Sputtering/Spun-Out stacks,
   Defeated once Compromised reaches 0 maximum Health - kept in step however the status was added or
   removed (core's HUD toggle included). Only the user who made the change acts, so it happens once. */
for (const hookName of ["createActiveEffect", "updateActiveEffect", "deleteActiveEffect"]) {
  Hooks.on(hookName, (effect, ...rest) => {
    const userId = rest.at(-1);
    if (userId == game.user.id && effect.parent instanceof Actor && [...(effect.statuses ?? [])].some(isVesselCondition)) {
      syncVesselConditionConsequences(effect.parent);
    }
  });
}

// Stack counts and the Zord override on the token HUD's vessel Conditions.
Hooks.on("renderTokenHUD", (hud, html) => {
  decorateTokenHudVesselConditions(hud, html);
});

// The Environment Region Behavior's Severity list follows its chosen environment - see
// mechanics/world/environment-levels.mjs.
Hooks.on("renderRegionBehaviorConfig", (app, html) => {
  wireEnvironmentLevelSelects(html);
});

// Per-scene environmental damage (Irradiated, Harmful Toxic Atmosphere) when the GM starts a new
// scene - see mechanics/world/environment-hazards.mjs.
Hooks.on("essence20.sceneAdvanced", () => {
  // Scene-long summons: capsule vehicles, Battlizers, Toxo-Zombies and summoned allies
  // (mechanics/companions/summons.mjs). (Renegade Commander's grant is a timed addEffect, swept by the rules.)
  if (game.users.activeGM?.isSelf) {
    dismissSceneSummons();
  }

  if (game.users.activeGM?.isSelf) {
    runSceneAdvanced();
  }

  // Scene-long made and borrowed items (Never Unarmed, Volatile Delivery, Faction Reservist).
  if (game.users.activeGM?.isSelf) {
    for (const actor of game.actors ?? []) {
      if (actor.items?.some?.(item => item.flags?.essence20?.temporary)) {
        sweepTemporary(actor);
      }
    }
  }

  applyEnvironmentAtSceneEnd(canvas?.scene ?? game.scenes?.viewed ?? null);
});

// Terrain-dependent derived data (Prowl, Taking Point) - see refreshTerrainDependentActor.
Hooks.on("updateToken", (tokenDoc, changes) => {
  refreshTerrainDependentActor(tokenDoc, changes);
  // A Proximity Bomb goes off when someone moves into it (items/attacks/planted-bombs.mjs).
  if (changes.x !== undefined || changes.y !== undefined) {
    checkProximityBombs(tokenDoc);
    // Moving into someone's Suppressing Fire (mechanics/combat/target-riders.mjs).
    checkSuppressingEntry(tokenDoc);
  }
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
