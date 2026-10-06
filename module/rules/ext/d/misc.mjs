import { registerDialogToggles, registerApplyDialog, registerDerived, registerPreRoll, registerTurnStart } from "../../../helpers/extensions.mjs";
import { registerRef, resolveValue } from "../../formula.mjs";
import { ruleId, rulesOfType } from "../../index.mjs";
import { contextFor, evaluate, interpolate, registerTag } from "../../predicate.mjs";
import { recipients, registerPickSource, registerRecipient, registerStep } from "../../steps.mjs";
import { registerRuleType } from "../../types.mjs";
import { escape, listOf, sameSide, T, worldActors, write } from "./common.mjs";

/**
 * Small steps, recipients, tags and refs (round 10, group D) - see docs/rules-batches/slD10.md for each.
 */

const amount = (value, ctx, fallback = 0, recipient = null) => Math.round(resolveValue(value, { actor: ctx.actor, item: ctx.item, vars: ctx.vars, other: ctx.targets?.[0] ?? null, recipient }, fallback));

/* -------------------------------------------- */
/*  Run helpers                                  */
/* -------------------------------------------- */

// countTargets {var}: how many targets the run has (@var.<var>).
registerStep('countTargets', async (step, ctx) => {
  ctx.vars[step.var || 'targets'] = ctx.targets.length;
});

// countRecipients {to, filter?, var}: how many actors `to` reaches (@var.<var>).
registerStep('countRecipients', async (step, ctx) => {
  ctx.vars[step.var || 'count'] = recipients(step, ctx).length;
});

// targetRecipients {to, filter?}: the actors `to` reaches become the run's targets (nothing on the canvas changes) - a
// list that later steps reach with to: target / targets, kept even when what chose them changes.
registerStep('targetRecipients', async (step, ctx) => {
  ctx.targets = recipients(step, ctx);
});

// targetSelf: the actor itself becomes the run's target (a button card it posts carries it to the presser).
registerStep('targetSelf', async (step, ctx) => {
  ctx.targets = ctx.actor ? [ctx.actor] : [];
});

// clearMarks {key, to}: every mark under the key on the recipients - each setter's own copy too (perSetter).
registerStep('clearMarks', async (step, ctx) => {
  for (const actor of recipients(step, ctx)) {
    const names = Object.keys(actor.flags?.essence20?.ruleMarks ?? {}).filter(name => name == step.key || name.startsWith(`${step.key}--`));
    if (names.length) {
      await write(actor, 'update', [Object.fromEntries(names.map(name => [`flags.essence20.ruleMarks.-=${name}`, null]))]);
    }
  }
}, { errors: (step, where) => (step.key ? [] : [`${where}: clearMarks needs a key`]) });

// claimCard: in a button's steps - the actor pressing (each presser's own with runAs: clicker) may answer this card once;
// a second press by the same actor stops here. The claim is kept on the card (flags.essence20.ruleButton.claimed).
registerStep('claimCard', async (step, ctx) => {
  const message = ctx.buttonMessage;
  const uuid = ctx.actor?.uuid;
  if (!message || !uuid) {
    return false;
  }

  const claimed = message.flags?.essence20?.ruleButton?.claimed ?? [];
  if (claimed.includes(uuid)) {
    globalThis.ui?.notifications?.warn?.(T('AlreadyAnswered', { name: ctx.actor.name }));
    return false;
  }

  await write(message, 'update', [{ 'flags.essence20.ruleButton.claimed': [...claimed, uuid] }]);
});

// rememberTarget {var}: the first target's uuid, kept for later steps ({var.<var>}) after the targets change.
registerStep('rememberTarget', async (step, ctx) => {
  const target = ctx.targets[0];
  if (!target && step.required !== false) {
    return false;
  }

  ctx.vars[step.var || 'target'] = target?.uuid ?? '';
});

/** Ask for a line of text. */
async function askText(step, ctx) {
  if (ctx.askText) {
    return ctx.askText(step, ctx);
  }

  const { DialogV2 } = globalThis.foundry.applications.api;
  const value = await DialogV2.prompt({
    window: { title: ctx.item?.name ?? '' },
    classes: ['essence20', 'e20-window'],
    content: `<div class="form-group"><label>${escape(step.prompt ?? '')}</label><input type="text" name="text" value="" autofocus></div>`,
    ok: { callback: (event, button) => String(button.form.elements.text.value ?? '') },
    rejectClose: false,
  });
  return typeof value == 'string' ? value : null;
}

