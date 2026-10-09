/**
 * Merging into, and breaking out of, a Transformers Combiner form (The Enigma of Combination).
 *
 * Merging (p.43), in short: each Matched Combiner member pays 2 Energon Points and a Standard action
 * (Gestalt: 3); if every member ends the round within Reach of another, they start the next round
 * combined. Out of combat only the Energon is paid. PCs merging with NPCs also pay a Story Point per
 * NPC each time.
 *
 * A Use button on the Gestalt Combiner / Matched Combiner / Universal Component Perk charges all of
 * that and records the member as pending on the Combiner form (flags.essence20.zord2Merge); the GM
 * client checks Reach when the next round starts (the end of the merging round) and links everyone
 * into system.actors, adding what they spent to energonSpentToMerge (which already drives the form's
 * half-of-what-was-spent pool in actor.mjs).
 *
 * - Efficient Combination (Component Ace, 3rd level, p.34): joining costs only a Free action and 1
 *   Energon Point.
 * - Universal Component (General Perk, p.41): no Story Point to merge; the Energon and Standard
 *   action are still paid.
 * - Universal Receptors (Combiner feature, p.43): merging with NPCs costs the group one Story Point
 *   less (not below 0).
 * - Macro-Magnetic Linkage (armor upgrade, p.54): Reach counts double for how far apart merging
 *   components may be.
 * - Invigorating Connection (Component Ace, 6th level, p.34): at the end of a successful merging
 *   round every component regains 1 Health - once, however many hold the Perk.
 *
 * Breaking apart (p.45): with more than half its components out of action, the Combiner is Defeated
 * and splits, each component Prone within its space and Reach, and the form's leftover Energon is
 * lost. Safe Release (Combiner feature, p.42): a forced exit always leaves at least 1 Health; Gigantic
 * forms and up only.
 *
 * Core Body (Combiner feature, p.42): base Health counts double for the component's share of the
 * combined form; Gigantic forms and up only. actor.mjs skipped it for Combiners; added
 * here in derived data the same way _prepareMegaformZordData doubles a Megazord part's share.
 *
 * Gestalt Hunter (General Perk, p.39): targeting one component of a Combined Form costs ↓1 instead of
 * a Snag. The base rule (p.44: a Snag for singling out one component) is a Roll Options Dialog checkbox whenever the
 * target is a Megaform.
 */
import {
  registerAfterDamage, registerApplyDialog, registerSceneAdvanced, registerDerived, registerDialogToggles, registerRoundStart, registerUse,
} from "../../mechanics/item-hooks.mjs";
import { worldActors } from "../../mechanics/companions/companion-link.mjs";
import { addParticipantBonus, BONUS_TAKEN_FLAG } from "../../mechanics/vehicles/megaform-bonus-health.mjs";
import { getMegaformParticipants } from "../../mechanics/vehicles/megaform-participants.mjs";
import {
  chat, holds, isCombinerForm, isGiganticOrLarger, isResponsible, itemsOf, megaformsContaining, rosterOf, sourceOf, T, traitsOf, writeDoc, ZORD2,
} from "./combiner-roster-helpers.mjs";

export const MERGE_FLAG = 'zord2Merge';
// Invigorating Connection's 1 Health has been given for this combination (cleared when it breaks apart).
const INVIGORATED_FLAG = 'zord2Invigorated';
const MERGE_PERKS = [ZORD2.gestaltCombiner, ZORD2.matchedCombiner, ZORD2.universalComponent];

const componentsOf = (form, roster = rosterOf(form)) => roster.filter(a => !['zord', 'vehicle', 'megaform'].includes(a.type));
const pendingOf = form => form?.flags?.essence20?.[MERGE_FLAG] ?? null;

/**
 * What merging costs this actor: {energon, action}.
 * @param {Actor} actor
 * @param {Item} perk   The Perk whose Use button was pressed.
 * @param {Number} teamSize   How many components the finished form will have (for Universal Component).
 */
