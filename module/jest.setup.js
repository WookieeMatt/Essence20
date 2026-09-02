import { jest } from '@jest/globals';
import { E20 } from './helpers/config.mjs';

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
  getRollData() {
    return foundry.utils.deepClone(this.system ?? {});
  }
};

global.Item = class Item {
  constructor() {}
  prepareData() {}
  prepareDerivedData() {}
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

global.fromUuid = jest.fn();
global.fromUuidSync = jest.fn();

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
    },
  },
  data: {
    fields: new Proxy({}, {
      get: () => StubDataField,
    }),
  },
  utils: {
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
