'use strict';

// Usage : node src/index.js package.json out.xml

var p2o = require('../src/index');

var packageFilePath = process.argv[2];
var outputFilePath  = process.argv[3];

var mode = 'all';

p2o(packageFilePath, outputFilePath, mode);
