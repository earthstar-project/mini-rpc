import {
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

// Each request will make one corresponding Response (officially called Res in the code).
// It has as matching id and either a result or an error.
// The error is a node Error class that's been squashed down to a regular JSON-friendly
// object (see errToObj).
export interface Res {
    id: string,
    result?: any,  // either a result will be present...
    err?: string,  // or an error.
}

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

// This basic proxy wraps around a object-of-functions or a class instance.
// It intercepts calls to the functions, runs the functions,
// and returns the results as promises.
// This essentually does nothing but is useful as an educational starting point.
// It never even creates Req or Res objects.
// Don't use this in production :)
let makeSimpleProxy = <Fns>(functions: Fns) : Fns => {
    let handler = {
        get: function(target: any, prop: any, receiver: any) {
            return async (...args: any[]): Promise<any> => {
                logHandler(`calling ${prop}(${args})`);
                let fn = target[prop]
                let result = await fn(...args);
                logHandler(' -->', result);
                return result;
            }
        }
    };
    return new Proxy(functions, handler) as Fns;
}

//================================================================================

// Given a object-of-functions or class instance, and a specific Request,
// exectute the request by calling the corresponding method.
// Return a Response containing the result, or a Response containing an error.
// This is always an async function no matter if the underlying method
// is async or not.
export let evaluator = async (functions: any, req: Req): Promise<Res> => {
    let fn = functions[req.method];
    if (fn === undefined) {
        // rpc user error: bad method name
        let err = new Error(`unknown RPC method: ${JSON.stringify(req.method)}`);
        logEvaluator(err.message);
        return {
            id: req.id,
            err: errorToString(err),
        };
    }
    try {
        logEvaluator(`calling ${JSON.stringify(req.method)}...`);
        // call the function.
        // we need to make sure "this" is correctly handled, since we've extracted
        // the fn from its context.
        // 3 equivalent ways of doing it:
        //    * up above, let fn = functions[req.method].bind(functions)
        //    * here, fn.call(functions, ...req.args)
        //    * here, functions[req.method](...req.args)
        let result = await fn.call(functions, ...req.args);
        logEvaluator(`called  ${JSON.stringify(req.method)}... complete`);
        return {
            id: req.id,
            result: result,
        };
    } catch (error) {
        // userland error: the method itself threw an error.
        logEvaluator(`the ${JSON.stringify(req.method)} method threw an error:`, error.message);
        //showError(error);
        return {
            id: req.id,
            err: errorToString(error),
        };
    }
}
type EvaluatorFn = typeof evaluator;

// Make a proxy around a object-of-functions or class instance, and an evaluator function.
// This proxy converts the call to a Req, evaluates it
// using the evaluator function to get a Res, then converts the
// Res back into a regular return value or throws the error
// if there is one.
export let makeProxy = <Fns>(functions: Fns, evaluator: EvaluatorFn) : Fns => {
    let handler = {
        get: function(target: any, prop: any, receiver: any) {
            return async (...args: any[]): Promise<any> => {
                logHandler(`calling ${prop}(${args})`);

                // We don't allow undefined function arguments because it's hard to
                // safely round-trip them through JSON.
                // TODO: we should inspect the args more deeply to check for undefined lurking in an array or something
                if (args.includes(undefined)) {
                    throw new UndefinedNotAllowedError(`In call to ${prop}: mini-rpc won't let you use undefined as a function argument.  Use null, if you can.`);
                } 

                let req: Req = {
                    id: makeId(),
                    method: prop,
                    args,
                }
                logHandler('    req:', req);

                logHandler('    evaluating...');
                let res: Res = await evaluator(functions, req);
                logHandler('    ...done evaluating, res is:', res);

                if (res.err) {
                    logHandler(' ~ ~ ~> ', res.err);
                    logHandler('      > reconstructing error and throwing it');
                    let error = stringToError(res.err);
                    //showError(error);
                    throw error;
                } else {
                    // We allow undefined as a result since it's so common for a function to not return anything.
                    // TODO: we should inspect the return value more deeply to check for undefined lurking in an array or something,
                    // and throw an error if that happens.

                    // If the 'result' property is undefined and it's been JSON-roundtripped, the property will go away,
                    // so let's restore it:
                    if (! ('result' in res)) {
                        res.result = undefined;
                    }
                    logHandler('    -->', res.result);
                    return res.result;
                }
            }
        }
    };
    return new Proxy(functions, handler) as Fns;
}
