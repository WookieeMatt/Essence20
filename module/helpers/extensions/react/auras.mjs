import { registerApplyDialog, registerChatButton, registerDialogToggles } from "../../extensions.mjs";
import { bestDefense, canAct, choose, damageButton, esc, ownerIds, rollVs, SCOPE, skillLabel, wornUpgrade } from "./core.mjs";

/**
 * Offensive-defense armor Upgrades - the attacker chooses, in their Roll Options Dialog:
 *
 * - Energized (G.I. Joe CRB, Battledress Upgrade, p.157): "Choose an Element type. Your battledress
 *   generates an aura of that element. When an enemy targets you with an Attack with range measured
 *   in Reach (not Reach x2), they must make the Attack ↓2 or let you make an immediate Attack with
 *   your element aura. Element aura attacks can be made with Might or Finesse, and deal 1 Element
 *   damage, on a successful hit."
 * - Spiked (p.156): "...they must make the attack ↓1 or let you make an immediate Attack with your
 *   battledress spikes... deal 1 Sharp Damage on a successful hit."
 * - Energy Field (Transformers CRB, Armor Upgrade, p.132): "Choose an energy type... ↓2 or let you
 *   make an immediate attack with your energy aura... deal 1 damage, plus the effect of the chosen
 *   energy type, on a successful hit."
 *
 * The strike back is a Might or Finesse Skill Test against the attacker's better of Toughness and
 * Evasion (the defender picks its Defense), with a GM Apply button for the damage. The element is
 * asked once and kept on the Upgrade.
 */

export const AURA = [
  { uuid: "Compendium.essence20.gi_joe_crb.Item.yoOIFTh1E2pVlSln", shiftDown: 2, type: null },
  { uuid: "Compendium.essence20.gi_joe_crb.Item.pRipbWx12tOzfdqD", shiftDown: 1, type: 'sharp' },
  { uuid: "Compendium.essence20.tf_crb.Item.p2ntDbJb38jpGNFO", shiftDown: 2, type: null },
];

const ELEMENTS = ['acid', 'cold', 'electric', 'fire', 'sonic'];
const T = (key, data) => (data ? game.i18n.format(`E20.${key}`, data) : game.i18n.localize(`E20.${key}`));

/** A melee attack whose range is plain Reach - not Reach x2 or more. */
export function isPlainReach(actor, item) {
  if (item?.type != 'weaponEffect' || item.system?.classification?.style != 'melee') {
    return false;
  }

  if (Number(item.system?.range?.reachMultiplier) > 1) {
    return false;
  }

  const reach = CONFIG.E20?.actorReach?.[actor?.system?.size];
  return !reach || !item.system?.totalReach || item.system.totalReach <= reach;
}

/** [{target, upgrade, aura}] for each targeted token wearing an aura Upgrade. */
export function auraTargets(actor, item) {
  if (!isPlainReach(actor, item)) {
    return [];
  }

  const out = [];
  for (const token of game.user?.targets ?? []) {
    const target = token?.actor;
    if (!target || target === actor) {
      continue;
    }

    for (const aura of AURA) {
      const upgrade = wornUpgrade(target, aura.uuid);
      if (upgrade) {
        out.push({ target, upgrade, aura });
      }
    }
  }

  return out;
}

registerDialogToggles((actor, ctx) => auraTargets(actor, ctx?.item).map((entry, index) => ({
  name: `reactAura${index}`,
  label: `${entry.upgrade.name} (${entry.target.name})`,
  type: 'select',
  options: [
    { value: 'penalty', label: T('ReactAuraPenalty', { shift: entry.aura.shiftDown }) },
    { value: 'strike', label: T('ReactAuraStrike', { name: entry.target.name }) },
  ],
})));

registerApplyDialog(async (actor, options, ctx) => {
  const entries = auraTargets(actor, ctx?.item);
  for (const [index, entry] of entries.entries()) {
    const choice = options.ext?.[`reactAura${index}`] ?? 'penalty';
    if (choice == 'penalty') {
      options.shiftDown = (Number(options.shiftDown) || 0) + entry.aura.shiftDown;
      continue;
    }

    await globalThis.ChatMessage?.create?.({
      speaker: globalThis.ChatMessage.getSpeaker?.({ actor: entry.target }),
      whisper: ownerIds(entry.target),
      content: `<p>${T('ReactAuraPrompt', { name: esc(entry.target.name), attacker: esc(actor.name), upgrade: esc(entry.upgrade.name) })}</p>
        <button type="button" data-e20-ext="reactAuraStrike" data-defender="${entry.target.uuid}" data-attacker="${actor.uuid}"
          data-upgrade="${entry.upgrade.id}">${esc(entry.upgrade.name)}</button>`,
    });
  }
});

registerChatButton('reactAuraStrike', async (message, button) => {
  const defender = await fromUuid(button.dataset.defender);
  const attacker = await fromUuid(button.dataset.attacker);
  const upgrade = defender?.items?.get?.(button.dataset.upgrade);
  if (!canAct(defender) || !attacker || !upgrade) {
    return;
  }

  const aura = AURA.find(a => a.uuid == (upgrade.flags?.core?.sourceId ?? upgrade._stats?.compendiumSource ?? upgrade?.flags?.essence20?.rulesSource));
  let type = aura?.type ?? upgrade.getFlag?.(SCOPE, 'reactElement');
  if (!type) {
    type = await choose(upgrade.name, T('ReactAuraElement'), ELEMENTS.map(e => [e, game.i18n.localize(CONFIG.E20?.damageTypes?.[e] ?? e)]));
    if (!type) {
      return;
    }

    await upgrade.setFlag?.(SCOPE, 'reactElement', type);
  }

  const skill = await choose(upgrade.name, T('ReactPickSkill'), ['might', 'finesse'].map(s => [s, skillLabel(s)]));
  if (!skill) {
    return;
  }

  button.disabled = true;
  const { success, cancelled } = await rollVs(defender, skill, bestDefense(attacker));
  if (!cancelled && success) {
    await damageButton(defender, attacker, 1, type, T('ReactAuraHit', { name: esc(defender.name), target: esc(attacker.name), upgrade: esc(upgrade.name) }));
  }
});
