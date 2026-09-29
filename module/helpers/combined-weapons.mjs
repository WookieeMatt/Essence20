/**
 * Combined Weapons (PR CRB p.115; Across the Stars p.79 "Combined: Some weapons can combine into an
 * alternate form"): "As a team, all Rangers may spend their full action to move to the same area
 * (within 5 feet of at least 2 other Rangers) and combine their Power Weapons into one
 * supercharged weapon. ... The Power Blaster does Damage equal to the amount of Power Weapons it is
 * made of but only hits if over half of the team succeeds on their Skill Tests."
 *
 * A Combined weapon's Use button (helpers/action-perks.mjs) runs combineWeapons(): pick who joins,
 * each spends a Full Action, and a chat card records the assembled weapon. Its Fire button has
 * every member roll their own weapon's attack against the targets; over half succeeding lands
 * damage equal to the number of weapons. An Engine Cell (A Jump Through Time p.73) powers the
 * combined RPM sidearms to "take double the normal listed number of Attacks with the combined form".
 */

const COMBINED_TRAIT = 'combined';

export function isCombinedWeapon(item) {
  return item?.type == 'weapon' && (item.system?.traits ?? []).includes(COMBINED_TRAIT);
}

/**
 * An actor's weapon that can join a combination, and its first effect.
 */
function combinedWeaponOf(actor) {
  const weapon = actor?.items?.find?.(item => isCombinedWeapon(item))
    ?? actor?.items?.find?.(item => item.type == 'weapon' && (item.system?.traits ?? []).includes('powerWeapon'));
  const effect = weapon ? actor.items.find(item => item.type == 'weaponEffect' && item.flags?.essence20?.parentId == weapon.id) : null;
  return weapon && effect ? { weapon, effect } : null;
}

/**
 * The allies who could join: tokens of the same disposition carrying a weapon that can combine.
 */
export function combineCandidates(actor) {
  const own = actor.getActiveTokens?.()?.[0];
  const tokens = canvas?.tokens?.placeables ?? [];
  return tokens.filter(token => token !== own && token.actor && token.actor.id != actor.id
    && (!own || token.document.disposition == own.document.disposition) && combinedWeaponOf(token.actor))
    .map(token => token.actor);
}

/**
 * Assemble a combined weapon. Returns the chat line, or null if it didn't happen.
 * @param {Actor} actor   Who started it.
 * @param {Item} weapon   Their Combined weapon.
 * @param {Object} economy {spend}
 */
export async function combineWeapons(actor, weapon, economy) {
  const candidates = combineCandidates(actor);
  const i18n = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));
  const rows = candidates.map(ally => `<label class="flexrow"><input type="checkbox" name="${ally.id}" checked> ${foundry.utils.escapeHTML(ally.name)}</label>`).join('');
  const result = await foundry.applications.api.DialogV2.wait({
    window: { title: weapon.name },
    classes: ["window-app", "e20-window"],
    position: { width: 400 },
    content: `<p>${i18n('E20.CombinedPrompt')}</p>${rows || `<p>${i18n('E20.CombinedNoAllies')}</p>`}
      <label class="flexrow"><input type="checkbox" name="engineCell"> ${i18n('E20.CombinedEngineCell')}</label>`,
    buttons: [
      {
        action: 'ok', label: i18n('E20.DialogConfirmButton'), default: true,
        callback: (event, button) => ({
          allies: candidates.filter(ally => button.form.elements[ally.id]?.checked).map(ally => ally.id),
          engineCell: !!button.form.elements.engineCell?.checked,
        }),
      },
      { action: 'cancel', label: i18n('E20.DialogCancelButton') },
    ],
    rejectClose: false,
  });
  if (!result || result == 'cancel') {
    return null;
  }

  // "within 5 feet of at least 2 other Rangers" - three weapons at the least.
  if (result.allies.length < 2) {
    ui.notifications.warn(i18n('E20.CombinedTooFew'));
    return null;
  }

  const members = [actor, ...result.allies.map(id => candidates.find(ally => ally.id == id))];
  for (const member of members) {
    await economy.spend(member, 'fullAction', { source: weapon.name });
  }

  const own = combinedWeaponOf(actor);
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<p>${i18n('E20.CombinedAssembled', { weapon: weapon.name, count: members.length, names: members.map(m => m.name).join(', ') })}</p>
      <button type="button" class="e20-chat-action-button e20-combined-fire">${i18n('E20.CombinedFire')}</button>`,
    flags: {
      essence20: {
        combined: {
          members: members.map(m => m.uuid),
          weaponName: weapon.name,
          damageType: own?.effect?.system?.damageType ?? 'blunt',
          attacks: result.engineCell ? 2 : 1,
        },
      },
    },
  });
  return null;
}

/**
 * Fire the combined weapon: every member rolls their weapon's attack against the current targets;
 * over half succeeding deals damage equal to the number of weapons to each target.
 * @param {ChatMessage} message
 * @returns {Promise<Boolean>}   Whether it hit.
 */
export async function fireCombinedWeapon(message) {
  const data = message.getFlag('essence20', 'combined');
  const targets = [...(game.user?.targets ?? [])];
  if (!data || !targets.length) {
    ui.notifications.warn(game.i18n.localize('E20.CombinedNeedsTarget'));
    return false;
  }

  let hit = false;
  for (let shot = 0; shot < (data.attacks ?? 1); shot++) {
    let successes = 0;
    for (const uuid of data.members) {
      const member = await fromUuid(uuid);
      const own = combinedWeaponOf(member);
      if (!member || !own) {
        continue;
      }

      const skill = own.effect.system?.classification?.skill ?? 'targeting';
      const essence = CONFIG.E20.skillToEssence?.[skill] ?? 'speed';
      const roll = await member._dice.rollSkill({
        skill, essence, shiftUp: 0, shiftDown: 0, defenseType: own.effect.system?.defenseType ?? 'toughness',
      }, member);
      if (roll?.success) {
        successes++;
      }
    }

    const landed = successes > data.members.length / 2;
    hit ||= landed;
    const damage = data.members.length;
    const buttons = landed ? targets.map(token => `<button type="button" class="e20-check-damage-button" data-action="apply-damage"
      data-key="${token.document.uuid}:combined:${shot}" data-target-uuid="${token.actor.uuid}" data-damage="${damage}" data-damage-type="${data.damageType}">
      ${foundry.utils.escapeHTML(token.name)}: ${damage} ${game.i18n.localize(CONFIG.E20.damageTypes[data.damageType] ?? data.damageType)}</button>`).join('') : '';
    await ChatMessage.create({
      speaker: message.speaker,
      content: `<div class="e20-check-card"><p>${game.i18n.format(landed ? 'E20.CombinedHit' : 'E20.CombinedMiss', {
        weapon: data.weaponName, successes, count: data.members.length,
      })}</p>${buttons}</div>`,
    });
  }

  return hit;
}

/**
 * Wire the Fire button on a combined-weapon card.
 */
export function decorateCombinedCard(message, html) {
  const button = html?.querySelector?.('.e20-combined-fire');
  if (button) {
    button.addEventListener('click', () => fireCombinedWeapon(message));
  }
}
