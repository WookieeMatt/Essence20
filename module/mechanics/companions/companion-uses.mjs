/**
 * Which items give, grow or work a companion - a pet, drone, Mini-Con, human or alien companion - and
 * so get a Use button. The work is in mechanics/companions/companions.mjs; this table stays apart from it so
 * mechanics/actions/action-perks.mjs can ask about the button without importing everything companions.mjs
 * does (which would loop back round to action-perks.mjs).
 */

import { sourceOfOrUndefined as sourceOf } from "../../items/shared/item-lookups.mjs";

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
  // Animal Perks on the pet.
  favoriteCommandGij: uuid('gi_joe_crb', 'ymF7fHkBglQ7pQRE'),
  favoriteCommandMlp: uuid('mlp_crb', 'rPnaWCU06W8c0Zua'),
  favoriteCommandWtnv: uuid('wtnv_citizens_guide', 'GeHPKfuWe24HpYcQ'),
  // (Agreeable's ↑1 on commanding its pet is a PetCommand upshift rule on the MLP Perk.)
  backupMaster: uuid('gi_joe_crb', 'VV2qGG2gqmjKYcPl'),
  extraFriend: uuid('mlp_crb', 'Hg3B2BkTNnqTzRmr'),
  // Drones.
  directControl: uuid('quartermasters_guide_to_gear', 'DzzgWT7OGa7bYB42'),
  masterControlProgram: uuid('quartermasters_guide_to_gear', 'YpfiYbfQ18up8x1F'),
  ric: uuid('across_the_stars', 'GGu11SYwOALYkJ61'),
  // Mini-Cons.
  miniConAlly: uuid('tf_crb', 'izA6rip6DcYsGxbq'),
  multiPurpose: uuid('tf_crb', 'ChfMqJaXUxMBP9SO'),
  reinforcedBondTf: uuid('tf_crb', 'LqmvdLyTmhvCFYUq'),
  emergencyDeployment: uuid('tf_crb', 'qorLGnvHpgo4wGq8'),
  additionalMiniCon: uuid('decepticon_directive', 'zCD2Vfs0JSDtngqE'),
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
  'directControl', 'masterControlProgram',
  'ric', 'miniConAlly', 'multiPurpose', 'additionalMiniCon', 'miniConAffinity', 'miniConHub',
  'miniConMaster', 'humanCompanion', 'alienCompanion',
]);

const BY_SOURCE = Object.fromEntries(Object.entries(COMP).filter(([kind]) => USE_KINDS.has(kind)).map(([kind, id]) => [id, kind]));

export function companionKindOf(item) {
  return BY_SOURCE[sourceOf(item)] ?? null;
}

export function isCompanionUse(item) {
  return !!companionKindOf(item);
}

/** Used once and done - the drone upgrades a focus hands out at a level. */
const ONCE = new Set(['directControl', 'masterControlProgram']);

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