// askText {var, prompt, firstWord?}: the player types something ({var.<var>}); empty or cancelled stops the run.
registerStep('askText', async (step, ctx) => {
  let text = await askText(step, ctx);
  text = String(text ?? '').trim();
  if (step.firstWord) {
    text = text.split(/\s+/)[0] ?? '';
  }

  if (!text) {
    return false;
  }

  ctx.vars[step.var || 'text'] = text;
}, { errors: (step, where) => (step.var && !/^[\w-]+$/.test(step.var) ? [`${where}: var must be a plain name`] : []) });

// spendActions {action, count}: spend that many actions of a kind (in combat); stops when one can't be paid.
registerStep('spendActions', async (step, ctx) => {
  const count = Math.max(0, amount(step.count ?? 1, ctx, 1));
  if (!globalThis.game?.combat) {
    return;
  }

  const { spend } = await import("../../../helpers/action-economy.mjs");
  for (let i = 0; i < count; i++) {
    const paid = await spend(ctx.actor, step.action ?? 'free', { source: ctx.item?.name ?? null });
    if (paid?.blocked) {
      return false;
    }
  }
}, { errors: (step, where) => (step.action && !['free', 'move', 'standard'].includes(step.action) ? [`${where}: action must be free, move or standard`] : []) });

/* -------------------------------------------- */
/*  At the start of someone's turn               */
/* -------------------------------------------- */

const QUEUE_FLAG = 'ruleTurnQueue';

/**
 * queueTurnStart {to, spendAction?, whisper?}: when each recipient's next turn starts in this combat, it spends that
 * action (when the action economy is tracking) and its owners are told `whisper` ({var.x} filled now).
 */
registerStep('queueTurnStart', async (step, ctx) => {
  const text = step.whisper ? (interpolate(String(step.whisper), ctx.item) ?? String(step.whisper)).replace(/\{var\.([\w-]+)\}/g, (m, key) => String(ctx.vars?.[key] ?? '')).replace(/\{name\}/g, ctx.actor?.name ?? '') : '';
  for (const actor of recipients(step, ctx)) {
    const queue = Array.isArray(actor.flags?.essence20?.[QUEUE_FLAG]) ? actor.flags.essence20[QUEUE_FLAG] : [];
    await write(actor, 'update', [{ [`flags.essence20.${QUEUE_FLAG}`]: [...queue, {
      action: step.spendAction ?? null, text, source: ctx.item?.name ?? '', combatId: globalThis.game?.combat?.id ?? null,
    }] }]);
  }
}, { errors: (step, where) => (step.spendAction && !['free', 'move', 'standard'].includes(step.spendAction) ? [`${where}: spendAction must be free, move or standard`] : []) });

export async function runTurnQueue(actor, combat) {
  const queue = actor?.flags?.essence20?.[QUEUE_FLAG];
  if (!Array.isArray(queue) || !queue.length) {
    return;
  }

  await actor.update({ [`flags.essence20.${QUEUE_FLAG}`]: [] });
  for (const entry of queue) {
    if (entry.combatId && entry.combatId != combat?.id) {
      continue;
    }

    if (entry.action) {
      const { isTracking, spend } = await import("../../../helpers/action-economy.mjs");
      if (isTracking()) {
        await spend(actor, entry.action, { source: entry.source });
      }
    }

    if (entry.text && globalThis.ChatMessage?.create) {
      const owners = listOf(globalThis.game?.users).filter(user => user.isGM || actor.testUserPermission?.(user, 'OWNER')).map(user => user.id);
      await globalThis.ChatMessage.create({ speaker: globalThis.ChatMessage.getSpeaker?.({ actor }), content: `<p>${escape(entry.text)}</p>`, whisper: owners });
    }
  }
}

registerTurnStart((actor, combat) => runTurnQueue(actor, combat));

/* -------------------------------------------- */
/*  Retrying the last Skill Test                 */
/* -------------------------------------------- */

