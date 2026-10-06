import { worldActors } from "../companions/companion-link.mjs";
import { getSceneEpoch } from "../resources/scene-clock.mjs";
import { itemsOf, sourceOfOrUndefined as sourceOf } from "../../items/shared/item-lookups.mjs";

/**
 * Issue Command (TF CRB, Field Commander, 1st level, p.64): a Move action. The commander sets the terms;
 * allies who follow them get ↑1 on a Skill Test or +1 to a Defense until the commander's next turn starts.
 *
 * - The Use button on Issue Command asks for the command: one of the book's common commands (Fire,
 *   Hold Your Fire, Hold The Line, What Is That?, It's a Trick) or a custom one (a Skill to boost, or a
 *   Defense). It is kept on the commander (flags.essence20.issuedCommands) until the start of their
 *   next turn.
 * - An ally's roll that meets the terms gets the ↑ as a labelled source (commandSources, from
 *   mechanics/combat/target-riders.mjs#rollRiderSources); a Defense command raises the ally's Defense when
 *   they're attacked (commandDefenseBonus, from riderDefenseAdjust).
 * - The perks that change it: Complex Command (two commands), Minimize Casualties (double when no one
 *   is harmed), On My Mark (+2 / Edge when you act on it yourself), Follow My Lead and Lead From the
 *   Rear (a Free action), The First Rule Of Soldiering (free on Initiative), No Excuses (an ally spends
 *   Energon to double it) and Dubious Tactics (an ally triples it for a penalty). Doubling and tripling
 *   are buttons on the command's chat card, taken by the ally.
 */

const uuid = (pack, id) => `Compendium.essence20.${pack}.Item.${id}`;
export const CMD = {
  issueCommand: uuid('tf_crb', '8kBCl8fTTMDnZDHk'),
  complexCommand: uuid('tf_crb', 'zIUXyy7BtKUs9ZOA'),
  followMyLead: uuid('tf_crb', 'PlNtZjYRW262Jh4n'),
  minimizeCasualties: uuid('tf_crb', '72O6Oz5cBJwpkD3u'),
  firstRule: uuid('tf_crb', 'pgp0jFamjz8Gn0aA'),
  dubiousTactics: uuid('decepticon_directive', 'Um9vbTdiE37OakdA'),
  leadFromTheRear: uuid('decepticon_directive', 'BEjHfDuw0TXiGtSi'),
  noExcuses: uuid('decepticon_directive', '0uUdZ51xULcmgTQQ'),
  onMyMark: uuid('enigma_of_combination', 'HmI4853ML6Tz14iD'),
};

const FLAG = 'issuedCommands';
const BOOST_FLAG = 'commandBoosts';
const T = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));

function has(actor, id) {
  return itemsOf(actor).some(item => sourceOf(item) == id);
}

/** The book's common commands. */
export const PRESETS = {
  fire: { kind: 'shift', match: 'rangedAttack', harmless: false },
  holdYourFire: { kind: 'shift', match: 'skill', skill: 'alertness', harmless: true },
  holdTheLine: { kind: 'defense', defense: 'toughness', harmless: true },
  whatIsThat: { kind: 'shift', match: 'essence', essence: 'smarts', harmless: true },
  itsATrick: { kind: 'defense', defense: 'cleverness', vsTarget: true, harmless: true },
};

/* -------------------------------------------- */
/*  How long one lasts                           */
/* -------------------------------------------- */

function untilStartOfNextTurn(actor) {
  const combat = game?.combat;
  if (!combat) {
    return { sceneEpoch: getSceneEpoch() };
  }

  const theirs = combat.turns?.findIndex?.(c => c.actor?.id == actor?.id) ?? -1;
  return { combatId: combat.id, untilRound: combat.round + (theirs <= combat.turn ? 1 : 0), untilTurn: Math.max(0, theirs) - 1 };
}

