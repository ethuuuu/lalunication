// Run: node --experimental-strip-types scripts/access.test.mjs
import assert from "node:assert";
import { isAllowed, isOwner } from "../src/lib/access.ts";

process.env.ALLOWED_EMAIL = "Owner@btech.uni.in";
delete process.env.ALLOWED_DOMAIN;
const ws = (email, extra = {}) => ({ email, email_verified: true, hd: "uni.in", ...extra });

assert.equal(isAllowed(ws("friend@btech.uni.in")), true, "same domain, workspace");
assert.equal(isAllowed(ws("FRIEND@BTECH.UNI.IN")), true, "case-insensitive");
assert.equal(isAllowed(ws("x@mba.uni.in")), false, "sibling sub-domain not allowed by default");
assert.equal(isAllowed(ws("x@evilbtech.uni.in")), false, "suffix without dot boundary");
assert.equal(isAllowed(ws("x@btech.uni.in.evil.com")), false, "domain as prefix");
assert.equal(isAllowed(ws("friend@btech.uni.in", { hd: undefined })), false, "consumer account w/ uni address");
assert.equal(isAllowed(ws("friend@btech.uni.in", { email_verified: false })), false, "unverified");
assert.equal(isAllowed(ws("x@gmail.com", { hd: undefined })), false, "gmail");
assert.equal(isAllowed(undefined), false);

process.env.ALLOWED_DOMAIN = "uni.in";
assert.equal(isAllowed(ws("x@mba.uni.in")), true, "ALLOWED_DOMAIN widens to sub-domains");
assert.equal(isAllowed(ws("x@uni.in")), true);

assert.equal(isOwner("owner@btech.uni.in"), true);
assert.equal(isOwner("friend@btech.uni.in"), false);
delete process.env.ALLOWED_EMAIL;
assert.equal(isOwner("owner@btech.uni.in"), false, "no owner when unset");
console.log("access ok");
