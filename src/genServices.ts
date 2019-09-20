import * as fs from "fs-extra";
import { get, set } from 'lodash';
import { Root } from 'protobufjs';
import { TEnum, TMessage, TMethod, TService } from "./types";
import {
  fileTip,
  getAbsPath,
  getImportPath,
  getPackageName,
  PROTO_TYPE_2_JSON_SEMANTIC_MAP,
  PROTO_TYPE_2_TS_TYPE_MAP,
  tslintDisable
} from "./utils";

interface TNamespace {
  messages?: { [name: string]: TMessage };
  enums?: { [name: string]: TEnum };
  nested?: { [name: string]: TNamespace };
}

function walkPackagePath(packagePath: string, type: string, map: { [key: string]: any }): string | null {
  if (map[`${packagePath}.${type}`]) {
    return `${packagePath}.${type}`;
  }
  const split = packagePath.split('.');
  if (split.length === 1) {
    return null;
  }
  return walkPackagePath(split.slice(0, split.length - 1).join('.'), type, map);
}

function getTsType(
  protoType: string,
  fullName: string,
  config: {
    root: Root,
    messageMap: { [key: string]: TMessage },
    enumMap: { [key: string]: TEnum },
  },
  isArr?: boolean,
): { tsType: string, semanticType?: string, basic: boolean } {
  const basic = PROTO_TYPE_2_TS_TYPE_MAP[protoType];
  if (basic) {
    return {
      tsType: basic,
      semanticType: PROTO_TYPE_2_JSON_SEMANTIC_MAP[protoType],
      basic: true,
    }
  }

  if (/\./.test(protoType)) {
    return {
      tsType: protoType,
      semanticType: isArr ? `ArraySchemaWithGenerics<${protoType}>` : undefined,
      basic: false,
    };
  }

  const { messageMap, enumMap, root } = config;

  let tsType = walkPackagePath(fullName, protoType, messageMap) ||
    walkPackagePath(fullName, protoType, enumMap);

  if (!tsType) {
    const typeOrEnum = root.lookupTypeOrEnum(protoType);
    if (typeOrEnum) {
      tsType = typeOrEnum.fullName.replace(/^\./, '');
    }
  }

  if (tsType) {
    return {
      tsType: tsType,
      semanticType: isArr ? `ArraySchemaWithGenerics<${tsType}>` : undefined,
      basic: false,
    };
  }
  throw new Error(`${protoType} not exist in message: ${fullName}`);
}

