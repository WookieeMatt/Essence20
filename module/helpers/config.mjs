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

/* The compendium pack folder each game line keeps its books in, as named in system.json's
   packFolders. Deliberately NOT derived from E20.gameVersions' labels: those happen to read
   the same today ("GI Joe", "My Little Pony", ...), but they are localized and the folder
   names are not, so the first translation would silently stop matching any book.

   Not preLocalized - these are data, not display strings. */
E20.gameLinePackFolders = {
  giJoe: "GI Joe",
  myLittlePony: "My Little Pony",
  powerRangers: "Power Rangers",
  transformers: "Transformers",
  welcomeToNightVale: "Welcome to Night Vale",
};

/************************************************
 * Defense                                      *
 ***********************************************/

// Essence-based defenses
// Area of Effect shape (GitHub #824) - see data/item/weapon-effect.mjs's own system.shape field
// and helpers/aoe-targeting.mjs for what each one actually does.
/* Area of Effect shapes, shared by weaponEffects, spells and Powers (module/data/aoe-schema.mjs).
   The keys are Foundry's OWN region shape type names, not a vocabulary of this system's own, so a
   stored value can be handed straight to canvas.regions.placeRegion() - see
   helpers/aoe-targeting.mjs. Foundry v14 offers ten shape types; only the three that map onto
   something this system's books actually describe are exposed here:
     circle    - centred on a chosen impact point (a thrown grenade's "Blast (10ft radius)").
                 Stored as "burst" before this became a shared schema; migration.mjs remaps it.
     cone      - apex on the attacker's own token, aimed at a chosen point (a flamethrower's
                 "Blast (15ft cone)").
     emanation - anchored to a token and moving with it, for an area that emanates from a creature
                 rather than from a point on the ground. */
/* How long a spell or Power's effect lasts (module/data/duration-schema.mjs). "instant" and
   "special" carry no count; the rest are counted units. Read by helpers/aoe-targeting.mjs to
   decide whether a placed area is discarded immediately or persists on the scene. */
E20.durationUnits = {
  instant: "E20.DurationUnitInstant",
  rounds: "E20.DurationUnitRounds",
  minutes: "E20.DurationUnitMinutes",
  hours: "E20.DurationUnitHours",
  days: "E20.DurationUnitDays",
  scenes: "E20.DurationUnitScenes",
  special: "E20.DurationUnitSpecial",
};
preLocalize("durationUnits");

/* Singular forms of the counted units above, used only to build a display label - "1 Scene"
   rather than "1 Scene(s)". Deliberately not a choices list: nothing is ever STORED as one of
   these, so it holds only the units that can actually carry a count. */
E20.durationUnitsSingular = {
  rounds: "E20.DurationUnitRound",
  minutes: "E20.DurationUnitMinute",
  hours: "E20.DurationUnitHour",
  days: "E20.DurationUnitDay",
  scenes: "E20.DurationUnitScene",
};
preLocalize("durationUnitsSingular");

E20.aoeShapes = {
  circle: "E20.AoeShapeCircle",
  cone: "E20.AoeShapeCone",
  // A straight band from the attacker, aimed at a chosen point (PR CRB's own "Blast: 60ft line").
  // Rarer than the others - one printed example across every book - but it IS printed, so a Blast
  // quality can't be fully expressed without it.
  line: "E20.AoeShapeLine",
  emanation: "E20.AoeShapeEmanation",
};
preLocalize("aoeShapes");

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

// The Weapon requirement shifts as an ordered ladder, lowest to highest, used to step a
// requirement down "one die" for a weapon installed in an Integrated Hardpoint (TF CRB p.114:
// "lower their Brawn requirements (if any) by one die (a requirement of d4 Brawn becomes d2)").
E20.weaponRequirementShiftLadder = ["none", "d2", "d4", "d6", "d8", "d10", "d12", "2d8", "3d6"];

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

// Default number of loadout "hands" a Weapon takes to wield, keyed off its Size, when the
// Weapon itself doesn't set an explicit system.hands override. Used for the six-hand Load Out
// tally (GI Joe CRB p.137-138 / TF CRB p.116 / PR CRB p.103). Integrated built-in weapons
// default to 0 - TF integrated-Hardpoint weapons don't count against the six-hand limit anyway.
E20.weaponSizeHands = {
  integrated: 0,
  sidearm: 1,
  light: 1,
  medium: 2,
  long: 2,
  heavy: 2,
};

// Base Load Out limit before any Role/Perk bonus: "six hands of weapons" (GI Joe CRB p.138,
// TF CRB p.116, PR CRB p.103). Actors store only system.loadout.handsMax (defaulting to this),
// which a GM/player can raise for Perks like Pack Mule.
E20.LOADOUT_BASE_HANDS = 6;

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
  // Linked (GI Joe CRB, Vehicle Trait, p.173): "Linked weapons gain an Edge on attacks." A
  // per-weapon trait, not just a whole-Vehicle one (RAW's own example stat blocks list "Linked"
  // directly in individual weapons' own Traits, e.g. the Dragonfly's "Laser-Guided 160MM Cannon
  // Pod... Traits: Ballistic, Computerized, Linked, Reload") - same shape 'computerized' already
  // has here, appearing on both this weapon-level enum and E20.vehicleTraits as a separate,
  // whole-vehicle concept.
  linked: "E20.WeaponTraitLinked",
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

