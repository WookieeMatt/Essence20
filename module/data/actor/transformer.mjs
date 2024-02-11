import { common } from './common';
import { creature } from './creature';
import { character } from './character';

class TransformerActorData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...character(),
      ...common(),
      ...creature(),
      canTransform: new fields.BooleanField({initial: true}),
      externalHardpoints: makeInt(2),
      internalHarpoints: makeInt(2),
      transformerFaction: new fields.StringField({initial: 'autobots'}),
    };
  }
}
