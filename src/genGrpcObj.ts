import { fileTip, getImportPath } from "./utils";

export default function genGrpcObj(opt:{
  grpcNpmName: string;
  grpcObjPath: string;
  jsonPath: string;
  configFilePath: string;
}): string {
  const { grpcNpmName, grpcObjPath, jsonPath, configFilePath } = opt;
  return [
    fileTip,
    `import * as grpc from '${grpcNpmName}';`,
    `import { Status } from '${grpcNpmName}/build/src/constants';`,
    `import * as fs from 'fs';`,
    `import { forOwn } from 'lodash';`,
    `import { loadFromJson } from 'load-proto';\n`,
    `const root = require('${getImportPath(grpcObjPath, jsonPath)}');\n`,
    `let config;`,
    `if (fs.existsSync(require.resolve('${getImportPath(grpcObjPath, configFilePath as string)}'))) {
  config = require('${getImportPath(grpcObjPath, configFilePath as string)}');
}`,
    `const grpcObject = grpc.loadPackageDefinition(loadFromJson(`,
    `  root,`,
    `  (config && config.loaderOptions) || { defaults: true },`,
    `));\n`,
    `// fix: grpc-message header split by comma
grpc.Metadata.prototype.getMap = function() {
  const result: any = {};
  const collection = (this as any).internalRepr;
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
};
      `,
    `export default grpcObject;`,
  ].join('\n')
}