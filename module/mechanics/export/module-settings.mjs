/**
 * Settings a module recommends (module.json flags.essence20.settings: {key: value}), as an Export Homebrew module carries
 * its world's. A module can't change a world's settings without code, so the system offers them: the first time the
 * active GM loads a world with such a module active (and again for each new version of it), a dialog lists them and
 * applies them on Yes. Either answer is remembered in the hidden world setting `moduleSettingsOffered`
 * ([`<module id>@<version>`]).
 *
 * Only the settings Export Homebrew may carry (homebrew-export.mjs#EXPORTABLE_SETTINGS) are applied; anything else is
 * ignored.
 */

import { EXPORTABLE_SETTINGS } from "./homebrew-export.mjs";

export const MODULE_SETTINGS_OFFERED = 'moduleSettingsOffered';

/** The key a module's offer is remembered by. */
export const offerKey = module => `${module.id}@${module.version ?? ''}`;

/**
 * The active modules with settings still to offer, each with its usable settings.
 * @param {Iterable<Object>} modules   game.modules.
 * @param {Array<String>} offered   The setting's list.
 * @returns {Array<{module: Object, settings: Object}>}
 */
export function pendingModuleSettings(modules, offered = []) {
  const done = new Set(offered);
  const out = [];
  for (const module of modules ?? []) {
    const raw = module?.active ? module.flags?.essence20?.settings : null;
    if (!raw || typeof raw != 'object' || done.has(offerKey(module))) {
      continue;
    }

    const settings = Object.fromEntries(Object.entries(raw).filter(([key]) => EXPORTABLE_SETTINGS.includes(key)));
    if (Object.keys(settings).length) {
      out.push({ module, settings });
    }
  }

  return out;
}

/** A setting's name for the dialog: its own label, else its key. */
function settingLabel(key) {
  const config = game.settings.settings.get(`essence20.${key}`);
  const name = config?.name ? game.i18n.localize(config.name) : '';
  return name || key;
}

/** A value as the dialog shows it: a choice's label, Yes/No, or a short JSON. */
function valueLabel(key, value) {
  const choices = game.settings.settings.get(`essence20.${key}`)?.choices;
  if (choices && value in choices) {
    return game.i18n.localize(choices[value]);
  }

  if (typeof value == 'boolean') {
    return game.i18n.localize(value ? 'Yes' : 'No');
  }

  const text = typeof value == 'object' ? JSON.stringify(value) : String(value);
  return text.length > 60 ? `${text.slice(0, 57)}...` : text;
}

/** On ready, for the active GM: offer each module's recommended settings once per version. */
export async function offerModuleSettings() {
  if (!game.users?.activeGM?.isSelf) {
    return;
  }

  const offered = game.settings.get('essence20', MODULE_SETTINGS_OFFERED) ?? [];
  for (const { module, settings } of pendingModuleSettings(game.modules, offered)) {
    const known = Object.entries(settings).filter(([key]) => game.settings.settings.has(`essence20.${key}`));
    const remember = () => game.settings.set('essence20', MODULE_SETTINGS_OFFERED, [...new Set([...game.settings.get('essence20', MODULE_SETTINGS_OFFERED) ?? [], offerKey(module)])]);
    if (!known.length) {
      await remember();
      continue;
    }

    const escape = foundry.utils.escapeHTML ?? (text => text);
    const rows = known.map(([key, value]) => `<li><strong>${escape(settingLabel(key))}:</strong> ${escape(valueLabel(key, value))}</li>`).join('');
    const apply = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize('E20.ModuleSettingsTitle') },
      content: `<p>${game.i18n.format('E20.ModuleSettingsPrompt', { module: escape(module.title ?? module.id) })}</p><ul>${rows}</ul>`,
      rejectClose: false,
    });

    if (apply) {
      for (const [key, value] of known) {
        await game.settings.set('essence20', key, value);
      }

      ui.notifications.info(game.i18n.format('E20.ModuleSettingsApplied', { module: module.title ?? module.id }));
    }

    await remember();
  }
}
