import {
  registerApplyDialog, registerChatButton, registerDialogToggles, registerRest,
  registerRollSources, registerSpecializes, registerUse,
} from "../../extensions.mjs";
import { getSceneEpoch, getUses, markUsed } from "../../scene-clock.mjs";
import { worldActors } from "../../companion-link.mjs";

/**
 * Item Review, "situational" group, slice 1: Perks and upgrades that only work in a particular
 * environment, terrain, stealth state or scene type. Everything here reads the physical environment
 * (helpers/environment.mjs#getEnvironment - underwater, zero-G...) or the terrain/biome
 * (getTerrain - arctic, urban, woodlands...) the GM set on the Scene or on an Environment Region, and
 * falls back to a player toggle when the GM hasn't tagged the scene - the same split
 * helpers/environmental-expertise.mjs already uses.
 *
 * Three things need a hook the extension registry doesn't have; SCRATCH/integration/situational1-
 * patch.cjs adds them as plain exported arrays that this file pushes onto at setup:
 *   - rough-terrain.mjs ROUGH_TERRAIN_IGNORERS (Urban Adaptation, Adapted Vehicle)
 * (Misguide's ROUGH_TERRAIN_IMPOSERS entry and Weather Gear / Acclimating's ENVIRONMENT_PROTECTORS are item rules now -
 * RoughTerrainImposer / HazardProtection, rules/ext/e/types.mjs.)
 * Heavy modules (environment, environmental-expertise, action-economy, grants, combat...) are loaded
 * with dynamic import - see `deps` below - so this file never joins an import cycle.
 */

const uuid = (pack, id) => `Compendium.essence20.${pack}.Item.${id}`;
export const S1 = {
  urbanAdaptation: uuid('cobra_codex', 'zdCIZOr6JOPGKUmL'),
  urbanJungle: uuid('cobra_codex', 'wIesQd7U5W2azAWY'),
  earthDefenseCommand: uuid('field_guide_action_adventure', 'uQQbRbwADVtVwsym'),
  adaptedVehicle: uuid('gi_joe_crb', 'ht26M90320SgdhMK'),
  environmentalExpertise: uuid('gi_joe_crb', 'EbbSUA2vSHyv3MjQ'),
  izunaDrop: uuid('intercontinental_adventures', 'jaUwQUvv1rXlXQUA'),
  environmentalEnforcer: uuid('general_hawk_s_personel_files', 'eZuijWvAUzOXD8DR'),
};
// Jungle Fighter and Out of the Jungle are item rules (rules/conv5-slC5.test.js, rules/conv8-slC8.test.js),
// and so is Earth Defense Command Benefits' Driving ↑2 (rules/conv8-slC8.test.js). Layered Armor, Environmental Warrior, Fast
// Tracking and Contort are item rules too (rules/conv10-slC10.test.js).

const FLAG = {
  urbanAdaptation: 's1UrbanAdaptation',
  urbanAdaptationPoints: 's1UrbanAdaptationSpent',
  environments: 's1Environments',
  spaceKit: 's1SpaceKit',
};

/* -------------------------------------------- */
/*  Small helpers                                */
/* -------------------------------------------- */

const cap = key => String(key).charAt(0).toUpperCase() + String(key).slice(1);
const T = (key, data) => (data ? game.i18n.format(`E20.${key}`, data) : game.i18n.localize(`E20.${key}`));

export function sourceOf(item) {
  return item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource;
}

function listOf(collection) {
  if (Array.isArray(collection?.contents)) {
    return collection.contents;
  }

  if (Array.isArray(collection)) {
    return collection;
  }

  return collection && typeof collection[Symbol.iterator] == 'function' ? [...collection] : [];
}

const itemsOf = actor => listOf(actor?.items);

export function findSourced(actor, id) {
  return id ? itemsOf(actor).find(item => sourceOf(item) == id) ?? null : null;
}

const has = (actor, id) => !!findSourced(actor, id);

const isAttackItem = item => item?.type == 'weaponEffect';

