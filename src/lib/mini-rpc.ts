import {
    isGenerator,
    logEvaluator,
    logHandler,
    makeId,
} from './util';

//================================================================================
// TYPES

// Each method call makes a Request object (officially called Req in the code).
// It has a random unique ID, the name of the method, and a list of arguments.
export interface Req {
    id: string,
    method: string,
    args: any[],
}

// Each Request will create one or many packets as a response.
// Each packet has a matching id and can return a result, an error,
// and has a property indicating that it could be the last packet of the series.
// The error is a node Error class that's been squashed down to a regular JSON-friendly
// object (see errToObj).

interface PacketOneShot {
  id: string;
  result: any;
  error: null;
  done: true;
}

interface PacketMidStream {
  id: string;
  result: any;
  error: null;
  done: false;
}

interface PacketEndStream {
  id: string;
  result: null;
  error: null;
  done: true;
}

interface PacketError {
  id: string;
  result: null;
  error: string;
  done: true;
}
    
type Packet =
    | PacketOneShot
    | PacketMidStream
    | PacketEndStream
    | PacketError;

//================================================================================
// UNDEFINED

// Important rules about undefined:
// --------------------------------
// Don't use undefined anywhere in the arguments or return values of
// your functions.  Use null instead.
// Reason: Undefined can't survive a round-trip through JSON.
// Exception: a method can return undefined, since that's such a common case,
//  so we've made sure it works end-to-end.
// But don't return [1, 2, undefined] or {a: undefined} or anything like that.
// If you use undefined as one of the method arguments, an error will be thrown.
// We don't currently do a deep inspection for deeply nested undefined, so
// be careful.

// The error thrown when you use undefined as a method argument
export class UndefinedNotAllowedError extends Error {
    constructor(message?: string) {
        super(message);
        this.name = 'UndefinedNotAllowed';
    }
}

//================================================================================
// ERRORS

// To keep things interoperable across languages, errors are converted
// to strings in the basic format "ErrorClass: message".
// Stack traces are not preserved.

// Push your custom error classes into this list
// and they will be used when deserializing Res objects
// back into actual Error instances.
// This is a global singleton.
// Error classes that are not in this list will end up as
// base Error instances.
export let ERROR_CLASSES: any[] = [
    EvalError,
    RangeError,
    ReferenceError,
    SyntaxError,
    TypeError,
    URIError,
];

// Convert node Error to a plain string like "TypeError: something went wrong"
export let errorToString = (error: Error): string => {
    if (error.message) {
        return `${error.name}: ${error.message}`;
    } else {
        return error.name
    }
}

// Convert string like "TypeError: something went wrong" back to an actual Error instance.
// If it's in the ERROR_CLASSES list, it will be an actual instance of that kind of class.
export let stringToError = (s: string): Error => {
    let [name, message] = s.split(': ');
    // instantiate an error with a custom class if one is found, otherwise
    // use the base Error class
    let error = new Error();
    let matched = false;
    for (let errorClass of ERROR_CLASSES) {
        if (errorClass.name === name) {
            logHandler('        matched a custom error class');
            matched = true;
            error = new errorClass();
            break;
        }
    }
    if (!matched) {
            logHandler('        did not match a custom error class');
    }
    error.name = name
    if (message) { error.message = message; }
    return error;
}

//================================================================================

// Transforms an object-of-functions or class instance + Request
// into an generator of packets (see above).
// If the called method is a generator itself, 
export async function* evaluator(functions: any, req: Req): AsyncGenerator<Packet> {
  const fn = functions[req.method];
 

  try {
     // If the called method is a generator itself,
     // We expect to return many packets.
    if (isGenerator(fn)) {
      const iterator = fn.call(functions, ...req.args);
      for await (const item of iterator) {
        const packet: PacketMidStream = {
          id: req.id,
          result: item,
          error: null,
          done: false,
        };
        yield packet;
      }
      // Return a packet indicating the stream is done.
      const packet: PacketEndStream = {
        id: req.id,
        result: null,
        error: null,
        done: true,
      };
      yield packet;
    } else {
      // If the called method is not a generator,
      // We should only return one packet.
      const result = await fn.call(functions, ...req.args);
      const packet: PacketOneShot = {
        id: req.id,
        result,
        error: null,
        done: true,
      };
      yield packet;
    }
  } catch (e) {
    // Errors in the stream get converted to JSON error packets
    const packet: PacketError = {
      id: req.id,
      result: null,
      error: `${e.name}: ${e.message}`,
      done: true,
    };
    yield packet;
  }
}
export type EvaluatorFn = typeof evaluator;

let checkArgs = (...args: any[]) => {
    // We don't allow undefined function arguments because it's hard to
      // safely round-trip them through JSON.
      // TODO: we should inspect the args more deeply to check for undefined lurking in an array or something
    if (args.includes(undefined)) {
        throw new UndefinedNotAllowedError(
          `mini-rpc won't let you use undefined as a function argument.  Use null, if you can.`,
        );
      }
}

// Make a proxy around a object-of-functions or class instance, and an evaluator function.
// This proxy converts the call to a Req, evaluates it
// using the evaluator generator to get a series of packets,
// And turns those into a regular result, an async generator, or an error
// if there is one.
export let makeProxy = <Fns>(functions: Fns, evaluator: EvaluatorFn): Fns => {
  const handler = {
    get: function (target: any, prop: any, receiver: any) {
      // If the called method is a generator itself,
      // We need to return a new async generator.
      if (isGenerator(target[prop])) {
        async function* generator(...args: any[]): AsyncGenerator<any> {
          logHandler(`calling ${prop}(${args})`);

          checkArgs(...args)

          const req: Req = {
            id: makeId(),
            method: prop,
            args,
          };
          
          logHandler("    req:", req);
          logHandler("    evaluating...");
  

          for await (const packet of evaluator(functions, req)) {
            logHandler(`    ...got new result for ${req.id}:`, packet);
            
            

            if (packet.error) {
              logHandler(" ~ ~ ~> ", packet.error);
              logHandler("      > reconstructing error and throwing it");
              const error = stringToError(packet.error);
            
              throw error;
            }

            if (packet.done) {
                logHandler(`    ${req.id} finished evaluating`);
              break;
            }

            yield packet.result;
          }
        }

        return generator;
      }

      return async (...args: any[]): Promise<any> => {
        console.log(`calling ${prop}(${args})`);

        checkArgs(...args);

        const req: Req = {
          id: makeId(),
          method: prop,
          args,
        };
        
        logHandler("    req:", req);
        logHandler("    evaluating...");

        for await (const packet of evaluator(functions, req)) {
          logHandler("    ...done evaluating, res is:", packet);

          if (packet.error) {
            logHandler(" ~ ~ ~> ", packet.error);
            logHandler("      > reconstructing error and throwing it");
            const error = stringToError(packet.error);
            throw error;
          }

          return packet.result;
        }
      };
    },
  };
  return new Proxy(functions, handler) as Fns;
}
