import { applyThemeClass, getGameLine } from "../settings.js";
import { serializeFormSubmits } from "./serialize-form-submits.mjs";
import {
  allowedSizes, appropriateThreatLevel, auditThreat, buildThreatIr, defaultRulesetFor, essenceBudget, essencesFromSkills,
  ESSENCES, extraMovementRate, maxDamagePerks, MOVEMENT_TYPES, perkBudget, QUICK_PERKS, RANKED_SHIFTS, ROLE_PRESETS, RULESETS,
  SIZE_LADDER, SKILLS_BY_ESSENCE, skillGuideFor, skillSpend, THREAT_TYPES, threatDefenses, threatFromActor, threatGroundMovement,
  threatHealth, threatLevelForRole,
} from "../helpers/threat-rules.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** Every step any rule set has, in book order; a rule set drops the ones it doesn't use. */
const ALL_STEPS = ['concept', 'level', 'body', 'essence', 'perks', 'attacks', 'equipment', 'grow', 'review'];

/** Which dropped Item types each drop zone takes. */
const DROP_ZONES = {
  perks: ['perk', 'power', 'hangUp'],
  attacks: ['weapon'],
  equipment: ['armor', 'shield', 'gear', 'weapon', 'upgrade'],
};

const T = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));

/**
 * The Threat Builder: the books' threat creation rules as a step-by-step window
 * (helpers/threat-rules.mjs holds the rules themselves and says which book each comes from).
 *
 * Two modes:
 * - create: walk the steps and create a new NPC (or vehicle) through the stat block importer's
 *   own creation path, so a built Threat is identical in shape to an imported one.
 * - audit: read an existing NPC and list where it departs from its rule set. Opened from an NPC
 *   sheet's header menu. Nothing on the actor changes, except that "Remember these rules" stores
 *   the chosen rule set and Threat type on it for next time.
 *
 * Guidance, never enforcement - every book says to bend its rules - so nothing here is blocked;
 * the summary column just shows where the Threat stands.
 */
export default class ThreatBuilder extends serializeFormSubmits(HandlebarsApplicationMixin(ApplicationV2)) {
  /**
   * @param {Object} [options]
   * @param {Actor} [options.actor]   Audit this actor instead of building a new Threat.
   */
  constructor({ actor = null } = {}) {
    super({ id: actor ? `essence20-threat-audit-${actor.id}` : 'essence20-threat-builder' });
    this._actor = actor;
    this._step = actor ? 'review' : 'concept';
    this._state = actor ? this._stateFromActor(actor) : ThreatBuilder.newState();
  }

  /** Open the builder (no actor) or an actor's audit, bringing an open one forward. */
  static open(actor = null) {
    const id = actor ? `essence20-threat-audit-${actor.id}` : 'essence20-threat-builder';
    const existing = foundry.applications.instances.get(id);
    if (existing) {
      existing.bringToFront();
      return existing;
    }

    const app = new ThreatBuilder({ actor });
    app.render({ force: true });
    return app;
  }

  /** A fresh Threat for the world's Game Line, pitched at the party (a Rival). */
  static newState() {
    const ruleset = defaultRulesetFor(getGameLine());
    const partyLevel = ThreatBuilder.partyLevels().average;
    const tl = threatLevelForRole('leader', partyLevel);
    return {
      ruleset,
      name: '',
      concept: '',
      type: 'typical',
      animal: false,
      vehicleAi: false,
      role: 'leader',
      tl,
      healthOverride: null,
      size: 'common',
      groundOverride: null,
      movementTypes: Object.fromEntries(MOVEMENT_TYPES.map(type => [type, false])),
      social: false,
      advanced: 0,
      essences: { strength: 2, speed: 2, smarts: 1, social: 1 },
      skills: {},
      conditioning: 0,
      quickPerks: [],
      customPerks: [],
      customPowers: [],
      customHangUps: [],
      attacks: [],
      dropped: [],
      grow: false,
    };
  }

