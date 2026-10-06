import { registerRollSources } from "../../extensions.mjs";
import { getSceneEpoch } from "../../scene-clock.mjs";
import {
  flagOf, nameOf, stampOpen, TF3,
} from "./common.mjs";

/**
 * Transformers CRB / Transformers One Sourcebook - the Roll Options Dialog's automatic sources for the tf3 slice
 * (Unexpected Alternative). Holographic Doubles, The Right Of All Sentient Beings, Martyr, Tow Cable & Hook's ↑1, all of
 * Rotor Blades (the ↑1, the Alt Mode Aerial and the +1 damage against organic targets), Target Breakdown's banked ↑,
 * Water Cannon's one hardpoint, Stoic and all of Ladder (its Use, the allies' ↑2 switch, the Bot Mode Reach) are rules on
 * their items.
 */

export const UNEXPECTED_FLAG = 'tf3UnexpectedEdge';

const safeEpoch = () => {
  try {
    return getSceneEpoch();
  } catch {
    return null;
  }
};

/* -------------------------------------------- */
/*  Automatic sources                            */
/* -------------------------------------------- */

export function tf3RollSources(actor, target) {
  const sources = [];
  const consumes = [];

  // Unexpected Alternative (Triple Changer, 3rd level, p.76): "you gain an Edge on Skill Tests
  // targeting them until the end of your next turn."
  const unexpected = flagOf(actor, UNEXPECTED_FLAG);
  if (target?.uuid && unexpected?.targets?.includes(target.uuid) && stampOpen(unexpected.stamp, safeEpoch())) {
    sources.push({ id: 'tf3Unexpected', label: nameOf(actor, TF3.unexpectedAlternative, 'Unexpected Alternative'), edge: true });
  }

  return { sources, consumes };
}

/* -------------------------------------------- */
/*  Registration                                 */
/* -------------------------------------------- */

registerRollSources(tf3RollSources);
