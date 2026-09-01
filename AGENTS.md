# AGENTS.md - acr-typescript-sdk

Official TypeScript & JavaScript client SDK for the Agentic Chat Rooms (ACR) Protocol.
Published to npm under `@acr-js/sdk`.

## Guidelines
1. Zero runtime dependencies: Rely exclusively on standard `fetch`, `AbortController`, and modern ES2022 primitives.
2. Complete typings: Always export comprehensive TypeScript interfaces for rooms, messages, consensus proposals, and audits.
3. Sovereign & Cloud Hybrid: Support both local daemon loopback (`http://localhost:20443`) and remote cloud fallback meshes seamlessly.