  /** The party's levels: the primary Party's members, else every player-owned character. */
  static partyLevels() {
    const party = game.actors?.party;
    let members = party?.members ?? [];
    if (!members.length) {
      members = game.actors?.filter(actor => actor.type == 'playerCharacter' && actor.hasPlayerOwner) ?? [];
    }

    const levels = members.map(actor => Number(actor.system?.level) || 1);
    const average = levels.length ? Math.round(levels.reduce((a, b) => a + b, 0) / levels.length) : 1;
    return { levels, average, count: levels.length, appropriate: levels.length ? appropriateThreatLevel(levels) : null };
  }

  static DEFAULT_OPTIONS = {
    actions: {
      step: ThreatBuilder.#onStep,
      next: ThreatBuilder.#onNext,
      back: ThreatBuilder.#onBack,
      role: ThreatBuilder.#onRole,
      addQuickPerk: ThreatBuilder.#onAddQuickPerk,
      addRow: ThreatBuilder.#onAddRow,
      removeRow: ThreatBuilder.#onRemoveRow,
      essencesFromSkills: ThreatBuilder.#onEssencesFromSkills,
      create: ThreatBuilder.#onCreate,
      remember: ThreatBuilder.#onRemember,
      openSkillPicker: ThreatBuilder.#onOpenSkillPicker,
    },
    classes: ["essence20", "theme-wrapper", "e20-window", "threat-builder"],
    tag: "form",
    window: {
      icon: "fa-solid fa-dragon",
      resizable: true,
    },
    position: {
      width: 980,
      height: 760,
    },
    form: {
      handler: ThreatBuilder.#onSubmit,
      submitOnChange: true,
      closeOnSubmit: false,
    },
  };

  static PARTS = {
    form: {
      template: "systems/essence20/templates/app/threat-builder.hbs",
      scrollable: [".threat-builder-step", ".threat-builder-summary"],
    },
  };

  get title() {
    return this._actor
      ? T('E20.ThreatBuilderAuditTitle', { name: this._actor.name })
      : T('E20.ThreatBuilderTitle');
  }

  get steps() {
    const rules = RULESETS[this._state.ruleset] ?? RULESETS.fieldGuide;
    return ALL_STEPS.filter(step => (step != 'equipment' || rules.equipmentStep) && (step != 'grow' || rules.growStep));
  }

  /* -------------------------------------------- */
  /*  State                                       */
  /* -------------------------------------------- */

  _stateFromActor(actor) {
    const threat = threatFromActor(actor, { gameLine: getGameLine() });
    return { ...threat, audit: true };
  }

  /** The Threat as it stands - derived numbers worked out from the choices. */
  _derived() {
    const s = this._state;
    const rules = RULESETS[s.ruleset] ?? RULESETS.fieldGuide;
    const tl = Math.max(0, Number(s.tl) || 0);
    const extraTypes = MOVEMENT_TYPES.filter(type => s.movementTypes?.[type]).length;
    const ground = s.groundOverride ?? threatGroundMovement(s.type, { ruleset: s.ruleset, extraTypes });
    const quick = s.quickPerks ?? [];
    const healthPerks = quick.filter(perk => perk.key == 'health').length;
    const health = (s.healthOverride ?? threatHealth(tl, s.type)) + healthPerks;
    const dropped = s.dropped ?? [];
    const perks = quick.length + (s.customPerks ?? []).filter(p => p.name).length + dropped.filter(d => d.type == 'perk').length;
    const powers = (s.customPowers ?? []).filter(p => p.name).length + dropped.filter(d => d.type == 'power').length;
    const hangUps = (s.customHangUps ?? []).filter(p => p.name).length + dropped.filter(d => d.type == 'hangUp').length;
    const attacks = [
      ...(s.attacks ?? []).map(a => ({ name: a.name, melee: !!a.melee })),
      ...dropped.filter(d => d.type == 'weapon' && d.zone == 'attacks').map(d => ({ name: d.name, melee: !!d.melee })),
    ];
    const defenses = threatDefenses(s.essences);
    const sizeSteps = quick.filter(perk => perk.key == 'size').length;
    const size = SIZE_LADDER[Math.min(SIZE_LADDER.length - 1, Math.max(0, SIZE_LADDER.indexOf(s.size)) + sizeSteps)] ?? s.size;

    // Audit mode: the actor's own numbers, not the builder's lists.
    if (s.audit) {
      return {
        rules, tl, ground, size: s.size, sizeSteps: 0,
        health: s.health, perks: s.perks, powers: s.powers, hangUps: s.hangUps, attacks: s.attacks, defenses: s.defenses,
        budget: essenceBudget({ tl, ruleset: s.ruleset, social: s.social, advanced: s.advanced, vehicleAi: s.vehicleAi, animal: s.animal }),
        perkAllowance: perkBudget({ tl, type: s.type, ruleset: s.ruleset, hangUps: s.hangUps }),
        spend: skillSpend({ skills: s.skills, conditioning: s.conditioning }),
        guide: skillGuideFor(tl),
      };
    }

    return {
      rules, tl, ground, health, perks, powers, hangUps, attacks, defenses, size, sizeSteps,
      budget: essenceBudget({ tl, ruleset: s.ruleset, social: s.social, advanced: s.advanced, vehicleAi: s.vehicleAi, animal: s.animal }),
      perkAllowance: perkBudget({ tl, type: s.type, ruleset: s.ruleset, hangUps }),
      spend: skillSpend({ skills: s.skills, conditioning: s.conditioning }),
      guide: skillGuideFor(tl),
    };
  }