/**
 * Environment readers, filled in at setup by loadDeps() from the heavy modules. The defaults mean
 * "nothing known" so a roll made before they load, or in a unit test, simply gets no bonus.
 */
export const deps = {
  getEnvironment: () => 'normal',
  getTerrain: () => null,
  isInEnvironmentOfExpertise: () => null,
  isEnvironmentalExpertiseActive: () => false,
};

function terrainOf(actor) {
  try {
    return deps.getTerrain(actor) || null;
  } catch (error) {
    return null;
  }
}


/* -------------------------------------------- */
/*  Where are we?                                */
/* -------------------------------------------- */

/**
 * Urban Adaptation (Cobra Codex, Citystriker, 10th level, p.68): "you gain a pool of Adaptation
 * Points equal to a Ranger of half your level (rounded up). As a Free action, you can spend an
 * Adaptation Point to use one of your Urban Jungle abilities outside of a city for the remainder of
 * the scene. Adaptation Points replenish after a night's rest."
 *
 * The Ranger's pool (GI Joe CRB p.91, the Adaptation Points role-points item) starts at 0 and gains
 * 1 at levels 2, 4, 7, 10, 13, 16 and 19.
 */
const RANGER_ADAPTATION_LEVELS = [2, 4, 7, 10, 13, 16, 19];
export function urbanAdaptationMax(actor) {
  const level = Math.ceil((Number(actor?.system?.level) || 0) / 2);
  return RANGER_ADAPTATION_LEVELS.filter(at => at <= level).length;
}

export function urbanAdaptationLeft(actor) {
  return Math.max(0, urbanAdaptationMax(actor) - (Number(actor?.getFlag?.('essence20', FLAG.urbanAdaptationPoints)) || 0));
}

/** The Urban Jungle abilities bought outside a city this scene: 'edge' | 'specialized' | 'roughTerrain'. */
export function urbanAdaptationAbilities(actor) {
  if (!has(actor, S1.urbanAdaptation) || terrainOf(actor) == 'urban') {
    return [];
  }

  const record = actor.getFlag?.('essence20', FLAG.urbanAdaptation);
  return record && record.epoch == getSceneEpoch() ? (record.abilities ?? []) : [];
}

/**
 * Adapted Vehicles (GI Joe CRB, Ranger Environmental Exposure, p.91): "Vehicles you drive in your
 * environments of expertise gain the benefits of Environment Expertise." The vehicle's driver (its
 * crew entry with the driver role) must hold this Perk and Environmental Expertise, and the terrain
 * under the VEHICLE's token must be one of the driver's environments of expertise (or, on an
 * untagged scene, the driver's own Environmental Expertise toggle is on).
 */
export function adaptedVehicleDriver(vehicle) {
  if (vehicle?.type != 'vehicle') {
    return null;
  }

  for (const entry of Object.values(vehicle.system?.actors ?? {})) {
    if (entry?.vehicleRole != 'driver' || !entry.uuid) {
      continue;
    }

    const driver = (typeof fromUuidSync == 'function' ? fromUuidSync(entry.uuid) : null)
      ?? worldActors().find(a => a.uuid == entry.uuid);
    if (driver && has(driver, S1.adaptedVehicle) && has(driver, S1.environmentalExpertise)) {
      return driver;
    }
  }

  return null;
}

export function isAdaptedVehicleActive(vehicle) {
  const driver = adaptedVehicleDriver(vehicle);
  if (!driver) {
    return false;
  }

  const terrain = terrainOf(vehicle);
  const inside = terrain ? deps.isInEnvironmentOfExpertise(driver, terrain) : null;
  return inside === true || (inside !== false && !!deps.isEnvironmentalExpertiseActive(driver));
}

/* -------------------------------------------- */
/*  Roll sources                                 */
/* -------------------------------------------- */

