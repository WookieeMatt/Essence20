import { itemsFor, pickOptions, recipients, registerRecipient, registerStep, runSteps } from "../../steps.mjs";
import { partyMates } from "../../links.mjs";
import { contextFor, evaluate, unknownTags } from "../../predicate.mjs";
import { isValidUntil } from "../../expiry.mjs";
import { formulaError, resolveValue } from "../../formula.mjs";
import {
  S, T, availabilityDif, escape, itemsOf, listOf, localize, oneStepHarder, sceneOf, sourceOf, worldActors, write,
} from "../shared/team-and-availability-helpers.mjs";

/**
 * Group E's steps (round 10): picking compendium entries and other actors' items, loops, per-recipient runs, Active
 * Effect switches and a few small writes. Registered with steps.mjs#registerStep; heavy helpers load lazily.
 */

const grantsOf = async ctx => ctx.grantHelpers ?? import("../../../mechanics/resources/grants.mjs");

function validPattern(text) {
  try {
    return !!new RegExp(text);
  } catch (error) {
    return false;
  }
}

/** Keep a pick on the rule's item under choices.<key> as a list of {uuid, name, ...} (max: the newest few). */
async function record(ctx, key, entry, max) {
  const old = ctx.item?.flags?.essence20?.rules?.choices?.[key];
  const kept = [...(Array.isArray(old) ? old : old && typeof old == 'object' ? [old] : []).filter(e => e?.uuid != entry.uuid), entry];
  const list = Number(max) > 0 ? kept.slice(-Number(max)) : kept;
  await write(ctx.item, 'update', [{ [`flags.essence20.rules.choices.${key}`]: list }]);
  globalThis.foundry?.utils?.setProperty?.(ctx.item, `flags.essence20.rules.choices.${key}`, list);
}

/** An until stamp for a recorded entry. */
async function stamped(entry, until, ctx) {
  if (!until) {
    return entry;
  }

  const { stampFor } = await import("../../expiry.mjs");
  return { ...entry, until, stamp: stampFor(until, undefined, ctx.actor) };
}

/* -------------------------------------------- */
/*  pickEntry - a compendium entry               */
/* -------------------------------------------- */

/**
 * pickEntry {from: {type, availabilities?, tags?, fields?} | children: {of: <var>, type}, var?, title?, auto?, record?,
 * key?, max?, until?} - choose a compendium entry without granting it. The run keeps it as @var.<var> (default picked,
 * its uuid) with <var>Name, <var>Availability, <var>Dif (its Availability DIF), <var>DifHarder (one step harder),
 * <var>Skill (the Requisition Skill for a weapon or armor) and <var>Traits (its traits, comma-joined). `children`
 * offers the entries a picked entry carries (an Origin's Alt Modes). `record` also keeps it on the rule's item (as
 * pickGrant's record). A cancelled pick stops the run; grant it later with grant {uuid: "{var.<var>}"}.
 */
