'use strict';

var mixlib = require('mix/lib');

module.exports = function (from, to) {
    return function (tree) {
        var nodes = tree.nodes.map(function (node) {
            var outputNode = mixlib.tree.cloneNode(node);

            outputNode.name = node.name.replace(from, to);

            outputNode.siblings = node.siblings.map(function (sibling) {
                var outputSibling = mixlib.tree.cloneSibling(sibling, outputNode);
                outputSibling.name = sibling.name.replace(from, to);
                return outputSibling;
            });

            var sourceMap = mixlib.tree.sourceMap.get(outputNode);
            if (sourceMap !== undefined) {
                outputNode = mixlib.tree.sourceMap.set(outputNode, sourceMap, { annotate: true });
            }

            mixlib.logger.log('rename', 'Renamed ' + node.name + ' to ' + outputNode.name);

            return outputNode;
        });

        return mixlib.signal.constant(mixlib.tree(nodes));
    };
};
