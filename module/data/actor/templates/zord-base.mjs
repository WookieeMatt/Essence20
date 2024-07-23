import { makeInt } from "../../generic-makers.mjs";

const fields = foundry.data.fields;

export const zordBase = () => ({
  armor: makeInt(10),
});
