import { 
    myMethods,
} from './lib/mini-rpc';
import { startHttpRpcServer } from './lib/http-server';
import { logMain } from './lib/util';

//================================================================================

logMain('starting http server on http://localhost:8123');
startHttpRpcServer(myMethods, 8123);
