'use strict';

var bygglib = require('bygg/lib');

module.exports = function (from, to) {
    return function (tree) {
        var nodes = tree.nodes.map(function (node) {
            var outputNode = bygglib.tree.cloneNode(node);

            outputNode.name = node.name.replace(from, to);

            outputNode.siblings = node.siblings.map(function (sibling) {
                var outputSibling = bygglib.tree.cloneSibling(sibling, outputNode);
                outputSibling.name = sibling.name.replace(from, to);
                return outputSibling;
            });

            var sourceMap = bygglib.tree.sourceMap.get(outputNode);
            if (sourceMap !== undefined) {
                outputNode = bygglib.tree.sourceMap.set(outputNode, sourceMap, { annotate: true });
            }

            bygglib.logger.log('rename', 'Renamed ' + node.name + ' to ' + outputNode.name);

            return outputNode;
        });

        return bygglib.signal.constant(bygglib.tree(nodes));
    };
};
