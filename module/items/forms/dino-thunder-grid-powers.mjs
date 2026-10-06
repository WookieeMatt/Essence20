import { registerRest, registerUse } from "../../mechanics/item-hooks.mjs";
import { worldActors } from "../../mechanics/companions/companion-link.mjs";

/**
 * The three Grid Powers built on Dino Thunder [Form] (Beneath the Helmet, p.52-57):
 * - Dino Thunder Boost (p.56): "you are granted 3 extra Personal Power that may only be used to
 *   activate your Dino Thunder Form Power. This special form of Personal Power is recovered the same
 *   way that regular Personal Power is recovered."
 * - Extra Dino Thunder Form Power (p.57): "you may take an additional Dino Thunder Form Power ...
 *   using a Personal Power activates both of your powers, and both powers disappear when you morph."
 * - White Ranger Extra Dino Thunder (p.57): "When you spend 1 Personal Power, you may activate any
 *   Dino Thunder Power that you or your teammates have. If you choose a power that is not yours, then
 *   the Game Master may impose a Snag or a ↓1 on Skill Tests that involve those powers."
 *
 * Which Form power a character has is stored on their Dino Thunder [Form] Perk as
 * flags.essence20.dinoThunderPower (asked for the first time it's needed), the second one on the
 * Extra Dino Thunder Form Power item under the same flag. Activation records the active powers on
 * the actor (flags.essence20.d1DinoThunderActive, cleared on morphing) and calls the
 * `essence20.dinoThunderActivated` hook with (actor, powerKeys, {source}) so the Form powers' own
 * effects can be applied by whatever builds them.
 */

const bth = id => `Compendium.essence20.beneath_the_helmet.Item.${id}`;
export const DINO = {
  form: bth('uh73qYz8bwDobLFh'),
  boost: bth('WmqXxyaXQlCFHNio'),
  extra: bth('egWuVVSAAb5Z8EZa'),
  whiteRanger: bth('E94x9wIiNGzgBfvZ'),
};

// Dino Thunder [Form] powers, p.52-55.
export const DINO_THUNDER_POWERS = [
  'auraReading', 'camouflage', 'invisibility', 'intangibility', 'mindReading', 'psychometry', 'pteraScream',
  'replication', 'shieldProjection', 'shieldPropulsion', 'superhumanStrength', 'triceraSkin', 'tRexSpeed',
  'visualTeleportation',
];

export const BOOST_POOL_MAX = 3;
const ACTIVE_FLAG = 'd1DinoThunderActive';

const T = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));
const powerLabel = key => T(`E20.D1DinoPower${key.charAt(0).toUpperCase()}${key.slice(1)}`);

function sourceOf(item) {
  return item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource ?? null;
}

function itemsOf(actor) {
  const items = actor?.items;
  if (!items) {
    return [];
  }

  return Array.isArray(items) ? items : (items.contents ?? [...items]);
}

export function findSourced(actor, uuid) {
  return uuid ? itemsOf(actor).find(item => sourceOf(item) == uuid) ?? null : null;
}

/** The actor's own Dino Thunder powers, primary first. */
export function formPowersOf(actor) {
  const powers = [];
  const primary = findSourced(actor, DINO.form)?.flags?.essence20?.dinoThunderPower;
  const second = findSourced(actor, DINO.extra)?.flags?.essence20?.dinoThunderPower;
  for (const key of [primary, second]) {
    if (key && DINO_THUNDER_POWERS.includes(key) && !powers.includes(key)) {
      powers.push(key);
    }
  }

  return powers;
}

/* -------------------------------------------- */
/*  Personal Power                               */
/* -------------------------------------------- */

export function boostPool(actor) {
  const boost = findSourced(actor, DINO.boost);
  if (!boost) {
    return 0;
  }

  const value = boost.flags?.essence20?.d1BoostPool;
  return Number.isFinite(value) ? value : BOOST_POOL_MAX;
}

function personalPower(actor) {
  return Number(actor?.system?.powers?.personal?.value) || 0;
}

/**
 * Pays the 1 Personal Power a Form activation costs - from the Boost pool first (it can pay for
 * nothing else), then the character's own Personal Power.
 * @returns {Promise<String|null>}   'boost' | 'personal', or null if neither could pay.
 */
export async function payFormPower(actor, { boostAllowed = true } = {}) {
  const boost = findSourced(actor, DINO.boost);
  const pool = boostPool(actor);
  if (boostAllowed && boost && pool > 0) {
    await boost.setFlag('essence20', 'd1BoostPool', pool - 1);
    return 'boost';
  }

  const value = personalPower(actor);
  if (value > 0) {
    await actor.update({ 'system.powers.personal.value': value - 1 });
    return 'personal';
  }

  return null;
}

/* -------------------------------------------- */
/*  Picking and activating                       */
/* -------------------------------------------- */

async function pickPower(title, exclude = []) {
  const { chooseSelect } = await import("../../mechanics/resources/grants.mjs");
  const options = DINO_THUNDER_POWERS.filter(key => !exclude.includes(key)).map(key => ({ value: key, label: powerLabel(key) }));
  return chooseSelect(title, T('E20.D1DinoPickPrompt'), options);
}

/** The Form Perk's own power, asked for (and stored) if it hasn't been chosen yet. */
export async function ensurePrimaryPower(actor) {
  const form = findSourced(actor, DINO.form);
  if (!form) {
    return null;
  }

  const current = form.flags?.essence20?.dinoThunderPower;
  if (current) {
    return current;
  }

  const chosen = await pickPower(form.name);
  if (chosen) {
    await form.setFlag('essence20', 'dinoThunderPower', chosen);
  }

  return chosen ?? null;
}

