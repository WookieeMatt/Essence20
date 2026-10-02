import {
  registerApplyDialog, registerCostRule, registerDialogToggles, registerPostRoll, registerRollSources, registerUse,
} from "../../extensions.mjs";
import { getNearbyAllyTokens } from "../../allies.mjs";
import { activateForWindow, getSceneEpoch, isActiveForWindow } from "../../scene-clock.mjs";
import {
  TF1, T, applyCondition, chooseButtons, chooseSelect, damageButton, firstTarget, has, itemOf, itemsOf, nameOf,
  rollTest, safe, say, sourceOf, spendEnergon, tokenOf, tokensNear,
} from "./common.mjs";

/**
 * Decepticon Directive social, utility and chassis Perks: Collection of Secrets, Loaded Questions,
 * the Traitor Hang-Up, Storage Compartments, the Infiltrator Analyst's Comms Probe / Feedback Field /
 * False Data / Eidetic Buffer, Mine!, Picking Up the Trail, They Called It A Glitch!, Partnered,
 * Flexible Switch, Alt Mode Mimicry, the Drone Origin's copied chassis, and the Tox-En and
 * Solid-State Energon hazards.
 */

const essenceOf = skill => CONFIG.E20?.skillToEssence?.[skill];
const target = () => firstTarget()?.actor ?? null;

/* -------------------------------------------- */
/*  Roll sources                                 */
/* -------------------------------------------- */

const LOADED_FLAG = 'tf1LoadedQuestions';

function loadedCount(actor, targetUuid) {
  const record = actor?.flags?.essence20?.[LOADED_FLAG];
  return record && record.scene == safe(getSceneEpoch) ? Number(record.counts?.[targetUuid]) || 0 : 0;
}

export function tf1SupportSources(actor, rollTarget, { rolledSkill } = {}) {
  const sources = [];
  // Loaded Questions (Decepticon Directive, Inquisitor, 1st level, p.41): "If you target the same
  // creature with your Deception and/or Persuasion Skill Tests in a single scene, you gain a cumulative
  // ↑1 with each Skill Test."
  if (['deception', 'persuasion'].includes(rolledSkill) && rollTarget?.uuid && has(actor, TF1.loadedQuestions)) {
    const count = loadedCount(actor, rollTarget.uuid);
    if (count) {
      sources.push({ id: 'loadedQuestions', label: nameOf(actor, TF1.loadedQuestions, 'Loaded Questions'), shiftUp: count });
    }
  }

  return { sources, consumes: [] };
}

export async function tf1SupportPostRoll(actor, results, checkContext, { hits = [], rider = {} } = {}) {
  if (['deception', 'persuasion'].includes(rider.skill) && has(actor, TF1.loadedQuestions)) {
    const targets = [...new Set(hits.map(h => h.target?.uuid).filter(Boolean))];
    if (targets.length) {
      const scene = safe(getSceneEpoch);
      const record = actor.flags?.essence20?.[LOADED_FLAG];
      const counts = record?.scene == scene ? { ...(record.counts ?? {}) } : {};
      for (const uuid of targets) {
        counts[uuid] = (Number(counts[uuid]) || 0) + 1;
      }

      await actor.setFlag('essence20', LOADED_FLAG, { scene, counts });
    }
  }
}

/* -------------------------------------------- */
/*  Dialog choices                               */
/* -------------------------------------------- */

export function tf1SupportToggles(actor, { rolledSkill } = {}) {
  const toggles = [];
  const essence = essenceOf(rolledSkill);
  const add = (name, label) => toggles.push({ name, label, type: 'checkbox' });

  // Collection of Secrets (Inquisitor, 20th level, p.41): "when you spend a Story Point to receive a
  // clue, you gain Edge on all Smarts- and Social-based Skill Tests to act on that information. This
  // bonus lasts until the end of the session."
  if (['smarts', 'social'].includes(essence) && isActiveForWindow(actor, 'tf1Secrets', 'mission')) {
    add('tf1Secrets', T('Tf1ToggleSecrets', { perk: nameOf(actor, TF1.collectionOfSecrets, 'Collection of Secrets') }));
  }

  // Storage Compartments (Raider, 1st level, p.61): "Anyone searching you for an object hidden in a
  // compartment suffers Snag on their Skill Test." Offered to the searcher when their target holds it.
  const searched = target();
  if (searched && searched.id != actor?.id && has(searched, TF1.storageCompartments)) {
    add('tf1Storage', T('Tf1ToggleStorage', { name: searched.name }));
  }

  return toggles;
}

