/**
 * The tf2 slice's Use buttons.
 *
 * - Diversion (TF CRB, Infiltrator, p.60): "Roll a Deception, Intimidation, or Persuasion Skill Test
 *   against a target's Willpower or Cleverness as a Standard action." What a success does is
 *   ./rolls.mjs's Diversion sources.
 * - Duke It Out (Warrior, 10th level, p.91): "once per combat as long as you haven't used your
 *   Standard action this turn, you can challenge a creature of your level or higher to fight you,
 *   one-on-one, as a Free action. They must immediately accept or refuse. If they refuse, you gain an
 *   Edge on Skill Tests targeting them until the beginning of your next turn. If they accept, you and
 *   your target both immediately make a Melee attack ... as a Contested Skill Test. The winner deals
 *   their attack's effect to the loser."
 * - Deconstruct (Scientist, 6th level, p.81): "as a Standard action, spend 1 Energon Point and make a
 *   Technology Skill Test against the Requisition Difficulty of a Kit, Gear, or Weapon used by an
 *   adjacent enemy... Kit: The Kit is destroyed. Gear: The Gear cannot be used unless subject to a DIF
 *   10 Technology Skill Test to repair it. If you Critically Succeeded ... the DIF increases to 20.
 *   Weapon: The attacker suffers a Snag using this weapon unless it's subject to a DIF 10 Technology
 *   Skill Test to repair it." The repair is a Use button on the sabotaged item.
 * - Determine Probability (Analyst, 5th level, p.59): "once per turn, instead of using a Standard
 *   action that requires a Skill Test, you can use a Free action to run a simulation in your head...
 *   If this simulated Skill Test succeeds, you can use your Standard action to use the results of the
 *   simulated Skill Test instead of making another Skill Test."
 * - Energon Bank (Scientist, 9th level, p.79): "allies within 30ft can spend your Energon Points
 *   instead of their own". Handed over one point at a time, as the ally needs it.
 * - Applied Science (Scientist, 12th level, p.79): "once per scene, you can use Broad Understanding
 *   and Thesis in Combat."
 * - We Are One! (Enigma of Combination, 10th level, p.30-31): "Choose a number of allies equal to your
 *   half of Social Essence Score (rounded up)... Then, choose two Skills from two different Essence
 *   Scores. You and your teammates can reroll 1s on Skill Dice when using those Skills." The team goes
 *   onto the holder; ./modes.mjs gives every member a reroll Active Effect (the reroll engine,
 *   helpers/reroll.mjs, reads those).
 * - Cage (TF CRB, Alt Mode feature, p.134): "You can imprison any number of Common or smaller
 *   passengers up to your Crew rating... if you use a Free action to focus on a passenger, their roll
 *   suffers a Snag. Bot Mode: ... you can only hold one prisoner while in Bot Mode."
 * - Mutant Beast (Technorganic Secrets, Influence, p.33): "choose two non-Fuzor Origins and use the Alt
 *   Mode Movement, Size, and Special Attacks from each to define your two Alt Modes." The button adds
 *   the second Origin's Alt Mode.
 */
import { registerUse } from "../../extensions.mjs";
import { getUses, markUsed } from "../../scene-clock.mjs";
import { hasUsedThisTurn, markUsedThisTurn } from "../../perks.mjs";
import {
  T, TF2, defenseOf, feetBetween, has, itemsOf, say, sourceOf, targetedActor, worldActors, writeActor,
} from "./common.mjs";
import {
  APPLIED_SCIENCE_FLAG, DECONSTRUCTED, MARK, addMarkTo, marksOf, removeMarkFrom, untilEndOfNextRound, untilStartOfNextTurn,
} from "./rolls.mjs";

export const WE_ARE_ONE_FLAG = 'tf2WeAreOne';

const skillLabel = skill => game.i18n.localize(CONFIG.E20?.skills?.[skill] ?? skill);
const defenseLabel = defense => game.i18n.localize(CONFIG.E20?.defenses?.[defense] ?? defense);
const energonOf = actor => Number(actor?.system?.energon?.normal?.value) || 0;

async function grants() {
  return import("../../grants.mjs");
}

function needTarget() {
  const target = targetedActor();
  if (!target) {
    ui.notifications.warn(game.i18n.localize('E20.PickTarget'));
  }

  return target;
}

