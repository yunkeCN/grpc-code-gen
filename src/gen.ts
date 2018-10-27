import * as program from 'commander';
import * as base from './base';

const packageJson = require('../package.json');
program
  .version(packageJson.version)
  .option('-b, --branch [branch]', 'Branch of proto')
  .option('-t, --token [token]', 'Access token for this repository')
  .option('-d, --dir [dir]', 'Base dir of the code gen')
  .option('-u, --url <items>', 'Urls of git repository, split by \',\'', function list(val) {
    return val.split(',');
  })
  .parse(process.argv);

const {
  url,
  branch,
  token,
  dir,
} = program;

base.gen({
  gitUrls: url,
  branch: branch,
  accessToken: token,
  baseDir: dir,
})
  .then((dir: string) => {
    console.info(`Generate success in ${dir}`);
  })
  .catch((err) => {
    console.error(err);
  })