export function mergeCost(actor, perk, teamSize) {
  if (holds(actor, ZORD2.efficientCombination)) {
    return { energon: 1, action: 'free' };
  }

  const source = sourceOf(perk);
  const gestalt = source == ZORD2.gestaltCombiner || (source == ZORD2.universalComponent && teamSize >= 4);
  return { energon: gestalt ? 3 : 2, action: 'standard' };
}

/**
 * Story Points a PC owes to merge with NPC components: one per NPC, less one if anyone on the team
 * brings Universal Receptors.
 */
export function storyPointCost(actor, members) {
  if (actor?.type == 'npc') {
    return 0;
  }

  const npcs = members.filter(m => m?.type == 'npc' && m !== actor).length;
  const receptors = [actor, ...members].some(m => traitsOf(m, 'universalReceptors').length);
  return Math.max(0, npcs - (receptors ? 1 : 0));
}

/** Edge-to-edge distance between two tokens, in scene units (feet). */
export function tokenGap(a, b, grid = canvas?.grid) {
  const size = grid?.size || 100;
  const distance = grid?.distance || 5;
  const gapX = Math.max(0, Math.abs(a.center.x - b.center.x) - (a.w + b.w) / 2);
  const gapY = Math.max(0, Math.abs(a.center.y - b.center.y) - (a.h + b.h) / 2);
  return (Math.max(gapX, gapY) / size) * distance;
}

export function mergeReach(actor) {
  const reach = CONFIG.E20?.actorReach?.[actor?.system?.size] ?? 5;
  return holds(actor, ZORD2.macroMagneticLinkage) ? reach * 2 : reach;
}

export function withinMergeReach(a, b) {
  const ta = a?.getActiveTokens?.()?.[0];
  const tb = b?.getActiveTokens?.()?.[0];
  if (!ta || !tb) {
    // Nothing on the map to measure - the GM's call, so don't block it.
    return true;
  }

  return tokenGap(ta, tb) <= Math.max(mergeReach(a), mergeReach(b));
}

/** Link members into the form, bank their Energon, and heal for Invigorating Connection. */
export async function completeMerge(form, members) {
  const roster = rosterOf(form);
  // The form's Energon pool is made of what was spent to merge (EoC p.45): half of it, rounded up, as its max - and
  // filled by what each joining member adds, not left empty for the GM to fill.
  const spentBefore = Number(form.system.energonSpentToMerge) || 0;
  const spentAfter = spentBefore + members.reduce((s, m) => s + (m.energon ?? 0), 0);
  const gained = Math.ceil(spentAfter / 2) - Math.ceil(spentBefore / 2);
  const update = {
    'system.energonSpentToMerge': spentAfter,
    'system.energon.normal.value': Math.min(Math.ceil(spentAfter / 2), (Number(form.system.energon?.normal?.value) || 0) + gained),
  };
  const present = new Set(Object.values(form.system.actors ?? {}).map(e => e.uuid));
  for (const member of members) {
    const actor = fromUuidSync(member.uuid);
    if (!actor || present.has(actor.uuid)) continue;
    update[`system.actors.${foundry.utils.randomID(4)}`] = {
      uuid: actor.uuid, img: actor.img, name: actor.name, type: actor.type, ...(isGuestEntry(member) ? { guestEpoch: member.guestEpoch } : {}),
    };
  }

  update[`flags.essence20.${MERGE_FLAG}`] = new foundry.data.operators.ForcedDeletion();
  await writeDoc(form, 'update', update);

  const components = componentsOf(form, [...roster, ...members.map(m => fromUuidSync(m.uuid)).filter(Boolean)]);
  let healed = false;
  // Invigorating Connection (EoC p.34) heals 1 Health once per combination - out of combat each member's merge completes
  // on its own, so the form remembers it was done until it breaks apart.
  if (!form.getFlag?.('essence20', INVIGORATED_FLAG) && components.some(c => holds(c, ZORD2.invigoratingConnection))) {
    await writeDoc(form, 'update', { [`flags.essence20.${INVIGORATED_FLAG}`]: true });
    for (const component of components) {
      const health = component.system?.health;
      if (health && health.value < health.max) {
        await writeDoc(component, 'update', { 'system.health.value': Math.min(health.max, health.value + 1) });
      }
    }

    healed = true;
  }

  await chat(form, T('Zord2MergeComplete', { form: form.name, names: members.map(m => m.name).join(', ') })
    + (healed ? ` ${T('Zord2InvigoratingConnection')}` : ''));
}

