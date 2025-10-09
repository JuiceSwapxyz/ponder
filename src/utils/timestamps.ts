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