export function isLive(command) {
  const combat = game?.combat;
  if (command.combatId) {
    if (!combat || combat.id != command.combatId) {
      return false;
    }

    return combat.round < command.untilRound || (combat.round == command.untilRound && combat.turn <= command.untilTurn);
  }

  return command.sceneEpoch == null || command.sceneEpoch == getSceneEpoch();
}

export function commandsOf(commander) {
  const list = commander?.flags?.essence20?.[FLAG];
  return Array.isArray(list) ? list.filter(isLive) : [];
}

function tokenActors() {
  const found = new Map();
  for (const token of globalThis.canvas?.tokens?.placeables ?? []) {
    if (token.actor) {
      found.set(token.actor.uuid, { actor: token.actor, disposition: token.document?.disposition });
    }
  }

  for (const actor of worldActors()) {
    if (!found.has(actor.uuid) && actor.flags?.essence20?.[FLAG]) {
      found.set(actor.uuid, { actor, disposition: actor.prototypeToken?.disposition });
    }
  }

  return [...found.values()];
}

function dispositionOf(actor) {
  return actor?.getActiveTokens?.()?.[0]?.document?.disposition ?? actor?.prototypeToken?.disposition ?? 1;
}

/**
 * Every live command an ally has given this actor.
 * @param {Actor} actor
 * @returns {Array<{command: Object, commander: Actor}>}
 */
export function commandsFollowedBy(actor) {
  const mine = dispositionOf(actor);
  const out = [];
  for (const { actor: commander, disposition } of tokenActors()) {
    if (commander.uuid == actor?.uuid || (disposition ?? 1) != mine) {
      continue;
    }

    for (const command of commandsOf(commander)) {
      out.push({ command, commander });
    }
  }

  return out;
}

function boostFor(actor, command) {
  const boosts = actor?.flags?.essence20?.[BOOST_FLAG] ?? {};
  return boosts[command.id] ?? 1;
}

/* -------------------------------------------- */
/*  Applying it                                  */
/* -------------------------------------------- */

function matches(command, { rolledSkill, isAttack, isRanged }) {
  if (command.kind != 'shift') {
    return false;
  }

  if (command.match == 'rangedAttack') {
    return !!isAttack && !!isRanged;
  }

  if (command.match == 'essence') {
    return CONFIG.E20?.skillToEssence?.[rolledSkill] == command.essence;
  }

  if (command.match == 'attack') {
    return !!isAttack;
  }

  return !!rolledSkill && rolledSkill == command.skill;
}

/**
 * The ↑ (or Edge) this roll gets from commands it follows, and Dubious Tactics' ↓1 on the rest.
 * @param {Actor} actor
 * @param {Object} ctx   {rolledSkill, isAttack, isRanged}
 * @returns {Array<Object>}   Roll sources.
 */
export function commandSources(actor, ctx = {}) {
  const sources = [];
  for (const { command, commander } of commandsFollowedBy(actor)) {
    const boost = boostFor(actor, command);
    if (matches(command, ctx)) {
      const shift = command.value * boost;
      sources.push({
        id: `command-${command.id}`, label: T('E20.CommandSource', { name: commander.name, command: command.label }),
        shiftUp: command.edge ? 0 : shift, shiftDown: 0, edge: !!command.edge, snag: false,
      });
    } else if (boost == 3 && command.penalty == 'unrelated') {
      // Dubious Tactics: ↓1 on tests unrelated to the command.
      sources.push({ id: `command-penalty-${command.id}`, label: T('E20.DubiousTactics'), shiftUp: 0, shiftDown: 1, edge: false, snag: false });
    }
  }

  return sources;
}

/**
 * A Defense command's bonus to the defender - and Dubious Tactics' -1 to all Defenses.
 * @param {Actor} defender
 * @param {String} defense
 * @param {Actor} [attacker]
 * @returns {Number}
 */
