// services/arduinoBridge.ts
import RNBluetoothClassic, {
  BluetoothDevice,
  BluetoothEventSubscription,
} from "react-native-bluetooth-classic";

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
  fatBurn: { low: 0.5, high: 0.7 },
  cardio: { low: 0.7, high: 0.85 },
  hiit: { low: 0.85, high: 0.95 },
};

export type ArduinoConnectionState =
  | "disconnected"
  | "connecting"
  | "connected";

type EcgListener = (bpm: number) => void;
type SpeedListener = (speed: number) => void;

/**
 * HC-05 Classic Bluetooth용 브리지 클래스
 * - BLE UUID/Characteristic 개념 없음
 * - 순수 문자열 시리얼 통신 기반
 *
 * 아두이노 통신 프로토콜:
 *  - 아두이노 → 앱:
 *      "BPM:85\n"
 *      "SPD:3.0\n"
 *  - 앱 → 아두이노:
 *      "T:150\n"
 *      "S:5.5\n"
 *      "STOP\n"
 */
export class ArduinoBridge {
  private device: BluetoothDevice | null = null;
  private state: ArduinoConnectionState = "disconnected";

  private ecgListeners: Set<EcgListener> = new Set();
  private speedListeners: Set<SpeedListener> = new Set();

  private dataSubscription: BluetoothEventSubscription | null = null;

  constructor() {}

  /**
   * 현재 연결 상태 반환
   */
  getState(): ArduinoConnectionState {
    return this.state;
  }

  /**
   * 페어링된(이미 연결된) 블루투스 기기 목록 조회
   * - 화면에서 리스트로 보여줄 때 사용 가능
   */
  async getBondedDevices(): Promise<BluetoothDevice[]> {
    const devices = await RNBluetoothClassic.getBondedDevices();
    return devices;
  }
    /**
   * Classic Bluetooth — 페어링된 기기 목록을 가져오는 스캔
   */
  async startScan(
    onDeviceFound: (device: BluetoothDevice) => void,
    durationMs: number = 10000
  ): Promise<void> {
    try {
      // HC-05는 BLE 스캔이 아니라 "이미 페어링된 리스트"를 가져오는 방식
      const bonded = await RNBluetoothClassic.getBondedDevices();

      bonded.forEach((dev) => {
        onDeviceFound(dev);
      });

      // durationMs 는 UI 연출용 — 여기선 특별히 타이머 동작 필요 없음
    } catch (e) {
      console.error("[BT] Scan error:", e);
      throw e;
    }
  }


  /**
   * 특정 디바이스에 연결 (HC-05 등)
   */
  async connect(deviceId: string): Promise<void> {
    this.state = "connecting";

    try {
      const device = await RNBluetoothClassic.connectToDevice(deviceId);
      this.device = device;
      this.state = "connected";

      // 데이터 수신 이벤트 등록
      this.dataSubscription = device.onDataReceived((event) => {
        const raw = (event.data ?? "").toString();
        this.handleIncomingData(raw);
      });
    } catch (error) {
      this.state = "disconnected";
      this.device = null;
      throw error;
    }
  }

  /**
   * 연결 해제
   */
  async disconnect(): Promise<void> {
    if (this.dataSubscription) {
      this.dataSubscription.remove();
      this.dataSubscription = null;
    }

    if (this.device) {
      try {
        await this.device.disconnect();
      } catch (e) {
        // 이미 끊겼을 수도 있으니 무시
      }
      this.device = null;
    }

    this.state = "disconnected";
  }

  /**
   * 공통 전송 함수 (문자열 + 개행)
   */
  private async sendCommand(command: string): Promise<void> {
    if (!this.device) {
      throw new Error("Device not connected");
    }
    // 아두이노 코드에서 readStringUntil('\n') 사용하므로 개행 필수
    await this.device.write(command + "\n");
  }

  /**
   * 목표 심박수 전송
   * → "T:150\n"
   */
  async sendTargetHeartRate(target: number): Promise<void> {
    await this.sendCommand(`T:${target}`);
  }

  /**
   * 비상 정지 명령
   * → "STOP\n"
   */
  async sendEmergencyStop(): Promise<void> {
    await this.sendCommand("STOP");
  }

  /**
   * 속도 설정
   * → "S:5.5\n"
   */
  async setSpeed(targetSpeed: number): Promise<void> {
    const safe = Math.max(0, parseFloat(targetSpeed.toFixed(1)));
    await this.sendCommand(`S:${safe.toFixed(1)}`);
  }

  /**
   * 아두이노 → 앱으로 들어오는 문자열 파싱
   * 예:
   *  "BPM:82"
   *  "SPD:3.0"
   */
  private handleIncomingData(raw: string) {
    const text = raw.trim();
    if (!text) return;

    // 한 번에 여러 줄이 들어올 가능성도 있으니 라인 단위로 분리
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      const msg = line.trim();
      if (!msg) continue;

      if (msg.startsWith("BPM:")) {
        const valueStr = msg.substring(4).trim();
        const bpm = parseInt(valueStr, 10);
        if (!Number.isNaN(bpm)) {
          this.notifyEcgListeners(bpm);
        }
      } else if (msg.startsWith("SPD:")) {
        const valueStr = msg.substring(4).trim();
        const speed = parseFloat(valueStr);
        if (!Number.isNaN(speed)) {
          this.notifySpeedListeners(speed);
        }
      } else {
        // 기타 디버그 메시지 (TARGET SET, SPEED SET 등)
        console.log("[BT][RAW]", msg);
      }
    }
  }

  /**
   * ECG 리스너 등록
   */
  onEcgSample(listener: EcgListener) {
    this.ecgListeners.add(listener);
    return () => this.ecgListeners.delete(listener);
  }

  /**
   * 속도 리스너 등록
   */
  onSpeed(listener: SpeedListener) {
    this.speedListeners.add(listener);
    return () => this.speedListeners.delete(listener);
  }

  /**
   * 리스너 정리
   */
  teardownStreams() {
    this.ecgListeners.clear();
    this.speedListeners.clear();

    if (this.dataSubscription) {
      this.dataSubscription.remove();
      this.dataSubscription = null;
    }
  }

  /**
   * ECG 리스너들에게 알림
   */
  private notifyEcgListeners(bpm: number) {
    this.ecgListeners.forEach((listener) => listener(bpm));
  }

  /**
   * 속도 리스너들에게 알림
   */
  private notifySpeedListeners(speed: number) {
    this.speedListeners.forEach((listener) => listener(speed));
  }

  // === 심박수 계산 유틸 (기존 그대로 유지) ===

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

  static getIntensityRange(purpose: WorkoutPurposeKey): IntensityRange {
    return PURPOSE_INTENSITY[purpose];
  }
}

export type { WorkoutPurposeKey, BodyInfo, IntensityRange };
