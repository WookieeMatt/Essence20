import {
  registerChatButton, registerPostRoll, registerTurnStart, registerUse,
} from "../../mechanics/item-hooks.mjs";
import {
  FMMC, KOC, T, findSourced, isFrom, num, post, rollDif, targetedActors,
} from "../shared/gm-relayed-item-writes.mjs";

/**
 * Magic: Knights of Canterlot's Temper Tempest, and Finster's build-your-own Sorcerous Power (Table 4-1).
 */
export const O2_MAGIC = {
  sorcery: FMMC('xUBOE1s5pgVyUrwj'),
  temperTempest: KOC('qwUMlRGUBOSoZJEI'),
  fireball: KOC('zlERIywyKQNBQzs6'),
};

export const TEMPEST_FLAG = 'o2TemperTempest';

// Thorn Warlord's Acid against Evasion is an outgoing Defense rule on the Perk (rules/conv10-slC10.test.js).

// More Bang for your Buck (Knights of Canterlot, Elemental Mage Influence Perk, p.36): its +1 on a successful elemental
// spell is a cast HitRider rule on the Perk (rules/plugins/combat/hit-rider.mjs); the storm's strikes below count as Temper
// Tempest's cast hits (rules/plugins/combat/cast-hit-damage.mjs#castHitDamage), so the same rule adds its +1 there.

/* -------------------------------------------- */
/*  Temper Tempest                               */
/* -------------------------------------------- */

/**
 * Temper Tempest (Knights of Canterlot, Beam spell, p.51-52): "each round, you must select 3
 * targets, who are then each struck by lightning for 3 Energy damage. Every round you have this
 * spell active, it causes the caster 1 Stress ... If the caster is rendered unconscious
 * (defeated), the storm dissipates on its own ... When you want to end the spell must succeed at a
 * DIF 20 Alertness (Insight) Skill Test". A successful cast raises the storm; each of the caster's
 * turns posts the round's card.
 */
export function tempestActive(actor) {
  return !!actor?.flags?.essence20?.[TEMPEST_FLAG];
}

function tempestCard(actor) {
  const uuid = actor.uuid;
  return `${T('O2TempestRound', { name: actor.name })}
    <button type="button" data-e20-ext="o2TempestStrike" data-actor-uuid="${uuid}">${T('O2TempestStrike')}</button>
    <button type="button" data-e20-ext="o2TempestStress" data-actor-uuid="${uuid}">${T('O2TempestStress')}</button>
    <button type="button" data-e20-ext="o2TempestCalm" data-actor-uuid="${uuid}">${T('O2TempestCalm')}</button>`;
}

registerPostRoll(async (actor, results, checkContext, { rider } = {}) => {
  if (rider?.itemSource != O2_MAGIC.temperTempest || !(results ?? []).some(r => r.success) || tempestActive(actor)) {
    return;
  }

  await actor.setFlag('essence20', TEMPEST_FLAG, { started: true });
  await post(actor, tempestCard(actor));
});

registerTurnStart(async (actor) => {
  if (!tempestActive(actor)) {
    return;
  }

  if (actor.statuses?.has?.('defeated') || actor.statuses?.has?.('unconscious')) {
    await actor.unsetFlag('essence20', TEMPEST_FLAG);
    await post(actor, T('O2TempestEnds', { name: actor.name }));
    return;
  }

  await post(actor, tempestCard(actor));
});

/** Lightning on up to three of the caster's targets: 3, then whatever the caster's cast HitRider rules add for the spell. */
export async function tempestDamage(caster) {
  const { castHitDamage } = await import("../../rules/plugins/combat/cast-hit-damage.mjs");
  return castHitDamage(caster, findSourced(caster, O2_MAGIC.temperTempest), 3, 'element');
}

