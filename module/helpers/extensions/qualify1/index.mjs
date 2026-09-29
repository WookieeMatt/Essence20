/**
 * qualify1 - equipment Qualification/Training Perks, shared reroll pools (Best-Laid Plans, One Last
 * Chance), Danger Sense, Ignite, Tenacity, Dome Generator, Nobility, Addicted (Dark Energon) and the
 * effective-Threat-Level readout. Each file registers its own hooks; this one wires them at load.
 */
import { registerQ1Relay } from "./common.mjs";
import { registerQualification } from "./qualification.mjs";
import { registerRerolls } from "./rerolls.mjs";
import { registerIgnite } from "./ignite.mjs";
import { registerMisc } from "./misc.mjs";

registerQualification();
registerRerolls();
registerIgnite();
registerMisc();

if (globalThis.Hooks?.once) {
  Hooks.once('ready', registerQ1Relay);
}