/** Mode Lock stops a character converting - merging as a Combiner included (EoC p.49). */
export function modeLocked(actor) {
  if (actor?.statuses?.has?.('modeLock')) {
    ui.notifications.warn(T('Zord2ModeLocked', { name: actor.name }));
    return true;
  }

  return false;
}

/** A roster entry (or pending member) joining for one scene without a Combiner Perk (EoC p.43, Other Cybertronians). */
const isGuestEntry = entry => entry?.guestEpoch !== undefined && entry?.guestEpoch !== null;

/** Whether the actor can merge on its own (Gestalt / Matched Combiner, Universal Component). */
export const holdsMergePerk = actor => MERGE_PERKS.some(perk => holds(actor, perk));

// The scene is over: a guest's single scene in the form ends (EoC p.43).
registerSceneAdvanced(async () => {
  for (const form of worldActors().filter(a => a?.type == 'megaform' && isCombinerForm(a) && isResponsible(a))) {
    const gone = Object.entries(form.system.actors ?? {}).filter(([, entry]) => isGuestEntry(entry));
    if (gone.length) {
      await form.update(Object.fromEntries(gone.map(([key]) => [`system.actors.${key}`, new foundry.data.operators.ForcedDeletion()])));
      await chat(form, T('Zord2GuestLeaves', { form: form.name, names: gone.map(([, entry]) => entry.name).join(', ') }));
    }
  }
});

/**
 * Other Cybertronians (EoC p.43): a PC without Gestalt / Matched Combiner merges for a single scene by spending a Story
 * Point as well as the Energon and the Standard action. At least one member must be able to merge, and only one such
 * PC can be part of the form at a time. Reached by dropping the PC on the Combiner form's sheet.
 * @param {Actor} actor
 * @param {Actor} form
 * @param {Function} [pay]   Spends the action (default: the action economy's Standard)
 */
export async function beginGuestMerge(actor, form, pay = null) {
  if (modeLocked(actor)) {
    return null;
  }

  if (Object.values(form.system.actors ?? {}).some(e => e.uuid == actor.uuid)) {
    ui.notifications.warn(T('Zord2AlreadyMerged', { form: form.name }));
    return null;
  }

  const pending = pendingOf(form);
  const pendingMembers = Object.values(pending?.members ?? {});
  const team = [...componentsOf(form), ...pendingMembers.map(m => fromUuidSync(m.uuid)).filter(Boolean)];
  if (!team.some(member => MERGE_PERKS.some(perk => holds(member, perk)))) {
    ui.notifications.warn(T('Zord2GuestNeedsCombiner', { form: form.name }));
    return null;
  }

  if ([...Object.values(form.system.actors ?? {}), ...pendingMembers].some(isGuestEntry)) {
    ui.notifications.warn(T('Zord2OneGuest', { form: form.name }));
    return null;
  }

  const cost = holds(actor, ZORD2.efficientCombination) ? { energon: 1, action: 'free' } : { energon: team.length + 1 >= 4 ? 3 : 2, action: 'standard' };
  const energon = actor.system?.energon?.normal?.value ?? 0;
  if (energon < cost.energon) {
    ui.notifications.warn(T('Zord2NotEnoughEnergon', { cost: cost.energon }));
    return null;
  }

  const storyPoints = 1 + (pending?.spPaid ? 0 : storyPointCost(actor, team));
  const sp = await import("../../mechanics/resources/story-points.mjs");
  if (!sp.canSpendForActor(actor, storyPoints)) {
    ui.notifications.warn(T('Zord2NotEnoughStoryPoints', { cost: storyPoints }));
    return null;
  }

  const confirmed = await foundry.applications.api.DialogV2.confirm({
    window: { title: form.name },
    content: `<p>${T('Zord2GuestConfirm', { name: actor.name, form: form.name, energon: cost.energon, sp: storyPoints })}</p>`,
    rejectClose: false,
  });
  if (!confirmed) {
    return null;
  }

  const payAction = pay ?? (async action => {
    const { spend } = await import("../../mechanics/actions/action-economy.mjs");
    return !(await spend(actor, action, { source: form.name }))?.blocked;
  });
  if (!(await payAction(cost.action))) {
    return null;
  }

  await actor.update({ 'system.energon.normal.value': energon - cost.energon });
  await sp.spendForActor(actor, storyPoints);
  const { getSceneEpoch } = await import("../../mechanics/resources/scene-clock.mjs");
  // The extra Story Point is the guest's own; only an NPC surcharge (storyPointCost) counts as the team's paid one.
  return queueMember(form, pending, { uuid: actor.uuid, name: actor.name, energon: cost.energon, guestEpoch: getSceneEpoch() }, storyPoints - 1);
}

