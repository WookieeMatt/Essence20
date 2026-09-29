import {
  registerApplyDialog, registerConsumer, registerDialogToggles, registerHitRider, registerPostRoll, registerRollSources, registerSpellCost,
  registerUse, registerChatButton, registerChatDecorator,
} from "../../extensions.mjs";
import { activateForWindow, getSceneEpoch, getUses, isActiveForWindow, markUsed } from "../../scene-clock.mjs";
import { hasSourced, worldActors } from "../../companion-link.mjs";

/**
 * My Little Pony - Dark Skies over Equestria, In a Jam and Knights of Canterlot items: shape-shifting
 * (Basic Shape-Shifting, Face-Shift, Identity Crisis, Master Morph, Size-Shift), Prize Honey,
 * Honorary Apple, Key to Whinnypeg, the Knights of Canterlot tools and Hang-Ups, and the spell Perks
 * (Illusion Casting, Mastery Power, Reach Out, Sharpcaster, Sorcerous Support) and spells (Brilliant
 * Sight, Pinkie Sense, Softenblows).
 */

const pack = (p, id) => `Compendium.essence20.${p}.Item.${id}`;
const dse = id => pack('dark_skies_over_equestria', id);
const koc = id => pack('knights_of_canterlot', id);
export const MLP1 = {
  basicShapeShifting: dse('u2fdkjPJZmeLgalz'),
  faceShift: dse('E1ZaVoP0yjYfyj6F'),
  identityCrisis: dse('R6XROOkbI2dKmn5R'),
  masterMorph: dse('0fKppLmw0TSNAn5z'),
  prizeHoney: dse('tbBjkVhSSc3Zj9zp'),
  sizeShift: dse('44UMuF7vQM094oQq'),
  shapeShiftOrigin: dse('yi2Z2ebEmTuow5LL'),
  ponymorph: pack('mlp_crb', '3Tm9SWc060Z62e4Q'),
  honoraryApple: pack('in_a_jam', 'bYx0fmWfkOTjr97q'),
  keyToWhinnypeg: pack('in_a_jam', '6HJlO4qnOTRqrOmF'),
  brilliantSight: koc('Oc8NpQa5ylK2Ix0B'),
  eagerToExplode: koc('ieng7vOsUiz5fVBP'),
  farSighted: koc('Sm7INWZQAIXlu5HC'),
  handAxe: koc('7crNgIuylYGHUES8'),
  handsaw: koc('f9Xl8sawCJ7EBwGw'),
  hardHabit: koc('q9ObJy6Ipqn7lPHM'),
  hiddenInPlainSight: koc('Sm5LWv4KkiQJNYyI'),
  illusionCasting: koc('UadqOmn6aZKAvXT1'),
  masteryPower: koc('DyIbIDlzOJX5GiO2'),
  miredInAcademia: koc('EC7Xzefmh7AEHBrr'),
  net: koc('5ZsWimVR7fWu2EMW'),
  pinkieSense: koc('hER4hs3jrIHM8gF3'),
  reachOut: koc('gu2V2C4aH0fsDYXN'),
  sharpcaster: koc('Cnv01qtQwEdrUh8I'),
  smokeBomb: koc('L5KOGeqX43EdO3b3'),
  snareTrap: koc('pCncxHtzpST2EN9Z'),
  softenblows: koc('j5qSt58bw2YLeDMq'),
  sorcerousSupport: koc('PhK5KSV4IXpOcTYP'),
};

const T = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));
const SHAPE_FLAG = 'mlpShape';

function sourceOf(item) {
  return item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource;
}

function itemsOf(actor) {
  const items = actor?.items;
  return Array.isArray(items?.contents) ? items.contents : (items && typeof items[Symbol.iterator] == 'function' ? [...items] : []);
}

const itemOf = (actor, uuid) => itemsOf(actor).find(i => sourceOf(i) == uuid) ?? null;
const nameOf = (actor, uuid, fallback) => itemOf(actor, uuid)?.name ?? fallback;
const essenceOf = skill => CONFIG.E20?.skillToEssence?.[skill];

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

