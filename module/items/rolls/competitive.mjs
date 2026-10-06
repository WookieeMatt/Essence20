import { registerConsumer, registerRollSources } from "../../mechanics/item-hooks.mjs";
import { deps, findById, FLAG, has, S2, sameSide } from "../shared/situation-checks.mjs";
import { T } from "../shared/item-lang.mjs";
import { setFlagRelayed, unsetFlagRelayed } from "../shared/relayed-writes.mjs";

/**
 * Competitive (MLP CRB, Hang-Up, p.60): "When you and an ally roll the same Skill Test, if your ally
 * gets a higher result than you, you have Snag on your next Skill Test this scene." Banked by the
 * chat-message watcher below, spent by the roll source. (Forgiving is item rules - rules/conv8-slC8.test.js.)
 */

/** An essence20 flag on someone, through the GM when needed; null unsets it. */
const writeFlag = (doc, key, value) => (value === null ? unsetFlagRelayed(doc, key) : setFlagRelayed(doc, key, value));

/**
 * @returns {{sources: Array, consumes: Array}}
 */
export function competitiveRollSources(actor) {
  const sources = [];
  const consumes = [];
  const add =(id, itemId, fallback, effect, type = null) => {
    sources.push({ id: `s2-${id}`, label: findById(actor, itemId, type)?.name ?? fallback, ...effect });
  };

  const pending = actor?.flags?.essence20?.[FLAG.competitive];
  if (pending && has(actor, S2.competitive, 'hangUp') && pending.epoch == deps.getSceneEpoch()) {
    add('competitive', S2.competitive, 'Competitive', { snag: true }, 'hangUp');
    consumes.push({ ext: 's2Competitive', actorUuid: actor.uuid });
  }

  return { sources, consumes };
}

/* -------------------------------------------- */
/*  Competitive                                 */
/* -------------------------------------------- */

const RECENT_WINDOW_MS = 5 * 60 * 1000;
const recentRolls = [];

/** For tests. */
export function resetRecentRolls() {
  recentRolls.length = 0;
}

async function markCompetitive(actor) {
  await writeFlag(actor, FLAG.competitive, { epoch: deps.getSceneEpoch() });
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker?.({ actor }),
    content: T('S2CompetitiveChat', { name: actor.name }),
  });
}

/**
 * Every Skill Test card (flags.essence20.skill + the roll's total), on the active GM: compares it to
 * the other same-side rolls of that Skill in the last few minutes of this scene.
 * @param {ChatMessage} message
 */
export async function watchCompetitive(message, now = Date.now()) {
  if (!game.user?.isActiveGM) {
    return;
  }

  const skill = message?.flags?.essence20?.skill;
  const total = message?.rolls?.[0]?.total;
  const actor = message?.speakerActor ?? (message?.speaker?.actor ? game.actors?.get?.(message.speaker.actor) : null);
  if (!skill || typeof total != 'number' || !actor) {
    return;
  }

  const epoch = deps.getSceneEpoch();
  for (let i = recentRolls.length - 1; i >= 0; i--) {
    if (now - recentRolls[i].time > RECENT_WINDOW_MS || recentRolls[i].epoch != epoch) {
      recentRolls.splice(i, 1);
    }
  }

  const marked = new Set();
  for (const roll of recentRolls) {
    if (roll.skill != skill || roll.actor == actor || !sameSide(actor, roll.actor)) {
      continue;
    }

    if (roll.total > total && has(actor, S2.competitive, 'hangUp') && !marked.has(actor)) {
      marked.add(actor);
      await markCompetitive(actor);
    }

    if (total > roll.total && has(roll.actor, S2.competitive, 'hangUp') && !marked.has(roll.actor)) {
      marked.add(roll.actor);
      await markCompetitive(roll.actor);
    }
  }

  recentRolls.push({ actor, skill, total, time: now, epoch });
}

registerRollSources(competitiveRollSources);

registerConsumer('s2Competitive', async (consume) => {
  const actor = await fromUuid(consume.actorUuid);
  if (actor) {
    await writeFlag(actor, FLAG.competitive, null);
  }
});

if (typeof Hooks != 'undefined') {
  Hooks.on?.('createChatMessage', message => {
    watchCompetitive(message).catch(error => console.error('Essence20 | Competitive failed', error));
  });
}
