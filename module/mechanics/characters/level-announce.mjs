/**
 * What a level change did to a character, said once it has finished: a notification for the
 * player who made it, and a chat card listing what moved.
 *
 * Worked out by comparing the character before and after (levelSnapshot) rather than by
 * listening to the advancement as it happens: onLevelChange reaches a character's Essences,
 * Health, Personal Power and Perks through a dozen separate paths (sheet-handlers/role-handler.mjs
 * and friends), and a before/after comparison catches all of them without touching any.
 *
 * A Role Perk that asks the player to choose opens its own dialog and is added only once they
 * answer, after this has run - so a chosen Perk shows up on the sheet but not on the card. The
 * card says there is a choice waiting when a choice dialog is open.
 */

const ESSENCES = ['strength', 'speed', 'smarts', 'social'];

/**
 * The parts of a character a level change can move.
 * @param {Actor} actor
 * @returns {{level: Number, essences: Object<String, Number>, health: ?Number, power: ?Number, perks: Map<String, String>}}
 */
export function levelSnapshot(actor) {
  const system = actor.system;
  return {
    level: system.level,
    essences: Object.fromEntries(ESSENCES.map(essence => [essence, system.essences?.[essence]?.max ?? 0])),
    health: system.health?.max ?? null,
    power: system.powers?.personal?.max ?? null,
    perks: new Map(actor.items.filter(item => item.type === 'perk').map(item => [item.id, item.name])),
  };
}

/**
 * The differences between two snapshots, as display lines.
 * @param {ReturnType<typeof levelSnapshot>} before
 * @param {ReturnType<typeof levelSnapshot>} after
 * @returns {{changes: Array<{label: String, from: Number, to: Number}>, gained: String[], lost: String[]}}
 */
export function summarizeLevelChange(before, after) {
  const changes = [];
  for (const essence of ESSENCES) {
    if (before.essences[essence] !== after.essences[essence]) {
      changes.push({ label: CONFIG.E20.essences[essence], from: before.essences[essence], to: after.essences[essence] });
    }
  }

  if (before.health !== after.health && after.health !== null) {
    changes.push({ label: 'E20.ActorHealth', from: before.health, to: after.health });
  }

  if (before.power !== after.power && after.power !== null) {
    changes.push({ label: 'E20.LevelChangePersonalPower', from: before.power, to: after.power });
  }

  const gained = [...after.perks].filter(([id]) => !before.perks.has(id)).map(([, name]) => name).sort();
  const lost = [...before.perks].filter(([id]) => !after.perks.has(id)).map(([, name]) => name).sort();
  return { changes, gained, lost };
}

/**
 * The chat card's HTML.
 * @param {Actor} actor
 * @param {ReturnType<typeof levelSnapshot>} before
 * @param {ReturnType<typeof levelSnapshot>} after
 * @param {Boolean} choicePending   Whether a Perk choice dialog is still waiting.
 * @returns {String}
 */
export function levelChangeContent(actor, before, after, choicePending = false) {
  const { changes, gained, lost } = summarizeLevelChange(before, after);
  const escape = foundry.utils.escapeHTML ?? (text => String(text));
  const key = after.level > before.level ? 'E20.LevelChangeUp' : 'E20.LevelChangeDown';
  const lines = [`<p><strong>${escape(game.i18n.format(key, { name: actor.name, level: after.level }))}</strong></p>`];

  if (changes.length) {
    lines.push('<ul class="e20-level-change">');
    for (const change of changes) {
      lines.push(`<li>${escape(game.i18n.localize(change.label))}: ${change.from} &rarr; ${change.to}</li>`);
    }

    lines.push('</ul>');
  }

  if (gained.length) {
    lines.push(`<p>${escape(game.i18n.format('E20.LevelChangeGained', { perks: gained.join(', ') }))}</p>`);
  }

  if (lost.length) {
    lines.push(`<p>${escape(game.i18n.format('E20.LevelChangeLost', { perks: lost.join(', ') }))}</p>`);
  }

  if (choicePending) {
    lines.push(`<p><em>${escape(game.i18n.localize('E20.LevelChangeChoicePending'))}</em></p>`);
  }

  return lines.join('');
}

/**
 * Tell the player, and the table, what a finished level change did.
 * @param {Actor} actor
 * @param {ReturnType<typeof levelSnapshot>} before
 * @param {ReturnType<typeof levelSnapshot>} after
 * @returns {Promise<void>}
 */
export async function announceLevelChange(actor, before, after) {
  if (before.level === after.level) return;

  const key = after.level > before.level ? 'E20.LevelChangeUp' : 'E20.LevelChangeDown';
  ui.notifications.info(game.i18n.format(key, { name: actor.name, level: after.level }));

  const choicePending = [...(foundry.applications.instances?.values() ?? [])]
    .some(app => app.rendered && /ChoiceSelector|ChoicesSelector/.test(app.constructor.name));

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: levelChangeContent(actor, before, after, choicePending),
  });
}
