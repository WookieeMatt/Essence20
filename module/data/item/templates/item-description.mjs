import { makeStr, makeInt } from "../../generic-makers.mjs";

const fields = foundry.data.fields;

export const itemDescription = () => ({
  description: new fields.HTMLField(),
  source: new fields.SchemaField({
    book: makeStr(''),
    page: makeInt(null),
  }),
});
