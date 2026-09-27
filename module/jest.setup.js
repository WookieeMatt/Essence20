import { jest } from '@jest/globals';
import { E20 } from './helpers/config.mjs';
import { legacyPoolParty } from './jest.legacy-pool-party.js';

/*
 * Minimal Foundry VTT client environment so document classes (which do
 * `class Essence20Actor extends Actor`, `extends HandlebarsApplicationMixin(ApplicationV2)`,
 * etc.) can be imported and exercised under Jest without a running Foundry client.
 * Only what's needed to load the module graph and drive isolated business-logic tests
 * is stubbed here - anything render/DOM/database-heavy is out of scope for unit tests
 * (see docs/QA_PLAN.md's Quench recommendation for that layer).
 */

// Foundry extends the built-in String prototype with a few helpers used throughout
// the system's derived-data code (e.g. `defense.essence.capitalize()`).
if (!String.prototype.capitalize) {
  Object.defineProperty(String.prototype, 'capitalize', {
    value: function capitalize() {
      return this.length ? this.charAt(0).toUpperCase() + this.slice(1) : this;
    },
    configurable: true,
    writable: true,
  });
}

// Foundry also extends the built-in Math object with radian/degree conversions, used by
// helpers/aoe-targeting.mjs's own angle math (matching the same conversions Foundry's own
// MeasuredTemplate/Region shape code uses internally).
Math.toDegrees ??= function toDegrees(radians) {
  return radians * (180 / Math.PI);
};

Math.toRadians ??= function toRadians(degrees) {
  return degrees * (Math.PI / 180);
};

global.Actor = class Actor {
  constructor() {}
  async _preCreate() {}
  getRollData() {
    return foundry.utils.deepClone(this.system ?? {});
  }
};

global.Item = class Item {
  constructor() {}
  prepareData() {}
  prepareDerivedData() {}
  async _preCreate() {}
  async _preUpdate() {}
};

/* Returning undefined from _preUpdateMovement is what core does when it has no objection -
   Essence20TokenDocument checks for an explicit false, so the two must not be conflated. */
global.TokenDocument = class TokenDocument {
  constructor() {}
  async _preUpdateMovement() {}
};
global.ChatMessage = {
  getSpeaker: jest.fn(() => ({})),
  create: jest.fn(),
};

global.Roll = class Roll {
  constructor(formula, data) {
    this.formula = formula;
    this.data = data;
  }
  toMessage() {}
};

// Just enough of ActiveEffect.applyChange (client/documents/active-effect.mjs) for
// helpers/skill-effects.mjs's tests - OVERRIDE (the only mode real compendium Perks in this
// codebase actually use) coerces the change's value to the current field's type, and ADD does a
// numeric add or boolean OR. Real Foundry's own mode dispatch is far more elaborate (MULTIPLY,
// UPGRADE, DOWNGRADE, per-field-type custom handlers); this only needs to be correct for the two
// modes this system's own content uses.
global.ActiveEffect = class ActiveEffect {
  // Minimal stand-in for ActiveEffect.implementation.fromStatusEffect(id) (real Foundry builds a
  // full effect document from CONFIG.statusEffects) - just enough for helpers/actor.mjs's
  // syncAutoBlindStatus/syncAutoImmobilizedStatus tests, which only need something with an
  // updateSource() to flag as auto-applied before createEmbeddedDocuments.
  static async fromStatusEffect() {
    return { updateSource: jest.fn() };
  }

  static get implementation() {
    return ActiveEffect;
  }

  static applyChange(targetDoc, change) {
    const current = foundry.utils.getProperty(targetDoc, change.key);
    let value = change.value;
    if (change.mode === 2) { // CONST.ACTIVE_EFFECT_MODES.ADD
      value = typeof current === "boolean"
        ? current || value === "true" || value === true
        : Number(current || 0) + Number(value);
    } else if (typeof current === "boolean") {
      value = value === "true" || value === true;
    } else if (typeof current === "number") {
      value = Number(value);
    }

    return { [change.key]: value };
  }
};

