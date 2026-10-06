import {
  registerSceneAdvanced, registerUse,
} from "../../extensions.mjs";
import { worldActors } from "../../companion-link.mjs";

/**
 * My Little Pony Core Rulebook, Knights of Canterlot and Story of the Seasons items: Acute Sense, the Hang-Ups (Bad with
 * People, Jarring, Wanderlust), Friendship Is Mystical, Competitor, and Bestow Expertise's scene limit. (Thick Skin's
 * Defense picks are a Use rule on the Perk - rules/conv10-slE10.test.js.) (Mystical Understanding's Refocus, Essential
 * Research and Magically Fit In are a Use, a RollModifier and a rest Trigger on the Perk - rules/conv12-slI12.test.js.)
 * (Extra Effective Spell, Long Lasting Spell, Spellcosting and Reactionary are rules on their items -
 * rules/conv10-slD10.test.js.)
 * (Waterrunning and Something Is Off are rules on their items - rules/conv10-slC10.test.js.)
 * (Wheel Excited's vehicle pick and Screech's attack are their own item rules now.)
 */

const pack = (p, id) => `Compendium.essence20.${p}.Item.${id}`;
const mlp = id => pack('mlp_crb', id);
export const MLP2 = {
  friendshipIsMystical: mlp('jCh9Z1Nhb6SeiapO'),
};

const T = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));

function sourceOf(item) {
  return item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource;
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
/*  Use buttons                                  */
/* -------------------------------------------- */

async function select(title, prompt, options) {
  const { chooseSelect } = await import("../../grants.mjs");
  return chooseSelect(title, prompt, options);
}

const USES = [
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
];

/* -------------------------------------------- */
/*  Registration                                 */
/* -------------------------------------------- */

USES.forEach(registerUse);

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
