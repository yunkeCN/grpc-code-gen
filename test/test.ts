import * as grpc from 'grpc';
import CustomerFeedService from './code-gen/feed/CustomerFeedService';
import ImTencentYunService from './code-gen/im/ImTencentYunService';
import * as jsonSemanticTypes from './code-gen/jsonSemanticTypes';

const customerFeedService = new CustomerFeedService('api.myscrm.cn:10056', grpc.credentials.createInsecure());

const jsonSemanticVar: jsonSemanticTypes.extjson_config_third.UpdateExtJsonByEnvRequest = {
  env:11,
  ext_json: {
    __type: "string",
    __format: "word"
  }
};

customerFeedService.GetRadarFeedHotPull({
  'yk_org_code': '',
  'yk_project_id': '',
  'yk_user_id': '',
})
  .then(res => {
    console.info(res);
  })

const imTencentYunService = new ImTencentYunService('api.myscrm.cn:10112', grpc.credentials.createInsecure());

imTencentYunService.IsAccountOnline({
  app_code: '',
  identifier: '',
})
  .then(res => {
    console.info(res);
  })
