import assert from "node:assert/strict";
import { test } from "node:test";
import {
  detectBrand,
  expiryIsValid,
  formatCardNumber,
  mockAuthorise,
  passesLuhn,
  validateCard,
  type CardDraft,
} from "./payment.js";

// Publicly documented TEST numbers from the card networks. They pass
// Luhn by construction and are not usable for real transactions.
const VISA = "4242424242424242";
const MASTERCARD = "5555555555554444";
const AMEX = "378282246310005";

const draft = (over: Partial<CardDraft> = {}): CardDraft => ({
  number: VISA,
  expiry: "12/35",
  cvc: "123",
  name: "A Perera",
  ...over,
});

test("brand is detected from the leading digits", () => {
  assert.equal(detectBrand(VISA), "visa");
  assert.equal(detectBrand(MASTERCARD), "mastercard");
  assert.equal(detectBrand(AMEX), "amex");
  assert.equal(detectBrand("6011111111111117"), "unknown");
});

test("Luhn accepts valid numbers and rejects a single mistyped digit", () => {
  assert.equal(passesLuhn(VISA), true);
  assert.equal(passesLuhn(AMEX), true);
  // One digit changed - length is still right, checksum is not.
  assert.equal(passesLuhn("4242424242424241"), false);
});

test("Luhn rejects empty and non-numeric input", () => {
  assert.equal(passesLuhn(""), false);
  assert.equal(passesLuhn("4242abcd42424242"), false);
});

test("a card is valid through the END of its expiry month", () => {
  const during = new Date(2026, 5, 20); // 20 June 2026
  assert.equal(expiryIsValid("06/26", during), true, "same month is valid");
  assert.equal(expiryIsValid("05/26", during), false, "previous month is not");
  assert.equal(expiryIsValid("07/26", during), true);
});

test("expiry rejects malformed input and impossible months", () => {
  const now = new Date(2026, 0, 1);
  assert.equal(expiryIsValid("1226", now), false);
  assert.equal(expiryIsValid("13/30", now), false);
  assert.equal(expiryIsValid("00/30", now), false);
});

test("card numbers are grouped by brand", () => {
  assert.equal(formatCardNumber(VISA), "4242 4242 4242 4242");
  assert.equal(formatCardNumber(AMEX), "3782 822463 10005");
  assert.equal(formatCardNumber("424242"), "4242 42", "partial input groups too");
});

test("a complete, valid card produces no errors", () => {
  assert.deepEqual(validateCard(draft()), []);
});

test("amex requires 15 digits and a 4-digit CVC", () => {
  assert.deepEqual(validateCard(draft({ number: AMEX, cvc: "1234" })), []);
  const errors = validateCard(draft({ number: AMEX, cvc: "123" }));
  assert.deepEqual(errors, [{ field: "cvc", message: "CVC must be 4 digits" }]);
});

test("unsupported card types are rejected even if they pass Luhn", () => {
  // A Discover test number: valid checksum, brand not accepted here.
  const errors = validateCard(draft({ number: "6011111111111117" }));
  assert.equal(errors[0]?.field, "number");
  assert.match(errors[0]!.message, /not supported/);
});

test("every problem is reported at once, not just the first", () => {
  const errors = validateCard(
    draft({ number: "4242424242424241", expiry: "01/20", cvc: "1", name: "" })
  );
  assert.deepEqual(
    errors.map((e) => e.field).sort(),
    ["cvc", "expiry", "name", "number"]
  );
});

test("the authorisation reference never contains the full card number", () => {
  const ref = mockAuthorise(draft());
  assert.match(ref, /^SIM-VISA-4242-/);
  assert.ok(!ref.includes(VISA), "full PAN must never appear in the reference");
});

/* --- demo mode (strict: false) -------------------------------------
   The checkout runs permissively because payment is simulated: there
   is no gateway downstream to reject a bad number, so requiring a real
   checksum would only force a demonstrator to memorise a test card.
   The strict rules above still exist and are still enforced here. */

test("demo mode accepts an arbitrary number of plausible length", () => {
  const d = draft({ number: "1234567890123456", cvc: "123" });
  assert.deepEqual(validateCard(d, new Date(), { strict: false }), []);
  // The same number is still rejected under the full rules.
  assert.ok(validateCard(d).length > 0);
});

test("demo mode still rejects an empty or implausible number", () => {
  const now = new Date();
  assert.equal(
    validateCard(draft({ number: "" }), now, { strict: false })[0]?.field,
    "number"
  );
  assert.equal(
    validateCard(draft({ number: "12345" }), now, { strict: false })[0]?.field,
    "number"
  );
});

test("demo mode still enforces expiry, CVC length and name", () => {
  const errors = validateCard(
    draft({ number: "1234567890123456", expiry: "01/20", cvc: "1", name: "" }),
    new Date(),
    { strict: false }
  );
  assert.deepEqual(errors.map((e) => e.field).sort(), ["cvc", "expiry", "name"]);
});
