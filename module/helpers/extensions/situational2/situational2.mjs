import {
  registerChatButton, registerConsumer, registerDerived, registerRollSources, registerRoundStart, registerUse,
} from "../../extensions.mjs";
import {
  S2, FLAG, deps, T, findById, has, sameSide, itemsOf,
} from "./common.mjs";
import { situationalInitiative, takeInASceneButton, misplacedConfidenceRound } from "./initiative.mjs";

/**
 * Situational items (Item Review "situational" group, slice 2) - rules that only apply in a place
 * (a town, the wild, the sea, a library, complete darkness), against someone (a StrexCorp agent, a
 * creature that attacked you, an ally who out-rolled you), or at the start of a fight (Surprise).
 *
 * Where the scene can answer (the GM-set terrain/environment - helpers/environment.mjs - the scene's
 * darkness level, a target's name or creature tags), the rule applies by itself as a labelled roll
 * source. Where it can't, the Roll Options Dialog offers a checkbox instead, so a table that never
 * tags its scenes still gets the rule.
 *
 * Initiative-time rules (Take in a Scene, Misplaced Confidence) live in initiative.mjs.
 *
 * Item rules now (rules/conv5-slC5.test.js): Seafarer's swimming Edge, the Seafarer Hang-Up's poison
 * Edge against its holder, Tritium Sights, Feet Wet (and Ship Shape's Feet Wet half), Shark's Fin's
 * Movement, and Amphibious Assault's / Tracking Outfit's Initiative halves. Ship Shape's vehicle
 * Movement too (rules/conv6-slC6.test.js). Caltrops and Bookworm's Initiative half too (rules/conv7-slC7.test.js).
 * Forgiving, and Plow's Rough Terrain after a Ram, too (rules/conv8-slC8.test.js). The Seafarer Hang-Up's Snag on
 * resisting poison, the exposure clothes (Arctic / Desert Expedition Clothes, Desert Gear) and Business too
 * (rules/conv10-slC10.test.js).
 */

/* -------------------------------------------- */
/*  Small helpers                               */
/* -------------------------------------------- */

async function writeFlag(doc, key, value) {
  const { needsGmRelay, relayToGm } = await import("../../gm-relay.mjs");
  if (needsGmRelay(doc)) {
    return relayToGm(doc, value === null ? 'unsetFlag' : 'setFlag', value === null ? ['essence20', key] : ['essence20', key, value]);
  }

  return value === null ? doc.unsetFlag('essence20', key) : doc.setFlag('essence20', key, value);
}

// A Defense / DerivedStat / Movement rule whose condition reads where the token stands (a terrain, an
// environment, or one of the position checks above) - prepared with the actor, so it needs the same
// refresh on a Region change (the exposure clothes' Defense rules among them).
const POSITION_TAG = /\b(?:terrain|environment):|\bcheck:(?:inWater|onLand|seaOrWetlands|aboardAquaticVessel|completeDarkness)\b/;
const PREPARED_RULES = ['Defense', 'DerivedStat', 'Movement'];

export function hasPositionRules(actor) {
  return itemsOf(actor).some(item => (Array.isArray(item?.system?.rules) ? item.system.rules : [])
    .some(rule => PREPARED_RULES.includes(rule?.type) && POSITION_TAG.test(JSON.stringify(rule.when ?? []))));
}

/* -------------------------------------------- */
/*  Roll sources                                */
/* -------------------------------------------- */

/**
 * @returns {{sources: Array, consumes: Array}}
 */
