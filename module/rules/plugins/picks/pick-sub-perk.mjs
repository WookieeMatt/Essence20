// Perk choice P1 (docs/PERK_CHOICE_MIGRATION_PLAN.md §2.2.5): step pickSubPerk - the old 'perks' picker's sub-Perk lists.
import { formulaError, resolveValue } from "../../formula.mjs";
import { registerStep, stepContext } from "../../steps.mjs";
import { queueAsk } from "../../ask-queue.mjs";
import { registerStepForm } from "../../editor-spec.mjs";
import { itemsOf, localize, sourceOf, write } from "../shared/card-text-helpers.mjs";

/**
 * `pickSubPerk {key?, count?, notOwned?, anyGeneral?, prompt?, optional?}` - in an `added` Trigger (removeOnStop), choose
 * `count` (a formula, default 1 - "2 + @choiceCount" keeps Grid Tap's extra pick) different sub-Perks and make each on the
 * actor under the rule's item, the way the old Perk picker's 'perks' choice did (Grid Science / Grid Tech, Modified
 * Shell, Metamorphosed Changeling, Nobody Like Me...):
 *  - the options are the item's own system.items entries (by name), or with `anyGeneral: true` every General Perk in the
 *    enabled books (perk-handler.mjs#anyGeneralPerkChoices), grouped by game line with the item's own line first;
 *  - `notOwned` (on unless false) leaves out what the actor already holds (by book source), and every pick leaves out the
 *    ones before it;
 *  - each pick is made by perk-handler.mjs#createSubPerk (parentId, collectionId, an entry written onto the parent for an
 *    any-General pick); a child with rules asks its own choices as it is created (queued behind this ask);
 *  - the picks' compendium uuids are kept as a list under `key` (default "perks"), shown on the Rules tab with "change".
 * Every pick is asked before anything is made, so a cancel makes nothing and stops the run (`optional`: the run goes on).
 * Queued with the actor's other asks (ask-queue.mjs). `@var.picked` is the uuid list.
 *
 * repickSubPerks(item, step) - "change": ask again (the current picks offered again), then take off the old children and
 * make the new ones. A cancel keeps the old ones.
 */

/** Test seam: {general(actor), create(actor, parent, uuid), gameLine(uuid), ask(step, options, ctx, n)}. */
let helpers = null;
export function setSubPerkHelpers(next) {
  helpers = next;
}

async function perkHandler() {
  return import("../../../sheet-handlers/perk-handler.mjs");
}

const general = async actor => (helpers?.general ? helpers.general(actor) : (await perkHandler()).anyGeneralPerkChoices(actor));
const create = async (actor, parent, uuid) => (helpers?.create ? helpers.create(actor, parent, uuid) : (await perkHandler()).createSubPerk(actor, parent, uuid));
const gameLine = async uuid => (helpers?.gameLine ? helpers.gameLine(uuid) : (await perkHandler()).gameLineOf(uuid));

async function askPick(step, options, ctx, n, count) {
  const ask = ctx.askPick ?? helpers?.ask;
  if (ask) {
    return ask({ ...step, n, count }, options, ctx);
  }

  const { chooseSelect } = await import("../../../mechanics/resources/grants.mjs");
  const text = step.prompt ? localize(String(step.prompt)) : localize(count > 1 ? 'E20.Rules.SubPerkPromptOf' : 'E20.Rules.SubPerkPrompt');
  const prompt = text.replace(/\{n\}/g, String(n)).replace(/\{count\}/g, String(count));
  return chooseSelect(ctx.item?.name ?? '', prompt, options);
}

/** The picks a pickSubPerk step keeps on its item. */
export function subPerkPicks(item, step) {
  const stored = item?.flags?.essence20?.rules?.choices?.[String(step?.key ?? 'perks')];
  return Array.isArray(stored) ? stored : stored ? [stored] : [];
}

/**
 * What a pickSubPerk step offers: [{value: uuid, label, group?}], sorted by group (the item's own game line first) then
 * name. `ignore` - uuids not counted as owned (a re-pick's current children).
 */
export async function subPerkOptions(step, ctx, { ignore = [] } = {}) {
  const actor = ctx.actor ?? ctx.item?.parent;
  const owned = step.notOwned === false ? new Set() : new Set(itemsOf(actor).map(sourceOf).filter(uuid => uuid && !ignore.includes(uuid)));
  let options;
  if (step.anyGeneral) {
    const choices = Object.values(await general(actor) ?? {});
    options = choices.map(choice => ({ value: choice.uuid ?? choice.value, label: choice.detail ? `${choice.label} (${choice.detail})` : choice.label, group: choice.group }));
    // anyGeneralPerkChoices already leaves out what the actor holds - but not a re-pick's current children.
    for (const uuid of ignore) {
      if (!options.some(option => option.value == uuid)) {
        const name = globalThis.fromUuidSync?.(uuid, { strict: false })?.name;
        if (name) {
          options.push({ value: uuid, label: name });
        }
      }
    }
  } else {
    options = Object.values(ctx.item?.system?.items ?? {}).filter(entry => entry?.uuid && (!entry.type || entry.type == 'perk'))
      .map(entry => ({ value: entry.uuid, label: entry.name ?? entry.uuid }));
  }

  const first = await gameLine(sourceOf(ctx.item));
  const groupRank = option => (!option.group ? 0 : option.group == first ? 1 : 2);
  return [...new Map(options.filter(option => option.value && !owned.has(option.value)).map(option => [option.value, option])).values()]
    .sort((a, b) => groupRank(a) - groupRank(b) || String(a.group ?? '').localeCompare(String(b.group ?? '')) || String(a.label).localeCompare(String(b.label)));
}

