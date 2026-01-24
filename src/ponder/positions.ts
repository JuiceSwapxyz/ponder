// @ts-ignore
import { UniswapV3PoolAbi } from "abis/UniswapV3Pool";
import { pool, position, token, nftOwner } from "ponder.schema";
// @ts-ignore
import { ponder } from "ponder:registry";
// @ts-ignore
import { decodeEventLog, erc20Abi, getAddress, zeroAddress } from "viem";
import { safeGetAddress, safeBigInt } from "../utils/helpers";

const getTokenOnchainData = async (address: string, context: any) => {
  const name = await context.client.readContract({
    address: address,
    abi: erc20Abi,
    functionName: "name",
  });
  const symbol = await context.client.readContract({
    address: address,
    abi: erc20Abi,
    functionName: "symbol",
  });
  const decimals = await context.client.readContract({
    address: address,
    abi: erc20Abi,
    functionName: "decimals",
  });
  return {
    name,
    symbol,
    decimals,
  };
};

ponder.on(
  "UniswapV3Factory:PoolCreated",
  async ({ event, context }: { event: any; context: any }) => {
    try {
      // UniswapV3Factory:PoolCreated(address indexed token0, address indexed token1, uint24 indexed fee, int24 tickSpacing, address pool)
      await context.db
        .insert(pool)
        .values({
          id: getAddress(event.args.pool),
          chainId: 5115,
          address: getAddress(event.args.pool),
          token0: getAddress(event.args.token0),
          token1: getAddress(event.args.token1),
          fee: event.args.fee,
          tickSpacing: Number(event.args.tickSpacing),
          createdAt: Number(event.block.timestamp),
        })
        .onConflictDoNothing();

      const token0Data = await context.db.find(token, {
        id: getAddress(event.args.token0).toLowerCase(),
      });
      if (!token0Data) {
        const token0DataOnchain = await getTokenOnchainData(
          getAddress(event.args.token0),
          context
        );
        await context.db
          .insert(token)
          .values({
            id: getAddress(event.args.token0).toLowerCase(),
            chainId: 5115,
            address: getAddress(event.args.token0),
            symbol: token0DataOnchain.symbol,
            decimals: token0DataOnchain.decimals,
            name: token0DataOnchain.name,
          })
          .onConflictDoNothing();
      }

      const token1Data = await context.db.find(token, {
        id: getAddress(event.args.token1).toLowerCase(),
      });
      if (!token1Data) {
        const token1DataOnchain = await getTokenOnchainData(
          getAddress(event.args.token1),
          context
        );
        await context.db
          .insert(token)
          .values({
            id: getAddress(event.args.token1).toLowerCase(),
            chainId: 5115,
            address: getAddress(event.args.token1),
            symbol: token1DataOnchain.symbol,
            decimals: token1DataOnchain.decimals,
            name: token1DataOnchain.name,
          })
          .onConflictDoNothing();
      }
    } catch (error) {
      console.error("Error processing PoolCreated event:", error);
      // Don't rethrow to prevent crashes
    }
  }
);

ponder.on(
  "NonfungiblePositionManager:Transfer", // Transfer(address indexed from, address indexed to, uint256 indexed tokenId)
  async ({ event, context }: { event: any; context: any }) => {
    // NFT ownership
    try {
      const chainId = 5115;
      const tokenId = event?.args?.tokenId;
      const contractAddress = safeGetAddress(event?.log?.address);

      await context.db
        .insert(nftOwner)
        .values({
          id: `${chainId}-${tokenId}-${contractAddress}`,
          owner: getAddress(event?.args?.to),
          chainId: chainId,
          tokenId: String(tokenId || "0"),
          contractAddress,
          timestamp: safeBigInt(event?.block?.timestamp),
        })
        .onConflictDoUpdate({
          owner: getAddress(event?.args?.to),
          timestamp: safeBigInt(event?.block?.timestamp),
        });
    } catch (error) {
      console.error("Error processing Transfer event:", error);
    }

    // Position ownership
    try {
      if (event.args.from !== zeroAddress) return;
      if (!event.transaction?.hash) {
        console.warn("Missing transaction data for Transfer event, skipping");
        return;
      }

      const txReceipt = await context.client.getTransactionReceipt({
        hash: event.transaction.hash,
      });

      // UniswapV3Pool:Mint(address sender, address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)
      const uniswapV3PoolMintEventTopic =
        "0x7a53080ba414158be7ec69b987b5fb7d07dee101fe85488f0853ae16239d0bde";

      const poolMintEvent = txReceipt.logs.find(
        (log: any) => log.topics[0] === uniswapV3PoolMintEventTopic
      );

      if (!poolMintEvent) {
        console.warn("No Mint event found in transaction logs");
        return;
      }

      const poolMintEventDecoded = decodeEventLog({
        abi: UniswapV3PoolAbi,
        data: poolMintEvent.data,
        topics: poolMintEvent.topics,
      });

      if (poolMintEventDecoded.eventName === "Mint") {
        const mintArgs = poolMintEventDecoded.args as any;
        await context.db
          .insert(position)
          .values({
            id: event.id,
            chainId: 5115,
            owner: getAddress(event.args.to),
            poolAddress: getAddress(poolMintEvent.address),
            tokenId: event.args.tokenId.toString(),
            tickLower: Number(mintArgs.tickLower),
            tickUpper: Number(mintArgs.tickUpper),
            amount0: mintArgs.amount0,
            amount1: mintArgs.amount1,
          })
          .onConflictDoNothing();
      }
    } catch (error) {
      console.error("Error processing Transfer event:", error);
    }
  }
);

ponder.on(
  "NonfungiblePositionManager:IncreaseLiquidity",
  async ({ event, context }: { event: any; context: any }) => {
    try {
      const tokenId = event.args.tokenId;
      if (!tokenId) {
        return;
      }

      await context.db
        .update(position, {id: tokenId})
        .set({
          amount0: event.args.amount0,
          amount1: event.args.amount1,
        })
    } catch (error) {
      // Don't rethrow to prevent crashes
    }
  }
);

ponder.on(
  "NonfungiblePositionManager:DecreaseLiquidity",
  async ({ event, context }: { event: any; context: any }) => {
    try {
      const tokenId = event.args.tokenId;
      if (!tokenId) {
        return;
      }
      await context.db
        .update(position)
        .set({
          amount0: event.args.amount0,
          amount1: event.args.amount1,
        })
    } catch (error) {
      // Don't rethrow to prevent crashes
    }
  }
);