import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
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
    adjustSpeed,
    setSpeed,
    sendTargetHr,
    emergencyStop,
    connectionState,
    startWorkoutSession,
    endWorkoutSession,
  } = useWorkout();

  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [isWorkoutActive, setIsWorkoutActive] = useState(false);

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

  // 🔥 운동 시작 핸들러
  const handleStartWorkout = async () => {
    if (connectionState !== "connected") {
      Alert.alert("연결 필요", "먼저 기기에 연결해주세요.");
      return;
    }

    if (!targetHr) {
      Alert.alert("입력 필요", "프로필 및 운동 목적을 먼저 설정하세요.");
      return;
    }

    try {
      // 목표 심박수를 아두이노로 자동 전송
      await sendTargetHr();
      
      // 운동 세션 시작
      startWorkoutSession();
      setIsWorkoutActive(true);
      setChartData([]); // 차트 데이터 초기화
      
      Alert.alert(
        "운동 시작",
        `목표 심박수 ${targetHr} bpm이 전송되었습니다.\n운동을 시작합니다!`
      );
    } catch (error) {
      console.error("운동 시작 실패:", error);
      Alert.alert("오류", "목표 심박수 전송에 실패했습니다.");
    }
  };

  // 🔥 운동 종료 핸들러
  const handleStopWorkout = async () => {
    Alert.alert(
      "운동 종료",
      "운동을 종료하시겠습니까?\n트레드밀이 정지됩니다.",
      [
        {
          text: "취소",
          style: "cancel",
        },
        {
          text: "종료",
          style: "destructive",
          onPress: async () => {
            try {
              // 모터 정지
              await emergencyStop();
              
              // 운동 세션 종료 및 통계 계산
              endWorkoutSession();
              setIsWorkoutActive(false);
              
              Alert.alert(
                "운동 종료 완료",
                "수고하셨습니다!\n운동 요약을 확인하시겠습니까?",
                [
                  {
                    text: "나중에",
                    style: "cancel",
                  },
                  {
                    text: "요약 보기",
                    onPress: () => navigation.navigate("WorkoutSummary"),
                  },
                ]
              );
            } catch (error) {
              console.error("운동 종료 실패:", error);
              Alert.alert("오류", "운동 종료 중 문제가 발생했습니다.");
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.topTitle}>대시보드</Text>
          <Text style={styles.topSubtitle}>{connectionLabel}</Text>
        </View>
        
        {/* 운동 상태 표시 */}
        {isWorkoutActive && (
          <View style={styles.activeIndicator}>
            <View style={styles.pulseDot} />
            <Text style={styles.activeText}>운동 중</Text>
          </View>
        )}
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
            <Text style={styles.chartSub}>실시간</Text>
          </View>

          <Text style={styles.targetText}>
            목표 심박수: {targetHr ?? "--"} bpm
          </Text>

          <View style={styles.simpleChart}>
            {chartData.map((p, idx) => {
              // 심박 범위 정규화 (예: 60~180 bpm)
              const minHr = 60;
              const maxHr = 180;
              const ratio = Math.min(
                Math.max((p.y - minHr) / (maxHr - minHr), 0),
                1
              );

              return (
                <View
                  key={idx}
                  style={[
                    styles.chartBar,
                    {
                      height: 120 * ratio,
                      backgroundColor:
                        p.y >= (targetHr ?? 0) ? "#FF3B30" : "#32CD32",
                    },
                  ]}
                />
              );
            })}
          </View>


          <View style={styles.chartTimeRow}>
            <Text style={styles.timeLabel}>5분 전</Text>
            <Text style={styles.timeLabel}>4분</Text>
            <Text style={styles.timeLabel}>3분</Text>
            <Text style={styles.timeLabel}>2분</Text>
            <Text style={styles.timeLabel}>1분</Text>
            <Text style={styles.timeLabel}>현재</Text>
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

        {/* Manual Speed Controls - 운동 중일 때만 활성화 */}
        {/* {isWorkoutActive && (
          <View style={styles.speedButtons}>
            <TouchableOpacity
              style={styles.speedBtn}
              onPress={() => adjustSpeed(-0.5)}
            >
              <Icon name="remove" size={40} color="#007BFF" />
              <Text style={styles.speedBtnText}>감속</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.speedBtn}
              onPress={() => adjustSpeed(0.5)}
            >
              <Icon name="add" size={40} color="#007BFF" />
              <Text style={styles.speedBtnText}>가속</Text>
            </TouchableOpacity>
          </View>
        )} */}

        {/* Start/Stop Workout Button */}
        {!isWorkoutActive ? (
          <TouchableOpacity
            style={[
              styles.startButton,
              connectionState !== "connected" && styles.buttonDisabled,
            ]}
            onPress={handleStartWorkout}
            disabled={connectionState !== "connected"}
          >
            <Icon name="play-arrow" size={28} color="#FFFFFF" />
            <Text style={styles.startText}>운동 시작</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.stopButton}
            onPress={handleStopWorkout}
          >
            <Icon name="stop" size={28} color="#FFFFFF" />
            <Text style={styles.stopText}>운동 종료</Text>
          </TouchableOpacity>
        )}

        {/* Summary Button - 운동이 비활성일 때만 표시 */}
        {!isWorkoutActive && (
          <TouchableOpacity
            style={styles.summaryButton}
            onPress={() => navigation.navigate("WorkoutSummary")}
          >
            <Icon name="assessment" size={24} color="#007BFF" />
            <Text style={styles.summaryText}>지난 운동 요약 보기</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Emergency Stop Button - 항상 표시 */}
      <TouchableOpacity
        style={styles.emergencyButton}
        onPress={emergencyStop}
      >
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
    justifyContent: "space-between",
  },
  topTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  topSubtitle: {
    color: "#9DA6B9",
    fontSize: 12,
  },
  activeIndicator: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#32CD3220",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#32CD32",
  },
  activeText: {
    color: "#32CD32",
    fontSize: 12,
    fontWeight: "600",
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

  simpleChart: {
  height: 120,
  flexDirection: "row",
  alignItems: "flex-end",
  gap: 2,
  overflow: "hidden",
},

chartBar: {
  width: 4,
  borderRadius: 2,
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
    marginTop: 60,
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
    height: 70,
    borderRadius: 16,
    backgroundColor: "#007BFF20",
    alignItems: "center",
    justifyContent: "center",
  },
  speedBtnText: {
    color: "#007BFF",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 4,
  },

  /* Start/Stop Buttons */
  startButton: {
    height: 64,
    backgroundColor: "#32CD32",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  startText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
  },
  stopButton: {
    height: 64,
    backgroundColor: "#FF3B30",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  stopText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
  },
  buttonDisabled: {
    backgroundColor: "#3B4354",
    opacity: 0.5,
  },
  summaryButton: {
    height: 56,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#007BFF",
    backgroundColor: "#E6F2FF",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
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