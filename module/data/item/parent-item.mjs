const fields = foundry.data.fields;

export const parentItem = () => ({
  items: new fields.ObjectField({}),
});
