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

  const root = await loadProto({
    gitUrls,
    branch,
    accessToken,
    resolvePath,
  });
  root.resolveAll();

  const json = root.toJSON({ keepComments: true });

  fs.mkdirpSync(path.join(process.cwd(), '.grpc-code-gen'));

  const jsonPath = path.join(process.cwd(), '.grpc-code-gen', 'root.json');
  await fs.writeJSON(jsonPath, json);

  const result = inspectNamespace(root);

  if (!result) {
    throw new Error('None code gen');
  }

  const { services, methods, messages, enums } = result;

  const namespace: TNamespace = {};
  messages.forEach((message) => {
    const packageName = getPackageName(message.fullName);
    const nameSpacePath = 'nested.' + packageName.replace(/\./g, '.nested.');
    const latest = get(namespace, nameSpacePath, { messages: {} });
    latest.messages[message.name] = message;
    set(namespace, nameSpacePath, latest);
  });
  enums.forEach((enumT) => {
    const packageName = getPackageName(enumT.fullName);
    const nameSpacePath = 'nested.' + packageName.replace(/\./g, '.nested.');
    const latest = get(namespace, nameSpacePath, { enums: {} });
    latest.enums[enumT.name] = enumT;
    set(namespace, nameSpacePath, latest);
  });

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

  const typesPath = getAbsPath('types.ts', baseDir);
  await fs.writeFile(
    typesPath,
    genTsType({ namespace, root, messages, enums, loaderOptions }),
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
  });

  console.info(`Generate success in ${baseDir}`);

  return baseDir;
}
