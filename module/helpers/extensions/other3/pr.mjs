/**
 * Power Rangers - Follow Me! (PR CRB), and Through the Shattered Grid's Better Together, Dr. K's
 * Modified Morpher, Guardian Blast, Mega Defender, the rest of Metallic Armor Power Up!, the Solarix
 * Shard and the Void Touched Origin's Essence trade.
 */
import {
  registerAfterDamage, registerApplyDialog, registerChatButton, registerDerived, registerDialogToggles,
  registerHitRider, registerPostRoll, registerRollSources, registerSceneAdvanced, registerTurnStart, registerUse,
} from "../../extensions.mjs";
import { getSceneEpoch, getUses, markUsed } from "../../scene-clock.mjs";
import {
  O3, T, escape, findItem, has, isItem, itemsOf, myActor, num, rollSkillTotal, sameSide, say, stampLive,
  targetedActors, tokenOf, untilEndOfNextTurn, worldActors, writeActor,
} from "./shared.mjs";

const isActiveGm = () => !!game.user?.isGM && (!game.users?.activeGM || game.users.activeGM.id == game.user.id);

/* -------------------------------------------- */
/*  Follow Me!                                   */
/* -------------------------------------------- */

/*
 * Follow Me! (PR CRB, Red Ranger, 2nd level, p.52): "At the beginning of any combat, instead of
 * rolling their own Initiative, your teammates may always choose to instead set their Initiative as
 * 1d4 lower than yours (minimum final result of 1). They must choose to follow this Role Perk BEFORE
 * you roll your Initiative result, but each team member who chooses to do this emboldens you and
 * adds +1 to your result."
 *
 * The leader's Use button posts a card; each teammate clicks Follow on it (stamping their own
 * combatant) before the leader rolls. When the leader's Initiative lands, the active GM adds +1 per
 * follower and sets each follower to the leader's final result minus 1d4 (minimum 1).
 */
const FOLLOW_FLAG = 'o3Follow';

