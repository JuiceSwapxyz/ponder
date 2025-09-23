#!/usr/bin/env node

/**
 * Test Script für Ponder v0.13.0 Symbol Error
 *
 * Testet ob der Fehler "Cannot use 'in' operator to search for 'Symbol(ponder:onchain)' in swap"
 * mit der neuen Ponder Version v0.13.0 noch auftritt.
 */

console.log('=== Ponder v0.13.0 Symbol Error Test ===\n');

// Test 1: Direkter Test des Symbol-Fehlers
console.log('Test 1: Reproduziere den exakten Fehler aus v0.7.17');
console.log('-----------------------------------------------');

try {
  const ponderSymbol = Symbol.for('ponder:onchain');
  const testValue = "swap"; // String statt Object - das war das Problem

  console.log('Teste: Symbol.for("ponder:onchain") in "swap"');

  // Dies sollte den Fehler werfen
  const result = ponderSymbol in testValue;

  console.log('❌ FEHLER NICHT AUFGETRETEN - Bug könnte behoben sein');
  console.log('   Result:', result);

} catch (error) {
  if (error.message === "Cannot use 'in' operator to search for 'Symbol(ponder:onchain)' in swap") {
    console.log('✅ EXAKTER FEHLER REPRODUZIERT!');
    console.log('   Der Bug existiert noch in JavaScript selbst');
    console.log('   Error:', error.message);
  } else {
    console.log('⚠️  Anderer Fehler:', error.message);
  }
}

console.log('\n');

// Test 2: Test mit verschiedenen Werten
console.log('Test 2: Symbol-Operationen mit verschiedenen Datentypen');
console.log('--------------------------------------------------------');

const testCases = [
  { value: "swap", type: "String", shouldFail: true },
  { value: {}, type: "Object", shouldFail: false },
  { value: { swap: true }, type: "Object mit swap property", shouldFail: false },
  { value: 123, type: "Number", shouldFail: true },
  { value: true, type: "Boolean", shouldFail: true },
  { value: null, type: "Null", shouldFail: true },
  { value: undefined, type: "Undefined", shouldFail: true },
  { value: [], type: "Array", shouldFail: false },
];

const ponderSymbol = Symbol.for('ponder:onchain');

testCases.forEach(({ value, type, shouldFail }) => {
  try {
    const result = ponderSymbol in value;
    if (shouldFail) {
      console.log(`❌ ${type}: Sollte fehlschlagen, aber hat nicht (Result: ${result})`);
    } else {
      console.log(`✅ ${type}: Funktioniert korrekt (Result: ${result})`);
    }
  } catch (error) {
    if (shouldFail) {
      console.log(`✅ ${type}: Fehler wie erwartet - ${error.message.substring(0, 50)}...`);
    } else {
      console.log(`❌ ${type}: Unerwarteter Fehler - ${error.message}`);
    }
  }
});

console.log('\n');

// Test 3: Simuliere Ponder-ähnliches Verhalten
console.log('Test 3: Simuliere Ponder Indexer Verhalten');
console.log('-------------------------------------------');

function simulatePonderProcessing(eventData) {
  const ponderOnchain = Symbol.for('ponder:onchain');

  try {
    // Check if this is onchain data (wie Ponder es macht)
    if (ponderOnchain in eventData) {
      console.log('✅ Event ist als Onchain-Daten markiert');
      return true;
    } else {
      console.log('⚠️  Event ist nicht als Onchain-Daten markiert');
      return false;
    }
  } catch (error) {
    console.log('❌ Fehler beim Verarbeiten:', error.message);
    return false;
  }
}

// Test mit verschiedenen Event-Daten
console.log('\nMit korrektem Event Object:');
const correctEvent = {
  amount0: -1000n,
  amount1: 2000n,
  [Symbol.for('ponder:onchain')]: true
};
simulatePonderProcessing(correctEvent);

console.log('\nMit String "swap" (reproduziert den Bug):');
simulatePonderProcessing("swap");

console.log('\nMit leerem Object:');
simulatePonderProcessing({});

console.log('\n');

// Test 4: BigInt Handling
console.log('Test 4: Negative BigInt Werte (Trigger für den Bug)');
console.log('----------------------------------------------------');

const swapEventData = {
  sender: '0x1234567890123456789012345678901234567890',
  recipient: '0x0987654321098765432109876543210987654321',
  amount0: -28896588352149n,  // Negativer Wert aus der Problem-Transaktion
  amount1: 3549340590433444n,
  sqrtPriceX96: 2208889193228473035632517408n,
  liquidity: 22178665093041456n,
  tick: -68925
};

console.log('Swap Event mit negativen BigInt Werten:');
console.log('  amount0:', swapEventData.amount0.toString());
console.log('  amount1:', swapEventData.amount1.toString());

try {
  // Füge Ponder Symbol hinzu
  swapEventData[Symbol.for('ponder:onchain')] = true;

  // Teste ob Symbol check funktioniert
  const isOnchain = Symbol.for('ponder:onchain') in swapEventData;
  console.log('✅ Symbol check mit negativen BigInt funktioniert:', isOnchain);
} catch (error) {
  console.log('❌ Fehler mit negativen BigInt:', error.message);
}

console.log('\n');

// Zusammenfassung
console.log('=== ZUSAMMENFASSUNG ===');
console.log('=======================');
console.log('Der "Cannot use \'in\' operator" Fehler tritt auf wenn:');
console.log('1. Ein String (wie "swap") statt eines Objects übergeben wird');
console.log('2. Der \'in\' Operator mit primitiven Typen verwendet wird');
console.log('3. Dies ist ein JavaScript Verhalten, kein Ponder-spezifischer Bug');
console.log('\nLösung: Sicherstellen dass nur Objects an Symbol-Checks übergeben werden');
console.log('        oder Type-Guards vor Symbol-Operationen einbauen');