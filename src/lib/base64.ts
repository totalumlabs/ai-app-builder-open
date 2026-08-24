/**
 * UTF-8 ⇄ base64, in the browser, for text of any size.
 *
 * ⚠️ WHY NOT `btoa(text)`. `btoa` throws on any code point above U+00FF, so a file
 * containing `€`, an emoji, or a Spanish `ñ` in a comment fails outright — and
 * these are people's source files. The text has to be encoded to UTF-8 BYTES first
 * and those bytes base64'd.
 *
 * ⚠️ WHY NOT `String.fromCharCode(...bytes)`. Spreading a typed array into a call
 * blows the argument limit and throws `RangeError: Maximum call stack size
 * exceeded` somewhere around 100 KB, depending on the engine — which means it works
 * on every file you test with and fails on the one big component in production.
 * Chunking is the fix, and 0x8000 is the conventional safe stride.
 *
 * Used by `vcaasApi.files.write`, where base64 is REQUIRED rather than merely
 * convenient — see the note there about the backend's HTML sanitizer.
 */

const CHUNK = 0x8000;

export function toBase64(text: string): string {
    const bytes = new TextEncoder().encode(text);

    let binary = "";
    for (let index = 0; index < bytes.length; index += CHUNK) {
        binary += String.fromCharCode(...bytes.subarray(index, index + CHUNK));
    }

    return btoa(binary);
}

export function fromBase64(value: string): string {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) {
        bytes[index] = binary.charCodeAt(index);
    }
    return new TextDecoder().decode(bytes);
}

/** The raw bytes behind a base64 payload — for binary files (images). */
export function bytesFromBase64(value: string): Uint8Array {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) {
        bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
}
