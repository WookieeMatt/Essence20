/**
 * Beast Mode's higher tiers and its scene length (Cobra Codex, Ranger Guerilla Focus, p.59):
 * "You can spend an Adaptation Point as a Free action to gain the Engrafted Mutation General Perk
 * (see page 80) for 1 scene. At 10th level, you can instead gain the benefits of two Engrafted
 * Mutation General Perks, or the Evolving Mutation General Perk. At 20th level, you can instead
 * gain the benefits of three Engrafted Mutation General Perks, two Evolving Mutation General Perks,
 * or the Outright Mutation General Perk."
 *
 * items/forms/beast-mode.mjs spends the Adaptation Point and grants one Engrafted Mutation, recording
 * it in flags.essence20.beastModeGrantedItemId. When that flag is set on a 10th+ level actor, this
 * asks which package they want and makes the grant match; the extra copies are remembered here
 * and go when Beast Mode is switched off (the flag cleared) or when the scene ends.
 */
import { registerSceneAdvanced } from "../../mechanics/item-hooks.mjs";
import { IDS, onHook, T, changed, has, isActiveGm, num, worldActors } from "../shared/resource-team-lookups.mjs";

const GRANT_FLAG = 'beastModeGrantedItemId';
const EXTRA_FLAG = 'beastModeExtraIds';

/** The packages a Ranger of this level may pick: [key, [uuid, ...]]. */
export function beastModePackages(level) {
  const E = IDS.engraftedMutation;
  const V = IDS.evolvingMutation;
  const packages = [['engrafted1', [E]]];
  if (level >= 10) {
    packages.push(['engrafted2', [E, E]], ['evolving1', [V]]);
  }

  if (level >= 20) {
    packages.push(['engrafted3', [E, E, E]], ['evolving2', [V, V]], ['outright1', [IDS.outrightMutation]]);
  }

  return packages;
}

async function applyPackage(actor, grantedId) {
  const level = num(actor.system?.level);
  const packages = beastModePackages(level);
  if (packages.length < 2) {
    return;
  }

  const { chooseButtons, grantCopy } = await import("../../mechanics/resources/grants.mjs");
  const pick = await chooseButtons(T('ResBeastMode'), T('ResBeastModePrompt'),
    packages.map(([key]) => [key, T(`ResBeastModePackage.${key}`)]));
  const uuids = packages.find(([key]) => key == pick)?.[1];
  if (!uuids || pick == 'engrafted1') {
    return;
  }

  // The grant already holds one Engrafted Mutation. Keep it as the first of an Engrafted package;
  // otherwise it's replaced by the package's first item, which becomes the one Beast Mode tracks.
  const extras = [];
  if (uuids[0] != IDS.engraftedMutation) {
    const first = await grantCopy(actor, uuids[0], { flags: { beastMode: true } });
    await actor.items.get(grantedId)?.delete();
    await actor.update({ [`flags.essence20.${GRANT_FLAG}`]: first?.id ?? null }, { essence20BeastMode: true });
  }

  for (const uuid of uuids.slice(1)) {
    const created = await grantCopy(actor, uuid, { flags: { beastMode: true } });
    if (created) {
      extras.push(created.id);
    }
  }

  await actor.setFlag('essence20', EXTRA_FLAG, extras);
}

async function clearExtras(actor) {
  const extras = actor.flags?.essence20?.[EXTRA_FLAG] ?? [];
  const ids = extras.filter(id => actor.items?.get(id));
  if (ids.length) {
    await actor.deleteEmbeddedDocuments('Item', ids);
  }

  await actor.unsetFlag('essence20', EXTRA_FLAG);
}

onHook('updateActor', (actor, changes, options, userId) => {
  if (userId != game.user?.id || !has(actor, IDS.beastMode)) {
    return;
  }

  if (!changes?.flags?.essence20) {
    return;
  }

  const grant = changed(changes, `flags.essence20.${GRANT_FLAG}`);
  const removed = !actor.flags?.essence20?.[GRANT_FLAG];
  if (removed && actor.flags?.essence20?.[EXTRA_FLAG]) {
    clearExtras(actor).catch(error => console.error('Essence20 | Beast Mode', error));
  } else if (grant && !options?.essence20BeastMode && !actor.flags?.essence20?.[EXTRA_FLAG]) {
    applyPackage(actor, grant).catch(error => console.error('Essence20 | Beast Mode', error));
  }
});

// "for 1 scene"
registerSceneAdvanced(async () => {
  if (!isActiveGm()) {
    return;
  }

  for (const actor of worldActors()) {
    const grantedId = actor.flags?.essence20?.[GRANT_FLAG];
    if (!grantedId) {
      continue;
    }

    await clearExtras(actor);
    await actor.items?.get(grantedId)?.delete();
    await actor.unsetFlag('essence20', GRANT_FLAG);
  }
});
