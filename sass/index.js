'use strict';

var extend = require('extend');
var path = require('path');
var sass = require('node-sass');
var fs = require('fs');
var mixlib = require('mix/lib');

module.exports = function (options) {
    return function (tree) {
        if (tree.nodes.length !== 1) {
            throw new Error('Exactly one scss file must be specified');
        }

        var node = tree.nodes[0];
        var output = mixlib.signal();
        var watcher = mixlib.watcher();
        var deps = [];

        var pushCss = function () {
            var sassFile = path.join(node.base, node.name);
            var start = new Date();

            sass.render(extend({}, options, {
                file: sassFile,
                sourceMap: '_.map',
                omitSourceMapUrl: true,
                sourceMapContents: true,
                success: function (result) {
                    deps = result.stats.includedFiles.filter(function (path) {
                        return path !== sassFile;
                    });
                    watcher.watch(deps);

                    var outputNode = mixlib.tree.cloneNode(node);
                    var outputPrefix = path.dirname(node.name) + '/';
                    if (outputPrefix === './') {
                        outputPrefix = '';
                    }
                    outputNode.name = outputPrefix + path.basename(node.name, path.extname(node.name)) + '.css';
                    outputNode.metadata.mime = 'text/css';
                    outputNode.data = new Buffer(result.css, 'utf8');

                    var sourceMap = JSON.parse(result.map);
                    outputNode = mixlib.tree.sourceMap.set(outputNode, sourceMap, { sourceBase: path.join(node.base, outputPrefix) });

                    mixlib.logger.log('sass', 'Compiled ' + outputNode.name, new Date() - start);

                    output.push(mixlib.tree([outputNode]));
                },
                error: function (error) {
                    mixlib.logger.error('sass', error);
                }
            }));
        };

        watcher.listen(function (paths) {
            pushCss();
        });

        pushCss();

        return output;
    };
};
