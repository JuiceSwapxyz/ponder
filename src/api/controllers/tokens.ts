import { Context, Hono } from "hono";
// @ts-ignore
import { db } from "ponder:api";
// @ts-ignore
import { token } from "ponder:schema";


const tokens = new Hono();

tokens.get("/all", async (c: Context) => {
  const tokenData = await db.select().from(token);
  return c.json({ tokens: tokenData });
});

export default tokens;
