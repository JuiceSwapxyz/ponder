import { Context, Hono } from "hono";
// @ts-ignore
import { db } from "ponder:api";
// @ts-ignore
import { token } from "ponder:schema";

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

export default tokens;
