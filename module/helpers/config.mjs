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
};
preLocalize("gameVersions");

/************************************************
 * Defense                                      *
 ***********************************************/

// Essence-based defenses
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
  blunt: "E20.WeaponTraitBlunt",
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
  inaccurate: "E20.WeaponTraitInaccurate",
  indirect: "E20.WeaponTraitIndirect",
  inertial: "E20.WeaponTraitInertial",
  injection: "E20.WeaponTraitInjection",
  intimidating: "E20.WeaponTraitIntimidating",
  laser: "E20.WeaponTraitLaser",
  maneuver: "E20.WeaponTraitManeuver",
  martialArts: "E20.WeaponTraitMartialArts",
  modeLock: "E20.WeaponTraitModeLock",
  mounted: "E20.WeaponTraitMounted",
  multipleTargets: "E20.WeaponTraitMultipleTargets",
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
  tempermental: "E20.WeaponTraitTempermental",
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
  silent: "E20.ArmorTraitSilent",
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
};
preLocalize("armorTypes");

// Options for Upgrade traits
E20.upgradeTraits = {
  ...E20.armorTraits,
  ...E20.weaponTraits,
};
preLocalize("upgradeTraits");

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
};
preLocalize("skills");

// Origin Essence Skills
E20.originSkills = {
  conditioning: "E20.SkillConditioning",
  initiative: "E20.SkillInitiative",
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
},

E20.skillsByEssence = {
  any: ["spellcasting"],
  strength: ["athletics", "brawn", "intimidation", "might"],
  speed:  ["acrobatics", "driving", "finesse", "infiltration", "targeting"],
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
  focus: "systems/essence20/assets/icons/items/focus.svg",
  gear: "systems/essence20/assets/icons/items/gear.svg",
  hangUp: "icons/svg/hazard.svg",
  influence: "systems/essence20/assets/icons/items/influence.svg",
  origin: "systems/essence20/assets/icons/items/origin.svg",
  perk: "systems/essence20/assets/icons/items/perk.svg",
  power: "systems/essence20/assets/icons/items/powers.svg",
  role: "systems/essence20/assets/icons/items/role.svg",
  rolePoints: "systems/essence20/assets/icons/items/rolePoints.svg",
  weaponEffect: "systems/essence20/assets/icons/items/weapon_effect.svg",
};

// Options for Equipment Item Types
E20.equipmentTypes = {
  armor: "E20.Armor",
  gear: "E20.Gear",
  magicBauble: "E20.MagicBauble",
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
};
preLocalize("availabilities");

// Damage Types
E20.damageTypes = {
  blunt: "E20.DamageBlunt",
  cover: "E20.DamageCover",
  element: "E20.DamageElement",
  grapple: "E20.DamageGrapple",
  impaired: "E20.DamageImparied",
  intimidate: "E20.DamageIntimidate",
  laser: "E20.DamageLaser",
  maneuver: "E20.DamageManeuver",
  mesmerized: "E20.DamageMesmerized",
  modelock: "E20.DamageModeLock",
  poison: "E20.DamagePoison",
  restrained: "E20.DamageRestrained",
  sharp: "E20.DamageSharp",
  sonic: "E20.DamageSonic",
  spot: "E20.DamageSpot",
  stun: "E20.DamageStun",
};

// Perk types
E20.perkTypes = {
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
    icon: 'systems/essence20/assets/icons/status_effects/status_asleep.svg',
    id: 'asleep',
    label: 'E20.StatusAsleep',
  },
  {
    icon: 'systems/essence20/assets/icons/status_effects/status_blinded.svg',
    id: 'blinded',
    label: 'E20.StatusBlinded',
  },
  {
    icon: 'systems/essence20/assets/icons/status_effects/status_deafened.svg',
    id: 'deafened',
    label: 'E20.StatusDeafened',
  },
  {
    icon: 'systems/essence20/assets/icons/status_effects/status_defeated.svg',
    id: 'defeated',
    label: 'E20.StatusDefeated',
  },
  {
    icon: 'systems/essence20/assets/icons/status_effects/status_frightened.svg',
    id: 'frightened',
    label: 'E20.StatusFrightened',
  },
  {
    icon: 'systems/essence20/assets/icons/status_effects/status_grappled.svg',
    id: 'grappled',
    label: 'E20.StatusGrappled',
  },
  {
    icon: 'systems/essence20/assets/icons/status_effects/status_immobilized.svg',
    id: 'immobilized',
    label: 'E20.StatusImmobilized',
  },
  {
    icon: 'systems/essence20/assets/icons/status_effects/status_impaired.svg',
    id: 'Impaired',
    label: 'E20.StatusImpaired',
  },
  {
    icon: 'systems/essence20/assets/icons/status_effects/status_invisible.svg',
    id: 'invisible',
    label: 'E20.StatusInvisible',
  },
  {
    icon: 'systems/essence20/assets/icons/status_effects/status_mesmerized.svg',
    id: 'mesmerized',
    label: 'E20.StatusMesmerized',
  },
  {
    icon: 'systems/essence20/assets/icons/status_effects/status_mode_lock.svg',
    id: 'modeLock',
    label: 'E20.StatusModeLock',
  },
  {
    icon: 'systems/essence20/assets/icons/status_effects/status_prone.svg',
    id: 'prone',
    label: 'E20.StatusProne',
  },
  {
    icon: 'systems/essence20/assets/icons/status_effects/status_restrained.svg',
    id: 'restrained',
    label: 'E20.StatusRestrained',
  },
  {
    icon: 'systems/essence20/assets/icons/status_effects/status_stunned.svg',
    id: 'stunned',
    label: 'E20.StatusStunned',
  },
  {
    icon: 'systems/essence20/assets/icons/status_effects/status_unconscious.svg',
    id: 'unconscious',
    label: 'E20.StatusUnconscious',
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

