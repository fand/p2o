'use strict';

import assert    from 'assert';
import p2o       from '../src/p2o';
import promisify from 'promisify-node';

const fs = promisify('fs');

describe('p2o', () => {
  it('should generate correct XML file', (done) => {
    const src = `${__dirname}/yo.json`;
    const dst = `${__dirname}/result.xml`;
    const exp = `${__dirname}/yo.xml`;

    p2o(src, dst, 'all').then(() =>
      Promise.all(
        fs.readFile(dst),
        fs.readFile(exp)
      )
    )
    .then((files) => {
      assert.equal(files[0], files[1]);
    })
    .finally(done);
  })
});
