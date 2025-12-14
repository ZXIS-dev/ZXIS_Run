// context/WorkoutProvider.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Alert } from "react-native";

import {
  ArduinoBridge,
  ArduinoConnectionState,
  BodyInfo,
  WorkoutPurposeKey,
} from "../services/arduinoBridge";

type UserProfile = BodyInfo & {
  weight?: number;
  gender?: string;
  level?: string;
};

type WorkoutContextValue = {
  profile: UserProfile;
  setProfile: (profile: UserProfile) => void;
  purpose: WorkoutPurposeKey | null;
  setPurpose: (purpose: WorkoutPurposeKey | null) => void;
  targetHr: number | null;
  heartRate: number | null;
  ecgHistory: number[];
  speed: number;
  connectionState: ArduinoConnectionState;
  connectToDevice: (id: string) => Promise<void>;
  disconnect: () => Promise<void>;
  sendTargetHr: () => Promise<void>;
  emergencyStop: () => Promise<void>;
  setSpeed: (speed: number) => Promise<void>;
  adjustSpeed: (delta: number) => Promise<void>;
};

const WorkoutContext = createContext<WorkoutContextValue | undefined>(
  undefined
);

const DEFAULT_PROFILE: UserProfile = {
  age: 25,
  restingHr: 60,
  weight: 70,
  gender: "Male",
  level: "Beginner",
};

export function WorkoutProvider({ children }: { children: React.ReactNode }) {
  const bridgeRef = useRef(new ArduinoBridge());

  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [purpose, setPurpose] = useState<WorkoutPurposeKey | null>(null);
  const [connectionState, setConnectionState] =
    useState<ArduinoConnectionState>("disconnected");

  const [heartRate, setHeartRate] = useState<number | null>(null);
  const [speed, setSpeedState] = useState(0);
  const [ecgHistory, setEcgHistory] = useState<number[]>([]);

  // ==========================================
  // 🔥 스트림 구독 (ECG / SPD)
  // ==========================================
  useEffect(() => {
    console.log("[WorkoutProvider] Setting up listeners");

    const unsubscribeEcg = bridgeRef.current.onEcgSample((bpmRaw) => {
      const bpm = Number(bpmRaw) || 0;

      console.log("[WorkoutProvider] Received BPM:", bpm);

      setHeartRate(bpm);
      setEcgHistory((prev) => [...prev.slice(-39), bpm]); // 그래프용 최근 40개 유지
    });

    const unsubscribeSpeed = bridgeRef.current.onSpeed((spdRaw) => {
      const spd = Number(spdRaw) || 0;

      console.log("[WorkoutProvider] Received Speed:", spd);
      setSpeedState(spd);
    });

    return () => {
      unsubscribeEcg();
      unsubscribeSpeed();
      bridgeRef.current.teardownStreams();
    };
  }, []);

  // ==========================================
  //  목표 심박 계산 (Karvonen)
  // ==========================================
  const targetHr = useMemo(() => {
    if (!purpose || !profile.age || !profile.restingHr) return null;
    return ArduinoBridge.computeTargetHr(profile, purpose);
  }, [profile, purpose]);

  // ==========================================
  // 디바이스 연결
  // ==========================================
  const connectToDevice = useCallback(async (deviceId: string) => {
    setConnectionState("connecting");
    console.log("[WorkoutProvider] Connecting to:", deviceId);

    try {
      await bridgeRef.current.connect(deviceId);
      setConnectionState("connected");

      // 연결되면 데이터 초기화
      setEcgHistory([]);
      setHeartRate(null);
      setSpeedState(0);

      console.log("[WorkoutProvider] Connected!");
    } catch (e) {
      console.error("[WorkoutProvider] Connection failed:", e);
      setConnectionState("disconnected");
      throw e;
    }
  }, []);

  // ==========================================
  // 🔥 연결 해제
  // ==========================================
  const disconnect = useCallback(async () => {
    try {
      await bridgeRef.current.disconnect();
    } finally {
      setConnectionState("disconnected");
      setHeartRate(null);
      setSpeedState(0);
      setEcgHistory([]);
    }
  }, []);

  // ==========================================
  // 🔥 목표 심박 전송
  // ==========================================
  const sendTargetHr = useCallback(async () => {
    console.log("[WorkoutProvider] Sending target HR:", targetHr);

    if (!targetHr) {
      Alert.alert("입력 필요", "프로필 및 운동 목적을 먼저 설정하세요.");
      return;
    }

    if (connectionState !== "connected") {
      Alert.alert("연결 필요", "먼저 기기에 연결해주세요.");
      return;
    }

    try {
      await bridgeRef.current.sendTargetHeartRate(targetHr);
      Alert.alert("전송 완료", `${targetHr} bpm 전송됨`);
    } catch (e) {
      console.error(e);
      Alert.alert("전송 실패", String(e));
    }
  }, [targetHr, connectionState]);

  // ==========================================
  // 🔥 비상 정지
  // ==========================================
  const emergencyStop = useCallback(async () => {
    try {
      await bridgeRef.current.sendEmergencyStop();
      setSpeedState(0);
      Alert.alert("정지 완료", "트레드밀이 정지되었습니다.");
    } catch (e) {
      Alert.alert("오류", String(e));
    }
  }, []);

  // ==========================================
  // 🔥 속도 설정 / 조절
  // ==========================================
  const setSpeed = useCallback(
    async (spd: number) => {
      if (connectionState !== "connected") {
        return Alert.alert("연결 필요", "기기가 연결되어 있지 않습니다.");
      }

      const safe = Math.max(0, Number(spd.toFixed(1)));

      setSpeedState(safe);

      try {
        await bridgeRef.current.setSpeed(safe);
      } catch (e) {
        Alert.alert("속도 오류", String(e));
      }
    },
    [connectionState]
  );

  const adjustSpeed = useCallback(
    async (delta: number) => {
      await setSpeed(speed + delta);
    },
    [speed, setSpeed]
  );

  // ==========================================
  // Provider value
  // ==========================================
  const value = useMemo(
    () => ({
      profile,
      setProfile,
      purpose,
      setPurpose,
      targetHr,
      heartRate,
      ecgHistory,
      speed,
      connectionState,
      connectToDevice,
      disconnect,
      sendTargetHr,
      emergencyStop,
      setSpeed,
      adjustSpeed,
    }),
    [
      profile,
      purpose,
      targetHr,
      heartRate,
      ecgHistory,
      speed,
      connectionState,
      connectToDevice,
      disconnect,
      sendTargetHr,
      emergencyStop,
      setSpeed,
      adjustSpeed,
    ]
  );

  return (
    <WorkoutContext.Provider value={value}>
      {children}
    </WorkoutContext.Provider>
  );
}

export function useWorkout() {
  const ctx = useContext(WorkoutContext);
  if (!ctx) throw new Error("useWorkout must be used within WorkoutProvider");
  return ctx;
}