/** Only plain values survive into a chat-card flag. */
export function plainDataset(dataset) {
  return Object.fromEntries(Object.entries(dataset ?? {}).filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value) || value === null));
}

/** Each actor's latest Skill Test as it started (dataset and item). */
export const LAST_ROLL = new Map();

registerPreRoll((actor, dataset, item) => {
  if (actor?.uuid) {
    LAST_ROLL.set(actor.uuid, { dataset: plainDataset(dataset), itemUuid: item?.uuid ?? null });
  }
});

/**
 * captureRoll {var}: the actor's latest Skill Test, kept in @var.<var> (a text the button cards carry) for a later
 * retryRoll; @var.chain is how many retries in a row this one would be.
 */
registerStep('captureRoll', async (step, ctx) => {
  const last = LAST_ROLL.get(ctx.actor?.uuid);
  if (!last) {
    return false;
  }

  const chain = (Number(last.dataset.e20RetryChain) || 0) + 1;
  const base = last.dataset.e20RetryBase ?? last.dataset.shiftDown ?? 0;
  ctx.vars[step.var || 'retry'] = JSON.stringify({ itemUuid: last.itemUuid, dataset: { ...last.dataset, e20RetryBase: base, e20RetryChain: chain } });
  ctx.vars.chain = chain;
});

/** The retried dataset: its base ↓ plus `downEach` per retry in the chain (cumulative). */
export function retryDataset(saved, downEach = 1) {
  const dataset = { ...(saved?.dataset ?? {}) };
  dataset.shiftDown = (Number(dataset.e20RetryBase) || 0) + (Number(dataset.e20RetryChain) || 0) * downEach;
  return dataset;
}

// retryRoll {var, downEach?}: roll the captured Skill Test again, ↓downEach per retry in the chain.
registerStep('retryRoll', async (step, ctx) => {
  let saved = null;
  try {
    saved = JSON.parse(String(ctx.vars?.[step.var || 'retry'] ?? ''));
  } catch (error) {
    saved = null;
  }

  if (!saved?.dataset || !ctx.actor?._dice?.rollSkill) {
    return false;
  }

  const item = saved.itemUuid ? await globalThis.fromUuid?.(saved.itemUuid) : null;
  await ctx.actor._dice.rollSkill(retryDataset(saved, Number(step.downEach ?? 1) || 1), ctx.actor, item);
});

// recastFree {item}: cast that spell again at no cost (item: {var.itemUuid} - the rolled item an afterRoll Trigger saw).
registerStep('recastFree', async (step, ctx) => {
  const uuid = String(step.item ?? '').replace(/\{var\.([\w-]+)\}/g, (m, key) => String(ctx.vars?.[key] ?? ''));
  const spell = uuid ? await globalThis.fromUuid?.(uuid) : null;
  if (!spell?.roll || spell.type != 'spell' || !ctx.actor?.isOwner) {
    return false;
  }

  await spell.roll({ rollType: 'spell', freeCast: true });
});

/* -------------------------------------------- */
/*  Bonus-die bank                               */
/* -------------------------------------------- */

const DICE_FLAG = 'ruleBonusDice';
const HEADS_FLAG = 'pendingMoreHeads';

export const bankedDice = actor => (Array.isArray(actor?.flags?.essence20?.[DICE_FLAG]) ? actor.flags.essence20[DICE_FLAG] : []);

// bankDie {die, appliesWhen, to}: a bonus die kept for the next roll matching appliesWhen (the More Heads bonus-die
// slot, read before the Roll Options Dialog); any other roll first leaves it banked.
registerStep('bankDie', async (step, ctx) => {
  const die = String(step.die ?? '');
  if (!/^\d*d\d+$/.test(die)) {
    return false;
  }

  for (const actor of recipients(step, ctx)) {
    const entry = { id: globalThis.foundry?.utils?.randomID?.() ?? String(Date.now()), die, when: step.appliesWhen ?? [], source: ctx.item?.id ?? null, label: ctx.item?.name ?? '' };
    await write(actor, 'update', [{ [`flags.essence20.${DICE_FLAG}`]: [...bankedDice(actor), entry] }]);
    ctx.chat.push(escape(T('DieBanked', { name: actor.name, die })));
  }
}, { errors: (step, where) => (/^\d*d\d+$/.test(String(step.die ?? '')) ? [] : [`${where}: bankDie needs a die (1d4, 1d8...)`]) });