async function chooseDefense(title) {
  const { chooseButtons } = await grants();
  return chooseButtons(title, T('Tf2WhichDefense'), ['willpower', 'cleverness'].map(d => [d, defenseLabel(d)]));
}

async function spendEnergon(actor, amount = 1) {
  if (energonOf(actor) < amount) {
    ui.notifications.warn(T('Tf2NoEnergon', { name: actor.name }));
    return false;
  }

  await actor.update({ 'system.energon.normal.value': energonOf(actor) - amount });
  return true;
}

/* -------------------------------------------- */
/*  Deconstruct                                  */
/* -------------------------------------------- */

/** What Deconstruct does to this item: 'kit', 'gear' or 'weapon' (null when it can't be targeted). */
export function deconstructKind(item) {
  if (item?.type == 'weapon') {
    return 'weapon';
  }

  if (item?.type == 'gear') {
    return /\bkit\b/i.test(item.name ?? '') ? 'kit' : 'gear';
  }

  return null;
}

/** The Requisition Difficulty of an item (TF CRB Table 8-1 via E20.availabilityDifficulties). */
export function requisitionDifOf(item, kitAvailability = () => 'standard') {
  const availability = item?.system?.totalAvailability ?? item?.system?.availability ?? kitAvailability(item?.name);
  return CONFIG.E20?.availabilityDifficulties?.[availability] ?? 0;
}

async function deconstruct(item, economy, pay) {
  const actor = item.parent;
  const target = needTarget();
  if (!target) {
    return null;
  }

  const distance = feetBetween(actor, target);
  if (distance != null && distance > 10) {
    ui.notifications.warn(T('Tf2NotAdjacent', { name: target.name }));
    return null;
  }

  const candidates = itemsOf(target).filter(other => deconstructKind(other) && !other.flags?.essence20?.[DECONSTRUCTED]);
  const { chooseSelect, kitAvailability, rollTest } = await grants();
  const chosenId = await chooseSelect(item.name, T('Tf2DeconstructPick', { name: target.name }), candidates.map(other => ({ value: other.id, label: other.name })));
  const victim = candidates.find(other => other.id == chosenId);
  if (!victim) {
    return null;
  }

  if (energonOf(actor) < 1) {
    ui.notifications.warn(T('Tf2NoEnergon', { name: actor.name }));
    return null;
  }

  if (!(await pay('standard')) || !(await spendEnergon(actor))) {
    return null;
  }

  const kind = deconstructKind(victim);
  const { success, crit } = await rollTest(actor, 'technology', requisitionDifOf(victim, kitAvailability));
  if (!success) {
    return T('Tf2DeconstructFailed', { name: actor.name, item: victim.name });
  }

  const { needsGmRelay, relayToGm } = await import("../../gm-relay.mjs");
  const record = { kind, dif: crit ? 20 : 10, by: actor.uuid };
  if (kind == 'kit' && !needsGmRelay(victim)) {
    await victim.delete();
  } else if (needsGmRelay(victim)) {
    await relayToGm(victim, 'setFlag', ['essence20', DECONSTRUCTED, record]);
  } else {
    await victim.setFlag('essence20', DECONSTRUCTED, record);
  }

  return T(kind == 'kit' ? 'Tf2DeconstructKit' : (kind == 'gear' ? 'Tf2DeconstructGear' : 'Tf2DeconstructWeapon'), {
    name: actor.name, target: target.name, item: victim.name, dif: record.dif,
  });
}

async function repair(item) {
  const record = item.flags?.essence20?.[DECONSTRUCTED];
  const actor = item.parent;
  const { rollTest } = await grants();
  const { success } = await rollTest(actor, 'technology', record?.dif ?? 10);
  if (!success) {
    return T('Tf2RepairFailed', { name: actor.name, item: item.name });
  }

  await item.unsetFlag('essence20', DECONSTRUCTED);
  return T('Tf2Repaired', { name: actor.name, item: item.name });
}

/* -------------------------------------------- */
/*  We Are One!                                  */
/* -------------------------------------------- */

