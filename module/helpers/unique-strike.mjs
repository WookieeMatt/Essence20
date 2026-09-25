import { E20 } from "./config.mjs";
import { setEntryAndAddItem } from "../sheet-handlers/attachment-handler.mjs";

/**
 * "Design your own Attack" (A Jump Through Time, Purple Ranger, p.37-39) - the project's first
 * player-authored weapon. Unlike an item-grant (handing over an EXISTING compendium Item, the
 * separate confirmed gap this codebase still doesn't have a generic mechanism for), Unique Strike
 * builds a wholly NEW weapon+weaponEffect item pair from scratch based on the player's own
 * choices, entirely on the actor's own sheet - closer to Zord Feature's own "create fresh items,
 * nothing existed to grant" precedent (Additional Attack Type/Ram-Flyby) than to a true item
 * grant.
 *
 * RAW's own "Alternate Effect" catalog (Weapon Effects and Traits, PR CRB p.106): Accurate
 * (an upshift), Armor Piercing (ignore Toughness's own armor bonus), Maneuver (a downshift,
 * expressed as this system's own 'maneuver' damageType), Multiple Attacks/Targets (a downshift +
 * numTargets), and Area of Effect (a radius). Of these, Maneuver/Multiple Targets/Area of Effect
 * already map cleanly onto existing weaponEffect fields (damageType/numTargets/radius+shape) -
 * only Accurate and Armor Piercing needed genuinely new schema fields
 * (WeaponEffectItemData#accurateShiftUp/hasArmorPiercing, both defaulting to 0/false so every
 * existing compendium weaponEffect is completely unaffected), since neither trait had ANY
 * mechanical hook anywhere in this codebase before now - confirmed via grep, the "accurate"/
 * "armorPiercing" weapon TRAITS (a separate, purely cosmetic array field on the parent Weapon
 * item) have never done anything mechanically for any of the ~28 real compendium items that
 * already carry them. This pass only wires the two NEW weaponEffect-level fields a freshly-built
 * Unique Strike actually sets - it does NOT retroactively populate them onto those existing
 * items, which would need its own separate verification pass per item.
 */
export const UNIQUE_STRIKE_MELEE_ID = "Compendium.essence20.jump_through_time.Item.G9dBppUoBQrJgXC4";
export const UNIQUE_STRIKE_RANGED_ID = "Compendium.essence20.jump_through_time.Item.MZIplpDN4t6ZhFwA";
export const ENHANCE_STRIKE_ID = "Compendium.essence20.jump_through_time.Item.bPlkdiTAN99QJ1ou";

const UNIQUE_STRIKE_FLAG = 'isUniqueStrike';

const MELEE_ALTERNATE_EFFECTS = ['none', 'accurate', 'armorPiercing', 'maneuver', 'multipleAttacks'];
const RANGED_ALTERNATE_EFFECTS = ['none', 'accurate', 'areaOfEffect', 'armorPiercing', 'maneuver', 'multipleTargets'];

/**
 * Applies one Alternate Effect's own mechanical properties directly onto a weaponEffect data
 * object (used both at creation time and, for Enhance Strike, as a further mutation on an
 * existing item). Each of the 5 named effects maps onto a real, already-generic mechanism -
 * see this file's own doc comment above for why only Accurate/Armor Piercing needed new fields.
 * @param {Object} data   A weaponEffect's own `system` fields (or a partial update object).
 * @param {String} effect   One of 'accurate'/'areaOfEffect'/'armorPiercing'/'maneuver'/
 *   'multipleAttacks'/'multipleTargets'/'none'.
 */
function applyAlternateEffect(data, effect) {
  if (effect == 'accurate') {
    data.accurateShiftUp = 1;
  } else if (effect == 'armorPiercing') {
    data.hasArmorPiercing = true;
  } else if (effect == 'maneuver') {
    data.damageType = 'maneuver';
    data.shiftDown = 1;
  } else if (effect == 'multipleAttacks' || effect == 'multipleTargets') {
    data.numTargets = 2;
    data.shiftDown = 1;
  } else if (effect == 'areaOfEffect') {
    data.radius = 10;
    data.shape = 'burst';
  }
}

