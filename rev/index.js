'use strict';

var crypto = require('crypto');
var path = require('path');
var minimatch = require('minimatch');
var mixlib = require('mix/lib');

var PATH_REGEX = /(?:\'|\"|\(|(?:\/\/|\/*)# sourceMappingURL=)([a-z0-9_@\-\/\.]{2,})/ig;

module.exports = function (options) {
    options = options || {};

    var entrypoint = options.entrypoint || 'index.html';
    var pathPrefix = options.pathPrefix ? new RegExp(options.pathPrefix, 'g') : undefined;

    return function (tree) {
        var deps = resolveDependencies(tree.nodes, pathPrefix);
        var stats = {
            processed: 0,
            revved: 0,
            references: 0
        };

        var revMap = deps.reduce(function (acc, dep) {
            var data;
            if (Object.keys(dep.refs).length > 0) {
                stats.processed++;
                var contents = dep.node.data.toString('utf8');
                Object.keys(dep.refs).forEach(function (reference) {
                    stats.references++;
                    var referencedNode = dep.refs[reference];
                    contents = contents.replace(new RegExp(reference, 'g'), replacement(reference, acc[referencedNode.name]));
                });
                data = new Buffer(contents, 'utf8');
            } else {
                data = dep.node.data;
            }

            var name = dep.node.name;
            var revName;
            // Do not rev entrypoints
            if (minimatch(name, entrypoint)) {
                revName = name;
            } else {
                stats.revved++;
                var revision = md5(data).substr(0, 8);
                var extension = path.extname(name);
                revName = joinPath(dirName(name), path.basename(name, extension) + '-' + revision + extension);
            }

            var revNode = dep.siblingOf === null ? mixlib.tree.cloneNode(dep.node) : mixlib.tree.cloneSibling(dep.node, dep.siblingOf);
            revNode.name = revName;
            revNode.data = data;
            acc[name] = revNode;

            return acc;
        }, {});

        var nodes = deps.reduce(function (nodes, dep) {
            var revNode = revMap[dep.node.name];
            if (dep.siblingOf) {
                var toplevel = revMap[dep.siblingOf.name];
                toplevel.siblings = toplevel.siblings.map(function (sibling) {
                    if (sibling === dep.node) {
                        return revNode;
                    } else {
                        return sibling;
                    }
                });
            } else {
                nodes.push(revNode);
            }
            return nodes;
        }, []);

        nodes.reverse();

        mixlib.logger.log('rev', 'Revved ' + stats.revved + ' files referenced ' + stats.references + ' times in ' + stats.processed + ' files');

        return mixlib.signal.constant(mixlib.tree(nodes));
    };
};

function resolveDependencies(nodes, pathPrefix, nodeMap, stack) {
    var deps = [];

    if (typeof nodeMap === 'undefined') {
        nodeMap = nodes.reduce(function (map, node) {
            map[node.name] = {
                node: node,
                siblingOf: null
            };
            node.siblings.forEach(function (sibling) {
                map[sibling.name] = {
                    node: sibling,
                    siblingOf: node
                };
            });
            return map;
        }, {});
    }

    stack = stack || [];

    forEachNode(nodes, function (node) {
        // Process each node only once
        if (stack.indexOf(node) !== -1) { return; }
        stack.push(node);

        var refs = {};
        var siblingOf = nodeMap[node.name].siblingOf;

        if (siblingOf === null && !isBinary(node)) {
            var contents = node.data.toString('utf8');
            if (pathPrefix !== undefined) {
                contents = contents.replace(pathPrefix, '');
            }

            var match;
            PATH_REGEX.lastIndex = 0;
            while ((match = PATH_REGEX.exec(contents))) {
                var reference = match[1];

                var path;
                if (reference.indexOf('/') === 0) {
                    path = reference.substr(1);
                } else {
                    path = joinPath(dirName(node.name), reference);
                }

                if (nodeMap.hasOwnProperty(path)) {
                    var entry = nodeMap[path];
                    refs[reference] = entry.node;
                    var subDeps = resolveDependencies([entry.node], pathPrefix, nodeMap, stack);
                    Array.prototype.push.apply(deps, subDeps);
                }
            }
        }

        deps.push({
            node: node,
            siblingOf: siblingOf,
            refs: refs
        });
    });

    return deps;
}

function replacement(reference, referencedNode) {
    return joinPath(dirName(reference), path.basename(referencedNode.name));
}

function forEachNode(nodes, callback) {
    nodes.forEach(function (node) {
        callback(node, null);
        if (node.siblings !== undefined) {
            node.siblings.forEach(function (sibling) {
                callback(sibling, node);
            });
        }
    });
}

function dirName(directory) {
    return path.dirname(directory).replace(/\\/g, '/');
}

function joinPath(directory, filename) {
    return path.join(directory, filename).replace(/\\/g, '/');
}

function md5(data) {
    return crypto.createHash('md5').update(data).digest('hex');
}

function isBinary(node) {
    var mime = node.metadata.mime;
    if (!mime) {
        return false;
    }

    if (mime.indexOf('text/') === 0) {
        return false;
    }

    if (mime === 'application/javascript' || mime === 'application/json') {
        return false;
    }

    return true;
}
