import { actorHasPerk } from "./perks.mjs";
import { buildDetectionModes } from "./blindsight.mjs";

// Quick Thinker (MLP CRB, General Perk, p.125): "you gain a number of Free actions equal to your
// Smarts Essence minus 2, instead of your Speed Essence minus 2."
const QUICK_THINKER_ID = "Compendium.essence20.mlp_crb.Item.i0PwoR0hDC0vyDD2";

// University Days (WTNV Citizen's Guide, General Perk, p.53) - verbatim identical text/effect to
// Quick Thinker above, just a different compendium item (a separate book, same mechanic).
const UNIVERSITY_DAYS_ID = "Compendium.essence20.wtnv_citizens_guide.Item.5T3DHQjLjyM9J5tS";

// Foot Soldier (TF CRB, Warrior Role Perk, 1st level, p.91): "When in Bot Mode, treat your Speed
// as if it was 2 higher when calculating how many Free actions you get on your turn." Unlike
// Quick Thinker/University Days above (a different SOURCE Essence for the same -2 formula), this
// keeps Speed as the source and just raises it by 2 - and only applies in Bot Mode.
const FOOT_SOLDIER_ID = "Compendium.essence20.tf_crb.Item.VXQ32nRPF4qEYTZR";

/**
 * Handle looking up tokens associated with actor and changing size
 * @param {Actor} actor  The actor
 * @param {Number} width The actor's new width
 * @param {Number} height The actor's new width
 */
export function resizeTokens(actor, width, height) {
  const tokens = actor?.getActiveTokens();
  for (const token of tokens) {
    token.document.update({
      "height": height,
      "width": width,
    });
  }
}

/**
 * Changes the image for all tokens tied to the actor
 * @param {Actor} actor The actor who is changing
 * @param {String} newImage The location of the image file
 */
export function changeTokenImage(actor, newImage){
  // No art to switch to (a Morphed image or Alt Mode token image that was never set) - leave
  // the tokens as they are. Writing an empty path here used to blank every token and throw
  // "Requested texture path is empty" from the token animation, once per token, on every
  // morph and transform. helpers/morph-state.mjs tells the user the art is missing.
  if (!newImage) {
    return;
  }

  const tokens = actor?.getActiveTokens();
  for (const token of tokens) {
    token.document.update({
      "texture.src": newImage,
    });
  }
}

/**
 * Pushes the actor's currently-computed vision grant (system.visionGrant, set by
 * Essence20Actor#_prepareVision()) onto every placed token and the actor's prototype token, so
 * items like Night Vision Goggles actually change what the token can see on a scene. Falls back
 * to the token's normal "basic" vision rather than force-disabling sight when no vision-granting
 * item is present, so a GM's own sight configuration isn't clobbered.
 *
 * Note this does NOT handle blocking vision outright for Blinded/Asleep/Unconscious - setting
 * TokenDocument.sight.enabled to false does not actually blank a token's perception the way
 * Foundry's own CONFIG.specialStatusEffects.BLIND handling does (confirmed by direct testing:
 * the "blinded" status, wired to BLIND in essence20.mjs, works; sight.enabled=false alone does
 * not). See syncAutoBlindStatus() below, which reuses Foundry's real Blind status for that.
 * @param {Actor} actor The actor whose vision grant should be applied to its tokens
 */
export async function applyVisionToTokens(actor) {
  const grant = actor?.system?.visionGrant;
  const sight = grant
    ? { enabled: true, visionMode: grant.mode, range: grant.range }
    : { visionMode: "basic", range: 0 };

  // Blindsight rides along on the same update: it is a detectionModes entry rather than a
  // sight mode, and the two are independent (see helpers/blindsight.mjs).
  const range = actor?.system?.blindsightRange ?? 0;

  const tokens = actor?.getActiveTokens() ?? [];
  for (const token of tokens) {
    await token.document.update({
      sight,
      detectionModes: buildDetectionModes(token.document.detectionModes, range),
    });
  }

  if (actor?.prototypeToken) {
    await actor.update({
      "prototypeToken.sight": sight,
      "prototypeToken.detectionModes": buildDetectionModes(actor.prototypeToken.detectionModes, range),
    });
  }
}

/**
 * Asleep/Unconscious have no Foundry-native equivalent to Blinded's CONFIG.specialStatusEffects.BLIND
 * wiring (see essence20.mjs), but closed eyes should black out vision exactly the same way. Rather
 * than reinventing that (sight.enabled=false alone doesn't work - see applyVisionToTokens() above),
 * this keeps the actor's real "blinded" status effect in sync with whether it's Asleep or
 * Unconscious, so Foundry's own already-working Blind handling takes care of vision for us.
 *
 * A flags.essence20.autoBlindFromSleep marker distinguishes an auto-applied Blinded from one the
 * GM/player toggled on manually for some other reason, so waking up never strips a manually-applied
 * Blinded, and a manually-applied Blinded is left alone (not removed) if the actor separately falls
 * asleep and wakes while it's active.
 * @param {Actor} actor The actor whose auto-blind status should be synced
 */
