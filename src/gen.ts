import * as program from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as base from "./base";
import { Options } from "./base";

const configFile = path.join(process.cwd(), 'grpc-code-gen.config.js');

const packageJson = require('../package.json');
program
  .version(packageJson.version)
  .option('-b, --branch [branch]', 'Branch of proto')
  .option('-t, --token [token]', 'Access token for this repository')
  .option('-d, --dir [dir]', 'Base dir of the code gen')
  .option('-t, --target [target]', 'Target file type, ex: javascript, typescript', 'typescript')
  .option('-c, --config [config]', 'Config file path', configFile)
  .option('-u, --url <items>', 'Urls of git repository, split by \',\'', function list(val) {
    return val.split(',');
  })
  .parse(process.argv);

const {
  url,
  branch,
  token,
  dir,
  config,
} = program;

const opt: any = {};

let configFilePath = undefined;
if (fs.existsSync(config)) {
  if (path.isAbsolute(config)) {
    configFilePath = config;
    Object.assign(opt, require(config));
  } else {
    configFilePath = path.join(process.cwd(), config);
    Object.assign(opt, require(configFile));
  }
}

if (!configFilePath) {
  console.error('Must set config file: grpc-code-gen.config.js');
  process.exit(1);
}

opt.configFilePath = configFilePath;

if (url) {
  opt.gitUrls = url;
}
if (branch) {
  opt.branch = branch;
}
if (token) {
  opt.accessToken = token;
}
if (dir) {
  opt.baseDir = dir;
}

base.gen(opt as Options)
  .catch((err) => {
    console.error(err);
  })
