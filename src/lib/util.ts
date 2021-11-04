import chalk = require('chalk');

//================================================================================
// LOGGING

// in fish shell, run like this:
// VERBOSE=true yarn start-client

export let log = console.log;
export let nop = (...args: any[]) => {};
if (process.env.VERBOSE === 'true') {
    nop = log;
}

export let logMain =      (...args: any[]) => log('' + chalk.black.bgWhite(        'main') + '          ', ...args);
export let logProxy  =    (...args: any[]) => nop(' ' + chalk.black.bgMagenta( 'proxy') + '       ', ...args);
export let logClient =    (...args: any[]) => nop(' ' + chalk.black.bgYellowBright( 'client') + '       ', ...args);
export let logTransport = (...args: any[]) => nop('  ' + chalk.black.bgCyanBright(   'transport') + '   ', ...args);
export let logServer =    (...args: any[]) => nop('            ' + chalk.black.bgYellow(       'server') + '    ', ...args);
export let logThread =    (...args: any[]) => nop('             ' + chalk.black.bgYellowBright(         'thread') + '   ', ...args);
export let logFunction =  (...args: any[]) => nop('              ' + chalk.black.bgGrey(         'fn') + '      ', ...args);

//================================================================================
// HELPERS

export interface Deferred<T> {
    resolve: (value: T | PromiseLike<T>) => void,
    reject: (reason?: any) => void,
    promise: Promise<T>,
}

export let makeDeferred = <T>(): Deferred<T> => {
    let def: any = {};
    def.promise = new Promise<T>((resolve, reject) => {
        def.resolve = resolve;
        def.reject = reject;
    });
    return def as Deferred<T>;
}

export let sleep = async (ms : number) : Promise<void> =>
    new Promise((resolve, reject) => setTimeout(resolve, ms));

// inclusive of endpoints
export let randInt = (lo: number, hi: number): number => 
    lo + Math.floor(Math.random() * (hi-lo));

export let makeId = (): string =>
    ('' + randInt(0, 999999999999999)).padStart(18, '0');
