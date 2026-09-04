import { preLocalize } from "./localize.mjs";

export const E20 = {};

/************************************************
 * System Version                               *
 ***********************************************/

// Game Versions
E20.gameVersions = {
  giJoe: "E20.VersionGIJoe",
  myLittlePony: "E20.VersionMyLittlePony",
  powerRangers: "E20.VersionPowerRangers",
  transformers: "E20.VersionTransformers",
  welcomeToNightVale: "E20.VersionWelcomeToNightVale",
};
preLocalize("gameVersions");

/************************************************
 * Defense                                      *
 ***********************************************/

// Essence-based defenses
// Area of Effect shape (GitHub #824) - see data/item/weapon-effect.mjs's own system.shape field
// and helpers/aoe-targeting.mjs for what each one actually does.
E20.weaponEffectShapes = {
  burst: "E20.WeaponShapeBurst",
  cone: "E20.WeaponShapeCone",
};
preLocalize("weaponEffectShapes");

E20.defenses = {
  cleverness: "E20.DefenseCleverness",
  evasion: "E20.DefenseEvasion",
  toughness: "E20.DefenseToughness",
  willpower: "E20.DefenseWillpower",
};
preLocalize("defenses");

/************************************************
 * Weapons                                      *
 ***********************************************/
E20.poisonApplications = {
  contact: "E20.PoisonApplicationContact",
  ingested: "E20.PoisonApplicationIngested",
  inhaled: "E20.PoisonApplicationInhaled",
};
preLocalize("poisonApplications");

E20.poisonTypes = {
  poison: "E20.PoisonTypePoison",
  toxin: "E20.PoisonTypeToxin",
};
preLocalize("poisonTypes");

E20.poisonTraining = {
  all: "E20.PoisonTrainingAll",
  standard: "E20.PoisonTrainingStandard",
  limited: "E20.PoisonTrainingLimited",
};
preLocalize("poisonTraining");

// Shifts required to use a weapon
E20.weaponRequirementShifts = {
  "none": "",
  "d2": "d2",
  "d4": "d4",
  "d6": "d6",
  "d8": "d8",
  "d10": "d10",
  "d12": "d12",
  "2d8": "2d8",
  "3d6": "3d6",
};

// Options for Weapon size
E20.weaponSizes = {
  integrated: "E20.WeaponSizeIntegrated",
  sidearm: "E20.WeaponSizeSidearm",
  light: "E20.WeaponSizeLight",
  medium: "E20.WeaponSizeMedium",
  long: "E20.WeaponSizeLong",
  heavy: "E20.WeaponSizeHeavy",
};
preLocalize("weaponSizes");

// Options for Weapon style
E20.weaponStyles = {
  melee: "E20.WeaponStyleMelee",
  energy: "E20.WeaponStyleEnergy",
  explosive: "E20.WeaponStyleExplosive",
  projectile: "E20.WeaponStyleProjectile",
};
preLocalize("weaponStyles");

// Options for Weapon trait
E20.weaponTraits = {
  accurate: "E20.WeaponTraitAccurate",
  acid: "E20.WeaponTraitAcid",
  amphibious: "E20.WeaponTraitAmphibious",
  antiTank: "E20.WeaponTraitAntiTank",
  aquatic: "E20.WeaponTraitAquatic",
  area: "E20.WeaponTraitArea",
  armorPiercing: "E20.WeaponTraitArmorPiercing",
  ballistic: "E20.WeaponTraitBallistic",
  blinding: "E20.WeaponTraitBlinding",
  blunt: "E20.WeaponTraitBlunt",
  burstFire: "E20.WeaponTraitBurstFire",
  bypassing: "E20.WeaponTraitBypassing",
  cold: "E20.WeaponTraitCold",
  combined: "E20.WeaponTraitCombined",
  components: "E20.WeaponTraitComponents",
  computerized: "E20.WeaponTraitComputerized",
  consumable: "E20.WeaponTraitConsumable",
  cover: "E20.WeaponTraitCover",
  defend: "E20.WeaponTraitDefend",
  electric: "E20.WeaponTraitElectric",
  electromagnetic: "E20.WeaponTraitElectormagnetic",
  energy: "E20.WeaponTraitEnergy",
  fanning: "E20.WeaponTraitFanning",
  fire: "E20.WeaponTraitFire",
  grapple: "E20.WeaponTraitGrapple",
  highDensity: "E20.WeaponTraitHighDensity",
  inaccurate: "E20.WeaponTraitInaccurate",
  indirect: "E20.WeaponTraitIndirect",
  inertial: "E20.WeaponTraitInertial",
  injection: "E20.WeaponTraitInjection",
  intimidating: "E20.WeaponTraitIntimidating",
  laser: "E20.WeaponTraitLaser",
  maneuver: "E20.WeaponTraitManeuver",
  marked: "E20.WeaponTraitMarked",
  martialArts: "E20.WeaponTraitMartialArts",
  modeLock: "E20.WeaponTraitModeLock",
  mounted: "E20.WeaponTraitMounted",
  multipleTargets: "E20.WeaponTraitMultipleTargets",
  mythicallyModular: "E20.WeaponTraitMythicallyModular",
  obfuscated: "E20.WeaponTraitObfuscated",
  ongoing: "E20.WeaponTraitOngoing",
  poison: "E20.WeaponTraitPoison",
  powerWeapon: "E20.WeaponTraitPowerWeapon",
  psychic: "E20.WeaponTraitPsychic",
  reload: "E20.WeaponTraitReload",
  retrogen: "E20.WeaponTraitRetrogen",
  seeking: "E20.WeaponTraitSeeking",
  sharp: "E20.WeaponTraitSharp",
  shove: "E20.WeaponTraitShove",
  silent: "E20.WeaponTraitSilent",
  sniper: "E20.WeaponTraitSniper",
  sonic: "E20.WeaponTraitSonic",
  spot: "E20.WeaponTraitSpot",
  stun: "E20.WeaponTraitStun",
  temperamental: "E20.WeaponTraitTemperamental",
  thrown: "E20.WeaponTraitThrown",
  tool: "E20.WeaponTraitTool",
  toxin: "E20.WeaponTraitToxin",
  titanClass: "E20.WeaponTraitTitanClass",
  trip: "E20.WeaponTraitTrip",
  vehicular: "E20.WeaponTraitVehicular",
  versatile: "E20.WeaponTraitVersatile",
  void: "E20.WeaponTraitVoid",
  wrecker: "E20.WeaponTraitWrecker",
  xenotech: "E20.WeaponTraitXenotech",
};
preLocalize("weaponTraits");

