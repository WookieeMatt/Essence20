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
      // halves the holder's Defenses against one chosen damage type - the halving itself was already trivial to express, but until now a Hang-Up had
      // nowhere at all to store WHICH damage type was chosen, since this schema carried no choice
      // fields. Deliberately narrower than perk.mjs's own set: no numChoices/selectionLimit, since
      // a Hang-Up is granted once by its parent Influence rather than re-picked at level-ups, and
      // the picker fires from background-handler.mjs#_hangUpSelect rather than setPerkValues.
      // Deprecated until 6.1 (Perk choice P2e): Augmented asks its damage type through a ChoiceSet rule now; 6.1 removes
      // these three. None of them is on the Hang-Up Details tab (Perk choice P3).
      // Deprecated 2026-10-07: replaced by rules choices; remove from the data model in 6.1.
      hasChoice: makeBool(false),
      // Deprecated 2026-10-07: replaced by rules choices; remove from the data model in 6.1.
      choiceType: makeStr(null),
      // Deprecated 2026-10-07: replaced by rules choices; remove from the data model in 6.1.
      choice: makeStr(null),
    };
  }
}
