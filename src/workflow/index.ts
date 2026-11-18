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

export enum NodeStatus {
  INACTIVE = 0,
  PENDING = 1,
  WAITING = 2,
  RUNNING = 3,
  COMPLETED = 4,
  FAILED = 5,
  CANCELLED = 6,
  RECONCILING = 7,
  OUTCOME_UNKNOWN = 8,
}

export class BranchPath {
  readonly segments: readonly string[];

  constructor(segments: readonly string[] = []) {
    for (const seg of segments) {
      if (typeof seg !== 'string' || seg.length === 0) {
        throw new Error('BranchPath segments must be non-empty strings.');
      }
      if (seg.includes('.')) {
        throw new Error(
          `BranchPath segment '${seg}' must not contain '.' (the segment separator).`
        );
      }
    }
    this.segments = Object.freeze([...segments]);
  }

  get isEmpty(): boolean {
    return this.segments.length === 0;
  }

  append(segment: string): BranchPath {
    return new BranchPath([...this.segments, segment]);
  }

  toString(): string {
    return this.segments.join('.');
  }
}

export function branchPathFromString(raw?: string): BranchPath {
  if (!raw) {
    return new BranchPath();
  }
  return new BranchPath(raw.split('.'));
}

export function createSubBranch(
  parentBranch: string | undefined,
  node: { name: string; runId?: string }
): string {
  const segment = node.runId ? `${node.name}@${node.runId}` : node.name;
  return branchPathFromString(parentBranch).append(segment).toString();
}

export function commonPrefixOf(
  branches: readonly string[]
): string | undefined {
  if (branches.length === 0) {
    return undefined;
  }
  const paths = branches.map((b) => branchPathFromString(b).segments);
  const first = paths[0];
  let prefixLen = 0;
  while (
    prefixLen < first.length &&
    paths.every(
      (segs) => segs.length > prefixLen && segs[prefixLen] === first[prefixLen]
    )
  ) {
    prefixLen++;
  }
  if (prefixLen === 0) {
    return undefined;
  }
  return first.slice(0, prefixLen).join('.');
}

export type RouteValue = boolean | number | string;
export const DEFAULT_ROUTE = '__DEFAULT__';
export const DEFAULT = DEFAULT_ROUTE;
export const OUTCOME_UNKNOWN_ROUTE = '__OUTCOME_UNKNOWN__';

export interface GraphNodeDescriptor {
  readonly name: string;
  readonly requiresAllPredecessors?: boolean;
  readonly sideEffecting?: boolean;
}

export const START: GraphNodeDescriptor = Object.freeze({
  name: '__START__',
  requiresAllPredecessors: false,
  sideEffecting: false,
});

export type SdkNodeLike = GraphNodeDescriptor | string;
export type SdkRoutingMap = Record<
  string | number,
  SdkNodeLike | readonly SdkNodeLike[]
>;
export type SdkChainElement =
  | SdkNodeLike
  | readonly SdkNodeLike[]
  | SdkRoutingMap;
export type SdkEdgeItem = SdkEdge | SdkChainElement[];

export class SdkEdge {
  constructor(
    readonly fromNode: GraphNodeDescriptor,
    readonly toNode: GraphNodeDescriptor,
    readonly route: RouteValue | RouteValue[] | null = null
  ) {}
}

function toNodeDescriptor(
  item: SdkNodeLike,
  nodeMap: Map<string, GraphNodeDescriptor>
): GraphNodeDescriptor {
  if (item === 'START' || (typeof item === 'object' && item.name === '__START__')) {
    return START;
  }
  if (typeof item === 'string') {
    const existing = nodeMap.get(item);
    if (existing) return existing;
    const desc: GraphNodeDescriptor = { name: item };
    nodeMap.set(item, desc);
    return desc;
  }
  return item;
}

function isRoutingMap(el: SdkChainElement): el is SdkRoutingMap {
  if (typeof el !== 'object' || el === null || Array.isArray(el)) {
    return false;
  }
  if ('name' in el && typeof (el as { name?: unknown }).name === 'string') {
    return false;
  }
  return true;
}

function flattenChainElement(el: SdkChainElement): SdkNodeLike[] {
  if (isRoutingMap(el)) {
    const out: SdkNodeLike[] = [];
    for (const v of Object.values(el)) {
      if (Array.isArray(v)) {
        out.push(...(v as SdkNodeLike[]));
      } else {
        out.push(v as SdkNodeLike);
      }
    }
    return out;
  }
  if (Array.isArray(el)) {
    return [...(el as readonly SdkNodeLike[])];
  }
  return [el as SdkNodeLike];
}

