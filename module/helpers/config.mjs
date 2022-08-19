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
  "criticalSuccess": "E20.shifts.criticalSuccess",
  "autoSuccess": "E20.shifts.autoSuccess",
  "3d6": "E20.shifts.3d6",
  "2d8": "E20.shifts.2d8",
  "d12": "E20.shifts.d12",
  "d10": "E20.shifts.d10",
  "d8": "E20.shifts.d8",
  "d6": "E20.shifts.d6",
  "d4": "E20.shifts.d4",
  "d2": "E20.shifts.d2",
  "d20": "E20.shifts.d20",
  "autoFail": "E20.shifts.autoFail",
  "fumble": "E20.shifts.fumble",
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
  integrated: "E20.weaponSizes.integrated",
  sidearm: "E20.weaponSizes.sidearm",
  medium: "E20.weaponSizes.medium",
  long: "E20.weaponSizes.long",
  heavy: "E20.weaponSizes.heavy",
};

E20.weaponStyles = {
  melee: "E20.weaponStyles.melee",
  energy: "E20.weaponStyles.energy",
  explosive: "E20.weaponStyles.explosive",
  projectile: "E20.weaponStyles.projectile",
};

E20.weaponTraits = {
  acid: "E20.weaponTraits.acid",
  amphibious: "E20.weaponTraits.amphibious",
  antiTank: "E20.weaponTraits.antiTank",
  aquatic: "E20.weaponTraits.aquatic",
  area: "E20.weaponTraits.area",
  armorPiercing: "E20.weaponTraits.armorPiercing",
  ballistic: "E20.weaponTraits.ballistic",
  blunt: "E20.weaponTraits.blunt",
  cold: "E20.weaponTraits.cold",
  consumable: "E20.weaponTraits.consumable",
  cover: "E20.weaponTraits.cover",
  electric: "E20.weaponTraits.electric",
  energy: "E20.weaponTraits.energy",
  fire: "E20.weaponTraits.fire",
  grapple: "E20.weaponTraits.grapple",
  indirect: "E20.weaponTraits.indirect",
  intimidating: "E20.weaponTraits.intimidating",
  laser: "E20.weaponTraits.laser",
  maneuver: "E20.weaponTraits.maneuver",
  mounted: "E20.weaponTraits.mounted",
  multipleTargets: "E20.weaponTraits.multipleTargets",
  poison: "E20.weaponTraits.poison",
  psychic: "E20.weaponTraits.psychic",
  seeking: "E20.weaponTraits.seeking",
  sharp: "E20.weaponTraits.sharp",
  silent: "E20.weaponTraits.silent",
  sonic: "E20.weaponTraits.sonic",
  spot: "E20.weaponTraits.spot",
  stun: "E20.weaponTraits.stun",
  trip: "E20.weaponTraits.trip",
  wrecker: "E20.weaponTraits.wrecker",
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
