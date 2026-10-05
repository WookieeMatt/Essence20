import {
  registerChatButton, registerHitRider, registerRoundStart, registerUse,
} from "../../extensions.mjs";
import {
  DD, T, feetBetween, firstTarget, isFrom, itemsOf, num, onHook, post, rollDif, sourceOf,
  wears, writeItems,
} from "./shared.mjs";

/**
 * Decepticon Directive gear and Rites: Junkplate / Pit Plates, Rust Derivatives, Stasis Cuffs and
 * the Rites of the All-Consuming (Grant His Hunger, In His Image). See Through Him is a rule on its
 * pack item.
 */
export const O2_DD = {
  junkplate: DD('qhxYoMHmnerakacO'),
  pitPlate: DD('AgWI1lccUBTgj3gT'),
  rustDerivatives: DD('h5tkU3gsCoMHGCFJ'),
  stasisCuffs: DD('YEvGNwsxSNGoHY3S'),
  grantHisHunger: DD('TuXN8c83c1CDiMUD'),
  inHisImage: DD('DegS9JawsaAzOCR1'),
};

export const RUST_FLAG = 'o2Rusted';
export const CUFFS_FLAG = 'o2StasisCuffs';
export const IN_HIS_IMAGE_FLAG = 'o2InHisImage';

/* -------------------------------------------- */
/*  Junkplate / Pit Plates                       */
/* -------------------------------------------- */

/**
 * Junkplate (Decepticon Directive p.75): "allows unarmed combat attacks to inflict Sharp damage;
 * enemies that Fumble with unarmed or natural attacks against wearer suffer 1 Sharp damage."
 * Pit Plates (p.75-76): "↑1 to Intimidation skill tests, and allows unarmed combat attacks to
 * inflict Sharp damage".
 */
export function hasSharpUnarmed(actor) {
  return wears(actor, O2_DD.junkplate) || wears(actor, O2_DD.pitPlate);
}

/** Turn a plain (Blunt) unarmed hit into Sharp damage, crit repeat included. */
export function sharpenResult(result) {
  if (result?.damageType != 'blunt') {
    return false;
  }

  const label = game.i18n.localize(CONFIG.E20?.damageTypes?.sharp ?? 'E20.DamageSharp');
  result.damageType = 'sharp';
  result.damageTypeLabel = label;
  for (const option of result.criticalOptions ?? []) {
    if (option.key == 'double' && option.damageType == 'blunt') {
      option.damageType = 'sharp';
      option.damageTypeLabel = label;
    }
  }

  return true;
}

registerHitRider((actor, target, result, rider) => {
  if (rider?.isUnarmed && hasSharpUnarmed(actor)) {
    sharpenResult(result);
  }
});

// Junkplate's fumble retaliation (1 Sharp to whoever Fumbles an unarmed attack against the wearer) is a
// `targeted` Trigger on its pack item.

/* -------------------------------------------- */
/*  Rust Derivatives                             */
/* -------------------------------------------- */

/**
 * Rust Derivatives (Decepticon Directive p.75): "target then can't regain Health until treated
 * with a successful DIF 20 Science or Technology Skill Test in a procedure that takes 10 minutes".
 * The +1 Acid is helpers/weapon-upgrades.mjs.
 */
export function weaponHasUpgrade(actor, weaponId, uuid) {
  return !!weaponId && itemsOf(actor).some(item => item.type == 'upgrade' && item.flags?.essence20?.parentId == weaponId && sourceOf(item) == uuid);
}

registerHitRider(async (actor, target, result, rider) => {
  if (!target || !weaponHasUpgrade(actor, rider?.weaponId, O2_DD.rustDerivatives)) {
    return;
  }

  if (target.flags?.essence20?.[RUST_FLAG]) {
    return;
  }

  await target.setFlag('essence20', RUST_FLAG, { by: actor.name });
  await post(target, `${T('O2RustApplied', { name: target.name })}
    <button type="button" data-e20-ext="o2TreatRust" data-actor-uuid="${target.uuid}">${T('O2RustTreat')}</button>`);
});

/** Whether this update would raise Health on someone who can't regain it. */
export function blockedHealing(actor, changes) {
  const next = foundry.utils.getProperty(changes, 'system.health.value');
  if (next === undefined || !actor?.flags?.essence20?.[RUST_FLAG]) {
    return false;
  }

  return num(next) > num(actor.system?.health?.value);
}

onHook('preUpdateActor', (actor, changes) => {
  if (blockedHealing(actor, changes)) {
    foundry.utils.setProperty(changes, 'system.health.value', num(actor.system?.health?.value));
    ui.notifications?.warn?.(T('O2RustNoHeal', { name: actor.name }));
  }
});

/** The one treating: this user's own character, or a token they control. */
function treater() {
  return globalThis.canvas?.tokens?.controlled?.[0]?.actor ?? game.user?.character ?? null;
}

