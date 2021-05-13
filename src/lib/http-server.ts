import * as http from 'http';

import { logHttpServer } from './util';
import { 
    evaluator,
} from './mini-rpc';

//================================================================================

// '/rpc' is a good choice for path
export let startHttpRpcServer = (functions: any, path: string, port: number) => {
    let server = http.createServer((request: http.IncomingMessage, response: http.ServerResponse) => {
        logHttpServer(`${request.method} ${request.url}`);

        if (request.method === 'POST' && request.url === path) {
            let body = '';
            request.on('data', data => { body += data });
            request.on('end', async () => {
                let rpcReq: any;
                try {
                    rpcReq = JSON.parse(body);
                } catch (err) {
                    response.writeHead(500, {'Content-Type': 'text/plain',});
                    response.end('bad JSON input', 'utf-8');
                }

                logHttpServer('incoming rpc req:', rpcReq);

                let rpcRes = await evaluator(functions, rpcReq);

                logHttpServer('rpc result:', rpcRes);

                response.writeHead(200, {'Content-Type': 'application/json',});
                response.end(JSON.stringify(rpcRes), 'utf-8');
            });
        } else {
            response.writeHead(404, {'Content-Type': 'text/plain',});
            response.end('not found', 'utf-8');
        }
    }).listen(port);

    logHttpServer('serving on', port);
    return server;
};
