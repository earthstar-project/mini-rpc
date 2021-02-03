import * as http from 'http';

import { 
    myMethods,
    evaluateReq,
    Req,
    Methods,
    Res,
    makeFancyProxy2,
} from './mini-rpc';
import { logHttpClient, logMain } from './util';

let makeHttpEvaluator = (hostname: string, path: string, port: number) => {
    return async (methods: Methods, rpcReq: Req) => {
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
            });
            request.write(postData);
            request.end();
        });
    };
}

//================================================================================

let main = async () => {
    let httpEvaluator = makeHttpEvaluator('localhost', '/rpc', 8123);
    let proxy = makeFancyProxy2(myMethods, httpEvaluator);
    logMain('asking for addSlowly...');
    let answer = await proxy.addSlowly(1, 2);
    logMain('...answer is', answer);
};
main();
