# Mini-RPC

A small RPC framework inspired by JSON-RPC.

Lets you run code on remote computers as if it was local.

Follows a request-response model but does not assume that either side is a "client" or "server" -- both sides can make requests.

## Design Goals

* Simplest possible protocol: peers send requests and responses to each other as JSON objects
* Either side can initiate requests; designed for p2p and not locked into a client-server model
* Short and simple
* Network agnostic -- write plugins to support different kinds of networks.  This repo has no network code except for a demonstration plugin for HTTP.
* Designed to work across many languages, not just Javascript.

## Code Features

* Pure Typescript with good type propagation through your code.
* No dependencies except `typescript`, and `tap` and `chalk` for testing.
* Good test coverage.

## Important caveat about undefined values

Because JSON doesn't support `undefined` values, don't use `undefined` anywhere in your function arguments or return values.  Use `null` instead.

If you use it in a function argument, mini-rpc will helpfully throw a `UndefinedNotAllowedError`.

However, it IS allowed as the one single return value of a function, e.g. a function that "doesn't return anything".  Since that's such a common use case, we've made it work.  But don't try to return [1, 2, undefined] or anything like that.

## Why not just use JSON-RPC

It's very similar to this.  But I plan to extend this to allow streaming and maybe pubsub-style subscriptions.

# Install

It's [@earthstar-project/mini-rpc](https://www.npmjs.com/package/@earthstar-project/mini-rpc) on NPM.

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

# How it works

You provide some functions you want to expose to the network, stored in a single object.  We call this the `Methods` object.

```ts
// example Methods object
let myMethods = {

    // These can be sync or async functions.
    // They will all be converted to async functions by
    // the RPC system, since they have to work over the network.

    doubleSync: (x: number) => { return x * 2; },
    doubleAsync: async (x: number) => { return x * 2; },

    add: (x: number, y: number) => { return x + y; },

    // Here's a slow one to help with testing
    addSlowly: async (x: number, y: number) => {
        await sleep(1000);
        return x + y;
    },

    // You can throw errors.
    divide: (x: number, y: number) => {
        if (y === 0) { throw new Error('divide by zero??'); }
        return x / y;
    },

    // Your functions will be correctly type-checked when you call them.
    hello: (name: string) => { return `Hello ${name}`; },
};
```

We're going to make a Javascript proxy object that stands in for this Methods object but intercepts the calls and runs code on a distant computer.

```ts
// EXAMPLE CLIENT CODE

// The proxy object is a stand-in for the methods object,
// but it runs the functions on some other computer.
// You control the network details by providing a different
// evaluator (explained later).
let proxy = makeProxy(myMethods, evaluator);

// Call a function through the proxy.
let five = await proxy.addSlowly(2, 3);  // --> 5

// All methods have been made async
// to allow for networking to happen,
// even if they were defined as sync methods.
let doubled = await proxy.doubleSync(123);  // --> 456

// Typescript checks the types correctly.  This is an error:
let oops = await proxy.add(1, "hello");  // should be a number, not a string

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
Proxy object            Evaluator function
-----------------       ------------------
when a function
is called, turn
it into a Req   --Req-->
                        Given a Req object,
                        run the actual function
                        and make a Res object
                <--Res--
return the value
from the Res, or
throw the error
```

A proxy wraps around your `Methods` object and intercepts the function calls.

```ts
let proxy = makeProxy(myMethods, evaluator);
let five = await proxy.addSlowly(2, 3);
```

The Proxy converts the function call to a `Req` object like this:

```js
{
    "id": "123456789012345",  // a random string
    "method": "addSlowly",
    "args": [2, 3]
}
```

The proxy hands that to an `evaluator` function, whose job is to turn Requests into Responses by running the function.  It returns a `Res` object:

```js
{
    "id": "123456789012345",  // matches the request's id
    "result": 5
}
```

The proxy takes that `Res` and returns the value as normal to your local code.

## Error handling

If a method throws an error, the error is squished into a simple string in the format "ErrorName: message".  The stack trace is discarded.

```json
{
    "id": "123456789012345",
    "err": "TypeError: something went wrong",
}
```

...and when it arrives back to your local proxy, the error is thrown again in your local code.

If you have custom error classes, add them to the global singleton list of error classes.  Then your errors will be re-created as the correct class instead of the generic Error class:

```ts
import {
    ERROR_CLASSES
} from '@earthstar-project/mini-rpc';

export class MyCustomError extends Error {
    constructor(message?: string) {
        super(message);
        this.name = 'MyCustomError';
    }
}
ERROR_CLASSES.push(MyCustomError);

// Now, if your function throws a MyCustomError,
// you'll get back actual instances
// of MyCustomError instead of just Error.
```

## Extending this over a network

The key idea is that an `evaluator` function's job is to turn requests into responses.  It can do that by actually running the functions, or by reaching over the network and asking someone else to do it.

So you can make your own `evaluator` functions that act like plugins or middleware for different network transports, and you have to make a corresponding server for them to talk to.

Example:

* `http-client.ts` -- Defines a new `httpEvaluator` function which sends the `Req` over HTTP to a server, lets the server evaluate it, and gets a `Res` back.

* `http-server.ts` -- Run a HTTP server.  It accepts `Req` objects by POST, runs them through the normal `evaluator` function, and sends the `Res` back out.

Obviously both computers will need to have matching expectations about the `Methods` they're both trying to talk about.

> Note, these http examples were written with only the built-in node `http` library so they're verbose and intimidating, but they could be much shorter if we used something like `express`.

Remember we use `Req` and `Res` as the names for our JSON objects, not to be confused with typical HTTP terminology.

```
proxy object            httpEvaluator   |  http server     evaluator
-----------------       -------------   |  -----------     ---------
when a function                         |
is called, turn                         |
it into a Req   --Req-->                |
                        convert to JSON |
                        POST to server -|->
                                        |  handle POST
                                        |  parse JSON  -->
                                        |                  given Req,
                                        |                  run the
                                        |                  actual
                                        |                  function,
                                        |                  make Res.
                                        |  convert to JSON <---
                                        |  return over http
                        get http resp <-|-
                        parse JSON      | 
                <--Res--                | 
return the value                        |
from the Res, or                        |
throw the error                         |
                               (network | boundary)
```

To build a plugin for some kind of network, your job is to build the two middle columns of this diagram: a new evaluator function which sends/receives `Req` and `Res` objects over the network, and a network server or listener that runs the normal evaluator function.

# Demos

## HTTP demo 

To run it:

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

* **More plugins**: Build plugins for websockets, express, WebRTC data channels, duplex streams (for hyperswarm), other p2p protocols?

* **Error handling**: do we need to clarify when the error is from the RPC system (network problems, etc) vs. an error from the user-supplied method being called?

* **Specification**: describe the `Req` and `Res` JSON objects in more detail

# Out of scope

* **Encryption, Authentication**: this will be the job of network plugins

* **Binary data**: we're using JSON for network encoding.  If you have binary data, base64 encode it so it can become a JSON string.

* **Function manifests, Function versioning**: to find out what methods a server supports, just add a special function yourself that lists them.
