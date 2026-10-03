import {
  registerApplyDialog, registerDefenseAdjust, registerDialogToggles, registerPostRoll,
  registerSceneAdvanced, registerSpellCost, registerUse, registerRest,
} from "../../extensions.mjs";
import { activateForWindow, getUses, isActiveForWindow, markUsed } from "../../scene-clock.mjs";
import { hasSourced, worldActors } from "../../companion-link.mjs";

/**
 * My Little Pony Core Rulebook, Knights of Canterlot and Story of the Seasons items: Waterrunning,
 * Acute Sense, the Hang-Ups (Bad with People, Jarring, Wanderlust), Extra Effective Spell and Long
 * Lasting Spell, Mystical Understanding (Refocus, Spellcosting, Essential Research) and Friendship Is
 * Mystical, Reactionary, Thick Skin, Wheel Excited, Competitor, Screech, Something Is Off, and Bestow
 * Expertise's scene limit.
 */

const pack = (p, id) => `Compendium.essence20.${p}.Item.${id}`;
const mlp = id => pack('mlp_crb', id);
export const MLP2 = {
  waterrunning: pack('knights_of_canterlot', 'F6mPryRgK7wLM0Yu'),
  extraEffectiveSpell: mlp('NOkMsAryMwYPDzNh'),
  friendshipIsMystical: mlp('jCh9Z1Nhb6SeiapO'),
  longLastingSpell: mlp('TJEbR90lLJYSF51p'),
  mysticalUnderstanding: mlp('23NeoRDRxlo0LpyQ'),
  reactionary: mlp('b4rCpGE6aJuxvoB5'),
  thickSkin: mlp('KakotlRk6PO2CRqu'),
  wheelExcited: mlp('nJP3Jv15O5MFTNcA'),
  screech: pack('story_of_the_seasons', '0OA0R7F3JejAQpkf'),
  somethingIsOff: pack('story_of_the_seasons', '1tLnQT580DafhUV4'),
};

const T = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));

function sourceOf(item) {
  return item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource;
}

function itemsOf(actor) {
  const items = actor?.items;
  return Array.isArray(items?.contents) ? items.contents : (items && typeof items[Symbol.iterator] == 'function' ? [...items] : []);
}

const itemOf = (actor, uuid) => itemsOf(actor).find(i => sourceOf(i) == uuid) ?? null;
const countOf = (actor, uuid) => itemsOf(actor).filter(i => sourceOf(i) == uuid).length;
const essenceOf = skill =>CONFIG.E20?.skillToEssence?.[skill];

// The Roll Options Dialog switch the roller ticks when a Social test is conning Something Is Off's holder.
export const CONNING_TOGGLE = 'somethingIsOffConning';

/** The actors of the tokens the current user has targeted. */
function targetedActors() {
  const targets = game?.user?.targets;
  return targets ? [...targets].map(t => t?.actor).filter(Boolean) : [];
}

function mysticalPoints(actor) {
  return actor?._getBaseRolePoints?.() ?? null;
}

async function spendMystical(actor, amount) {
  const points = mysticalPoints(actor);
  const left = Number(points?.system?.resource?.value) || 0;
  if (!points || left < amount) {
    ui.notifications.warn(T('E20.Mlp2NoMystical', { name: actor.name }));
    return false;
  }

  await points.update({ 'system.resource.value': left - amount });
  return true;
}

/* -------------------------------------------- */
/*  Dialog choices                               */
/* -------------------------------------------- */

