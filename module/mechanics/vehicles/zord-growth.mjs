/**
 * Gaining Zord Health and Skills (PR CRB p.134; A Jump Through Time p.82-83): a Zord linked to a Power Ranger gains one
 * benefit, the Ranger's choice, at the Ranger's 5th, 10th, 15th and 20th level.
 *
 * Each choice becomes a feature item on the Zord ("Zord Growth (10th Level): +1 Health") carrying what it does - an
 * Active Effect for a flat number, a rule for the rest - so it shows on the sheet, can be removed, and needs no special
 * code to apply. The flag zordGrowth.level marks which level it answers. The choice is offered when the Ranger reaches
 * the level (role-handler.mjs#onLevelChange) and from the Ranger's Zords tab while any is missing.
 */

export const GROWTH_LEVELS = [5, 10, 15, 20];
export const GROWTH_FLAG = 'zordGrowth';
const MOVEMENT_TYPES = ['ground', 'aerial', 'climb', 'swim', 'burrow'];

const T = (key, data) => (data ? game.i18n.format(`E20.${key}`, data) : game.i18n.localize(`E20.${key}`));

/** The options (CRB p.134, plus A Jump Through Time p.83's): id -> {label, book, page}. */
export const GROWTH_OPTIONS = {
  health: { label: 'ZordGrowthHealth', book: 'Power Rangers Core Rulebook', page: 134 },
  plating: { label: 'ZordGrowthPlating', book: 'Power Rangers Core Rulebook', page: 134 },
  movement: { label: 'ZordGrowthMovement', book: 'Power Rangers Core Rulebook', page: 134 },
  driving: { label: 'ZordGrowthDriving', book: 'Power Rangers Core Rulebook', page: 134 },
  initiative: { label: 'ZordGrowthInitiative', book: 'Power Rangers Core Rulebook', page: 134 },
  damage: { label: 'ZordGrowthDamage', book: 'Power Rangers Core Rulebook', page: 134 },
  accurate: { label: 'ZordGrowthAccurate', book: 'A Jump Through Time', page: 83 },
  exchange: { label: 'ZordGrowthExchange', book: 'A Jump Through Time', page: 83 },
};

/** The Zords linked to a Ranger (dropped on its sheet - its Zords tab). */
export function linkedZords(ranger) {
  return Object.values(ranger?.system?.actors ?? {})
    .filter(entry => entry?.type == 'zord')
    .map(entry => globalThis.fromUuidSync?.(entry.uuid))
    .filter(Boolean);
}

/** The levels a Zord already has its growth for. */
export function grownLevels(zord) {
  const items = zord?.items?.contents ?? [...(zord?.items ?? [])];
  return new Set(items.map(item => Number(item.flags?.essence20?.[GROWTH_FLAG]?.level)).filter(Boolean));
}

/** The growth levels the Ranger has reached that the Zord has no choice for yet. */
export function missingGrowthLevels(ranger, zord) {
  const level = Number(ranger?.system?.level) || 0;
  const grown = grownLevels(zord);
  return GROWTH_LEVELS.filter(at => at <= level && !grown.has(at));
}

const effectData = (name, changes) => [{
  name, img: 'icons/svg/upgrade.svg', transfer: true, disabled: false, type: 'base',
  changes: changes.map(([key, value]) => ({ key, mode: 2, value: String(value), priority: null })),
}];

/** A Zord's own attacks: [{effect, weapon, label}]. */
function zordAttacks(zord) {
  const items = zord?.items?.contents ?? [];
  return items.filter(item => item.type == 'weaponEffect').map(effect => {
    const weapon = items.find(item => item.id == effect.flags?.essence20?.parentId) ?? null;
    return { effect, weapon, label: weapon ? `${weapon.name} - ${effect.name}` : effect.name };
  });
}

/**
 * The item a choice makes, or null when a follow-up pick was cancelled. Exported for tests.
 * @param {Actor} zord
 * @param {Number} level
 * @param {String} option
 * @param {Object} [extra]   {movement, effectId, weaponId, featureId} - the follow-up pick
 */
export function growthItemData(zord, level, option, extra = {}) {
  const spec = GROWTH_OPTIONS[option];
  if (!spec) {
    return null;
  }

  let detail = T(spec.label);
  const system = { source: { book: spec.book, page: spec.page }, rules: [], automation: { status: 'full', notes: '' } };
  let effects = [];
  const label = `Zord Growth (${level})`;
  switch (option) {
  case 'health':
    effects = effectData(label, [['system.health.bonus', 1]]);
    break;
  case 'plating':
    effects = effectData(label, [['system.defenses.toughness.armor', 1]]);
    break;
  case 'movement':
    if (!MOVEMENT_TYPES.includes(extra.movement)) {
      return null;
    }

    detail = T('ZordGrowthMovementOf', { movement: game.i18n.localize(CONFIG.E20.movementTypes[extra.movement]) });
    effects = effectData(label, [[`system.movement.${extra.movement}.bonus`, 10]]);
    break;
  case 'driving':
  case 'initiative':
    system.rules.push({ type: 'RollModifier', scope: 'pilot', label: `${label}: ${detail}`, upshift: 1, when: [`skill:${option}`] });
    break;
  case 'damage':
    if (!extra.effectId) {
      return null;
    }

    detail = T('ZordGrowthDamageOf', { attack: extra.attackLabel ?? '' });
    system.rules.push({ type: 'DamageModifier', direction: 'dealt', label: `${label}: ${detail}`, amount: 1, when: [`item:id:${extra.effectId}`] });
    break;
  case 'accurate':
    if (!extra.weaponId) {
      return null;
    }

    detail = T('ZordGrowthAccurateOf', { attack: extra.attackLabel ?? '' });
    system.rules.push({ type: 'WeaponTrait', label: `${label}: ${detail}`, traits: ['accurate'], items: [`item:id:${extra.weaponId}`] });
    break;
  case 'exchange':
    detail = T('ZordGrowthExchangeOf', { feature: extra.featureName ?? '' });
    break;
  }

  system.automation.notes = `<p>${detail}</p>`;
  return {
    name: `${T('ZordGrowthName', { level })}: ${detail}`,
    type: 'feature',
    img: 'icons/svg/upgrade.svg',
    system,
    effects,
    flags: { essence20: { [GROWTH_FLAG]: { level, option, ...extra } } },
  };
}

