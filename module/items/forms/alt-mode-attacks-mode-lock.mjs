/**
 * The tf2 slice's reactions to things happening: derived data, chat cards with buttons, token
 * movement, Alt Modes arriving, and a few end-of-roll follow-ups.
 *
 * - Charger / Pillar / Speaker Alt Modes (Enigma of Combination, Origins, p.26-28): "Special Attack:
 *   Flyby (Driving) or Ram (Driving): Driving Skill, Reach (2 Blunt damage), Trip alternate effect"
 *   (Charger), "Special Attack: Ram (Driving): Driving Skill, Reach (1 Blunt damage), Trip alternate
 *   effect" (Pillar, Speaker). The Core Rulebook's Ram / Flyby weapon (TF CRB p.47) is given with the
 *   Alt Mode; the Charger's hits for 2. The same goes for the other printed special attacks:
 *   - the Core Rulebook's vehicle chassis (p.49-54), "Special Attack: Ram (Driving): Driving Skill,
 *     Range Reach (1 Blunt Damage, Trip)" - 2 Blunt for the Monolith, Flyby for the Seeker;
 *   - Salvaged (Decepticon Directive, p.38), "Spiked Ram: Driving skill, Reach (1 Sharp damage);
 *     Maneuver alternate effect", and the Mini-Con's Mini-Vehicle (p.36), "Ram: Driving skill, Reach
 *     (1 Blunt damage); Maneuver";
 *   - the Technorganic Secrets chassis (p.36-44) and both Monstrosity printings: "Natural Weapon
 *     (Might): Might Skill, Reach (1 Blunt or Sharp damage) Alternate Effect: Maneuver" (Finesse or
 *     Might for the Climber/Nimble), the Flora's Reach x2 one, the Flyer's Natural Weapon Flyby and
 *     the Behemoth's SMASH!. "Blunt or Sharp" and "Finesse or Might" are asked when the weapon arrives.
 *   Only the Charger, the Monolith and the chassis with a choice stay here: every Alt Mode whose printed
 *   attack needs no change carries it as a Grant rule (plus a Use to get it back) on its own item.
 * - Mode Lock (Enigma of Combination, p.49): "the character can remove the Condition by performing an
 *   Energon flush, which requires spending 1 Energon and succeeding at a DIF 12 Technology Skill Test
 *   as a Standard action." Conversion itself is already refused (sheet-handlers/transformer-handler.mjs);
 *   the flush is a button on the chat card posted when the Condition lands.
 * - Not Like That, Like This! (Enigma of Combination, 6th level, p.30): "when a teammate within 60
 *   feet rolls a Skill Test, you can ask them to reroll any or all the dice involved, though they must
 *   accept the second result. If you do this, you must attempt a Skill Test using the same Skill that
 *   was re-rolled on your following turn, if possible. If it isn't possible, you lose your Move action
 *   for that turn."
 * We Are One!'s team reroll is a picked-scope Reroll rule on the Perk (rules/conv12-slI12.test.js). Roller Drum's Combined Mode Health and Scramble Modulator's Combiner-form Sonic are their items' own rules
 * (MegaformHealth, a hit Trigger - module/rules/ext/a/).
 */
import {
  registerChatButton, registerChatDecorator, registerPostRoll, registerTurnEnd, registerTurnStart,
} from "../../mechanics/item-hooks.mjs";
import {
  T, TF2, feetBetween, has, nameOf, say, worldActors,
} from "../shared/weapon-target-lookups.mjs";

const OWED_FLAG = 'tf2NotLikeThatOwed';

const escape = text => foundry.utils.escapeHTML(String(text ?? ''));
const energonOf = actor => Number(actor?.system?.energon?.normal?.value) || 0;

function resolve(uuid) {
  try {
    return uuid && typeof fromUuidSync == 'function' ? fromUuidSync(uuid) : null;
  } catch (error) {
    return null;
  }
}

async function payAction(actor, type, source) {
  if (!globalThis.game?.combat) {
    return true;
  }

  const { spend } = await import("../../mechanics/actions/action-economy.mjs");
  const result = await spend(actor, type, { source });
  return !result?.blocked;
}

