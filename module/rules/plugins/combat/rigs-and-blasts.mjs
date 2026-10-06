import { registerRoundStart, registerTurnEnd, registerTurnStart } from "../../../mechanics/item-hooks.mjs";
import { resolveValue } from "../../formula.mjs";
import { recipients, registerStep, runSteps, stepContext } from "../../steps.mjs";
import { escape, T, worldActors, write } from "../shared/chat-speaker-helpers.mjs";
import { tokensAround } from "./canvas-points.mjs";

/**
 * Delayed cards, rigs and blasts around a canvas point (round 10, group D) - the pieces a rigged-to-explode Perk
 * needs. A point is the run's @var.pointX / @var.pointY / {var.pointScene} (canvas.mjs pickPoint).
 *
 *  - `scheduleCard {turnEnds?, turnStarts?, rounds?, steps}` - in a combat, `steps` run later: once this actor's turn has
 *    ended `turnEnds` times (the current turn counts), when its turn has started `turnStarts` times from now (1: the
 *    start of its next turn - round 15, items2, Artillery Support), or when round now + `rounds` starts; out of combat
 *    (or with none set) they run now. The run's targets and values go with them.
 *  - `rig {var}` / `requireRig {var, message?}` / `endRig {var}` - a live "rig" on the actor, named by a fresh id kept in
 *    @var.<var>: cards that act on the same rig check it's still live and end it, so a second card for it does nothing.
 *  - `blast {radius, skill, defense: toughness | evasion | ask, damage, damageType, title}` - the actor's Skill Test
 *    (the roll dialog, the check card) against that Defense of every token around the point, then an Apply Damage
 *    button per creature it succeeded against (damage x Degrees of Success). Nobody there: says so.
 *    Round 15 (items2 - Artillery Support): `packets: [{amount, type}]` - fixed damage instead (no Degrees of Success),
 *    a button per packet for each creature hit, and `missPackets` for each it missed ("those who Defend"); `at:
 *    targets` - the run's targets' tokens instead of those around the point; `excludeTargets: true` - leaves the
 *    run's targets out of the area (a splash around them).
 *  - `explosion {radius, formula, saveSkills, saveDif, damageType, title}` - roll the damage once; each creature around
 *    the point makes a plain save (the best of the Skills - d20 + the die + its modifier) and takes half on a success;
 *    Apply Damage buttons for each.
 *  - `damageCard {actor, amount, damageType, title}` - an Apply Damage button for one actor ({var.x} a uuid). With `to`
 *    instead of `actor` (round 15, items2 - Solid-State Energon's blast): one card, a button for each recipient.
 *  - `explodeVehicle {actor}` - a vehicle or Zord explodes as itself (mechanics/vehicles/vehicle-defeat.mjs).
 */

const SCHEDULE = 'ruleScheduled';
const RIGS = 'ruleRigs';

const fill = (text, ctx) => String(text ?? '').replace(/\{var\.([\w-]+)\}/g, (m, key) => String(ctx.vars?.[key] ?? ''));
const plainVars = vars => Object.fromEntries(Object.entries(vars ?? {}).filter(([, value]) => ['number', 'string', 'boolean'].includes(typeof value)));

/* -------------------------------------------- */
/*  Scheduled cards                              */
/* -------------------------------------------- */

registerStep('scheduleCard', async (step, ctx) => {
  const combat = globalThis.game?.combat;
  const rounds = step.rounds === undefined ? 0 : Math.max(0, Math.round(resolveValue(step.rounds, { actor: ctx.actor, item: ctx.item, vars: ctx.vars }, 0)));
  const turnEnds = Math.max(0, Number(step.turnEnds) || 0);
  const turnStarts = Math.max(0, Number(step.turnStarts) || 0);
  if (!combat || (!rounds && !turnEnds && !turnStarts)) {
    return runSteps(step.steps ?? [], ctx);
  }

  const entry = {
    id: globalThis.foundry?.utils?.randomID?.() ?? String(Date.now()), combatId: combat.id, itemUuid: ctx.item?.uuid ?? null,
    targets: ctx.targets.map(target => target.uuid), vars: plainVars(ctx.vars), steps: step.steps ?? [],
    ...(turnEnds ? { turnEndsLeft: turnEnds } : turnStarts ? { turnStartsLeft: turnStarts } : { dueRound: (Number(combat.round) || 0) + rounds }),
  };
  const list = Array.isArray(ctx.actor?.flags?.essence20?.[SCHEDULE]) ? ctx.actor.flags.essence20[SCHEDULE] : [];
  await write(ctx.actor, 'update', [{ [`flags.essence20.${SCHEDULE}`]: [...list, entry] }]);
}, { branches: ['steps'] });

