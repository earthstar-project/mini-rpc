import chalk = require('chalk');

// in fish shell, run like this:
// VERBOSE=true yarn start-client

export let log = console.log;
export let nop = (...args: any[]) => {};
if (process.env.VERBOSE) {
    nop = log;
}

// main is always printed
export let logMain =       (...args: any[]) => log(         chalk.black.bgWhite(     'main') + '        ', ...args);

// the rest are optional
export let logHandler =    (...args: any[]) => nop(' '   + chalk.black.bgCyanBright('handler') + '    ', ...args);
export let logEvaluator =  (...args: any[]) => nop('  ' + chalk.black.bgGreen(     'evaluator') + ' ', ...args);

export let logHttpServer = (...args: any[]) => nop(chalk.black.bgYellow('http server'), ...args);
export let logHttpClient = (...args: any[]) => nop(chalk.black.bgMagenta('http client'), ...args);

export let logTest =       (...args: any[]) => nop(chalk.black.bgWhite(  'test       '), ...args);
export let logTestMark =   (...args: any[]) => nop(chalk.black.bgWhite(  'test ') + chalk.black.bgGray(       'mark  '), ...args);
export let logTestLog =    (...args: any[]) => nop(chalk.black.bgWhite(  'test ') + chalk.black.bgGreenBright('log   '), ...args);
export let logTestExpect = (...args: any[]) => nop(chalk.black.bgWhite(  'test ') + chalk.black.bgRedBright(  'expect'), ...args);

//================================================================================

export let showError = (error: Error): void => {
    console.log(chalk.red('/') + ' class', error.constructor.name);
    console.log(chalk.red('|') + ' name', error.name);
    console.log(chalk.red('|') + ' message', error.message);
    console.log(chalk.red('\\') + ' stack', error.stack);
}

//================================================================================
// HELPERS

export let arrayToNumberedObject = (arr: any[]) => {
    // convert an array into an object like {'0': 'first item', '1': 'next item', ... }
    let result: {[k: string]: any} = {};
    for (let ii = 0; ii < arr.length; ii++) {
        result[ii] = arr[ii];
    }
    return result;
}
export let numberedObjectToArray = (obj: {[k: string]: any}): any[] => {
    // given an object with numbered keys starting at zero,
    // convert it into an array.
    // array slots that were not present in the input will be undefined.
    let arr = [];

    for (let key of Object.keys(obj)) {
        let index = +key;
        if (!isNaN(index)) {
            arr[index] = obj[key];
        }
    }
    // fill in empty slots with actual undefineds
    for (let ii = 0; ii < arr.length; ii++) {
        arr[ii] = arr[ii];
    }

    return arr;
}

export let sleep = async (ms : number) : Promise<void> => {
    return new Promise((resolve, reject) => {
        setTimeout(resolve, ms);
    });
}

// inclusive of endpoints
export let randInt = (lo: number, hi: number): number => 
    lo + Math.floor(Math.random() * (hi-lo));

export let makeId = (): string =>
    ('' + randInt(0, 999999999999999)).padStart(15, '0');