/* Sample Specialization catalogs, one per E20.gameVersions line, keyed by skill - pulled from
   each line's own "Essence Scores and Skills" chapter ("Sample/Suggested/Example Specializations"
   per skill: GI Joe CRB p.116-122, MLP CRB p.99-107, Power Rangers CRB p.79-87, Transformers CRB
   p.95-101, Welcome to Night Vale: Citizens' Guide p.11-14). These are names only, not the
   books' own descriptive text (see feedback-essence20-no-book-text-descriptions) - every book is
   explicit that this list is suggestions, not an exhaustive catalog ("Specializations are
   available for most skills and are open ended... this chapter suggests a few for each skill"),
   so the Skill Picker's add-specialization control always offers a free-text option alongside
   this dropdown. Conditioning and Initiative are omitted entirely (every line states plainly
   neither skill has Specializations) rather than listed with an empty array, so UI code can
   treat "no entry here" and "skill can't be specialized" as the same check.

   A handful of entries name a *category* rather than a pick - "Specific Subject" (Science),
   "Specific Environment" (Survival), "Specific Technology" (Technology), "Specific Art"
   (Performance, GI Joe only), and GI Joe/Transformers' "Weapon Type"/"Weapon Classification"/
   "Weapon Trait" (Targeting/Might/Finesse). Wherever the book actually names examples for one of
   these ("such as Biology, Chemistry, Zoology, etc.", "such as Deserts, Forests, or the Arctic"),
   those are expanded into their own concrete entries below rather than left as one vague catalog
   entry nobody could actually specialize with by picking it as-is - the free-text "Custom..."
   option already covers anything not named. Where a book's own text gives no such examples for
   that category (e.g. Power Rangers' own "Specific Environment", every line's "Specific Culture"
   except MLP's), it's left as a bare category entry, since there's nothing in the source to
   expand it into. */
