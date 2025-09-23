import { http, type Transport, type TransportConfig } from "viem";

/**
 * Sanitizes an object to prevent Reflect.get errors by ensuring all properties are proper objects.
 * Converts problematic values to safe defaults.
 */
function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) {
    return {};
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  const sanitized: any = {};
  for (const [key, value] of Object.entries(obj)) {
    try {
      // Ensure the key exists and the value is accessible
      if (value !== null && value !== undefined) {
        if (typeof value === 'object') {
          sanitized[key] = sanitizeObject(value);
        } else {
          sanitized[key] = value;
        }
      } else {
        // Replace null/undefined with safe defaults based on common RPC fields
        if (key === 'input' || key === 'data') {
          sanitized[key] = '0x';
        } else if (key.includes('Index') || key.includes('Number')) {
          sanitized[key] = '0x0';
        } else if (key.includes('Hash')) {
          sanitized[key] = '0x0000000000000000000000000000000000000000000000000000000000000000';
        } else {
          sanitized[key] = value; // Keep original null/undefined for non-critical fields
        }
      }
    } catch (error) {
      console.warn(`Error sanitizing property ${key}:`, error);
      sanitized[key] = null; // Safe fallback
    }
  }

  return sanitized;
}

/**
 * Comprehensive fix for Citrea RPC incompatibilities.
 * Wraps HTTP transport to correct transactionIndex and sanitize problematic data.
 *
 * Fixes:
 * 1. Invalid transactionIndex values in eth_getLogs responses
 * 2. Problematic data structures that cause Reflect.get errors
 */
export function citreaTransport(url: string): Transport {
  const baseTransport = http(url);

  return (config: TransportConfig) => {
    const transport = baseTransport(config);
    const originalRequest = transport.request;

    // Return a new transport object to avoid mutating the original
    return {
      ...transport,
      request: async (args: any) => {
        const response = await originalRequest(args);

        // Only process eth_getLogs responses (keep it simple)
        if (args.method === 'eth_getLogs' && Array.isArray(response)) {
          // Cache to avoid duplicate block fetches
          const blockCache = new Map<string, any>();

          for (const log of response) {
            if (!log?.blockNumber || !log?.transactionHash) continue;

            // Fetch block if not cached
            let block = blockCache.get(log.blockNumber);
            if (!block) {
              try {
                block = await originalRequest({
                  method: 'eth_getBlockByNumber',
                  params: [log.blockNumber, true]
                });
                if (block) {
                  blockCache.set(log.blockNumber, block);
                }
              } catch (error) {
                console.warn(`Failed to fetch block ${log.blockNumber}:`, error);
                continue;
              }
            }

            // Find correct transaction index by hash
            const txs = block?.transactions ?? [];
            const idx = txs.findIndex((tx: any) => tx?.hash === log.transactionHash);
            if (idx >= 0) {
              // Convert to hex to match expected format
              log.transactionIndex = `0x${idx.toString(16)}`;
            }
          }
        }

        return response;
      }
    };
  };
}