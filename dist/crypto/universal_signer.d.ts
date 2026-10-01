/**
 * Universal Isomorphic Web Crypto / Node Crypto Signer & Verifier
 *
 * Implements Ed25519 key generation, signing, verification, and canonical
 * length-prefixed bytes composition across Node.js, Browsers, and Edge runtimes.
 */
export interface UniversalKeypair {
    publicKeyHex: string;
    privateKeyHex: string;
}
export declare class UniversalSigner {
    /**
     * Constructs canonical, versioned, length-prefixed bytes for tamper-evident signing.
     * Format:
     * header\n
     * {len}:{part_0}\n
     * {len}:{part_1}\n
     */
    static compose(header: string, parts: (string | Uint8Array)[]): Uint8Array;
    /**
     * Generates a new Ed25519 keypair.
     */
    static generateKeypair(): Promise<UniversalKeypair>;
    /**
     * Signs data with an Ed25519 private key (raw 32 bytes hex).
     */
    static sign(privateKeyHex: string, data: Uint8Array | string): Promise<string>;
    /**
     * Verifies an Ed25519 signature against a public key (raw 32 bytes hex).
     */
    static verify(publicKeyHex: string, data: Uint8Array | string, signatureHex: string): Promise<boolean>;
    /**
     * Computes SHA-256 hex digest for content-addressing across environments.
     */
    static sha256(data: Uint8Array | string): Promise<string>;
}
//# sourceMappingURL=universal_signer.d.ts.map