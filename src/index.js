'use strict';

// Usage : node src/index.js package.json out.xml

var promisify = require("promisify-node");
var npm       = require('npm');
var fs        = promisify('fs');
var Mustache  = require('mustache');

var packageFilePath = process.argv[2];
var outputFilePath  = process.argv[3];
var mode = 'all';

var depsToRepos = function (deps) {
  return Promise.all(Object.keys(deps).map(function (depName) {
    return promisify(npm.commands.view)([depName, 'repository'], true)
      .then(function (info) {
        var latestVersion = Object.keys(info)[0];
        return info[latestVersion].repository;
      });
  }));
};

var pack, proDeps, devDeps, opmlTitle, opmlOwner;

fs.readFile(packageFilePath, 'utf8')
  .then(function (file) {
    pack    = JSON.parse(file);
    proDeps = pack.dependencies || {};
    devDeps = pack.devDependencies || {};
    opmlTitle = pack.name + ' : Deps updates';
    opmlOwner = pack.author;
  })
  .then(function () {
    return promisify(npm.load)({});
  })
  .then(function () {
    var proRepos = depsToRepos(proDeps);
    var devRepos = depsToRepos(devDeps);

    return Promise.all([proRepos, devRepos]).then(function (repos) {
      return {
        pro : repos[0],
        dev : repos[1],
      };
    });
  })
  .then(function (repos) {
    // 引数によってrepoを変える
    if (mode === 'all') {
      return repos.pro.concat(repos.dev);
    }
    if (mode === 'pro') {
      return repos.pro;
    }
    if (mode === 'all') {
      return repos.dev;
    }
  })
  .then(function (repos) {
    var feeds = repos.filter(function (repo) {
      if (repo.type !== 'git') { return false; }
      if (! /github\.com.*\.git$/.test(repo.url)) { return false; }
      return true;
    }).map(function (repo) {
      var m = repo.url.match(/github\.com[\/\:](.*)\/(.*)\.git$/);
      var userName = m[1];
      var repoName = m[2];
      var htmlUrl = 'http://github.com/' + userName + '/' + repoName;
      var xmlUrl = htmlUrl + '/releases.atom';
      return {
        title   : repoName,
        htmlUrl : htmlUrl,
        xmlUrl  : xmlUrl,
      };
    });
    return feeds;
  })
  .then(function (feeds) {
    var view = {
      opmlTitle : opmlTitle,
      opmlOwner : opmlOwner,
      feeds     : feeds,
    };

    return fs.readFile(__dirname + '/template.xml', 'utf8')
      .then(function (template) {
        return Mustache.render(template, view);
      })
      .catch(function (err) {
        if (err) { throw err; }
      });
  })
  .then(function (output) {
    return fs.writeFile(outputFilePath, output, 'utf8');
  })
  .catch(function (err) {
    throw err;
  });
