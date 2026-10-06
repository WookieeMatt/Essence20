import { registerUse } from "../../mechanics/item-hooks.mjs";
import { G2 } from "../shared/gij-crb-item-lookups.mjs";
import { TFull as T } from "../shared/item-lang.mjs";
import { sourceOf } from "../shared/item-lookups.mjs";

/**
 * Martial Artist (GI JOE CRB, Influence, p.50): "Given the opportunity to observe another martial artist for one
 * minute, you can learn information about their capabilities compared to your own. The GM tells you if the
 * creature is your equal, superior, or inferior in Threat Level as well as Toughness and Evasion defense." Read
 * off the targeted token and whispered to the player and the GM.
 *
 * (Mentor, Expert Knowledge and Energy Resistant - their picks and what they give - are item rules now:
 * rules/conv5-slC5.test.js and rules/conv4-slC4.test.js. Fearsome Presence (Renegade, 14th level, p.97) is a Use
 * rule on its Perk: the first three hits within 20 ft are Frightened until the Renegade's next turn starts.)
 */

const levelOf = actor => Number(actor?.system?.threatLevel || actor?.system?.level) || 0;
const compare = (theirs, mine) => (theirs > mine ? 'Superior' : (theirs < mine ? 'Inferior' : 'Equal'));

export async function martialArtistCompare(actor, target) {
  const { getDefenseValue } = await import("../../mechanics/combat/combat.mjs");
  const word = key => T(`E20.Gij2Compare${key}`);
  return T('E20.Gij2MartialArtistResult', {
    target: target.name,
    level: word(compare(levelOf(target), levelOf(actor))),
    toughness: word(compare(getDefenseValue(target, 'toughness'), getDefenseValue(actor, 'toughness'))),
    evasion: word(compare(getDefenseValue(target, 'evasion'), getDefenseValue(actor, 'evasion'))),
  });
}

registerUse({
  id: 'gij2MartialArtist',
  matches: item => sourceOf(item) == G2.martialArtist && !!item.parent,
  run: async (item) => {
    const actor = item.parent;
    const target = game.user?.targets?.first?.()?.actor;
    if (!target || target == actor) {
      ui.notifications.warn(T('E20.Gij2NeedsTarget', { perk: item.name }));
      return null;
    }

    const content = await martialArtistCompare(actor, target);
    const gms = (game.users?.filter?.(u => u.isGM) ?? []).map(u => u.id);
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content, whisper: [...new Set([game.user.id, ...gms])] });
    return null;
  },
});
