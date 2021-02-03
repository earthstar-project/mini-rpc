import * as http from 'http';

import { logHttpServer } from './util';
import { 
    Methods,
    evaluator,
} from './mini-rpc';

//================================================================================

export let startHttpRpcServer = (methods: Methods, port: number) => {
    http.createServer((request: http.IncomingMessage, response: http.ServerResponse) => {
        logHttpServer(`${request.method} ${request.url}`);

        if (request.method === 'POST' && request.url === '/rpc') {
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

                let rpcRes = await evaluator(methods, rpcReq);

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
};
