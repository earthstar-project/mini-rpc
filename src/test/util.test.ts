import test = require('tape');

import {
    makeId,
    randInt,
} from '../lib/util';

//================================================================================

test('randInt', async (t: any) => {
    let passed = true;
    for (let ii = 0; ii < 1000; ii++) {
        let n = randInt(3, 5);
        if (n < 3 || n > 5) { passed = false; }
    }
    t.ok(passed, 'randInt range is inclusive of endpoints');
    t.end();
});

test('makeId', async (t: any) => {
    let passed = true;
    for (let ii = 0; ii < 1000; ii++) {
        if (makeId().length !== 18) { passed = false; }
    }
    t.ok(passed, 'makeId is always 18 characters long');
    t.end();
});
