import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { RootStackParamList } from "../types/navigation";
import { useWorkout } from "../context/WorkoutProvider";

type Props = NativeStackScreenProps<RootStackParamList, "WorkoutSummary">;

export default function SummaryScreen({ navigation }: Props) {
  const { workoutSession } = useWorkout();

  // 운동 시간 포맷팅
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}분 ${secs}초`;
  };

  // 기본값 (세션이 없을 경우)
  const duration = workoutSession ? formatDuration(workoutSession.duration) : "--";
  const avgHeartRate = workoutSession ? `${workoutSession.avgHeartRate} bpm` : "-- bpm";
  const caloriesBurned = workoutSession ? `${workoutSession.caloriesBurned} kcal` : "-- kcal";
  const distance = workoutSession ? `${workoutSession.totalDistance} km` : "-- km";

  const summary = [
    { label: "운동 시간", value: duration, icon: "schedule" },
    { label: "평균 심박수", value: avgHeartRate, icon: "favorite" },
    { label: "소모 칼로리", value: caloriesBurned, icon: "local-fire-department" },
    { label: "이동 거리", value: distance, icon: "timeline" },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={28} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>운동 요약</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>수고하셨습니다!</Text>
        <Text style={styles.cardSubtitle}>
          오늘 운동의 간략한 요약입니다.
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

        {workoutSession && workoutSession.maxHeartRate > 0 && (
          <View style={styles.additionalStats}>
            <Text style={styles.additionalLabel}>추가 통계</Text>
            <Text style={styles.additionalText}>
              최대 심박수: {workoutSession.maxHeartRate} bpm
            </Text>
            <Text style={styles.additionalText}>
              최소 심박수: {workoutSession.minHeartRate} bpm
            </Text>
          </View>
        )}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate("UserBodyInfo")}
        >
          <Text style={styles.primaryText}>새 세션 시작</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.navigate("WorkoutDashboard")}
        >
          <Text style={styles.secondaryText}>대시보드로 돌아가기</Text>
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
  additionalStats: {
    marginTop: 8,
    padding: 12,
    backgroundColor: "#1C2431",
    borderRadius: 12,
  },
  additionalLabel: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  additionalText: {
    color: "#9DA6B9",
    fontSize: 13,
    marginTop: 4,
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