# F1 Hub

Next.js(App Router) 기반 F1 종합 대시보드. 스케줄 · 스탠딩 · 텔레메트리 리플레이.

## 실행

```bash
npm install
npm run dev
# http://localhost:3000
```

## 데이터 소스

- **Jolpica** (`api.jolpi.ca/ergast/f1`) — 스케줄, 스탠딩, 결과. 무인증, 무료, 1950~현재.
- **OpenF1** (`api.openf1.org/v1`) — 실시간 텔레메트리 (리플레이 페이지).

서버 컴포넌트에서 fetch, Next.js ISR로 1시간 캐싱 (`revalidate: 3600`).

## 구조

```
src/
├── app/
│   ├── layout.tsx           # 루트 레이아웃 (사이드바 + 메인)
│   ├── globals.css          # 디자인 토큰 (피트월 다크 테마)
│   ├── page.tsx             # 홈 대시보드 (다음레이스 + 스탠딩 요약)
│   └── schedule/page.tsx    # 시즌 일정 + 카운트다운
├── components/
│   ├── Sidebar.tsx          # 네비게이션
│   └── Countdown.tsx        # 다음 레이스 카운트다운
└── lib/
    ├── f1api.ts             # Jolpica/OpenF1 클라이언트 + 타입
    └── teams.ts             # 팀 컬러 + 국기 매핑
```

## 구현된 것

- ✅ 레이아웃 + 사이드바 (반응형)
- ✅ 홈 대시보드 (다음 레이스, 드라이버/컨스트럭터 스탠딩 top5)
- ✅ 스케줄 페이지 (다음 레이스 하이라이트 + 카운트다운 + 전체 일정)

## TODO (다음)

- [ ] 드라이버/컨스트럭터 스탠딩 전체 페이지 (`/standings/drivers`, `/standings/constructors`)
- [ ] 레이스 결과 페이지 (`/results`)
- [ ] 텔레메트리 리플레이 편입 (`/replay`) — 기존 F1RealTimeDashboard의 canvas 대시보드
- [ ] 라이브 타이밍, 드라이버 스탯, H2H 등

## 디자인

F1 피트월 / 방송 타이밍스크린 감성:
- 배경 딥 그래파이트(`#0A0B0D`), 데이터는 tabular 모노
- accent = F1 레드(`#E10600`) + 팀 컬러(데이터 기반)
- 기존 텔레메트리 대시보드와 통일 → 리플레이 편입 자연스럽게