export function mlp1RollSources(actor, target, { item, rolledSkill } = {}) {
  const sources = [];
  const consumes = [];
  const shape = shapeOf(actor);

  // Basic Shape-Shifting (DSoE p.22): "You gain Edge on Deception and Infiltration Skill Tests to maintain
  // your deception".
  if (shape?.spell && ['deception', 'infiltration'].includes(rolledSkill)) {
    sources.push({ id: 'basicShapeShifting', label: nameOf(actor, MLP1.basicShapeShifting, 'Basic Shape-Shifting'), edge: true });
  }

  if (shape?.faceSkill && shape.faceSkill == rolledSkill) {
    sources.push({ id: 'faceShift', label: nameOf(actor, MLP1.faceShift, 'Face-Shift'), shiftUp: 1 });
  }

  if (shape?.morphSkill && shape.morphSkill == rolledSkill) {
    sources.push({ id: 'masterMorph', label: nameOf(actor, MLP1.masterMorph, 'Master Morph'), shiftUp: 2 });
  }

  // Mastery Power (KoC p.38): "You gain ↑1 when you cast any spell from the chosen mastery specialty."
  const mastery = itemOf(actor, MLP1.masteryPower)?.flags?.essence20?.mastery;
  if (item?.type == 'spell' && mastery && item.system?.circle == mastery.circle && item.system?.tier == mastery.tier) {
    sources.push({ id: 'masteryPower', label: nameOf(actor, MLP1.masteryPower, 'Mastery Power'), shiftUp: 1 });
  }

  // Smoke Bomb (KoC p.20): "making their targets in a 10x10 foot area suffer ↓1 to any Alertness Skill
  // Tests." Anyone rolling Alertness from inside a live cloud.
  if (rolledSkill == 'alertness' && inSmoke(actor)) {
    sources.push({ id: 'smokeBomb', label: T('E20.Mlp1SmokeBomb'), shiftDown: 1 });
  }

  // Honorary Apple's banked Edge (Free action, once per session).
  if (actor?.flags?.essence20?.honoraryAppleEdge) {
    sources.push({ id: 'honoraryApple', label: nameOf(actor, MLP1.honoraryApple, 'Honorary Apple'), edge: true });
    consumes.push({ ext: 'honoraryApple', actorUuid: actor.uuid });
  }

  return { sources, consumes };
}

function inSmoke(actor) {
  const token = actor?.getActiveTokens?.()?.[0];
  if (!token || !globalThis.canvas?.grid) {
    return false;
  }

  for (const other of worldActors()) {
    for (const cloud of other.flags?.essence20?.smokeBombs ?? []) {
      if (cloud.scene == getSceneEpoch() && cloud.sceneId == canvas.scene?.id
        && Math.abs(token.center.x - cloud.x) <= canvas.grid.size && Math.abs(token.center.y - cloud.y) <= canvas.grid.size) {
        return true;
      }
    }
  }

  return false;
}

/* -------------------------------------------- */
/*  Dialog choices                               */
/* -------------------------------------------- */

const carries = (actor, uuid) => itemsOf(actor).some(i => sourceOf(i) == uuid && (i.system?.quantity ?? 1) > 0);

function hasRangedWeapon(actor) {
  const list = itemsOf(actor);
  return list.some(w => w.type == 'weapon' && w.system?.equipped
    && list.some(e => e.type == 'weaponEffect' && e.flags?.essence20?.parentId == w.id && e.system?.classification?.style != 'melee'));
}

