# 터미널 기반 패키지 관리 통합 계획

웹 UI에서 제공하던 `Packages` 패널을 제거하고, VS Code와 유사한 터미널 경험 안에서 패키지 관리를 모두 수행할 수 있도록 하는 단계별 계획입니다. 목표는 “사용자가 임베디드 터미널만으로 프로젝트 환경을 완전히 제어할 수 있고, 백엔드는 패키지 변경 사실을 안정적으로 감지해 워커와 LSP를 즉시 동기화”하는 것입니다.

---

## 1. 사용자 경험 목표
- 터미널 접속 시 자동으로 해당 프로젝트의 `.venv`가 활성화되고 `pip`, `python` 등 기본 명령이 정확히 동작한다.
- 터미널에서 `pip install/uninstall`을 실행하면 별도 UI 없이도 워커가 환경 변화를 감지하고 재시작한다.
- 패키지 설치/삭제 로그 확인, 최근 작업 히스토리 등의 편의 기능을 터미널 명령 또는 간단한 안내로 대체한다.
- 종전 `Packages` 패널에 있던 기능(설치/삭제, 설치된 라이브러리 조회, 로그 확인)을 더 이상 UI에서 제공하지 않는다.

---

## 2. 백엔드 정비
### 2.1 pip 래퍼 확장 (`app/core/venv_manager.py`)
- 이미 추가된 `_ensure_pip_entrypoints` 스크립트를 확장해 `pip`, `pip3`, `python -m pip` 호출이 모두 후처리 훅을 타도록 구성한다.
- 후처리 훅은 아래 두 가지를 수행:
  1. `env_meta.json`의 `updated_at`을 현재 시각으로 갱신.
  2. 새 `pip` 호출 결과(성공/실패, stdout/stderr)를 `.pip-logs/` 아래 저장.
- 가능하다면 래퍼 스크립트에 `aim-venv-sync --project <id>` 같은 경량 CLI를 호출해 워커 재시작 시그널을 날리도록 한다.

### 2.2 워커 재시작 감지 (`app/core/worker_manager.py`, `worker.py`)
- 워커가 부팅될 때 `env_meta.json`의 `updated_at` 값을 메모리에 저장.
- 각 노드 실행 직전에 파일을 다시 읽어 값이 바뀌었으면 현재 워커를 종료하고 새 워커를 기동.
- 재시작 실패 시 클라이언트에 명확한 에러(“환경 갱신 실패”)를 반환하고, 로그에 stdout/stderr 기록.

### 2.3 REST API 정리
- `app/api/packages.py` 라우터 삭제 → 관련 테스트(`tests/test_…`)도 제거.
- 종전 API를 사용하던 프론트 코드(React Query 등) 제거.
- 기존 패키지 설치/삭제 기록 기능이 필요하다면 REST가 아닌 터미널 명령(`aim-logs list`)으로 대체.

### 2.4 터미널 개선 (`app/api/terminal.py`)
- 이미 적용한 가상환경 자동 활성화를 기본값으로 확정.
- 추가 버그 픽스:
  - 셸 종료 후 master FD가 남아 EOF 스트림이 반복 전송되는 현상 점검.
  - Ctrl+C(시그널) 전달, 셸 종료 코드 수집.
  - WebSocket 오류 시 명확한 사유 코드/메시지 반환.
- 선택: 특정 명령어 (`pip`, `aim-*`) 실행 시 사용자에게 가이드 텍스트 출력(예: “패키지 변경이 감지되면 자동으로 워커를 재시작합니다”).

---

## 3. 프론트엔드 정리
### 3.1 UI 컴포넌트 삭제
- `packages/frontend/src/pages/Project/layouts/ProjectPanel.tsx`, `PackageManagerPanel.tsx`, `TerminalModal.tsx` 등에서 `Packages` 패널 관련 상태와 컴포넌트 제거.
- 패키지 API와 연결된 zustand 스토어, hooks 제거.

