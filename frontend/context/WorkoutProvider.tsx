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

  // 실시간 스트림 구독
  useEffect(() => {
    const unsubscribeEcg = bridgeRef.current.onEcgSample((bpm) => {
      setHeartRate(bpm);
      setEcgHistory((prev) => {
        const next = [...prev, bpm];
        // 메모리 폭주 방지: 최근 40개까지만 유지
        return next.slice(-40);
      });
    });

    const unsubscribeSpeed = bridgeRef.current.onSpeed((value) => {
      setSpeedState(value);
    });

    return () => {
      unsubscribeEcg();
      unsubscribeSpeed();
      bridgeRef.current.teardownStreams();
    };
  }, []);

  const targetHr = useMemo(() => {
    if (!purpose || !profile.age || !profile.restingHr) return null;
    return ArduinoBridge.computeTargetHr(profile, purpose);
  }, [profile, purpose]);

  const connectToDevice = useCallback(async (deviceId: string) => {
    setConnectionState("connecting");
    try {
      await bridgeRef.current.connect(deviceId);
      setConnectionState("connected");
    } catch (error) {
      setConnectionState("disconnected");
      Alert.alert("Connection failed", String(error));
      throw error;
    }
  }, []);

  const disconnect = useCallback(async () => {
    await bridgeRef.current.disconnect();
    setConnectionState("disconnected");
  }, []);

  const sendTargetHr = useCallback(async () => {
    if (!targetHr) {
      Alert.alert("입력 필요", "나이, 안정시 심박수, 운동 목적을 먼저 설정하세요.");
      return;
    }
    try {
      await bridgeRef.current.sendTargetHeartRate(targetHr);
    } catch (error) {
      Alert.alert("전송 실패", String(error));
    }
  }, [targetHr]);

  const emergencyStop = useCallback(async () => {
    try {
      await bridgeRef.current.sendEmergencyStop();
      setSpeedState(0);
    } catch (error) {
      Alert.alert("정지 실패", String(error));
    }
  }, []);

  const setSpeed = useCallback(
    async (nextSpeed: number) => {
      const safe = Math.max(0, parseFloat(nextSpeed.toFixed(1)));
      setSpeedState(safe);
      try {
        await bridgeRef.current.setSpeed(safe);
      } catch (error) {
        Alert.alert("속도 전송 실패", String(error));
      }
    },
    []
  );

  const adjustSpeed = useCallback(
    async (delta: number) => {
      const next = Math.max(0, parseFloat((speed + delta).toFixed(1)));
      setSpeedState(next);
      try {
        await bridgeRef.current.setSpeed(next);
      } catch (error) {
        Alert.alert("속도 전송 실패", String(error));
      }
    },
    [speed]
  );

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
    <WorkoutContext.Provider value={value}>{children}</WorkoutContext.Provider>
  );
}

export function useWorkout() {
  const ctx = useContext(WorkoutContext);
  if (!ctx) throw new Error("useWorkout must be used within WorkoutProvider");
  return ctx;
}