/** Merge now (out of combat) or at the end of this round. `storyPoints` is what this member just spent. */
async function queueMember(form, pending, member, storyPoints) {
  if (!game.combat) {
    await completeMerge(form, [member]);
    return null;
  }

  const actor = fromUuidSync(member.uuid);
  const next = {
    combatId: game.combat.id,
    round: game.combat.round,
    spPaid: !!(pending?.spPaid || storyPoints),
    members: { ...(pending?.combatId == game.combat.id ? pending.members : {}), [actor?.id ?? member.uuid]: member },
  };
  await writeDoc(form, 'setFlag', 'essence20', MERGE_FLAG, next);
  return T('Zord2MergeBegun', { name: member.name, form: form.name, energon: member.energon, sp: storyPoints });
}

async function beginMerge(item, economy, pay) {
  const actor = item.parent;
  if (modeLocked(actor)) {
    return null;
  }

  const forms = worldActors().filter(a => a?.type == 'megaform' && isCombinerForm(a));
  if (!forms.length) {
    ui.notifications.warn(T('Zord2NoCombinerForm'));
    return null;
  }

  const { chooseSelect } = await import("../../mechanics/resources/grants.mjs");
  const formId = forms.length == 1 ? forms[0].id
    : await chooseSelect(item.name, T('Zord2PickCombinerForm'), forms.map(f => ({ value: f.id, label: f.name })));
  const form = forms.find(f => f.id == formId);
  if (!form) return null;

  if (Object.values(form.system.actors ?? {}).some(e => e.uuid == actor.uuid)) {
    ui.notifications.warn(T('Zord2AlreadyMerged', { form: form.name }));
    return null;
  }

  const pending = pendingOf(form);
  const pendingMembers = Object.values(pending?.members ?? {}).map(m => fromUuidSync(m.uuid)).filter(Boolean);
  const team = [...componentsOf(form), ...pendingMembers.filter(m => m !== actor)];
  const cost = mergeCost(actor, item, team.length + 1);
  const energon = actor.system?.energon?.normal?.value ?? 0;
  if (energon < cost.energon) {
    ui.notifications.warn(T('Zord2NotEnoughEnergon', { cost: cost.energon }));
    return null;
  }

  const storyPoints = pending?.spPaid ? 0 : storyPointCost(actor, team);
  const sp = storyPoints ? await import("../../mechanics/resources/story-points.mjs") : null;
  if (storyPoints && !sp.canSpendForActor(actor, storyPoints)) {
    ui.notifications.warn(T('Zord2NotEnoughStoryPoints', { cost: storyPoints }));
    return null;
  }

  if (!(await pay(cost.action))) {
    return null;
  }

  await actor.update({ 'system.energon.normal.value': energon - cost.energon });
  if (storyPoints) {
    await sp.spendForActor(actor, storyPoints);
  }

  return queueMember(form, pending, { uuid: actor.uuid, name: actor.name, energon: cost.energon }, storyPoints);
}

