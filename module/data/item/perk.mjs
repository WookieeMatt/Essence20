import { E20 } from "../../helpers/config.mjs";

import { makeBool, makeInt, makeStr, makeStrWithChoices } from "../generic-makers.mjs";

import { rerollSchema } from '../reroll-schema.mjs';
import { activation } from './templates/activation.mjs';
import { item } from './templates/item.mjs';
import { itemDescription } from './templates/item-description.mjs';
import { parentItem } from './templates/parent-item.mjs';

const fields = foundry.data.fields;

export class PerkItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...item(),
      ...activation(),
      ...itemDescription(),
      ...parentItem(),
      advances: new fields.SchemaField({
        baseValue: makeInt(1),
        canAdvance: makeBool(false),
        currentValue: makeInt(0),
        increaseValue: makeInt(1),
        type: makeStrWithChoices(Object.keys(E20.perkAdvanceTypes)),
      }),
      canActivate: makeBool(false),
      choice: makeStr(null),
      // Optionally narrows a choiceType:'skills' picker to one Essence's own skills - e.g. I've
      // Done My Research (Beneath the Helmet, Genius Origin Benefit, p.29) offers only the Smarts
      // skills. Left empty (the default) the picker offers every skill, as Expertise's own does.
      choiceEssence: makeStr(null),
      choiceType: makeStrWithChoices(Object.keys(E20.perkChoiceTypes), 'none'),
      isRoleVariant: makeBool(false),
      hasChoice: makeBool(false),
      hasMorphedToughnessBonus: makeBool(false),
      numChoices : makeInt(1),
      prerequisite: makeStr(null),
      ...rerollSchema(),
      selectionLimit: makeInt(1),
      type: makeStrWithChoices(Object.keys(E20.perkTypes), 'general'),
      value: makeInt(0),
      version: makeStrWithChoices(Object.keys(E20.gameVersions), 'powerRangers'),
      blindsight: new fields.SchemaField({
        enabled: makeBool(false),
        range: makeInt(0),
      }),
      visionGrant: new fields.SchemaField({
        enabled: makeBool(false),
        mode: makeStrWithChoices(Object.keys(E20.visionModes), 'darkvision'),
        range: makeInt(0),
        // Vision Focuser (PR CRB, Blue Ranger Grid Tech II pick, p.38): "While Morphed, you and
        // your team can see in darkness..." - the first visionGrant in this codebase that isn't
        // simply always-on (every other holder, e.g. Night Eyes/Used to the Dark, has no such
        // condition). Read in helpers/vision-grant.mjs#getBestVisionGrant, the same
        // isSuppressedWhileUnmorphed idiom morph-gated-effects.mjs already established for
        // ActiveEffects, applied here to this plain data field instead.
        whileMorphed: makeBool(false),
        // The "and your team" half - also read in getBestVisionGrant, which additionally scans
        // nearby allies (getNearbyAllyTokens, the same "any teammate has the Perk" idiom Blaster
        // Focusers/Power Focusers already use for a team-wide grant) for a teamWide grant, not
        // just the actor's own items.
        teamWide: makeBool(false),
      }),
    };
  }
}
