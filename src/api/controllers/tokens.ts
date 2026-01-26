import { getChainFieldByChainId } from "@/utils/chainId";
import { and, eq } from "drizzle-orm";
import { Context, Hono } from "hono";
// @ts-ignore
import { db } from "ponder:api";
// @ts-ignore
import { token } from "ponder:schema";
import { getAddress } from "viem";

const tokens = new Hono();

tokens.get("/all", async (c: Context) => {
  try {
    const tokenData = await db.select().from(token);
    return c.json({ tokens: tokenData });
  } catch (error) {
    console.error("Get all tokens error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

tokens.post("/byAddresses", async (c: Context) => {
  try {
    const body = await c.req.json();
    const { contracts } = body;

    const tokensResponse = await Promise.all(contracts.map(async (contract: { chainId: number, address: string }) => {
      const chainField = getChainFieldByChainId(contract.chainId);
      if (!chainField) {
        return null;
      }

      const tokenData = await db.select().from(token).where(and(eq(token.address, getAddress(contract.address)), eq(token.chainId, contract.chainId)));
      if (tokenData.length === 0) {
        return null;
      }

      return {
        "id": tokenData[0].id,
        "address": tokenData[0].address,
        "chain": chainField,
        "decimals": tokenData[0].decimals,
        "name": tokenData[0].name,
        "standard": "ERC20",
        "symbol": tokenData[0].symbol,
        "project": {
          "id": tokenData[0].id,
          "isSpam": false,
          "logoUrl": null,
          "name": tokenData[0].name,
          "safetyLevel": "STRONG_WARNING",
          "spamCode": 1,
          "tokens": [
            {
              "chain": chainField,
              "address": tokenData[0].address,
            }
          ],
        },
        "feeData": null,
        "protectionInfo": null
      };
    }));

    return c.json({ tokens: tokensResponse });
  } catch (error) {
    console.error("Get tokens by address error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export default tokens;
