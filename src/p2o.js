'use strict';

import promisify from 'promisify-node';
import npm       from 'npm';
import Mustache  from 'mustache';

const fs = promisify('fs');

/**
 * Extract package data from given 'package.json'.
 * @param {string} jsonPath
 * @return {object}
 */
const readPackageJson = (jsonPath) => {
  return fs.readFile(jsonPath, 'utf8')
    .then((file) => {
      const pack = JSON.parse(file);
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
const loadNpm = () => promisify(npm.load)({});

/**
 * Fetch repositories' info from deps list.
 * @param {Array<dep>} deps
 * @return {Promise<Repo>}
 */
const depsToRepos = (deps) => {
  return Promise.all(Object.keys(deps).map((depName) => {
    return promisify(npm.commands.view)([depName, 'repository'], true)
      .then((info) => {
        const latestVersion = Object.keys(info)[0];
        return info[latestVersion].repository;
      });
  }));
};

/**
 * Extract feeds info from repos.
 * @param {Array<Repo>} repos
 * @return {Array<Feed>}
 */
const reposToFeed = (repos) => {
  return repos.filter((repo) => {
    if (repo.type !== 'git') { return false; }
    if (! /github\.com.*\.git$/.test(repo.url)) { return false; }
    return true;
  }).map((repo) => {
    const m       = repo.url.match(/github\.com[\/\:](.*)\/(.*)\.git$/);
    const author  = m[1];
    const title   = m[2];
    const htmlUrl = `https://github.com/${author}/${title}`;
    const xmlUrl  = `${htmlUrl}/releases.atom`;

    return {
      author,
      title,
      htmlUrl,
      xmlUrl,
    };
  });
};

/**
 * Write OPML to given path.
 * @param {object} data
 * @param {string} outputFilePath
 */
const renderOPML = (data, outputFilePath) => {
  return fs.readFile(`${__dirname}/../.template.xml`, 'utf8')
    .then((template) => Mustache.render(template, data))
    .then((outputData) => fs.writeFile(outputFilePath, outputData, 'utf8'));
};

/**
 * Prepare repos array for environment.
 * @param {string} mode
 * @param {Array<Repo>} proRepos
 * @param {Array<Repo>} devRepos
 */
const reposForMode = (mode, proRepos, devRepos) => {
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
const p2o = (packageFilePath, outputFilePath, mode) => {

  var pkg;

  return readPackageJson(packageFilePath)
    .then(res => pkg = res)
    .then(loadNpm)
    .then(() => {
      var proRepos = depsToRepos(pkg.proDeps);
      var devRepos = depsToRepos(pkg.devDeps);

      return Promise.all([proRepos, devRepos]).then((repos) => {
        pkg.proRepos = repos[0];
        pkg.devRepos = repos[1];
      });
    })
    .then(() => {
      var repos = reposForMode(mode, pkg.proRepos, pkg.devRepos);
      pkg.view.feeds = reposToFeed(repos);
    })
    .then(() => renderOPML(pkg.view, outputFilePath))
    .catch(err => { throw err; });

};

export default p2o;
