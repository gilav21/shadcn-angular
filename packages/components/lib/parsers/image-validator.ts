const SVG_CHECK_LENGTH = 256;

export function isValidImageMagicBytes(bytes: Uint8Array): boolean {
    if (bytes.length < 3) return false;

    if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return true;

    if (bytes.length >= 8 &&
        bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47 &&
        bytes[4] === 0x0D && bytes[5] === 0x0A && bytes[6] === 0x1A && bytes[7] === 0x0A) return true;

    if (bytes.length >= 4 &&
        bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return true;

    if (bytes.length >= 12 &&
        bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
        bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return true;

    return isSvgContent(bytes);
}

function isSvgContent(bytes: Uint8Array): boolean {
    let offset = 0;
    if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
        offset = 3;
    }
    const length = Math.min(bytes.length, SVG_CHECK_LENGTH);
    let text = '';
    for (let i = offset; i < length; i++) {
        text += String.fromCharCode(bytes[i]);
    }
    const trimmed = text.trimStart().toLowerCase();
    return trimmed.startsWith('<svg') || trimmed.startsWith('<?xml');
}

export function isValidImageDataUrl(dataUrl: string): boolean {
    const lower = dataUrl.toLowerCase();
    if (!lower.startsWith('data:image/')) return false;

    const base64Marker = ';base64,';
    const markerIndex = lower.indexOf(base64Marker);
    if (markerIndex === -1) return false;

    const base64Start = markerIndex + base64Marker.length;

    if (lower.startsWith('data:image/svg+xml')) {
        const svgChunk = dataUrl.substring(base64Start, base64Start + 344);
        if (!svgChunk) return false;
        try {
            const decoded = atob(svgChunk);
            const bytes = new Uint8Array(decoded.length);
            for (let i = 0; i < decoded.length; i++) {
                bytes[i] = decoded.charCodeAt(i);
            }
            return isSvgContent(bytes);
        } catch {
            return false;
        }
    }

    const chunk = dataUrl.substring(base64Start, base64Start + 16);
    if (!chunk) return false;
    try {
        const decoded = atob(chunk);
        const bytes = new Uint8Array(decoded.length);
        for (let i = 0; i < decoded.length; i++) {
            bytes[i] = decoded.charCodeAt(i);
        }
        return isValidImageMagicBytes(bytes);
    } catch {
        return false;
    }
}
