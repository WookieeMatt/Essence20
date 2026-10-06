/**
 * Compendium ids for the tf3 slice - Transformers Core Rulebook and Transformers One Sourcebook
 * items. The lookups, chat and stamp helpers it used to carry live in item-lookups.mjs,
 * chat-lines.mjs, sides.mjs and turn-stamps.mjs.
 */

const tf = id => `Compendium.essence20.tf_crb.Item.${id}`;
const tf1s = id => `Compendium.essence20.transformers_one_sourcebook.Item.${id}`;

export const TF3 = {
  multiplication: tf('K3FNcAMjjek1UaJk'),
  thirdDimension: tf('4pyOcetfAuXZlXmH'),
  unexpectedAlternative: tf('UNe8N1eZWjWxDTIz'),
  deceptiveWarfare: tf1s('OJcHMBA3QYgPp5w0'),
  oneBotOverAnother: tf1s('n5dNCOPVTsqLAapp'),
};

export const SCOPE = 'essence20';