### 3.2 터미널 UX 강화
- 터미널 모달/패널은 유지하되 다음을 추가:
  - 프로젝트 진입 시 “패키지 설치 안내” 퀵 가이드 메시지 출력.
  - 최근 설치 로그 확인 방법(`ls .pip-logs` 등) 안내 명령.
  - `fit` 애드온 적용, 자동 리사이즈/포커스 처리.

### 3.3 사용자 안내 문서 및 온보딩
- 프런트 쪽 툴팁/모달을 통해 “패키지 관리 → terminal” 전환을 알리는 텍스트 추가.
- docs/README 혹은 UI 가이드에 패키지 관리 섹션 업데이트.

---

## 4. 자료/코드 정리
- 삭제 대상
  - `app/api/packages.py` 및 관련 테스트/스토어/컴포넌트.
  - `docs/component-dev/…` 중 패키지 패널 설명이 있는 문서.
  - 프런트 번들에서 사용하지 않는 타입 정의(`types` 폴더 내 Package 관련 인터페이스 등).
- 재사용 대상
  - `venv_manager`의 로그 작성(`write_pip_log`) 로직 → 터미널 안내에 재활용.
  - `.pip-logs/` 와 `env_meta.json` → 터미널에서 확인할 수 있도록 가이드 제공.

---

## 5. 단계별 일정
1. **Backend Pass**
   - pip 래퍼 후처리 + 워커 재시작 감지 구현.
   - 패키지 API 제거.
   - 터미널 WebSocket 안정화.
2. **Frontend Pass**
   - `Packages` 패널 제거.
   - 터미널 UX 강화 및 안내 추가.
3. **Docs & QA**
   - README/Docs 업데이트.
   - 시나리오 테스트: 동일 프로젝트에서 `pip install` → 즉시 워커 재시작, 설치/삭제/로그 조회.

---

## 6. QA 체크리스트
- 터미널 접속 즉시 프롬프트에 가상환경이 활성화되어 있는가(프롬프트 표시, `which pip` 확인).
- `pip install packagename` 실행 후 다른 노드 실행이 새 환경을 반영하는가.
- 설치/삭제 후 `.pip-logs`와 `env_meta.json`이 갱신되는가.
- `Packages` 패널 제거 후 UI에 깨진 영역은 없는가.
- 기존 프로젝트에 남아 있는 패키지 API 호출 코드가 없는가(404/JS 오류 검증).

---

## 7. 오픈 리스크 & 대응
- **사용자가 `python -m pip`를 직접 실행** → 래퍼 후처리가 누락될 수 있음 → `pip` 스크립트를 수정해 `python -m pip`도 래퍼를 통하도록 가이드, 또는 sitecustomize로 보완.
- **워커 재시작 실패** → 워커 매니저에서 재시작 실패 사유를 UI 토스트/로그로 노출, 사용자가 터미널에서 직접 수동 재시작(`aim-worker restart`) 가능하게.
- **대규모 패키지 설치 시 터미널 로그 과다** → 저장소 용량 관리 위해 오래된 `.pip-logs` 자동 정리.

---

## 8. 단계별 실행 체크리스트

### Step 1 — 코드 베이스 정리 준비 ✓
- [x] `packages/frontend`에서 `Packages` 패널 관련 컴포넌트/스토어/타입 식별 목록 작성.
  - UI 엔트리포인트: `packages/frontend/src/pages/Project/layouts/ProjectPanel.tsx:4`, `PackageManagerPanel.tsx`가 패널 렌더와 상태 토글을 담당.
  - API 사용 지점: `packages/frontend/src/utils/api.ts:312-343`에서 `list/install/uninstall/getPackageLog` 요청 정의.
  - 타입 정의: `packages/frontend/src/types/interface.ts:257-288`에 `PackageInfo`, `PackageActionResponse` 등 패키지 관련 인터페이스 존재.