async function pickEntry(step, ctx) {
  const name = step.var || 'picked';
  const helpers = await grantsOf(ctx);
  let rows;
  if (step.children) {
    const parentUuid = ctx.vars[step.children.of || 'picked'];
    const parent = parentUuid ? await globalThis.fromUuid?.(parentUuid) : null;
    rows = Object.values(parent?.system?.items ?? {}).filter(entry => entry?.uuid && (!step.children.type || entry.type == step.children.type))
      .map(entry => ({ ...entry, uuid: entry.uuid, name: entry.name }));
  } else {
    const from = step.from ?? {};
    const tags = Array.isArray(from.tags) ? from.tags : [];
    // Round 15 (items1): from.types - several item types in one list, by name (Welds, Rivets, and Ideas: gear and upgrades).
    const types = Array.isArray(from.types) && from.types.length ? from.types : [from.type];
    const found = await Promise.all(types.map(type => helpers.findItems({
      type,
      availabilities: Array.isArray(from.availabilities) && from.availabilities.length ? from.availabilities : null,
      ...(Array.isArray(from.fields) && from.fields.length ? { fields: from.fields } : {}),
      matches: tags.length ? entry => evaluate(tags, contextFor({ self: ctx.actor, item: entry, ruleItem: ctx.item, vars: ctx.vars })) === true : null,
    })));
    rows = types.length > 1 ? found.flat().sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? ''))) : found[0] ?? [];
  }

  let uuid = null;
  if (step.auto && rows.length == 1) {
    uuid = rows[0].uuid;
  } else if (step.children) {
    uuid = rows.length ? await helpers.chooseSelect(ctx.item?.name ?? '', escape(step.prompt ?? S('PickPrompt')), rows.map(row => ({ value: row.uuid, label: row.name }))) : null;
  } else {
    uuid = await helpers.pickOne(step.title || ctx.item?.name || '', rows);
  }

  const row = rows.find(entry => entry.uuid == uuid);
  if (!uuid || !row) {
    return false;
  }

  const source = await globalThis.fromUuid?.(uuid) ?? null;
  const doc = source ?? row;
  // kitTier: a kit (gear has no Availability) takes its tier from its name - "Limited Burglary Kit"
  // (grants.mjs#kitAvailability, as Construct / Kitbash Equipment read it).
  const availability = doc.system?.availability ?? row.system?.availability ?? (step.kitTier ? helpers.kitAvailability?.(doc.name ?? row.name) : null) ?? 'standard';
  ctx.vars[name] = uuid;
  ctx.vars[`${name}Name`] = doc.name ?? row.name ?? '';
  ctx.vars[`${name}Availability`] = availability;
  ctx.vars[`${name}Dif`] = availabilityDif(availability);
  ctx.vars[`${name}DifHarder`] = availabilityDif(oneStepHarder(availability));
  ctx.vars[`${name}Traits`] = [...(row.system?.traits ?? []), ...(source?.system?.traits ?? [])].join(',');
  ctx.vars[`${name}Skill`] = '';
  if (['weapon', 'armor'].includes(doc.type)) {
    const { requisitionSkill } = ctx.requisition ?? await import("../../../mechanics/resources/requisition.mjs");
    ctx.vars[`${name}Skill`] = requisitionSkill(doc);
  }

  if (step.record) {
    await record(ctx, String(step.key ?? name), await stamped({ uuid, name: ctx.vars[`${name}Name`] }, step.until, ctx), step.max);
  }

  ctx.chat.push(S('Picked', { item: escape(ctx.item?.name ?? ''), choice: escape(ctx.vars[`${name}Name`]) }));
}

registerStep('pickEntry', pickEntry, {
  errors: (step, where) => [
    ...(step.from?.type || step.from?.types?.length || step.children ? [] : [`${where}: pickEntry needs from.type (or from.types) or children`]),
    ...(step.from?.tags ? unknownTags(step.from.tags).map(tag => `${where}: unknown tag "${tag}" in from.tags`) : []),
    ...(step.var && !/^[\w-]+$/.test(step.var) ? [`${where}: var must be a plain name`] : []),
    ...(step.until && !isValidUntil(step.until) ? [`${where}: bad until`] : []),
  ],
});

/* -------------------------------------------- */
/*  pickActorItem - another actor's weapon / vehicle */
/* -------------------------------------------- */

/** The world vehicles / Zords an actor is crewing. */
function crewedVehicles(actor) {
  return worldActors().filter(other => ['vehicle', 'zord'].includes(other?.type)
    && Object.values(other.system?.actors ?? {}).some(crew => crew?.uuid == actor?.uuid));
}

/** Resolve `actor: picked:<key> | target | self`. */
function actorFrom(step, ctx) {
  const which = String(step.actor ?? 'target');
  const picked = /^picked:([\w-]+)$/.exec(which);
  if (picked) {
    const stored = ctx.item?.flags?.essence20?.rules?.choices?.[picked[1]];
    return stored ? globalThis.fromUuidSync?.(stored, { strict: false }) ?? worldActors().find(a => a.uuid == stored || a.id == stored) ?? null : null;
  }

  return which == 'self' ? ctx.actor : ctx.targets[0] ?? null;
}

