import {
    myFunctions,  // some example functions to play with
} from './test/things-to-test';
import { startHttpRpcServer } from './lib/http-server';
import { logMain } from './lib/util';

//================================================================================

let HOSTNAME = 'localhost';
let PORT = 8077;
let PATH = '/rpc';
let URL = `http://${HOSTNAME}${PATH}:${PORT}`;

logMain('starting http server on ' + URL);
startHttpRpcServer(myFunctions, PATH, PORT);
