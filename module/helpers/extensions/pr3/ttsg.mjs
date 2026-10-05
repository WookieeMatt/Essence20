import {
  registerAfterDamage, registerApplyDialog, registerChatButton, registerDialogToggles, registerHitRider, registerPostRoll,
  registerRollSources, registerSceneAdvanced, registerUse,
} from "../../extensions.mjs";
import { worldActors } from "../../companion-link.mjs";
import { epochFor, getUses, markUsed } from "../../scene-clock.mjs";
import {
  IDS, T, applyStatus, escapeHtml, giveEdge, holding, isItem, isThisTurn, itemsOf, postLine, spendPower,
  turnStamp, writeActor,
} from "./common.mjs";

/**
 * Through the Shattered Grid pieces of the pr3 slice. Each rule is quoted above its code.
 */

const isAttackEffect = item => item?.type == 'weaponEffect';

/* -------------------------------------------- */
/*  Elemental Fury (Zord Feature)                */
/* -------------------------------------------- */

// Elemental Fury (TtSG, Zord Feature, p.33): "Once per scene, this Zord can unleash a powerful
// elemental ranged Attack... choose among air, earth, fire, lightning, and water. The Attack deals
// two times the normal level of damage as this Zord's strongest ranged Attack, uses its Range, and
// has the following additional characteristics according to the selected element". The Use button
// builds that Attack on the Zord for one roll (the element is picked the first time and kept on the
// Feature); it goes away once rolled, or when the scene ends.
export const FURY = {
  air: { damageType: 'sonic', status: 'impaired' },
  earth: { damageType: 'blunt', status: 'prone' },
  fire: { damageType: 'fire', bonus: 2 },
  lightning: { damageType: 'electric', status: 'stunned' },
  water: { damageType: 'cold', status: 'immobilized' },
};
const FURY_FLAG = 'pr3ElementalFury';
const FURY_USES = 'pr3ElementalFuryUses';

/** The Zord's strongest ranged Attack (the Fury's own excluded). */
export function strongestRanged(zord) {
  const ranged = itemsOf(zord).filter(item => isAttackEffect(item) && item.system?.classification?.style
    && item.system.classification.style != 'melee' && !item.flags?.essence20?.[FURY_FLAG]
    && !zord.items?.get?.(item.flags?.essence20?.parentId)?.flags?.essence20?.[FURY_FLAG]);
  return ranged.sort((a, b) => (Number(b.system?.damageValue) || 0) - (Number(a.system?.damageValue) || 0))[0] ?? null;
}

registerUse({
  id: 'pr3ElementalFury',
  matches: item => isItem(item, IDS.elementalFury),
  canUse: item => getUses(item.parent, FURY_USES, 'scene') < 1,
  run: async (item) => {
    const zord = item.parent;
    let element = item.flags?.essence20?.pr3Element;
    if (!FURY[element]) {
      const { chooseButtons } = await import("../../grants.mjs");
      element = await chooseButtons(item.name, T('Pr3FuryElementPrompt'), Object.keys(FURY).map(key => [key, T(`Pr3FuryElement.${key}`)]));
      if (!FURY[element]) {
        return null;
      }

      await item.setFlag('essence20', 'pr3Element', element);
    }

    const base = strongestRanged(zord);
    if (!base) {
      ui.notifications.warn(T('Pr3FuryNoRanged', { name: zord.name }));
      return null;
    }

    const name = `${item.name} (${T(`Pr3FuryElement.${element}`)})`;
    const [weapon] = await zord.createEmbeddedDocuments('Item', [{ name, type: 'weapon', flags: { essence20: { [FURY_FLAG]: element } }, system: {} }]);
    await zord.createEmbeddedDocuments('Item', [{
      name,
      type: 'weaponEffect',
      flags: { essence20: { parentId: weapon.id, [FURY_FLAG]: element } },
      system: {
        classification: foundry.utils.deepClone(base.system.classification),
        damageType: FURY[element].damageType,
        damageValue: 2 * (Number(base.system.damageValue) || 0),
        defenseType: base.system.defenseType ?? 'toughness',
        range: foundry.utils.deepClone(base.system.range),
      },
    }]);
    await markUsed(zord, FURY_USES, { window: 'scene' });
    return T('Pr3FuryReady', { name: escapeHtml(zord.name), attack: escapeHtml(name) });
  },
});

function furyWeapon(actor, rider) {
  const weapon = rider?.weaponId ? actor?.items?.get?.(rider.weaponId) : null;
  return weapon?.flags?.essence20?.[FURY_FLAG] ? weapon : null;
}

