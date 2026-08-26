import { E20 } from "../../helpers/config.mjs";

import { makeBool, makeInt, makeStr, makeStrArray, makeStrArrayWithChoices } from "../generic-makers.mjs";

import { common } from './templates/common.mjs';
import { machine } from './templates/machine.mjs';
import { zordBase } from './templates/zord-base.mjs';

const fields = foundry.data.fields;

export class MegaformActorData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...common(),
      ...machine(),
      ...zordBase(),
      subtype: makeStrArrayWithChoices(Object.keys(E20.megaformSubtypes), 'megaformZord'),
      health: makeInt(null),
      zordIds: makeStrArray(),
      // Combiner-subtype only: how many Energon Points the component members actually spent
      // to merge into this form (2/member for a Matched Combiner, 3/member for a Gestalt,
      // per the Transformers Combiner rules) - a GM-tracked value that drives the computed
      // energon.normal.max below, since it depends on in-combat choices this system doesn't
      // otherwise track (Story Point substitutions, NPCs joining, etc).
      energonSpentToMerge: makeInt(0),
      // The following are all computed fresh in Essence20Actor#_prepareMegaformData() from
      // the linked component actors (system.actors) and are never edited directly, but need a
      // schema declaration so their computed values survive Actor#toObject(), which sheets
      // rely on.
      combinedHealthMax: makeInt(0),
      combinedHealthValue: makeInt(0),
      hasEnhancedAttack: makeBool(false),
      isDefeated: makeBool(false),
      participantHealth: new fields.ArrayField(new fields.SchemaField({
        name: makeStr(''),
        value: makeInt(0),
        max: makeInt(0),
      })),
    };
  }
}

