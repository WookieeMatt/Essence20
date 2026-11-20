import { applyThemeClass } from "../settings.js";
import { RACE_FLAG, addRacers, bump, normalizeRace, removeRacer, resetRace, standings, standingsHtml } from "../mechanics/campaign/race.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * GM-only Race and Chase Tracker: the viewed scene's race (mechanics/campaign/race.mjs) - join the selected tokens, count
 * each one's laps or lead up and down, post the standings, reset. A hazard table, if picked, is drawn to chat when the
 * leader starts a new lap, or with the Hazard button.
 */
export default class RaceTracker extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "essence20-race-tracker",
    classes: ["essence20", "theme-wrapper", "e20-window", "race-tracker"],
    tag: "form",
    window: {
      icon: "fa-solid fa-flag-checkered",
      title: "E20.RaceTitle",
      resizable: true,
    },
    position: {
      width: 440,
      height: "auto",
    },
    form: {
      handler: RaceTracker.#onChange,
      submitOnChange: true,
      closeOnSubmit: false,
    },
    actions: {
      addSelected: RaceTracker.#onAddSelected,
      remove: RaceTracker.#onRemove,
      up: RaceTracker.#onUp,
      down: RaceTracker.#onDown,
      post: RaceTracker.#onPost,
      reset: RaceTracker.#onReset,
      hazard: RaceTracker.#onHazard,
    },
  };

  static PARTS = {
    form: {
      template: "systems/essence20/templates/app/race-tracker.hbs",
      scrollable: [".race-racers"],
    },
  };

  static #instance = null;

  /** Open (or bring forward) the one Race and Chase Tracker. */
  static open() {
    this.#instance ??= new this();
    return this.#instance.render({ force: true });
  }

  /** Draw it again if it's open (the scene's race changed, or another scene is viewed). */
  static refresh() {
    if (this.#instance?.rendered) {
      this.#instance.render();
    }
  }

  get scene() {
    return canvas?.scene ?? null;
  }

  /** The scene's race, each racer under its token's current name. */
  get race() {
    const race = normalizeRace(this.scene?.getFlag("essence20", RACE_FLAG));
    race.racers.forEach(racer => (racer.name = this.scene?.tokens.get(racer.tokenId)?.name ?? racer.name));
    return race;
  }

  async #save(race) {
    await this.scene?.setFlag("essence20", RACE_FLAG, race);
  }

  /** "2 laps" / "lead 3". */
  static unit(mode, count) {
    if (mode == "lead") {
      return game.i18n.format("E20.RaceUnitLead", { count });
    }

    return game.i18n.format(Math.abs(count) == 1 ? "E20.RaceUnitLap" : "E20.RaceUnitLaps", { count });
  }

  async _prepareContext() {
    const race = this.race;
    const tables = game.tables.contents.map(table => ({ uuid: table.uuid, name: table.name }));
    for (const pack of game.packs.filter(entry => entry.documentName == "RollTable" && entry.visible)) {
      tables.push(...pack.index.map(entry => ({ uuid: entry.uuid, name: `${entry.name} (${pack.title})` })));
    }

    tables.sort((a, b) => a.name.localeCompare(b.name));

    return {
      scene: this.scene?.name ?? "",
      hasScene: !!this.scene,
      race,
      isLaps: race.mode == "laps",
      modes: { laps: game.i18n.localize("E20.RaceModeLaps"), lead: game.i18n.localize("E20.RaceModeLead") },
      countLabel: game.i18n.localize(race.mode == "lead" ? "E20.RaceColumnLead" : "E20.RaceColumnLaps"),
      racers: standings(race),
      tables: Object.fromEntries([["", game.i18n.localize("E20.RaceNoHazards")], ...tables.map(table => [table.uuid, table.name])]),
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    applyThemeClass(this.element);
  }

  static async #onChange(event, form, formData) {
    const values = formData.object;
    await this.#save({ ...this.race, mode: values.mode, hazardTable: values.hazardTable ?? "", hazardEachLap: !!values.hazardEachLap });
  }

  static async #onAddSelected() {
    const tokens = canvas.tokens?.controlled ?? [];
    if (!tokens.length) {
      ui.notifications.warn("E20.RaceSelectTokens", { localize: true });
      return;
    }

    await this.#save(addRacers(this.race, tokens));
  }

  static async #onRemove(event, target) {
    await this.#save(removeRacer(this.race, target.closest("[data-token-id]").dataset.tokenId));
  }

  async #bump(target, delta) {
    const { race, newLap } = bump(this.race, target.closest("[data-token-id]").dataset.tokenId, delta);
    await this.#save(race);
    if (newLap && race.hazardEachLap) {
      await this.#drawHazard(race);
    }
  }

  static async #onUp(event, target) {
    await this.#bump(target, 1);
  }

  static async #onDown(event, target) {
    await this.#bump(target, -1);
  }

  static async #onPost() {
    const race = this.race;
    const title = game.i18n.localize(race.mode == "lead" ? "E20.RaceChaseStandings" : "E20.RaceStandings");
    await ChatMessage.implementation.create({
      speaker: ChatMessage.implementation.getSpeaker({ alias: title }),
      content: standingsHtml(race, { title, unit: count => RaceTracker.unit(race.mode, count) }),
    });
  }

  static async #onReset() {
    await this.#save(resetRace(this.race));
  }

  async #drawHazard(race) {
    const table = race.hazardTable ? await fromUuid(race.hazardTable) : null;
    if (!table) {
      ui.notifications.warn("E20.RaceNoHazardTable", { localize: true });
      return;
    }

    await table.draw();
  }

  static async #onHazard() {
    await this.#drawHazard(this.race);
  }
}

// The viewed scene's race changed, or another scene is viewed.
Hooks.on("updateScene", (scene, changes) => {
  if (scene == canvas?.scene && foundry.utils.hasProperty(changes, `flags.essence20.${RACE_FLAG}`)) {
    RaceTracker.refresh();
  }
});
Hooks.on("canvasReady", () => RaceTracker.refresh());
