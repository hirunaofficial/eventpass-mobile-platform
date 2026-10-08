/**
 * Create an account screen (Presentation layer).
 *
 * The screen owns only form state and error display. The actual auth
 * call lives in auth-context (signUp), which is the ViewModel: it talks
 * to the API, persists the token in expo-secure-store, and updates the
 * user everywhere. On success this screen navigates nowhere - AuthGate
 * in _layout.tsx reacts to the new user and redirects.
 */
import { useState } from "react";
import { router } from "expo-router";
import { Ticket } from "phosphor-react-native";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { Button } from "@/components/ui/button";
import { PhosphorIcon } from "@/components/ui/phosphor-icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Text } from "@/components/ui/text";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export default function SignupScreen() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      await signUp(email, password);
    } catch (e) {
      // ApiError carries the server's real message (including flattened
      // zod field errors); anything else is a network/unknown failure.
      setError(e instanceof ApiError ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    // KeyboardAvoidingView + ScrollView: without these the on-screen
    // keyboard covers the password field on shorter devices.
    <KeyboardAvoidingView
      className="bg-background flex-1"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="gap-9 px-6 py-10">
          <View className="gap-4">
            <View className="bg-primary h-14 w-14 items-center justify-center rounded-2xl">
              <PhosphorIcon as={Ticket} size={28} weight="fill" className="text-primary-foreground" />
            </View>
            <View className="gap-2">
              <Text variant="eyebrow">EventPass</Text>
              <Text className="font-display text-4xl">Create{"\n"}account</Text>
              <Text variant="muted">Plan your nights out and keep every ticket in one place.</Text>
            </View>
          </View>

          <View className="gap-4">
            <View className="gap-2">
              <Label>Email</Label>
              <Input
                className="bg-card"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="you@example.com"
                editable={!submitting}
              />
            </View>
            <View className="gap-2">
              <Label>Password</Label>
              <Input
                className="bg-card"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="At least 8 characters"
                editable={!submitting}
              />
            </View>
            {error ? <Text className="text-destructive">{error}</Text> : null}
            <Button onPress={handleSubmit} disabled={submitting} size="lg" className="mt-2 rounded-full">
              <Text>{submitting ? "Signing up..." : "Sign up"}</Text>
            </Button>
          </View>

          <View className="items-center">
            <Button variant="ghost" onPress={() => router.push("/login")}>
              <Text>Already have an account? Log in</Text>
            </Button>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