async function runEntry(actor, entry) {
  const lookup = uuid => (uuid ? globalThis.fromUuidSync?.(uuid, { strict: false }) ?? null : null);
  const ctx = stepContext({ actor, item: lookup(entry.itemUuid), targets: (entry.targets ?? []).map(lookup).filter(Boolean) });
  Object.assign(ctx.vars, entry.vars ?? {});
  await runSteps(entry.steps ?? [], ctx);
  if (ctx.chat.length && globalThis.ChatMessage?.create) {
    await globalThis.ChatMessage.create({ speaker: globalThis.ChatMessage.getSpeaker?.({ actor }), content: [`<strong>${escape(ctx.item?.name ?? '')}</strong>`, ...ctx.chat].join('<br>') });
  }
}

/** An actor's turn ended: its turn-counted entries tick down; those at zero run. */
export async function scheduledTurnEnd(actor, combat) {
  const list = actor?.flags?.essence20?.[SCHEDULE];
  if (!Array.isArray(list) || !list.length || !combat) {
    return;
  }

  const due = [];
  const kept = [];
  for (const entry of list) {
    if (entry.turnEndsLeft === undefined || entry.combatId != combat.id) {
      kept.push(entry);
      continue;
    }

    const left = entry.turnEndsLeft - 1;
    (left > 0 ? kept : due).push({ ...entry, turnEndsLeft: left });
  }

  if (!due.length && kept.every((entry, i) => entry === list[i])) {
    return;
  }

  await actor.update({ [`flags.essence20.${SCHEDULE}`]: kept });
  for (const entry of due) {
    await runEntry(actor, entry);
  }
}

/** An actor's turn started: its turn-start-counted entries tick down; those at zero run. */
export async function scheduledTurnStart(actor, combat) {
  const list = actor?.flags?.essence20?.[SCHEDULE];
  if (!Array.isArray(list) || !list.length || !combat) {
    return;
  }

  const due = [];
  const kept = [];
  for (const entry of list) {
    if (entry.turnStartsLeft === undefined || entry.combatId != combat.id) {
      kept.push(entry);
      continue;
    }

    const left = entry.turnStartsLeft - 1;
    (left > 0 ? kept : due).push({ ...entry, turnStartsLeft: left });
  }

  if (!due.length && kept.every((entry, i) => entry === list[i])) {
    return;
  }

  await actor.update({ [`flags.essence20.${SCHEDULE}`]: kept });
  for (const entry of due) {
    await runEntry(actor, entry);
  }
}

/** A round started: round-counted entries that are due run. */
export async function scheduledRoundStart(combat, actors = worldActors()) {
  for (const actor of actors) {
    const list = actor?.flags?.essence20?.[SCHEDULE];
    if (!Array.isArray(list) || !list.length) {
      continue;
    }

    const due = list.filter(entry => entry.dueRound !== undefined && entry.combatId == combat?.id && combat.round >= entry.dueRound);
    if (!due.length) {
      continue;
    }

    await actor.update({ [`flags.essence20.${SCHEDULE}`]: list.filter(entry => !due.includes(entry)) });
    for (const entry of due) {
      await runEntry(actor, entry);
    }
  }
}

registerTurnEnd((actor, combat) => scheduledTurnEnd(actor, combat));
registerTurnStart((actor, combat) => scheduledTurnStart(actor, combat));
registerRoundStart(combat => scheduledRoundStart(combat));

/* -------------------------------------------- */
/*  Rigs                                         */
/* -------------------------------------------- */

registerStep('rig', async (step, ctx) => {
  const id = globalThis.foundry?.utils?.randomID?.() ?? String(Date.now());
  await write(ctx.actor, 'update', [{ [`flags.essence20.${RIGS}.${id}`]: true }]);
  ctx.vars[step.var || 'rig'] = id;
});

registerStep('requireRig', async (step, ctx) => {
  const id = ctx.vars?.[step.var || 'rig'];
  if (!id || !ctx.actor?.flags?.essence20?.[RIGS]?.[id]) {
    if (step.message) {
      ctx.chat.push(escape(step.message));
    }

    return false;
  }
});

