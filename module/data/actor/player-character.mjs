import { E20 } from "../../helpers/config.mjs";

import { makeBool, makeInt, makeStrWithChoices } from "../generic-makers.mjs";

import { character, migrateCharacterData } from './templates/character.mjs';
import { common } from './templates/common.mjs';
import { creature } from './templates/creature.mjs';

export class PlayerCharacterActorData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...character(),
      ...common(),
      ...creature(),
      canMorph: makeBool(false),
      canSetToughnessBonus: makeBool(false),
      canSpellcast: makeBool(false),
      canTransform: makeBool(false),
      // The 12 Essence points spent at creation, before the Origin and Role add theirs - see
      // helpers/starting-essences.mjs. 3 each is what every character got before these existed.
      essenceBase: new foundry.data.fields.SchemaField({
        strength: makeInt(3),
        speed: makeInt(3),
        smarts: makeInt(3),
        social: makeInt(3),
      }),
      // Whether the player has spent them yet; a new character's Starting Essences window opens
      // until they have (essence20.mjs's createActor hook).
      essencesAssigned: makeBool(false),
      transformerFaction: makeStrWithChoices(Object.keys(E20.transformerFactions), 'autobots'),
    };
  }

  static migrateData(source, options) {
    migrateCharacterData(source);

    // A character saved before Starting Essences existed already has its 3/3/3/3 - a legal
    // spread - so it counts as assigned rather than nagging every existing player. A brand-new
    // character arrives with no Essences in its data yet, and so stays unassigned.
    //
    // Never on a partial update: Foundry migrates those too (client-backend.mjs cleans every
    // update with migrate: true), and a Role drop's own `system.essences` change on a
    // brand-new character would otherwise read as "an old character" and mark it assigned.
    if (!options?.partial && source.essences
      && source.essenceBase === undefined && source.essencesAssigned === undefined) {
      source.essencesAssigned = true;
    }

    return super.migrateData(source, options);
  }

  prepareBaseData() {
    super.prepareBaseData();
    this.movementIsReadOnly = true;
  }
}
