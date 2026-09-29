import { makeStr, makeStrArray } from "../../generic-makers.mjs";

export const creature = () => ({
  languages: makeStrArray(),
  // What kind of creature this is, as a comma-separated list ("robot, machine empire") - read by
  // helpers/creature-tags.mjs for the Perks that care (Bot-Hunter, Grid Champion, Monster Hunter...).
  creatureTags: makeStr(''),
});
