import { Chan } from 'concurrency-friends';

import { ChanPair, Message } from './types';

export let makeTransportLocal = (): [ChanPair<Message>, ChanPair<Message>] => {
    let pair1 = {
        inChan: new Chan<Message>(0),
        outChan: new Chan<Message>(0),
    };
    let pair2 = {
        inChan: pair1.outChan,
        outChan: pair1.inChan,
    };
    return [pair1, pair2];
}

