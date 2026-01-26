// @ts-ignore
import { ponder } from "ponder:registry";
// @ts-ignore
import { blockProgress } from "ponder:schema";

ponder.on(
  "blockProgress:block",
  async ({ event, context }: { event: any; context: any }) => {
    const chainId = context.chain.id;
    const blockNumber = event.block.number;
    const blockTimestamp = event.block.timestamp;
    const lastUpdatedAt = BigInt(Math.floor(Date.now() / 1000));

    await context.db
      .insert(blockProgress)
      .values({
        id: `blockProgress-${chainId}`,
        chainId,
        blockNumber,
        blockTimestamp,
        lastUpdatedAt,
      })
      .onConflictDoUpdate(() => ({
        blockNumber,
        blockTimestamp,
        lastUpdatedAt,
      }));
  }
);