E20.standardSpecializations = {
  giJoe: {
    athletics: ["Climbing", "Running", "Sports Activity", "Swimming", "Throwing"],
    brawn: ["Force", "Endurance"],
    intimidation: ["Distract", "Frighten", "Taunt"],
    might: ["Blunt Weaponry", "Grappling", "Martial Arts"],
    acrobatics: ["Coordination", "Escape Artist", "Gymnastics", "Maneuverability"],
    driving: ["Air", "Land", "Sea"],
    finesse: ["Martial Arts", "Sharp Weaponry", "Throwing"],
    infiltration: ["Burglary", "Sleight of Hand", "Shadowing", "Stealth"],
    // "Weapon Type" (GI Joe CRB p.117) isn't itself a pick - it's mastery with one particular
    // weapon family, "such as pistols, submachine guns, shotguns, assault rifles, sniper rifles,
    // and other weapon types found in Chapter 8: Equipment. This can be taken multiple times,
    // once for each weapon family" - so it's expanded here into the book's own named families
    // rather than left as one vague catalog entry a player couldn't actually specialize with.
    targeting: [
      "Archery", "Martial Arts", "Throwing", "Vehicle",
      "Assault Rifle", "Pistol", "Shotgun", "Sniper Rifle", "Submachine Gun",
    ],
    alertness: ["Insight", "Investigation", "Perception", "Situational Awareness"],
    culture: ["Classified Intel", "History", "Linguistics", "Psychology"],
    science: ["Medicine", "Biology", "Chemistry", "Zoology"],
    survival: ["Foraging", "Hunting", "Deserts", "Forests", "Arctic", "Tracking"],
    technology: [
      "Advanced Technology", "Communications", "Computers", "Engineering", "Explosives",
      "Artificial Intelligence", "Drones", "Mechanics", "Robotics",
    ],
    animalHandling: ["Pet", "Riding", "Training"],
    deception: ["Bluffing", "Disguise", "Distraction"],
    performance: ["Dancing", "Singing", "Painting"],
    persuasion: ["Diplomacy", "Flattery", "Truth"],
    streetwise: ["Black Market", "Crime", "Transportation"],
  },
  myLittlePony: {
    athletics: ["Climbing", "Trotting", "Sport (Specific)", "Swimming"],
    brawn: ["Carry", "Drag", "Lift"],
    intimidation: ["Distract", "Frighten", "Taunt"],
    might: ["Grappling", "Shoving", "Unarmed Combat", "Melee Weapon (Specific)"],
    acrobatics: ["Balance", "Flying", "Gymnastics"],
    driving: ["Air Vehicle", "Land Vehicle", "Sea Vehicle"],
    finesse: ["Coordination", "Martial Arts", "Steady Hoof"],
    infiltration: ["Burglary", "Shadowing", "Sleight of Hoof", "Stealth"],
    targeting: ["Kicking", "Ranged Weapon (Specific)", "Trajectory"],
    alertness: ["Insight", "Investigation", "Perception"],
    culture: ["Cuisine", "Fashion", "History", "Linguistics", "Yakyakistan", "Klugetown"],
    science: ["Medicine", "Research", "Biology", "Chemistry", "Mathematics"],
    survival: ["Cartography", "Foraging", "Meteorology", "Deserts", "Forests", "Sea"],
    technology: ["Engineering", "Simple Machines", "Theoretical Technology"],
    animalHandling: ["Domesticated Pets", "Mythical Creatures", "Wild Animals"],
    deception: ["Bluffing", "Disguise", "Misdirect"],
    performance: ["Career Art (Specific)", "Literary Art (Specific)", "Performing Art (Specific)", "Visual Art (Specific)"],
    persuasion: ["Diplomacy", "Etiquette", "Understanding"],
    streetwise: ["Connections", "Gossip", "Underworld"],
    spellcasting: ["Circle", "Dispelling", "Magical Knowledge"],
  },
  powerRangers: {
    athletics: ["Climbing", "Jogging/Running", "Sports Activity", "Swimming", "Throwing"],
    brawn: ["Drag", "Lift", "Stamina"],
    intimidation: ["Distract", "Frighten", "Taunt"],
    might: ["Blunt Weapons", "Grappling", "Martial Arts", "Power Weapons", "Pushing"],
    acrobatics: ["Balance", "Flying", "Gymnastics", "Maneuverability"],
    driving: [
      "Autopilot", "Boat", "Hovercraft", "Motorcycle", "Rotor", "Submersible", "Tracked",
      "Wheeled", "Winged", "Zord",
    ],
    finesse: ["Escape Artist", "Martial Arts", "Power Weapon", "Sharp Weaponry", "Steady Action", "Throwing"],
    infiltration: ["Burglary", "Sleight of Hand", "Shadowing", "Stealth"],
    targeting: [
      "Archery", "Ballistic", "Energy", "Power Weapon", "Specific Weapon", "Throwing",
      "Trajectory", "Vehicle",
    ],
    alertness: ["Insight", "Investigation", "Perception"],
    culture: ["Grid Lore", "History", "Language", "Psychology", "Specific Culture"],
    science: ["Medicine", "Biology", "Chemistry", "Xeno-zoology"],
    survival: ["Cartography", "Foraging", "Hunting", "Specific Environment", "Weather Prediction"],
    technology: ["Computer", "Grid Tech", "Engineering", "Artificial Intelligence", "Mechanics", "Robotics"],
    animalHandling: ["Calming", "Riding", "Animal Type", "Training"],
    deception: ["Bluffing", "Disguise", "Distraction"],
    performance: ["Visual Arts", "Literary Arts", "Performing Arts", "Culinary Arts"],
    persuasion: ["Diplomacy", "Embellishments", "Flattery", "Romance", "Truth"],
    streetwise: ["Black Market", "Crime", "Gossip", "Transportation"],
  },
  // "Weapon Classification" and "Weapon Trait" (Transformers CRB p.97-100) aren't themselves
  // picks - each is mastery with weapons sharing one specific Classification or Trait, "such as"
  // the examples actually named per skill (a genuine narrower pick than the full ~65-entry
  // E20.weaponTraits master list, which spans every game line's weapons and includes plenty with
  // no combat-specialization narrative at all, like acid/psychic/xenotech) - expanded below into
  // those named examples rather than left as one vague catalog entry. Athletics' own "Weapon
  // Trait" has no "such as" example in the book at all, so it's left as a bare entry (same
  // "Custom" free-text intent as Culture/Science/Survival/Technology's "Specific X" entries).
  transformers: {
    athletics: ["Climbing", "Running", "Sports Activity", "Swimming", "Weapon Trait"],
    brawn: ["Force", "Endurance", "Mettle"],
    intimidation: ["Distract", "Frighten", "Taunt"],
    might: ["Grappling", "Martial Arts", "Heavy Swords", "Clubs", "Blunt", "Silent"],
    acrobatics: ["Balance", "Coordination", "Escape", "Gymnastics"],
    driving: ["Air", "Land", "Sea"],
    finesse: ["Dexterity", "Martial Arts", "Swords", "Knives", "Maneuver", "Sharp"],
    infiltration: ["Burglary", "Sleight of Hand", "Shadow", "Stealth"],
    targeting: ["Vehicular Weaponry", "Rifles", "Grenades", "Sniper"],
    alertness: ["Insight", "Investigation", "Perception", "Situational Awareness"],
    culture: ["Classified Intel", "History", "Linguistics", "Planetary", "Psychology", "Specific Culture"],
    science: ["Medicine", "Biology", "Chemistry", "Physics", "Zoology"],
    survival: ["Foraging", "Camping", "Deserts", "Forests", "Arctic", "Tracking"],
    technology: [
      "Advanced Technology", "Communications", "Computers", "Engineering", "Explosives",
      "Repair", "Artificial Intelligence", "Drones", "Mechanics", "Robotics",
    ],
    animalHandling: ["Calm", "Pet", "Training"],
    deception: ["Bluffing", "Disguise", "Distraction"],
    performance: ["Literary Arts", "Performing Arts", "Visual Arts"],
    persuasion: ["Diplomacy", "Embellishments", "Flattery", "Truth"],
    streetwise: ["Black Market", "Crime", "Gossip", "Transportation"],
  },
  // Welcome to Night Vale: Citizens' Guide p.11-14 - condensed into per-skill tables ("EXAMPLE
  // SPECIALIZATIONS") rather than the bulleted prose the other four lines use, but the same
  // "suggestions, not a fixed catalog" framing applies. Weird (this line's own "any"-Essence
  // skill, p.14) lists its examples under five broader usage themes instead of one flat list -
  // flattened here into a single array, same treatment as MLP's own Spellcasting suggestions.
  // Survival's own third example ("specific environments") names no actual environments the way
  // Athletics/Survival do in the other three lines that got that treatment - left as a bare
  // category entry for the same reason Power Rangers' own "Specific Environment" was.
  welcomeToNightVale: {
    athletics: ["Climb", "Jump", "Sprint", "Swim", "Sports"],
    brawn: ["Carry", "Drag", "Lift"],
    intimidation: ["Distract", "Frighten", "Taunt"],
    might: ["Brawl", "Grapple", "Clubs", "Hammers"],
    acrobatics: ["Balance", "Gymnastics", "Tumbling"],
    driving: ["Cars", "Boats", "Planes"],
    finesse: ["Coordination", "Martial Arts", "Swords"],
    infiltration: ["Lockpicking", "Sleight of Hand", "Stealth"],
    targeting: ["Bows", "Guns", "Trajectory"],
    alertness: ["Insight", "Investigation", "Perception"],
    culture: ["Cuisine", "Fashion", "History"],
    science: ["Medicine", "Research", "Strange Phenomena"],
    survival: ["Cartography", "Foraging", "Specific Environment"],
    technology: ["Computers", "Engineering", "Theoretical Tech"],
    animalHandling: ["Pets", "Training", "Riding"],
    deception: ["Disguise", "Lying", "Misdirection"],
    performance: ["Dance", "Painting", "Singing"],
    persuasion: ["Diplomacy", "Etiquette", "Negotiation"],
    streetwise: ["Connections", "Gossip", "Underworld"],
    weird: [
      "Absorb", "Blend", "Imprint", "Dimensions", "Objects", "Timelines", "Decontaminate",
      "Disbelieve", "Unveil", "Lucidity", "Scopaesthesia", "Witness", "Communicate",
      "Comprehend", "Paraphrase",
    ],
  },
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
  // The default for every item type. With ~2,600 Perks carrying no authored action cost, anything
  // else would have the system inventing costs it can't justify - see actionTypeCosts below, where
  // 'none' deliberately spends nothing.
  none: "E20.ActionTypeNone",
  free: "E20.ActionTypeFree",
  fullAction: "E20.ActionTypeFullAction",
  move: "E20.ActionTypeMove",
  // The Contingency action (GI Joe CRB, p.196): "making your character ready to do something when
  // something else occurs... a predetermined action after your place in the Initiative order, but
  // before the start of your next turn." This is Essence20's readied/interrupt mechanism, and it
  // is a STANDARD action - there is no separate reaction resource anywhere in the rules. Listed
  // separately from plain 'standard' because several Perks change its cost specifically (Vigilance
  // p.110 and Not Getting Away That Easy p.98 both allow "a Contingency action as a Free action").
  contingency: "E20.ActionTypeContingency",
  standard: "E20.ActionTypeStandard",
  standardAndMove: "E20.ActionTypeStandardAndMove",
  wholeTurn: "E20.ActionTypeWholeTurn",
  tenMinutes: "E20.ActionTypeTenMinutes",
  oneHour: "E20.ActionTypeOneHour",
};
preLocalize("actionTypes");

