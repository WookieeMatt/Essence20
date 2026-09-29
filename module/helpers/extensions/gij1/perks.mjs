import {
  registerApplyDialog, registerDerived, registerDialogToggles, registerRollSources, registerUse,
} from "../../extensions.mjs";
import { hasSourced } from "../../companion-link.mjs";
import { hasUsedThisTurn, markUsedThisTurn } from "../../perks.mjs";
import { getUses, markUsed } from "../../scene-clock.mjs";
import {
  G1, SIGNATURE_WEAPONS, T, askSkillAndText, findSourced, firstTarget, inCombat, isFrom, isStampActive, itemsOf,
  post, skillsOf, sourceOf, turnStamp,
} from "./shared.mjs";
import { ONE_HANDED_FLAG } from "./gear.mjs";

/**
 * Cobra Codex Perks and Hang-Ups: Bootlicker, Chemist, Cover Job, Cybernetic Part, Double Life,
 * Demolition Artist / Improvise Bomb, Extract Poison, Primal Fear / Feed On Fear, Let It Rip,
 * Metier, Scavenger, Sea Legs, Shielded and Stellar Experience.
 */

// A Perk's own pick (Cover Job's skill + profession, Double Life's skill + Specialization, Metier's
// option) lives on the Perk copy, so taking the Perk twice keeps two picks.
export const CHOICE_FLAG = 'gij1Choice';
export const choiceOf = item => item?.flags?.essence20?.[CHOICE_FLAG] ?? null;
const allSourced = (actor, uuid) => itemsOf(actor).filter(item => sourceOf(item) == uuid);

/* -------------------------------------------- */
/*  Self-declared toggles                        */
/* -------------------------------------------- */

// Bootlicker (General Perk, p.79): "Gain ↑1 on Skill Tests when interacting with superior
// officers." Stellar Experience (Space Division Perk, p.76): "You gain Edge on Smarts-based Skill
// Tests that relate to space, geography, engineering, and philosophy, including using the stars
// to navigate." (Its "hold your breath for twice as long" half has no breath clock to change.)
// Cover Job (Crimson Guard Division Perk, p.72): "outside of combat, you are considered Specialized
// in Skill Tests that relate to your chosen profession." Double Life (General Perk, p.79): "When
// you have time before making a Skill Test related to that Specialization to reach out to someone
// from your fake life ... you gain Edge and the benefits of that Specialization on your roll.
// Whether you have time to contact them is up to your GM." Each hinges on what the test is about,
// so each is an off-by-default checkbox shown only on the rolls it could apply to.
export function gij1Toggles(actor, ctx = {}) {
  const toggles = [];
  const isAttack = ctx.item?.type == 'weaponEffect';
  const bootlicker = findSourced(actor, G1.bootlicker);
  if (bootlicker && !isAttack) {
    toggles.push({ name: 'gij1Bootlicker', type: 'checkbox', label: T('G1BootlickerToggle', { perk: bootlicker.name }) });
  }

  const stellar = findSourced(actor, G1.stellarExperience);
  if (stellar && ctx.rolledEssence == 'smarts' && !isAttack) {
    toggles.push({ name: 'gij1Stellar', type: 'checkbox', label: T('G1StellarToggle', { perk: stellar.name }) });
  }

  if (!inCombat(actor)) {
    for (const perk of allSourced(actor, G1.coverJob)) {
      const choice = choiceOf(perk);
      if (choice?.text) {
        toggles.push({ name: `gij1CoverJob-${perk.id}`, type: 'checkbox', label: T('G1CoverJobToggle', { profession: choice.text }) });
      }
    }
  }

  for (const perk of allSourced(actor, G1.doubleLife)) {
    const choice = choiceOf(perk);
    if (choice?.skill && choice.skill == ctx.rolledSkill) {
      toggles.push({ name: `gij1DoubleLife-${perk.id}`, type: 'checkbox', label: T('G1DoubleLifeToggle', { spec: choice.text || perk.name }) });
    }
  }

  return toggles;
}

export function applyGij1Toggles(actor, options) {
  const ext = options.ext ?? {};
  if (ext.gij1Bootlicker) {
    options.shiftUp = (options.shiftUp ?? 0) + 1;
  }

  if (ext.gij1Stellar) {
    options.edge = true;
  }

  for (const [name, on] of Object.entries(ext)) {
    if (!on) {
      continue;
    }

    if (name.startsWith('gij1CoverJob-')) {
      options.isSpecialized = true;
    } else if (name.startsWith('gij1DoubleLife-')) {
      options.edge = true;
      options.isSpecialized = true;
    }
  }
}

