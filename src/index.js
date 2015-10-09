'use strict';

var promisify = require("promisify-node");
var npm       = require('npm');
var fs        = promisify('fs');
var Mustache  = require('mustache');

var readPackageJson = function (jsonPath) {
  return fs.readFile(jsonPath, 'utf8')
    .then(function (file) {
      var pack = JSON.parse(file);
      return {
        package   : pack,
        proDeps   : pack.dependencies || {},
        devDeps   : pack.devDependencies || {},
        proRepos  : null,
        devRepos  : null,
        opmlTitle : pack.name + ' : Deps updates',
        opmlOwner : pack.author,
      };
    });
};

var loadNpm = function () {
  return promisify(npm.load)({});
};

var depsToRepos = function (deps) {
  return Promise.all(Object.keys(deps).map(function (depName) {
    return promisify(npm.commands.view)([depName, 'repository'], true)
      .then(function (info) {
        var latestVersion = Object.keys(info)[0];
        return info[latestVersion].repository;
      });
  }));
};

var reposToFeed = function (repos) {
  return repos.filter(function (repo) {
    if (repo.type !== 'git') { return false; }
    if (! /github\.com.*\.git$/.test(repo.url)) { return false; }
    return true;
  }).map(function (repo) {
    var m = repo.url.match(/github\.com[\/\:](.*)\/(.*)\.git$/);
    var userName = m[1];
    var repoName = m[2];
    var htmlUrl = 'https://github.com/' + userName + '/' + repoName;
    var xmlUrl = htmlUrl + '/releases.atom';

    return {
      title   : repoName,
      htmlUrl : htmlUrl,
      xmlUrl  : xmlUrl,
    };
  });
};

var renderOPML = function (data, outputFilePath) {
  return fs.readFile(__dirname + '/template.xml', 'utf8')
    .then(function (template) {
      return Mustache.render(template, data);
    })
    .then(function (outputData) {
      return fs.writeFile(outputFilePath, outputData, 'utf8');
    });
};

var writeOPML = function (path, data) {
  return fs.writeFile(path, data, 'utf8');
};

/**
 * @param {string} packageFilePath
 * @param {string} outputFilePath
 * @param {string} mode
 * @return {Promise}
 */
module.exports = function (packageFilePath, outputFilePath, mode) {

  var pkg;

  readPackageJson(packageFilePath)
    .then(function (res) {
      pkg = res;
    })
    .then(loadNpm)
    .then(function () {
      var proRepos = depsToRepos(pkg.proDeps);
      var devRepos = depsToRepos(pkg.devDeps);

      return Promise.all([proRepos, devRepos]).then(function (repos) {
        pkg.proRepos = repos[0];
        pkg.devRepos = repos[1];
      });
    })
    .then(function () {
      // 引数によってrepoを変える
      if (mode === 'all') {
        pkg.repos = pkg.proRepos.concat(pkg.devRepos);
      }
      if (mode === 'pro') {
        pkg.repos = pkg.proRepos;
      }
      if (mode === 'all') {
        pkg.repos = pkg.devRepos;
      }

      pkg.feeds = reposToFeed(pkg.repos);
    })
    .then(function () {
      return renderOPML(pkg, outputFilePath);
    })
    .catch(function (err) {
      throw err;
    });

};
