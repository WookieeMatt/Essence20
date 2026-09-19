import { E20 } from "../../../helpers/config.mjs";

import { makeBool, makeInt, makeStr, makeStrWithChoices } from "../../generic-makers.mjs";

/**
 * What an item costs to use, in action economy terms - read by
 * helpers/action-economy.mjs#consumeForItem, which every item roll funnels through.
 *
 * `actionType` keeps the name the `power` item type has always used for this field rather than
 * moving to something tidier, precisely so the 103 compendium Powers that already store a value
 * need no migration and migration.mjs stays untouched.
 *
 * The default is 'none' - not 'standard'. Roughly 2,600 Perks and 1,100 weapon effects carry no
 * authored action cost, and defaulting them to anything else would have the system inventing costs
 * it can't justify. 'none' is the honest representation of "nobody has said yet".
 *
 * @param {String} [defaultType]   Overrides the 'none' default - used by `power`, whose own field
 *   has always defaulted to 'free', so the handful of Powers that authored their type by omission
 *   aren't silently reclassified.
 */
export const activation = (defaultType = 'none') => ({
  actionType: makeStrWithChoices(Object.keys(E20.actionTypes), defaultType),
  // Reserved for the rare item that costs more than one of its category (nothing in the books
  // needs it yet). getCost() multiplies by this when it lands; today every cost is 1.
  actionCost: makeInt(1),
  // The trigger text for a Contingency action, e.g. "when an enemy enters your reach" - the
  // condition the readied action waits on (GI Joe CRB p.196). Free text rather than a structured
  // condition: the automation for these lives in each feature own helper, and this field exists so
  // the player can read WHAT the Contingency is waiting for.
  contingencyTrigger: makeStr(null),
  // Escape hatch for an item whose use shouldn't touch the economy at all, regardless of what its
  // actionType says - a roll made as part of someone else's action, say.
  ignoresEconomy: makeBool(false),
});
