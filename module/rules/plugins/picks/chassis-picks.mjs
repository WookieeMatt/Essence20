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
 *
 * A cancelled pick stops the run; grant it with grant {uuid: "{var.chassis}"}. Text ref {ruleItem.<path>} - the rule's
 * own item (its id for a parentId flag).
 */

// Long and Extended sizes are the elongated forms of Large and Huge and share their Size Class.
const SIZE_CLASS = { small: 0, common: 1, large: 2, long: 2, huge: 3, extended: 3, gigantic: 4, extended2: 4, towering: 5, extended3: 5, titanic: 6 };

export const sizeClass = size => SIZE_CLASS[size] ?? 1;

/** Alt Mode Mimicry's size window: less than two Size Classes larger than the original. */
export const mimicrySizeOk = (originalSize, candidateSize) => sizeClass(candidateSize) - sizeClass(originalSize) < 2;

/** The helpers the step reads (tests set them). */
export const chassisHelpers = {
  index: async () => (await import("../../../items/shared/origin-chassis-index.mjs")).originIndex(),
  altModeUuidsOf: origin => Object.values(origin?.system?.items ?? {}).filter(entry => entry?.type == 'altMode').map(entry => entry.uuid),
  choose: async (title, prompt, options) => (await import("../../../mechanics/resources/grants.mjs")).chooseSelect(title, prompt, options),
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

registerStep('pickChassis', async (step, ctx) => {
  const name = step.var || 'chassis';
  const title = ctx.item?.name ?? '';
  const flag = String(step.flag ?? '');
  const original = step.mode == 'mimicry' ? originalAltMode(ctx.actor, flag) : null;
  if (step.mode == 'mimicry' && !original) {
    globalThis.ui?.notifications?.warn?.(localize('E20.Tf1NoOriginalAltMode'));
    return false;
  }

  const { origins, altModes } = await chassisHelpers.index();
  const modesOf = chassisHelpers.altModeUuidsOf;
  let origin = null;
  let uuid = null;
  if (step.mode == 'mimicry') {
    const originOf = modeUuid => origins.find(entry => modesOf(entry).includes(modeUuid)) ?? null;
    const taken = [original, ...itemsOf(ctx.actor).filter(item => item.flags?.essence20?.[flag])].map(item => originOf(sourceOf(item))?.uuid).filter(Boolean);
    const rows = [...altModes.values()].filter(entry => {
      const from = originOf(entry.uuid);
      return from && !taken.includes(from.uuid) && mimicrySizeOk(original.system?.altModesize, entry.system?.altModesize);
    }).map(entry => ({ value: entry.uuid, label: `${entry.name} (${originOf(entry.uuid).name})` })).sort(byLabel);
    uuid = rows.length ? await chassisHelpers.choose(title, escape(localize('E20.Tf1PickChassis')), rows) : null;
    origin = uuid ? originOf(uuid) : null;
  } else {
    const own = sourceOf(ctx.item);
    const rows = origins.filter(entry => entry.uuid != own && modesOf(entry).length).map(entry => ({ value: entry.uuid, label: entry.name })).sort(byLabel);
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

  ctx.vars[name] = uuid;
  ctx.vars[`${name}Name`] = entry?.name ?? '';
  ctx.vars[`${name}BotSize`] = entry?.system?.botModeSize ?? '';
  ctx.vars[`${name}Origin`] = origin.uuid;
  ctx.vars[`${name}OriginName`] = origin.name ?? '';
  ctx.vars[`${name}Ground`] = Number(origin.system?.baseGroundMovement) || 0;
  ctx.vars[`${name}Aerial`] = Number(origin.system?.baseAerialMovement) || 0;
  ctx.vars[`${name}Swim`] = Number(origin.system?.baseAquaticMovement) || 0;
}, {
  errors: (step, where) => [
    ...(['origin', 'mimicry'].includes(step.mode) ? [] : [`${where}: pickChassis mode must be origin or mimicry`]),
    ...(step.mode == 'mimicry' && !/^[\w-]+$/.test(String(step.flag ?? '')) ? [`${where}: pickChassis mimicry needs a flag`] : []),
    ...(step.var && !/^[\w-]+$/.test(step.var) ? [`${where}: var must be a plain name`] : []),
  ],
});
