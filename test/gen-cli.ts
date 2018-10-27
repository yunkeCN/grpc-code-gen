import * as spawn from 'cross-spawn';

const result = spawn.sync(
  'node',
  `bin/index.js gen -u git@git.myscrm.cn:2c/panther-statistics-proto.git,git@git.myscrm.cn:2c/panther-third-proto.git -b test -t b1wZx77sDx1YQPLyLww3 --dir test/code-gen-cli`.split(' '),
  { stdio: 'inherit' }
);
process.exit(result.status);
