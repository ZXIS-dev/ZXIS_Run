// screens/ConnectDeviceScreen.tsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  PermissionsAndroid,
  Platform,
  Alert,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import RNBluetoothClassic from "react-native-bluetooth-classic";

import { RootStackParamList } from "../types/navigation";
import { useWorkout } from "../context/WorkoutProvider";
import { ArduinoBridge } from "../services/arduinoBridge";

type Props = NativeStackScreenProps<RootStackParamList, "BleConnection">;

type DeviceInfo = {
  id: string;
  name: string;
  rssi: number;
};

// 🔥 권한 요청 함수를 컴포넌트 외부로 이동
const requestBtPermissions = async (): Promise<boolean> => {
  if (Platform.OS !== "android") return true;

  try {
    if (Platform.Version >= 31) {
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);

      return Object.values(granted).every(
        (v) => v === PermissionsAndroid.RESULTS.GRANTED
      );
    } else {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
  } catch (e) {
    console.log("BT Permission error:", e);
    return false;
  }
};

export default function ConnectDeviceScreen({ navigation }: Props) {
  const {
    connectToDevice,
    disconnect,
    connectionState,
    targetHr,
    sendTargetHr,
    profile,
    purpose,
  } = useWorkout();

  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

  // 🔥 연결 끊김 감지
  useEffect(() => {
    if (connectionState === "disconnected" && selectedDeviceId) {
      Alert.alert(
        "연결 끊김",
        "기기와의 연결이 끊어졌습니다.",
        [
          {
            text: "확인",
            onPress: () => setSelectedDeviceId(null),
          },
        ]
      );
    }
  }, [connectionState, selectedDeviceId]);

  // 🔥 스캔 시작 (개선됨)
  const startScan = async () => {
    const ok = await requestBtPermissions();
    if (!ok) {
      Alert.alert(
        "권한 필요",
        "블루투스 사용을 위해 위치 및 블루투스 권한이 필요합니다."
      );
      return;
    }

    setScanning(true);
    setDevices([]);

    try {
      console.log("[Scan] Starting scan for bonded devices...");
      
      // HC-06은 페어링된 기기 목록에서 찾음
      const bonded = await RNBluetoothClassic.getBondedDevices();
      
      console.log(`[Scan] Found ${bonded.length} bonded devices`);

      const deviceList: DeviceInfo[] = bonded.map((dev) => ({
        id: dev.id,
        name: dev.name || "Unknown Device",
        rssi: -60, // Classic BT는 rssi가 없으므로 기본값
      }));

      setDevices(deviceList);

      if (deviceList.length === 0) {
        Alert.alert(
          "기기 없음",
          "페어링된 블루투스 기기가 없습니다.\n\n설정 > 블루투스에서 HC-06을 먼저 페어링해주세요."
        );
      }
    } catch (error) {
      console.error("[Scan] Error:", error);
      Alert.alert("스캔 실패", String(error));
    } finally {
      setScanning(false);
    }
  };

  // 🔥 연결 (에러 처리 개선)
  const handleConnect = async (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    
    try {
      console.log(`[Connect] Attempting to connect to: ${deviceId}`);
      await connectToDevice(deviceId);
      
      Alert.alert(
        "연결 성공",
        "HC-06 모듈에 연결되었습니다.",
        [{ text: "확인" }]
      );
    } catch (error) {
      console.error("[Connect] Error:", error);
      setSelectedDeviceId(null);

      // 🔥 구체적인 에러 메시지
      let errorMsg = "연결에 실패했습니다.";
      if (error instanceof Error) {
        if (error.message.includes("timeout")) {
          errorMsg = "연결 시간이 초과되었습니다.\n\n기기가 켜져있고 범위 내에 있는지 확인하세요.";
        } else if (error.message.includes("refused") || error.message.includes("reject")) {
          errorMsg = "기기가 연결을 거부했습니다.\n\n다른 앱에서 사용 중인지 확인하거나 재페어링을 시도하세요.";
        } else if (error.message.includes("not found")) {
          errorMsg = "기기를 찾을 수 없습니다.\n\n페어링을 다시 시도하세요.";
        } else if (error.message.includes("permission")) {
          errorMsg = "블루투스 권한이 필요합니다.\n\n설정에서 권한을 허용해주세요.";
        } else {
          errorMsg = `연결 실패: ${error.message}`;
        }
      }

      Alert.alert("연결 실패", errorMsg);
    }
  };

  // 🔥 연결 해제 (확인 다이얼로그 추가)
  const handleDisconnect = async () => {
    Alert.alert(
      "연결 해제",
      "기기와의 연결을 해제하시겠습니까?",
      [
        {
          text: "취소",
          style: "cancel",
        },
        {
          text: "해제",
          style: "destructive",
          onPress: async () => {
            try {
              await disconnect();
              setSelectedDeviceId(null);
            } catch (error) {
              console.error("[Disconnect] Error:", error);
            }
          },
        },
      ]
    );
  };

  // 신호 강도를 바 개수로 변환
  const getSignalBars = (rssi: number): 1 | 2 | 3 | 4 => {
    if (rssi >= -50) return 4;
    if (rssi >= -65) return 3;
    if (rssi >= -80) return 2;
    return 1;
  };

  const renderSignalBars = (rssi: number) => {
    const level = getSignalBars(rssi);
    const icons = {
      4: "signal-cellular-4-bar",
      3: "signal-cellular-3-bar",
      2: "signal-cellular-2-bar",
      1: "signal-cellular-1-bar",
    };
    return <Icon name={icons[level]} size={22} color="#9DA6B9" />;
  };

  const mhr = profile?.age ? 220 - profile.age : null;
  const hrr = mhr && profile?.restingHr ? mhr - profile.restingHr : null;
  const intensityRange = purpose
    ? ArduinoBridge.getIntensityRange(purpose)
    : null;

  // 연결 상태에 따른 디바이스 상태 결정
  const getDeviceState = (deviceId: string) => {
    if (selectedDeviceId === deviceId) {
      if (connectionState === "connecting") return "connecting";
      if (connectionState === "connected") return "connected";
    }
    return "available";
  };

  return (
    <View style={styles.container}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={28} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>블루투스 기기 연결</Text>
        <View style={{ width: 28 }} />
      </View>

      {/* Main */}
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.subtitle}>
          {scanning
            ? "페어링된 기기를 검색하는 중..."
            : "아래 버튼을 눌러 페어링된 기기 목록을 불러오세요"}
        </Text>

        {/* 목표 HR 계산 요약 */}
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>목표 심박수(Karvonen 공식)</Text>
          <Text style={styles.infoText}>
            최대 심박수(220 - 나이): {mhr ?? "--"} bpm | 심박수 예비량: {hrr ?? "--"} bpm
          </Text>
          <Text style={styles.infoText}>
            운동 목적: {purpose ?? "미선택"} | 운동 강도:{" "}
            {intensityRange
              ? `${Math.round(intensityRange.low * 100)}% ~ ${Math.round(
                  intensityRange.high * 100
                )}%`
              : "--"}
          </Text>
          <Text style={[styles.infoText, { marginTop: 4 }]}>
            전송할 목표 심박수: {targetHr ?? "--"} bpm
          </Text>
        </View>

        {/* Device Cards */}
        {devices.map((device) => {
          const state = getDeviceState(device.id);
          const isConnected = state === "connected";
          const isConnecting = state === "connecting";

          return (
            <View
              key={device.id}
              style={[styles.card, isConnected && styles.cardConnected]}
            >
              {/* Top Row */}
              <View style={styles.row}>
                <View style={styles.iconBox}>
                  <Icon
                    name="bluetooth"
                    size={32}
                    color={isConnected ? "#32CD32" : "#9DA6B9"}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.deviceName,
                      isConnected && styles.deviceNameConnected,
                    ]}
                  >
                    {device.name}
                  </Text>
                  <Text style={styles.deviceId}>
                    ID: {device.id}
                  </Text>
                </View>

                
              </View>

              {/* Connected State */}
              {isConnected && (
                <>
                  <View style={styles.connectedBox}>
                    <Text style={styles.connectedText}> 연결됨</Text>
                    <TouchableOpacity onPress={handleDisconnect}>
                      <Text style={styles.disconnectText}>연결 해제</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={styles.sendButton}
                    onPress={sendTargetHr}
                  >
                    <Icon name="send" size={20} color="#0A0F1A" style={{ marginRight: 8 }} />
                    <Text style={styles.sendButtonText}>
                      목표 심박수 전송 ({targetHr ?? "?"} bpm)
                    </Text>
                  </TouchableOpacity>
                </>
              )}

              {/* Available State */}
              {state === "available" && (
                <TouchableOpacity
                  style={styles.connectButton}
                  onPress={() => handleConnect(device.id)}
                >
                  <Icon name="link" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.connectText}>연결하기</Text>
                </TouchableOpacity>
              )}

              {/* Connecting State */}
              {isConnecting && (
                <View style={styles.connectingButton}>
                  <ActivityIndicator color="#FFFFFF" size="small" />
                  <Text style={styles.connectingText}>연결 중...</Text>
                </View>
              )}
            </View>
          );
        })}

        {/* Empty State */}
        {!scanning && devices.length === 0 && (
          <View style={styles.emptyBox}>
            <View style={styles.emptyIconWrapper}>
              <Icon name="bluetooth-disabled" size={40} color="#9DA6B9" />
            </View>
            <Text style={styles.emptyTitle}>기기가 없습니다</Text>
            <Text style={styles.emptyDesc}>
              HC-06 모듈이 켜져있고{"\n"}
              스마트폰 설정에서 페어링되어 있는지{"\n"}
              확인해주세요.
            </Text>
          </View>
        )}

        {/* Scanning Indicator */}
        {scanning && (
          <View style={styles.scanningBox}>
            <ActivityIndicator color="#32CD32" size="large" />
            <Text style={styles.scanningText}>
              페어링된 블루투스 기기를 검색하는 중...
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Bottom Buttons */}
      <View style={styles.bottomButtons}>
        {/* Scan Button */}
        <TouchableOpacity
          style={[styles.scanButton, scanning && styles.scanButtonDisabled]}
          onPress={startScan}
          disabled={scanning}
        >
          <Icon name="refresh" size={24} color="#FFFFFF" />
          <Text style={styles.scanText}>
            {scanning ? "검색 중..." : "기기 검색"}
          </Text>
        </TouchableOpacity>

        {/* Next Button */}
        <TouchableOpacity
          style={[
            styles.nextButton,
            connectionState !== "connected" && styles.nextButtonDisabled,
          ]}
          onPress={() => navigation.navigate("WorkoutDashboard")}
          disabled={connectionState !== "connected"}
        >
          <Text style={styles.nextText}>대시보드로 이동</Text>
          <Icon name="arrow-forward" size={24} color={connectionState === "connected" ? "#0A0F1A" : "#FFFFFF"} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#101622",
  },
  topBar: {
    height: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  topTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 30,
  },
  subtitle: {
    textAlign: "center",
    color: "#9DA6B9",
    marginBottom: 12,
    fontSize: 14,
  },
  infoBox: {
    backgroundColor: "#1C2431",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#2E3440",
    marginBottom: 4,
  },
  infoTitle: {
    color: "#FFFFFF",
    fontWeight: "700",
    marginBottom: 6,
  },
  infoText: {
    color: "#9DA6B9",
    fontSize: 12,
  },
  card: {
    backgroundColor: "#1C2431",
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2E3440",
    gap: 12,
  },
  cardConnected: {
    backgroundColor: "#135bec20",
    borderColor: "#32CD32",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  iconBox: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: "#2A303D",
    justifyContent: "center",
    alignItems: "center",
  },
  deviceName: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  deviceNameConnected: {
    color: "#32CD32",
  },
  deviceId: {
    color: "#9DA6B9",
    fontSize: 12,
    marginTop: 2,
  },
  connectedBox: {
    backgroundColor: "#39FF1415",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  connectedText: {
    color: "#32CD32",
    fontWeight: "600",
  },
  disconnectText: {
    color: "#FF5555",
    fontWeight: "600",
  },
  connectButton: {
    backgroundColor: "#135bec",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  connectText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  connectingButton: {
    backgroundColor: "#135bec90",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
  },
  connectingText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  sendButton: {
    marginTop: 8,
    backgroundColor: "#32CD32",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  sendButtonText: {
    color: "#0A0F1A",
    fontWeight: "700",
  },
  emptyBox: {
    marginTop: 40,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#3B4354",
    borderRadius: 14,
    paddingVertical: 40,
    alignItems: "center",
    gap: 12,
  },
  emptyIconWrapper: {
    backgroundColor: "#2A303D",
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  emptyDesc: {
    color: "#9DA6B9",
    fontSize: 14,
    textAlign: "center",
    maxWidth: 260,
  },
  scanningBox: {
    marginTop: 20,
    alignItems: "center",
    gap: 16,
    paddingVertical: 30,
  },
  scanningText: {
    color: "#9DA6B9",
    fontSize: 14,
  },
  bottomButtons: {
    padding: 16,
    paddingBottom: 30,
    gap: 12,
  },
  scanButton: {
    height: 56,
    borderRadius: 14,
    backgroundColor: "#135bec",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  scanButtonDisabled: {
    opacity: 0.6,
  },
  scanText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
  },
  nextButton: {
    height: 56,
    borderRadius: 14,
    backgroundColor: "#32CD32",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  nextButtonDisabled: {
    backgroundColor: "#3B4354",
    opacity: 0.5,
  },
  nextText: {
    color: "#0A0F1A",
    fontSize: 17,
    fontWeight: "700",
  },
});