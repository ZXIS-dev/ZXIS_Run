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

type WorkoutSession = {
  duration: number; // 초 단위
  avgHeartRate: number;
  maxHeartRate: number;
  minHeartRate: number;
  caloriesBurned: number;
  totalDistance: number; // km
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
  workoutSession: WorkoutSession | null;
  startWorkoutSession: () => void;
  endWorkoutSession: () => void;
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

  // 🔥 운동 세션 추적
  const [workoutSession, setWorkoutSession] = useState<WorkoutSession | null>(null);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [sessionHeartRates, setSessionHeartRates] = useState<number[]>([]);
  const [sessionSpeeds, setSessionSpeeds] = useState<number[]>([]);

  // ==========================================
  // 🔥 스트림 구독 (ECG / SPD) - 앱 생명주기 1회
  // ==========================================
  useEffect(() => {
    console.log("[WorkoutProvider] Setting up listeners (ONE TIME)");

    const unsubscribeEcg = bridgeRef.current.onEcgSample((bpmRaw) => {
      const bpm = Number(bpmRaw) || 0;

      console.log("[WorkoutProvider] Received BPM:", bpm);

      setHeartRate(bpm);
      setEcgHistory((prev) => [...prev.slice(-39), bpm]);

      // ✅ 운동 중일 때만 세션 데이터로 저장
      if (isSessionActive && bpm > 0) {
        setSessionHeartRates((prev) => [...prev, bpm]);
      }
    });

    const unsubscribeSpeed = bridgeRef.current.onSpeed((spdRaw) => {
      const spd = Number(spdRaw) || 0;

      console.log("[WorkoutProvider] Received Speed:", spd);
      setSpeedState(spd);

      if (isSessionActive && spd > 0) {
        setSessionSpeeds((prev) => [...prev, spd]);
      }
    });

    return () => {
      unsubscribeEcg();
      unsubscribeSpeed();
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

  const disconnect = useCallback(async () => {
    try {
      await bridgeRef.current.disconnect();
    } finally {
      bridgeRef.current.teardownStreams();
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
      console.log(`[WorkoutProvider] Target HR sent: ${targetHr} bpm`);
    } catch (e) {
      console.error(e);
      Alert.alert("전송 실패", String(e));
      throw e;
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
  // 🔥 운동 세션 시작
  // ==========================================
  const startWorkoutSession = useCallback(() => {
    setIsSessionActive(true);
    setSessionStartTime(Date.now());
    setSessionHeartRates([]);
    setSessionSpeeds([]);
    setWorkoutSession(null);
    console.log("[WorkoutProvider] Workout session started");
  }, []);

  // ==========================================
  // 🔥 운동 세션 종료 및 통계 계산
  // ==========================================
  const endWorkoutSession = useCallback(() => {
    if (!isSessionActive || !sessionStartTime) {
      console.log("[WorkoutProvider] No active session to end");
      return;
    }

    const duration = Math.floor((Date.now() - sessionStartTime) / 1000); // 초 단위

    // 심박수 통계
    const validHeartRates = sessionHeartRates.filter((hr) => hr > 0);
    const avgHeartRate =
      validHeartRates.length > 0
        ? Math.round(
            validHeartRates.reduce((sum, hr) => sum + hr, 0) / validHeartRates.length
          )
        : 0;
    const maxHeartRate = validHeartRates.length > 0 ? Math.max(...validHeartRates) : 0;
    const minHeartRate = validHeartRates.length > 0 ? Math.min(...validHeartRates) : 0;

    // 거리 계산 (속도 * 시간)
    // 속도는 MPH, 시간은 초 단위 -> km로 변환
    const totalDistance =
      sessionSpeeds.length > 0
        ? sessionSpeeds.reduce((sum, spd) => {
            // 각 속도 샘플당 약 1초로 가정
            // MPH -> km/h 변환: 1 MPH = 1.60934 km/h
            // 1시간 = 3600초
            return sum + (spd * 1.60934) / 3600;
          }, 0)
        : 0;

    // 칼로리 계산 (간단한 공식)
    // 칼로리 = MET * 체중(kg) * 시간(시간)
    // 러닝 MET: 대략 평균 심박수 기반 추정
    const met = avgHeartRate > 0 ? (avgHeartRate / 10) * 0.7 : 5; // 간단한 추정
    const caloriesBurned = Math.round(
      met * (profile.weight || 70) * (duration / 3600)
    );

    const session: WorkoutSession = {
      duration,
      avgHeartRate,
      maxHeartRate,
      minHeartRate,
      caloriesBurned,
      totalDistance: parseFloat(totalDistance.toFixed(2)),
    };

    setWorkoutSession(session);
    setIsSessionActive(false);
    setSessionStartTime(null);

    console.log("[WorkoutProvider] Workout session ended:", session);
  }, [isSessionActive, sessionStartTime, sessionHeartRates, sessionSpeeds, profile.weight]);

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
      workoutSession,
      startWorkoutSession,
      endWorkoutSession,
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
      workoutSession,
      startWorkoutSession,
      endWorkoutSession,
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