// Options for Weapon types
E20.weaponTypes = {
  assaultRifle: "E20.WeaponsAssaultRifle",
  ballistic: "E20.WeaponsBallistic",
  blunt: "E20.WeaponsBlunt",
  closeCombatHeavyBlade: "E20.WeaponsCloseCombatHeavyBlade",
  element: "E20.WeaponsElement",
  explosives: "E20.WeaponsExplosives",
  finesse: "E20.WeaponsFinesse",
  grenades: "E20.WeaponGrenades",
  mightMelee: "E20.WeaponsMightMelee",
  oneHanded: "E20.WeaponsOneHanded",
  shotguns: "E20.WeaponsShotgun",
  silent: "E20.WeaponsSilent",
  stun: "E20.WeaponsStun",
  submachineGun: "E20.WeaponsSubmachineGun",
  thrown: "E20.WeaponsThrown",
};
preLocalize("weaponTypes");

/************************************************
 * Armor                                        *
 ***********************************************/

// Options for Armor classification
E20.armorClassifications = {
  non: "E20.ArmorClassificationNon",
  light: "E20.ArmorClassificationLight",
  medium: "E20.ArmorClassificationMedium",
  heavy: "E20.ArmorClassificationHeavy",
  ultraHeavy: "E20.ArmorClassificationUltraHeavy",
};
preLocalize("armorClassifications");

// Options for Armor trait
E20.armorTraits = {
  bulwark: "E20.ArmorTraitBulwark",
  computerized: "E20.ArmorTraitComputerized",
  deflective: "E20.ArmorTraitDeflective",
  enhanceSkill: "E20.ArmorTraitEnhanceSkill",
  enviroSealed: "E20.ArmorTraitEnviroSealed",
  exoFrame: "E20.ArmorTraitExoFrame",
  modular: "E20.ArmorTraitModular",
  plating: "E20.ArmorTraitPlating",
  regal: "E20.ArmorTraitRegal",
  shield: "E20.ArmorTraitShield",
  silent: "E20.ArmorTraitSilent",
  temperamental: "E20.ArmorTraitTemperamental",
  xenotech: "E20.ArmorTraitXenotech",
};
preLocalize("armorTraits");

// Options for Armor types
E20.armorTypes = {
  computerized: "E20.ArmorsComputerized",
  heavy: "E20.ArmorsHeavy",
  impulse: "E20.ArmorsImpulse",
  light: "E20.ArmorsLight",
  medium: "E20.ArmorsMedium",
  psycho: "E20.ArmorsPsycho",
  tactical: "E20.ArmorsTactical",
  ultraHeavy: "E20.ArmorsUltraHeavy",
};
preLocalize("armorTypes");

E20.morphedToughness = {
  light: 1,
  medium: 2,
  heavy: 4,
  ultraHeavy: 6,
};

// Options for Upgrade traits
E20.upgradeTraits = {
  ...E20.armorTraits,
  ...E20.weaponTraits,
};
preLocalize("upgradeTraits");

// Options for Upgrade traits
E20.shieldEffectTypes = {
  defenseBonus: "E20.ShieldDefense1Bonus",
  defenseBonusCombo: "E20.ShieldDefense2Bonuses",
  defenseBonusMixed: "E20.ShieldDefenseMixedBonuses",
  defenseBonusOption: "E20.ShieldDefense1Of2Bonuses",
  other: "E20.ShieldDefense1OtherBonus",
};
preLocalize("shieldEffectTypes");

/************************************************
 * Essences and Skills                          *
 ***********************************************/

// Essence names
E20.essences = {
  any: "E20.EssenceAny",
  strength: "E20.EssenceStrength",
  speed: "E20.EssenceSpeed",
  smarts: "E20.EssenceSmarts",
  social: "E20.EssenceSocial",
};
preLocalize("essences");

// Origin Essence Names
E20.originEssences = {
  strength: "E20.EssenceStrength",
  speed: "E20.EssenceSpeed",
  smarts: "E20.EssenceSmarts",
  social: "E20.EssenceSocial",
};
preLocalize("originEssences");

// Actor Essence skills
E20.skills = {
  athletics: "E20.SkillAthletics",
  brawn: "E20.SkillBrawn",
  intimidation: "E20.SkillIntimidation",
  might: "E20.SkillMight",
  acrobatics: "E20.SkillAcrobatics",
  driving: "E20.SkillDriving",
  finesse: "E20.SkillFinesse",
  infiltration: "E20.SkillInfiltration",
  initiative: "E20.SkillInitiative",
  targeting: "E20.SkillTargeting",
  alertness: "E20.SkillAlertness",
  culture: "E20.SkillCulture",
  science: "E20.SkillScience",
  survival: "E20.SkillSurvival",
  technology: "E20.SkillTechnology",
  animalHandling: "E20.SkillAnimalHandling",
  deception: "E20.SkillDeception",
  performance: "E20.SkillPerformance",
  persuasion: "E20.SkillPersuasion",
  spellcasting: "E20.SkillSpellcasting",
  streetwise: "E20.SkillStreetwise",
  weird: "E20.SkillWeird",
};
preLocalize("skills");

// Origin Essence Skills
E20.originSkills = {
  conditioning: "E20.SkillConditioning",
  ...E20.skills,
};
preLocalize("originSkills");