registerUse({
  id: 'zord2-combiner-merge',
  matches: item => MERGE_PERKS.includes(sourceOf(item)),
  canUse: item => !megaformsContaining(item.parent).some(isCombinerForm),
  run: beginMerge,
});

/** End of the merging round: whoever is in Reach combines. */
export async function resolvePendingMerges(combat) {
  for (const form of worldActors().filter(a => a?.type == 'megaform' && isCombinerForm(a))) {
    const pending = pendingOf(form);
    if (!pending || pending.combatId != combat?.id || pending.round >= combat.round) {
      continue;
    }

    const members = Object.values(pending.members ?? {});
    const actors = members.map(m => fromUuidSync(m.uuid)).filter(Boolean);
    const everyone = [...componentsOf(form), ...actors];
    const inReach = everyone.length > 1 && actors.every(a => everyone.some(o => o !== a && withinMergeReach(a, o)));
    if (inReach) {
      await completeMerge(form, members);
    } else {
      await form.update({ [`flags.essence20.${MERGE_FLAG}`]: new foundry.data.operators.ForcedDeletion() });
      await chat(form, T('Zord2MergeFailed', { form: form.name }));
    }
  }
}

registerRoundStart(resolvePendingMerges);

/* -------------------------------------------- */
/*  Breaking apart                               */
/* -------------------------------------------- */

const breaking = new Set();

export async function breakApart(form) {
  if (breaking.has(form.id)) return;
  breaking.add(form.id);
  try {
    // A Megazord falls apart into its Zords the same way, each Prone (PR CRB p.140).
    const combiner = isCombinerForm(form);
    const components = combiner ? componentsOf(form) : getMegaformParticipants(form);
    const safe = combiner && isGiganticOrLarger(form.system?.size);
    const saved = [];
    for (const component of components) {
      if (safe && (component.system?.health?.value ?? 1) <= 0 && traitsOf(component, 'safeRelease').length) {
        await writeDoc(component, 'update', { 'system.health.value': 1 });
        saved.push(component.name);
      }

      await writeDoc(component, 'toggleStatusEffect', 'prone', { active: true });
    }

    const update = {
      'system.energonSpentToMerge': 0, 'system.energon.normal.value': 0,
      [`flags.essence20.${INVIGORATED_FLAG}`]: new foundry.data.operators.ForcedDeletion(), [`flags.essence20.${BONUS_TAKEN_FLAG}`]: new foundry.data.operators.ForcedDeletion(), [`flags.essence20.${HOLD_FLAG}`]: new foundry.data.operators.ForcedDeletion(),
    };
    for (const [key, entry] of Object.entries(form.system.actors ?? {})) {
      if (components.some(c => c.uuid == entry.uuid)) {
        update[`system.actors.${key}`] = new foundry.data.operators.ForcedDeletion();
      }
    }

    await writeDoc(form, 'update', update);
    await chat(form, T(combiner ? 'Zord2BreakApart' : 'Zord2MegazordBreakApart', { form: form.name })
      + (saved.length ? ` ${T('Zord2SafeRelease', { names: saved.join(', ') })}` : ''));
  } finally {
    breaking.delete(form.id);
  }
}

/* A Combiner may postpone breaking apart for 1d2 turns by spending 1 Energon Point per combined member, active or not
   (EoC p.45). Kept on the form as the round it holds until; the round start checks it again. */
const HOLD_FLAG = 'zord2HoldTogether';

/** The round a postponed break-apart holds until, in this combat - or null. */
export function heldUntil(form, combat = game.combat) {
  const hold = form?.flags?.essence20?.[HOLD_FLAG];
  return hold && combat && hold.combatId == combat.id ? Number(hold.round) : null;
}

