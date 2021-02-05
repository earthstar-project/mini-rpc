/*
function getAllPropertyNames(obj: any): string[] {
    let result = new Set<string>();
    while (obj) {
        Object.getOwnPropertyNames(obj).forEach((p: string) => result.add(p));
        obj = Object.getPrototypeOf(obj);
    }
    return [...result];
}

let commonKeys = ['stack', 'message', 'name'];

export let flattenError = (error: Error): any => {
    var flat: any = {};
    let keys = Object.getOwnPropertyNames(error).concat(commonKeys);
    //let keys = getAllPropertyNames(error);
    //console.log(keys);
    keys.forEach((k: string) => {
        flat[k] = (error as any)[k];
    });
    return flat;
}

export let restoreError = (flat: any, customErrors: any[] = []): Error => {
    let e = new Error();
    for (let customError of customErrors) {
        if (customError.name === flat.name) {
            e = new customError(e.message);
        }
    }

    for (let [k,v] of Object.entries(flat)) {
        (e as any)[k] = v;
    }
    return e;
}

//================================================================================

// A custom error class for testing
export class MyCustomError extends Error {
    constructor(message?: string) {
        super(message);
        this.name = 'MyCustomError';
    }
}
let customErrors: any[] = [
    MyCustomError,
];

let error = new MyCustomError('the message is here');
let flat = flattenError(error);
let error2 = restoreError(flat, customErrors);
let flat2 = flattenError(error2);
console.log(`constructor: ${error.constructor.name}`);
console.log(`name: ${error.name}`);
console.log(error);
console.log();
console.log();
console.log(flat);
console.log();
console.log();
console.log(`constructor: ${error2.constructor.name}`);
console.log(`name: ${error2.name}`);
console.log(error2);
console.log();
console.log();
console.log(flat2);




*/