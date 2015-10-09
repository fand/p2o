'use strict';

var assert    = require('assert');
var p2o       = require('../src/index');
var promisify = require("promisify-node");
var fs        = promisify('fs');

describe('p2o', function () {
  it('should generate correct XML file', function (done) {
    var src = __dirname + '/yo.json';
    var dst = __dirname + '/result.xml';
    var exp = __dirname + '/yo.xml';

    p2o(src, dst, 'all').then(function () {
      return Promise.all(
        fs.readFile(dst),
        fs.readFile(exp)
      );
    })
    .then(function (files) {
      assert.equal(files[0], files[1]);
    })
    .finally(done);
  })
});