/**
 * pickActorItem {actor: picked:<key> | target | self, itemType?, vehicles?, key, max?, until?, legacy?} - one of that
 * actor's items (of itemType), or (vehicles: true) a vehicle / Zord they crew; recorded on the rule's item as
 * {kind: weapon | vehicle, uuid (the item's book source, else its uuid; a vehicle's uuid), name, ally}. Read by
 * item:recorded:<key> and self:crewsRecorded:<key>.
 */
async function pickActorItem(step, ctx) {
  const other = actorFrom(step, ctx);
  if (!other) {
    ctx.chat.push(S('NeedsTarget', { item: escape(ctx.item?.name) }));
    return false;
  }

  const types = [step.itemType ?? []].flat();
  const options = itemsOf(other).filter(item => !types.length || types.includes(item.type))
    .map(item => ({ value: `item:${item.id}`, label: item.name, kind: item.type, uuid: sourceOf(item) ?? item.uuid, name: item.name }));
  if (step.vehicles) {
    for (const vehicle of crewedVehicles(other)) {
      options.push({ value: `vehicle:${vehicle.uuid}`, label: vehicle.name, kind: 'vehicle', uuid: vehicle.uuid, name: vehicle.name });
    }
  }

  if (!options.length) {
    ctx.chat.push(S('NothingToPick', { item: escape(ctx.item?.name) }));
    return false;
  }

  const ask = ctx.askPick ?? (async (s, list) => (await grantsOf(ctx)).chooseSelect(ctx.item?.name ?? '', escape(s.prompt ?? S('PickPrompt')), list));
  const value = await ask(step, options.map(({ value: v, label }) => ({ value: v, label })), ctx);
  const chosen = options.find(option => option.value == value);
  if (!chosen) {
    return false;
  }

  await record(ctx, String(step.key ?? 'picked'), await stamped({ kind: chosen.kind, uuid: chosen.uuid, name: chosen.name, ally: other.name }, step.until, ctx), step.max ?? 1);
  ctx.vars.picked = chosen.uuid;
  ctx.chat.push(S('Picked', { item: escape(ctx.item?.name ?? ''), choice: escape(`${chosen.name} (${other.name})`) }));
}

registerStep('pickActorItem', pickActorItem, {
  errors: (step, where) => [
    ...(step.key ? [] : [`${where}: pickActorItem needs a key`]),
    ...(step.actor && !/^(target|self|picked:[\w-]+)$/.test(step.actor) ? [`${where}: actor must be target, self or picked:<key>`] : []),
    ...(step.until && !isValidUntil(step.until) ? [`${where}: bad until`] : []),
  ],
});

/* -------------------------------------------- */
/*  pickMany - several at once                   */
/* -------------------------------------------- */

async function askMany(step, options, count, ctx) {
  const { DialogV2 } = globalThis.foundry.applications.api;
  const rows = options.map(option => `<div class="form-group"><label><input type="checkbox" name="m" value="${escape(option.value)}"> ${escape(option.label)}</label></div>`).join('');
  const result = await DialogV2.wait({
    window: { title: ctx.item?.name ?? '' },
    classes: ['essence20', 'e20-window'],
    content: `<p>${escape(step.prompt ?? T('PickUpTo', { count }))}</p>${rows}`,
    buttons: [
      { action: 'ok', label: localize('E20.DialogConfirmButton'), default: true, callback: (event, button) => [...button.form.querySelectorAll('input[name="m"]:checked')].map(input => input.value) },
      { action: 'cancel', label: localize('E20.DialogCancelButton') },
    ],
    rejectClose: false,
  });
  return Array.isArray(result) ? result : null;
}

/**
 * pickMany {key, from, count (formula), ...the pick's own options} - choose up to `count` of what a pick step would
 * offer (any `from`), kept on the rule's item as a list. Ticking more keeps the first `count`; none is a valid answer;
 * closing the box stops the run. @var.picked is the list.
 */
