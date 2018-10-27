import * as spawn from 'cross-spawn';

const result = spawn.sync(
  'node',
  `bin/index.js gen -b test -c ./test/grpc-code-gen.config.js`.split(' '),
  { stdio: 'inherit' }
);
process.exit(result.status);
