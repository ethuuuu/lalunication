// Run: AUTH_SECRET=x node --experimental-strip-types scripts/crypto.test.mjs
import assert from "node:assert";
import { encrypt, decrypt } from "../src/lib/crypto.ts";

const enc = encrypt("AIza-secret-key");
assert.notEqual(enc, "AIza-secret-key");
assert.equal(decrypt(enc), "AIza-secret-key");
assert.throws(() => decrypt(enc.slice(0, -4) + "AAAA")); // tampering is detected
console.log("crypto ok");
