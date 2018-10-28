import * as grpc from 'grpc';
import CustomerFeedService from './code-gen/feed/CustomerFeedService';
import ImTencentYunService from './code-gen/im/ImTencentYunService';

const customerFeedService = new CustomerFeedService('api.myscrm.cn:10056', grpc.credentials.createInsecure());

console.info(CustomerFeedService.$FILE_NAME)

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