export function situationalRollSources(actor, target, ctx = {}) {
  const { item } = ctx;
  const isAttack = ctx.isAttack ?? isAttackItem(item);
  const sources = [];
  const add = (id, perk, mods) => sources.push({ id: `s1-${id}`, label: findSourced(actor, perk)?.name ?? perk, ...mods });
  if (!actor) {
    return { sources, consumes: [] };
  }

  // Urban Adaptation - the Urban Jungle Edge bought for this scene outside a city.
  if (!isAttack && urbanAdaptationAbilities(actor).includes('edge')) {
    add('urbanAdaptation', S1.urbanAdaptation, { edge: true });
  }

  // Earth Defense Command Benefits' Driving ↑2 (and its zero-G attack ↑2) are item rules.

  // Adapted Vehicles: the vehicle gets Environmental Expertise's "Edge on non-combat Skill Tests".
  if (!isAttack && actor.type == 'vehicle' && isAdaptedVehicleActive(actor)) {
    sources.push({ id: 's1-adaptedVehicle', label: findSourced(adaptedVehicleDriver(actor), S1.adaptedVehicle)?.name ?? 'Adapted Vehicles', edge: true });
  }

  // Jungle Fighter's light armor counting as Silent is item rules too (rules/conv8-slC8.test.js).

  // Weatherproof is item rules now (host-scoped RollModifiers on the upgrade, rules/conv3-slC3.test.js).

  // Environmental Enforcer (Hawk's Personnel Files, General Perk, p.174): "You gain an Edge on
  // Attack Skill Tests when taking the Maneuver effect in [a chosen] environment."
  const enforcer = findSourced(actor, S1.environmentalEnforcer);
  if (enforcer && isAttack && (item?.system?.damageType == 'maneuver' || ctx.isShove)) {
    const terrain = terrainOf(actor);
    const chosen = enforcer.flags?.essence20?.[FLAG.environments] ?? [];
    if (terrain && chosen.includes(terrain)) {
      add('environmentalEnforcer', S1.environmentalEnforcer, { edge: true });
    }
  }

  return { sources: sources.map(s => ({ shiftUp: 0, shiftDown: 0, edge: false, snag: false, ...s })), consumes: [] };
}

/* -------------------------------------------- */
/*  Dialog toggles                               */
/* -------------------------------------------- */

export function situationalToggles(actor, ctx = {}) {
  const { item } = ctx;
  const isAttack = isAttackItem(item);
  const toggles = [];

  // Environmental Enforcer on a scene with no terrain set.
  const enforcer = findSourced(actor, S1.environmentalEnforcer);
  if (enforcer && isAttack && item?.system?.damageType == 'maneuver' && !terrainOf(actor)) {
    toggles.push({ name: 's1EnvironmentalEnforcer', label: T('S1EnvironmentalEnforcerToggle'), type: 'checkbox' });
  }

  // City Slicker's Streetwise switch is a rule on the Perk (terrain:urban, pre-ticked when urban).

  return toggles;
}

/** The ↑/↓ that moves a roll from one skill's die to another's (the Urban Jungle substitution). */
export function skillSwapDelta(actor, fromSkill, toSkill) {
  const list = CONFIG.E20?.skillShiftList ?? [];
  const from = list.indexOf(actor?.system?.skills?.[fromSkill]?.shift);
  const to = list.indexOf(actor?.system?.skills?.[toSkill]?.shift);
  return from >= 0 && to >= 0 ? from - to : 0;
}

export async function situationalApplyDialog(actor, options) {
  const ext = options.ext ?? {};
  if (ext.s1EnvironmentalEnforcer) {
    options.edge = true;
  }
}

/* -------------------------------------------- */
/*  Specialized attacks                          */
/* -------------------------------------------- */

export function situationalSpecializes(actor, skill, item) {
  if (!isAttackItem(item)) {
    return false;
  }

  return urbanAdaptationAbilities(actor).includes('specialized')
    || (actor?.type == 'vehicle' && isAdaptedVehicleActive(actor));
}

/* -------------------------------------------- */
/*  Movement and environment hooks (patched)     */
/* -------------------------------------------- */

/** ROUGH_TERRAIN_IGNORERS entry. */
export function ignoresRoughTerrainS1(actor) {
  return urbanAdaptationAbilities(actor).includes('roughTerrain')
    || (actor?.type == 'vehicle' && isAdaptedVehicleActive(actor));
}