export function mlp1Toggles(actor, { item, rolledSkill } = {}) {
  const toggles = [];
  const add = (name, label, extra = {}) => toggles.push({ name, label, type: 'checkbox', ...extra });
  const essence = essenceOf(rolledSkill);
  const shaped = !!shapeOf(actor) || !!actor?.flags?.essence20?.dsoeDisguiseActive;

  // Face-Shift: "You gain Edge on Skill Tests to pass as that individual".
  if (shapeOf(actor) && hasSourced(actor, MLP1.faceShift)) {
    add('faceShiftPass', T('E20.Mlp1TogglePassAs'));
  }

  // Identity Crisis: "You gain an Edge on Skill Tests targeting creatures who believe you are
  // somecreature else".
  if (shaped && hasSourced(actor, MLP1.identityCrisis)) {
    add('identityCrisis', T('E20.Mlp1ToggleBelieved'));
  }

  // Prize Honey: "allowing the chef to gain ↑2 when attempting to create a memorable and tasty food".
  const honey = itemOf(actor, MLP1.prizeHoney);
  if (honey && (honey.flags?.essence20?.usesLeft ?? 3) > 0) {
    add('prizeHoney', T('E20.Mlp1ToggleHoney'));
  }

  // Honorary Apple: "You gain Edge on Social-based Skill Tests with members of the Apple family."
  if (essence == 'social' && hasSourced(actor, MLP1.honoraryApple)) {
    add('honoraryApple', T('E20.Mlp1ToggleApple'));
  }

  // Key to Whinnypeg: "↑2 on Social-based Skill Tests when dealing with Whinnypeg politicians, business
  // owners, and influencers, and ↑1 ... with non-Whinnypeg" ones.
  if (essence == 'social' && carries(actor, MLP1.keyToWhinnypeg)) {
    toggles.push({ name: 'keyToWhinnypeg', label: T('E20.Mlp1ToggleWhinnypeg'), type: 'select',
      options: [{ value: '', label: T('E20.None') }, { value: '2', label: T('E20.Mlp1WhinnypegLocal') }, { value: '1', label: T('E20.Mlp1WhinnypegOther') }] });
  }

  // The tools (KoC p.20): Hand Axe ↑1 chopping, Handsaw Edge on clean cuts, Net ↑1 catching, Snare Trap
  // ↑1 capturing once set.
  if (carries(actor, MLP1.handAxe)) {
    add('handAxe', T('E20.Mlp1ToggleHandAxe'));
  }

  if (carries(actor, MLP1.handsaw)) {
    add('handsaw', T('E20.Mlp1ToggleHandsaw'));
  }

  if (carries(actor, MLP1.net)) {
    add('net', T('E20.Mlp1ToggleNet'));
  }

  if (carries(actor, MLP1.snareTrap)) {
    add('snareTrap', T('E20.Mlp1ToggleSnare'));
  }

  // Hang-Ups.
  if (item?.type != 'spell' && rolledSkill != 'spellcasting' && hasSourced(actor, MLP1.eagerToExplode)) {
    add('eagerToExplode', T('E20.Mlp1ToggleEager'));
  }

  if (rolledSkill == 'alertness' && hasSourced(actor, MLP1.farSighted) && hasRangedWeapon(actor)) {
    add('farSighted', T('E20.Mlp1ToggleFarSighted'), { value: true });
  }

  if (rolledSkill != 'deception' && hasSourced(actor, MLP1.hardHabit)) {
    add('hardHabit', T('E20.Mlp1ToggleHardHabit'));
  }

  if (hasSourced(actor, MLP1.hiddenInPlainSight)) {
    add('hiddenInPlainSight', T('E20.Mlp1ToggleNoticed'));
  }

  if (hasSourced(actor, MLP1.miredInAcademia)) {
    add('miredInAcademia', T('E20.Mlp1ToggleTeaching'));
  }

  return toggles;
}

export async function mlp1ApplyDialog(actor, options) {
  const ext = options.ext ?? {};
  const up = n => {
    options.shiftUp = (options.shiftUp ?? 0) + n;
  };

  const down = n => {
    options.shiftDown = (options.shiftDown ?? 0) + n;
  };

  const edge = () => (options.snag ? (options.snag = false) : (options.edge = true));
  const snag = () => (options.edge ? (options.edge = false) : (options.snag = true));

  if (ext.faceShiftPass || ext.identityCrisis || ext.honoraryApple || ext.handsaw) {
    edge();
  }

  if (ext.prizeHoney) {
    up(2);
  }

  if (Number(ext.keyToWhinnypeg)) {
    up(Number(ext.keyToWhinnypeg));
  }

  if (ext.handAxe || ext.net || ext.snareTrap) {
    up(1);
  }

  // Eager to Explode: "the Skill Test suffers ↓1". Hard Habit to Break: "you suffer ↓1 to your Skill
  // Test". Far-Sighted: "Snag on any Alertness Skill Tests within 10 feet of you if you're currently using
  // a ranged weapon". Hidden in Plain Sight / Mired in Academia: a Snag.
  if (ext.eagerToExplode) {
    down(1);
  }

  if (ext.hardHabit) {
    down(1);
  }

  if (ext.farSighted || ext.hiddenInPlainSight || ext.miredInAcademia) {
    snag();
  }
}

/* -------------------------------------------- */
/*  Spell costs                                  */
/* -------------------------------------------- */

