import { applyThemeClass } from "../settings.js";
import { actorToIr, createActorFromStatBlock } from "../helpers/stat-block-import.mjs";
import { computeGrownStatBlock, multipliersForIncrease } from "../helpers/monster-grow-generator.mjs";
import {
  getLinkCandidates, getLinkedForm, linkGrownForm, unlinkGrownForm,
} from "../helpers/monster-grow-swap.mjs";
import { serializeFormSubmits } from "./serialize-form-submits.mjs";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * "Make My Monster Grow" - builds the Grown version of a Threat as its own Actor. Phase 6 of
 * docs/STAT_BLOCK_IMPORTER_PLAN.md, mode A.
 *
 * The books model a Grown form as a **separate stat block with different content**, not a modified
 * one (Goldar (Grown) has Perks his Normal form doesn't), so this creates a sibling Actor and
 * cross-links the pair rather than stacking Active Effects on the original. See §6.4 of the plan
 * for why Active Effects are the wrong tool here.
 *
 * Every knob the generator exposes is editable, because the published Grown blocks demonstrably do
 * not follow the book's own algorithm - see §6.3. The defaults follow the RULE; the dialog is
 * where a GM reproduces a published block's own choices instead.
 */
export default class MonsterGrowDialog extends serializeFormSubmits(HandlebarsApplicationMixin(ApplicationV2)) {
  /** @param {Actor} actor The Normal-form Threat being grown. */
  constructor(actor) {
    super({ id: `essence20-monster-grow-${actor.id}` });
    this._actor = actor;
    this._ir = actorToIr(actor);
    this._options = {
      tlIncrease: 3,
      newSize: 'gigantic',
      growMovement: true,
      conditioningIncrease: 0,
      scalePowerText: true,
    };
    // Null until the GM edits them, so they keep tracking the generator's own defaults as the
    // Threat Level increase changes.
    this._essenceAllocation = null;
    this._skillAllocation = null;
    // "generate" builds a new Actor from the rules; "existing" pairs one the GM already has -
    // which is the common case after a batch import, since a printed page carries both forms and
    // the importer creates both as separate, unlinked Actors.
    this._mode = 'generate';
    this._linkTargetId = '';
  }

  static DEFAULT_OPTIONS = {
    actions: {
      createGrownForm: this.#onCreate,
      linkExistingForm: this.#onLinkExisting,
      resetAllocations: this.#onResetAllocations,
      unlinkForm: this.#onUnlink,
    },
    classes: ["essence20", "sheet", "theme-wrapper", "e20-window", "monster-grow-dialog"],
    tag: "form",
    window: {
      icon: "fa-solid fa-up-right-and-down-left-from-center",
      title: "E20.MonsterGrowTitle",
      resizable: true,
    },
    position: {
      width: 860,
      height: 720,
    },
    form: {
      handler: MonsterGrowDialog.#onSubmit,
      submitOnChange: true,
      closeOnSubmit: false,
    },
  };

  static PARTS = {
    form: {
      scrollable: [".monster-grow-body"],
      template: "systems/essence20/templates/app/monster-grow-dialog.hbs",
    },
  };

  get title() {
    return game.i18n.format("E20.MonsterGrowTitleFor", { name: this._actor.name });
  }

  /** The generator result for the current options - recomputed rather than cached, it is cheap. */
  #result() {
    return computeGrownStatBlock(this._ir, {
      ...this._options,
      ...(this._essenceAllocation ? { essenceAllocation: this._essenceAllocation } : {}),
      ...(this._skillAllocation ? { skillAllocation: this._skillAllocation } : {}),
      ...(this._options.rangeMultiplier ? { rangeMultiplier: this._options.rangeMultiplier } : {}),
      ...(this._options.damageMultiplier ? { damageMultiplier: this._options.damageMultiplier } : {}),
    });
  }

  static async #onSubmit(event, form, formData) {
    const data = foundry.utils.expandObject(formData.object);

    this._options = {
      tlIncrease: Number(data.tlIncrease) || 3,
      newSize: data.newSize || 'gigantic',
      growMovement: Boolean(data.growMovement),
      conditioningIncrease: Number(data.conditioningIncrease) || 0,
      scalePowerText: Boolean(data.scalePowerText),
      rangeMultiplier: Number(data.rangeMultiplier) || null,
      damageMultiplier: Number(data.damageMultiplier) || null,
    };

    this._mode = data.mode === 'existing' ? 'existing' : 'generate';
    this._linkTargetId = data.linkTargetId ?? '';

    this._essenceAllocation = Object.fromEntries(
      Object.entries(data.essenceAllocation ?? {}).map(([k, v]) => [k, Number(v) || 0]));
    this._skillAllocation = Object.fromEntries(
      Object.entries(data.skillAllocation ?? {})
        .map(([k, v]) => [k, Number(v) || 0])
        .filter(([, v]) => v > 0));

    this.render();
  }

  static async #onLinkExisting() {
    const target = game.actors.get(this._linkTargetId);
    if (!target) {
      ui.notifications.warn(game.i18n.localize("E20.MonsterGrowPickAnActor"));
      return;
    }

    if (await linkGrownForm(this._actor, target)) {
      ui.notifications.info(game.i18n.format("E20.MonsterGrowLinked",
        { normal: this._actor.name, grown: target.name }));
      this.render();
    }
  }

  static async #onUnlink() {
    if (await unlinkGrownForm(this._actor)) {
      ui.notifications.info(game.i18n.localize("E20.MonsterGrowUnlinked"));
      this.render();
    }
  }

  /** Drops the GM's hand-set splits so they track the generator's defaults again. */
  static async #onResetAllocations() {
    this._essenceAllocation = null;
    this._skillAllocation = null;
    this.render();
  }

  static async #onCreate() {
    const { ir } = this.#result();

    try {
      const grown = await createActorFromStatBlock(ir, {
        type: this._actor.type,
        folder: this._actor.folder?.id ?? null,
      });

      if (!grown) {
        ui.notifications.error(game.i18n.localize("E20.MonsterGrowFailed"));
        return;
      }

      // Cross-link the pair. Phase 7's in-combat swap reads exactly these two flags to find the
      // other form of a placed token.
      await this._actor.setFlag('essence20', 'grownFormId', grown.id);
      await grown.setFlag('essence20', 'normalFormId', this._actor.id);

      ui.notifications.info(game.i18n.format("E20.MonsterGrowCreated", { name: grown.name }));
      grown.sheet.render(true);
      this.close();
    } catch (err) {
      console.error("essence20 | Grown form creation failed", err);
      ui.notifications.error(game.i18n.localize("E20.MonsterGrowFailed"));
    }
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const { ir: grown, review, essenceIncreases, skillAllocation } = this.#result();
    const before = this._ir;

    context.options = this._options;
    context.sizeChoices = CONFIG.E20.actorSizes;

    context.mode = this._mode;
    context.isGenerateMode = this._mode === 'generate';
    context.modeChoices = {
      generate: game.i18n.localize("E20.MonsterGrowModeGenerate"),
      existing: game.i18n.localize("E20.MonsterGrowModeExisting"),
    };

    const existingLink = getLinkedForm(this._actor);
    context.linkedPartner = existingLink ? game.actors.get(existingLink.id)?.name ?? null : null;
    context.linkedDirection = existingLink?.direction ?? null;

    context.linkTargetId = this._linkTargetId;
    context.linkChoices = Object.fromEntries(
      getLinkCandidates(this._actor, game.actors)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(candidate => [candidate.id, candidate.name]));
    context.hasLinkCandidates = Object.keys(context.linkChoices).length > 0;

    // Shown next to the multiplier inputs so a GM can see what RAW would have used for the
    // Threat Level increase they picked.
    const raw = multipliersForIncrease(this._options.tlIncrease);
    context.rawRange = raw.range;
    context.rawDamage = raw.damage;
    context.rangeMultiplier = this._options.rangeMultiplier ?? raw.range;
    context.damageMultiplier = this._options.damageMultiplier ?? raw.damage;

    const row = (label, from, to) => ({ label, from: from ?? '—', to: to ?? '—', changed: from !== to });

    context.summaryRows = [
      row(game.i18n.localize("E20.StatBlockImportThreatLevel"), before.threatLevel, grown.threatLevel),
      row(game.i18n.localize("E20.StatBlockImportSize"),
        CONFIG.E20.actorSizes[before.size], CONFIG.E20.actorSizes[grown.size]),
      row(game.i18n.localize("E20.StatBlockImportHealth"), before.health, grown.health),
      row(game.i18n.localize("E20.SkillConditioning"), before.conditioning, grown.conditioning),
    ];

    for (const type of ['ground', 'aerial', 'swim', 'climb']) {
      if (before.movement[type] !== null || grown.movement[type] !== null) {
        context.summaryRows.push(
          row(CONFIG.E20.movementTypes[type], before.movement[type], grown.movement[type]));
      }
    }

    context.essenceRows = Object.entries(before.essences).map(([key, value]) => ({
      key,
      label: key.capitalize(),
      from: value,
      to: grown.essences[key],
      allocated: essenceIncreases[key] ?? 0,
    }));

    context.essencePoints = 2 * this._options.tlIncrease;
    context.essenceSpent = Object.values(essenceIncreases).reduce((a, b) => a + b, 0);
    context.essenceMismatch = context.essenceSpent !== context.essencePoints;

    context.defenseRows = Object.entries(before.defenses)
      .filter(([, value]) => value !== null)
      .map(([key, value]) => row(key.capitalize(), value, grown.defenses[key]));

    context.skillRows = before.skills.map((skill, index) => ({
      key: skill.key,
      label: CONFIG.E20.skills[skill.key] ?? skill.key,
      from: skill.shift,
      to: grown.skills[index]?.shift,
      shifts: skillAllocation[skill.key] ?? 0,
    }));

    context.attackRows = before.attacks.map((attack, index) => {
      const after = grown.attacks[index];
      return {
        name: attack.name,
        from: this.#attackLabel(attack),
        to: this.#attackLabel(after),
      };
    });

    context.review = review;
    // Only offered in generate mode - it resets the Essence/skill splits, and none of that UI is
    // even on screen while an existing actor is being linked.
    context.hasAllocationOverride = context.isGenerateMode
      && Boolean(this._essenceAllocation || this._skillAllocation);

    return context;
  }

  #attackLabel(attack) {
    if (!attack) {
      return '—';
    }

    const parts = [];
    if (attack.damageValue) {
      parts.push(`${attack.damageValue} ${attack.damageType ?? ''}`.trim());
    }

    if (attack.range?.value) {
      parts.push(`${attack.range.value}/${attack.range.long}ft`);
    } else if (attack.isReach) {
      parts.push(game.i18n.localize("E20.MonsterGrowReach"));
    }

    return parts.join(', ') || '—';
  }

  _onRender(context, options) {
    super._onRender(context, options);
    applyThemeClass(this.element);
  }
}
