# grpc-code-gen

Code generator for grpc, for typescript and javascript.

## CLI usage

```bash
grpc-code-gen gen -u git@git.myscrm.cn:2c/panther-statistics-proto.git,git@git.myscrm.cn:2c/panther-third-proto.git -b test -t ${token} -d test/code-gen-cli
```

### Set params by config file

```js
//grpc-code-gen.config.js
module.exports = {
  gitUrls: [
    {
      url: 'git@git.myscrm.cn:ykcommon/ykproto.git',
      branch: 'master',
    },
    'git@git.myscrm.cn:2c/panther-statistics-proto.git',
    'git@git.myscrm.cn:2c/panther-third-proto.git',
  ],
  branch: 'test',
  accessToken: '${token}',
  baseDir: `${__dirname}/code-gen`,
  resolvePath: (origin, target, rootDir) => {
    if (/^git\.myscrm\.cn\/golang\/common\/proto\/(google|common)\//.test(target)) {
      return `${rootDir}/git.myscrm.cn/ykcommon/ykproto/${target.replace(/^git\.myscrm\.cn\/golang\/common\/proto\//, '')}`;
    } else if (/^proto\/(common|google)\//.test(target)) {
      return `${rootDir}/git.myscrm.cn/ykcommon/ykproto/${target.replace(/^proto\//, '')}`;
    } else if (/^proto\//.test(target)) {
      return target.replace(/^proto\/([^\/]+)(.+)/, (_target, $1, $2) => {
        return `${rootDir}/git.myscrm.cn/2c/${$1.replace(/_/g, '-')}${$2}`;
      });
    } else if (/^(common|google\/api)\//.test(target)) {
      return `${rootDir}/git.myscrm.cn/ykcommon/ykproto/${target}`;
    }
    return null;
  },
};
```

then

```bash
grpc-code-gen gen
```

### Params

参数 | 类型 | 说明 | 默认值
---|---|---
gitUrls | string[] | 仓库地址数组
branch |  string | 分支
accessToken | string | git access token
baseDir? | string | 生成目录 | 
target? | `javascript typescript` | 目标语言
jsonSemanticTypes? | boolean | 生成json semantic types | `false`  
serviceCode? | boolean | 生成客户端代码 | `true` 


## Program usage
```js
const base = require('grpc-code-gen/build/base');

base.gen({
  gitUrls: [
    {
      url: 'git@git.myscrm.cn:ykcommon/ykproto.git',
      branch: 'master',
    },
    'git@git.myscrm.cn:2c/panther-statistics-proto.git',
    'git@git.myscrm.cn:2c/panther-third-proto.git',
  ],
  branch: 'test',
  accessToken: process.env.token,
  baseDir: `${__dirname}/code-gen`,
  resolvePath: (origin, target, rootDir) => {
    if (/^git\.myscrm\.cn\/golang\/common\/proto\/(google|common)\//.test(target)) {
      return `${rootDir}/git.myscrm.cn/ykcommon/ykproto/${target.replace(/^git\.myscrm\.cn\/golang\/common\/proto\//, '')}`;
    } else if (/^proto\/(common|google)\//.test(target)) {
      return `${rootDir}/git.myscrm.cn/ykcommon/ykproto/${target.replace(/^proto\//, '')}`;
    } else if (/^proto\//.test(target)) {
      return target.replace(/^proto\/([^\/]+)(.+)/, (_target, $1, $2) => {
        return `${rootDir}/git.myscrm.cn/2c/${$1.replace(/_/g, '-')}${$2}`;
      });
    } else if (/^(common|google\/api)\//.test(target)) {
      return `${rootDir}/git.myscrm.cn/ykcommon/ykproto/${target}`;
    }
    return null;
  },
})
  .catch((err)=>{
    console.error(err.stack)
  });
```
 
