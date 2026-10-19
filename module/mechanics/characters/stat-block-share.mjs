import { actorToIr } from "../../importers/stat-block-import.mjs";
import { irToStatBlockText } from "../../importers/stat-block-export.mjs";

/**
 * Copy Stat Block: a Threat as printed-style text (importers/stat-block-export.mjs) to share - paste it into a post or a
 * message, and the Stat Block Importer on another table reads it back. Reached from an NPC's, Zord's or vehicle's sheet
 * (the header's ⋮ menu), the Threat Builder's last step, and game.essence20.threats.exportStatBlock.
 */

/** The actor types a stat block describes (the importer makes these). */
export const STAT_BLOCK_TYPES = Object.freeze(['npc', 'zord', 'vehicle']);

/** Whether this actor can be copied as a stat block. */
export const canCopyStatBlock = actor => !!actor && STAT_BLOCK_TYPES.includes(actor.type);

/**
 * The stat block text for an actor or a Threat Builder state.
 * An actor is read as it stands now - not the text it was imported from, which its later edits would leave stale.
 * @param {Actor|Object} source
 * @param {Object} [helpers]   {threatIr} - the Builder state's reader (tests pass their own).
 * @returns {Promise<String>}
 */
export async function statBlockText(source, { threatIr = null } = {}) {
  if (!source) {
    return '';
  }

  if (typeof source.getFlag == 'function' || source.documentName == 'Actor') {
    return irToStatBlockText(actorToIr(source, { preferFlag: false }));
  }

  const read = threatIr ?? (await import("./threat-api.mjs")).threatIr;
  const ir = read(source);
  const unnamed = globalThis.game?.i18n?.localize?.('E20.StatBlockUnnamed');
  return irToStatBlockText({ ...ir, name: ir.name?.trim() || (unnamed && unnamed != 'E20.StatBlockUnnamed' ? unnamed : 'Threat') });
}

/** Copy text to the clipboard; false when the browser refuses (the window's text can still be selected). */
export async function copyText(text) {
  try {
    await globalThis.navigator?.clipboard?.writeText?.(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Show a stat block in a window: its text, a Copy button inside it (the window stays open; if the browser refuses the
 * clipboard, the text is selected ready for Ctrl+C) and Close.
 * @param {String} text
 * @param {String} [title]
 */
export async function showStatBlock(text, title = '') {
  const { DialogV2 } = foundry.applications.api;
  const i18n = game.i18n;
  const escaped = foundry.utils.escapeHTML(text);
  return DialogV2.wait({
    window: { title: title ? `${i18n.localize('E20.StatBlockTitle')}: ${title}` : i18n.localize('E20.StatBlockTitle'), icon: 'fa-solid fa-file-lines' },
    classes: ['essence20', 'e20-window', 'e20-stat-block-export'],
    position: { width: 560 },
    content: `<p class="hint">${i18n.localize('E20.StatBlockHint')}</p>
      <textarea class="e20-stat-block-text" readonly rows="18" spellcheck="false">${escaped}</textarea>
      <button type="button" class="e20-stat-block-copy"><i class="fa-solid fa-copy" inert></i> ${i18n.localize('E20.StatBlockCopyButton')}</button>`,
    buttons: [{ action: 'close', label: 'Close', icon: 'fa-solid fa-xmark', default: true }],
    render: (event, dialog) => {
      const root = dialog?.element;
      root?.querySelector('.e20-stat-block-copy')?.addEventListener('click', async () => {
        if (await copyText(text)) {
          ui.notifications.info(i18n.localize('E20.StatBlockCopied'));
        } else {
          root.querySelector('.e20-stat-block-text')?.select();
          ui.notifications.warn(i18n.localize('E20.StatBlockCopyFailed'));
        }
      });
    },
    rejectClose: false,
  });
}

/** Copy Stat Block for an actor: the window with its text. */
export async function copyStatBlock(actor) {
  return showStatBlock(await statBlockText(actor), actor?.name ?? '');
}

/** The sheet header's ⋮ menu entry (getHeaderControls hook). Exported for tests. */
export function addStatBlockControl(app, controls) {
  const actor = app?.document ?? app?.actor;
  if (!canCopyStatBlock(actor)) {
    return;
  }

  controls.push({
    icon: 'fa-solid fa-file-lines',
    label: 'E20.StatBlockCopy',
    action: 'essence20CopyStatBlock',
    visible: () => !!actor.isOwner,
    onClick: () => copyStatBlock(actor),
  });
}

globalThis.Hooks?.on?.('getHeaderControlsEssence20BaseActorSheet', addStatBlockControl);