async function removeFury(actor) {
  const doomed = itemsOf(actor).filter(item => item.flags?.essence20?.[FURY_FLAG]).map(item => item.id);
  if (doomed.length) {
    await actor.deleteEmbeddedDocuments('Item', doomed);
  }
}

// Critical riders: Air Impaired, Earth Prone, Lightning Stunned, Water Immobilized ("until the end
// of their next turn" - one round), Fire "+2 damage".
registerHitRider(async (actor, target, result, rider, tools) => {
  const weapon = furyWeapon(actor, rider);
  const spec = FURY[weapon?.flags?.essence20?.[FURY_FLAG]];
  if (!spec || !tools?.isCrit) {
    return;
  }

  if (spec.bonus) {
    tools.damageBonusNote(result, spec.bonus, weapon.name);
  } else {
    await applyStatus(target, spec.status, spec.status == 'prone' ? null : 1);
  }
});

registerPostRoll(async (actor, results, checkContext, { rider } = {}) => {
  if (furyWeapon(actor, rider)) {
    await removeFury(actor);
  }
});

registerSceneAdvanced(async () => {
  if (!game.user?.isGM) {
    return;
  }

  for (const actor of worldActors()) {
    if (itemsOf(actor).some(item => item.flags?.essence20?.[FURY_FLAG])) {
      await removeFury(actor);
    }
  }
});

/* -------------------------------------------- */
/*  Overload (Zord Feature)                      */
/* -------------------------------------------- */

// Overload (TtSG, Zord Feature, p.34): "As a Free action at the beginning of the Zord pilot's turn,
// they can have the Zord lose 1d2 Health (this is a cost to activate this Zord Feature rather than
// damage) to give an Edge to all the Attacks it performs on that turn."
const OVERLOAD_FLAG = 'pr3Overload';

registerUse({
  id: 'pr3Overload',
  matches: item => isItem(item, IDS.overload),
  canUse: item => !!game.combat && !isThisTurn(item.parent?.flags?.essence20?.[OVERLOAD_FLAG]),
  run: async (item, economy, pay) => {
    const zord = item.parent;
    if (!(await pay('free'))) {
      return null;
    }

    const roll = await new Roll('1d2').evaluate();
    const health = Number(zord.system?.health?.value) || 0;
    await zord.update({ 'system.health.value': Math.max(0, health - roll.total), [`flags.essence20.${OVERLOAD_FLAG}`]: turnStamp() });
    return T('Pr3OverloadOn', { name: escapeHtml(zord.name), lost: roll.total });
  },
});

registerRollSources((actor, target, ctx) => {
  if (ctx?.isAttack && holding(actor, IDS.overload) && isThisTurn(actor.flags?.essence20?.[OVERLOAD_FLAG])) {
    return { sources: [{ id: 'pr3Overload', label: holding(actor, IDS.overload).name, edge: true }] };
  }

  return {};
});

/* -------------------------------------------- */
/*  Power Construct (Zord Feature)               */
/* -------------------------------------------- */

// Power Construct (TtSG, Zord Feature, p.34): "When the Zord suffers damage from a melee Attack
// targeting its Toughness Defense, the attacker receives 1 Energy damage. The Zord's melee Attacks
// gain 'Alternate Effect: 2 Energy damage.' When the Zord reaches 0 Health, it disappears into the
// Morphin Grid as if it had been recalled with the Recall for Repairs Zord Feature." Energy damage
// is this system's Element type. The retaliation reads the attack card the GM just applied
// (helpers/extensions/react/core.mjs#lastApplyContext) and posts the usual GM damage button.
registerHitRider((actor, target, result, rider, tools) => {
  if (rider?.style == 'melee' && holding(actor, IDS.powerConstruct)) {
    tools.addRiderOption(result, { key: 'pr3PowerConstruct', label: holding(actor, IDS.powerConstruct).name, damageValue: 2, damageType: 'element' });
  }
});

registerAfterDamage(async (actor, dealt, damageType, ctx = {}) => {
  const feature = holding(actor, IDS.powerConstruct);
  if (!feature || !(dealt > 0)) {
    return;
  }

  const { damageButton, lastApplyContext } = await import("../react/core.mjs");
  const applied = lastApplyContext();
  if (applied?.isMelee && applied.targetUuid == actor.uuid && applied.attackerUuid) {
    const attacker = await fromUuid(applied.attackerUuid);
    if (attacker) {
      await damageButton(actor, attacker, 1, 'element', T('Pr3ConstructRetaliate', { name: escapeHtml(feature.name), attacker: escapeHtml(attacker.name) }));
    }
  }

  if (Number(ctx.newValue) <= 0 && Number(ctx.previousValue) > 0) {
    await postLine(actor, T('Pr3ConstructVanish', { name: escapeHtml(actor.name) }));
  }
});

