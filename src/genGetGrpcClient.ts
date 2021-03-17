import * as path from "path";
import { fileTip, getImportPath, tslintDisable } from "./utils";

export default function genGetGrpcClient(grpcNpmName: string, grpcClientPath: string): string {
  const grpcNative = grpcNpmName === 'grpc';
  return `${fileTip}
${tslintDisable}
import * as grpc from '${grpcNpmName}';
import { ChannelCredentials } from "${grpcNative ? 'grpc' : `${grpcNpmName}/build/src/channel-credentials`}";
import * as fs from 'fs';
import * as path from 'path';

export interface IService<S> {
  $FILE_NAME: string;
  serverName: string;

  new(address: string, credentials: ChannelCredentials, options?: object): S;
}

const codeGenConfig = require('${getImportPath(grpcClientPath, path.join(process.cwd(), 'grpc-code-gen.config.js'))}');

const {
  clientOptions = {},
  getServiceConfig,
} = codeGenConfig;

if (typeof getServiceConfig !== 'function') {
  console.error('请在配置文件grpc-code-gen.config.js中设置属性: getServiceConfig');
  process.exit(-1);
}

const grpcServiceConfigPath = process.env.NODE_ENV === 'dev' ? 
  path.resolve(__dirname, '${getImportPath(grpcClientPath, path.join(process.cwd(), 'grpc-service.dev.config.js'))}.js') : 
  path.resolve(__dirname, '${getImportPath(grpcClientPath, path.join(process.cwd(), 'grpc-service.config.js'))}.js')


let grpcServiceConfigLocal: { [serviceName: string]: { host: string; port: number; cert_pem_content?: string } } = {};
const serviceConfigFileExist = fs.existsSync(grpcServiceConfigPath);
if (serviceConfigFileExist) {
  grpcServiceConfigLocal = require(grpcServiceConfigPath);
  // console.info('---------------------------');
  // console.info('Use local service config: ');
  // console.info(JSON.stringify(grpcServiceConfigLocal, (key, value) => value, 2));
  // console.info('---------------------------');
}

export default function getGrpcClient<S>(service: IService<S>): S {
  const serverName: string = service.serverName

  if (serverName) {
    const serviceConfig = getServiceConfig(serverName, grpcServiceConfigLocal);

    if (serviceConfig) {
      let credentials;
      if (serviceConfig.cert_pem_content) {
        credentials = grpc.credentials.createSsl(Buffer.from(serviceConfig.cert_pem_content));
      } else {
        credentials = grpc.credentials.createInsecure();
      }
      
      const defaultOptions = {
        'grpc.ssl_target_name_override': serverName,
      };

      let options;
      if (typeof clientOptions === 'function') {
        options = clientOptions(defaultOptions);
      } else {
        options = Object.assign(defaultOptions, clientOptions);
      }

      return new service(\`\$\{serviceConfig.host\}:\$\{serviceConfig.port\}\`, credentials, options);
    }
  }
  throw new Error(\`\$\{service.$FILE_NAME\} config not exists!\`);
}
`;
}