/* -------------------------------------------- */
/*  Surprise                                     */
/* -------------------------------------------- */

// Danger Sense (GI Joe CRB, Bodyguard, 6th level, p.110): the holder's own immunity and its Protected Target's
// within 10 ft are ConditionImmunity rules on the item (the second an aura with holder:protects -
// rules/conv10-slD10.test.js).

/* -------------------------------------------- */
/*  Use buttons                                  */
/* -------------------------------------------- */

async function grants() {
  return import("../../grants.mjs");
}

/** Environment choosers stored on the item itself. */
async function chooseTerrains(item, max) {
  const env = CONFIG.E20?.environments ?? {};
  const current = item.flags?.essence20?.[FLAG.environments] ?? [];
  const boxes = Object.entries(env).map(([key, label]) => `<label class="checkbox"><input type="checkbox" name="${key}" ${current.includes(key) ? 'checked' : ''}/> ${game.i18n.localize(label)}</label>`).join('<br>');
  const picked = await foundry.applications.api.DialogV2.wait({
    window: { title: item.name },
    classes: ["window-app", "e20-window"],
    content: `<p>${T('S1ChooseEnvironments', { max })}</p><div class="form-group">${boxes}</div>`,
    buttons: [
      { action: 'ok', label: T('DialogConfirmButton'), default: true,
        callback: (event, button) => Object.keys(env).filter(key => button.form.elements[key]?.checked) },
      { action: 'cancel', label: T('DialogCancelButton') },
    ],
    rejectClose: false,
  });
  if (!Array.isArray(picked)) {
    return null;
  }

  const chosen = picked.slice(0, max);
  await item.setFlag('essence20', FLAG.environments, chosen);
  return chosen;
}

const terrainLabel = key => game.i18n.localize(CONFIG.E20?.environments?.[key] ?? key);

export function survivalRanks(actor) {
  const list = CONFIG.E20?.skillShiftList ?? [];
  const index = list.indexOf(actor?.system?.skills?.survival?.shift);
  const untrained = list.indexOf('d20');
  return index >= 0 && untrained >= 0 ? Math.max(0, untrained - index) : 0;
}

