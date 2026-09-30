import {
  registerApplyDialog, registerDialogToggles, registerHitRider, registerPostRoll, registerRollSources, registerUse,
} from "../../extensions.mjs";
import { getUses } from "../../scene-clock.mjs";
import { worldActors } from "../../companion-link.mjs";
import { T, ats, bth, fgaa, findSourced, flagOf, giveEdge, itemsOf, jtt, parentWeaponOf, postLine, sourceOf, writeActor } from "./common.mjs";

/**
 * Megaform pieces:
 * - Multi-Megaform (A Jump Through Time, Zord Feature, p.83): "choose three Megaform Traits. While
 *   Combined into a Megaform, your Zord applies one of these Megaform Traits." The three are noted on
 *   the Feature; the Use button swaps which one the Zord currently carries (a real megaformTrait item,
 *   so documents/actor.mjs#_prepareMegaformZordData counts it).
 * - Accurate Combiner (Across the Stars, Megaform Trait, p.104): "Whenever the Megaform calls upon one
 *   of this Combiner participant's attack types, the associated Skill Test gains ↑1."
 * - Assault Weapon (A Jump Through Time, Megaform Trait, p.84): +1 damage on the Megaform's participant
 *   melee attacks.
 * - Megaform (Advanced) Signature Finishing Move (Beneath the Helmet, Zord Features, p.72-73).
 * - Power Master / Target Master (Field Guide to Action & Adventure, Battledress Upgrades, p.280):
 *   "You gain the Combiner trait. Your Perks and Powers apply to Megaforms you join." / "...Your
 *   Megaform can Attack with any of your weapons." Mirrored onto the Megaform as real items while the
 *   wearer is one of its participants.
 */

export const MF = {
  multiMegaform: jtt('vbySX4nIsHsIhIzJ'),
  sfm: bth('ETpLoMS5CLTbVONp'),
  advancedSfm: bth('ZTFvl0a1KvIyZ87f'),
  accurateCombiner: ats('yYaK1g58FCPpSNUr'),
  powerMaster: fgaa('Zord1PowerMastr1'),
  targetMaster: fgaa('Zord1TargetMastr'),
};

const MIRROR_FLAG = 'zord1MirrorOf';

export function rosterOf(megaform) {
  return Object.values(megaform?.system?.actors ?? {})
    .map(entry => globalThis.fromUuidSync?.(entry.uuid))
    .filter(Boolean);
}

export function megaformsContaining(actor) {
  if (!actor?.uuid) {
    return [];
  }

  return worldActors().filter(other => other?.type == 'megaform'
    && Object.values(other.system?.actors ?? {}).some(entry => entry?.uuid == actor.uuid));
}

/* -------------------------------------------- */
/*  Which participant's attack is this?          */
/* -------------------------------------------- */

/** The participant actor whose attack the Megaform is using (null if it can't be told). */
export function attackOwner(megaform, item) {
  const weapon = parentWeaponOf(megaform, item);
  const roster = rosterOf(megaform);
  const mirror = flagOf(weapon, MIRROR_FLAG) ?? flagOf(item, MIRROR_FLAG);
  if (mirror) {
    const uuid = String(mirror).split('|')[0];
    return roster.find(actor => actor.uuid == uuid) ?? null;
  }

  // helpers/extensions/zord2/megaform-attacks.mjs remembers the participant weapon it was built from.
  const built = flagOf(weapon, 'zord2WeaponUuid') ?? flagOf(item, 'zord2WeaponUuid');
  if (built) {
    const owner = roster.find(actor => String(built).startsWith(`${actor.uuid}.`));
    if (owner) {
      return owner;
    }
  }

  // Otherwise: the participant holding a weapon of the same compendium source or name.
  const key = sourceOf(weapon) ?? null;
  const name = weapon?.name ?? item?.name;
  return roster.find(actor => itemsOf(actor).some(other => other.type == (weapon ? 'weapon' : 'weaponEffect')
    && ((key && sourceOf(other) == key) || other.name == name))) ?? null;
}

/* -------------------------------------------- */
/*  Accurate Combiner                            */
/* -------------------------------------------- */