/* -------------------------------------------- */
/*  Restraining Gear (Zord Feature)              */
/* -------------------------------------------- */

// Restraining Gear (TtSG, Zord Feature, p.118): "When dealing damage with a melee attack you can
// spend one Personal Power and make an opposed Brawn or Might Skill Test against the target. If
// successful, the enemy is also restrained by the attack. This feature can be used as part of a
// Megaform." Each melee hit gets a chat button; the Power comes from the pilot (or the Zord's own
// reserve when nobody is driving).
async function hasRestrainingGear(actor) {
  if (holding(actor, IDS.restrainingGear)) {
    return true;
  }

  if (actor?.type != 'megaform') {
    return false;
  }

  const { getMegaformParticipants } = await import("../../megaform-participants.mjs");
  return (getMegaformParticipants(actor) ?? []).some(part => holding(part, IDS.restrainingGear));
}

registerPostRoll(async (actor, results, checkContext, { hits = [], rider } = {}) => {
  if (rider?.style != 'melee' || !hits.some(h => h.hit) || !(await hasRestrainingGear(actor))) {
    return;
  }

  for (const { target, hit } of hits) {
    if (hit && target) {
      await postLine(actor, `<p>${T('Pr3RestrainOffer', { name: escapeHtml(actor.name), target: escapeHtml(target.name) })}</p>
        <button type="button" data-e20-ext="pr3Restrain" data-actor-uuid="${escapeHtml(actor.uuid)}" data-target-uuid="${escapeHtml(target.uuid)}">${T('Pr3RestrainButton')}</button>`);
    }
  }
});

/** "+d6" style shift to a formula: the d20 plus the Skill Die (untrained is the d20 alone). */
export function opposedFormula(shift) {
  const match = /^(\d*)d(\d+)$/.exec(String(shift ?? ''));
  return !match || shift == 'd20' ? '1d20' : `1d20 + ${match[1] || 1}d${match[2]}`;
}

function bestStrengthShift(actor) {
  const order = globalThis.CONFIG?.E20?.skillShiftList ?? [];
  const shifts = ['brawn', 'might'].map(skill => actor?.system?.skills?.[skill]?.shift ?? 'd20');
  return order.length ? shifts.sort((a, b) => order.indexOf(a) - order.indexOf(b))[0] : shifts[0];
}

registerChatButton('pr3Restrain', async (message, button) => {
  const actor = await fromUuid(button.dataset.actorUuid);
  const target = await fromUuid(button.dataset.targetUuid);
  if (!actor || !target) {
    return;
  }

  const { getVehicleDriver } = await import("../../combat.mjs");
  const payer = (actor.type == 'zord' ? getVehicleDriver(actor) : null) ?? actor;
  if (!(await spendPower(payer, 1))) {
    return;
  }

  button.disabled = true;
  const mine = await new Roll(opposedFormula(bestStrengthShift(actor))).evaluate();
  const theirs = await new Roll(opposedFormula(bestStrengthShift(target))).evaluate();
  const success = mine.total > theirs.total;
  if (success) {
    await applyStatus(target, 'restrained');
  }

  await postLine(actor, T(success ? 'Pr3RestrainWon' : 'Pr3RestrainLost', {
    name: escapeHtml(actor.name), target: escapeHtml(target.name), mine: mine.total, theirs: theirs.total,
  }));
});

/* -------------------------------------------- */
/*  Zord Mount (Zord Feature)                    */
/* -------------------------------------------- */

// Zord Mount (TtSG, Zord Feature, p.35): "When the Zord mount makes a melee Attack for the first
// time in its turn, the rider Zord can immediately also make a melee Attack against that same
// target." The Use button names the Zord riding it; the mount's first melee Attack each turn then
// announces the rider's free follow-up (the mounted-combat movement rules are the table's).
const RIDER_FLAG = 'pr3MountRider';
const MOUNT_TURN_FLAG = 'pr3MountAttacked';

