import {
  registerApplyDialog, registerDialogToggles, registerPostRoll, registerRollSources, registerUse,
} from "../../mechanics/item-hooks.mjs";
import { getSceneEpoch } from "../../mechanics/resources/scene-clock.mjs";
import { hasSourced, worldActors } from "../../mechanics/companions/companion-link.mjs";

/**
 * My Little Pony - Dark Skies over Equestria and Knights of Canterlot items: shape-shifting
 * (Basic Shape-Shifting's shape, Face-Shift, Master Morph, Size-Shift). Pinkie Sense is its item's own rule now; so are
 * Softenblows (rules/conv10-slB10.test.js), Illusion Casting, Reach Out, Brilliant Sight's fog option (SpellCost rules),
 * Sharpcaster, Sorcerous Support and the Smoke Bomb (rules/conv10-slD10.test.js), and Brilliant Sight's darkvision
 * (rules/conv12-slI12.test.js).
 */

const pack = (p, id) => `Compendium.essence20.${p}.Item.${id}`;
const dse = id => pack('dark_skies_over_equestria', id);
export const MLP1 = {
  basicShapeShifting: dse('u2fdkjPJZmeLgalz'),
  faceShift: dse('E1ZaVoP0yjYfyj6F'),
  masterMorph: dse('0fKppLmw0TSNAn5z'),
  sizeShift: dse('44UMuF7vQM094oQq'),
  shapeShiftOrigin: dse('yi2Z2ebEmTuow5LL'),
  ponymorph: pack('mlp_crb', '3Tm9SWc060Z62e4Q'),
};

const T = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));
const SHAPE_FLAG = 'mlpShape';

function sourceOf(item) {
  return item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource;
}

function itemsOf(actor) {
  const items = actor?.items;
  return Array.isArray(items?.contents) ? items.contents : (items && typeof items[Symbol.iterator] == 'function' ? [...items] : []);
}

const itemOf = (actor, uuid) => itemsOf(actor).find(i => sourceOf(i) == uuid) ?? null;
const nameOf = (actor, uuid, fallback) => itemOf(actor, uuid)?.name ?? fallback;

/* -------------------------------------------- */
/*  Shape-shifting                               */
/* -------------------------------------------- */

/** The current changed shape: {scene, faceSkill, morphSkill, originalSize}, or null. */
export function shapeOf(actor) {
  const shape = actor?.flags?.essence20?.[SHAPE_FLAG];
  return shape && shape.scene == getSceneEpoch() ? shape : null;
}

async function setShape(actor, shape) {
  await actor.setFlag('essence20', SHAPE_FLAG, { ...shape, scene: getSceneEpoch() });
}

/**
 * Change shape - the Use button on Shape-Shift, Face-Shift, Master Morph or Size-Shift. "When you change
 * your shape, you can choose to take the shape of an individual" (Face-Shift, ↑1 on a Skill that
 * individual is known for), "gain a ↑2 bonus to a Skill that the target is known for" (Master Morph),
 * "take the shape of a creature one size category larger or smaller" per pick (Size-Shift).
 */
export async function changeShape(actor) {
  const current = shapeOf(actor);
  if (current) {
    if (current.originalSize) {
      await actor.update({ 'system.size': current.originalSize });
    }

    await actor.unsetFlag('essence20', SHAPE_FLAG);
    return T('E20.Mlp1ShapeEnds', { name: actor.name });
  }

  const skills = Object.entries(CONFIG.E20.skills).map(([value, label]) => `<option value="${value}">${T(label)}</option>`).join('');
  const sizes = Object.keys(CONFIG.E20.actorSizes ?? {});
  const steps = itemsOf(actor).filter(i => sourceOf(i) == MLP1.sizeShift).length;
  const here = sizes.indexOf(actor.system?.size ?? 'common');
  const sizeOptions = steps ? sizes.map((s, i) => [s, i]).filter(([, i]) => Math.abs(i - here) <= steps)
    .map(([s]) => `<option value="${s}" ${s == actor.system?.size ? 'selected' : ''}>${T(CONFIG.E20.actorSizes[s])}</option>`).join('') : '';
  const face = hasSourced(actor, MLP1.faceShift);
  const morph = hasSourced(actor, MLP1.masterMorph);
  const answer = await foundry.applications.api.DialogV2.wait({
    window: { title: T('E20.Mlp1ShapeTitle') },
    classes: ["window-app", "e20-window"],
    content: [
      face ? `<div class="form-group"><label>${T('E20.Mlp1FaceSkill')}</label><select name="face"><option value="">${T('E20.None')}</option>${skills}</select></div>` : '',
      morph ? `<div class="form-group"><label>${T('E20.Mlp1MorphSkill')}</label><select name="morph"><option value="">${T('E20.None')}</option>${skills}</select></div>` : '',
      steps ? `<div class="form-group"><label>${T('E20.Mlp1Size')}</label><select name="size">${sizeOptions}</select></div>` : '',
      `<p>${T('E20.Mlp1ShapePrompt')}</p>`,
    ].join(''),
    buttons: [
      { action: 'ok', label: T('E20.DialogConfirmButton'), default: true, callback: (event, button) => ({
        face: button.form.elements.face?.value || null, morph: button.form.elements.morph?.value || null, size: button.form.elements.size?.value || null,
      }) },
      { action: 'cancel', label: T('E20.DialogCancelButton') },
    ],
    rejectClose: false,
  });
  if (!answer || answer == 'cancel') {
    return null;
  }

  const shape = { faceSkill: answer.face, morphSkill: answer.morph };
  if (answer.size && answer.size != actor.system?.size) {
    shape.originalSize = actor.system?.size ?? 'common';
    await actor.update({ 'system.size': answer.size });
  }

  await setShape(actor, shape);
  return T('E20.Mlp1ShapeChanged', { name: actor.name });
}

