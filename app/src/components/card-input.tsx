import {
  brandRules,
  detectBrand,
  formatCardNumber,
  type CardBrand,
  type CardDraft,
  type CardFieldError,
} from "@eventpass/shared";
import { useMemo } from "react";
import { TextInput, View } from "react-native";
import { Text } from "@/components/ui/text";

/**
 * <CardInput> - hand-built card entry field.
 *
 * Not a library component and not a plain <Input>: the behaviour here
 * is the point. It reformats as you type, infers the card brand from
 * the leading digits and adapts its own rules to it (Amex is 15 digits
 * with a 4-digit CVC, everyone else 16 and 3), and enforces maximum
 * lengths so invalid input cannot be entered in the first place rather
 * than being rejected afterwards.
 *
 * It is CONTROLLED and stateless. The parent owns the draft; this
 * component owns presentation and keystroke-level transformation only.
 * That split is what lets the same validation run in tests without
 * rendering anything - see packages/shared/src/payment.ts.
 *
 * NOTE: EventPass simulates payment. No card data is transmitted or
 * stored anywhere; only a generated reference reaches the server.
 */

export interface CardInputProps {
  /** Current values. Digits-only for `number` and `cvc`. */
  value: CardDraft;
  /** Fires on every keystroke with the normalised draft. */
  onChange: (next: CardDraft) => void;
  /**
   * Errors to display, from validateCard(). Passed in rather than
   * computed internally so the parent decides WHEN to validate -
   * showing errors while someone is still typing their first digit is
   * hostile.
   */
  errors?: CardFieldError[];
  /** Disables every field while a payment is in flight. */
  disabled?: boolean;
}

const BRAND_LABEL: Record<CardBrand, string> = {
  visa: "VISA",
  mastercard: "Mastercard",
  amex: "Amex",
  unknown: "",
};

/** Strips everything that is not a digit, then caps at `max`. */
function digitsOnly(text: string, max: number): string {
  return text.replace(/\D/g, "").slice(0, max);
}

/**
 * Expiry behaves like every real card form: the slash appears on its
 * own after the month, and deleting back through it removes the month
 * digit rather than stranding the user on a lone "/".
 */
function formatExpiry(text: string, previous: string): string {
  const digits = digitsOnly(text, 4);
  if (previous.endsWith("/") && text.length < previous.length) {
    return digits.slice(0, 1);
  }
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function Field({
  label,
  error,
  children,
  className,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <View className={className}>
      <Text className="text-muted-foreground font-ui mb-1.5 text-sm">{label}</Text>
      {children}
      {error ? (
        <Text className="text-destructive font-ui mt-1 text-xs">{error}</Text>
      ) : null}
    </View>
  );
}

export function CardInput({ value, onChange, errors = [], disabled }: CardInputProps) {
  const brand = detectBrand(value.number);
  const rules = brandRules(brand);

  const errorFor = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of errors) map.set(e.field, e.message);
    return map;
  }, [errors]);

  const inputClass =
    "border-border bg-card text-foreground font-sans rounded-md border px-3 py-3 text-base";

  return (
    <View className="gap-4">
      <Field label="Card number" error={errorFor.get("number")}>
        <View className="relative">
          <TextInput
            value={formatCardNumber(value.number)}
            onChangeText={(t) => onChange({ ...value, number: digitsOnly(t, rules.length) })}
            placeholder="4242 4242 4242 4242"
            placeholderTextColor="#8A8276"
            keyboardType="number-pad"
            editable={!disabled}
            className={inputClass}
            accessibilityLabel="Card number"
          />
          {/* Brand label appears only once the number identifies one -
              immediate feedback that the right card was recognised. */}
          {brand !== "unknown" ? (
            <View className="absolute right-3 top-0 bottom-0 justify-center">
              <Text className="text-primary font-title text-xs">{BRAND_LABEL[brand]}</Text>
            </View>
          ) : null}
        </View>
      </Field>

      <View className="flex-row gap-3">
        <Field label="Expiry" error={errorFor.get("expiry")} className="flex-1">
          <TextInput
            value={value.expiry}
            onChangeText={(t) => onChange({ ...value, expiry: formatExpiry(t, value.expiry) })}
            placeholder="MM/YY"
            placeholderTextColor="#8A8276"
            keyboardType="number-pad"
            editable={!disabled}
            className={inputClass}
            accessibilityLabel="Expiry date"
          />
        </Field>

        <Field label="CVC" error={errorFor.get("cvc")} className="flex-1">
          <TextInput
            value={value.cvc}
            onChangeText={(t) => onChange({ ...value, cvc: digitsOnly(t, rules.cvc) })}
            // The placeholder itself tells you the expected length,
            // which changes when an Amex number is entered.
            placeholder={rules.cvc === 4 ? "••••" : "•••"}
            placeholderTextColor="#8A8276"
            keyboardType="number-pad"
            secureTextEntry
            editable={!disabled}
            className={inputClass}
            accessibilityLabel="Security code"
          />
        </Field>
      </View>

      <Field label="Name on card" error={errorFor.get("name")}>
        <TextInput
          value={value.name}
          onChangeText={(t) => onChange({ ...value, name: t })}
          placeholder="As printed on the card"
          placeholderTextColor="#8A8276"
          autoCapitalize="words"
          editable={!disabled}
          className={inputClass}
          accessibilityLabel="Name on card"
        />
      </Field>
    </View>
  );
}