/**
 * Whether the weaponEffect's own current fields already express the given Alternate Effect -
 * derived directly from its own field values rather than a separately-tracked list, since every
 * one of the 5 named effects already has an unambiguous field signature. Used by Enhance Strike's
 * own "add one Alternate Effect that the Attack does not already possess" clause.
 * @param {Object} system   A weaponEffect item's own `system` data.
 * @param {String} effect
 * @returns {Boolean}
 */
function hasAlternateEffect(system, effect) {
  if (effect == 'accurate') {
    return (system.accurateShiftUp ?? 0) > 0;
  } else if (effect == 'armorPiercing') {
    return !!system.hasArmorPiercing;
  } else if (effect == 'maneuver') {
    return system.damageType == 'maneuver';
  } else if (effect == 'multipleAttacks' || effect == 'multipleTargets') {
    return (system.numTargets ?? 1) > 1;
  } else if (effect == 'areaOfEffect') {
    return (system.radius ?? 0) > 0;
  }

  return false;
}

/**
 * One combined DialogV2 form gathering every choice RAW's own Unique Strike checklist asks for -
 * name, Attack Skill, (Melee only) damage type, (Ranged only) Attack Range, and one optional
 * Alternate Effect.
 * @param {Boolean} ranged
 * @returns {Promise<Object|null>}   {name, skill, damageType, range, alternateEffect}, or null
 *   if cancelled.
 */
async function pickUniqueStrikeDetails(ranged) {
  const skillOptions = (ranged ? ['athletics', 'targeting'] : ['finesse', 'might'])
    .map(key => `<option value="${key}">${game.i18n.localize(E20.skills[key])}</option>`).join('');
  const damageTypeField = ranged ? '' : `<div class="form-group"><label>${
    game.i18n.localize('E20.UniqueStrikeDamageType')
  }</label><select name="damageType">${
    Object.keys(E20.damageTypes).map(key => `<option value="${key}">${game.i18n.localize(E20.damageTypes[key])}</option>`).join('')
  }</select></div>`;
  const rangeField = ranged ? `<div class="form-group"><label>${
    game.i18n.localize('E20.UniqueStrikeRange')
  }</label><select name="range">
    <option value="standard">${game.i18n.localize('E20.UniqueStrikeRangeStandard')}</option>
    <option value="flat">${game.i18n.localize('E20.UniqueStrikeRangeFlat')}</option>
    <option value="burst">${game.i18n.localize('E20.UniqueStrikeRangeBurst')}</option>
  </select></div>` : '';
  const alternateEffects = ranged ? RANGED_ALTERNATE_EFFECTS : MELEE_ALTERNATE_EFFECTS;
  const alternateEffectOptions = alternateEffects
    .map(key => `<option value="${key}">${game.i18n.localize(`E20.UniqueStrikeAlternateEffect${key.capitalize()}`)}</option>`)
    .join('');

  const result = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize(ranged ? 'E20.UniqueStrikeRangedTitle' : 'E20.UniqueStrikeMeleeTitle') },
    classes: ["window-app"],
    content: `
      <div class="form-group"><label>${game.i18n.localize('E20.UniqueStrikeName')}</label>
        <input type="text" name="name" value="${game.i18n.localize('E20.UniqueStrikeDefaultName')}" /></div>
      <div class="form-group"><label>${game.i18n.localize('E20.UniqueStrikeSkill')}</label>
        <select name="skill">${skillOptions}</select></div>
      ${damageTypeField}
      ${rangeField}
      <div class="form-group"><label>${game.i18n.localize('E20.UniqueStrikeAlternateEffect')}</label>
        <select name="alternateEffect">${alternateEffectOptions}</select></div>
    `,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => ({
          name: button.form.elements.name.value || game.i18n.localize('E20.UniqueStrikeDefaultName'),
          skill: button.form.elements.skill.value,
          damageType: button.form.elements.damageType?.value ?? 'element',
          range: button.form.elements.range?.value ?? null,
          alternateEffect: button.form.elements.alternateEffect.value,
        }),
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  return result && result != 'cancel' ? result : null;
}

