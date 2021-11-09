import { Chan } from 'concurrency-friends';
import { z } from 'zod';

export type Thunk = () => void;

export interface Obj {}

export interface Fns {
    [name: string]: (...args: any[]) => any,
}

//================================================================================
// client-sent packets

export const PacketRequest = z.object({
    kind: z.literal('REQUEST'),
    id: z.string().min(5).max(256),
    method: z.string().min(1).max(128),
    args: z.array(z.any()),
});

export const PacketStartStream = z.object({
    kind: z.literal('START_STREAM'),
    id: z.string().min(5).max(256),
    method: z.string().min(1).max(128),
    args: z.array(z.any()),
});

export const PacketCancelStream = z.object({
    kind: z.literal('CANCEL_STREAM'),
    id: z.string().min(5).max(256),
});

export const ClientPacket =
    PacketRequest
    .or(PacketStartStream)
    .or(PacketCancelStream);

export type PacketRequest = z.infer<typeof PacketRequest>;
export type PacketStartStream = z.infer<typeof PacketStartStream>;
export type PacketCancelStream = z.infer<typeof PacketCancelStream>;
export type ClientPacket = z.infer<typeof ClientPacket>;

//================================================================================
// server-sent packets

export const PacketResponse = z.object({
    // response to a PacketRequest from the client
    kind: z.literal('RESPONSE'),
    id: z.string().min(5).max(256),
    data: z.any(),
});

export const PacketStreamStarted = z.object({
    kind: z.literal('STREAM_STARTED'),
    id: z.string().min(5).max(256),
});

export const PacketStreamData = z.object({
    kind: z.literal('STREAM_DATA'),
    id: z.string().min(5).max(256),
    data: z.any(),
});

export const PacketStreamEnded = z.object({
    // stream ended naturally
    kind: z.literal('STREAM_ENDED'),
    id: z.string().min(5).max(256),
});

export const PacketStreamCancelled = z.object({
    // stream was cancelled by client
    kind: z.literal('STREAM_CANCELLED'),
    id: z.string().min(5).max(256),
});

export const PacketError = z.object({
    kind: z.literal('ERROR'),
    id: z.string().min(5).max(256),
    error: z.string(),
});

export const ServerPacket =
    PacketResponse
    .or(PacketStreamStarted)
    .or(PacketStreamData)
    .or(PacketStreamEnded)
    .or(PacketStreamCancelled)
    .or(PacketError);

export type PacketResponse = z.infer<typeof PacketResponse>;
export type PacketStreamStarted = z.infer<typeof PacketStreamStarted>;
export type PacketStreamData = z.infer<typeof PacketStreamData>;
export type PacketStreamEnded = z.infer<typeof PacketStreamEnded>;
export type PacketStreamCancelled = z.infer<typeof PacketStreamCancelled>;
export type PacketError = z.infer<typeof PacketError>;
export type ServerPacket = z.infer<typeof ServerPacket>;

//================================================================================

export type CONNECTION_STATUS = 
    'ERROR'
    | 'CLOSED'
    | 'CONNECTING'
    | 'OPEN'

export interface ITransport {
    status(): CONNECTION_STATUS,
    send(packet: Obj): Promise<void>,
    onReceive(cb: (packet: Obj) => Promise<void>): Thunk,  // thunk to remove callback
    close(): void,
}

export interface IRpcClient {
    request(method: string, ...args: any[]): Promise<PacketResponse | PacketError>,
    startStream(method: string, ...args: any[]): { chan: Chan<ServerPacket>, cancelStream: () => Promise<void> },
}

export interface IRpcServer {
    onRequest(cb: (method: string, args: any[]) => Promise<any>): Thunk;  // thunk to remove callback
    onStartStream(cb: (method: string, args: any[]) => Promise<any>): Thunk;  // thunk to remove callback
}
