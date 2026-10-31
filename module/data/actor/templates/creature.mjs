import { makeBool, makeInt, makeStr, makeStrArray } from "../../generic-makers.mjs";

/**
 * Homebrew: a creature that can be ridden - a companion or an NPC (mechanics/companions/mounts.mjs). Off by default;
 * riders: how many can ride it at once.
 */
export const mount = () => ({
  mount: new foundry.data.fields.SchemaField({
    rideable: makeBool(false),
    riders: makeInt(1),
  }),
});

export const creature = () => ({
  languages: makeStrArray(),
  // What kind of creature this is, as a comma-separated list ("robot, machine empire") - read by
  // mechanics/characters/creature-tags.mjs for the Perks that care (Bot-Hunter, Grid Champion, Monster Hunter...).
  creatureTags: makeStr(''),
});