async function pickMany(step, ctx) {
  const key = String(step.key ?? '');
  const options = pickOptions(step, ctx);
  if (!key || !ctx.item || !options.length) {
    ctx.chat.push(S('NothingToPick', { item: escape(ctx.item?.name) }));
    return false;
  }

  const count = Math.max(0, Math.round(resolveValue(step.count ?? 1, { actor: ctx.actor, item: ctx.item, vars: ctx.vars }, 1)));
  const answer = await (ctx.askMany ?? askMany)(step, options, count, ctx);
  if (!Array.isArray(answer)) {
    return false;
  }

  const values = [...new Set(answer)].filter(value => options.some(option => option.value == value)).slice(0, count);
  await write(ctx.item, 'update', [{ [`flags.essence20.rules.choices.${key}`]: values }]);
  globalThis.foundry?.utils?.setProperty?.(ctx.item, `flags.essence20.rules.choices.${key}`, values);
  ctx.vars.picked = values;
  const labels = values.map(value => options.find(option => option.value == value)?.label ?? value);
  ctx.chat.push(S('Picked', { item: escape(ctx.item.name), choice: escape(labels.join(', ') || '-') }));
}

registerStep('pickMany', pickMany, {
  errors: (step, where) => [
    ...(step.key && step.from ? [] : [`${where}: pickMany needs a key and from`]),
    ...(formulaError(step.count) ? [`${where}.count: ${formulaError(step.count)}`] : []),
  ],
});

/* -------------------------------------------- */
/*  repeat / forEach / focus                     */
/* -------------------------------------------- */

/**
 * repeat {steps, max?, var?} - run the steps again and again until one of them stops (a cancelled pick); @var.<var>
 * (default repeats) counts the rounds that finished. Never stops the run itself.
 */
registerStep('repeat', async (step, ctx) => {
  const name = step.var || 'repeats';
  const max = Math.max(1, Math.round(resolveValue(step.max ?? 50, { actor: ctx.actor, item: ctx.item, vars: ctx.vars }, 50)));
  ctx.vars[name] = 0;
  for (let i = 0; i < max; i++) {
    if (!(await runSteps(step.steps ?? [], ctx))) {
      break;
    }

    ctx.vars[name]++;
  }
}, { errors: (step, where) => (Array.isArray(step.steps) && step.steps.length ? [] : [`${where}: repeat needs steps`]), branches: ['steps'] });

/**
 * forEach {to, steps} - run the steps once for each recipient, with it as the target (`to: "target"` inside);
 * a stopped run for one recipient doesn't stop the others.
 */
registerStep('forEach', async (step, ctx) => {
  const saved = ctx.targets;
  for (const one of recipients(step, ctx)) {
    ctx.targets = [one];
    await runSteps(step.steps ?? [], ctx);
  }

  ctx.targets = saved;
}, { errors: (step, where) => (Array.isArray(step.steps) && step.steps.length ? [] : [`${where}: forEach needs steps`]), branches: ['steps'] });

/** focus {to} - make the recipients this run's targets (not the user's targeting); stops when there are none. */
registerStep('focus', async (step, ctx) => {
  const list = recipients(step, ctx);
  if (!list.length) {
    ctx.chat.push(S('NeedsTarget', { item: escape(ctx.item?.name) }));
    return false;
  }

  ctx.targets = list;
}, { errors: (step, where) => (step.to ? [] : [`${where}: focus needs to`]) });

/* -------------------------------------------- */
/*  Item / actor writes                          */
/* -------------------------------------------- */

/**
 * setEffects {effects: [{name?, changeKey?, on}], items?} - switch the rule's own item's Active Effects on or off. Each effect
 * takes the first entry that matches it (name contains `name`, its first change's key contains `changeKey`; an entry
 * with neither matches any); `on` is true / false or a list of tags. Effects no entry matches are left alone.
 * `items` (round 15, items2 - Zord Ultra Mode): the actor's items that selector picks instead (type:feature - every
 * Zord Feature it holds; an item step's `item`, all of them).
 */
