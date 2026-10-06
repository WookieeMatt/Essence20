import { registerChatButton, registerChatDecorator } from "../item-hooks.mjs";
import { hasSourced, worldActors } from "../companions/companion-link.mjs";
import { findSourced, itemsOf, sourceOf } from "../../items/shared/item-lookups.mjs";

/**
 * The reaction engine - "react to an attack in flight" and "react to someone else's roll".
 *
 * Essence 20 has no reactions (a Contingency stands in for them), but a good many Perks let a
 * character answer an attack or another character's roll after the dice land: Desperate Parry,
 * Shoot Out, Sidestep, Defender, Soldier On, Not Perfect But Better... This file is the shared
 * plumbing they all use, built only on the extension registry and Foundry hooks:
 *
 * - Every posted check card (dice.mjs stamps `checkResults` onto its flags) is read by cardInfo().
 * - Reactions registered with registerReaction() get a button on that card - on the row of the
 *   target they concern, or once for the whole card - drawn only for users who own the reacting
 *   actor. Using one is remembered on the REACTOR (an actor its user can always write), not on the
 *   message, which the reacting player usually doesn't own.
 * - negateHit() turns a hit into "no effect" by marking that target's Apply Damage buttons as
 *   already applied - chat.mjs#attachCheckCardListeners disables every key in damageAppliedKeys.
 *   A player can't write the attacker's message, so the change rides on a chat message the active
 *   GM's client carries out (gmDo, below).
 * - damageButton() posts a GM-only "Apply N damage" button (a counter-attack's damage), matching
 *   the rest of the system, where damage to another actor is always a GM click.
 * - lastApplyContext() remembers which attack card the GM just clicked Apply Damage on, so an
 *   afterDamage hook knows who dealt the blow (Energon Manipulator, Revengeful, Monster Morph).
 */

export const SCOPE = 'essence20';
const REACTIONS = [];

/* -------------------------------------------- */
/*  Small readers                                */
/* -------------------------------------------- */

// sourceOf / itemsOf / findSourced are items/shared/item-lookups.mjs's, re-exported for the callers
// that import them from here.
export { findSourced, itemsOf, sourceOf };

/** Whether the actor holds an item sourced from uuid (any type). Guards an undefined uuid. */
export function holds(actor, uuid) {
  return !!uuid && !!actor && hasSourced(actor, uuid);
}

/**
 * An armor Upgrade the actor is actually wearing: its parent armor is equipped, or (a Transformer's
 * integrated upgrade) it has no parent at all - the same reading target-riders.mjs#
 * armorUpgradeBonuses uses.
 */
export function wornUpgrade(actor, uuid) {
  const items = itemsOf(actor);
  const equipped = new Set(items.filter(item => item.type == 'armor' && item.system?.equipped).map(item => item.id));
  return items.find(item => item.type == 'upgrade' && sourceOf(item) == uuid
    && (equipped.has(item.flags?.essence20?.parentId) || !item.flags?.essence20?.parentId)) ?? null;
}

export function tokenOf(actor) {
  return actor?.getActiveTokens?.()?.[0] ?? null;
}

/** Distance in feet between two actors' tokens on the current scene, or Infinity. */
export function distanceBetween(a, b) {
  const ta = tokenOf(a);
  const tb = tokenOf(b);
  if (!ta || !tb || !canvas?.grid?.measurePath) {
    return Infinity;
  }

  return canvas.grid.measurePath([ta.center, tb.center]).distance;
}

/** Same side of the fight: token disposition when both are on the canvas, else PC vs non-PC. */
export function areAllies(a, b) {
  if (!a || !b || a === b) {
    return false;
  }

  const ta = tokenOf(a);
  const tb = tokenOf(b);
  if (ta && tb) {
    return ta.document?.disposition === tb.document?.disposition;
  }

  return (a.type == 'playerCharacter') == (b.type == 'playerCharacter');
}

export function defenseOf(actor, defense) {
  const d = actor?.system?.defenses?.[defense];
  return Number(d?.total ?? d?.value ?? d?.base ?? 0) || 0;
}

/** "The defender chooses the Defense" (GI Joe CRB p.195) - the better of the two they could pick. */
export function bestDefense(actor, defenses = ['toughness', 'evasion']) {
  return Math.max(...defenses.map(d => defenseOf(actor, d)));
}

