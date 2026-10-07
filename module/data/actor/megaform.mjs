import { E20 } from "../../util/config.mjs";

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
      hasEnhancedInitiative: makeBool(false),
      hasTitanHardpoint: makeBool(false),
      hasAssaultWeapon: makeBool(false),
      isDefeated: makeBool(false),
      participantHealth: new fields.ArrayField(new fields.SchemaField({
        name: makeStr(''),
        value: makeInt(0),
        max: makeInt(0),
      })),
      participantStun: new fields.ArrayField(new fields.SchemaField({
        name: makeStr(''),
        value: makeInt(0),
      })),
      // A Transformers Combiner's Hardpoints (Enigma of Combination p.44): two External, plus one Integrated for each
      // component - the bases are worked out in Essence20Actor#_prepareMegaformCombinerData, the rest is the same
      // tally a Transformer's are (Essence20Actor#_prepareLoadout). A Megazord has none.
      hardpoints: new fields.SchemaField({
        external: new fields.SchemaField({ base: makeInt(2), bonus: makeInt(0), max: makeInt(0), used: makeInt(0), over: makeBool(false) }),
        integrated: new fields.SchemaField({ base: makeInt(0), bonus: makeInt(0), max: makeInt(0), used: makeInt(0), over: makeBool(false) }),
      }),
      loadout: new fields.SchemaField({
        handsMax: makeInt(6),
        handsUsed: makeInt(0),
        handsOver: makeBool(false),
      }),
    };
  }
}

