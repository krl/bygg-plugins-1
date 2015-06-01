'use strict';

var postcss = require('postcss');
var bygglib = require('bygg/lib');
var path = require('path');

module.exports = function (plugins, name) {
    return function (tree) {
        var output = bygglib.signal([]);
        var nodes = [];
        var processed = 0;

        tree.nodes.forEach(function (node, index) {
            var start = new Date();
            var input = node.data.toString('utf8');

            var prevSourceMap = bygglib.tree.sourceMap.get(node);
            var opts = {
                from: node.name,
                map: {
                    prev: prevSourceMap !== undefined ? prevSourceMap : false,
                    sourcesContent: true,
                    annotation: false
                }
            };

            postcss(plugins)
                .process(input, opts)
                .then(function (result) {
                    var outputNode = bygglib.tree.cloneNode(node);
                    outputNode.data = new Buffer(result.css, 'utf8');

                    var sourceMap = JSON.parse(result.map);
                    outputNode = bygglib.tree.sourceMap.set(outputNode, sourceMap, {
                        sourceBase: path.dirname(node.name)
                    });

                    nodes[index] = outputNode;
                    processed++;

                    if (processed === tree.nodes.length) {
                        bygglib.logger.log(name || 'postcss', 'Processed ' + tree.nodes.length + ' stylesheets');
                        output.push(bygglib.tree(nodes));
                    }
                })
                .catch(function (error) {
                    bygglib.logger.error(name || 'postcss', error.message);
                });
        });

        return output;
    };
};
