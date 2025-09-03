# AI Component Development Prompts

이 파일은 AI (Claude, GPT 등)와 함께 AIM-Forge 컴포넌트를 개발할 때 사용하는 상세한 프롬프트를 제공합니다.

---

## 🇰🇷 한국어 프롬프트 (전체 복사용)

```
나는 AIM-Forge 프로젝트에서 새로운 컴포넌트를 개발하려고 합니다. 먼저 이 프로젝트의 전체 구조를 설명하겠습니다.

### 프로젝트 개요
AIM-Forge는 비주얼 플로우 기반 Python IDE입니다. 사용자는 노드(컴포넌트)를 만들고 연결하여 Python 코드를 시각적으로 실행합니다.

### 시스템 아키텍처
1. **노드 시스템**: 각 노드는 Python 코드를 실행하는 독립적인 단위
2. **포트 연결**: 노드의 출력(sourceHandle)이 다른 노드의 입력(targetHandle)으로 연결
3. **데이터 전달**: 
   - 작은 데이터(<10KB): JSON 직렬화로 직접 전달
   - 큰 데이터(>10KB): object_store를 통한 참조 전달
4. **실행 플로우**: Start 노드 → 연결된 노드들 순차 실행 → Result 노드

### 파일 구조

packages/
├── frontend/src/components/nodes/
│   ├── flow-control/      # 플로우 제어 컴포넌트
│   │   ├── StartNode.tsx   # 실행 시작 버튼이 있는 노드
│   │   └── ResultNode.tsx  # 결과 표시 (리사이즈 가능, 다운로드 버튼)
│   ├── params/            # 매개변수 컴포넌트
│   │   └── TextInputNode.tsx  # 텍스트 입력 (localStorage 저장)
│   ├── inputs/            # 데이터 입력 (현재 비어있음)
│   ├── dataops/           # 데이터 처리 (현재 비어있음)
│   ├── jailbreak/         # AI 공격 (현재 비어있음)
│   ├── reports/           # 리포트 (현재 비어있음)
│   ├── DefaultNode.tsx    # 기본 노드 UI (코드 에디터)
│   └── ComponentRegistry.tsx  # componentType → React 컴포넌트 매핑
└── backend/templates/
    ├── flow_control/
    │   ├── start_node.py   # Start 버튼 로직
    │   ├── result_node.py  # Result 표시 로직
    │   └── custom_node.py  # 사용자 정의 Python 코드
    ├── params/
    │   └── text_input.py   # 텍스트 값 전달
    ├── inputs/
    │   └── csv_loader.py   # CSV 파일 로드
    └── jailbreak/
        └── aim_stinger.py  # API 기반 공격

### 핵심 규칙

1. **백엔드 템플릿 규칙**:
```python
from typing import Dict, Any

def RunScript(
    # 입력 매개변수 = 왼쪽 입력 포트
    input1: str = "기본값",
    input2: int = 0,
) -> Dict[str, Any]:
    """함수 설명"""
    
    # 처리 로직
    result = process(input1, input2)
    
    # 반환 딕셔너리 키 = 오른쪽 출력 포트
    return {
        "output1": result,
        "output2": "다른 값"
    }
```

2. **프론트엔드 컴포넌트 규칙** (커스텀 UI가 필요한 경우):
```tsx
import { Handle, Position, type NodeProps } from "@xyflow/react";

export default function MyNode(props: NodeProps) {
  return (
    <div className="bg-neutral-800 rounded-lg border-2 border-neutral-600">
      {/* 입력 핸들 - 매개변수명과 일치 */}
      <Handle
        type="target"
        position={Position.Left}
        id="input1"  // RunScript의 매개변수명과 동일
      />
      
      {/* UI 내용 */}
      <div className="p-4">
        <h3>{props.data?.title}</h3>
      </div>
      
      {/* 출력 핸들 - 반환 키와 일치 */}
      <Handle
        type="source"
        position={Position.Right}
        id="output1"  // return 딕셔너리 키와 동일
      />
    </div>
  );
}
```

3. **카테고리별 index.ts 등록**:
```typescript
export const paramsComponents = [
  {
    id: "my-component",
    name: "내 컴포넌트",
    icon: "📝",
    template: "params/my_component",  // 백엔드 템플릿 경로
    nodeType: "custom",
    componentType: "MyComponent",  // 커스텀 UI인 경우
  }
];
```

4. **데이터 저장 패턴**:
- 텍스트 값: `localStorage.setItem('textInput_${projectId}_${nodeId}', value)`
- 노드 크기: `localStorage.setItem('textInput_dimensions_${projectId}_${nodeId}', JSON.stringify({width, height}))`

### 실제 구현 예시

#### 예시 1: CSV Loader (Simple Component - DefaultNode UI 사용)
백엔드만 구현 (`packages/backend/templates/inputs/csv_loader.py`):
```python
from typing import Dict, Any, List
import csv
import chardet

