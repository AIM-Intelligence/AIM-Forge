# 컴포넌트 개발자 가이드

AIM-Forge 컴포넌트 개발을 시작하신 것을 환영합니다! 🎉

이 가이드는 처음 컴포넌트를 만드는 개발자부터 고급 기능을 활용하려는 개발자까지 모두를 위한 체계적인 학습 경로를 제공합니다.

## 🎯 학습 목표

이 가이드를 완료하면 다음을 할 수 있게 됩니다:

- ✅ Custom Component를 Python 스크립트로 빠르게 프로토타이핑
- ✅ 재사용 가능한 Production 컴포넌트 개발
- ✅ 프론트엔드 UI와 백엔드 로직 통합
- ✅ AI (Claude, GPT)와 함께 컴포넌트 개발

## 📖 학습 경로

### 🚀 Level 1: Quick Start

#### Step 1: AIM-Forge 실행해보기
```bash
# 프로젝트 실행
pnpm dev

# Network: http://XXX.XXX.XX.XXX:5173/ 접속
```

#### Step 2: Example Playground 프로젝트로 시작하기 (준비 중)
**"Example Playground"** 프로젝트를 열어 다양한 파이프라인을 체험해보세요:
- 기초 파이프라인: 데이터 입출력과 간단한 처리
- 베이스 컴포넌트 활용: CSV 로더, API 호출 등
- 커스텀 컴포넌트 예제: 사칙연산 계산기, 텍스트 처리기

#### Step 3: 첫 파이프라인 직접 만들기
1. **New Project** 버튼으로 새 프로젝트 생성
2. 왼쪽 패널에서 컴포넌트 추가:
   - `Start Node` - 실행 시작점
   - `Custom Node` - Python 코드 작성
   - `Result Node` - 결과 확인
3. 노드를 연결 (Start → Custom → Result)
4. Custom Node를 더블클릭하여 코드 작성:
   ```python
   def RunScript(x: int = 5) -> dict:
       return {"result": x * 2}
   ```
5. Start 노드의 실행 버튼 클릭

축하합니다! 첫 컴포넌트를 직접 만들었습니다! 🎉

### 💡 Level 2: Custom Component 이해

커스텀 컴포넌트의 핵심 개념을 이해합니다.

#### 📚 필독 문서
- 한국어: [CUSTOM_COMPONENT_GUIDE_KR.md](CUSTOM_COMPONENT_GUIDE_KR.md)
- English: [CUSTOM_COMPONENT_GUIDE_EN.md](CUSTOM_COMPONENT_GUIDE_EN.md)

**주요 학습 내용:**
- **Python Script Mode** - 간단한 실험과 프로토타이핑
- **AIM SDK Mode** - 정식 컴포넌트 개발
- **자동 포트 매핑** - 함수 시그니처 → UI 자동 생성
- **타입힌트 활용** - `int`, `str`, `bool`, `Literal` 등

#### 실습: 덧셈/뺄셈 계산기 만들기

1. Custom Node에 다음 코드 작성:
```python
from typing import Literal

def RunScript(
    a: float = 0,
    b: float = 0,
    operation: Literal["add", "subtract", "multiply", "divide"] = "add"
) -> dict:
    if operation == "add":
        result = a + b
    elif operation == "subtract":
        result = a - b
    elif operation == "multiply":
        result = a * b
    elif operation == "divide":
        result = a / b if b != 0 else "Error: Division by zero"
    
    return {
        "result": result,
        "operation": operation,
        "inputs": {"a": a, "b": b}
    }
```

2. 코드 저장 후 메타데이터 새로고침
3. 입력 포트가 자동으로 생성되는 것 확인
4. 실행하여 결과 확인

### 🔧 Level 3: Production Component 개발

실제 배포 가능한 컴포넌트를 만듭니다.

#### 📚 필독 문서
- 한국어: [COMPONENT_DEVELOPMENT_KR.md](COMPONENT_DEVELOPMENT_KR.md)
- English: [COMPONENT_DEVELOPMENT_EN.md](COMPONENT_DEVELOPMENT_EN.md)

**주요 학습 내용:**
- 백엔드 템플릿 작성 (`packages/backend/templates/`)
- 프론트엔드 컴포넌트 작성 (`packages/frontend/src/components/nodes/`)
- 컴포넌트 등록 및 카테고리 분류
- localStorage를 활용한 데이터 영속성

#### 실습: CSV 데이터 프로세서 만들기

1. **백엔드 템플릿** (`packages/backend/templates/dataops/csv_processor.py`):
```python
import csv
import chardet
from typing import Dict, Any, List

def RunScript(
    file_path: str = "",
    has_header: bool = True,
    filter_column: str = "",
    filter_value: str = ""
) -> Dict[str, Any]:
    try:
        # 인코딩 감지
        with open(file_path, 'rb') as f:
            raw = f.read()
            encoding = chardet.detect(raw)['encoding']
        
        # CSV 읽기
        with open(file_path, 'r', encoding=encoding) as f:
            if has_header:
                reader = csv.DictReader(f)
            else:
                reader = csv.reader(f)
            
            data = []
            for row in reader:
                if filter_column and filter_value:
                    if isinstance(row, dict):
                        if row.get(filter_column) == filter_value:
                            data.append(row)
                    else:
                        data.append(row)
                else:
                    data.append(row)
        
        return {
            "data": data,
            "row_count": len(data),
            "success": True
        }
    except Exception as e:
        return {
            "error": str(e),
            "success": False
        }
```