export async function activateDinoThunder(actor, powers, { source } = {}) {
  await actor.setFlag('essence20', ACTIVE_FLAG, { powers, source: source ?? null });
  Hooks.callAll('essence20.dinoThunderActivated', actor, powers, { source });
}

export function activeDinoThunder(actor) {
  return actor?.flags?.essence20?.[ACTIVE_FLAG] ?? null;
}

function paidNote(paid, actor) {
  return paid == 'boost'
    ? T('E20.D1DinoPaidBoost', { left: boostPool(actor) })
    : T('E20.D1DinoPaidPersonal', { left: personalPower(actor) });
}

/** Both Form powers (or the one there is) for 1 Personal Power. */
async function activateOwn(actor, source) {
  const primary = await ensurePrimaryPower(actor);
  if (!primary) {
    return null;
  }

  const powers = formPowersOf(actor);
  const paid = await payFormPower(actor);
  if (!paid) {
    ui.notifications?.warn(T('E20.D1DinoNoPower', { name: actor.name }));
    return null;
  }

  await activateDinoThunder(actor, powers, { source });
  return T('E20.D1DinoActivated', { name: actor.name, powers: powers.map(powerLabel).join(', ') }) + ' ' + paidNote(paid, actor);
}

// Dino Thunder Boost - activate the Form from the Boost pool (or Personal Power once it's empty).
registerUse({
  id: 'd1DinoThunderBoost',
  matches: item => sourceOf(item) == DINO.boost,
  canUse: item => !!findSourced(item.parent, DINO.form) && (boostPool(item.parent) > 0 || personalPower(item.parent) > 0),
  run: async item => activateOwn(item.parent, 'boost'),
});

// Extra Dino Thunder Form Power - pick the second power once; after that the Use activates both.
registerUse({
  id: 'd1DinoThunderExtra',
  matches: item => sourceOf(item) == DINO.extra,
  canUse: item => !!findSourced(item.parent, DINO.form),
  run: async item => {
    const actor = item.parent;
    if (!item.flags?.essence20?.dinoThunderPower) {
      const primary = await ensurePrimaryPower(actor);
      if (!primary) {
        return null;
      }

      const second = await pickPower(item.name, [primary]);
      if (!second) {
        return null;
      }

      await item.setFlag('essence20', 'dinoThunderPower', second);
      return T('E20.D1DinoSecondChosen', { name: actor.name, power: powerLabel(second) });
    }

    return activateOwn(actor, 'extra');
  },
});

/** Every Dino Thunder power the actor or a teammate has: [{key, owner}]. */
export function mimicOptions(actor) {
  const options = formPowersOf(actor).map(key => ({ key, owner: actor }));
  for (const other of worldActors()) {
    if (other?.id == actor?.id || other?.type != 'playerCharacter') {
      continue;
    }

    for (const key of formPowersOf(other)) {
      options.push({ key, owner: other });
    }
  }

  return options;
}

// White Ranger Extra Dino Thunder - any power the White Ranger or a teammate has, for 1 Personal Power.
registerUse({
  id: 'd1DinoThunderWhiteRanger',
  matches: item => sourceOf(item) == DINO.whiteRanger,
  canUse: item => !!findSourced(item.parent, DINO.form) && (personalPower(item.parent) > 0 || boostPool(item.parent) > 0),
  run: async item => {
    const actor = item.parent;
    await ensurePrimaryPower(actor);
    const options = mimicOptions(actor);
    const { chooseSelect } = await import("../../mechanics/resources/grants.mjs");
    const picked = await chooseSelect(item.name, T('E20.D1DinoPickPrompt'),
      options.map((option, index) => ({ value: String(index), label: `${powerLabel(option.key)} (${option.owner.name})` })));
    const option = picked === null || picked === undefined ? null : options[Number(picked)];
    if (!option) {
      return null;
    }

    // The Boost pool only pays for the character's own Form power.
    const own = option.owner.id == actor.id;
    const paid = await payFormPower(actor, { boostAllowed: own });
    if (!paid) {
      ui.notifications?.warn(T('E20.D1DinoNoPower', { name: actor.name }));
      return null;
    }

    await activateDinoThunder(actor, [option.key], { source: 'whiteRanger', from: option.owner.uuid });
    return T('E20.D1DinoActivated', { name: actor.name, powers: powerLabel(option.key) }) + ' ' + paidNote(paid, actor)
      + (own ? '' : ' ' + T('E20.D1DinoMimicNote', { owner: option.owner.name }));
  },
});

// "This special form of Personal Power is recovered the same way that regular Personal Power is
// recovered" - refilled whenever the sheet's Rest refills Personal Power.
export async function refillBoost(actor) {
  const boost = findSourced(actor, DINO.boost);
  if (boost && boostPool(actor) < BOOST_POOL_MAX) {
    await boost.setFlag('essence20', 'd1BoostPool', BOOST_POOL_MAX);
  }
}

registerRest(refillBoost);

// "Both powers disappear when you morph."
Hooks.on('updateActor', async (actor, changes, options, userId) => {
  if (userId != game.user?.id || changes?.system?.isMorphed !== true || !activeDinoThunder(actor)) {
    return;
  }

  await actor.unsetFlag('essence20', ACTIVE_FLAG);
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: T('E20.D1DinoEndsOnMorph', { name: actor.name }) });
});