/**
 * The one client that should act for an actor: its first active non-GM owner, else the active GM.
 * Every client sees every hook, so automatic reactions run only where this is true.
 */
export function isResponsible(actor) {
  if (!actor || !game.user) {
    return false;
  }

  const owners = (game.users?.contents ?? [...(game.users ?? [])])
    .filter(user => user.active && !user.isGM && actor.testUserPermission?.(user, 'OWNER'))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  if (owners.length) {
    return owners[0].id == game.user.id;
  }

  return game.user.id == game.users?.activeGM?.id;
}

export function canAct(actor) {
  return !!actor && (game.user?.isGM || !!actor.isOwner);
}

/** Owners of an actor (for whispers). */
export function ownerIds(actor) {
  return (game.users?.contents ?? [...(game.users ?? [])])
    .filter(user => user.isGM || actor?.testUserPermission?.(user, 'OWNER')).map(user => user.id);
}

export function speakerActor(message) {
  const fromSpeaker = globalThis.ChatMessage?.getSpeakerActor?.(message?.speaker);
  return fromSpeaker ?? (message?.speaker?.actor ? game.actors?.get?.(message.speaker.actor) : null) ?? null;
}

export function inCombat() {
  return !!game.combat;
}

/* -------------------------------------------- */
/*  The check card                               */
/* -------------------------------------------- */

/** Every Apply Damage/crit/rider button on the card, from its stored HTML. */
export function cardButtons(message) {
  const out = [];
  const re = /<button[^>]*data-action="apply-damage"[^>]*>/g;
  for (const tag of String(message?.content ?? '').match(re) ?? []) {
    const attr = name => tag.match(new RegExp(`data-${name}="([^"]*)"`))?.[1] ?? null;
    out.push({ key: attr('key'), targetUuid: attr('target-uuid'), damage: Number(attr('damage')) || 0, damageType: attr('damage-type') });
  }

  return out;
}

/**
 * What a check card says, read back off its flags (dice.mjs's fullRollContext) and HTML.
 * @param {ChatMessage} message
 * @returns {Object|null}
 */
export function cardInfo(message) {
  const flags = message?.flags?.[SCOPE];
  if (!flags || !Array.isArray(flags.checkResults) || !message.rolls?.length) {
    return null;
  }

  const roll = message.rolls[0];
  const buttons = cardButtons(message);
  const rows = flags.checkResults.map((row, index) => {
    const base = buttons.find(b => b.key == `${row.targetUuid}:base`);
    return {
      index,
      targetUuid: row.targetUuid ?? null,
      difficulty: Number(row.difficulty),
      success: !!row.success,
      damage: base?.damage ?? 0,
      damageType: base?.damageType ?? null,
      isCrit: buttons.some(b => b.targetUuid == row.targetUuid && String(b.key).includes(':crit:')),
    };
  });
  const rider = flags.riderContext ?? {};
  return {
    message,
    flags,
    attacker: speakerActor(message),
    total: Number(roll.total),
    roll,
    rows,
    skill: flags.skill ?? rider.skill ?? null,
    isAttack: !!flags.isAttack,
    isMelee: !!flags.isMelee || rider.style == 'melee',
    style: flags.attackStyle ?? rider.style ?? null,
    traits: flags.attackTraits ?? flags.weaponTraits ?? [],
    isArea: !!rider.isArea,
    damageType: rider.damageType ?? null,
    itemUuid: flags.itemUuid ?? rider.itemUuid ?? null,
    isFumble: !!flags.isFumble,
    rollFailed: flags.rollFailed === true,
    hadEdge: /kh/i.test(String(roll.formula ?? '')),
    defenseType: flags.defenseType ?? null,
  };
}

/** The kept d20 result of the card's roll (for a late Snag), or null. */
export function keptD20(roll) {
  const d20 = (roll?.dice ?? []).find(die => die.faces == 20);
  const kept = (d20?.results ?? []).filter(r => r.active !== false).map(r => r.result);
  return kept.length ? Math.max(...kept) : null;
}

/**
 * A Snag imposed after the dice landed: "roll an additional d20 as though they had a Snag" (TF CRB
 * p.66). Returns the new total (lower d20 kept) and the extra die rolled.
 */
