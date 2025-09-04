# 컴포넌트 개발 가이드

이 가이드는 AIM-Forge를 위한 새로운 컴포넌트를 만드는 방법을 설명합니다. 컴포넌트는 시각적 플로우 시스템의 구성 요소입니다.

## 목차
- [컴포넌트 타입](#컴포넌트-타입)
- [빠른 시작](#빠른-시작)
- [단계별 가이드](#단계별-가이드)
- [컴포넌트 카테고리](#컴포넌트-카테고리)
- [예제](#예제)
- [모범 사례](#모범-사례)
- [문제 해결](#문제-해결)

## 컴포넌트 타입

생성할 수 있는 컴포넌트는 두 가지 타입이 있습니다:

1. **심플 컴포넌트** - 기본 UI 사용 (DefaultNode)
   - 백엔드 Python 템플릿만 필요
   - 기본적인 데이터 처리에 적합

2. **커스텀 UI 컴포넌트** - 자체 React 컴포넌트 보유
   - 프론트엔드 컴포넌트와 백엔드 템플릿 모두 필요
   - 특별한 UI 요구사항에 적합 (예: TextInput, Result 노드)

## 빠른 시작

### 심플 컴포넌트 생성 (기본 UI)

특별한 UI가 필요 없는 컴포넌트의 경우:

```bash
# 1. 백엔드 템플릿 생성
touch packages/backend/templates/{category}/{component_name}.py

# 2. 프론트엔드 index에 추가
# 편집: packages/frontend/src/components/nodes/{category}/index.ts
```

### 커스텀 UI 컴포넌트 생성

특별한 UI가 필요한 컴포넌트의 경우:

```bash
# 1. 프론트엔드 컴포넌트 생성
touch packages/frontend/src/components/nodes/{category}/MyComponent.tsx

# 2. 백엔드 템플릿 생성
touch packages/backend/templates/{category}/my_component.py

# 3. 카테고리 index에 등록
# 편집: packages/frontend/src/components/nodes/{category}/index.ts
```

## 단계별 가이드

### 1단계: 카테고리 선택

컴포넌트가 속할 카테고리를 결정하세요:

- `flow-control` - 플로우 실행 제어 (Start, Result 등)
- `params` - 사용자 입력 매개변수 (TextInput, NumberInput 등)
- `inputs` - 데이터 입력/로딩 (CSVLoader, JSONLoader 등)
- `dataops` - 데이터 연산 (Parser, Filter, Transform 등)
- `jailbreak` - AI 보안 테스팅 (공격, 프롬프트 등)
- `reports` - 분석 및 리포팅 (메트릭, 시각화 등)

### 2단계: 백엔드 템플릿 생성

모든 컴포넌트는 백엔드 Python 템플릿이 필요합니다. 다음 위치에 파일을 생성하세요:
```
packages/backend/templates/{category}/{component_name}.py
```

#### 템플릿 구조:

```python
"""
컴포넌트 이름 - 간단한 설명
이 컴포넌트가 하는 일에 대한 상세 설명
"""

from typing import Dict, Any

def RunScript(
    # 입력 매개변수 (입력 포트가 됨)
    param1: str = "기본값",
    param2: int = 0,
    param3: bool = True,
) -> Dict[str, Any]:
    """
    컴포넌트의 메인 실행 함수.
    
    Parameters:
        param1: param1 설명
        param2: param2 설명
        param3: param3 설명
        
    Returns:
        출력값을 담은 딕셔너리 (키가 출력 포트가 됨)
    """
    
    # 컴포넌트 로직 작성
    result = process_data(param1, param2, param3)
    
    # 딕셔너리로 출력 반환
    return {
        "output1": result,
        "output2": "다른_값",
        "status": "success"
    }
```

**중요 사항:**
- 함수 이름은 반드시 `RunScript`여야 함
- 매개변수는 입력 포트가 됨 (왼쪽 핸들)
- 반환 딕셔너리 키는 출력 포트가 됨 (오른쪽 핸들)
- 더 나은 포트 생성을 위해 타입 힌트 사용
- 선택적 매개변수에는 기본값 제공

### 3단계A: 심플 컴포넌트의 경우 (DefaultNode 사용)

컴포넌트가 코드 편집 UI만 필요한 경우, 4단계로 건너뛰세요.

### 3단계B: 커스텀 UI 컴포넌트의 경우

다음 위치에 React 컴포넌트를 생성하세요:
```
packages/frontend/src/components/nodes/{category}/MyComponent.tsx
```

#### 컴포넌트 템플릿:

```tsx
import { useState, useEffect } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import clsx from "clsx";
import { useParams } from "react-router-dom";
import { useExecutionStore } from "../../../stores/executionStore";

// 노드 타입 정의
export type MyComponentNodeType = Node<{
  title: string;
  description: string;
  componentType?: string;
}>;

export default function MyComponentNode(props: NodeProps<MyComponentNodeType>) {
  const [hovering, setHovering] = useState(false);
  const { projectId } = useParams<{ projectId: string }>();
  
  // 값을 저장해야 하는 컴포넌트의 경우
  const setNodeResult = useExecutionStore((state) => state.setNodeResult);
  
  // 컴포넌트 로직 작성
  
  return (
    <div
      className={clsx(
        "bg-neutral-800 rounded-lg border-2 transition-colors",
        hovering ? "border-blue-500 shadow-lg shadow-blue-500/20" : "border-neutral-600"
      )}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {/* 입력 핸들 - RunScript의 각 매개변수마다 하나씩 */}
      <Handle
        type="target"
        position={Position.Left}
        id="param1"  // 매개변수 이름과 일치해야 함
        style={{ top: "50%" }}
        className="w-3 h-3 bg-blue-500 border-2 border-neutral-900"
      />
      
      {/* UI 작성 */}
      <div className="p-4">
        <h3 className="text-white text-sm font-medium">{props.data?.title}</h3>
        {/* 커스텀 UI 요소 추가 */}
      </div>
      
      {/* 출력 핸들 - 반환 딕셔너리의 각 키마다 하나씩 */}
      <Handle
        type="source"
        position={Position.Right}
        id="output1"  // 반환 키와 일치해야 함
        style={{ top: "50%" }}
        className="w-3 h-3 bg-green-500 border-2 border-neutral-900"
      />
      
      {/* 삭제 버튼 */}
      {hovering && props.data?.viewCode && (
        <button
          onClick={props.data.viewCode}
          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full text-white text-xs"
        >
          ×
        </button>
      )}
    </div>
  );
}
```

### 4단계: 카테고리 Index에 컴포넌트 등록

카테고리의 index 파일을 편집하세요:
```
packages/frontend/src/components/nodes/{category}/index.ts
```

#### 심플 컴포넌트의 경우 (DefaultNode):

```typescript
export const {category}Components = [
  // ... 기존 컴포넌트
  {
    id: "my-component",
    name: "내 컴포넌트",
    description: "이 컴포넌트가 하는 일",
    icon: "🎯",  // 이모지 아이콘 선택
    template: "{category}/my_component",  // Python 템플릿 경로
    nodeType: "custom",
    // component 속성 불필요 - DefaultNode 사용
  },
];
```

#### 커스텀 UI 컴포넌트의 경우:

```typescript
// 컴포넌트 import
import MyComponentNode from './MyComponentNode';

// export
export { MyComponentNode };

// 메타데이터에 추가
export const {category}Components = [
  // ... 기존 컴포넌트
  {
    id: "my-component",
    name: "내 컴포넌트",
    description: "이 컴포넌트가 하는 일",
    icon: "🎯",
    template: "{category}/my_component",
    nodeType: "custom",
    componentType: "MyComponent",  // 커스텀 렌더링 트리거
    component: MyComponentNode,     // React 컴포넌트 참조
  },
];
```

### 5단계: ComponentRegistry에 등록 (커스텀 UI만)

커스텀 UI 컴포넌트를 만든 경우, 다음 파일에 등록하세요:
```
packages/frontend/src/components/nodes/ComponentRegistry.tsx
```

```typescript
export const componentRegistry: ComponentRegistry = {
  // ... 기존 컴포넌트
  'MyComponent': MyComponentNode,
};
```

### 6단계: 컴포넌트 테스트

1. 개발 서버 재시작:
   ```bash
   pnpm dev
   ```

2. UI를 열고 컴포넌트 라이브러리 패널에서 컴포넌트 확인

3. 캔버스로 드래그하여 테스트:
   - 입력/출력 포트가 올바르게 표시되는지
   - 다른 노드와 연결 가능한지
   - 플로우 실행 시 동작하는지

## 컴포넌트 카테고리

### Flow Control (`flow-control`)
실행 플로우 제어를 위한 핵심 컴포넌트:
- Start Node - 실행 진입점
- Result Node - 결과 표시 및 통과
- Custom Node - 일반 Python 코드 노드
- Loop Node - 반복 제어 (향후)
- Conditional Node - 분기 로직 (향후)

### Parameters (`params`)
사용자 입력 및 설정:
- TextInput - 영구 텍스트 저장
- NumberInput - 숫자 값 (향후)
- BooleanInput - 참/거짓 토글 (향후)
- SelectInput - 드롭다운 선택 (향후)
- SliderInput - 범위 선택 (향후)

### Inputs (`inputs`)
데이터 로딩 및 획득:
- CSVLoader - CSV 파일 로드
- JSONLoader - JSON 파일 로드 (향후)
- ExcelLoader - Excel 파일 로드 (향후)
- DatabaseConnector - SQL 쿼리 (향후)
- APIFetcher - HTTP 요청 (향후)

### Data Operations (`dataops`)
데이터 변환 및 처리:
- JSONParser - JSON 문자열 파싱 (향후)
- DataFilter - 배열/객체 필터링 (향후)
- DataMapper - 데이터 변환 (향후)
- DataAggregator - 통계 집계 (향후)

### Jailbreak (`jailbreak`)
AI 보안 테스팅:
- AIMStinger - 다중 턴 공격
- GCGAttack - 그래디언트 기반 공격
- PromptInjection - 인젝션 공격 (향후)
- AdversarialSuffix - 접미사 공격 (향후)

### Reports (`reports`)
분석 및 시각화:
- ASRMeasurement - 공격 성공률
- ReportGenerator - PDF/HTML 리포트 (향후)
- DataVisualizer - 차트/그래프 (향후)
- MetricsDashboard - KPI 표시 (향후)

## 예제

### 예제 1: 심플 CSV 파서 컴포넌트

**백엔드** (`packages/backend/templates/dataops/csv_parser.py`):
```python
"""
CSV 파서 - CSV 문자열을 구조화된 데이터로 파싱
"""

from typing import Dict, Any, List
import csv
import io

def RunScript(
    csv_string: str = "",
    has_header: bool = True,
    delimiter: str = ",",
) -> Dict[str, Any]:
    """
    CSV 문자열을 딕셔너리 리스트로 파싱.
    
    Parameters:
        csv_string: 원본 CSV 텍스트
        has_header: 첫 행이 헤더인지 여부
        delimiter: 열 구분자
        
    Returns:
        파싱된 데이터와 메타데이터
    """
    if not csv_string:
        return {
            "data": [],
            "row_count": 0,
            "column_count": 0,
            "error": "입력이 제공되지 않음"
        }
    
    try:
        reader = csv.DictReader(
            io.StringIO(csv_string),
            delimiter=delimiter
        ) if has_header else csv.reader(
            io.StringIO(csv_string),
            delimiter=delimiter
        )
        
        data = list(reader)
        
        return {
            "data": data,
            "row_count": len(data),
            "column_count": len(data[0]) if data else 0,
            "error": None
        }
    except Exception as e:
        return {
            "data": [],
            "row_count": 0,
            "column_count": 0,
            "error": str(e)
        }
```

**프론트엔드 등록** (`packages/frontend/src/components/nodes/dataops/index.ts`):
```typescript
export const dataopsComponents = [
  {
    id: "csv-parser",
    name: "CSV 파서",
    description: "CSV 문자열을 구조화된 데이터로 파싱",
    icon: "📄",
    template: "dataops/csv_parser",
    nodeType: "custom",
  },
];
```

### 예제 2: 커스텀 UI를 가진 숫자 입력 컴포넌트

**백엔드** (`packages/backend/templates/params/number_input.py`):
```python
"""
숫자 입력 - 숫자 값 저장
"""

from typing import Dict, Any

def RunScript(stored_value: float = 0.0) -> float:
    """
    저장된 숫자 값을 전달.
    
    Parameters:
        stored_value: 사용자가 저장한 숫자 (프론트엔드에서 관리)
        
    Returns:
        숫자 값
    """
    return stored_value
```

**프론트엔드** (`packages/frontend/src/components/nodes/params/NumberInputNode.tsx`):
```tsx
import { useState, useEffect } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import clsx from "clsx";
import { useParams } from "react-router-dom";
import { useExecutionStore } from "../../../stores/executionStore";

export type NumberInputNodeType = Node<{
  title: string;
  description: string;
  componentType?: string;
}>;

export default function NumberInputNode(props: NodeProps<NumberInputNodeType>) {
  const [hovering, setHovering] = useState(false);
  const [value, setValue] = useState<number>(0);
  const { projectId } = useParams<{ projectId: string }>();
  const setNodeResult = useExecutionStore((state) => state.setNodeResult);

  // localStorage에서 로드
  useEffect(() => {
    if (projectId) {
      const storageKey = `numberInput_${projectId}_${props.id}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const num = parseFloat(saved);
        setValue(num);
        setNodeResult(props.id, num);
      }
    }
  }, [projectId, props.id, setNodeResult]);

  const handleChange = (newValue: number) => {
    setValue(newValue);
    setNodeResult(props.id, newValue);
    if (projectId) {
      const storageKey = `numberInput_${projectId}_${props.id}`;
      localStorage.setItem(storageKey, newValue.toString());
    }
  };

  return (
    <div
      className={clsx(
        "bg-neutral-800 rounded-lg border-2 transition-colors p-4 min-w-[200px]",
        hovering ? "border-purple-500 shadow-lg shadow-purple-500/20" : "border-neutral-600"
      )}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <div className="text-white text-sm font-medium mb-2">
        {props.data?.title || "숫자 입력"}
      </div>
      
      <input
        type="number"
        value={value}
        onChange={(e) => handleChange(parseFloat(e.target.value) || 0)}
        className="w-full bg-neutral-700 text-white px-2 py-1 rounded"
        placeholder="숫자 입력..."
      />
      
      {/* 출력 핸들 */}
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-purple-500 border-2 border-neutral-900"
      />
      
      {/* 삭제 버튼 */}
      {hovering && props.data?.viewCode && (
        <button
          onClick={props.data.viewCode}
          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full text-white text-xs"
        >
          ×
        </button>
      )}
    </div>
  );
}
```

**등록**:
```typescript
// params/index.ts에서
import NumberInputNode from './NumberInputNode';

export { TextInputNode, NumberInputNode };

export const paramsComponents = [
  // ... 기존
  {
    id: "number-input",
    name: "숫자 입력",
    description: "숫자 값 저장 및 입력",
    icon: "🔢",
    template: "params/number_input",
    nodeType: "custom",
    componentType: "NumberInput",
    component: NumberInputNode,
  },
];

// ComponentRegistry.tsx에서
export const componentRegistry: ComponentRegistry = {
  'TextInput': TextInputNode,
  'NumberInput': NumberInputNode,  // 이 줄 추가
};
```

## 모범 사례

### 1. 네이밍 규칙
- **파일 이름**: Python은 snake_case (`my_component.py`), React는 PascalCase (`MyComponent.tsx`)
- **컴포넌트 ID**: kebab-case 사용 (`my-component`)
- **컴포넌트 타입**: PascalCase 사용 (`MyComponent`)
- **템플릿 경로**: category/filename 사용 (`params/my_component`)

### 2. 입력/출력 포트
- **포트 이름을 단순하게**: 명확하고 설명적인 이름 사용
- **정확히 일치**: 포트 ID는 매개변수 이름 및 반환 키와 일치해야 함
- **타입 문서화**: 명확성을 위해 Python에서 타입 힌트 사용
- **기본값 제공**: 항상 합리적인 기본값 제공

### 3. 에러 처리
```python
def RunScript(data: str = "") -> Dict[str, Any]:
    try:
        result = process_data(data)
        return {
            "success": True,
            "result": result,
            "error": None
        }
    except Exception as e:
        return {
            "success": False,
            "result": None,
            "error": str(e)
        }
```

### 4. 성능
- **블로킹 연산 피하기**: 긴 작업은 비동기 처리 사용
- **데이터 크기 제한**: 큰 데이터(>10KB)는 객체 참조 사용
- **가능하면 캐싱**: 재계산 방지를 위해 계산된 값 저장

### 5. UI 가이드라인
- **일관된 스타일링**: 기존 색상 구성과 간격 따르기
- **호버 상태**: 더 나은 UX를 위한 호버 효과 추가
- **반응형 디자인**: 다양한 크기에서 작동하도록 보장
- **다크 테마**: 모든 컴포넌트는 다크 테마 색상 사용

## AI와 함께 개발하기

AI (Claude, GPT 등)와 컴포넌트를 개발할 때:

📋 **`AI_COMPONENT_PROMPTS.md`** 파일을 참조하세요.

이 파일에는:
- 프로젝트 전체 구조와 아키텍처 상세 설명
- 데이터 전달 방식 (JSON 직렬화, object_store 참조)
- 실제 구현된 모든 컴포넌트 예시
- 복사해서 바로 사용 가능한 한국어/영어 프롬프트

**사용 방법**:
1. `AI_COMPONENT_PROMPTS.md` 파일 열기
2. 한국어 또는 영어 프롬프트 전체 복사
3. AI와의 첫 대화에 붙여넣기
4. 원하는 컴포넌트 요청

이렇게 하면 AI가 프로젝트를 완전히 이해하고 정확한 코드를 생성합니다.

## 문제 해결

### 컴포넌트가 라이브러리에 나타나지 않음
1. 카테고리 index.ts에 추가했는지 확인
2. 템플릿 파일이 올바른 위치에 있는지 확인
3. 개발 서버 재시작

### 포트가 표시되지 않음
1. RunScript 함수에 적절한 타입 힌트가 있는지 확인
2. 매개변수 이름이 핸들 ID와 일치하는지 확인
3. 반환 딕셔너리 키가 출력 핸들 ID와 일치하는지 확인

### 커스텀 UI가 렌더링되지 않음
1. 메타데이터에 componentType이 설정되어 있는지 확인
2. ComponentRegistry.tsx에 컴포넌트가 등록되어 있는지 확인
3. 카테고리 index.ts에서 컴포넌트가 export되는지 확인

### 실행 오류
1. 템플릿 파일의 Python 구문 확인
2. 필요한 모든 import가 포함되어 있는지 확인
3. 먼저 간단한 입력으로 테스트
4. 브라우저 콘솔에서 오류 메시지 확인

### TypeScript 오류
1. 모든 import가 올바른 상대 경로를 사용하는지 확인
2. 타입이 제대로 정의되어 있는지 확인
3. 컴포넌트 props가 NodeProps 타입과 일치하는지 확인

## 고급 주제

### 대용량 데이터를 위한 Object Store 사용

10KB보다 큰 데이터는 object store를 사용하세요:

```python
def RunScript(large_data: Any = None) -> Dict[str, Any]:
    # 대용량 데이터 처리
    if hasattr(large_data, '__ref__'):
        # 데이터가 참조이며, executor가 처리함
        pass
    
    result = process_large_data(large_data)
    
    # 큰 결과를 위한 참조 반환
    return {
        "result": result,  # 10KB 초과 시 자동으로 참조로 변환
        "size": len(str(result))
    }
```

### 동적 포트

설정에 따라 동적 포트를 가진 컴포넌트 생성:

```python
def RunScript(**kwargs) -> Dict[str, Any]:
    """
    동적으로 임의 개수의 입력 수용.
    """
    results = {}
    for key, value in kwargs.items():
        results[f"output_{key}"] = process(value)
    return results
```

### 프로젝트 컨텍스트 접근

컴포넌트는 프로젝트 정보에 접근할 수 있습니다:

```python
import os

def RunScript() -> Dict[str, Any]:
    project_dir = os.getcwd()  # 프로젝트 디렉토리
    return {
        "project_path": project_dir,
        "files": os.listdir(project_dir)
    }
```

## 기여

컴포넌트를 기여할 때:

1. 네이밍 규칙을 따르세요
2. 포괄적인 문서를 추가하세요
3. 에러 처리를 포함하세요
4. 다양한 입력으로 테스트하세요
5. 새 카테고리를 추가하는 경우 이 가이드를 업데이트하세요

## 지원

질문이나 문제가 있을 때:
- 예제를 위해 기존 컴포넌트 확인
- 문제 해결 섹션 검토
- 개발팀 채팅에서 질문
- 저장소에 이슈 생성

---

즐거운 컴포넌트 빌딩! 🚀