var gulp = require('gulp');
var gutil = require("gulp-util");
var noprotocol = require('gulp-noprotocol');
// var livereload = require('gulp-livereload');

var webpack = require("webpack");
var WebpackDevServer = require("webpack-dev-server");
var webpackConfig = require("./webpack.config.js");



gulp.task('build-rxwebrtc', function (done) {
      // Create bundle
    return webpack(webpackConfig, function(err, stats) {
        if (err) throw new gutil.PluginError("webpack", err);
        gutil.log("[webpack]", stats.toString());
        done();
    });
});
gulp.task('build-angular-webrtc', function () {
    return gulp
        .src([
            'src/angular-webrtc/module.js',
            'src/angular-webrtc/*.js'
        ])
        .pipe(noprotocol.angular({
            module: 'angular-webrtc',
        }))
        .on('error', noprotocol.notify)
        .pipe(gulp.dest('build/'));
});
gulp.task('build', ['build-rxwebrtc', 'build-angular-webrtc'], function () {
    return gulp.src(['src/bower.json']).pipe(gulp.dest('build/'));
});

gulp.task("continuous-build", ['build'], function() {
    return gulp.watch(['src/**/*'], ['build']);
});

gulp.task('default', ['build']);