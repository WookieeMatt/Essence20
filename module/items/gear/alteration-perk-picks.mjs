import { registerUse } from "../../mechanics/item-hooks.mjs";
import {
  CC, G1, T, isFrom, itemsOf, post, sourceOf,
} from "../shared/cobra-codex-item-lookups.mjs";

/**
 * Cobra Codex Perks and Hang-Ups: Cybernetic Part and its sibling Alteration Perks. (Demolition Artist /
 * Improvise Bomb, Extract Poison's Use, Metier and Scavenger are item rules now - rules/conv10-slE10.test.js.)
 * (Shielded is an item rule now - rules/conversions-uses.test.js; so are Primal Fear and Feed On
 * Fear - rules/conv3-slC3.test.js - and Let It Rip - rules/conv7-slC7.test.js.)
 */

// A Perk's own pick (Metier's option) lives on the Perk copy, so taking the Perk twice keeps two picks.
export const CHOICE_FLAG = 'gij1Choice';
export const choiceOf = item => item?.flags?.essence20?.[CHOICE_FLAG] ?? null;

/* -------------------------------------------- */
/*  Picks made when the Perk is taken            */
/* -------------------------------------------- */

// Cybernetic Part (General Perk, p.79): "Gain a permanent Standard Cybernetic Alteration. You may
// select this Perk multiple times." Its siblings on p.79-81 work the same way at other tiers:
// Enhanced Part (Limited Cybernetic), Optimized Part (Restricted Cybernetic), Engrafted Mutation
// (Standard Genetic), Evolving Mutation (Limited Genetic) and Outright Mutation (Restricted
// Genetic). Any Alteration can be taken in cybernetic or genetic form (p.82), so the picker offers
// every Alteration of that tier the character doesn't already have ("You can't gain the same
// Alteration twice", p.82). It goes through the Alteration drop handler, so its Essence/skill/
// movement benefit and cost are applied exactly as a dragged-in one would be.
export const ALTERATION_PERKS = {
  [G1.cyberneticPart]: { availability: 'standard', form: 'cybernetic' },
  [CC('eT4g9EfrFtvjMqWu')]: { availability: 'limited', form: 'cybernetic' }, // Enhanced Part
  [CC('zGsTAngJ2HRdKPkz')]: { availability: 'restricted', form: 'cybernetic' }, // Optimized Part
  [CC('zuR9YJ2Wy956VGGy')]: { availability: 'standard', form: 'genetic' }, // Engrafted Mutation
  [CC('7cL4aUwJwqvbhYCz')]: { availability: 'limited', form: 'genetic' }, // Evolving Mutation
  [CC('RcGUjeMpsNDFjwmL')]: { availability: 'restricted', form: 'genetic' }, // Outright Mutation
};

// Beast Mode's copies of the Mutation Perks last one scene (items/forms/beast-mode-tiers.mjs),
// so they don't hand out a permanent Alteration.
const isBeastModeCopy = item => !!item.flags?.essence20?.beastMode
  || item.parent?.flags?.essence20?.beastModeGrantedItemId == item.id;

async function grantAlterationPerk(item) {
  const actor = item.parent;
  const spec = ALTERATION_PERKS[sourceOf(item)];
  if (!spec) {
    return null;
  }

  const { findItems, pickOne } = await import("../../mechanics/resources/grants.mjs");
  const owned = new Set(itemsOf(actor).filter(i => i.type == 'alteration').map(i => i.system?.originalId ?? sourceOf(i)));
  const rows = (await findItems({ type: 'alteration', availabilities: [spec.availability] })).filter(row => !owned.has(row.uuid)
    && !owned.has(row.uuid.split('.').pop()));
  const uuid = await pickOne(item.name, rows);
  const source = uuid ? await fromUuid(uuid) : null;
  if (!source) {
    return null;
  }

  const { onAlterationDrop } = await import("../../sheet-handlers/alteration-handler.mjs");
  const before = new Set(itemsOf(actor).map(i => i.id));
  const data = source.toObject();
  delete data._id;
  foundry.utils.setProperty(data, 'flags.core.sourceId', uuid);
  foundry.utils.setProperty(data, 'flags.essence20.grantedBy', item.id);
  foundry.utils.setProperty(data, `flags.essence20.${spec.form}Alteration`, true);
  await onAlterationDrop(actor, source, () => actor.createEmbeddedDocuments('Item', [data]));
  const created = itemsOf(actor).find(i => !before.has(i.id) && i.type == 'alteration');
  if (!created) {
    return null;
  }

  await item.setFlag('essence20', 'granted', true);
  return spec.form == 'cybernetic'
    ? T('G1CyberneticGranted', { name: actor.name, alteration: created.name })
    : T('Pr3GrantedItem', { name: actor.name, item: created.name, source: item.name });
}

const SETUPS = [
  ...Object.keys(ALTERATION_PERKS).map(uuid => ({
    uuid, needs: item => !item.flags?.essence20?.granted && !isBeastModeCopy(item), run: grantAlterationPerk,
  })),
];

for (const setup of SETUPS) {
  registerUse({
    id: `gij1Setup-${setup.uuid.split('.').pop()}`,
    matches: isFrom(setup.uuid),
    canUse: item => !!item.parent && setup.needs(item),
    run: item => setup.run(item),
  });
}

// Asked as soon as the Perk lands on a character, by the user who added it; the Use button stays
// until the pick is made, for a dialog closed early or a Perk added some other way.
Hooks.on('createItem', async (item, options, userId) => {
  if (userId != game.user?.id || item.parent?.documentName != 'Actor') {
    return;
  }

  const setup = SETUPS.find(entry => isFrom(entry.uuid)(item));
  if (!setup || !setup.needs(item)) {
    return;
  }

  try {
    const line = await setup.run(item);
    if (line) {
      await post(item.parent, line);
    }
  } catch (error) {
    console.error('Essence20 | gij1 setup failed', error);
  }
});
