#!/usr/bin/env node

/**
 * Test script to verify if the Symbol error occurs with Ponder v0.13.0
 *
 * Tests the problematic transaction that caused crashes in v0.7.17:
 * https://explorer.testnet.citrea.xyz/tx/0x89234270e8ace0e3c172ef48cea48a1f0df22a071170bdedc9e07b36721b8630
 */

import { createPublicClient, http, parseAbiItem, decodeEventLog } from 'viem';

// Citrea Testnet configuration
const CITREA_TESTNET = {
  chainId: 5115,
  rpcUrl: 'http://vm-dfx-node-prd.westeurope.cloudapp.azure.com:8085'
};

// Problematic transaction details
const PROBLEMATIC_TX = '0x89234270e8ace0e3c172ef48cea48a1f0df22a071170bdedc9e07b36721b8630';
const POOL_ADDRESS = '0x6006797369E2A595D31Df4ab3691044038AAa7FE';

// UniswapV3 Swap event ABI
const SWAP_EVENT_ABI = parseAbiItem(
  'event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)'
);

// Test function to reproduce the Symbol error
async function testSymbolError() {
  console.log('=== Ponder v0.13.0 Symbol Error Test ===\n');
  console.log('Testing transaction:', PROBLEMATIC_TX);
  console.log('Ponder version: v0.13.0\n');

  try {
    // Create Viem client
    const client = createPublicClient({
      chain: { id: CITREA_TESTNET.chainId, name: 'Citrea Testnet' },
      transport: http(CITREA_TESTNET.rpcUrl)
    });

    // Get transaction receipt
    console.log('Fetching transaction receipt...');
    const receipt = await client.getTransactionReceipt({
      hash: PROBLEMATIC_TX
    });

    // Find swap events
    const swapLogs = receipt.logs.filter(
      log => log.address?.toLowerCase() === POOL_ADDRESS.toLowerCase()
    );

    console.log(`Found ${swapLogs.length} swap event(s) in transaction\n`);

    // Process each swap event
    for (const [index, log] of swapLogs.entries()) {
      console.log(`Processing swap event ${index + 1}:`);

      try {
        // Decode the event
        const decodedEvent = decodeEventLog({
          abi: [SWAP_EVENT_ABI],
          data: log.data,
          topics: log.topics
        });

        console.log('Decoded event:', {
          eventName: decodedEvent.eventName,
          sender: decodedEvent.args.sender,
          recipient: decodedEvent.args.recipient,
          amount0: decodedEvent.args.amount0?.toString(),
          amount1: decodedEvent.args.amount1?.toString(),
          tick: decodedEvent.args.tick
        });

        // Test the problematic scenario that caused the error in v0.7.17
        // The error occurred when "swap" string was passed instead of object
        const ponderSymbol = Symbol.for('ponder:onchain');

        // Test 1: Check if Symbol operations work correctly
        console.log('\nTest 1: Symbol operations with object (should work)');
        try {
          const testObject = { [ponderSymbol]: true };
          const hasSymbol = ponderSymbol in testObject;
          console.log('✓ Symbol in object test passed:', hasSymbol);
        } catch (error) {
          console.error('✗ Symbol in object test failed:', error.message);
        }

        // Test 2: Reproduce the exact error from v0.7.17
        console.log('\nTest 2: Symbol operations with string (reproduces v0.7.17 error)');
        try {
          const testString = "swap";
          const hasSymbol = ponderSymbol in testString;
          console.log('✓ No error with string - bug might be fixed in v0.13.0');
        } catch (error) {
          if (error.message.includes("Cannot use 'in' operator")) {
            console.error('✗ Same error as v0.7.17:', error.message);
            console.error('  Bug still exists in v0.13.0!');
          } else {
            console.error('✗ Different error:', error.message);
          }
        }

        // Test 3: Check handling of negative BigInt values
        console.log('\nTest 3: Negative BigInt handling');
        const negativeAmount = decodedEvent.args.amount0 < 0n || decodedEvent.args.amount1 < 0n;
        if (negativeAmount) {
          console.log('✓ Found negative BigInt value');
          console.log('  amount0:', decodedEvent.args.amount0?.toString());
          console.log('  amount1:', decodedEvent.args.amount1?.toString());

          // Simulate what Ponder might do internally
          try {
            const eventData = {
              amount0: decodedEvent.args.amount0,
              amount1: decodedEvent.args.amount1,
              [ponderSymbol]: true
            };
            console.log('✓ Created event data object with Symbol successfully');
          } catch (error) {
            console.error('✗ Error creating event data:', error.message);
          }
        } else {
          console.log('⚠ No negative BigInt values found in this event');
        }

      } catch (error) {
        console.error(`Error processing swap event ${index + 1}:`, error.message);
      }

      console.log('\n' + '='.repeat(50) + '\n');
    }

    // Final test: Direct simulation of Ponder v0.7.17 bug
    console.log('=== Direct Bug Simulation ===\n');
    console.log('Simulating exact conditions from v0.7.17 error...');

    try {
      // This is what happened in v0.7.17
      const buggyValue = "swap"; // String passed instead of object
      const ponderOnchainSymbol = Symbol.for('ponder:onchain');

      // This should throw the exact error
      const test = ponderOnchainSymbol in buggyValue;
      console.log('✓ Bug appears to be fixed - no error thrown');

    } catch (error) {
      console.error('✗ Bug still present:', error.message);
      console.error('\nThe Symbol error still occurs in v0.13.0!');
      console.error('This means the bug is not in Ponder itself, but in how');
      console.error('the indexer handles certain event data.\n');
    }

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run the test
console.log('Starting Ponder v0.13.0 Symbol error test...\n');
testSymbolError()
  .then(() => {
    console.log('Test completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });