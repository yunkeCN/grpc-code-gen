import * as base from '../src/base';

base.gen({
  gitUrls: [
    'git@git.myscrm.cn:2c/panther-statistics-proto.git',
    'git@git.myscrm.cn:2c/panther-third-proto.git',
  ],
  branch: 'test',
  accessToken: 'b1wZx77sDx1YQPLyLww3',
  baseDir: `${__dirname}/code-gen`,
  // target: 'javascript',
})
  .catch((err) => {
    console.error(err.stack)
  });