// Maps skills back to their corresponding Essence
E20.skillToEssence = {
  athletics: "strength",
  brawn: "strength",
  conditioning: "strength",
  intimidation: "strength",
  might: "strength",
  acrobatics: "speed",
  driving: "speed",
  finesse: "speed",
  infiltration: "speed",
  initiative: "speed",
  targeting: "speed",
  alertness: "smarts",
  culture: "smarts",
  science: "smarts",
  survival: "smarts",
  technology: "smarts",
  animalHandling: "social",
  deception: "social",
  performance: "social",
  persuasion: "social",
  spellcasting: "any",
  streetwise: "social",
  weird: "any",
},

E20.skillsByEssence = {
  any: ["spellcasting", "weird"],
  strength: ["athletics", "brawn", "intimidation", "might"],
  speed:  ["acrobatics", "driving", "finesse", "infiltration", "initiative", "targeting"],
  smarts: ["alertness", "culture", "science", "survival", "technology"],
  social: ["animalHandling", "deception", "performance", "persuasion", "streetwise"],
};

E20.actorLevels = {
  level1: "E20.Level1",
  level1optional: "E20.Level1Additional",
  level2: "E20.Level2",
  level3: "E20.Level3",
  level4: "E20.Level4",
  level5: "E20.Level5",
  level6: "E20.Level6",
  level7: "E20.Level7",
  level8: "E20.Level8",
  level9: "E20.Level9",
  level10: "E20.Level10",
  level11: "E20.Level11",
  level12: "E20.Level12",
  level13: "E20.Level13",
  level14: "E20.Level14",
  level15: "E20.Level15",
  level16: "E20.Level16",
  level17: "E20.Level17",
  level18: "E20.Level18",
  level19: "E20.Level19",
  level20: "E20.Level20",
};
preLocalize("actorLevels");

/************************************************
 * Rolls                                        *
 ***********************************************/

// Roll shifts that automatically fail
E20.autoFailShifts = [
  "autoFail",
  "fumble",
];

// Roll shifts that automatically succeed
E20.autoSuccessShifts = [
  "criticalSuccess",
  "autoSuccess",
];

// Shifts that are available for rolling initiative
E20.initiativeShifts = {
  "d20": "d20",
  "d2": "d2",
  "d4": "d4",
  "d6": "d6",
  "d8": "d8",
  "d10": "d10",
  "d12": "d12",
  "2d8": "2d8",
  "3d6": "3d6",
};

// Shifts that are available for rolling initiative in list form
E20.initiativeShiftList = [
  "3d6",
  "2d8",
  "d12",
  "d10",
  "d8",
  "d6",
  "d4",
  "d2",
  "d20",
];

// Shifts that are available for rolling skills and require making a roll
E20.skillRollableShifts = [
  "d2",
  "d4",
  "d6",
  "d8",
  "d10",
  "d12",
  "2d8",
  "3d6",
];

// Shifts that are available for rolling skills
E20.skillShifts = {
  "criticalSuccess": "E20.ShiftCriticalSuccess",
  "autoSuccess": "E20.ShiftAutoSuccess",
  "3d6": "3d6",
  "2d8": "2d8",
  "d12": "d12",
  "d10": "d10",
  "d8": "d8",
  "d6": "d6",
  "d4": "d4",
  "d2": "d2",
  "d20": "d20",
  "autoFail": "E20.ShiftAutoFail",
  "fumble": "E20.ShiftFumble",
};
preLocalize("skillShifts");

// Shifts that are available for rolling skills in list form
E20.skillShiftList = [
  "criticalSuccess",
  "autoSuccess",
  "3d6",
  "2d8",
  "d12",
  "d10",
  "d8",
  "d6",
  "d4",
  "d2",
  "d20",
  "autoFail",
  "fumble",
];

/* The trainable range a skill's shift can actually be *set* to from the Skill Picker app
   (module/apps/skill-picker.mjs) - d20 (the untrained default) up through d12 (the best a skill
   can be trained to). The critical/auto-success and auto-fail/fumble tiers in skillShiftList
   above are real values a skill's shift can end up at through other game effects (Edges, Snags,
   downshifts, ...), but aren't something a GM/player should be able to just pick directly here.
   Must be a {value: label} object, not a plain array - {{selectOptions}} (handlebars.mjs) uses
   an array's own INDEX as each <option>'s value when given a bare array of strings, so a plain
   array here saved a skill's shift as "0"-"6" instead of "d20"-"d12", which then failed schema
   validation entirely ("3 is not a valid choice") since shift is a string field. skillShifts/
   wealthShifts above use the same {value: value} shape for the same reason. */
E20.skillChoicesShifts = {
  "d20": "d20",
  "d2": "d2",
  "d4": "d4",
  "d6": "d6",
  "d8": "d8",
  "d10": "d10",
  "d12": "d12",
};

// Shifts that are available for rolling wealth tests
E20.wealthShifts = {
  "d20": "d20",
  "d2": "d2",
  "d4": "d4",
  "d6": "d6",
  "d8": "d8",
  "d10": "d10",
  "d12": "d12",
};

/************************************************
 * Actions                                        *
 ***********************************************/

// Options for Actions
E20.actionTypes = {
  free: "E20.ActionTypeFree",
  fullAction: "E20.ActionTypeFullAction",
  move: "E20.ActionTypeMove",
  standard: "E20.ActionTypeStandard",
  standardAndMove: "E20.ActionTypeStandardAndMove",
  wholeTurn: "E20.ActionTypeWholeTurn",
  tenMinutes: "E20.ActionTypeTenMinutes",
  oneHour: "E20.ActionTypeOneHour",
};
preLocalize("actionTypes");

// Options for Intervals
E20.usesInterval = {
  perScene: "E20.UsesIntervalScene",
  perTurn: "E20.UsesIntervalTurn",
  special: "E20.UsesIntervalSpecial",
};
preLocalize("usesInterval");

/************************************************
 * Items                                        *
 ***********************************************/

