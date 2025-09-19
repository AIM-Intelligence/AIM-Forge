# Markdown Note Component — Implementation Plan

## 1. Objectives & Scope
- Deliver a non-executable "Markdown Note" node for annotations, documentation, and presentation cues inside flows.
- Support GitHub-flavored Markdown (headings, lists, inline/code fences) with live rendering in-canvas.
- Provide transparent, draggable, and resizable text box UI that can overlap other nodes without obstructing flow view.
- Persist note content, size, and position inside project data so reloads and collaboration sessions remain consistent.
- Enable minor typography tweaks (font size/weight) driven by keyboard shortcuts; avoid complex WYSIWYG controls for v1.

## 2. UX & Interaction Design
- Node defaults: wide aspect, semi-transparent handle outlines, no background fill (only subtle border when selected).
- Editing modes:
  - Double-click (or shortcut) toggles between **edit** (markdown textarea overlay) and **view** (rendered markdown) modes.
  - Blur / Cmd+Enter commits changes and triggers backend persistence via `updateNodeData`.
- Resizing via ReactFlow node resize handles (retain aspect ratio toggle with Shift).
- Keyboard shortcuts (initial set):
  - `Cmd/Ctrl + =` / `Cmd/Ctrl + -` adjust font size within min/max bounds.
  - `Cmd/Ctrl + B` toggles bold markdown insertion (`**selection**`).
- Accessibility: ensure rendered markdown uses high-contrast text and headings map to semantic tags for screen readers.

## 3. Data Model & Persistence
- Extend node `data` payload stored in `structure.json` with:
  - `componentType: "MarkdownNote"` (drives renderer lookup).
  - `content: string` for raw markdown.
  - `fontSize: number` & `fontWeight: "normal" | "bold"` (optional customization state).
  - `dimensions: { width: number, height: number }` for persisted size.
- Reuse existing project APIs:
  - `updateNodeData` to patch content/formatting changes.
  - `updateNodePosition` already handles placement.
- No backend execution/template file required; ensure serializers safely accept large markdown blobs (validate size limit ~20KB).

## 4. Frontend Workstream
1. **Component Definition**
   - Create `packages/frontend/src/components/nodes/annotations/MarkdownNoteNode.tsx` (new category `annotations` if helpful).
   - Render markdown using `react-markdown` + `remark-gfm`; add dependencies to `packages/frontend/package.json`.
   - Overlay textarea in edit mode; hide background via CSS, mirror resizing frame to keep transparency.
2. **Node Registration**
   - Export component from category index and register inside `ComponentRegistry` and `componentLibrary` with metadata (icon, template id `markdown_note`).
   - Update `ProjectFlow` node type map to include `markdownNote` type if we choose dedicated type; otherwise branch on `componentType` inside `DefaultNode`.
3. **State Management**
   - Extend `useProjectData` transformation to map nodes with `componentType === "MarkdownNote"` to the new node renderer, passing content & formatting props.
   - Introduce local editing state with debounced save to `projectApi.updateNodeData`.
   - Persist `dimensions` when resize stops using existing handler pipeline (`useNodeOperations` / `useEdgeOperations`).
4. **Keyboard Shortcuts & Focus Handling**
   - Implement event listeners scoped to the active editor to adjust font settings and wrap selections with markdown tokens.
   - Ensure shortcuts do not leak to global flow shortcuts (stop propagation while in edit mode).
5. **Styling**
   - Add CSS module or Tailwind classes for transparent background, drop shadow on hover, and minimal toolbar (optional in later iteration).

## 5. Backend Adjustments
- **Project Structure**: ensure `project_structure` validator permits `componentType` and new fields (should already pass-through but confirm at `packages/backend/app/core/project_structure.py`).
- **Component Creation**: add template metadata in `packages/backend/templates` (even if no Python file). Options:
  - Create placeholder template `annotations/markdown_note.py` returning empty string for compatibility.
  - Adjust `components.create_node_from_template` to allow file-less nodes when template flagged as `documentation`.
- **Metadata Endpoint**: update `codeApi.getNodeMetadata` to return empty inputs/outputs for Markdown notes to avoid port rendering.
- **Tests**: extend project structure tests to cover creating/updating nodes with large markdown content.

## 6. Persistence & Migration Strategy
- New nodes rely on data fields only; existing projects unaffected.
- When first shipping, optionally run one-off migration script to ensure `componentType` defaults for existing TextInput nodes still behave (regression check).
- Document JSON schema additions in `docs/development/README.md` under project structure section.

