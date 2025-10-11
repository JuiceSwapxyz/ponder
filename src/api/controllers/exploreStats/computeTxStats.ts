import { desc, eq } from "ponder";
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
  
      return await Promise.all(
        swaps.map(async (swap: any) => {
          const [token0Addr, token1Addr] = [swap.tokenIn, swap.tokenOut].sort();
  
          const [token0Info, token1Info] = await Promise.all([
            db
              .select()
              .from(token)
              .where(eq(token.address, getAddress(token0Addr))),
            db
              .select()
              .from(token)
              .where(eq(token.address, getAddress(token1Addr))),
          ]);
  
          const formatAmount = (amount: bigint, decimals: number) =>
            (Number(amount) / Math.pow(10, decimals)).toString();
  
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
              address: token0Info[0].address,
              symbol: token0Info[0].symbol,
              decimals: token0Info[0].decimals,
              project: {
                logo: {},
                name: token0Info[0].name,
                isSpam: false,
                safetyLevel: "STRONG_WARNING",
              },
            },
            token0Quantity: isToken0Input
              ? `-${formatAmount(swap.amountIn, token0Info[0].decimals)}`
              : formatAmount(swap.amountOut, token0Info[0].decimals),
            token1: {
              chain: "CITREA_TESTNET",
              address: token1Info[0].address,
              symbol: token1Info[0].symbol,
              decimals: token1Info[0].decimals,
              project: {
                logo: {},
                name: token1Info[0].name,
                isSpam: false,
                safetyLevel: "STRONG_WARNING",
              },
            },
            token1Quantity: isToken0Input
              ? formatAmount(swap.amountOut, token1Info[0].decimals)
              : `-${formatAmount(swap.amountIn, token1Info[0].decimals)}`,
            type: "SWAP",
            protocolVersion: "V3",
          };
        })
      );
    } catch (error) {
      return [];
    }
  };