def RunScript(
    Start: bool = True,
    file_path: str = "/path/to/file.csv",
    has_header: bool = True,
) -> Dict[str, Any]:
    try:
        # 인코딩 자동 감지
        with open(file_path, 'rb') as file:
            raw_data = file.read()
            detected = chardet.detect(raw_data)
            encoding = detected['encoding'] or 'utf-8'
        
        # CSV 읽기
        with open(file_path, 'r', encoding=encoding) as file:
            if has_header:
                reader = csv.DictReader(file)
            else:
                reader = csv.reader(file)
            data = list(reader)
        
        return {
            "data": data,
            "row_count": len(data),
            "success": True
        }
    except Exception as e:
        return {
            "data": [],
            "error": str(e),
            "success": False
        }
```

#### 예시 2: Text Input (Custom UI Component)
백엔드 (`packages/backend/templates/params/text_input.py`):
```python
def RunScript(stored_value: str = "") -> str:
    return stored_value
```

프론트엔드 (`packages/frontend/src/components/nodes/params/TextInputNode.tsx`):
```tsx
import { useState, useEffect } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useExecutionStore } from "../../../stores/executionStore";

export default function TextInputNode(props: NodeProps) {
  const [value, setValue] = useState("");
  const [dimensions, setDimensions] = useState({ width: 300, height: 150 });
  const setNodeResult = useExecutionStore((state) => state.setNodeResult);
  
  // localStorage에서 값과 크기 로드
  useEffect(() => {
    const storageKey = `textInput_${projectId}_${props.id}`;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      setValue(saved);
      setNodeResult(props.id, saved);
    }
    
    const dimensionsKey = `textInput_dimensions_${projectId}_${props.id}`;
    const savedDimensions = localStorage.getItem(dimensionsKey);
    if (savedDimensions) {
      setDimensions(JSON.parse(savedDimensions));
    }
  }, [props.id]);
  
  const handleChange = (e) => {
    setValue(e.target.value);
    localStorage.setItem(`textInput_${projectId}_${props.id}`, e.target.value);
    setNodeResult(props.id, e.target.value);
  };
  
  return (
    <div 
      className="bg-neutral-900 border border-blue-600"
      style={{ width: dimensions.width, height: dimensions.height }}
    >
      <textarea
        value={value}
        onChange={handleChange}
        className="w-full h-full p-3 bg-transparent text-blue-300"
        placeholder="텍스트 입력..."
      />
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
```

#### 예시 3: AIM Stinger (API 호출 컴포넌트)
백엔드 (`packages/backend/templates/jailbreak/aim_stinger.py`):
```python
import requests
from typing import Dict, Any

def RunScript(
    queries: List[str] = [],
    target_model: Dict[str, str] = {},
    api_key: str = "",
    max_turns: int = 5,
) -> Dict[str, Any]:
    # API 엔드포인트 설정
    endpoint = target_model.get("endpoint", "https://api.openai.com/v1")
    model = target_model.get("model_name", "gpt-3.5-turbo")
    
    # API 호출
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    results = []
    for query in queries:
        # 실제 API 호출 로직
        response = requests.post(
            f"{endpoint}/chat/completions",
            headers=headers,
            json={
                "model": model,
                "messages": [{"role": "user", "content": query}],
                "max_tokens": 150
            }
        )
        results.append(response.json())
    
    return {
        "results": results,
        "success": True,
        "processed_count": len(results)
    }
```

### 컴포넌트 타입별 특징

1. **Simple Component (DefaultNode UI)**:
   - 백엔드 템플릿만 필요
   - 자동으로 코드 에디터 UI 제공
   - 포트는 RunScript 매개변수/반환값에서 자동 생성

2. **Custom UI Component**:
   - 백엔드 템플릿 + 프론트엔드 컴포넌트
   - ComponentRegistry.tsx에 등록 필요
   - localStorage 사용 가능 (값, 크기 저장)
   - 커스텀 스타일링 가능

### 실행 플로우 데이터 전달

1. **일반 데이터 전달**:
```python
# 노드 A
def RunScript() -> Dict[str, Any]:
    return {"data": [1, 2, 3]}

# 노드 B (A의 data를 받음)
def RunScript(data: List[int] = []) -> Dict[str, Any]:
    result = sum(data)
    return {"sum": result}
```

2. **TextInput 값 전달**:
- 프론트엔드: `setNodeResult(nodeId, value)` 호출
- 백엔드: `result_node_values`를 통해 값 수신
- 실행 시 자동으로 stored_value 매개변수로 전달

3. **큰 데이터 처리**:
- 10KB 이상 데이터는 자동으로 object_store 참조로 변환
- `{"__ref__": "object_id"}` 형식으로 전달
- 다음 노드에서 자동으로 역참조

### 현재 구현된 컴포넌트 목록

**flow_control**:
- StartNode: 실행 시작 버튼
- ResultNode: 결과 표시, 리사이즈, 다운로드
- CustomNode: 사용자 Python 코드

**params**:
- TextInputNode: 영구 텍스트 저장 (API 키, 경로 등)

**inputs**:
- CSVLoader: CSV 파일 로드 (인코딩 자동 감지)

**jailbreak**:
- AIMStinger: 외부 API 기반 공격

이제 원하는 컴포넌트를 설명해주시면, 위 구조에 맞게 코드를 생성하겠습니다.
```

---

## 🇬🇧 English Prompt (Full Copy)

```
I need to develop a new component for the AIM-Forge project. Let me first explain the complete project structure.

### Project Overview
AIM-Forge is a visual flow-based Python IDE. Users create and connect nodes (components) to visually execute Python code.

### System Architecture
1. **Node System**: Each node is an independent unit executing Python code
2. **Port Connections**: Node outputs (sourceHandle) connect to other nodes' inputs (targetHandle)
3. **Data Transfer**: 
   - Small data (<10KB): Direct transfer via JSON serialization
   - Large data (>10KB): Reference-based transfer through object_store
4. **Execution Flow**: Start node → Connected nodes execute sequentially → Result node

### File Structure

packages/
├── frontend/src/components/nodes/
│   ├── flow-control/      # Flow control components
│   │   ├── StartNode.tsx   # Node with execution start button
│   │   └── ResultNode.tsx  # Result display (resizable, download button)
│   ├── params/            # Parameter components
│   │   └── TextInputNode.tsx  # Text input (localStorage persistence)
│   ├── inputs/            # Data input (currently empty)
│   ├── dataops/           # Data operations (currently empty)
│   ├── jailbreak/         # AI attacks (currently empty)
│   ├── reports/           # Reports (currently empty)
│   ├── DefaultNode.tsx    # Default node UI (code editor)
│   └── ComponentRegistry.tsx  # componentType → React component mapping
└── backend/templates/
    ├── flow_control/
    │   ├── start_node.py   # Start button logic
    │   ├── result_node.py  # Result display logic
    │   └── custom_node.py  # User-defined Python code
    ├── params/
    │   └── text_input.py   # Text value pass-through
    ├── inputs/
    │   └── csv_loader.py   # CSV file loading
    └── jailbreak/
        └── aim_stinger.py  # API-based attacks

### Core Rules

1. **Backend Template Rules**:
```python
from typing import Dict, Any

def RunScript(
    # Input parameters = Left input ports
    input1: str = "default",
    input2: int = 0,
) -> Dict[str, Any]:
    """Function description"""
    
    # Processing logic
    result = process(input1, input2)
    
    # Return dictionary keys = Right output ports
    return {
        "output1": result,
        "output2": "another value"
    }
```

2. **Frontend Component Rules** (when custom UI needed):
```tsx
import { Handle, Position, type NodeProps } from "@xyflow/react";

export default function MyNode(props: NodeProps) {
  return (
    <div className="bg-neutral-800 rounded-lg border-2 border-neutral-600">
      {/* Input handle - matches parameter name */}
      <Handle
        type="target"
        position={Position.Left}
        id="input1"  // Same as RunScript parameter name
      />
      
      {/* UI content */}
      <div className="p-4">
        <h3>{props.data?.title}</h3>
      </div>
      
      {/* Output handle - matches return key */}
      <Handle
        type="source"
        position={Position.Right}
        id="output1"  // Same as return dictionary key
      />
    </div>
  );
}
```

3. **Category index.ts Registration**:
```typescript
export const paramsComponents = [
  {
    id: "my-component",
    name: "My Component",
    icon: "📝",
    template: "params/my_component",  // Backend template path
    nodeType: "custom",
    componentType: "MyComponent",  // If custom UI
  }
];
```

4. **Data Storage Patterns**:
- Text values: `localStorage.setItem('textInput_${projectId}_${nodeId}', value)`
- Node dimensions: `localStorage.setItem('textInput_dimensions_${projectId}_${nodeId}', JSON.stringify({width, height}))`

### Real Implementation Examples

#### Example 1: CSV Loader (Simple Component - Uses DefaultNode UI)
Backend only (`packages/backend/templates/inputs/csv_loader.py`):
```python
from typing import Dict, Any, List
import csv
import chardet

def RunScript(
    Start: bool = True,
    file_path: str = "/path/to/file.csv",
    has_header: bool = True,
) -> Dict[str, Any]:
    try:
        # Auto-detect encoding
        with open(file_path, 'rb') as file:
            raw_data = file.read()
            detected = chardet.detect(raw_data)
            encoding = detected['encoding'] or 'utf-8'
        
        # Read CSV
        with open(file_path, 'r', encoding=encoding) as file:
            if has_header:
                reader = csv.DictReader(file)
            else:
                reader = csv.reader(file)
            data = list(reader)
        
        return {
            "data": data,
            "row_count": len(data),
            "success": True
        }
    except Exception as e:
        return {
            "data": [],
            "error": str(e),
            "success": False
        }
```

#### Example 2: Text Input (Custom UI Component)
Backend (`packages/backend/templates/params/text_input.py`):
```python
def RunScript(stored_value: str = "") -> str:
    return stored_value
```

Frontend (`packages/frontend/src/components/nodes/params/TextInputNode.tsx`):
```tsx
import { useState, useEffect } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useExecutionStore } from "../../../stores/executionStore";