/**
 * Grants Unique Strike (Melee or Ranged): prompts for the design, then creates a real
 * weapon+weaponEffect item pair on the actor - "integrated" size (the same weaponless-attack
 * classification Unarmed Combat itself uses), flagged so Enhance Strike can find it again later.
 * @param {Actor} actor
 * @param {Boolean} ranged
 */
export async function grantUniqueStrike(actor, ranged) {
  const details = await pickUniqueStrikeDetails(ranged);
  if (!details) {
    return;
  }

  const weaponEffectSystem = ranged
    ? {
      classification: { skill: details.skill, style: 'element' },
      damageType: 'element',
      damageValue: 1,
      numHands: 0,
      numTargets: 1,
      radius: 0,
      range: details.range == 'standard'
        ? { min: null, reachMultiplier: 1, long: 60, value: 30 }
        : details.range == 'flat'
          ? { min: null, reachMultiplier: 1, long: 45, value: 45 }
          : { min: null, reachMultiplier: 1, long: null, value: null },
      shiftDown: 0,
    }
    : {
      classification: { skill: details.skill, style: 'melee' },
      damageType: details.damageType,
      damageValue: 1,
      numHands: 0,
      numTargets: 1,
      radius: 0,
      range: { min: null, reachMultiplier: 1, long: null, value: null },
      shiftDown: 0,
    };

  if (ranged && details.range == 'burst') {
    weaponEffectSystem.radius = 10;
    weaponEffectSystem.shape = 'burst';
  }

  applyAlternateEffect(weaponEffectSystem, details.alternateEffect);

  const weaponItem = await Item.create({
    name: details.name,
    type: 'weapon',
    img: 'systems/essence20/assets/icons/weapons/punch.svg',
    system: {
      classification: { size: 'integrated' },
      equipped: true,
      items: {},
      requirements: { custom: '', skill: null, shift: null },
      traits: [],
    },
  }, { parent: actor });

  const weaponEffectItem = await Item.create({
    name: details.name,
    type: 'weaponEffect',
    img: 'systems/essence20/assets/icons/items/weapon_effect.svg',
    system: weaponEffectSystem,
    flags: { essence20: { [UNIQUE_STRIKE_FLAG]: true } },
  }, { parent: actor });

  const key = await setEntryAndAddItem(weaponEffectItem, weaponItem);
  await weaponEffectItem.setFlag('essence20', 'collectionId', key);
  await weaponEffectItem.setFlag('essence20', 'parentId', weaponItem._id);
}

/**
 * Finds every Unique Strike weaponEffect the actor has already designed (flagged at creation
 * time above) - Enhance Strike may need to ask which one, if the actor has taken both Unique
 * Strike (Melee) and Unique Strike (Ranged).
 * @param {Actor} actor
 * @returns {Item[]}
 */
export function findUniqueStrikeWeaponEffects(actor) {
  return (actor?.items ?? []).filter(item => item.type == 'weaponEffect' && item.flags?.essence20?.[UNIQUE_STRIKE_FLAG]);
}

/**
 * Enhance Strike (8th/11th/15th/19th level): "you may choose one of the following enhancements to
 * apply to one of your Unique Strikes (Melee or Ranged). You may select the same option multiple
 * times." Prompts which Unique Strike (if more than one exists) and which enhancement, then
 * mutates that item directly.
 * @param {Actor} actor
 */
