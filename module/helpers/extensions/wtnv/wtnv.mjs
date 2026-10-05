import {
  registerApplyDialog, registerDialogToggles, registerHitRider, registerRollSources, registerSpecializes, registerUse,
} from "../../extensions.mjs";
import { hasSourced, worldActors } from "../../companion-link.mjs";

/**
 * Welcome to Night Vale Citizens' Guide and Field Guide to Action & Adventure items that needed a
 * roll hook, a Use button or a natural attack: Obsessive, Dog Person, Third Eye, the Night Vale Animal
 * Perks and Staggering Sway. (Community Martial Arts, Vehicle Whisperer, Acute Senses, Nobility and
 * Gridlock Authority's roll switches, and the Use buttons of Double Vision, The List, Nobility and
 * More Than Worldly, are their own item rules now.)
 */

const wtnv = id => `Compendium.essence20.wtnv_citizens_guide.Item.${id}`;
const fgaa = id => `Compendium.essence20.field_guide_action_adventure.Item.${id}`;
export const WTNV = {
  obsessive: wtnv('eOgtG24LKGR6OE0v'),
  dogPerson: wtnv('U5arLtyo8eEgl2Ck'),
  thirdEye: wtnv('XolO5C6pgFt8WQJZ'),
  delicateStomach: wtnv('W04dEJSSgaWOeebQ'),
  pincers: wtnv('WwU4Ebk3IY6Yr2jy'),
  quills: wtnv('m9rPGuVLv5cmfqkm'),
  serratedTail: wtnv('MZCPG1uZPRUMzz4N'),
  replacementTeeth: wtnv('wuHnZ1qtGrd8il8a'),
  staggeringSway: fgaa('DulMH7OAwrg3G85A'),
};

const T = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));

function sourceOf(item) {
  return item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource;
}

function itemOf(actor, uuid) {
  const items = actor?.items;
  const list = Array.isArray(items?.contents) ? items.contents : (items && typeof items[Symbol.iterator] == 'function' ? [...items] : []);
  return list.find(item => sourceOf(item) == uuid) ?? null;
}

/* -------------------------------------------- */
/*  Roll sources                                 */
/* -------------------------------------------- */

/**
 * @returns {{sources: Array, consumes: Array}}
 */
export function wtnvRollSources(actor, target, { rolledSkill } = {}) {
  const sources = [];

  // Obsessive (Hang-Up, p.29): "Whenever you make a Skill Test that doesn't directly relate to your
  // current obsession, you take ↓1." The obsession is the Skill chosen on the Hang-Up; the ↓1 is a
  // listed source the player can untick when the test does relate.
  const obsession = itemOf(actor, WTNV.obsessive)?.flags?.essence20?.obsession;
  if (obsession && rolledSkill && rolledSkill != obsession) {
    sources.push({ id: 'obsessive', label: itemOf(actor, WTNV.obsessive).name, shiftDown: 1 });
  }

  // Dog Person (p.47): "When you interact with a feral dog or even a Radon Canyon coyote, you gain ↑1
  // on Skill Tests". Read off the target's creature tags or name.
  if (target && hasSourced(actor, WTNV.dogPerson) && isDogOrCoyote(target)) {
    sources.push({ id: 'dogPerson', label: itemOf(actor, WTNV.dogPerson).name, shiftUp: 1 });
  }

  return { sources, consumes: [] };
}

export function isDogOrCoyote(actor) {
  const tags = String(actor?.system?.creatureTags ?? '').toLowerCase();
  return /\b(dog|coyote|canine)s?\b/.test(`${tags} ${String(actor?.name ?? '').toLowerCase()}`);
}

/**
 * Dog Person: "are considered to have a Specialization in Animal Handling for the dog you're
 * interacting with."
 */
export function wtnvSpecializes(actor, skill) {
  const target = globalThis.game?.user?.targets?.first?.()?.actor;
  return skill == 'animalHandling' && hasSourced(actor, WTNV.dogPerson) && !!target && isDogOrCoyote(target);
}

