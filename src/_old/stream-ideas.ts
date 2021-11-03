import { logMain, sleep } from './lib/util';

let myFunctions = {
    // a sync function
    double: (x: number) => x * 2,
    // an async function
    doubleSlowly: async (x: number): Promise<number> => {
        await sleep(500);
        return x * 2;
    },
    // streams are represented as async iterators
    // TODO: how to end them?
    streamIntegers: async function* (interval: number, max: number) {
        for (let ii = 0; ii <= max; ii++) {
            if (ii > 5) {
                throw new Error("can't count higher than 5");
            }
            await sleep(interval)
            yield ii;
        }
    }
}

// json packets
interface PacketOneShot {
    result: any;
    error: null;
    done: true;
}
interface PacketMidStream {
    result: any;
    error: null;
    done: false;
}
interface PacketEndStream {
    result: null;
    error: null;
    done: true;
}
interface PacketError {
    result: null;
    error: string;
    done: true;
}
type Packet = PacketOneShot | PacketMidStream | PacketEndStream | PacketError;

// call a function by name (using the string of the function name...)
async function* call(fns: any, fnName: string, args: any[]): any {
    try {
        if (fnName.startsWith('stream')) {
            let iterator = fns[fnName](...args);
            for await (let item of iterator) {
                let packet: PacketMidStream = { result: item, error: null, done: false };
                yield packet;
            }
            let packet: PacketEndStream = { result: null, error: null, done: true };
            yield packet;
        } else {
            let result = await fns[fnName](...args);
            let packet: PacketOneShot = { result, error: null, done: true }
            yield packet;
        }
    } catch (e) {
        // errors in the stream get converted to JSON error packets
        let packet: PacketError = { result: null, error: `${e.name}: ${e.message}`, done: true };
        yield packet;
    }
}

let main = async () => {

    // we have to treat all calls as potential streams.
    // one-shot functions are just very short streams.

    logMain('-------- sync function --------');
    for await (let packet of call(myFunctions, 'double', [123])) {
        logMain(packet);
    }

    logMain('-------- async function --------');
    for await (let packet of call(myFunctions, 'doubleSlowly', [123])) {
        logMain(packet);
    }

    logMain('-------- stream (async iterator) --------');
    for await (let packet of call(myFunctions, 'streamIntegers', [333, 7])) {
        logMain(JSON.stringify(packet, null, 4));
    }

}
main();









/*
let isIterable = (obj: any): boolean => {
    // checks for null and undefined
    if (obj == null) { return false; }
    console.log('');
    console.log(obj.name);
    console.log(obj.constructor.name);
    console.log(typeof obj);
    for (let x of Object.getOwnPropertyNames(obj)) {
        console.log('    ', x);
    }
    for (let x of Object.getOwnPropertySymbols(obj)) {
        console.log('    ', x);
    }
    console.log(typeof obj[Symbol.iterator]);
    console.log(typeof obj[Symbol.asyncIterator]);
    console.log(obj[Symbol.iterator]);
    console.log(obj[Symbol.asyncIterator]);

    let GeneratorFunction = function* () {}.constructor;
    let AsyncFunction = async function () {}.constructor;
    let AsyncGeneratorFunction = async function* () {}.constructor;
    console.log(obj instanceof GeneratorFunction);
    console.log(obj instanceof AsyncFunction);
    console.log(obj instanceof AsyncGeneratorFunction);

    console.log(obj['next']);
    console.log(obj['throw']);

    return typeof obj[Symbol.iterator] === 'function';
}

console.log(isIterable(myFunctions.double));
console.log(isIterable(myFunctions.doubleSlowly));
console.log(isIterable(myFunctions.streamIntegers));
*/




/*
let logMain = console.log;
let logFn = console.log;


async function* countSlowly(interval: number, max: number) {
    logFn('fn: init');
    for (let ii = 0; ii <= max; ii++) {
        logFn('    fn: sleep');
        await sleep(interval)
        logFn('    fn: yield ' + ii);
        yield ii;
    }
    logFn('fn: done');
}


let main = async () => {
    logMain('main: creating function');
    let cs = countSlowly(333, 10);

    logMain('main: iterating');
    for await (const ii of cs) {
        logMain('    main: ' + ii);
    }

    logMain('main: done');
}

main();
*/

//