/** Offer the Energon to hold a Defeated Combiner together; true when it holds. */
export async function offerHoldTogether(form) {
  if (!isCombinerForm(form) || !game.combat) {
    return false;
  }

  const cost = componentsOf(form).length;
  const pool = Number(form.system?.energon?.normal?.value) || 0;
  if (!cost || pool < cost) {
    return false;
  }

  const confirmed = await foundry.applications.api.DialogV2.confirm({
    window: { title: form.name },
    content: `<p>${T('Zord2HoldTogetherOffer', { form: form.name, cost, pool })}</p>`,
    rejectClose: false,
  });
  if (!confirmed) {
    return false;
  }

  const roll = await new Roll('1d2').evaluate();
  const round = game.combat.round + roll.total;
  await writeDoc(form, 'update', {
    'system.energon.normal.value': pool - cost,
    [`flags.essence20.${HOLD_FLAG}`]: { combatId: game.combat.id, round },
  });
  await chat(form, T('Zord2HoldTogether', { form: form.name, cost, turns: roll.total, round }));
  return true;
}

/** A Defeated form: still held together, held now, or it breaks apart. */
async function settleDefeat(form) {
  form.reset?.();
  if (!form.system?.isDefeated) {
    return;
  }

  const held = heldUntil(form);
  if (held !== null && game.combat.round < held) {
    return;
  }

  if (await offerHoldTogether(form)) {
    return;
  }

  await breakApart(form);
}

registerAfterDamage(async (actor, dealt) => {
  if (!(dealt > 0)) return;
  // A Transformers Combiner (EoC p.45) or a Power Rangers Megazord (PR CRB p.140): more than half down, it falls apart.
  for (const form of megaformsContaining(actor)) {
    await settleDefeat(form);
  }
});

// The postponement runs out at the start of the round it named: still Defeated, it breaks apart (or pays again).
registerRoundStart(async combat => {
  for (const form of worldActors().filter(a => a?.type == 'megaform' && isCombinerForm(a) && isResponsible(a))) {
    const held = heldUntil(form, combat);
    if (held !== null && combat.round >= held) {
      await form.update({ [`flags.essence20.${HOLD_FLAG}`]: new foundry.data.operators.ForcedDeletion() });
      await settleDefeat(form);
    }
  }
});

/* -------------------------------------------- */
/*  Core Body, Gestalt Hunter                    */
/* -------------------------------------------- */

export function coreBodyDerived(actor) {
  if (actor?.type != 'megaform' || !isCombinerForm(actor) || !isGiganticOrLarger(actor.system?.size)) {
    return;
  }

  // Core Body doubles the member's Health while merged: extra Health the form's damage uses up first
  // (mechanics/vehicles/megaform-bonus-health.mjs, which builds the rows and totals).
  for (const component of componentsOf(actor)) {
    if (traitsOf(component, 'coreBody').length) {
      addParticipantBonus(actor, component, component.system?.health?.max ?? 0);
    }
  }
}

registerDerived(coreBodyDerived);

const targetActor = () => game.user?.targets?.first?.()?.actor ?? null;

export function focusToggles(actor, ctx) {
  const target = targetActor();
  if (ctx?.item?.type != 'weaponEffect' || target?.type != 'megaform') {
    return [];
  }

  const hunter = isCombinerForm(target) && holds(actor, ZORD2.gestaltHunter);
  return [{ name: 'zord2FocusComponent', label: T(hunter ? 'Zord2FocusComponentHunter' : 'Zord2FocusComponent'), type: 'checkbox' }];
}

export function applyFocus(actor, options) {
  if (!options?.ext?.zord2FocusComponent) return;
  const target = targetActor();
  if (isCombinerForm(target) && holds(actor, ZORD2.gestaltHunter)) {
    options.shiftDown = (options.shiftDown ?? 0) + 1;
  } else {
    options.snag = true;
  }
}

registerDialogToggles(focusToggles);
registerApplyDialog(applyFocus);

export { itemsOf };