/* The three per-turn budgets an actor tracks - the keys of system.actions (see
   data/actor/templates/common.mjs) and of a Combatant's own spend ledger. Three, not four: the
   rules define exactly Move, Standard and Free (CRB p.192-193), and the Contingency action spends
   a Standard rather than a resource of its own. */
E20.actionCategories = {
  standard: "E20.ActionTypeStandard",
  move: "E20.ActionTypeMove",
  free: "E20.ActionTypeFree",
};
preLocalize("actionCategories");

/* What each actionType above actually costs, as {category: amount}. An empty object means "spends
   nothing", which covers three genuinely different cases: 'none' (a passive item, the default),
   and tenMinutes/oneHour, which are out-of-combat DURATIONS rather than budgets - modelling those
   as a cost of zero rather than excluding them outright is what would otherwise have every
   downtime Perk asking the combat tracker for permission.

   fullAction/standardAndMove/wholeTurn all consume both budgets and are spent atomically (see
   helpers/action-economy.mjs#spend) - if either half is gone, neither is taken. wholeTurn
   additionally flags the NEXT turn, which is why it's listed separately from standardAndMove
   despite the identical cost. */
E20.actionTypeCosts = {
  none: {},
  free: { free: 1 },
  fullAction: { standard: 1, move: 1 },
  move: { move: 1 },
  // Setting a Contingency costs the Standard action; it resolves later, out of turn, at no
  // further cost. See E20.actionTypes' own comment.
  contingency: { standard: 1 },
  standard: { standard: 1 },
  standardAndMove: { standard: 1, move: 1 },
  wholeTurn: { standard: 1, move: 1 },
  tenMinutes: {},
  oneHour: {},
};

// Action types that also consume the actor's NEXT turn - see resetTurn's own carry-over handling.
/* The actions the rules give everyone, as opposed to the ones an Item provides. An Item is
   clicked and charges itself through Item#roll (see helpers/action-economy.mjs#consumeForItem),
   but "I Defend" or "I Sprint" has nothing to click, so before this the player had to work out
   the cost and decrement a pip by hand with no record of what it went on.

   Standard actions are Attack, Contingency, Defend, Hide, Lend Assistance, Search the Area, Use
   a Skill and Sprint (GI Joe CRB p.192). Commanding a pet is also a Standard action - "Commanding
   an animal pet requires a Handle Animal Skill Test as a Standard action" (p.164) - and is listed
   because two Perks re-cost it and would otherwise have nothing to point at.

   `type` is a key of actionTypeCosts, so the cost lives in one place: Contingency stays a
   Standard action here exactly as it is there. Only labels are stored, never rule text. */
E20.namedActions = {
  attack: { label: 'E20.ActionAttack', type: 'standard' },
  // Aiming is a Free action and can be taken more than once: "you can choose to ignore one of
  // the target's Armor Upgrades for each Free action you spend Aiming" (TF CRB), and GI Joe CRB
  // p.133 speaks of "when you Aim as a Free action".
  aim: { label: 'E20.ActionAim', type: 'free' },
  contingency: { label: 'E20.ActionContingency', type: 'contingency' },
  defend: { label: 'E20.ActionDefend', type: 'standard' },
  hide: { label: 'E20.ActionHide', type: 'standard' },
  lendAssistance: { label: 'E20.ActionLendAssistance', type: 'standard' },
  searchTheArea: { label: 'E20.ActionSearchTheArea', type: 'standard' },
  useASkill: { label: 'E20.ActionUseASkill', type: 'standard' },
  sprint: { label: 'E20.ActionSprint', type: 'standard' },
  commandPet: { label: 'E20.ActionCommandPet', type: 'standard' },
  move: { label: 'E20.ActionMove', type: 'move' },
  freeAction: { label: 'E20.ActionFree', type: 'free' },
};
preLocalize("namedActions", { key: "label" });
E20.actionTypesConsumingNextTurn = ['wholeTurn'];

/* How hard the action economy is enforced, world-wide. 'track' is the default and not as a hedge:
   with the overwhelming majority of Perks carrying no authored action cost, shipping 'strict'
   would gate real abilities on absent data. It also matches the idiom this codebase already
   settled on elsewhere - "visible marker, not hard enforcement" (see helpers/undo-engine.mjs). */
E20.actionEconomyModes = {
  off: "E20.ActionEconomyModeOff",
  track: "E20.ActionEconomyModeTrack",
  warn: "E20.ActionEconomyModeWarn",
  strict: "E20.ActionEconomyModeStrict",
};
preLocalize("actionEconomyModes");

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

// Which Equipment Assignment bucket an Equipment Package represents (GI Joe CRB p.136-138 /
// TF CRB p.114-115 / PR CRB p.103): the same-for-everyone Standard Issue kit, gear you're
// Qualified for (taken freely, no roll), squad-level Mission Critical items, or a character's
// approved Personal gear.
E20.equipmentPackageTypes = {
  standardIssue: "E20.EquipmentPackageTypeStandardIssue",
  qualified: "E20.EquipmentPackageTypeQualified",
  missionCritical: "E20.EquipmentPackageTypeMissionCritical",
  personal: "E20.EquipmentPackageTypePersonal",
};
preLocalize("equipmentPackageTypes");

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

