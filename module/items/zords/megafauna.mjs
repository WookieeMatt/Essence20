import { registerDerived, registerPreRoll, registerUse } from "../../mechanics/item-hooks.mjs";
import { worldActors } from "../../mechanics/companions/companion-link.mjs";
import { TSafe as T } from "../shared/item-lang.mjs";
import { ats } from "../shared/personal-power-and-ranger-weapons.mjs";
import { findSourcedAny as findSourced, flagOf, sourceOf } from "../shared/item-lookups.mjs";

/**
 * Zord-side Features: Megafauna (Across the Stars, Zord Feature, p.103) - the Zord's beast form.
 * Rex Feature, Additional Zord, Terrorzord Nature and Phantom Focus: Ship Integration are their items' own
 * rules (module/rules/ext/a/ - scopes ownZord / driven, pick from ownedZords, SummonLimit).
 */

export const ZS = {
  megafauna: ats('c6plguiUVmJzGNsw'),
};

/* -------------------------------------------- */
/*  Whose Zord is whose                          */
/* -------------------------------------------- */

/** The Zord this pilot is sitting in the driver's seat of, if any. */
export function pilotedZord(pilot) {
  if (!pilot?.uuid) {
    return null;
  }

  return worldActors().find(actor => actor?.type == 'zord'
    && Object.values(actor.system?.actors ?? {}).some(crew => crew?.vehicleRole == 'driver' && crew.uuid == pilot.uuid)) ?? null;
}

/* -------------------------------------------- */
/*  Megafauna                                    */
/* -------------------------------------------- */

const MEGAFAUNA_FLAG = 'zord1Megafauna';
export const inMegafaunaForm = zord => !!findSourced(zord, ZS.megafauna) && !!flagOf(zord, MEGAFAUNA_FLAG);

/** "When the Zord answers its Call to Action, it arrives in its Megafauna Form". */
function megafaunaOnSummon(zord, changes) {
  const ready = changes?.flags?.essence20?.zordSummonReadyRound;
  if (zord?.type == 'zord' && ready != null && findSourced(zord, ZS.megafauna) && !flagOf(zord, MEGAFAUNA_FLAG)) {
    foundry.utils.setProperty(changes, `flags.essence20.${MEGAFAUNA_FLAG}`, true);
  }
}

/**
 * Pilot: "uses Animal Handling in place of Driving to operate the Megafauna Form."
 */
export function megafaunaPreRoll(actor, dataset) {
  if (dataset?.skill != 'driving') {
    return;
  }

  const zord = pilotedZord(actor);
  if (zord && inMegafaunaForm(zord)) {
    dataset.skill = 'animalHandling';
    dataset.essence = CONFIG.E20?.skillToEssence?.animalHandling ?? 'social';
  }
}

/* -------------------------------------------- */
/*  Hooks into rolls and data                    */
/* -------------------------------------------- */

export function zordDerived(actor) {
  const system = actor?.system;
  if (!system) {
    return;
  }

  // Megafauna: "The Zord has Smarts and Social Essence Scores of 3" - Terrorzord Nature's 5 and 4 (its Perk's
  // DerivedStat rules) leave a Megafauna Form alone. Its Evasion +3 is a rule on its pack item.
  if (actor.type == 'zord' && inMegafaunaForm(actor)) {
    if (system.essences?.smarts) {
      system.essences.smarts.value = 3;
    }

    if (system.essences?.social) {
      system.essences.social.value = 3;
    }
  }
}

/* -------------------------------------------- */
/*  Use buttons and registration                 */
/* -------------------------------------------- */

const USES = [
  {
    id: 'zord1Megafauna',
    matches: item => sourceOf(item) == ZS.megafauna && item.parent?.type == 'zord',
    async run(item, economy, pay) {
      // "The Zord's pilot can take a Standard action using the conversion key to convert to Zord Form."
      const zord = item.parent;
      const toBeast = !flagOf(zord, MEGAFAUNA_FLAG);
      if (!(await pay('standard'))) {
        return null;
      }

      await zord.setFlag('essence20', MEGAFAUNA_FLAG, toBeast);
      return T(toBeast ? 'Zord1MegafaunaOn' : 'Zord1MegafaunaOff', { name: zord.name });
    },
  },
];

registerDerived(zordDerived);
registerPreRoll(megafaunaPreRoll);
USES.forEach(registerUse);

// (Additional Zord's one-Zord-per-scene check is its SummonLimit rule's own preUpdateActor hook.)
globalThis.Hooks?.on?.('preUpdateActor', (actor, changes) => {
  if (actor?.type != 'zord') {
    return true;
  }

  megafaunaOnSummon(actor, changes);
  return true;
});

globalThis.Hooks?.on?.('createItem', (item, options, userId) => {
  if (userId != globalThis.game?.user?.id || !item.parent) {
    return;
  }

  const source = sourceOf(item);
  if (source == ZS.megafauna && item.parent.type == 'zord') {
    item.parent.setFlag('essence20', MEGAFAUNA_FLAG, true);
  }
});

// "The Zord cannot access its Combiner Zord Feature in Megafauna Form."
globalThis.Hooks?.on?.('updateActor', (actor, changes, options, userId) => {
  if (userId != globalThis.game?.user?.id || actor?.type != 'megaform' || changes?.system?.actors === undefined) {
    return;
  }

  const beasts = Object.values(actor.system?.actors ?? {}).map(entry => globalThis.fromUuidSync?.(entry.uuid)).filter(zord => zord && inMegafaunaForm(zord));
  if (beasts.length) {
    ui.notifications.warn(T('Zord1MegafaunaNoCombine', { names: beasts.map(z => z.name).join(', ') }));
  }
});