export async function lateSnag(info) {
  const kept = keptD20(info.roll);
  const extra = await new Roll('1d20').evaluate();
  const die = extra.total;
  if (kept === null) {
    return { total: info.total, die, roll: extra };
  }

  return { total: info.total - Math.max(0, kept - die), die, roll: extra };
}

/** Roll an actor's Skill Die for a skill (Sidestep, Defender): null when untrained ('d20'). */
export async function rollSkillDie(actor, skill, flavor = '') {
  const shift = actor?.system?.skills?.[skill]?.shift;
  const match = /^(\d*)d(\d+)$/.exec(String(shift ?? ''));
  if (!match || shift == 'd20') {
    return null;
  }

  const roll = await new Roll(`${match[1] || 1}d${match[2]}`).evaluate();
  await roll.toMessage?.({ speaker: globalThis.ChatMessage?.getSpeaker?.({ actor }), flavor });
  return roll.total;
}

/* -------------------------------------------- */
/*  Rolling                                      */
/* -------------------------------------------- */

function clearTargets() {
  try {
    if (game.user?.targets?.size) {
      canvas?.tokens?.setTargets?.([]);
      game.user.updateTokenTargets?.([]);
    }
  } catch (error) {
    // targets are a convenience only
  }
}

/** Target an actor's token for the next roll (a counter-attack). */
export function targetActor(actor) {
  const token = tokenOf(actor);
  try {
    if (token) {
      canvas?.tokens?.setTargets?.([token.id]);
    }
  } catch (error) {
    // no canvas
  }
}

/**
 * A Skill Test against a flat DIF through the system's own roll (dialog, chat card and all).
 * Targets are cleared first - dice.mjs compares against targets before a flat DIF.
 * @returns {Promise<{success: Boolean, crit: Boolean}>}
 */
export async function rollVs(actor, skill, dif, extra = {}) {
  clearTargets();
  const essence = CONFIG.E20?.skillToEssence?.[skill] ?? 'strength';
  const result = await actor?._dice?.rollSkill?.({ skill, essence, shiftUp: 0, shiftDown: 0, dif: String(dif), ...extra }, actor);
  const first = result?.outcomes?.[0]?.results?.[0] ?? result?.results?.[0];
  return { success: !!(result?.success ?? first?.success), crit: !!first && first.multiplier >= 2, cancelled: !result || !!result.cancelled };
}

/**
 * One Skill Test against several creatures' Defense at once (Monster Form's "all creatures within
 * 10 feet"): targets them and rolls with that Defense.
 * `extra` - more dataset flags for the roll (a rules step's stepDamage, isTakedown...).
 * @returns {Promise<Array<{targetUuid, success, multiplier}>>}
 */
export async function rollVsMany(actor, skill, actors, defenseType, essenceOverride = null, extra = null) {
  const ids = actors.map(a => tokenOf(a)?.id).filter(Boolean);
  if (!ids.length) {
    return [];
  }

  canvas?.tokens?.setTargets?.(ids);
  const essence = essenceOverride ?? CONFIG.E20?.skillToEssence?.[skill] ?? 'strength';
  const result = await actor?._dice?.rollSkill?.({ ...(extra ?? {}), skill, essence, shiftUp: 0, shiftDown: 0, defenseType }, actor);
  clearTargets();
  const rows = result?.outcomes?.flatMap(outcome => outcome.results ?? []) ?? result?.results ?? [];
  return rows.map(row => ({ targetUuid: row.targetUuid, success: !!row.success, multiplier: Number(row.multiplier) || (row.success ? 1 : 0) }));
}

/* -------------------------------------------- */
/*  Chat output                                  */
/* -------------------------------------------- */

export function say(actor, content, extra = {}) {
  return globalThis.ChatMessage?.create?.({ speaker: globalThis.ChatMessage.getSpeaker?.({ actor }), content, ...extra });
}

