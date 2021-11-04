
import {
    logProxy,
} from './util';

import {
    IRpcClient,
} from './types';

// Make a proxy around a object-of-functions or class instance, and an evaluator function.
// This proxy converts the function call to rpcClient.<functionName>(...args).
// The result is returned, or an error is thrown if there is one from the remote side.
export let makeProxy = <Fns>(fns: Fns, rpcClient: IRpcClient): Fns => {
    let handler = {
        get: function(target: any, prop: string, receiver: any) {
            return async (...args: any[]): Promise<any> => {
                logProxy(`calling ${prop}(...${JSON.stringify(args)})`);

                // We don't allow undefined function arguments because it's hard to
                // safely round-trip them through JSON.
                // TODO: we should inspect the args more deeply to check for undefined lurking in an array or something
                // TODO: add this safety check elsewhere in the code too
                if (args.includes(undefined)) {
                    throw new Error(`In call to ${prop}: mini-rpc won't let you use undefined as a function argument.  Use null, if you can.`);
                } 

                logProxy('sending request');
                // TODO: handle errors thrown in here
                let result = await rpcClient.request(prop, ...args);
                logProxy('...sending request: done.');
                logProxy('got result:', result);

                return result;
            }
        }
    };
    return new Proxy(fns, handler) as Fns;
}