/** The Party rosters the actor is on. */
function partyMates(actor) {
  const mates = new Map();
  for (const party of worldActors().filter(other => other?.type == 'party')) {
    const roster = Object.values(party.system?.actors ?? {}).map(entry => entry?.uuid);
    if (!roster.includes(actor?.uuid)) {
      continue;
    }

    for (const uuid of roster) {
      const member = typeof fromUuidSync == 'function' ? fromUuidSync(uuid) : null;
      if (member && member.uuid != actor.uuid) {
        mates.set(member.uuid, member);
      }
    }
  }

  return [...mates.values()];
}

/** How many allies We Are One! takes: half the Social Essence, rounded up. */
export function weAreOneSize(actor) {
  const social = Number(actor?.system?.essences?.social?.max ?? actor?.system?.essences?.social?.value) || 0;
  return Math.ceil(social / 2);
}

/** Whether two skills come from two different Essences. */
export function differentEssences(a, b) {
  const map = CONFIG.E20?.skillToEssence ?? {};
  return !!a && !!b && a != b && map[a] != map[b];
}

async function pickAllies(title, candidates, limit) {
  const rows = candidates.map(member => `<div class="form-group"><label><input type="checkbox" name="m" value="${member.uuid}"> ${foundry.utils.escapeHTML(member.name)}</label></div>`).join('');
  const result = await foundry.applications.api.DialogV2.wait({
    window: { title },
    classes: ['window-app', 'e20-window'],
    content: `<p>${T('Tf2WeAreOnePickAllies', { count: limit })}</p>${rows}`,
    buttons: [
      {
        action: 'ok', label: game.i18n.localize('E20.DialogConfirmButton'), default: true,
        callback: (event, button) => [...button.form.querySelectorAll('input[name="m"]:checked')].map(input => input.value),
      },
      { action: 'cancel', label: game.i18n.localize('E20.DialogCancelButton') },
    ],
    rejectClose: false,
  });
  return Array.isArray(result) ? result.slice(0, limit) : null;
}

async function weAreOne(item) {
  const actor = item.parent;
  const limit = weAreOneSize(actor);
  const candidates = partyMates(actor);
  const pool = candidates.length ? candidates : [...(game.user?.targets ?? [])].map(token => token.actor).filter(other => other && other.uuid != actor.uuid);
  if (!pool.length) {
    ui.notifications.warn(T('Tf2WeAreOneNoTeam'));
    return null;
  }

  const members = await pickAllies(item.name, pool, limit);
  if (!members) {
    return null;
  }

  const { chooseSelect } = await grants();
  const skills = Object.keys(CONFIG.E20?.skills ?? {});
  const first = await chooseSelect(item.name, T('Tf2WeAreOneSkill', { n: 1 }), skills.map(value => ({ value, label: skillLabel(value) })));
  if (!first) {
    return null;
  }

  const second = await chooseSelect(item.name, T('Tf2WeAreOneSkill', { n: 2 }), skills.filter(value => differentEssences(first, value)).map(value => ({ value, label: skillLabel(value) })));
  if (!second) {
    return null;
  }

  await actor.setFlag('essence20', WE_ARE_ONE_FLAG, { members, skills: [first, second], label: item.name });
  const names = members.map(uuid => fromUuidSync(uuid)?.name).filter(Boolean).join(', ');
  return T('Tf2WeAreOneSet', { name: actor.name, team: names, a: skillLabel(first), b: skillLabel(second) });
}

/* -------------------------------------------- */
/*  Cage                                         */
/* -------------------------------------------- */

/** How many prisoners the Cage holds right now: the Alt Mode's Crew rating, one in Bot Mode. */
export function cageCapacity(actor) {
  if (!actor?.system?.isTransformed) {
    return 1;
  }

  const altMode = itemsOf(actor).find(other => other.id == actor.system.altModeId);
  const crew = Number(altMode?.system?.altModeCrew ?? altMode?.system?.crew) || 0;
  return crew + (has(actor, TF2.extraCrewCapacity) ? 4 : 0);
}

export const prisonersOf = actor => worldActors().filter(other => marksOf(other, MARK.caged).some(mark => mark.by == actor?.uuid));

