import { ERROR_CLASSES } from '../lib/mini-rpc';
import { sleep } from '../lib/util';

//================================================================================
// custom errors

// A custom error class for testing
export class MyError extends Error {
    constructor(message?: string) {
        super(message);
        this.name = 'MyError';
    }
}
// This one is not put into ERROR_CLASSES
export class MyError2 extends Error {
    constructor(message?: string) {
        super(message);
        this.name = 'MyError2';
    }
}
ERROR_CLASSES.push(MyError);

//================================================================================
// example object-of-functions

export let myFunctions = {
    identity: (x: any) => { return x; },
    identity2: (x: any, y: any) => { return [x, y]; },
    returnUndefined: () => {},
    ok0: () => { return 'ok'; },
    ok1: (x: any) => { return 'ok'; },
    ok2: (x: any, y: any) => { return 'ok'; },
    doubleSync: (x: number) => { return x * 2; },
    doubleAsync: async (x: number) => { return x * 2; },
    add: (x: number, y: number) => { return x + y; },
    addSlowly: async (x: number, y: number) => {
        await sleep(1000);
        return x + y;
    },
    divide: async (x: number, y: number) => {
        if (y === 0) { throw new MyError('divide by zero'); }
        return x / y;
    },
    hello: (name: string) => { return `Hello ${name}`; },
    throwMyError: () => { throw new MyError('text of error'); },
    throwMyError2: () => { throw new MyError2('text of error2'); },
    generator0: async function* () {
        for (let ii = 0; ii <= 999; ii++) {
              if (ii > 5) {
                break;
              }
              await sleep(100);
              yield ii;
            }
    },
    generator1: async function* (max: number) {
        for (let ii = 0; ii <= max; ii++) {
              if (ii > 5) {
                break;
              }
              await sleep(100);
              yield ii;
            }
    },
    generator2: async function* (max: number, limit: number) {
        for (let ii = 0; ii <= max; ii++) {
              if (ii > limit) {
                break;
              }
              await sleep(100);
              yield ii;
            }
    },
    generatorError: async function* () {
        for (let ii = 0; ii <= 999; ii++) {
              if (ii > 5) {
                throw new MyError("can't count higher than 5");
              }
              await sleep(100);
              yield ii;
            }
    },
};

export class MyClass {
    classVar: number = 123;

    constructor() {}

    getClassVar() { return this.classVar; }

    identity(x: any) { return x; }
    identity2(x: any, y: any) { return [x, y]; }
    returnUndefined() {}
    ok0() { return 'ok'; }
    ok1(x: any) { return 'ok'; }
    ok2(x: any, y: any) { return 'ok'; }
    doubleSync(x: number) { return x * 2; }
    async doubleAsync(x: number) { return x * 2; }
    add(x: number, y: number) { return x + y; }
    async addSlowly(x: number, y: number) {
        await sleep(1000);
        return x + y;
    }
    async divide (x: number, y: number) {
        if (y === 0) { throw new MyError('divide by zero'); }
        return x / y;
    }
    hello(name: string) { return `Hello ${name}`; }
    throwMyError() { throw new MyError('text of error'); }
    throwMyError2() { throw new MyError2('text of error2'); }
    
    async * generator0 () {
        for (let ii = 0; ii <= 999; ii++) {
              if (ii > 5) {
                break;
              }
              await sleep(100);
              yield ii;
            }
    }
    async * generator1 (max: number) {
        for (let ii = 0; ii <= max; ii++) {
              if (ii > 5) {
                break;
              }
              await sleep(100);
              yield ii;
            }
    }
    async * generator2 (max: number, limit: number) {
        for (let ii = 0; ii <= max; ii++) {
              if (ii > limit) {
                break;
              }
              await sleep(100);
              yield ii;
            }
    }
    async * generatorError () {
        for (let ii = 0; ii <= 999; ii++) {
              if (ii > 5) {
                throw new MyError("can't count higher than 5");
              }
              await sleep(100);
              yield ii;
            }
    }
};
