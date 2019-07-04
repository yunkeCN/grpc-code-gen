import * as path from "path";
import { fileTip, getImportPath } from "./utils";

export default function genGetGrpcClient(grpcNpmName: string, grpcClientPath: string): string {
  const grpcNative = grpcNpmName === 'grpc';
  const grpcCodeGenPath = path.join(process.cwd(), '.grpc-code-gen');
  return `${fileTip}
import * as grpc from '${grpcNpmName}';
import { ChannelCredentials } from "${grpcNative ? 'grpc' : `${grpcNpmName}/build/src/channel-credentials`}";
import * as fs from 'fs';
import * as path from 'path';

export interface IService<S> {
  $FILE_NAME: string;

  new(address: string, credentials: ChannelCredentials, options?: object): S;
}

let grpcServiceConfig: {
  [key: string]: {
    server_name: string;
    server_port: number;
    cert_pem_path: string | undefined;
  }
};

const codeGenConfig = require('${getImportPath(grpcClientPath, path.join(process.cwd(), 'grpc-code-gen.config.js'))}');

const globalConfigPath = path.resolve(__dirname, '${getImportPath(grpcClientPath, path.join(grpcCodeGenPath, 'config.json'))}');
if (!fs.existsSync(globalConfigPath)) {
  console.error('Please run: "yarn grpc-gen" first');
  process.exit(-1);
}

const grpcServiceConfigPath = path.resolve(__dirname, '${getImportPath(grpcClientPath, path.join(process.cwd(), 'grpc-service.config.js'))}.js');
grpcServiceConfig = require(globalConfigPath);

let grpcServiceConfigLocal: any = {};
const serviceConfigFileExist = fs.existsSync(grpcServiceConfigPath);
if (serviceConfigFileExist) {
  grpcServiceConfigLocal = require(grpcServiceConfigPath);
  console.info('---------------------------');
  console.info('Use local service config: ');
  console.info(JSON.stringify(grpcServiceConfigLocal, (key, value) => value, 2));
  console.info('---------------------------');
}

export default function getGrpcClient<S>(service: IService<S>): S {
  const exec = /\\/([^/]+)-proto\\//.exec(service.$FILE_NAME);

  if (exec) {
    const serverName = exec[1];
    const configLocal = grpcServiceConfigLocal[serverName];
    if (serviceConfigFileExist && !configLocal) {
      console.warn(\`Service: \$\{serverName\} not setting local, use global config, please ensure have set hosts\`)
    }
    const config = configLocal || grpcServiceConfig[serverName];
    if (config) {
      let credentials;
      if (config.cert_pem_path) {
        credentials = grpc.credentials.createSsl(
          fs.readFileSync(path.join(__dirname, '${getImportPath(grpcClientPath, path.join(grpcCodeGenPath, 'ca.pem'))}')),
        );
      } else {
        credentials = grpc.credentials.createInsecure();
      }
      
      let options;
      const {
        clientOptions = {},
      } = codeGenConfig;

      const defaultOptions = {
        'grpc.ssl_target_name_override': serverName,
        'grpc.keepalive_time_ms': 3000,
        'grpc.keepalive_timeout_ms': 2000,
      };

      if (typeof clientOptions === 'function') {
        options = clientOptions(defaultOptions);
      } else {
        options = Object.assign(defaultOptions, clientOptions);
      }

      return new service(\`\$\{config.server_name\}:\$\{config.server_port\}\`, credentials, options);
    }
  }
  throw new Error(\`\$\{service.$FILE_NAME\} config not exists!\`);
}
`;
}