/**
 * Before a roll: a banked die whose condition this roll meets moves into the More Heads bonus-die slot (the dice.mjs
 * pendingMoreHeads flag); a die that moved there for an earlier roll that never happened goes back to the bank.
 */
export async function bonusDicePreRoll(actor, dataset, item) {
  const heads = actor?.flags?.essence20?.[HEADS_FLAG];
  const list = bankedDice(actor);
  // A legacy Prospector Toolkit die (pr1ProspectorDie) joins the bank as a Wealth die.
  const legacy = actor?.flags?.essence20?.pr1ProspectorDie;
  const all = legacy ? [...list, { id: 'legacy', die: legacy, when: ['skill:wealth'], source: null, label: '' }] : list;
  const match = all.find(entry => evaluate(entry.when, contextFor({ self: actor, item, rolledSkill: dataset?.skill, dataset })) === true);
  if (!match) {
    if (heads?.ruleBonusDie) {
      await actor.update({
        [`flags.essence20.${DICE_FLAG}`]: [...list, heads.ruleBonusDie],
        [`flags.essence20.${HEADS_FLAG}`]: heads.rulePrevious ?? null,
      });
    }

    return;
  }

  if (heads?.ruleBonusDie) {
    return;
  }

  const update = {
    [`flags.essence20.${DICE_FLAG}`]: list.filter(entry => entry.id != match.id),
    [`flags.essence20.${HEADS_FLAG}`]: {
      bonusDie: heads?.bonusDie ? `${heads.bonusDie} + ${match.die}` : match.die,
      combatId: globalThis.game?.combat?.id ?? null, round: globalThis.game?.combat?.round ?? null,
      ruleBonusDie: { ...match, id: match.id == 'legacy' ? 'legacy-moved' : match.id }, rulePrevious: heads ?? null,
    },
  };
  if (legacy) {
    update['flags.essence20.-=pr1ProspectorDie'] = null;
  }

  await actor.update(update);
}

registerPreRoll(bonusDicePreRoll);

// rule:bankedDie - a die this rule's item banked is still waiting (or moved into the bonus-die slot for a roll).
registerTag('rule:bankedDie', (rest, ctx) => {
  const actor = ctx.self;
  const id = ctx.ruleItem?.id;
  return bankedDice(actor).some(entry => entry.source == id) || actor?.flags?.essence20?.[HEADS_FLAG]?.ruleBonusDie?.source == id
    || !!actor?.flags?.essence20?.pr1ProspectorDie;
});

/* -------------------------------------------- */
/*  Temporary resources and team grants           */
/* -------------------------------------------- */

// tempResource {kind: health | energon, amount, to, untilDamage?}: temporary Health / Energon through the resource
// slice's ledger (taken back at the scene's end); `amount` is worked out for each recipient. Energon only reaches
// actors that have it.
registerStep('tempResource', async (step, ctx) => {
  const { grantTemp } = await import("../../../helpers/extensions/resource/temp-resources.mjs");
  const kind = step.kind == 'energon' ? 'energon' : 'health';
  for (const actor of recipients(step, ctx)) {
    if (kind == 'energon' && !actor.system?.energon?.normal) {
      continue;
    }

    const value = Math.max(0, amount(step.amount ?? 1, ctx, 1, actor));
    await grantTemp(actor, { kind, amount: value, source: ctx.item?.name ?? '', by: ctx.actor?.uuid ?? null, untilDamage: !!step.untilDamage });
    ctx.chat.push(escape(T(kind == 'energon' ? 'TempEnergon' : 'TempHealth', { name: actor.name, amount: value })));
  }
}, { errors: (step, where) => (step.kind && !['health', 'energon'].includes(step.kind) ? [`${where}: kind must be health or energon`] : []) });

/** The actor's teammates: everyone on any Party roster with it (itself included). */
export function teamOf(actor, actors = worldActors()) {
  const seen = new Map([[actor?.uuid, actor]]);
  for (const party of actors.filter(other => other?.type == 'party' && Object.values(other.system?.actors ?? {}).some(entry => entry?.uuid == actor?.uuid))) {
    for (const member of listOf(party.members)) {
      seen.set(member.uuid, member);
    }
  }

  return [...seen.values()].filter(Boolean);
}

