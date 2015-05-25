'use strict';

var autoprefixer = require('autoprefixer-core');
var bygglib = require('bygg/lib');
var path = require('path');

var DEFAULT_CONSTRAINTS = ['last 2 versions', 'ie 9'];

module.exports = function () {
    var constraints = arguments.length > 0 ? Array.prototype.slice.call(arguments) : DEFAULT_CONSTRAINTS;

    return function (tree) {
        var nodes = tree.nodes.map(function (node) {
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

            var outputNode;
            try {
                outputNode = bygglib.tree.cloneNode(node);
                var result = autoprefixer({ browsers: constraints }).process(input, opts);
                outputNode.data = new Buffer(result.css, 'utf8');

                var sourceMap = JSON.parse(result.map);
                outputNode = bygglib.tree.sourceMap.set(outputNode, sourceMap, { sourceBase: path.dirname(node.name) });

                bygglib.logger.log('autoprefixer', 'Prefixed ' + node.name, new Date() - start);
            } catch (e) {
                bygglib.logger.error('autoprefixer', e.message);
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
