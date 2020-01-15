import { fileTip, getImportPath, tslintDisable } from "./utils";

export default function genGrpcObj(opt: {
  grpcNpmName: string;
  grpcObjPath: string;
  jsonPath: string;
  configFilePath: string;
}): string {
  const { grpcNpmName, grpcObjPath, jsonPath, configFilePath } = opt;
  const isNative = grpcNpmName === 'grpc';
  return [
    fileTip,
    tslintDisable,
    `import * as grpc from '${grpcNpmName}';`,
    `import * as fs from 'fs';`,
    `import { forOwn } from 'lodash';`,
    `import { loadFromJson } from 'load-proto';\n`,
    isNative ? `import { EventEmitter } from "events";` : `import { Status } from '${grpcNpmName}/build/src/constants';`,
    `const root = require('${getImportPath(grpcObjPath, jsonPath)}');\n`,
    `let config: any;`,
    `if (fs.existsSync(require.resolve('${getImportPath(grpcObjPath, configFilePath as string)}'))) {
  config = require('${getImportPath(grpcObjPath, configFilePath as string)}');
}`,
    `const grpcObjectGroup: any = {}`,
    `Object.keys(root).forEach((key: string) => {`,
    ` grpcObjectGroup[key] = grpc.loadPackageDefinition(loadFromJson(`,
    `   root[key],`,
    `   (config && config.loaderOptions) || { defaults: true },`,
    ` ));`,
    `});\n`,
    `// fix: grpc-message header split by comma
grpc.Metadata.prototype.getMap = function() {
  const result: any = {};
  const collection = (this as any).internalRepr || (this as any)._internal_repr;
  if (collection.forEach) {
    collection.forEach((values: any, key: string) => {
      if (values.length > 0) {
        result[key] = values.map((v: any) => {
          return v instanceof Buffer ? v.slice() : v;
        }).join(',')
      }
    });
  } else {
    forOwn(collection, (values, key) => {
      if (values.length > 0) {
        // const v = values[0];
        result[key] = values.map((v: any) => {
          return v instanceof Buffer ? v.slice() : v;
        }).join(',')
      }
    });
  }
  return result;
};
`,
    isNative ?
      `
const clientInterceptors = require('grpc/src/client_interceptors');
const common = require('grpc/src/common');

const getLastListener = clientInterceptors.getLastListener;

function _getUnaryListener(method_definition: any, emitter: any, callback: any) {
  var resultMessage: any;
  return {
    onReceiveMetadata: function(metadata: any) {
      emitter.emit('metadata', metadata);
    },
    onReceiveMessage: function(message: any) {
      resultMessage = message;
    },
    onReceiveStatus: function(status: any) {
      if (status.code !== grpc.status.OK) {
        var error = common.createStatusError(status);
        callback(error);
      } else {
        callback(null, resultMessage, status.metadata);
      }
      emitter.emit('status', status);
    }
  };
}

clientInterceptors.getLastListener = function (method_definition: any, emitter: any, callback: any) {
  var method_type = common.getMethodType(method_definition);
  if (method_type !== 0) {
    return getLastListener(method_definition, emitter, callback);
  }

  if (emitter instanceof Function) {
    callback = emitter;
    callback = function() {};
  }
  if (!(callback instanceof Function)) {
    callback = function() {};
  }
  if (!((emitter instanceof EventEmitter) &&
    (callback instanceof Function))) {
    throw new Error('Argument mismatch in getLastListener');
  }

  return _getUnaryListener(method_definition, emitter, callback);
}`
      :
      `
(grpc.Client.prototype as any).handleUnaryResponse = function(call: any, deserialize: any, callback: any) {
  let responseMessage:any = null;
  call.on('data', (data: any) => {
    if (responseMessage != null) {
      call.cancelWithStatus(Status.INTERNAL, 'Too many responses received');
    }
    try {
      responseMessage = deserialize(data);
    } catch (e) {
      call.cancelWithStatus(Status.INTERNAL, 'Failed to parse server response');
    }
  });
  call.on('end', () => {
    if (responseMessage == null) {
      call.cancelWithStatus(Status.INTERNAL, 'Not enough responses received');
    }
  });
  call.on('status', (status: any) => {
    // 增加返回参数metadata
    if (status.code === Status.OK) {
      callback(null, responseMessage, status.metadata);
    } else {
      const error = Object.assign(new Error(status.details), status);
      callback(error, null, status.metadata);
    }
  });
};`,
    `export default grpcObjectGroup;`,
  ].join('\n')
}