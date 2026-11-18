export declare const REMOTE_MCP_URL = "https://mcp.agentchatrooms.dev/mcp";
export declare const DEFAULT_LOCAL_PORT = 20443;
export declare const DEFAULT_LOCAL_URL = "http://127.0.0.1:20443";
export declare const REST_TIMEOUT_MS = 10000;
/**
 * OAuth scopes requested by browser/native clients during Clerk OAuth login.
 * Never request privilege/entitlement scopes (`acr:rooms`, `acr:cloud:pro`) from the client.
 */
export declare const CLERK_OAUTH_CLIENT_SCOPES: readonly ["profile", "email"];
/**
 * Server-granted entitlement scopes checked as a routing hint when selecting remote vs local MCP.
 */
export declare const REQUIRED_REMOTE_SCOPES: readonly ["acr:rooms", "acr:cloud:pro"];
export type EndpointMode = 'local' | 'remote';
export interface EndpointResolution {
    mode: EndpointMode;
    url: string;
    reason: string;
}
export interface ResolveEndpointOptions {
    override?: string;
    grantedScopes?: readonly string[];
    localUrl?: string;
}
export declare class McpEndpointError extends Error {
    constructor(message: string);
}
/**
 * Validates that a remote MCP endpoint matches the pinned REMOTE_MCP_URL exactly.
 * Rejects non-https, userinfo, non-443 ports, non-/mcp or percent-encoded paths,
 * queries, fragments, trailing dots, and lookalike hostnames.
 */
export declare function validateRemote(raw: string): string;
/**
 * Validates that a local daemon URL uses http and a loopback literal (`127.0.0.1`, `::1`, or
 * `localhost` pinned to `127.0.0.1`), with port in 1024-65535 (defaulting to 20443),
 * no userinfo, no query, no fragment, and empty or `/` path.
 */
export declare function validateLocal(raw: string): string;
/**
 * Resolves the target MCP endpoint (`local` or `remote`) using explicit override and
 * server-granted entitlement scopes. Always validates `localUrl`, even if remote wins.
 */
export declare function resolveEndpoint(options?: ResolveEndpointOptions): EndpointResolution;
/**
 * Resolves and validates the local daemon URL from explicit config, ACR_DAEMON_URL env,
 * or the default http://127.0.0.1:20443.
 */
export declare function resolveLocalDaemonUrl(explicitUrl?: string): string;
export declare function isRedirectStatus(status: number): boolean;
/**
 * Enforces noRedirect semantics on fetch(..., { redirect: 'manual' }) responses so a 3xx
 * cannot silently redirect or carry an Authorization header to another origin.
 */
export declare function assertNoRedirectResponse(response: Response): Response;
//# sourceMappingURL=mcpendpoint.d.ts.map