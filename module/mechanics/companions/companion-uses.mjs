/**
 * Which items give, grow or work a companion - a pet, drone, Mini-Con, human or alien companion - and
 * so get a Use button. The work is in mechanics/companions/companions.mjs; this table stays apart from it so
 * mechanics/actions/action-perks.mjs can ask about the button without importing everything companions.mjs
 * does (which would loop back round to action-perks.mjs).
 */

const uuid = (pack, id) => `Compendium.essence20.${pack}.Item.${id}`;

export const COMP = {
  // Pets.
  animalPetGij: uuid('gi_joe_crb', '6oF71x58kaB302bH'),
  robotPet: uuid('gi_joe_crb', 'sYxiuh3ydA0cS83j'),
  animalPetMlp: uuid('mlp_crb', 'ECHhiqGO5Xs0QLO2'),
  adoptionCenter: uuid('wtnv_citizens_guide', 'whI0JF2OHjjVF3QY'),
  faithfulCompanion: uuid('wtnv_citizens_guide', '4vYOyC2EuKgrEDNW'),
  morphinPet: uuid('field_guide_action_adventure', 'TgrFrV09NhlXIxom'),
  roboticAnimalPet: uuid('field_guide_action_adventure', 'lSVOgibKYfdHl2J4'),
  inTheirElement: uuid('gi_joe_crb', 'UkAgppAPli6yrImr'),
  packAttack: uuid('gi_joe_crb', '7k9DzU918tm8OK9V'),
  toughTogether: uuid('gi_joe_crb', 'aGD2qvPmkdeL6ObV'),
  // Animal Perks on the pet.
  assistantGij: uuid('gi_joe_crb', 'l6nLJeg8ev4mhNwE'),
  assistantMlp: uuid('mlp_crb', 'ueOByvZQdpmGc3Ds'),
  favoriteCommandGij: uuid('gi_joe_crb', 'ymF7fHkBglQ7pQRE'),
  favoriteCommandMlp: uuid('mlp_crb', 'rPnaWCU06W8c0Zua'),
  favoriteCommandWtnv: uuid('wtnv_citizens_guide', 'GeHPKfuWe24HpYcQ'),
  agreeableGij: uuid('gi_joe_crb', '2b51OQSju1kswWLj'),
  agreeableMlp: uuid('mlp_crb', 'YMG6nH32Y8yaYqZ9'),
  backupMaster: uuid('gi_joe_crb', 'VV2qGG2gqmjKYcPl'),
  extraFriend: uuid('mlp_crb', 'Hg3B2BkTNnqTzRmr'),
  attackMlp: uuid('mlp_crb', 'G1yDcOArg2EonV9a'),
  constrictor: uuid('cobra_codex', 'S63cNsFogI1Ahh2C'),
  acidSacs: uuid('wtnv_citizens_guide', '8sUOMdsOyxfF0o1s'),
  // Drones.
  artificialIntelligence: uuid('gi_joe_crb', 'OBjcj6ordJi60Cdd'),
  directControl: uuid('quartermasters_guide_to_gear', 'DzzgWT7OGa7bYB42'),
  masterControlProgram: uuid('quartermasters_guide_to_gear', 'YpfiYbfQ18up8x1F'),
  telemetryData: uuid('quartermasters_guide_to_gear', 'U4Ug6iUQC4Ehzs5l'),
  terminalGuidance: uuid('quartermasters_guide_to_gear', 'kqqN3i3ZR8qYHQaN'),
  automaticHarmonics: uuid('quartermasters_guide_to_gear', 'Foow2rilePmztBFk'),
  buzzTheTower: uuid('quartermasters_guide_to_gear', 'q0LPjcOQ0bnTSZTy'),
  ric: uuid('across_the_stars', 'GGu11SYwOALYkJ61'),
  // Mini-Cons.
  miniConAlly: uuid('tf_crb', 'izA6rip6DcYsGxbq'),
  multiPurpose: uuid('tf_crb', 'ChfMqJaXUxMBP9SO'),
  reinforcedBondTf: uuid('tf_crb', 'LqmvdLyTmhvCFYUq'),
  ambushDeployment: uuid('tf_crb', 'NMVCdrUBejXHGBOa'),
  emergencyDeployment: uuid('tf_crb', 'qorLGnvHpgo4wGq8'),
  enhancedSensors: uuid('tf_crb', 'Qqw4h2kmK8HsE3zC'),
  shieldCompanion: uuid('tf_crb', 'K46iTCabKbKdBQKA'),
  kittedPurpose: uuid('tf_crb', 'YO5STToLRPYVnWBT'),
  additionalMiniCon: uuid('decepticon_directive', 'zCD2Vfs0JSDtngqE'),
  commandAndControl: uuid('decepticon_directive', 'oPtLbnCPYyCSZIVU'),
  loyalMinions: uuid('decepticon_directive', 'MIghwIOKR1AqeQiY'),
  miniConAffinity: uuid('decepticon_directive', 'vUA6Abi5IGqxBngI'),
  miniConHub: uuid('decepticon_directive', 'pTwyIvr5RbNaHmRf'),
  miniConMaster: uuid('decepticon_directive', 'FI1XThm3ns0V4bJU'),
  reinforcedBondDd: uuid('decepticon_directive', 'bEqDYxyIKdUrWZj6'),
  // Companions.
  humanCompanion: uuid('tf_crb', 'xPW26L1cpi3ax3Ag'),
  alienCompanion: uuid('enigma_of_combination', 'ksrnVFThLDcEFTV9'),
};

/** Items whose Use button runs something in companions.mjs, and what. */
const USE_KINDS = new Set([
  'animalPetGij', 'robotPet', 'animalPetMlp', 'adoptionCenter', 'faithfulCompanion', 'morphinPet', 'roboticAnimalPet',
  'assistantGij', 'assistantMlp', 'directControl', 'masterControlProgram', 'telemetryData', 'terminalGuidance',
  'buzzTheTower', 'ric', 'miniConAlly', 'multiPurpose', 'enhancedSensors', 'additionalMiniCon', 'miniConAffinity', 'miniConHub',
  'miniConMaster', 'loyalMinions', 'humanCompanion', 'alienCompanion',
  'backupMaster', 'extraFriend', 'favoriteCommandGij', 'favoriteCommandMlp', 'favoriteCommandWtnv',
]);

const BY_SOURCE = Object.fromEntries(Object.entries(COMP).filter(([kind]) => USE_KINDS.has(kind)).map(([kind, id]) => [id, kind]));

function sourceOf(item) {
  return item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource;
}

export function companionKindOf(item) {
  return BY_SOURCE[sourceOf(item)] ?? null;
}

export function isCompanionUse(item) {
  return !!companionKindOf(item);
}

/** Used once and done - the drone upgrades a focus hands out at a level. */
const ONCE = new Set(['directControl', 'masterControlProgram', 'telemetryData', 'enhancedSensors']);

export function canUseCompanion(item) {
  const kind = companionKindOf(item);
  if (!kind || !item?.parent) {
    return false;
  }

  return !ONCE.has(kind) || !item.flags?.essence20?.granted;
}

export function isOnceCompanionUse(kind) {
  return ONCE.has(kind);
}
