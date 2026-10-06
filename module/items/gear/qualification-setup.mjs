/**
 * qualify1 - equipment Qualification/Training Perks, Addicted (Dark Energon) and the
 * effective-Threat-Level readout. (Best-Laid Plans, One Last Chance and Danger Sense's Initiative rerolls are
 * rules on their items - rules/conv10-slD10.test.js.) Each file registers its own hooks; this one wires them at load.
 */
import { registerQ1Relay } from "../shared/qualification-gm-relay.mjs";
import { registerQualification } from "./equipment-qualification.mjs";
import { registerNuPogodiSeatSwap } from "../vehicles/nu-pogodi-seat-swap.mjs";
import { registerDarkEnergonAddiction } from "../resources/addicted-dark-energon.mjs";
import { registerThreatLevelReadout } from "../../mechanics/combat/effective-threat-level.mjs";

registerNuPogodiSeatSwap();
registerQualification();
registerDarkEnergonAddiction();
registerThreatLevelReadout();

if (globalThis.Hooks?.once) {
  Hooks.once('ready', registerQ1Relay);
}
