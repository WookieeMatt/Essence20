/**
 * Adventures in Angel Grove / Beneath the Helmet items for the pr1 slice.
 *
 * - Advanced Dino Gem Integration, Zord Feature (Beneath the Helmet, p.71-72): one of - Dino Shield
 *   "Snag to ranged attacks targeting the Zord specifically"; Dino Sense "Gain ↑2 on all Alertness
 *   Skill Tests"; Primordial Power "May choose to take a Snag on melee attacks to inflict +2 damage";
 *   Enhanced Stealth "Increase all Movement types by 10 feet. Gain ↑2 on Infiltration Skill Tests to
 *   move quietly and avoid detection"; Genetic Resonance "Reduce the time it takes for the Zord to
 *   arrive when summoned to the conflict by 2 rounds to a minimum of 1 round."
 */
import {
  registerApplyDialog, registerDerived, registerDialogToggles, registerHitRider, registerRollSources, registerUse,
} from "../../extensions.mjs";
import {
  PR1, T, allSourced, driverOf, findSourced, flagOf, giveSnag, isItem, isMeleeEffect, isRanged,
  num, pending, postLine, seatsOf, setPending,
} from "./common.mjs";

/* -------------------------------------------- */
/*  Advanced Dino Gem Integration                */
/* -------------------------------------------- */

const DINO_FLAG = 'pr1DinoGem';
export const DINO_OPTIONS = ['shield', 'sense', 'primordial', 'stealth', 'resonance'];
const SUMMON_FLAG = 'zordSummonReadyRound';

export const dinoOf = zord => allSourced(zord, PR1.advancedDinoGem).map(f => flagOf(f, DINO_FLAG)).filter(Boolean);
const dinoHas = (zord, option) => zord?.type == 'zord' && dinoOf(zord).includes(option);

async function pickDino(feature) {
  const { chooseSelect } = await import("../../grants.mjs");
  const option = await chooseSelect(feature.name, T('Pr1DinoPick'), DINO_OPTIONS.map(value => ({ value, label: T(`Pr1Dino.${value}`) })));
  if (!option) {
    return null;
  }

  await feature.setFlag('essence20', DINO_FLAG, option);
  return T('Pr1DinoChosen', { name: feature.parent?.name ?? '', option: T(`Pr1Dino.${option}`) });
}

registerUse({
  id: 'pr1-advanced-dino-gem',
  matches: item => isItem(item, PR1.advancedDinoGem),
  canUse: item => !flagOf(item, DINO_FLAG),
  run: item => pickDino(item),
});

/** The Zord a roll draws on: the Zord itself, or the one its roller is driving. */
function zordFor(actor) {
  return actor?.type == 'zord' ? actor : seatsOf(actor).find(s => s.role == 'driver' && s.vehicle?.type == 'zord')?.vehicle ?? null;
}

export function dinoSources(actor, target, { rolledSkill, item, isAttack } = {}) {
  const sources = [];
  const label = zord => findSourced(zord, PR1.advancedDinoGem)?.name ?? 'Advanced Dino Gem Integration';
  const zord = zordFor(actor);
  if (rolledSkill == 'alertness' && dinoHas(zord, 'sense')) {
    sources.push({ id: 'pr1DinoSense', label: label(zord), shiftUp: 2 });
  }

  if (rolledSkill == 'infiltration' && dinoHas(zord, 'stealth')) {
    sources.push({ id: 'pr1DinoStealth', label: T('Pr1DinoStealthLabel', { name: label(zord) }), shiftUp: 2 });
  }

  // Dino Shield: "Snag to ranged attacks targeting the Zord specifically."
  if (isAttack && isRanged(item) && dinoHas(target, 'shield')) {
    sources.push({ id: 'pr1DinoShield', label: label(target), snag: true });
  }

  return sources;
}

export function dinoDerived(actor) {
  if (!dinoHas(actor, 'stealth')) {
    return;
  }

  for (const movement of Object.values(actor.system?.movement ?? {})) {
    if (movement && num(movement.total) > 0) {
      movement.total = num(movement.total) + 10;
    }
  }
}

/** Genetic Resonance: the rolled 3d2 arrival, two rounds sooner (at least 1). */
export function resonanceRound(readyRound, currentRound) {
  const rounds = num(readyRound) - num(currentRound);
  return num(currentRound) + Math.max(1, rounds - 2);
}

globalThis.Hooks?.on?.('updateActor', async (actor, changes, options, userId) => {
  const ready = changes?.flags?.essence20?.[SUMMON_FLAG];
  if (userId != globalThis.game?.user?.id || actor?.type != 'zord' || !ready || !dinoHas(actor, 'resonance')
    || flagOf(actor, 'pr1ResonanceFor') == ready || !globalThis.game?.combat) {
    return;
  }

  const sooner = resonanceRound(ready, game.combat.round);
  await actor.update({ [`flags.essence20.${SUMMON_FLAG}`]: sooner, 'flags.essence20.pr1ResonanceFor': sooner });
  await postLine(driverOf(actor) ?? actor, T('Pr1DinoResonanceLine', { name: actor.name, round: sooner }));
});

registerDialogToggles((actor, { item } = {}) => (dinoHas(actor, 'primordial') && isMeleeEffect(item)
  ? [{ name: 'pr1DinoPrimordial', label: T('Pr1DinoPrimordialToggle'), type: 'checkbox', value: false }]
  : []));

registerApplyDialog((actor, options) => {
  if (options.ext?.pr1DinoPrimordial) {
    giveSnag(options);
    setPending(actor, { primordial: true });
  }
});

registerHitRider((actor, target, result, rider, tools) => {
  if (pending(actor).primordial && result?.damageValue) {
    tools.damageBonusNote(result, 2, findSourced(actor, PR1.advancedDinoGem)?.name ?? 'Primordial Power');
  }
});

registerRollSources((actor, target, ctx) => ({ sources: dinoSources(actor, target, ctx) }));
registerDerived(dinoDerived);

globalThis.Hooks?.on?.('createItem', async (item, options, userId) => {
  if (userId != globalThis.game?.user?.id || item.parent?.type != 'zord' || !isItem(item, PR1.advancedDinoGem) || flagOf(item, DINO_FLAG)) {
    return;
  }

  const line = await pickDino(item);
  if (line) {
    await postLine(item.parent, line);
  }
});

