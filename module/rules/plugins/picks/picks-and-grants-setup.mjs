// Rules-engine plug-ins, group E (round 10). Registered on import; see module/rules/plugins/index.mjs.
// Picks, grants, item data, small tags and events: rules/ext/e/*.mjs (docs/rules-batches/slE10.md).
import "./pick-and-loop-steps.mjs";
import "../tags/actor-state-tags.mjs";
import { installTypes } from "../combat/hazard-terrain-targets.mjs";
import { installKitPrerequisite } from "../resources/kit-prerequisite.mjs";
import "../rolls/allies-anywhere-scope.mjs";
import { installEquipmentBroke } from "../combat/equipment-broke.mjs";
import { installDerived } from "../effects/derived-stages.mjs";
import { installLegacy } from "../marks/legacy-marks.mjs";

installTypes();
installKitPrerequisite();
installEquipmentBroke();
installDerived();
installLegacy();
