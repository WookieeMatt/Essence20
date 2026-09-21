import { Essence20BaseActorSheet } from "./base-actor-sheet.mjs";
import { requisitionAccess, requisitionDrop } from "../helpers/requisition.mjs";
import { getGameLine } from "../settings.js";

/**
 * Sheet for the Party ("Squad") actor: a roster of Player Characters, the squad's shared
 * Requisition budget (rolled per member, spent from one pool - GI Joe CRB p.137-138 / TF CRB
 * p.115-116 / PR CRB p.103), a Mission Critical Items stash ("assigned to your squad, not
 * each Joe"), plus the shared effects/notes tabs.
 */
export class Essence20PartyActorSheet extends Essence20BaseActorSheet {
  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    // Spread, not retyped. Foundry merges DEFAULT_OPTIONS down the class chain but REPLACES
    // arrays wholesale, so declaring `classes` here at all drops everything the base sheet
    // listed. Both sheets used to restate the list by hand and both had silently lost
    // "e20-window", the opt-in every window-frame rule keys off - which is why this sheet kept
    // losing its bottom-right corner long after that was fixed everywhere else.
    classes: [...Essence20BaseActorSheet.DEFAULT_OPTIONS.classes],
    actions: {
      openMember: Essence20PartyActorSheet.#onOpenMember,
      requisitionReset: Essence20PartyActorSheet.#onRequisitionReset,
    },
    position: {
      width: 760,
      height: 680,
    },
  };

  static TABS = {
    primary: {
      tabs: [
        { id: "roster", group: 'primary', label: "E20.TabRoster" },
        { id: "requisition", group: 'primary', label: "E20.TabRequisition" },
        { id: "missionCritical", group: 'primary', label: "E20.TabMissionCritical" },
        { id: "effects", group: 'primary', label: "E20.TabEffects" },
        { id: "notes", group: 'primary', label: "E20.TabNotes" },
      ],
      initial: "roster",
    },
  };

  static PARTS = {
    header: {
      template: "systems/essence20/templates/actor/headers/party.hbs",
    },
    sidebar: {
      template: "systems/essence20/templates/actor/sidebars/party.hbs",
    },
    tabs: {
      template: "templates/generic/tab-navigation.hbs",
    },
    roster: {
      template: "systems/essence20/templates/actor/parts/main/party-roster.hbs",
      scrollable: [''],
    },
    requisition: {
      template: "systems/essence20/templates/actor/parts/main/party-requisition.hbs",
      scrollable: [''],
    },
    missionCritical: {
      template: "systems/essence20/templates/actor/parts/main/party-mission-critical.hbs",
      scrollable: [''],
    },
    effects: {
      template: "systems/essence20/templates/actor/tabs/effects.hbs",
      scrollable: [''],
    },
    notes: {
      template: "systems/essence20/templates/actor/tabs/notes.hbs",
      scrollable: [""],
    },
  };

  /**
   * The window title: the game-line-specific squad name when a line is set (Strike Team,
   * Ranger Team, …), appended to the actor's own name; otherwise just the actor name.
   * @override
   */
  get title() {
    const line = getGameLine();
    if (!line) {
      return this.document.name;
    }

    return `${this.document.name} — ${game.i18n.localize(`E20.PartyName${line.capitalize()}`)}`;
  }

  /**
   * AppV2 only writes the window-frame title on the initial frame render, so a change to the
   * game line setting (which re-renders the content but not the frame) would leave a stale
   * title. Re-apply it from the getter on every render.
   * @override
   */
  _onRender(context, options) {
    super._onRender(context, options);

    if (this.window?.title) {
      this.window.title.textContent = this.title;
    }

    this.#applyConditionalTabs();
  }

  /**
   * Hides the Requisition tab for a My Little Pony squad.
   *
   * Equipment Assignment and Requisition is a GI Joe mechanic that Power Rangers and
   * Transformers adapt (PR CRB p.105, TF CRB p.135-136). The MLP core rulebook has no
   * Requisition phase at all - the word does not appear in it - so showing the tab on a
   * Friend Group offers a mechanic that line does not have.
   *
   * Hidden rather than removed from TABS: the tab comes straight back if the world's game
   * line is changed, and any Requisition already logged is not thrown away.
   */
  #applyConditionalTabs() {
    const hidden = getGameLine() == 'myLittlePony';
    const navLink = this.element.querySelector('nav.tabs a[data-tab="requisition"]');
    if (navLink) {
      navLink.style.display = hidden ? 'none' : '';
    }

    if (hidden && this.tabGroups?.primary == 'requisition') {
      this.changeTab('roster', 'primary');
    }
  }

  /** @override */
  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);

    // The world's game line, for the sidebar caption. Every part gets it so the template
    // does not have to reach for the setting itself.
    context.gameLine = getGameLine();

    if (partId === 'roster') {
      // Live Player Character members only (drops stale / non-PC system.actors entries that
      // prepareSystemActors' context.actors would still list).
      context.members = this.document.members;
    }

    if (partId === 'requisition') {
      // One block per Player Character member, each with their Requisitionable items (weapons
      // and armor - the two Item types that carry an Availability).
      const withAccess = (actor) => (item) => ({ item, access: requisitionAccess(actor, item) });
      context.requisitionMembers = this.document.members.map(actor => ({
        actor,
        weapons: actor.items.filter(item => item.type === 'weapon').map(withAccess(actor)),
        armors: actor.items.filter(item => item.type === 'armor').map(withAccess(actor)),
      }));
    }

    return context;
  }

  /**
   * An Item dropped on a member in the Requisition tab is a Requisition for that member, not
   * an item for the Party actor itself: they roll for it, and it lands on THEIR sheet.
   *
   * Anywhere else on the sheet keeps the inherited behaviour, which is what the Mission
   * Critical stash ("assigned to your squad, not each Joe") relies on.
   * @param {DragEvent} event   The concluding drop event.
   * @param {Object} data   The drag data.
   * @override
   */
  async _onDropItem(event, data) {
    const memberId = event.target.closest('[data-requisition-member]')?.dataset.requisitionMember;
    if (!memberId) {
      return super._onDropItem(event, data);
    }

    if (!this.document.isOwner) {
      return false;
    }

    const member = game.actors.get(memberId);
    const item = await Item.implementation.fromDropData(data);
    if (!member || !item) {
      return false;
    }

    return requisitionDrop(member, item, this.document);
  }

  /**
   * Opens a roster member's own sheet.
   * @param {PointerEvent} event   The originating click event.
   */
  static #onOpenMember(event) {
    const uuid = event.target.closest('[data-member-uuid]')?.dataset.memberUuid;
    if (uuid) {
      fromUuidSync(uuid)?.sheet.render(true);
    }
  }


  /**
   * Resets the shared Requisition attempt pool to its derived maximum (3 x roster size, or the
   * current value when autoFromRoster is off).
   */
  static #onRequisitionReset() {
    if (!this.document.isOwner) {
      return;
    }

    this.document.update({ 'system.requisition.attempts': this.document.system.requisitionMax });
  }
}