export function esc(text) {
  return String(text ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/**
 * A GM-only "Apply N damage" button (counter-attacks, Legendary Cruelty, deflected projectiles).
 * @param {Actor} from   Who is dealing it (speaker).
 * @param {Actor} target
 * @param {Number} amount
 * @param {String} damageType
 * @param {String} text   The line above the button.
 */
export function damageButton(from, target, amount, damageType, text) {
  const typeLabel = game.i18n.localize(CONFIG.E20?.damageTypes?.[damageType] ?? damageType ?? '');
  const label = game.i18n.format('E20.ReactApplyDamage', { amount, type: typeLabel, name: target?.name ?? '' });
  return say(from, `<p>${text}</p><button type="button" data-e20-ext="reactDamage" data-target-uuid="${esc(target?.uuid)}"
    data-amount="${Number(amount) || 0}" data-type="${esc(damageType)}">${esc(label)}</button>`);
}

registerChatButton('reactDamage', async (message, button) => {
  if (!game.user.isGM) {
    ui.notifications?.warn(game.i18n.localize('E20.CheckApplyDamageGmOnly'));
    return;
  }

  if (message.getFlag?.(SCOPE, 'reactDamageDone')) {
    button.disabled = true;
    return;
  }

  const target = await fromUuid(button.dataset.targetUuid);
  if (!target) {
    return;
  }

  const { applyDamage } = await import("./combat.mjs");
  await applyDamage(target, Number(button.dataset.amount) || 0, button.dataset.type || 'blunt');
  await message.setFlag(SCOPE, 'reactDamageDone', true);
  button.disabled = true;
});

/* -------------------------------------------- */
/*  GM-carried operations                        */
/* -------------------------------------------- */

/**
 * The few writes a reaction needs on documents its user can't write: disabling a hit's damage
 * buttons on the attacker's card, restoring Health/Power to a teammate, a timed Condition on an
 * enemy. Done directly when this user can; otherwise posted as a chat line carrying the operation,
 * which the active GM's client carries out when it arrives (createChatMessage below).
 */
export async function gmDo(op, announce, speaker = null) {
  if (game.user?.isGM || canDoDirectly(op)) {
    await runOp(op);
    if (announce) {
      await say(speaker, announce);
    }

    return;
  }

  await globalThis.ChatMessage?.create?.({
    speaker: globalThis.ChatMessage.getSpeaker?.({ actor: speaker }),
    content: announce || game.i18n.localize('E20.ReactGmOp'),
    flags: { [SCOPE]: { reactOp: op } },
  });
}

function canDoDirectly(op) {
  const doc = op.kind == 'negate' ? game.messages?.get?.(op.messageId) : fromUuidSync?.(op.uuid);
  return !!doc && (doc.canUserModify ? doc.canUserModify(game.user, 'update') : doc.isOwner);
}

export async function runOp(op) {
  switch (op?.kind) {
  case 'negate': {
    const message = game.messages?.get?.(op.messageId);
    if (!message) {
      return;
    }

    const applied = message.getFlag(SCOPE, 'damageAppliedKeys') || [];
    await message.setFlag(SCOPE, 'damageAppliedKeys', [...new Set([...applied, ...(op.keys ?? [])])]);
    const negated = message.getFlag(SCOPE, 'reactNegated') || [];
    await message.setFlag(SCOPE, 'reactNegated', [...new Set([...negated, op.targetUuid])]);
    break;
  }

  case 'restore': {
    const actor = await fromUuid(op.uuid);
    if (!actor) {
      return;
    }

    const path = op.what == 'power' ? 'system.powers.personal' : 'system.health';
    const current = foundry.utils.getProperty(actor, `${path}.value`) ?? 0;
    const max = foundry.utils.getProperty(actor, `${path}.max`) ?? Infinity;
    await actor.update({ [`${path}.value`]: Math.max(0, Math.min(max, current + (Number(op.amount) || 0))) });
    break;
  }

  case 'status': {
    const actor = await fromUuid(op.uuid);
    if (!actor) {
      return;
    }

    if (op.active === false) {
      await actor.toggleStatusEffect(op.status, { active: false });
    } else {
      const { applyTimedCondition } = await import("./timed-status.mjs");
      // op.timing: a Condition ending with a creature's next turn (rules applyCondition until - book check 2026-10-06).
      await (op.timing ? applyTimedCondition(actor, op.status, op.rounds ?? 0, op.timing) : applyTimedCondition(actor, op.status, op.rounds ?? 0));
    }

    break;
  }

  default:
    break;
  }
}

globalThis.Hooks?.on('createChatMessage', message => {
  const op = message?.flags?.[SCOPE]?.reactOp;
  if (op && game.user?.id == game.users?.activeGM?.id) {
    runOp(op).catch(error => console.error('Essence20 | react op failed', error));
  }
});

/**
 * "The incoming attack has no effect" for one target of a card: its damage, crit and rider buttons
 * are all marked applied.
 */
export async function negateHit(message, targetUuid, announce, speaker = null) {
  const keys = cardButtons(message).filter(b => b.targetUuid == targetUuid).map(b => b.key).filter(Boolean);
  await gmDo({ kind: 'negate', messageId: message.id, targetUuid, keys }, announce, speaker);
}

export function isNegated(message, targetUuid) {
  return (message?.getFlag?.(SCOPE, 'reactNegated') ?? []).includes(targetUuid);
}

/* -------------------------------------------- */
/*  Claims (kept on the reacting actor)          */
/* -------------------------------------------- */

const CLAIMS_FLAG = 'reactClaims';

export function claimKey(message, row, reactionId) {
  return `${message?.id}|${row?.targetUuid ?? '*'}|${reactionId}`;
}

export function isClaimed(actor, key) {
  return (actor?.getFlag?.(SCOPE, CLAIMS_FLAG) ?? []).includes(key);
}

export async function claim(actor, key) {
  const list = (actor.getFlag?.(SCOPE, CLAIMS_FLAG) ?? []).slice(-60);
  await actor.setFlag(SCOPE, CLAIMS_FLAG, [...list, key]);
}

/* -------------------------------------------- */
/*  Contingencies (Desperate Parry, PDR)         */
/* -------------------------------------------- */

const ARMED_FLAG = 'reactArmed';

/** Set a Contingency: it holds until the start of this actor's next turn. */
export async function arm(actor, key) {
  const armed = { ...(actor.getFlag?.(SCOPE, ARMED_FLAG) ?? {}) };
  armed[key] = { combatId: game.combat?.id ?? null, round: game.combat?.round ?? 0 };
  await actor.setFlag(SCOPE, ARMED_FLAG, armed);
}

/** Armed in this combat - or no combat running, where there is no turn order to set it in. */
export function isArmed(actor, key) {
  if (!game.combat) {
    return true;
  }

  const entry = actor?.getFlag?.(SCOPE, ARMED_FLAG)?.[key];
  return !!entry && entry.combatId == game.combat.id;
}

export async function disarm(actor, key = null) {
  const armed = { ...(actor.getFlag?.(SCOPE, ARMED_FLAG) ?? {}) };
  if (!Object.keys(armed).length) {
    return;
  }

  if (key) {
    delete armed[key];
    await actor.setFlag(SCOPE, ARMED_FLAG, armed);
  } else {
    await actor.unsetFlag?.(SCOPE, ARMED_FLAG);
  }
}

/* -------------------------------------------- */
/*  Who dealt this damage                        */
/* -------------------------------------------- */

let lastApply = null;

/** Record an Apply Damage click (called from the card decorator, in the capture phase). */
export function noteApply(message, button) {
  const info = cardInfo(message);
  lastApply = {
    at: Date.now(),
    messageId: message.id,
    attackerUuid: info?.attacker?.uuid ?? null,
    targetUuid: button?.dataset?.targetUuid ?? null,
    isAttack: !!info?.isAttack,
    isMelee: !!info?.isMelee,
  };
}

/** The attack card the GM last applied damage from, if it was within the last two minutes. */
export function lastApplyContext() {
  return lastApply && Date.now() - lastApply.at < 120000 ? lastApply : null;
}

export function setLastApplyForTest(value) {
  lastApply = value;
}

/* -------------------------------------------- */
/*  Reaction buttons                             */
/* -------------------------------------------- */

/**
 * @param {Object} reaction
 * @param {String} reaction.id
 * @param {'row'|'card'} [reaction.scope]   Once per target row (default) or once per card.
 * @param {Function} reaction.reactors   (info, row) => Array<Actor> who could use it here.
 * @param {Function} reaction.label   (reactor, info, row) => button text.
 * @param {Function} reaction.run   async (reactor, info, row) => void
 */
export function registerReaction(reaction) {
  REACTIONS.push({ scope: 'row', ...reaction });
}

export function reactionsFor(info) {
  const offers = [];
  for (const reaction of REACTIONS) {
    const rows = reaction.scope == 'card' ? [null] : info.rows.filter(row => row.targetUuid && !isNegated(info.message, row.targetUuid));
    for (const row of rows) {
      let reactors = [];
      try {
        reactors = reaction.reactors(info, row) ?? [];
      } catch (error) {
        console.error(`Essence20 | reaction ${reaction.id} failed`, error);
      }

      for (const reactor of reactors) {
        offers.push({ reaction, row, reactor, key: claimKey(info.message, row, reaction.id) });
      }
    }
  }

  return offers;
}

/** Every world actor holding an item sourced from uuid. */
export function holdersOf(uuid) {
  return worldActors().filter(actor => holds(actor, uuid));
}

export function placeFor(element, row) {
  const items = element?.querySelectorAll?.('.e20-check-result') ?? [];
  const li = row ? items[row.index] : null;
  let box = (li ?? element)?.querySelector?.(':scope > .e20-react-buttons');
  if (!box) {
    box = document.createElement('div');
    box.className = 'e20-react-buttons e20-chat-action-buttons';
    (li ?? element.querySelector?.('.message-content') ?? element).appendChild(box);
  }

  return box;
}

registerChatDecorator((message, element) => {
  const info = cardInfo(message);
  if (!info || !element?.querySelectorAll) {
    return;
  }

  // Who dealt the damage the GM is about to apply - see lastApplyContext.
  for (const button of element.querySelectorAll('[data-action="apply-damage"]')) {
    if (!button.dataset.e20ReactNoted) {
      button.dataset.e20ReactNoted = '1';
      button.addEventListener('click', () => noteApply(message, button), true);
    }
  }

  for (const offer of reactionsFor(info)) {
    if (!canAct(offer.reactor)) {
      continue;
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'e20-chat-action-button e20-react-button';
    button.textContent = offer.reaction.label(offer.reactor, info, offer.row);
    button.disabled = isClaimed(offer.reactor, offer.key);
    button.addEventListener('click', async event => {
      event.preventDefault();
      if (button.disabled) {
        return;
      }

      button.disabled = true;
      try {
        const result = await offer.reaction.run(offer.reactor, info, offer.row);
        if (result === false) {
          button.disabled = false;
          return;
        }

        await claim(offer.reactor, offer.key);
      } catch (error) {
        button.disabled = false;
        console.error(`Essence20 | reaction ${offer.reaction.id} failed`, error);
      }
    });
    placeFor(element, offer.row).appendChild(button);
  }
});

/* -------------------------------------------- */
/*  Small dialogs                                */
/* -------------------------------------------- */

export async function choose(title, prompt, choices) {
  if (choices.length == 1) {
    return choices[0][0];
  }

  const { chooseButtons } = await import("../resources/grants.mjs");
  return chooseButtons(title, prompt, choices);
}

export async function confirm(title, content) {
  const DialogV2 = foundry.applications?.api?.DialogV2;
  if (!DialogV2) {
    return true;
  }

  return !!(await DialogV2.confirm({ window: { title }, content: `<p>${content}</p>`, rejectClose: false }));
}

export function skillLabel(skill) {
  return game.i18n.localize(CONFIG.E20?.skills?.[skill] ?? skill);
}

/** Pay Personal Power from an actor it's this user's to spend. */
export async function payPower(actor, amount) {
  const value = actor?.system?.powers?.personal?.value ?? 0;
  if (value < amount) {
    ui.notifications?.warn(game.i18n.format('E20.ReactNoPower', { name: actor?.name, amount }));
    return false;
  }

  await actor.update({ 'system.powers.personal.value': value - amount });
  return true;
}

/**
 * Turn rows of a card into successes (or Critical Successes). A plain Skill Test just says so; an
 * Attack gets the damage it now deals as a GM Apply button - its base damage for a new hit, and for a
 * Critical Success the "repeat the effect" crit option (GI Joe CRB p.205) on top.
 */
export async function convertRows(info, rows, { crit, speaker, reason }) {
  const item = info.itemUuid ? await fromUuid(info.itemUuid) : null;
  const base = Number(item?.system?.damageValue) || 0;
  const type = item?.system?.damageType ?? 'blunt';
  await say(speaker, `<p>${reason}</p>`);
  if (!info.isAttack || !base) {
    return;
  }

  for (const row of rows) {
    const target = row.targetUuid ? await fromUuid(row.targetUuid) : null;
    if (!target) {
      continue;
    }

    const amount = (row.success ? 0 : base) + (crit ? base : 0);
    if (amount > 0) {
      await damageButton(info.attacker, target, amount, type, game.i18n.format('E20.ReactConvertedDamage', { name: esc(target.name) }));
    }
  }
}

