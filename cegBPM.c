// ===================== 복붙 시작: ECG_BPM_Extractor.ino =====================
#include <Arduino.h>

/*
 [배선 가정: AD8232 같은 아날로그 ECG]
  - ECG OUT  → A0
  - GND 공유  (ECG GND ↔ Arduino GND)
  - 3.3V 또는 5V (모듈 권장 전압 확인, 보통 3.3V)
*/

const int PIN_ECG = A0;

/* 샘플링 파라미터 */
const uint16_t FS_HZ          = 250;   // 샘플링 주파수(Hz) 권장: 200~360
const uint32_t SAMPLE_PERIOD  = 1000000UL / FS_HZ; // μs 단위 (예: 250Hz → 4000μs)

/* 신호처리 파라미터 (간단한 실시간 R-peak 탐지용) */
const float DC_ALPHA          = 0.995f; // DC 제거(저역 EMA) 계수(0.99~0.999) → 클수록 느리게, 드리프트 제거
const float ENV_ALPHA         = 0.3f;   // 포락선(절댓값 EMA) 계수 → 클수록 민감
const float THRESH_ALPHA      = 0.01f;  // 임계값 적응(EMA) 계수 → 작을수록 천천히 적응
const float THRESH_GAIN       = 1.5f;   // 임계값 = (포락선 EMA 평균) * 이 값 (1.2~2.0 튜닝)

/* R-peak 검출 안정화 */
const uint16_t REFRACT_MS     = 250;    // 불응기(ms): 250ms 이내엔 또 peak로 보지 않음 (심박 240bpm 상한)
const uint8_t  RR_AVG_N       = 5;      // 최근 RR 간격 평균 개수 (3~8 권장)
const uint8_t  BPM_VALID_MIN  = 40;     // 유효 BPM 범위
const uint8_t  BPM_VALID_MAX  = 200;

/* 내부 상태 */
uint32_t lastSampleUs   = 0;
float    dcMean         = 0.0f;  // DC 제거용 EMA
float    envEma         = 0.0f;  // 포락선(절댓값) EMA
float    threshEnv      = 0.0f;  // 동적 임계값(포락선 평균 기반)
bool     aboveThresh    = false; // 임계 상향 교차 상태 기억
uint32_t lastPeakMs     = 0;     // 마지막 R-peak 시각
uint16_t rrBuf[RR_AVG_N];
uint8_t  rrIdx          = 0;
bool     rrFilled       = false;
int      bpmCurrent     = 0;

void pushRR(uint16_t rr) {
  rrBuf[rrIdx++] = rr;
  if (rrIdx >= RR_AVG_N) { rrIdx = 0; rrFilled = true; }

  // 이동평균으로 BPM 계산 (너무 튀는 값 완화)
  uint32_t sum = 0;
  uint8_t  n   = rrFilled ? RR_AVG_N : rrIdx;
  for (uint8_t i=0; i<n; ++i) sum += rrBuf[i];
  if (n > 0) {
    float rrAvg = (float)sum / (float)n; // ms
    int bpm = (int)round(60000.0f / rrAvg);
    if (bpm >= BPM_VALID_MIN && bpm <= BPM_VALID_MAX) {
      bpmCurrent = bpm;  // 유효 범위일 때만 갱신
    }
  }
}

// 매 샘플마다 호출: ECG 샘플 1개 처리 → 필요 시 R-peak 인식
void ecgProcessSample(int raw) {
  // 1) DC 제거: x_dc = x - EMA(x)
  dcMean = DC_ALPHA * dcMean + (1.0f - DC_ALPHA) * raw;
  float xdc = (float)raw - dcMean;

  // 2) 절댓값(간이 에너지) → 포락선 EMA로 스무딩
  float env = fabs(xdc);
  envEma = ENV_ALPHA * envEma + (1.0f - ENV_ALPHA) * env;

  // 3) 동적 임계값: 포락선 평균을 천천히 추적, 여기에 gain 곱
  threshEnv = THRESH_ALPHA * threshEnv + (1.0f - THRESH_ALPHA) * envEma;
  float thr = threshEnv * THRESH_GAIN;

  // 4) 임계 상향 교차(edge) + 불응기 체크로 R-peak 간주
  bool nowAbove = (envEma > thr);
  uint32_t nowMs = millis();
  if (nowAbove && !aboveThresh) {
    // 방금 임계 상향 교차
    if (nowMs - lastPeakMs >= REFRACT_MS) {
      // R-peak 인정
      uint16_t rr = (uint16_t)(nowMs - lastPeakMs);
      if (lastPeakMs != 0) { // 첫 peak는 RR 없음
        pushRR(rr);
      }
      lastPeakMs = nowMs;
    }
  }
  aboveThresh = nowAbove;
}

/* 샘플러: FS_HZ로 A0에서 샘플 채취 */
void ecgUpdateSampler() {
  uint32_t nowUs = micros();
  if (nowUs - lastSampleUs >= SAMPLE_PERIOD) {
    lastSampleUs += SAMPLE_PERIOD;
    int raw = analogRead(PIN_ECG); // 0~1023
    ecgProcessSample(raw);
  }
}

/* 외부에서 심박 요청 시 가져가는 함수 */
int ecgGetBPM() {
  return bpmCurrent; // 유효 범위 내에서 업데이트된 최신 BPM
}

void setup() {
  Serial.begin(115200);
  pinMode(PIN_ECG, INPUT);

  // 버퍼 초기화
  for (uint8_t i=0; i<RR_AVG_N; ++i) rrBuf[i] = 0;
  Serial.println("ECG BPM extractor ready (A0 @ 250Hz).");
}

void loop() {
  // 1) 샘플링/신호처리 계속 실행
  ecgUpdateSampler();

  // 2) 1초마다 BPM 출력 (데모)
  static uint32_t lastPrint = 0;
  if (millis() - lastPrint >= 1000) {
    lastPrint = millis();
    int bpm = ecgGetBPM();
    Serial.print("BPM: ");
    Serial.println(bpm);
  }

  // 주: 여기서 너의 트레드밀 제어 루프(dietRun()/trainingRun())를 호출해도 됨.
  // 단, ecgUpdateSampler()가 항상 충분히 자주 호출되도록 loop를 블로킹하지 마!
}
// ===================== 복붙 끝 =====================