export function commandDefenseBonus(defender, defense, attacker = null) {
  let bonus = 0;
  for (const { command } of commandsFollowedBy(defender)) {
    const boost = boostFor(defender, command);
    if (command.kind == 'defense' && command.defense == defense && (!command.vsTarget || command.vsTarget == attacker?.uuid)) {
      bonus += command.value * boost;
    }

    if (boost == 3 && command.penalty == 'defenses') {
      bonus -= 1;
    }
  }

  return bonus;
}

/* -------------------------------------------- */
/*  Issuing one                                  */
/* -------------------------------------------- */

async function askCommand(commander, index) {
  const presetOptions = Object.keys(PRESETS).map(key => `<option value="${key}">${T(`E20.CommandPreset.${key}`)}</option>`).join('');
  const skillOptions = Object.entries(CONFIG.E20.skills).map(([key, label]) => `<option value="${key}">${T(label)}</option>`).join('');
  const defenseOptions = Object.entries(CONFIG.E20.defenses).map(([key, label]) => `<option value="${key}">${T(label)}</option>`).join('');
  const onMyMark = has(commander, CMD.onMyMark);
  const dubious = has(commander, CMD.dubiousTactics);
  const content = `
    <p>${T(index ? 'E20.CommandSecond' : 'E20.CommandPrompt')}</p>
    <div class="form-group"><label>${T('E20.CommandWhich')}</label><select name="preset">${presetOptions}<option value="customSkill">${T('E20.CommandCustomSkill')}</option><option value="customDefense">${T('E20.CommandCustomDefense')}</option></select></div>
    <div class="form-group"><label>${T('E20.CommandLabel')}</label><input type="text" name="label" value="" /></div>
    <div class="form-group"><label>${T('E20.CommandSkill')}</label><select name="skill">${skillOptions}</select></div>
    <div class="form-group"><label>${T('E20.CommandDefense')}</label><select name="defense">${defenseOptions}</select></div>
    <div class="form-group"><label>${T('E20.CommandHarmless')}</label><select name="harmless"><option value="no">${T('No')}</option><option value="yes">${T('Yes')}</option></select></div>
    ${onMyMark ? `<div class="form-group"><label>${T('E20.CommandOnMyMark')}</label><select name="onMyMark"><option value="no">${T('No')}</option><option value="yes">${T('Yes')}</option></select></div>` : ''}
    ${dubious ? `<div class="form-group"><label>${T('E20.CommandDubiousPenalty')}</label><select name="penalty"><option value="defenses">${T('E20.DubiousPenaltyDefenses')}</option><option value="movement">${T('E20.DubiousPenaltyMovement')}</option><option value="unrelated">${T('E20.DubiousPenaltyUnrelated')}</option></select></div>` : ''}`;
  const result = await foundry.applications.api.DialogV2.wait({
    window: { title: T('E20.CommandTitle') },
    classes: ["window-app", "e20-window"],
    content,
    buttons: [
      { action: 'ok', label: T('E20.DialogConfirmButton'), default: true, callback: (event, button) => Object.fromEntries(
        ['preset', 'label', 'skill', 'defense', 'harmless', 'onMyMark', 'penalty'].map(name => [name, button.form.elements[name]?.value ?? null])) },
      { action: 'cancel', label: T('E20.DialogCancelButton') },
    ],
    rejectClose: false,
  });
  return result && result != 'cancel' ? result : null;
}

/**
 * Build a command from the dialog's answers.
 * @param {Actor} commander
 * @param {Object} answer
 * @returns {Object}
 */
