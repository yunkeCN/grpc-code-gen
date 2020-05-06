import * as fs from 'fs-extra';
import { IOption, loadProto } from 'load-proto';
import { Options as LoaderOptions } from 'load-proto/build/loader';
import { get, set } from 'lodash';
import * as path from 'path';
import genGetGrpcClient from "./genGetGrpcClient";
import genGrpcObj from "./genGrpcObj";
import genServices from "./genServices";
import genServiceWrapper from "./genServiceWrapper";
import genTsType from "./genTsType";
import { inspectNamespace } from "./pbjs";
import { TNamespace } from "./types";
import { getAbsPath, getPackageName } from "./utils";

const BASE_DIR = path.join(process.cwd(), 'code-gen');

export interface Options extends IOption {
  baseDir?: string;
  target?: 'javascript' | 'typescript';
  configFilePath?: string;
  grpcNpmName?: string;
  loaderOptions?: LoaderOptions;
}

interface GitUrlsItem {
  url: string,
  branch?: string,
  [propname: string]: any;
}

export async function gen(opt: Options): Promise<string> {
  const {
    baseDir = BASE_DIR,
    target = 'typescript',
    configFilePath,
    gitUrls,
    branch,
    accessToken,
    resolvePath,
    grpcNpmName = 'grpc',
    loaderOptions,
  } = opt;

  fs.removeSync(baseDir);
  console.info(`Clean dir: ${baseDir}`);

  fs.mkdirpSync(baseDir);

  if (gitUrls.length <= 1) {
    throw new Error('gitUrls must be more than two parameters');
  }

  const firstUrl = gitUrls.splice(0, 1)
  let allResult: Array<{ result: any, root: any, [propname: string]: any }> = []
  let alljson: { [propname: string]: any } = {}

  await Promise.all(gitUrls.map(async (url: GitUrlsItem | string) => {
    const newUrl: string = typeof url === 'string' ? url : url.url
    const root = await loadProto({
      gitUrls: [...firstUrl, url],
      branch,
      accessToken,
      resolvePath,
    });
    root.resolveAll();
    const json: any = root.toJSON({ keepComments: true });

    let space:string = '' 
    let service:string = ''

    if (newUrl.indexOf('https://') > -1){
      [service, space] = newUrl.replace('-proto.git', '').split('/').reverse()
    } else {
      [space, service] = (newUrl.match(/:.+-proto/) as any)[0].replace(/:|-proto/g, '').split('/')
    }

    allResult.push({
      result: inspectNamespace(root),
      root,
      space,
      service
    })
    alljson[`${space}_${service.replace(/-/g, '_')}`] = json
  }))


  fs.mkdirpSync(path.join(process.cwd(), '.grpc-code-gen'));

  const jsonPath = path.join(process.cwd(), '.grpc-code-gen', 'root.json');
  await fs.writeJSON(jsonPath, alljson);

  if (!allResult.length) {
    throw new Error('None code gen');
  }


  const grpcObjPath = getAbsPath(`grpcObj.ts`, baseDir);
  await fs.writeFile(
    grpcObjPath,
    genGrpcObj({
      grpcNpmName,
      configFilePath: configFilePath as string,
      grpcObjPath,
      jsonPath,
    }),
  );

  const grpcClientPath = getAbsPath(`getGrpcClient.ts`, baseDir);
  await fs.writeFile(
    grpcClientPath,
    genGetGrpcClient(grpcNpmName, grpcClientPath),
  );


  const serviceWrapperPath = getAbsPath(`serviceWrapper.ts`, baseDir);
  await fs.writeFile(
    serviceWrapperPath,
    genServiceWrapper({
      configFilePath: configFilePath as string,
      grpcNpmName,
      serviceWrapperPath,
    }),
  );


  allResult.map(async (item: { result: any, root: any, [propname: string]: any }, index: number) => {

    const { result, root, space, service } = item
    const { services, methods, messages, enums } = result;

    const namespace: TNamespace = {};
    messages.forEach((message: any) => {
      const packageName = getPackageName(message.fullName);
      const nameSpacePath = 'nested.' + packageName.replace(/\./g, '.nested.');
      const latest = get(namespace, nameSpacePath, { messages: {} });
      if (!latest.messages) latest.messages = {}
      latest.messages[message.name] = message;
      set(namespace, nameSpacePath, latest);
    });
    enums.forEach((enumT: any) => {
      const packageName = getPackageName(enumT.fullName);
      const nameSpacePath = 'nested.' + packageName.replace(/\./g, '.nested.');
      const latest = get(namespace, nameSpacePath, { enums: {} });
      if (!latest.enums) latest.enums = {}
      latest.enums[enumT.name] = enumT;
      set(namespace, nameSpacePath, latest);
    });

    const typesPath = getAbsPath('types.ts', space && service ? `${baseDir}/${space}/${service}` : baseDir);
    space && service && await fs.mkdirp(`${baseDir}/${space}/${service}`);
    await fs.writeFile(
      typesPath,
      genTsType({ namespace, root, messages, enums, loaderOptions }),
    );

    await genServices({
      grpcClientPath,
      serviceWrapperPath,
      messages,
      methods,
      grpcNpmName,
      configFilePath: configFilePath as string,
      grpcObjPath,
      baseDir,
      enums,
      root,
      services,
      typesPath,
      loaderOptions,
      space,
      service
    });

  })




  console.info(`Generate success in ${baseDir}`);

  return baseDir;
}
