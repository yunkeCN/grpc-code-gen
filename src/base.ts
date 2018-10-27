import { loadProto } from '@yunke/load-proto';
import * as fs from 'fs-extra';
import { get, set } from 'lodash';
import * as path from 'path';
import { inspectNamespace } from "./pbjs";
import { TEnum, TMessage, TMethod, TService } from "./types";

const BASE_DIR = path.join(process.cwd(), 'code-gen');

function getPackageName(fullName: string): string {
  let split = fullName.split('.');
  return split.slice(0, split.length - 1).join('.');
}

function getAbsPath(relativePath: string, baseDir: string = BASE_DIR): string {
  return path.join(baseDir, relativePath);
}

interface TNamespace {
  messages?: { [name: string]: TMessage };
  enums?: { [name: string]: TEnum };
  nested?: { [name: string]: TNamespace };
}

function genSpace(num: number) {
  let space = '';
  for (let i = 0; i < num; i++) {
    space += ' ';
  }
  return space;
}

const TYPE_MAP: { [key: string]: string } = {
  'double': 'number',
  'float': 'number',
  'int32': 'number',
  'int64': 'number',
  'uint32': 'number',
  'uint64': 'number',
  'sint32': 'number',
  'sint64': 'number',
  'fixed32': 'number',
  'fixed64': 'number',
  'sfixed32': 'number',
  'sfixed64': 'number',
  'bool': 'boolean',
  'string': 'string',
  'bytes': 'string',
};

function walkPackagePath(packagePath: string, map: { [key: string]: any }): string | null {
  if (map[packagePath]) {
    return packagePath;
  }
  const split = packagePath.split('.');
  if (split.length === 1) {
    return null;
  }
  return walkPackagePath(split.slice(0, split.length - 1).join('.'), map);
}

function getTsType(protoType: string, fullName: string, config: {
  messageMap: { [key: string]: TMessage },
  enumMap: { [key: string]: TEnum },
}): { tsType: string, basic: boolean } {
  const basic = TYPE_MAP[protoType];
  if (basic) {
    return {
      tsType: basic,
      basic: true,
    }
  }

  if (/\./.test(protoType)) {
    return {
      tsType: protoType,
      basic: false,
    };
  }

  const { messageMap, enumMap } = config;

  const packagePath = `${fullName}.${protoType}`;

  const tsType = walkPackagePath(packagePath, messageMap) ||
    walkPackagePath(packagePath, enumMap);

  if (tsType) {
    return {
      tsType: tsType,
      basic: false,
    };
  }
  throw new Error(`${protoType} not exist in message: ${fullName}`);
}

function genTsType(namespace: TNamespace, config: {
  messageMap: { [key: string]: TMessage },
  enumMap: { [key: string]: TEnum },
}, deep: number = 0): string {
  let str = '';
  const { messages, enums, nested } = namespace;
  const space = genSpace(deep * 2);
  if (messages) {
    str += Object.keys(messages)
      .map((name) => {
        const message = messages[name];
        const fieldDefine = message.fields
          .map((field) => {
            const { tsType } = getTsType(field.type, message.fullName, config);

            return `${space}  '${field.name}'${field.repeated ? '' : '?'}: `
              + `${tsType}${field.repeated ? '[]' : ''};`;
          });
        return [
          `${space}export interface ${name} {`,
          ...fieldDefine,
          `${space}}`,
        ].join('\n') + '\n';
      })
      .join('\n\n') + '\n\n';
  }
  if (enums) {
    str += Object.keys(enums)
      .map((name) => {
        const enumT = enums[name];
        const fieldDefine = Object.keys(enumT.values)
          .map((key) => {
            return `${space}  ${key} = ${enumT.values[key]},`;
          });
        return [
          `${space}export enum ${name} {`,
          ...fieldDefine,
          `${space}}`,
        ].join('\n') + '\n';
      })
      .join('\n\n') + '\n\n';
  }
  if (nested) {
    const nextDeep = deep + 1;
    Object.keys(nested)
      .map((name) => {
        str += `${space}export namespace ${name} {\n`;
        str += genTsType(nested[name], config, nextDeep);
        str += `${space}}\n`;
      });
  }
  return str;
}

function getImportPath(fromPath: string, toPath: string) {
  let relative = path.relative(path.dirname(fromPath), toPath);
  relative = relative.replace(/\.(js|d\.ts|ts)$/, '');
  if (!/^\./.test(relative)) {
    relative = `./${relative}`;
  }
  return relative;
}

export type Options = {
  gitUrls: string[];
  branch: string;
  accessToken: string;
  baseDir?: string;
};

export async function gen(opt: Options): Promise<string> {
  const { baseDir = BASE_DIR } = opt;

  fs.mkdirpSync(baseDir);

  const { gitUrls, branch, accessToken } = opt;
  const root = await loadProto(gitUrls, branch, accessToken);
  root.resolveAll();

  const json = root.toJSON({ keepComments: true });

  const jsonPath = getAbsPath('root.json', baseDir);
  await fs.writeJSON(jsonPath, json);

  const grpcObjPath = getAbsPath('grpcObj.js', baseDir);
  await fs.writeFile(grpcObjPath, [
    `const grpc = require('grpc');`,
    `const { loadFromJson } = require('@yunke/load-proto');`,
    `const root = require('${getImportPath(grpcObjPath, jsonPath)}');\n`,
    `const grpcObject = grpc.loadPackageDefinition(loadFromJson(root));`,
    `module.exports = grpcObject;`,
  ].join('\n'));

  const result = inspectNamespace(root);

  if (!result) {
    throw new Error('None code gen');
  }

  const { services, methods, messages, enums } = result;

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

  const typesPath = getAbsPath('types.ts', baseDir);
  await fs.writeFile(typesPath, genTsType(namespace, { messageMap, enumMap }));

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
    const servicePath = getAbsPath(`${service.fullName.replace(/\./g, '/')}.js`, baseDir);
    const serviceDTsPath = getAbsPath(`${service.fullName.replace(/\./g, '/')}.d.ts`, baseDir);

    await fs.mkdirp(getAbsPath(packageName, baseDir));
    await fs.writeFile(servicePath, [
      `const { get } = require('lodash')`,
      `const grpcObject = require('${getImportPath(servicePath, grpcObjPath)}');\n`,
      `const ${service.name} = get(grpcObject, '${service.fullName}');`,
      `module.exports.${service.name} = ${service.name};\n`,
      `module.exports.default = ${service.name};\n`,
    ].join('\n'));
    // d.ts
    const serviceWithMethod = servicesWithMethods[service.fullName];
    const config = {
      messageMap,
      enumMap,
    };
    const methodStrArr = serviceWithMethod.methods.map((method) => {
      const requestType = 'types.' + getTsType(method.requestType, packageName, config).tsType;
      const responseType = 'types.' + getTsType(method.responseType, packageName, config).tsType;
      return `  ${method.name}(request: ${requestType}, callback: (error: Error, response: ${responseType}) => void): void;`
    });
    await fs.writeFile(serviceDTsPath, [
      `import { ChannelCredentials } from "grpc";`,
      `import * as types from '${getImportPath(serviceDTsPath, typesPath)}';\n`,
      `export declare class ${service.name} {`,
      `  constructor(address: string, credentials: ChannelCredentials, options?: object)`,
      ...methodStrArr,
      `}`,
      `export default ${service.name};\n`,
    ].join('\n'));
  });
  return baseDir;
}
