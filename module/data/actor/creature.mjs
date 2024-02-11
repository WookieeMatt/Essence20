const fields = foundry.data.fields;

export const creature = () => ({
  languages: new fields.ArrayField(new fields.StringField()), // Prob change to string
});
