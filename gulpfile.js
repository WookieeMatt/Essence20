const { src, dest, watch, series} = require('gulp')
const sass = require('gulp-sass')(require('sass'))

/* ----------------------------------------- */
/*  Compile Sass
/* ----------------------------------------- */

// Compiler
function buildStyles() {
  return src('style.scss')
  .pipe(sass())
  .pipe(dest('css'))
}

function watchTask() {
  watch(['style.scss'], buildStyles)
}

exports.default = series(buildStyles, watchTask)