registerStep('endRig', async (step, ctx) => {
  const id = ctx.vars?.[step.var || 'rig'];
  if (id) {
    await write(ctx.actor, 'update', [{ [`flags.essence20.${RIGS}.-=${id}`]: null }]);
  }
});

/* -------------------------------------------- */
/*  Damage buttons                               */
/* -------------------------------------------- */

const localize = key => globalThis.game?.i18n?.localize?.(key) ?? key;

/** An Apply Damage button for one actor (the check card's own apply-damage action). */
export function damageButtonHtml(actor, key, amount, damageType, label = null) {
  const typeLabel = localize(globalThis.CONFIG?.E20?.damageTypes?.[damageType] ?? damageType);
  return `<button type="button" class="e20-check-damage-button" data-action="apply-damage" data-key="${actor.uuid}:${key}"
    data-target-uuid="${actor.uuid}" data-damage="${amount}" data-damage-type="${damageType}">
    ${escape(label ?? actor.name)}: ${amount} ${escape(typeLabel)}</button>`;
}

async function postButtons(ctx, title, buttons, rolls = undefined) {
  if (!buttons.length || !globalThis.ChatMessage?.create) {
    return;
  }

  await globalThis.ChatMessage.create({
    speaker: globalThis.ChatMessage.getSpeaker?.({ actor: ctx.actor }), ...(rolls ? { rolls } : {}),
    content: `<div class="e20-check-card"><p>${escape(title)}</p>${buttons.join('')}</div>`,
  });
}

const pointOf = ctx => {
  const x = Number(ctx.vars?.pointX);
  const y = Number(ctx.vars?.pointY);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
};

/** The point's tokens - only on the scene it was picked on. */
function tokensAt(ctx, radius) {
  const scene = ctx.vars?.pointScene;
  if (scene && globalThis.canvas?.scene?.id && scene != globalThis.canvas.scene.id) {
    return [];
  }

  return tokensAround(pointOf(ctx), radius);
}

registerStep('damageCard', async (step, ctx) => {
  const uuid = fill(step.actor, ctx);
  const actors = step.actor === undefined && step.to ? recipients(step, ctx) : [uuid ? globalThis.fromUuidSync?.(uuid, { strict: false }) ?? null : null].filter(Boolean);
  if (!actors.length) {
    return;
  }

  const amount = Math.max(0, Math.round(resolveValue(step.amount ?? 1, { actor: ctx.actor, item: ctx.item, vars: ctx.vars }, 1)));
  await postButtons(ctx, fill(step.title, ctx), actors.map(actor => damageButtonHtml(actor, 'ruleDamage', amount, step.damageType ?? 'blunt')));
});

/** Ask Toughness or Evasion. */
async function askDefense(ctx) {
  if (ctx.askDefense) {
    return ctx.askDefense(ctx);
  }

  const { chooseButtons } = await import("../../../mechanics/resources/grants.mjs");
  return chooseButtons(ctx.item?.name ?? '', T('WhichDefense'), [['toughness', localize('E20.DefenseToughness')], ['evasion', localize('E20.DefenseEvasion')]]);
}