/** Teammates (teamOf) who are combatants in the running combat - the actor too when it is one. */
export function teamCombatants(actor, combat = globalThis.game?.combat) {
  const uuids = new Set(listOf(combat?.combatants).map(c => c.actor?.uuid).filter(Boolean));
  return teamOf(actor).filter(member => uuids.has(member.uuid));
}

registerRecipient('teamCombatants', (match, ctx) => teamCombatants(ctx.actor));
registerRef('teamCombatants', (key, scope) => teamCombatants(scope.actor).length);

// driverOrSelf: a Zord's driver (its pilot pays), else the actor itself (a Zord with no driver, a Megaform, anyone else).
registerRecipient('driverOrSelf', (match, ctx) => {
  const actor = ctx.actor;
  if (actor?.type == 'zord') {
    const seat = Object.values(actor.system?.actors ?? {}).find(crew => crew?.vehicleRole == 'driver');
    const driver = seat ? globalThis.fromUuidSync?.(seat.uuid, { strict: false }) ?? null : null;
    if (driver) {
      return [driver];
    }
  }

  return actor ? [actor] : [];
});

// spendFor {resource: {path}, amount, to}: each recipient pays from its own value at the path; the run stops (nothing
// taken) when one of them can't.
registerStep('spendFor', async (step, ctx) => {
  const path = step.resource?.path;
  const list = recipients(step, ctx);
  const value = Math.max(0, amount(step.amount ?? 1, ctx, 1));
  const have = actor => Number(path.split('.').reduce((at, key) => at?.[key], actor)) || 0;
  const short = list.find(actor => have(actor) < value);
  if (!list.length || short) {
    globalThis.ui?.notifications?.warn?.(T('CannotPay', { name: short?.name ?? '' }));
    return false;
  }

  for (const actor of list) {
    await write(actor, 'update', [{ [path]: have(actor) - value }]);
  }

  ctx.vars.spent = value;
}, { errors: (step, where) => (step.resource?.path ? [] : [`${where}: spendFor needs resource.path`]) });

// combat:roundIs:<n> - the running combat is in that round.
registerTag('combat:roundIs', rest => {
  const combat = globalThis.game?.combat;
  return combat?.started ? Number(combat.round) == Number(rest) : false;
});

// allOf:<tag>&<tag>... - every one of the tags holds (an AND inside an `any` list).
registerTag('allOf', (rest, ctx) => {
  const answers = String(rest).split('&').filter(Boolean).map(tag => evaluate([tag], ctx));
  return answers.includes(false) ? false : answers.includes(null) ? null : answers.length > 0;
}, { family: 'roll', param: 'text' });

// attackHands:<n> - the rolled attack belongs to a weapon held in at least n hands (its derived hands, else its hands,
// else the attack's own).
registerTag('attackHands', (rest, ctx) => {
  const effect = ctx.item;
  if (effect?.type != 'weaponEffect') {
    return false;
  }

  const parentId = effect.flags?.essence20?.parentId;
  const owner = effect.parent ?? ctx.self;
  const weapon = parentId ? owner?.items?.get?.(parentId) ?? listOf(owner?.items).find(item => item.id == parentId) ?? null : null;
  const hands = Number(weapon?.system?.derivedHands ?? weapon?.system?.hands ?? effect.system?.numHands ?? 1);
  return !!weapon && hands >= Number(rest);
}, { family: 'roll', param: 'text' });

// target:uuid:<uuid> - the other party is that actor ({var.x} / {choice.x} filled first).
registerTag('target:uuid', (rest, ctx) => (ctx.other ? ctx.other.uuid == rest : false));

// @targetKeyed.<path>: a number this actor keeps per target under a flag object keyed by the target's uuid with its
// dots as dashes (flags.essence20.analyzeTargetCounts) - for the run's first target.
registerRef('targetKeyed', (key, scope) => {
  const other = scope.other;
  if (!other?.uuid) {
    return 0;
  }

  const table = key.split('.').reduce((at, part) => at?.[part], scope.actor);
  return Number(table?.[other.uuid.replace(/\./g, '-')]) || 0;
});

