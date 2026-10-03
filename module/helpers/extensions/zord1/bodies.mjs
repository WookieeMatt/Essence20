import {
  registerApplyDialog, registerDerived, registerDialogToggles, registerRollSources, registerSceneAdvanced, registerUse,
} from "../../extensions.mjs";
import { getSceneEpoch } from "../../scene-clock.mjs";
import { worldActors } from "../../companion-link.mjs";
import { T, cc, dd, dsoe, findSourced, flagOf, isUnarmed, itemsOf, sourceOf, writeActor } from "./common.mjs";

/**
 * Size and mode items:
 * - Enlarged / Shrunk (Cobra Codex, Alterations, p.85-86): "Increase [Decrease] your size by one
 *   class." Cost: "You can only wear Battledress with the Restricted [Limited] Alteration Accommodation
 *   Upgrade (see page 101)."
 * - Revolutionary Shape-Shifting (Dark Skies over Equestria, spell, p.22).
 * - Additional Pair of Limbs (Decepticon Directive, p.76) - Alt/Bot Mode gated (system.isTransformed =
 *   Alt Mode). Plated Carapace and Titan Frame (same page) are item rules now (system.rules).
 */

export const BODY = {
  enlarged: cc('JPcfpND1LOVLDKIZ'),
  shrunk: cc('nvyLaYW6EOcAdHDo'),
  shapeShifting: dsoe('ojIyM3QMD0QgRGca'),
  limbs: dd('pedTP4vV1qwoBJvn'),
};

/* -------------------------------------------- */
/*  Size classes                                 */
/* -------------------------------------------- */

// The Size Class ladder; the "extended/long" rungs of E20.actorSizes are shapes of the class below.
export const SIZE_LADDER = ['small', 'common', 'large', 'huge', 'gigantic', 'towering', 'titanic'];
const SIZE_BASE = { long: 'large', extended: 'huge', extended2: 'gigantic', extended3: 'towering' };

export function shiftSize(size, steps) {
  const base = SIZE_BASE[size] ?? size;
  const index = SIZE_LADDER.indexOf(base);
  if (index < 0) {
    return size;
  }

  return SIZE_LADDER[Math.max(0, Math.min(SIZE_LADDER.length - 1, index + steps))];
}

const ORIGINAL_SIZE = 'zord1OriginalSize';

async function applyAlterationSize(item, steps) {
  const actor = item.parent;
  if (!actor?.system?.size || flagOf(item, ORIGINAL_SIZE)) {
    return;
  }

  await item.setFlag('essence20', ORIGINAL_SIZE, actor.system.size);
  await actor.update({ 'system.size': shiftSize(actor.system.size, steps) });
}

async function revertAlterationSize(item) {
  const actor = item.parent;
  const original = flagOf(item, ORIGINAL_SIZE);
  if (actor && original) {
    await actor.update({ 'system.size': original });
  }
}

/** Whether this armor has the Accommodation Upgrade the alteration needs. */
export function hasAccommodation(actor, armor, level) {
  const tiers = level == 'limited' ? /limited|restricted/i : /restricted/i;
  const upgrades = [
    ...itemsOf(actor).filter(item => item.type == 'upgrade' && flagOf(item, 'parentId') == armor.id).map(item => item.name),
    ...Object.values(armor.system?.items ?? {}).map(entry => entry?.name),
  ].filter(Boolean);
  return upgrades.some(name => /accomm?odation/i.test(name) && tiers.test(name));
}

/** @returns {Boolean} false to refuse putting the armor on. */
export function checkBattledress(item, changes) {
  const actor = item?.parent;
  if (item?.type != 'armor' || changes?.system?.equipped !== true || !actor) {
    return true;
  }

  const need = findSourced(actor, BODY.enlarged) ? 'restricted' : (findSourced(actor, BODY.shrunk) ? 'limited' : null);
  if (need && !hasAccommodation(actor, item, need)) {
    ui.notifications.warn(T('Zord1NeedsAccommodation', { name: actor.name, armor: item.name, level: T(need == 'restricted' ? 'Zord1Restricted' : 'Zord1Limited') }));
    return false;
  }

  return true;
}

/* -------------------------------------------- */
/*  Revolutionary Shape-Shifting                 */
/* -------------------------------------------- */

const SHAPE_FLAG = 'zord1ShapeShift';

export function shapeOf(actor) {
  const state = flagOf(actor, SHAPE_FLAG);
  return state && state.epoch == getSceneEpoch() ? state : null;
}

/**
 * "When you change shape using this spell... You may change into another creature but not a specific
 * individual. You gain full use of the creature's natural attacks and a ↑1 on all Skill Tests
 * appropriate to the creature you turn into and may change to be one size larger or smaller than your
 * current size." 1 Scene. Cast the spell as usual, then press Use to take the shape.
 */
