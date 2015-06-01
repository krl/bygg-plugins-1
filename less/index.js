'use strict';

var bygglib = require('bygg/lib');
var extend = require('extend');
var fs = require('fs');
var path = require('path');
var less = require('less');

module.exports = function (options) {
    return function (tree) {
        if (tree.nodes.length !== 1) {
            throw new Error('Exactly one less file must be specified');
        }

        var node = tree.nodes[0];
        var output = bygglib.signal();
        var watcher = bygglib.watcher();
        var deps = [];

        var pushCss = function () {
            var lessFile = path.join(node.base, node.name);
            var start = new Date();
            var lessData = fs.readFileSync(lessFile, 'utf-8');

            less.render(lessData, options, function (err, result) {
                if (err) {
                    return bygglib.logger.error('less', error);
                }

                deps = result.imports.filter(function (path) {
                    return path !== lessFile;
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

                // var sourceMap = JSON.parse(result.map);
                // outputNode = bygglib.tree.sourceMap.set(outputNode, sourceMap, { sourceBase: path.join(node.base, outputPrefix) });

                bygglib.logger.log('less', 'Compiled ' + outputNode.name, new Date() - start);

                output.push(bygglib.tree([outputNode]));
            })
        }

        watcher.listen(function (paths) {
            pushCss();
        });

        pushCss();

        return output;
    };
};
