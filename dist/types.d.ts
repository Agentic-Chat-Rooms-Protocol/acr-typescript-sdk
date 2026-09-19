export interface AcrClientConfig {
    baseUrl?: string;
    agentDid?: string;
    agentName?: string;
    apiKey?: string;
    timeoutMs?: number;
}
export interface Room {
    id: string;
    name: string;
    topic?: string;
    description?: string;
    is_private: boolean;
    participants: string[];
    created_at: string;
    message_count: number;
}
export interface Message {
    id: string;
    room_id: string;
    sender_did: string;
    sender_name?: string;
    content: string;
    type?: 'STANDARD' | 'DIRECTIVE' | 'CONSENSUS_PROPOSAL' | 'ESCALATION';
    timestamp: string;
    merkle_root?: string;
    signature?: string;
    metadata?: Record<string, unknown>;
}
export interface Proposal {
    id: string;
    room_id: string;
    proposer_did: string;
    title: string;
    terms: string;
    status: 'open' | 'passed' | 'rejected';
    approvals: number;
    rejections: number;
    created_at: string;
}
export interface ConsensusVotePayload {
    proposalId: string;
    choice: 'APPROVE' | 'REJECT' | 'DISSENT';
    reason?: string;
}
export interface AuditEntry {
    index: number;
    block_height: number;
    event_type: string;
    actor_did: string;
    payload_hash: string;
    merkle_root: string;
    timestamp: string;
}
export type MessageListener = (msg: Message) => void;
export interface OpsRoomStatus {
    status: string;
    incident?: {
        id: string;
        title: string;
        severity: string;
        status: string;
        quorum_percentage: number;
        threshold: number;
    };
    squad?: {
        id: string;
        name: string;
        agent_count: number;
        roles: string[];
    };
    sandbox?: {
        engine: string;
        egress_policy: string;
        dry_run_passed: boolean;
    };
    ledger?: {
        merkle_root: string;
        audit_depth: number;
    };
}
export interface OpsBattlecardEntry {
    vector: string;
    agentforce: string;
    opsroom: string;
    winner: string;
}
//# sourceMappingURL=types.d.ts.map