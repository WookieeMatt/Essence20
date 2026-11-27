import { T } from "../shared/item-lang.mjs";
import { num } from "../shared/numbers.mjs";
import { addSorcerousTrait, requiringPowerData, sorcerousFoci } from "./sorcerous-focus.mjs";

/**
 * Magic: Finster's build-your-own Sorcerous Power (Table 4-1) - the builder dialog and the Power it makes. The Sorcery
 * Perk's Use rule runs it (the buildSorcerousPower step, rules/plugins/picks/sorcery-builder-step.mjs). (Knights of
 * Canterlot's Temper Tempest is the spell's own rules.)
 */

// Thorn Warlord's Acid against Evasion is an outgoing Defense rule on the Perk (rules/conv10-slC10.test.js).

// Temper Tempest (Knights of Canterlot, p.51-52) is the spell's own rules: the storm a mark, its round card a CardButtons card, the
// lightning a damage step counted as the spell's cast hit (More Bang for your Buck's +1) - rules/conv15-items2.test.js.

/* -------------------------------------------- */
/*  Build a Sorcerous Power                      */
/* -------------------------------------------- */

/**
 * The basic attacks' Energy damage. This system has no 'energy' damage type: the book's Energy damage is stored as
 * 'element' (Arcane Bolt and every other Energy attack in the packs).
 */
export const BASE_DAMAGE_TYPE = 'element';

/**
 * Finster's Monster-Matic Cookbook, Table 4-1: Sorcerous Power Effect Costs (p.273). The point cost
 * of a Power built from the table's rows; the Power is then created on the Sorcery holder with that
 * cost, which documents/actor.mjs#_prepareSorcerousPower counts against the build budget. The basic
 * attacks deal Energy damage; any other type is a change (+1, and +1 damage; Void +2). No Power's cost
 * drops below 1 (p.272).
 * @param {Object} b   The builder's choices.
 * @returns {Number}
 */
export function sorceryCost(b) {
  // melee: a magical focus's basic melee attack (Building an Enchanted Item or Focus, p.274) - the basic attack's cost.
  let cost = { targeting: 1, melee: 1, area: 2, mimic: 2, traitAttack: 1, traitArmor: 1 }[b.base] ?? 0;
  if (b.damageType == 'void') {
    cost += 2;
  } else if (b.damageType && b.damageType != BASE_DAMAGE_TYPE) {
    cost += 1;
  }

  if (b.shape && b.shape != 'none') {
    cost += 1;
  }

  cost += num(b.rangeSteps) + num(b.extraDamage) + num(b.extraTraits) + num(b.multiple);
  cost += b.accurate ? 1 : 0;
  cost += b.alternate ? 2 : 0;
  cost += b.unique ? 2 : 0;
  cost -= { none: 0, tenMinutes: 1, hour: 2 }[b.ritual] ?? 0;
  cost -= b.focus ? 1 : 0;
  cost -= b.nullified ? 1 : 0;
  cost -= b.resource ? 2 : 0;
  return Math.max(1, cost);
}

/** The Power Item the choices make. */
export function sorceryPowerData(b) {
  const attack = ['targeting', 'area', 'melee'].includes(b.base);
  const changedType = b.damageType && b.damageType != BASE_DAMAGE_TYPE;
  const damage = attack ? 1 + num(b.extraDamage) + (changedType && b.damageType != 'void' ? 1 : 0) : 0;
  const range = 30 + (10 * num(b.rangeSteps));
  const shape = b.base == 'area' ? 'emanation' : (b.shape == 'blast' ? 'circle' : (b.shape == 'cone' ? 'cone' : null));
  const radius = b.base == 'area' ? 20 + (b.shape == 'none' ? 10 * num(b.rangeSteps) : 0)
    : b.shape == 'blast' ? 5 : b.shape == 'cone' ? 20 : 0;
  const skill = b.ritual && b.ritual != 'none' ? 'performance' : ({ targeting: 'targeting', area: 'culture', melee: 'might' }[b.base] ?? 'culture');
  const summary = [
    T(`O2SorceryBase.${b.base}`),
    attack ? T('O2SorcerySummaryAttack', { damage, type: game.i18n.localize(CONFIG.E20?.damageTypes?.[b.damageType || BASE_DAMAGE_TYPE] ?? ''), range }) : '',
    b.accurate ? T('O2SorceryAccurate') : '',
    num(b.multiple) ? T('O2SorceryMultiple', { n: b.multiple }) : '',
  ].filter(Boolean).join('; ');

  return {
    name: b.name || T('O2SorceryDefaultName'),
    type: 'power',
    img: 'systems/essence20/assets/icons/items/powers.svg',
    system: {
      type: 'sorcerous',
      powerCost: sorceryCost(b),
      // A trait build only marks an attack or armor (the trait goes on the item itself) - nothing to activate.
      canActivate: !['traitAttack', 'traitArmor'].includes(b.base),
      actionType: b.ritual && b.ritual != 'none' ? 'free' : 'standard',
      attackSkill: attack || b.base == 'mimic' ? skill : null,
      damageType: attack ? (b.damageType || BASE_DAMAGE_TYPE) : null,
      damageValue: damage,
      defenseType: attack ? 'toughness' : null,
      numTargets: 1 + num(b.multiple),
      shape,
      radius,
      usesInterval: 'perTurn',
      usesPer: 1,
      description: `<p>${summary}</p>`,
    },
    flags: { essence20: { o2SorceryBuild: b } },
  };
}