function normalizeRouteKey(routeKey: string): RouteValue {
  if (/^-?\d+$/.test(routeKey)) {
    return Number(routeKey);
  }
  if (routeKey === 'true' || routeKey === 'false') {
    return routeKey === 'true';
  }
  return routeKey;
}

export function parseSdkEdgeItems(items: SdkEdgeItem[]): SdkEdge[] {
  const nodeMap = new Map<string, GraphNodeDescriptor>();
  const out: SdkEdge[] = [];

  for (const item of items) {
    if (item instanceof SdkEdge) {
      out.push(item);
      continue;
    }
    for (let i = 0; i < item.length - 1; i++) {
      const fromEl = item[i];
      const toEl = item[i + 1];
      if (isRoutingMap(toEl)) {
        if (isRoutingMap(fromEl)) {
          throw new Error(
            'Consecutive routing maps are not allowed in a chain.'
          );
        }
        const keys = Object.keys(toEl);
        if (keys.length === 0) {
          throw new Error('Routing map must not be empty.');
        }
        for (const rk of keys) {
          const route = normalizeRouteKey(rk);
          const targets = Array.isArray(toEl[rk])
            ? (toEl[rk] as readonly SdkNodeLike[])
            : [toEl[rk] as SdkNodeLike];
          for (const fn of flattenChainElement(fromEl)) {
            for (const tn of targets) {
              out.push(
                new SdkEdge(
                  toNodeDescriptor(fn, nodeMap),
                  toNodeDescriptor(tn, nodeMap),
                  route
                )
              );
            }
          }
        }
      } else {
        for (const fn of flattenChainElement(fromEl)) {
          for (const tn of flattenChainElement(toEl)) {
            out.push(
              new SdkEdge(
                toNodeDescriptor(fn, nodeMap),
                toNodeDescriptor(tn, nodeMap),
                null
              )
            );
          }
        }
      }
    }
  }

  return out;
}

export function detectUnconditionalCycles(
  edges: SdkEdge[],
  nodeNames: Set<string>
): void {
  const adj = new Map<string, string[]>();
  for (const name of nodeNames) {
    adj.set(name, []);
  }
  for (const edge of edges) {
    if (edge.route === null) {
      adj.get(edge.fromNode.name)!.push(edge.toNode.name);
    }
  }

  const inStack = new Set<string>();
  const done = new Set<string>();

  const dfs = (node: string, path: string[]): void => {
    inStack.add(node);
    path.push(node);
    for (const neighbor of adj.get(node) ?? []) {
      if (inStack.has(neighbor)) {
        const cycleStart = path.indexOf(neighbor);
        const cycle = [...path.slice(cycleStart), neighbor];
        throw new Error(
          `Graph validation failed. Unconditional cycle detected: ${cycle.join(' -> ')}`
        );
      }
      if (!done.has(neighbor)) {
        dfs(neighbor, path);
      }
    }
    path.pop();
    inStack.delete(node);
    done.add(node);
  };

  for (const name of nodeNames) {
    if (!done.has(name)) {
      dfs(name, []);
    }
  }
}

export function validateSdkGraph(
  nodes: GraphNodeDescriptor[],
  edges: SdkEdge[]
): Set<string> {
  const counts = new Map<string, number>();
  for (const node of nodes) {
    counts.set(node.name, (counts.get(node.name) ?? 0) + 1);
  }
  const duplicates = [...counts.entries()]
    .filter(([, c]) => c > 1)
    .map(([n]) => n);
  if (duplicates.length > 0) {
    throw new Error(
      `Graph validation failed. Duplicate node names found: ${JSON.stringify(duplicates)}`
    );
  }
  const nodeNames = new Set(counts.keys());
  if (!nodeNames.has(START.name)) {
    throw new Error(
      `Graph validation failed. START node (name: '${START.name}') not found in graph nodes.`
    );
  }
  for (const edge of edges) {
    if (edge.fromNode.name === START.name && edge.route !== null) {
      throw new Error(
        `Graph validation failed. Edges from START must not have routes.`
      );
    }
  }
  detectUnconditionalCycles(edges, nodeNames);

  const fromNames = new Set(edges.map((e) => e.fromNode.name));
  return new Set(
    nodes
      .filter((n) => n.name !== START.name && !fromNames.has(n.name))
      .map((n) => n.name)
  );
}

