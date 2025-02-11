import bs58 from 'bs58';

// Add this utility function to process the transaction object
export const convertBuffers = (obj: any): any => {
    if (obj === null || obj === undefined) {
        return obj;
    }

    // Handle Buffer objects
    if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
        return bs58.encode(new Uint8Array(obj.data));
    }

    // Handle arrays
    if (Array.isArray(obj)) {
        return obj.map(item => convertBuffers(item));
    }

    // Handle objects
    if (typeof obj === 'object') {
        // Handle Uint8Array directly
        if (obj instanceof Uint8Array) {
            return bs58.encode(obj);
        }

        const converted: any = {};
        for (const [key, value] of Object.entries(obj)) {
            // Skip certain keys that shouldn't be converted
            if (key === 'uiAmount' || key === 'decimals' || key === 'uiAmountString') {
                converted[key] = value;
            } else {
                converted[key] = convertBuffers(value);
            }
        }
        return converted;
    }

    return obj;
}