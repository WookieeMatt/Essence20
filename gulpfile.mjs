import {compilePack, extractPack} from "@foundryvtt/foundryvtt-cli";

// const gulp = require('gulp');
// const prefix = require('gulp-autoprefixer');
// const sourcemaps = require('gulp-sourcemaps');
// const sass = require('gulp-sass')(require('sass'));

/* ----------------------------------------- */
/*  Compile Sass
/* ----------------------------------------- */

// // Small error handler helper function.
// function handleError(err) {
//   console.log(err.toString());
//   this.emit('end');
// }

// const SYSTEM_SCSS = ["sass/*.scss"];
// function compileScss() {
//   // Configure options for sass output. For example, 'expanded' or 'nested'
//   let options = {
//     outputStyle: 'expanded'
//   };
//   return gulp.src(SYSTEM_SCSS)
//     .pipe(
//       sass(options)
//         .on('error', handleError)
//     )
//     .pipe(prefix({
//       cascade: false
//     }))
//     .pipe(gulp.dest("./css"))
// }
// const css = gulp.series(compileScss);

// /* ----------------------------------------- */
// /*  Watch Updates
// /* ----------------------------------------- */

// function watchUpdates() {
//   gulp.watch(SYSTEM_SCSS, css);
// }

// /* ----------------------------------------- */
// /*  Export Tasks
// /* ----------------------------------------- */

// exports.default = gulp.series(
//   compileScss,
//   watchUpdates
// );
// exports.build = gulp.series(
//   compileScss
// );
// exports.css = css;

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
		await compilePack(PACK_SOURCE + packInfo.name, packInfo.path);
		// await extractPack(packInfo.path, PACK_SOURCE + packInfo.name);
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
		await extractPack(packInfo.path, PACK_SOURCE + packInfo.name);
	}
}
export const extract = gulp.series(extractPacks);
