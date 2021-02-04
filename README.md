# Mini-RPC

A small RPC framework inspired by JSON-RPC.

Lets you run code on remote computers as if it was local.

Follows a request-response model but does not assume that either side is a "client" or "server" -- bothe sides can make requests.

## Features

Pure Typescript with good type propagation through your code.

No dependencies except `tap` and `chalk` for debugging.

## Why not JSON-RPC

It's almost the same.  But I plan to extend this to allow streaming and maybe pubsub-style subscriptions.

## Install

It's [@earthstar-project/mini-rpc](https://www.npmjs.com/package/@earthstar-project/mini-rpc) on NPM

```sh
npm install --save @earthstar-project/mini-rpc
  or
yarn add @earthstar-project/mini-rpc
```

```ts
import {
    Req,
    Res,
    makeProxy,
    evaluator
} from '@earthstar-project/mini-rpc';
```

## How it works

You provide an object containing some functions you want to expose.  We call this the `Methods` object.

```ts
// example Methods object
let myMethods = {
    // These can be sync or async functions.
    doubleSync: (x: number) => { return x * 2; },
    doubleAsync: async (x: number) => { return x * 2; },

    add: async (x: number, y: number) => { return x + y; },

    // This one takes 1 second to run, to help with testing
    addSlowly: async (x: number, y: number) => {
        await sleep(1000);
        return x + y;
    },

    // These functions can throw errors.
    divide: async (x: number, y: number) => {
        if (y === 0) { throw new Error('divide by zero??'); }
        return x / y;
    },

    // They will be correctly type-checked when you use them.
    hello: async (name: string) => { return `Hello ${name}`; },
};
```

We're going to make a Javascript proxy object that stands in for this Methods object but intercepts the calls and runs code on a distant computer.  Because a network is involved, all the methods will be turned into async functions.

```ts
// EXAMPLE CLIENT CODE

// The proxy object is a stand-in for the methods object.
let proxy = makeProxy(myMethods, evaluator);

// call a function through the proxy
let five = await proxy.addSlowly(2, 3);  // --> 5

// all methods have been made async
// to allow for networking to happen,
// even if they were defined as sync methods
let doubled = await proxy.doubleSync(123);  // --> 456

// Typescript checks the types correctly.  This is an error:
//let oops = await proxy.doubleSync("this should be a number");

try (
    // The divide function throws an error over on the
    // other computer where its code is running.
    // That error is shipped back over the network
    // and re-thrown here.
    let oops = await proxy.divide(1, 0);
} catch (err) {
    console.warn(err);
}
```

## The moving parts

```
Proxy object        Evaluator function
-----------------   ------------------
when a function
is called, turn
it into a Req   --->
                    Given a Req object,
                    run the actual function
                    and make a Res object
                <---
return the value
from the Res, or
throw the error
```

A proxy wraps around your `methods` object and intercepts the function calls.

```ts
let proxy = makeProxy(myMethods, evaluator);
let five = await proxy.addSlowly(2, 3);
```

The Proxy converts the function call to a `Req` object like this:

```json
{
    "id": "123456",  // a random string
    "method": "addSlowly",
    "args": [2, 3]
}
```

The proxy hands that to an `evaluator` function, whose job is to turn Requests into Responses by running the function.  It returns a `Res` object:

```json
{
    "id": "123456",  // matches the request id
    "result": 5
}
```

The proxy takes that `Res` and returns the value as normal to your local code.

## Error handling

If a method throws an error, the evaluator packs the error into the `Res` object in a JSON-safe way:

```json
{
    "id": "123456",
    "err": {
        "code": "ERR_VALUE_OUT_OF_RANGE",
        "message": "Value out of range",
        "name": "ValueOutOfRangeError",
        "stack": "... multi-line string with stack trace ...",
    }
}
```

...and when it arrives back to your local proxy, the error is thrown again.

## Extending this over a network

The key idea is that an `evaluator` function's job is to turn requests into responses.  It can do that by actually running the functions, or by reaching over the network and asking someone else to do it.

So you can make your own `evaluator` functions that act like plugins or middleware for different network transports, and you have to make a corresponding server for them to talk to.

Example:

* `http-client.ts` -- Defines a new `httpEvaluator` function which sends the `Req` over HTTP to a server, lets the server evaluate it, and gets a `Res` back.

* `http-server.ts` -- Run a HTTP server.  It accepts `Req` objects by POST, runs them through the normal `evaluator` function, and sends the `Res` back out.

Obviously both computers will need to have matching expectations about the `Methods` they're both trying to talk about.

> Note, these examples were written with only the built-in node `http` library so they're verbose and intimidating, but they could be much shorter if we used something like `express`.

# Demos

## HTTP demo 

* `yarn install`
* `yarn build`
* `yarn start-server`
* in another shell, `yarn start-client` to make a request to the server

## Local demo

This runs both parts in the same process, not over the network.

* `yarn install`
* `yarn build`
* `yarn start-local-demo`

# Future work

* **Streaming**: Subscribe to a stream of events or receive long data as a stream of messages.  Unsubscribe from streams.  Maybe even something like pubsub.

* **Room servers**: Make a "room server" that helps browsers talk directly to each other by forwarding their Req and Res objects back and forth

* **2-way over HTTP**: Figure out bidirectional communication over HTTP so both sides can initiate requests.  Maybe use server-sent-events.

* **More Plugins**: Build plugins for websockets, express, WebRTC data channels, duplex streams (for hyperswarm), other p2p protocols?

* **Error handling**: do we need to clarify when the error is from the RPC system (network problems, etc) vs. an error from the method being called?  Make sure errors aren't getting mangled too much by being flattened to JSON.

* **Tests**: Write more tests around error handling

* **Encoding**: JSON is the obvious choice but also consider something like bencode
