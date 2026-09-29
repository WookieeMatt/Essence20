/**
 * My Little Pony: Stress, spell mastery and a jar of jam.
 *
 * Stress (MLP CRB p.160, "Stress, Essence Loss and Consequences"): "When a character suffers stress,
 * one of two things can happen. They can suffer a point of Health damage, or they can suffer damage
 * to their Essence Scores." So healing Stress heals either; suffering it takes either - the pony
 * (or the GM) picks which.
 */
import {
  registerChatButton, registerConsumer, registerMissionAdvanced, registerRest, registerRollSources,
  registerSceneAdvanced, registerTurnEnd, registerTurnStart, registerUse,
} from "../../extensions.mjs";
import { activateForWindow, isActiveForWindow } from "../../scene-clock.mjs";
import {
  IDS, T, onHook, has, isActiveGm, isItem, itemsOf, num, say, targetedActor, teamOf, worldActors, writeActor,
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

/** Which kind of Stress to heal: ask only when both are damaged. */
async function pickStressKind(title, actor, amounts = { health: 1, essence: 1 }) {
  const health = healthDamage(actor) > 0;
  const essence = essenceDamage(actor) > 0;
  if (!health && !essence) {
    return null;
  }

  if (health != essence) {
    return health ? 'health' : 'essence';
  }

  const { chooseButtons } = await import("../../grants.mjs");
  return chooseButtons(title, T('ResStressPrompt', { name: actor.name }), [
    ['health', T('ResStressHealth', { count: amounts.health })],
    ['essence', T('ResStressEssence', { count: amounts.essence })],
  ]);
}

/* -------------------------------------------- */
/*  Honest Compassion                            */
/* -------------------------------------------- */

// Honest Compassion (MLP CRB, Spirit of Honesty, 3rd level, p.78): "once per day, as a Standard
// action, you can heal 1 Stress without needing to make a Skill Test. At 11th level, you can use
// Honest Compassion three times per day." A Rest is the new day.
const DAILY_FLAG = 'resDailyUses';

export function dailyUses(actor, key) {
  return num(actor?.flags?.essence20?.[DAILY_FLAG]?.[key]);
}

export function honestCompassionMax(level) {
  return num(level) >= 11 ? 3 : 1;
}

async function markDaily(actor, key) {
  const used = actor.flags?.essence20?.[DAILY_FLAG] ?? {};
  await actor.setFlag('essence20', DAILY_FLAG, { ...used, [key]: num(used[key]) + 1 });
}

registerRest(async (actor) => {
  if (actor?.flags?.essence20?.[DAILY_FLAG]) {
    await actor.unsetFlag('essence20', DAILY_FLAG);
  }
});

registerUse({
  id: 'resHonestCompassion',
  matches: item => isItem(item, IDS.honestCompassion),
  canUse: item => dailyUses(item.parent, 'honestCompassion') < honestCompassionMax(item.parent?.system?.level),
  run: async (item, economy, pay) => {
    const actor = item.parent;
    const friend = targetedActor() ?? actor;
    const kind = await pickStressKind(item.name, friend);
    if (!kind) {
      ui.notifications.warn(T('ResStressNone', { name: friend.name }));
      return null;
    }

    if (!(await pay('standard'))) {
      return null;
    }

    await healStress(friend, 1, kind);
    await markDaily(actor, 'honestCompassion');
    return T('ResHonestCompassionLine', { name: actor.name, friend: friend.name, kind: T(kind == 'health' ? 'ResStressHealth' : 'ResStressEssence', { count: 1 }) });
  },
});

/* -------------------------------------------- */
/*  Musical Interlude (Hang-Up)                  */
/* -------------------------------------------- */

// Musical Interlude (Knights of Canterlot, Bard Hang-Up, p.15): "When a conflict of any form begins,
// if you don't use your first action to sing a song, you suffer 1 Stress." Asked on the pony's first
// turn of each combat; the GM (or player) answers on the card.
const INTERLUDE_COMBAT_FLAG = 'musicalInterludeAsked';

registerTurnStart(async (actor, combat) => {
  if (!has(actor, IDS.musicalInterlude) || !combat) {
    return;
  }

  const asked = combat.getFlag?.('essence20', INTERLUDE_COMBAT_FLAG) ?? {};
  if (asked[actor.id]) {
    return;
  }

  await combat.setFlag?.('essence20', INTERLUDE_COMBAT_FLAG, { ...asked, [actor.id]: true });
  const button = (kind, label) => `<button type="button" data-e20-ext="resMusicalInterlude" data-uuid="${actor.uuid}" data-kind="${kind}">${label}</button>`;
  await say(actor, `<p>${T('ResMusicalInterludePrompt', { name: actor.name })}</p>${button('sang', T('ResMusicalInterludeSang'))}${
    button('health', T('ResStressHealth', { count: 1 }))}${button('essence', T('ResStressEssence', { count: 1 }))}`);
});

registerChatButton('resMusicalInterlude', async (message, button) => {
  const actor = fromUuidSync(button.dataset.uuid);
  const kind = button.dataset.kind;
  if (!actor || kind == 'sang') {
    return;
  }

  if (kind == 'health') {
    await writeActor(actor, { 'system.health.value': Math.max(0, num(actor.system.health.value) - 1) });
  } else {
    const { chooseSelect } = await import("../../grants.mjs");
    const essence = await chooseSelect(T('ResMusicalInterlude'), T('ResStressWhichEssence'), Object.keys(actor.system.essences ?? {})
      .map(e => ({ value: e, label: game.i18n.localize(CONFIG.E20?.originEssences?.[e] ?? e) })));
    if (!essence) {
      return;
    }

    await writeActor(actor, { [`system.essences.${essence}.value`]: Math.max(0, num(actor.system.essences[essence].value) - 1) });
  }

  await say(actor, T('ResMusicalInterludeStress', { name: actor.name }));
});

/* -------------------------------------------- */
/*  Camper                                       */
/* -------------------------------------------- */

// Camper (Knights of Canterlot, General Perk, p.13): "As long as you have at least half your Health
// remaining ... anypony who attempts a Skill Test while camping (such as telling stories or keeping
// watch) gains ↑1. As soon as the camp is set up, its welcoming feel automatically restores 1 Health
// or 2 Stress to all characters resting there." (The Survival Edge is in dice.mjs.)
const CAMP_FLAG = 'resCampActive';

export function camperFit(actor) {
  return num(actor?.system?.health?.value) >= num(actor?.system?.health?.max) / 2;
}

function campFor(actor) {
  return worldActors().find(camper => has(camper, IDS.camper) && camperFit(camper)
    && isActiveForWindow(camper, CAMP_FLAG, 'scene')
    && teamOf(camper).some(member => member.uuid == actor?.uuid)) ?? null;
}

registerRollSources((actor) => {
  const camper = campFor(actor);
  return camper ? { sources: [{ id: 'camper', label: T('ResCamperSource', { name: camper.name }), shiftUp: 1 }] } : {};
});

registerUse({
  id: 'resCamper',
  matches: item => isItem(item, IDS.camper),
  canUse: item => camperFit(item.parent),
  run: async (item) => {
    const actor = item.parent;
    await activateForWindow(actor, CAMP_FLAG, 'scene');
    const lines = [];
    for (const member of teamOf(actor)) {
      const kind = await pickStressKind(item.name, member, { health: 1, essence: 2 });
      if (!kind) {
        continue;
      }

      const healed = await healStress(member, kind == 'health' ? 1 : 2, kind);
      if (healed) {
        lines.push(T('ResCamperHeal', { name: member.name, kind: T(kind == 'health' ? 'ResStressHealth' : 'ResStressEssence', { count: healed }) }));
      }
    }

    return [T('ResCamperLine', { name: actor.name }), ...lines].join('<br>');
  },
});

/* -------------------------------------------- */
/*  Zap Apple Jam                                */
/* -------------------------------------------- */

// Zap Apple Jam (In a Jam, Magic Object, p.32): "A jar of Zap Apple jam contains three cups of jam.
// ... By eating this jam, you heal all damage to your Essence Scores and gain Edge on Skill Tests
// for 1 Scene. By using this jam as an ingredient in a recipe ... You gain 6 Zap Apple jam
// pastries. Eating a Zap Apple jam pastry heals 1 point of damage to an Essence Score and grants
// Edge on Skill Tests for 1 turn. ... It can be bartered to automatically pass a Wealth Test,
// regardless of the difficulty. ... If the Zap Apple jam isn't used before the end of the following
// adventure or session of play, it disappears in a flash."
const JAM_EDGE_FLAG = 'zapJamEdgeScene';
const PASTRY_FLAG = 'zapPastryEdge';

export function cupsLeft(item) {
  const stored = item?.flags?.essence20?.zapCups;
  return stored === undefined ? 3 * Math.max(0, num(item?.system?.quantity ?? 1)) : num(stored);
}

export function pastriesLeft(item) {
  return num(item?.flags?.essence20?.zapPastries);
}

function pastryActive(actor) {
  const stamp = actor?.flags?.essence20?.[PASTRY_FLAG];
  if (!stamp) {
    return false;
  }

  const combat = game.combat;
  if (!stamp.combatId) {
    return true;
  }

  return !!combat && combat.id == stamp.combatId && combat.round == stamp.round && combat.turn == stamp.turn;
}

registerRollSources((actor) => {
  if (isActiveForWindow(actor, JAM_EDGE_FLAG, 'scene')) {
    return { sources: [{ id: 'zapJam', label: T('ResZapJamSource'), edge: true }] };
  }

  if (pastryActive(actor)) {
    const stamp = actor.flags.essence20[PASTRY_FLAG];
    return {
      sources: [{ id: 'zapPastry', label: T('ResZapPastrySource'), edge: true }],
      // Out of combat "1 turn" is the next Skill Test.
      consumes: stamp.combatId ? [] : [{ ext: 'resZapPastry', actorUuid: actor.uuid }],
    };
  }

  return {};
});

registerConsumer('resZapPastry', async (consume) => {
  const actor = fromUuidSync(consume.actorUuid);
  if (actor?.flags?.essence20?.[PASTRY_FLAG]) {
    await actor.unsetFlag('essence20', PASTRY_FLAG);
  }
});

async function useJam(item) {
  const actor = item.parent;
  const { chooseButtons } = await import("../../grants.mjs");
  const cups = cupsLeft(item);
  const pastries = pastriesLeft(item);
  const choices = [];
  if (cups > 0) {
    choices.push(['eat', T('ResZapJamEat')], ['bake', T('ResZapJamBake')], ['barter', T('ResZapJamBarter')]);
  }

  if (pastries > 0) {
    choices.push(['pastry', T('ResZapJamPastry')]);
  }

  if (!choices.length) {
    ui.notifications.warn(T('ResZapJamEmpty'));
    return null;
  }

  const pick = await chooseButtons(item.name, T('ResZapJamPrompt', { cups, pastries }), choices);
  if (!pick) {
    return null;
  }

  const { healEssenceDamage } = await import("../../essence-damage.mjs");
  if (pick == 'eat') {
    await item.setFlag('essence20', 'zapCups', cups - 1);
    await healEssenceDamage(actor, essenceDamage(actor));
    await activateForWindow(actor, JAM_EDGE_FLAG, 'scene');
    return T('ResZapJamEatLine', { name: actor.name });
  }

  if (pick == 'bake') {
    await item.update({ 'flags.essence20.zapCups': cups - 1, 'flags.essence20.zapPastries': pastries + 6 });
    return T('ResZapJamBakeLine', { name: actor.name });
  }

  if (pick == 'barter') {
    await item.setFlag('essence20', 'zapCups', cups - 1);
    return T('ResZapJamBarterLine', { name: actor.name });
  }

  await item.setFlag('essence20', 'zapPastries', pastries - 1);
  await healEssenceDamage(actor, 1);
  const combat = game.combat;
  await actor.setFlag('essence20', PASTRY_FLAG, combat ? { combatId: combat.id, round: combat.round, turn: combat.turn } : { combatId: null });
  return T('ResZapJamPastryLine', { name: actor.name });
}

registerUse({
  id: 'resZapAppleJam',
  matches: item => isItem(item, IDS.zapAppleJam),
  run: useJam,
});

// Shelf life: kept through the next adventure, then gone.
registerMissionAdvanced(async () => {
  if (!isActiveGm()) {
    return;
  }

  for (const actor of worldActors()) {
    for (const item of itemsOf(actor).filter(i => isItem(i, IDS.zapAppleJam))) {
      if (item.flags?.essence20?.zapStale) {
        await item.delete();
        await say(actor, T('ResZapJamSpoiled', { name: actor.name }));
      } else {
        await item.setFlag('essence20', 'zapStale', true);
      }
    }
  }
});

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
  const key = item => item.flags?.core?.sourceId ?? item._stats?.compendiumSource ?? `name:${item.name}`;
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

/* -------------------------------------------- */
/*  Extensive Research                           */
/* -------------------------------------------- */

// Researching a spell (MLP CRB p.131): "Researching an Elementary spell takes 6 hours and at least d4
// in Spellcasting. Researching a Superior spell takes 12 hours and at least d8 in Spellcasting.
// Researching a Virtuoso spell takes 24 hours and d12 in Spellcasting ... After successfully
// researching a spell, you Master the spell for 24 hours."
// Extensive Research (MLP CRB, Spirit of Magic, 13th level, p.95): "when you Research a Spell, you
// master it for a week instead of a day. You can only master one spell at a time through extensive
// research."
const RESEARCH_FLAG = 'resResearchedUntil';
const TIER_SHIFT = { elementary: 'd4', superior: 'd8', virtuoso: 'd12' };
const SHIFT_ORDER = ['d20', 'd2', 'd4', 'd6', 'd8', 'd10', 'd12', '2d8', '3d6', 'autoSuccess', 'criticalSuccess'];

export function canResearch(shift, tier) {
  return SHIFT_ORDER.indexOf(shift) >= SHIFT_ORDER.indexOf(TIER_SHIFT[tier] ?? 'd4');
}

registerUse({
  id: 'resExtensiveResearch',
  matches: item => isItem(item, IDS.extensiveResearch),
  run: async (item) => {
    const actor = item.parent;
    const { findItems, grantCopy, pickOne } = await import("../../grants.mjs");
    const shift = actor.system?.skills?.spellcasting?.shift ?? 'd20';
    const rows = await findItems({ type: 'spell', fields: ['system.tier'], matches: entry => canResearch(shift, entry.system?.tier ?? 'elementary') });
    const uuid = await pickOne(item.name, rows);
    if (!uuid) {
      return null;
    }

    const previous = itemsOf(actor).filter(i => i.flags?.essence20?.[RESEARCH_FLAG]).map(i => i.id);
    if (previous.length) {
      await actor.deleteEmbeddedDocuments('Item', previous);
    }

    const until = num(game.time?.worldTime) + 7 * 24 * 60 * 60;
    const created = await grantCopy(actor, uuid, { grantedBy: item, flags: { [RESEARCH_FLAG]: until } });
    return created ? T('ResResearchLine', { name: actor.name, spell: created.name }) : null;
  },
});

onHook('updateWorldTime', async (worldTime) => {
  if (!isActiveGm()) {
    return;
  }

  for (const actor of worldActors()) {
    const ids = itemsOf(actor).filter(i => num(i.flags?.essence20?.[RESEARCH_FLAG]) && num(i.flags.essence20[RESEARCH_FLAG]) <= worldTime).map(i => i.id);
    if (ids.length) {
      await actor.deleteEmbeddedDocuments('Item', ids);
    }
  }
});
