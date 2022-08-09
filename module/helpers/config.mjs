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
  non: "E20.armorClassifications.non",
  light: "E20.armorClassifications.light",
  medium: "E20.armorClassifications.medium",
  heavy: "E20.armorClassifications.heavy",
};

E20.armorTraits = {
  deflective: "E20.armorTraits.deflective",
  silent: "E20.armorTraits.silent",
};

E20.availabilities = {
  automatic: "E20.availabilities.automatic",
  standard: "E20.availabilities.standard",
  limited: "E20.availabilities.limited",
  restricted: "E20.availabilities.restricted",
  prototype: "E20.availabilities.prototype",
  unique: "E20.availabilities.unique",
  theoretical: "E20.availabilities.theoretical",
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
  cleverness: "E20.defenses.cleverness",
  evasion: "E20.defenses.evasion",
  toughness: "E20.defenses.toughness",
  willpower: "E20.defenses.willpower",
};

E20.effectShapes = {
  circle: "E20.effectShapes.circle",
  cone: "E20.effectShapes.cone",
  square: "E20.effectShapes.square",
};

E20.essences = {
  strength: "E20.essences.strength",
  speed: "E20.essences.speed",
  smarts: "E20.essences.smarts",
  social: "E20.essences.social",
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

E20.lightRange = {
  bright: "E20.lightRange.bright",
  dim: "E20.lightRange.dim",
};

E20.movement = {
  aerial: "E20.movement.aerial",
  aerialMin: "E20.movement.aerialMin",
  ground: "E20.movement.ground",
  swim: "E20.movement.swim",
};

E20.rangers = {
  black: "E20.rangers.black",
  blue: "E20.rangers.blue",
  green: "E20.rangers.green",
  pink: "E20.rangers.pink",
  red: "E20.rangers.red",
  yellow: "E20.rangers.yellow",
  white: "E20.rangers.white",
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
  athletics: "E20.essenceSkills.athletics",
  brawn: "E20.essenceSkills.brawn",
  intimidation: "E20.essenceSkills.intimidation",
  might: "E20.essenceSkills.might",
  acrobatics: "E20.essenceSkills.acrobatics",
  driving: "E20.essenceSkills.driving",
  finesse: "E20.essenceSkills.finesse",
  infiltration: "E20.essenceSkills.infiltration",
  alertness: "E20.essenceSkills.alertness",
  culture: "E20.essenceSkills.culture",
  science: "E20.essenceSkills.science",
  survival: "E20.essenceSkills.survival",
  technology: "E20.essenceSkills.technology",
  animalHandling: "E20.essenceSkills.animalHandling",
  deception: "E20.essenceSkills.deception",
  performance: "E20.essenceSkills.performance",
  persuasion: "E20.essenceSkills.persuasion",
  streetwise: "E20.essenceSkills.streetwise",
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

E20.weaponSkills = {
  athletics: "E20.essenceSkills.athletics",
  might: "E20.essenceSkills.might",
  finesse: "E20.essenceSkills.finesse",
  targeting: "E20.essenceSkills.targeting",
  technology: "E20.essenceSkills.technology",
};

E20.weaponRequirementSkills = {
  none: "",
  ...E20.weaponSkills,
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

