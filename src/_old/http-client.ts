import * as http from 'http';

import { logHttpClient } from '../lib/util';
import { 
    Req,
    Res,
} from './mini-rpc';

// '/rpc' is a good choice for path
export let makeHttpEvaluator = (hostname: string, path: string, port: number)  => {
    // functions is unused here because we're sending requests over the network,
    // never calling the functions in this code
    return async (functions: any, rpcReq: Req): Promise<Res> => {
        return new Promise((resolve, reject) => {
            let postData = JSON.stringify(rpcReq);
            let opts = {
                hostname,
                path,
                port,
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
