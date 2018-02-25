var fs = require('mz/fs');
var path = require('path');
var debug = require('debug').debug('bilibili:i:downloader');
var check = require('debug').debug('bilibili:d:downloader');
var subprocess = require('child_process');
var _ = require('lodash');

var guessFileExtension = function (url) {
  return /https?:\/\/(?:[^/]+\/)+[^.]+(?:\.[^.]+\.)*\.?(.*)(?=\?)/.exec(url)[1];
}

var downloadFiles = function* (taskInfo, { dryRun, print = _.noop, outputDir, downloadOptions = [] }) {

  var segmentFiles = [];

  for (var i = 0, N = taskInfo.durl.length; i++ != N; segmentFiles[i-1] = yield (function* ({ order, url, size, backup_url }) {

    print(`downloading video segment ${i}/${N}...`);

    var fileName = `av${taskInfo.aid}-${i}.${guessFileExtension(url)}`
      , filePath = path.resolve(outputDir, fileName);

    try {
      var stat = yield fs.stat(filePath);
      if (stat.size === size && !(yield fs.exists(`${filePath}.aria2`))) {
        debug(`file ${filePath} already downloaded.`);
        return filePath;
      } else {
        debug(`file ${filePath} is incomplete.`)
      }
    } catch (e) {
      debug(`file ${filePath} not exists.`);
    }

    var aria2cOptions = [
      '--no-conf',
      '--console-log-level=error',
      '--file-allocation=none',
      '--summary-interval=0',
      '--continue',
      `--dir="${outputDir}"`,
      `--out="${fileName}"`,
      `--referer="${taskInfo.url}"`,
      ...downloadOptions
    ]
      , downloadCommand = `aria2c ${aria2cOptions.join(' ')} "${url}"`;

    debug(`executing download command:\n${downloadCommand}`);

    if (dryRun) {
      return filePath;
    }

    var { status } = subprocess.spawnSync('sh', ['-c', downloadCommand], {
      stdio: 'inherit'
    });

    if (status) {
      throw new Error(`download command failed with code ${status}.`);
    }

    return filePath;
  })(taskInfo.durl[i-1]))

  debug(`download video segments: success.`);
  check(segmentFiles);

  return segmentFiles;
};

module.exports = { downloadFiles };