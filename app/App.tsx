import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";
import type { Event } from "@eventpass/shared";

const placeholderEvent: Pick<Event, "title"> = {
  title: "EventPass",
};

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{placeholderEvent.title}</Text>
      <Text style={styles.subtitle}>Smart Event Discovery & Ticketing</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
});
