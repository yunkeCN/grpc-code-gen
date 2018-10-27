import { uniqBy } from 'lodash';
import {
  Enum,
  Field,
  IEnum,
  IMethod,
  INamespace,
  IService,
  IType,
  Namespace,
  ReflectionObject,
  Service,
  Type,
} from 'protobufjs';
import { TEnum, TField, TMessage, TMethod, TService } from "./types";

interface HasName {
  name: string;
  fullName: string;
  comment: string;
}

interface HasAuthor {
  author: string;
}

function formatFullName(fullName: string): string {
  return fullName.replace(/^\./, '');
}

export function inspectNamespace(namespace: ReflectionObject & INamespace): {
  json: HasName & INamespace,
  services: TService[],
  methods: TMethod[],
  messages: TMessage[],
  enums: TEnum[],
} | null | undefined {
  const collectServices: TService[] = [];
  const collectMethods: TMethod[] = [];
  const collectMessages: TMessage[] = [];
  const collectEnums: TEnum[] = [];
  const { nested, name, fullName, comment } = namespace;
  if (typeof nested !== 'undefined') {
    const cloneNested: any = {};
    Object.keys(nested).forEach((key) => {
      const reflectionObject = nested[key];

      const asNamespace = reflectionObject as Namespace;
      const asType = reflectionObject as Type;
      const asService = reflectionObject as Service;
      const asEnum = reflectionObject as Enum;

      if (typeof asNamespace.nested !== 'undefined') {
        const namespace1 = inspectNamespace(asNamespace);
        if (namespace1) {
          cloneNested[key] = namespace1.json;

          collectMessages.push(...namespace1.messages);
          collectMethods.push(...namespace1.methods);
          collectServices.push(...namespace1.services);
          collectEnums.push(...namespace1.enums);
        }
      }
      if (typeof asType.fields !== 'undefined') {
        const inspectType1 = inspectType(asType);
        cloneNested[key] = inspectType1.json;

        collectMethods.push(...inspectType1.methods);
        collectMessages.push(...inspectType1.messages);
        collectServices.push(...inspectType1.services);
      }
      if (typeof asService.methods !== 'undefined') {
        const inspectService1 = inspectService(asService);
        cloneNested[key] = inspectService1.json;

        collectMethods.push(...inspectService1.methods);
        collectServices.push(...inspectService1.services);
      }
      if (typeof asEnum.values !== 'undefined') {
        const inspectEnum1 = inspectEnum(asEnum);
        cloneNested[key] = inspectEnum1.json;

        collectEnums.push(...inspectEnum1.enums);
      }
    });
    return {
      json: {
        name,
        fullName: formatFullName(fullName),
        nested: cloneNested,
        comment: comment as string,
      },
      services: uniqBy(collectServices, 'fullName'),
      methods: uniqBy(collectMethods, 'fullName'),
      messages: uniqBy(collectMessages, 'fullName'),
      enums: uniqBy(collectEnums, 'fullName'),
    };
  }
  return null;
}

function inspectType(message: Type): {
  json: IType & HasName,
  services: TService[],
  methods: TMethod[],
  messages: TMessage[],
} {
  const collectServices: TService[] = [];
  const collectMethods: TMethod[] = [];
  const collectMessages: TMessage[] = [];

  const { nested } = message;
  const typeClone: IType & HasName = {
    fields: {},
    name: message.name,
    fullName: formatFullName(message.fullName),
    comment: message.comment as string,
  };
  if (nested) {
    const inspectNamespace1 = inspectNamespace(message);
    if (inspectNamespace1) {
      typeClone.nested = inspectNamespace1.json.nested;
      collectServices.push(...inspectNamespace1.services);
      collectMethods.push(...inspectNamespace1.methods);
      collectMessages.push(...inspectNamespace1.messages);
    }
  }

  const fields: TField[] = [];
  Object.keys(message.fields).forEach((key) => {
    const field: Field = message.fields[key];
    const {
      type,
      name,
      repeated,
      defaultValue,
      bytes,
      id,
    } = field;

    let {
      comment,
      required,
    } = field;

    const regExp = /\n?\s*@required/;
    if (comment && regExp.test(comment)) {
      comment = comment.replace(regExp, '');
      required = true;
    }

    const fieldClone = {
      name,
      type,
      id,
      comment,
      required,
      repeated,
      defaultValue,
      bytes,
    } as TField;

    fields.push(fieldClone);

    typeClone.fields[key] = fieldClone;
  });
  collectMessages.push({
    name: message.name,
    fullName: formatFullName(message.fullName),
    comment: message.comment as string,
    fields,
  });
  return {
    json: typeClone,
    services: collectServices,
    messages: collectMessages,
    methods: collectMethods,
  };
}

function inspectEnum(enum1: Enum): {
  json: IEnum & HasName,
  enums: TEnum[],
} {
  const collectEnums: TEnum[] = [];

  const clone: TEnum = {
    values: enum1.values,
    name: enum1.name,
    fullName: formatFullName(enum1.fullName),
    comment: enum1.comment as string,
    comments: enum1.comments,
  };

  collectEnums.push(clone);
  return {
    json: clone,
    enums: collectEnums,
  };
}

const regExpAuthor = /\n?\s*@author\s+([^\n]+)/;

function getAuthor(comment: string | null): { author: string | undefined | null, comment: string | undefined | null } {
  if (!comment) {
    return { author: null, comment };
  }

  let author;

  if (regExpAuthor.test(comment)) {
    const execRes = regExpAuthor.exec(comment);
    if (execRes) {
      author = execRes[1];
    }

    comment = comment.replace(regExpAuthor, '');
  }
  return { author, comment };
}

function inspectService(service: Service): {
  json: IService & HasName,
  services: TService[],
  methods: TMethod[],
} {
  const collectServices: TService[] = [];
  const collectMethods: TMethod[] = [];

  const res = getAuthor(service.comment);
  const { author } = res;
  const clone: IService & HasName & HasAuthor = {
    methods: {},
    name: service.name,
    fullName: formatFullName(service.fullName),
    comment: res.comment as string,
    author: author as string,
  };
  Object.keys(service.methods).forEach((key) => {
    const method = service.methods[key];
    const {
      name,
      type,
      options,
      requestType,
      responseType,
      requestStream,
      responseStream,
      fullName,
    } = method;

    let {
      comment,
    } = method;

    const authorAndComment = getAuthor(comment);
    comment = authorAndComment.comment as string;

    const methodClone = {
      name,
      fullName: formatFullName(fullName),
      type,
      comment,
      options,
      requestType,
      responseType,
      requestStream,
      responseStream,
      author: authorAndComment.author,
    } as IMethod & HasName;
    collectMethods.push(methodClone);
    clone.methods[key] = methodClone;
  });

  const { methods: methodsClone, nested: nestedClone, ...restClone } = clone;

  collectServices.push({
    ...restClone,
    methods: collectMethods,
  });

  return {
    json: clone,
    services: collectServices,
    methods: collectMethods,
  };
}