// Default item Icons
E20.defaultIcon = {
  alteration: "systems/essence20/assets/icons/items/alteration.svg",
  altMode: "systems/essence20/assets/icons/items/altmode.svg",
  armor: "systems/essence20/assets/icons/items/armor.svg",
  equipmentPackage: "systems/essence20/assets/icons/items/equipment_package.svg",
  feature: "systems/essence20/assets/icons/items/feature.svg",
  faction: "systems/essence20/assets/icons/items/faction.svg",
  focus: "systems/essence20/assets/icons/items/focus.svg",
  gear: "systems/essence20/assets/icons/items/gear.svg",
  hangUp: "icons/svg/hazard.svg",
  influence: "systems/essence20/assets/icons/items/influence.svg",
  origin: "systems/essence20/assets/icons/items/origin.svg",
  perk: "systems/essence20/assets/icons/items/perk.svg",
  power: "systems/essence20/assets/icons/items/powers.svg",
  role: "systems/essence20/assets/icons/items/role.svg",
  rolePoints: "systems/essence20/assets/icons/items/rolePoints.svg",
  shield: "systems/essence20/assets/icons/items/shield.svg",
  spell: "systems/essence20/assets/icons/items/powers.svg",
  weaponEffect: "systems/essence20/assets/icons/items/weapon_effect.svg",
};

// Options for Equipment Item Types
E20.equipmentTypes = {
  armor: "E20.Armor",
  equipmentPackage: "E20.EquipmentPackage",
  gear: "E20.Gear",
  magicBauble: "E20.MagicBauble",
  shield: "E20.Shield",
  upgrade: "E20.Upgrade",
  weapon: "E20.Weapon",
  weaponEffect: "E20.WeaponEffect",
};

// Options for Background Item Types
E20.backgroundTypes = {
  bond: "E20.Bond",
  hangUp: "E20.HangUp",
  influence: "E20.Influence",
  origin: "E20.Origin",
};

// Options for Character Item Types
E20.characterTypes = {
  alteration: "E20.Alteration",
  altMode: "E20.AltMode",
  feature: "E20.Feature",
  faction: "E20.Faction",
  focus: "E20.Focus",
  perk: "E20.Perk",
  power: "E20.Power",
  role: "E20.Role",
  rolePoints: "E20.RolePoints",
  specialization: "E20.Specialization",
  spell: "E20.Spell",
};

// Options for Other Item Types
E20.otherTypes = {
  contact: "E20.Contact",
  megaformTrait: "E20.MegaformTrait",
  trait: "E20.Trait",
};

// Options for Item availabilities
E20.availabilities = {
  automatic: "E20.AvailabilityAutomatic",
  standard: "E20.AvailabilityStandard",
  limited: "E20.AvailabilityLimited",
  restricted: "E20.AvailabilityRestricted",
  prototype: "E20.AvailabilityPrototype",
  unique: "E20.AvailabilityUnique",
  theoretical: "E20.AvailabilityTheoretical",
  other: "E20.AvailabilityOther",
};
preLocalize("availabilities");

// Options for vision grants (Night Vision Goggles, Thermal Goggles, etc.), mapped directly onto
// Foundry's own built-in CONFIG.Canvas.visionModes keys so no custom VisionMode/shader is needed.
E20.visionModes = {
  darkvision: "E20.VisionModeDarkvision",
  monochromatic: "E20.VisionModeMonochromatic",
  lightAmplification: "E20.VisionModeLightAmplification",
};
preLocalize("visionModes");

// Table 8-2: Upgrading Equipment. Combining an item's current Availability tier with a new
// Upgrade's Availability tier gives the tier that must be Requisitioned to acquire the
// upgraded item. Only covers the 5 tiers the table actually defines; anything outside those
// (automatic, other, theoretical) is handled by getCombinedAvailability() below.
E20.upgradeAvailabilityMatrix = {
  standard: {
    standard: 'standard',
    limited: 'limited',
    restricted: 'restricted',
    prototype: 'prototype',
    unique: 'theoretical',
  },
  limited: {
    standard: 'limited',
    limited: 'restricted',
    restricted: 'prototype',
    prototype: 'theoretical',
    unique: 'theoretical',
  },
  restricted: {
    standard: 'restricted',
    limited: 'prototype',
    restricted: 'theoretical',
    prototype: 'theoretical',
    unique: 'theoretical',
  },
  prototype: {
    standard: 'prototype',
    limited: 'theoretical',
    restricted: 'theoretical',
    prototype: 'theoretical',
    unique: 'theoretical',
  },
  unique: {
    standard: 'theoretical',
    limited: 'theoretical',
    restricted: 'theoretical',
    prototype: 'theoretical',
    unique: 'theoretical',
  },
};

// Damage Types
E20.damageTypes = {
  blindingBlast: "E20.DamageBlindingBlast",
  blunt: "E20.DamageBlunt",
  cover: "E20.DamageCover",
  element: "E20.DamageElement",
  frightened: "E20.DamageFrightened",
  grapple: "E20.DamageGrapple",
  impaired: "E20.DamageImparied",
  intimidate: "E20.DamageIntimidate",
  knocProne: "E20.DamageKnockProne",
  laser: "E20.DamageLaser",
  maneuver: "E20.DamageManeuver",
  mesmerized: "E20.DamageMesmerized",
  modelock: "E20.DamageModeLock",
  poison: "E20.DamagePoison",
  restrained: "E20.DamageRestrained",
  sharp: "E20.DamageSharp",
  sonic: "E20.DamageSonic",
  special: "E20.DamageSpecial",
  spot: "E20.DamageSpot",
  stun: "E20.DamageStun",
  unconscious: "E20.DamageUnconscious",
};
preLocalize("damageTypes");

// Perk types
E20.perkTypes = {
  contact: "E20.PerkContact",
  division: "E20.PerkDivision",
  faction: "E20.PerkFaction",
  general: "E20.PerkGeneral",
  influence: "E20.PerkInfluence",
  origin: "E20.PerkOrigin",
  minicon: "E20.MiniCon",
  role: "E20.PerkRole",
};
preLocalize("perkTypes");

// Gear types
E20.gearTypes = {
  clothes: "E20.GearClothes",
  computers: "E20.GearComputers",
  exploration: "E20.GearExploration",
  hazard: "E20.GearHazard",
  kits: "E20.GearKits",
  medical: "E20.GearMedical",
  military: "E20.GearMilitary",
  other: "E20.GearOther",
  security: "E20.GearSecurity",
  support: "E20.GearSupport",
  tools: "E20.GearTools",
};
preLocalize("gearTypes");