export default async function genServices(opt: {
  grpcNpmName: string;
  configFilePath: string;
  serviceWrapperPath: string;
  typesPath: string;
  grpcClientPath: string;

  services: TService[];
  methods: TMethod[];
  enums: TEnum[];
  messages: TMessage[];
  baseDir: string;
  root: Root;
  grpcObjPath: string;
}): Promise<void> {
  const {
    grpcNpmName,
    grpcObjPath,
    typesPath,
    serviceWrapperPath,
    grpcClientPath,
    services,
    methods,
    baseDir,
    enums,
    messages,
    root,
  } = opt;

  const grpcNative = grpcNpmName === 'grpc';

  const messageMap: { [key: string]: TMessage } = {};
  const enumMap: { [key: string]: TEnum } = {};

  const namespace: TNamespace = {};
  messages.forEach((message) => {
    const packageName = getPackageName(message.fullName);
    const nameSpacePath = 'nested.' + packageName.replace(/\./g, '.nested.');
    const latest = get(namespace, nameSpacePath, { messages: {} });
    latest.messages[message.name] = message;
    set(namespace, nameSpacePath, latest);

    messageMap[message.fullName] = message;
  });
  enums.forEach((enumT) => {
    const packageName = getPackageName(enumT.fullName);
    const nameSpacePath = 'nested.' + packageName.replace(/\./g, '.nested.');
    const latest = get(namespace, nameSpacePath, { enums: {} });
    latest.enums[enumT.name] = enumT;
    set(namespace, nameSpacePath, latest);

    enumMap[enumT.fullName] = enumT;
  });

  const servicesWithMethods: { [fullName: string]: TService & { methods: TMethod[] } } = {};
  services.forEach((service) => {
    servicesWithMethods[service.fullName] = { ...service, methods: [] };
  });
  methods.forEach((method) => {
    const packageName = getPackageName(method.fullName);
    const serviceWithMethod = servicesWithMethods[packageName];
    if (serviceWithMethod) {
      serviceWithMethod.methods.push(method);
    }
  });
  services.map(async (service) => {
    const packageName = getPackageName(service.fullName).replace(/\./g, '/');
    const servicePath = getAbsPath(`${service.fullName.replace(/\./g, '/')}.ts`, baseDir);

    await fs.mkdirp(getAbsPath(packageName, baseDir));

    const serviceWithMethod = servicesWithMethods[service.fullName];
    const config = {
      messageMap,
      enumMap,
      root,
    };
    const methodStrArr = serviceWithMethod.methods
      .sort((a, b) => {
        if (a.name < b.name) {
          return -1;
        }
        if (a.name > b.name) {
          return 1;
        }
        return 0;
      })
      .map((method) => {
        const requestType = 'types.' + getTsType(method.requestType, packageName, config).tsType;
        const responseType = `types.${getTsType(method.responseType, packageName, config).tsType}`;
        return `  /** @deprecated 请使用: ${method.name}V2 */
  ${method.name}(
    request: ${requestType},
    options?: { timeout?: number; flags?: number; host?: string; }
  ): Promise<${responseType}>;
  /** @deprecated 请使用: ${method.name}V2 */
  ${method.name}(
    request: ${requestType},
    metadata: MetadataMap,
    options?: { timeout?: number; flags?: number; host?: string; }
  ): Promise<${responseType}>;
  ${method.comment ? `/** ${method.comment} */` : ''}
  ${method.name}V2(option: {
    request: ${requestType};
    metadata?: MetadataMap;
    options?: { timeout?: number; flags?: number; host?: string; };
  }): Promise<{ response:${responseType}, metadata: Metadata }>;`
      });

    const typeName = 'I' + service.name;
    await fs.writeFile(servicePath, [
      fileTip,
      tslintDisable,
      `import { Metadata } from "${grpcNpmName}";`,
      `import { get } from 'lodash';`,
      `import grpcObject from '${getImportPath(servicePath, grpcObjPath)}';\n`,
      `import { ChannelCredentials } from "${grpcNative ? 'grpc' : `${grpcNpmName}/build/src/channel-credentials`}";`,
      `import * as types from '${getImportPath(servicePath, typesPath)}';\n`,
      `import getGrpcClient from '${getImportPath(servicePath, grpcClientPath)}';\n`,
      `import serviceWrapper, { MetadataMap } from '${getImportPath(servicePath, serviceWrapperPath)}';\n`,
      `export interface ${typeName} {`,
      `  $FILE_NAME: string;`,
      `  new (address: string, credentials: ChannelCredentials, options?: object): ${typeName};\n`,
      ...methodStrArr,
      `  restartServer?: Function;`,
      `  closeServer?: Function;`,
      `}`,
      `const Service: ${typeName} = get<any, string>(grpcObject, '${service.fullName}');`,
      `Service.$FILE_NAME = '${service.filename && service.filename.replace(/\\/g, '/')}';`,
      `export const ${service.name}: ${typeName} = serviceWrapper<${typeName}>(Service);`,
      `export default ${service.name};`,
      `export let base${service.name[0]}${service.name.slice(1)} = getGrpcClientFactory();`,
      `function getGrpcClientFactory() { return getGrpcClient<${typeName}>(${service.name}) };`,
      `export const ${service.name[0].toLowerCase()}${service.name.slice(1)} = <${typeName}>(new Object());`,
      `Object.entries(base${service.name[0]}${service.name.slice(1)}.constructor.prototype)
  .filter(([methodName]) => /^[A-Za-z0-9]+$/g.test(methodName)).forEach(item => {
    (${service.name[0].toLowerCase()}${service.name.slice(1)} as any)[item[0]] = async function (...option: []) {
      try { return await (base${service.name[0]}${service.name.slice(1)} as any)[item[0]](...option) } catch (err) {
        restrtGrpcRules(base${service.name[0]}${service.name.slice(1)}, err); 
        console.info(err);
        throw err;
      }
    }
  });`,
      `Service.prototype.restartServer = base${service.name[0]}${service.name.slice(1)}.restartServer = function () { base${service.name[0]}${service.name.slice(1)} = getGrpcClientFactory()};`,
      `Service.prototype.closeServer = base${service.name[0]}${service.name.slice(1)}.closeServer = function () { (this as any).close(); (base${service.name[0]}${service.name.slice(1)} as any) = null;}`,
      `const cache = {regs: [/failed.+connect/,/deadline.+exceeded/,/cannot.+read.+property/,/tcp.+read.+failed/,/internal.+http2.+error/,/stream.+removed/]}`,
      `function restrtGrpcRules(server: any, err: any){
  const message = (err.details || err.message || err.error || '').toLowerCase();
  if (cache.regs.some(item => item.test(message))) { console.info('*******grpc server restart success.*******');server.closeServer(); server.restartServer() };
}`
    ].join('\n'));
  });
}