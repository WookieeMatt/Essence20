import { lineOf } from "../../../mechanics/resources/game-lines.mjs";
import { contextFor, evaluate, registerTag } from "../../predicate.mjs";
import { itemsFor, recipients, registerStep, runSteps } from "../../steps.mjs";
import { escape } from "../shared/chat-speaker-helpers.mjs";

/**
 * Granting compendium entries the way the sheet's drop handlers do (round 15, uses):
 *
 *   - Tags (on a compendium entry, as pickEntry / pickGrant `from.tags` ask them): `item:line:<gij|pr|tf|mlp|wtnv>` - the
 *     entry's game line, by its pack (mechanics/resources/game-lines.mjs); `item:folderName:<name>` - the entry sits in a
 *     compendium folder of that name (ignoring case); `item:nameOfOwned:<type>` - its name is the name of an item of that
 *     type the actor holds; `item:isVar:<key>` - it is the entry a step stored as @var.<key> (a pick earlier in the run).
 *   - Step `pickChildEntry {parent: {type, tags?, fields?}, childType?, childTags?, entryTags?, label?: parent | role,
 *     var?, prompt?}` - choose one entry that a compendium entry carries (an Origin's Perk, a Role-variant Perk's per-Role
 *     Perk) from one list over every parent the tags allow: `childTags` are asked of the child's own document (its
 *     system.type...), `entryTags` of the parent's entry row (its `role`). Options read "<parent>: <child>" (label: role -
 *     "<the entry's role>: <child>"), sorted. The run keeps @var.<var> (default picked, its uuid) and @var.<var>Parent (the
 *     parent entry's uuid); a cancel stops it.
 *   - Step `grantPerk {uuid, link?}` - a Perk added the way dropping it does (sheet-handlers/perk-handler.mjs
 *     #grantPerkOutright: its own choices and Role / Focus set-up run; nothing when the actor has it already). `link:
 *     true` ties the copy to the rule's item (grantedBy); the hand-written Uses this replaces didn't.
 *   - Step `grantEntries {of: <var> | "owned:<type>", childType?, notOwned?, until?, to?, flags?}` - every entry the
 *     picked compendium entry (or the actor's own item of that type - its Faction, as it stands on the sheet) carries, granted like the `grant` step
 *     (tied to the rule's item, `until` as usual); `notOwned` leaves out what the recipient already has. @var.grantedCount.
 *   - Step `factionDrop {item?}` - run the Faction drop handler (sheet-handlers/faction-handler.mjs#onFactionDrop) on an
 *     item of the actor (default the run's last grant - justGranted): its Faction Perks and Role variants.
 */

const listOf = collection => collection?.contents ?? (collection ? [...collection] : []);
const sourceOf = item => item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource ?? null;

registerTag('item:line', (rest, ctx) => (ctx.item ? lineOf(ctx.item.uuid ?? sourceOf(ctx.item)) == rest : false));

registerTag('item:folderName', (rest, ctx) => {
  const wanted = String(rest ?? '').toLowerCase();
  const entry = ctx.item;
  if (!wanted || !entry?.folder) {
    return false;
  }

  const [, , pack] = String(entry.uuid ?? '').split('.');
  const folders = globalThis.game?.packs?.get?.(`essence20.${pack}`)?.folders;
  const folder = folders?.get?.(typeof entry.folder == 'string' ? entry.folder : entry.folder?.id);
  return String(folder?.name ?? '').toLowerCase() == wanted;
});

registerTag('item:nameOfOwned', (rest, ctx) => !!ctx.item?.name && listOf(ctx.self?.items).some(item => item.type == rest && item.name == ctx.item.name));

registerTag('item:isVar', (rest, ctx) => !!ctx.item && !!ctx.vars?.[rest] && (ctx.item.uuid == ctx.vars[rest] || sourceOf(ctx.item) == ctx.vars[rest]));

async function grantsOf(ctx) {
  return ctx.grantHelpers ?? import("../../../mechanics/resources/grants.mjs");
}