export function accurateCombinerSources(actor, target, { item, isAttack, isMelee } = {}) {
  if (actor?.type != 'megaform' || !isAttack) {
    return { sources: [] };
  }

  const owner = attackOwner(actor, item);
  const attackType = isMelee ? 'melee' : 'ranged';
  const trait = itemsOf(owner).find(i => i.type == 'megaformTrait' && i.system?.type == 'accurateCombiner'
    && (i.system?.attackType ?? 'melee') == attackType);
  return trait ? { sources: [{ id: 'zord1AccurateCombiner', label: `${trait.name} (${owner.name})`, shiftUp: 1 }] } : { sources: [] };
}

/* -------------------------------------------- */
/*  Assault Weapon                               */
/* -------------------------------------------- */

/**
 * Assault Weapon (A Jump Through Time, Megaform Trait, p.84): "Increase the Megaform's Participant Melee
 * Attack's base damage by 1." documents/actor.mjs sets system.hasAssaultWeapon when any participant holds
 * it; this adds the +1 to a landed melee attack the Megaform makes with one of its participants' attacks
 * (attackOwner above). Once, however many participants hold it. The trait-generated attacks
 * (extensions/zord2/megaform-attacks.mjs - Enhanced Melee Attack and the like) are left alone: they're
 * already scaled from a participant attack rather than being one.
 */
export async function assaultWeaponHitRider(actor, target, result, rider, tools) {
  if (actor?.type != 'megaform' || !actor.system?.hasAssaultWeapon || rider?.style != 'melee' || !result?.damageValue) {
    return;
  }

  const effectId = String(rider.itemUuid ?? '').split('.').pop();
  const item = actor.items?.get?.(effectId) ?? itemsOf(actor).find(i => i.id == effectId);
  if (!item || flagOf(item, 'zord2Gen') || flagOf(parentWeaponOf(actor, item), 'zord2Gen') || !attackOwner(actor, item)) {
    return;
  }

  const trait = rosterOf(actor).flatMap(itemsOf).find(i => i.type == 'megaformTrait' && i.system?.type == 'assaultWeapon');
  tools.damageBonusNote(result, 1, trait?.name ?? T('MegaformTraitAssaultWeapon'));
}

/* -------------------------------------------- */
/*  Signature Finishing Moves                    */
/* -------------------------------------------- */

const SFM_USED = 'zord1SfmUsed';
const ADV_USED = 'zord1AdvSfmUsed';
const ADV_READY = 'zord1AdvSfmReady';
const pendingFinisher = new Map();

/** "The type of attack and the type of damage that it deals is chosen at the selection of this Feature." */
export async function pickFinisher(feature) {
  const { chooseButtons, chooseSelect } = await import("../../grants.mjs");
  const style = await chooseButtons(feature.name, T('Zord1SfmStylePrompt'), [['melee', T('Zord1SfmMelee')], ['ranged', T('Zord1SfmRanged')]]);
  if (!['melee', 'ranged'].includes(style)) {
    return null;
  }

  const damageType = await chooseSelect(feature.name, T('Zord1SfmDamagePrompt'),
    Object.entries(CONFIG.E20?.damageTypes ?? {}).map(([value, label]) => ({ value, label: game.i18n.localize(label) })));
  await feature.update({ 'flags.essence20.zord1Finisher': { style, damageType: damageType ?? null } });
  return T('Zord1SfmSet', { name: feature.name, style: T(style == 'melee' ? 'Zord1SfmMelee' : 'Zord1SfmRanged') });
}

function finisherFeature(megaform, uuid, isMelee) {
  for (const zord of rosterOf(megaform)) {
    const feature = itemsOf(zord).find(item => sourceOf(item) == uuid);
    if (!feature) {
      continue;
    }

    const style = flagOf(feature, 'zord1Finisher')?.style
      ?? (uuid == MF.advancedSfm ? flagOf(findSourced(zord, MF.sfm), 'zord1Finisher')?.style : null);
    if (!style || style == (isMelee ? 'melee' : 'ranged')) {
      return { zord, feature };
    }
  }

  return null;
}

