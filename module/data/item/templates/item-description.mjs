import { makeStr } from "../../generic-makers.mjs";

const fields = foundry.data.fields;

export const itemDescription = () => ({
  description: new fields.HTMLField(),
  source: new fields.SchemaField({
    book: makeStr(''),
    page: new fields.NumberField({
      initial: null,
      integer: true,
    }),
  }),
});