function card(actor, text, button = null) {
  const extra = button
    ? `<button type="button" data-e20-ext="${button.key}"${Object.entries(button.data ?? {}).map(([k, v]) => ` data-${k}="${escape(v)}"`).join('')}>${escape(button.label)}</button>`
    : '';
  return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<p>${text}</p>${extra}` });
}

/* -------------------------------------------- */
/*  Mode Lock                                    */
/* -------------------------------------------- */

registerChatButton('tf2EnergonFlush', async (message, button) => {
  const actor = resolve(button.dataset.actorUuid);
  if (!actor?.isOwner) {
    return;
  }

  if (!actor.statuses?.has?.('modeLock')) {
    ui.notifications.warn(T('Tf2NotModeLocked', { name: actor.name }));
    return;
  }

  if (energonOf(actor) < 1) {
    ui.notifications.warn(T('Tf2NoEnergon', { name: actor.name }));
    return;
  }

  if (!(await payAction(actor, 'standard', T('Tf2EnergonFlush')))) {
    return;
  }

  await actor.update({ 'system.energon.normal.value': energonOf(actor) - 1 });
  const { rollTest } = await import("../../mechanics/resources/grants.mjs");
  const { success } = await rollTest(actor, 'technology', 12);
  if (success) {
    await actor.toggleStatusEffect('modeLock', { active: false });
  }

  await say(actor, T(success ? 'Tf2EnergonFlushDone' : 'Tf2EnergonFlushFailed', { name: actor.name }));
});

/* -------------------------------------------- */
/*  Not Like That, Like This!                    */
/* -------------------------------------------- */

/** The actors this user plays that could call for the reroll on this roller's test. */
export function notLikeThatHolders(roller) {
  // A player's character offers it to that player; the GM only sees it for characters no player has.
  const isGm = !!globalThis.game?.user?.isGM;
  return worldActors().filter(actor => actor?.uuid != roller?.uuid && actor.isOwner && (!isGm || !actor.hasPlayerOwner)
    && has(actor, TF2.notLikeThat) && (feetBetween(actor, roller) ?? 0) <= 60);
}

export function notLikeThatDecorator(message, element) {
  const flags = message?.flags?.essence20;
  if (!flags?.skill || flags.tf2NotLikeThat || !message.rolls?.length || element?.querySelector?.('[data-e20-ext="tf2NotLikeThat"]')) {
    return;
  }

  const roller = ChatMessage.getSpeakerActor?.(message.speaker);
  if (!roller) {
    return;
  }

  const holders = notLikeThatHolders(roller);
  if (!holders.length) {
    return;
  }

  const wrap = document.createElement('div');
  wrap.className = 'e20-reroll-buttons';
  for (const holder of holders) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.e20Ext = 'tf2NotLikeThat';
    button.dataset.holderUuid = holder.uuid;
    button.textContent = T('Tf2NotLikeThatButton', { name: holder.name, perk: nameOf(holder, TF2.notLikeThat, 'Not Like That, Like This!') });
    wrap.append(button);
  }

  const diceRoll = element.querySelector?.('.dice-roll');
  if (diceRoll?.parentElement) {
    diceRoll.parentElement.insertBefore(wrap, diceRoll.nextSibling);
  } else {
    (element.querySelector?.('.message-content') ?? element).append(wrap);
  }
}

registerChatDecorator(notLikeThatDecorator);

registerChatButton('tf2NotLikeThat', async (message, button) => {
  const holder = resolve(button.dataset.holderUuid);
  const roller = ChatMessage.getSpeakerActor?.(message.speaker);
  if (!holder?.isOwner || !roller) {
    return;
  }

  const used = holder.flags?.essence20?.tf2NotLikeThatUsed ?? [];
  if (used.includes(message.id)) {
    ui.notifications.warn(T('Tf2AlreadyRerolled'));
    return;
  }

  const { applyReroll } = await import("../../mechanics/rolls/reroll.mjs");
  const roll = Roll.fromData(message.rolls[0].toJSON());
  if (!(await applyReroll(roll, { mode: 'all', target: 'allDice', values: [], recursive: false }))) {
    return;
  }

  const { buildCheckChatData } = await import("../../mechanics/combat/combat.mjs");
  const chatData = await buildCheckChatData(roll, {
    flavor: T('Tf2NotLikeThatFlavor', { name: roller.name, holder: holder.name }),
    results: [], speaker: message.speaker, canCritD2: !!message.flags?.essence20?.canCritD2,
  });
  foundry.utils.setProperty(chatData, 'flags.essence20.tf2NotLikeThat', true);
  await ChatMessage.create(chatData);

  const skill = message.flags.essence20.skill;
  const update = { 'flags.essence20.tf2NotLikeThatUsed': [...used.slice(-20), message.id] };
  if (game.combat) {
    update[`flags.essence20.${OWED_FLAG}`] = { skill, combatId: game.combat.id, reminded: false };
  }

  await holder.update(update);
});

registerChatButton('tf2NotLikeThatForfeit', async (message, button) => {
  const actor = resolve(button.dataset.actorUuid);
  if (!actor?.isOwner || !actor.flags?.essence20?.[OWED_FLAG]) {
    return;
  }

  await payAction(actor, 'move', T('Tf2NotLikeThatForfeitSource'));
  await actor.unsetFlag('essence20', OWED_FLAG);
  await say(actor, T('Tf2NotLikeThatForfeited', { name: actor.name }));
});

registerTurnStart(async (actor, combat) => {
  // Not Like That, Like This!: the reminder of what's owed this turn.
  const owed = actor?.flags?.essence20?.[OWED_FLAG];
  if (owed && owed.combatId == combat?.id && !owed.reminded) {
    await actor.update({ [`flags.essence20.${OWED_FLAG}.reminded`]: true });
    const skill = game.i18n.localize(CONFIG.E20?.skills?.[owed.skill] ?? owed.skill);
    await card(actor, T('Tf2NotLikeThatOwed', { name: actor.name, skill }), {
      key: 'tf2NotLikeThatForfeit', label: T('Tf2NotLikeThatForfeit'), data: { 'actor-uuid': actor.uuid },
    });
  } else if (owed && owed.combatId != combat?.id) {
    await actor.unsetFlag('essence20', OWED_FLAG);
  }
});

registerTurnEnd(async actor => {
  const owed = actor?.flags?.essence20?.[OWED_FLAG];
  if (owed?.reminded) {
    await actor.unsetFlag('essence20', OWED_FLAG);
  }
});

/* -------------------------------------------- */
/*  After a roll                                 */
/* -------------------------------------------- */

export async function tf2PostRoll(actor, results, checkContext, { rider = {} } = {}) {
  // Not Like That, Like This!: the owed Skill Test was made.
  const owed = actor?.flags?.essence20?.[OWED_FLAG];
  const skill = rider?.skill ?? checkContext?.skill;
  if (owed && skill && skill == owed.skill) {
    await actor.unsetFlag('essence20', OWED_FLAG);
  }

  // (Sustained Beam's once-per-round follow-up attack is a hit Trigger on the upgrade - rules/plugins/combat/rule-attacks.mjs.)
}

registerPostRoll(tf2PostRoll);

/* -------------------------------------------- */
/*  Foundry hooks                                */
/* -------------------------------------------- */

const H = globalThis.Hooks;

// Mode Lock lands: offer the Energon flush.
H?.on?.('createActiveEffect', async (effect, options, userId) => {
  const actor = effect?.parent;
  if (userId != globalThis.game?.user?.id || actor?.documentName != 'Actor' || !effect.statuses?.has?.('modeLock')) {
    return;
  }

  await card(actor, T('Tf2ModeLocked', { name: actor.name }), {
    key: 'tf2EnergonFlush', label: T('Tf2EnergonFlush'), data: { 'actor-uuid': actor.uuid },
  });
});

// Roll Out (For The Allspark!) is the Perk's own initiativeRolled Trigger (a pick of the Alt Mode, transformInto).
