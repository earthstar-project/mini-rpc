import {
    myMethods,  // some example methods to play with
} from './test/things-to-test';
import { startHttpRpcServer } from './lib/http-server';
import { logMain } from './lib/util';

//================================================================================

logMain('starting http server on http://localhost:8123');
startHttpRpcServer(myMethods, 8123);
