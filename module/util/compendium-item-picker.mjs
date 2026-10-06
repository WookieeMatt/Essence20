import { getVisibleItemPacks } from "./compendium-browser.mjs";

/**
 * A picker over every compendium Item matching a filter, rather than over a fixed list of options.
 *
 * Built 2026-09-15 to close a gap the ledger had been describing under several different names -
 * "item-grant/equipment-mutation" (7 entries), "item-grant mechanism", and "a bigger,
 * dynamic-per-actor picker, not a static list". Those labels sounded like three problems; reading
 * the RAW behind them showed one. Several Perks let you choose an item from a CATEGORY rather than
 * from a handful of named options:
 *   - Weapon Implant (Decepticon Directive p.52): "a single Standard non-Consumable weapon",
 *     widening to Limited and then Restricted at higher levels.
 *   - Custom Gear (GI Joe CRB p.80): "one free Limited Armor Upgrade, and one free Limited Weapon
 *     Upgrade."
 * Every existing picker in this project (pickHobbleCondition, pickCreateWeaponForm, the
 * choiceType tables) offers options written out in advance, which is exactly why these were filed
 * as needing new infrastructure. They do - but only this much of it.
 *
 * The enumeration is not new either: the Compendium Browser already builds a flat, filterable
 * index this same way (apps/compendium-browser.mjs#_buildIndex). This reuses its own
 * getVisibleItemPacks(), so a book the GM has disabled is invisible here too - a Perk cannot hand
 * out an item from a sourcebook the table has switched off.
 */

/**
 * Every compendium Item matching the given filter, as {uuid, name, img} rows.
 *
 * Indexing is done through pack.getIndex(), which reads each pack's cached index rather than
 * loading documents - the same call the Compendium Browser makes, and the reason this is cheap
 * enough to run on a click.
 * @param {Object} options
 * @param {String} options.type   The Item type to keep ('weapon', 'upgrade', 'armor', ...).
 * @param {Array<String>} [options.availabilities]   Availability tiers to keep, if restricted.
 * @param {Array<String>} [options.fields]   Extra index fields needed by `matches`.
 * @param {Function} [options.matches]   A final per-entry predicate, for anything the coarse
 *   filters can't express.
 * @returns {Promise<Array<Object>>}
 */
export async function findCompendiumItems({ type, availabilities = null, fields = [], matches = null }) {
  const rows = [];
  for (const pack of getVisibleItemPacks()) {
    const index = await pack.getIndex({
      fields: ['img', 'type', 'system.availability', ...fields],
    });

    for (const entry of index.values()) {
      if (entry.type != type) {
        continue;
      }

      if (availabilities && !availabilities.includes(entry.system?.availability)) {
        continue;
      }

      if (matches && !matches(entry)) {
        continue;
      }

      rows.push({ uuid: entry.uuid, name: entry.name, img: entry.img ?? null });
    }
  }

  rows.sort((a, b) => a.name.localeCompare(b.name));
  return rows;
}

/**
 * Asks which of a filtered set of compendium Items to take - the same single-select DialogV2 shape
 * as every other picker here, just with options built at click time.
 *
 * Returns null (rather than picking for the player) when nothing matches, so a caller can warn
 * instead of silently doing nothing - a filter that matches nothing usually means a disabled
 * sourcebook, which is worth saying out loud.
 * @param {Array<Object>} rows   From findCompendiumItems.
 * @param {Object} labels
 * @param {String} labels.title
 * @param {String} labels.label
 * @returns {Promise<String|null>}   The chosen Item's uuid, or null.
 */
export async function pickCompendiumItem(rows, { title, label }) {
  if (!rows?.length) {
    return null;
  }

  const options = rows
    .map(row => `<option value="${row.uuid}">${foundry.utils.escapeHTML?.(row.name) ?? row.name}</option>`)
    .join('');
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize(title) },
    classes: ["window-app"],
    content: `<div class="form-group"><label>${
      game.i18n.localize(label)
    }</label><select name="uuid">${options}</select></div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => button.form.elements.uuid.value,
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  return chosen && chosen != 'cancel' ? chosen : null;
}
