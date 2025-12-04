import { NativeEventEmitter } from "react-native";

type WorkoutPurposeKey = "fatBurn" | "cardio" | "hiit";

type BodyInfo = {
  age: number;
  restingHr: number;
};

type IntensityRange = {
  low: number;
  high: number;
};

const PURPOSE_INTENSITY: Record<WorkoutPurposeKey, IntensityRange> = {
  // 다이어트: 지방 연소 효율이 높아지는 중강도
  fatBurn: { low: 0.5, high: 0.7 },
  // 심폐지구력: 유산소 능력 향상 구간
  cardio: { low: 0.7, high: 0.85 },
  // HIIT: 고강도 인터벌(여기서는 높은 강도 구간의 평균값 사용)
  hiit: { low: 0.85, high: 0.95 },
};

export type ArduinoConnectionState =
  | "disconnected"
  | "connecting"
  | "connected";

type EcgListener = (bpm: number) => void;
type SpeedListener = (speed: number) => void;

/**
 * BLE/시리얼 연동이 아직 없는 상태에서의 임시 브리지.
 * - 추후 react-native-ble-plx 등 BLE 라이브러리로 교체 시, 아래 send on 부분만 실제 구현으로 교체하면 됨.
 * - EventEmitter로 ECG / 속도 스트림을 흉내내고, 명령 전송도 로그로 대체.
 */
export class ArduinoBridge {
  private emitter = new NativeEventEmitter();
  private ecgInterval: ReturnType<typeof setInterval> | null = null;
  private speedInterval: ReturnType<typeof setInterval> | null = null;
  private currentSpeed = 0;
  private state: ArduinoConnectionState = "disconnected";

  async connect(deviceId: string) {
    // 실제 BLE 연결 로직 자리. (지금은 딜레이 후 성공으로 간주)
    this.state = "connecting";
    await new Promise<void>((resolve) => setTimeout(() => resolve(), 900));
    this.state = "connected";
    this.startMockStreams();
    console.log(`[ArduinoBridge] connected to ${deviceId}`);
  }

  async disconnect() {
    this.teardownStreams();
    this.state = "disconnected";
    console.log("[ArduinoBridge] disconnected");
  }

  getState(): ArduinoConnectionState {
    return this.state;
  }

  /**
   * 목표 심박수 전송
   */
  async sendTargetHeartRate(target: number) {
    if (this.state !== "connected") throw new Error("Device not connected");
    // TODO: BLE characteristic write
    console.log(`[ArduinoBridge] send target HR -> ${target} bpm`);
  }

  /**
   * 비상 정지 명령
   */
  async sendEmergencyStop() {
    if (this.state !== "connected") throw new Error("Device not connected");
    this.currentSpeed = 0;
    console.log("[ArduinoBridge] EMERGENCY STOP sent");
  }

  /**
   * 절대 속도 설정
   */
  async setSpeed(targetSpeed: number) {
    if (this.state !== "connected") throw new Error("Device not connected");
    this.currentSpeed = Math.max(0, targetSpeed);
    console.log(`[ArduinoBridge] set speed -> ${this.currentSpeed.toFixed(1)}`);
  }

  /**
   * ECG 스트림 구독 (BPM 기반)
   */
  onEcgSample(listener: EcgListener) {
    const subscription = this.emitter.addListener("ecg", listener);
    return () => subscription.remove();
  }

  /**
   * 속도 스트림 구독
   */
  onSpeed(listener: SpeedListener) {
    const subscription = this.emitter.addListener("speed", listener);
    return () => subscription.remove();
  }

  /**
   * HRR 기반 목표심박수 계산.
   * MHR = 220 - 나이
   * HRR = MHR - RHR
   * THR = HRR * intensity + RHR
   */
  static computeTargetHr(
    body: BodyInfo,
    purpose: WorkoutPurposeKey,
    intensityOverride?: number
  ): number {
    const mhr = 220 - body.age;
    const hrr = mhr - body.restingHr;
    const range = PURPOSE_INTENSITY[purpose];
    const intensity = intensityOverride ?? (range.low + range.high) / 2;
    return Math.round(hrr * intensity + body.restingHr);
  }

  /**
   * 구간별 강도(%) 설명 반환
   */
  static getIntensityRange(purpose: WorkoutPurposeKey): IntensityRange {
    return PURPOSE_INTENSITY[purpose];
  }

  teardownStreams() {
    if (this.ecgInterval) clearInterval(this.ecgInterval);
    if (this.speedInterval) clearInterval(this.speedInterval);
    this.ecgInterval = null;
    this.speedInterval = null;
  }

  private startMockStreams() {
    this.teardownStreams();

    // ECG: 1초마다 BPM 수치 방출 (약간의 노이즈 포함)
    this.ecgInterval = setInterval(() => {
      const mockBpm = 120 + Math.round(Math.random() * 15);
      this.emitter.emit("ecg", mockBpm);
    }, 1000);

    // 속도: 2초마다 현재 속도 정보 방출
    this.speedInterval = setInterval(() => {
      // 약간의 흔들림 주기
      const drift = (Math.random() - 0.5) * 0.2;
      this.currentSpeed = Math.max(0, this.currentSpeed + drift);
      this.emitter.emit("speed", parseFloat(this.currentSpeed.toFixed(1)));
    }, 2000);
  }
}

export type { WorkoutPurposeKey, BodyInfo, IntensityRange };
