const core = require('@actions/core');
const github = require('@actions/github');
const fs = require('fs');
const axios = require('axios').default;
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const process = require('process');
const axiosRetry = require('axios-retry');

axiosRetry(
  axios,
  {
    retries: 3,
    retryDelay: axiosRetry.exponentialDelay,
  },
);

async function run() {
  try {
    var api = 'https://api.github.com';
    var owner = core.getInput('owner');
    var repo = core.getInput('repo');
    var tag = core.getInput('tag');
    var file = core.getInput('file');
    var path = core.getInput('path');
    var token = core.getInput('token');

    // Get release
    let url;
    if (tag == 'latest') {
      url = `${api}/repos/${owner}/${repo}/releases/latest`;
    } else {
      url = `${api}/repos/${owner}/${repo}/releases/tags/${tag}`;
    }

    let headers = {
      Accept: 'application/json',
    };
    if (token != '') {
      headers.Authorization = 'token ' + token;
    }

    let resp = await axios({
      method: 'get',
      url: url,
      headers: headers,
    });
    let js = resp.data;

    // Construct regex
    let re;
    if (file[0] == '/' && file[file.length - 1] == '/') {
      re = new RegExp(file.substr(1, file.length - 2));
    } else {
      re = new RegExp('^' + file + '$');
    }

    // Get assets
    let assets = [];
    for (let a of js.assets) {
      if (re.test(a.name)) {
        assets.push(a);
      }
    }

    // Create output directory
    if (path == '') {
      path = '.';
    } else if (path == '/') {
      // skip
    } else if (path == '.') {
      // skip
    } else if (path == './') {
      // skip
    } else {
      if (process.platform == 'win32') {
        /*
         * Reference
         * https://stackoverflow.com/questions/47357135/powershell-equivalent-of-linux-mkdir-p
         */
        await exec(`mkdir ${path} -force -ea 0`, { shell: 'powershell.exe' });
      } else {
        await exec(`mkdir -p ${path}`);
      }
    }

    // Download assets
    headers = {
      Accept: 'application/octet-stream',
    };
    if (token != '') {
      headers.Authorization = 'token ' + token;
    }
    await Promise.all(assets.map(a =>
      axios({
        method: 'get',
        url: a.url,
        headers: headers,
        responseType: 'stream',
      }).then(resp => {
        resp.data.pipe(fs.createWriteStream(`${path}/${a.name}`));
      })
    ));
  } catch (error) {
    core.setFailed(error.message);
  }
}

module.exports = run;
