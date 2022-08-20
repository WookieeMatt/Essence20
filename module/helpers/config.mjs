export const E20 = {};

E20.defenseBase = 10;

E20.armorClassifications = {
  non: "E20.ArmorClassificationNon",
  light: "E20.ArmorClassificationLight",
  medium: "E20.ArmorClassificationMedium",
  heavy: "E20.ArmorClassificationHeavy",
};

E20.armorTraits = {
  deflective: "E20.ArmorTraitDeflective",
  silent: "E20.ArmorTraitSilent",
};

E20.availabilities = {
  automatic: "E20.AvailabilityAutomatic",
  standard: "E20.AvailabilityStandard",
  limited: "E20.AvailabilityLimited",
  restricted: "E20.AvailabilityRestricted",
  prototype: "E20.AvailabilityPrototype",
  unique: "E20.AvailabilityUnique",
  theoretical: "E20.AvailabilityTheoretical",
};

E20.autoFailShifts = [
  "autoFail",
  "fumble",
];

E20.autoSuccessShifts = [
  "criticalSuccess",
  "autoSuccess",
];

E20.defenses = {
  cleverness: "E20.DefenseCleverness",
  evasion: "E20.DefenseEvasion",
  toughness: "E20.DefenseToughness",
  willpower: "E20.DefenseWillpower",
};

E20.effectShapes = {
  circle: "E20.EffectShapeCircle",
  cone: "E20.EffectShapeCone",
  square: "E20.EffectShapeSquare",
};

E20.essences = {
  strength: "E20.EssenceStrength",
  speed: "E20.EssenceSpeed",
  smarts: "E20.EssenceSocial",
  social: "E20.EssenceSmarts",
};

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

E20.lightRanges = {
  bright: "E20.LightRangeBright",
  dim: "E20.LightRangeDim",
};

E20.movementTypes = {
  aerial: "E20.MovementTypeAerial",
  ground: "E20.MovementTypeGround",
  swim: "E20.MovementTypeSwim",
};

E20.rangers = {
  black: "E20.RangerBlack",
  blue: "E20.RangerBlue",
  green: "E20.RangerGreen",
  pink: "E20.RangerPink",
  red: "E20.RangerRed",
  yellow: "E20.RangerYellow",
  white: "E20.RangerWhite",
};

E20.shifts = {
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

E20.shiftList = [
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

E20.rollableShifts = [
  "d2",
  "d4",
  "d6",
  "d8",
  "d10",
  "d12",
  "2d8",
  "3d6",
];

E20.essenceSkills = {
  athletics: "E20.EffectShapeAthletics",
  brawn: "E20.EffectShapeBrawn",
  intimidation: "E20.EffectShapeIntimidation",
  might: "E20.EffectShapeMight",
  acrobatics: "E20.EffectShapeAcrobatics",
  driving: "E20.EffectShapeDriving",
  finesse: "E20.EffectShapeFinesse",
  infiltration: "E20.EffectShapeInfiltration",
  targeting: "E20.EffectShapeTargeting",
  alertness: "E20.EffectShapeAlertness",
  culture: "E20.EffectShapeCulture",
  science: "E20.EffectShapeScience",
  survival: "E20.EffectShapeSurvival",
  technology: "E20.EffectShapeTechnology",
  animalHandling: "E20.EffectShapeAnimalHandling",
  deception: "E20.EffectShapeDeception",
  performance: "E20.EffectShapePerformance",
  persuasion: "E20.EffectShapePersuasion",
  streetwise: "E20.EffectShapeStreetwise",
};

E20.skillToEssence = {
  athletics: "strength",
  brawn: "strength",
  intimidation: "strength",
  might: "strength",
  acrobatics: "speed",
  driving: "speed",
  finesse: "speed",
  infiltration: "speed",
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
  streetwise: "social"
},

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

E20.weaponSizes = {
  integrated: "E20.WeaponSizeIntegrated",
  sidearm: "E20.WeaponSizeSidearm",
  medium: "E20.WeaponSizeMedium",
  long: "E20.WeaponSizeLong",
  heavy: "E20.WeaponSizeHeavy",
};

E20.weaponStyles = {
  melee: "E20.WeaponStyleMelee",
  energy: "E20.WeaponStyleEnergy",
  explosive: "E20.WeaponStyleExplosive",
  projectile: "E20.WeaponStyleProjectile",
};

E20.weaponTraits = {
  acid: "E20.WeaponTraitAcid",
  amphibious: "E20.WeaponTraitAmphibious",
  antiTank: "E20.WeaponTraitAntiTank",
  aquatic: "E20.WeaponTraitAquatic",
  area: "E20.WeaponTraitArea",
  armorPiercing: "E20.WeaponTraitArmorPiercing",
  ballistic: "E20.WeaponTraitBallistic",
  blunt: "E20.WeaponTraitBlunt",
  cold: "E20.WeaponTraitCold",
  consumable: "E20.WeaponTraitConsumable",
  cover: "E20.WeaponTraitCover",
  electric: "E20.WeaponTraitElectric",
  energy: "E20.WeaponTraitEnergy",
  fire: "E20.WeaponTraitFire",
  grapple: "E20.WeaponTraitGrapple",
  indirect: "E20.WeaponTraitIndirect",
  intimidating: "E20.WeaponTraitIntimidating",
  laser: "E20.WeaponTraitLaser",
  maneuver: "E20.WeaponTraitManeuver",
  mounted: "E20.WeaponTraitMounted",
  multipleTargets: "E20.WeaponTraitMultipleTargets",
  poison: "E20.WeaponTraitPoison",
  psychic: "E20.WeaponTraitPsychic",
  seeking: "E20.WeaponTraitSeeking",
  sharp: "E20.WeaponTraitSharp",
  silent: "E20.WeaponTraitSilent",
  sonic: "E20.WeaponTraitSonic",
  spot: "E20.WeaponTraitSpot",
  stun: "E20.WeaponTraitStun",
  trip: "E20.WeaponTraitTrip",
  wrecker: "E20.WeaponTraitWrecker",
}

E20.creatureSizes = {
  small: "E20.CreatureSizeSmall",
  common: "E20.CreatureSizeCommon",
  large: "E20.CreatureSizeLarge",
  long: "E20.CreatureSizeLong",
  huge: "E20.CreatureSizeHuge",
  extended: "E20.CreatureSizeExtended",
  gigantic: "E20.CreatureSizeGigantic",
  extended2: "E20.CreatureSizeExtended2",
  towering: "E20.CreatureSizeTowering",
  extended3: "E20.CreatureSizeExtended3",
  titanic: "E20.CreatureSizeTitanic"
};
