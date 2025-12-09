// screens/ConnectDeviceScreen.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  PermissionsAndroid,
  Platform,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BluetoothDevice } from "react-native-bluetooth-classic";

import { RootStackParamList } from "../types/navigation";
import { useWorkout } from "../context/WorkoutProvider";
import { ArduinoBridge } from "../services/arduinoBridge";

type Props = NativeStackScreenProps<RootStackParamList, "BleConnection">;

type DeviceInfo = {
  id: string;
  name: string;
  rssi: number; // Classic BT에서 실제 rssi가 없을 수도 있으니 UI용 가짜 값
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

  const requestBtPermissions = async () => {
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


  // 스캔 전용 브리지 (Provider의 bridgeRef와는 별개, 단순 목록 조회용)
  const bridge = new ArduinoBridge();

  // 스캔 시작: Classic BT에서는 페어링된 기기 목록을 가져오는 방식 사용
  const startScan = async () => {
    const ok = await requestBtPermissions();
    if (!ok) {
      console.log("Bluetooth permissions denied");
    return;
  }
    setScanning(true);
    setDevices([]);

    try {
      await bridge.startScan((device: BluetoothDevice) => {
        setDevices((prev) => {
          if (prev.some((d) => d.id === device.id)) return prev;

          return [
            ...prev,
            {
              id: device.id,
              name: device.name || "Unknown Device",
              // Classic BT는 rssi 정보가 없는 경우가 많으므로 UI용 기본값
              rssi: typeof device.rssi === "number" ? device.rssi : -60,
            },
          ];
        });
      }, 10000);

      // 10초 후 자동 "스캔 중" 상태 해제 (실제 스캔은 즉시 끝나더라도 UI 연출용)
      setTimeout(() => {
        setScanning(false);
      }, 10000);
    } catch (error) {
      console.error("Scan error:", error);
      setScanning(false);
    }
  };

  // 연결
  const handleConnect = async (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    try {
      await connectToDevice(deviceId);
    } catch (error) {
      console.error("Connection error:", error);
      setSelectedDeviceId(null);
    }
  };

  // 연결 해제
  const handleDisconnect = async () => {
    await disconnect();
    setSelectedDeviceId(null);
  };

  // 신호 강도를 바 개수로 변환 (rssi는 대략적인 값)
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
        <Text style={styles.topTitle}>Connect Device</Text>
        <View style={{ width: 28 }} />
      </View>

      {/* Main */}
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.subtitle}>
          {scanning
            ? "Scanning for paired devices..."
            : "Tap scan to list paired devices"}
        </Text>

        {/* 목표 HR 계산 요약 */}
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>Target HR (Karvonen)</Text>
          <Text style={styles.infoText}>
            MHR(220 - age): {mhr ?? "--"} bpm | HRR: {hrr ?? "--"} bpm
          </Text>
          <Text style={styles.infoText}>
            Purpose: {purpose ?? "미선택"} | Intensity:{" "}
            {intensityRange
              ? `${Math.round(intensityRange.low * 100)}% ~ ${Math.round(
                  intensityRange.high * 100
                )}%`
              : "--"}
          </Text>
          <Text style={[styles.infoText, { marginTop: 4 }]}>
            Target HR to send: {targetHr ?? "--"} bpm
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
                    name="directions-run"
                    size={32}
                    color={isConnected ? "#39FF14" : "#9DA6B9"}
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
                    Signal: {device.rssi} dBm
                  </Text>
                </View>

                {renderSignalBars(device.rssi)}
              </View>

              {/* Connected State */}
              {isConnected && (
                <>
                  <View style={styles.connectedBox}>
                    <Text style={styles.connectedText}>Connected</Text>
                    <TouchableOpacity onPress={handleDisconnect}>
                      <Text style={styles.disconnectText}>Disconnect</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={styles.sendButton}
                    onPress={sendTargetHr}
                  >
                    <Text style={styles.sendButtonText}>
                      Send Target HR ({targetHr ?? "?"} bpm)
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
                  <Text style={styles.connectText}>Connect</Text>
                </TouchableOpacity>
              )}

              {/* Connecting State */}
              {isConnecting && (
                <View style={styles.connectingButton}>
                  <ActivityIndicator color="#FFFFFF" size="small" />
                  <Text style={styles.connectingText}>Connecting...</Text>
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
            <Text style={styles.emptyTitle}>No devices found</Text>
            <Text style={styles.emptyDesc}>
              Make sure your HC-05 is powered on and paired in system settings.
            </Text>
          </View>
        )}

        {/* Scanning Indicator */}
        {scanning && (
          <View style={styles.scanningBox}>
            <ActivityIndicator color="#39FF14" size="large" />
            <Text style={styles.scanningText}>
              Searching for paired Bluetooth devices...
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
          <Icon
            name="refresh"
            size={24}
            color="#FFFFFF"
            style={scanning && styles.rotating}
          />
          <Text style={styles.scanText}>
            {scanning ? "불러오는 중..." : "기기 불러오기"}
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
          <Icon name="arrow-forward" size={24} color="#FFFFFF" />
          <Text style={styles.nextText}>Go to Dashboard</Text>
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
    borderColor: "#39FF14",
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
    color: "#39FF14",
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
    color: "#39FF14",
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
    backgroundColor: "#39FF14",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
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
    backgroundColor: "#39FF14",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  nextButtonDisabled: {
    backgroundColor: "#B0B8C5",
    opacity: 0.5,
  },
  nextText: {
    color: "#0A0F1A",
    fontSize: 17,
    fontWeight: "700",
  },
  rotating: {
    // 회전 애니메이션은 Animated API로 구현 가능
  },
});
