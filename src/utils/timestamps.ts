import { getAddress } from "viem";

export const TEMPORAL_FRAMES = ["1h", "24h", "all-time"];

export const getTimestamp1hRoundedDown = (timestamp: bigint) => {
  const date = new Date(Number(timestamp) * 1000);
  const roundedDown = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(),
      date.getUTCHours(),
      0,
      0,
      0
    )
  );
  return BigInt(roundedDown.getTime() / 1000);
};

export const getTimestamp24hRoundedDown = (timestamp: bigint) => {
  const date = new Date(Number(timestamp) * 1000);
  const roundedDown = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(),
      0,
      0,
      0
    )
  );
  return BigInt(roundedDown.getTime() / 1000);
};

export const getIdByTemporalFrame = (
  address: string,
  type: string,
  timestamp: bigint
) => {
  switch (type) {
    case "1h":
      return `${getAddress(address)}-1h-${getTimestamp1hRoundedDown(
        timestamp
      )}`;
    case "24h":
      return `${getAddress(address)}-24h-${getTimestamp24hRoundedDown(
        timestamp
      )}`;
    case "all-time":
      return `${getAddress(address)}`;
  }
};