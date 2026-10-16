import { useState } from "react";
import { router } from "expo-router";
import { ShieldCheck } from "phosphor-react-native";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { Button } from "@/components/ui/button";
import { PhosphorIcon } from "@/components/ui/phosphor-icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Text } from "@/components/ui/text";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export default function StaffLoginScreen() {
  const { signIn, signOut } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const signedInUser = await signIn(email, password);
      if (signedInUser.role !== "staff") {
        // Not a scope-widening exploit- requireStaff on the server already
        // blocks non-staff from actually checking anyone in. This is just
        // about not leaving an attendee "logged in" on the staff screen,
        // which would otherwise sit there looking broken with no obvious
        // way forward.
        await signOut();
        setError("This account isn't registered as staff.");
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    // Deliberately dark, unlike every attendee screen- staff surfaces stay
    // dark end-to-end (this screen -> the scanner) so it's visually
    // unmistakable which "mode" you're in, no label required.
    <KeyboardAvoidingView className="bg-primary flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="gap-9 px-6 py-10">
          <View className="items-center gap-3">
            <View className="bg-primary-foreground h-14 w-14 items-center justify-center rounded-md">
              <PhosphorIcon as={ShieldCheck} size={28} weight="fill" className="text-primary" />
            </View>
            <View className="items-center gap-1">
              <Text className="text-primary-foreground font-display text-center text-3xl">
                Staff Check-In
              </Text>
              <Text className="text-primary-foreground/70 text-center">
                For event staff scanning tickets at the door
              </Text>
            </View>
          </View>

          <View className="gap-4">
            <View className="gap-2">
              <Label className="text-primary-foreground">Email</Label>
              <Input
                className="border-foreground/20 bg-foreground/5 text-primary-foreground"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="staff@eventpass.dev"
                editable={!submitting}
              />
            </View>
            <View className="gap-2">
              <Label className="text-primary-foreground">Password</Label>
              <Input
                className="border-foreground/20 bg-foreground/5 text-primary-foreground"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="••••••••"
                editable={!submitting}
              />
            </View>
            {error ? <Text className="text-destructive">{error}</Text> : null}
            {/* Staff chrome is INVERTED - acid background, dark button -
                so the label has to be light. Without the explicit colour
                it inherits `text-primary-foreground`, which is dark, and
                the button renders with no visible text at all. */}
            <Button
              className="bg-primary-foreground mt-2 rounded-md"
              onPress={handleSubmit}
              loading={submitting}
              size="lg"
            >
              <Text className="text-primary font-title">
                {submitting ? "Checking..." : "Continue"}
              </Text>
            </Button>
          </View>

          <View className="items-center">
            <Button variant="ghost" onPress={() => router.push("/login")}>
              <Text className="text-primary-foreground/70">Not staff? Attendee log in</Text>
            </Button>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
