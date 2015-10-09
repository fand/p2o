'use strict';

var promisify = require("promisify-node");
var npm       = require('npm');
var fs        = promisify('fs');
var Mustache  = require('mustache');

/**
 * Extract package data from given 'package.json'.
 * @param {string} jsonPath
 * @return {object}
 */
var readPackageJson = function (jsonPath) {
  return fs.readFile(jsonPath, 'utf8')
    .then(function (file) {
      var pack = JSON.parse(file);
      return {
        package  : pack,
        proDeps  : pack.dependencies || {},
        devDeps  : pack.devDependencies || {},
        proRepos : null,
        devRepos : null,

        view : {
          opmlTitle : pack.name + ' : Deps updates',
          opmlOwner : pack.author,
          feeds     : null,
        }
      };
    });
};

/**
 * Init npm engine.
 * @return {Promise}
 */
var loadNpm = function () {
  return promisify(npm.load)({});
};

/**
 * Fetch repositories' info from deps list.
 * @param {Array<dep>} deps
 * @return {Promise<Repo>}
 */
var depsToRepos = function (deps) {
  return Promise.all(Object.keys(deps).map(function (depName) {
    return promisify(npm.commands.view)([depName, 'repository'], true)
      .then(function (info) {
        var latestVersion = Object.keys(info)[0];
        return info[latestVersion].repository;
      });
  }));
};

/**
 * Extract feeds info from repos.
 * @param {Array<Repo>} repos
 * @return {Array<Feed>}
 */
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

/**
 * Write OPML to given path.
 * @param {object} data
 * @param {string} outputFilePath
 */
var renderOPML = function (data, outputFilePath) {
  return fs.readFile(__dirname + '/template.xml', 'utf8')
    .then(function (template) {
      return Mustache.render(template, data);
    })
    .then(function (outputData) {
      return fs.writeFile(outputFilePath, outputData, 'utf8');
    });
};

/**
 * Prepare repos array for environment.
 * @param {string} mode
 * @param {Array<Repo>} proRepos
 * @param {Array<Repo>} devRepos
 */
var reposForMode = function (mode, proRepos, devRepos) {
  if (mode === 'all') {
    return proRepos.concat(devRepos);
  }
  if (mode === 'pro') {
    return proRepos;
  }
  if (mode === 'all') {
    return devRepos;
  }
};

/**
 * Main function
 * @param {string} packageFilePath
 * @param {string} outputFilePath
 * @param {string} mode
 * @return {Promise}
 */
module.exports = function (packageFilePath, outputFilePath, mode) {

  var pkg;

  return readPackageJson(packageFilePath)
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
      var repos = reposForMode(mode, pkg.proRepos, pkg.devRepos);
      pkg.view.feeds = reposToFeed(repos);
    })
    .then(function () {
      return renderOPML(pkg.view, outputFilePath);
    })
    .catch(function (err) {
      throw err;
    });

};
