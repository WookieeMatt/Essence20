import { findSourced, has } from "../shared/item-lookups.mjs";
import { T } from "../shared/item-lang.mjs";

/**
 * Touch Move (GI Joe CRB, Grandmaster, 6th level, p.87): "when you roll Initiative, all of your
 * teammates who aren't surprised can immediately make a Move Action." Nothing in the action economy
 * can hand out an action before the first turn, so the active GM posts who may move, the moment the
 * holder's Initiative lands.
 */

const U = (pack, id) => `Compendium.essence20.${pack}.Item.${id}`;
export const TOUCH_MOVE_ID = U('gi_joe_crb', 'wv5vpbiCZXiwTpdm');

const escape = text => foundry.utils.escapeHTML(String(text ?? ''));

function listOf(collection) {
  if (Array.isArray(collection?.contents)) {
    return collection.contents;
  }

  if (Array.isArray(collection)) {
    return collection;
  }

  return collection && typeof collection[Symbol.iterator] == 'function' ? [...collection] : [];
}

const touchMovePosted = new Set();
export async function onTouchMoveInitiative(combatant, changes) {
  if (!game.users?.activeGM?.isSelf || changes?.initiative == null || !has(combatant?.actor, TOUCH_MOVE_ID)) {
    return;
  }

  const key = `${combatant.parent?.id}.${combatant.id}`;
  if (touchMovePosted.has(key)) {
    return;
  }

  touchMovePosted.add(key);
  const holder = combatant.actor;
  const disposition = combatant.token?.disposition;
  const allies = listOf(combatant.parent?.combatants).map(other => other.actor)
    .filter(other => other && other.id != holder.id && !other.statuses?.has?.('surprised'))
    .filter(other => {
      const token = listOf(combatant.parent?.combatants).find(c => c.actor?.id == other.id)?.token;
      return disposition != null && token?.disposition != null ? token.disposition == disposition : other.type == 'playerCharacter';
    });
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: holder }),
    content: T('Gij3TouchMoveChat', {
      name: escape(holder.name),
      perk: escape(findSourced(holder, TOUCH_MOVE_ID).name),
      allies: escape(allies.map(a => a.name).join(', ') || T('Gij3Nobody')),
    }),
  });
}

if (typeof Hooks != 'undefined') {
  Hooks.on('updateCombatant', (combatant, changes) => {
    onTouchMoveInitiative(combatant, changes).catch(error => console.error('Essence20 | Touch Move', error));
  });
}
