import * as path from "path";
import { Root } from "@yunke/protobufjs";
import { TEnum, TMessage } from "./types";
import { Options as LoaderOptions } from "load-proto/build/loader";

export const BASE_DIR = path.join(process.cwd(), 'code-gen');

export const tslintDisable = `// tslint:disable`;
export const fileTip = `// This file is auto generated by grpc-code-gen, do not edit!`;

const longsType = ['double', 'float', 'int64', 'uint64', 'sint64', 'fixed64', 'sfixed64'];

export const PROTO_TYPE_2_TS_TYPE_MAP: { [key: string]: string } = {
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

export const PROTO_TYPE_2_JSON_SEMANTIC_MAP: { [key: string]: string } = {
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

export function getImportPath(fromPath: string, toPath: string) {
  let relative = path.relative(path.dirname(fromPath), toPath);
  relative = relative
    .replace(/\.(js|d\.ts|ts)$/, '')
    .replace(/\\/g, '/');
  if (!/^\./.test(relative)) {
    relative = `./${relative}`;
  }
  return relative;
}

export function getPackageName(fullName: string): string {
  let split = fullName.split('.');
  return split.slice(0, split.length - 1).join('.');
}

export function getAbsPath(relativePath: string, baseDir: string = BASE_DIR): string {
  return path.join(baseDir, relativePath);
}

export function getTsTypeFactory(
  walkPackagePath: (packagePath: string, type: string, map: { [key: string]: any }) => string | null,
  loaderOptions: LoaderOptions = {},
) {
  return function getTsType(
    protoType: string,
    fullName: string,
    config: {
      root: Root,
      messageMap: { [key: string]: TMessage },
      enumMap: { [key: string]: TEnum },
    },
    isArr?: boolean,
  ): { tsType: string, semanticType?: string, basic: boolean } {
    let basic = PROTO_TYPE_2_TS_TYPE_MAP[protoType];
    if (basic) {
      let prototype2JSONSEMANTIC = PROTO_TYPE_2_JSON_SEMANTIC_MAP[protoType];
      if (longsType.indexOf(protoType) > -1 && loaderOptions.longs === String) {
        basic = 'string';
        prototype2JSONSEMANTIC = 'StringSchema';
      }
      return {
        tsType: basic,
        semanticType: prototype2JSONSEMANTIC,
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
}