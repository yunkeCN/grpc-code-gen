# grpc-code-gen

## CLI usage
```bash
grpc-code-gen gen -u git@git.myscrm.cn:2c/panther-statistics-proto.git,git@git.myscrm.cn:2c/panther-third-proto.git -b test -t ${token} -d test/code-gen-cli
```

### Set params by config file
```js
//grpc-code-gen.config.js
module.exports = {
  gitUrls: [
    'git@git.myscrm.cn:2c/panther-statistics-proto.git',
    'git@git.myscrm.cn:2c/panther-third-proto.git',
  ],
  branch: 'test',
  accessToken: '${token}',
  baseDir: `${__dirname}/code-gen`,
};
```

then

```bash
grpc-code-gen gen
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


## Params

参数 | 类型 | 意义
---|---|---
gitUrls | string[] | 仓库地址数组
branch |  string | 分支
accessToken | string | git access token
baseDir? | string | 生成目录
target? | `javascript typescript` | 目标语言 