  /** The audit input: the live actor in audit mode, otherwise the Threat being built. */
  _threatForAudit(derived) {
    const s = this._state;
    if (s.audit) {
      return s;
    }

    return {
      ruleset: s.ruleset, type: s.type, tl: derived.tl, social: s.social, advanced: s.advanced, animal: s.animal,
      vehicleAi: s.vehicleAi, size: s.size, sizeSteps: derived.sizeSteps, health: derived.health,
      healthBonus: derived.health - threatHealth(derived.tl, s.type),
      essences: s.essences, skills: s.skills, conditioning: s.conditioning, defenses: derived.defenses,
      perks: derived.perks, powers: derived.powers, hangUps: derived.hangUps, attacks: derived.attacks,
    };
  }

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    // Audit mode re-reads the actor every render, so the findings follow edits made on its sheet
    // meanwhile; only the choices made here (rule set, type, social, Advanced...) are kept.
    if (this._state.audit && this._actor) {
      const keep = ['ruleset', 'type', 'social', 'advanced', 'animal', 'vehicleAi'];
      const kept = Object.fromEntries(keep.map(key => [key, this._state[key]]));
      this._state = { ...threatFromActor(this._actor, { ruleset: kept.ruleset }), ...kept, audit: true, typeInferred: this._state.typeInferred };
    }