// Table 8-1: Equipment Availability - the Skill Test DIF to Requisition an item of each
// Availability tier (GI Joe CRB p.138 / PR CRB p.104). "other" has no listed DIF; treat it
// as Standard.
E20.availabilityDifficulties = {
  automatic: 0,
  standard: 0,
  limited: 10,
  restricted: 15,
  prototype: 20,
  unique: 25,
  theoretical: 30,
  other: 0,
};

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
  acid: "E20.DamageAcid",
  blindingBlast: "E20.DamageBlindingBlast",
  blunt: "E20.DamageBlunt",
  cold: "E20.DamageCold",
  cover: "E20.DamageCover",
  electric: "E20.DamageElectric",
  element: "E20.DamageElement",
  // Electromagnetic (p.170-ish, Damage Types): "energy that disrupts machinery." This is the same
  // damage type combat.mjs#applyDamage/dice.mjs's own Impenetrable Shield check already assume
  // exists under the key 'emp' (Personal Shield's "immunity to EMP damage") - added here to
  // actually match those existing checks against a real schema choice for the first time, rather
  // than leaving 'emp' a value no weaponEffect's damageType field could ever actually be set to.
  emp: "E20.DamageEmp",
  fire: "E20.DamageFire",
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
  psychic: "E20.DamagePsychic",
  restrained: "E20.DamageRestrained",
  sharp: "E20.DamageSharp",
  sonic: "E20.DamageSonic",
  special: "E20.DamageSpecial",
  spot: "E20.DamageSpot",
  stun: "E20.DamageStun",
  unconscious: "E20.DamageUnconscious",
  // Void: not part of this system's own core Damage Types chapter (Acid/Cold/Electric/
  // Electromagnetic/Fire/Laser/Sonic) - introduced by a specific Power Rangers sourcebook
  // (Across the Stars' Void Blade/Bow, echoed by Finster's Monster-Matic Cookbook's Focused Rage
  // Flare) as its own rare Element sub-type ("Element (Void)" per Across the Stars' own Traits
  // glossary, p.79). No distinct mechanical rule is defined for it anywhere found so far - added
  // here purely so these items can be classified correctly instead of falling back to generic
  // `element`, same as every other real sub-type this system tracks.
  void: "E20.DamageVoid",
};
preLocalize("damageTypes");

// The concrete, choosable sub-types of the Element damage-type family (Weapon Effects and Traits:
// "you must first choose the type of element the weapon uses") - the same 7 keys
// helpers/combat.mjs#ENERGY_DAMAGE_TYPES matches against, minus the generic 'element' catch-all
// itself (an unspecified type isn't something a Perk like A Jump Through Time's own "Adapted
// Wavelength" - "choose a single type of Element damage" - could sensibly protect against).
E20.elementDamageTypes = {
  acid: "E20.DamageAcid",
  cold: "E20.DamageCold",
  electric: "E20.DamageElectric",
  emp: "E20.DamageEmp",
  fire: "E20.DamageFire",
  laser: "E20.DamageLaser",
  sonic: "E20.DamageSonic",
};
preLocalize("elementDamageTypes");

// Defensive Flexibility (A Jump Through Time, Blue Spectrum Modification, replaces Grid Tech,
// p.45) - see helpers/defensive-flexibility.mjs's own doc comment. A single flat option list
// combining both of RAW's own choice categories (a +2 bonus to one named Defense, or Resistance to
// one named Element sub-type) - each option's key encodes both which half it is AND which specific
// Defense/damage type, since a single Perk instance's system.choice can only hold one value.
// Electromagnetic Disruption (Technorganic Secrets, Technorganic Influence Perks, p.47,
// prerequisite: Mutant Beast Influence): "choose one of your Alt Modes to gain one of the
// following abilities: (1) once per day, send a 15ft electromagnetic pulse dealing 1
// Electromagnetic damage and 1 Stun to non-organic opponents within range; (2) once per scene,
// give one of your natural weapons the Electromagnetic trait for 2d2 rounds." Only option 1 is
// built (see helpers/electromagnetic-disruption.mjs) - option 2 needs the same temporary
// weapon-trait-mutation mechanism already blocking the item-grant/equipment-mutation cluster
// generally. "Which Alt Mode" isn't scoped - applies regardless of current Alt Mode, the same
// accepted simplification this project already uses for every other unenforceable narrative
// qualifier. "Non-organic opponents" is dropped too - applies to any nearby enemy.
E20.electromagneticDisruptionOptions = {
  pulse: "E20.ElectromagneticDisruptionPulse",
  weaponTrait: "E20.ElectromagneticDisruptionWeaponTrait",
};
preLocalize("electromagneticDisruptionOptions");

E20.defensiveFlexibilityOptions = {
  defenseToughness: "E20.DefensiveFlexibilityDefenseToughness",
  defenseEvasion: "E20.DefensiveFlexibilityDefenseEvasion",
  defenseWillpower: "E20.DefensiveFlexibilityDefenseWillpower",
  defenseCleverness: "E20.DefensiveFlexibilityDefenseCleverness",
  resistanceAcid: "E20.DefensiveFlexibilityResistanceAcid",
  resistanceCold: "E20.DefensiveFlexibilityResistanceCold",
  resistanceElectric: "E20.DefensiveFlexibilityResistanceElectric",
  resistanceEmp: "E20.DefensiveFlexibilityResistanceEmp",
  resistanceFire: "E20.DefensiveFlexibilityResistanceFire",
  resistanceLaser: "E20.DefensiveFlexibilityResistanceLaser",
  resistanceSonic: "E20.DefensiveFlexibilityResistanceSonic",
};
preLocalize("defensiveFlexibilityOptions");

// Spared No Expense (Ferocious Fighters, Dino-Hunters Faction Perk, p.73): "Choose one of the
// following Skills: Animal Handling, Infiltration, or Survival. You gain ↑1 on Skill Tests of your
// chosen Skill." A dedicated, narrowly-scoped choiceType (rather than reusing the generic 'skills'
// choiceType, which offers every skill in the game) since RAW explicitly restricts the choice to
// these 3 - same "a small option table for a narrow specific list" idiom elementDamageTypes above
// already established.
E20.sparedNoExpenseSkills = {
  animalHandling: "E20.SkillAnimalHandling",
  infiltration: "E20.SkillInfiltration",
  survival: "E20.SkillSurvival",
};
preLocalize("sparedNoExpenseSkills");

