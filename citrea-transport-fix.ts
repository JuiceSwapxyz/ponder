import { http, type Transport, type TransportConfig } from "viem";

/**
 * Ultra-minimal fix for Citrea's transactionIndex bug.
 * Wraps HTTP transport to correct transactionIndex in eth_getLogs responses.
 *
 * This is the most efficient solution - fixes data in-memory without any proxy overhead.
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

        // Only process eth_getLogs responses
        if (args.method === 'eth_getLogs' && Array.isArray(response)) {
          // Cache to avoid duplicate block fetches
          const blockCache = new Map<string, any>();

          for (const log of response) {
            if (!log.blockNumber || !log.transactionHash) continue;

            // Fetch block if not cached
            let block = blockCache.get(log.blockNumber);
            if (!block) {
              block = await originalRequest({
                method: 'eth_getBlockByNumber',
                params: [log.blockNumber, true]
              });
              blockCache.set(log.blockNumber, block);
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