registerDialogToggles(gij1Toggles);
registerApplyDialog(applyGij1Toggles);

/* -------------------------------------------- */
/*  Automatic roll sources                       */
/* -------------------------------------------- */

// Chemist's Hang-Up (Influence, p.27): "You suffer ↓1 to Persuasion Skill Tests that don't involve
// science." Listed on every Persuasion roll; the player unticks it when the test is about science.
// Cover Job: "Pick a profession and a Smarts or Social skill. You gain ↑1 in that skill."
// Primal Fear (Ranger Guerilla Focus, 3rd level, p.59): "On a success, you gain ↑1 on Skill Tests
// targeting that creature for the remainder of your turn." (the Use below sets the mark).
export const PRIMAL_FEAR_FLAG = 'gij1PrimalFear';

export function gij1Sources(actor, target, ctx = {}) {
  const sources = [];
  const chemist = findSourced(actor, G1.chemistHangUp);
  if (chemist && ctx.rolledSkill == 'persuasion') {
    sources.push({ id: 'gij1Chemist', label: T('G1ChemistLabel', { name: chemist.name }), shiftDown: 1 });
  }

  for (const perk of allSourced(actor, G1.coverJob)) {
    if (choiceOf(perk)?.skill && choiceOf(perk).skill == ctx.rolledSkill) {
      sources.push({ id: `gij1CoverJob-${perk.id}`, label: perk.name, shiftUp: 1 });
    }
  }

  const mark = actor?.getFlag?.('essence20', PRIMAL_FEAR_FLAG);
  if (target?.uuid && mark?.targetUuid == target.uuid && isStampActive(mark)) {
    sources.push({ id: 'gij1PrimalFear', label: findSourced(actor, G1.primalFear)?.name ?? 'Primal Fear', shiftUp: 1 });
  }

  return sources;
}

registerRollSources((actor, target, ctx) => ({ sources: gij1Sources(actor, target, ctx), consumes: [] }));

/* -------------------------------------------- */
/*  Picks made when the Perk is taken            */
/* -------------------------------------------- */

async function setupCoverJob(item) {
  const picked = await askSkillAndText(item.name, T('G1CoverJobPrompt'), skillsOf(['smarts', 'social']), T('G1CoverJobProfession'));
  if (!picked) {
    return null;
  }

  const skillName = game.i18n.localize(CONFIG.E20.skills[picked.skill]);
  const text = picked.text || skillName;
  await item.update({ name: `${item.name} (${text}, ${skillName})`, [`flags.essence20.${CHOICE_FLAG}`]: { skill: picked.skill, text } });
  return T('G1ChoiceMade', { name: item.parent?.name, perk: item.name, choice: `${text}, ${skillName}` });
}

async function setupDoubleLife(item) {
  const picked = await askSkillAndText(item.name, T('G1DoubleLifePrompt'), skillsOf(null), T('G1DoubleLifeSpec'));
  if (!picked) {
    return null;
  }

  const skillName = game.i18n.localize(CONFIG.E20.skills[picked.skill]);
  const text = picked.text || skillName;
  await item.update({ name: `${item.name} (${text})`, [`flags.essence20.${CHOICE_FLAG}`]: { skill: picked.skill, text } });
  return T('G1ChoiceMade', { name: item.parent?.name, perk: item.name, choice: `${skillName}: ${text}` });
}

// Metier (Assassin Origin Benefit, p.40): "You are either trained in poisons ... or all weapons with
// one of the following Traits: Silent, Sniper, or Wrecker. If another option grants you training
// in all weapons, such as the Infantry Role, you instead gain the Weapon Training General Perk."
export const METIER_OPTIONS = ['poisons', 'silent', 'sniper', 'wrecker', 'weaponTraining'];
const metierKey = key => `G1Metier${key.charAt(0).toUpperCase()}${key.slice(1)}`;

async function setupMetier(item) {
  const { chooseButtons } = await import("../../grants.mjs");
  const choice = await chooseButtons(item.name, T('G1MetierPrompt'), METIER_OPTIONS.map(key => [key, T(metierKey(key))]));
  if (!METIER_OPTIONS.includes(choice)) {
    return null;
  }

  const actor = item.parent;
  await item.update({ name: `${item.name} (${T(metierKey(choice))})`, [`flags.essence20.${CHOICE_FLAG}`]: { choice } });
  if (choice == 'weaponTraining') {
    const { grantPerkOutright } = await import("../../../sheet-handlers/perk-handler.mjs");
    await grantPerkOutright(actor, G1.weaponTraining);
  }

  return T('G1ChoiceMade', { name: actor?.name, perk: item.name, choice: T(metierKey(choice)) });
}