registerStep('setEffects', async (step, ctx) => {
  if (step.items) {
    for (const other of itemsFor({ item: step.items, all: true }, ctx.actor, ctx)) {
      await setEffectsOn(other, step, ctx);
    }

    return;
  }

  await setEffectsOn(ctx.item, step, ctx);
}, {
  errors: (step, where) => (Array.isArray(step.effects) && step.effects.length
    ? step.effects.flatMap((e, i) => (Array.isArray(e?.on) ? unknownTags(e.on).map(tag => `${where}.effects[${i}]: unknown tag "${tag}"`) : typeof e?.on == 'boolean' ? [] : [`${where}.effects[${i}]: on must be true, false or a list of tags`]))
    : [`${where}: setEffects needs effects`]),
});

/** setEffects on one item: its Active Effects switched as the step's entries say (`on` tags see the rule's own item). */
async function setEffectsOn(item, step, ctx) {
  const lower = text => String(text ?? '').toLowerCase();
  const updates = [];
  for (const effect of listOf(item?.effects)) {
    const key = effect.changes?.[0]?.key ?? effect.system?.changes?.[0]?.key ?? '';
    const entry = (Array.isArray(step.effects) ? step.effects : []).find(e => (!e.name || lower(effect.name).includes(lower(e.name)))
      && (!e.changeKey || lower(key).includes(lower(e.changeKey))));
    if (!entry) {
      continue;
    }

    const on = typeof entry.on == 'boolean' ? entry.on
      : evaluate(entry.on ?? [], contextFor({ self: ctx.actor, ruleItem: ctx.item, other: ctx.targets[0] ?? null, vars: ctx.vars })) === true;
    updates.push({ _id: effect.id, disabled: !on });
  }

  if (updates.length) {
    await write(item, 'updateEmbeddedDocuments', ['ActiveEffect', updates]);
  }
}

/** unbank - take back every bonus this rule's item banked on the recipients (rules/bank.mjs). */
registerStep('unbank', async (step, ctx) => {
  for (const actor of recipients(step, ctx)) {
    const bank = actor.flags?.essence20?.ruleBank;
    const kept = (Array.isArray(bank) ? bank : []).filter(entry => entry?.source != ctx.item?.id);
    if (Array.isArray(bank) && kept.length != bank.length) {
      await write(actor, 'update', [{ 'flags.essence20.ruleBank': kept }]);
    }
  }
});

/** appendToName {text} - the rule's own item is renamed "<name> (<text>)"; text may be an i18n key. */
registerStep('appendToName', async (step, ctx) => {
  const text = localize(String(step.text ?? ''));
  if (!ctx.item || !text) {
    return;
  }

  await write(ctx.item, 'update', [{ name: `${ctx.item.name} (${text})` }]);
}, { errors: (step, where) => (step.text ? [] : [`${where}: appendToName needs text`]) });

/**
 * recordScene {path} - write {sceneId, terrain} for the scene the actor is on at `path` on the actor (Cartography
 * Suite's survey, read by self:onRecordedScene:<path>). Stops, saying so, when there's no scene. `quiet: true` (round 15,
 * items2 - Help Yourself's clone) posts no "surveyed" line.
 */
registerStep('recordScene', async (step, ctx) => {
  const scene = sceneOf(ctx.actor);
  if (!scene) {
    ctx.chat.push(T('NoScene'));
    return false;
  }

  let terrain = null;
  try {
    const { getTerrain } = await import("../../../mechanics/world/environment.mjs");
    terrain = getTerrain(ctx.actor) ?? null;
  } catch (error) {
    terrain = null;
  }

  await write(ctx.actor, 'update', [{ [String(step.path)]: { sceneId: scene.id, terrain } }]);
  if (!step.quiet) {
    ctx.chat.push(T('SceneRecorded', { name: escape(ctx.actor?.name), scene: escape(scene.name) }));
  }
}, { errors: (step, where) => (/^flags\.[\w.-]+$/.test(String(step.path ?? '')) ? [] : [`${where}: recordScene needs a flags.<...> path`]) });