async function cage(item, economy, pay) {
  const actor = item.parent;
  const { chooseButtons, chooseSelect } = await grants();
  const prisoners = prisonersOf(actor);
  const choices = [['imprison', T('Tf2CageImprison')]];
  if (prisoners.length) {
    choices.push(['focus', T('Tf2CageFocus')], ['release', T('Tf2CageRelease')]);
  }

  const action = await chooseButtons(item.name, T('Tf2CagePrompt', { count: prisoners.length, max: cageCapacity(actor) }), choices);
  if (action == 'imprison') {
    const target = needTarget();
    if (!target) {
      return null;
    }

    if (prisoners.length >= cageCapacity(actor)) {
      ui.notifications.warn(T('Tf2CageFull', { name: item.name }));
      return null;
    }

    await addMarkTo(target, { kind: MARK.caged, by: actor.uuid, label: item.name });
    return T('Tf2CageImprisoned', { name: actor.name, target: target.name });
  }

  if (action != 'focus' && action != 'release') {
    return null;
  }

  const id = await chooseSelect(item.name, T('Tf2CagePickPrisoner'), prisoners.map(other => ({ value: other.uuid, label: other.name })));
  const prisoner = prisoners.find(other => other.uuid == id);
  if (!prisoner) {
    return null;
  }

  if (action == 'release') {
    await removeMarkFrom(prisoner, MARK.caged, actor.uuid);
    return T('Tf2CageReleased', { name: actor.name, target: prisoner.name });
  }

  if (!(await pay('free'))) {
    return null;
  }

  const mark = marksOf(prisoner, MARK.caged).find(existing => existing.by == actor.uuid);
  await addMarkTo(prisoner, { ...mark, focused: true });
  return T('Tf2CageFocused', { name: item.name, target: prisoner.name });
}

/* -------------------------------------------- */
/*  The buttons                                  */
/* -------------------------------------------- */

const isFrom = uuid => item => sourceOf(item) == uuid;