global.fromUuid = jest.fn();
global.fromUuidSync = jest.fn();

// Declares the `canvas` global (Foundry's own scene/token layer) as undefined rather than
// leaving it undeclared - helpers/allies.mjs#getNearbyAllyTokens and its siblings read it via
// bare `canvas?.tokens`/`canvas?.grid`, and a bare identifier that was never assigned ANYWHERE
// throws ReferenceError on read, not just returns undefined, unlike an actual missing object
// property. Test files that exercise those helpers already set `global.canvas` to a real
// fixture themselves before calling anything that needs it (and restore it afterward) - this
// only guarantees the identifier exists at all so a file that happens to run before any of
// those, or a test within one of them that deliberately leaves canvas unset to exercise the
// "no scene" path, doesn't crash on ordering alone.
global.canvas = undefined;

global.game = {
  i18n: {
    localize: (key) => key,
    format: (key) => key,
  },
  settings: {
    get: jest.fn(() => 'roll'),
  },
  packs: [],
};

// The Story Point pool lives on the primary Party; see jest.legacy-pool-party.js for why the
// stand-in reads it from the mocked world setting.
global.game.actors = { party: legacyPoolParty() };
global.CONFIG = { E20 };

global.ui = {
  notifications: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
};

// Foundry's DataModel schema field classes. Data model files (module/data/**) reference
// these at import time (`const fields = foundry.data.fields;`), but their defineSchema()
// methods aren't invoked by these unit tests, so a field just needs to be a constructible
// stand-in - it doesn't need to actually validate or serialize anything.
class StubDataField {
  constructor(options = {}) {
    this.options = options;
  }
}

global.foundry = {
  applications: {
    // Foundry keeps every open ApplicationV2 here, keyed by id. Code that wants to refresh an
    // app it does not own looks it up rather than holding a reference, so the stand-in needs to
    // be a real Map - an empty one simply reports that nothing is open.
    instances: new Map(),
    api: {
      ApplicationV2: class ApplicationV2 {},
      HandlebarsApplicationMixin: (Base) => class extends Base {},
    },
    handlebars: {
      renderTemplate: jest.fn(async () => ''),
    },
  },
  abstract: {
    TypeDataModel: class TypeDataModel {
      constructor() {}
      prepareDerivedData() {}
      static migrateData(source) {
        return source;
      }
    },
  },
  documents: {
    collections: {
      // Minimal stand-in for the world Actor collection so documents/actors.mjs
      // (`class Essence20Actors extends foundry.documents.collections.Actors`) can be imported.
      Actors: class Actors {
        constructor(entries = []) {
          this._byId = new Map(entries.map(e => [e._id ?? e.id, e]));
        }
        get(id) {
          return this._byId.get(id);
        }
      },
    },
  },
  dice: {
    terms: {
      // Real behavior isn't needed for unit tests (helpers/reroll.mjs only needs `instanceof`
      // checks against this) - test fixtures build their own plain {results, rolls} shape and
      // set this as their prototype.
      PoolTerm: class PoolTerm {},
    },
  },
  data: {
    fields: new Proxy({}, {
      get: () => StubDataField,
    }),
    // The value paired with a "-=<key>" deletion path (see e.g. specialization-handler.mjs's
    // deleteSpecialization) - Foundry v14 deprecated plain `null` there in favor of this marker
    // class. A bare stand-in is enough for unit tests, which only assert on the key/shape of an
    // update payload, never on Foundry's own deletion behavior.
    operators: {
      ForcedDeletion: class ForcedDeletion {},
    },
  },
  utils: {
    // Only the shape matters to the code under test (a unique opaque string); helpers/
    // action-economy.mjs uses it to tag each spend so it can be refunded later.
    randomID: () => Math.random().toString(36).slice(2, 12),
    getProperty: (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj),
    hasProperty: (obj, path) => {
      let o = obj;
      for (const k of path.split('.')) {
        if (o == null || !(k in o)) return false;
        o = o[k];
      }

      return true;
    },
    deepClone: (obj) => JSON.parse(JSON.stringify(obj)),
  },
};
