import { applyThemeClass } from "../settings.js";
import {
  applyCompendiumMatches, buildSimpleItems, collectEffectContributions,
  collectUncancellableEffects,
  createActorFromStatBlock,
} from "../helpers/stat-block-import.mjs";
import { parseStatBlock, splitStatBlocks } from "../helpers/stat-block-parser.mjs";
import {
  buildMatchIndex, countEffectBearingMatches, countMatches, findMatches, folderForGameVersion,
  loadCompendiumEntries,
} from "../helpers/stat-block-match.mjs";
import { serializeFormSubmits } from "./serialize-form-submits.mjs";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Paste a Threat/NPC stat block out of a sourcebook PDF, see what it parsed into, and create the
 * Actor. Phase 3 of docs/STAT_BLOCK_IMPORTER_PLAN.md.
 *
 * Two panes: the paste on the left, a live preview of the parsed result plus its diagnostics on
 * the right. Uses submitOnChange/no-close-on-submit (like apps/skill-picker.mjs, and unlike most
 * apps in this folder, which submit once on close) so the preview re-parses as the paste is
 * edited - the textarea IS the correction surface, which is why a stat block that parses badly
 * can usually be fixed by tidying the paste rather than by hand-editing fields afterwards.
 *
 * Pasting several blocks at once works without a mode switch: the paste is split on its own
 * "THREAT LEVEL:" lines (helpers/stat-block-parser.mjs#splitStatBlocks), every block is parsed,
 * the first is previewed, and Import creates all of them. A one-block paste is simply the
 * one-element case.
 */
export default class StatBlockImporter extends serializeFormSubmits(HandlebarsApplicationMixin(ApplicationV2)) {
  constructor(options = {}) {
    super({ id: "essence20-stat-block-importer", ...options });
    this._text = '';
    this._ir = null;
    // Every parsed block in the paste. Batch import is just the single case with more than one -
    // see #onImport, which walks this list.
    this._irs = [];
    this._actorType = 'npc';
    this._folderId = '';
    this._gameVersion = '';
    // Built once per app instance from the enabled Item packs - see #ensureMatchIndex.
    this._matchIndex = null;
    this._matches = null;
  }

  static DEFAULT_OPTIONS = {
    actions: {
      importStatBlock: this.#onImport,
    },
    classes: ["essence20", "sheet", "theme-wrapper", "e20-window", "stat-block-importer"],
    tag: "form",
    window: {
      icon: "fa-solid fa-file-import",
      title: "E20.StatBlockImportTitle",
      resizable: true,
    },
    position: {
      width: 920,
      height: 700,
    },
    form: {
      handler: StatBlockImporter.#onSubmit,
      submitOnChange: true,
      closeOnSubmit: false,
    },
  };

  static PARTS = {
    form: {
      scrollable: [".stat-block-importer-preview"],
      template: "systems/essence20/templates/app/stat-block-importer.hbs",
    },
  };

  /**
   * Re-parses on every form change. Nothing is written anywhere until the Import button is
   * actually pressed - this only refreshes what the preview shows.
   */
  static async #onSubmit(event, form, formData) {
    const data = formData.object;
    this._text = data.statBlockText ?? '';
    this._actorType = data.actorType || 'npc';
    this._folderId = data.folderId ?? '';
    this._gameVersion = data.gameVersion ?? '';
    const blocks = this._text.trim() ? splitStatBlocks(this._text) : [];
    this._irs = blocks.map(block => parseStatBlock(block));
    this._ir = this._irs[0] ?? null;
    await this.#refreshMatches();
    this.render();
  }

  /**
   * Indexes every enabled Item pack once per app instance. Foundry caches each pack's index after
   * the first read, so the cost is paid on the first parse rather than on open - a GM who only
   * wanted to look at the app never pays it at all.
   */
  async #ensureMatchIndex() {
    if (!this._matchIndex) {
      this._matchIndex = buildMatchIndex(await loadCompendiumEntries());
    }

    return this._matchIndex;
  }

  async #refreshMatches() {
    if (!this._ir) {
      this._matches = null;
      return;
    }

    const index = await this.#ensureMatchIndex();
    this._matches = findMatches(this._ir, index, folderForGameVersion(this._gameVersion));
  }

  static async #onImport() {
    if (!this._irs.length) {
      return;
    }

    const created = [];
    try {
      for (const ir of this._irs) {
        // Matches are only resolved for the previewed block; the rest are matched on demand so a
        // big batch does not pay for matching it may not use.
        const matches = ir === this._ir
          ? this._matches
          : findMatches(ir, await this.#ensureMatchIndex(), folderForGameVersion(this._gameVersion));

        const actor = await createActorFromStatBlock(ir, {
          type: this._actorType,
          raw: this._irs.length === 1 ? this._text : null,
          folder: this._folderId || null,
          matches,
        });

        if (actor) {
          created.push(actor);
        }
      }
    } catch (err) {
      console.error("essence20 | Stat block import failed", err);
      ui.notifications.error(game.i18n.localize("E20.StatBlockImportFailed"));
      return;
    }

    if (!created.length) {
      ui.notifications.error(game.i18n.localize("E20.StatBlockImportFailed"));
      return;
    }

    if (created.length === 1) {
      ui.notifications.info(game.i18n.format("E20.StatBlockImportCreated", { name: created[0].name }));
      created[0].sheet.render(true);
    } else {
      ui.notifications.info(game.i18n.format("E20.StatBlockImportCreatedMany", { count: created.length }));
    }

    this.close();
  }

  /** The header scalars, as label/value rows the template can just walk. */
  #summaryRows(ir) {
    // CONFIG.E20's own label maps are already localized in place by performPreLocalization (see
    // essence20.mjs's i18nInit hook), so they're read directly here rather than passed through
    // game.i18n.localize again - the same way skill-picker.mjs reads CONFIG.E20.skills.
    const missing = game.i18n.localize("E20.StatBlockImportMissing");
    const movement = Object.entries(ir.movement)
      .filter(([, value]) => value !== null)
      .map(([type, value]) => `${value}ft ${CONFIG.E20.movementTypes[type] ?? type}`)
      .join(', ');

    return [
      { label: game.i18n.localize("E20.StatBlockImportThreatLevel"), value: ir.threatLevel ?? missing },
      { label: game.i18n.localize("E20.StatBlockImportSize"), value: ir.size ? CONFIG.E20.actorSizes[ir.size] : missing },
      { label: game.i18n.localize("E20.StatBlockImportHealth"), value: ir.health ?? missing },
      { label: game.i18n.localize("E20.SkillConditioning"), value: ir.conditioning || 0 },
      { label: game.i18n.localize("E20.StatBlockImportMovement"), value: movement || missing },
      { label: game.i18n.localize("E20.StatBlockImportLanguages"), value: ir.languages.join(', ') || missing },
    ];
  }

  #scoreRows(scores) {
    const missing = game.i18n.localize("E20.StatBlockImportMissing");
    return Object.entries(scores).map(([key, value]) => ({
      key,
      label: key.capitalize(),
      value: value === null ? missing : value,
    }));
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const ir = this._ir;

    context.text = this._text;
    context.actorType = this._actorType;
    context.folderId = this._folderId;
    context.folderChoices = { "": game.i18n.localize("E20.StatBlockImportNoFolder") };
    for (const folder of game.folders.filter(folder => folder.type === "Actor")
      .sort((a, b) => a.name.localeCompare(b.name))) {
      context.folderChoices[folder.id] = folder.name;
    }

    context.actorTypeChoices = Object.fromEntries(["npc", "vehicle", "zord"]
      .map(type => [type, game.i18n.localize(`TYPES.Actor.${type}`)]));

    // Biases compendium matching towards one game line's own books when the same Perk name is
    // reprinted across several - see helpers/stat-block-match.mjs#selectMatch.
    context.gameVersion = this._gameVersion;
    context.gameVersionChoices = {
      "": game.i18n.localize("E20.StatBlockImportAnyGameLine"),
      ...CONFIG.E20.gameVersions,
    };

    // Drives the "N stat blocks found" line and the Import button's own label.
    context.blockCount = this._irs.length;
    context.blockNames = this._irs.map(entry => entry.name || game.i18n.localize("E20.StatBlockImportUnnamed"));
    context.hasParse = Boolean(ir);
    if (!ir) {
      return context;
    }

    context.ir = ir;
    context.summaryRows = this.#summaryRows(ir);
    context.essenceRows = this.#scoreRows(ir.essences);
    context.defenseRows = this.#scoreRows(ir.defenses);
    context.skills = ir.skills.map(skill => ({
      label: CONFIG.E20.skills[skill.key] ?? skill.key,
      detail: [
        skill.shift ?? `+${skill.modifier}`,
        skill.specialization ? `(${skill.specialization})` : null,
        skill.isSpecialized ? '*' : null,
      ].filter(Boolean).join(' '),
    }));

    context.attacks = ir.attacks.map(attack => ({
      name: attack.name,
      detail: [
        attack.skill ?? '?',
        attack.damageValue !== null ? `${attack.damageValue} ${attack.damageType ?? '?'}` : null,
        attack.range?.value ? `${attack.range.value}/${attack.range.long}ft` : null,
        attack.isReach ? 'Reach' : null,
        attack.alternateEffects.length
          ? game.i18n.format("E20.StatBlockImportAltEffects", { count: attack.alternateEffects.length })
          : null,
      ].filter(Boolean).join(' - '),
    }));

    // Perks/Powers/Hang-Ups carry their compendium match status, since whether an entry arrives as
    // a real compendium copy (with its Active Effects) or as inert text is the single most
    // important thing about an import - see helpers/stat-block-match.mjs's own doc comment.
    for (const section of ["perks", "powers", "hangUps"]) {
      const matched = this._matches?.[section] ?? [];
      context[section] = ir[section].map((entry, position) => {
        const match = matched[position]?.match ?? null;
        return {
          name: entry.name,
          actionType: entry.actionType,
          matchLabel: match
            ? game.i18n.format(match.ambiguous
              ? "E20.StatBlockImportMatchedAmbiguous"
              : "E20.StatBlockImportMatched", { pack: match.packLabel, count: match.candidateCount })
            : game.i18n.localize("E20.StatBlockImportUnmatched"),
          matchClass: match ? (match.ambiguous ? "match-ambiguous" : "match-found") : "match-none",
        };
      });
    }

    const counts = countMatches(this._matches);
    context.matchSummary = counts.total
      ? game.i18n.format("E20.StatBlockImportMatchSummary", counts)
      : null;

    // A matched Perk's Active Effect would otherwise double-count a bonus the printed block
    // already included. The builder nets those out of the residuals (see
    // helpers/stat-block-import.mjs#collectEffectContributions); this reports what it did, and
    // names anything it could not cancel arithmetically.
    context.effectCaution = null;
    context.effectNetted = null;
    if (countEffectBearingMatches(this._matches)) {
      const { items } = await applyCompendiumMatches(buildSimpleItems(ir), this._matches);
      const contributions = collectEffectContributions(items);
      const nettedCount = Object.keys(contributions.defenses).length
        + Object.keys(contributions.movement).length
        + (contributions.health ? 1 : 0);

      if (nettedCount) {
        context.effectNetted = game.i18n.format("E20.StatBlockImportEffectNetted", { count: nettedCount });
      }

      const uncancellable = [
        ...collectUncancellableEffects(items).map(entry => entry.item),
        ...contributions.unnetted.map(entry => entry.item),
      ];
      if (uncancellable.length) {
        context.effectCaution = game.i18n.format("E20.StatBlockImportEffectCaution",
          { items: [...new Set(uncancellable)].join(', ') });
      }
    }

    context.errorCount = ir.diagnostics.filter(entry => entry.severity === 'error').length;
    context.diagnostics = ir.diagnostics.map(entry => ({
      ...entry,
      icon: entry.severity === 'error' ? 'fa-circle-exclamation'
        : entry.severity === 'warning' ? 'fa-triangle-exclamation' : 'fa-circle-info',
    }));

    return context;
  }

  _onRender(context, options) {
    super._onRender(context, options);
    applyThemeClass(this.element);
  }
}