// pick from: sideActors - this actor's side (the running combat's combatants, else every world actor), not the first
// target; inCombat / notSelf narrow it.
registerPickSource('sideActors', (step, ctx) => {
  const combat = globalThis.game?.combat;
  const pool = combat ? listOf(combat.combatants).map(c => c.actor).filter(Boolean) : worldActors();
  const target = ctx.targets[0];
  return [...new Set(pool)].filter(other => sameSide(other, ctx.actor) && other !== target && !(step.notSelf && other === ctx.actor))
    .map(other => ({ value: other.uuid, label: other.name }));
});

/** Tick allies (within `within` feet, not the actor) in one dialog: the chosen ones. */
async function askAllies(step, candidates, ctx) {
  if (ctx.askAllies) {
    return ctx.askAllies(step, candidates, ctx);
  }

  const { DialogV2 } = globalThis.foundry.applications.api;
  const chosen = await DialogV2.wait({
    window: { title: ctx.item?.name ?? '' },
    classes: ['window-app', 'e20-window'],
    content: `<p>${escape((step.prompt ?? '').replace(/\{target\}/g, ctx.targets[0]?.name ?? ''))}</p>`
      + candidates.map(ally => `<div class="form-group"><label><input type="checkbox" name="${ally.id}" /> ${escape(ally.name)}</label></div>`).join(''),
    buttons: [
      { action: 'ok', label: globalThis.game.i18n.localize('E20.DialogConfirmButton'), default: true, callback: (event, button) => candidates.filter(ally => button.form.elements[ally.id]?.checked) },
      { action: 'cancel', label: globalThis.game.i18n.localize('E20.DialogCancelButton') },
    ],
    rejectClose: false,
  });
  return Array.isArray(chosen) ? chosen : [];
}

// checkAllies {within, prompt?}: tick any of the allies within range (helpers/allies.mjs, not the actor) - they become
// the targets. None ticked (or none in range) stops the run.
registerStep('checkAllies', async (step, ctx) => {
  const { getNearbyAllyTokens } = await import("../../../helpers/allies.mjs");
  const within = step.within === undefined ? Infinity : amount(step.within, ctx, 0);
  const candidates = [...new Set(getNearbyAllyTokens(ctx.actor, within).map(token => token.actor).filter(ally => ally && ally.id != ctx.actor?.id))];
  if (!candidates.length) {
    return false;
  }

  const chosen = await askAllies(step, candidates, ctx);
  if (!chosen.length) {
    return false;
  }

  ctx.targets = chosen;
});

// lendAssistEdge {to, against, actionEach?}: each recipient gets Lend Assistance's attack benefit (an Edge on its first
// attack against `against` - an actor uuid, {var.x} filled - helpers/lend-assistance.mjs's pendingLendAssistanceEdge),
// each costing `actionEach` (in combat; the first that can't be paid stops it).
registerStep('lendAssistEdge', async (step, ctx) => {
  const uuid = String(step.against ?? '').replace(/\{var\.([\w-]+)\}/g, (m, key) => String(ctx.vars?.[key] ?? ''));
  const against = uuid ? globalThis.fromUuidSync?.(uuid, { strict: false }) ?? null : null;
  const foe = against?.documentName == 'Token' ? against.actor : against;
  if (!foe) {
    return false;
  }

  const combat = globalThis.game?.combat;
  const economy = combat && step.actionEach ? await import("../../../helpers/action-economy.mjs") : null;
  const granted = [];
  for (const ally of recipients(step, ctx)) {
    if (economy && (await economy.spend(ctx.actor, step.actionEach, { source: ctx.item?.name ?? null }))?.blocked) {
      break;
    }

    await write(ally, 'setFlag', ['essence20', 'pendingLendAssistanceEdge', { targetId: foe.id ?? null, edge: true, combatId: combat?.id ?? null, round: combat?.round ?? null }]);
    granted.push(ally.name);
  }

  if (granted.length) {
    ctx.chat.push(escape(T('AssistLent', { name: ctx.actor?.name ?? '', allies: granted.join(', '), target: foe.name })));
  }
}, { errors: (step, where) => (step.against ? [] : [`${where}: lendAssistEdge needs against`]) });

/* -------------------------------------------- */
/*  HardpointUse                                 */
/* -------------------------------------------- */