export function finisherToggles(actor, { item } = {}) {
  if (actor?.type != 'megaform' || item?.type != 'weaponEffect') {
    return [];
  }

  const isMelee = item.system?.classification?.style == 'melee';
  const toggles = [];
  // "Once per scene, a Megaform that includes at least one Zord with this Feature can initiate a
  // Signature Finishing Move as a Standard action... deals 4× the damage of the participant attack".
  const sfm = finisherFeature(actor, MF.sfm, isMelee);
  if (sfm && getUses(actor, SFM_USED, 'scene') < 1) {
    toggles.push({ name: 'zord1Sfm', type: 'checkbox', label: T('Zord1ToggleSfm', { name: sfm.feature.name }) });
  }

  // "If every Zord in the Megaform is successful, the Megaform executes their Signature Finishing Move!
  // ... deals ×5 damage ... while bypassing all of the target's damage Resistances!"
  const adv = finisherFeature(actor, MF.advancedSfm, isMelee);
  if (adv && getUses(actor, ADV_READY, 'scene') > 0) {
    toggles.push({ name: 'zord1AdvSfm', type: 'checkbox', label: T('Zord1ToggleAdvSfm', { name: adv.feature.name }), value: true });
  }

  return toggles;
}

export async function finisherApplyDialog(actor, options, { item } = {}) {
  const ext = options.ext ?? {};
  if (!ext.zord1Sfm && !ext.zord1AdvSfm) {
    return;
  }

  const isMelee = item?.system?.classification?.style == 'melee';
  const advanced = !!ext.zord1AdvSfm;
  const found = finisherFeature(actor, advanced ? MF.advancedSfm : MF.sfm, isMelee);
  const damageType = flagOf(found?.feature, 'zord1Finisher')?.damageType
    ?? flagOf(findSourced(found?.zord, MF.sfm), 'zord1Finisher')?.damageType ?? null;
  pendingFinisher.set(actor.uuid, { mult: advanced ? 5 : 4, damageType, advanced, name: found?.feature?.name ?? '' });

  if (advanced) {
    await writeActor(actor, 'unsetFlag', ['essence20', ADV_READY]);
    // Bypassing Resistance: Resistance is a Snag on the attack roll (PR CRB p.170), so an Edge cancels it.
    const target = game.user?.targets?.first?.()?.actor;
    const type = damageType ?? item?.system?.damageType;
    if (target && type && target.system?.resistances?.[type]) {
      giveEdge(options);
    }
  } else {
    const { epochFor } = await import("../../scene-clock.mjs");
    await writeActor(actor, 'setFlag', ['essence20', SFM_USED, { epoch: epochFor('scene'), window: 'scene', count: 1 }]);
  }
}

export async function finisherHitRider(actor, target, result, rider, tools) {
  const pending = actor?.uuid ? pendingFinisher.get(actor.uuid) : null;
  if (!pending || !result.damageValue) {
    return;
  }

  tools.damageBonusNote(result, result.damageValue * (pending.mult - 1), pending.name);
  if (pending.damageType) {
    result.damageType = pending.damageType;
    result.damageTypeLabel = game.i18n.localize(CONFIG.E20?.damageTypes?.[pending.damageType] ?? pending.damageType);
  }
}

export async function finisherPostRoll(actor) {
  if (actor?.uuid && pendingFinisher.has(actor.uuid)) {
    const pending = pendingFinisher.get(actor.uuid);
    pendingFinisher.delete(actor.uuid);
    await postLine(actor, T('Zord1SfmReach', { name: pending.name }));
  }
}

const STRENGTH_SPEED_SKILLS = ['athletics', 'brawn', 'intimidation', 'might', 'acrobatics', 'driving', 'finesse', 'infiltration', 'initiative', 'targeting'];

/**
 * "Once per day... To initiate, each Zord or pilot must succeed on a DIF 15 Skill Test using any
 * Strength or Speed Essence Skill." Once per day is kept once per mission here.
 */
