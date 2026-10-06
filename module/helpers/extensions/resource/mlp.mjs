/**
 * My Little Pony: Stress, spell mastery and a jar of jam.
 *
 * Stress (MLP CRB p.160, "Stress, Essence Loss and Consequences"): "When a character suffers stress,
 * one of two things can happen. They can suffer a point of Health damage, or they can suffer damage
 * to their Essence Scores." So healing Stress heals either; suffering it takes either - the pony
 * (or the GM) picks which.
 */
import {
  registerSceneAdvanced, registerTurnEnd, registerUse,
} from "../../extensions.mjs";
import {
  IDS, T, isActiveGm, isItem, itemsOf, num, worldActors, writeActor,
} from "./common.mjs";

/* -------------------------------------------- */
/*  Stress                                       */
/* -------------------------------------------- */

export function essenceDamage(actor) {
  let total = 0;
  for (const essence of Object.values(actor?.system?.essences ?? {})) {
    total += Math.max(0, num(essence?.max) - num(essence?.value));
  }

  return total;
}

export function healthDamage(actor) {
  return Math.max(0, num(actor?.system?.health?.max) - num(actor?.system?.health?.value));
}

/**
 * Heal Stress: Health or Essence damage.
 * @param {Actor} actor
 * @param {Number} amount
 * @param {'health'|'essence'} kind
 * @returns {Promise<Number>}   How much was healed.
 */
export async function healStress(actor, amount, kind) {
  if (kind == 'health') {
    const healed = Math.min(amount, healthDamage(actor));
    if (healed > 0) {
      await writeActor(actor, { 'system.health.value': num(actor.system.health.value) + healed });
    }

    return healed;
  }

  const { healEssenceDamage } = await import("../../essence-damage.mjs");
  return healEssenceDamage(actor, amount);
}

// (Honest Compassion, the Spirit of Honesty's 3rd-level Perk, is its own Use rule: a rest-limited heal
// of 1 Health or 1 Essence on the target or the pony, asked before the Standard action is paid.)

// (Musical Interlude, the Knights of Canterlot Bard Hang-Up, is its own rules: a turnStart Trigger
// once per combat posting a "suffer 1 Stress" button.)

// (Camper is its own rules too: the camp Use with a per-member heal, and the ↑1 for the team while it stands.)

/* -------------------------------------------- */
/*  Zap Apple Jam                                */
/* -------------------------------------------- */

// Zap Apple Jam (In a Jam, Magic Object, p.32) is its item's own rules: the cups / pastries Use, the Edge, and
// a missionStart Trigger for its shelf life (marked stale at the first mission advance, gone at the second).

/* -------------------------------------------- */
/*  Circle of Magical Friends                    */
/* -------------------------------------------- */

// Circle of Magical Friends (MLP CRB, Spirit of Magic, 7th level, p.94): "when you participate in a
// Circle of Friends, you and all your friends become Magical. If anypony in the circle Mastered a
// spell, everypony in the circle treats the spell like they've mastered it." Use while the Circle
// (helpers/friendship-circle.mjs) is live: each member gets a copy of every spell another member
// has Mastered; the copies go when the Circle ends.
const CIRCLE_SPELL_FLAG = 'resCircleSpell';

/** Spells (by source uuid, falling back to name) held by some members and not others. */
export function spellsToShare(members) {
  const key = item => item.flags?.core?.sourceId ?? item._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource ?? `name:${item.name}`;
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
  const { getCircle } = await import("../../friendship-circle.mjs");
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