registerChatButton('o2TreatRust', async (message, button) => {
  const target = await fromUuid(button.dataset.actorUuid);
  const healer = treater();
  if (!target || !healer) {
    ui.notifications?.warn?.(T('O2NeedHealer'));
    return;
  }

  const { chooseButtons } = await import("../../grants.mjs");
  const skill = await chooseButtons(T('O2RustTreat'), T('O2PickSkill'), [
    ['science', game.i18n.localize(CONFIG.E20.skills.science)],
    ['technology', game.i18n.localize(CONFIG.E20.skills.technology)],
  ]);
  if (!skill) {
    return;
  }

  if ((await rollDif(healer, skill, 20)).success) {
    await target.unsetFlag('essence20', RUST_FLAG);
    await post(target, T('O2RustCured', { name: target.name, healer: healer.name }));
  }
});

/* -------------------------------------------- */
/*  Stasis Cuffs                                 */
/* -------------------------------------------- */

/**
 * Stasis Cuffs (Decepticon Directive p.76-77): "While worn, the bearer cannot convert modes, spend
 * Energon Points for any reason, and is Impaired. It requires a DIF 19 Brawn Skill Test to break
 * free from a pair of stasis cuffs, and the energy tether has a Toughness Defense of 19 and 4
 * Health, regenerating 1 Health at the start of each round."
 */
export function isCuffed(actor) {
  return !!actor?.flags?.essence20?.[CUFFS_FLAG];
}

/** What a cuffed actor's update may not do: convert, or lower either Energon pool. */
export function cuffsBlock(actor, changes) {
  if (!isCuffed(actor)) {
    return null;
  }

  const get = path => foundry.utils.getProperty(changes, path);
  if (get('system.isTransformed') !== undefined && !!get('system.isTransformed') != !!actor.system?.isTransformed) {
    return 'convert';
  }

  for (const pool of ['normal', 'dark']) {
    const next = get(`system.energon.${pool}.value`);
    if (next !== undefined && num(next) < num(actor.system?.energon?.[pool]?.value)) {
      return 'energon';
    }
  }

  return null;
}

onHook('preUpdateActor', (actor, changes, options) => {
  if (options?.o2AllowCuffed) {
    return true;
  }

  const blocked = cuffsBlock(actor, changes);
  if (blocked) {
    ui.notifications?.warn?.(T(blocked == 'convert' ? 'O2CuffsNoConvert' : 'O2CuffsNoEnergon', { name: actor.name }));
    return false;
  }

  return true;
});

registerUse({
  id: 'o2StasisCuffs',
  matches: isFrom(O2_DD.stasisCuffs),
  async run(item, economy, pay) {
    const actor = item.parent;
    const target = firstTarget();
    if (!target || target.id == actor.id) {
      ui.notifications?.warn?.(T('O2NeedTarget'));
      return null;
    }

    // "Prerequisites: d2 Technology to use".
    const tech = actor.system?.skills?.technology?.shift;
    if (tech == 'd20') {
      ui.notifications?.warn?.(T('O2CuffsNeedTech'));
      return null;
    }

    if (!(await pay('standard'))) {
      return null;
    }

    await target.setFlag('essence20', CUFFS_FLAG, { by: actor.name, tether: 4 });
    await target.toggleStatusEffect?.('impaired', { active: true });
    await post(target, `${T('O2CuffsApplied', { name: target.name })}
      <button type="button" data-e20-ext="o2CuffsBreak" data-actor-uuid="${target.uuid}">${T('O2CuffsBreak')}</button>
      <button type="button" data-e20-ext="o2CuffsRelease" data-actor-uuid="${target.uuid}">${T('O2CuffsRelease')}</button>`);
    return T('O2CuffsUsed', { name: actor.name, target: target.name });
  },
});

async function releaseCuffs(target) {
  await target.unsetFlag('essence20', CUFFS_FLAG);
  await target.toggleStatusEffect?.('impaired', { active: false });
  await post(target, T('O2CuffsFreed', { name: target.name }));
}

registerChatButton('o2CuffsBreak', async (message, button) => {
  const target = await fromUuid(button.dataset.actorUuid);
  if (!target || !isCuffed(target) || !target.isOwner) {
    return;
  }

  if ((await rollDif(target, 'brawn', 19)).success) {
    await releaseCuffs(target);
  }
});

registerChatButton('o2CuffsRelease', async (message, button) => {
  const target = await fromUuid(button.dataset.actorUuid);
  if (target && isCuffed(target)) {
    await releaseCuffs(target);
  }
});

// The tether regenerates 1 Health at the start of each round (up to its 4).
registerRoundStart(async () => {
  const { worldActors } = await import("../../companion-link.mjs");
  for (const actor of worldActors()) {
    const cuffs = actor.flags?.essence20?.[CUFFS_FLAG];
    if (cuffs && num(cuffs.tether) < 4) {
      await actor.setFlag('essence20', CUFFS_FLAG, { ...cuffs, tether: num(cuffs.tether) + 1 });
    }
  }
});

