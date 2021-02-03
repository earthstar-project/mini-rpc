import { 
    myMethods,
} from './mini-rpc';
import { startHttpRpcServer } from './http-server';

//================================================================================

startHttpRpcServer(myMethods, 8123);
