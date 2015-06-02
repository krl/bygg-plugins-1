'use strict';

var bygglib = require('bygg/lib');
var browserify = require('browserify');
var fs = require('fs');
var extend = require('extend');
var path = require('path');
var convertSourceMap = require('convert-source-map');

module.exports = function (options) {
    options = options || {};
    var configure = options.configure || function () {};
    delete options.configure;

    var bundles = [];

    return function (tree) {
        var output = bygglib.signal();
        var processed = 0;

        var render = function (bundle) {
            bundle.watched = [];
            var start = new Date();
            var entrypoint = path.join(bundle.inputNode.base, bundle.inputNode.name);

            var b = browserify(extend({}, options, {
                basedir: bundle.inputNode.base,
                cache: bundle.cache,
                debug: true,
                fullPaths: true
            }));

            configure(b);

            b.add(entrypoint);

            b.bundle(function (err, buf) {
                if (err) { bygglib.logger.error('browserify', err.message); return; }

                bundle.watcher.watch(bundle.watched);

                // Result
                var outputNode = bygglib.tree.cloneNode(bundle.inputNode);
                var outputPrefix = path.dirname(bundle.inputNode.name) + '/';
                outputPrefix = (outputPrefix === './') ? '' : outputPrefix;
                outputNode.name = outputPrefix + path.basename(bundle.inputNode.name, path.extname(bundle.inputNode.name)) + '.js';
                outputNode.metadata.mime = 'application/javascript';

                var data = buf.toString('utf-8');
                var outputBundle = convertSourceMap.removeComments(data);
                outputNode.data = new Buffer(outputBundle, 'utf-8');

                // Source map
                var sourceMap = convertSourceMap.fromSource(data).toObject();
                sourceMap.sources = sourceMap.sources.map(function (source) {
                    return (source[0] === '/') ? path.relative(bundle.inputNode.base, source) : source;
                });
                outputNode = bygglib.tree.sourceMap.set(outputNode, sourceMap, { sourceBase: outputPrefix });

                bygglib.logger.log('browserify', 'Bundled ' + outputNode.name, new Date() - start);

                // Push upstream if required
                if (bundle.outputNode === undefined) {
                    processed++;
                }
                bundle.outputNode = outputNode;
                if (processed === tree.nodes.length) {
                    output.push(bygglib.tree(bundles.map(function (bundle) {
                        return bundle.outputNode;
                    })));
                }
            });

            b.on('dep', function (dep) {
                if (typeof dep.id === 'string') {
                    bundle.cache[dep.id] = dep;
                }
                if (typeof dep.file === 'string') {
                    watch(dep.file);
                }
            });

            b.on('file', function (file) {
                watch(file);
            });

            b.on('package', function (pkg) {
                watch(path.join(pkg.__dirname, 'package.json'));
            });

            var watch = function (path) {
                if (bundle.watched.indexOf(path) === -1 && path !== entrypoint) {
                    bundle.watched.push(path);
                }
            };
        };

        bundles.forEach(function (bundle) {
            bundle.watcher.close();
        });

        tree.nodes.forEach(function (node, index) {
            var bundle = bundles[index] = {
                inputNode: node,
                outputNode: undefined,
                watcher: bygglib.watcher(),
                cache: bundles[index] !== undefined ? bundles[index].cache : {},
                watched: []
            };

            bundle.watcher.listen(function (paths) {
                paths.forEach(function (path) {
                    delete bundle.cache[path];
                });
                render(bundle);
            });

            render(bundle);
        });

        return output;
    };
};
