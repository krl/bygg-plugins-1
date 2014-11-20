'use strict';

var browserify = require('browserify');
var mix = require('mix');
var mixIn = require('mout/object/mixIn');
var path = require('path');
var convertSourceMap = require('convert-source-map');

module.exports = function (options) {
    var watcher;
    var depCache = {};
    var idCache = {};

    options = options || {};
    var configure = options.configure || function () {};
    delete options.configure;

    return function (tree) {
        if (watcher !== undefined) {
            watcher.close();
        }

        if (tree.nodes.length !== 1) {
            throw new Error('Exactly one file must be specified for browserification');
        }

        var node = tree.nodes[0];
        var entrypoint = path.join(node.base, node.name);
        var signal = mix.signal();
        watcher = mix.watcher();

        delete depCache[entrypoint];

        var bOpts = mixIn({}, options, {
            basedir: node.base,
            cache: depCache,
            debug: true
        });

        var b = browserify(bOpts);

        configure(b);

        var pushBundle = function () {
            var start = new Date();

            b.bundle(function (err, buf) {
                if (err) { mix.logger.error('browserify', err.message); return; }

                resolveCachedDepsIds();

                watcher.watch(Object.keys(depCache).map(function (depId) {
                    return depCache[depId].file;
                }));

                var outputNode = tree.cloneNode(node);
                var outputPrefix = path.dirname(node.name) + '/';
                if (outputPrefix === './') {
                    outputPrefix = '';
                }

                var bundle = buf.toString('utf-8');

                // Bundle
                var outputBundle = convertSourceMap.removeComments(bundle);
                outputNode.name = outputPrefix + path.basename(node.name, path.extname(node.name)) + '.js';
                outputNode.metadata.mime = 'application/javascript';
                outputNode.data = new Buffer(outputBundle, 'utf-8');

                // Source map
                var sourceMap = convertSourceMap.fromSource(bundle).toObject();
                sourceMap.sources = sourceMap.sources.map(function (source) {
                    return (source[0] === '/') ? path.relative(node.base, source) : source;
                });
                mix.tree.sourceMap.set(outputNode, sourceMap, { sourceBase: outputPrefix });

                mix.logger.log('browserify', 'Bundled ' + node.name, new Date() - start);

                signal.push(mix.tree([outputNode]));
            });
        };

        var resolveCachedDepsIds = function (){
            Object.keys(depCache).forEach(function (file) {
                var dep = depCache[file];
                dep.deps = Object.keys(dep.deps).reduce(function (acc, subdep) {
                    acc[subdep] = idCache[dep.deps[subdep]];
                    return acc;
                }, {});
            });
        };

        b.on('dep', function (dep) {
            if (dep.file !== entrypoint) {
                depCache[dep.file] = dep;
                idCache[dep.id] = dep.file;
            }
        });

        watcher.listen(function (paths) {
            paths.forEach(function (path) {
                delete depCache[path];
            });

            pushBundle();
        });

        b.add(entrypoint);

        pushBundle();

        return signal;
    };
};
