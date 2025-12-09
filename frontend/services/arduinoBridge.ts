import { BleManager, Device, Characteristic } from "react-native-ble-plx";
import { Platform, PermissionsAndroid } from "react-native";
import { Buffer} from "buffer";
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

// 아두이노 BLE 서비스 UUID (아두이노 코드와 일치해야 함)
const SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
const ECG_CHARACTERISTIC_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a8";
const SPEED_CHARACTERISTIC_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a9";
const COMMAND_CHARACTERISTIC_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26aa";

export class ArduinoBridge {
  private manager: BleManager;
  private device: Device | null = null;
  private state: ArduinoConnectionState = "disconnected";
  private ecgListeners: Set<EcgListener> = new Set();
  private speedListeners: Set<SpeedListener> = new Set();
  private scanningDevices: Map<string, Device> = new Map();

  constructor() {
    this.manager = new BleManager();
  }

  /**
   * 블루투스 권한 요청 (Android)
   */
  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === "android") {
      if (Platform.Version >= 31) {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);
        return Object.values(granted).every(
          (status) => status === PermissionsAndroid.RESULTS.GRANTED
        );
      } else {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
    }
    return true;
  }

  /**
   * 주변 BLE 디바이스 스캔
   */
  async startScan(
    onDeviceFound: (device: Device) => void,
    durationMs: number = 10000
  ): Promise<void> {
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      throw new Error("Bluetooth permissions not granted");
    }

    this.scanningDevices.clear();

    this.manager.startDeviceScan(
      [SERVICE_UUID], // 특정 서비스 UUID로 필터링
      { allowDuplicates: false },
      (error, device) => {
        if (error) {
          console.error("[BLE Scan Error]", error);
          return;
        }

        if (device && device.name) {
          // 중복 방지
          if (!this.scanningDevices.has(device.id)) {
            this.scanningDevices.set(device.id, device);
            onDeviceFound(device);
          }
        }
      }
    );

    // 일정 시간 후 스캔 중지
    setTimeout(() => {
      this.stopScan();
    }, durationMs);
  }

  /**
   * 스캔 중지
   */
  stopScan() {
    this.manager.stopDeviceScan();
  }

  /**
   * 특정 디바이스에 연결
   */
  async connect(deviceId: string): Promise<void> {
    this.state = "connecting";
    
    try {
      // 연결
      this.device = await this.manager.connectToDevice(deviceId, {
        autoConnect: false,
        requestMTU: 512,
      });

      console.log(`[BLE] Connected to ${this.device.name}`);

      // 서비스 및 특성 검색
      await this.device.discoverAllServicesAndCharacteristics();

      // 연결 끊김 모니터링
      this.device.onDisconnected((error, device) => {
        console.log("[BLE] Device disconnected", device?.name);
        this.state = "disconnected";
        this.device = null;
      });

      // ECG 데이터 구독 (Notify)
      this.device.monitorCharacteristicForService(
        SERVICE_UUID,
        ECG_CHARACTERISTIC_UUID,
        (error, characteristic) => {
          if (error) {
            console.error("[BLE ECG Error]", error);
            return;
          }
          if (characteristic?.value) {
            const bpm = this.decodeEcgData(characteristic.value);
            this.notifyEcgListeners(bpm);
          }
        }
      );

      // 속도 데이터 구독 (Notify)
      this.device.monitorCharacteristicForService(
        SERVICE_UUID,
        SPEED_CHARACTERISTIC_UUID,
        (error, characteristic) => {
          if (error) {
            console.error("[BLE Speed Error]", error);
            return;
          }
          if (characteristic?.value) {
            const speed = this.decodeSpeedData(characteristic.value);
            this.notifySpeedListeners(speed);
          }
        }
      );

      this.state = "connected";
      console.log("[BLE] Subscription started");
    } catch (error) {
      this.state = "disconnected";
      console.error("[BLE Connection Error]", error);
      throw error;
    }
  }

  /**
   * 연결 해제
   */
  async disconnect(): Promise<void> {
    if (this.device) {
      await this.device.cancelConnection();
      this.device = null;
    }
    this.state = "disconnected";
  }

  /**
   * 목표 심박수 전송
   */
  async sendTargetHeartRate(target: number): Promise<void> {
    if (!this.device) throw new Error("Device not connected");

    // "T:150\n" 형태로 전송
    const command = `T:${target}\n`;
    const base64 = this.stringToBase64(command);

    await this.device.writeCharacteristicWithResponseForService(
      SERVICE_UUID,
      COMMAND_CHARACTERISTIC_UUID,
      base64
    );

    console.log(`[BLE] Sent target HR: ${target}`);
  }

  /**
   * 비상 정지 명령
   */
  async sendEmergencyStop(): Promise<void> {
    if (!this.device) throw new Error("Device not connected");

    const command = "STOP\n";
    const base64 = this.stringToBase64(command);

    await this.device.writeCharacteristicWithResponseForService(
      SERVICE_UUID,
      COMMAND_CHARACTERISTIC_UUID,
      base64
    );

    console.log("[BLE] Emergency stop sent");
  }

  /**
   * 속도 설정
   */
  async setSpeed(targetSpeed: number): Promise<void> {
    if (!this.device) throw new Error("Device not connected");

    // "S:5.5\n" 형태로 전송
    const command = `S:${targetSpeed.toFixed(1)}\n`;
    const base64 = this.stringToBase64(command);

    await this.device.writeCharacteristicWithResponseForService(
      SERVICE_UUID,
      COMMAND_CHARACTERISTIC_UUID,
      base64
    );

    console.log(`[BLE] Set speed: ${targetSpeed}`);
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

  getState(): ArduinoConnectionState {
    return this.state;
  }

  /**
   * Base64로 인코딩된 ECG 데이터 디코딩
   * 아두이노에서 uint16_t로 BPM 전송한다고 가정
   */
  private decodeEcgData(base64: string): number {
    const buffer = Buffer.from(base64, "base64");
    // 2바이트 리틀엔디안으로 읽기
    if (buffer.length >= 2) {
      return buffer.readUInt16LE(0);
    }
    return 0;
  }

  /**
   * Base64로 인코딩된 속도 데이터 디코딩
   * 아두이노에서 float로 속도 전송한다고 가정
   */
  private decodeSpeedData(base64: string): number {
    const buffer = Buffer.from(base64, "base64");
    // 4바이트 리틀엔디안 float로 읽기
    if (buffer.length >= 4) {
      return buffer.readFloatLE(0);
    }
    return 0;
  }

  /**
   * 문자열을 Base64로 인코딩
   */
  private stringToBase64(str: string): string {
    return Buffer.from(str, "utf-8").toString("base64");
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

  teardownStreams() {
    // BLE는 자동으로 구독 해제됨
    this.ecgListeners.clear();
    this.speedListeners.clear();
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