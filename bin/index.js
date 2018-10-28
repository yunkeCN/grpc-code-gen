#!/usr/bin/env node
const path = require('path');
const spawn = require('cross-spawn');

const script = process.argv[2];
const args = process.argv.slice(3);

switch (script) {
  case 'gen':
  case 'load-config':
  case 'load-pem': {
    const result = spawn.sync(
      'node',
      [require.resolve(path.join('../build', script))].concat(args),
      { stdio: 'inherit' }
    );
    process.exit(result.status);
    break;
  }
  default:
    console.log(`Unknown script "${script}".`);
    break;
}