/**
 * grantTopRolePerks {notRole?: uuid, notRoleName?, excludeName?: regex} - the actor's (base) Role's highest-level
 * Role Perks, granted outright (mechanics/resources/grants.mjs#grantCopy) unless already owned. Stops when there's no Role.
 */
registerStep('grantTopRolePerks', async (step, ctx) => {
  const actor = ctx.actor;
  const role = itemsOf(actor).find(item => item.type == 'role' && (!step.notRole || sourceOf(item) != step.notRole) && (!step.notRoleName || item.name != step.notRoleName));
  const perks = Object.values(role?.system?.items ?? {}).filter(entry => entry?.type == 'perk' && entry.subtype == 'role' && entry.uuid);
  const top = Math.max(0, ...perks.map(entry => Number(entry.level) || 0));
  const exclude = step.excludeName ? new RegExp(step.excludeName, 'i') : null;
  const entries = perks.filter(entry => (Number(entry.level) || 0) == top && !(exclude && exclude.test(entry.name ?? '')));
  if (!entries.length) {
    ctx.chat.push(T('NoRolePerks', { name: escape(actor?.name) }));
    return false;
  }

  const { grantCopy } = await grantsOf(ctx);
  for (const entry of entries) {
    if (itemsOf(actor).some(item => sourceOf(item) == entry.uuid)) {
      continue;
    }

    const got = await grantCopy(actor, entry.uuid, { grantedBy: ctx.item });
    if (got) {
      ctx.chat.push(S('Granted', { name: escape(actor.name), item: escape(got.name) }));
    }
  }
}, { errors: (step, where) => (step.excludeName && !validPattern(step.excludeName) ? [`${where}: excludeName is not a pattern`] : []) });

/**
 * fitUpgrade {uuid, onto: choice:<key>, flags?} - a compendium upgrade made on the actor and attached to the owned
 * item a pick stored (attachment-handler.mjs#setEntryAndAddItem, the way dropping it on the item does). It is not
 * tied to the rule's item (no grantedBy): it stays when the item goes.
 * Round 15 (uses): `onto: granted` - the item the run's last grant made (@var.granted - Weapon Forage's foraged weapon);
 * `uuid` may be {var.<key>} (a pickEntry); `until` - a temporary attachment, the weapon-perk-uses.mjs#attachTemporaryUpgrade
 * stamp its sweep removes (with the host's entry): endOfTurn ("turn"), endOfNextTurn ("nextTurn"), scene, untilUsed
 * (gone after the host's next attack), rounds:N.
 */
const FIT_UNTIL = { endOfTurn: 'turn', endOfNextTurn: 'nextTurn', scene: 'scene', untilUsed: 'untilUsed' };
const fitUntilOf = until => (FIT_UNTIL[until] ? { kind: FIT_UNTIL[until] } : /^rounds:(\d+)$/.test(String(until ?? '')) ? { kind: 'rounds', rounds: Number(String(until).slice(7)) } : null);

