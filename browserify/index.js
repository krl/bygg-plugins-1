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

    var cache = {};

    return function (tree) {
        if (tree.nodes.length !== 1) {
            throw new Error('Exactly one file must be specified for browserification');
        }

        var node = tree.nodes[0];
        var entrypoint = path.join(node.base, node.name);
        var output = bygglib.signal();
        var watched = [];
        var watcher = bygglib.watcher();

        var bOpts = extend({}, options, {
            basedir: node.base,
            cache: cache,
            debug: true,
            fullPaths: true
        });

        var b = browserify(bOpts);

        configure(b);

        var pushBundle = function () {
            var start = new Date();

            watched = [];

            b.bundle(function (err, buf) {
                if (err) { bygglib.logger.error('browserify', err.message); return; }

                watcher.watch(watched);

                var outputNode = bygglib.tree.cloneNode(node);
                var outputName = options.dest || node.name;
                var outputPrefix = path.dirname(outputName) + '/';
                if (outputPrefix === './') {
                    outputPrefix = '';
                }

                var bundle = buf.toString('utf-8');

                // Bundle
                var outputBundle = convertSourceMap.removeComments(bundle);
                outputNode.name = outputPrefix + path.basename(outputName, path.extname(outputName)) + '.js';
                outputNode.metadata.mime = 'application/javascript';
                outputNode.data = new Buffer(outputBundle, 'utf-8');

                // Source map
                var sourceMap = convertSourceMap.fromSource(bundle).toObject();
                sourceMap.sources = sourceMap.sources.map(function (source) {
                    return (source[0] === '/') ? path.relative(node.base, source) : source;
                });
                outputNode = bygglib.tree.sourceMap.set(outputNode, sourceMap, { sourceBase: outputPrefix });

                bygglib.logger.log('browserify', 'Bundled ' + outputName, new Date() - start);

                output.push(bygglib.tree([outputNode]));
            });
        };

        b.on('dep', function (dep) {
            if (typeof dep.id === 'string') {
                cache[dep.id] = dep;
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
            if (watched.indexOf(path) === -1 && path !== entrypoint) {
                watched.push(path);
            }
        };

        watcher.listen(function (paths) {
            paths.forEach(function (path) {
                delete cache[path];
            });
            pushBundle();
        });

        b.add(entrypoint);

        pushBundle();

        return output;
    };
};
