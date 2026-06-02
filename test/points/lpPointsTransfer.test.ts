import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm/table";
import { getAddress, zeroAddress } from "viem";

vi.mock("ponder:registry", () => ({
  ponder: {
    on: vi.fn(),
  },
}));

// `@/utils/lpValuation` resolves to the real module via the `@` alias in
// vitest.config.ts — valuation behaviour is intentionally NOT mocked.
const { handleLpTransfer } = await import("../../src/ponder/lpPoints");

const CHAIN = 4114;
const DAY = 86_400n;
const TOKEN_ID = "123";
const LP_ID = `${CHAIN}:${TOKEN_ID}`;
const POOL_ADDRESS = "0x4444444444444444444444444444444444444444";

const FROM_LOWER = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const TO_LOWER = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const OTHER_LOWER = "0xcccccccccccccccccccccccccccccccccccccccc";
const FROM = getAddress(FROM_LOWER);
const TO = getAddress(TO_LOWER);
const OTHER = getAddress(OTHER_LOWER);

type LpPositionRow = {
  id: string;
  chainId: number;
  tokenId: string;
  owner: string;
  poolAddress: string;
  usdCents: bigint;
};

type LpPositionWalletRow = {
  id: string;
  chainId: number;
  walletAddress: string;
  usdCents: bigint;
  lastEventTimestamp: bigint;
};

type LpDayCreditRow = {
  id: string;
  chainId: number;
  walletAddress: string;
  day: bigint;
};

class InMemoryLpDb {
  readonly positions = new Map<string, LpPositionRow>();
  readonly wallets = new Map<string, LpPositionWalletRow>();
  readonly dayCredits = new Map<string, LpDayCreditRow>();

  async find(table: unknown, query: { id: string }) {
    const row = this.rowsFor(table).get(query.id);
    return row ? { ...row } : undefined;
  }

  insert(table: unknown) {
    return {
      values: (row: { id: string }) => ({
        onConflictDoNothing: async () => {
          const rows = this.rowsFor(table);
          if (!rows.has(row.id)) {
            rows.set(row.id, { ...row });
          }
        },
      }),
    };
  }

  update(table: unknown, query: { id: string }) {
    return {
      set: async (patch: Record<string, unknown>) => {
        const rows = this.rowsFor(table);
        const existing = rows.get(query.id);
        if (existing) {
          rows.set(query.id, { ...existing, ...patch });
        }
      },
    };
  }

  private rowsFor(table: unknown): Map<string, any> {
    const tableName = getTableName(table as Parameters<typeof getTableName>[0]);
    if (tableName === "lp_position") return this.positions;
    if (tableName === "lp_position_wallet") return this.wallets;
    if (tableName === "lp_day_credit") return this.dayCredits;
    throw new Error(`Unexpected LP table: ${tableName}`);
  }
}

let db: InMemoryLpDb;
let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  db = new InMemoryLpDb();
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  const consoleErrorCalls = [...consoleError.mock.calls];
  consoleError.mockRestore();
  expect(consoleErrorCalls).toEqual([]);
});

function context() {
  return {
    chain: { id: CHAIN },
    db,
  };
}

function transferEvent(opts: {
  from: string;
  to: string;
  timestamp: bigint;
  tokenId?: string;
}) {
  return {
    args: {
      tokenId: BigInt(opts.tokenId ?? TOKEN_ID),
      from: opts.from,
      to: opts.to,
    },
    block: {
      timestamp: opts.timestamp,
    },
  };
}

function seedLpPosition(overrides: Partial<LpPositionRow> = {}) {
  db.positions.set(LP_ID, {
    id: LP_ID,
    chainId: CHAIN,
    tokenId: TOKEN_ID,
    owner: FROM,
    poolAddress: POOL_ADDRESS,
    usdCents: 1_500n,
    ...overrides,
  });
}

function walletId(address: string) {
  return `${CHAIN}:${address.toLowerCase()}`;
}

