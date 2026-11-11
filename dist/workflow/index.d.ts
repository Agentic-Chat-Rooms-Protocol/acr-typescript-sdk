/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 *
 * Provenance: Lifted from `google/adk-js` (commit `8dad457`, v2.4.0)
 * `core/src/workflow/node_status.ts`, `branch_path.ts`, `graph.ts`,
 * `utils/graph_parser.ts`, and `utils/graph_validation.ts`.
 * Zero-dependency client-side graph topology builder & validator for `@acr-js/sdk`.
 */
export declare enum NodeStatus {
    INACTIVE = 0,
    PENDING = 1,
    WAITING = 2,
    RUNNING = 3,
    COMPLETED = 4,
    FAILED = 5,
    CANCELLED = 6,
    RECONCILING = 7,
    OUTCOME_UNKNOWN = 8
}
export declare class BranchPath {
    readonly segments: readonly string[];
    constructor(segments?: readonly string[]);
    get isEmpty(): boolean;
    append(segment: string): BranchPath;
    toString(): string;
}
export declare function branchPathFromString(raw?: string): BranchPath;
export declare function createSubBranch(parentBranch: string | undefined, node: {
    name: string;
    runId?: string;
}): string;
export declare function commonPrefixOf(branches: readonly string[]): string | undefined;
export type RouteValue = boolean | number | string;
export declare const DEFAULT_ROUTE = "__DEFAULT__";
export declare const DEFAULT = "__DEFAULT__";
export declare const OUTCOME_UNKNOWN_ROUTE = "__OUTCOME_UNKNOWN__";
export interface GraphNodeDescriptor {
    readonly name: string;
    readonly requiresAllPredecessors?: boolean;
    readonly sideEffecting?: boolean;
}
export declare const START: GraphNodeDescriptor;
export type SdkNodeLike = GraphNodeDescriptor | string;
export type SdkRoutingMap = Record<string | number, SdkNodeLike | readonly SdkNodeLike[]>;
export type SdkChainElement = SdkNodeLike | readonly SdkNodeLike[] | SdkRoutingMap;
export type SdkEdgeItem = SdkEdge | SdkChainElement[];
export declare class SdkEdge {
    readonly fromNode: GraphNodeDescriptor;
    readonly toNode: GraphNodeDescriptor;
    readonly route: RouteValue | RouteValue[] | null;
    constructor(fromNode: GraphNodeDescriptor, toNode: GraphNodeDescriptor, route?: RouteValue | RouteValue[] | null);
}
export declare function parseSdkEdgeItems(items: SdkEdgeItem[]): SdkEdge[];
export declare function detectUnconditionalCycles(edges: SdkEdge[], nodeNames: Set<string>): void;
export declare function validateSdkGraph(nodes: GraphNodeDescriptor[], edges: SdkEdge[]): Set<string>;
export type ExecutionAuthorityLevel = 'NONE' | 'QUORUM_ELEVATED' | 'CONSENT_ELEVATED' | 'SYSTEM';
export declare const EXECUTION_AUTHORITY_RANK: Readonly<Record<ExecutionAuthorityLevel, number>>;
export declare function elevateExecutionAuthority(a: ExecutionAuthorityLevel, b: ExecutionAuthorityLevel): ExecutionAuthorityLevel;
export declare function intersectExecutionAuthorities(authorities: readonly ExecutionAuthorityLevel[]): ExecutionAuthorityLevel;
export declare enum ContextCompactionTrigger {
    BeforeInvocation = "before_invocation",
    AfterInvocation = "after_invocation",
    Manual = "manual"
}
export declare const FINISH_TASK_TOOL_NAME = "finish_task";
export declare const EXIT_LOOP_TOOL_NAME = "exit_loop";
export declare const TOOL_CALL_HMAC_METADATA_KEY = "__adk_internal_fc_hmac";
export declare const SIDE_EFFECT_RECONCILIATION_REQUIRED_TYPE = "SIDE_EFFECT_RECONCILIATION_REQUIRED";
export declare const PREDECESSOR_REF_PATTERN: RegExp;
export interface SdkWorkflowInstructionScope {
    input?: unknown;
    outputsByNode?: Record<string, unknown>;
}
export declare function resolvePredecessorRefs(template: string, scope: SdkWorkflowInstructionScope | undefined): string;
export declare function resolveSdkPredecessorRefs(template: string, outputsByNodeOrScope: Record<string, unknown> | SdkWorkflowInstructionScope): string;
export interface SdkEventLike {
    id: string;
    timestamp: number;
    type?: string;
    startTime?: number;
    endTime?: number;
    compactedEventIds?: string[];
    isolationScope?: string;
    nodeInfo?: {
        path?: string;
        runId?: string;
    };
    output?: unknown;
    executionAuthority?: ExecutionAuthorityLevel;
    checkpointManifest?: SdkCheckpointManifest;
    [key: string]: unknown;
}
export interface SdkCheckpointManifest {
    invocationId?: string;
    paused: boolean;
    runsByPath: Record<string, Array<{
        path: string;
        runId?: string;
        output?: unknown;
    }>>;
    outputsByNode: Record<string, unknown>;
    highestAuthority: ExecutionAuthorityLevel;
}
export declare function extractSdkCheckpointManifest(events: readonly SdkEventLike[], invocationId?: string): SdkCheckpointManifest;
export declare function getActiveSdkEvents<T extends SdkEventLike>(events: readonly T[], consumerScope?: string): T[];
//# sourceMappingURL=index.d.ts.map