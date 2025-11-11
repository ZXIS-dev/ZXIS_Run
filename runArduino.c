// ==== 복붙 시작 ====
// Arduino 심박수 기반 트레드밀 제어 예시 (diet: 60~70, training: 70~80)

#include <Arduino.h>

/* =====================[ 하드웨어 핀 설정 ]===================== */
// L298N 기준 예시 (보드/배선에 맞게 수정하세요)
const int PIN_MOTOR_PWM = 5;   // ENA에 연결 (PWM 핀)
const int PIN_MOTOR_IN1 = 7;   // IN1
const int PIN_MOTOR_IN2 = 8;   // IN2

// ECG 센서 입력 (아날로그 예시; 라이브러리 쓰면 그 함수로 대체)
const int PIN_ECG = A0;

/* =====================[ 제어 파라미터 ]===================== */
// 공통
const uint8_t  PWM_MIN       = 70;     // 모터가 실제로 도는 최소 PWM (장치에 맞게 튜닝)
const uint8_t  PWM_MAX       = 255;    // 최대 PWM
const uint16_t CTRL_PERIODMS = 1000;   // 제어 주기 (ms) - 1초마다 한 번 조정
const float    HR_SMOOTH_A   = 0.6f;   // BPM EMA(지수이동평균) 계수 (0~1, 클수록 둔감하게)

// 비례 제어 이득(오차 → PWM 변경량으로 환산)
const float    KP            = 3.5f;   // 오차 1bpm 당 PWM 3.5 정도 변경 (튜닝 포인트)

// 히스테리시스(데드밴드) - 이 범위 내부면 속도 유지 (출렁임 방지)
const float    HR_DEADBAND   = 1.5f;   // ±1.5 bpm

// 비정상 값/노이즈 방어
const uint8_t  HR_VALID_MIN  = 40;     // 유효한 심박 최솟값
const uint8_t  HR_VALID_MAX  = 200;    // 유효한 심박 최댓값

/* =====================[ 상태 변수 ]===================== */
String setMode = "";        // "diet" 또는 "training"
uint8_t motorPwm = 0;       // 현재 모터 PWM
float   hrEma    = 0.0f;    // EMA로 스무딩된 BPM
unsigned long lastCtrlMs = 0;

/* =====================[ 유틸 함수들 ]===================== */

// (필요 시 교체) ECG → BPM 추정 함수(더미 구현)
// - 실제로는 MAX30102/AD8232 등 라이브러리/알고리즘을 써서 BPM을 구하세요.
int readBPM() {
  // 아주 단순한 더미: 아날로그 값 범위를 50~150bpm 정도로 매핑 (테스트용)
  int raw = analogRead(PIN_ECG); // 0~1023
  int bpm = map(raw, 0, 1023, 50, 150);
  return bpm;
}

// 안전 클램프
template<typename T>
T clampT(T v, T lo, T hi) {
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}

// 모터 회전: 러닝머신은 한 방향만 사용(전진). 역회전 금지.
void motorWrite(uint8_t pwm) {
  digitalWrite(PIN_MOTOR_IN1, HIGH);
  digitalWrite(PIN_MOTOR_IN2, LOW);
  analogWrite(PIN_MOTOR_PWM, pwm);
  motorPwm = pwm;
}