export function mlp2Toggles(actor, { rolledSkill } = {}) {
  const toggles = [];
  const add = (name, label) => toggles.push({ name, label, type: 'checkbox' });
  const essence = essenceOf(rolledSkill);
  const label = (uuid, key, data = {}) => T(key, { perk: itemOf(actor, uuid)?.name ?? '', ...data });

  // Waterrunning (KoC p.48): the Acrobatics ↓1 for sharp turns and sudden stops on liquid.
  if (rolledSkill == 'acrobatics' && isActiveForWindow(actor, 'waterrunning', 'scene')) {
    add('waterrunning', T('E20.Mlp2ToggleWaterrunning'));
  }

  // Wheel Excited (p.65): "Edge on Skill Tests related to one type of vehicle".
  const wheel = itemOf(actor, MLP2.wheelExcited)?.flags?.essence20?.vehicleType;
  if (wheel) {
    add('wheelExcited', label(MLP2.wheelExcited, 'E20.Mlp2ToggleVehicle', { type: T(`E20.Mlp2Vehicle.${wheel}`) }));
  }

  // Something Is Off (Story of the Seasons p.131) is the DEFENDER's Perk, but only the roller knows whether
  // this Social test is "actively conning" the target in a deal rather than a "simple lie" - so the roller
  // says so here, and somethingIsOffDefense reads the answer. Offered only when a targeted actor has it.
  const conned = (essence == 'social' || rolledSkill == 'deception') ? targetedActors().find(a => hasSourced(a, MLP2.somethingIsOff)) : null;
  if (conned) {
    add(CONNING_TOGGLE, T('E20.Mlp2ToggleConning', { perk: itemOf(conned, MLP2.somethingIsOff)?.name ?? '', name: conned.name }));
  }

  return toggles;
}

export async function mlp2ApplyDialog(actor, options) {
  const ext = options.ext ?? {};
  const edge = () => (options.snag ? (options.snag = false) : (options.edge = true));
  options.shiftDown = (options.shiftDown ?? 0) + (ext.waterrunning ? 1 : 0);

  if (ext.wheelExcited) {
    edge();
  }
}

/* -------------------------------------------- */
/*  Spell costs                                  */
/* -------------------------------------------- */

/**
 * Extra Effective Spell (p.123): pay double the Cost to double the effect. Long Lasting Spell (p.124):
 * "double the duration for double the cost". Mystical Understanding - Spellcosting (p.95): "You can
 * reduce the Cost to cast a spell you've mastered by the number of Mystical Points you spend as a Free
 * action."
 */