export function buildCommand(commander, answer) {
  const preset = PRESETS[answer.preset];
  const base = preset ? { ...preset } : answer.preset == 'customDefense'
    ? { kind: 'defense', defense: answer.defense, harmless: answer.harmless == 'yes' }
    : { kind: 'shift', match: 'skill', skill: answer.skill, harmless: answer.harmless == 'yes' };
  const target = base.vsTarget ? game.user?.targets?.first?.()?.actor : null;
  // Minimize Casualties (TF CRB, Ambassador, 6th level): a combat command that harms no one gives
  // double benefits.
  const doubled = base.harmless && !!game?.combat && has(commander, CMD.minimizeCasualties);
  // On My Mark (Enigma of Combination, Team Leader, 1st level): when the commander does what they
  // ordered, followers get +2 to the Defense or Edge on the Skill Test instead.
  const onMark = answer.onMyMark == 'yes';
  const label = answer.label || (preset ? T(`E20.CommandPreset.${answer.preset}`) : base.kind == 'defense'
    ? T(CONFIG.E20.defenses[base.defense]) : T(CONFIG.E20.skills[base.skill]));
  return {
    id: foundry.utils.randomID(),
    ...base,
    vsTarget: target?.uuid ?? (base.vsTarget ? null : undefined),
    label,
    value: base.kind == 'defense' ? Math.max(onMark ? 2 : 1, doubled ? 2 : 1) : (doubled ? 2 : 1),
    edge: base.kind == 'shift' && onMark,
    penalty: answer.penalty ?? null,
    ...untilStartOfNextTurn(commander),
  };
}

/**
 * Lead From the Rear (Decepticon Directive, 3rd level): Issue Command is a Free action while every
 * ally is nearer to the commander than any enemy.
 */
export function isLeadingFromTheRear(commander) {
  const mine = commander?.getActiveTokens?.()?.[0];
  if (!mine || !canvas?.grid) {
    return false;
  }

  const distance = token => canvas.grid.measurePath([mine.center, token.center]).distance;
  const others = canvas.tokens.placeables.filter(t => t !== mine && t.actor && !t.document.hidden);
  const allies = others.filter(t => t.document.disposition == mine.document.disposition);
  const enemies = others.filter(t => t.document.disposition == -mine.document.disposition);
  if (!allies.length || !enemies.length) {
    return !!allies.length;
  }

  const nearestEnemy = Math.min(...enemies.map(distance));
  return allies.every(ally => distance(ally) <= nearestEnemy);
}

/** What issuing costs now: a Move action, or Free with Follow My Lead / Lead From the Rear / on Initiative. */
async function issueCost(commander, { onInitiative = false } = {}) {
  if (onInitiative) {
    return null;
  }

  if (has(commander, CMD.leadFromTheRear) && isLeadingFromTheRear(commander)) {
    return 'free';
  }

  // Follow My Lead (TF CRB, Strategist, 3rd level): a Free action when the commander meets the
  // command's own terms.
  if (has(commander, CMD.followMyLead)) {
    const meets = await foundry.applications.api.DialogV2.confirm({
      window: { title: T('E20.CommandTitle') }, content: `<p>${T('E20.CommandFollowMyLead')}</p>`, rejectClose: false,
    });
    if (meets) {
      return 'free';
    }
  }

  return 'move';
}

/**
 * Issue a Command (or two, with Complex Command).
 * @param {Actor} commander
 * @param {Object} [options]
 * @param {Function} [options.pay]   Spends the action; resolves false if blocked.
 * @param {Boolean} [options.onInitiative]   The First Rule Of Soldiering: a free command on the
 *   Initiative roll.
 * @returns {Promise<String|null>}   The chat line.
 */
export async function issueCommand(commander, { pay = async () => true, onInitiative = false } = {}) {
  const commands = [];
  const count = has(commander, CMD.complexCommand) ? 2 : 1;
  for (let i = 0; i < count; i++) {
    const answer = await askCommand(commander, i);
    if (!answer) {
      break;
    }

    commands.push(buildCommand(commander, answer));
  }

  if (!commands.length) {
    return null;
  }

  // Complex Command: the two commands need different terms and benefits.
  if (commands.length == 2 && commands[0].label == commands[1].label) {
    commands.pop();
  }

  const cost = await issueCost(commander, { onInitiative });
  if (cost && !(await pay(cost))) {
    return null;
  }

  await commander.setFlag('essence20', FLAG, commands);
  await postCommandCard(commander, commands);
  return null;
}

