const fields = foundry.data.fields;

export const item = () => ({
  originalId: new fields.StringField({initial: ''}), // Idt we need this
});