/**
 * Illusion Casting (KoC p.36): "You can cast an illusionary version of any spell you know. This spell
 * cannot actually affect anyone and does no damage ... and costs only ↓1 instead of the normal casting
 * cost." Reach Out (p.38): double a spell's range for +1 cost. Brilliant Sight: "By adding ↑1 to the
 * casting cost" it also sees through fog. Sharpcaster's second roll: "made at no cost".
 */
export async function mlp1SpellCost(item, cost, dataset = {}) {
  const actor = item?.actor ?? item?.parent;
  if (dataset?.sharpcasterFree) {
    return 0;
  }

  const illusion = hasSourced(actor, MLP1.illusionCasting);
  const reach = hasSourced(actor, MLP1.reachOut);
  const fog = sourceOf(item) == MLP1.brilliantSight;
  if (!illusion && !reach && !fog) {
    return cost;
  }

  const answer = await foundry.applications.api.DialogV2.wait({
    window: { title: item.name },
    classes: ["window-app", "e20-window"],
    content: [
      illusion ? `<label class="flexrow"><input type="checkbox" name="illusion" /> ${T('E20.Mlp1IllusionOption')}</label>` : '',
      reach ? `<label class="flexrow"><input type="checkbox" name="reach" /> ${T('E20.Mlp1ReachOption')}</label>` : '',
      fog ? `<label class="flexrow"><input type="checkbox" name="fog" /> ${T('E20.Mlp1FogOption')}</label>` : '',
    ].join(''),
    buttons: [
      { action: 'ok', label: T('E20.DialogConfirmButton'), default: true, callback: (event, button) => ({
        illusion: !!button.form.elements.illusion?.checked, reach: !!button.form.elements.reach?.checked, fog: !!button.form.elements.fog?.checked,
      }) },
      { action: 'cancel', label: T('E20.DialogCancelButton') },
    ],
    rejectClose: false,
  });
  if (!answer || answer == 'cancel') {
    return null;
  }

  const notes = [];
  let next = cost;
  if (answer.illusion) {
    next = 1;
    notes.push(T('E20.Mlp1IllusionNote'));
  }

  if (answer.reach) {
    next += 1;
    notes.push(T('E20.Mlp1ReachNote'));
  }

  if (answer.fog) {
    next += 1;
    await actor.setFlag('essence20', 'brilliantSightFog', true);
  }

  if (notes.length) {
    ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<p>${item.name}: ${notes.join(' ')}</p>` });
  }

  return next;
}

/* -------------------------------------------- */
/*  After a cast                                 */
/* -------------------------------------------- */

const PINKIE_ROWS = 8;

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
    await setShape(actor, { ...(shapeOf(actor) ?? {}), spell: true });
  }

  // Brilliant Sight (KoC p.42): "The target of this spell can see perfectly well in darkness, even
  // magical darkness." For the scene: a darkvision grant on a temporary item.
  if (source == MLP1.brilliantSight && succeeded) {
    const target = game.user?.targets?.first?.()?.actor ?? actor;
    const { temporary } = await import("../../grants.mjs");
    const { needsGmRelay } = await import("../../gm-relay.mjs");
    if (!needsGmRelay(target)) {
      await target.createEmbeddedDocuments('Item', [{
        name: T('E20.Mlp1BrilliantSightName'), type: 'gear',
        system: { equipped: true, gearType: 'other', visionGrant: { enabled: true, mode: 'darkvision', range: 120 } },
        flags: { essence20: { temporary: temporary('scene') } },
      }]);
    }
  }

  // Pinkie Sense (KoC p.50): "Roll a d8 and consult the Pinkie Sense Table."
  if (source == MLP1.pinkieSense && succeeded) {
    const roll = await new Roll(`1d${PINKIE_ROWS}`).evaluate();
    await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: `${T('E20.Mlp1PinkieSense')}: ${T(`E20.Mlp1Pinkie.${roll.total}`)}` });
  }

  // Softenblows (KoC p.51): "One target creature can deal no damage for the duration of the spell"
  // (1 round).
  if (source == MLP1.softenblows && succeeded) {
    const target = game.user?.targets?.first?.()?.actor;
    if (target) {
      const { addMark, untilEndOfNextTurn } = await import("../../target-riders.mjs");
      await addMark(target, { kind: 'softenblows', by: actor.uuid, label: T('E20.Mlp1Softenblows'), ...untilEndOfNextTurn(target) });
    }
  }

  // Sharpcaster (KoC p.38): "When you make a Spellcasting Attack Test and successfully cast the spell
  // but miss your target, you may make another Spellcasting Attack Test ... at no cost."
  const targeted = (results ?? []).filter(r => r.targetUuid);
  if (hasSourced(actor, MLP1.sharpcaster) && !checkContext?.riderContext?.sharpcasterFree && targeted.length && targeted.every(r => !r.success)) {
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<button type="button" data-e20-ext="mlp1Sharpcaster" data-actor="${actor.uuid}" data-item="${rider.itemUuid}">${T('E20.Mlp1SharpcasterButton')}</button>`,
    });
  }
}

