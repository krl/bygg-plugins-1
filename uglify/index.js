'use strict';

var bygglib = require('bygg/lib');
var extend = require('extend');
var fs = require('fs');
var path = require('path');
var UglifyJS = require('uglify-js');

module.exports = function (options) {
    options = extend({
        screw_ie8: true,
        warnings: false,
        compress: {},
        mangle: {},
        output: {},
        sourceRoot: null
    }, options || {});

    if (options.screw_ie8) {
        options.compress.screw_ie8 = true;
        options.mangle.screw_ie8 = true;
        options.output.screw_ie8 = true;
    }

    return function (tree) {
        var nodes = tree.nodes.map(function (node) {
            var start = new Date();
            var source = node.data.toString('utf8');

            var ast = UglifyJS.parse(source, {
                filename: node.name,
                toplevel: null
            });

            var scopeOptions = { screw_ie8: options.screw_ie8 };

            if (options.compress) {
                ast.figure_out_scope(scopeOptions);
                var compressOptions = extend({ warnings: options.warnings }, options.compress);
                ast = ast.transform(UglifyJS.Compressor(compressOptions));
            }

            if (options.mangle) {
                ast.figure_out_scope(scopeOptions);
                ast.compute_char_frequency();
                ast.mangle_names(options.mangle);
            }

            var prevSourceMap = bygglib.tree.sourceMap.get(node);
            var sourceMap = UglifyJS.SourceMap({
                orig: prevSourceMap !== undefined ? prevSourceMap : false,
                root: options.sourceRoot
            });
            var outputOptions = extend({}, options.output, {
                source_map: sourceMap
            });

            var outputSource = ast.print_to_string(outputOptions);
            var outputNode = bygglib.tree.cloneNode(node);
            outputNode.data = new Buffer(outputSource, 'utf8');

            var sourceMapData = JSON.parse(sourceMap.toString());
            outputNode = bygglib.tree.sourceMap.set(outputNode, sourceMapData, {
                annotate: true,
                sourceBase: prevSourceMap === undefined ? path.dirname(node.name) : undefined
            });

            bygglib.logger.log('uglify', 'Minified ' + node.name, new Date() - start);

            return outputNode;
        });

        return bygglib.signal.constant(bygglib.tree(nodes));
    };
};
