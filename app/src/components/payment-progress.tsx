import { useColorScheme } from "nativewind";
import { CheckCircle, CircleIcon, XCircle } from "phosphor-react-native";
import { ActivityIndicator, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { PhosphorIcon } from "@/components/ui/phosphor-icon";
import { Text } from "@/components/ui/text";

/**
 * <PaymentProgress> - the processing overlay shown while a purchase is
 * being completed.
 *
 * The steps are not decoration: each maps to real work the checkout
 * performs, in the order it performs it. Showing them individually
 * matters because the slow step (reserving the seat) is a network call
 * that can genuinely fail, and a single undifferentiated spinner gives
 * the user no idea whether their card was charged when it does.
 *
 * `failedAt` marks which step broke, so a failure says "we never got
 * as far as taking payment" rather than leaving it ambiguous.
 */

export type PaymentStep = "validate" | "authorise" | "reserve" | "issue";

export const PAYMENT_STEPS: { key: PaymentStep; label: string }[] = [
  { key: "validate", label: "Checking card details" },
  { key: "authorise", label: "Authorising payment" },
  { key: "reserve", label: "Reserving your seat" },
  { key: "issue", label: "Issuing your ticket" },
];

export interface PaymentProgressProps {
  /** The step currently running. */
  current: PaymentStep;
  /** Set when a step failed; that step renders as an error. */
  failedAt?: PaymentStep | null;
  /** Shown under the steps when something went wrong. */
  errorMessage?: string | null;
}

export function PaymentProgress({ current, failedAt, errorMessage }: PaymentProgressProps) {
  const { colorScheme } = useColorScheme();
  const currentIndex = PAYMENT_STEPS.findIndex((s) => s.key === current);
  const failedIndex = failedAt ? PAYMENT_STEPS.findIndex((s) => s.key === failedAt) : -1;

  // The scrim has to follow the theme. Everything inside it is drawn
  // with theme tokens, so a fixed dark scrim turned the whole overlay
  // into dark-on-dark text under the light theme. Near-opaque rather
  // than opaque so the checkout stays faintly visible underneath and
  // the overlay reads as a layer over it, not a new screen.
  const scrim = colorScheme === "dark" ? "rgba(20,18,16,0.97)" : "rgba(242,239,230,0.97)";

  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      className="absolute inset-0 items-center justify-center px-8"
      style={{ backgroundColor: scrim }}
      accessibilityViewIsModal
      accessibilityLabel="Processing payment"
    >
      <View className="w-full max-w-[320px] gap-5">
        <View className="gap-1">
          <Text className="text-primary font-ui text-sm">Please wait</Text>
          <Text className="font-display text-3xl">
            {failedAt ? "Payment stopped" : "Processing payment"}
          </Text>
        </View>

        <View className="gap-3.5">
          {PAYMENT_STEPS.map((step, i) => {
            const failed = failedIndex === i;
            const done = failedIndex === -1 ? i < currentIndex : i < failedIndex;
            const active = !failed && i === currentIndex && failedIndex === -1;
            // Steps after a failure never ran, so they stay dimmed
            // rather than implying they were attempted.
            const pending = !failed && !done && !active;

            return (
              <Animated.View
                key={step.key}
                entering={FadeInDown.delay(i * 70).duration(220)}
                className="flex-row items-center gap-3"
              >
                <View className="h-6 w-6 items-center justify-center">
                  {active ? (
                    <ActivityIndicator
                      size="small"
                      color={colorScheme === "dark" ? "#E8FF52" : "#141210"}
                    />
                  ) : failed ? (
                    <PhosphorIcon as={XCircle} size={22} weight="fill" className="text-destructive" />
                  ) : done ? (
                    <PhosphorIcon as={CheckCircle} size={22} weight="fill" className="text-primary" />
                  ) : (
                    <PhosphorIcon as={CircleIcon} size={20} className="text-muted-foreground" />
                  )}
                </View>
                <Text
                  className={
                    failed
                      ? "text-destructive font-title text-base"
                      : active
                        ? "font-title text-base"
                        : done
                          ? "font-ui text-base"
                          : "text-muted-foreground font-sans text-base"
                  }
                  style={pending ? { opacity: 0.55 } : undefined}
                >
                  {step.label}
                </Text>
              </Animated.View>
            );
          })}
        </View>

        {errorMessage ? (
          <Text className="text-destructive font-ui text-sm">{errorMessage}</Text>
        ) : (
          <Text variant="muted" className="text-xs">
            Don't close the app. Your seat is held once reserving completes.
          </Text>
        )}
      </View>
    </Animated.View>
  );
}