// ---------------------------------------------------------------------------
// Dynamic Workflow, Predecessor Ref Resolution & Authority Lattice Helpers
// ---------------------------------------------------------------------------

export type ExecutionAuthorityLevel =
  | 'NONE'
  | 'QUORUM_ELEVATED'
  | 'CONSENT_ELEVATED'
  | 'SYSTEM';

export const EXECUTION_AUTHORITY_RANK: Readonly<
  Record<ExecutionAuthorityLevel, number>
> = Object.freeze({
  NONE: 0,
  QUORUM_ELEVATED: 1,
  CONSENT_ELEVATED: 2,
  SYSTEM: 3,
});

export function elevateExecutionAuthority(
  a: ExecutionAuthorityLevel,
  b: ExecutionAuthorityLevel
): ExecutionAuthorityLevel {
  return EXECUTION_AUTHORITY_RANK[a] >= EXECUTION_AUTHORITY_RANK[b] ? a : b;
}

export function intersectExecutionAuthorities(
  authorities: readonly ExecutionAuthorityLevel[]
): ExecutionAuthorityLevel {
  if (authorities.length === 0) {
    return 'NONE';
  }
  let min = authorities[0];
  for (let i = 1; i < authorities.length; i++) {
    if (EXECUTION_AUTHORITY_RANK[authorities[i]] < EXECUTION_AUTHORITY_RANK[min]) {
      min = authorities[i];
    }
  }
  return min;
}

export enum ContextCompactionTrigger {
  BeforeInvocation = 'before_invocation',
  AfterInvocation = 'after_invocation',
  Manual = 'manual',
}

export const FINISH_TASK_TOOL_NAME = 'finish_task';
export const EXIT_LOOP_TOOL_NAME = 'exit_loop';
export const TOOL_CALL_HMAC_METADATA_KEY = '__adk_internal_fc_hmac';
export const SIDE_EFFECT_RECONCILIATION_REQUIRED_TYPE =
  'SIDE_EFFECT_RECONCILIATION_REQUIRED';

