# F1 Hub

Next.js 기반 F1 종합 대시보드. **정적 export**로 빌드해 S3 + CloudFront에서 서빙합니다.

> 🔗 **Live**: https://d3shcg6j0sntam.cloudfront.net
> 🛠 **백엔드·인프라**: [F1RealTimeDashboard](https://github.com/F3ZLoV/F1RealTimeDashboard)

---

## 실행

```bash
npm install

# API Gateway 주소 (백엔드 terraform output replay_api_base)
echo "NEXT_PUBLIC_API_BASE=https://xxxxx.execute-api.us-east-1.amazonaws.com" > .env.local

npm run dev     # http://localhost:3000
npm run build   # out/ 생성 → S3 업로드
```

`NEXT_PUBLIC_API_BASE`는 **빌드 시점에 코드에 박힙니다.** API 주소가 바뀌면 반드시 다시 빌드해야 합니다.

---

## 페이지

| 경로 | 내용 |
|---|---|
| `/` | 다음 레이스 카운트다운 · 서킷 실루엣 · 스탠딩 요약 |
| `/schedule` | 시즌 일정 · 다음 레이스 하이라이트 |
| `/standings/drivers` | 드라이버 챔피언십 (헤드샷 · 팀 로고 · 포인트 바) |
| `/standings/constructors` | 컨스트럭터 챔피언십 |
| `/results` | GP 선택 · 우승자/폴/패스티스트랩 카드 · 레이스·예선·그리드 탭 |
| `/replay` | 텔레메트리 리플레이 (트랙맵 · 타이밍타워 · AI 타이어 분석) |

---

## 데이터 소스

**서버가 없으므로 브라우저가 직접 가져옵니다.**

- **Jolpica** — 스케줄·스탠딩. 항상 최신
- **`/data/*.json`** — 시즌 결과·예선. 백엔드가 S3에 구워둔 것을 CloudFront에서 받습니다.
  없으면 Jolpica로 폴백하므로 로컬 개발에서도 동작합니다
- **API Gateway** — 텔레메트리 리플레이 청크
- **OpenF1** — 드라이버 헤드샷·팀 컬러

---

## 리플레이 뷰어

`canvas`는 60fps로 명령형 렌더링, 사이드 패널은 React 상태로 갱신합니다.
19대를 매 프레임 리렌더하면 무거우므로 **계층을 나눴습니다** — 캔버스 60fps,
속도·기어 등 수치 15fps, 타이밍타워 순위 3fps.

**순위는 누적 주행거리로 계산합니다.** 랩 수만으로 정렬하면 같은 랩의 19대가
카 넘버 순으로 나열됩니다. 프레임 좌표에서 구간 거리를 적산해두고 그 시점의 진행도를
비교하면 같은 랩 안의 앞뒤도 잡히고 추월도 반영됩니다.

**트랙 구조는 좌표에서 분석합니다** (`src/lib/trackGeometry.ts`).
곡률로 코너·직선을 판정하고, DRS 활성 지점을 경로에 투영해 존을 찾습니다.
섹터 경계만 서버가 랩 데이터에서 역산해 내려줍니다.

---

## 구성

```
src/
├── app/                    페이지 (전부 클라이언트 컴포넌트 — 정적 export)
├── components/
│   ├── replay/             ReplayClient · ReplayViewer · useReplayData
│   └── TeamLogo · Flag · DriverAvatar · Countdown
└── lib/
    ├── f1api.ts            Jolpica/OpenF1 클라이언트 (캐시 파일 우선)
    ├── trackGeometry.ts    코너·직선·DRS 존 분석
    ├── teams.ts            팀 컬러 · 로고 매핑 · 국가 코드
    └── useAsync.ts         클라이언트 데이터 로딩 훅
public/
├── logos/                  팀 로고 SVG
└── drivers/                드라이버 이미지
```

---

## 정적 export 관련 주의

`output: "export"`이므로 **서버 컴포넌트에서 런타임 fetch를 할 수 없습니다.**
데이터가 필요한 페이지는 모두 `"use client"` + `useAsync`로 브라우저에서 가져옵니다.

`trailingSlash: true`가 필요합니다. S3에서 `/schedule` 요청이 `/schedule/index.html`로
매핑되어야 하는데, CloudFront는 루트에만 자동으로 붙여주기 때문입니다
(하위 경로는 CloudFront Function이 URI를 다시 씁니다).

---

## 디자인

F1 중계 타이밍 그래픽에서 가져왔습니다 — 각진 클립 코너, 팀 컬러 스트라이프,
tabular 모노 숫자, 딥 그래파이트 배경. 폰트는 Geist(본문) · Geist Mono(데이터) ·
Chakra Petch(제목·숫자).
