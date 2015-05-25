'use strict';

var bygglib = require('bygg/lib');

module.exports = function () {
    return function (tree) {
        var counter = 0;

        var nodes = tree.nodes.map(function (node) {
            var outputNode = bygglib.tree.sourceMap.unset(node);
            if (outputNode !== node) {
                counter++;
            }
            return outputNode;
        });

        if (counter > 0) {
            bygglib.logger.log('strip-maps', 'Removed ' + counter + ' source maps and comments');
        }

        return bygglib.signal.constant(bygglib.tree(nodes));
    };
};
