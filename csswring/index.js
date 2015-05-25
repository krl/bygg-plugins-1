'use strict';

var bygglib = require('bygg/lib');
var csswring = require('csswring');
var path = require('path');

module.exports = function (options) {
    return function (tree) {
        var output = bygglib.signal();

        var nodes = tree.nodes.map(function (node) {
            var start = new Date();
            var input = node.data.toString('utf8');

            var prevSourceMap = bygglib.tree.sourceMap.get(node);
            var opts = {
                from: node.name,
                map: {
                    prev: prevSourceMap !== undefined ? prevSourceMap : false,
                    sourcesContent: true,
                    annotation: bygglib.tree.sourceMap.name(node)
                }
            };

            var outputNode;
            try {
                outputNode = bygglib.tree.cloneNode(node);
                var result = csswring(options).wring(input, opts);
                outputNode.data = new Buffer(result.css, 'utf8');

                var sourceMap = JSON.parse(result.map);
                outputNode = bygglib.tree.sourceMap.set(outputNode, sourceMap, { sourceBase: path.dirname(node.name) });

                bygglib.logger.log('csswring', 'Minified ' + node.name, new Date() - start);
                return outputNode;
            } catch (e) {
                bygglib.logger.error('csswring', e.message);
                outputNode = undefined;
            }
            return outputNode;
        })
        .filter(function (node) {
            return node !== undefined;
        });

        return bygglib.signal.constant(nodes.length > 0 ? bygglib.tree(nodes) : undefined);
    };
};