// Roaming the Land (Ferocious Fighters, Mega Monsters Faction Perk, p.75): "Choose to deal either
// +1 damage with melee attacks targeting smaller creatures or +1 Stun with melee attacks targeting
// larger creatures." A permanent, one-time pick (unlike Grid Surge's own pick-fresh-each-use
// shape) - same "no numeric field of its own, read directly off system.choice" idiom as
// sparedNoExpenseSkill/elementDamageType above.
E20.roamingTheLandOptions = {
  smallerDamage: "E20.RoamingTheLandSmallerDamage",
  largerStun: "E20.RoamingTheLandLargerStun",
};
preLocalize("roamingTheLandOptions");

// Community Helper (PR CRB, Influence Perk, p.68): "You gain an Edge on any non-combat tasks
// related to your chosen service." Table 5-3.1's own 4-option Skill mapping (EMT/Firefighter/
// Police Officer/National Guard) - a dedicated narrow choiceType (rather than the generic 'skills'
// picker, which offers every Skill in the game), same "small option table for a narrow specific
// list" idiom sparedNoExpenseSkills/roamingTheLandOptions above already establish. Keyed directly
// by the real Skill each profession maps to (rather than a profession-name key) so dice.mjs's own
// check can compare system.choice against rolledSkill/rolledEssence directly with no extra lookup.
E20.communityHelperSkills = {
  science: "E20.CommunityHelperEmt",
  brawn: "E20.CommunityHelperFirefighter",
  alertness: "E20.CommunityHelperPoliceOfficer",
  initiative: "E20.CommunityHelperNationalGuard",
};
preLocalize("communityHelperSkills");

// Two-Handed Assault (Factions in Action Vol. 2, Silent Weapons Expert Focus, 3rd level, p.12):
// "choose to gain either ↑1 on Attacks with two light Silent Martial Arts weapons... or ↑1 on
// Attacks with two-handed Silent Martial Arts weapons." A permanent, one-time pick determining
// which weapon-handedness configuration the manual Roll Options Dialog checkbox (same "no dual-
// wielding/hand-tracking concept exists, so this is a self-declared toggle" idiom Akimbo's own
// identical checkbox already establishes) checks against.
E20.twoHandedAssaultOptions = {
  dualWieldLight: "E20.TwoHandedAssaultDualWieldLight",
  twoHanded: "E20.TwoHandedAssaultTwoHanded",
};
preLocalize("twoHandedAssaultOptions");

// Vicious or Venom (Technorganic Secrets, Saurian Origin Benefit, p.43): "choose one of the
// following benefits to add to your natural weapon attacks: Acidic Saliva (+1 Acid damage) /
// Razor-Sharp (+1 Sharp damage) / Venomous (+1 Poison damage)." A distinct 3-option set from
// elementDamageTypes above - Sharp isn't an Element sub-type at all, and RAW doesn't offer every
// Element option here, just these 3 specific ones.
E20.viciousOrVenomOptions = {
  acid: "E20.DamageAcid",
  sharp: "E20.DamageSharp",
  poison: "E20.DamagePoison",
};
preLocalize("viciousOrVenomOptions");

// Over the Candlestick (Technorganic Secrets, Climber/Nimble Origin Benefit, p.38): "choose one:
// Agile Reflexes (once/scene, use Evasion instead of Toughness when targeted) / Innate Climber
// (+40ft Climb Movement in Alt Mode)."
E20.overTheCandlestickOptions = {
  agileReflexes: "E20.OverTheCandlestickAgileReflexes",
  innateClimber: "E20.OverTheCandlestickInnateClimber",
};
preLocalize("overTheCandlestickOptions");

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
  vehicle: "E20.UpgradeTypeVehicle",
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
// joins a Megaform. The base six (coreAbility through move) are from the Power Rangers Core
// Rulebook (p.140); accurateCombiner/defender/detachable/layeredSystems/resistant were added by
// Across the Stars (p.104-105) and assaultWeapon/compensation/grounding/tenaciousBonds by A Jump
// Through Time (p.84) - both sourcebooks call these "accessible to all Power Rangers Roleplaying
// Game Zords," not scoped to that book's own examples, so they live in this same shared enum
// rather than a book-specific one. "Multi-Megaform" (A Jump Through Time, p.83) is deliberately
// NOT a member of this enum - RAW frames it as its own Zord Feature (like Combiner itself) that
// grants a Zord a choice of three OTHER Megaform Traits to swap between across different
// combination events, not a trait in its own right; since swapping which megaformTrait item is
// embedded on a Zord actor is already fully supported by the existing add/remove item UI, it
// needs no new enum entry or code - just a reference `feature` item documenting the ability,
// the same non-mechanical role Combiner's own item already plays.
E20.megaformTraitTypes = {
  accurateCombiner: "E20.MegaformTraitAccurateCombiner",
  assaultWeapon: "E20.MegaformTraitAssaultWeapon",
  commander: "E20.MegaformTraitCommander",
  compensation: "E20.MegaformTraitCompensation",
  coreAbility: "E20.MegaformTraitCoreAbility",
  coreBody: "E20.MegaformTraitCoreBody",
  coreDefenses: "E20.MegaformTraitCoreDefenses",
  defender: "E20.MegaformTraitDefender",
  detachable: "E20.MegaformTraitDetachable",
  enhancedInitiative: "E20.MegaformTraitEnhancedInitiative",
  enhancedMeleeAttack: "E20.MegaformTraitEnhancedMeleeAttack",
  enhancedRangedAttack: "E20.MegaformTraitEnhancedRangedAttack",
  grounding: "E20.MegaformTraitGrounding",
  layeredSystems: "E20.MegaformTraitLayeredSystems",
  move: "E20.MegaformTraitMove",
  resistant: "E20.MegaformTraitResistant",
  safeRelease: "E20.MegaformTraitSafeRelease",
  skillExpertise: "E20.MegaformTraitSkillExpertise",
  tenaciousBonds: "E20.MegaformTraitTenaciousBonds",
  titanHardpoint: "E20.MegaformTraitTitanHardpoint",
  universalReceptors: "E20.MegaformTraitUniversalReceptors",
};
preLocalize("megaformTraitTypes");

