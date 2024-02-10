class CreatureActorData extends foundry.abstract.DataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      languages: new fields.ArrayField(new fields.StringField()), // Prob change to string
    };
  }
}