export function situational2RollSources(actor) {
  const sources = [];
  const consumes = [];
  const add =(id, itemId, fallback, effect, type = null) => {
    sources.push({ id: `s2-${id}`, label: findById(actor, itemId, type)?.name ?? fallback, ...effect });
  };

  // Forgiving is item rules (rules/conv8-slC8.test.js).

  // Competitive (MLP CRB, Hang-Up, p.60): "When you and an ally roll the same Skill Test, if your ally
  // gets a higher result than you, you have Snag on your next Skill Test this scene." Banked by the
  // chat-message watcher below, spent here.
  const pending = actor?.flags?.essence20?.[FLAG.competitive];
  if (pending && has(actor, S2.competitive, 'hangUp') && pending.epoch == deps.getSceneEpoch()) {
    add('competitive', S2.competitive, 'Competitive', { snag: true }, 'hangUp');
    consumes.push({ ext: 's2Competitive', actorUuid: actor.uuid });
  }

  return { sources, consumes };
}

/* -------------------------------------------- */
/*  Defenses and derived data                   */
/* -------------------------------------------- */

export function situational2Derived(actor) {
  const system = actor?.system;
  if (!system) {
    return;
  }

  // Ship Shape's Movement x1.5 for the aquatic vehicle its holder drives is an item rule
  // (rules/conv6-slC6.test.js).

  // Cartography Suite's Move actions while Surprised are SurpriseExemption rules on the Perk (self and a 60 ft ally
  // aura), Plow's Multiple Targets a MultipleTargets rule and Lay of the Land's Rough Terrain a MovementAction rule
  // (rules/conv10-slE10.test.js).
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

/* -------------------------------------------- */
/*  Uses and chat buttons                       */
/* -------------------------------------------- */

// (Cartography Suite's survey is a Use rule on the Perk - rules/conv10-slE10.test.js.)
export const USES = [];

/* -------------------------------------------- */
/*  Hook-array registrations (patched in)       */
/* -------------------------------------------- */

/**
 * Loads the heavier helpers and joins the patched-in hook arrays: rough-terrain.mjs
 * ROUGH_TERRAIN_IGNORERS (situational1's patch), multiple-targets.mjs MULTIPLE_TARGETS_GRANTS and
 * dice.mjs INITIATIVE_EXTENSIONS (SCRATCH/integration/situational2-patch.cjs). Absent arrays are
 * skipped, so nothing breaks before the patches run.
 */
export async function loadDeps() {
  const environment = await import("../../environment.mjs");
  deps.getTerrain = actor => environment.getTerrain(actor);
  deps.getEnvironment = actor => environment.getEnvironment(actor, { includeInterior: false });
  const clock = await import("../../scene-clock.mjs");
  deps.getSceneEpoch = clock.getSceneEpoch;
  const allies = await import("../../allies.mjs");
  deps.nearbyAllies = allies.getNearbyAllyTokens;

  const dice = await import("../../../dice.mjs");
  dice.INITIATIVE_EXTENSIONS?.push(situationalInitiative);
}

registerRollSources(situational2RollSources);
registerDerived(situational2Derived);
registerRoundStart(misplacedConfidenceRound);
USES.forEach(registerUse);

registerConsumer('s2Competitive', async (consume) => {
  const actor = await fromUuid(consume.actorUuid);
  if (actor) {
    await writeFlag(actor, FLAG.competitive, null);
  }
});

registerChatButton('s2TakeInScene', takeInASceneButton);

if (typeof Hooks != 'undefined') {
  Hooks.once?.('init', () => {
    loadDeps().catch(error => console.error('Essence20 | situational2 setup failed', error));
  });
  // Terrain/environment-dependent derived data (item rules that read where the token stands - the
  // exposure clothes among them) catches up as soon as the token walks into or out of a Region - same trigger as
  // environment.mjs's own refresh.
  Hooks.on?.('updateToken', (tokenDoc, changes) => {
    const actor = tokenDoc?.actor;
    if (changes && '_regions' in changes
      && hasPositionRules(actor)) {
      actor.reset?.();
      if (actor.sheet?.rendered) {
        actor.sheet.render();
      }
    }
  });
  Hooks.on?.('createChatMessage', message => {
    watchCompetitive(message).catch(error => console.error('Essence20 | Competitive failed', error));
  });
}