/* -------------------------------------------- */
/*  Roll sources                                 */
/* -------------------------------------------- */

export function mlp1RollSources(actor, target, { rolledSkill } = {}) {
  const sources = [];
  const consumes = [];
  const shape = shapeOf(actor);

  if (shape?.faceSkill && shape.faceSkill == rolledSkill) {
    sources.push({ id: 'faceShift', label: nameOf(actor, MLP1.faceShift, 'Face-Shift'), shiftUp: 1 });
  }

  if (shape?.morphSkill && shape.morphSkill == rolledSkill) {
    sources.push({ id: 'masterMorph', label: nameOf(actor, MLP1.masterMorph, 'Master Morph'), shiftUp: 2 });
  }

  return { sources, consumes };
}

/* -------------------------------------------- */
/*  Dialog choices                               */
/* -------------------------------------------- */

export function mlp1Toggles(actor) {
  const toggles = [];
  const add = (name, label, extra = {}) => toggles.push({ name, label, type: 'checkbox', ...extra });

  // Face-Shift: "You gain Edge on Skill Tests to pass as that individual".
  if (shapeOf(actor) && hasSourced(actor, MLP1.faceShift)) {
    add('faceShiftPass', T('E20.Mlp1TogglePassAs'));
  }

  return toggles;
}

export async function mlp1ApplyDialog(actor, options) {
  const ext = options.ext ?? {};
  const edge = () => (options.snag ? (options.snag = false) : (options.edge = true));

  if (ext.faceShiftPass) {
    edge();
  }
}

/* -------------------------------------------- */
/*  After a cast                                 */
/* -------------------------------------------- */

export async function mlp1PostRoll(actor, results, checkContext) {
  const rider = checkContext?.riderContext ?? {};
  const source = rider.itemSource;
  const succeeded = (results ?? []).some(r => r.success) || (!(results ?? []).length && !checkContext?.rollFailed);
  const cast = source && (await fromUuid(rider.itemUuid))?.type == 'spell';
  if (!cast) {
    return;
  }

  // Basic Shape-Shifting / Ponymorph: the caster changes shape.
  if ((source == MLP1.basicShapeShifting || source == MLP1.ponymorph) && succeeded) {
    await setShape(actor, { ...(shapeOf(actor) ?? {}), spell: source });
  }

  // Brilliant Sight's darkvision for the scene is an afterRoll Trigger on the spell (createItem - rules/conv12-slI12.test.js).

  // Softenblows (the enchanted creature's hits deal nothing) is an afterRoll Trigger + a marked HitRider on the spell.
}

/* -------------------------------------------- */
/*  Use buttons                                  */
/* -------------------------------------------- */

const USES = [
  {
    id: 'mlp1Shape',
    matches: item => [MLP1.shapeShiftOrigin, MLP1.faceShift, MLP1.masterMorph, MLP1.sizeShift].includes(sourceOf(item)),
    run: item => changeShape(item.parent),
  },
];

/* -------------------------------------------- */
/*  Registration                                 */
/* -------------------------------------------- */

registerRollSources(mlp1RollSources);
registerDialogToggles(mlp1Toggles);
registerApplyDialog(mlp1ApplyDialog);
registerPostRoll(mlp1PostRoll);
USES.forEach(registerUse);

// Pointy (DSoE p.21): "Manifesting the natural weapon ... lasts until the end of the combat scene."
globalThis.Hooks?.on?.('deleteCombat', () => {
  for (const actor of worldActors()) {
    if (actor.isOwner && actor.flags?.essence20?.pointyActive && globalThis.game.user?.isGM) {
      actor.unsetFlag('essence20', 'pointyActive');
    }
  }
});
