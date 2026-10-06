/**
 * Zord and Vehicle Essences: a typed base and a worked-out value.
 *
 * A Zord's Essences used to be one stored number, `system.essences.<key>.value`, that both the
 * sheet and the Zord Features' Active Effects (Heavy Chassis, Increase Essence, ...) and item rules
 * (Mesh Zord, Terrorzord Nature) wrote to. The sheet showed the boosted number and saved it back
 * with every form submit, so each edit counted the Feature bonuses again.
 *
 * Now the sheet edits `system.essences.<key>.base`. Each prep copies base into value before Active
 * Effects apply (Essence20Actor#prepareBaseData), so effects and rules still target `.value` and
 * stack on top of the base. Code that writes `.value` directly (Zord Alterations, Essence damage,
 * rule steps) is turned into the same change on the base (Essence20Actor#_preUpdate).
 *
 * Megaforms are left alone: their Strength / Speed are worked out from the joined Zords.
 */

const KEYS = ['strength', 'speed', 'smarts', 'social'];
const TYPES = ['zord', 'vehicle'];

/** Whether an actor keeps a typed Essence base under its worked-out value. */
export function usesEssenceBase(actor) {
  return TYPES.includes(actor?.type);
}

/**
 * migrateData: a stored Zord / Vehicle record without a base takes its stored value as the base,
 * as-is. Only a full record (one carrying `usesDrivers`) is migrated, never a partial update.
 * @param {Object} source   The raw system data
 * @returns {Boolean}       Whether anything moved
 */
export function migrateMachineEssences(source) {
  let moved = false;
  for (const key of KEYS) {
    const essence = source?.essences?.[key];
    if (essence && typeof essence == 'object' && essence.base === undefined && 'usesDrivers' in essence && 'value' in essence) {
      essence.base = essence.value;
      moved = true;
    }
  }

  return moved;
}

/** prepareBaseData: start each Essence's value from its base, before Active Effects apply. */
export function resetEssencesFromBase(system) {
  for (const key of KEYS) {
    const essence = system?.essences?.[key];
    if (essence && essence.base !== undefined) {
      essence.value = essence.base;
    }
  }
}

/**
 * _preUpdate: a write to `.value` with no `.base` in the same update moves the base by the same
 * amount the value moves (an Alteration's +2 on a Zord showing 7 from Heavy Chassis raises a base
 * of 6 to 8). The `.value` write stays in the update (essenceChanged Triggers read it); the next
 * prep replaces it.
 * @param {Actor} actor
 * @param {Object} changed   The (expanded) update data
 */
export function convertEssenceWrites(actor, changed) {
  const { getProperty, hasProperty, setProperty } = foundry.utils;
  for (const key of KEYS) {
    const valuePath = `system.essences.${key}.value`;
    const basePath = `system.essences.${key}.base`;
    if (!hasProperty(changed, valuePath) || hasProperty(changed, basePath)) {
      continue;
    }

    const wanted = getProperty(changed, valuePath);
    if (wanted === null || wanted === undefined || !Number.isFinite(Number(wanted))) {
      setProperty(changed, basePath, wanted ?? null);
      continue;
    }

    const shown = Number(actor.system?.essences?.[key]?.value) || 0;
    const stored = actor._source?.system?.essences?.[key];
    const base = Number(stored?.base ?? stored?.value) || 0;
    setProperty(changed, basePath, base + (Number(wanted) - shown));
  }
}

/**
 * The Zords / Vehicles whose effects or rules change an Essence: [{actor, rows: [{key, base, value}]}].
 * World actors, and unlinked tokens on every scene.
 */
export function essenceAdjustedMachines(game = globalThis.game) {
  const actors = [...(game?.actors ?? [])];
  for (const scene of game?.scenes ?? []) {
    for (const token of scene.tokens ?? []) {
      if (!token.actorLink && token.actor) {
        actors.push(token.actor);
      }
    }
  }

  const found = [];
  for (const actor of actors) {
    if (!usesEssenceBase(actor)) {
      continue;
    }

    const rows = KEYS.map(key => ({ key, base: actor.system?.essences?.[key]?.base, value: actor.system?.essences?.[key]?.value }))
      .filter(row => row.base !== null && row.base !== undefined && Number(row.base) != Number(row.value));
    if (rows.length) {
      found.push({ actor, rows });
    }
  }

  return found;
}

/**
 * Once per world (the active GM, at ready): whisper the GMs which Zords / Vehicles have Features
 * changing an Essence, so they can check the base wasn't typed with the bonus already in it.
 */
export async function noticeEssenceBases(game = globalThis.game) {
  if (!game?.users?.activeGM?.isSelf || game.settings.get('essence20', 'machineEssenceBaseNotice')) {
    return false;
  }

  await game.settings.set('essence20', 'machineEssenceBaseNotice', true);
  const found = essenceAdjustedMachines(game);
  if (!found.length) {
    return false;
  }

  const i18n = game.i18n;
  const escape = text => String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const lines = found.map(({ actor, rows }) => `<li><strong>${escape(actor.name)}</strong>: ${rows.map(row => i18n.format('E20.MachineEssenceRow', {
    essence: i18n.localize(globalThis.CONFIG?.E20?.essences?.[row.key] ?? row.key), base: row.base, value: row.value,
  })).join(', ')}</li>`);
  await ChatMessage.create({
    content: `<p><strong>${i18n.localize('E20.MachineEssenceNoticeTitle')}</strong></p><p>${i18n.localize('E20.MachineEssenceNoticeBody')}</p><ul>${lines.join('')}</ul>`,
    whisper: ChatMessage.getWhisperRecipients('GM').map(user => user.id),
    speaker: { alias: 'Essence 20' },
  });
  return true;
}
