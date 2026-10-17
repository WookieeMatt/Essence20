import { registerStep, registerTextRef } from "../../steps.mjs";
import { escape, itemsOf, localize, sourceOf } from "../shared/copy-and-data-helpers.mjs";

/**
 * Round 15 (items2) - picking a Transformers chassis (an Alt Mode) by its Origin, from the visible packs' index
 * (items/shared/origin-chassis-index.mjs):
 *
 *   pickChassis {mode: origin, var?}   (the Drone Origin) - choose another Origin that has Alt Modes (not the rule's own
 *       item's source), then one of its chassis (asked only when it has several). Keeps @var.<var> (default chassis: the
 *       Alt Mode's uuid), <var>Name, <var>BotSize (the chassis' Bot Mode Size, '' when it has none), <var>Origin (the
 *       Origin's uuid), <var>OriginName and the Origin's base Movements <var>Ground / <var>Aerial / <var>Swim.
 *   pickChassis {mode: mimicry, flag, var?}   (Alt Mode Mimicry) - choose a chassis of an Origin the actor hasn't drawn
 *       one from yet (its original Alt Mode's, and those of the Alt Modes carrying flags.essence20.<flag>) whose Alt Mode
 *       Size is less than two Size Classes above the original's. No original Alt Mode: warns and stops.
 *   pickChassis {mode: additional, flag, var?}   (Additional Alt Mode, Everything in Threes - TF CRB p.107, p.76) - choose
 *       any Origin's chassis the actor doesn't have yet, whose Alt Mode Size isn't two Size Classes above the original's
 *       - unless the actor has Size Change, when it may be (TF CRB p.111 lets an Alt Mode be one class larger). No
 *       original Alt Mode: warns and stops.
 *   choose: true (any mode) - then asks the chassis' own choices (items/shared/alt-mode-chassis.mjs): its Alt Mode size,
 *       only among those the size window allows, and its movement; with mode origin (the Drone, who takes the Bot Mode
 *       too) also its Bot Mode size. Kept as @var.<var>System ({altModesize?, altModeMovement?} - grant's systemFrom)
 *       and <var>BotSize. A closed dialog stops the run.
 *
 * A cancelled pick stops the run; grant it with grant {uuid: "{var.chassis}"}. Text ref {ruleItem.<path>} - the rule's
 * own item (its id for a parentId flag).
 */

// Long and Extended sizes are the elongated forms of Large and Huge and share their Size Class.
const SIZE_CLASS = { small: 0, common: 1, large: 2, long: 2, huge: 3, extended: 3, gigantic: 4, extended2: 4, towering: 5, extended3: 5, titanic: 6 };

export const sizeClass = size => SIZE_CLASS[size] ?? 1;

/** Alt Mode Mimicry's size window: less than two Size Classes larger than the original. */
export const mimicrySizeOk = (originalSize, candidateSize) => sizeClass(candidateSize) - sizeClass(originalSize) < 2;

/** Size Change (TF CRB p.111): an Alt Mode one Size Class off - lets Additional Alt Mode reach two classes larger. */
export const SIZE_CHANGE_UUID = 'Compendium.essence20.tf_crb.Item.yqDvVK13r4ZzX7ic';

/** The Alt Mode sizes a chassis may be: its choices, else its one size. */
export const chassisSizes = entry => (entry?.system?.altModeSizeOptions?.length ? entry.system.altModeSizeOptions : [entry?.system?.altModesize ?? 'common']);

/** The sizes of a chassis inside a window over the original's size (max classes larger, exclusive). Exported for tests. */
export function sizesWithin(entry, originalSize, max = 2) {
  return chassisSizes(entry).filter(size => sizeClass(size) - sizeClass(originalSize) < max);
}

/** The helpers the step reads (tests set them). */
export const chassisHelpers = {
  index: async () => (await import("../../../items/shared/origin-chassis-index.mjs")).originIndex(),
  altModeUuidsOf: origin => Object.values(origin?.system?.items ?? {}).filter(entry => entry?.type == 'altMode').map(entry => entry.uuid),
  choose: async (title, prompt, options) => (await import("../../../mechanics/resources/grants.mjs")).chooseSelect(title, prompt, options),
  // A chassis' own choices, in the Origin-drop dialog (sheet-handlers/background-handler.mjs).
  chooseOptions: async system => (await import("../../../sheet-handlers/background-handler.mjs")).chooseAltModeOptions(system),
};

registerTextRef('ruleItem', (path, ctx) => {
  const value = String(path).split('.').reduce((at, key) => (at === null || at === undefined ? at : at[key]), ctx.item);
  return value === null || value === undefined || typeof value == 'object' ? '' : value;
});

function originalAltMode(actor, flag) {
  const modes = itemsOf(actor).filter(item => item.type == 'altMode' && !item.flags?.essence20?.[flag]);
  return modes.find(item => item.flags?.essence20?.parentId) ?? modes[0] ?? null;
}

const byLabel = (a, b) => a.label.localeCompare(b.label);

/** Rows by label, each label once - a chassis or Origin reprinted in another book (Insecticon, Monstrosity, Pretender). */
const listed = rows => rows.sort(byLabel).filter((row, i, all) => all.findIndex(other => other.label == row.label) == i);

