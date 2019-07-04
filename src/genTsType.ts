import { Root } from 'protobufjs';
import { TEnum, TMessage, TNamespace } from "./types";
import { fileTip, PROTO_TYPE_2_JSON_SEMANTIC_MAP, PROTO_TYPE_2_TS_TYPE_MAP } from "./utils";

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

function doGenTsType(
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
}): string {
  const {
    namespace,
    root,
    messages,
    enums,
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
    doGenTsType(namespace, { root, messageMap, enumMap }),
  ].join('\n');
}
