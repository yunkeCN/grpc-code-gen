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
      metadataIns.add(keyName, '' + metadata[keyName]);
    });
  }
  return metadataIns;
}

const config = require('${getImportPath(serviceWrapperPath, configFilePath)}');

const logOptions = config.logOptions ? { ...config.logOptions } : { enable: true, attributes: ['request'] }

const callOptions = config.callOptions ? { ...config.callOptions } : {}

const filterError = config.filterError || ((err: Error)=> err);

function needRetry(err: any): boolean {
  const message = err.details || err.message || err.data;
  if (/^TCP Read failed/.test(message)) {
    return true;
  }
  if (/^Internal HTTP2 error/.test(message)) {
    return true;
  }
  return false;
}

export default function serviceWrapper<Type>(Service: Type): Type {
  Object.keys((Service as any).prototype).forEach((key) => {
    if (!/^\\$/.test(key)) {
      const origin = (Service as any).prototype[key];
      const methodId = origin.path.replace(/\\//g, '.').replace(/^\\./, '');
      const wrapper = function(this: any, request: any, metadata: any, options: any, callback: any) {
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

        const optionCallback = (option:any) => {
          const {
            url = '', method = '', headers = {},
            metadata: callmetadata = {}
          }: any = option || {}
          
          // @ts-ignore
          console.access(
            '-------grpc begin-------',
            'grpc invoke:', methodId,
            'request:', JSON.stringify({ url, method }),
            'metadata:', JSON.stringify(callmetadata._internal_repr || metadata),
            'request:', JSON.stringify(request),
            'trace.id', headers['trace-id']
          );
        }

        options = Object.assign({ optionCallback }, callOptions, options);

        let count = 0;

        function doCall(self: any) {
          if (typeof options.timeout === 'number') {
            options.deadline = Date.now() + options.timeout;
          }

          const start = Date.now();
          (origin as any).apply(self, [request, toMetadata(metadata), options, function(err: any, response: any, metadataRes: Metadata, elasticOptions:any) {
            if (!logOptions.disable) {
              const duration = (Date.now() - start) / 1000;

              const {
                url = '', method = '', headers = {},
                metadata: callmetadata = {}
              }: any = elasticOptions || {}

              // @ts-ignore
              console.access(
                '-------grpc end-------',
                'grpc invoke:', methodId,
                'duration:', duration + 's',
                'request:', JSON.stringify({ url, method }),
                'metadata:', JSON.stringify(callmetadata._internal_repr || metadata),
                'request:', JSON.stringify(request),
                'trace.id', headers['trace-id']
              );

              if (err) {
                console.error(
                  '-------grpc-end--------',
                  'grpc invoke:', methodId,
                  'duration:', duration + 's',
                  'request:', JSON.stringify({ url, method }),
                  'metadata:', JSON.stringify(callmetadata || metadata),
                  'request:', JSON.stringify(request),
                  'trace.id', headers['trace-id'],
                  'err:', err,
                );
              }
            }

            if (err && count < maxTry && needRetry(err)) {
              count++;
              setTimeout(() => {
                doCall(self);
              }, 25);
            } else {
              callback(err && filterError(err), response, metadataRes);
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