import { hasUpgrade, UPGRADE } from "./weapon-upgrades.mjs";

/**
 * Time, Proximity and Detonator Bombs (GI Joe CRB / PR CRB / TF CRB Weapon Upgrades): "This
 * explosive is planted instead of thrown ... Setting a bomb is a Standard action. ... When a bomb
 * detonates, whoever planted it makes a Technology (Explosives) Skill Test against anyone in the
 * bomb's blast radius. This does mean that if the person who set the bomb gets caught in the bomb's
 * blast radius, they attack themself."
 *
 * - Time Bomb: "designate a number of turns and an Initiative count ... On that Initiative count in
 *   that many turns, the time bomb detonates."
 * - Proximity Bomb: "Starting after the end of the turn the proximity bomb is set, if any time a
 *   character enters the bomb's area of effect, the proximity bomb detonates."
 * - Detonator Bomb: "The bomb triggers when someone ... presses a detonator button ... Using a
 *   detonator is a free action."
 *
 * Rolling a weapon effect whose weapon carries one of these plants it instead of attacking
 * (documents/item.mjs). A planted bomb is kept on the planter's own actor (flags.essence20.
 * plantedBombs), where they may write it. Its chat card carries the Detonate button; a Time Bomb
 * coming due or a Proximity Bomb being walked into posts another card with the same button,
 * resolved by the planter - their Technology test, against every token inside the radius.
 */

const BOMBS_FLAG = 'plantedBombs';
const KINDS = { [UPGRADE.timeBomb]: 'time', [UPGRADE.proximityBomb]: 'proximity', [UPGRADE.detonatorBomb]: 'detonator' };

/**
 * Which kind of bomb this weapon is, if any.
 * @param {Item} weapon
 * @returns {?String}   'time', 'proximity' or 'detonator'.
 */
export function bombKind(weapon) {
  for (const [id, kind] of Object.entries(KINDS)) {
    if (hasUpgrade(weapon, id)) {
      return kind;
    }
  }

  return null;
}

export function getPlantedBombs(actor) {
  return actor?.getFlag?.('essence20', BOMBS_FLAG) ?? [];
}

async function setPlantedBombs(actor, bombs) {
  await actor.setFlag('essence20', BOMBS_FLAG, bombs);
}

/**
 * Plant a bomb where the planter stands (its range is Reach) or on the targeted token.
 * @param {Actor} actor
 * @param {Item} effect   The weapon effect planted - its radius is the blast.
 * @param {Item} weapon
 * @returns {Promise<?Object>}   The planted bomb, or null if the question was closed.
 */
export async function plantBomb(actor, effect, weapon) {
  const kind = bombKind(weapon);
  const token = actor.getActiveTokens?.()?.[0];
  const target = game.user?.targets?.first?.();
  const at = target?.center ?? token?.center;
  if (!kind || !at) {
    return null;
  }

  let turns = 0;
  if (kind == 'time') {
    const result = await foundry.applications.api.DialogV2.wait({
      window: { title: weapon.name },
      classes: ["window-app", "e20-window"],
      content: `<p>${game.i18n.localize('E20.BombTimePrompt')}</p><div class="form-group"><input type="number" name="turns" value="1" min="0" step="1"></div>`,
      buttons: [
        { action: 'ok', label: game.i18n.localize('E20.DialogConfirmButton'), default: true, callback: (event, button) => Number(button.form.elements.turns.value) || 0 },
        { action: 'cancel', label: game.i18n.localize('E20.DialogCancelButton') },
      ],
      rejectClose: false,
    });
    if (result === null || result == 'cancel') {
      return null;
    }

    turns = result;
  }

  const combat = game.combat;
  const combatant = combat?.combatants?.find?.(c => c.actorId == actor.id || c.actor?.id == actor.id);
  const bomb = {
    id: foundry.utils.randomID(),
    kind,
    sceneId: canvas?.scene?.id ?? null,
    x: at.x,
    y: at.y,
    radius: effect.system.radius || 5,
    effectId: effect.id,
    weaponName: weapon.name,
    combatId: combat?.id ?? null,
    plantedRound: combat?.round ?? 0,
    plantedTurn: combat?.turn ?? 0,
    dueRound: kind == 'time' ? (combat?.round ?? 0) + turns : null,
    dueInitiative: kind == 'time' ? (combatant?.initiative ?? null) : null,
  };

  await setPlantedBombs(actor, [...getPlantedBombs(actor), bomb]);
  await postBombCard(actor, bomb, 'E20.BombPlanted');
  return bomb;
}

