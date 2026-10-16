import type { CardBrand, CardDraft } from "@eventpass/shared";
import { detectBrand } from "@eventpass/shared";
import { getDb, runInTransaction } from "@/lib/db";

/**
 * Locally saved cards.
 *
 * WHAT IS STORED: brand, last four digits, expiry, cardholder name.
 * WHAT IS NOT: the card number and the CVC. Ever.
 *
 * That is not a shortcut, it is how real payment apps work. A gateway
 * returns a token standing in for the card, and the app keeps only
 * enough to show the user WHICH card they are reusing. EventPass has
 * no gateway, but storing a full PAN on the device would be the wrong
 * thing to demonstrate regardless - so the table has no column for it.
 *
 * Because the number is not retained, re-using a saved card still
 * requires the CVC to be re-entered, exactly as a real checkout does.
 *
 * Device-local only: this never syncs to the server.
 */
export interface SavedCard {
  id: string;
  brand: CardBrand;
  last4: string;
  expiry: string;
  name: string;
  createdAt: number;
}

export async function getSavedCards(): Promise<SavedCard[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: string; brand: string; last4: string;
    expiry: string; name: string; created_at: number;
  }>("SELECT * FROM saved_cards ORDER BY created_at DESC");

  return rows.map((r) => ({
    id: r.id,
    brand: r.brand as CardBrand,
    last4: r.last4,
    expiry: r.expiry,
    name: r.name,
    createdAt: r.created_at,
  }));
}

/**
 * Saves the non-sensitive remainder of a card.
 *
 * The id is derived from brand + last4 + expiry rather than being
 * random, so saving the same card twice updates one row instead of
 * filling the list with duplicates.
 */
export async function saveCard(draft: CardDraft): Promise<void> {
  const brand = detectBrand(draft.number);
  const last4 = draft.number.slice(-4);
  const id = `${brand}-${last4}-${draft.expiry}`;

  await runInTransaction(async () => {
    const db = await getDb();
    await db.runAsync(
      `INSERT OR REPLACE INTO saved_cards (id, brand, last4, expiry, name, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      id, brand, last4, draft.expiry, draft.name.trim(), Date.now()
    );
  });
}

export async function removeSavedCard(id: string): Promise<void> {
  await runInTransaction(async () => {
    const db = await getDb();
    await db.runAsync("DELETE FROM saved_cards WHERE id = ?", id);
  });
}

/** "Visa ·••• 4242" - what the user sees in the picker. */
export function describeCard(card: SavedCard): string {
  const label =
    card.brand === "amex" ? "Amex"
    : card.brand === "visa" ? "Visa"
    : card.brand === "mastercard" ? "Mastercard"
    : "Card";
  return `${label} ···· ${card.last4}`;
}
