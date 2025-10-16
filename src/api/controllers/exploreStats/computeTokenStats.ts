// @ts-ignore
import { token, tokenStat } from "ponder.schema";

import { eq, and } from "ponder";
// @ts-ignore
import { db } from "ponder:api";
import { getAddress } from "viem";

export const computeTokenStatsByAddress = async (
  address: string,
  tokenMap?: Map<string, any>
) => {
  const tokenStats = await db
    .select()
    .from(tokenStat)
    .where(
      and(eq(tokenStat.type, "all-time"), eq(tokenStat.address, getAddress(address)))
    )
    .limit(1);

  if (tokenStats.length === 0) {
    return null;
  }

  const tokenDataWithMock = tokenMap
    ? getTokenStatFormatWithMock(address, tokenMap)
    : await getTokenStatFormatWithMockQuery(address);

  return {
    timestamp: tokenStats[0].timestamp.toString(),
    txCount: tokenStats[0].txCount.toString(),
    volume: tokenStats[0].volume.toString(),
    ...tokenDataWithMock,
  };
};

export const computeTokenStats = async () => {
  const [tokens, tokenStats] = await Promise.all([
    db.select().from(token),
    db
      .select()
      .from(tokenStat)
      .where(eq(tokenStat.type, "all-time")),
  ]);

  const tokenMap: Map<string, any> = new Map(
    tokens.map((t: any) => [t.address.toLowerCase(), t])
  );

  const statsMap = new Map<string, any>();
  for (const stat of tokenStats) {
    statsMap.set(stat.address.toLowerCase(), stat);
  }

  const serializedTokenStats = Array.from(statsMap.values())
    .map((stat: any) => {
      const address = stat.address;
      const tokenDataWithMock = getTokenStatFormatWithMock(address, tokenMap);

      return {
        timestamp: stat.timestamp.toString(),
        txCount: stat.txCount.toString(),
        volume: stat.volume.toString(),
        ...tokenDataWithMock,
      };
    })
    .sort((a: any, b: any) => Number(b.txCount) - Number(a.txCount));

  return serializedTokenStats;
};

function getTokenStatFormatWithMock(address: string, tokenMap: Map<string, any>) {
  const tokenData = tokenMap.get(getAddress(address).toLowerCase());
  
  if (!tokenData) {
    return null;
  }

  const { name, symbol, decimals } = tokenData;
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

async function getTokenStatFormatWithMockQuery(address: string) {
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