registerUse({
  id: 'pr3ZordMount',
  matches: item => isItem(item, IDS.zordMount),
  run: async (item) => {
    const mount = item.parent;
    const { chooseSelect } = await import("../../grants.mjs");
    const options = [{ value: '-', label: T('Pr3MountNobody') },
      ...worldActors().filter(a => a.type == 'zord' && a.uuid != mount.uuid).map(a => ({ value: a.uuid, label: a.name }))];
    const uuid = await chooseSelect(item.name, T('Pr3MountPrompt'), options);
    if (!uuid) {
      return null;
    }

    await item.setFlag('essence20', RIDER_FLAG, uuid == '-' ? null : uuid);
    const rider = options.find(o => o.value == uuid);
    return uuid == '-' ? T('Pr3MountCleared', { name: escapeHtml(mount.name) })
      : T('Pr3MountSet', { name: escapeHtml(mount.name), rider: escapeHtml(rider?.label) });
  },
});

registerPostRoll(async (actor, results, checkContext, { hits = [], rider } = {}) => {
  const feature = holding(actor, IDS.zordMount);
  const riderUuid = feature?.flags?.essence20?.[RIDER_FLAG];
  if (!riderUuid || rider?.style != 'melee' || !hits.length || isThisTurn(actor.flags?.essence20?.[MOUNT_TURN_FLAG])) {
    return;
  }

  if (game.combat) {
    await actor.setFlag('essence20', MOUNT_TURN_FLAG, turnStamp());
  }

  const riderZord = await fromUuid(riderUuid);
  const target = hits[0]?.target;
  if (riderZord && target) {
    await postLine(actor, T('Pr3MountFollowUp', { rider: escapeHtml(riderZord.name), target: escapeHtml(target.name) }));
  }
});

/* -------------------------------------------- */
/*  Emissary's Gift                              */
/* -------------------------------------------- */

// Emissary's Gift (TtSG, General Perk, p.73): "select a Role Perk from any of the Core Ranger
// Spectrum Roles at any Level equal to or lower than your current Level; you now possess this Role
// Perk... You cannot choose the following: Extra Attack, General Perk, Grid Power, Zord, Zord
// Feature." The picker lists the PR CRB Roles' Role Perks at or below your level.
export const EMISSARY_EXCLUDED = ['Extra Attack', 'General Perk', 'Grid Power', 'Zord', 'Zord Feature'];

export function emissaryOptions(roles, level) {
  const seen = new Set();
  const options = [];
  for (const role of roles) {
    for (const entry of Object.values(role.system?.items ?? {})) {
      if (entry?.type != 'perk' || entry.subtype != 'role' || !entry.uuid || seen.has(entry.uuid)
        || Number(entry.level) > level || EMISSARY_EXCLUDED.includes(entry.name)) {
        continue;
      }

      seen.add(entry.uuid);
      options.push({ value: entry.uuid, label: `${role.name}: ${entry.name} (${entry.level})` });
    }
  }

  return options.sort((a, b) => a.label.localeCompare(b.label));
}

registerUse({
  id: 'pr3EmissarysGift',
  matches: item => isItem(item, IDS.emissarysGift),
  canUse: item => !item.flags?.essence20?.pr3Granted,
  run: async (item) => {
    const actor = item.parent;
    const pack = game.packs?.get('essence20.pr_crb');
    const index = pack ? await pack.getIndex({ fields: ['type', 'system.items'] }) : [];
    const roles = [...index.values?.() ?? index].filter(entry => entry.type == 'role');
    const { chooseSelect } = await import("../../grants.mjs");
    const uuid = await chooseSelect(item.name, T('Pr3EmissaryPrompt'), emissaryOptions(roles, Number(actor.system?.level) || 1));
    if (!uuid) {
      return null;
    }

    const { grantPerkOutright } = await import("../../../sheet-handlers/perk-handler.mjs");
    await grantPerkOutright(actor, uuid);
    const created = itemsOf(actor).find(i => isItem(i, uuid));
    await created?.setFlag?.('essence20', 'grantedBy', item.id);
    await item.setFlag('essence20', 'pr3Granted', created?.id ?? true);
    return T('Pr3GrantedItem', { name: escapeHtml(actor.name), item: escapeHtml(created?.name ?? ''), source: escapeHtml(item.name) });
  },
});

/* -------------------------------------------- */
/*  Morphin Navigator (gear)                     */
/* -------------------------------------------- */

// Morphin Navigator (TtSG, p.116): "Once per session, a character wielding one can spend a
// Standard action to activate a Grid Power Bloom... that generates 1d2 Personal Power for each team
// member... While in the Grid, the Morphin Navigator grants an Edge to all Skill Tests to navigate
// the Grid". A session is the mission window; the team is the Party roster (or just you). The Edge
// is a dialog tick while you carry one.
const NAVIGATOR_USES = 'pr3Navigator';