/** Ask every pick (none made yet). Null when cancelled; [] when there is nothing to pick. */
async function askSubPerks(step, ctx, options) {
  const count = Math.max(0, Math.round(resolveValue(step.count ?? 1, { actor: ctx.actor, item: ctx.item, vars: ctx.vars }, 1)));
  const picks = [];
  for (let n = 1; n <= count; n++) {
    const left = options.filter(option => !picks.includes(option.value));
    if (!left.length) {
      break;
    }

    const value = await askPick(step, left, ctx, n, count);
    const chosen = left.find(option => option.value == value);
    if (!chosen) {
      return null;
    }

    picks.push(chosen.value);
  }

  return picks;
}

/** Make the picks and keep their uuids under the key. */
async function makeSubPerks(step, ctx, picks) {
  const key = String(step.key ?? 'perks');
  const made = [];
  for (const uuid of picks) {
    if (await create(ctx.actor, ctx.item, uuid)) {
      made.push(uuid);
    }
  }

  await write(ctx.item, 'update', [{ [`flags.essence20.rules.choices.${key}`]: made }]);
  globalThis.foundry?.utils?.setProperty?.(ctx.item, `flags.essence20.rules.choices.${key}`, made);
  ctx.vars.picked = made;
  return made;
}

/** How many times a granted item's required sub-Perk pick is asked again after a cancel (as lifecycle.mjs#setUpItem). */
const REQUIRED_REASKS = 10;

/** Whether the rule's item was granted (a Role level, another Perk): it carries grantedBy / parentId by now. */
function isGranted(ctx) {
  const actor = ctx.actor ?? ctx.item?.parent;
  const now = actor?.items?.get?.(ctx.item?.id) ?? ctx.item;
  return !!(now?.flags?.essence20?.grantedBy || now?.flags?.essence20?.parentId);
}

async function runPickSubPerk(step, ctx) {
  const options = await subPerkOptions(step, ctx);
  // required (Perk choice P2, user ruling 2026-10-07): a granted item is kept whatever happens - it asks again after a
  // cancel, and with nothing to offer it stays unpicked (a warning) rather than being taken off; a dropped one is
  // removed by its Trigger's removeOnStop, as the old picker never added it.
  const keep = () => step.required && isGranted(ctx);
  if (!options.length) {
    ctx.chat.push(localize('E20.Rules.Step.NothingToPick').replace('{item}', ctx.item?.name ?? ''));
    return step.optional || keep() ? undefined : false;
  }

  let picks = await askSubPerks(step, ctx, options);
  for (let tries = 0; !picks && keep() && tries < REQUIRED_REASKS; tries++) {
    globalThis.ui?.notifications?.warn?.(globalThis.game?.i18n?.format?.('E20.Rules.ChoiceRequired', { item: ctx.item?.name ?? '' }) ?? `${ctx.item?.name ?? ''}: a choice is required.`);
    picks = await askSubPerks(step, ctx, options);
  }

  if (!picks) {
    return step.optional || keep() ? undefined : false;
  }

  await makeSubPerks(step, ctx, picks);
}

registerStep('pickSubPerk', async (step, ctx) => {
  const actor = ctx.actor ?? ctx.item?.parent;
  if (!ctx.item || !actor) {
    return false;
  }

  ctx.actor ??= actor;
  return queueAsk(actor, () => runPickSubPerk(step, ctx));
}, {
  errors: (step, where) => [
    ...(formulaError(step.count) ? [`${where}.count: ${formulaError(step.count)}`] : []),
    ...(step.key !== undefined && !/^[\w-]+$/.test(String(step.key)) ? [`${where}: key must be a plain name`] : []),
  ],
});

/**
 * "Change" on the Rules tab: pick the sub-Perks again. The current picks are offered too; the old children (made under
 * this item from those picks) are taken off only once every new pick is made.
 * @param {Item} item
 * @param {Object} step   The rule's pickSubPerk step.
 * @param {Object} [rule]
 * @returns {Promise<Boolean>}   false when cancelled or there's no actor.
 */
export async function repickSubPerks(item, step, rule = null) {
  const actor = item?.parent?.documentName == 'Actor' ? item.parent : null;
  if (!actor) {
    return false;
  }

  return queueAsk(actor, async () => {
    const ctx = stepContext({ actor, item, rule, targets: [] });
    const current = subPerkPicks(item, step);
    const options = await subPerkOptions(step, ctx, { ignore: current });
    const picks = options.length ? await askSubPerks(step, ctx, options) : null;
    if (!picks) {
      return false;
    }

    const old = itemsOf(actor).filter(other => other.flags?.essence20?.parentId == item.id && current.includes(sourceOf(other))).map(other => other.id);
    if (old.length) {
      await write(actor, 'deleteEmbeddedDocuments', ['Item', old]);
    }

    await makeSubPerks(step, ctx, picks);
    return true;
  });
}

registerStepForm('pickSubPerk', [
  { path: 'key', kind: 'text', label: 'PickKey' },
  { path: 'count', kind: 'formula', label: 'SubPerkCount', hint: 'SubPerkCountHint' },
  { path: 'notOwned', kind: 'stacks', label: 'SubPerkNotOwned' },
  { path: 'anyGeneral', kind: 'checkbox', label: 'SubPerkAnyGeneral' },
  { path: 'prompt', kind: 'text', label: 'PickQuestion' },
  { path: 'optional', kind: 'checkbox', label: 'SubPerkOptional', advanced: true },
  { path: 'required', kind: 'checkbox', label: 'SubPerkRequired', advanced: true },
]);