export async function tf1SupportApplyDialog(actor, options) {
  const ext = options.ext ?? {};
  if (ext.tf1Secrets) {
    if (options.snag) {
      options.snag = false;
    } else {
      options.edge = true;
    }
  }

  if (ext.tf1Storage) {
    if (options.edge) {
      options.edge = false;
    } else {
      options.snag = true;
    }
  }
}

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
  const { getVisibleItemPacks } = await import("../../compendium-browser.mjs");
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
    // Collection of Secrets: the Story Point for the clue, then Edge for the session (the mission).
    id: 'tf1Secrets', matches: item => sourceOf(item) == TF1.collectionOfSecrets,
    async run(item) {
      const actor = item.parent;
      const { canSpendForActor, spendForActor } = await import("../../story-points.mjs");
      if (!canSpendForActor(actor, 1)) {
        ui.notifications.warn(T('Tf1NoStoryPoint'));
        return null;
      }

      await spendForActor(actor, 1);
      await activateForWindow(actor, 'tf1Secrets', 'mission');
      return T('Tf1SecretsOn', { name: actor.name, perk: item.name });
    },
  },
  {
    // Comms Probe (Infiltrator Analyst, 1st level, p.40): "If you are within 10 feet of an electronic
    // device that is sending or receiving messages, you can spend a Free action and attempt a DIF 12
    // Technology Skill Test to tap into the data pathways and receive a copy of the information."
    id: 'tf1CommsProbe', matches: item => sourceOf(item) == TF1.commsProbe,
    async run(item, economy, pay) {
      if (!(await pay('free'))) {
        return null;
      }

      const { success } = await rollTest(item.parent, 'technology', 12);
      if (success) {
        await activateForWindow(item.parent, 'tf1CommsProbe', 'scene');
      }

      return T(success ? 'Tf1ProbeYes' : 'Tf1ProbeNo', { name: item.parent.name });
    },
  },
  {
    // Feedback Field (3rd level): "spend an Energon Point and a Move action to emit a feedback field.
    // While the field is active, all non-allied communications and data transfers in the scene are
    // partially jammed and require a successful Technology Skill Test against your Willpower Defense".
    id: 'tf1FeedbackField', matches: item => sourceOf(item) == TF1.feedbackField,
    canUse: item => !isActiveForWindow(item.parent, 'tf1FeedbackField', 'scene'),
    async run(item, economy, pay) {
      const actor = item.parent;
      if ((Number(actor.system?.energon?.normal?.value) || 0) < 1) {
        ui.notifications.warn(T('Tf1NoEnergon', { name: actor.name }));
        return null;
      }

      if (!(await pay('move')) || !(await spendEnergon(actor, 1))) {
        return null;
      }

      await activateForWindow(actor, 'tf1FeedbackField', 'scene');
      return T('Tf1FeedbackOn', { name: actor.name, willpower: actor.system?.defenses?.willpower?.total ?? '-' });
    },
  },
  {
    // False Data (6th level): "if you have successfully used the Comms Probe Perk, you can choose to
    // roll a Deception Skill Test to completely change the data ...; the result becomes the DIF of an
    // Alertness (Investigation) Skill Test for anyone trying to determine if the information is false."
    id: 'tf1FalseData', matches: item => sourceOf(item) == TF1.falseData,
    canUse: item => isActiveForWindow(item.parent, 'tf1CommsProbe', 'scene'),
    async run(item) {
      const actor = item.parent;
      await actor._dice?.rollSkill({ skill: 'deception', essence: 'social', shiftUp: 0, shiftDown: 0 }, actor);
      return T('Tf1FalseData', { name: actor.name });
    },
  },
  {
    // Eidetic Buffer (10th level): "you can always attempt a DIF 14 Alertness Skill Test to remember a
    // specific fact or previously learned piece of information."
    id: 'tf1Eidetic', matches: item => sourceOf(item) == TF1.eideticBuffer,
    async run(item) {
      const { success } = await rollTest(item.parent, 'alertness', 14);
      return T(success ? 'Tf1RecallYes' : 'Tf1RecallNo', { name: item.parent.name });
    },
  },
  {
    // Mine! (Decepticon Directive, Scavenger, 1st level, p.63): "As a Free action, you can grab an
    // unattended one-handed (or smaller) item within your natural reach ... If you are trying to do
    // this without someone noticing, attempt an Infiltration Skill Test contested by any onlookers'
    // Alertness."
    id: 'tf1Mine', matches: item => sourceOf(item) == TF1.mine,
    async run(item, economy, pay) {
      const choice = await chooseButtons(item.name, T('Tf1MinePrompt'), [['open', T('Tf1MineOpen')], ['sneak', T('Tf1MineSneak')]]);
      if (!choice || !(await pay('free'))) {
        return null;
      }

      if (choice == 'sneak') {
        await item.parent._dice?.rollSkill({ skill: 'infiltration', essence: 'speed', shiftUp: 0, shiftDown: 0 }, item.parent);
      }

      return T(choice == 'sneak' ? 'Tf1MineSneaked' : 'Tf1MineGrabbed', { name: item.parent.name });
    },
  },
  {
    // Picking Up the Trail (Tracker, 17th level, p.56): "Attempt an Alertness or Survival Skill Test
    // contested by your Primary Quarry's Infiltration Skill Test."
    id: 'tf1Trail', matches: item => sourceOf(item) == TF1.pickingUpTheTrail,
    async run(item) {
      const skill = await chooseButtons(item.name, T('Tf1TrailPrompt'), [['alertness', T('SkillAlertness')], ['survival', T('SkillSurvival')]]);
      if (!skill) {
        return null;
      }

      await item.parent._dice?.rollSkill({ skill, essence: 'smarts', shiftUp: 0, shiftDown: 0 }, item.parent);
      return T('Tf1TrailRolled', { name: item.parent.name });
    },
  },
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

      const { findCompendiumItems, pickCompendiumItem } = await import("../../item-picker.mjs");
      const rows = await findCompendiumItems({ type: 'perk', fields: ['system.type'], matches: e => e.system?.type == 'general' });
      const uuid = await pickCompendiumItem(rows, { title: item.name, label: 'E20.Tf1GlitchPickPerk' });
      if (!uuid) {
        return null;
      }

      const { success } = await rollTest(actor, 'technology', 20);
      if (!success) {
        return T('Tf1GlitchFailed', { name: actor.name, ally: ally.name });
      }

      const { grantCopy } = await import("../../grants.mjs");
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
    // Partnered (Decepticon Directive, General Perk, p.66): "You have a deep connection with a single
    // creature, chosen when you take this Perk." Picks the creature; the Free-action Lend Assistance is
    // the cost rule below.
    id: 'tf1Partnered', matches: item => sourceOf(item) == TF1.partnered,
    async run(item) {
      const actor = item.parent;
      let partner = target();
      if (!partner || partner.id == actor.id) {
        const allies = safe(() => getNearbyAllyTokens(actor, Infinity), []).map(t => t.actor).filter(Boolean);
        const picked = await chooseSelect(item.name, T('Tf1PickPartner'), allies.map(a => ({ value: a.uuid, label: a.name })));
        partner = picked ? allies.find(a => a.uuid == picked) : null;
      }

      if (!partner) {
        ui.notifications.warn(T('Tf1PickAlly'));
        return null;
      }

      await item.setFlag('essence20', 'partner', { uuid: partner.uuid, name: partner.name });
      return T('Tf1PartnerSet', { name: actor.name, partner: partner.name });
    },
  },
  {
    // Flexible Switch (Modemaster, 3rd level, p.48): "You can spend 10 minutes outside of combat to
    // alter which two of your Alt Modes this Perk applies to".
    id: 'tf1FlexibleSwitch', matches: item => sourceOf(item) == TF1.flexibleSwitch,
    canUse: item => !game?.combat && itemsOf(item.parent).filter(i => i.type == 'altMode').length >= 2,
    async run(item) {
      const modes = itemsOf(item.parent).filter(i => i.type == 'altMode');
      const options = modes.map(m => ({ value: m.id, label: m.name }));
      const first = await chooseSelect(item.name, T('Tf1SwitchFirst'), options);
      const second = first ? await chooseSelect(item.name, T('Tf1SwitchSecond'), options.filter(o => o.value != first)) : null;
      if (!second) {
        return null;
      }

      await item.setFlag('essence20', 'switchModes', [first, second]);
      return T('Tf1SwitchSet', { name: item.parent.name, a: modes.find(m => m.id == first)?.name, b: modes.find(m => m.id == second)?.name });
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

      const { grantCopy } = await import("../../grants.mjs");
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

      const { grantCopy } = await import("../../grants.mjs");
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
    // Tox-En (Decepticon Directive p.83): "When a Cybertronian is within 20 feet of exposed Tox-En, the
    // substance makes an attack with a skill level of +d8 against the Cybertronian's Toughness Defense.
    // This attack gains Edge if the Cybertronian touches the Tox-En ... If the attack is successful, the
    // Cybertronian suffers 1 Strength and 1 Speed Essence damage and is Impaired for 1 minute. This
    // attack repeats every round ... increasing the duration of the Impaired condition by 1 minute with
    // each successful attack." Run by the GM against the targeted creatures, once per round.
    id: 'tf1ToxEn', matches: item => sourceOf(item) == TF1.toxEn,
    async run(item) {
      const targets = [...(game.user?.targets ?? [])].map(t => t.actor).filter(Boolean);
      if (!targets.length) {
        ui.notifications.warn(T('Tf1PickTargets'));
        return null;
      }

      const how = await chooseButtons(item.name, T('Tf1ToxPrompt'), [['near', T('Tf1ToxNear')], ['touch', T('Tf1ToxTouch')]]);
      if (!how) {
        return null;
      }

      const lines = [];
      for (const victim of targets) {
        const roll = await new Roll(`${how == 'touch' ? '2d20kh' : '1d20'} + 1d8`).evaluate();
        const toughness = Number(victim.system?.defenses?.toughness?.total) || 0;
        const hit = roll.total >= toughness;
        lines.push(T(hit ? 'Tf1ToxHit' : 'Tf1ToxMiss', { name: victim.name, total: roll.total, toughness }));
        if (hit) {
          await toxHit(victim);
        }
      }

      return `${item.name}: ${lines.join(' ')}`;
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

async function toxHit(victim) {
  if (!victim.isOwner) {
    ui.notifications.warn(T('Tf1GmApplies'));
    return;
  }

  const { applyEssenceDamage } = await import("../../environment-hazards.mjs");
  await applyEssenceDamage(victim, ['strength', 'speed']);
  const impaired = (victim.effects?.contents ?? [...(victim.effects ?? [])]).find(e => e.statuses?.has?.('impaired'));
  if (impaired && game.combat && impaired.duration?.rounds) {
    await impaired.update({ 'duration.rounds': impaired.duration.rounds + 10 });
  } else {
    await applyCondition(victim, 'impaired', 10);
  }
}

/* -------------------------------------------- */
/*  Cost rules                                   */
/* -------------------------------------------- */

// Partnered: "You can always Lend Assistance using a Free Action to that creature as long as they are
// within your line of sight."
export const PARTNERED_RULE = {
  id: 'tf1Partnered', label: 'Partnered', ask: 'E20.Tf1AskPartnered',
  has: actor => !!itemOf(actor, TF1.partnered)?.flags?.essence20?.partner,
  matches: ctx => ctx?.key == 'lendAssistance', to: () => 'free',
};

// Flexible Switch (Modemaster, 3rd level, p.48): "you gain the benefits of the Quick Change General
// Perk that applies only to a conversion sequence from one Alt Mode to another."
export const FLEXIBLE_SWITCH_RULE = {
  id: 'tf1FlexibleSwitch', label: 'Flexible Switch', ask: 'E20.Tf1AskFlexibleSwitch',
  has: actor => {
    const perk = itemOf(actor, TF1.flexibleSwitch);
    if (!perk || !actor.system?.isTransformed || itemsOf(actor).filter(i => i.type == 'altMode').length < 2) {
      return false;
    }

    const pair = perk.flags?.essence20?.switchModes;
    return !pair?.length || pair.includes(actor.system?.altModeId);
  },
  matches: ctx => ctx?.kind == 'conversion', to: () => 'free',
};

/* -------------------------------------------- */
/*  Registration                                 */
/* -------------------------------------------- */

registerRollSources(tf1SupportSources);
registerPostRoll(tf1SupportPostRoll);
registerDialogToggles(tf1SupportToggles);
registerApplyDialog(tf1SupportApplyDialog);
registerCostRule(PARTNERED_RULE);
registerCostRule(FLEXIBLE_SWITCH_RULE);
SUPPORT_USES.forEach(registerUse);
