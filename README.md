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
---|---|---|---
gitUrls | Array<string \| {url: string, branch?: string, accessToken?: string}> | 仓库地址数组 | `null`
branch |  string | 分支，如参数没有，会去读取环境变量参数`branch` | `null`
accessToken | string | git access token | `null`
baseDir? | string | 生成目录 | `null`
target? | `javascript typescript` | 目标语言 | `null`
grpcNpmName? | string | grpc npm name, 可取值：`grpc`, `@grpc/grpc-js` | `grpc`
jsonSemanticTypes? | boolean | 生成json semantic types | `false`  
loaderOptions? | [LoaderOptions](https://github.com/grpc/grpc-node/tree/master/packages/proto-loader) | loader生成配置 | `{ defaults: true }`
callOptions? | [callOptions](#callOptions) | 方法调用配置 | null
logOptions? | [logOptions](#logOptions) | 日志配置 | null
filterError? | (err: Error) => Error | 错误过滤 | (err) => err

#### callOptions

参数 | 类型 | 说明 | 默认值
---|---|---|---
timeout? | number | 超时时间，单位：ms | undefined

#### logOptions

参数 | 类型 | 说明 | 默认值
---|---|---|---
disable? | boolean | 是否启用 | false
attributes? | string[] | 记录字段，`request, response` | ['request'] 

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
 

### 版本说明

- v6.0.4 版本
新增 grpc-service.dev.config.js 本地配置，去掉繁琐的本地host配置

- v6.0.3 版本
解决编译go proto枚举报错问题

- v6.0.0 版本
解决grpc-code-gen编译时，后端相同package下有相同service的冲突问题

- v5.4.4 版本
解决javascript精度文档，js在超过16位的number数字会有精度丢失问题，因此统一把（'double', 'float', 'int64', 'uint64', 'sint64', 'fixed64', 'sfixed64'）类型转换为string类型

- v5.3.0 版本
bff  grpc 新增热重启功能