export async function initiateAdvancedFinisher(feature) {
  const zord = feature.parent;
  const megaform = megaformsContaining(zord)[0];
  if (!megaform) {
    ui.notifications.warn(T('Zord1SfmNotCombined', { name: zord.name }));
    return null;
  }

  const { epochFor } = await import("../../scene-clock.mjs");
  if (getUses(megaform, ADV_USED, 'mission') > 0) {
    ui.notifications.warn(T('Zord1AdvSfmUsed'));
    return null;
  }

  await writeActor(megaform, 'setFlag', ['essence20', ADV_USED, { epoch: epochFor('mission'), window: 'mission', count: 1 }]);
  const { chooseSelect, rollTest } = await import("../../grants.mjs");
  const failed = [];
  for (const participant of rosterOf(megaform).filter(actor => actor.type == 'zord')) {
    const pilot = Object.values(participant.system?.actors ?? {}).find(crew => crew?.vehicleRole == 'driver');
    const roller = (pilot && globalThis.fromUuidSync?.(pilot.uuid)) || participant;
    const skill = await chooseSelect(feature.name, T('Zord1AdvSfmSkill', { name: roller.name }),
      STRENGTH_SPEED_SKILLS.map(value => ({ value, label: game.i18n.localize(CONFIG.E20?.skills?.[value] ?? value) })));
    const { success } = skill ? await rollTest(roller, skill, 15) : { success: false };
    if (!success) {
      failed.push(roller.name);
    }
  }

  if (failed.length) {
    return T('Zord1AdvSfmFailed', { name: megaform.name, names: failed.join(', ') });
  }

  await writeActor(megaform, 'setFlag', ['essence20', ADV_READY, { epoch: epochFor('scene'), window: 'scene', count: 1 }]);
  return T('Zord1AdvSfmReady', { name: megaform.name });
}

/* -------------------------------------------- */
/*  Multi-Megaform                               */
/* -------------------------------------------- */

const MULTI_FLAG = 'zord1MultiTraits';
const MULTI_ITEM = 'zord1MultiMegaform';

/** "When you select this Zord Feature, choose three Megaform Traits." */
export async function pickMultiTraits(feature) {
  const { findItems, pickOne } = await import("../../grants.mjs");
  const rows = await findItems({ type: 'megaformTrait' });
  const chosen = [];
  // "your Zord may not acquire any further instances of these chosen Megaform Traits" - and the
  // three already noted on another Multi-Megaform are off the table too.
  const taken = new Set(itemsOf(feature.parent).filter(item => sourceOf(item) == MF.multiMegaform && item.id != feature.id)
    .flatMap(item => flagOf(item, MULTI_FLAG) ?? []));
  for (let i = 0; i < 3; i++) {
    const uuid = await pickOne(T('Zord1MultiPick', { n: i + 1 }), rows.filter(row => !chosen.includes(row.uuid) && !taken.has(row.uuid)));
    if (!uuid) {
      break;
    }

    chosen.push(uuid);
  }

  if (chosen.length) {
    await feature.setFlag('essence20', MULTI_FLAG, chosen);
  }

  return chosen.length ? T('Zord1MultiNoted', { name: feature.name, n: chosen.length }) : null;
}

/** Swap which of the three traits the Zord carries into the Megaform. */
export async function applyMultiTrait(feature) {
  const traits = flagOf(feature, MULTI_FLAG) ?? [];
  if (!traits.length) {
    return pickMultiTraits(feature);
  }

  const zord = feature.parent;
  const rows = await Promise.all(traits.map(async uuid => [uuid, (await fromUuid(uuid))?.name ?? uuid]));
  rows.push(['renote', T('Zord1MultiRenote')]);
  const { chooseButtons, grantCopy } = await import("../../grants.mjs");
  const picked = await chooseButtons(feature.name, T('Zord1MultiApplyPrompt'), rows);
  if (picked == 'renote') {
    return pickMultiTraits(feature);
  }

  if (!traits.includes(picked)) {
    return null;
  }

  const old = itemsOf(zord).filter(item => flagOf(item, MULTI_ITEM) == feature.id).map(item => item.id);
  if (old.length) {
    await zord.deleteEmbeddedDocuments('Item', old);
  }

  const created = await grantCopy(zord, picked, { grantedBy: feature, flags: { [MULTI_ITEM]: feature.id } });
  return created ? T('Zord1MultiApplied', { name: zord.name, trait: created.name }) : null;
}

/* -------------------------------------------- */
/*  Power Master / Target Master                 */
/* -------------------------------------------- */