/** The weapons (traitAttack) or armor (traitArmor) a trait build can put the Sorcerous trait on. */
export function traitTargets(actor, base) {
  const type = { traitAttack: 'weapon', traitArmor: 'armor' }[base];
  const items = actor?.items?.contents ?? (actor?.items ? [...actor.items] : []);
  return type ? items.filter(item => item.type == type) : [];
}

function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

/**
 * The builder's form. focusable: offer "Needs a focus" (picking one of the actor's magical foci) and the trait builds -
 * off for the Power a focus grants, which already works only through that focus.
 */
function sorceryForm(actor, { focusable = true } = {}) {
  const types = Object.entries(CONFIG.E20?.damageTypes ?? {}).map(([k, v]) => `<option value="${k}"${k == BASE_DAMAGE_TYPE ? ' selected' : ''}>${game.i18n.localize(v)}</option>`).join('');
  const option = (name, keys) => `<select name="${name}">${keys.map(k => `<option value="${k}">${T(`O2SorceryOpt.${name}.${k}`)}</option>`).join('')}</select>`;
  const numberField = name => `<div class="form-group"><label>${T(`O2SorceryLabel.${name}`)}</label><input type="number" name="${name}" min="0" value="0"/></div>`;
  const check = name => `<div class="form-group"><label>${T(`O2SorceryLabel.${name}`)}</label><input type="checkbox" name="${name}"/></div>`;
  const bases = focusable ? ['targeting', 'area', 'mimic', 'traitAttack', 'traitArmor'] : ['targeting', 'area', 'mimic'];
  const traitItems = [...traitTargets(actor, 'traitAttack'), ...traitTargets(actor, 'traitArmor')]
    .map(item => `<option value="${item.id}">${escapeHtml(item.name)} (${game.i18n.localize(`TYPES.Item.${item.type}`)})</option>`).join('');
  const foci = sorcerousFoci(actor).map(focus => `<option value="${focus.id}">${escapeHtml(focus.name)}</option>`).join('');
  const traitRow = focusable ? `<div class="form-group"><label>${T('O2SorceryLabel.traitItem')}</label><select name="traitItem"><option value=""></option>${traitItems}</select></div>` : '';
  const focusRow = focusable ? `<div class="form-group"><label>${T('O2SorceryLabel.focus')}</label><select name="focusId"><option value="">${T('O2SorceryNoFocus')}</option>${foci}</select></div>` : '';
  return `
    <div class="form-group"><label>${T('O2SorceryLabel.name')}</label><input type="text" name="name"/></div>
    <div class="form-group"><label>${T('O2SorceryLabel.base')}</label>${option('base', bases)}</div>
    ${traitRow}
    <div class="form-group"><label>${T('O2SorceryLabel.damageType')}</label><select name="damageType">${types}</select></div>
    <div class="form-group"><label>${T('O2SorceryLabel.shape')}</label>${option('shape', ['none', 'blast', 'cone'])}</div>
    ${numberField('rangeSteps')}${numberField('extraDamage')}${numberField('extraTraits')}${numberField('multiple')}
    ${check('accurate')}${check('alternate')}${check('unique')}
    <div class="form-group"><label>${T('O2SorceryLabel.ritual')}</label>${option('ritual', ['none', 'tenMinutes', 'hour'])}</div>
    ${focusRow}${check('nullified')}${check('resource')}`;
}

