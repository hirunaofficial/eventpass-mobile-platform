import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
      setError(e instanceof ApiError ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View className="bg-background flex-1 justify-center p-4">
      <Card>
        <CardHeader>
          <Text variant="h2">Sign up</Text>
        </CardHeader>
        <CardContent className="gap-4">
          <View className="gap-2">
            <Label>Email</Label>
            <Input
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="you@example.com"
            />
          </View>
          <View className="gap-2">
            <Label>Password</Label>
            <Input
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="At least 8 characters"
            />
          </View>
          {error ? <Text className="text-destructive">{error}</Text> : null}
          <Button onPress={handleSubmit} disabled={submitting}>
            <Text>{submitting ? "Signing up..." : "Sign up"}</Text>
          </Button>
          <Button variant="ghost" onPress={() => router.push("/login")}>
            <Text>Already have an account? Log in</Text>
          </Button>
        </CardContent>
      </Card>
    </View>
  );
}
