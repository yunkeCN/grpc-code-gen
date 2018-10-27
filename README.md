# grpc-code-gen

## CLI usage
```bash
grpc-code-gen gen -u git@git.myscrm.cn:2c/panther-statistics-proto.git,git@git.myscrm.cn:2c/panther-third-proto.git -b test -t ${token} -d test/code-gen-cli
```

## program usage
```js
const base = require('@yunke/grpc-code-gen/build/base');

base.gen({
  gitUrls: [
    'git@git.myscrm.cn:2c/panther-statistics-proto.git',
    'git@git.myscrm.cn:2c/panther-third-proto.git',
  ],
  branch: 'test',
  accessToken: '${token}',
  baseDir: `${__dirname}/code-gen`
})
  .catch((err)=>{
    console.error(err.stack)
  });
```