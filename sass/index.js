'use strict';

var bygglib = require('bygg/lib');
var extend = require('extend');
var fs = require('fs');
var path = require('path');
var sass = require('node-sass');

module.exports = function (options) {
    var watchers = [];

    return function (tree) {
        var processed = 0;
        var output = bygglib.signal();
        var nodes = [];

        var render = function (node, index) {
            var sassFile = path.join(node.base, node.name);
            var start = new Date();

            sass.render(extend({}, options, {
                file: sassFile, // cannot use 'data' because the source map would show 'stdin' as a source
                sourceMap: '_',
                omitSourceMapUrl: true,
                sourceMapContents: true,
            }), function (error, result) {
                if (error) {
                    bygglib.logger.error('sass', error);
                    return;
                }

                var deps = result.stats.includedFiles.filter(function (path) {
                    return path !== sassFile;
                });
                watchers[index].watch(deps);

                var outputNode = bygglib.tree.cloneNode(node);
                var outputPrefix = path.dirname(node.name) + '/';
                if (outputPrefix === './') {
                    outputPrefix = '';
                }
                outputNode.name = outputPrefix + path.basename(node.name, path.extname(node.name)) + '.css';
                outputNode.metadata.mime = 'text/css';
                outputNode.data = new Buffer(result.css, 'utf8');

                var sourceMap = JSON.parse(result.map);
                outputNode = bygglib.tree.sourceMap.set(outputNode, sourceMap, {
                    sourceBase: path.join(node.base, outputPrefix)
                });

                bygglib.logger.log('sass', 'Compiled ' + outputNode.name, new Date() - start);

                if (nodes[index] === undefined) {
                    processed++;
                }
                nodes[index] = outputNode;

                if (processed === tree.nodes.length) {
                    output.push(bygglib.tree(nodes));
                }
            });
        };

        watchers.forEach(function (watcher) {
            watcher.close();
        });

        tree.nodes.forEach(function (node, index) {
            watchers[index] = bygglib.watcher();
            watchers[index].listen(function (paths) {
                render(node, index);
            });

            render(node, index);
        });

        return output;
    };
};
