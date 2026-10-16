/**
 * The Bond item type is gone (6.0.5). Bonds were the books' Background Bonds - roleplaying hooks an Influence suggests
 * (PR CRB p.65, TF CRB p.29) - only ever a name and some text, so they're text now: the Bio tab's Bonds box
 * (system.biography.bonds). Each Bond's name and text move there (into Notes, under a heading, for actor types without a
 * Bio tab), and the Bond items are deleted - from
 * world actors, unlinked tokens on every scene, the Items directory, and world and module compendiums. A Bond on no
 * character (the Items directory, an Item compendium) with anything in it is kept in a "Bonds" Journal Entry first.
 *
 * With the type out of system.json a Bond no longer validates, so Foundry loads it as an invalid document: still in its
 * parent's source data, readable (EmbeddedCollection#getInvalid) and deletable by id - the same way the old megaformZord
 * actors were migrated (migration.mjs). Everything here therefore reads the raw source, never the Item documents.
 * Run from migrateWorld (needsMigrationVersion 6.0.5); every step is value-matched, so a second run finds nothing.
 */

/** Item types that no longer exist. */
export const RETIRED_ITEM_TYPES = ['bond'];

const isRetired = data => RETIRED_ITEM_TYPES.includes(data?.type);

const escape = text => String(text ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * The HTML a set of Bonds becomes: a heading and a list, each Bond's name in bold and its text after it. Each entry
 * carries its item's id, so a Bond already moved (a run interrupted between the write and the delete) isn't added twice.
 * @param {Object[]} bonds     Bond item source data: [{_id, name, system: {description}}]
 * @param {String} existing    The field's HTML now.
 * @param {String|null} heading   A heading above the list - none in the Bonds box itself.
 * @returns {String|null}      The new HTML, or null when there is nothing new to add.
 */
export function bondsHtml(bonds, existing = '', heading = 'Bonds') {
  const fresh = bonds.filter(bond => !String(existing ?? '').includes(`data-e20-bond="${bond._id}"`));
  if (!fresh.length) {
    return null;
  }

  const entries = fresh.map(bond => {
    const text = String(bond.system?.description ?? '').trim();
    return `<li data-e20-bond="${escape(bond._id)}"><strong>${escape(bond.name)}</strong>${text ? ` ${text}` : ''}</li>`;
  });
  return `${existing ?? ''}${heading ? `<h3>${escape(heading)}</h3>` : ''}<ul>${entries.join('')}</ul>`;
}

/** Whether a loose Bond is worth keeping: it has text, or a name of its own (not the default "Bond"). */
export function isWorthKeeping(bond, defaultName = 'Bond') {
  const text = String(bond?.system?.description ?? '').replace(/<[^>]*>/g, '').trim();
  const name = String(bond?.name ?? '').trim();
  return !!text || (!!name && name != defaultName);
}

/**
 * Where an actor's Bonds go: the Bio tab's Bonds box when its type has one (characters, NPCs, companions - the type's
 * own schema says), else its Notes (Zords, vehicles, Megaforms, the Party).
 * @param {Object} system   The actor's system source.
 * @param {String} [type]   The actor type.
 * @returns {String}        The update path.
 */
export function bondsField(system, type = null) {
  const schema = type ? globalThis.CONFIG?.Actor?.dataModels?.[type]?.schema : null;
  if (schema) {
    return schema.getField('biography.bonds') ? 'system.biography.bonds' : 'system.notes';
  }

  return system?.biography && typeof system.biography == 'object' ? 'system.biography.bonds' : 'system.notes';
}

/**
 * What retiring an actor's Bonds takes, from its source data: the field update and the Bond item ids to delete - or
 * null when it holds none.
 * @param {Object} source    The actor's source ({system, items: [...]}) - invalid embedded Items included.
 * @param {String} [heading]
 * @returns {{update: Object, ids: String[]}|null}
 */
export function retireBondsPlan(source, heading = 'Bonds') {
  const bonds = (source?.items ?? []).filter(isRetired);
  if (!bonds.length) {
    return null;
  }

  const path = bondsField(source.system, source.type);
  const existing = path.split('.').slice(1).reduce((value, key) => value?.[key], source.system) ?? '';
  // The Bonds box is its own heading; in Notes they get one.
  const html = bondsHtml(bonds, existing, path == 'system.notes' ? heading : null);
  return { update: html ? { [path]: html } : {}, ids: bonds.map(bond => bond._id) };
}

/**
 * A write that may throw after it has landed: when a world actor changes, Foundry rebuilds the actors of its unlinked
 * tokens, and one still holding a Bond (an invalid Item) fails that rebuild - after the write itself went through. So
 * the write counts as done when `landed` says the data changed, whatever was thrown.
 */
async function settle(write, landed) {
  try {
    await write();
  } catch (error) {
    if (!landed()) {
      throw error;
    }
  }
}

const valueAt = (data, path) => path.split('.').reduce((value, key) => value?.[key], data);

/**
 * Retire one actor's Bonds - a world actor or one in a compendium. Read from its source, so Bonds that are invalid
 * documents now are found too.
 * @param {Actor} actor
 * @param {String} [heading]
 * @returns {Promise<Number>}   How many Bonds moved.
 */
export async function retireActorBonds(actor, heading = 'Bonds') {
  const plan = retireBondsPlan(actor?._source, heading);
  if (!plan) {
    return 0;
  }

  // The text first, then the items: a run stopped in between finds the text there and only deletes.
  const [[path, html] = []] = Object.entries(plan.update);
  if (path) {
    await settle(() => actor.update(plan.update), () => valueAt(actor._source, path) === html);
  }

  await settle(() => actor.deleteEmbeddedDocuments('Item', plan.ids), () => !actor._source.items.some(item => plan.ids.includes(item._id)));
  return plan.ids.length;
}

/**
 * Retire an unlinked token's own Bonds: the ones its delta holds (its base actor's are its base actor's, done with it).
 * Written to the delta itself - the token's actor can't be rebuilt while its base actor still holds a Bond.
 * @param {TokenDocument} token
 * @param {String} [heading]
 * @returns {Promise<Number>}
 */
export async function retireTokenBonds(token, heading = 'Bonds') {
  const delta = token?.delta;
  const bonds = (delta?._source?.items ?? []).filter(isRetired);
  if (!bonds.length) {
    return 0;
  }

  // The token's text as it reads now (its own, else its base actor's), with its own Bonds added.
  const system = token.actor?._source?.system ?? token.baseActor?._source?.system ?? {};
  const path = bondsField(system, token.actor?.type ?? token.baseActor?.type);
  const html = bondsHtml(bonds, valueAt(system, path.slice('system.'.length)) ?? '', path == 'system.notes' ? heading : null);
  const ids = bonds.map(bond => bond._id);
  if (html) {
    await settle(() => delta.update({ [path]: html }), () => valueAt(delta._source, path) === html);
  }

  await settle(() => delta.deleteEmbeddedDocuments('Item', ids), () => !delta._source.items.some(item => ids.includes(item._id)));
  return ids.length;
}

/**
 * Retire every Bond in the world: world actors, unlinked tokens' actors on every scene, Items-directory Bonds, and the
 * world's and modules' Essence20 compendiums (unlocked for it and locked again). Each document on its own, so one that
 * fails doesn't stop the rest.
 * @returns {Promise<{actors: Number, bonds: Number, items: Number, failed: Number}>}
 */
export async function retireWorldBonds() {
  const heading = game.i18n.localize('E20.BondsHeading');
  const tally = { actors: 0, bonds: 0, items: 0, failed: 0 };
  const retire = async (actor, token = null) => {
    try {
      const moved = token ? await retireTokenBonds(token, heading) : await retireActorBonds(actor, heading);
      if (moved) {
        tally.actors++;
        tally.bonds += moved;
      }
    } catch (error) {
      tally.failed++;
      console.error(`essence20 | could not move ${actor?.name}'s Bonds`, error);
    }
  };

  // Unlinked tokens' own Bonds first: until they're gone, changing a token's base actor fails to rebuild the token.
  for (const scene of game.scenes ?? []) {
    for (const token of scene.tokens ?? []) {
      if (!token.actorLink) {
        await retire(token.actor ?? token, token);
      }
    }
  }

  for (const actor of game.actors ?? []) {
    await retire(actor);
  }

  // Bonds on no character - the Items directory, Item compendiums - are kept in a Journal Entry when there's anything in
  // them, before they go.
  const kept = [];
  const keep = async bonds => {
    const worth = bonds.filter(bond => isWorthKeeping(bond));
    if (worth.length) {
      kept.push(...worth);
    }
  };

  // Items-directory Bonds: invalid documents now, found by id in the world's source data.
  const looseBonds = (game.data?.items ?? []).filter(isRetired);
  const looseItems = [];
  if (looseBonds.length) {
    await keep(looseBonds);
    looseItems.push(...looseBonds.map(item => item._id));
  }

  for (const pack of game.packs ?? []) {
    const system = pack.metadata?.system;
    if (!['world', 'module'].includes(pack.metadata?.packageType) || !['Actor', 'Item'].includes(pack.documentName)
      || (system && system != 'essence20')) {
      continue;
    }

    try {
      // From the index: the Bond items, or the actors holding one - only those are opened.
      const index = await pack.getIndex({ fields: pack.documentName == 'Item' ? ['type', 'system.description'] : ['items'] });
      const ids = pack.documentName == 'Item'
        ? index.filter(isRetired).map(entry => entry._id)
        : index.filter(entry => (entry.items ?? []).some(isRetired)).map(entry => entry._id);
      if (!ids.length) {
        continue;
      }

      const wasLocked = pack.locked;
      if (wasLocked) await pack.configure({ locked: false });
      try {
        if (pack.documentName == 'Item') {
          await keep(index.filter(isRetired));
          await keepInJournal(kept, heading);
          kept.length = 0;
          await Item.deleteDocuments(ids, { pack: pack.collection });
          tally.items += ids.length;
        } else {
          for (const id of ids) {
            await retire(await pack.getDocument(id));
          }
        }
      } finally {
        if (wasLocked) await pack.configure({ locked: true });
      }
    } catch (error) {
      tally.failed++;
      console.error(`essence20 | could not retire the Bonds in ${pack.collection}`, error);
    }
  }

  if (looseItems.length) {
    try {
      await keepInJournal(kept, heading);
      await Item.deleteDocuments(looseItems);
      tally.items += looseItems.length;
    } catch (error) {
      tally.failed++;
      console.error('essence20 | could not retire the Items-directory Bonds', error);
    }
  }

  if (tally.bonds || tally.items) {
    ui.notifications.info(game.i18n.format('E20.BondsRetired', { bonds: tally.bonds + tally.items, actors: tally.actors }), { permanent: true });
  }

  return tally;
}

/** Keep loose Bonds' text in a "Bonds" Journal Entry (made once, added to after). */
async function keepInJournal(bonds, heading) {
  if (!bonds.length) {
    return null;
  }

  const name = game.i18n.localize('E20.BondsJournal');
  const journal = game.journal?.getName?.(name) ?? await JournalEntry.create({ name });
  const page = journal.pages?.contents?.[0];
  const html = bondsHtml(bonds, page?.text?.content ?? '', heading);
  if (!html) {
    return journal;
  }

  if (page) {
    await page.update({ 'text.content': html });
  } else {
    await journal.createEmbeddedDocuments('JournalEntryPage', [{ name: heading, type: 'text', text: { content: html } }]);
  }

  return journal;
}