/** What the Megaform should be carrying from each Power/Target Master participant. */
export function desiredMirrors(megaform) {
  const out = [];
  if (megaform?.type != 'megaform') {
    return out;
  }

  for (const actor of rosterOf(megaform)) {
    const power = findSourced(actor, MF.powerMaster);
    const target = findSourced(actor, MF.targetMaster);
    for (const item of itemsOf(actor)) {
      if (flagOf(item, MIRROR_FLAG)) {
        continue;
      }

      const isPerkOrPower = power && ['perk', 'power'].includes(item.type);
      const isWeapon = target && (item.type == 'weapon' || (item.type == 'weaponEffect' && flagOf(item, 'parentId')));
      if (isPerkOrPower || isWeapon) {
        out.push({ key: `${actor.uuid}|${item.id}`, item });
      }
    }
  }

  return out;
}

export async function syncMasters(megaform) {
  if (megaform?.type != 'megaform') {
    return;
  }

  const want = desiredMirrors(megaform);
  const wantKeys = new Set(want.map(entry => entry.key));
  const have = itemsOf(megaform).filter(item => flagOf(item, MIRROR_FLAG));
  const haveKeys = new Set(have.map(item => flagOf(item, MIRROR_FLAG)));

  const stale = have.filter(item => !wantKeys.has(flagOf(item, MIRROR_FLAG))).map(item => item.id);
  if (stale.length) {
    await megaform.deleteEmbeddedDocuments('Item', stale);
  }

  const fresh = want.filter(entry => !haveKeys.has(entry.key)).map(({ key, item }) => {
    const data = item.toObject();
    foundry.utils.setProperty(data, `flags.essence20.${MIRROR_FLAG}`, key);
    if (!sourceOf(data) && item.uuid) {
      foundry.utils.setProperty(data, 'flags.core.sourceId', item.uuid);
    }

    return data;
  });
  if (fresh.length) {
    // Same ids as the participant's items, so a mirrored weaponEffect still points at its weapon.
    await megaform.createEmbeddedDocuments('Item', fresh, { keepId: true });
  }
}

/* -------------------------------------------- */
/*  Registration                                 */
/* -------------------------------------------- */

registerRollSources(accurateCombinerSources);
registerDialogToggles(finisherToggles);
registerApplyDialog(finisherApplyDialog);
registerHitRider(finisherHitRider);
registerHitRider(assaultWeaponHitRider);
registerPostRoll(finisherPostRoll);

registerUse({ id: 'zord1Multi', matches: item => sourceOf(item) == MF.multiMegaform, run: applyMultiTrait });
registerUse({ id: 'zord1Sfm', matches: item => sourceOf(item) == MF.sfm, run: pickFinisher });
registerUse({ id: 'zord1AdvSfm', matches: item => sourceOf(item) == MF.advancedSfm, run: initiateAdvancedFinisher });
registerUse({
  id: 'zord1Masters',
  matches: item => [MF.powerMaster, MF.targetMaster].includes(sourceOf(item)),
  async run(item) {
    const megaforms = megaformsContaining(item.parent);
    for (const megaform of megaforms) {
      await syncMasters(megaform);
    }

    return megaforms.length ? T('Zord1MastersSynced', { name: item.parent.name, megaform: megaforms.map(m => m.name).join(', ') }) : null;
  },
});

globalThis.Hooks?.on?.('updateActor', (actor, changes, options, userId) => {
  if (userId == globalThis.game?.user?.id && actor?.type == 'megaform' && changes?.system?.actors !== undefined) {
    syncMasters(actor);
  }
});

globalThis.Hooks?.on?.('createItem', (item, options, userId) => {
  if (userId != globalThis.game?.user?.id || !item.parent) {
    return;
  }

  const source = sourceOf(item);
  if (source == MF.sfm && !flagOf(item, 'zord1Finisher')) {
    pickFinisher(item);
  } else if (source == MF.multiMegaform && !flagOf(item, MULTI_FLAG)) {
    pickMultiTraits(item);
  } else if ([MF.powerMaster, MF.targetMaster].includes(source)) {
    megaformsContaining(item.parent).forEach(megaform => syncMasters(megaform));
  }
});