export const USES = [
  {
    id: 'tf2Diversion', matches: isFrom(TF2.diversion),
    async run(item, economy, pay) {
      const actor = item.parent;
      const target = needTarget();
      if (!target) {
        return null;
      }

      const { chooseButtons, rollTest } = await grants();
      const skill = await chooseButtons(item.name, T('Tf2DiversionSkill'), ['deception', 'intimidation', 'persuasion'].map(s => [s, skillLabel(s)]));
      const defense = skill ? await chooseDefense(item.name) : null;
      if (!defense || !(await pay('standard'))) {
        return null;
      }

      const { success } = await rollTest(actor, skill, defenseOf(target, defense) ?? 10);
      if (!success) {
        return T('Tf2DiversionFailed', { name: actor.name, target: target.name });
      }

      await addMarkTo(target, { kind: MARK.diversion, by: actor.uuid, label: item.name, ...untilEndOfNextRound() });
      return T('Tf2DiversionSet', { name: actor.name, target: target.name });
    },
  },
  {
    id: 'tf2DukeItOut', matches: isFrom(TF2.dukeItOut),
    canUse: item => getUses(item.parent, 'tf2DukeItOut', 'encounter') < 1,
    async run(item, economy, pay) {
      const actor = item.parent;
      const target = needTarget();
      if (!target) {
        return null;
      }

      const theirs = Number(target.system?.level ?? target.system?.threatLevel) || 0;
      if (theirs && theirs < (Number(actor.system?.level) || 0)) {
        ui.notifications.warn(T('Tf2DukeTooLow', { name: target.name }));
        return null;
      }

      if (game.combat) {
        const { getLedger } = await import("../../action-economy.mjs");
        if ((getLedger(actor)?.standard ?? 0) > 0) {
          ui.notifications.warn(T('Tf2DukeStandardUsed'));
          return null;
        }
      }

      const { chooseButtons } = await grants();
      const answer = await chooseButtons(item.name, T('Tf2DukePrompt', { name: actor.name, target: target.name }), [
        ['accept', T('Tf2DukeAccept')], ['refuse', T('Tf2DukeRefuse')],
      ]);
      if (!answer || !(await pay('free'))) {
        return null;
      }

      await markUsed(actor, 'tf2DukeItOut', { window: 'encounter' });
      if (answer == 'refuse') {
        await addMarkTo(target, { kind: MARK.dukeRefused, by: actor.uuid, label: item.name, ...untilStartOfNextTurn(actor) });
        return T('Tf2DukeRefused', { name: actor.name, target: target.name });
      }

      return T('Tf2DukeAccepted', { name: actor.name, target: target.name });
    },
  },
  { id: 'tf2Deconstruct', matches: isFrom(TF2.deconstruct), run: deconstruct },
  {
    // Repairing what Deconstruct broke.
    id: 'tf2Repair', matches: item => !!item?.flags?.essence20?.[DECONSTRUCTED],
    run: repair,
  },
  {
    id: 'tf2DetermineProbability', matches: isFrom(TF2.determineProbability),
    canUse: item => !game.combat || !hasUsedThisTurn(item.parent, 'tf2DetermineProbability'),
    async run(item, economy, pay) {
      const actor = item.parent;
      const { chooseSelect } = await grants();
      const skill = await chooseSelect(item.name, T('Tf2DetermineProbabilitySkill'), Object.keys(CONFIG.E20?.skills ?? {}).map(value => ({ value, label: skillLabel(value) })));
      if (!skill || !(await pay('free'))) {
        return null;
      }

      if (game.combat) {
        await markUsedThisTurn(actor, 'tf2DetermineProbability');
      }

      await say(actor, T('Tf2DetermineProbabilityRolling', { name: actor.name, skill: skillLabel(skill) }));
      await actor._dice?.rollSkill({ skill, essence: CONFIG.E20?.skillToEssence?.[skill], shiftUp: 0, shiftDown: 0 }, actor);
      return T('Tf2DetermineProbabilityDone', { name: actor.name });
    },
  },
  {
    id: 'tf2EnergonBank', matches: isFrom(TF2.energonBank),
    canUse: item => energonOf(item.parent) > 0,
    async run(item) {
      const actor = item.parent;
      const ally = needTarget();
      if (!ally || ally.uuid == actor.uuid) {
        return null;
      }

      const distance = feetBetween(actor, ally);
      if (distance != null && distance > 30) {
        ui.notifications.warn(T('Tf2OutOfRange', { range: 30 }));
        return null;
      }

      if (!ally.system?.energon?.normal || !(await spendEnergon(actor))) {
        return null;
      }

      await writeActor(ally, 'update', [{ 'system.energon.normal.value': energonOf(ally) + 1 }]);
      return T('Tf2EnergonBankGave', { name: actor.name, ally: ally.name });
    },
  },
  {
    id: 'tf2AppliedScience', matches: isFrom(TF2.appliedScience),
    canUse: item => getUses(item.parent, 'tf2AppliedScience', 'scene') < (has(item.parent, TF2.multiplication) ? 2 : 1),
    async run(item) {
      const actor = item.parent;
      await markUsed(actor, 'tf2AppliedScience', { window: 'scene' });
      await actor.setFlag('essence20', APPLIED_SCIENCE_FLAG, true);
      return T('Tf2AppliedScience', { name: actor.name });
    },
  },
  { id: 'tf2WeAreOne', matches: isFrom(TF2.weAreOne), run: weAreOne },
  { id: 'tf2Cage', matches: isFrom(TF2.cage), run: cage },
  {
    id: 'tf2MutantBeast', matches: isFrom(TF2.mutantBeast),
    canUse: item => itemsOf(item.parent).filter(other => other.type == 'altMode').length < 2,
    async run(item) {
      const actor = item.parent;
      const { chooseSelect, findItems, grantCopy, pickOne } = await grants();
      const rows = await findItems({ type: 'origin', matches: entry => !/fuzor/i.test(entry.name ?? '') });
      const uuid = await pickOne(T('Tf2MutantBeastOrigin'), rows);
      const origin = uuid ? await fromUuid(uuid) : null;
      const altModes = Object.values(origin?.system?.items ?? {}).filter(entry => entry?.type == 'altMode');
      const altUuid = altModes.length == 1 ? altModes[0].uuid
        : await chooseSelect(item.name, T('Tf2MutantBeastAltMode'), altModes.map(entry => ({ value: entry.uuid, label: entry.name })));
      if (!altUuid) {
        return null;
      }

      const created = await grantCopy(actor, altUuid, { grantedBy: item });
      return created ? T('Tf2MutantBeastAdded', { name: actor.name, mode: created.name, origin: origin.name }) : null;
    },
  },
];

USES.forEach(registerUse);