async function postBombCard(actor, bomb, key) {
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<p>${game.i18n.format(key, { name: actor.name, weapon: bomb.weaponName, kind: game.i18n.localize(`E20.BombKind.${bomb.kind}`) })}</p>
      <button type="button" class="e20-chat-action-button e20-detonate-bomb" data-actor-uuid="${actor.uuid}" data-bomb-id="${bomb.id}">${game.i18n.localize('E20.BombDetonate')}</button>`,
    flags: { essence20: { bomb: { actorUuid: actor.uuid, bombId: bomb.id } } },
  });
}

/**
 * The tokens inside a bomb's blast.
 */
export function tokensInBlast(bomb) {
  const tokens = canvas?.tokens?.placeables ?? [];
  if (!canvas?.grid || canvas.scene?.id != bomb.sceneId) {
    return [];
  }

  return tokens.filter(token => token.actor
    && canvas.grid.measurePath([{ x: bomb.x, y: bomb.y }, token.center]).distance <= bomb.radius);
}

/**
 * Detonate: the planter's Technology (Explosives) test against everyone in the blast, then the bomb
 * is gone.
 * @param {Actor} actor   The planter.
 * @param {String} bombId
 * @returns {Promise<Boolean>}
 */
export async function detonateBomb(actor, bombId) {
  const bomb = getPlantedBombs(actor).find(b => b.id == bombId);
  if (!bomb) {
    ui.notifications.warn(game.i18n.localize('E20.BombGone'));
    return false;
  }

  if (!actor.isOwner) {
    ui.notifications.warn(game.i18n.format('E20.BombNotYours', { name: actor.name }));
    return false;
  }

  const effect = actor.items.get(bomb.effectId);
  await setPlantedBombs(actor, getPlantedBombs(actor).filter(b => b.id != bombId));
  if (!effect) {
    return false;
  }

  const targets = tokensInBlast(bomb);
  canvas.tokens?.setTargets?.(targets.map(token => token.id));
  await effect.roll({ bombDetonation: true, bypassEconomy: true, skillOverride: 'technology' });
  return true;
}

/**
 * Time Bombs coming due, on the active GM's client when a turn starts: "On that Initiative count in
 * that many turns, the time bomb detonates."
 * @param {Combat} combat
 */
export async function checkTimeBombs(combat) {
  if (!game.user?.isActiveGM || !combat) {
    return;
  }

  const current = combat.combatant;
  for (const actor of game.actors?.contents ?? []) {
    for (const bomb of getPlantedBombs(actor)) {
      if (bomb.kind != 'time' || bomb.combatId != combat.id || bomb.announced) {
        continue;
      }

      const dueNow = combat.round > bomb.dueRound
        || (combat.round == bomb.dueRound && (bomb.dueInitiative == null || (current?.initiative ?? -Infinity) <= bomb.dueInitiative));
      if (dueNow) {
        await setPlantedBombs(actor, getPlantedBombs(actor).map(b => (b.id == bomb.id ? { ...b, announced: true } : b)));
        await postBombCard(actor, bomb, 'E20.BombDue');
      }
    }
  }
}

/**
 * Proximity Bombs: someone moved into the blast area, after the turn it was set.
 * @param {TokenDocument} tokenDoc
 */
export async function checkProximityBombs(tokenDoc) {
  if (!game.user?.isActiveGM) {
    return;
  }

  const combat = game.combat;
  const size = tokenDoc.parent?.grid?.size ?? canvas?.grid?.size ?? 100;
  const center = { x: tokenDoc.x + ((tokenDoc.width ?? 1) * size) / 2, y: tokenDoc.y + ((tokenDoc.height ?? 1) * size) / 2 };
  if (!canvas?.grid) {
    return;
  }

  for (const actor of game.actors?.contents ?? []) {
    for (const bomb of getPlantedBombs(actor)) {
      if (bomb.kind != 'proximity' || bomb.announced || bomb.sceneId != tokenDoc.parent?.id) {
        continue;
      }

      const armed = !combat || combat.id != bomb.combatId
        || combat.round > bomb.plantedRound || (combat.round == bomb.plantedRound && combat.turn > bomb.plantedTurn);
      if (armed && canvas.grid.measurePath([{ x: bomb.x, y: bomb.y }, center]).distance <= bomb.radius) {
        await setPlantedBombs(actor, getPlantedBombs(actor).map(b => (b.id == bomb.id ? { ...b, announced: true } : b)));
        await postBombCard(actor, bomb, 'E20.BombTriggered');
      }
    }
  }
}

/**
 * Wire the Detonate buttons on a rendered chat card.
 * @param {ChatMessage} message
 * @param {HTMLElement} html
 */
export function decorateBombCard(message, html) {
  const button = html?.querySelector?.('.e20-detonate-bomb');
  if (!button) {
    return;
  }

  button.addEventListener('click', async () => {
    const actor = await fromUuid(button.dataset.actorUuid);
    if (actor && await detonateBomb(actor, button.dataset.bombId)) {
      button.disabled = true;
    }
  });
}
