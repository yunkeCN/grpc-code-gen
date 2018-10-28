import { load } from '@yunke/load-git';
import * as program from 'commander';
import * as fs from "fs";
import * as path from "path";

const packageJson = require('../package.json');
program
  .version(packageJson.version)
  .option(
    '-u, --url [url]',
    'Url of git repository',
    'git@git.myscrm.cn:service-config/global-conf.git',
  )
  .option(
    '-b, --branch [branch]',
    'Branch of proto',
    'master',
  )
  .option(
    '-t, --token [token]',
    'Access token for this repository',
    'b1wZx77sDx1YQPLyLww3',
  )
  .parse(process.argv);

const {
  url,
  branch,
  token,
} = program;

load({
  url,
  branch,
  accessToken: token,
})
  .then((res) => {
    const dir = path.join(process.cwd(), '.grpc-code-gen');

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }

    const target = `${dir}/config.json`;
    fs.copyFileSync(`${res.path}/config.json`, target);
    console.info(`Generate success in ${target}`);
  })
  .catch((err) => {
    console.error(err);
  })
