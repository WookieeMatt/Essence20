const { ActorDirectory } = foundry.applications.sidebar.tabs;

/**
 * The Actors sidebar tab, extended so Party ("Squad") actors render as expandable folders with
 * their Player-Character members nested inside. Drop a PC onto a squad folder to add them;
 * drag a member out, right-click → Remove from Squad, or click the eject button to remove.
 * The squad the GM has pinned (essence20.primaryParty) floats to the top with an accent.
 *
 * Structure is a port of PF2e's ActorDirectoryPF2e: an extra `parties` PART whose rendered
 * <ol> is relocated into the top of the `directory` PART in _onRender (before super binds
 * drag/drop over `.directory-item` / `.directory-list`).
 */
export class Essence20ActorDirectory extends ActorDirectory {
  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    actions: {
      togglePartyFolder: Essence20ActorDirectory.#onTogglePartyFolder,
      openPartySheet: Essence20ActorDirectory.#onOpenPartySheet,
      pinParty: Essence20ActorDirectory.#onPinParty,
      removePartyMember: Essence20ActorDirectory.#onRemovePartyMember,
    },
    // Array options replace wholesale down the DEFAULT_OPTIONS chain, so repeat the base keys
    // plus `system.actors` (a roster change must re-render).
    renderUpdateKeys: ["name", "img", "ownership", "sort", "folder", "system.actors"],
  };

  /** @inheritDoc */
  static PARTS = (() => {
    const parts = { ...super.PARTS };
    parts.parties = { template: "systems/essence20/templates/sidebar/party-directory.hbs" };
    return parts;
  })();

  /** { [partyId]: boolean } expand state, seeded from the partyFolderState client setting. */
  #expanded = foundry.utils.deepClone(game.settings.get("essence20", "partyFolderState") ?? {});

  /** { [partyId]: boolean } open state captured at the start of a search, or null. */
  #preSearchExpanded = null;

  /** True while a Party actor is itself the drag source (used to suppress folder highlight). */
  #draggingParty = false;

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);
    if (partId !== "parties") {
      return context;
    }

    const pinnedId = game.actors.party?.id ?? null;
    const toContext = party => ({
      id: party.id,
      name: party.name,
      img: party.img,
      pinned: party.id === pinnedId,
      memberCount: party.members.length,
      members: party.members.map(m => ({ id: m.id, uuid: m.uuid, name: m.name, img: m.img })),
    });

    context.parties = this.collection
      .filter(actor => actor.type === "party")
      .sort((a, b) => (b.id === pinnedId) - (a.id === pinnedId) || a.sort - b.sort)
      .map(toContext);
    context.expanded = this.#expanded;
    return context;
  }

  /** @inheritDoc */
  render(options = {}, _options = {}) {
    // A `parties`-only re-render must also re-render `directory`, or the relocation + drag/drop
    // rebinding in _onRender won't run and drop handling breaks.
    if (options && typeof options === "object" && options.parts?.includes("parties")
      && !options.parts.includes("directory")) {
      options.parts.push("directory");
    }

    return super.render(options, _options);
  }

  /** @inheritDoc */
  async _onRender(context, options) {
    // Relocate the parties <ol> to the top of the directory list BEFORE super._onRender binds
    // DragDrop over the directory subtree.
    if (options.parts.includes("directory") && this.parts.parties && this.parts.directory) {
      this.parts.parties.remove();
      this.parts.directory.prepend(this.parts.parties);
    }

    await super._onRender(context, options);

    // Party actors are managed through their folder now - drop their plain rows from the tree.
    if (options.parts.includes("directory")) {
      for (const el of this.element.querySelectorAll("li.directory-item.entry[data-entry-id]")) {
        if (game.actors.get(el.dataset.entryId)?.type === "party" && !el.closest(".e20-parties")) {
          el.remove();
        }
      }
    }
  }

  /* -------------------------------------------- */
  /*  Context menus                               */
  /* -------------------------------------------- */

  /** @override - keep folder context menus off the party "folders". */
  _createContextMenus() {
    this._createContextMenu(this._getFolderContextOptions, ".folder:not([data-party]) .folder-header", {
      fixed: true,
      hookName: "getFolderContextOptions",
      parentClassHooks: false,
    });
    this._createContextMenu(this._getEntryContextOptions, ".directory-item[data-entry-id]", {
      fixed: true,
      hookName: `get${this.documentName}ContextOptions`,
      parentClassHooks: false,
    });
  }

  /** @inheritDoc */
  _getEntryContextOptions() {
    const options = super._getEntryContextOptions();
    options.push({
      label: "E20.PartyRemoveMember",
      icon: '<i class="fa-solid fa-eject"></i>',
      visible: li => game.user.isGM && !!li.closest("[data-party]") && !li.closest(".folder-header"),
      callback: li => {
        const party = game.actors.get(li.closest("[data-party]")?.dataset.entryId);
        const member = game.actors.get(li.dataset.entryId);
        if (party && member) {
          party.removeMember(member.uuid);
        }
      },
    });
    return options;
  }

  /* -------------------------------------------- */
  /*  Search                                      */
  /* -------------------------------------------- */

  /**
   * @inheritDoc
   * The base search filter treats the squad "folders" as real folders and, since they carry no
   * folderId, hides them on any query and collapses them on clear. Re-derive their state here:
   * during a search, show + expand a folder whose member matches (collapse others); on clear,
   * restore the open state each folder had when the search began.
   */
  _onSearchFilter(event, query, rgx, html) {
    // Snapshot open state at the first keystroke of a search.
    if (query && !this.#preSearchExpanded) {
      this.#preSearchExpanded = {};
      for (const folder of html.querySelectorAll(".e20-parties .e20-party-folder")) {
        this.#preSearchExpanded[folder.dataset.entryId] = folder.classList.contains("expanded");
      }
    }

    super._onSearchFilter(event, query, rgx, html);

    for (const folder of html.querySelectorAll(".e20-parties .e20-party-folder")) {
      const id = folder.dataset.entryId;

      if (query) {
        const hasMatch = [...folder.querySelectorAll(".directory-item.actor")]
          .some(li => !li.hidden && li.style.display !== "none");
        folder.style.display = hasMatch ? "flex" : "none";
        folder.classList.toggle("expanded", hasMatch || !!this.#preSearchExpanded?.[id]);
      } else {
        folder.style.display = "flex";
        folder.classList.toggle("expanded", !!(this.#preSearchExpanded?.[id] ?? this.#expanded[id]));
      }
    }

    if (!query) {
      this.#preSearchExpanded = null;
    }
  }

  /* -------------------------------------------- */
  /*  Drag & drop                                 */
  /* -------------------------------------------- */

  /** @inheritDoc */
  _onDragStart(event) {
    super._onDragStart(event);

    const partyId = event.target.closest("[data-party]")?.dataset.entryId;
    if (!partyId) {
      this.#draggingParty = false;
      return;
    }

    try {
      const data = JSON.parse(event.dataTransfer.getData("text/plain"));
      data.fromParty = partyId;
      event.dataTransfer.setData("text/plain", JSON.stringify(data));
      this.#draggingParty = fromUuidSync(data.uuid)?.type === "party";
    } catch {
      this.#draggingParty = false;
    }
  }

  /** @inheritDoc */
  _onDragHighlight(event) {
    if (event.type === "dragenter" && this.#draggingParty) {
      event.stopPropagation();
      return;
    }

    super._onDragHighlight(event);
  }

  /** @inheritDoc */
  async _handleDroppedEntry(target, data) {
    const toPartyId = target?.closest("[data-party]")?.dataset.entryId ?? null;
    const fromPartyId = data.fromParty ?? null;

    if (fromPartyId && fromPartyId !== toPartyId) {
      await game.actors.get(fromPartyId)?.removeMember(data.uuid);
    }

    if (toPartyId) {
      if (toPartyId !== fromPartyId) {
        const dropped = await fromUuid(data.uuid);
        if (dropped?.type === "playerCharacter") {
          await game.actors.get(toPartyId)?.addMember(dropped);
          this.#setExpanded(toPartyId, true);
        }
      }

      return; // handled entirely as a squad-membership change
    }

    return super._handleDroppedEntry(target, data);
  }

  /* -------------------------------------------- */
  /*  Public API                                  */
  /* -------------------------------------------- */

  /** @inheritDoc */
  collapseAll() {
    super.collapseAll();

    for (const el of this.element.querySelectorAll(".e20-party-folder.expanded")) {
      el.classList.remove("expanded");
    }

    this.#expanded = {};
    game.settings.set("essence20", "partyFolderState", {});
  }

  /* -------------------------------------------- */
  /*  Handlers                                    */
  /* -------------------------------------------- */

  /**
   * Persists an expand/collapse state change for one squad folder.
   * @param {string} id      The Party actor id.
   * @param {boolean} value  Whether it is now expanded.
   */
  #setExpanded(id, value) {
    this.#expanded[id] = value;
    game.settings.set("essence20", "partyFolderState", this.#expanded);
  }

  static #onTogglePartyFolder(event, target) {
    const li = target.closest("li[data-party]");
    const id = li?.dataset.entryId;
    if (!id) {
      return;
    }

    const expanded = !li.classList.contains("expanded");
    li.classList.toggle("expanded", expanded);
    this.#setExpanded(id, expanded);
  }

  static #onOpenPartySheet(event, target) {
    const id = target.closest("[data-entry-id]")?.dataset.entryId;
    game.actors.get(id)?.sheet.render(true);
  }

  static #onPinParty(event, target) {
    if (!game.user.isGM) {
      return;
    }

    const id = target.closest("[data-entry-id]")?.dataset.entryId;
    if (game.actors.has(id)) {
      game.settings.set("essence20", "primaryParty", id);
    }
  }

  static #onRemovePartyMember(event, target) {
    const party = game.actors.get(target.closest("[data-party]")?.dataset.entryId);
    const member = game.actors.get(target.closest("[data-entry-id]")?.dataset.entryId);
    if (party && member) {
      party.removeMember(member.uuid);
    }
  }
}
