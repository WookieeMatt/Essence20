import { registerChatButton, registerHitRider, registerRollSources } from "../../extensions.mjs";
import { getSceneEpoch } from "../../scene-clock.mjs";
import { say, T } from "./shared.mjs";

/**
 * The Enigma of Combination weapons whose Special line needed code: Assault Claw, Demolecularization
 * Gun and Primeon Blade.
 */

const eoc = id => `Compendium.essence20.enigma_of_combination.Item.${id}`;
export const WEAPON22 = {
  assaultClaw: eoc('VKaNv1Vf0O6ewkix'),
  demolecularizationGun: eoc('HjkeUVUUTQiXi0MO'),
  demolecularizationEffect: eoc('pb41Xy9DvpifezHR'),
  primeonBlade: eoc('VuvBnBhXQTmr4Tro'),
};

const DEMOLEC_FLAG = 'd22Demolecularized';
export const CLAW_FLAG = 'd22AssaultClawGrapple';

const dealsSharp = item => item?.system?.damageType == 'sharp' || item?.system?.secondaryDamage?.type == 'sharp';

/* -------------------------------------------- */
/*  Roll sources                                 */
/* -------------------------------------------- */

export function weaponRollSources(actor, target, { item, isAttack } = {}) {
  const sources = [];
  const epoch = getSceneEpoch();

  // Demolecularization Gun (p.53): "Targets hit are partially demolecularized for the remainder of
  // the scene, granting Edge to attacks against them that deal Sharp damage."
  const demolec = target?.flags?.essence20?.[DEMOLEC_FLAG];
  if (isAttack && demolec?.scene == epoch && dealsSharp(item)) {
    sources.push({ id: 'd22Demolecularized', label: T('D22Demolecularized'), edge: true });
  }

  // Assault Claw (p.49): "Targets Grappled by this weapon suffer Snag to escape." Its escape Snag is
  // the Grappled switch (extensions/rules/grappled.mjs#clawGrappled), which a Claw grapple turns on
  // for every roll, escape attempts included.
  return { sources, consumes: [] };
}

registerRollSources((actor, target, ctx) => weaponRollSources(actor, target, ctx));

/* -------------------------------------------- */
/*  On a hit                                     */
/* -------------------------------------------- */

export async function weaponHitRider(actor, target, result, rider) {
  if (!target || result?.success === false) {
    return;
  }

  const epoch = getSceneEpoch();
  if (rider?.weaponSource == WEAPON22.demolecularizationGun || rider?.itemSource == WEAPON22.demolecularizationEffect) {
    await target.setFlag('essence20', DEMOLEC_FLAG, { scene: epoch, by: actor.uuid });
    await say(actor, T('D22DemolecularizedHit', { target: target.name }));
  }

  // The Assault Claw's Grapple alternate effect.
  if (rider?.weaponSource == WEAPON22.assaultClaw && rider.damageType == 'grapple') {
    await target.setFlag('essence20', CLAW_FLAG, { scene: epoch, by: actor.uuid });
  }

  // Primeon Blade (p.52): "Deals 1 additional Energy damage to a single component member in a
  // combined form." A card with one button per component member of the Combiner that was hit.
  if (rider?.weaponSource == WEAPON22.primeonBlade && target.type == 'megaform'
    && (target.system?.subtype ?? []).includes('megaformCombiner')) {
    const { getMegaformParticipants } = await import("../../megaform-participants.mjs");
    const members = getMegaformParticipants(target);
    if (members.length) {
      const buttons = members.map(m => `<button type="button" data-e20-ext="d22PrimeonComponent" data-uuid="${m.uuid}">${m.name}</button>`).join('');
      await say(actor, `<p>${T('D22PrimeonPick', { target: target.name })}</p>${buttons}`);
    }
  }
}

registerHitRider((actor, target, result, rider) => weaponHitRider(actor, target, result, rider));

export async function onPrimeonComponent(message, button) {
  const member = await fromUuid(button.dataset.uuid);
  if (!member) {
    return;
  }

  const { applyDamage } = await import("../../combat.mjs");
  await applyDamage(member, 1, 'element');
  button.disabled = true;
  await ChatMessage.create({ content: T('D22PrimeonDealt', { target: member.name }) });
}

registerChatButton('d22PrimeonComponent', onPrimeonComponent);

