import {compilePack, extractPack} from "@foundryvtt/foundryvtt-cli";
import fs from "fs";
import gulp from "gulp";
import logger from "fancy-log";

/**
 * Folder where source JSON files should be located relative to the system folder.
 * @type {string}
 */
const PACK_SOURCE = "/_source/";

/**
 * Compile the source JSON files into compendium packs.
 * - `gulp compile` - Compile all JSON files into their LevelDB files.
 */
async function compilePacks() {
	// Load system.json.
	const system = JSON.parse(fs.readFileSync("./system.json", {encoding: "utf8"}));

	// Determine which source packs to process.
	const packs = system.packs;

	for(const packInfo of packs) {
		logger.info(`Compiling pack ${packInfo.name}`);
		await compilePack(packInfo.path + PACK_SOURCE, packInfo.path);
	}
}
export const compile = gulp.series(compilePacks);

/**
 * Extract the contents of compendium packs to JSON files.
 * - `gulp extract` - Extract all compendium NEDB files into JSON files.
 */
async function extractPacks() {
	// Load system.json.
	const system = JSON.parse(fs.readFileSync("./system.json", {encoding: "utf8"}));

	// Determine which source packs to process.
	const packs = system.packs;

	for(const packInfo of packs) {
		logger.info(`Extracting pack ${packInfo.name}`);
		await extractPack(packInfo.path, packInfo.path + PACK_SOURCE);
	}
}
export const extract = gulp.series(extractPacks);
