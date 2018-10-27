import * as program from 'commander';
import * as fs from 'fs';
import { assign } from 'lodash';
import * as path from 'path';
import * as base from "./base";
import { Options } from "./base";

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

const opt = {};

const configFile = path.join(process.cwd(), 'grpc-code-gen.config.js');
if (fs.existsSync(configFile)) {
  Object.assign(opt, require(configFile));
}

assign(opt, {
  gitUrls: url,
  branch: branch,
  accessToken: token,
  baseDir: dir,
});

base.gen(opt as Options)
  .then((dir: string) => {
    console.info(`Generate success in ${dir}`);
  })
  .catch((err) => {
    console.error(err);
  })