export async function applyEnhanceStrike(actor) {
  const candidates = findUniqueStrikeWeaponEffects(actor);
  if (!candidates.length) {
    ui.notifications.warn(game.i18n.localize('E20.EnhanceStrikeNoUniqueStrike'));
    return;
  }

  let target = candidates[0];
  if (candidates.length > 1) {
    const options = candidates.map(item => `<option value="${item.id}">${item.name}</option>`).join('');
    const chosenId = await foundry.applications.api.DialogV2.wait({
      window: { title: game.i18n.localize('E20.EnhanceStrikeTitle') },
      classes: ["window-app"],
      content: `<div class="form-group"><label>${
        game.i18n.localize('E20.EnhanceStrikePickLabel')
      }</label><select name="item">${options}</select></div>`,
      modal: true,
      buttons: [
        { label: game.i18n.localize('E20.DialogConfirmButton'), action: 'confirm', callback: (event, button) => button.form.elements.item.value },
        { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
      ],
    });

    if (!chosenId || chosenId == 'cancel') {
      return;
    }

    target = candidates.find(item => item.id == chosenId);
  }

  const isRanged = target.system.classification.style != 'melee';
  const availableAlternateEffects = (isRanged ? RANGED_ALTERNATE_EFFECTS : MELEE_ALTERNATE_EFFECTS)
    .filter(key => key != 'none' && !hasAlternateEffect(target.system, key));

  const enhancementOptions = ['damage', 'elementType'];
  if (isRanged) {
    enhancementOptions.push('range');
  }

  if (availableAlternateEffects.length) {
    enhancementOptions.push('alternateEffect');
  }

  const enhancement = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.EnhanceStrikeTitle') },
    classes: ["window-app"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.EnhanceStrikePickEnhancement')
    }</label><select name="enhancement">${
      enhancementOptions.map(key => `<option value="${key}">${game.i18n.localize(`E20.EnhanceStrikeOption${key.capitalize()}`)}</option>`).join('')
    }</select></div>`,
    modal: true,
    buttons: [
      { label: game.i18n.localize('E20.DialogConfirmButton'), action: 'confirm', callback: (event, button) => button.form.elements.enhancement.value },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  if (!enhancement || enhancement == 'cancel') {
    return;
  }

  if (enhancement == 'damage') {
    await target.update({ 'system.damageValue': (target.system.damageValue ?? 0) + 1 });
  } else if (enhancement == 'elementType') {
    const elementKeys = Object.keys(E20.elementDamageTypes);
    const options = elementKeys.map(key => `<option value="${key}">${game.i18n.localize(E20.elementDamageTypes[key])}</option>`).join('');
    const elementType = await foundry.applications.api.DialogV2.wait({
      window: { title: game.i18n.localize('E20.EnhanceStrikeTitle') },
      classes: ["window-app"],
      content: `<div class="form-group"><label>${
        game.i18n.localize('E20.EnhanceStrikePickElement')
      }</label><select name="damageType">${options}</select></div>`,
      modal: true,
      buttons: [
        { label: game.i18n.localize('E20.DialogConfirmButton'), action: 'confirm', callback: (event, button) => button.form.elements.damageType.value },
        { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
      ],
    });

    if (elementType && elementType != 'cancel') {
      await target.update({ 'system.damageType': elementType });
    }
  } else if (enhancement == 'range') {
    // "Add 10 feet to all values of the Attack's Range/Reach" - only expressible for a Ranged
    // Unique Strike (a flat, non-multiplier value/long pair); a Melee Unique Strike's own Reach
    // is derived from Size via range.reachMultiplier (see weapon-effect.mjs's own
    // prepareDerivedData), which has no equivalent "add 10 flat feet" operation to perform -
    // correctly excluded from enhancementOptions above rather than approximated incorrectly.
    const range = target.system.range;
    await target.update({
      'system.range.value': (range.value ?? 0) + 10,
      'system.range.long': (range.long ?? range.value ?? 0) + 10,
    });
  } else if (enhancement == 'alternateEffect') {
    const options = availableAlternateEffects
      .map(key => `<option value="${key}">${game.i18n.localize(`E20.UniqueStrikeAlternateEffect${key.capitalize()}`)}</option>`)
      .join('');
    const chosenEffect = await foundry.applications.api.DialogV2.wait({
      window: { title: game.i18n.localize('E20.EnhanceStrikeTitle') },
      classes: ["window-app"],
      content: `<div class="form-group"><label>${
        game.i18n.localize('E20.EnhanceStrikePickAlternateEffect')
      }</label><select name="alternateEffect">${options}</select></div>`,
      modal: true,
      buttons: [
        { label: game.i18n.localize('E20.DialogConfirmButton'), action: 'confirm', callback: (event, button) => button.form.elements.alternateEffect.value },
        { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
      ],
    });

    if (chosenEffect && chosenEffect != 'cancel') {
      const update = {};
      applyAlternateEffect(update, chosenEffect);
      await target.update(Object.fromEntries(Object.entries(update).map(([k, v]) => [`system.${k}`, v])));
    }
  }
}
