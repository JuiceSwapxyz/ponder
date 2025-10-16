import { desc, eq, inArray } from "ponder";
import { token, transactionSwap } from "ponder.schema";
import { getAddress } from "viem";
// @ts-ignore
import { db } from "ponder:api";


export const computeTxStats = async () => {
    try {
      const swaps = await db
        .select()
        .from(transactionSwap)
        .orderBy(desc(transactionSwap.blockTimestamp))
        .limit(50);
  
      const uniqueTokenAddresses = Array.from(
        new Set(
          swaps.flatMap((swap: any) => [
            getAddress(swap.tokenIn),
            getAddress(swap.tokenOut),
          ])
        )
      ) as string[];

      const tokens = await db
        .select()
        .from(token)
        .where(inArray(token.address, uniqueTokenAddresses as any));

      const tokenMap = new Map(
        tokens.map((t: any) => [t.address.toLowerCase(), t])
      );

      const formatAmount = (amount: bigint, decimals: number) =>
        (Number(amount) / Math.pow(10, decimals)).toString();
  
      return swaps.map((swap: any) => {
        const [token0Addr, token1Addr] = [swap.tokenIn, swap.tokenOut].sort();
        const token0Info: any = tokenMap.get(getAddress(token0Addr).toLowerCase());
        const token1Info: any = tokenMap.get(getAddress(token1Addr).toLowerCase());

        if (!token0Info || !token1Info) {
          return null;
        }

        const isToken0Input =
          swap.tokenIn.toLowerCase() === token0Addr.toLowerCase();

        return {
          hash: swap.txHash,
          chain: "CITREA_TESTNET",
          timestamp: Number(swap.blockTimestamp),
          account: swap.from,
          usdValue: { value: 0 },
          token0: {
            chain: "CITREA_TESTNET",
            address: token0Info.address,
            symbol: token0Info.symbol,
            decimals: token0Info.decimals,
            project: {
              logo: {},
              name: token0Info.name,
              isSpam: false,
              safetyLevel: "STRONG_WARNING",
            },
          },
          token0Quantity: isToken0Input
            ? `-${formatAmount(swap.amountIn, token0Info.decimals)}`
            : formatAmount(swap.amountOut, token0Info.decimals),
          token1: {
            chain: "CITREA_TESTNET",
            address: token1Info.address,
            symbol: token1Info.symbol,
            decimals: token1Info.decimals,
            project: {
              logo: {},
              name: token1Info.name,
              isSpam: false,
              safetyLevel: "STRONG_WARNING",
            },
          },
          token1Quantity: isToken0Input
            ? formatAmount(swap.amountOut, token1Info.decimals)
            : `-${formatAmount(swap.amountIn, token1Info.decimals)}`,
          type: "SWAP",
          protocolVersion: "V3",
        };
      }).filter(Boolean);
    } catch (error) {
      return [];
    }
  };