    const s = this._state;
    const d = this._derived();
    const party = ThreatBuilder.partyLevels();
    const loc = obj => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, game.i18n.localize(v)]));
    const findings = auditThreat(this._threatForAudit(d)).map(finding => ({
      ...finding,
      text: T(`E20.ThreatAudit.${finding.key}`, {
        ...finding.data,
        essence: finding.data.essence ? game.i18n.localize(CONFIG.E20.originEssences?.[finding.data.essence] ?? finding.data.essence) : '',
        type: finding.data.type ? T(`E20.ThreatType.${finding.data.type}`) : '',
        size: finding.data.size ? game.i18n.localize(CONFIG.E20.actorSizes[finding.data.size] ?? finding.data.size) : '',
        skills: (finding.data.skills ?? []).map(k => game.i18n.localize(CONFIG.E20.skills[k] ?? k)).join(', '),
        max: finding.data.max ?? '',
      }),
    }));

    const steps = this.steps;
    const index = steps.indexOf(this._step);
    const sizes = allowedSizes(s.type, s.ruleset);

    Object.assign(context, {
      audit: !!s.audit,
      actor: this._actor,
      state: s,
      derived: d,
      party,
      findings,
      warnCount: findings.filter(f => f.level == 'warn').length,
      steps: steps.map((key, i) => ({ key, number: i + 1, label: T(`E20.ThreatStep.${key}`), active: key == this._step })),
      step: this._step,
      isFirst: index <= 0,
      isLast: index == steps.length - 1,
      rulesetChoices: Object.fromEntries(Object.keys(RULESETS).map(key => [key, T(`E20.ThreatRuleset.${key}`)])),
      rulesetSource: (RULESETS[s.ruleset] ?? RULESETS.fieldGuide).source,
      types: THREAT_TYPES.map(type => ({
        key: type, label: T(`E20.ThreatType.${type}`), hint: T(`E20.ThreatTypeHint.${type}`), checked: s.type == type,
        health: threatHealth(d.tl, type),
      })),
      roles: Object.entries(ROLE_PRESETS).map(([key, offset]) => ({
        key, label: T(`E20.ThreatRole.${key}`), tl: threatLevelForRole(key, party.average), offset: offset > 0 ? `+${offset}` : `${offset}`,
        active: s.role == key,
      })),
      sizeChoices: Object.fromEntries(SIZE_LADDER.map(size => [size,
        game.i18n.localize(CONFIG.E20.actorSizes[size]) + (sizes && !sizes.includes(size) ? ` (${T('E20.ThreatSizeNeedsPerk')})` : '')])),
      movementRows: MOVEMENT_TYPES.map(type => ({
        key: type, label: game.i18n.localize(CONFIG.E20.movementTypes[type == 'swim' ? 'swim' : type] ?? type),
        checked: !!s.movementTypes?.[type], rate: extraMovementRate(type, d.ground),
      })),
      essenceRows: ESSENCES.map(essence => ({
        key: essence, label: game.i18n.localize(CONFIG.E20.originEssences?.[essence] ?? essence), value: s.essences?.[essence] ?? 0,
        spent: d.spend[essence], over: d.spend[essence] > (s.essences?.[essence] ?? 0),
        skills: SKILLS_BY_ESSENCE[essence].map(key => ({
          key, label: game.i18n.localize(CONFIG.E20.skills[key]),
          shift: s.skills?.[key]?.shift ?? 'd20', specialization: s.skills?.[key]?.specialization ?? '',
        })),
      })),
      shiftChoices: { d20: '—', ...Object.fromEntries(RANKED_SHIFTS.map(shift => [shift, `+${shift}`])) },
      essenceTotal: ESSENCES.reduce((sum, e) => sum + (Number(s.essences?.[e]) || 0), 0),
      defenseRows: Object.entries(d.defenses).map(([key, value]) => ({ label: game.i18n.localize(CONFIG.E20.defenses[key]), value })),
      quickPerkChoices: QUICK_PERKS.map(key => ({ key, label: T(`E20.ThreatQuickPerk.${key}`) })),
      quickPerkRows: (s.quickPerks ?? []).map((perk, i) => ({ ...perk, index: i, label: T(`E20.ThreatQuickPerk.${perk.key}`), isDamage: perk.key == 'damage' })),
      attackChoices: Object.fromEntries((s.attacks ?? []).map((a, i) => [i, a.name || `#${i + 1}`])),
      maxDamagePerks: maxDamagePerks(d.size),
      damagePerks: (s.quickPerks ?? []).filter(p => p.key == 'damage').length,
      droppedRows: (s.dropped ?? []).map((item, i) => ({ ...item, index: i, typeLabel: game.i18n.localize(`TYPES.Item.${item.type}`) })),
      skillChoices: loc(CONFIG.E20.skills),
      damageChoices: loc(CONFIG.E20.damageTypes),
      defenseChoices: loc(CONFIG.E20.defenses),
      actionChoices: loc(CONFIG.E20.actionTypes),
      rulesFlags: d.rules,
      perksSpent: d.perkAllowance.includesPowers ? d.perks + d.powers : d.perks,
      sizeLabel: game.i18n.localize(CONFIG.E20.actorSizes[d.size] ?? d.size ?? ''),
      isVehicle: s.ruleset == 'vehicle',
    });

    return context;
  }

  _onRender(context, options) {
    super._onRender(context, options);
    applyThemeClass(this.element);
    new foundry.applications.ux.DragDrop.implementation({
      dropSelector: '.threat-builder-drop',
      callbacks: { drop: this._onDrop.bind(this) },
    }).bind(this.element);
  }

  async _onDrop(event) {
    const zone = event.target.closest('.threat-builder-drop')?.dataset.zone;
    const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
    if (!zone || data?.type != 'Item') {
      return;
    }

    const item = await fromUuid(data.uuid);
    if (!item || !DROP_ZONES[zone]?.includes(item.type)) {
      ui.notifications.warn(T('E20.ThreatDropWrongType', { name: item?.name ?? '' }));
      return;
    }

    // A dropped weapon's first effect says whether it is melee, for the attack mix check.
    let melee = false;
    if (item.type == 'weapon') {
      const effect = Object.values(item.system?.items ?? {})[0];
      melee = !effect?.range?.value;
    }

    this._state.dropped.push({ uuid: item.uuid, name: item.name, img: item.img, type: item.type, zone, melee });
    this.render();
  }

  /* -------------------------------------------- */
  /*  Form                                        */
  /* -------------------------------------------- */

  static async #onSubmit(event, form, formData) {
    const data = foundry.utils.expandObject(formData.object);
    const s = this._state;
    const asArray = value => Object.values(value ?? {});
    const number = (value, fallback = null) => (value === '' || value === null || value === undefined ? fallback : Number(value));

    for (const key of ['name', 'concept', 'type', 'size']) {
      if (key in data) s[key] = data[key];
    }

    for (const key of ['animal', 'vehicleAi', 'social', 'grow']) {
      if (key in data) s[key] = !!data[key];
    }

    if ('ruleset' in data && data.ruleset != s.ruleset) {
      s.ruleset = data.ruleset;
      if (!this.steps.includes(this._step)) {
        this._step = 'review';
      }
    }

    if ('tl' in data) {
      s.tl = Math.max(0, number(data.tl, 0));
      s.role = null;
    }

    if ('advanced' in data) s.advanced = number(data.advanced, 0);
    if ('conditioning' in data) s.conditioning = number(data.conditioning, 0);
    if ('healthOverride' in data) s.healthOverride = number(data.healthOverride);
    if ('groundOverride' in data) s.groundOverride = number(data.groundOverride);
    if (data.movementTypes) s.movementTypes = { ...s.movementTypes, ...data.movementTypes };
    if (data.essences) {
      for (const essence of ESSENCES) {
        if (essence in data.essences) s.essences[essence] = Math.max(0, number(data.essences[essence], 0));
      }
    }

    if (data.skills) {
      for (const [key, skill] of Object.entries(data.skills)) {
        s.skills[key] = { ...s.skills[key], ...skill };
      }
    }

    for (const key of ['quickPerks', 'customPerks', 'customPowers', 'customHangUps', 'attacks']) {
      if (data[key]) {
        const rows = asArray(data[key]);
        s[key] = s[key].map((row, i) => ({ ...row, ...(rows[i] ?? {}) }));
      }
    }

    s.attacks = s.attacks.map(attack => ({ ...attack, melee: attack.melee === true || attack.melee === 'true' }));
    this.render();
  }

  /* -------------------------------------------- */
  /*  Actions                                     */
  /* -------------------------------------------- */

  static #onStep(event, target) {
    this._step = target.dataset.step;
    this.render();
  }

  static #onNext() {
    const steps = this.steps;
    this._step = steps[Math.min(steps.length - 1, steps.indexOf(this._step) + 1)];
    this.render();
  }

  static #onBack() {
    const steps = this.steps;
    this._step = steps[Math.max(0, steps.indexOf(this._step) - 1)];
    this.render();
  }

  static #onRole(event, target) {
    const role = target.dataset.role;
    this._state.role = role;
    this._state.tl = threatLevelForRole(role, ThreatBuilder.partyLevels().average);
    this.render();
  }

  static #onAddQuickPerk(event, target) {
    const key = this.element.querySelector('[data-quick-perk-select]')?.value ?? target.dataset.key;
    if (key) {
      this._state.quickPerks.push({ key, attack: 0 });
      this.render();
    }
  }

  static #onAddRow(event, target) {
    const list = target.dataset.list;
    const blank = list == 'attacks'
      ? { name: '', melee: true, skill: 'might', damageValue: 1, damageType: 'blunt', defenseType: 'toughness', range: 30 }
      : { name: '', text: '' };
    this._state[list]?.push(blank);
    this.render();
  }

  static #onRemoveRow(event, target) {
    const { list, index } = target.dataset;
    this._state[list]?.splice(Number(index), 1);
    this.render();
  }

  static #onEssencesFromSkills() {
    const s = this._state;
    s.essences = { ...s.essences, ...essencesFromSkills({ skills: s.skills, conditioning: s.conditioning }) };
    this.render();
  }

  static async #onCreate() {
    const s = this._state;
    if (!s.name?.trim()) {
      ui.notifications.warn(T('E20.ThreatBuilderNeedsName'));
      this._step = 'concept';
      this.render();
      return;
    }

    const labels = { quickPerk: Object.fromEntries(QUICK_PERKS.map(key => [key, T(`E20.ThreatQuickPerk.${key}`)])) };
    const ir = buildThreatIr({ ...s, health: this._derived().health - (s.quickPerks ?? []).filter(p => p.key == 'health').length, ground: s.groundOverride ?? undefined }, labels);
    const { createActorFromStatBlock } = await import("../helpers/stat-block-import.mjs");
    const actor = await createActorFromStatBlock(ir, { type: s.ruleset == 'vehicle' ? 'vehicle' : 'npc' });
    if (!actor) {
      return;
    }

    // healthPerks lets a later audit expect the Health those quick Perks added.
    const update = {
      'flags.essence20.threatBuild': {
        ruleset: s.ruleset, type: s.type, social: s.social, advanced: s.advanced, animal: s.animal, vehicleAi: s.vehicleAi,
        healthPerks: (s.quickPerks ?? []).filter(perk => perk.key == 'health').length,
      },
    };
    if (s.concept?.trim()) {
      update['system.biography.bio'] = `<p>${foundry.utils.escapeHTML(s.concept.trim())}</p>`;
    }

    await actor.update(update);

    // Dropped compendium items go through the sheet's own drop handling, so a weapon arrives with
    // its effects and a Perk with its choices exactly as if it had been dragged onto the sheet.
    // v14's sheet drop handler takes the resolved Item document, not the drag data.
    for (const item of s.dropped ?? []) {
      try {
        const document = await fromUuid(item.uuid);
        if (document) {
          await actor.sheet._onDropItem(new DragEvent('drop'), document);
        }
      } catch (error) {
        console.warn(`essence20 | Threat Builder could not add ${item.name}`, error);
      }
    }

    ui.notifications.info(T('E20.ThreatBuilderCreated', { name: actor.name }));
    actor.sheet.render(true);
    if (s.grow && (RULESETS[s.ruleset] ?? {}).growStep) {
      const { default: MonsterGrowDialog } = await import("./monster-grow-dialog.mjs");
      new MonsterGrowDialog(actor).render(true);
    }

    this.close();
  }

  /** Audit mode: store the chosen rule set and Threat type on the actor. */
  static async #onRemember() {
    if (!this._actor) {
      return;
    }

    const s = this._state;
    await this._actor.update({
      'flags.essence20.threatBuild': {
        ruleset: s.ruleset, type: s.type, social: !!s.social, advanced: Number(s.advanced) || 0, animal: !!s.animal, vehicleAi: !!s.vehicleAi,
        healthPerks: Number(this._actor.flags?.essence20?.threatBuild?.healthPerks) || 0,
      },
    });
    ui.notifications.info(T('E20.ThreatAuditRemembered', { name: this._actor.name }));
  }

  static async #onOpenSkillPicker() {
    if (!this._actor) {
      return;
    }

    const { default: SkillPicker } = await import("./skill-picker.mjs");
    new SkillPicker(this._actor).render(true);
  }
}
