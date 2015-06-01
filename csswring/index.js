'use strict';

var csswring = require('csswring');
var postcss = require('../postcss');

module.exports = function (options) {
    return postcss([csswring(options)], 'csswring');
};