async function postCommandCard(commander, commands) {
  const noExcuses = has(commander, CMD.noExcuses);
  const dubious = has(commander, CMD.dubiousTactics);
  const rows = commands.map(command => {
    const bonus = command.kind == 'defense' ? `+${command.value} ${T(CONFIG.E20.defenses[command.defense])}` : (command.edge ? T('E20.Edge') : `↑${command.value}`);
    const buttons = [
      noExcuses ? `<button type="button" data-e20-social="commandBoost" data-commander="${commander.uuid}" data-command="${command.id}" data-boost="2">${T('E20.NoExcusesButton')}</button>` : '',
      dubious ? `<button type="button" data-e20-social="commandBoost" data-commander="${commander.uuid}" data-command="${command.id}" data-boost="3">${T('E20.DubiousTacticsButton', { penalty: T(`E20.DubiousPenaltyShort.${command.penalty ?? 'defenses'}`) })}</button>` : '',
    ].join('');
    return `<li><strong>${foundry.utils.escapeHTML(command.label)}</strong> (${bonus})${buttons ? `<div class="flexrow">${buttons}</div>` : ''}</li>`;
  }).join('');
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: commander }),
    content: `<p>${T('E20.CommandIssued', { name: commander.name })}</p><ul>${rows}</ul>`,
  });
}

/**
 * An ally taking No Excuses (an Energon Point doubles their bonus) or Dubious Tactics (triple the
 * bonus for a penalty the commander picks, until the end of the commander's next turn) from the
 * command's card. The ally is whoever the clicking
 * user has selected or owns as their character.
 */
export async function onCommandBoost(button) {
  const ally = globalThis.canvas?.tokens?.controlled?.[0]?.actor ?? game.user?.character;
  const commander = await fromUuid(button.dataset.commander);
  const command = commandsOf(commander).find(c => c.id == button.dataset.command);
  const boost = Number(button.dataset.boost) || 1;
  if (!ally || !command || !ally.isOwner) {
    ui.notifications.warn(T('E20.CommandPickAlly'));
    return;
  }

  if (boost == 2) {
    const energon = Number(ally.system?.energon?.normal?.value) || 0;
    if (energon < 1) {
      ui.notifications.warn(T('E20.NoEnergon', { name: ally.name }));
      return;
    }

    await ally.update({ 'system.energon.normal.value': energon - 1 });
  }

  const boosts = { ...(ally.flags?.essence20?.[BOOST_FLAG] ?? {}), [command.id]: boost };
  await ally.setFlag('essence20', BOOST_FLAG, boosts);
  // Dubious Tactics' "-10ft to all their Movements" rides the forced-movement penalty.
  if (boost == 3 && command.penalty == 'movement') {
    const { slowNextTurn } = await import("../combat/forced-movement.mjs");
    await slowNextTurn?.(ally, 10);
  }

  ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: ally }), content: T(boost == 3 ? 'E20.DubiousTacticsTaken' : 'E20.NoExcusesTaken', { name: ally.name, command: command.label }) });
}

/**
 * The First Rule Of Soldiering: prompt once per combat when the commander's Initiative is rolled.
 */
export async function onInitiativeRolled(actor) {
  if (!has(actor, CMD.firstRule) || !actor.isOwner || !game?.combat) {
    return;
  }

  if (actor.flags?.essence20?.firstRuleCombat == game.combat.id) {
    return;
  }

  await actor.setFlag('essence20', 'firstRuleCombat', game.combat.id);
  const confirmed = await foundry.applications.api.DialogV2.confirm({
    window: { title: T('E20.CommandTitle') }, content: `<p>${T('E20.FirstRulePrompt', { name: actor.name })}</p>`, rejectClose: false,
  });
  if (confirmed) {
    await issueCommand(actor, { onInitiative: true });
  }
}
