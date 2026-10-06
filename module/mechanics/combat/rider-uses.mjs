/**
 * The compendium entries mechanics/combat/target-riders.mjs works from, and which of them get a Use button.
 * Kept apart from that file so mechanics/actions/action-perks.mjs can ask about the Use button without pulling
 * in everything target-riders.mjs imports (which would loop back round to action-perks.mjs).
 */

const uuid = (pack, id) => `Compendium.essence20.${pack}.Item.${id}`;

export const RIDER = {
  suppressingFire: uuid('gi_joe_crb', 'MVUiiMad4HYe5xL7'),
  allOutAttack: uuid('gi_joe_crb', 'Rhz1k6gTl2XTs8Nk'),
  evasiveFighting: uuid('gi_joe_crb', 'tBXpROuVSuAxGZpR'),
  concentratedFire: uuid('cobra_codex', '2UPKeLtWRXIoDlux'),
  disarmingShot: uuid('general_hawk_s_personel_files', 'b4v1GUBwSqnCTozq'),
  secondaryQuarry: uuid('decepticon_directive', 'GS8YX7V6rYJLnkfQ'),
};

function sourceOf(item) {
  return item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource;
}

export function riderUseFor(item) {
  const source = sourceOf(item);
  if (item?.type == 'weapon' && item.system?.isPoison && item.system.poisonApplication?.contact) {
    return 'coat';
  }

  return {
    [RIDER.suppressingFire]: 'suppressingFire',
  }[source] ?? null;
}

export function isRiderUse(item) {
  return !!riderUseFor(item);
}

export function canUseRider(item) {
  const kind = riderUseFor(item);
  const actor = item?.parent;
  if (!kind || !actor) {
    return false;
  }

  return true;
}
