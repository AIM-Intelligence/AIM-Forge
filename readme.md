# AIM-Forge

비주얼 플로우 기반의 Python IDE - 노드를 연결하여 코드를 시각적으로 실행하고, Language Server Protocol(LSP)을 통해 VS Code 수준의 개발 경험을 제공합니다.

## 🚀 Quick Start

### 로컬 개발 (권장)
```bash
# pnpm 설치
npm install -g pnpm

# 의존성 설치
pnpm install

# 개발 서버 실행
pnpm dev

# Network: http://XXX.XXX.XX.XXX:5173/ 접속
```

### Docker로 실행 (준비 중)
```bash
# 개발 모드
docker-compose -f docker-compose.dev.yml up --build

# 프로덕션 모드  
docker-compose -f docker-compose.prod.yml up --build
```

## 📚 컴포넌트 개발 학습 가이드

AIM-Forge 컴포넌트를 개발하고 싶다면 체계적인 학습 경로를 제공하는 가이드를 참고하세요:

👉 **[컴포넌트 개발자 가이드 바로가기](docs/component-dev/README.md)**

**학습 단계:**
- 🚀 Level 1: Quick Start - 첫 파이프라인 만들기
- 💡 Level 2: Custom Component 이해 - Python Script Mode & SDK Mode
- 🔧 Level 3: Production Component - 정식 컴포넌트 개발
- 🤖 Level 4: AI와 함께 개발 - Claude/GPT 활용법

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
