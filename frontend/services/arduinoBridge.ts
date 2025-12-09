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

export class ArduinoBridge {
  private device: BluetoothDevice | null = null;
  private state: ArduinoConnectionState = "disconnected";
  private ecgListeners: Set<EcgListener> = new Set();
  private speedListeners: Set<SpeedListener> = new Set();
  private dataSubscription: BluetoothEventSubscription | null = null;
  private receiveBuffer: string = "";

  constructor() {}

  getState(): ArduinoConnectionState {
    return this.state;
  }

  async getBondedDevices(): Promise<BluetoothDevice[]> {
    const devices = await RNBluetoothClassic.getBondedDevices();
    return devices;
  }

  async startScan(
    onDeviceFound: (device: BluetoothDevice) => void,
    durationMs: number = 10000
  ): Promise<void> {
    try {
      const bonded = await RNBluetoothClassic.getBondedDevices();
      bonded.forEach((dev) => {
        onDeviceFound(dev);
      });
    } catch (e) {
      console.error("[BT] Scan error:", e);
      throw e;
    }
  }

  async connect(deviceId: string): Promise<void> {
    // 이미 연결되어 있으면 먼저 연결 해제
    if (this.device && this.state === "connected") {
      console.log("[BT] Already connected, disconnecting first...");
      await this.disconnect();
    }

    this.state = "connecting";
    this.receiveBuffer = "";

    // 타임아웃 설정
    const connectWithTimeout = async () => {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error("Connection timeout after 15 seconds"));
        }, 15000);
      });

      const connectPromise = RNBluetoothClassic.connectToDevice(deviceId);
      return Promise.race([connectPromise, timeoutPromise]);
    };

    try {
      console.log(`[BT] Connecting to device: ${deviceId}`);
      
      const device = await connectWithTimeout();
      
      // 연결 상태 확인
      const isConnected = await device.isConnected();
      if (!isConnected) {
        throw new Error("Device connected but not responding");
      }
      
      this.device = device;
      this.state = "connected";
      
      console.log(`[BT] Successfully connected to: ${device.name || deviceId}`);

      // 데이터 수신 리스너 등록
      this.dataSubscription = device.onDataReceived((event) => {
        const raw = (event.data ?? "").toString();
        console.log("[BT] Received raw:", raw);
        this.receiveBuffer += raw;
        this.processBuffer();
      });

      // HC-06 초기화 메시지 전송
      try {
        await this.device.write("READY\n");
        console.log("[BT] Sent initialization message");
      } catch (e) {
        console.warn("[BT] Could not send init message:", e);
      }
      
    } catch (error) {
      console.error("[BT] Connection failed:", error);
      this.state = "disconnected";
      this.device = null;
      this.receiveBuffer = "";
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    console.log("[BT] Disconnecting...");
    
    if (this.dataSubscription) {
      this.dataSubscription.remove();
      this.dataSubscription = null;
    }

    if (this.device) {
      try {
        await this.device.disconnect();
        console.log("[BT] Disconnected successfully");
      } catch (e) {
        console.log("[BT] Disconnect error (may be already disconnected):", e);
      }
      this.device = null;
    }

    this.state = "disconnected";
    this.receiveBuffer = "";
  }

  private async sendCommand(command: string): Promise<void> {
    if (!this.device) {
      throw new Error("Device not connected");
    }
    
    console.log(`[BT] Sending command: ${command}`);
    await this.device.write(command + "\n");
  }

  async sendTargetHeartRate(target: number): Promise<void> {
    await this.sendCommand(`T:${target}`);
  }

  async sendEmergencyStop(): Promise<void> {
    await this.sendCommand("STOP");
  }

  async setSpeed(targetSpeed: number): Promise<void> {
    const safe = Math.max(0, parseFloat(targetSpeed.toFixed(1)));
    await this.sendCommand(`S:${safe.toFixed(1)}`);
  }

  private processBuffer() {
    // HC-06은 \r 또는 \r\n 또는 \\r로 끝날 수 있으므로 모두 처리
    this.receiveBuffer = this.receiveBuffer.replace(/\r\n/g, "\n");
    this.receiveBuffer = this.receiveBuffer.replace(/\r/g, "\n");
    this.receiveBuffer = this.receiveBuffer.replace(/\\r/g, "\n");

    let newlineIndex;
    while ((newlineIndex = this.receiveBuffer.indexOf("\n")) !== -1) {
      const line = this.receiveBuffer.substring(0, newlineIndex).trim();
      this.receiveBuffer = this.receiveBuffer.substring(newlineIndex + 1);

      if (line.length > 0) {
        this.parseLine(line);
      }
    }
    

    // 버퍼 폭주 방지
    if (this.receiveBuffer.length > 500) {
      console.warn("[BT] Buffer overflow, clearing");
      this.receiveBuffer = "";
    }
  }

  private parseLine(line: string) {
    console.log("[BT] Parsing line:", line);

    if (line.startsWith("BPM:")) {
      const value = parseInt(line.substring(4).trim(), 10);
      if (!isNaN(value)) {
        this.notifyEcgListeners(value);
      }
      return;
    }

    if (line.startsWith("SPD:")) {
      const value = parseFloat(line.substring(4).trim());
      if (!isNaN(value)) {
        this.notifySpeedListeners(value);
      }
      return;
    }

    if (line.startsWith("N:")) {
      console.log("[BT] Received Target N:", line.substring(2).trim());
      return;
    }

    console.log("[BT] Unknown message:", line);
  }

  onEcgSample(listener: EcgListener) {
    this.ecgListeners.add(listener);
    return () => this.ecgListeners.delete(listener);
  }

  onSpeed(listener: SpeedListener) {
    this.speedListeners.add(listener);
    return () => this.speedListeners.delete(listener);
  }

  teardownStreams() {
    this.ecgListeners.clear();
    this.speedListeners.clear();
    this.receiveBuffer = "";

    if (this.dataSubscription) {
      this.dataSubscription.remove();
      this.dataSubscription = null;
    }
  }

  private notifyEcgListeners(bpm: number) {
    this.ecgListeners.forEach((listener) => listener(bpm));
  }

  private notifySpeedListeners(speed: number) {
    this.speedListeners.forEach((listener) => listener(speed));
  }

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