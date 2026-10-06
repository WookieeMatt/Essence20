import { registerUse } from "../../mechanics/item-hooks.mjs";
import {
  TF1, T, chooseButtons, chooseSelect, damageButton, firstTarget, has, itemsOf,
  rollTest, say, sourceOf, tokenOf, tokensNear,
} from "../shared/condition-damage-buttons.mjs";

/**
 * Decepticon Directive social, utility and chassis Perks: Collection of Secrets,
 * the Traitor Hang-Up, Storage Compartments, They Called It A Glitch!,
 * Alt Mode Mimicry, the Drone Origin's copied chassis, and the Solid-State Energon hazard.
 * Tox-En, Loaded Questions, Comms Probe, False Data, Mine!, Picking Up the Trail, Feedback Field, Partnered (its
 * partner pick and the Free-action Lend Assistance) and Flexible Switch (its two picks and its Free
 * conversion) are rules on their pack items.
 */

const target = () => firstTarget()?.actor ?? null;

/* -------------------------------------------- */
/*  Alt Mode size classes                        */
/* -------------------------------------------- */

// Long and Extended sizes are the elongated forms of Large and Huge and share their Size Class.
const SIZE_CLASS = { small: 0, common: 1, large: 2, long: 2, huge: 3, extended: 3, gigantic: 4, extended2: 4, towering: 5, extended3: 5, titanic: 6 };

export function sizeClass(size) {
  return SIZE_CLASS[size] ?? 1;
}

/**
 * Alt Mode Mimicry (Decepticon Directive, Modemaster, 1st level, p.48): "Choose two chassis tied to
 * different Origins ... You cannot choose a chassis whose Alt Mode Size is two Size Classes larger
 * than the Alt Mode Size of your original chassis."
 * @param {String} originalSize
 * @param {String} candidateSize
 */
export function mimicrySizeOk(originalSize, candidateSize) {
  return sizeClass(candidateSize) - sizeClass(originalSize) < 2;
}

async function originIndex() {
  const { getVisibleItemPacks } = await import("../../util/compendium-browser.mjs");
  const origins = [];
  const altModes = new Map();
  for (const pack of getVisibleItemPacks()) {
    const index = await pack.getIndex({ fields: ['type', 'system.items', 'system.altModesize', 'system.botModeSize', 'system.baseGroundMovement', 'system.baseAerialMovement', 'system.baseAquaticMovement'] });
    for (const entry of index.values()) {
      if (entry.type == 'origin') {
        origins.push(entry);
      } else if (entry.type == 'altMode') {
        altModes.set(entry.uuid, entry);
      }
    }
  }

  return { origins, altModes };
}

const altModeUuidsOf = origin => Object.values(origin?.system?.items ?? {}).filter(e => e?.type == 'altMode').map(e => e.uuid);

function originalAltMode(actor) {
  const modes = itemsOf(actor).filter(i => i.type == 'altMode' && !i.flags?.essence20?.tf1Mimicry);
  return modes.find(i => i.flags?.essence20?.parentId) ?? modes[0] ?? null;
}

/* -------------------------------------------- */
/*  Use buttons                                  */
/* -------------------------------------------- */

const GLITCH_FLAG = 'tf1Glitch';

