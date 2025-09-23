import express from 'express';
import axios from 'axios';

const app = express();
app.use(express.json());

const CITREA_RPC = 'https://rpc.testnet.citrea.xyz';

app.post('/', async (req, res) => {
  try {
    const response = await axios.post(CITREA_RPC, req.body, {
      headers: { 'Content-Type': 'application/json' }
    });

    let data = response.data;

    // Fix transactionIndex in eth_getLogs responses
    if (req.body.method === 'eth_getLogs' && data.result) {
      data.result = data.result.map((log, index) => {
        // Convert the huge transactionIndex to local block index
        if (log.transactionIndex) {
          // Just use the position in the current result set as a workaround
          log.transactionIndex = '0x' + index.toString(16);
        }
        return log;
      });
    }

    // Fix transactionIndex in block responses
    if (req.body.method === 'eth_getBlockByNumber' && data.result && data.result.transactions) {
      data.result.transactions = data.result.transactions.map((tx, index) => {
        if (typeof tx === 'object') {
          tx.transactionIndex = '0x' + index.toString(16);
        }
        return tx;
      });
    }

    res.json(data);
  } catch (error) {
    console.error('Proxy error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

const PORT = 8545;
app.listen(PORT, () => {
  console.log(`RPC proxy running on http://localhost:${PORT}`);
  console.log(`Proxying to ${CITREA_RPC}`);
});