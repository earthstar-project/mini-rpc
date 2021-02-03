import * as http from 'http';

import { logHttpClient, logMain } from './util';
import { 
    Methods,
    Req,
    Res,
    makeProxy,
    myMethods,
} from './mini-rpc';

let makeHttpEvaluator = (hostname: string, path: string, port: number)  => {
    return async (methods: Methods, rpcReq: Req): Promise<Res> => {
        return new Promise((resolve, reject) => {
            let PORT = 8123;
            let postData = JSON.stringify(rpcReq);
            let opts = {
                hostname: 'localhost',
                path: '/rpc',
                port: 8123,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData),
                }
            };
            logHttpClient(`sending rpc request to ${hostname}${path}:${port}...`);
            let request = http.request(opts, (response) => {
                if (response.statusCode !== 200) {
                    reject(new Error('http status ' + response.statusCode));
                }
                let body = '';
                response.setEncoding('utf-8');
                response.on('data', (chunk) => { body += chunk; });
                response.on('end', () => {
                    logHttpClient('...rpc response from server:', body);
                    try {
                        let rpcRes: Res = JSON.parse(body);
                        resolve(rpcRes);
                    } catch (err) {
                        reject(new Error('bad JSON response from server'));
                    } 
                });
            });
            request.on('error', (err) => {
                logHttpClient('request error:', err.message);
                reject(err);
            });
            request.write(postData);
            request.end();
        });
    };
}

//================================================================================

let main = async () => {
    let httpEvaluator = makeHttpEvaluator('localhost', '/rpc', 8123);
    let proxy = makeProxy(myMethods, httpEvaluator);
    logMain('asking for addSlowly...');
    try {
        let answer = await proxy.divide(1, 0);
        logMain('...answer is', answer);
    } catch (err) {
        logMain('error:', err.message);
    }
};
main();
