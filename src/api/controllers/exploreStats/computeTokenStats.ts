// @ts-ignore
import { token, tokenStat } from "ponder.schema";

import { desc, eq, and } from "ponder";
// @ts-ignore
import { db } from "ponder:api";
import { getAddress } from "viem";

export const computeTokenStatsByAddress = async (address: string) => {
  const tokenStats = await db
    .select()
    .from(tokenStat)
    .where(
      and(eq(tokenStat.type, "1h"), eq(tokenStat.address, getAddress(address)))
    )
    .orderBy(desc(tokenStat.timestamp))
    .limit(1);

  if (tokenStats.length === 0) {
    return null;
  }

  const tokenDataWithMock = await getTokenStatFormatWithMock(address);

  return {
    timestamp: tokenStats[0].timestamp.toString(),
    txCount: tokenStats[0].txCount.toString(),
    volume: tokenStats[0].volume.toString(),
    ...tokenDataWithMock,
  };
};

export const computeTokenStats = async () => {
  const tokenStats = await db
    .select()
    .from(tokenStat)
    .where(and(eq(tokenStat.type, "1h")))
    .orderBy(desc(tokenStat.timestamp))
    .limit(50);

  const tokenStatsByAddress: string[] = tokenStats
    .reduce(
      (
        acc: { address: string; txCount: number }[],
        stat: { address: string; txCount: number }
      ) => {
        const existing = acc.find(
          (item: { address: string }) => item.address === stat.address
        );
        if (existing) {
          existing.txCount += stat.txCount;
        } else {
          acc.push({ ...stat });
        }
        return acc;
      },
      []
    )
    .sort(
      (a: { txCount: number }, b: { txCount: number }) =>
        Number(b.txCount) - Number(a.txCount)
    )
    .map((stat: { address: string }) => stat.address)
    .slice(0, 5);

  const serializedTokenStats = tokenStatsByAddress.map(
    async (address: string) => {
      const stats = tokenStats.find(
        (stat: { address: string }) => stat.address === address
      );

      const tokenDataWithMock = await getTokenStatFormatWithMock(address);

      return {
        timestamp: stats.timestamp.toString(),
        txCount: stats.txCount.toString(),
        volume: stats.volume.toString(),
        ...tokenDataWithMock,
      };
    }
  );

  return Promise.all(serializedTokenStats);
};

async function getTokenStatFormatWithMock(address: string) {
  const tokenData = await db
    .select()
    .from(token)
    .where(eq(token.address, getAddress(address)));

  const { name, symbol, decimals } = tokenData[0];
  return {
    chain: "CITREA_TESTNET",
    address: address,
    name: name,
    symbol: symbol,
    logo: "",
    decimals: decimals,
    project: {
      logo: {
        url: "",
      },
      name: name,
      isSpam: false,
      safetyLevel: "STRONG_WARNING",
    },
    standard: "ERC20",
    price: {
      currency: "USD",
      value: 0,
    },
    pricePercentChange1Hour: {
      currency: "USD",
      value: 0,
    },
    pricePercentChange1Day: {
      currency: "USD",
      value: 0,
    },
    pricePercentChange1Week: {
      currency: "USD",
      value: 0,
    },
    pricePercentChange1Month: {
      currency: "USD",
      value: 0,
    },
    pricePercentChange1Year: {
      currency: "USD",
      value: 0,
    },
    volume1Hour: {
      currency: "USD",
      value: 0,
    },
    volume1Day: {
      currency: "USD",
      value: 0,
    },
    volume1Week: {
      currency: "USD",
      value: 0,
    },
    volume1Month: {
      currency: "USD",
      value: 0,
    },
    volume1Year: {
      currency: "USD",
      value: 0,
    },
    priceHistoryHour: {
      start: 0,
      end: 0,
      step: 300,
      values: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
    priceHistoryDay: {
      start: 0,
      end: 0,
      step: 1200,
      values: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
    priceHistoryWeek: {
      start: 0,
      end: 0,
      step: 7200,
      values: [
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0,
      ],
    },
    priceHistoryMonth: {
      start: 0,
      end: 0,
      step: 7200,
      values: [
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0,
      ],
    },
    priceHistoryYear: {
      start: 0,
      end: 0,
      step: 172800,
      values: [
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0,
      ],
    },
  };
}