// Power types
E20.powerTypes = {
  grid: "E20.PowerSourceGrid",
  sorcerous: "E20.PowerSourceSorcerous",
  threat: "E20.PowerSourceThreat",
};
preLocalize("powerTypes");

// Upgrade types
E20.upgradeTypes = {
  armor: "E20.UpgradeTypeArmor",
  drone: "E20.UpgradeTypeDrone",
  weapon: "E20.UpgradeTypeWeapon",
};
preLocalize("upgradeTypes");

// Alteration Type Options
E20.alterationTypes = {
  essence: "E20.AlterationTypeEssence",
  movement: "E20.AlterationTypeMovement",
  other: "E20.AlterationTypeOther",
};
preLocalize("alterationTypes");

E20.bonusTypes = {
  none: "E20.BonusNone",
  attackUpshift: "E20.BonusAttackUpshift",
  damageBonus: "E20.BonusDamage",
  defenseBonus: "E20.BonusDefense",
  enemyDownshift: "E20.BonusEnemyDownshift",
  healthBonus: "E20.BonusHealth",
  other: "E20.BonusOther",
};
preLocalize("bonusTypes");

E20.perkAdvanceTypes = {
  area: "E20.PerkAdvanceTypeArea",
  damage: "E20.PerkAdvanceTypeDamage",
  die: "E20.PerkAdvanceTypeDie",
  number: "E20.PerkAdvanceTypeNumber",
  rerolls: "E20.PerkAdvanceTypeReroll",
  upshift: "E20.PerkAdvanceTypeUpshift",
};
preLocalize("perkAdvanceTypes");

/************************************************
 * Spells                                       *
 ***********************************************/

// Options for Spell Tiers
E20.spellTiers = {
  elementary: "E20.SpellTierElementary",
  superior: "E20.SpellTierSuperior",
  virtuoso: "E20.SpellTierVirtuoso",
};
preLocalize("spellTiers");

// Options for Spell Circles
E20.spellCircles = {
  aid: "E20.SpellCircleAid",
  beam: "E20.SpellCircleBeam",
  enchantment: "E20.SpellCircleEnchantment",
  utility: "E20.SpellCircleUtility",
};
preLocalize("spellCircles");

/************************************************
 * Actors                                       *
 ***********************************************/

// Options for Creature size
E20.actorSizes = {
  small: "E20.ActorSizeSmall",
  common: "E20.ActorSizeCommon",
  large: "E20.ActorSizeLarge",
  long: "E20.ActorSizeLong",
  huge: "E20.ActorSizeHuge",
  extended: "E20.ActorSizeExtended",
  gigantic: "E20.ActorSizeGigantic",
  extended2: "E20.ActorSizeExtended2",
  towering: "E20.ActorSizeTowering",
  extended3: "E20.ActorSizeExtended3",
  titanic: "E20.ActorSizeTitanic",
};
preLocalize("actorSizes");

//Reach by size
E20.actorReach = {
  small: 2,
  common: 5,
  large: 5,
  long: 5,
  huge: 10,
  extended: 10,
  gigantic: 15,
  extended2: 15,
  towering: 20,
  extended3: 15,
  titanic: 25,
};

// Subtypes of megaforms
E20.megaformSubtypes = {
  megaformCombiner: "E20.MegaformSubtypeCombiner",
  megaformZord: "E20.MegaformSubtypeZord",
};
preLocalize("megaformSubtypes");

// Megaform Trait options a Zord with the Combiner Zord Feature can contribute when it
// joins a Megaform.
E20.megaformTraitTypes = {
  coreAbility: "E20.MegaformTraitCoreAbility",
  coreBody: "E20.MegaformTraitCoreBody",
  coreDefenses: "E20.MegaformTraitCoreDefenses",
  enhancedMeleeAttack: "E20.MegaformTraitEnhancedMeleeAttack",
  enhancedRangedAttack: "E20.MegaformTraitEnhancedRangedAttack",
  move: "E20.MegaformTraitMove",
};
preLocalize("megaformTraitTypes");

// Types of movement used by Actors
E20.movementTypes = {
  aerial: "E20.MovementTypeAerial",
  climb: "E20.MovementTypeClimb",
  ground: "E20.MovementTypeGround",
  swim: "E20.MovementTypeSwim",
};
preLocalize("movementTypes");

// Options for Transformers Factions
E20.transformerFactions = {
  autobots: "E20.FactionAutobots",
  decepticons: "E20.FactionDecepticons",
  other: "E20.FactionOther",
};
preLocalize("transformerFactions");

// Options for Transformer Modes
E20.transformerModes = {
  modeAltMode: "E20.ModeAltMode",
  modeBotMode: "E20.ModeBotMode",
  modeAny: "E20.ModeAny",
};
preLocalize("transformerModes");

// Options for Companion types
E20.companionTypes = {
  drone: "E20.CompanionTypeDrone",
  human: "E20.CompanionTypeHuman",
  miniCon: "E20.CompanionTypeMiniCon",
  pet: "E20.CompanionTypePet",
};
preLocalize("companionTypes");

// Energon types
E20.energonTypes = {
  energon: "E20.Energon",
  dark: "E20.EnergonDark",
  primal: "E20.EnergonPrimal",
  red: "E20.EnergonRed",
  synthEn: "E20.EnergonSynthEn",
};
preLocalize("energonTypes");

E20.perkChoiceTypes = {
  none: "E20.PerkChoiceNone",
  environments: "E20.PerkChoiceEnvironments",
  field: "E20.PerkChoiceField",
  fightingStyle: "E20.PerkChoiceFightingStyle",
  movement: "E20.PerkChoiceMovement",
  perks: "E20.PerkChoicePerks",
  senses: "E20.PerkChoiceSenses",
  // MLP/PR CRB "Expertise", PR CRB "Aptitude Augmenter" (Grid Tech I) - "Choose a Skill... for
  // this Perk to apply to", takeable multiple times, each time for a different skill. Drives
  // system.reroll.skills (module/data/reroll-schema.mjs) on the granted Perk instance - see
  // sheet-handlers/perk-handler.mjs#onPerkDrop.
  skills: "E20.PerkChoiceSkills",
};
preLocalize("perkChoiceTypes");