const USES = [
  {
    // Urban Adaptation - spend a point (Free action), pick which Urban Jungle ability to take out of
    // the city for the rest of the scene.
    id: 's1-urbanAdaptation',
    matches: item => sourceOf(item) == S1.urbanAdaptation,
    canUse: item => urbanAdaptationLeft(item.parent) > 0,
    run: async (item, economy, pay) => {
      const actor = item.parent;
      const { chooseButtons } = await grants();
      const record = actor.getFlag('essence20', FLAG.urbanAdaptation);
      const owned = record?.epoch == getSceneEpoch() ? (record.abilities ?? []) : [];
      const choices = ['edge', 'specialized', 'roughTerrain'].filter(key => !owned.includes(key))
        .map(key => [key, T(`S1UrbanAbility${cap(key)}`)]);
      const ability = choices.length ? await chooseButtons(item.name, T('S1UrbanAdaptationPrompt'), choices) : null;
      if (!ability || !(await pay('free'))) {
        return null;
      }

      await actor.setFlag('essence20', FLAG.urbanAdaptation, { epoch: getSceneEpoch(), abilities: [...owned, ability] });
      await actor.setFlag('essence20', FLAG.urbanAdaptationPoints, (Number(actor.getFlag('essence20', FLAG.urbanAdaptationPoints)) || 0) + 1);
      return T('S1UrbanAdaptationUsed', { actor: actor.name, ability: T(`S1UrbanAbility${cap(ability)}`), left: urbanAdaptationLeft(actor) });
    },
  },
  // Ambush Master's extra attack is an item rule now (rules/conv6-slC6.test.js).
  {
    // Izuna Drop - see izunaDrop below.
    id: 's1-izunaDrop',
    matches: item => sourceOf(item) == S1.izunaDrop,
    run: async (item, economy, pay) => izunaDrop(item, pay),
  },
  {
    // Earth Defense Command, Space Kit: "During Equipment Requisition, you receive a free Limited Kit
    // tied to a Driving, Culture, Science, or Technology Specialization." Once per mission.
    id: 's1-spaceKit',
    matches: item => sourceOf(item) == S1.earthDefenseCommand,
    canUse: item => getUses(item.parent, FLAG.spaceKit, 'mission') < 1,
    run: async (item) => {
      const actor = item.parent;
      const { chooseSelect } = await grants();
      const specs = [];
      for (const skill of ['driving', 'culture', 'science', 'technology']) {
        for (const spec of Object.values(actor.system?.skills?.[skill]?.specializations ?? {})) {
          if (spec?.name) {
            specs.push({ value: `${skill}|${spec.name}`, label: `${game.i18n.localize(CONFIG.E20?.skills?.[skill] ?? skill)} (${spec.name})` });
          }
        }
      }

      if (!specs.length) {
        ui.notifications.warn(T('S1SpaceKitNoSpec'));
        return null;
      }

      const picked = await chooseSelect(item.name, T('S1SpaceKitPrompt'), specs);
      if (!picked) {
        return null;
      }

      const [skill, spec] = picked.split('|');
      const { makeKit } = await import("../../kits.mjs");
      await makeKit(actor, item, 'limited', skill, spec);
      await markUsed(actor, FLAG.spaceKit, { window: 'mission' });
      return T('S1SpaceKit', { actor: actor.name, spec: `${skill} (${spec})` });
    },
  },
  {
    // Environmental Enforcer: "For each Skill Rank you have in Survival, choose an environment."
    id: 's1-environmentalEnforcer',
    matches: item => sourceOf(item) == S1.environmentalEnforcer,
    run: async (item) => {
      const chosen = await chooseTerrains(item, Math.max(1, survivalRanks(item.parent)));
      return chosen ? T('S1EnvironmentsChosen', { item: item.name, list: chosen.map(terrainLabel).join(', ') || '-' }) : null;
    },
  },
];

/**
 * Izuna Drop (Intercontinental Adventures, General Perk, p.30): "If you are falling and an enemy is
 * within 10 feet of you, you can propel yourself towards them and attempt to Grapple them as a Free
 * action. On a success, you maneuver your target into a position beneath you, landing on top of them
 * at the end of your fall. Your target takes all the damage from the fall that you would have taken,
 * but if the fall damage exceeds their Health and renders them Defeated, you take the remaining
 * damage." Falling (GI Joe CRB p.222): "1 damage for every 10 feet it fell, to a maximum of 20
 * damage. The creature lands prone, unless it avoids taking damage from the fall."
 *
 * The Grapple is rolled as the better of Athletics/Acrobatics against the target's Toughness. On a
 * miss the faller simply lands. Damage to a target this user doesn't own goes to the GM as a button.
 */
export function fallDamage(feet) {
  return Math.min(20, Math.floor((Number(feet) || 0) / 10));
}

export function splitIzunaDamage(damage, targetHealth) {
  const absorbed = Math.min(damage, Math.max(0, Number(targetHealth) || 0));
  return { toTarget: damage, overflow: damage - absorbed };
}