- [x] `app/api/packages.py`와 연관된 백엔드 테스트, 유틸리티, 문서 위치 파악.
  - 엔드포인트 구현: `packages/backend/app/api/packages.py` 전반이 대상, `venv_manager.write_pip_log`, `update_env_metadata`, `worker_manager.restart` 호출.
  - 테스트: `packages/backend/tests/test_venv_manager.py`는 로그/메타 util을 간접 확인, 별도 API 테스트 파일은 없음.
  - 문서: `docs/development/README.md:107-110`에서 UI 패널 안내, `docs/development/README.md:128-130`에 REST 엔드포인트 명세 존재.
- [x] `.pip-logs`, `env_meta.json` 을 활용하는 현행 흐름 정리(삭제/유지 여부 결정).
  - 생성 위치: `venv_manager.write_pip_log`와 `update_env_metadata`가 패키지 작업마다 `.pip-logs/<timestamp>_...` 로그와 `env_meta.json`을 갱신.
  - 소비 지점: 현재는 `PackageManagerPanel`이 `getPackageLog`로 로그 내용을 표시, 워커/LSP는 직접 참조하지 않음.

### Step 2 — pip 래퍼 + 메타데이터 후처리
- [ ] `_ensure_pip_entrypoints`를 수정해 `pip`, `pip3`, `python -m pip` 호출이 모두 래퍼 스크립트를 거치도록 함.
- [ ] 래퍼 내부에서 `env_meta.json` `updated_at` 갱신, `.pip-logs` 기록 추가.
- [ ] 패키지 설치/삭제 후 `aim-worker restart` CLI 혹은 워커 매니저 호출 로직 배치.

### Step 3 — 워커 재시작 감시 로직
- [ ] `worker.py` 부팅 시 `env_meta.json` 스냅샷 저장.
- [ ] `exec_node` 처리 직전에 파일 수정 시간 비교, 변동 시 현재 워커를 종료하고 새 워커를 띄움.
- [ ] 재시작 실패 시 명확한 에러 메시지와 로그 출력.

### Step 4 — 백엔드 API/라우트 정리
- [ ] `app/api/packages.py` 및 관련 종속 코드 제거.
- [ ] 패키지 API 테스트(`tests/test_…`) 삭제 및 pytest 통과 확인.
- [ ] `worker_manager`/`EnhancedFlowExecutor`에서 더 이상 사용되지 않는 코드 정리.

### Step 5 — 터미널 WebSocket 개선
- [ ] 셸 종료/에러 시 마스터 FD 닫힘 확인, WebSocket 종료 코드 표준화.
- [ ] Ctrl+C 전달, 윈도우/리사이즈 처리가 정상인지 수동 검증.
- [ ] 특정 이벤트 시 사용자 안내 메시지(패키지 변경 감지 등) 출력.

### Step 6 — 프론트엔드 통합
- [ ] `Packages` 패널/상태/타입 제거, 라우팅/스토어에서 참조 삭제.
- [ ] 터미널 컴포넌트에 안내 텍스트/퀵 가이드 추가.
- [ ] `.pip-logs` 확인 방법 등을 문구로 제공.

### Step 7 — 문서 & QA
- [ ] docs/README 및 사용자 가이드에서 `Packages` 패널 언급 제거 후 터미널 사용법 추가.
- [ ] QA 시나리오: 설치→재시작 확인, 삭제→ImportError 확인, 터미널/워커 재연결 확인.
- [ ] 릴리즈 노트에 변경 사항 및 사용법 안내 작성.

### Step 8 — 롤아웃
- [ ] 스테이징에서 A/B 프로젝트로 검증, 로그 수집.
- [ ] 문제 없으면 전 프로젝트에 적용, 플래그/환경변수 제거.
- [ ] 모니터링 후 필요 시 미세 조정.

---

이 계획에 따라 구현하면, 사용자는 VS Code와 거의 동일한 터미널 기반 패키지 관리 경험을 얻고, 중복된 UI 유지보수 부담도 줄일 수 있습니다.