registerUse({
  id: 'o3FollowMe',
  matches: item => isItem(item, O3.followMe),
  canUse: item => !!game.combat?.getCombatantsByActor?.(item.parent)?.length,
  run: async (item) => {
    const actor = item.parent;
    const combatant = game.combat?.getCombatantsByActor?.(actor)?.[0];
    if (!combatant) {
      return null;
    }

    if (combatant.initiative != null) {
      ui.notifications.warn(T('O3FollowMeAlreadyRolled'));
      return null;
    }

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<p>${T('O3FollowMeCall', { name: escape(actor.name) })}</p>`
        + `<button type="button" data-e20-ext="o3FollowMe" data-combat="${game.combat.id}" data-leader="${combatant.id}">${T('O3FollowMeFollow')}</button>`,
    });
    return null;
  },
});

registerChatButton('o3FollowMe', async (message, button) => {
  const combat = game.combats?.get?.(button.dataset.combat) ?? game.combat;
  const leader = combat?.combatants?.get?.(button.dataset.leader);
  const actor = myActor();
  const mine = actor ? combat?.getCombatantsByActor?.(actor)?.[0] : null;
  if (!leader || !mine || mine.id == leader.id || !mine.isOwner) {
    ui.notifications.warn(T('O3FollowMeNoCombatant'));
    return;
  }

  if (leader.initiative != null || mine.initiative != null) {
    ui.notifications.warn(T('O3FollowMeTooLate'));
    return;
  }

  await mine.setFlag('essence20', FOLLOW_FLAG, leader.id);
  await say(actor, T('O3FollowMeFollowing', { name: escape(actor.name), leader: escape(leader.name) }));
});

/** The leader's final Initiative and each follower's, given the leader's roll and the d4s. */
export function followMeResults(leaderRoll, d4s) {
  const final = leaderRoll + d4s.length;
  return { leader: final, followers: d4s.map(d => Math.max(1, final - d)) };
}

Hooks.on?.('updateCombatant', async (combatant, changes) => {
  if (!isActiveGm() || changes?.initiative == null || combatant.flags?.essence20?.o3FollowApplied) {
    return;
  }

  const combat = combatant.parent;
  const followers = (combat?.combatants?.contents ?? [...(combat?.combatants ?? [])])
    .filter(c => c.flags?.essence20?.[FOLLOW_FLAG] == combatant.id && c.initiative == null);
  if (!followers.length || !has(combatant.actor, O3.followMe)) {
    return;
  }

  const d4s = [];
  for (let i = 0; i < followers.length; i++) {
    const roll = await new Roll('1d4').evaluate();
    d4s.push(roll.total);
  }

  const result = followMeResults(num(changes.initiative), d4s);
  await combatant.update({ initiative: result.leader, 'flags.essence20.o3FollowApplied': true });
  for (const [index, follower] of followers.entries()) {
    await follower.update({ initiative: result.followers[index] });
  }

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: combatant.actor }),
    content: T('O3FollowMeResolved', {
      name: escape(combatant.name), total: result.leader,
      list: followers.map((f, i) => `${escape(f.name)} ${result.followers[i]}`).join(', '),
    }),
  });
});

/* -------------------------------------------- */
/*  Better Together                              */
/* -------------------------------------------- */

/*
 * Better Together (Through the Shattered Grid, Influence, p.18): "You synchronize with a chosen ally
 * when you take this Influence. Whenever you or your chosen ally Lend Assistance to one another for
 * any Skill Test, you both gain ↑1 and an Edge until the end of your next turn." Hang-Up: "In any
 * situation where you and your chosen ally are not in a scene together, you suffer ↓1 on any Skill
 * Test until you are reunited."
 *
 * The ally is chosen with the Perk's Use button. The assist is seen as it's banked (the ally's
 * pendingLendAssistance flag written by helpers/lend-assistance.mjs, on the assister's client); the
 * assister stamps the pair on their own actor, which both of them read.
 */
const PARTNER_FLAG = 'o3Partner';
const SYNC_FLAG = 'o3BetterTogether';
const BT_HANGUP = 'Compendium.essence20.through_the_shattered_grid.Item.7WzxxG6T7kF6daMY';

export function partnerOf(actor) {
  return findItem(actor, O3.betterTogether)?.flags?.essence20?.[PARTNER_FLAG] ?? null;
}

export function isPair(a, b) {
  return !!a && !!b && ((has(a, O3.betterTogether) && partnerOf(a) == b.uuid) || (has(b, O3.betterTogether) && partnerOf(b) == a.uuid));
}

export function betterTogetherActive(actor) {
  const live = record => !!record && record.epoch == getSceneEpoch() && stampLive(record.until);
  const own = actor?.flags?.essence20?.[SYNC_FLAG];
  if (live(own)) {
    return true;
  }

  return worldActors().some(other => {
    const record = other.flags?.essence20?.[SYNC_FLAG];
    return record?.with == actor?.uuid && live(record);
  });
}

registerUse({
  id: 'o3BetterTogether',
  matches: item => isItem(item, O3.betterTogether),
  run: async (item) => {
    const actor = item.parent;
    const { chooseSelect } = await import("../../grants.mjs");
    const options = worldActors().filter(a => a.type == 'playerCharacter' && a.uuid != actor.uuid)
      .map(a => ({ value: a.uuid, label: a.name }));
    const uuid = await chooseSelect(item.name, T('O3BetterTogetherPick'), options);
    if (!uuid) {
      return null;
    }

    await item.setFlag('essence20', PARTNER_FLAG, uuid);
    return T('O3BetterTogetherChosen', { name: escape(actor.name), ally: escape(options.find(o => o.value == uuid)?.label) });
  },
});

Hooks.on?.('updateActor', async (ally, changes, options, userId) => {
  if (userId != game.user?.id) {
    return;
  }

  const flags = changes?.flags?.essence20 ?? {};
  const shift = flags.pendingLendAssistanceShift;
  const edge = flags.pendingLendAssistanceEdge;
  if (!shift && !edge) {
    return;
  }

  const assister = shift?.assisterUuid ? await fromUuid(shift.assisterUuid) : myActor();
  if (!assister || assister.uuid == ally.uuid || !assister.isOwner || !isPair(assister, ally)) {
    return;
  }

  await assister.setFlag('essence20', SYNC_FLAG, { with: ally.uuid, epoch: getSceneEpoch(), until: untilEndOfNextTurn(assister) });
  await say(assister, T('O3BetterTogetherLine', { name: escape(assister.name), ally: escape(ally.name) }));
});

function onSceneTogether(actor, partnerUuid) {
  const scene = canvas?.scene;
  if (!scene || !tokenOf(actor)) {
    return true;
  }

  const partner = worldActors().find(a => a.uuid == partnerUuid);
  return !partner || !!tokenOf(partner);
}

registerRollSources((actor) => {
  const sources = [];
  if (betterTogetherActive(actor)) {
    sources.push({ id: 'o3BetterTogether', label: 'Better Together', shiftUp: 1, edge: true });
  }

  const partner = partnerOf(actor);
  if (partner && has(actor, BT_HANGUP) && !onSceneTogether(actor, partner)) {
    sources.push({ id: 'o3BetterTogetherApart', label: 'Better Together (Hang-Up)', shiftDown: 1 });
  }

  return { sources };
});

/* -------------------------------------------- */
/*  Dr. K's Modified Morpher                     */
/* -------------------------------------------- */

/*
 * Dr. K's Modified Morpher (Through the Shattered Grid, p.25): "Attacks that would make you lose
 * Personal Power or make you unable to spend it suffer ↓2 when targeting you." No attack in the
 * packs is flagged as draining Power, so the attacker declares it: the dialog offers the ↓2 on any
 * attack against a holder.
 */
registerDialogToggles((actor, ctx) => (ctx?.item?.type == 'weaponEffect' || ctx?.item?.type == 'power' || ctx?.item?.type == 'spell'
  ? (targetedActors().some(target => has(target, O3.drKMorpher))
    ? [{ name: 'o3DrK', label: T('O3DrKToggle'), type: 'checkbox', value: false }] : [])
  : []));

registerApplyDialog((actor, options) => {
  if (options.ext?.o3DrK) {
    options.shiftDown = num(options.shiftDown) + 2;
  }
});

/* -------------------------------------------- */
/*  Guardian Blast                               */
/* -------------------------------------------- */

/*
 * Guardian Blast (Through the Shattered Grid, Eltarian Guardian, p.73): "You and your allies can
 * make a combined Attack. As a team, with you leading the effort, everyone must spend their full
 * action to move into the same area (within 5 feet of at least 2 other allies) and launch an Attack
 * fueled by Grid energy. You and each ally make a Group Targeting Skill Test. If you hit, the blast
 * deals 5 Energy damage."
 *
 * A Group Skill Test (half or more succeed) against the targeted enemy's Evasion. Each participant
 * rolls from the card on their own client and records the result on their own actor; Resolve tallies.
 */
const GUARDIAN_FLAG = 'o3GuardianBlast';

export function guardianTally(records, count) {
  const successes = records.filter(r => r?.success).length;
  return { successes, rolled: records.filter(Boolean).length, success: count > 0 && successes * 2 >= count };
}

function guardianCard(test) {
  const rows = test.participants.map(uuid => {
    const actor = worldActors().find(a => a.uuid == uuid);
    const record = actor?.flags?.essence20?.[GUARDIAN_FLAG];
    const state = record?.id == test.id ? (record.success ? T('O3Hit') : T('O3Miss')) : '';
    return `<li>${escape(actor?.name ?? uuid)} ${state}<button type="button" data-e20-ext="o3GuardianRoll" data-actor="${uuid}">${T('O3Roll')}</button></li>`;
  }).join('');
  return `<p>${T('O3GuardianBlastCard', { target: escape(test.targetName), dif: test.dif })}</p><ul>${rows}</ul>`
    + `<button type="button" data-e20-ext="o3GuardianResolve">${T('O3Resolve')}</button>`;
}

registerUse({
  id: 'o3GuardianBlast',
  matches: item => isItem(item, O3.guardianBlast),
  run: async (item, economy, pay) => {
    const actor = item.parent;
    const target = targetedActors()[0];
    if (!target) {
      ui.notifications.warn(T('O3NeedTarget'));
      return null;
    }

    const allies = worldActors().filter(a => a.uuid != actor.uuid && tokenOf(a) && sameSide(a, actor) && a.type != 'vehicle');
    const chosen = await foundry.applications.api.DialogV2.wait({
      window: { title: item.name },
      classes: ["window-app", "e20-window"],
      content: `<p>${T('O3GuardianBlastWho')}</p>${allies.map(a => `<label class="flexrow"><input type="checkbox" name="who" value="${a.uuid}" checked /> ${escape(a.name)}</label>`).join('')}`,
      buttons: [
        { action: 'ok', label: game.i18n.localize('E20.DialogConfirmButton'), default: true,
          callback: (event, button) => [...button.form.querySelectorAll('input[name="who"]:checked')].map(i => i.value) },
        { action: 'cancel', label: game.i18n.localize('E20.DialogCancelButton') },
      ],
      rejectClose: false,
    });
    if (!Array.isArray(chosen) || !(await pay('standard'))) {
      return null;
    }

    const test = {
      id: foundry.utils.randomID(), target: target.uuid, targetName: target.name,
      dif: num(target.system?.defenses?.evasion?.total), participants: [actor.uuid, ...chosen],
    };
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: guardianCard(test), flags: { essence20: { [GUARDIAN_FLAG]: test } } });
    return null;
  },
});

registerChatButton('o3GuardianRoll', async (message, button) => {
  const test = message?.flags?.essence20?.[GUARDIAN_FLAG];
  const actor = await fromUuid(button.dataset.actor);
  if (!test || !actor?.isOwner) {
    ui.notifications.warn(T('O3NotYours'));
    return;
  }

  if (actor.flags?.essence20?.[GUARDIAN_FLAG]?.id == test.id) {
    return;
  }

  if (game.combat && actor.uuid != test.participants[0]) {
    const { spend } = await import("../../action-economy.mjs");
    if ((await spend(actor, 'standard', { source: 'Guardian Blast' }))?.blocked) {
      return;
    }
  }

  const roll = await rollSkillTotal(actor, 'targeting', { dif: test.dif });
  if (roll) {
    await actor.setFlag('essence20', GUARDIAN_FLAG, { id: test.id, success: roll.success });
    if (message.isOwner) {
      await message.update({ content: guardianCard(test) });
    }
  }
});

registerChatButton('o3GuardianResolve', async (message) => {
  const test = message?.flags?.essence20?.[GUARDIAN_FLAG];
  if (!test || test.resolved) {
    return;
  }

  const records = test.participants.map(uuid => {
    const record = worldActors().find(a => a.uuid == uuid)?.flags?.essence20?.[GUARDIAN_FLAG];
    return record?.id == test.id ? record : null;
  });
  const tally = guardianTally(records, test.participants.length);
  const target = await fromUuid(test.target);
  if (!tally.success || !target) {
    await ChatMessage.create({ content: T('O3GuardianBlastMissed', { hits: tally.successes, count: test.participants.length }) });
    return;
  }

  if (target.isOwner) {
    const { applyDamage } = await import("../../combat.mjs");
    await applyDamage(target, 5, 'energy');
    await ChatMessage.create({ content: T('O3GuardianBlastHit', { target: escape(target.name) }) });
  } else {
    await ChatMessage.create({ content: `${T('O3GuardianBlastHit', { target: escape(target.name) })}<button type="button" data-e20-ext="o3GuardianDamage" data-target="${target.uuid}">${T('O3ApplyDamage')}</button>` });
  }

  if (message.isOwner) {
    await message.setFlag('essence20', GUARDIAN_FLAG, { ...test, resolved: true });
  }
});

registerChatButton('o3GuardianDamage', async (message, button) => {
  const target = await fromUuid(button.dataset.target);
  if (!target?.isOwner || button.dataset.done) {
    ui.notifications.warn(T('O3NotYours'));
    return;
  }

  button.dataset.done = '1';
  const { applyDamage } = await import("../../combat.mjs");
  await applyDamage(target, 5, 'energy');
});

/* -------------------------------------------- */
/*  Mega Defender                                */
/* -------------------------------------------- */

/*
 * Mega Defender (Through the Shattered Grid, Magna Defender, p.24): "by expending 3 Personal Power
 * as a Standard action, you can have [the Torozord] channel and infuse you with Morphin Grid energy,
 * changing you into a Zord-like form known as the Mega Defender. ... You use the Strength and Speed
 * Essence Scores, Health, Defense bonuses, and type of movement of the Mega Defender form. ... you
 * remain in Mega Defender form until the scene's end or the form's Health falls to 0. When reduced
 * to 0 Health, you automatically return to your Morphed form with the same Health and Conditions you
 * had before." Stat block (p.38): Health 8, 40ft Ground, Strength 8, Speed 4, Toughness 18,
 * Evasion 14. Might/Targeting stay the Ranger's own ranks, which is how the actor already rolls.
 *
 * "Once the Torozord has answered your call and arrived at the conflict" - the form needs the
 * Ranger's Torozord (a Zord on their sheet) on the scene, and remembers which one. "While in this form,
 * you and the Torozord share actions. This means only one of you can Move and only one can take a
 * Standard action each turn. You may divide your Free actions as you see fit, using the highest
 * number of Free actions between you." They keep separate turns, so what one spends is pre-spent on
 * the partner's turn if it is still to come this round, and the one with fewer Free actions is topped
 * up to the other's at the start of their turn.
 */
const MEGA_FLAG = 'o3MegaDefender';
export const MEGA_FORM = { health: 8, strength: 8, speed: 4, toughness: 18, evasion: 14, ground: 40 };

export function megaDefenderActive(actor) {
  const record = actor?.flags?.essence20?.[MEGA_FLAG];
  return !!record && record.epoch == getSceneEpoch();
}

/** The Ranger's Torozord: a Zord on their sheet that has a token on the current scene. */
export function presentTorozord(actor) {
  const zords = Object.values(actor?.system?.actors ?? {})
    .map(entry => globalThis.fromUuidSync?.(entry?.uuid))
    .filter(zord => zord?.type == 'zord');
  const scene = globalThis.canvas?.scene ?? globalThis.game?.scenes?.current;
  const onScene = zords.filter(zord => scene?.tokens?.some?.(token => token.actorId == zord.id || token.actor?.id == zord.id));
  return onScene.find(zord => /toro/i.test(zord.name ?? '')) ?? onScene[0] ?? null;
}

/** The other half of an active Mega Defender pair, from either side. */
export function megaDefenderPartner(actor) {
  if (megaDefenderActive(actor)) {
    const uuid = actor.flags.essence20[MEGA_FLAG].torozordUuid;
    return uuid ? globalThis.fromUuidSync?.(uuid) ?? null : null;
  }

  if (actor?.type != 'zord') {
    return null;
  }

  return worldActors().find(ranger => megaDefenderActive(ranger) && ranger.flags.essence20[MEGA_FLAG].torozordUuid == actor.uuid) ?? null;
}

/** Whether this actor's turn is still to come in the current round. */
export function turnStillToCome(actor, combat = globalThis.game?.combat) {
  if (!combat?.turns?.length) {
    return false;
  }

  const index = combat.turns.findIndex(combatant => combatant.actor?.id == actor?.id);
  return index > (combat.turn ?? 0);
}

/** One partner spent actions: pre-spend them on the other's turn, if that is still to come. */
export async function shareMegaDefenderSpend(actor, cost = {}) {
  const partner = megaDefenderPartner(actor);
  const shared = Object.fromEntries(Object.entries(cost).filter(([category, amount]) => ['move', 'standard', 'free'].includes(category) && amount > 0));
  if (!partner || !Object.keys(shared).length || !turnStillToCome(partner)) {
    return false;
  }

  const economy = await import("../../action-economy.mjs");
  return economy.setNextTurn(partner, { prespend: shared }, T('O3MegaDefenderShared', { name: actor.name }));
}

/** The Free actions the pair has: the higher of the two. */
export function sharedFreeTopUp(actor, partner) {
  const own = num(actor?.system?.actions?.free?.max);
  const theirs = num(partner?.system?.actions?.free?.max);
  return Math.max(0, theirs - own);
}

registerTurnStart(async (actor) => {
  const partner = megaDefenderPartner(actor);
  const topUp = partner ? sharedFreeTopUp(actor, partner) : 0;
  if (topUp > 0) {
    const economy = await import("../../action-economy.mjs");
    await economy.grantActionsThisTurn(actor, { free: topUp }, T('O3MegaDefenderFree'));
  }
});

if (globalThis.Hooks?.on) {
  Hooks.on('essence20.actionSpent', (actor, actionType, cost) => {
    shareMegaDefenderSpend(actor, cost).catch(error => console.warn('essence20 | Mega Defender share failed', error));
  });
}

export function applyMegaDefender(actor) {
  if (!megaDefenderActive(actor)) {
    return;
  }

  const system = actor.system;
  for (const essence of ['strength', 'speed']) {
    const score = system.essences?.[essence];
    if (score) {
      if (score.max != null) {
        score.max = MEGA_FORM[essence];
      }

      score.value = MEGA_FORM[essence];
    }
  }

  if (system.health) {
    system.health.max = MEGA_FORM.health;
  }

  for (const defense of ['toughness', 'evasion']) {
    if (system.defenses?.[defense]) {
      system.defenses[defense].total = MEGA_FORM[defense];
      system.defenses[defense].string = `${MEGA_FORM[defense]} (Mega Defender)`;
    }
  }

  for (const [type, move] of Object.entries(system.movement ?? {})) {
    if (move && typeof move == 'object' && 'total' in move) {
      move.total = type == 'ground' ? MEGA_FORM.ground : 0;
    }
  }
}

registerDerived(applyMegaDefender);

async function endMegaDefender(actor) {
  const record = actor?.flags?.essence20?.[MEGA_FLAG];
  if (!record) {
    return;
  }

  await actor.unsetFlag('essence20', MEGA_FLAG);
  await actor.update({ 'system.health.value': num(record.prevHealth) });
  await say(actor, T('O3MegaDefenderEnds', { name: escape(actor.name) }));
}

registerUse({
  id: 'o3MegaDefender',
  matches: item => isItem(item, O3.megaDefender),
  run: async (item, economy, pay) => {
    const actor = item.parent;
    if (megaDefenderActive(actor)) {
      await endMegaDefender(actor);
      return null;
    }

    const power = num(actor.system?.powers?.personal?.value);
    if (power < 3) {
      ui.notifications.warn(T('O3NoPower', { name: escape(actor.name) }));
      return null;
    }

    const torozord = presentTorozord(actor);
    if (!torozord) {
      ui.notifications.warn(T('O3MegaDefenderNoTorozord', { name: escape(actor.name) }));
      return null;
    }

    if (!(await pay('standard'))) {
      return null;
    }

    await actor.update({
      'system.powers.personal.value': power - 3,
      'system.health.value': MEGA_FORM.health,
      [`flags.essence20.${MEGA_FLAG}`]: { epoch: getSceneEpoch(), prevHealth: num(actor.system?.health?.value), torozordUuid: torozord.uuid },
    });
    return T('O3MegaDefenderLine', { name: escape(actor.name) });
  },
});

registerAfterDamage(async (actor, dealt, damageType, { newValue } = {}) => {
  if (megaDefenderActive(actor) && num(newValue) <= 0 && actor.isOwner) {
    await endMegaDefender(actor);
  }
});

registerSceneAdvanced(async () => {
  for (const actor of worldActors()) {
    if (actor.flags?.essence20?.[MEGA_FLAG] && !megaDefenderActive(actor)) {
      await endMegaDefender(actor);
    }
  }
});

/* -------------------------------------------- */
/*  Metallic Armor Power Up!                     */
/* -------------------------------------------- */

/*
 * Metallic Armor Power Up! (Through the Shattered Grid, p.26) - the +3 temporary Health and upkeep
 * are helpers/metallic-armor.mjs. The rest: "You reduce the damage dealt to you by minion and foot
 * soldier enemies by 1 to a minimum of 0." and "It lasts until you choose to end it, you cannot pay
 * the Personal Power to continue using it, you suffer a Critical Success on an Attack by a non-minion
 * Threat, or you are Defeated." A minion is an NPC tagged minion / foot soldier / mook / grunt
 * (helpers/creature-tags.mjs), or a Putty or Tenga.
 */
const METALLIC_FLAG = 'metallicArmorActive';
const MINION_TAGS = ['minion', 'minions', 'foot soldier', 'footsoldier', 'foot-soldier', 'mook', 'grunt'];

export async function isMinion(actor) {
  if (!actor || actor.type == 'playerCharacter') {
    return false;
  }

  const tags = await import("../../creature-tags.mjs");
  const list = tags.creatureTagsOf(actor);
  return MINION_TAGS.some(tag => list.has(tag)) || !!tags.isPuttyOrTenga?.(actor);
}

async function endMetallicArmor(actor) {
  if (!actor?.flags?.essence20?.[METALLIC_FLAG]) {
    return;
  }

  await writeActor(actor, 'update', [{
    [`flags.essence20.${METALLIC_FLAG}`]: false,
    'system.health.bonus': Math.max(0, num(actor.system?.health?.bonus) - 3),
  }]);
  await say(actor, T('O3MetallicArmorEnds', { name: escape(actor.name) }));
}

registerHitRider(async (attacker, target, result, rider, tools) => {
  if (target?.flags?.essence20?.[METALLIC_FLAG] && num(result?.damageValue) > 0 && await isMinion(attacker)) {
    tools.damageBonusNote(result, -1, 'Metallic Armor');
  }
});

registerPostRoll(async (attacker, results, checkContext, { isCrit, hits } = {}) => {
  if (!isCrit || !checkContext?.isAttack || await isMinion(attacker)) {
    return;
  }

  for (const { target, hit } of hits ?? []) {
    if (hit && target?.flags?.essence20?.[METALLIC_FLAG]) {
      await endMetallicArmor(target);
    }
  }
});

registerAfterDamage(async (actor, dealt, damageType, { newValue } = {}) => {
  if (num(newValue) <= 0 && actor?.flags?.essence20?.[METALLIC_FLAG] && actor.isOwner) {
    await endMetallicArmor(actor);
  }
});

// The Power's one Use button: switches it on (its activation - power-handler.mjs#powerCost ->
// helpers/metallic-armor.mjs) or, while it's on, ends it.
registerUse({
  id: 'o3MetallicArmorEnd',
  matches: item => isItem(item, O3.metallicArmor),
  canUse: item => !!item.parent?.flags?.essence20?.[METALLIC_FLAG] || !!item.system?.canActivate,
  run: async (item) => {
    if (item.parent?.flags?.essence20?.[METALLIC_FLAG]) {
      await endMetallicArmor(item.parent);
      return null;
    }

    const { powerCost } = await import("../../../sheet-handlers/power-handler.mjs");
    await powerCost(item.parent, item);
    return null;
  },
});

/* -------------------------------------------- */
/*  Solarix Shard                                */
/* -------------------------------------------- */

/*
 * Solarix Shard (Through the Shattered Grid, gear, p.76): "When applied to a Power Weapon, that weapon
 * does 1 additional Fire damage. Once per scene, if a Perk or Power costs Personal Power to activate,
 * that cost is reduced by 1." The Use button applies it to a Power Weapon; the extra Fire damage is
 * an extra damage button on each hit; the discount refunds 1 of the first Personal Power spend each
 * scene (a spend being any decrease not marked as a loss or refund - resource/power-spend.mjs's rule).
 */
const SOLARIX_WEAPON = 'o3SolarixWeapon';
const SOLARIX_KEY = 'o3SolarixScene';

export function solarixWeaponId(actor) {
  return itemsOf(actor).find(item => isItem(item, O3.solarixShard))?.flags?.essence20?.[SOLARIX_WEAPON] ?? null;
}

registerUse({
  id: 'o3Solarix',
  matches: item => isItem(item, O3.solarixShard),
  run: async (item) => {
    const actor = item.parent;
    const weapons = itemsOf(actor).filter(i => i.type == 'weapon' && (i.system?.traits ?? []).includes('powerWeapon'));
    const { chooseSelect } = await import("../../grants.mjs");
    const id = await chooseSelect(item.name, T('O3SolarixPick'), weapons.map(w => ({ value: w.id, label: w.name })));
    if (!id) {
      return null;
    }

    await item.setFlag('essence20', SOLARIX_WEAPON, id);
    return T('O3SolarixApplied', { weapon: escape(weapons.find(w => w.id == id)?.name) });
  },
});

registerHitRider(async (attacker, target, result, rider, tools) => {
  const id = solarixWeaponId(attacker);
  if (id && rider?.weaponId == id) {
    tools.addRiderOption(result, { key: 'o3Solarix', label: 'Solarix Shard', damageValue: 1, damageType: 'fire' });
  }
});

const POWER_PATH = 'system.powers.personal.value';
const powerChange = changes => (changes && Object.prototype.hasOwnProperty.call(changes, POWER_PATH) ? changes[POWER_PATH] : foundry.utils?.getProperty?.(changes, POWER_PATH));

Hooks.on?.('preUpdateActor', (actor, changes, options) => {
  const next = powerChange(changes);
  if (next !== undefined) {
    options.o3PrevPower = num(actor.system?.powers?.personal?.value);
  }
});

Hooks.on?.('updateActor', async (actor, changes, options, userId) => {
  if (userId != game.user?.id || options?.o3PrevPower === undefined || options.essence20Loss || options.essence20Refund) {
    return;
  }

  const next = num(powerChange(changes));
  if (options.o3PrevPower - next <= 0 || !has(actor, O3.solarixShard) || getUses(actor, SOLARIX_KEY, 'scene') >= 1) {
    return;
  }

  await markUsed(actor, SOLARIX_KEY, { window: 'scene' });
  await actor.update({ 'system.powers.personal.value': next + 1 }, { essence20Refund: true });
  await say(actor, T('O3SolarixRefund', { name: escape(actor.name) }));
});

/* -------------------------------------------- */
/*  Void Touched                                 */
/* -------------------------------------------- */

/*
 * Void Touched (Through the Shattered Grid, Origin, p.21): "You may decrease your Strength or Social
 * by 1 and increase your Smarts or Speed by 2." The ordinary Origin drop already raised the chosen
 * Essence by 1; this adds the second point and takes the one away, asked once when the Origin lands
 * (or from its Use button), and undone if the Origin is deleted.
 */
const VOID_FLAG = 'o3VoidTouched';

export function voidTouchedUpdate(actor, down, up, sign = 1) {
  const essences = actor.system?.essences ?? {};
  return {
    [`system.essences.${down}.max`]: num(essences[down]?.max) - sign,
    [`system.essences.${up}.max`]: num(essences[up]?.max) + sign,
  };
}

async function applyVoidTouched(origin) {
  const actor = origin?.parent;
  if (!actor || origin.flags?.essence20?.[VOID_FLAG]) {
    return null;
  }

  const { chooseSelect } = await import("../../grants.mjs");
  const label = e => game.i18n.localize(CONFIG.E20.originEssences?.[e] ?? e);
  const down = await chooseSelect(origin.name, T('O3VoidTouchedDown'), ['strength', 'social'].map(e => ({ value: e, label: label(e) })));
  if (!down) {
    return null;
  }

  const up = await chooseSelect(origin.name, T('O3VoidTouchedUp'), ['smarts', 'speed'].map(e => ({ value: e, label: label(e) })));
  if (!up) {
    return null;
  }

  await actor.update(voidTouchedUpdate(actor, down, up));
  await origin.setFlag('essence20', VOID_FLAG, { down, up });
  return T('O3VoidTouchedLine', { name: escape(actor.name), down: label(down), up: label(up) });
}

registerUse({
  id: 'o3VoidTouched',
  matches: item => isItem(item, O3.voidTouched),
  canUse: item => !item.flags?.essence20?.[VOID_FLAG],
  run: item => applyVoidTouched(item),
});

Hooks.on?.('createItem', (item, options, userId) => {
  if (userId == game.user?.id && item?.parent?.documentName == 'Actor' && isItem(item, O3.voidTouched)) {
    // After the Origin drop's own Essence/Skill update has landed.
    setTimeout(() => applyVoidTouched(item).then(line => line && say(item.parent, line)), 1500);
  }
});

Hooks.on?.('deleteItem', async (item, options, userId) => {
  const swap = item?.flags?.essence20?.[VOID_FLAG];
  if (userId == game.user?.id && swap && item.parent?.documentName == 'Actor') {
    await item.parent.update(voidTouchedUpdate(item.parent, swap.down, swap.up, -1));
  }
});