async function izunaDrop(item, pay) {
  const actor = item.parent;
  const target = game.user?.targets?.first?.()?.actor;
  if (!target || target.id == actor.id) {
    ui.notifications.warn(T('S1IzunaNoTarget'));
    return null;
  }

  const feet = await foundry.applications.api.DialogV2.wait({
    window: { title: item.name },
    classes: ["window-app", "e20-window"],
    content: `<p>${T('S1IzunaPrompt')}</p><div class="form-group"><input type="number" name="feet" value="30" min="0" step="5"/></div>`,
    buttons: [
      { action: 'ok', label: T('DialogConfirmButton'), default: true, callback: (event, button) => Number(button.form.elements.feet.value) },
      { action: 'cancel', label: T('DialogCancelButton') },
    ],
    rejectClose: false,
  });
  if (typeof feet != 'number' || !(await pay('free'))) {
    return null;
  }

  const damage = fallDamage(feet);
  const skills = actor.system?.skills ?? {};
  const list = CONFIG.E20?.skillShiftList ?? [];
  const better = list.indexOf(skills.acrobatics?.shift) >= 0 && list.indexOf(skills.acrobatics?.shift) < list.indexOf(skills.athletics?.shift)
    ? 'acrobatics' : 'athletics';
  const { rollTest } = await grants();
  const dif = Number(target.system?.defenses?.toughness?.total) || 10;
  const { success } = await rollTest(actor, better, dif);
  const { applyDamage } = await import("../../combat.mjs");

  if (!success) {
    if (damage) {
      await applyDamage(actor, damage, 'blunt');
      await actor.toggleStatusEffect('prone', { active: true });
    }

    return T('S1IzunaMissed', { actor: actor.name, damage });
  }

  const { toTarget, overflow } = splitIzunaDamage(damage, target.system?.health?.value);
  if (target.isOwner) {
    await applyDamage(target, toTarget, 'blunt');
    if (toTarget) {
      await target.toggleStatusEffect('prone', { active: true });
    }
  } else {
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<p>${T('S1IzunaGmApply', { target: target.name, damage: toTarget })}</p>`
        + `<button type="button" data-e20-ext="s1IzunaDamage" data-target="${target.uuid}" data-damage="${toTarget}">${T('S1IzunaApplyButton')}</button>`,
    });
  }

  if (overflow) {
    await applyDamage(actor, overflow, 'blunt');
  }

  return T('S1IzunaHit', { actor: actor.name, target: target.name, damage: toTarget, overflow });
}

export async function onIzunaButton(message, button) {
  if (!game.user?.isGM) {
    ui.notifications.warn(T('S1GmOnly'));
    return;
  }

  const target = await fromUuid(button.dataset.target);
  const damage = Number(button.dataset.damage) || 0;
  if (!target) {
    return;
  }

  const { applyDamage } = await import("../../combat.mjs");
  await applyDamage(target, damage, 'blunt');
  if (damage) {
    await target.toggleStatusEffect('prone', { active: true });
  }

  button.disabled = true;
}

/* -------------------------------------------- */
/*  Turn, damage and rest housekeeping           */
/* -------------------------------------------- */

export async function situationalRest(actor) {
  if (actor?.flags?.essence20?.[FLAG.urbanAdaptationPoints]) {
    await actor.unsetFlag('essence20', FLAG.urbanAdaptationPoints);
  }
}

/* -------------------------------------------- */
/*  Registration                                 */
/* -------------------------------------------- */

export async function loadDeps() {
  const environment = await import("../../environment.mjs");
  deps.getEnvironment = (actor, options) => environment.getEnvironment(actor, options);
  deps.getTerrain = actor => environment.getTerrain(actor);
  const expertise = await import("../../environmental-expertise.mjs");
  deps.isInEnvironmentOfExpertise = (actor, terrain) => expertise.isInEnvironmentOfExpertise(actor, ...(terrain === undefined ? [] : [terrain]));
  deps.isEnvironmentalExpertiseActive = expertise.isEnvironmentalExpertiseActive;

  // Patched-in hook arrays (SCRATCH/integration/situational1-patch.cjs). Absent until the patch runs.
  const rough = await import("../../rough-terrain.mjs");
  rough.ROUGH_TERRAIN_IGNORERS?.push({ checkFn: ignoresRoughTerrainS1 });
}

registerRollSources(situationalRollSources);
registerDialogToggles(situationalToggles);
registerApplyDialog(situationalApplyDialog);
registerSpecializes(situationalSpecializes);
registerRest(situationalRest);
registerChatButton('s1IzunaDamage', onIzunaButton);
USES.forEach(use => registerUse(use));

if (typeof Hooks != 'undefined') {
  Hooks.once('setup', () => {
    loadDeps().catch(error => console.error('Essence20 | situational1 deps failed', error));
  });
  // Spacewalker's Evasion and Environmental Camouflage are item rules now; situational2.mjs's
  // updateToken hook refreshes any actor whose rules read where its token stands.
}