// Cybernetic Part (General Perk, p.79): "Gain a permanent Standard Cybernetic Alteration. You may
// select this Perk multiple times." Any Standard Alteration can be taken in cybernetic form (p.82),
// so the picker offers every Standard Alteration the character doesn't already have ("You can't
// gain the same Alteration twice", p.82). It goes through the Alteration drop handler, so its
// Essence/skill/movement benefit and cost are applied exactly as a dragged-in one would be.
async function grantCyberneticPart(item) {
  const actor = item.parent;
  const { findItems, pickOne } = await import("../../grants.mjs");
  const owned = new Set(itemsOf(actor).filter(i => i.type == 'alteration').map(i => i.system?.originalId ?? sourceOf(i)));
  const rows = (await findItems({ type: 'alteration', availabilities: ['standard'] })).filter(row => !owned.has(row.uuid)
    && !owned.has(row.uuid.split('.').pop()));
  const uuid = await pickOne(item.name, rows);
  const source = uuid ? await fromUuid(uuid) : null;
  if (!source) {
    return null;
  }

  const { onAlterationDrop } = await import("../../../sheet-handlers/alteration-handler.mjs");
  const before = new Set(itemsOf(actor).map(i => i.id));
  const data = source.toObject();
  delete data._id;
  foundry.utils.setProperty(data, 'flags.core.sourceId', uuid);
  foundry.utils.setProperty(data, 'flags.essence20.grantedBy', item.id);
  foundry.utils.setProperty(data, 'flags.essence20.cyberneticAlteration', true);
  await onAlterationDrop(actor, source, () => actor.createEmbeddedDocuments('Item', [data]));
  const created = itemsOf(actor).find(i => !before.has(i.id) && i.type == 'alteration');
  if (!created) {
    return null;
  }

  await item.setFlag('essence20', 'granted', true);
  return T('G1CyberneticGranted', { name: actor.name, alteration: created.name });
}

// Shielded (Citystriker Focus, 1st level, p.68): "You gain a Standard shield (see page 98) as
// personal gear". (Using Medium weapons one-handed alongside it needs no rule change - nothing here
// blocks a weapon for the hands it needs.)
async function grantShield(item) {
  const { pickAndGrant } = await import("../../grants.mjs");
  const got = await pickAndGrant(item.parent, item, item.name, { type: 'shield', availabilities: ['standard'] });
  if (!got) {
    return null;
  }

  await item.setFlag('essence20', 'granted', true);
  return T('G1ShieldGranted', { name: item.parent.name, shield: got.name });
}

const SETUPS = [
  { uuid: G1.coverJob, needs: item => !choiceOf(item), run: setupCoverJob },
  { uuid: G1.doubleLife, needs: item => !choiceOf(item), run: setupDoubleLife },
  { uuid: G1.metier, needs: item => !choiceOf(item), run: setupMetier },
  { uuid: G1.cyberneticPart, needs: item => !item.flags?.essence20?.granted, run: grantCyberneticPart },
  { uuid: G1.shielded, needs: item => !item.flags?.essence20?.granted, run: grantShield },
];

for (const setup of SETUPS) {
  registerUse({
    id: `gij1Setup-${setup.uuid.split('.').pop()}`,
    matches: isFrom(setup.uuid),
    canUse: item => !!item.parent && setup.needs(item),
    run: item => setup.run(item),
  });
}

// Asked as soon as the Perk lands on a character, by the user who added it; the Use button stays
// until the pick is made, for a dialog closed early or a Perk added some other way.
Hooks.on('createItem', async (item, options, userId) => {
  if (userId != game.user?.id || item.parent?.documentName != 'Actor') {
    return;
  }

  const setup = SETUPS.find(entry => isFrom(entry.uuid)(item));
  if (!setup || !setup.needs(item)) {
    return;
  }

  try {
    const line = await setup.run(item);
    if (line) {
      await post(item.parent, line);
    }
  } catch (error) {
    console.error('Essence20 | gij1 setup failed', error);
  }
});

/* -------------------------------------------- */
/*  Metier / Extract Poison training             */
/* -------------------------------------------- */

