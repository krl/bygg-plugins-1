'use strict';

var bygglib = require('bygg/lib');
var extend = require('extend');
var fs = require('fs');
var path = require('path');
var sass = require('node-sass');

module.exports = function (options) {
    return function (tree) {
        if (tree.nodes.length !== 1) {
            throw new Error('Exactly one scss file must be specified');
        }

        var node = tree.nodes[0];
        var output = bygglib.signal();
        var watcher = bygglib.watcher();
        var deps = [];

        var pushCss = function () {
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

                deps = result.stats.includedFiles.filter(function (path) {
                    return path !== sassFile;
                });
                watcher.watch(deps);

                var outputNode = bygglib.tree.cloneNode(node);
                var outputPrefix = path.dirname(node.name) + '/';
                if (outputPrefix === './') {
                    outputPrefix = '';
                }
                outputNode.name = outputPrefix + path.basename(node.name, path.extname(node.name)) + '.css';
                outputNode.metadata.mime = 'text/css';
                outputNode.data = new Buffer(result.css, 'utf8');

                var sourceMap = JSON.parse(result.map);
                outputNode = bygglib.tree.sourceMap.set(outputNode, sourceMap, { sourceBase: path.join(node.base, outputPrefix) });

                bygglib.logger.log('sass', 'Compiled ' + outputNode.name, new Date() - start);

                output.push(bygglib.tree([outputNode]));
            });
        };

        watcher.listen(function (paths) {
            pushCss();
        });

        pushCss();

        return output;
    };
};