registerStep('pickChassis', async (step, ctx) => {
  const name = step.var || 'chassis';
  const title = ctx.item?.name ?? '';
  const flag = String(step.flag ?? '');
  const original = ['mimicry', 'additional'].includes(step.mode) ? originalAltMode(ctx.actor, flag) : null;
  if (step.mode == 'mimicry' && !original) {
    globalThis.ui?.notifications?.warn?.(localize('E20.Tf1NoOriginalAltMode'));
    return false;
  }

  const { origins, altModes } = await chassisHelpers.index();
  const modesOf = chassisHelpers.altModeUuidsOf;
  let origin = null;
  let uuid = null;
  // The window over the original Alt Mode's size the chosen chassis' sizes must fit.
  let window = 2;
  if (step.mode == 'additional') {
    if (!original) {
      globalThis.ui?.notifications?.warn?.(localize('E20.Tf1NoOriginalAltMode'));
      return false;
    }

    window = itemsOf(ctx.actor).some(item => sourceOf(item) == SIZE_CHANGE_UUID) ? 3 : 2;
    const owned = new Set(itemsOf(ctx.actor).filter(item => item.type == 'altMode').map(item => sourceOf(item)).filter(Boolean));
    const originOf = modeUuid => origins.find(entry => modesOf(entry).includes(modeUuid)) ?? null;
    const rows = listed([...altModes.values()].filter(entry => originOf(entry.uuid) && !owned.has(entry.uuid)
      && sizesWithin(entry, original.system?.altModesize, window).length)
      .map(entry => ({ value: entry.uuid, label: `${entry.name} (${originOf(entry.uuid).name})` })));
    uuid = rows.length ? await chassisHelpers.choose(title, escape(localize('E20.Tf1PickChassis')), rows) : null;
    origin = uuid ? originOf(uuid) : null;
  } else if (step.mode == 'mimicry') {
    const originOf = modeUuid => origins.find(entry => modesOf(entry).includes(modeUuid)) ?? null;
    const taken = [original, ...itemsOf(ctx.actor).filter(item => item.flags?.essence20?.[flag])].map(item => originOf(sourceOf(item))?.uuid).filter(Boolean);
    const rows = listed([...altModes.values()].filter(entry => {
      const from = originOf(entry.uuid);
      return from && !taken.includes(from.uuid) && sizesWithin(entry, original.system?.altModesize).length;
    }).map(entry => ({ value: entry.uuid, label: `${entry.name} (${originOf(entry.uuid).name})` })));
    uuid = rows.length ? await chassisHelpers.choose(title, escape(localize('E20.Tf1PickChassis')), rows) : null;
    origin = uuid ? originOf(uuid) : null;
  } else {
    const own = sourceOf(ctx.item);
    const rows = listed(origins.filter(entry => entry.uuid != own && modesOf(entry).length).map(entry => ({ value: entry.uuid, label: entry.name })));
    const picked = rows.length ? await chassisHelpers.choose(title, escape(localize('E20.Tf1PickCopiedOrigin')), rows) : null;
    origin = origins.find(entry => entry.uuid == picked) ?? null;
    const modes = origin ? modesOf(origin) : [];
    uuid = modes.length > 1
      ? await chassisHelpers.choose(title, escape(localize('E20.Tf1PickChassis')), modes.map(mode => ({ value: mode, label: altModes.get(mode)?.name ?? mode })))
      : modes[0] ?? null;
  }

  const entry = uuid ? altModes.get(uuid) ?? null : null;
  if (!uuid || !origin) {
    return false;
  }

  // Its own choices - the sizes the window allows, its movement, and (taking the Bot Mode too, the Drone) its Bot Mode's.
  let system = {};
  let botSize = entry?.system?.botModeSize ?? '';
  if (step.choose && entry) {
    const sizes = original ? sizesWithin(entry, original.system?.altModesize, window) : chassisSizes(entry);
    const offered = {
      altModeSizeOptions: sizes,
      movementOptions: entry.system?.movementOptions ?? [],
      botModeSizeOptions: step.mode == 'origin' ? entry.system?.botModeSizeOptions ?? [] : [],
      botModeSizeFor: step.mode == 'origin' ? entry.system?.botModeSizeFor ?? {} : {},
    };
    const asks = sizes.length > 1 || offered.movementOptions.length > 1 || offered.botModeSizeOptions.length > 1;
    const picked = asks ? await chassisHelpers.chooseOptions(offered) : { alt: null, bot: null, movement: null };
    if (asks && !picked.alt && !picked.bot && !picked.movement) {
      return false;
    }

    const altSize = picked.alt ?? (sizes.includes(entry.system?.altModesize) ? null : sizes[0]);
    system = { ...(altSize ? { altModesize: altSize } : {}), ...(picked.movement ? { altModeMovement: picked.movement } : {}) };
    botSize = picked.bot ?? botSize;
  }

  ctx.vars[name] = uuid;
  ctx.vars[`${name}Name`] = entry?.name ?? '';
  ctx.vars[`${name}BotSize`] = botSize;
  ctx.vars[`${name}System`] = system;
  ctx.vars[`${name}Origin`] = origin.uuid;
  ctx.vars[`${name}OriginName`] = origin.name ?? '';
  ctx.vars[`${name}Ground`] = Number(origin.system?.baseGroundMovement) || 0;
  ctx.vars[`${name}Aerial`] = Number(origin.system?.baseAerialMovement) || 0;
  ctx.vars[`${name}Swim`] = Number(origin.system?.baseAquaticMovement) || 0;
}, {
  errors: (step, where) => [
    ...(['origin', 'mimicry', 'additional'].includes(step.mode) ? [] : [`${where}: pickChassis mode must be origin, mimicry or additional`]),
    ...(['mimicry', 'additional'].includes(step.mode) && !/^[\w-]+$/.test(String(step.flag ?? '')) ? [`${where}: pickChassis ${step.mode} needs a flag`] : []),
    ...(step.var && !/^[\w-]+$/.test(step.var) ? [`${where}: var must be a plain name`] : []),
  ],
});
