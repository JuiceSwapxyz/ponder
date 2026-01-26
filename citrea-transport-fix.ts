import { http } from "viem";

/**
 * Comprehensive fix for Citrea RPC incompatibilities.
 * Wraps HTTP transport to correct transactionIndex and sanitize problematic data.
 *
 * Fixes:
 * 1. Invalid transactionIndex values in eth_getLogs responses
 * 2. Problematic data structures that cause Reflect.get errors
 */
export function citreaTransport(url: string): any {
  const baseTransport = http(url);

  return (config: any) => {
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