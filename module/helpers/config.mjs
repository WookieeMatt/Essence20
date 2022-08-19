export const E20 = {};

E20.defenseBase = 10;

E20.alternateEffects = "E20.alternateEffects";
E20.attackRoll = "E20.attackRoll";
E20.autoFail = "E20.autoFail";
E20.autoFailFumble = "E20.autoFailFumble";
E20.cancel = "E20.cancel";
E20.effect = "E20.effect";
E20.none = "E20.none";
E20.roll = "E20.roll";
E20.rollDialogTitle = "E20.rollDialogTitle";
E20.rollingFor = "E20.rollingFor";
E20.withAnEdge = "E20.withAnEdge";
E20.withASnag = "E20.withASnag";

E20.armorClassifications = {
  non: "E20.armorClassificationNon",
  light: "E20.armorClassificationLight",
  medium: "E20.armorClassificationMedium",
  heavy: "E20.armorClassificationHeavy",
};

E20.armorTraits = {
  deflective: "E20.armorTraitDeflective",
  silent: "E20.armorTraitSilent",
};

E20.availabilities = {
  automatic: "E20.availabilityAutomatic",
  standard: "E20.availabilityStandard",
  limited: "E20.availabilityLimited",
  restricted: "E20.availabilityRestricted",
  prototype: "E20.availabilityPrototype",
  unique: "E20.availabilityUnique",
  theoretical: "E20.availabilityTheoretical",
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
  cleverness: "E20.defenseCleverness",
  evasion: "E20.defenseEvasion",
  toughness: "E20.defenseToughness",
  willpower: "E20.defenseWillpower",
};

E20.effectShapes = {
  circle: "E20.effectShapeCircle",
  cone: "E20.effectShapeCone",
  square: "E20.effectShapeSquare",
};

E20.essences = {
  strength: "E20.essenceStrength",
  speed: "E20.essenceSpeed",
  smarts: "E20.essenceSocial",
  social: "E20.essenceSmarts",
};

E20.initiativeShifts = {
  "d20": "E20.shifts.d20",
  "d2": "E20.shifts.d2",
  "d4": "E20.shifts.d4",
  "d6": "E20.shifts.d6",
  "d8": "E20.shifts.d8",
  "d10": "E20.shifts.d10",
  "d12": "E20.shifts.d12",
  "2d8": "E20.shifts.2d8",
  "3d6": "E20.shifts.3d6",
};

E20.lightRanges = {
  bright: "E20.lightRangeBright",
  dim: "E20.lightRangeDim",
};

E20.movementTypes = {
  aerial: "E20.movementTypeAerial",
  ground: "E20.movementTypeGround",
  swim: "E20.movementTypeSwim",
};

E20.rangers = {
  black: "E20.rangerBlack",
  blue: "E20.rangerBlue",
  green: "E20.rangerGreen",
  pink: "E20.rangerPink",
  red: "E20.rangerRed",
  yellow: "E20.rangerYellow",
  white: "E20.rangerWhite",
};

E20.shifts = {
  "criticalSuccess": "E20.shiftCriticalSuccess",
  "autoSuccess": "E20.shiftAutoSuccess",
  "3d6": "3d6",
  "2d8": "2d8",
  "d12": "d12",
  "d10": "d10",
  "d8": "d8",
  "d6": "d6",
  "d4": "d4",
  "d2": "d2",
  "d20": "d20",
  "autoFail": "E20.shiftAutoFail",
  "fumble": "E20.shiftFumble",
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
  athletics: "E20.essenceSkillAthletics",
  brawn: "E20.essenceSkillBrawn",
  intimidation: "E20.essenceSkillIntimidation",
  might: "E20.essenceSkillMight",
  acrobatics: "E20.essenceSkillAcrobatics",
  driving: "E20.essenceSkillDriving",
  finesse: "E20.essenceSkillFinesse",
  infiltration: "E20.essenceSkillInfiltration",
  targeting: "E20.essenceSkillTargeting",
  alertness: "E20.essenceSkillAlertness",
  culture: "E20.essenceSkillCulture",
  science: "E20.essenceSkillScience",
  survival: "E20.essenceSkillSurvival",
  technology: "E20.essenceSkillTechnology",
  animalHandling: "E20.essenceSkillAnimalHandling",
  deception: "E20.essenceSkillDeception",
  performance: "E20.essenceSkillPerformance",
  persuasion: "E20.essenceSkillPersuasion",
  streetwise: "E20.essenceSkillStreetwise",
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
  "d2": "E20.shifts.d2",
  "d4": "E20.shifts.d4",
  "d6": "E20.shifts.d6",
  "d8": "E20.shifts.d8",
  "d10": "E20.shifts.d10",
  "d12": "E20.shifts.d12",
  "2d8": "E20.shifts.2d8",
  "3d6": "E20.shifts.3d6",
};

E20.weaponSizes = {
  integrated: "E20.weaponSizeIntegrated",
  sidearm: "E20.weaponSizeSidearm",
  medium: "E20.weaponSizeMedium",
  long: "E20.weaponSizeLong",
  heavy: "E20.weaponSizeHeavy",
};

E20.weaponStyles = {
  melee: "E20.weaponStyleMelee",
  energy: "E20.weaponStyleEnergy",
  explosive: "E20.weaponStyleExplosive",
  projectile: "E20.weaponStyleProjectile",
};

E20.weaponTraits = {
  acid: "E20.weaponTraitAcid",
  amphibious: "E20.weaponTraitAmphibious",
  antiTank: "E20.weaponTraitAntiTank",
  aquatic: "E20.weaponTraitAquatic",
  area: "E20.weaponTraitArea",
  armorPiercing: "E20.weaponTraitArmorPiercing",
  ballistic: "E20.weaponTraitBallistic",
  blunt: "E20.weaponTraitBlunt",
  cold: "E20.weaponTraitCold",
  consumable: "E20.weaponTraitConsumable",
  cover: "E20.weaponTraitCover",
  electric: "E20.weaponTraitElectric",
  energy: "E20.weaponTraitEnergy",
  fire: "E20.weaponTraitFire",
  grapple: "E20.weaponTraitGrapple",
  indirect: "E20.weaponTraitIndirect",
  intimidating: "E20.weaponTraitIntimidating",
  laser: "E20.weaponTraitLaser",
  maneuver: "E20.weaponTraitManeuver",
  mounted: "E20.weaponTraitMounted",
  multipleTargets: "E20.weaponTraitMultipleTargets",
  poison: "E20.weaponTraitPoison",
  psychic: "E20.weaponTraitPsychic",
  seeking: "E20.weaponTraitSeeking",
  sharp: "E20.weaponTraitSharp",
  silent: "E20.weaponTraitSilent",
  sonic: "E20.weaponTraitSonic",
  spot: "E20.weaponTraitSpot",
  stun: "E20.weaponTraitStun",
  trip: "E20.weaponTraitTrip",
  wrecker: "E20.weaponTraitWrecker",
}

E20.creatureSizes = {
  small: "E20.creatureSizeSmall",
  common: "E20.creatureSizeCommon",
  large: "E20.creatureSizeLarge",
  long: "E20.creatureSizeLong",
  huge: "E20.creatureSizeHuge",
  extended: "E20.creatureSizeExtended",
  gigantic: "E20.creatureSizeGigantic",
  extended2: "E20.creatureSizeExtended2",
  towering: "E20.creatureSizeTowering",
  extended3: "E20.creatureSizeExtended3",
  titanic: "E20.creatureSizeTitanic"
};