// GI Joe CRB p.104 - the 3 skills Technician/Expert Focus's Field Perk can be chosen from
// ("choose a Culture, Science, or Technology Specialization... This is your Field" - see
// perk-handler.mjs's 'field' choiceType). Not a distinct set of options from E20.skills, just a
// restricted view of it - Eureka/Expert in Your Field (both gated on this same choice) read the
// stored skill key directly off system.choice, same as Fighting Style already does.
E20.fieldSkills = ['culture', 'science', 'technology'];

// GI Joe CRB p.79/108 - the 6 Fighting Style options shared by Infantry and Vanguard's identical
// Perk (a single compendium item, granted by both Roles - see perk-handler.mjs's 'fightingStyle'
// choiceType).
E20.fightingStyle = {
  akimbo: "E20.FightingStyleAkimbo",
  careful: "E20.FightingStyleCareful",
  closeQuartersBattle: "E20.FightingStyleCloseQuartersBattle",
  defense: "E20.FightingStyleDefense",
  longShot: "E20.FightingStyleLongShot",
  triggerHappy: "E20.FightingStyleTriggerHappy",
};
preLocalize("fightingStyle");

E20.rerollModes = {
  all: "E20.RerollModeAll",
  ones: "E20.RerollModeOnes",
  onesAndTwos: "E20.RerollModeOnesAndTwos",
  single: "E20.RerollModeSingle",
};
preLocalize("rerollModes");

E20.rerollTargets = {
  allDice: "E20.RerollTargetAllDice",
  anyDie: "E20.RerollTargetAnyDie",
  skillDice: "E20.RerollTargetSkillDice",
  // GI Joe CRB "Skilled Under Pressure" (Origin Benefit), GI Joe/Transformers CRB "Veteran"
  // (General Perk): both reroll the base d20 term specifically, never a skill die - there's
  // always exactly one d20 term in a roll (the Edge/Snag pair is a single 2d20kh/2d20kl term,
  // not two), so unlike anyDie this never needs a die-picker prompt.
  d20: "E20.RerollTargetD20",
};
preLocalize("rerollTargets");

E20.rerollResets = {
  none: "E20.RerollResetNone",
  scene: "E20.RerollResetScene",
  day: "E20.RerollResetDay",
  // Transformers CRB p.? "Veteran" (General Perk): "Three times per MISSION, you can reroll a
  // d20 on a Skill Test" - a mission is this game line's own encounter-spanning session unit,
  // distinct from a single scene. There's no existing "current mission" concept anywhere else in
  // this codebase to key off, so this reset bucket falls back to a manual GM-cleared flag - see
  // helpers/reroll.mjs's own getRerollResetBucket for the "no automatic boundary" caveat.
  mission: "E20.RerollResetMission",
  // GI Joe CRB "In My Sights" (Infantry, p.78): "Once per combat..." - bucketed on
  // game.combat?.id (helpers/reroll.mjs's own getRerollResetBucket), a real, automatically-
  // bounded unit unlike "mission" above. Used outside an active Combat encounter (game.combat
  // is then null) shares one bucket rather than being unlimited, since "once per combat" implies
  // this is meant to apply during one.
  combat: "E20.RerollResetCombat",
};
preLocalize("rerollResets");

// A small, explicit set of conditions a reroll grant can require beyond simple usage-counting -
// deliberately NOT a generic expression evaluator (this system doesn't have one, and every other
// Perk-specific check in this codebase is a hardcoded, named condition rather than free-form
// logic - see dice.mjs's own dozens of Perk checks for the established idiom this follows).
E20.rerollConditions = {
  none: "E20.RerollConditionNone",
  // Power Rangers CRB p.41 "Power Infusion": "...while Morphed..."
  morphed: "E20.RerollConditionMorphed",
  // GI Joe/Transformers CRB "Veteran" (General Perk): "...as long as you aren't suffering a
  // Snag." Checked against the triggering roll's own Snag state (helpers/reroll.mjs's
  // rollContext, stashed on the chat message by dice.mjs) rather than the actor's current
  // condition, since a Snag is a property of one specific roll, not standing actor state.
  notSnagged: "E20.RerollConditionNotSnagged",
  // PR CRB "Weapon Mastery" (Red Ranger, p.52): "...an attack you make with your Power
  // Weapon..." Checked against the attacking weaponEffect's own parent weapon having the
  // existing "powerWeapon" weaponTrait (a GM/player checks it via that weapon's own Traits
  // selector, same as any other trait - no dedicated field), stashed into the roll's context
  // the same way as skill/essence/snag.
  powerWeapon: "E20.RerollConditionPowerWeapon",
  // MLP CRB p.86 "Cheer" (Role Feature): "...to reroll a FAILED Performance Skill Test."
  // Checked against the triggering roll's own outcome (rollContext.rollFailed, set only for a
  // vs-Difficulty check - a plain skill roll with no Difficulty to fail against never sets it,
  // so this condition reads as unmet rather than assuming success either way).
  rollFailed: "E20.RerollConditionRollFailed",
};
preLocalize("rerollConditions");

E20.senses = {
  hearing: "E20.SenseHearing",
  sight: "E20.SenseSight",
  smell: "E20.SenseSmell",
  taste: "E20.SenseTaste",
  touch: "E20.SenseTouch",
};
preLocalize("senses");

E20.environments = {
  arctic: "E20.EnvironmentArctic",
  desert: "E20.EnvironmentDesert",
  grasslands: "E20.EnvironmentGrasslands",
  mountains: "E20.EnvironmentMountains",
  sea: "E20.EnvironmentSea",
  urban: "E20.EnvironmentUrban",
  wetlands: "E20.EnvironmentWetlands",
  woodlands: "E20.EnvironmentWoodlands",
};
preLocalize("environments");

