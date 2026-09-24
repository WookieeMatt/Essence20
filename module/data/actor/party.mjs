import { makeBool, makeInt, makeStr } from "../generic-makers.mjs";

import { common } from './templates/common.mjs';

const fields = foundry.data.fields;

/**
 * The Party ("Squad") actor - a container for a group of Player Characters that owns the
 * squad-level Equipment Assignment state the CRBs describe (GI Joe CRB p.136-138 / TF CRB
 * p.114-116 / PR CRB p.103): the shared Requisition budget and Mission Critical Items. The
 * roster rides on `system.actors` (the same type-agnostic attachment collection `common()`
 * gives every actor, reused for Vehicle crew / Zord combiners / PC Contacts).
 */
export class PartyActorData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...common(),
      biography: new fields.HTMLField(),
      // Requisition tracker state. The panel that reads it lands in a later PR; the schema
      // lives here now so the Party actor is its single home from the start.
      requisition: new fields.SchemaField({
        attempts: makeInt(0),           // the live, spendable pool
        autoFromRoster: makeBool(true), // when true, requisitionMax = 3 x memberCount
        log: new fields.ArrayField(new fields.SchemaField({
          memberName: makeStr(''),
          itemName: makeStr(''),
          availability: makeStr(''),
          dif: makeInt(0),
          time: makeInt(0),
        })),
      }),
      // The table's shared Story Point pool and the GM's own points. They live on the PRIMARY
      // Party (Essence20Actors#party) rather than in a world setting because a setting can only
      // be written by a GM, and a player granted ownership of this actor can write this. Not
      // shown on the sheet - the Story Points tracker is their one screen. Only the primary
      // Party's copy is ever read; see helpers/story-points.mjs and helpers/party.mjs.
      storyPoints: makeInt(0),
      gmPoints: makeInt(0),
      // Derived each prep by Essence20Actor._preparePartyData() - schema-declared so the
      // computed values survive Actor#toObject(false) into the sheet context.
      memberCount: makeInt(0),
      requisitionMax: makeInt(0),
    };
  }
}
