import { E20 } from "../../helpers/config.mjs";

import { makeBool, makeStrWithChoices } from "../generic-makers.mjs";

import { item } from './templates/item.mjs';

export class SpecializationItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...item(),
      isSpecialized: makeBool(true),
      shift: makeStrWithChoices(E20.skillShiftList, 'd20'),
      skill: makeStrWithChoices(Object.keys(E20.skills), 'athletics'),
    };
  }
}