registerStep('pickChildEntry', async (step, ctx) => {
  const helpers = await grantsOf(ctx);
  const parent = step.parent ?? {};
  const tags = Array.isArray(parent.tags) ? parent.tags : [];
  const parents = await helpers.findItems({
    type: parent.type,
    ...(Array.isArray(parent.fields) && parent.fields.length ? { fields: parent.fields } : {}),
    matches: tags.length ? entry => evaluate(tags, contextFor({ self: ctx.actor, item: entry, ruleItem: ctx.item, vars: ctx.vars })) === true : null,
  });
  const options = [];
  for (const row of parents) {
    const doc = await globalThis.fromUuid?.(row.uuid);
    for (const entry of Object.values(doc?.system?.items ?? {})) {
      if (!entry?.uuid || (step.childType && entry.type != step.childType) || options.some(option => option.value == entry.uuid)) {
        continue;
      }

      if (Array.isArray(step.entryTags) && evaluate(step.entryTags, contextFor({ self: ctx.actor, item: entry, ruleItem: ctx.item, vars: ctx.vars })) !== true) {
        continue;
      }

      if (Array.isArray(step.childTags) && step.childTags.length) {
        const child = await globalThis.fromUuid?.(entry.uuid);
        if (!child || evaluate(step.childTags, contextFor({ self: ctx.actor, item: child, ruleItem: ctx.item, vars: ctx.vars })) !== true) {
          continue;
        }
      }

      options.push({ value: entry.uuid, parent: row.uuid, label: `${step.label == 'role' ? entry.role : doc?.name ?? row.name}: ${entry.name}` });
    }
  }

  options.sort((a, b) => a.label.localeCompare(b.label));
  const uuid = await helpers.chooseSelect(ctx.item?.name ?? '', escape(step.prompt ?? ''), options);
  if (!uuid) {
    return false;
  }

  ctx.vars[step.var || 'picked'] = uuid;
  // @var.<var>Parent (round 15, items1): the entry it came from - a second pick from another one (Multimorph).
  ctx.vars[`${step.var || 'picked'}Parent`] = options.find(option => option.value == uuid)?.parent ?? '';
}, { errors: (step, where) => (step.parent?.type ? [] : [`${where}: pickChildEntry needs parent.type`]) });

registerStep('grantPerk', async (step, ctx) => {
  const uuid = String(step.uuid ?? '').replace(/\{var\.([\w-]+)\}/g, (match, key) => String(ctx.vars?.[key] ?? ''));
  if (!uuid) {
    return false;
  }

  const { grantPerkOutright, setPerkValues } = await import("../../../sheet-handlers/perk-handler.mjs");
  for (const actor of recipients(step, ctx)) {
    const had = listOf(actor.items).some(item => sourceOf(item) == uuid);
    await grantPerkOutright(actor, uuid);
    const made = listOf(actor.items).find(item => sourceOf(item) == uuid);
    if (made && step.link) {
      await made.setFlag?.('essence20', 'grantedBy', ctx.item?.id ?? null);
    }

    // runPicker (round 15, systems): a newly granted Perk's own drop-time picker opens (setPerkValues - its hasChoice
    // pick), as if it had been dropped on the sheet (Metamorphosis's Metamorphosed Changeling benefits).
    if (made && step.runPicker && !had) {
      await setPerkValues(actor, made, null, null, uuid);
    }

    ctx.chat.push(globalThis.game?.i18n?.format?.('E20.Rules.Step.Granted', { name: escape(actor.name), item: escape(made?.name ?? '') }) ?? escape(made?.name ?? ''));
  }
}, { errors: (step, where) => (step.uuid ? [] : [`${where}: grantPerk needs a uuid`]) });

registerStep('grantEntries', async (step, ctx) => {
  const of = String(step.of ?? 'picked');
  let parent = null;
  const owned = /^owned:(\w+)$/.exec(of);
  if (owned) {
    const item = listOf(ctx.actor?.items).find(i => i.type == owned[1]);
    // The actor's own copy (its entries as they stand on the sheet).
    parent = item ?? null;
  } else if (ctx.vars?.[of]) {
    parent = await globalThis.fromUuid?.(ctx.vars[of]);
  }

  const entries = Object.values(parent?.system?.items ?? {}).filter(entry => entry?.uuid && (!step.childType || entry.type == step.childType));
  ctx.vars.grantedCount = 0;
  for (const actor of recipients(step, ctx)) {
    for (const entry of entries) {
      if (step.notOwned && listOf(actor.items).some(item => sourceOf(item) == entry.uuid)) {
        continue;
      }

      const grant = { do: 'grant', uuid: entry.uuid, ...(step.until ? { until: step.until } : {}), ...(step.flags ? { flags: step.flags } : {}) };
      // The grant step, with each recipient in turn as the run's actor (the ally of a Field Promotion).
      await runSteps([grant], { ...ctx, actor });
      ctx.vars.grantedCount++;
    }
  }
}, { errors: (step, where) => (/^(owned:\w+|[\w-]+)$/.test(String(step.of ?? 'picked')) ? [] : [`${where}: grantEntries of must be a var name or owned:<type>`]) });

registerStep('factionDrop', async (step, ctx) => {
  const [item] = itemsFor({ item: step.item ?? 'justGranted' }, ctx.actor, ctx);
  if (!item) {
    return;
  }

  const { onFactionDrop } = await import("../../../sheet-handlers/faction-handler.mjs");
  await onFactionDrop(ctx.actor, null, item);
});