// Types of movement used by Actors
E20.movementTypes = {
  aerial: "E20.MovementTypeAerial",
  burrow: "E20.MovementTypeBurrow",
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

// Options for Transformer Modes. Legacy: superseded by hardpointTypes below (a Weapon's mode
// is now derived from which Hardpoint it's installed in). Kept for the read-only derived-mode
// label and for reading pre-Hardpoint weapon data - see WeaponItemData.migrateData().
E20.transformerModes = {
  modeAltMode: "E20.ModeAltMode",
  modeBotMode: "E20.ModeBotMode",
  modeAny: "E20.ModeAny",
};
preLocalize("transformerModes");

// Transformer Hardpoints (TF CRB p.114). Every Cybertronian starts with 2 External + 2
// Integrated. External Hardpoints hold weapons in-hand (no mods, can be disarmed, unusable in
// Alt Mode) and cost Load Out hands; Integrated Hardpoints build a weapon into the chassis
// (free of the six-hand limit, size drops to Integrated). "none" = not installed to a Hardpoint.
E20.hardpointTypes = {
  external: "E20.HardpointExternal",
  integrated: "E20.HardpointIntegrated",
  none: "E20.HardpointNone",
};
preLocalize("hardpointTypes");

// For a weapon in an Integrated Hardpoint (TF CRB p.114): whether it's hidden in Alt Mode
// (needs a Free action to deploy) or obvious in Alt Mode (usable at will, but constrains when
// the Alt Mode suits the environment).
E20.altModeVisibilities = {
  hidden: "E20.AltModeVisibilityHidden",
  obvious: "E20.AltModeVisibilityObvious",
};
preLocalize("altModeVisibilities");

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
// Air Born (MLP Pegasus Origin Perk, p.37): the 3 fixed starting ground/aerial Movement pairs -
// see dice.mjs's own AIR_BORN_ID comment and documents/actor.mjs#_prepareMovement's own
// AIR_BORN_MOVEMENT_OPTIONS table for the actual ground/aerial numbers each key maps to.
E20.airBornMovement = {
  groundHeavy: "E20.AirBornGroundHeavy",
  balanced: "E20.AirBornBalanced",
  aerialHeavy: "E20.AirBornAerialHeavy",
};
preLocalize("airBornMovement");

E20.fightingStyle = {
  akimbo: "E20.FightingStyleAkimbo",
  careful: "E20.FightingStyleCareful",
  closeQuartersBattle: "E20.FightingStyleCloseQuartersBattle",
  defense: "E20.FightingStyleDefense",
  longShot: "E20.FightingStyleLongShot",
  triggerHappy: "E20.FightingStyleTriggerHappy",
};
preLocalize("fightingStyle");

// Power Adaptation (Across the Stars, Silver Ranger, 9th/18th level, p.57) - see
// helpers/power-adaptation.mjs's own doc comment for how each option is actually applied. Same
// "no numeric field of its own, read directly off system.choice" shape as fightingStyle above.
// Always Ready (General Hawk's Personnel Files, Coast Guard Origin Perk, p.172) - see
// dice.mjs's own ALWAYS_READY_FUNCTION_SKILLS for how each function maps to its own pair of
// skills, read directly off system.choice at roll time (same "no numeric field of its own" shape
// as powerAdaptationOptions/phantomFocusOptions below).
E20.alwaysReadyOptions = {
  admin: "E20.AlwaysReadyAdmin",
  biologist: "E20.AlwaysReadyBiologist",
  engineer: "E20.AlwaysReadyEngineer",
  pilot: "E20.AlwaysReadyPilot",
  rescue: "E20.AlwaysReadyRescue",
  security: "E20.AlwaysReadySecurity",
};
preLocalize("alwaysReadyOptions");

E20.powerAdaptationOptions = {
  boostOfSpeed: "E20.PowerAdaptationBoostOfSpeed",
  crushingStrength: "E20.PowerAdaptationCrushingStrength",
  strikingHands: "E20.PowerAdaptationStrikingHands",
  fastTrigger: "E20.PowerAdaptationFastTrigger",
  regeneratingShell: "E20.PowerAdaptationRegeneratingShell",
};
preLocalize("powerAdaptationOptions");

// Phantom Focus (Across the Stars, Phantom Ranger, 10th/15th level, p.62) - see
// helpers/banked-buffs.mjs's own PHANTOM_FOCUS_ID comment for how each option is actually applied
// (or, for multiversalPocket/shipIntegration, why it isn't). Same "no numeric field of its own,
// read directly off system.choice" shape as fightingStyle/powerAdaptationOptions.
E20.phantomFocusOptions = {
  boostedVigor: "E20.PhantomFocusBoostedVigor",
  healingLight: "E20.PhantomFocusHealingLight",
  multiversalPocket: "E20.PhantomFocusMultiversalPocket",
  phaseDefense: "E20.PhantomFocusPhaseDefense",
  shipIntegration: "E20.PhantomFocusShipIntegration",
};
preLocalize("phantomFocusOptions");

// Experiment (Transformers CRB, Influence Perk, p.32) - "choose one of the following four
// options." Same "no numeric field of its own, read directly off system.choice" shape as
// fightingStyle/powerAdaptationOptions - shove/technology are real, built grants (see their own
// checks in dice.mjs); carryingWeight/hardpoint stay in the picker per the "the choice still
// exists even when unautomated" idiom (carrying-capacity and Integrated-Hardpoint-slot tracking
// are both confirmed-missing gaps), same as Power Adaptation's own Fast Trigger.
E20.experimentOptions = {
  shove: "E20.ExperimentShove",
  carryingWeight: "E20.ExperimentCarryingWeight",
  technology: "E20.ExperimentTechnology",
  hardpoint: "E20.ExperimentHardpoint",
};
preLocalize("experimentOptions");

E20.wisdomOfTheEldersOptions = {
  teleportation: "E20.WisdomOfTheEldersTeleportation",
  lightshieldArmor: "E20.WisdomOfTheEldersLightshieldArmor",
  enhancedReflexes: "E20.WisdomOfTheEldersEnhancedReflexes",
  lightfoilWings: "E20.WisdomOfTheEldersLightfoilWings",
  resilientArmor: "E20.WisdomOfTheEldersResilientArmor",
  ferociousStrikes: "E20.WisdomOfTheEldersFerociousStrikes",
};
preLocalize("wisdomOfTheEldersOptions");

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
  // A Jump Through Time p.47 "Quantum Master": "Once per turn, you may reroll a single Skill die
  // result of 1... you must accept the second result." Scoped even narrower than "combat" above -
  // bucketed on the specific combatant-turn (game.combat's own id/round/turn triple, the exact
  // identity helpers/perks.mjs#hasUsedThisTurn/markUsedThisTurn already key their own once-per-
  // turn flags on) rather than the whole encounter. Outside an active Combat, shares one bucket,
  // same "no active encounter" fallback the "combat" bucket above already uses.
  turn: "E20.RerollResetTurn",
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
  // Decepticon Directive "Exterminator" (General Perk, p.65): "...as long as the target is
  // smaller than you." Checked against the triggering roll's own context
  // (rollContext.smallerTarget, computed in dice.mjs's own _getAutomaticCombatModifiers where the
  // actual actor-vs-target Size comparison lives), the same "computed there, read here" shape as
  // notSnagged/powerWeapon above.
  smallerTarget: "E20.RerollConditionSmallerTarget",
  // Quartermaster's Guide to Gear "Clip Check" (General Perk, p.28): "...reroll a Fumble on an
  // Attack Skill Test." Checked against the triggering roll's own real natural-min-die Fumble
  // outcome (rollContext.isFumble, dice.mjs#_isCritIsFumble) - distinct from this codebase's own
  // unrelated shift-based "fumble" auto-fail tier.
  fumble: "E20.RerollConditionFumble",
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
// A handful of entries this list once carried had no attested source anywhere across the game
// lines' own rulebooks (Combiner Core, Gridjump, Freight Carry, Instrument Array, Integrated
// Storage, Landing Pattern, Self-Repair, Shielded, Hydro-Portation) - removed rather than kept as
// unverifiable vestigial content. Aerospace and Zero-G are kept despite neither appearing as a
// literal printed Trait either - both are real, well-attested combat-context concepts (GI Joe
// CRB's own Aerospace Combat/Zero-G Combat rules) worth flagging on a Vehicle even without a
// stat-block precedent for "Traits: Aerospace". ampibious/ranshackle were misspelled keys with
// already-correct label strings - renamed to amphibious/ramshackle (confirmed unreferenced
// anywhere outside this file before renaming, so no migration was needed).
E20.vehicleTraits = {
  aerospace: "E20.VehicleTraitAerospace",
  ai: "E20.VehicleTraitAI",
  air: "E20.VehicleTraitAir",
  allTerrain: "E20.VehicleTraitAllTerrain",
  amphibious: "E20.VehicleTraitAmphibious",
  armoredCabin: "E20.VehicleTraitArmoredCabin",
  attackMode: "E20.VehicleTraitAttackMode",
  autopilot: "E20.VehicleTraitAutopilot",
  autopilotAdvanced: "E20.VehicleTraitAutopilotAdvanced",
  battlePlatforms: "E20.VehicleTraitBattlePlatforms",
  battleShield: "E20.VehicleTraitBattleShield",
  battleStation: "E20.VehicleTraitBattleStation",
  beastOfBurden: "E20.VehicleTraitBeastOfBurden",
  bomber: "E20.VehicleTraitBomber",
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
  heavyWinch: "E20.VehicleTraitHeavyWinch",
  heavyWheels: "E20.VehicleTraitHeavyWheels",
  hissColumn: "E20.VehicleTraitHISSColumn",
  hover: "E20.VehicleTraitHover",
  land: "E20.VehicleTraitLand",
  largeObstacle: "E20.VehicleTraitLargeObstacle",
  linked: "E20.VehicleTraitLinked",
  multifrequencyCameras: "E20.VehicleTraitMultiFrequencyCameras",
  multiPurpose: "E20.VehicleTraitMultiPurpose",
  prowlMode: "E20.VehicleTraitProwlMode",
  pythonPaint: "E20.VehicleTraitPythonPaint",
  ram: "E20.VehicleTraitRam",
  ramshackle: "E20.VehicleTraitRamshackle",
  rapidDeploymentRamps: "E20.VehicleTraitRapidDeploymentRamps",
  responsive: "E20.VehicleTraitResponsive",
  rollCage: "E20.VehicleTraitRollCage",
  sea: "E20.VehicleTraitSea",
  sensors: "E20.VehicleTraitSensors",
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

// E20.upgradeTraits (defined above, before Vehicle Traits exist yet) is augmented here rather
// than merged in at its own declaration - preLocalize just registers the "upgradeTraits" config
// key by name (harmless to have already run once above), so the actual localization pass, which
// runs later at init, still sees every Vehicle Trait folded in by then.
E20.upgradeTraits = {...E20.upgradeTraits, ...E20.vehicleTraits};

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
    /* The Defend action (GI Joe CRB p.196): "all attacks against you from adversaries and
       effects you can see suffer a Snag on their Attack Skill Test. This benefit lasts until
       the beginning of your next turn."

       A Condition rather than a flag, so it shows on the token - a GM needs to see who is
       defending without opening five sheets - and because the attacker reads it off their
       TARGET, which actor.statuses makes a one-liner. Applied by helpers/named-actions.mjs,
       read by dice.mjs#_getAutomaticCombatModifiers, cleared at the start of the defender's
       next turn by documents/combat.mjs#_onStartTurn.

       Borrows the shield art from assets/icons/items rather than adding a new status icon,
       the same reuse cantTakeFreeActions makes of status_impaired. `changes` stays empty:
       the Snag lands on the ATTACKER's roll, not on any field of the defender, so there is
       nothing here for an Active Effect to change. */
    img: 'systems/essence20/assets/icons/items/shield.svg',
    id: 'defending',
    name: 'E20.StatusDefending',
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