// HardpointUse {items: [item tags asked of each equipped weapon], slots}: those weapons take `slots` hardpoints (in
// their hardpoint type) instead of one per hand.
registerRuleType('HardpointUse', {
  params: { items: { kind: 'object', required: true }, slots: { kind: 'formula', required: true } },
  scopes: ['self'],
  validate: rule => (Array.isArray(rule.items) ? [] : ['items must be a list of item tags']),
});

export function hardpointUseDerived(actor) {
  const system = actor?.system;
  const entries = rulesOfType(actor, 'HardpointUse');
  if (!entries.length || !system?.hardpoints) {
    return;
  }

  for (const weapon of listOf(actor.items)) {
    if (weapon.type != 'weapon' || !weapon.system?.equipped) {
      continue;
    }

    const entry = entries.find(({ rule, item }) => evaluate(rule.items, contextFor({ self: actor, ruleItem: item, item: weapon })) === true);
    if (!entry) {
      continue;
    }

    const slot = system.hardpoints[weapon.system.hardpoint?.type ?? 'external'];
    const hands = Math.max(1, Number(weapon.system.derivedHands ?? weapon.system.hands ?? 1) || 1);
    const slots = Math.max(0, Math.round(resolveValue(entry.rule.slots, { actor, item: entry.item }, 1)));
    const extra = hands - slots;
    if (slot && extra > 0) {
      slot.used = Math.max(0, (Number(slot.used) || 0) - extra);
      slot.over = slot.used > (Number(slot.max) || 0);
    }
  }
}

registerDerived(hardpointUseDerived);

/* -------------------------------------------- */
/*  StanceSwitch                                 */
/* -------------------------------------------- */

// StanceSwitch {stance: allOutAttack | evasiveFighting, max}: a number box (0..max) in the Roll Options Dialog while
// `when` holds; the number chosen is that many ↓ on the roll and the actor's rider stance (target-riders.mjs - enemies
// attacking it get as many ↑ / ↓ until its next turn starts); All Out Attack's also adds that much damage to one hit.
registerRuleType('StanceSwitch', {
  params: { stance: { kind: 'enum', options: ['allOutAttack', 'evasiveFighting'], required: true }, max: { kind: 'formula' } },
  scopes: ['self'],
});

export function stanceToggles(actor, roll = {}) {
  return rulesOfType(actor, 'StanceSwitch').filter(({ rule, item }) => evaluate(rule.when, contextFor({ ...roll, self: actor, ruleItem: item, isAttack: roll.item?.type == 'weaponEffect' })) === true)
    .map(({ rule, item, index }) => ({
      name: `${ruleId(item, index)}-stance`, label: rule.label || item.name, type: 'number', value: 0,
      max: Math.max(0, Math.round(resolveValue(rule.max ?? 5, { actor, item }, 5))),
    }));
}

export async function stanceApply(actor, options) {
  const ext = options.ext ?? {};
  const totals = { allOutAttack: 0, evasiveFighting: 0 };
  for (const { rule, item, index } of rulesOfType(actor, 'StanceSwitch')) {
    const max = Math.max(0, Math.round(resolveValue(rule.max ?? 5, { actor, item }, 5)));
    totals[rule.stance] += Math.max(0, Math.min(max, Number(ext[`${ruleId(item, index)}-stance`]) || 0));
  }

  if (!totals.allOutAttack && !totals.evasiveFighting) {
    return;
  }

  options.shiftDown = (Number(options.shiftDown) || 0) + totals.allOutAttack + totals.evasiveFighting;
  options.allOutAttackShifts = (Number(options.allOutAttackShifts) || 0) + totals.allOutAttack;
  const riders = await import("../../../helpers/target-riders.mjs");
  const current = riders.stanceOf(actor);
  await actor.setFlag('essence20', 'riderStance', {
    allOutAttack: Math.max(current.allOutAttack, totals.allOutAttack),
    evasiveFighting: Math.max(current.evasiveFighting, totals.evasiveFighting),
    ...riders.untilStartOfNextTurn(actor),
  });
}

registerDialogToggles((actor, ctx) => stanceToggles(actor, ctx ?? {}));
registerApplyDialog((actor, options) => stanceApply(actor, options));
