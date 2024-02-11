const fields = foundry.data.fields;

export const item = () => ({
  description: new fields.HTMLField(),
  source: new fields.SchemaField({
    book: new fields.StringField({initial: ''}),
    page: new fields.NumberField({
      initial: null,
      integer: true,
    }),
  }),
});
