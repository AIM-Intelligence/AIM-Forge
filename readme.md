# AIM-Forge

비주얼 플로우 기반의 Python IDE - 노드를 연결하여 코드를 시각적으로 실행하고, Language Server Protocol(LSP)을 통해 VS Code 수준의 개발 경험을 제공합니다.

## 🚀 Quick Start

### Docker로 실행 (준비 중)
```bash
# 개발 모드
docker-compose -f docker-compose.dev.yml up --build

# 프로덕션 모드  
docker-compose -f docker-compose.prod.yml up --build
```

### 로컬 개발 (권장)
```bash
# pnpm 설치
npm install -g pnpm

# 의존성 설치
pnpm install

# 개발 서버 실행
pnpm dev
```

## 📚 컴포넌트 개발 학습 가이드

AIM-Forge에서 컴포넌트를 개발하고 싶다면 다음 단계를 따라주세요:

### Step 1: Example Project 실행해보기
```bash
# 1. AIM-Forge 실행
pnpm dev

# 2. 브라우저에서 http://localhost:5173 접속

# 3. "New Project" 버튼으로 프로젝트 생성

# 4. 왼쪽 패널에서 컴포넌트 드래그하여 추가
   - Start Node 추가
   - Custom Node 추가  
   - Result Node 추가

# 5. 노드 연결 후 Start 버튼으로 실행
```

### Step 2: Custom Component 이해하기
커스텀 컴포넌트의 두 가지 모드를 익히세요:

- **Python Script Mode** - 간단한 `RunScript` 함수로 빠른 프로토타이핑
- **AIM SDK Mode** - 헬퍼 클래스와 함께 재사용 가능한 컴포넌트 개발

📖 **필독:** [`docs/component-dev/CUSTOM_COMPONENT_GUIDE.md`](docs/component-dev/CUSTOM_COMPONENT_GUIDE.md)

### Step 3: 실제 Component 만들기
프론트엔드 UI와 백엔드 로직을 갖춘 정식 컴포넌트 개발:

1. 백엔드 템플릿 작성 (`packages/backend/templates/`)
2. 프론트엔드 컴포넌트 작성 (`packages/frontend/src/components/nodes/`)
3. 컴포넌트 등록 및 테스트

📖 **필독:** [`docs/component-dev/COMPONENT_DEVELOPMENT.md`](docs/component-dev/COMPONENT_DEVELOPMENT.md)

### 🤖 AI와 함께 개발하기
Claude, GPT 등 AI 도구와 함께 컴포넌트를 개발할 수 있도록 프로젝트 전체 컨텍스트를 제공합니다.

📖 **AI 프롬프트:** [`docs/component-dev/AI_COMPONENT_PROMPTS.md`](docs/component-dev/AI_COMPONENT_PROMPTS.md)

## 📁 문서 구조

```
docs/
├── development/         # 시스템 개발자용
│   └── README.md        # 상세 개발 가이드
│
└── component-dev/       # 컴포넌트 개발자용
    ├── README.md        # 컴포넌트 개발 시작 가이드
    ├── CUSTOM_COMPONENT_GUIDE.md     # 커스텀 컴포넌트 규칙
    ├── COMPONENT_DEVELOPMENT.md      # 정식 컴포넌트 개발
    └── AI_COMPONENT_PROMPTS.md       # AI 도구 활용
```

## 🏗️ 프로젝트 구조

```
packages/
├── frontend/            # React + TypeScript + XYFlow
│   └── src/
│       ├── components/  # UI 컴포넌트
│       ├── pages/       # 라우트 페이지
│       └── stores/      # Zustand 상태 관리
│
└── backend/             # FastAPI + Python
    ├── app/
    │   ├── api/         # API 엔드포인트
    │   └── core/        # 비즈니스 로직
    └── templates/       # 컴포넌트 템플릿
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

MIT License - 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

## 🔗 Links

- [Issue Tracker](https://github.com/AIM-Intelligence/AIM-Forge/issues)
- [Documentation](docs/)
- [API Reference](http://localhost:8000/docs)
