import ChoicesSelector from "../apps/choices-selector.mjs";
import { getOwnedZord } from "./combat.mjs";

/**
 * Torozord Feature (Through the Shattered Grid, Magna Defender Role Perk, p.25): "Upon reaching
 * 6th level, then again at 10th, 14th, and 17th levels, your connection with the Torozord has
 * strengthened, allowing it to evolve and become more powerful. Each time you acquire this Role
 * Perk, you may choose from the available Zord Features to apply to the Torozord." This is the
 * project's first cross-actor, player-choice item grant: the Perk lives on the Magna Defender
 * (the pilot), but the item it grants belongs on their own Torozord, a separate linked Zord
 * actor - resolved via getOwnedZord (combat.mjs), the "which Zord is MINE" lookup, not
 * getVehicleDriver/_getPilotedVehicle's "who's currently seated in this Zord right now."
 *
 * The Zord Feature catalog itself isn't attached to this Perk's own system.items map (unlike
 * every other choiceType picker in this codebase) - Zord Features are scattered across every PR
 * sourcebook's own item pack (feature.mjs's own FeatureItemData, ~86 real items system-wide), not
 * a fixed short list one Perk can enumerate. So this scans every world Item compendium directly,
 * the same live-index technique perk-handler.mjs's own _showSpectrumShiftDialog already
 * established for Spectrum Shift's identically-scattered Role catalog, rather than requiring
 * every Feature to be pre-listed on this item by uuid.
 *
 * Reuses ChoicesSelector's existing "rolePerk" action (apps/choices-selector.mjs) verbatim -
 * the same dispatch attachment-handler.mjs's own promptRolePerkChoice already uses for a
 * same-actor Role-Perk alternative - just constructed with the ZORD as its target actor instead
 * of the pilot who holds the Perk, so the resulting grantItemEntry() call creates the chosen
 * Feature directly on the Zord.
 * @param {Actor} actor   The Magna Defender pilot who was just granted this Perk.
 * @param {Item} perk   The granted Torozord Feature Perk item itself (becomes the new Feature's
 *   own flags.essence20.parentId, matching every other Role-Perk-choice grant's provenance).
 *
 * Note: leveling back down deletes this Perk item from the PILOT via the normal
 * deleteAttachmentsForItem() sweep, but has no way to also find and remove the Feature it
 * granted on the ZORD (that sweep only ever searches the same actor holding the deleted Perk) -
 * an accepted gap, the same "un-grant on level-down isn't always modeled" simplification this
 * project already lives with elsewhere (e.g. a banked bonus that's already been spent).
 */
export async function grantTorozordFeature(actor, perk) {
  const zord = getOwnedZord(actor);
  if (!zord) {
    ui.notifications.warn(game.i18n.localize('E20.TorozordFeatureNoZord'));
    return;
  }

  const choices = await buildTorozordFeatureChoices(zord);
  if (!Object.keys(choices).length) {
    ui.notifications.error(game.i18n.localize('E20.NoChoicesError'));
    return;
  }

  const prompt = game.i18n.localize('E20.SelectTorozordFeature');
  const title = game.i18n.localize('E20.TorozordFeatureSelectTitle');
  await new ChoicesSelector(choices, zord, prompt, title, perk, null, null, null, null, null, 'rolePerk').render(true);
}

/**
 * Scans every world Item compendium for real `feature`-type items (Zord Features) the given
 * Zord doesn't already hold, shaped as a ChoicesSelector-ready choices map. Pulled out of
 * grantTorozordFeature() so this - the actual candidate-gathering logic - can be unit tested
 * directly; the dialog-construction step around it isn't (same "sheet-handler-adjacent UI
 * plumbing isn't practically unit-tested" split this codebase already draws everywhere else).
 * @param {Actor} zord
 * @returns {Promise<Object>}
 */
export async function buildTorozordFeatureChoices(zord) {
  const alreadyHeldSourceIds = new Set(
    zord.items.map(item => item.flags.core?.sourceId ?? item._stats?.compendiumSource),
  );

  const choices = {};
  for (const pack of game.packs.filter(p => p.documentName == 'Item')) {
    const index = await pack.getIndex({ fields: ['type'] });
    for (const entry of index) {
      if (entry.type == 'feature' && !alreadyHeldSourceIds.has(entry.uuid)) {
        choices[entry.uuid] = {
          chosen: false,
          value: entry.uuid,
          label: entry.name,
          entry: { uuid: entry.uuid, name: entry.name, type: 'feature' },
        };
      }
    }
  }

  return choices;
}
