import { TransportHTTPClientSide } from './transport-http-client';
import { Obj } from './types';

let log = (...args: any[]) => console.log('CLIENT  ', ...args);

let main = async () => {
    log('main (client)');
    let PORT = 8008

    log('main: setting up transport on port ' + PORT);
    let transport = new TransportHTTPClientSide(`http://localhost`, PORT);
    transport.onReceive(async (packet: Obj) => {
        log('main: = = = = = = = = CLIENT TRANSPORT GOT A MESSAGE', packet);
        log('client response: 789');
    });

    let ii = 0;
    while (true) {
        log(`main: --> await transport.send(hello: world, ${ii}) which should be a POST to the server...`, ii);
        await transport.send({hello: 'world', from: 'client', num: ii})
        log('main: ...done.');
        log('...main is done.');
        ii += 1;
    }

}
main();
