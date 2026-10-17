/**
 * Circle of Magical Friends: a live Circle of Friends shares every Mastered spell among its members.
 */
import {
  registerSceneAdvanced, registerTurnEnd, registerUse,
} from "../../mechanics/item-hooks.mjs";
import { IDS } from "../shared/resource-team-lookups.mjs";
import { T } from "../shared/item-lang.mjs";
import { isActiveGm } from "../shared/hooks-and-clients.mjs";
import { isItem, itemsOf, sourceOf } from "../shared/item-lookups.mjs";
import { worldActors } from "../../mechanics/companions/companion-link.mjs";

// Circle of Magical Friends (MLP CRB, Spirit of Magic, 7th level, p.94): in a Circle, every member
// counts as Magical and shares every spell any member has Mastered. Use while the Circle
// (items/social/friendship-circle.mjs) is live: each member gets a copy of every spell another member
// has Mastered; the copies go when the Circle ends.
const CIRCLE_SPELL_FLAG = 'resCircleSpell';

/** Spells (by source uuid, falling back to name) held by some members and not others. */
export function spellsToShare(members) {
  const key = item => sourceOf(item) ?? `name:${item.name}`;
  const all = new Map();
  for (const member of members) {
    for (const spell of itemsOf(member).filter(i => i.type == 'spell' && !i.flags?.essence20?.[CIRCLE_SPELL_FLAG])) {
      if (!all.has(key(spell))) {
        all.set(key(spell), spell);
      }
    }
  }

  return members.map(member => {
    const own = new Set(itemsOf(member).filter(i => i.type == 'spell').map(key));
    return { member, spells: [...all.entries()].filter(([k]) => !own.has(k)).map(([, spell]) => spell) };
  });
}

async function liveCircleMembers() {
  const { getCircle } = await import("../social/friendship-circle.mjs");
  const circle = getCircle();
  return circle ? circle.members.map(uuid => fromUuidSync(uuid)).filter(Boolean) : null;
}

registerUse({
  id: 'resCircleOfMagicalFriends',
  matches: item => isItem(item, IDS.circleOfMagicalFriends),
  run: async (item) => {
    const actor = item.parent;
    const members = await liveCircleMembers();
    if (!members?.some(m => m.uuid == actor.uuid)) {
      ui.notifications.warn(T('ResCircleNotIn'));
      return null;
    }

    let shared = 0;
    for (const { member, spells } of spellsToShare(members)) {
      if (!spells.length) {
        continue;
      }

      if (!member.isOwner) {
        ui.notifications.warn(T('ResCircleNotOwner', { name: member.name }));
        continue;
      }

      await member.createEmbeddedDocuments('Item', spells.map(spell => {
        const data = spell.toObject();
        delete data._id;
        foundry.utils.setProperty(data, `flags.essence20.${CIRCLE_SPELL_FLAG}`, true);
        return data;
      }));
      shared += spells.length;
    }

    return T('ResCircleLine', { name: actor.name, count: shared });
  },
});

async function sweepCircleSpells() {
  const members = await liveCircleMembers();
  const live = new Set((members ?? []).map(m => m.uuid));
  for (const actor of worldActors()) {
    if (live.has(actor.uuid)) {
      continue;
    }

    const ids = itemsOf(actor).filter(i => i.flags?.essence20?.[CIRCLE_SPELL_FLAG]).map(i => i.id);
    if (ids.length) {
      await actor.deleteEmbeddedDocuments('Item', ids);
    }
  }
}

registerTurnEnd(async () => {
  if (isActiveGm()) {
    await sweepCircleSpells();
  }
});

registerSceneAdvanced(async () => {
  if (isActiveGm()) {
    await sweepCircleSpells();
  }
});

// (Extensive Research, the Spirit of Magic's 13th-level Perk, is its own Use rule: a pickGrant of a spell the
// Spellcasting die reaches by tier, lasting a week of game time, replacing the one it researched before.)
