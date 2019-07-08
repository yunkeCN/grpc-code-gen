import { fileTip, getImportPath, tslintDisable } from "./utils";

export default function genServiceWrapper(opt: {
  grpcNpmName: string;
  configFilePath: string;
  serviceWrapperPath: string;
}): string {
  const { grpcNpmName, configFilePath, serviceWrapperPath } = opt;
  return `${fileTip}
${tslintDisable}
import * as grpc from '${grpcNpmName}';
import { Metadata } from "${grpcNpmName}";
import { promisify } from "util";

export type MetadataMap = { [key: string]: string | number | Buffer };

export interface ReqOptions {
  request: any;
  metadata?: MetadataMap;
  options: any;
}

const maxTry = 3;

function toMetadata(metadata: MetadataMap): Metadata {
  const metadataIns = new grpc.Metadata();
  if (metadata && typeof metadata === "object") {
    Object.keys(metadata).forEach((keyName) => {
      metadataIns.add(keyName, metadata[keyName] as string);
    });
  }
  return metadataIns;
}

const config = require('${getImportPath(serviceWrapperPath, configFilePath)}');

const logOptions = config.logOptions ? { ...config.logOptions } : { enable: true, attributes: ['request'] }

const callOptions = config.callOptions ? { ...config.callOptions } : {}

export default function serviceWrapper<Type>(Service: Type): Type {
  Object.keys((Service as any).prototype).forEach((key) => {
    if (!/^\\$/.test(key)) {
      const origin = (Service as any).prototype[key];
      const methodId = origin.path.replace(/\\//g, '.').replace(/^\\./, '');
      const wrapper = function(this: any, request: any, metadata: MetadataMap, options: any, callback: any) {
        switch (arguments.length) {
          case 2:
            callback = metadata;
            metadata = {};
            options = {};
            break;
          case 3:
            callback = options;
            options = metadata;
            metadata = {};
            break;
        }

        options = Object.assign({}, callOptions, options);

        let count = 0;

        function doCall(self: any) {
          if (typeof options.timeout === 'number') {
            options.deadline = Date.now() + options.timeout;
          }

          const start = Date.now();
          (origin as any).apply(self, [request, toMetadata(metadata), options, function(err: any, response: any, metadataRes: Metadata) {
            if (!logOptions.disable) {
              const duration = (Date.now() - start) / 1000;
              console.info(
                'grpc invoke:', methodId,
                'duration:', duration + 's',
                'metadata:', JSON.stringify(metadata),
                'request:', JSON.stringify(request),
              );
              if (err) {
                console.error(
                  'grpc invoke:', methodId,
                  'duration:', duration + 's',
                  'metadata:', JSON.stringify(metadata),
                  'request:', JSON.stringify(request),
                  'err:', err,
                );
              }
            }

            if (err && count < maxTry && /^Internal HTTP2 error/.test(err.details || err.message || err.data)) {
              count++;
              setTimeout(() => {
                doCall(self);
              }, 25);
            } else {
              callback(err, response, metadataRes);
            }
          }]);
        }

        doCall(this);
      };
      (Service as any).prototype[key] = promisify(wrapper);
      (Service as any).prototype[\`\$\{key\}V2\`] = function(option: ReqOptions) {
        const { request, metadata = {}, options } = option;
        return new Promise((resolve, reject) => {
          wrapper.call(this, request, metadata, options, (err: Error | null, res: any, metadataRes: Metadata) => {
            if (err) {
              reject(err);
              return;
            }
            resolve({ response: res, metadata: metadataRes });
          });
        });
      };
    }
  });
  return Service;
}
`;
}