/* -------------------------------------------- */
/*  Dialog choices                               */
/* -------------------------------------------- */

/**
 * The situational halves the table decides: each is a switch in the Roll Options Dialog, shown only
 * when it could apply.
 */
export function wtnvToggles(actor) {
  const toggles = [];
  const add = (name, label) => toggles.push({ name, label, type: 'checkbox' });

  // Dog Person, with no dog targeted: "When you interact with a feral dog or even a Radon Canyon coyote".
  const target = globalThis.game?.user?.targets?.first?.()?.actor;
  if (hasSourced(actor, WTNV.dogPerson) && !(target && isDogOrCoyote(target))) {
    add('dogPerson', T('E20.WtnvToggleDogs', { perk: itemOf(actor, WTNV.dogPerson).name }));
  }

  // Third Eye (p.47): "ignore the first ↓1 in Skill Tests that rely on vision."
  if (hasSourced(actor, WTNV.thirdEye)) {
    add('thirdEye', T('E20.WtnvToggleVision', { perk: itemOf(actor, WTNV.thirdEye).name }));
  }

  return toggles;
}

export async function wtnvApplyDialog(actor, options, { rolledSkill } = {}) {
  const ext = options.ext ?? {};
  const up = n => {
    options.shiftUp = (options.shiftUp ?? 0) + n;
  };


  if (ext.dogPerson) {
    up(1);
    if (rolledSkill == 'animalHandling') {
      options.isSpecialized = true;
    }
  }

  if (ext.thirdEye && (options.shiftDown ?? 0) > 0) {
    options.shiftDown -= 1;
  }

}

/* -------------------------------------------- */
/*  Hits                                         */
/* -------------------------------------------- */

/**
 * Staggering Sway (Field Guide, Face Focus, 13th level, p.66): "when an ally deals Stun damage to a
 * creature, they deal 1 additional Stun." Any ally of someone holding it.
 */
export async function staggeringSwayHit(actor, target, result, rider, tools) {
  if (!result?.damageValue || (rider?.damageType ?? result.damageType) != 'stun') {
    return;
  }

  const holder = staggeringSwayHolder(actor);
  if (holder) {
    tools.damageBonusNote(result, 1, itemOf(holder, WTNV.staggeringSway)?.name ?? 'Staggering Sway');
  }
}

export function staggeringSwayHolder(actor) {
  const mine = actor?.getActiveTokens?.()?.[0]?.document?.disposition ?? actor?.prototypeToken?.disposition ?? 1;
  return worldActors().find(other => other?.uuid && other.uuid != actor?.uuid && hasSourced(other, WTNV.staggeringSway)
    && (other.getActiveTokens?.()?.[0]?.document?.disposition ?? other.prototypeToken?.disposition ?? 1) == mine) ?? null;
}

/* -------------------------------------------- */
/*  Use buttons                                  */
/* -------------------------------------------- */

async function chooseSkill(title) {
  const { chooseSelect } = await import("../../grants.mjs");
  return chooseSelect(title, T('E20.WtnvObsessionPrompt'), Object.entries(CONFIG.E20.skills).map(([value, label]) => ({ value, label: T(label) })));
}

/** A pet's natural attack, as the weapon + effect pair. */
function naturalAttack(name, { damage, type, range = null, traits = [], skill = 'might' }) {
  const id = foundry.utils.randomID();
  return [
    { _id: id, name, type: 'weapon', system: { classification: { size: 'sidearm' }, availability: 'standard', equipped: true, hardpoint: { type: 'none' }, traits }, flags: { essence20: { natural: true } } },
    {
      name, type: 'weaponEffect',
      system: {
        classification: { skill: range ? 'targeting' : skill, style: range ? 'projectile' : 'melee' }, damageType: type, damageValue: damage, numTargets: 1, numHands: '0',
        range: range ? { value: range[0], long: range[1] } : { reachMultiplier: 1 },
      },
      flags: { essence20: { parentId: id } },
    },
  ];
}

