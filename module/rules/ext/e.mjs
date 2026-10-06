// Rules-engine plug-ins, group E (round 10). Registered on import; see module/rules/ext/index.mjs.
// Picks, grants, item data, small tags and events: rules/ext/e/*.mjs (docs/rules-batches/slE10.md).
import "./e/steps.mjs";
import "./e/tags.mjs";
import { installTypes } from "./e/types.mjs";
import { installDerived } from "./e/derived.mjs";
import { installLegacy } from "./e/legacy.mjs";

installTypes();
installDerived();
installLegacy();
