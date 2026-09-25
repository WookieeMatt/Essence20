import { makeBool, makeStr } from '../generic-makers.mjs';
import { item } from './templates/item.mjs';
import { itemDescription } from './templates/item-description.mjs';

export class HangUpItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      // Lets a Hang-Up record a player choice the same way a Perk's own hasChoice/choiceType/choice
      // trio does. Added 2026-09-15 for Augmented (Across the Stars, p.44), whose mandatory Hang-Up
      // is "choose one damage type; you halve your Defenses when targeted by attacks that inflict
      // it" - the halving itself was already trivial to express, but until now a Hang-Up had
      // nowhere at all to store WHICH damage type was chosen, since this schema carried no choice
      // fields. Deliberately narrower than perk.mjs's own set: no numChoices/selectionLimit, since
      // a Hang-Up is granted once by its parent Influence rather than re-picked at level-ups, and
      // the picker fires from background-handler.mjs#_hangUpSelect rather than setPerkValues.
      hasChoice: makeBool(false),
      choiceType: makeStr(null),
      choice: makeStr(null),
    };
  }
}
