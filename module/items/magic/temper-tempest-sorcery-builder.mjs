import { T } from "../shared/item-lang.mjs";
import { num } from "../shared/numbers.mjs";

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
 * Finster's Monster-Matic Cookbook, Table 4-1: Sorcerous Power Effect Costs (p.273). The point cost
 * of a Power built from the table's rows; the Power is then created on the Sorcery holder with that
 * cost, which documents/actor.mjs#_prepareSorcerousPower counts against the build budget. The basic
 * attacks deal Energy damage; any other type is a change (+1, and +1 damage; Void +2). No Power's cost
 * drops below 1 (p.272).
 * @param {Object} b   The builder's choices.
 * @returns {Number}
 */
export function sorceryCost(b) {
  let cost = { targeting: 1, area: 2, mimic: 2, traitAttack: 1, traitArmor: 1 }[b.base] ?? 0;
  if (b.damageType == 'void') {
    cost += 2;
  } else if (b.damageType && b.damageType != 'energy') {
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
  const attack = ['targeting', 'area'].includes(b.base);
  const changedType = b.damageType && b.damageType != 'energy';
  const damage = attack ? 1 + num(b.extraDamage) + (changedType && b.damageType != 'void' ? 1 : 0) : 0;
  const range = 30 + (10 * num(b.rangeSteps));
  const shape = b.base == 'area' ? 'emanation' : (b.shape == 'blast' ? 'circle' : (b.shape == 'cone' ? 'cone' : null));
  const radius = b.base == 'area' ? 20 + (b.shape == 'none' ? 10 * num(b.rangeSteps) : 0)
    : b.shape == 'blast' ? 5 : b.shape == 'cone' ? 20 : 0;
  const skill = b.ritual && b.ritual != 'none' ? 'performance' : ({ targeting: 'targeting', area: 'culture' }[b.base] ?? 'culture');
  const summary = [
    T(`O2SorceryBase.${b.base}`),
    attack ? T('O2SorcerySummaryAttack', { damage, type: game.i18n.localize(CONFIG.E20?.damageTypes?.[b.damageType || 'energy'] ?? ''), range }) : '',
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
      canActivate: true,
      actionType: b.ritual && b.ritual != 'none' ? 'free' : 'standard',
      attackSkill: attack || b.base == 'mimic' ? skill : null,
      damageType: attack ? (b.damageType || 'energy') : null,
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

function sorceryForm() {
  const types = Object.entries(CONFIG.E20?.damageTypes ?? {}).map(([k, v]) => `<option value="${k}"${k == 'energy' ? ' selected' : ''}>${game.i18n.localize(v)}</option>`).join('');
  const option = (name, keys) => `<select name="${name}">${keys.map(k => `<option value="${k}">${T(`O2SorceryOpt.${name}.${k}`)}</option>`).join('')}</select>`;
  const numberField = name => `<div class="form-group"><label>${T(`O2SorceryLabel.${name}`)}</label><input type="number" name="${name}" min="0" value="0"/></div>`;
  const check = name => `<div class="form-group"><label>${T(`O2SorceryLabel.${name}`)}</label><input type="checkbox" name="${name}"/></div>`;
  return `
    <div class="form-group"><label>${T('O2SorceryLabel.name')}</label><input type="text" name="name"/></div>
    <div class="form-group"><label>${T('O2SorceryLabel.base')}</label>${option('base', ['targeting', 'area', 'mimic', 'traitAttack', 'traitArmor'])}</div>
    <div class="form-group"><label>${T('O2SorceryLabel.damageType')}</label><select name="damageType">${types}</select></div>
    <div class="form-group"><label>${T('O2SorceryLabel.shape')}</label>${option('shape', ['none', 'blast', 'cone'])}</div>
    ${numberField('rangeSteps')}${numberField('extraDamage')}${numberField('extraTraits')}${numberField('multiple')}
    ${check('accurate')}${check('alternate')}${check('unique')}
    <div class="form-group"><label>${T('O2SorceryLabel.ritual')}</label>${option('ritual', ['none', 'tenMinutes', 'hour'])}</div>
    ${check('focus')}${check('nullified')}${check('resource')}`;
}

function readForm(form) {
  const e = form.elements;
  return {
    name: e.name.value.trim(), base: e.base.value, damageType: e.damageType.value, shape: e.shape.value,
    rangeSteps: num(e.rangeSteps.value), extraDamage: num(e.extraDamage.value), extraTraits: num(e.extraTraits.value),
    multiple: num(e.multiple.value), accurate: e.accurate.checked, alternate: e.alternate.checked, unique: e.unique.checked,
    ritual: e.ritual.value, focus: e.focus.checked, nullified: e.nullified.checked, resource: e.resource.checked,
  };
}

/**
 * The builder dialog; the Power it describes is created on the actor (a warning when it goes over the Sorcerous budget).
 * @returns {Promise<String|null>}   The chat line, or null when cancelled.
 */
export async function buildSorcerousPower(actor) {
  const build = await foundry.applications.api.DialogV2.wait({
    window: { title: T('O2SorceryTitle') },
    classes: ["window-app", "e20-window"],
    content: sorceryForm(),
    buttons: [
      { action: 'ok', label: T('O2SorceryCreate'), default: true, callback: (event, button) => readForm(button.form) },
      { action: 'cancel', label: game.i18n.localize('E20.DialogCancelButton') },
    ],
    rejectClose: false,
  });
  if (!build || build == 'cancel') {
    return null;
  }

  const data = sorceryPowerData(build);
  const sorcerous = actor.system?.powers?.sorcerous ?? {};
  if (num(sorcerous.committed) + data.system.powerCost > num(sorcerous.max)) {
    ui.notifications?.warn?.(T('O2SorceryOverBudget', { cost: data.system.powerCost, left: num(sorcerous.max) - num(sorcerous.committed) }));
  }

  await actor.createEmbeddedDocuments('Item', [data]);
  return T('O2SorceryBuilt', { name: actor.name, power: data.name, cost: data.system.powerCost });
}
