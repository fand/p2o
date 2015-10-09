#!/usr/bin/env node

var p2o = require('../lib/p2o');

var packageFilePath = process.argv[2];
var outputFilePath  = process.argv[3];

var mode = 'all';

if (! (packageFilePath && outputFilePath)) {
  console.log('Usage:');
  console.log('    $ p2o <package.json> <outputFile>');
  process.exit();
}

p2o(packageFilePath, outputFilePath, mode);