/************************************************
 * Vehicles                                     *
 ***********************************************/

// Vehicle Roles
E20.vehicleRoles = {
  driver: "E20.VehicleRoleDriver",
  passenger: "E20.VehicleRolePassenger",
};
preLocalize("vehicleRoles");

// Vehicle Traits
E20.vehicleTraits = {
  aerospace: "E20.VehicleTraitAerospace",
  ai: "E20.VehicleTraitAI",
  air: "E20.VehicleTraitAir",
  allTerrain: "E20.VehicleTraitAllTerrain",
  ampibious: "E20.VehicleTraitAmphibious",
  armoredCabin: "E20.VehicleTraitArmoredCabin",
  attackMode: "E20.VehicleTraitAttackMode",
  autopilot: "E20.VehicleTraitAutopilot",
  autopilotAdvanced: "E20.VehicleTraitAutopilotAdvanced",
  battlePlatforms: "E20.VehicleTraitBattlePlatforms",
  battleShield: "E20.VehicleTraitBattleShield",
  battleStation: "E20.VehicleTraitBattleStation",
  beastOfBurden: "E20.VehicleTraitBeastOfBurden",
  bomber: "E20.VehicleTraitBomber",
  combinerCore: "E20.VehicleTraitCombinerCore",
  computerized: "E20.VehicleTraitComputerized",
  convertible: "E20.VehicleTraitConvertible",
  deployable: "E20.VehicleTraitDeployable",
  driveBy: "E20.VehicleTraitDriveBy",
  elusive: "E20.VehicleTraitElusive",
  evasiveManeuvers: "E20.VehicleTraitEvasiveManeuvers",
  exoskeleton: "E20.VehicleTraitExoskeleton",
  flyBy: "E20.VehicleTraitFlyBy",
  flyingPodium: "E20.VehicleTraitFlyingPodium",
  fragile: "E20.VehicleTraitFragile",
  gridjump: "E20.VehicleTraitGridjump",
  freightCarry: "E20.VehicleTraitFreightCarry",
  heavyWinch: "E20.VehicleTraitHeavyWinch",
  heavyWheels: "E20.VehicleTraitHeavyWheels",
  hissColumn: "E20.VehicleTraitHISSColumn",
  hover: "E20.VehicleTraitHover",
  hydroPortation: "E20.VehicleTraitHydroPortation",
  instrumentArray: "E20.VehicleTraitInstrumentArray",
  integratedStorage: "E20.VehicleTraitIntegratedStorage",
  land: "E20.VehicleTraitLand",
  landingPattern: "E20.VehicleTraitLandingPattern",
  largeObstacle: "E20.VehicleTraitLargeObstacle",
  linked: "E20.VehicleTraitLinked",
  multifrequencyCameras: "E20.VehicleTraitMultiFrequencyCameras",
  multiPurpose: "E20.VehicleTraitMultiPurpose",
  prowlMode: "E20.VehicleTraitProwlMode",
  pythonPaint: "E20.VehicleTraitPythonPaint",
  ram: "E20.VehicleTraitRam",
  ranshackle: "E20.VehicleTraitRamshackle",
  rapidDeploymentRamps: "E20.VehicleTraitRapidDeploymentRamps",
  responsive: "E20.VehicleTraitResponsive",
  rollCage: "E20.VehicleTraitRollCage",
  sea: "E20.VehicleTraitSea",
  selfRepair: "E20.VehicleTraitSelfRepair",
  sensors: "E20.VehicleTraitSensors",
  shielded: "E20.VehicleTraitShielded",
  sidecar: "E20.VehicleTraitSidecar",
  SixWheelDrive: "E20.VehicleTraitSixWheelDrive",
  takeOff: "E20.VehicleTraitTakeOff",
  tank: "E20.VehicleTraitTank",
  targetingSystem: "E20.VehicleTraitTargetingSystem",
  thermalImaging: "E20.VehicleTraitThermalImaging",
  tigerStripes: "E20.VehicleTraitTigerStripes",
  towable: "E20.VehicleTraitTowable",
  treads: "E20.VehicleTraitTreads",
  vehicle: "E20.VehicleTraitVehicle",
  vtol: "E20.VehicleTraitVTOL",
  wearable: "E20.VehicleTraitWearable",
  zeroG: "E20.VehicleTraitZeroG",
};
preLocalize("vehicleTraits");

/************************************************
 * Settings                                     *
 ***********************************************/

E20.pointsNameOptions = {
  story: "E20.SptNameStory",
  friendship: "E20.SptNameFriendship",
};
preLocalize("pointsNameOptions");

/************************************************
 * Status Effects                               *
 ***********************************************/

