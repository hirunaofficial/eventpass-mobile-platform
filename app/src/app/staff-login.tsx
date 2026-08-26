import { useState } from "react";
import { router } from "expo-router";
import { ShieldCheck } from "lucide-react-native";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
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
    <KeyboardAvoidingView className="flex-1 bg-black" behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="gap-8 p-6">
          <View className="items-center gap-3">
            <View className="bg-primary h-14 w-14 items-center justify-center rounded-2xl">
              <Icon as={ShieldCheck} size={26} className="text-primary-foreground" />
            </View>
            <View className="items-center gap-1">
              <Text className="text-white" variant="h3">
                Staff Check-In
              </Text>
              <Text className="text-center text-white/60">
                For event staff scanning tickets at the door
              </Text>
            </View>
          </View>

          <View className="gap-4">
            <View className="gap-2">
              <Label className="text-white">Email</Label>
              <Input
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="staff@eventpass.dev"
                editable={!submitting}
              />
            </View>
            <View className="gap-2">
              <Label className="text-white">Password</Label>
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
              <Text>{submitting ? "Checking..." : "Continue"}</Text>
            </Button>
          </View>

          <View className="items-center">
            <Button variant="ghost" onPress={() => router.push("/login")}>
              <Text className="text-white/70">Not staff? Attendee log in</Text>
            </Button>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
