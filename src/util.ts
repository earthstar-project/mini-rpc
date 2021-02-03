import chalk = require('chalk');

export let nop = (...args: any[]) => {};
export let log = nop; //console.log;

export let logMain =       (...args: any[]) => log(         chalk.black.bgWhite(     'main') + '        ', ...args);
export let logHandler =    (...args: any[]) => log(' '   + chalk.black.bgCyanBright('handler') + '    ', ...args);
export let logEvaluator =  (...args: any[]) => log('  ' + chalk.black.bgGreen(     'evaluator') + ' ', ...args);

export let logTest =       (...args: any[]) => log(chalk.black.bgWhite(  'test       '), ...args);
export let logTestMark =   (...args: any[]) => log(chalk.black.bgWhite(  'test ') + chalk.black.bgGray(       'mark  '), ...args);
export let logTestLog =    (...args: any[]) => log(chalk.black.bgWhite(  'test ') + chalk.black.bgGreenBright('log   '), ...args);
export let logTestExpect = (...args: any[]) => log(chalk.black.bgWhite(  'test ') + chalk.black.bgRedBright(  'expect'), ...args);

export let logHttpServer = (...args: any[]) => log(chalk.black.bgYellow('http server'), ...args);
export let logHttpClient = (...args: any[]) => log(chalk.black.bgMagenta('http client'), ...args);

//================================================================================
// HELPERS

export let sleep = async (ms : number) : Promise<void> => {
    return new Promise((resolve, reject) => {
        setTimeout(resolve, ms);
    });
}

export let randInt = (lo: number, hi: number): number => 
    lo + Math.floor(Math.random() * hi-lo);

export let makeId = (): string =>
    ('' + randInt(0, 999999999999999)).padStart(15, '0');
