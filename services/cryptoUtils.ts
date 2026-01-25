// services/cryptoUtils.ts

export const generateKeyPair = async () => {
    return await window.crypto.subtle.generateKey(
        {
            name: "RSA-OAEP",
            modulusLength: 1024,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: "SHA-256",
        },
        true,
        ["encrypt", "decrypt"]
    );
};

export const exportPublicKey = async (key: CryptoKey): Promise<`0x${string}`> => {
    const exported = await window.crypto.subtle.exportKey("spki", key);
    // Convert to hex string for Solidity bytes
    const bytes = new Uint8Array(exported);
    return ('0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')) as `0x${string}`;
};

// Also export as Base64 for storage/display if needed
export const exportPublicKeyBase64 = async (key: CryptoKey): Promise<string> => {
    const exported = await window.crypto.subtle.exportKey("spki", key);
    return btoa(String.fromCharCode(...new Uint8Array(exported)));
};

export const importPublicKey = async (pem: string): Promise<CryptoKey> => {
    let binaryDer: Uint8Array<ArrayBuffer>;

    // Handle both hex (0x...) and base64 formats
    if (pem.startsWith('0x')) {
        // Hex format - convert to bytes
        const hex = pem.slice(2);
        const arr = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
            arr[i / 2] = parseInt(hex.substr(i, 2), 16);
        }
        binaryDer = arr as Uint8Array<ArrayBuffer>;
    } else {
        // Base64 format (legacy)
        const binaryDerString = atob(pem);
        const arr = new Uint8Array(binaryDerString.length);
        for (let i = 0; i < binaryDerString.length; i++) {
            arr[i] = binaryDerString.charCodeAt(i);
        }
        binaryDer = arr as Uint8Array<ArrayBuffer>;
    }

    return await window.crypto.subtle.importKey(
        "spki",
        binaryDer,
        { name: "RSA-OAEP", hash: "SHA-256" },
        true,
        ["encrypt"]
    );
};

// Helper: Convert string to hex bytes for Solidity
export const stringToHex = (str: string): `0x${string}` => {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);
    return ('0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')) as `0x${string}`;
};

// Helper: Convert hex bytes back to string
export const hexToString = (hex: string): string => {
    if (!hex || hex === '0x') return '';
    const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
    const bytes = new Uint8Array(cleanHex.length / 2);
    for (let i = 0; i < cleanHex.length; i += 2) {
        bytes[i / 2] = parseInt(cleanHex.substr(i, 2), 16);
    }
    const decoder = new TextDecoder();
    return decoder.decode(bytes);
};