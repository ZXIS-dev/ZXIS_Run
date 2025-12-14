import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import { VictoryLine } from "victory-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { RootStackParamList } from "../types/navigation";
import { useWorkout } from "../context/WorkoutProvider";

type Props = NativeStackScreenProps<RootStackParamList, "WorkoutDashboard">;

type ChartPoint = { x: number; y: number };

export default function WorkoutDashboardScreen({ navigation }: Props) {
  const {
    heartRate,
    targetHr,
    speed,
    // ecgHistory,  // <= 이제 안 씀
    adjustSpeed,
    sendTargetHr,
    emergencyStop,
    connectionState,
  } = useWorkout();

  const [chartData, setChartData] = useState<ChartPoint[]>([]);

  // 속도 표시용 (NaN 방지)
  const displaySpeed = useMemo(
    () => (Number.isFinite(speed) ? speed : 0),
    [speed]
  );

  // 🔥 heartRate가 바뀔 때마다 로컬 차트 히스토리 쌓기
  useEffect(() => {
    if (heartRate == null || !Number.isFinite(heartRate)) return;

    setChartData((prev) => {
      const nextX = prev.length ? prev[prev.length - 1].x + 1 : 0;
      const next = [...prev, { x: nextX, y: heartRate }];
      // 최근 60개만 유지 (원하면 조절)
      return next.slice(-60);
    });
  }, [heartRate]);

  const connectionLabel = useMemo(() => {
    if (connectionState === "connected") return "아두이노 연결됨";
    if (connectionState === "connecting") return "연결 중...";
    return "미연결 상태";
  }, [connectionState]);

  return (
    <View style={styles.container}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.topTitle}>대시보드</Text>
          <Text style={styles.topSubtitle}>{connectionLabel}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Current HR */}
        <View style={styles.hrCard}>
          <Text style={styles.label}>현재 심박수</Text>

          <View style={styles.hrRow}>
            <Icon
              name="favorite"
              size={48}
              color="#FF3B30"
              style={styles.pulse}
            />
            <Text style={styles.hrValue}>
              {heartRate != null ? heartRate : "--"}
            </Text>
          </View>

          <Text style={styles.label}>BPM</Text>
        </View>

        {/* Trend Chart */}
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>심박수 변화 그래프</Text>
            <Text style={styles.chartSub}>최근 5분</Text>
          </View>

          <Text style={styles.targetText}>
            목표 심박수: {targetHr ?? "Set after profile/purpose"}
          </Text>

          <View style={{ height: 180, padding: 20 }}>
            {chartData.length > 1 ? (
              <VictoryLine
                interpolation="natural"
                data={chartData}
                style={{
                  data: { stroke: "#39FF14", strokeWidth: 3 },
                }}
              />
            ) : (
              <Text style={styles.chartPlaceholder}>
                ECG 데이터를 기다리는 중...
              </Text>
            )}
          </View>

          <View style={styles.chartTimeRow}>
            <Text style={styles.timeLabel}>5:00</Text>
            <Text style={styles.timeLabel}>4:00</Text>
            <Text style={styles.timeLabel}>3:00</Text>
            <Text style={styles.timeLabel}>2:00</Text>
            <Text style={styles.timeLabel}>1:00</Text>
            <Text style={styles.timeLabel}>Now</Text>
          </View>

        </View>

        {/* Current Speed */}
        <View style={styles.speedCard}>
          <Text style={styles.label}>현재 속도</Text>

          <View style={styles.speedRow}>
            <Text style={styles.speedValue}>{displaySpeed.toFixed(1)}</Text>
            <Text style={styles.speedUnit}>MPH</Text>
          </View>
        </View>

        {/* Manual Speed Controls */}
        <View style={styles.speedButtons}>
          <TouchableOpacity
            style={styles.speedBtn}
            onPress={() => adjustSpeed(-0.5)}
          >
            <Icon name="remove" size={40} color="#007BFF" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.speedBtn}
            onPress={() => adjustSpeed(0.5)}
          >
            <Icon name="add" size={40} color="#007BFF" />
          </TouchableOpacity>
        </View>

        {/* Send Target HR */}
        <TouchableOpacity style={styles.sendButton} onPress={sendTargetHr}>
          <Text style={styles.sendText}>
            목표 심박수 전송 ({targetHr ?? "?"} bpm)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.summaryButton}
          onPress={() => navigation.navigate("WorkoutSummary")}
        >
          <Text style={styles.summaryText}>요약 보기</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Emergency Stop Button */}
      <TouchableOpacity style={styles.emergencyButton} onPress={emergencyStop}>
        <Icon name="emergency" size={36} color="#FFFFFF" />
        <Text style={styles.emergencyText}>비상 정지</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1A2B48",
  },

  /* Top Bar */
  topBar: {
    paddingTop: 40,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  topTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  topSubtitle: {
    color: "#9DA6B9",
    fontSize: 12,
    textAlign: "center",
  },

  /* Content */
  content: {
    padding: 16,
    gap: 20,
    paddingBottom: 120,
  },

  /* HR Card */
  hrCard: {
    backgroundColor: "#FFFFFF",
    padding: 24,
    borderRadius: 16,
    alignItems: "center",
  },
  label: {
    color: "#7C8798",
    fontSize: 14,
  },
  hrRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginVertical: 8,
  },
  pulse: {
    transform: [{ scale: 1 }],
  },
  hrValue: {
    fontSize: 60,
    fontWeight: "700",
    color: "#1A1A1A",
  },

  /* Chart Card */
  chartCard: {
    backgroundColor: "#FFFFFF",
    padding: 20,
    borderRadius: 16,
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  chartTitle: {
    color: "#1A1A1A",
    fontSize: 18,
    fontWeight: "600",
  },
  chartSub: {
    color: "#9DA6B9",
    fontSize: 14,
  },
  targetText: {
    color: "#007BFF",
    fontSize: 22,
    fontWeight: "700",
    marginTop: 10,
  },
  chartTimeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: -20,
  },
  timeLabel: {
    color: "#9DA6B9",
    fontSize: 12,
  },
  chartPlaceholder: {
    color: "#9DA6B9",
    fontSize: 14,
    textAlign: "center",
  },

  /* Speed Card */
  speedCard: {
    backgroundColor: "#FFFFFF",
    padding: 24,
    borderRadius: 16,
    alignItems: "center",
  },
  speedRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  speedValue: {
    fontSize: 50,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  speedUnit: {
    color: "#7C8798",
    fontSize: 18,
    marginLeft: 8,
  },

  /* Speed Control Buttons */
  speedButtons: {
    flexDirection: "row",
    gap: 16,
  },
  speedBtn: {
    flex: 1,
    height: 60,
    borderRadius: 16,
    backgroundColor: "#007BFF20",
    alignItems: "center",
    justifyContent: "center",
  },

  /* Send Target HR */
  sendButton: {
    height: 60,
    backgroundColor: "#32CD32",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  sendText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
  },
  summaryButton: {
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#007BFF",
    backgroundColor: "#E6F2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  summaryText: {
    color: "#007BFF",
    fontSize: 16,
    fontWeight: "700",
  },

  /* Emergency FAB */
  emergencyButton: {
    position: "absolute",
    bottom: 20,
    right: 20,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#FF3B30",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#FF3B30",
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  emergencyText: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
