// Round 15 (items1): recipient targetParticipants - the first target's Megaform participants. Primeon Blade.
import { getMegaformParticipants } from "../../../mechanics/vehicles/megaform-participants.mjs";
import { registerRecipient } from "../../steps.mjs";

/**
 * The participants of a Megaform (mechanics/vehicles/megaform-participants.mjs#getMegaformParticipants): a Combiner's
 * members that aren't Zords / vehicles / Megaforms, else its Zords. None for anything that isn't a Megaform.
 */
export function participantsOf(target) {
  if (target?.type != 'megaform' || !target.system?.actors) {
    return [];
  }

  try {
    return getMegaformParticipants(target);
  } catch (error) {
    return [];
  }
}

registerRecipient('targetParticipants', (match, ctx) => participantsOf(ctx.targets?.[0]));
