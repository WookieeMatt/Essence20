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
  registerAfterDamage, registerApplyDialog, registerDerived, registerDialogToggles, registerRoundStart, registerUse,
} from "../../mechanics/item-hooks.mjs";
import { worldActors } from "../../mechanics/companions/companion-link.mjs";
import {
  chat, holds, isCombinerForm, isGiganticOrLarger, itemsOf, megaformsContaining, rosterOf, sourceOf, T, traitsOf, writeDoc, ZORD2,
} from "./combiner-roster-helpers.mjs";

export const MERGE_FLAG = 'zord2Merge';
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
  const update = { 'system.energonSpentToMerge': (form.system.energonSpentToMerge ?? 0) + members.reduce((s, m) => s + (m.energon ?? 0), 0) };
  const present = new Set(Object.values(form.system.actors ?? {}).map(e => e.uuid));
  for (const member of members) {
    const actor = fromUuidSync(member.uuid);
    if (!actor || present.has(actor.uuid)) continue;
    update[`system.actors.${foundry.utils.randomID(4)}`] = { uuid: actor.uuid, img: actor.img, name: actor.name, type: actor.type };
  }

  update[`flags.essence20.-=${MERGE_FLAG}`] = null;
  await writeDoc(form, 'update', update);

  const components = componentsOf(form, [...roster, ...members.map(m => fromUuidSync(m.uuid)).filter(Boolean)]);
  let healed = false;
  if (components.some(c => holds(c, ZORD2.invigoratingConnection))) {
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

async function beginMerge(item, economy, pay) {
  const actor = item.parent;
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

  const member = { uuid: actor.uuid, name: actor.name, energon: cost.energon };
  if (!game.combat) {
    await completeMerge(form, [member]);
    return null;
  }

  const next = {
    combatId: game.combat.id,
    round: game.combat.round,
    spPaid: !!(pending?.spPaid || storyPoints),
    members: { ...(pending?.combatId == game.combat.id ? pending.members : {}), [actor.id]: member },
  };
  await writeDoc(form, 'setFlag', 'essence20', MERGE_FLAG, next);
  return T('Zord2MergeBegun', { name: actor.name, form: form.name, energon: cost.energon, sp: storyPoints });
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
      await form.update({ [`flags.essence20.-=${MERGE_FLAG}`]: null });
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
    const components = componentsOf(form);
    const safe = isGiganticOrLarger(form.system?.size);
    const saved = [];
    for (const component of components) {
      if (safe && (component.system?.health?.value ?? 1) <= 0 && traitsOf(component, 'safeRelease').length) {
        await writeDoc(component, 'update', { 'system.health.value': 1 });
        saved.push(component.name);
      }

      await writeDoc(component, 'toggleStatusEffect', 'prone', { active: true });
    }

    const update = { 'system.energonSpentToMerge': 0, 'system.energon.normal.value': 0 };
    for (const [key, entry] of Object.entries(form.system.actors ?? {})) {
      if (components.some(c => c.uuid == entry.uuid)) {
        update[`system.actors.-=${key}`] = null;
      }
    }

    await writeDoc(form, 'update', update);
    await chat(form, T('Zord2BreakApart', { form: form.name })
      + (saved.length ? ` ${T('Zord2SafeRelease', { names: saved.join(', ') })}` : ''));
  } finally {
    breaking.delete(form.id);
  }
}

registerAfterDamage(async (actor, dealt) => {
  if (!(dealt > 0)) return;
  for (const form of megaformsContaining(actor).filter(isCombinerForm)) {
    form.reset?.();
    if (form.system?.isDefeated) {
      await breakApart(form);
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

  const system = actor.system;
  let extraMax = 0;
  let extraValue = 0;
  for (const component of componentsOf(actor)) {
    if (!traitsOf(component, 'coreBody').length) continue;
    const max = component.system?.health?.max ?? 0;
    const value = Math.max(0, component.system?.health?.value ?? 0);
    extraMax += max;
    extraValue += value;
    const row = (system.participantHealth ?? []).find(r => r.name == component.name);
    if (row) {
      row.max += max;
      row.value += value;
    }
  }

  if (extraMax) {
    system.combinedHealthMax = (system.combinedHealthMax ?? 0) + extraMax;
    system.combinedHealthValue = (system.combinedHealthValue ?? 0) + extraValue;
    if (system.health) {
      system.health.max = (system.health.max ?? 0) + extraMax;
      system.health.value = (system.health.value ?? 0) + extraValue;
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