registerStep('fitUpgrade', async (step, ctx) => {
  const actor = ctx.actor;
  const key = /^choice:([\w-]+)$/.exec(String(step.onto ?? ''))?.[1];
  const id = key ? ctx.item?.flags?.essence20?.rules?.choices?.[key] : null;
  const granted = step.onto == 'granted' ? ctx.vars?.granted ?? null : null;
  const host = granted ?? (id ? itemsOf(actor).find(item => item.id == id || item.uuid == id) : null);
  const uuid = String(step.uuid ?? '').replace(/\{var\.([\w-]+)\}/g, (match, name) => String(ctx.vars?.[name] ?? ''));
  const source = host ? await globalThis.fromUuid?.(uuid) : null;
  if (!host || !source) {
    ctx.chat.push(S('NoSuchItem', { name: escape(actor?.name) }));
    return false;
  }

  if (step.until) {
    const { attachTemporaryUpgrade } = await import("../../../items/attacks/weapon-perk-uses.mjs");
    const made = await attachTemporaryUpgrade(host.parent ?? actor, host, uuid, { ...fitUntilOf(step.until), source: ctx.item?.name ?? '' });
    if (!made) {
      return false;
    }

    ctx.chat.push(T('Fitted', { item: escape(made.name ?? source.name), host: escape(host.name) }));
    return;
  }

  const data = source.toObject();
  delete data._id;
  globalThis.foundry.utils.setProperty(data, 'flags.core.sourceId', uuid);
  globalThis.foundry.utils.setProperty(data, 'flags.essence20.parentId', host.id);
  for (const [path, value] of Object.entries(step.flags ?? {})) {
    globalThis.foundry.utils.setProperty(data, `flags.essence20.${path}`, value);
  }

  const [created] = await actor.createEmbeddedDocuments('Item', [data]);
  const { setEntryAndAddItem } = await import("../../../sheet-handlers/attachment-handler.mjs");
  const entryKey = created ? await setEntryAndAddItem(created, host) : null;
  if (entryKey) {
    await created.setFlag('essence20', 'collectionId', entryKey);
  }

  ctx.chat.push(T('Fitted', { item: escape(data.name), host: escape(host.name) }));
}, {
  errors: (step, where) => [
    ...(step.uuid && (step.onto == 'granted' || /^choice:[\w-]+$/.test(String(step.onto ?? ''))) ? [] : [`${where}: fitUpgrade needs a uuid and onto: choice:<key> or granted`]),
    ...(step.until && !fitUntilOf(step.until) ? [`${where}: fitUpgrade until must be endOfTurn, endOfNextTurn, scene, untilUsed or rounds:N`] : []),
  ],
});


/**
 * giveCopy {uuid, to?, flags?} - a copy of a compendium item ({var.<key>} reads a pickEntry) made on each recipient,
 * through the GM when this user can't write to them (another creature's sheet), tied to the rule's item (grantedBy).
 * For items with nothing attached (a Hang-Up, a Perk) - a weapon's attacks need the `grant` step.
 */
registerStep('giveCopy', async (step, ctx) => {
  const uuid = String(step.uuid ?? '').replace(/\{var\.([\w-]+)\}/g, (match, key) => String(ctx.vars?.[key] ?? ''));
  const source = uuid ? await globalThis.fromUuid?.(uuid) : null;
  if (!source) {
    return false;
  }

  for (const actor of recipients(step, ctx)) {
    const data = source.toObject();
    delete data._id;
    globalThis.foundry.utils.setProperty(data, '_stats.compendiumSource', uuid);
    globalThis.foundry.utils.setProperty(data, 'flags.essence20.grantedBy', ctx.item?.id ?? null);
    for (const [path, value] of Object.entries(step.flags ?? {})) {
      globalThis.foundry.utils.setProperty(data, `flags.essence20.${path}`, value);
    }

    await write(actor, 'createEmbeddedDocuments', ['Item', [data]]);
    ctx.chat.push(S('Granted', { name: escape(actor.name), item: escape(data.name) }));
  }
}, { errors: (step, where) => (step.uuid ? [] : [`${where}: giveCopy needs a uuid`]) });

/* -------------------------------------------- */
/*  Recipients                                   */
/* -------------------------------------------- */

// allParties: the actor and everyone on any Party roster with it (resource/common.mjs#teamOf).
registerRecipient('allParties', (match, ctx) => [ctx.actor, ...partyMates(ctx.actor)].filter(Boolean));
// targetOrCombatant: the first target, else the creature whose turn it is (Misguide).
registerRecipient('targetOrCombatant', (match, ctx) => [ctx.targets[0] ?? globalThis.game?.combat?.combatant?.actor ?? null].filter(Boolean));
