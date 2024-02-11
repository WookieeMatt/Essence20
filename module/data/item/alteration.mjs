import { item } from './item';
import { itemDescription } from './item-description';

const fields = foundry.data.fields;

class AlterationItemData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      availability: new fields.StringField({initial: 'standard'}),
      benefit: new fields.StringField({initial: ''}),
      bonusSkill: new fields.StringField({initial: ''}),
      cost: new fields.StringField({initial: ''}),
      costSkill: new fields.StringField({initial: ''}),
      essenceBenefit: new fields.StringField({initial: ''}),
      essenceCost: new fields.StringField({initial: ''}),
      movementCost: new fields.StringField({initial: ''}),
      selectedEssence: new fields.StringField({initial: ''}),
      type: new fields.StringField({initial: 'other'}),
    };
  }
}
