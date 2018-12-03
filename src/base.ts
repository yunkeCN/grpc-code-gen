import * as fs from 'fs-extra';
import { IOption, loadProto } from 'load-proto';
import { get, set } from 'lodash';
import * as path from 'path';
import { Root } from 'protobufjs';
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

const fileTip = `// This file is auto generated by grpc-code-gen, do not edit!`;

const PROTO_TYPE_2_TS_TYPE_MAP: { [key: string]: string } = {
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

const PROTO_TYPE_2_JSON_SEMANTIC_MAP: { [key: string]: string } = {
  'double': 'NumberSchema',
  'float': 'NumberSchema',
  'int32': 'NumberSchema',
  'int64': 'NumberSchema',
  'uint32': 'NumberSchema',
  'uint64': 'NumberSchema',
  'sint32': 'NumberSchema',
  'sint64': 'NumberSchema',
  'fixed32': 'NumberSchema',
  'fixed64': 'NumberSchema',
  'sfixed32': 'NumberSchema',
  'sfixed64': 'NumberSchema',
  'bool': 'BooleanSchema',
  'string': 'StringSchema',
  'bytes': 'StringSchema',
};

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

function genTsType(
  namespace: TNamespace,
  config: {
    root: Root,
    messageMap: { [key: string]: TMessage },
    enumMap: { [key: string]: TEnum },
    withJsonSemantic?: boolean,
  },
  deep: number = 0,
): string {
  let str = '';
  const { messages, enums, nested } = namespace;
  const space = genSpace(deep * 2);
  if (messages) {
    str += Object
      .keys(messages)
      .sort((a, b) => {
        if (a < b) {
          return -1;
        }
        if (a > b) {
          return 1;
        }
        return 0;
      })
      .map((name) => {
        const message = messages[name];
        const fieldDefine = message.fields
          .map((field) => {
            const isArr = field.repeated;
            const { tsType, semanticType } = getTsType(field.type, message.fullName, config, isArr);

            let res = `${space}  '${field.name}'${field.required ? '' : '?'}: `;

            if (isArr) {
              if (config.withJsonSemantic && semanticType) {
                res += `Array<${tsType} | ${semanticType}>;`;
              } else {
                res += `${tsType}${isArr ? '[]' : ''};`
              }
            } else {
              if (config.withJsonSemantic && semanticType) {
                res += `${tsType} | ${semanticType};`;
              } else {
                res += `${tsType};`;
              }
            }
            return res;
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
      .sort((a, b) => {
        if (a < b) {
          return -1;
        }
        if (a > b) {
          return 1;
        }
        return 0;
      })
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
    Object
      .keys(nested)
      .sort((a, b) => {
        if (a < b) {
          return -1;
        }
        if (a > b) {
          return 1;
        }
        return 0;
      })
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
  relative = relative
    .replace(/\.(js|d\.ts|ts)$/, '')
    .replace(/\\/g, '/');
  if (!/^\./.test(relative)) {
    relative = `./${relative}`;
  }
  return relative;
}

export interface Options extends IOption {
  baseDir?: string;
  target?: 'javascript' | 'typescript';
  jsonSemanticTypes?: boolean;
  serviceCode?: boolean;
  configFilePath: string;
  grpcNative?: boolean;
}

export async function gen(opt: Options): Promise<string> {
  const {
    baseDir = BASE_DIR,
    target = 'typescript',
    serviceCode = true,
    jsonSemanticTypes = false,
    configFilePath,
    gitUrls,
    branch,
    accessToken,
    resolvePath,
    grpcNative,
  } = opt;

  const typescript = target === 'typescript';
  const grpcNpmName = grpcNative ? 'grpc' : '@grpc/grpc-js';

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

  const moduleSuffix = typescript ? 'ts' : 'js';

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

  if (jsonSemanticTypes) {
    const jsonSemanticTypesPath = getAbsPath('jsonSemanticTypes.ts', baseDir);
    await fs.writeFile(
      jsonSemanticTypesPath,
      fileTip + '\n'
      + 'import { ArraySchemaWithGenerics, BooleanSchema, NumberSchema, StringSchema } from \'json-semantic\';\n\n'
      + genTsType(namespace, { root, messageMap, enumMap, withJsonSemantic: true })
      + `
export interface ICase<Request, Response> {
    id: string;
    name: string;
    desc?: string;
    request: Request;
    response?: Response;
    error?: {
        code: number,
        details: string,
        metadata: {
            internalRepr: {}
        }
    }
}
      `,
    );
  }

  if (serviceCode) {
    const grpcObjPath = getAbsPath(`grpcObj.${moduleSuffix}`, baseDir);
    if (typescript) {
      await fs.writeFile(grpcObjPath, [
        fileTip,
        `import * as grpc from '${grpcNpmName}';`,
        `import * as fs from 'fs';`,
        `import { forOwn } from 'lodash';`,
        `import { loadFromJson } from 'load-proto';\n`,
        `const root = require('${getImportPath(grpcObjPath, jsonPath)}');\n`,
        `let config;`,
`if (fs.existsSync(require.resolve('${getImportPath(grpcObjPath, configFilePath)}'))) {
  config = require('${getImportPath(grpcObjPath, configFilePath)}');
}`,
        `const grpcObject = grpc.loadPackageDefinition(loadFromJson(`,
        `  root,`,
        `  (config && config.loaderOptions) || { defaults: true },`,
        `));\n`,
        `// fix: grpc-message header split by comma
grpc.Metadata.prototype.getMap = function() {
  const result: any = {};
  forOwn((this as any).internalRepr, (values, key) => {
    if (values.length > 0) {
      // const v = values[0];
      result[key] = values.map((v: any) => {
        return v instanceof Buffer ? v.slice() : v;
      }).join(',')
    }
  });
  return result;
}
      `,
        `export default grpcObject;`,
      ].join('\n'));
    } else {
      await fs.writeFile(grpcObjPath, [
        fileTip,
        `const grpc = require('${grpcNpmName}');`,
        `const { loadFromJson } = require('load-proto');`,
        `const root = require('${getImportPath(grpcObjPath, jsonPath)}');\n`,
        `const grpcObject = grpc.loadPackageDefinition(loadFromJson(root));`,
        `module.exports = grpcObject;`,
        `module.exports.default = grpcObject;`,
      ].join('\n'));
    }

    const typesPath = getAbsPath('types.ts', baseDir);

    await fs.writeFile(
      typesPath,
      fileTip + '\n'
      + genTsType(namespace, { root, messageMap, enumMap }),
    );

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
      const servicePath = getAbsPath(`${service.fullName.replace(/\./g, '/')}.${moduleSuffix}`, baseDir);
      const serviceDTsPath = getAbsPath(`${service.fullName.replace(/\./g, '/')}.d.ts`, baseDir);

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
          return `  ${method.name}(
    request: ${requestType},
    options?: { timeout?: number; flags?: number; host?: string; },
    callback?: (err: Error, response: ${responseType}) => void,
  ): Promise<${responseType}>;
`
        });

      if (typescript) {
        const typeName = 'I' + service.name;
        await fs.writeFile(servicePath, [
          fileTip,
          `import { get } from 'lodash';`,
          `import grpcObject from '${getImportPath(servicePath, grpcObjPath)}';\n`,
          `import { ChannelCredentials } from "${grpcNative ? 'grpc' : '@grpc/grpc-js/build/src/channel-credentials'}";`,
          `import { promisify } from 'util';`,
          `import * as types from '${getImportPath(servicePath, typesPath)}';\n`,
          `const config = require('${getImportPath(servicePath, configFilePath)}');\n`,
          `const logOptions = config.logOptions ? { ...config.logOptions } : { enable: true, attributes: ['request'] } \n`,
          `const callOptions = config.callOptions ? { ...config.callOptions } : {} \n`,
          `export interface ${typeName} {`,
          `  $FILE_NAME: string;`,
          `  new (address: string, credentials: ChannelCredentials, options?: object): ${typeName};\n`,
          ...methodStrArr,
          `}`,
          `const Service: ${typeName} = get<any, string>(grpcObject, '${service.fullName}');`,
          `Service.$FILE_NAME = '${service.filename.replace(/\\/g, '/')}';`,
          `
Object.keys(Service.prototype).forEach((key) => {
  if (!/^\\$/.test(key)) {
    const origin = Service.prototype[key];
    const methodId = origin.path.replace(/\\//g, '.').replace(/^\\./, '');
    Service.prototype[key] = promisify(function(this: any, request: any, options: any, callback: any) {
      if (typeof callback !== 'undefined') {
        options = Object.assign({}, callOptions, options) || {};
      } else {
        callback = options;
        options = { ...callOptions };
      }

      if (typeof options.timeout === 'number') {
        options.deadline = Date.now() + options.timeout; 
      }

      const start = Date.now();
      return (origin as any).apply(this, [request, options, function(err: any, response: any) {
        if (!logOptions.disable) {
          const duration = (Date.now() - start) / 1000;
          console.info('grpc invoke:', methodId, 'duration:', duration + 's', 'request:', JSON.stringify(request));
          if (err) {
            console.error('grpc invoke:', methodId, 'duration:', duration + 's', 'request:', JSON.stringify(request), 'err:', err);
          }
        }
        callback(err, response);
      }]);
    });
  }
});`,
          `export const ${service.name}: ${typeName} = Service;`,
          `export default ${service.name};\n`,
        ].join('\n'));
      } else {
        await fs.writeFile(servicePath, [
          fileTip,
          `const { get } = require('lodash');`,
          `const { promisify } = require('util');`,
          `const grpcObject = require('${getImportPath(servicePath, grpcObjPath)}');\n`,
          `const config = require('${getImportPath(servicePath, configFilePath)}');\n`,
          `const logOptions = config.logOptions ? { ...config.logOptions } : { enable: true, attributes: ['request'] } \n`,
          `const callOptions = config.callOptions ? { ...config.callOptions } : {} \n`,
          `const ${service.name} = get(grpcObject, '${service.fullName}');`,
          `${service.name}.$FILE_NAME = '${service.filename}';`,
          `
Object.keys(${service.name}.prototype).forEach((key) => {
  if (!/^\\$/.test(key)) {
    const origin = ${service.name}.prototype[key];
    const methodId = origin.path.replace(/\\//g, '.').replace(/^\\./, '');
    ${service.name}.prototype[key] = promisify(function(request, options, callback) {
      if (typeof callback !== 'undefined') {
        options = Object.assign({}, callOptions, options) || {};
      } else {
        callback = options;
        options = { ...callOptions };
      }

      if (typeof options.timeout === 'number') {
        options.deadline = Date.now() + options.timeout; 
      }

      return origin.apply(this, [request, options, function(err: any, response: any) {
        if (!logOptions.disable) {
          const duration = (Date.now() - start) / 1000;
          console.info('grpc invoke:', methodId, 'duration:', duration + 's', 'request:', JSON.stringify(request));
          if (err) {
            console.error('grpc invoke:', methodId, 'duration:', duration + 's', 'request:', JSON.stringify(request), 'err:', err);
          }
        }
        callback(err, response);
      }]);
    });
  }
});`,
          `module.exports.${service.name} = ${service.name};\n`,
          `module.exports.default = ${service.name};\n`,
        ].join('\n'));

        // .d.ts
        await fs.writeFile(serviceDTsPath, [
          fileTip,
          `import { ChannelCredentials } from "${grpcNative ? 'grpc' : '@grpc/grpc-js/build/src/channel-credentials'}";`,
          `import * as types from '${getImportPath(serviceDTsPath, typesPath)}';\n`,
          `export class ${service.name} {`,
          `  static $FILE_NAME: string;`,
          `  constructor(address: string, credentials: ChannelCredentials, options?: object)`,
          ...methodStrArr,
          `}`,
          `export default ${service.name};\n`,
        ].join('\n'));
      }
    });
  }

  console.info(`Generate success in ${baseDir}`);
  return baseDir;
}