// The Assassin Origin's own Active Effect adds the poison training unconditionally; a Metier that
// picked weapons instead takes that step back off. Extract Poison (Saboteur Poisoner, 17th level,
// p.50): "you become Qualified in all poisons."
function assassinPoisonStep(actor) {
  const origin = findSourced(actor, G1.assassin);
  return origin && (origin.effects?.contents ?? [...(origin.effects ?? [])]).some(effect => !effect.disabled
    && (effect.changes ?? effect.system?.changes ?? []).some(change => change.key == 'system.poisonTraining')) ? 1 : 0;
}

export function metierChoice(actor) {
  return choiceOf(findSourced(actor, G1.metier))?.choice ?? null;
}

export function applyTraining(actor) {
  const system = actor?.system;
  if (!system) {
    return;
  }

  const choice = metierChoice(actor);
  if (choice && choice != 'poisons' && Number(system.poisonTraining) > 0 && assassinPoisonStep(actor)) {
    system.poisonTraining -= 1;
    actor._preparePoisonTraining?.();
  }

  if (choice && ['silent', 'sniper', 'wrecker'].includes(choice) && system.trained?.weapons && choice in system.trained.weapons) {
    system.trained.weapons[choice] = true;
  }

  if (hasSourced(actor, G1.extractPoison) && system.qualified?.poisons) {
    for (const key of ['all', 'standard', 'limited']) {
      system.qualified.poisons[key] = true;
    }

    if (system.trained?.poisons) {
      for (const key of ['all', 'standard', 'limited']) {
        system.trained.poisons[key] = true;
      }
    }
  }
}

registerDerived(applyTraining);

/* -------------------------------------------- */
/*  Sea Legs                                     */
/* -------------------------------------------- */

// Sea Legs (General Perk, p.81): "You gain 30ft Aquatic Movement. If you already have Aquatic
// Movement, increase it by 15 feet." Read against whatever Swim the character has from everything
// else, so a later Aquatic source turns the 30 into +15 on its own.
export function applySeaLegs(actor) {
  const swim = actor?.system?.movement?.swim;
  if (!swim || !hasSourced(actor, G1.seaLegs)) {
    return;
  }

  const current = Number(swim.total) || 0;
  swim.total = current > 0 ? current + 15 : 30;
}

registerDerived(applySeaLegs);

/* -------------------------------------------- */
/*  Improvise Bomb / Demolition Artist           */
/* -------------------------------------------- */

// Improvise Bomb (Saboteur Crimson Focus, 6th level, p.51): "As a Standard action, you can create a
// bomb or grenade by succeeding at a Technology Skill Test against the availability DIF of the
// explosive. You make an additional copy of the explosive on a Critical Success." Demolition Artist
// (20th level): "Making bombs and grenades is a Free action for you."
export function isBombEntry(entry) {
  const traits = entry?.system?.traits ?? [];
  if (!traits.includes('consumable') || traits.includes('mounted') || traits.includes('vehicular')) {
    return false;
  }

  const effects = Object.values(entry.system?.items ?? {}).filter(e => e?.type == 'weaponEffect');
  return effects.some(e => e.classification?.style == 'explosive') || /grenade|bomb|explosive|charge|dynamite/i.test(entry.name ?? '');
}

export function improviseCost(actor) {
  return hasSourced(actor, G1.demolitionArtist) ? 'free' : 'standard';
}

registerUse({
  id: 'gij1ImproviseBomb',
  matches: isFrom(G1.improviseBomb),
  run: async (item, economy, pay) => {
    const actor = item.parent;
    const { findItems, grantCopy, pickOne, rollTest } = await import("../../grants.mjs");
    const uuid = await pickOne(item.name, await findItems({ type: 'weapon', matches: isBombEntry }));
    const source = uuid ? await fromUuid(uuid) : null;
    if (!source || !await pay(improviseCost(actor))) {
      return null;
    }

    const dif = CONFIG.E20.availabilityDifficulties?.[source.system?.availability] ?? 0;
    const { success, crit } = await rollTest(actor, 'technology', dif);
    if (!success) {
      return T('G1CraftFailed', { name: actor.name, item: source.name });
    }

    const made = [await grantCopy(actor, uuid, { grantedBy: item })];
    if (crit) {
      made.push(await grantCopy(actor, uuid, { grantedBy: item }));
    }

    return T('G1BombMade', { name: actor.name, item: source.name, n: made.filter(Boolean).length });
  },
});

/* -------------------------------------------- */
/*  Extract Poison                               */
/* -------------------------------------------- */