/** Ask for the follow-up an option needs; null when cancelled. */
async function followUp(zord, option) {
  const { chooseSelect } = await import("../resources/grants.mjs");
  const title = zord.name;
  if (option == 'movement') {
    const options = MOVEMENT_TYPES.filter(type => Number(zord.system?.movement?.[type]?.total ?? zord.system?.movement?.[type]?.base) > 0)
      .map(type => ({ value: type, label: game.i18n.localize(CONFIG.E20.movementTypes[type]) }));
    const movement = options.length ? await chooseSelect(title, T('ZordGrowthPickMovement'), options) : null;
    return movement ? { movement } : null;
  }

  if (option == 'damage' || option == 'accurate') {
    const attacks = zordAttacks(zord).filter(attack => option == 'damage' || attack.weapon);
    const picked = attacks.length ? await chooseSelect(title, T('ZordGrowthPickAttack'), attacks.map(a => ({ value: a.effect.id, label: a.label }))) : null;
    const attack = attacks.find(a => a.effect.id == picked);
    if (!attack) {
      return null;
    }

    return option == 'damage' ? { effectId: attack.effect.id, attackLabel: attack.label } : { weaponId: attack.weapon.id, attackLabel: attack.label };
  }

  if (option == 'exchange') {
    const features = (zord.items?.contents ?? []).filter(item => item.type == 'feature' && !item.flags?.essence20?.[GROWTH_FLAG]);
    const picked = features.length ? await chooseSelect(title, T('ZordGrowthPickExchange'), features.map(f => ({ value: f.id, label: f.name }))) : null;
    const feature = features.find(f => f.id == picked);
    return feature ? { featureId: feature.id, featureName: feature.name } : null;
  }

  return {};
}

/**
 * Offer the growth choice for one level of one Zord; makes the item. Returns whether a choice was made.
 * @param {Actor} ranger
 * @param {Actor} zord
 * @param {Number} level
 */
export async function chooseZordGrowth(ranger, zord, level) {
  const choices = Object.entries(GROWTH_OPTIONS).map(([value, spec], index) => `<label class="flexrow" style="gap: 6px; align-items: center;">
      <input type="radio" name="option" value="${value}" style="flex: 0 0 auto;"${index ? '' : ' checked'}> <span>${T(spec.label)}</span>
    </label>`).join('');
  const option = await foundry.applications.api.DialogV2.wait({
    window: { title: T('ZordGrowthTitle', { name: zord.name, level }) },
    classes: ['window-app', 'e20-window'],
    position: { width: 420 },
    content: `<p>${T('ZordGrowthPrompt', { name: zord.name, ranger: ranger?.name ?? '', level })}</p><div class="flexcol" style="gap: 2px;">${choices}</div>`,
    buttons: [
      { action: 'choose', label: T('ZordGrowthChoose'), default: true, callback: (event, button) => button.form.elements.option.value },
      { action: 'later', label: T('ZordGrowthLater') },
    ],
    rejectClose: false,
  });
  if (!option || option == 'later') {
    return false;
  }

  const extra = await followUp(zord, option);
  const data = extra ? growthItemData(zord, level, option, extra) : null;
  if (!data) {
    return false;
  }

  await zord.createEmbeddedDocuments('Item', [data]);
  // Exchange: the old Feature goes; the new one is dropped from the Compendium Browser (the GM checks prerequisites).
  if (option == 'exchange') {
    await zord.items.get(extra.featureId)?.delete();
    ui.notifications.info(T('ZordGrowthExchangeDrop', { name: zord.name }));
  }

  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: zord }), content: T('ZordGrowthChosen', { name: zord.name, level, choice: data.name }) });
  return true;
}

/** Every growth choice still owed to the Ranger's Zords, one after another. */
export async function offerZordGrowth(ranger) {
  for (const zord of linkedZords(ranger)) {
    if (!zord.isOwner) {
      continue;
    }

    for (const level of missingGrowthLevels(ranger, zord)) {
      if (!(await chooseZordGrowth(ranger, zord, level))) {
        return;
      }
    }
  }
}
