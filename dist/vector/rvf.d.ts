/**
 * Standalone RVF Vector Memory Layout & LshIndex ANN Client
 *
 * Implements the agentbbs.rvf.v1 binary format specification and 64-hyperplane
 * sign random-projection approximate nearest neighbor search with exact cosine re-ranking.
 */
export interface RvfRecord {
    id: string;
    vector: number[];
    meta: Record<string, any>;
}
export interface RvfHit {
    id: string;
    score: number;
    meta: Record<string, any>;
}
export declare function cosineSimilarity(a: number[], b: number[], normA?: number): number;
export declare class RvfStore {
    readonly dim: number;
    private readonly _records;
    constructor(dim: number);
    get records(): readonly RvfRecord[];
    get length(): number;
    upsert(rec: RvfRecord): void;
    search(query: number[], topK?: number): RvfHit[];
    /**
     * Serializes the store to agentbbs.rvf.v1 binary format.
     */
    toBytes(): Uint8Array;
    /**
     * Deserializes an RvfStore from agentbbs.rvf.v1 binary data.
     */
    static fromBytes(data: Uint8Array): RvfStore;
}
export declare class LshIndex {
    readonly dim: number;
    private readonly planes;
    private readonly sigs;
    constructor(dim: number, planes: number[][], sigs: bigint[]);
    static build(store: RvfStore): LshIndex;
    computeSignature(v: number[]): bigint;
    search(store: RvfStore, query: number[], topK?: number, maxCandidates?: number): RvfHit[];
}
//# sourceMappingURL=rvf.d.ts.map