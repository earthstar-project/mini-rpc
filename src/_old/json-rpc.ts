
// Provided for comparison only: JSON-RPC format
// This is not used in the code anywhere.
// Compare this with our Req and Res types at the top
// of mini-rpc.ts.

// https://www.jsonrpc.org/specification

export interface JsonRpcRequest {
    jsonrpc: '2.0',
    method: string,
    params?: any[] | Record<string, any>, // array or object of params

    // id numbers must not be floats.
    // avoid null.
    // no id means this is a "notification" e.g. server sends no response.
    id?: string | number | null,
};

interface JsonRpcResponseSuccess {
    jsonrpc: '2.0',
    result: any;
    id: string | number | null,
}
interface JsonRpcResponseError {
    jsonrpc: '2.0',
    error: {
        code: number,  // integer only; some reserved values
        message: string,
        data: any,
    }
    id: string | number | null,
}
type JsonRpcResponse = JsonRpcResponseSuccess | JsonRpcResponseError