export async function syncAutoBlindStatus(actor) {
  if (!actor) return;

  const shouldBeBlind = actor.statuses?.has('asleep') || actor.statuses?.has('unconscious') || false;
  const blindEffect = actor.effects.find(effect => effect.statuses?.has('blinded'));
  const isAutoBlind = !!blindEffect?.getFlag('essence20', 'autoBlindFromSleep');

  if (shouldBeBlind && !blindEffect) {
    const effectData = await ActiveEffect.implementation.fromStatusEffect('blinded');
    effectData.updateSource({ "flags.essence20.autoBlindFromSleep": true });
    await actor.createEmbeddedDocuments('ActiveEffect', [effectData]);
  } else if (!shouldBeBlind && isAutoBlind) {
    await blindEffect.delete();
  }
}

/**
 * Restrained (GI Joe CRB, Conditions, p.226): "In addition to the effects of Immobilized..." -
 * Restrained is written as a strict superset of Immobilized, but nothing actually turned the real
 * "immobilized" status on for a Restrained actor, so its Movement 0 / +1 shift never applied. Same
 * "sync a real status from a related one" shape as syncAutoBlindStatus() above (Asleep/Unconscious
 * -> Blinded), just Restrained -> Immobilized instead, and the same autoImmobilizedFromRestrained
 * flag distinguishes an auto-applied Immobilized from one toggled on manually for some other
 * reason, so a Restrained actor losing the condition never strips a manually-applied Immobilized.
 * @param {Actor} actor The actor whose auto-immobilized status should be synced
 */
export async function syncAutoImmobilizedStatus(actor) {
  if (!actor) return;

  const shouldBeImmobilized = actor.statuses?.has('restrained') || false;
  const immobilizedEffect = actor.effects.find(effect => effect.statuses?.has('immobilized'));
  const isAutoImmobilized = !!immobilizedEffect?.getFlag('essence20', 'autoImmobilizedFromRestrained');

  if (shouldBeImmobilized && !immobilizedEffect) {
    const effectData = await ActiveEffect.implementation.fromStatusEffect('immobilized');
    effectData.updateSource({ "flags.essence20.autoImmobilizedFromRestrained": true });
    await actor.createEmbeddedDocuments('ActiveEffect', [effectData]);
  } else if (!shouldBeImmobilized && isAutoImmobilized) {
    await immobilizedEffect.delete();
  }
}

/**
 * Displays an error message if the sheet is locked
 * @returns {boolean} True if the sheet is locked, and false otherwise
 */
export function checkIsLocked(actor) {
  if (actor.system.isLocked) {
    ui.notifications.error(game.i18n.localize('E20.ActorLockError'));
    return true;
  }

  return false;
}

/**
 * Prepare the number of actions available for the given actor
 * @param {Actor} actor The actor to get actions for
 * @return {Object} Action types mapped to an action count
 */
export function getNumActions(actor) {
  // Character/NPC/Companion essences use .max (character.mjs); Vehicle/Zord/Megaform's
  // machine-based essences (machine.mjs, zord-base.mjs) use .value instead - there's no .max
  // on those to read. Actor types with no Essence scores at all (e.g. Party) have no action
  // economy.
  const speedEssence = actor.system.essences?.speed;
  if (!speedEssence) {
    return { free: 0, movement: 0, standard: 0 };
  }

  const speed = speedEssence.max ?? speedEssence.value ?? 0;

  // Quick Thinker - see QUICK_THINKER_ID's own comment above. Free actions come from Smarts
  // instead of Speed while the actor holds the Perk; movement/standard actions are unaffected.
  let freeActionEssence = speed;
  if (actorHasPerk(actor, QUICK_THINKER_ID) || actorHasPerk(actor, UNIVERSITY_DAYS_ID)) {
    const smartsEssence = actor.system.essences.smarts;
    freeActionEssence = smartsEssence.max ?? smartsEssence.value ?? 0;
  } else if (actorHasPerk(actor, FOOT_SOLDIER_ID) && !actor.system.isTransformed) {
    freeActionEssence = speed + 2;
  }

  return {
    free: Math.max(0, freeActionEssence - 2),
    movement: speed > 0 ? 1 : 0,
    standard: speed > 1 ? 1 : 0,
  };
}

