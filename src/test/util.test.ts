import t = require('tap');
//t.runOnly = true;

import {
    arrayToNumberedObject,
    numberedObjectToArray,
    makeId,
    randInt,
} from '../lib/util';

//================================================================================

t.test('randInt', async (t: any) => {
    let passed = true;
    for (let ii = 0; ii < 1000; ii++) {
        let n = randInt(3, 5);
        if (n < 3 || n > 5) { passed = false; }
    }
    t.ok(passed, 'randInt range is inclusive of endpoints');
    t.done();
});

t.test('makeId', async (t: any) => {
    let passed = true;
    for (let ii = 0; ii < 1000; ii++) {
        if (makeId().length !== 15) { passed = false; }
    }
    t.ok(passed, 'makeId is always 15 characters long');
    t.done();
});

t.test('arrayToNumberedObject', async (t: any) => {
    t.deepEqual(arrayToNumberedObject([]), {}, 'empty');

    t.deepEqual(
        arrayToNumberedObject(['a', 'b', 'c']),
        {'0': 'a', '1': 'b', '2': 'c'},
        'three items'
    );

    t.deepEqual(
        arrayToNumberedObject(['a', undefined, 'c']),
        {'0': 'a', '1': undefined, '2': 'c'},
        'three items with undefined'
    );

    t.done();
});

t.test('numberedObjectToArray', async (t: any) => {
    t.deepEqual(numberedObjectToArray({}), [], 'empty');

    t.deepEqual(
        numberedObjectToArray({'0': 'a', '1': 'b', '2': 'c'}),
        ['a', 'b', 'c'],
        'three items',
    );

    t.deepEqual(
        numberedObjectToArray({'0': 'a', '1': undefined, '2': 'c'}),
        ['a', undefined, 'c'],
        'three items with undefined',
    );

    let objMissingInMiddle = {'0': 'a', '2': 'c'};
    let arrMissingInMiddle = numberedObjectToArray(objMissingInMiddle);
    t.deepEqual(arrMissingInMiddle, ['a', undefined, 'c'],
        'empty slots get filled with undefined (direct check)');
    t.deepEqual(Object.keys(arrMissingInMiddle), ['0', '1', '2'],
        'empty slots get filled with undefined (keys)');
    t.deepEqual(Object.values(arrMissingInMiddle), ['a', undefined, 'c'],
        'empty slots get filled with undefined (values)');
    t.deepEqual(arrMissingInMiddle.length, 3, 'array length = 3');

    let objUndefinedAtEnd = {'0': 'a', '1': 'b', '2': undefined};
    let arrUndefinedAtEnd = numberedObjectToArray(objUndefinedAtEnd);
    t.deepEqual(arrUndefinedAtEnd, ['a', 'b', undefined]);
    t.deepEqual(Object.keys(arrUndefinedAtEnd), ['0', '1', '2']);
    t.deepEqual(Object.values(arrUndefinedAtEnd), ['a', 'b', undefined]);
    t.deepEqual(arrUndefinedAtEnd.length, 3);

    t.done();
});
