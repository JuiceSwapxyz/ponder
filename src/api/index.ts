import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => {
  return c.text("JuiceSwap Ponder API v1.0.0");
});

app.get("/api/info", (c) => {
  return c.json({
    name: "JuiceSwap Ponder",
    version: "1.0.0",
    chain: "citreaTestnet",
    contracts: {
      CBTCNUSDPool: "0x6006797369E2A595D31Df4ab3691044038AAa7FE",
      CBTCcUSDPool: "0xA69De906B9A830Deb64edB97B2eb0848139306d2",
      CBTCUSDCPool: "0xD8C7604176475eB8D350bC1EE452dA4442637C09"
    }
  });
});

export default app;