2. **컴포넌트 등록** (`packages/frontend/src/components/nodes/dataops/index.ts`):
```typescript
export const dataopsComponents = [
  {
    id: "csv-processor",
    name: "CSV Processor",
    icon: "📊",
    template: "dataops/csv_processor",
    nodeType: "custom"
  }
];
```

3. 서버 재시작 후 테스트

### 🤖 Level 4: AI와 함께 개발 (30분)

AI 도구를 활용하여 더 빠르고 효율적으로 개발합니다.

#### 📚 필독 문서: [AI_COMPONENT_PROMPTS.md](AI_COMPONENT_PROMPTS.md)

**AI 활용 방법:**

1. **전체 프롬프트 복사**: AI_COMPONENT_PROMPTS.md의 한국어/영어 섹션 전체 복사
2. **AI에게 요청**: 
   ```
   위 프로젝트 구조를 참고하여 다음 컴포넌트를 만들어주세요:
   - 이름: JSON Validator
   - 기능: JSON 문자열 검증 및 포맷팅
   - 입력: json_string (str), indent (int)
   - 출력: valid (bool), formatted (str), error (str)
   ```
3. **생성된 코드 적용 및 테스트**

## 📚 문서 구조

| 문서 | 설명 | 난이도 |
|------|------|--------|
| [CUSTOM_COMPONENT_GUIDE.md](CUSTOM_COMPONENT_GUIDE.md) | 커스텀 컴포넌트 기본 규칙 | ⭐⭐ |
| [COMPONENT_DEVELOPMENT_KR.md](COMPONENT_DEVELOPMENT_KR.md) | 정식 컴포넌트 개발 (한국어) | ⭐⭐⭐ |
| [COMPONENT_DEVELOPMENT_EN.md](COMPONENT_DEVELOPMENT_EN.md) | 정식 컴포넌트 개발 (영어) | ⭐⭐⭐ |
| [AI_COMPONENT_PROMPTS.md](AI_COMPONENT_PROMPTS.md) | AI 도구 활용 가이드 | ⭐ |

## 🎓 고급 주제

### 대용량 데이터 처리
10KB 이상의 데이터는 자동으로 참조 시스템으로 전환:
```python
def RunScript(large_data: Any = None) -> Dict[str, Any]:
    # 자동으로 object_store 참조로 변환
    huge_array = [i for i in range(1000000)]
    return {"data": huge_array}
```

### 비동기 처리
```python
import asyncio

async def fetch_data():
    # 비동기 작업
    await asyncio.sleep(1)
    return "data"

def RunScript() -> Dict[str, Any]:
    loop = asyncio.new_event_loop()
    result = loop.run_until_complete(fetch_data())
    return {"result": result}
```

### 외부 API 통합
```python
import requests

def RunScript(api_url: str = "", api_key: str = "") -> Dict[str, Any]:
    headers = {"Authorization": f"Bearer {api_key}"}
    response = requests.get(api_url, headers=headers)
    return {"data": response.json()}
```

## 💡 Tips & Tricks

### 디버깅
- **로컬 테스트**: 컴포넌트에 `if __name__ == "__main__"` 블록 추가
- **로그 출력**: `verbose: bool = False` 파라미터 활용
- **타입 체크**: `mypy` 사용

### 성능 최적화
- 큰 데이터는 generator 사용
- 무거운 연산은 캐싱 고려
- 불필요한 import 제거

### 보안
- 사용자 입력 검증 필수
- 파일 경로는 절대 경로 사용
- API 키는 환경 변수로 관리

## 🚨 자주 묻는 질문

**Q: 컴포넌트가 UI에 나타나지 않아요**
- A: 카테고리 index.ts에 등록했는지 확인
- A: 서버 재시작 필요 (프론트엔드/백엔드 모두)

**Q: 포트가 자동으로 생성되지 않아요**
- A: RunScript 함수의 타입힌트 확인
- A: 메타데이터 새로고침 버튼 클릭

**Q: 실행 결과가 안 보여요**
- A: Result Node 연결 확인
- A: 브라우저 콘솔에서 에러 확인

## 🎉 다음 단계

축하합니다! 이제 AIM-Forge 컴포넌트 개발의 기초를 마스터했습니다.

### 추천 프로젝트
1. **날씨 API 컴포넌트** - 외부 API 연동 연습
2. **데이터 시각화 컴포넌트** - 커스텀 UI 개발
3. **머신러닝 파이프라인** - 복잡한 워크플로우 구성

### 커뮤니티
- 질문이나 아이디어가 있다면 [Issues](https://github.com/AIM-Intelligence/AIM-Forge/issues)에 남겨주세요
- 만든 컴포넌트를 공유하고 싶다면 Pull Request를 보내주세요

---

Happy Coding! 🚀