describe("handleLpTransfer", () => {
  it("moves a transferred LP NFT between wallet aggregates and credits only fully covered sender days", async () => {
    const oldTimestamp = 2n * DAY + 1n;
    const transferTimestamp = 5n * DAY + 10n;
    seedLpPosition();
    db.wallets.set(walletId(FROM), {
      id: walletId(FROM),
      chainId: CHAIN,
      walletAddress: FROM,
      usdCents: 2_500n,
      lastEventTimestamp: oldTimestamp,
    });

    await handleLpTransfer(
      transferEvent({ from: FROM_LOWER, to: TO_LOWER, timestamp: transferTimestamp }),
      context(),
    );

    expect(db.positions.get(LP_ID)).toEqual({
      id: LP_ID,
      chainId: CHAIN,
      tokenId: TOKEN_ID,
      owner: TO,
      poolAddress: POOL_ADDRESS,
      usdCents: 1_500n,
    });
    expect(db.wallets.get(walletId(FROM))).toEqual({
      id: walletId(FROM),
      chainId: CHAIN,
      walletAddress: FROM,
      usdCents: 1_000n,
      lastEventTimestamp: transferTimestamp,
    });
    expect(db.wallets.get(walletId(TO))).toEqual({
      id: walletId(TO),
      chainId: CHAIN,
      walletAddress: TO,
      usdCents: 1_500n,
      lastEventTimestamp: transferTimestamp,
    });
    expect([...db.dayCredits.values()]).toEqual([
      {
        id: `${CHAIN}:${FROM.toLowerCase()}:3`,
        chainId: CHAIN,
        walletAddress: FROM,
        day: 3n,
      },
      {
        id: `${CHAIN}:${FROM.toLowerCase()}:4`,
        chainId: CHAIN,
        walletAddress: FROM,
        day: 4n,
      },
    ]);
  });

  it("burns debit the current LP owner and clear the position value", async () => {
    const oldTimestamp = 7n * DAY + 1n;
    const burnTimestamp = 10n * DAY + 2n;
    seedLpPosition({ usdCents: 2_200n });
    db.wallets.set(walletId(FROM), {
      id: walletId(FROM),
      chainId: CHAIN,
      walletAddress: FROM,
      usdCents: 3_500n,
      lastEventTimestamp: oldTimestamp,
    });

    await handleLpTransfer(
      transferEvent({ from: FROM_LOWER, to: zeroAddress, timestamp: burnTimestamp }),
      context(),
    );

    expect(db.positions.get(LP_ID)).toEqual({
      id: LP_ID,
      chainId: CHAIN,
      tokenId: TOKEN_ID,
      owner: zeroAddress,
      poolAddress: POOL_ADDRESS,
      usdCents: 0n,
    });
    expect(db.wallets.get(walletId(FROM))).toEqual({
      id: walletId(FROM),
      chainId: CHAIN,
      walletAddress: FROM,
      usdCents: 1_300n,
      lastEventTimestamp: burnTimestamp,
    });
    expect([...db.dayCredits.values()]).toEqual([
      {
        id: `${CHAIN}:${FROM.toLowerCase()}:8`,
        chainId: CHAIN,
        walletAddress: FROM,
        day: 8n,
      },
      {
        id: `${CHAIN}:${FROM.toLowerCase()}:9`,
        chainId: CHAIN,
        walletAddress: FROM,
        day: 9n,
      },
    ]);
  });

  it("mint transfers from the zero address do not mutate LP position or wallet state", async () => {
    seedLpPosition({ owner: OTHER, usdCents: 1_200n });

    await handleLpTransfer(
      transferEvent({ from: zeroAddress, to: TO_LOWER, timestamp: 12n * DAY }),
      context(),
    );

    expect(db.positions.get(LP_ID)).toEqual({
      id: LP_ID,
      chainId: CHAIN,
      tokenId: TOKEN_ID,
      owner: OTHER,
      poolAddress: POOL_ADDRESS,
      usdCents: 1_200n,
    });
    expect(db.wallets.size).toBe(0);
    expect(db.dayCredits.size).toBe(0);
  });
});