export const SUPPORT_USES = [
  {
    // They Called It a Glitch! (Knock Out, 20th level, p.52): "By performing 8 hours of modification
    // work on a willing ally and succeeding at a DIF 20 Technology (Engineering) Skill Test, you reduce
    // the target's maximum Health by 2 and grant them a General Perk they meet the prerequisites for.
    // This modification is permanent, unless you reverse it with another 8 hours of cybersurgery (this
    // requires no Skill Test) ... you can't perform it on them if it would reduce their maximum Health
    // to 1 or lower."
    id: 'tf1Glitch', matches: item => sourceOf(item) == TF1.theyCalledItAGlitch,
    canUse: () => !game?.combat,
    async run(item) {
      const actor = item.parent;
      const ally = target();
      if (!ally || ally.id == actor.id) {
        ui.notifications.warn(T('Tf1PickAlly'));
        return null;
      }

      if (!ally.isOwner) {
        ui.notifications.warn(T('Tf1GmApplies'));
        return null;
      }

      const done = (ally.effects?.contents ?? [...(ally.effects ?? [])]).filter(e => e.flags?.essence20?.[GLITCH_FLAG]);
      const choice = done.length
        ? await chooseButtons(item.name, T('Tf1GlitchPrompt', { ally: ally.name }), [['operate', T('Tf1GlitchOperate')], ['reverse', T('Tf1GlitchReverse')]])
        : 'operate';
      if (choice == 'reverse') {
        const pick = done.length > 1 ? await chooseSelect(item.name, T('Tf1GlitchPickReverse'), done.map(e => ({ value: e.id, label: e.name }))) : done[0].id;
        const effect = done.find(e => e.id == pick);
        if (!effect) {
          return null;
        }

        const perkId = effect.flags.essence20[GLITCH_FLAG].itemId;
        await ally.deleteEmbeddedDocuments('ActiveEffect', [effect.id]);
        if (perkId && ally.items?.get?.(perkId)) {
          await ally.deleteEmbeddedDocuments('Item', [perkId]);
        }

        return T('Tf1GlitchReversed', { name: actor.name, ally: ally.name });
      }

      if (choice != 'operate') {
        return null;
      }

      const max = Number(ally.system?.health?.max) || 0;
      if (max - 2 <= 1) {
        ui.notifications.warn(T('Tf1GlitchTooFrail', { ally: ally.name }));
        return null;
      }

      const { findCompendiumItems, pickCompendiumItem } = await import("../../util/compendium-item-picker.mjs");
      const rows = await findCompendiumItems({ type: 'perk', fields: ['system.type'], matches: e => e.system?.type == 'general' });
      const uuid = await pickCompendiumItem(rows, { title: item.name, label: 'E20.Tf1GlitchPickPerk' });
      if (!uuid) {
        return null;
      }

      const { success } = await rollTest(actor, 'technology', 20);
      if (!success) {
        return T('Tf1GlitchFailed', { name: actor.name, ally: ally.name });
      }

      const { grantCopy } = await import("../../mechanics/resources/grants.mjs");
      const perk = await grantCopy(ally, uuid, { grantedBy: item, flags: { tf1GlitchPerk: true } });
      await ally.createEmbeddedDocuments('ActiveEffect', [{
        name: `${item.name}: ${perk?.name ?? ''}`, img: item.img,
        changes: [{ key: 'system.health.bonus', mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: '-2' }],
        flags: { essence20: { [GLITCH_FLAG]: { itemId: perk?.id ?? null, by: actor.uuid } } },
      }]);
      return T('Tf1GlitchDone', { name: actor.name, ally: ally.name, perk: perk?.name ?? '' });
    },
  },
  {
    // Alt Mode Mimicry: "You gain two additional Alt Modes. Choose two chassis tied to different
    // Origins." Alt Mode Mastery (10th level, p.48): "selecting a fourth and a fifth Alt Mode. This
    // follows all the same rules and limitations".
    id: 'tf1Mimicry', matches: item => sourceOf(item) == TF1.altModeMimicry,
    canUse: item => mimicryLeft(item.parent) > 0,
    async run(item) {
      const actor = item.parent;
      const original = originalAltMode(actor);
      if (!original) {
        ui.notifications.warn(T('Tf1NoOriginalAltMode'));
        return null;
      }

      const { origins, altModes } = await originIndex();
      const originOf = uuid => origins.find(o => altModeUuidsOf(o).includes(uuid));
      const taken = [original, ...itemsOf(actor).filter(i => i.flags?.essence20?.tf1Mimicry)]
        .map(i => originOf(sourceOf(i))?.uuid).filter(Boolean);
      const rows = [...altModes.values()]
        .filter(entry => {
          const origin = originOf(entry.uuid);
          return origin && !taken.includes(origin.uuid) && mimicrySizeOk(original.system?.altModesize, entry.system?.altModesize);
        })
        .map(entry => ({ value: entry.uuid, label: `${entry.name} (${originOf(entry.uuid).name})` }))
        .sort((a, b) => a.label.localeCompare(b.label));
      const uuid = await chooseSelect(item.name, T('Tf1PickChassis'), rows);
      if (!uuid) {
        return null;
      }

      const { grantCopy } = await import("../../mechanics/resources/grants.mjs");
      const created = await grantCopy(actor, uuid, { grantedBy: item, flags: { tf1Mimicry: true } });
      if (created) {
        await actor.update({ 'system.canTransform': true });
      }

      return T('Tf1MimicryGained', { name: actor.name, mode: created?.name ?? '' });
    },
  },
  {
    // Drone (Decepticon Directive, Origin, p.33): "Choose another Origin; all your Bot and Alt Mode
    // statistics are based upon that copied Origin." Bot Mode Movement and Size, and the Alt Mode, come
    // from the copied Origin.
    id: 'tf1Drone', matches: item => sourceOf(item) == TF1.drone,
    canUse: item => !item.flags?.essence20?.copiedOrigin,
    async run(item) {
      const actor = item.parent;
      const { origins, altModes } = await originIndex();
      const rows = origins.filter(o => o.uuid != TF1.drone && altModeUuidsOf(o).length)
        .map(o => ({ value: o.uuid, label: o.name })).sort((a, b) => a.label.localeCompare(b.label));
      const originUuid = await chooseSelect(item.name, T('Tf1PickCopiedOrigin'), rows);
      const origin = origins.find(o => o.uuid == originUuid);
      if (!origin) {
        return null;
      }

      const modes = altModeUuidsOf(origin);
      const modeUuid = modes.length > 1
        ? await chooseSelect(item.name, T('Tf1PickChassis'), modes.map(u => ({ value: u, label: altModes.get(u)?.name ?? u })))
        : modes[0];
      if (!modeUuid) {
        return null;
      }

      const { grantCopy } = await import("../../mechanics/resources/grants.mjs");
      const created = await grantCopy(actor, modeUuid, { flags: { parentId: item.id } });
      const botSize = created?.system?.botModeSize;
      await actor.update({
        'system.canTransform': true,
        'system.movement.ground.base': Number(origin.system?.baseGroundMovement) || 0,
        'system.movement.aerial.base': Number(origin.system?.baseAerialMovement) || 0,
        'system.movement.swim.base': Number(origin.system?.baseAquaticMovement) || 0,
        ...(botSize ? { 'system.size': botSize } : {}),
      });
      await item.setFlag('essence20', 'copiedOrigin', origin.uuid);
      return T('Tf1DroneCopied', { name: actor.name, origin: origin.name, mode: created?.name ?? '' });
    },
  },
  {
    // Solid-State Energon (Decepticon Directive p.79): "Should it suffer damage of any type aside from
    // Cold ... Roll 1d2 and add the damage the crystals suffer. If the result is equal to or higher than
    // the number of Energon Points stored within the crystal, it explodes, inflicting 1 Energy damage
    // to everyone within a radius equal to 10ft times the number of Energon Points within the crystal. A
    // character who succeeds at a DIF 14 Science (Mineralogy) Skill Test as a Standard action can break
    // down a single solid-state Energon crystal into a useable liquid form".
    id: 'tf1SolidEnergon', matches: item => sourceOf(item) == TF1.solidStateEnergon,
    canUse: item => (Number(item.system?.quantity) || 0) > 0,
    async run(item, economy, pay) {
      const actor = item.parent;
      const choice = await chooseButtons(item.name, T('Tf1CrystalPrompt'), [['damaged', T('Tf1CrystalDamaged')], ['refine', T('Tf1CrystalRefine')]]);
      if (!choice) {
        return null;
      }

      const stored = Number(item.flags?.essence20?.tf1Points) || 0;
      const answer = await foundry.applications.api.DialogV2.wait({
        window: { title: item.name },
        classes: ["window-app", "e20-window"],
        content: `<div class="form-group"><label>${T('Tf1CrystalPoints')}</label><input type="number" name="points" min="1" value="${stored || 1}" /></div>${
          choice == 'damaged' ? `<div class="form-group"><label>${T('Tf1CrystalDamage')}</label><input type="number" name="damage" min="0" value="1" /></div>` : ''}`,
        buttons: [
          { action: 'ok', label: T('DialogConfirmButton'), default: true, callback: (event, button) => ({
            points: Math.max(1, Number(button.form.elements.points.value) || 1), damage: Math.max(0, Number(button.form.elements.damage?.value) || 0),
          }) },
          { action: 'cancel', label: T('DialogCancelButton') },
        ],
        rejectClose: false,
      });
      if (!answer || answer == 'cancel') {
        return null;
      }

      await item.setFlag('essence20', 'tf1Points', answer.points);
      const useOne = () => item.update({ 'system.quantity': Math.max(0, (Number(item.system?.quantity) || 1) - 1) });
      if (choice == 'refine') {
        if (!(await pay('standard'))) {
          return null;
        }

        const { success } = await rollTest(actor, 'science', 14);
        if (success) {
          await useOne();
        }

        return T(success ? 'Tf1CrystalRefined' : 'Tf1CrystalRefineFailed', { name: actor.name, points: answer.points });
      }

      const roll = await new Roll(`1d2 + ${answer.damage}`).evaluate();
      if (roll.total < answer.points) {
        return T('Tf1CrystalHolds', { total: roll.total, points: answer.points });
      }

      await useOne();
      const own = tokenOf(actor);
      const caught = own ? [own, ...tokensNear(own, 10 * answer.points)] : [];
      const buttons = caught.map(t => damageButton(t.actor, 1, 'element'));
      await say(actor, `${T('Tf1CrystalExplodes', { total: roll.total, points: answer.points, radius: 10 * answer.points })}${buttons.length ? `<br>${buttons.join('<br>')}` : ''}`);
      return null;
    },
  },
];

function mimicryLeft(actor) {
  const allowed = 2 + (has(actor, 'Compendium.essence20.decepticon_directive.Item.pVpAdlWmS3psTgIp') ? 2 : 0);
  return allowed - itemsOf(actor).filter(i => i.flags?.essence20?.tf1Mimicry).length;
}

/* -------------------------------------------- */
/*  Registration                                 */
/* -------------------------------------------- */

SUPPORT_USES.forEach(registerUse);
