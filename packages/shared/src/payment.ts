/* ===================================================================
   SIMULATED PAYMENT VALIDATION

   EventPass does NOT process real payments and never transmits or
   stores card data. This module validates the SHAPE of card input so
   the checkout flow behaves like a real one - formatting, brand
   detection, inline errors - while the "authorisation" is generated
   locally and only a reference string ever reaches the server.

   It is the project's second constraint system, and deliberately the
   same style as clash.ts: pure functions, zero I/O, shared by client
   and server, covered by unit tests. The constraints here are
   arithmetic and calendar rules rather than scheduling ones.
   =================================================================== */

export type CardBrand = "visa" | "mastercard" | "amex" | "unknown";

export interface CardDraft {
  /** Digits only, no spaces. */
  number: string;
  /** "MM/YY" as typed. */
  expiry: string;
  cvc: string;
  name: string;
}

export type CardFieldError =
  | { field: "number"; message: string }
  | { field: "expiry"; message: string }
  | { field: "cvc"; message: string }
  | { field: "name"; message: string };

/**
 * Brand from the Issuer Identification Number (the leading digits).
 * Only the three brands the mock accepts are detected; anything else
 * is "unknown" and rejected, so the demo cannot be fed arbitrary
 * numbers that happen to pass the checksum.
 */
export function detectBrand(digits: string): CardBrand {
  if (/^4/.test(digits)) return "visa";
  if (/^(5[1-5]|2[2-7])/.test(digits)) return "mastercard";
  if (/^3[47]/.test(digits)) return "amex";
  return "unknown";
}

/** Amex is 15 digits and uses a 4-digit CVC; the others 16 and 3. */
export function brandRules(brand: CardBrand): { length: number; cvc: number } {
  return brand === "amex" ? { length: 15, cvc: 4 } : { length: 16, cvc: 3 };
}

/**
 * Luhn checksum - the real algorithm used by every card network.
 *
 * Walking right to left, double every second digit; if doubling takes
 * it above 9, subtract 9 (equivalent to summing its two digits). A
 * valid number's total is divisible by 10. This is what catches a
 * mistyped digit, which a pure length check cannot.
 */
export function passesLuhn(digits: string): boolean {
  if (digits.length === 0) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (d < 0 || d > 9) return false;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

/**
 * Expiry must parse as MM/YY and not be in the past. A card is valid
 * through the END of its expiry month, so the comparison is against
 * the first day of the FOLLOWING month.
 */
export function expiryIsValid(expiry: string, now: Date = new Date()): boolean {
  const match = /^(\d{2})\/(\d{2})$/.exec(expiry);
  if (!match) return false;
  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  if (month < 1 || month > 12) return false;
  const expiresAfter = new Date(year, month, 1);
  return expiresAfter.getTime() > now.getTime();
}

/** Groups digits for display: 4-4-4-4, or 4-6-5 for Amex. */
export function formatCardNumber(digits: string): string {
  const groups = detectBrand(digits) === "amex" ? [4, 6, 5] : [4, 4, 4, 4];
  const out: string[] = [];
  let i = 0;
  for (const size of groups) {
    if (i >= digits.length) break;
    out.push(digits.slice(i, i + size));
    i += size;
  }
  return out.join(" ");
}

export interface ValidateOptions {
  /**
   * `true` (the default) applies the full rules: recognised brand,
   * exact brand length, Luhn checksum, brand-specific CVC length.
   *
   * `false` is DEMO MODE. It keeps the structural checks - something
   * was entered, a plausible card length, a future expiry, a CVC, a
   * name - but drops the two rules that reject an arbitrary number:
   * brand recognition and the Luhn checksum.
   *
   * Demo mode exists because EventPass simulates payment. There is no
   * gateway to reject a bad number downstream, so enforcing a real
   * checksum would only mean a demonstrator has to memorise a specific
   * test number to show the flow. The rules themselves remain
   * implemented and tested either way; this only decides whether they
   * BLOCK submission or merely inform the display.
   */
  strict?: boolean;
}

/** Any real card number is 13-19 digits (ISO/IEC 7812). */
const MIN_PAN = 13;
const MAX_PAN = 19;

/**
 * Full validation. Returns every problem rather than the first, so the
 * form can mark all offending fields at once instead of making the
 * user fix them one submission at a time.
 */
export function validateCard(
  draft: CardDraft,
  now: Date = new Date(),
  options: ValidateOptions = {}
): CardFieldError[] {
  const strict = options.strict ?? true;
  const errors: CardFieldError[] = [];
  const brand = detectBrand(draft.number);
  const rules = brandRules(brand);

  if (draft.number.length === 0) {
    errors.push({ field: "number", message: "Enter a card number" });
  } else if (strict) {
    if (brand === "unknown") {
      errors.push({ field: "number", message: "Card type not supported" });
    } else if (draft.number.length !== rules.length) {
      errors.push({
        field: "number",
        message: `${brand === "amex" ? "Amex" : "This card"} needs ${rules.length} digits`,
      });
    } else if (!passesLuhn(draft.number)) {
      errors.push({ field: "number", message: "Check the card number" });
    }
  } else if (draft.number.length < MIN_PAN || draft.number.length > MAX_PAN) {
    errors.push({ field: "number", message: `Enter ${MIN_PAN}-${MAX_PAN} digits` });
  }

  if (!expiryIsValid(draft.expiry, now)) {
    errors.push({ field: "expiry", message: "Enter a valid future date" });
  }

  // Demo mode accepts either common CVC length rather than tying it to
  // a brand that may not have been recognised.
  const cvcOk = strict
    ? draft.cvc.length === rules.cvc
    : draft.cvc.length >= 3 && draft.cvc.length <= 4;
  if (!cvcOk) {
    errors.push({
      field: "cvc",
      message: strict ? `CVC must be ${rules.cvc} digits` : "CVC must be 3 or 4 digits",
    });
  }

  if (draft.name.trim().length < 2) {
    errors.push({ field: "name", message: "Enter the name on the card" });
  }

  return errors;
}

/**
 * Stands in for a payment gateway authorisation.
 *
 * Only this reference is ever sent to the server - never the card
 * number. A real integration would swap this function for a call to
 * Stripe or similar and keep the rest of the flow unchanged, which is
 * the point of isolating it here.
 */
export function mockAuthorise(draft: CardDraft): string {
  const last4 = draft.number.slice(-4);
  const stamp = Date.now().toString(36).toUpperCase();
  return `SIM-${detectBrand(draft.number).toUpperCase()}-${last4}-${stamp}`;
}
