type Thunk = () => void;

export class Atom<T> {
    val : T;
    callbacksSync : ((val : T)=>void)[];
    callbacksNextTick : ((val : T)=>void)[];
    //callbacksBlockingAsync : ((val : T)=>Promise<void>)[];
    constructor(val : T) {
        this.val = val;
        this.callbacksSync = [];
        this.callbacksNextTick = [];
        //this.callbacksBlockingAsync = [];
    }
    subscribeSync(cb : (val : T) => void) : Thunk {
        this.callbacksSync.push(cb);
        let unsub = () => {
            this.callbacksSync = this.callbacksSync.filter(c => c != cb);
        };
        return unsub;
    }
    subscribeNextTick(cb : (val : T) => void) : Thunk {
        this.callbacksNextTick.push(cb);
        let unsub = () => {
            this.callbacksNextTick = this.callbacksNextTick.filter(c => c != cb);
        };
        return unsub;
    }
    //subscribeBlockingAsync(cb : (val : T) => Promise<void>) : () => void {
    //    let unsub = () => {
    //        this.callbacksBlockingAsync = this.callbacksBlockingAsync.filter(c => c != cb);
    //    };
    //    return unsub;
    //}
    setAndNotify(val : T) : void {  // would be async
        if (val !== this.val) {
            this.val = val;
            this.notify();
        }
    }
    setQuietly(val : T) : void {
        this.val = val;
    }
    notify() : void {
        for (let cb of this.callbacksSync) {
            cb(this.val);
        }
        for (let cb of this.callbacksNextTick) {
            process.nextTick(() => cb(this.val));
        }
        //for (let cb of this.callbacksBlockingAsync) {
        //    await cb(val);
        //}
    }
    get() : T {
        return this.val;
    }
}

