'use strict';

var csswring = require('csswring');
var path = require('path');
var mixlib = require('mix/lib');

module.exports = function (options) {
    return function (tree) {
        var output = mixlib.signal();

        var nodes = tree.nodes.map(function (node) {
            var start = new Date();
            var input = node.data.toString('utf8');

            var prevSourceMap = mixlib.tree.sourceMap.get(node);
            var opts = {
                from: node.name,
                map: {
                    prev: prevSourceMap !== undefined ? prevSourceMap : false,
                    sourcesContent: true,
                    annotation: mixlib.tree.sourceMap.name(node)
                }
            };

            var outputNode;
            try {
                var outputNode = tree.cloneNode(node);
                var result = csswring(options).wring(input, opts);
                outputNode.data = new Buffer(result.css, 'utf8');

                var sourceMap = JSON.parse(result.map);
                mixlib.tree.sourceMap.set(outputNode, sourceMap, { sourceBase: path.dirname(node.name) });

                mixlib.logger.log('csswring', 'Minified ' + node.name, new Date() - start);
                return outputNode;
            } catch (e) {
                mixlib.logger.error('csswring', e.message);
                outputNode = undefined;
            }
            return outputNode;
        })
        .filter(function (node) {
            return node !== undefined;
        });

        return mixlib.signal.constant(nodes.length > 0 ? mixlib.tree(nodes) : undefined);
    };
};