/** Softenblows: the enchanted creature's hits deal nothing. */
export async function mlp1HitRider(actor, target, result, rider, tools) {
  const marks = actor?.flags?.essence20?.riderMarks ?? [];
  if (result?.damageValue && marks.some(m => m.kind == 'softenblows')) {
    tools.damageBonusNote(result, -result.damageValue, T('E20.Mlp1Softenblows'));
  }
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
  {
    // Prize Honey: "when consumed, heals up to 3 points of Health ... enough honey for three uses".
    id: 'mlp1Honey', matches: item => sourceOf(item) == MLP1.prizeHoney,
    canUse: item => (item.flags?.essence20?.usesLeft ?? 3) > 0,
    async run(item) {
      const target = game.user?.targets?.first?.()?.actor ?? item.parent;
      const health = target.system?.health;
      if (health) {
        await target.update({ 'system.health.value': Math.min(health.max ?? health.value + 3, (health.value ?? 0) + 3) });
      }

      await item.setFlag('essence20', 'usesLeft', (item.flags?.essence20?.usesLeft ?? 3) - 1);
      return T('E20.Mlp1HoneyHeals', { name: target.name });
    },
  },
  {
    // Honorary Apple: "as a Free action, you can gain Edge on a Skill Test related to agriculture per
    // session." Once per mission here.
    id: 'mlp1Apple', matches: item => sourceOf(item) == MLP1.honoraryApple,
    canUse: item => getUses(item.parent, 'honoraryApple', 'mission') < 1,
    async run(item, economy, pay) {
      if (!(await pay('free'))) {
        return null;
      }

      await markUsed(item.parent, 'honoraryApple', { window: 'mission' });
      await item.parent.setFlag('essence20', 'honoraryAppleEdge', true);
      return T('E20.Mlp1AppleEdge', { name: item.parent.name });
    },
  },
  {
    // Mastery Power: "Choose one of your Mastery specialties (such as 'Elementary Beam spells')."
    id: 'mlp1Mastery', matches: item => sourceOf(item) == MLP1.masteryPower,
    async run(item) {
      const circles = Object.entries(CONFIG.E20.spellCircles ?? {}).map(([k, v]) => `<option value="${k}">${T(v)}</option>`).join('');
      const tiers = Object.entries(CONFIG.E20.spellTiers ?? {}).map(([k, v]) => `<option value="${k}">${T(v)}</option>`).join('');
      const answer = await foundry.applications.api.DialogV2.wait({
        window: { title: item.name },
        classes: ["window-app", "e20-window"],
        content: `<div class="form-group"><label>${T('E20.Mlp1Tier')}</label><select name="tier">${tiers}</select></div>
          <div class="form-group"><label>${T('E20.Mlp1Circle')}</label><select name="circle">${circles}</select></div>`,
        buttons: [
          { action: 'ok', label: T('E20.DialogConfirmButton'), default: true, callback: (event, button) => ({ tier: button.form.elements.tier.value, circle: button.form.elements.circle.value }) },
          { action: 'cancel', label: T('E20.DialogCancelButton') },
        ],
        rejectClose: false,
      });
      if (!answer || answer == 'cancel') {
        return null;
      }

      await item.setFlag('essence20', 'mastery', answer);
      return T('E20.Mlp1MasterySet', { name: item.parent.name });
    },
  },
  {
    // Smoke Bomb: a 10x10 cloud where it's thrown, for the scene.
    id: 'mlp1Smoke', matches: item => sourceOf(item) == MLP1.smokeBomb,
    async run(item, economy, pay) {
      const { pickCanvasPoint } = await import("../../forced-movement.mjs");
      const point = await pickCanvasPoint(T('E20.Mlp1SmokeWhere'));
      if (!point || !(await pay('standard'))) {
        return null;
      }

      const actor = item.parent;
      const clouds = (actor.flags?.essence20?.smokeBombs ?? []).filter(c => c.scene == getSceneEpoch());
      await actor.setFlag('essence20', 'smokeBombs', [...clouds, { x: point.x, y: point.y, scene: getSceneEpoch(), sceneId: canvas.scene?.id }]);
      const left = (item.system?.quantity ?? 1) - 1;
      await (left > 0 ? item.update({ 'system.quantity': left }) : item.delete());
      return T('E20.Mlp1SmokeThrown', { name: actor.name });
    },
  },
  {
    // Sorcerous Support (KoC p.17): "Once per game session, you can allow an ally to re-roll a Fumble."
    // Readies it for the targeted ally's next Fumble card; once per mission here.
    id: 'mlp1Sorcerous', matches: item => sourceOf(item) == MLP1.sorcerousSupport,
    canUse: item => getUses(item.parent, 'sorcerousSupport', 'mission') < 1,
    async run(item) {
      await activateForWindow(item.parent, 'sorcerousSupportReady', 'mission');
      return T('E20.Mlp1SorcerousReady', { name: item.parent.name });
    },
  },
];

