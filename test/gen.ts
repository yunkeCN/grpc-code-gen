import * as base from '../src/base';

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
  serviceCode: true,
  jsonSemanticTypes: true,
  resolvePath: (origin: string, target: string, rootDir: string) => {
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
  configFilePath: '',
  // target: 'javascript',
})
  .catch((err) => {
    console.error(err.stack)
  });