// 목표 구간 유지 제어 루프
void controlHeartRateBand(float targetLow, float targetHigh) {
  // 1) 센서에서 BPM 읽기
  int bpm = readBPM();

  // 2) 값 검증 및 스무딩
  bool valid = (bpm >= HR_VALID_MIN && bpm <= HR_VALID_MAX);
  if (!valid) {
    // 비정상 측정시: 모터를 너무 급히 바꾸지 않고 현재 유지 (로그만)
    Serial.print("[WARN] Invalid BPM: "); Serial.println(bpm);
    return;
  }

  if (hrEma <= 0.0f) hrEma = bpm;     // 초기화
  hrEma = HR_SMOOTH_A * hrEma + (1.0f - HR_SMOOTH_A) * bpm;

  // 3) 제어 주기마다 속도 조절
  unsigned long now = millis();
  if (now - lastCtrlMs < CTRL_PERIODMS) {
    // 아직 제어 시점 아님 → 상태만 출력하고 리턴
    Serial.print("BPM="); Serial.print(bpm);
    Serial.print(" (EMA="); Serial.print(hrEma, 1);
    Serial.print(") | PWM="); Serial.println(motorPwm);
    return;
  }
  lastCtrlMs = now;

  // 4) 오차 계산 (밴드 외부일 때만 조작)
  float pwmDelta = 0.0f;

  if (hrEma < targetLow - HR_DEADBAND) {
    // 심박이 너무 낮음 → 속도(=PWM) 올리기
    float err = (targetLow - hrEma); // 몇 bpm 부족?
    pwmDelta = KP * err;             // 비례이득으로 PWM 변경량 산출
  } else if (hrEma > targetHigh + HR_DEADBAND) {
    // 심박이 너무 높음 → 속도(=PWM) 낮추기
    float err = (hrEma - targetHigh);
    pwmDelta = -KP * err;
  } else {
    // 데드밴드 내 → 유지 (미세 출렁임 방지)
    pwmDelta = 0.0f;
  }

  // 5) PWM 갱신 + 안전 클램프
  int nextPwm = (int)motorPwm + (int)round(pwmDelta);
  nextPwm = clampT<int>(nextPwm, PWM_MIN, PWM_MAX);
  motorWrite((uint8_t)nextPwm);

  // 6) 디버그 출력
  Serial.print("[CTRL] Target=");
  Serial.print(targetLow); Serial.print("~"); Serial.print(targetHigh);
  Serial.print(" | BPM="); Serial.print(bpm);
  Serial.print(" (EMA="); Serial.print(hrEma, 1); Serial.print(")");
  Serial.print(" | ΔPWM="); Serial.print((int)round(pwmDelta));
  Serial.print(" | PWM→"); Serial.println(nextPwm);
}

/* =====================[ 모드별 함수 ]===================== */
// dietRun: 목표 60~70 bpm
void dietRun() {
  controlHeartRateBand(60.0f, 70.0f);
}

// trainingRun: 목표 70~80 bpm
void trainingRun() {
  controlHeartRateBand(70.0f, 80.0f);
}

/* =====================[ 표준 Arduino 구조 ]===================== */
void setup() {
  Serial.begin(9600);

  pinMode(PIN_MOTOR_PWM, OUTPUT);
  pinMode(PIN_MOTOR_IN1, OUTPUT);
  pinMode(PIN_MOTOR_IN2, OUTPUT);
  pinMode(PIN_ECG, INPUT);

  // 초기 모터 정방향, 안전한 낮은 속도
  digitalWrite(PIN_MOTOR_IN1, HIGH);
  digitalWrite(PIN_MOTOR_IN2, LOW);
  motorWrite(PWM_MIN);

  Serial.println("모드 입력: diet / training");
}

void loop() {
  // 1) 시리얼에서 모드 입력 받기 (줄바꿈 기준)
  if (Serial.available() > 0) {
    setMode = Serial.readStringUntil('\n');
    setMode.trim();
    if (setMode != "diet" && setMode != "training") {
      Serial.println("잘못된 입력. diet 또는 training을 입력하세요.");
      setMode = "";
    } else {
      Serial.print("모드 변경: ");
      Serial.println(setMode);
    }
  }

  // 2) 모드에 따라 제어
  if (setMode == "diet") {
    dietRun();
  } else if (setMode == "training") {
    trainingRun();
  } else {
    // 모드 미설정: 현재 속도 유지, 상태만 출력
    int bpm = readBPM();
    if (bpm >= HR_VALID_MIN && bpm <= HR_VALID_MAX) {
      if (hrEma <= 0.0f) hrEma = bpm;
      hrEma = HR_SMOOTH_A * hrEma + (1.0f - HR_SMOOTH_A) * bpm;
    }
    Serial.print("[IDLE] 모드 대기 | BPM=");
    Serial.print(bpm);
    Serial.print(" (EMA="); Serial.print(hrEma, 1); Serial.print(")");
    Serial.print(" | PWM="); Serial.println(motorPwm);
    delay(500);
  }
}
// ==== 복붙 끝 ====
