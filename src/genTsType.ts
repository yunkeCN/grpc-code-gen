import { Root } from '@yunke/protobufjs';
import { Options as LoaderOptions } from 'load-proto/build/loader';
import { TEnum, TMessage, TNamespace } from "./types";
import {
  fileTip,
  getTsTypeFactory,
  tslintDisable
} from "./utils";

function genSpace(num: number) {
  let space = '';
  for (let i = 0; i < num; i++) {
    space += ' ';
  }
  return space;
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

function doGenTsType(
  namespace: TNamespace,
  config: {
    root: Root,
    messageMap: { [key: string]: TMessage },
    enumMap: { [key: string]: TEnum },
    withJsonSemantic?: boolean,
    loaderOptions?: LoaderOptions,
  },
  deep: number = 0,
): string {
  const getTsType = getTsTypeFactory(walkPackagePath, config.loaderOptions);

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
        str += doGenTsType(nested[name], config, nextDeep);
        str += `${space}}\n`;
      });
  }
  return str;
}

export default function genTsType(opt: {
  namespace: TNamespace;
  root: Root;
  messages: TMessage[];
  enums: TEnum[];
  loaderOptions?: LoaderOptions,
}): string {
  const {
    namespace,
    root,
    messages,
    enums,
    loaderOptions,
  } = opt;

  const messageMap: { [key: string]: TMessage } = {};
  const enumMap: { [key: string]: TEnum } = {};

  messages.forEach((message) => {
    messageMap[message.fullName] = message;
  });
  enums.forEach((enumT) => {
    enumMap[enumT.fullName] = enumT;
  });

  return [
    fileTip,
    tslintDisable,
    doGenTsType(namespace, { root, messageMap, enumMap, loaderOptions, }),
  ].join('\n');
}