/* -------------------------------------------- */
/*  Rites of the All-Consuming                   */
/* -------------------------------------------- */

/**
 * Grant His Hunger (Decepticon Directive p.111): "As a Standard action, the Follower may touch a
 * target and attempt a Culture Skill Test against the target's Cleverness Defense. On a success,
 * the target loses 1d2 Energon Points (or takes 1d2 damage to a random Essence Score)."
 */
export function hasEnergon(actor) {
  return !!actor?.system?.canTransform || num(actor?.system?.energon?.normal?.max) > 0;
}

registerUse({
  id: 'o2GrantHisHunger',
  matches: isFrom(O2_DD.grantHisHunger),
  async run(item, economy, pay) {
    const actor = item.parent;
    const target = firstTarget();
    if (!target || target.id == actor.id) {
      ui.notifications?.warn?.(T('O2NeedTarget'));
      return null;
    }

    const distance = feetBetween(actor, target);
    if (distance != null && distance > 5) {
      ui.notifications?.warn?.(T('O2NeedTouch'));
      return null;
    }

    if (!(await pay('standard'))) {
      return null;
    }

    const dif = num(target.system?.defenses?.cleverness?.total);
    if (!(await rollDif(actor, 'culture', dif)).success) {
      return T('O2RiteFailed', { name: actor.name, rite: item.name });
    }

    const amount = (await new Roll('1d2').evaluate()).total;
    if (hasEnergon(target)) {
      const current = num(target.system?.energon?.normal?.value);
      await target.update({ 'system.energon.normal.value': Math.max(0, current - amount) }, { o2AllowCuffed: true });
      return T('O2HungerEnergon', { name: actor.name, target: target.name, amount });
    }

    const essences = Object.keys(CONFIG.E20?.essences ?? { strength: 1, speed: 1, smarts: 1, social: 1 });
    const essence = essences[Math.floor(Math.random() * essences.length)];
    const { applyEssenceDamage } = await import("../../environment-hazards.mjs");
    for (let i = 0; i < amount; i++) {
      await applyEssenceDamage(target, [essence]);
    }

    return T('O2HungerEssence', { name: actor.name, target: target.name, amount, essence: game.i18n.localize(CONFIG.E20?.essences?.[essence] ?? essence) });
  },
});

/**
 * In His Image (Decepticon Directive p.111): "In a ritual that takes 1 hour, the Follower can
 * attempt a Culture Skill Test against a Defeated target's Toughness Defense (ignoring armor
 * bonuses) to exchange one or more of the target's Hang-Ups with an equal number of Hang-Ups of the
 * Follower's choice and design ... this rite may only be successful on any given target once."
 */
export function inHisImageDif(target) {
  const toughness = target?.system?.defenses?.toughness ?? {};
  return Math.max(0, num(toughness.total) - num(toughness.armor));
}

registerUse({
  id: 'o2InHisImage',
  matches: isFrom(O2_DD.inHisImage),
  async run(item) {
    const actor = item.parent;
    const target = firstTarget();
    if (!target || !target.statuses?.has?.('defeated')) {
      ui.notifications?.warn?.(T('O2NeedDefeatedTarget'));
      return null;
    }

    if (target.flags?.essence20?.[IN_HIS_IMAGE_FLAG]) {
      ui.notifications?.warn?.(T('O2InHisImageOnce', { name: target.name }));
      return null;
    }

    if (!(await rollDif(actor, 'culture', inHisImageDif(target))).success) {
      return T('O2RiteFailed', { name: actor.name, rite: item.name });
    }

    const { chooseSelect, findItems, pickOne } = await import("../../grants.mjs");
    const remove = [];
    const create = [];
    let hangUps = itemsOf(target).filter(i => i.type == 'hangUp');
    while (hangUps.length) {
      const id = await chooseSelect(item.name, T('O2InHisImagePickOld'), [
        { value: '', label: T('O2Done') }, ...hangUps.map(h => ({ value: h.id, label: h.name })),
      ]);
      if (!id) {
        break;
      }

      const uuid = await pickOne(item.name, await findItems({ type: 'hangUp' }));
      if (!uuid) {
        break;
      }

      const source = await fromUuid(uuid);
      const data = source?.toObject?.();
      if (!data) {
        break;
      }

      delete data._id;
      foundry.utils.setProperty(data, 'flags.core.sourceId', uuid);
      remove.push(id);
      create.push(data);
      hangUps = hangUps.filter(h => h.id != id);
    }

    if (!remove.length) {
      return null;
    }

    await writeItems(target, { create, remove });
    await target.setFlag('essence20', IN_HIS_IMAGE_FLAG, true);
    return T('O2InHisImageDone', { name: actor.name, target: target.name, n: remove.length });
  },
});