function readForm(form) {
  const e = form.elements;
  const focusId = e.focusId?.value || null;
  return {
    name: e.name.value.trim(), base: e.base.value, damageType: e.damageType.value, shape: e.shape.value,
    rangeSteps: num(e.rangeSteps.value), extraDamage: num(e.extraDamage.value), extraTraits: num(e.extraTraits.value),
    multiple: num(e.multiple.value), accurate: e.accurate.checked, alternate: e.alternate.checked, unique: e.unique.checked,
    ritual: e.ritual.value, focus: !!focusId, focusId, traitItem: e.traitItem?.value || null,
    nullified: e.nullified.checked, resource: e.resource.checked,
  };
}

/**
 * Why a build can't be made, or null: a trait build names the weapon / armor it marks; the Power a focus grants costs
 * no more than maxCost.
 */
export function buildProblem(build, actor, { maxCost = null } = {}) {
  if (['traitAttack', 'traitArmor'].includes(build.base) && !traitTargets(actor, build.base).some(item => item.id == build.traitItem)) {
    return T(build.base == 'traitAttack' ? 'O2SorceryNeedWeapon' : 'O2SorceryNeedArmor');
  }

  if (maxCost !== null && sorceryCost(build) > maxCost) {
    return T('O2SorceryOverFocusCap', { cost: sorceryCost(build), max: maxCost });
  }

  return null;
}

/**
 * Ask for a Sorcerous Power and answer its Item data (nothing is created yet). A build that can't be made warns and
 * asks again.
 * @param {Actor} actor
 * @param {{maxCost?: Number|null, focusable?: Boolean, title?: String|null}} options
 * @returns {Promise<Object|null>}   Power Item data, or null when cancelled.
 */
export async function askSorcerousPower(actor, { maxCost = null, focusable = true, title = null } = {}) {
  for (;;) {
    const build = await foundry.applications.api.DialogV2.wait({
      window: { title: title ?? T('O2SorceryTitle') },
      classes: ["window-app", "e20-window"],
      content: sorceryForm(actor, { focusable }),
      buttons: [
        { action: 'ok', label: T('O2SorceryCreate'), default: true, callback: (event, button) => readForm(button.form) },
        { action: 'cancel', label: game.i18n.localize('E20.DialogCancelButton') },
      ],
      rejectClose: false,
    });
    if (!build || build == 'cancel') {
      return null;
    }

    const problem = buildProblem(build, actor, { maxCost });
    if (problem) {
      ui.notifications?.warn?.(problem);
      continue;
    }

    const data = sorceryPowerData(build);
    // Whether the focus's -1 actually came off (a Power already at the floor of 1 gets nothing).
    const discounted = sorceryCost({ ...build, focus: false }) > sorceryCost(build);
    return build.focusId ? requiringPowerData(data, build.focusId, { discounted }) : data;
  }
}

/**
 * The builder dialog; the Power it describes is created on the actor (a warning when it goes over the Sorcerous budget).
 * A trait build also puts the Sorcerous trait on the weapon or armor it names (Table 4-1: "permanently add").
 * @returns {Promise<String|null>}   The chat line, or null when cancelled.
 */
export async function buildSorcerousPower(actor) {
  const data = await askSorcerousPower(actor);
  if (!data) {
    return null;
  }

  const sorcerous = actor.system?.powers?.sorcerous ?? {};
  if (num(sorcerous.committed) + data.system.powerCost > num(sorcerous.max)) {
    ui.notifications?.warn?.(T('O2SorceryOverBudget', { cost: data.system.powerCost, left: num(sorcerous.max) - num(sorcerous.committed) }));
  }

  const marked = data.flags?.essence20?.o2SorceryBuild?.traitItem;
  if (marked) {
    await addSorcerousTrait(actor.items?.get?.(marked));
  }

  await actor.createEmbeddedDocuments('Item', [data]);
  return T('O2SorceryBuilt', { name: actor.name, power: data.name, cost: data.system.powerCost });
}
