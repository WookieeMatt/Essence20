import { registerStep } from "../../steps.mjs";

/**
 * Step `reduceTimer {by}` (round 15, systems - docs/rules-batches/slSystems15.md): the actor picks one of the timers
 * still running for them - a Zord of theirs still on its way (zordSummonReadyRound, mechanics/vehicles/zord-summon.mjs) or
 * a Megaform they are part of that can't combine yet (combineReadyRound, mechanics/vehicles/combiner-timer.mjs) - and it
 * comes `by` rounds sooner, never before the current round. Nothing running: a warning, and the run stops (a Use's limit
 * isn't spent). Accelerate Conversion.
 */

const T = (key, data) => (data ? globalThis.game?.i18n?.format?.(key, data) : globalThis.game?.i18n?.localize?.(key)) ?? key;

const worldActors = () => {
  const actors = globalThis.game?.actors;
  return actors?.contents ?? (actors && typeof actors[Symbol.iterator] == 'function' ? [...actors] : []);
};

registerStep('reduceTimer', async (step, ctx) => {
  const actor = ctx.actor;
  const by = Math.max(0, Math.round(Number(step.by ?? 2) || 0));
  const options = [];
  for (const entry of Object.values(actor?.system?.actors ?? {})) {
    const other = globalThis.fromUuidSync?.(entry?.uuid);
    if (other?.flags?.essence20?.zordSummonReadyRound) {
      options.push({ value: other.uuid, label: other.name, flag: 'zordSummonReadyRound' });
    }
  }

  for (const megaform of worldActors().filter(a => a.type == 'megaform' && a.flags?.essence20?.combineReadyRound
    && Object.values(a.system?.actors ?? {}).some(e => e?.uuid == actor?.uuid))) {
    options.push({ value: megaform.uuid, label: megaform.name, flag: 'combineReadyRound' });
  }

  if (!options.length) {
    globalThis.ui?.notifications?.warn?.(T('E20.AccelerateNothing'));
    return false;
  }

  const { chooseSelect } = await import("../../../mechanics/resources/grants.mjs");
  const picked = options.length == 1 ? options[0].value : await chooseSelect(T('E20.AccelerateConversion'), T('E20.AcceleratePick'), options);
  const option = options.find(o => o.value == picked);
  const target = option ? await globalThis.fromUuid?.(option.value) : null;
  if (!target) {
    return false;
  }

  const ready = Math.max(globalThis.game?.combat?.round ?? 0, Number(target.flags.essence20[option.flag]) - by);
  await target.setFlag('essence20', option.flag, ready);
  ctx.chat.push(T('E20.Accelerated', { name: target.name, round: ready }));
}, { errors: (step, where) => (step.by !== undefined && !(Number(step.by) >= 0) ? [`${where}: reduceTimer by must be a number`] : []) });
