// @ts-ignore
import { blockIndexingProgress } from "ponder.schema";
// @ts-ignore
import { ponder } from "ponder:registry";

ponder.on(
  "TimeSeriesMinute:block",
  async ({ event, context }: { event: any; context: any }) => {
    await context.db
      .insert(blockIndexingProgress)
      .values({
        id: `latest`,
        latestBlock: event.block.number,
        latestTimestamp: event.block.timestamp,
      })
      .onConflictDoUpdate({
        latestBlock: event.block.number,
        latestTimestamp: event.block.timestamp,
      });
  }
);