// The Night Vale Animal Perks that give the pet an attack (p.74-76). "All animal pet attacks are treated
// as Unarmed Combat"; a Short Range attack reaches 30ft/60ft.
const PET_ATTACKS = {
  [WTNV.delicateStomach]: { name: 'Hairball', damage: 1, type: 'acid', range: [30, 60] },
  [WTNV.pincers]: { name: 'Pincers', damage: 1, type: 'blunt' },
  [WTNV.quills]: { name: 'Quills', damage: 1, type: 'sharp', range: [30, 60] },
  [WTNV.serratedTail]: { name: 'Serrated Tail', damage: 1, type: 'sharp', traits: ['trip'] },
};

/** Give the pet its attack when the Perk lands on it - and from the Use button if it's missing. */
export async function grantPetAttack(pet, perk) {
  const spec = PET_ATTACKS[sourceOf(perk)];
  const list = pet?.items?.contents ?? [];
  if (!spec || list.some(i => i.flags?.essence20?.grantedBy == perk.id)) {
    return null;
  }

  const [weapon, effect] = naturalAttack(spec.name, spec);
  weapon.flags.essence20.grantedBy = perk.id;
  await pet.createEmbeddedDocuments('Item', [weapon, effect], { keepId: true });
  return spec.name;
}

const USES = [
  {
    // Obsessive: pick the current obsession.
    id: 'wtnvObsessive', matches: item => sourceOf(item) == WTNV.obsessive,
    async run(item) {
      const skill = await chooseSkill(item.name);
      if (!skill) {
        return null;
      }

      await item.setFlag('essence20', 'obsession', skill);
      return T('E20.WtnvObsessionSet', { name: item.parent.name, skill: T(CONFIG.E20.skills[skill]) });
    },
  },
  {
    // Replacement Teeth (Animal Perk, p.76): "As a Standard action, your pet can clamp down on an enemy and
    // give them the Immobilized Condition until the end of their next turn."
    id: 'wtnvReplacementTeeth', matches: item => sourceOf(item) == WTNV.replacementTeeth,
    async run(item, economy, pay) {
      const target = game.user?.targets?.first?.()?.actor;
      if (!target) {
        ui.notifications.warn(T('E20.PickTarget'));
        return null;
      }

      if (!(await pay('standard'))) {
        return null;
      }

      const { applyTimedCondition } = await import("../../timed-status.mjs");
      await applyTimedCondition(target, 'immobilized', 1);
      return T('E20.WtnvClamp', { name: item.parent.name, target: target.name });
    },
  },
  {
    // The attack Animal Perks - the Use button adds the pet's attack if it isn't there yet.
    id: 'wtnvPetAttack', matches: item => !!PET_ATTACKS[sourceOf(item)] && item.parent?.type == 'companion',
    canUse: item => !(item.parent?.items?.contents ?? []).some(i => i.flags?.essence20?.grantedBy == item.id),
    async run(item) {
      const name = await grantPetAttack(item.parent, item);
      return name ? T('E20.GrantGained', { name: item.parent.name, item: item.name, what: name }) : null;
    },
  },
];

/* -------------------------------------------- */
/*  Registration                                 */
/* -------------------------------------------- */

registerRollSources(wtnvRollSources);
registerSpecializes(wtnvSpecializes);
registerDialogToggles(wtnvToggles);
registerApplyDialog(wtnvApplyDialog);
registerHitRider(staggeringSwayHit);
USES.forEach(registerUse);

// A pet gaining an attack Animal Perk gets the attack with it.
globalThis.Hooks?.on?.('createItem', (item, options, userId) => {
  if (userId == globalThis.game?.user?.id && item.parent?.type == 'companion' && PET_ATTACKS[sourceOf(item)]) {
    grantPetAttack(item.parent, item);
  }
});