export const PREDECESSOR_REF_PATTERN =
  /<([A-Za-z_]\w*)(?:\.([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*))?(?:\s+from\s+([A-Za-z_][\w.-]*))?>/g;

export interface SdkWorkflowInstructionScope {
  input?: unknown;
  outputsByNode?: Record<string, unknown>;
}

export function resolvePredecessorRefs(
  template: string,
  scope: SdkWorkflowInstructionScope | undefined
): string {
  if (!scope || !template.includes('<')) {
    return template;
  }
  return template.replace(
    PREDECESSOR_REF_PATTERN,
    (match, _typeName: string, fieldPath?: string, fromNode?: string) => {
      let root: unknown =
        fromNode !== undefined ? scope.outputsByNode?.[fromNode] : scope.input;
      if (root === undefined) {
        return match;
      }
      if (fieldPath) {
        for (const seg of fieldPath.split('.')) {
          if (root === null || typeof root !== 'object' || !(seg in root)) {
            return match;
          }
          root = (root as Record<string, unknown>)[seg];
        }
      }
      if (root === undefined) {
        return match;
      }
      return typeof root === 'string'
        ? root
        : typeof root === 'number' || typeof root === 'boolean'
          ? String(root)
          : JSON.stringify(root);
    }
  );
}

export function resolveSdkPredecessorRefs(
  template: string,
  outputsByNodeOrScope: Record<string, unknown> | SdkWorkflowInstructionScope
): string {
  const scope: SdkWorkflowInstructionScope =
    outputsByNodeOrScope &&
    ('outputsByNode' in outputsByNodeOrScope || 'input' in outputsByNodeOrScope)
      ? (outputsByNodeOrScope as SdkWorkflowInstructionScope)
      : { outputsByNode: outputsByNodeOrScope as Record<string, unknown> };
  return resolvePredecessorRefs(template, scope);
}

export interface SdkEventLike {
  id: string;
  timestamp: number;
  type?: string;
  startTime?: number;
  endTime?: number;
  compactedEventIds?: string[];
  isolationScope?: string;
  nodeInfo?: { path?: string; runId?: string };
  output?: unknown;
  executionAuthority?: ExecutionAuthorityLevel;
  checkpointManifest?: SdkCheckpointManifest;
  [key: string]: unknown;
}

export interface SdkCheckpointManifest {
  invocationId?: string;
  paused: boolean;
  runsByPath: Record<string, Array<{ path: string; runId?: string; output?: unknown }>>;
  outputsByNode: Record<string, unknown>;
  highestAuthority: ExecutionAuthorityLevel;
}

export function extractSdkCheckpointManifest(
  events: readonly SdkEventLike[],
  invocationId?: string
): SdkCheckpointManifest {
  const runsByPath: Record<
    string,
    Array<{ path: string; runId?: string; output?: unknown }>
  > = {};
  const outputsByNode: Record<string, unknown> = {};
  let highestAuthority: ExecutionAuthorityLevel = 'NONE';

  for (const ev of events) {
    if (ev.checkpointManifest) {
      highestAuthority = elevateExecutionAuthority(
        highestAuthority,
        ev.checkpointManifest.highestAuthority ?? 'NONE'
      );
      for (const [k, v] of Object.entries(ev.checkpointManifest.runsByPath)) {
        runsByPath[k] = [...(runsByPath[k] ?? []), ...v];
      }
      Object.assign(outputsByNode, ev.checkpointManifest.outputsByNode);
    }
    if (ev.executionAuthority) {
      highestAuthority = elevateExecutionAuthority(
        highestAuthority,
        ev.executionAuthority
      );
    }
    if (ev.nodeInfo?.path) {
      const path = ev.nodeInfo.path;
      runsByPath[path] = [
        ...(runsByPath[path] ?? []),
        { path, runId: ev.nodeInfo.runId, output: ev.output },
      ];
      const shortName = path.split('.').pop()!;
      if (ev.output !== undefined) {
        outputsByNode[shortName] = ev.output;
        outputsByNode[path] = ev.output;
      }
    }
  }

  return {
    invocationId,
    paused: false,
    runsByPath,
    outputsByNode,
    highestAuthority,
  };
}

export function getActiveSdkEvents<T extends SdkEventLike>(
  events: readonly T[],
  consumerScope?: string
): T[] {
  let latestCompacted: T | undefined;
  let latestIdx = -1;
  for (let i = events.length - 1; i >= 0; i--) {
    const ev = events[i];
    if (
      ev.type === 'compacted_event' &&
      (!ev.isolationScope || ev.isolationScope === consumerScope)
    ) {
      latestCompacted = ev;
      latestIdx = i;
      break;
    }
  }
  if (!latestCompacted) {
    return [...events];
  }
  const compactedIds = new Set(latestCompacted.compactedEventIds ?? []);
  const endTime = latestCompacted.endTime ?? latestCompacted.timestamp;
  const active: T[] = [latestCompacted];
  for (let i = 0; i < events.length; i++) {
    if (i === latestIdx) {
      continue;
    }
    const ev = events[i];
    if (compactedIds.size > 0) {
      if (!compactedIds.has(ev.id)) {
        active.push(ev);
      }
    } else if (ev.timestamp > endTime || i > latestIdx) {
      active.push(ev);
    }
  }
  return active;
}

// ---------------------------------------------------------------------------
// Canonical 18-Workflow Catalog Alignment (ADK 2.0 / ACR Protocol)
// ---------------------------------------------------------------------------

export const CANONICAL_WORKFLOW_IDS = Object.freeze([
  'postgres-split-brain',
  'egress-token-anomaly',
  'ingress-oom-autoscaling',
  'canary-deployment-rollback',
  'code-review-tla-verification',
  'saif-compliance-audit',
  'bft-consensus-deliberation',
  'twinseal-passkey-approval',
  'durable-wal-recovery',
  'context-compaction-pruning',
  'byzantine-fault-slashing',
  'identity-key-rotation',
  'micro-sandbox-isolation',
  'cross-model-agentflex-synthesis',
  'declarative-step-playbook',
  'postguard-injection-defense',
  'dynamic-dag-topology',
  'transitive-trust-federation',
] as const);

export type CanonicalWorkflowId = (typeof CANONICAL_WORKFLOW_IDS)[number];

const CANONICAL_WORKFLOW_ID_SET: ReadonlySet<string> = new Set(CANONICAL_WORKFLOW_IDS);

export function isCanonicalWorkflowId(id: string): id is CanonicalWorkflowId {
  return CANONICAL_WORKFLOW_ID_SET.has(id);
}


