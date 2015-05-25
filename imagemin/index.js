'use strict';

var bygglib = require('bygg/lib');
var Imagemin = require('imagemin');

module.exports = function (options) {
    options = options || {};

    return function (tree) {
        var output = bygglib.signal();
        var nodes = [];
        var processed = 0;

        tree.nodes.forEach(function (node, index) {
            new Imagemin()
                .use(Imagemin.gifsicle({ interlaced: options.interlaced }))
                .use(Imagemin.jpegtran({ progressive: options.progressive }))
                .use(Imagemin.optipng({ optimizationLevel: options.optimizationLevel }))
                .use(Imagemin.svgo({ plugins: options.svgoPlugins || [] }))
                .src(node.data)
                .run(function(err, result) {
                    if (err) {
                        processed++;
                        bygglib.logger.error('imagemin', err);
                        return;
                    }

                    var outputNode = bygglib.tree.cloneNode(node);
                    outputNode.data = result[0].contents;
                    nodes.push(outputNode);
                    processed++;

                    if (processed === tree.nodes.length) {
                        bygglib.logger.log('imagemin', 'Minified ' + tree.nodes.length + ' images');
                        output.push(bygglib.tree(nodes));
                    }
                });
        });

        return output;
    };
};