/**
 * WCAG relative luminance of a hex colour: 0 for black, 1 for white.
 * @param {String} hex   "#rgb" or "#rrggbb".
 * @returns {Number|null}   Null for anything that is not a hex colour.
 */
export function relativeLuminance(hex) {
  const value = String(hex ?? "").trim();
  if (!/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value)) {
    return null;
  }

  const full = value.length === 4 ? value.slice(1).split("").map(c => c + c).join("") : value.slice(1);
  const channel = (i) => {
    const c = parseInt(full.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };

  return (0.2126 * channel(0)) + (0.7152 * channel(2)) + (0.0722 * channel(4));
}

/**
 * Above this luminance, dark text out-contrasts light text on the colour - WCAG's black/white
 * crossover, where the two contrast ratios are equal.
 */
export const LIGHT_FILL_LUMINANCE = 0.179;

/**
 * Given a system.color string, work out the values for --e20-system-color and its
 * 50%-alpha counterpart --e20-system-color-50, and which tone of text reads on it.
 * @param {String} color The raw system.color value (expected to be a hex color)
 * @returns {{normalizedColor: String, alphaColor: String, fillTone: "light"|"dark"|null}}
   fillTone is null for a colour that is not a hex value, where the luminance is unknown.
 */
export function computeSystemColorVars(color) {
  const normalizedColor = String(color).trim();

  const hexColor = normalizedColor.startsWith('#') ? normalizedColor : null;
  const alphaColor = hexColor && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hexColor)
    ? (() => {
      const hex = hexColor.length === 4
        ? hexColor.split('').map((char, index) => index === 0 ? char : char + char).join('').slice(1)
        : hexColor.slice(1);
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, 0.5)`;
    })()
    : 'rgba(0, 0, 0, 0.5)';

  const luminance = relativeLuminance(normalizedColor);
  const fillTone = luminance === null ? null : (luminance > LIGHT_FILL_LUMINANCE ? "light" : "dark");

  return { normalizedColor, alphaColor, fillTone };
}

/**
 * Set the --e20-system-color CSS variables used to drive the e20-border-accent
 * coloring (header/profile-img border, sheet tabs, skill headers, etc.) from the
 * actor's chosen system.color.
 * @param {HTMLElement} element The sheet's root element
 * @param {Actor} actor The actor being rendered
 */
export function applySystemColorCssVariables(element, actor) {
  const color = actor?.system?.color;
  if (!element || !color) return;

  const { normalizedColor, alphaColor, fillTone } = computeSystemColorVars(color);
  element.style.setProperty('--e20-system-color', normalizedColor);
  element.style.setProperty('--e20-system-color-50', alphaColor);

  // Text laid straight on the colour - the unselected sheet tabs (actors/_tabs.scss). Whichever
  // of dark or near-white text contrasts more (the WCAG crossover): a light fill gets dark text
  // and no halo, a dark one near-white over the stylesheet's dark halo. The old one-size light
  // grey read at under 2:1 on mid-tones like magenta and purple, and all but vanished on yellow.
  // An unparseable colour keeps the stylesheet default; the properties are removed rather than
  // left behind, since the sheet can change colour without being re-created.
  if (fillTone === "light") {
    element.style.setProperty('--e20-system-color-contrast', '#1a1a1a');
    element.style.setProperty('--e20-system-color-halo', 'transparent');
  } else if (fillTone === "dark") {
    element.style.setProperty('--e20-system-color-contrast', '#f2f2f2');
    element.style.removeProperty?.('--e20-system-color-halo');
  } else {
    element.style.removeProperty?.('--e20-system-color-contrast');
    element.style.removeProperty?.('--e20-system-color-halo');
  }
}

/**
 * The Contacts/Combiners/Crew list (system-actors.hbs) shows other actors attached to this
 * one - each row's e20-border-accent trim should read as THAT attached actor's own
 * system.color, not the sheet owner's color it would otherwise inherit from the root element
 * above. Each row carries its attached actor's color in a data-e20-color attribute already;
 * this sets the same --e20-system-color/-50 pair locally on each row so it overrides (rather
 * than inherits) the root value for just that row's subtree.
 * @param {HTMLElement} element The sheet's root element
 */
export function applySystemActorsColorCssVariables(element) {
  if (!element) return;

  for (const row of element.querySelectorAll('.systemActors[data-e20-color]')) {
    const color = row.dataset.e20Color;
    if (!color) continue;

    const { normalizedColor, alphaColor } = computeSystemColorVars(color);
    row.style.setProperty('--e20-system-color', normalizedColor);
    row.style.setProperty('--e20-system-color-50', alphaColor);
  }
}