/* -------------------------------------------- */
/*  Chat                                         */
/* -------------------------------------------- */

async function sharpcasterAgain(message, button) {
  const actor = await fromUuid(button.dataset.actor);
  const item = await fromUuid(button.dataset.item);
  if (!actor?.isOwner || !item) {
    return;
  }

  button.disabled = true;
  await item.roll({ rollType: 'spell', sharpcasterFree: true });
}

/**
 * Sorcerous Support: a "re-roll this Fumble" button on an ally's fumbled card while it's ready.
 */
function decorateFumble(message, element) {
  if (!message?.rolls?.length || element.querySelector('[data-e20-ext="mlp1Sorcerous"]')) {
    return;
  }

  const d20 = message.rolls[0].dice?.find(d => d.faces == 20)?.total;
  if (d20 != 1) {
    return;
  }

  const helper = (worldActors()).find(a => a.isOwner && hasSourced(a, MLP1.sorcerousSupport)
    && isActiveForWindow(a, 'sorcerousSupportReady', 'mission') && getUses(a, 'sorcerousSupport', 'mission') < 1);
  if (!helper) {
    return;
  }

  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.e20Ext = 'mlp1Sorcerous';
  button.dataset.helper = helper.uuid;
  button.textContent = T('E20.Mlp1SorcerousButton', { name: helper.name });
  element.querySelector('.message-content')?.appendChild(button);
}

async function sorcerousReroll(message, button) {
  const helper = await fromUuid(button.dataset.helper);
  if (!helper || getUses(helper, 'sorcerousSupport', 'mission') >= 1) {
    return;
  }

  await markUsed(helper, 'sorcerousSupport', { window: 'mission' });
  const rerolled = await new Roll(message.rolls[0].formula).evaluate();
  await rerolled.toMessage({ speaker: message.speaker, flavor: T('E20.Mlp1SorcerousRerolled', { name: helper.name }) });
}

/* -------------------------------------------- */
/*  Registration                                 */
/* -------------------------------------------- */

registerRollSources(mlp1RollSources);
registerDialogToggles(mlp1Toggles);
registerApplyDialog(mlp1ApplyDialog);
registerSpellCost(mlp1SpellCost);
registerPostRoll(mlp1PostRoll);
registerHitRider(mlp1HitRider);
registerChatButton('mlp1Sharpcaster', sharpcasterAgain);
registerChatButton('mlp1Sorcerous', sorcerousReroll);
registerConsumer('honoraryApple', async consume => {
  const actor = await fromUuid(consume.actorUuid);
  if (actor?.flags?.essence20?.honoraryAppleEdge) {
    await actor.unsetFlag('essence20', 'honoraryAppleEdge');
  }
});
USES.forEach(registerUse);

registerChatDecorator(decorateFumble);

// Pointy (DSoE p.21): "Manifesting the natural weapon ... lasts until the end of the combat scene."
globalThis.Hooks?.on?.('deleteCombat', () => {
  for (const actor of worldActors()) {
    if (actor.isOwner && actor.flags?.essence20?.pointyActive && globalThis.game.user?.isGM) {
      actor.unsetFlag('essence20', 'pointyActive');
    }
  }
});
