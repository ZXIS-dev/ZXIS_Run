import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "WorkoutSummary">;

export default function SummaryScreen({ navigation }: Props) {
  const summary = [
    { label: "Duration", value: "32 min", icon: "schedule" },
    { label: "Avg Heart Rate", value: "143 bpm", icon: "favorite" },
    { label: "Calories Burned", value: "245 kcal", icon: "local-fire-department" },
    { label: "Distance", value: "3.4 km", icon: "timeline" },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={28} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Workout Summary</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Great job!</Text>
        <Text style={styles.cardSubtitle}>
          Here is a quick recap of your session.
        </Text>

        {summary.map((item) => (
          <View key={item.label} style={styles.row}>
            <View style={styles.iconWrapper}>
              <Icon name={item.icon} size={26} color="#39FF14" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>{item.label}</Text>
              <Text style={styles.value}>{item.value}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate("UserBodyInfo")}
        >
          <Text style={styles.primaryText}>Start New Session</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.navigate("WorkoutDashboard")}
        >
          <Text style={styles.secondaryText}>Back to Dashboard</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0F1A",
    paddingHorizontal: 16,
    paddingTop: 40,
    gap: 20,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  card: {
    backgroundColor: "#101622",
    borderRadius: 16,
    padding: 20,
    gap: 16,
  },
  cardTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
  },
  cardSubtitle: {
    color: "#9DA6B9",
    fontSize: 14,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#1C2431",
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#1C2431",
    justifyContent: "center",
    alignItems: "center",
  },
  label: {
    color: "#9DA6B9",
    fontSize: 13,
  },
  value: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  actions: {
    gap: 12,
  },
  primaryButton: {
    height: 56,
    borderRadius: 14,
    backgroundColor: "#39FF14",
    justifyContent: "center",
    alignItems: "center",
  },
  primaryText: {
    color: "#0A0F1A",
    fontSize: 17,
    fontWeight: "700",
  },
  secondaryButton: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#3B4354",
    justifyContent: "center",
    alignItems: "center",
  },
  secondaryText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