// Extract Poison: "You can spend 10 minutes extracting the poison from an Unconscious or Restrained
// creature with a poison attack, a poisoned creature, or a weapon with poison applied. If you
// succeed at a Science Skill Test against a DIF set by the Availability DIF of the poison, you gain
// a dose of that poison." Ten minutes is not a combat action, so the button is offered out of
// combat; which poison is on offer is the table's call.
registerUse({
  id: 'gij1ExtractPoison',
  matches: isFrom(G1.extractPoison),
  canUse: item => !inCombat(item.parent),
  run: async (item) => {
    const actor = item.parent;
    const { findItems, grantCopy, pickOne, rollTest } = await import("../../grants.mjs");
    const rows = await findItems({ type: 'weapon', fields: ['system.isPoison'], matches: entry => !!entry.system?.isPoison });
    const uuid = await pickOne(item.name, rows);
    const source = uuid ? await fromUuid(uuid) : null;
    if (!source) {
      return null;
    }

    const dif = CONFIG.E20.availabilityDifficulties?.[source.system?.availability] ?? 0;
    const { success } = await rollTest(actor, 'science', dif);
    if (!success) {
      return T('G1CraftFailed', { name: actor.name, item: source.name });
    }

    const got = await grantCopy(actor, uuid, { grantedBy: item });
    return got ? T('G1PoisonExtracted', { name: actor.name, item: got.name }) : null;
  },
});

/* -------------------------------------------- */
/*  Primal Fear / Feed On Fear                   */
/* -------------------------------------------- */

// Primal Fear: "In your environments of expertise, you can target a creature with a Survival Skill
// Test against their Willpower or Cleverness as a Free action once per turn. On a success, you gain
// ↑1 on Skill Tests targeting that creature for the remainder of your turn." Feed On Fear (20th
// level, p.60): "when you successfully use Primal Fear, instead of gaining ↑1 on a Skill Test, you
// can heal 1 Health."
const PRIMAL_FEAR_TURN = 'gij1PrimalFearTurn';

// environmental-expertise.mjs reaches the app layer through its own imports, so it is loaded once
// the game is ready rather than at the top (canUse is synchronous, hence the cached function).
let envExpertise = null;
Hooks.once('ready', async () => {
  envExpertise = (await import("../../environmental-expertise.mjs")).hasActiveEnvironmentalExpertise;
});

/** For tests. */
export function setEnvironmentCheck(fn) {
  envExpertise = fn;
}

export function canPrimalFear(actor) {
  return !!actor && !!envExpertise?.(actor) && !hasUsedThisTurn(actor, PRIMAL_FEAR_TURN);
}

export async function healOne(actor) {
  const health = actor.system?.health;
  const value = Number(health?.value) || 0;
  const max = Number(health?.max) || 0;
  if (value >= max) {
    return false;
  }

  await actor.update({ 'system.health.value': Math.min(max, value + 1) });
  return true;
}

registerUse({
  id: 'gij1PrimalFear',
  matches: isFrom(G1.primalFear),
  canUse: item => canPrimalFear(item.parent),
  run: async (item, economy, pay) => {
    const actor = item.parent;
    const target = firstTarget();
    if (!target) {
      ui.notifications?.warn?.(T('G1NeedTarget'));
      return null;
    }

    const { chooseButtons, rollTest } = await import("../../grants.mjs");
    const defense = await chooseButtons(item.name, T('G1PrimalFearDefense', { name: target.name }), [
      ['willpower', game.i18n.localize('E20.DefenseWillpower')], ['cleverness', game.i18n.localize('E20.DefenseCleverness')],
    ]);
    if (!['willpower', 'cleverness'].includes(defense) || !await pay('free')) {
      return null;
    }

    await markUsedThisTurn(actor, PRIMAL_FEAR_TURN);
    const dif = Number(target.system?.defenses?.[defense]?.total) || 0;
    const { success } = await rollTest(actor, 'survival', dif);
    if (!success) {
      return T('G1PrimalFearFailed', { name: actor.name, target: target.name });
    }

    const feed = findSourced(actor, G1.feedOnFear);
    if (feed) {
      const pick = await chooseButtons(feed.name, T('G1FeedOnFearPrompt'), [['shift', T('G1FeedOnFearShift')], ['heal', T('G1FeedOnFearHeal')]]);
      if (pick == 'heal') {
        const healed = await healOne(actor);
        return T(healed ? 'G1FeedOnFearHealed' : 'G1FeedOnFearFull', { name: actor.name, perk: feed.name });
      }
    }

    await actor.setFlag('essence20', PRIMAL_FEAR_FLAG, { targetUuid: target.uuid, ...turnStamp() });
    return T('G1PrimalFearHit', { name: actor.name, target: target.name });
  },
});