export async function mlp2SpellCost(item, cost, dataset = {}) {
  const actor = item?.actor ?? item?.parent;
  if (dataset?.sharpcasterFree) {
    return cost;
  }

  const effective = hasSourced(actor, MLP2.extraEffectiveSpell);
  const lasting = hasSourced(actor, MLP2.longLastingSpell);
  const points = hasSourced(actor, MLP2.mysticalUnderstanding) ? Number(mysticalPoints(actor)?.system?.resource?.value) || 0 : 0;
  if (!effective && !lasting && !points) {
    return cost;
  }

  const answer = await foundry.applications.api.DialogV2.wait({
    window: { title: item.name },
    classes: ["window-app", "e20-window"],
    content: [
      effective ? `<label class="flexrow"><input type="checkbox" name="effective" /> ${T('E20.Mlp2EffectiveOption')}</label>` : '',
      lasting ? `<label class="flexrow"><input type="checkbox" name="lasting" /> ${T('E20.Mlp2LastingOption')}</label>` : '',
      points ? `<div class="form-group"><label>${T('E20.Mlp2SpellcostingOption', { left: points })}</label><input type="number" name="points" value="0" min="0" max="${points}" /></div>` : '',
    ].join(''),
    buttons: [
      { action: 'ok', label: T('E20.DialogConfirmButton'), default: true, callback: (event, button) => ({
        effective: !!button.form.elements.effective?.checked, lasting: !!button.form.elements.lasting?.checked,
        points: Math.max(0, Math.min(points, Number(button.form.elements.points?.value) || 0)),
      }) },
      { action: 'cancel', label: T('E20.DialogCancelButton') },
    ],
    rejectClose: false,
  });
  if (!answer || answer == 'cancel') {
    return null;
  }

  let next = cost;
  const notes = [];
  if (answer.effective) {
    next *= 2;
    notes.push(T('E20.Mlp2EffectiveNote'));
  }

  if (answer.lasting) {
    next *= 2;
    notes.push(T('E20.Mlp2LastingNote'));
  }

  if (answer.points && (await spendMystical(actor, answer.points))) {
    next = Math.max(0, next - answer.points);
    notes.push(T('E20.Mlp2SpellcostingNote', { points: answer.points }));
  }

  if (notes.length) {
    ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<p>${item.name}: ${notes.join(' ')}</p>` });
  }

  return next;
}

/* -------------------------------------------- */
/*  After a roll                                 */
/* -------------------------------------------- */

export async function mlp2PostRoll(actor, results, checkContext) {
  const rider = checkContext?.riderContext ?? {};
  // Waterrunning: a successful cast on the target (or the caster) for the scene.
  if (rider.itemSource == MLP2.waterrunning && (results ?? []).some(r => r.success)) {
    const target = game.user?.targets?.first?.()?.actor ?? actor;
    await activateForWindow(target, 'waterrunning', 'scene');
  }
}

/**
 * Something Is Off (Story of the Seasons p.131): +1 Cleverness per pick (up to 4) "when somepony is trying
 * to cheat you in a deal" - never against "simple lies or deception". Only when the roller ticked the
 * conning switch in their Roll Options Dialog (mlp2Toggles), which reaches here as ctx.ext.
 */
export function somethingIsOffDefense(attacker, defender, defenseType, ctx = {}) {
  return defenseType == 'cleverness' && ctx?.ext?.[CONNING_TOGGLE] ? Math.min(4, countOf(defender, MLP2.somethingIsOff)) : 0;
}

/* -------------------------------------------- */
/*  Use buttons                                  */
/* -------------------------------------------- */

async function select(title, prompt, options) {
  const { chooseSelect } = await import("../../grants.mjs");
  return chooseSelect(title, prompt, options);
}

const USES = [
  {
    // Mystical Understanding - Refocus ("Your Current Spellcasting Rank ... returns to your Total
    // Spellcasting Rank. Refocus is a Standard action and costs 2 Mystical Points") and Essential
    // Research ("temporarily increase an Essence score ... spending a Mystical Point ... for the rest of
    // the day ... only 3 times per day"). This Use claims the item's Use button, so the Magically Fit
    // In benefit (helpers/magically-fit-in.mjs, which the older banked-buffs dispatch would otherwise
    // reach) is offered here as a third choice rather than going unreachable.
    id: 'mlp2Mystical', matches: item => sourceOf(item) == MLP2.mysticalUnderstanding,
    async run(item, economy, pay) {
      const actor = item.parent;
      const { chooseButtons } = await import("../../grants.mjs");
      const choice = await chooseButtons(item.name, T('E20.Mlp2MysticalPrompt'), [
        ['refocus', T('E20.Mlp2Refocus')], ['research', T('E20.Mlp2Research')], ['fitIn', T('E20.MagicallyFitInPickTitle')],
      ]);
      if (choice == 'fitIn') {
        const { activateMagicallyFitIn, canUseMagicallyFitIn } = await import("../../magically-fit-in.mjs");
        if (!canUseMagicallyFitIn(actor)) {
          ui.notifications.warn(T('E20.Mlp2NoMystical', { name: actor.name }));
          return null;
        }

        // It runs its own Skill / Mystical Point picker; only report it if points were actually spent.
        const before = Number(mysticalPoints(actor)?.system?.resource?.value) || 0;
        await activateMagicallyFitIn(actor);
        const after = Number(mysticalPoints(actor)?.system?.resource?.value) || 0;
        return after < before ? T('E20.PerkUsedNotification', { perk: T('E20.MagicallyFitInPickTitle'), actor: actor.name }) : null;
      }

      if (choice == 'refocus') {
        if (!(await pay('standard')) || !(await spendMystical(actor, 2))) {
          return null;
        }

        await actor.update({ 'system.skills.spellcasting.shiftDown': 0 });
        return T('E20.Mlp2Refocused', { name: actor.name });
      }

      if (choice == 'research') {
        const research = actor.flags?.essence20?.essentialResearch ?? [];
        if (research.length >= 3) {
          ui.notifications.warn(T('E20.Mlp2ResearchDone'));
          return null;
        }

        const essence = await select(item.name, T('E20.Mlp2PickEssence'), ['strength', 'speed', 'smarts', 'social'].map(e => ({ value: e, label: T(`E20.Essence${e.capitalize()}`) })));
        if (!essence || !(await spendMystical(actor, 1))) {
          return null;
        }

        const current = actor.system.essences[essence];
        await actor.update({ [`system.essences.${essence}.max`]: current.max + 1, [`system.essences.${essence}.value`]: current.value + 1, 'flags.essence20.essentialResearch': [...research, essence] });
        return T('E20.Mlp2Researched', { name: actor.name, essence: T(`E20.Essence${essence.capitalize()}`) });
      }

      return null;
    },
  },
  {
    // Friendship Is Mystical (p.95): "you can spend Mystical Points to use your Mystical Understanding and
    // Expanded Mysticism on friends, as long as they are no more than 50ft away." The targeted friend
    // gets Magically Fit In's ranks, Fortify, or Heal, from the holder's points.
    id: 'mlp2FriendshipMystical', matches: item => sourceOf(item) == MLP2.friendshipIsMystical,
    async run(item, economy, pay) {
      const actor = item.parent;
      const friend = game.user?.targets?.first?.()?.actor;
      if (!friend) {
        ui.notifications.warn(T('E20.PickTarget'));
        return null;
      }

      const { chooseButtons } = await import("../../grants.mjs");
      const choice = await chooseButtons(item.name, T('E20.Mlp2FriendPrompt', { friend: friend.name }), [
        ['fitIn', T('E20.Mlp2FitIn')], ['fortify', T('E20.Mlp2Fortify')], ['heal', T('E20.Mlp2Heal')],
      ]);
      const { needsGmRelay, relayToGm } = await import("../../gm-relay.mjs");
      const write = (changes) => (needsGmRelay(friend) ? relayToGm(friend, 'update', [changes]) : friend.update(changes));
      if (choice == 'fitIn') {
        const skill = await select(item.name, T('E20.Mlp2PickSkill'), Object.entries(CONFIG.E20.skills).map(([value, l]) => ({ value, label: T(l) })));
        if (!skill || !(await spendMystical(actor, 1))) {
          return null;
        }

        const { magicallyFitInValue } = await import("../../magically-fit-in.mjs");
        await write({ 'flags.essence20.magicallyFitInBonus': magicallyFitInValue(skill, 1) });
        return T('E20.Mlp2FriendFitIn', { name: actor.name, friend: friend.name });
      }

      if (choice == 'fortify') {
        const defense = await select(item.name, T('E20.Mlp2PickDefense'), ['toughness', 'evasion'].map(d => ({ value: d, label: T(CONFIG.E20.defenses[d]) })));
        if (!defense || !(await pay('free')) || !(await spendMystical(actor, 1))) {
          return null;
        }

        await write({ 'flags.essence20.expandedMysticismFortifyType': defense });
        return T('E20.Mlp2FriendFortify', { name: actor.name, friend: friend.name });
      }

      if (choice == 'heal') {
        const health = friend.system?.health ?? {};
        const missing = Math.max(0, (health.max ?? 0) - (health.value ?? 0));
        const left = Number(mysticalPoints(actor)?.system?.resource?.value) || 0;
        const amount = Math.min(missing, left);
        if (!amount || !(await pay('standard')) || !(await spendMystical(actor, amount))) {
          return null;
        }

        await write({ 'system.health.value': (health.value ?? 0) + amount });
        return T('E20.Mlp2FriendHeal', { name: actor.name, friend: friend.name, amount });
      }

      return null;
    },
  },
  {
    // Reactionary (p.90): "If you're not first in Initiative order, you can roll a new Initiative check as
    // a Free action once per round to set your Initiative for the next round."
    id: 'mlp2Reactionary', matches: item => sourceOf(item) == MLP2.reactionary,
    canUse: item => !!game?.combat && getUses(item.parent, 'reactionary', 'encounter') < (game.combat?.round ?? 0),
    async run(item, economy, pay) {
      const combat = game.combat;
      const combatant = combat?.combatants?.find?.(c => c.actor?.id == item.parent.id);
      if (!combatant || combat.turns?.[0]?.id == combatant.id) {
        ui.notifications.warn(T('E20.Mlp2AlreadyFirst'));
        return null;
      }

      if (!(await pay('free'))) {
        return null;
      }

      await markUsed(item.parent, 'reactionary', { window: 'encounter', count: combat.round - getUses(item.parent, 'reactionary', 'encounter') });
      await combat.rollInitiative([combatant.id]);
      return T('E20.Mlp2Rerolled', { name: item.parent.name });
    },
  },
  {
    // Thick Skin (p.78): "At 7th, and 15th level, you gain +1 Health, and a +1 bonus to a Defense. Your
    // Thick Skin bonus to Defense must go to a different Defense every time." Picks the Defenses and
    // switches on the item's own effects.
    id: 'mlp2ThickSkin', matches: item => sourceOf(item) == MLP2.thickSkin,
    async run(item) {
      const level = Number(item.parent.system?.level) || 1;
      const tiers = level >= 15 ? 2 : (level >= 7 ? 1 : 0);
      const picks = [];
      for (let i = 0; i < tiers; i++) {
        const options = ['toughness', 'evasion', 'willpower', 'cleverness'].filter(d => !picks.includes(d)).map(d => ({ value: d, label: T(CONFIG.E20.defenses[d]) }));
        const pick = await select(item.name, T('E20.Mlp2ThickSkinPick', { level: i ? 15 : 7 }), options);
        if (!pick) {
          return null;
        }

        picks.push(pick);
      }

      const updates = item.effects.map(effect => {
        const key = effect.changes?.[0]?.key ?? '';
        const defense = /defenses\.(\w+)\.bonus/.exec(key)?.[1];
        const on = defense ? picks.includes(defense) : (/15th/.test(effect.name) ? tiers >= 2 : tiers >= 1);
        return { _id: effect.id, disabled: !on };
      });
      await item.updateEmbeddedDocuments('ActiveEffect', updates);
      return T('E20.Mlp2ThickSkinSet', { name: item.parent.name });
    },
  },
  {
    // Wheel Excited: "(Land, Sea, or Air, which you pick when you gain this Perk)".
    id: 'mlp2Wheel', matches: item => sourceOf(item) == MLP2.wheelExcited,
    async run(item) {
      const type = await select(item.name, T('E20.Mlp2PickVehicle'), ['land', 'sea', 'air'].map(v => ({ value: v, label: T(`E20.Mlp2Vehicle.${v}`) })));
      if (!type) {
        return null;
      }

      await item.setFlag('essence20', 'vehicleType', type);
      return T('E20.Mlp2WheelSet', { name: item.parent.name, type: T(`E20.Mlp2Vehicle.${type}`) });
    },
  },
  {
    // Screech (Story of the Seasons p.131): a Targeting attack, 1 Blunt, one target.
    id: 'mlp2Screech', matches: item => sourceOf(item) == MLP2.screech,
    canUse: item => !itemsOf(item.parent).some(i => i.flags?.essence20?.grantedBy == item.id),
    async run(item) {
      const id = foundry.utils.randomID();
      await item.parent.createEmbeddedDocuments('Item', [
        { _id: id, name: item.name, type: 'weapon', system: { classification: { size: 'sidearm' }, availability: 'standard', equipped: true, hardpoint: { type: 'none' } }, flags: { essence20: { grantedBy: item.id, natural: true } } },
        { name: item.name, type: 'weaponEffect', system: { classification: { skill: 'targeting', style: 'energy' }, damageType: 'blunt', damageValue: 1, numTargets: 1, numHands: '0', range: { value: 30, long: 60 } }, flags: { essence20: { parentId: id } } },
      ], { keepId: true });
      return T('E20.GrantGained', { name: item.parent.name, item: item.name, what: item.name });
    },
  },
];

/* -------------------------------------------- */
/*  Registration                                 */
/* -------------------------------------------- */

registerDialogToggles(mlp2Toggles);
registerApplyDialog(mlp2ApplyDialog);
registerSpellCost(mlp2SpellCost);
registerPostRoll(mlp2PostRoll);
registerDefenseAdjust(somethingIsOffDefense);
USES.forEach(registerUse);

// Essential Research: "You lose these once you've had a night's sleep."
registerRest(async actor => {
  const research = actor.flags?.essence20?.essentialResearch ?? [];
  if (!research.length) {
    return;
  }

  const updates = { 'flags.essence20.essentialResearch': [] };
  for (const essence of research) {
    const current = actor.system.essences[essence];
    const lost = research.filter(e => e == essence).length;
    updates[`system.essences.${essence}.max`] = current.max - lost;
    updates[`system.essences.${essence}.value`] = Math.min(current.value, current.max - lost);
  }

  await actor.update(updates);
});

// Bestow Expertise (MLP CRB p.137) lasts the scene: the Specializations it gave go when the GM starts a
// new one.
registerSceneAdvanced(async () => {
  for (const actor of worldActors()) {
    const bestowed = actor.flags?.essence20?.bestowedExpertise ?? [];
    if (!bestowed.length) {
      continue;
    }

    const updates = { 'flags.essence20.bestowedExpertise': [] };
    for (const { skill, key } of bestowed) {
      updates[`system.skills.${skill}.specializations.${key}`] = new foundry.data.operators.ForcedDeletion();
    }

    await actor.update(updates);
  }
});
