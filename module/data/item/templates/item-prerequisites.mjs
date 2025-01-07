const fields = foundry.data.fields;

export const itemPrerequisites = () => ({
  prerequisites: new fields.ObjectField({}),
});
