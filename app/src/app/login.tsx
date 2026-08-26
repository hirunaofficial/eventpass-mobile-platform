import { useState } from "react";
import { router } from "expo-router";
import { Ticket } from "lucide-react-native";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Text } from "@/components/ui/text";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email, password);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      className="bg-background flex-1"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="gap-8 p-6">
          <View className="items-center gap-3">
            <View className="bg-primary h-14 w-14 items-center justify-center rounded-2xl">
              <Icon as={Ticket} size={26} className="text-primary-foreground" />
            </View>
            <View className="items-center gap-1">
              <Text variant="h3">Welcome back</Text>
              <Text variant="muted">Log in to discover and manage your events</Text>
            </View>
          </View>

          <View className="gap-4">
            <View className="gap-2">
              <Label>Email</Label>
              <Input
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
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="••••••••"
                editable={!submitting}
              />
            </View>
            {error ? <Text className="text-destructive">{error}</Text> : null}
            <Button onPress={handleSubmit} disabled={submitting} size="lg">
              <Text>{submitting ? "Logging in..." : "Log in"}</Text>
            </Button>
          </View>

          <View className="items-center gap-2">
            <Button variant="ghost" onPress={() => router.push("/signup")}>
              <Text>Need an account? Sign up</Text>
            </Button>
            <Button variant="ghost" size="sm" onPress={() => router.push("/staff-login")}>
              <Text variant="muted">Event staff? Check in here</Text>
            </Button>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