export default function TextInputNode(props: NodeProps) {
  const [value, setValue] = useState("");
  const [dimensions, setDimensions] = useState({ width: 300, height: 150 });
  const setNodeResult = useExecutionStore((state) => state.setNodeResult);
  
  // Load value and dimensions from localStorage
  useEffect(() => {
    const storageKey = `textInput_${projectId}_${props.id}`;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      setValue(saved);
      setNodeResult(props.id, saved);
    }
    
    const dimensionsKey = `textInput_dimensions_${projectId}_${props.id}`;
    const savedDimensions = localStorage.getItem(dimensionsKey);
    if (savedDimensions) {
      setDimensions(JSON.parse(savedDimensions));
    }
  }, [props.id]);
  
  const handleChange = (e) => {
    setValue(e.target.value);
    localStorage.setItem(`textInput_${projectId}_${props.id}`, e.target.value);
    setNodeResult(props.id, e.target.value);
  };
  
  return (
    <div 
      className="bg-neutral-900 border border-blue-600"
      style={{ width: dimensions.width, height: dimensions.height }}
    >
      <textarea
        value={value}
        onChange={handleChange}
        className="w-full h-full p-3 bg-transparent text-blue-300"
        placeholder="Enter text..."
      />
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
```

#### Example 3: AIM Stinger (API Call Component)
Backend (`packages/backend/templates/jailbreak/aim_stinger.py`):
```python
import requests
from typing import Dict, Any, List

def RunScript(
    queries: List[str] = [],
    target_model: Dict[str, str] = {},
    api_key: str = "",
    max_turns: int = 5,
) -> Dict[str, Any]:
    # API endpoint setup
    endpoint = target_model.get("endpoint", "https://api.openai.com/v1")
    model = target_model.get("model_name", "gpt-3.5-turbo")
    
    # API call
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    results = []
    for query in queries:
        # Actual API call logic
        response = requests.post(
            f"{endpoint}/chat/completions",
            headers=headers,
            json={
                "model": model,
                "messages": [{"role": "user", "content": query}],
                "max_tokens": 150
            }
        )
        results.append(response.json())
    
    return {
        "results": results,
        "success": True,
        "processed_count": len(results)
    }
```

### Component Type Characteristics

1. **Simple Component (DefaultNode UI)**:
   - Only needs backend template
   - Automatically provides code editor UI
   - Ports auto-generated from RunScript parameters/returns

2. **Custom UI Component**:
   - Backend template + Frontend component
   - Must register in ComponentRegistry.tsx
   - Can use localStorage (values, dimensions)
   - Custom styling possible

### Execution Flow Data Transfer

1. **Regular Data Transfer**:
```python
# Node A
def RunScript() -> Dict[str, Any]:
    return {"data": [1, 2, 3]}

# Node B (receives A's data)
def RunScript(data: List[int] = []) -> Dict[str, Any]:
    result = sum(data)
    return {"sum": result}
```

2. **TextInput Value Transfer**:
- Frontend: Call `setNodeResult(nodeId, value)`
- Backend: Receives value through `result_node_values`
- Automatically passed as stored_value parameter during execution

3. **Large Data Handling**:
- Data >10KB automatically converted to object_store reference
- Transferred as `{"__ref__": "object_id"}` format
- Automatically dereferenced in next node

### Currently Implemented Components

**flow_control**:
- StartNode: Execution start button
- ResultNode: Result display, resizable, download
- CustomNode: User Python code

**params**:
- TextInputNode: Persistent text storage (API keys, paths, etc.)

**inputs**:
- CSVLoader: CSV file loading (auto-detect encoding)

**jailbreak**:
- AIMStinger: External API-based attacks

Now describe the component you want to create, and I'll generate code following this structure.
```

---

## 📋 컴포넌트 요청 템플릿

### 한국어
```
다음 컴포넌트를 만들어주세요:

**컴포넌트 정보**:
- 이름: [컴포넌트 이름]
- 카테고리: [flow_control/params/inputs/dataops/jailbreak/reports 중 선택]
- UI 타입: [Simple(기본 코드 에디터) / Custom(특별 UI)]

**기능 설명**:
[이 컴포넌트가 하는 일을 상세히 설명]

**입력 포트**:
- [포트1]: [타입] - [설명]
- [포트2]: [타입] - [설명]

**출력 포트**:
- [포트1]: [타입] - [설명]
- [포트2]: [타입] - [설명]

**특별 요구사항**:
- [localStorage 저장 필요 여부]
- [리사이즈 필요 여부]
- [특별한 UI 요소]
```

### English
```
Please create the following component:

**Component Info**:
- Name: [Component Name]
- Category: [Choose from: flow_control/params/inputs/dataops/jailbreak/reports]
- UI Type: [Simple (default code editor) / Custom (special UI)]

**Functionality**:
[Detailed description of what this component does]

**Input Ports**:
- [port1]: [type] - [description]
- [port2]: [type] - [description]

**Output Ports**:
- [port1]: [type] - [description]
- [port2]: [type] - [description]

**Special Requirements**:
- [Need localStorage persistence?]
- [Need resize functionality?]
- [Special UI elements]
```

---

## 🎯 사용 방법

1. 위의 전체 프롬프트(한국어 또는 영어)를 복사
2. AI에게 붙여넣기
3. 컴포넌트 요청 템플릿을 작성하여 추가
4. AI가 프로젝트 구조에 맞는 정확한 코드 생성

## 💡 팁

- **Claude**: 전체 프롬프트를 한 번에 제공하면 더 정확한 코드 생성
- **GPT-4**: 프롬프트 + 실제 코드 예시를 함께 제공하면 스타일 일관성 유지
- **공통**: 구체적인 입력/출력 예시를 제공하면 더 나은 결과