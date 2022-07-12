export const E20 = {};

E20.defenseBase = 10;

E20.rollingFor = "E20.rollingFor";
E20.withAnEdge = "E20.withAnEdge";
E20.withASnag = "E20.withASnag";
E20.autoFail = "E20.autoFail";
E20.autoFailFumble = "E20.autoFailFumble";
E20.rollDialogTitle = "E20.rollDialogTitle";
E20.cancel = "E20.cancel";
E20.roll = "E20.roll";

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

E20.elements = {
  acid: "E20.elements.acid",
  cold: "E20.elements.cold",
  electric: "E20.elements.electric",
  energy: "E20.elements.energy",
  fire: "E20.elements.fire",
  laser: "E20.elements.laser",
  sonic: "E20.elements.sonic"
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

E20.skills = {
  athletics: "E20.essenceSkills.strength.athletics",
  brawn: "E20.essenceSkills.strength.brawn",
  intimidation: "E20.essenceSkills.strength.intimidation",
  might: "E20.essenceSkills.strength.might",
  acrobatics: "E20.essenceSkills.speed.acrobatics",
  driving: "E20.essenceSkills.speed.driving",
  finesse: "E20.essenceSkills.speed.finesse",
  infiltration: "E20.essenceSkills.speed.infiltration",
  alertness: "E20.essenceSkills.smarts.alertness",
  culture: "E20.essenceSkills.smarts.culture",
  science: "E20.essenceSkills.smarts.science",
  survival: "E20.essenceSkills.smarts.survival",
  technology: "E20.essenceSkills.smarts.technology",
  animalHandling: "E20.essenceSkills.social.animalHandling",
  deception: "E20.essenceSkills.social.deception",
  performance: "E20.essenceSkills.social.performance",
  persuasion: "E20.essenceSkills.social.persuasion",
  streetwise: "E20.essenceSkills.social.streetwise",
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
  athletics: "E20.essenceSkills.strength.athletics",
  might: "E20.essenceSkills.strength.might",
  finesse: "E20.essenceSkills.speed.finesse",
  targeting: "E20.essenceSkills.speed.targeting",
  technology: "E20.essenceSkills.smarts.technology",
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
