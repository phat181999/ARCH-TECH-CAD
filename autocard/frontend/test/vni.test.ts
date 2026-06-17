import { convertVniToUnicode, detectVniEncoding } from "../src/canvas/vniConverter";

const tests: [string, string][] = [
  ["MAÙI NGOÙI ÑOÀNG TAÂM", "MÁI NGÓI ĐỒNG TÂM"],
  ["XAØ GOÀ THEÙP 25x25",   "XÀ GỒ THÉP 25x25"],
  ["TRAÀN THAÏCH CAO",       "TRẦN THẠCH CAO"],
  ["PHOØNG NGUÛ",            "PHÒNG NGỦ"],
  ["BEÁP",                   "BẾP"],
  ["HELLO WORLD",            "HELLO WORLD"], // no VNI → unchanged
];

console.log("=== VNI Converter Tests ===\n");

// Test detection
const vniSample = "MAÙI NGOÙI ÑOÀNG TAÂM XAØ GOÀ THEÙP TRAÀN THAÏCH CAO";
const nonVniSample = "HELLO WORLD THIS IS NORMAL TEXT";
console.log("Detection (VNI text):", detectVniEncoding(vniSample) ? "✅ DETECTED" : "❌ MISSED");
console.log("Detection (normal text):", !detectVniEncoding(nonVniSample) ? "✅ CORRECTLY IGNORED" : "❌ FALSE POSITIVE");
console.log("");

// Test conversion
let pass = 0, fail = 0;
for (const [input, expected] of tests) {
  const result = convertVniToUnicode(input);
  const ok = result === expected;
  if (ok) { pass++; } else { fail++; }
  console.log(ok ? "✅" : "❌", `"${input}" → "${result}"${ok ? "" : ` (expected "${expected}")`}`);
}

console.log(`\n${pass}/${pass + fail} tests passed`);
if (fail > 0) process.exit(1);