registerChatButton('o2TempestStrike', async (message, button) => {
  const caster = await fromUuid(button.dataset.actorUuid);
  if (!caster?.isOwner || !tempestActive(caster)) {
    return;
  }

  const targets = targetedActors().slice(0, 3);
  if (!targets.length) {
    ui.notifications?.warn?.(T('O2NeedTarget'));
    return;
  }

  const { applyDamage } = await import("../../mechanics/combat/combat.mjs");
  const amount = await tempestDamage(caster);
  for (const target of targets) {
    await applyDamage(target, amount, 'element');
  }

  button.disabled = true;
  await post(caster, T('O2TempestStruck', { name: caster.name, targets: targets.map(t => t.name).join(', '), amount }));
});

registerChatButton('o2TempestStress', async (message, button) => {
  const caster = await fromUuid(button.dataset.actorUuid);
  if (!caster || !tempestActive(caster)) {
    return;
  }

  const { applyDamage } = await import("../../mechanics/combat/combat.mjs");
  await applyDamage(caster, 1, 'special');
  button.disabled = true;
});

registerChatButton('o2TempestCalm', async (message, button) => {
  const caster = await fromUuid(button.dataset.actorUuid);
  if (!caster?.isOwner || !tempestActive(caster)) {
    return;
  }

  if ((await rollDif(caster, 'alertness', 20)).success) {
    await caster.unsetFlag('essence20', TEMPEST_FLAG);
    await post(caster, T('O2TempestEnds', { name: caster.name }));
  }
});

/* -------------------------------------------- */
/*  Build a Sorcerous Power                      */
/* -------------------------------------------- */

/**
 * Finster's Monster-Matic Cookbook, Table 4-1: Sorcerous Power Effect Costs (p.273). The point cost
 * of a Power built from the table's rows; the Power is then created on the Sorcery holder with that
 * cost, which documents/actor.mjs#_prepareSorcerousPower counts against the build budget.
 * @param {Object} b   The builder's choices.
 * @returns {Number}
 */
export function sorceryCost(b) {
  let cost = { targeting: 1, area: 2, mimic: 2, traitAttack: 1, traitArmor: 1 }[b.base] ?? 0;
  if (b.damageType == 'void') {
    cost += 2;
  } else if (b.damageType && b.damageType != 'element') {
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
  return Math.max(0, cost);
}

/** The Power Item the choices make. */
export function sorceryPowerData(b) {
  const attack = ['targeting', 'area'].includes(b.base);
  const changedType = b.damageType && b.damageType != 'element';
  const damage = attack ? 1 + num(b.extraDamage) + (changedType && b.damageType != 'void' ? 1 : 0) : 0;
  const range = 30 + (10 * num(b.rangeSteps));
  const shape = b.base == 'area' ? 'emanation' : (b.shape == 'blast' ? 'circle' : (b.shape == 'cone' ? 'cone' : null));
  const radius = b.base == 'area' ? 20 + (b.shape == 'none' ? 10 * num(b.rangeSteps) : 0)
    : b.shape == 'blast' ? 5 : b.shape == 'cone' ? 20 : 0;
  const skill = b.ritual && b.ritual != 'none' ? 'performance' : ({ targeting: 'targeting', area: 'culture' }[b.base] ?? 'culture');
  const summary = [
    T(`O2SorceryBase.${b.base}`),
    attack ? T('O2SorcerySummaryAttack', { damage, type: game.i18n.localize(CONFIG.E20?.damageTypes?.[b.damageType || 'element'] ?? ''), range }) : '',
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
      damageType: attack ? (b.damageType || 'element') : null,
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
  const types = Object.entries(CONFIG.E20?.damageTypes ?? {}).map(([k, v]) => `<option value="${k}"${k == 'element' ? ' selected' : ''}>${game.i18n.localize(v)}</option>`).join('');
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

registerUse({
  id: 'o2SorceryBuilder',
  matches: isFrom(O2_MAGIC.sorcery),
  async run(item) {
    const actor = item.parent;
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
  },
});