E20.statusEffects = [
  {
    img: 'systems/essence20/assets/icons/status_effects/status_acting_smaller.svg',
    id: 'actingSmaller',
    name: 'E20.StatusActingSmaller',
    changes: [],
  },
  {
    img: 'systems/essence20/assets/icons/status_effects/status_asleep.svg',
    id: 'asleep',
    name: 'E20.StatusAsleep',
    changes: [],
  },
  {
    img: 'systems/essence20/assets/icons/status_effects/status_blinded.svg',
    id: 'blinded',
    name: 'E20.StatusBlinded',
    changes: [],
  },
  {
    // MLP CRB "Laughtracting" (p.86): "...they can't use any Free actions on their next turn."
    // No existing status icon fits this narrowly - reuses status_impaired's art rather than
    // adding new assets, same as cantTakeMoveActions below.
    img: 'systems/essence20/assets/icons/status_effects/status_impaired.svg',
    id: 'cantTakeFreeActions',
    name: 'E20.StatusCantTakeFreeActions',
    changes: [],
  },
  {
    // MLP CRB "Distraughter" (p.86): extends Laughtracting - "...can't use a Move action this
    // round." Bookkeeping-only, like every other status here - this system has no enforced
    // action economy to gate against, so nothing else reads this status; see the Laughtracting/
    // Distraughter Perk items themselves (packs/mlpcrbitems/_source) for the ability text.
    img: 'systems/essence20/assets/icons/status_effects/status_immobilized.svg',
    id: 'cantTakeMoveActions',
    name: 'E20.StatusCantTakeMoveActions',
    changes: [],
  },
  {
    // No custom art yet (p.202) - reuses Foundry's own bundled shield.svg, same "generic core
    // icon" fallback already used elsewhere in this system rather than hand-authoring new art.
    img: 'icons/svg/shield.svg',
    id: 'cover',
    name: 'E20.StatusCover',
    changes: [],
  },
  {
    img: 'systems/essence20/assets/icons/status_effects/status_deafened.svg',
    id: 'deafened',
    name: 'E20.StatusDeafened',
    changes: [],
  },
  {
    img: 'systems/essence20/assets/icons/status_effects/status_defeated.svg',
    id: 'defeated',
    name: 'E20.StatusDefeated',
    changes: [],
  },
  {
    img: 'systems/essence20/assets/icons/status_effects/status_frightened.svg',
    id: 'frightened',
    name: 'E20.StatusFrightened',
    changes: [],
  },
  {
    img: 'systems/essence20/assets/icons/status_effects/status_grappled.svg',
    id: 'grappled',
    name: 'E20.StatusGrappled',
    changes: [],
  },
  {
    img: 'systems/essence20/assets/icons/status_effects/status_immobilized.svg',
    id: 'immobilized',
    name: 'E20.StatusImmobilized',
    changes: [],
  },
  {
    img: 'systems/essence20/assets/icons/status_effects/status_impaired.svg',
    id: 'impaired',
    name: 'E20.StatusImpaired',
    changes: [],
  },
  {
    img: 'systems/essence20/assets/icons/status_effects/status_invisible.svg',
    id: 'invisible',
    name: 'E20.StatusInvisible',
    changes: [],
  },
  {
    img: 'systems/essence20/assets/icons/status_effects/status_mesmerized.svg',
    id: 'mesmerized',
    name: 'E20.StatusMesmerized',
    changes: [],
  },
  {
    img: 'systems/essence20/assets/icons/status_effects/status_mode_lock.svg',
    id: 'modeLock',
    name: 'E20.StatusModeLock',
    changes: [],
  },
  {
    img: 'systems/essence20/assets/icons/status_effects/status_prone.svg',
    id: 'prone',
    name: 'E20.StatusProne',
    changes: [],
  },
  {
    img: 'systems/essence20/assets/icons/status_effects/status_restrained.svg',
    id: 'restrained',
    name: 'E20.StatusRestrained',
    changes: [],
  },
  {
    img: 'systems/essence20/assets/icons/status_effects/status_stunned.svg',
    id: 'stunned',
    name: 'E20.StatusStunned',
    changes: [],
  },
  {
    // "A target completely concealed by an obstacle or much larger creature is considered as
    // having Total Cover. A target with Total Cover can't be targeted directly, although some
    // special attacks may mitigate or eliminate this protection" (p.202) - the "can't be targeted"
    // half isn't enforced as a hard block (nothing else in this system's automatic combat
    // modifiers hard-blocks a roll, and the book itself treats it as overridable), so this status
    // gets the same automatic -2 as Cover instead - see dice.mjs#_getAutomaticCombatModifiers.
    // Reuses Foundry's bundled castle.svg (a fully-walled-in visual) to read as stronger than the
    // plain shield.svg used for Cover.
    img: 'icons/svg/castle.svg',
    id: 'totalCover',
    name: 'E20.StatusTotalCover',
    changes: [],
  },
  {
    img: 'systems/essence20/assets/icons/status_effects/status_unconscious.svg',
    id: 'unconscious',
    name: 'E20.StatusUnconscious',
    changes: [],
  },
];

/************************************************
 * Token Sizes                                  *
 ***********************************************/

E20.tokenSizes = {
  small: {
    height: 1,
    reach: 2,
    width: 1,
  },
  common: {
    height: 1,
    reach: 5,
    width: 1,
  },
  large: {
    height: 2,
    reach: 5,
    width: 2,
  },
  long: {
    height: 1,
    reach: 5,
    width: 2,
  },
  huge: {
    height: 3,
    reach: 10,
    width: 3,
  },
  extended: {
    height: 2,
    reach: 10,
    width: 4,
  },
  gigantic: {
    height: 4,
    reach: 15,
    width: 4,
  },
  extended2: {
    height: 3,
    reach: 15,
    width: 6,
  },
  towering: {
    height: 5,
    reach: 20,
    width: 5,
  },
  extended3: {
    height: 5,
    reach: 15,
    width: 5,
  },
  titanic: {
    height: 5,
    reach: 25,
    width: 5,
  },
};

/************************************************
 * MLP Essence Advancement                      *
 ***********************************************/

E20.MLPAdvancement = {
  diamond: [
    "level1",
    "level1optional",
    "level5",
    "level9",
    "level13",
    "level16",
    "level18",
    "level20",
  ],
  gold: [
    "level1",
    "level2",
    "level6",
    "level10",
    "level14",
    "level17",
    "level19",
  ],
  silver: [
    "level3",
    "level7",
    "level11",
    "level15",
  ],
  bronze: [
    "level4",
    "level8",
    "level12",
  ],
};

E20.EssenceRankNames = [
  "diamond",
  "gold",
  "silver",
  "bronze",
];

/************************************************
 * TF Special Essence Advancement               *
 ***********************************************/

E20.TFSpecialAdvancement = {
  first: [
    "level2",
    "level5",
    "level9",
    "level14",
    "level18",
    "level20",
  ],
  second: [
    "level3",
    "level7",
    "level11",
    "level15",
    "level19",
  ],
  third: [
    "level4",
    "level8",
    "level13",
    "level16",
  ],
  fourth: [
    "level6",
    "level2",
    "level17",
  ],
};

E20.TFEssenceRankNames = [
  "first",
  "second",
  "third",
  "fourth",
];

E20.CombinedEssenceRankNames = [
  ...E20.EssenceRankNames,
  ...E20.TFEssenceRankNames,
];

E20.allPackRoles = null;