registerUse({
  id: 'pr3Navigator',
  matches: item => isItem(item, IDS.navigator),
  canUse: item => getUses(item.parent, NAVIGATOR_USES, 'mission') < 1,
  run: async (item, economy, pay) => {
    const actor = item.parent;
    if (!(await pay('standard'))) {
      return null;
    }

    const { teamOf } = await import("../resource/common.mjs");
    const { gridPowerBloomResults } = await import("../../story-points.mjs");
    const members = teamOf(actor).filter(member => Number(member.system?.powers?.personal?.max) > 0);
    const rolls = [];
    for (let i = 0; i < members.length; i++) {
      rolls.push((await new Roll('1d2').evaluate()).total);
    }

    const lines = [];
    for (const { member, value, gained } of gridPowerBloomResults(members, rolls)) {
      await writeActor(member, 'update', [{ 'system.powers.personal.value': value }]);
      lines.push(`<li>${escapeHtml(member.name)}: +${gained}</li>`);
    }

    await markUsed(actor, NAVIGATOR_USES, { window: 'mission' });
    return `${T('Pr3NavigatorBloom', { name: escapeHtml(actor.name) })}<ul>${lines.join('')}</ul>`;
  },
});

/* -------------------------------------------- */
/*  Protector of Safehaven                       */
/* -------------------------------------------- */

// Protector of Safehaven (TtSG, General Perk, p.115): "Once per story in Safehaven, you may choose
// one of the following effects... Gain a weapon from Eternity Point's armory (one Limited weapon).
// Gain an Edge on your weapon upgrade attempts while in Safehaven. Gain 1 Temporary Health. Gain ↑1
// on Social Skill Tests with Safehaven residents. While in Safehaven, you are treated as having a +11
// Wealth Bonus." A story is the mission window; being in Safehaven is the player's call.
const SAFEHAVEN_USES = 'pr3Safehaven';
const SAFEHAVEN_BOON = 'pr3SafehavenBoon';
export const SAFEHAVEN_CHOICES = ['weapon', 'upgrade', 'health', 'social', 'wealth'];

export function safehavenBoon(actor) {
  const perk = holding(actor, IDS.safehaven);
  const boon = perk?.flags?.essence20?.[SAFEHAVEN_BOON];
  return boon && boon.epoch == epochFor('mission') ? boon.kind : null;
}

registerUse({
  id: 'pr3Safehaven',
  matches: item => isItem(item, IDS.safehaven),
  canUse: item => getUses(item.parent, SAFEHAVEN_USES, 'mission') < 1,
  run: async (item) => {
    const actor = item.parent;
    const { chooseButtons, pickAndGrant } = await import("../../grants.mjs");
    const kind = await chooseButtons(item.name, T('Pr3SafehavenPrompt'), SAFEHAVEN_CHOICES.map(key => [key, T(`Pr3Safehaven.${key}`)]));
    if (!SAFEHAVEN_CHOICES.includes(kind)) {
      return null;
    }

    if (kind == 'weapon' && !(await pickAndGrant(actor, item, item.name, { type: 'weapon', availabilities: ['limited'] }))) {
      return null;
    }

    if (kind == 'health') {
      const { grantTemp } = await import("../resource/temp-resources.mjs");
      await grantTemp(actor, { kind: 'health', amount: 1, source: 'pr3Safehaven' });
    }

    await item.setFlag('essence20', SAFEHAVEN_BOON, { kind, epoch: epochFor('mission') });
    await markUsed(actor, SAFEHAVEN_USES, { window: 'mission' });
    return T('Pr3SafehavenChosen', { name: escapeHtml(actor.name), boon: T(`Pr3Safehaven.${kind}`) });
  },
});

/* -------------------------------------------- */
/*  Dialog ticks                                 */
/* -------------------------------------------- */

registerDialogToggles((actor, ctx) => {
  const toggles = [];
  const boon = safehavenBoon(actor);
  if (boon == 'upgrade' && ctx?.rolledSkill == 'technology') {
    toggles.push({ name: 'pr3SafehavenUpgrade', type: 'checkbox', label: T('Pr3SafehavenUpgradeToggle') });
  }

  if (boon == 'social' && ctx?.rolledEssence == 'social') {
    toggles.push({ name: 'pr3SafehavenSocial', type: 'checkbox', label: T('Pr3SafehavenSocialToggle') });
  }

  return toggles;
});

registerApplyDialog((actor, options) => {
  const ext = options.ext ?? {};
  if (ext.pr3SafehavenUpgrade) {
    giveEdge(options);
  }

  if (ext.pr3SafehavenSocial) {
    options.shiftUp = (Number(options.shiftUp) || 0) + 1;
  }
});