## 7. QA & Validation
- Manual scenarios:
  - Create markdown note, add headings/lists/code block, reload page → content retained.
  - Resize & move note; ensure z-index keeps note above edges but below modals.
  - Shortcut tests for font size and bold insertion.
  - Collaboration smoke: open same project in two sessions, confirm backend updates propagate (current system uses polling; verify no race conditions).
- Automated coverage:
  - Add Vitest unit tests for formatting helpers & shortcut handlers once frontend test harness exists (document in plan even if deferred).
  - Extend backend pytest to validate `updateNodeData` accepts markdown payload and keeps JSON structure intact.

## 8. Documentation & Rollout
- Update component catalog docs (`docs/component-dev/README.md`) with Markdown Note usage notes and screenshots.
- Add changelog / release notes referencing new annotation capability.
- Provide quick tutorial snippet in root README or project blog for discoverability.

## 9. Open Questions
- Do we want live preview while typing (split view) or simple edit/preview toggle is enough for v1?
- Should notes support background color toggle for visibility on dark themes?
- Will we need history/undo per note beyond existing global undo stack?

## 10. Estimated Effort
- Frontend implementation & styling: ~2-3 dev days.
- Backend adjustments & tests: ~1 dev day.
- QA + documentation polish: ~0.5-1 day.

> Deliverable: functional Markdown Note node integrated into AIM-Forge flow editor with persisted markdown content, tailored UI interactions, and supporting documentation.

## 단계별 구현 플랜 (테스트 가능 단위)
1. **마크다운 노드 기본 렌더링**
   - 새 노드 타입(컴포넌트 등록)과 기본 UI 틀 구현 후, 뷰 모드에서 마크다운 렌더링이 정상 표시되는지 확인.
2. **에디팅 모드 전환 및 저장 연동**
   - 편집 모드 토글, textarea 입력, `updateNodeData` 저장 루틴을 연결하고, 새로고침 후 내용 유지 여부를 테스트.
3. **크기/위치 조정 및 지속성**
   - 리사이즈 핸들 및 드래그 이동 상태를 `dimensions`/`position`으로 저장하고, 재접속 시 동일 배치가 재현되는지 검증.
4. **단축키 및 포커스 처리**
   - 폰트 사이즈/굵기 단축키와 마크다운 삽입 단축키 구현 후, 다른 플로우 단축키와 충돌 없는지 확인.
5. **백엔드 호환성 & 템플릿 등록**
   - 템플릿/메타데이터 엔드포인트 업데이트가 문제 없이 동작하는지, 기존 프로젝트와의 호환성을 점검.
6. **문서화 및 최종 QA**
   - 사용자 문서 추가와 회귀 테스트(노트 생성→편집→배치→저장→재로딩)를 통해 안정성을 확인.

### 1단계 상세 계획
- **노드 타입 식별자 정의**: `componentType: "MarkdownNote"` 및 필요 시 React Flow `type` 명시.
- **컴포넌트 파일 생성**: `packages/frontend/src/components/nodes/annotations/MarkdownNoteNode.tsx` 생성, 기본 JSX 골격과 투명 배경 스타일 설정.
- **마크다운 렌더러 도입**: `react-markdown`, `remark-gfm` 추가 후, 단순 헤딩/리스트/코드 블록 렌더링 지원 확인.
- **샘플 데이터 바인딩**: 더미 `content` 값을 prop으로 전달하여 렌더링만 하는 플로우 노드 생성.
- **렌더링 테스트**: 로컬에서 노드 추가 후 다양한 Markdown 구문이 의도대로 표시되는지 수동 확인.
- **회귀 체크**: 기본 플로우 로딩·화면 전환 시 에러 로그 없는지, 다른 노드 타입에 영향 없는지 점검.

## 추가 점검 항목
- [ ] `pnpm install` 이후 `pnpm --filter frontend lint` 실행해 기존 코드 전반의 ESLint 오류 정리
- [ ] `pnpm --filter frontend dev`에서 Markdown Text 노드를 여러 개 이동/편집하며 위치/스타일 유지 여부 수동 검증
- [ ] Tailwind typography 적용과 커스텀 마크다운 컴포넌트가 다른 노드 스타일에 영향 주지 않는지 UI 스모크 테스트
