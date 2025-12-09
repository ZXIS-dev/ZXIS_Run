import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { RootStackParamList } from "../types/navigation";
import { useWorkout } from "../context/WorkoutProvider";
import { ArduinoBridge } from "../services/arduinoBridge";

type Props = NativeStackScreenProps<RootStackParamList, "BleConnection">;

type DeviceState = "connected" | "available" | "connecting";

type Device = {
  name: string;
  id: string;
  state: DeviceState;
  signal: 1 | 2 | 3 | 4;
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
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [devices] = useState<Device[]>([
    {
      name: "Treadmill Controller XT",
      id: "00:1A:7D:DA:71:13",
      state: "available",
      signal: 4,
    },
    {
      name: "Arduino Treadmill",
      id: "00:1B:7C:EA:71:14",
      state: "available",
      signal: 3,
    },
    {
      name: "Smart Runner Pro",
      id: "00:1C:8D:FB:72:15",
      state: "connecting",
      signal: 2,
    },
  ]);

  const deriveState = (deviceId: string, baseState: DeviceState) => {
    if (selectedDevice !== deviceId) return baseState;
    if (connectionState === "connecting") return "connecting";
    if (connectionState === "connected") return "connected";
    return baseState;
  };

  const mhr = profile?.age ? 220 - profile.age : null;
  const hrr = mhr && profile?.restingHr ? mhr - profile.restingHr : null;
  const intensityRange = purpose
    ? ArduinoBridge.getIntensityRange(purpose)
    : null;

  const handleConnect = async (device: Device) => {
    setSelectedDevice(device.id);
    await connectToDevice(device.id);
  };

  const handleDisconnect = async () => {
    await disconnect();
    setSelectedDevice(null);
  };

  function renderSignalBars(level: Device["signal"]) {
    const icons = {
      4: "signal-cellular-4-bar",
      3: "signal-cellular-3-bar",
      2: "signal-cellular-2-bar",
      1: "signal-cellular-1-bar",
    };
    return <Icon name={icons[level]} size={22} color="#9DA6B9" />;
  }

  return (
    <View style={styles.container}>

      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back-ios" size={28} color="#FFFFFF" />
        </TouchableOpacity>

        <Text style={styles.topTitle}>Connect Device</Text>
        <View style={{ width: 28 }} />
      </View>

      {/* Main */}
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.subtitle}>Select a device to connect</Text>

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
        {devices.map((d) => {
          const state = deriveState(d.id, d.state);

          return (
            <View
              key={d.id}
              style={[
                styles.card,
                state === "connected" && styles.cardConnected,
              ]}
            >
              {/* Top Row */}
              <View style={styles.row}>
                <View style={styles.iconBox}>
                  <Icon
                    name="directions-run"
                    size={32}
                    color={state === "connected" ? "#39FF14" : "#9DA6B9"}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.deviceName,
                      state === "connected" && styles.deviceNameConnected,
                    ]}
                  >
                    {d.name}
                  </Text>
                  <Text style={styles.deviceId}>Device ID: {d.id}</Text>
                </View>

                {renderSignalBars(d.signal)}
              </View>

              {/* Bottom Row (State / Button) */}
              {state === "connected" && (
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

              {state === "available" && (
                <TouchableOpacity
                  style={styles.connectButton}
                  onPress={() => handleConnect(d)}
                >
                  <Text style={styles.connectText}>Connect</Text>
                </TouchableOpacity>
              )}

              {state === "connecting" && (
                <View style={styles.connectingButton}>
                  <ActivityIndicator color="#FFFFFF" size="small" />
                  <Text style={styles.connectingText}>Connecting...</Text>
                </View>
              )}
            </View>
          );
        })}

        {/* Empty State (예: devices.length === 0일 때 표시) */}
        {/* 아래는 참고용 - 실제 조건추가 필요 */}
        <View style={styles.emptyBox}>
          <View style={styles.emptyIconWrapper}>
            <Icon name="bluetooth-disabled" size={40} color="#9DA6B9" />
          </View>
          <Text style={styles.emptyTitle}>No devices found</Text>
          <Text style={styles.emptyDesc}>
            Make sure your device is turned on and Bluetooth is enabled.
          </Text>
        </View>
      </ScrollView>

      {/* Scan Button */}
      <View style={styles.scanWrapper}>
        <TouchableOpacity
          style={[
            styles.scanButton,
            connectionState === "connected" && { backgroundColor: "#39FF14" },
            connectionState !== "connected" && { opacity: 0.6 },
          ]}
          onPress={() => navigation.navigate("WorkoutDashboard")}
          disabled={connectionState !== "connected"}
        >
          <Icon
            name={connectionState === "connected" ? "" : "refresh"}
            size={24}
            color="#0A0F1A"
          />
          <Text style={styles.scanText}>
            {connectionState === "connected"
              ? "Go to Dashboard"
              : "Scan for Devices"}
          </Text>
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

  /* Top Bar */
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

  /* Content */
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

  /* Device Card */
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

  /* Empty State */
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

  /* Scan Button */
  scanWrapper: {
    padding: 16,
    paddingBottom: 30,
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
  scanText: {
    color: "#0A0F1A",
    fontSize: 17,
    fontWeight: "700",
  },
});