registerStep('blast', async (step, ctx) => {
  // defense: a name, "ask", or a formula giving 1 Toughness, 2 Evasion, 3 Willpower, 4 Cleverness (@var.defense).
  const DEFENSES = ['toughness', 'evasion', 'willpower', 'cleverness'];
  const defense = step.defense == 'ask' ? await askDefense(ctx)
    : DEFENSES.includes(step.defense) ? step.defense : DEFENSES[Math.round(resolveValue(step.defense, { actor: ctx.actor, item: ctx.item, vars: ctx.vars }, 0)) - 1];
  if (!['toughness', 'evasion', 'willpower', 'cleverness'].includes(defense)) {
    return false;
  }

  const title = fill(step.title, ctx) || ctx.item?.name || '';
  const aimed = new Set(ctx.targets.map(target => target?.uuid).filter(Boolean));
  const tokenActor = token => token?.actor ?? null;
  const tokens = (step.at == 'targets'
    ? ctx.targets.map(target => target?.token?.object ?? target?.getActiveTokens?.()?.[0] ?? null).filter(Boolean)
    : tokensAt(ctx, Number(step.radius) || 0))
    .filter(token => !step.excludeTargets || !aimed.has(tokenActor(token)?.uuid));
  if (!tokens.length) {
    await globalThis.ChatMessage?.create?.({ speaker: globalThis.ChatMessage.getSpeaker?.({ actor: ctx.actor }), content: `<p>${escape(T('BlastEmpty', { name: title }))}</p>` });
    return;
  }

  globalThis.canvas?.tokens?.setTargets?.(tokens.map(token => token.id));
  const skill = step.skill ?? 'technology';
  const essence = globalThis.CONFIG?.E20?.skillToEssence?.[skill] ?? 'smarts';
  const rolled = await ctx.actor?._dice?.rollSkill?.({ skill, essence, shiftUp: 0, shiftDown: 0, defenseType: defense }, ctx.actor);
  const results = (rolled?.outcomes ?? []).flatMap(outcome => outcome.results ?? []);
  const damage = Math.max(0, Math.round(resolveValue(step.damage ?? 1, { actor: ctx.actor, item: ctx.item, vars: ctx.vars }, 1)));
  const buttons = [];
  if (Array.isArray(step.packets)) {
    for (const [index, result] of results.entries()) {
      const found = result.targetUuid ? await globalThis.fromUuid?.(result.targetUuid) : null;
      const actor = found?.documentName == 'Token' ? found.actor : found;
      const packets = result.success ? step.packets : step.missPackets ?? [];
      if (!actor || !packets.length) {
        continue;
      }

      const label = result.success ? actor.name : `${actor.name} (${localize('E20.RulesExtItems2.Defended')})`;
      packets.forEach((packet, at) => buttons.push(damageButtonHtml(actor, `ruleBlast:${index}:${at}`, Math.max(0, Math.round(Number(packet.amount) || 0)), packet.type ?? 'blunt', label)));
    }

    await postButtons(ctx, title, buttons);
    return;
  }

  for (const [index, result] of results.entries()) {
    const target = result.success && result.targetUuid ? await globalThis.fromUuid?.(result.targetUuid) : null;
    const actor = target?.documentName == 'Token' ? target.actor : target;
    if (actor) {
      buttons.push(damageButtonHtml(actor, `ruleBlast:${index}`, damage * Math.max(1, result.multiplier ?? 1), step.damageType ?? 'blunt'));
    }
  }

  await postButtons(ctx, title, buttons);
}, { errors: (step, where) => (step.radius === undefined && step.at != 'targets' ? [`${where}: blast needs a radius`] : []) });

/** A plain save: the best of the Skills (d20 + the die + its modifier) against the DIF. */
async function plainSave(actor, skills, dif) {
  const totals = [];
  for (const skill of skills) {
    const data = actor.system?.skills?.[skill];
    if (!data) {
      continue;
    }

    const formula = data.shift && data.shift != 'd20' ? `d20 + ${data.shift}` : 'd20';
    const roll = await new globalThis.Roll(`${formula} + ${Number(data.modifier) || 0}`).evaluate();
    totals.push(roll.total);
  }

  return Math.max(0, ...totals) >= dif;
}

registerStep('explosion', async (step, ctx) => {
  const roll = await new globalThis.Roll(fill(step.formula ?? '2d2', ctx)).evaluate();
  const buttons = [];
  const half = T('Half');
  for (const [index, token] of tokensAt(ctx, Number(step.radius) || 0).entries()) {
    const saved = await plainSave(token.actor, step.saveSkills ?? ['athletics', 'acrobatics'], Number(step.saveDif) || 14);
    const amount = saved ? Math.ceil(roll.total / 2) : roll.total;
    buttons.push(damageButtonHtml(token.actor, `ruleExplosion:${index}`, amount, step.damageType ?? 'fire', `${token.name}${saved ? ` (${half})` : ''}`));
  }

  await globalThis.ChatMessage?.create?.({
    speaker: globalThis.ChatMessage.getSpeaker?.({ actor: ctx.actor }), rolls: [roll],
    content: `<div class="e20-check-card"><p>${escape(fill(step.title, ctx).replace(/\{damage\}/g, String(roll.total)))}</p>${buttons.join('')}</div>`,
  });
}, { errors: (step, where) => (step.radius === undefined || !step.formula ? [`${where}: explosion needs a radius and a formula`] : []) });

registerStep('explodeVehicle', async (step, ctx) => {
  const uuid = fill(step.actor, ctx);
  const vehicle = uuid ? globalThis.fromUuidSync?.(uuid, { strict: false }) ?? null : null;
  if (!vehicle) {
    return false;
  }

  const { explodeVehicle } = await import("../../../mechanics/vehicles/vehicle-defeat.mjs");
  await explodeVehicle(vehicle);
});