/* -------------------------------------------- */
/*  Let It Rip                                   */
/* -------------------------------------------- */

// Let It Rip (Renegade Troublemaker Focus, 3rd level, p.63): "as a Free action, you can treat your
// Signature Weapons as a one-handed weapon until the end of your turn." Stamps the weapon the same
// way Recoil Brace does (gear.mjs). "Choose its one-handed or two-handed effects even when wielding
// it in one hand" needs nothing: no attack effect is locked to a hand count here.
export function signatureWeapons(actor) {
  return itemsOf(actor).filter(item => item.type == 'weapon' && SIGNATURE_WEAPONS.includes(sourceOf(item)));
}

registerUse({
  id: 'gij1LetItRip',
  matches: isFrom(G1.letItRip),
  canUse: item => signatureWeapons(item.parent).length > 0,
  run: async (item, economy, pay) => {
    const actor = item.parent;
    const weapons = signatureWeapons(actor);
    let weapon = weapons[0];
    if (weapons.length > 1) {
      const { chooseSelect } = await import("../../grants.mjs");
      const id = await chooseSelect(item.name, T('G1PickWeapon'), weapons.map(w => ({ value: w.id, label: w.name })));
      weapon = weapons.find(w => w.id == id);
    }

    if (!weapon || !await pay('free')) {
      return null;
    }

    await weapon.setFlag('essence20', ONE_HANDED_FLAG, turnStamp());
    return T('G1OneHanded', { name: actor.name, weapon: weapon.name, source: item.name });
  },
});

/* -------------------------------------------- */
/*  Scavenger                                    */
/* -------------------------------------------- */

// Scavenger (General Perk, p.81): "After combat, you can spend 10 minutes searching the battlefield
// for useful scraps. Pick a piece of equipment you want to find or build out of junk and roll a
// Requisition check as though the equipment was one step harder to acquire. On a success, you find
// the piece of equipment, but it has the Temperamental trait." Once per encounter, out of combat.
export const AVAILABILITY_STEPS = ['standard', 'limited', 'restricted', 'prototype', 'unique', 'theoretical'];

export function oneStepHarder(availability) {
  const index = AVAILABILITY_STEPS.indexOf(availability ?? 'standard');
  return AVAILABILITY_STEPS[Math.min(AVAILABILITY_STEPS.length - 1, Math.max(0, index) + 1)];
}

const SCAVENGER_KEY = 'gij1Scavenger';

registerUse({
  id: 'gij1Scavenger',
  matches: isFrom(G1.scavenger),
  canUse: item => !game.combat && getUses(item.parent, SCAVENGER_KEY, 'encounter') < 1,
  run: async (item) => {
    const actor = item.parent;
    const { chooseButtons, findItems, grantCopy, pickOne, rollTest } = await import("../../grants.mjs");
    const type = await chooseButtons(item.name, T('G1ScavengerType'), [
      ['weapon', T('G1ScavengerWeapon')], ['armor', T('G1ScavengerArmor')], ['shield', T('G1ScavengerShield')], ['gear', T('G1ScavengerGear')],
    ]);
    if (!['weapon', 'armor', 'shield', 'gear'].includes(type)) {
      return null;
    }

    const uuid = await pickOne(item.name, await findItems({ type }));
    const source = uuid ? await fromUuid(uuid) : null;
    if (!source) {
      return null;
    }

    const { requisitionSkill } = await import("../../requisition.mjs");
    const skill = ['weapon', 'armor'].includes(source.type) ? requisitionSkill(source) : 'technology';
    const dif = CONFIG.E20.availabilityDifficulties?.[oneStepHarder(source.system?.availability)] ?? 0;
    await markUsed(actor, SCAVENGER_KEY, { window: 'encounter' });
    const { success } = await rollTest(actor, skill, dif);
    if (!success) {
      return T('G1ScavengerFailed', { name: actor.name, item: source.name });
    }

    const traits = Array.isArray(source.system?.traits) ? source.system.traits : null;
    const got = await grantCopy(actor, uuid, {
      grantedBy: item, flags: { scavenged: true, temperamental: true },
      system: traits && !traits.includes('temperamental') ? { traits: [...traits, 'temperamental'] } : {},
    });
    return got ? T('G1ScavengerFound', { name: actor.name, item: got.name }) : null;
  },
});