async function runShapeShift(item) {
  const actor = item.parent;
  const current = flagOf(actor, SHAPE_FLAG);
  if (current) {
    await endShapeShift(actor);
    return T('Zord1ShapeEnded', { name: actor.name });
  }

  const creature = await foundry.applications.api.DialogV2.prompt({
    window: { title: item.name },
    content: `<div class="form-group"><label>${T('Zord1ShapeCreature')}</label><input type="text" name="creature" autofocus></div>`,
    ok: { label: game.i18n.localize('E20.DialogConfirmButton'), callback: (event, button) => button.form.elements.creature.value },
    rejectClose: false,
  });
  if (!creature) {
    return null;
  }

  const { chooseButtons } = await import("../../grants.mjs");
  const size = await chooseButtons(item.name, T('Zord1ShapeSize'), [['-1', T('Zord1ShapeSmaller')], ['0', T('Zord1ShapeSame')], ['1', T('Zord1ShapeLarger')]]);
  const steps = Number(size) || 0;
  const original = actor.system?.size ?? null;
  await actor.setFlag('essence20', SHAPE_FLAG, { creature, epoch: getSceneEpoch(), originalSize: original, steps });
  if (steps && original) {
    await actor.update({ 'system.size': shiftSize(original, steps) });
  }

  return T('Zord1ShapeTaken', { name: actor.name, creature });
}

export async function endShapeShift(actor) {
  const state = flagOf(actor, SHAPE_FLAG);
  if (!state) {
    return;
  }

  if (state.steps && state.originalSize) {
    await writeActor(actor, 'update', [{ 'system.size': state.originalSize }]);
  }

  await writeActor(actor, 'unsetFlag', ['essence20', SHAPE_FLAG]);
}

/* -------------------------------------------- */
/*  Decepticon Directive mode items              */
/* -------------------------------------------- */

export function bodiesDerived(actor) {
  const system = actor?.system;
  const defenses = system?.defenses;
  if (!defenses) {
    return;
  }

  const altMode = !!system.isTransformed;

  // Additional Pair of Limbs, Alt Mode: "Adds 10ft to your Ground Movement".
  const limbs = findSourced(actor, BODY.limbs);
  if (limbs && altMode && flagOf(limbs, 'zord1LimbsMode') == 'move' && system.movement?.ground) {
    system.movement.ground.total = (Number(system.movement.ground.total) || 0) + 10;
  }
}

export function bodiesRollSources(actor, target, { item, isAttack } = {}) {
  const sources = [];
  // Additional Pair of Limbs, Alt Mode: "...or Multiple (2) Targets (Reach, ↓1) to your unarmed combat
  // attack." The ↓1 applies when the unarmed attack goes at two targets.
  const limbs = findSourced(actor, BODY.limbs);
  if (limbs && actor.system?.isTransformed && flagOf(limbs, 'zord1LimbsMode') == 'multi' && isAttack && isUnarmed(actor, item)
    && (game.user?.targets?.size ?? 0) >= 2) {
    sources.push({ id: 'zord1Limbs', label: limbs.name, shiftDown: 1 });
  }

  return { sources };
}

export function shapeToggles(actor) {
  const shape = shapeOf(actor);
  return shape ? [{ name: 'zord1Shape', type: 'checkbox', label: T('Zord1ToggleShape', { creature: shape.creature }) }] : [];
}

export async function shapeApplyDialog(actor, options) {
  if (options.ext?.zord1Shape) {
    options.shiftUp = (Number(options.shiftUp) || 0) + 1;
  }
}

async function runLimbs(item, economy, pay) {
  const actor = item.parent;
  const { chooseButtons } = await import("../../grants.mjs");
  const rows = [['move', T('Zord1LimbsMove')], ['multi', T('Zord1LimbsMulti')]];
  // Bot Mode: "stand up from being Prone as a Free action that doesn't require any of your Movement."
  if (!actor.system?.isTransformed && actor.statuses?.has?.('prone')) {
    rows.unshift(['stand', T('Zord1LimbsStand')]);
  }

  const choice = await chooseButtons(item.name, T('Zord1LimbsPrompt'), rows);
  if (choice == 'stand') {
    if (!(await pay('free'))) {
      return null;
    }

    await actor.toggleStatusEffect('prone', { active: false });
    return T('Zord1LimbsStood', { name: actor.name });
  }

  if (['move', 'multi'].includes(choice)) {
    await item.setFlag('essence20', 'zord1LimbsMode', choice);
    return T('Zord1LimbsSet', { name: actor.name, mode: T(choice == 'move' ? 'Zord1LimbsMove' : 'Zord1LimbsMulti') });
  }

  return null;
}

/* -------------------------------------------- */
/*  Registration                                 */
/* -------------------------------------------- */

registerDerived(bodiesDerived);
registerRollSources(bodiesRollSources);
registerDialogToggles(shapeToggles);
registerApplyDialog(shapeApplyDialog);
registerUse({ id: 'zord1ShapeShift', matches: item => sourceOf(item) == BODY.shapeShifting, run: runShapeShift });
registerUse({ id: 'zord1Limbs', matches: item => sourceOf(item) == BODY.limbs, run: runLimbs });

// A new scene ends the shape (1 Scene duration).
registerSceneAdvanced(async () => {
  for (const actor of worldActors()) {
    if (flagOf(actor, SHAPE_FLAG)) {
      await endShapeShift(actor);
    }
  }
});

globalThis.Hooks?.on?.('createItem', (item, options, userId) => {
  if (userId != globalThis.game?.user?.id) {
    return;
  }

  const source = sourceOf(item);
  if (source == BODY.enlarged) {
    applyAlterationSize(item, 1);
  } else if (source == BODY.shrunk) {
    applyAlterationSize(item, -1);
  }
});

globalThis.Hooks?.on?.('deleteItem', (item, options, userId) => {
  if (userId == globalThis.game?.user?.id && [BODY.enlarged, BODY.shrunk].includes(sourceOf(item))) {
    revertAlterationSize(item);
  }
});

globalThis.Hooks?.on?.('preUpdateItem', (item, changes) => checkBattledress(item, changes));
