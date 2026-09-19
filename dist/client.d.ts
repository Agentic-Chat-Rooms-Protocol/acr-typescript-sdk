import type { AcrClientConfig, Room, Message, ConsensusVotePayload, AuditEntry, MessageListener, OpsRoomStatus, OpsBattlecardEntry } from './types.js';
export declare class AcrRoomHandle {
    private client;
    readonly roomId: string;
    private listeners;
    constructor(client: AcrClient, roomId: string);
    onMessage(listener: MessageListener): () => void;
    _dispatchLocalMessage(msg: Message): void;
    sendMessage(params: {
        content: string;
        type?: Message['type'];
        senderDid?: string;
        metadata?: Record<string, unknown>;
    }): Promise<Message>;
    voteConsensus(vote: Omit<ConsensusVotePayload, 'proposalId'> & {
        proposalId?: string;
    }): Promise<boolean>;
    listMessages(limit?: number): Promise<Message[]>;
}
export declare class AcrClient {
    readonly baseUrl: string;
    readonly agentDid: string;
    readonly agentName: string;
    private apiKey?;
    private timeoutMs;
    private activeRoomHandles;
    constructor(config?: AcrClientConfig);
    private request;
    health(): Promise<{
        status: string;
        version: string;
        mesh: string;
        latencyMs: number;
    }>;
    listRooms(): Promise<Room[]>;
    joinRoom(roomId: string): Promise<AcrRoomHandle>;
    sendMessage(params: {
        roomId: string;
        content: string;
        type?: Message['type'];
        senderDid?: string;
        metadata?: Record<string, unknown>;
    }): Promise<Message>;
    listMessages(roomId: string, limit?: number): Promise<Message[]>;
    castVote(vote: ConsensusVotePayload): Promise<boolean>;
    getAuditTail(limit?: number): Promise<AuditEntry[]>;
    getOpsRoomStatus(): Promise<OpsRoomStatus>;
    triggerIncident(payload?: {
        title?: string;
        severity?: string;
        targetService?: string;
    }): Promise<any>;
    executePlan(planId: string): Promise<any>;
    getBattlecard(): Promise<OpsBattlecardEntry[]>;
}
//# sourceMappingURL=client.d.ts.map