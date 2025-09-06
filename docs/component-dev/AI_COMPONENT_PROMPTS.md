# AI Component Development Prompts

이 파일은 AI (Claude, GPT 등)와 함께 AIM-Forge 컴포넌트를 개발할 때 사용하는 상세한 프롬프트를 제공합니다.

---

## 🇰🇷 한국어 프롬프트 (전체 복사용)

```plaintext
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

2. **프론트엔드 컴포넌트 규칙** (커스텀 UI가 필요한 경우):
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

3. **카테고리 index.ts 구조**:
    // 위치: packages/frontend/src/components/nodes/[category]/index.ts
    import { ComponentDefinition } from "../../../types/component";
    
    export const paramsComponents: ComponentDefinition[] = [
      {
        id: "my-component",
        name: "내 컴포넌트",
        icon: "📝",
        template: "params/my_component",  // 백엔드 템플릿 경로
        nodeType: "custom",
        componentType: "MyComponent",  // 커스텀 UI인 경우, ComponentRegistry 키와 일치해야 함
      }
    ];

4. **ComponentRegistry 등록** (커스텀 UI인 경우):
    // 위치: packages/frontend/src/components/nodes/ComponentRegistry.tsx
    import MyComponentNode from "./params/MyComponentNode";
    
    // 레지스트리에 추가
    componentRegistry.set("MyComponent", MyComponentNode);

5. **projectId 가져오기**:
    import { useParams } from "react-router-dom";
    
    export default function MyNode(props: NodeProps) {
      const { projectId } = useParams<{ projectId: string }>();
      
      // localStorage 키에 사용
      const key = `myNode_${projectId}_${props.id}`;
    }

6. **데이터 저장 패턴**:
    - 텍스트 값: localStorage.setItem(`textInput_${projectId}_${nodeId}`, value)
    - 노드 크기: localStorage.setItem(`textInput_dimensions_${projectId}_${nodeId}`, JSON.stringify({width, height}))

### 실제 구현 예시

#### 예시 1: CSV Loader (Simple Component - DefaultNode UI 사용)
백엔드만 구현 (packages/backend/templates/inputs/csv_loader.py):

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

#### 예시 2: Text Input (Custom UI Component)
백엔드 (packages/backend/templates/params/text_input.py):

    def RunScript(stored_value: str = "") -> str:
        return stored_value

프론트엔드 (packages/frontend/src/components/nodes/params/TextInputNode.tsx):

    import { useState, useEffect } from "react";
    import { Handle, Position, type NodeProps } from "@xyflow/react";
    import { useExecutionStore } from "../../../stores/executionStore";
    
    export default function TextInputNode(props: NodeProps) {
      const [value, setValue] = useState("");
      const [dimensions, setDimensions] = useState({ width: 300, height: 150 });
      const setNodeResult = useExecutionStore((state) => state.setNodeResult);
      
      // localStorage에서 값과 크기 로드
      useEffect(() => {
        const storageKey = 'textInput_${projectId}_${props.id}';
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          setValue(saved);
          setNodeResult(props.id, saved);
        }
        
        const dimensionsKey = 'textInput_dimensions_${projectId}_${props.id}';
        const savedDimensions = localStorage.getItem(dimensionsKey);
        if (savedDimensions) {
          setDimensions(JSON.parse(savedDimensions));
        }
      }, [props.id]);
      
      const handleChange = (e) => {
        setValue(e.target.value);
        localStorage.setItem('textInput_${projectId}_${props.id}', e.target.value);
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

#### 예시 3: AIM Stinger (API 호출 컴포넌트)
백엔드 (packages/backend/templates/jailbreak/aim_stinger.py):

    import requests
    from typing import Dict, Any, List
    
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

### 노드 실행 플로우

1. **Start 노드 트리거**:
    // StartNode 버튼 클릭
    const handleExecute = async () => {
      const response = await fetch('/api/project/execute-flow', {
        method: 'POST',
        body: JSON.stringify({ 
          project_id: projectId,
          node_id: startNodeId 
        })
      });
      
      // SSE (Server-Sent Events) 스트리밍
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        // 실행 결과 처리
      }
    };

2. **백엔드 실행 순서**:
    - Start 노드 트리거 → 엣지로 연결된 노드 찾기
    - 의존성 순서로 토폴로지 정렬
    - 이전 출력을 입력으로 각 노드 실행
    - 실행 스토어에 결과 저장
    - SSE로 진행 상황 스트리밍

### 실행 플로우 데이터 전달

1. **일반 데이터 전달**:
    # 노드 A
    def RunScript() -> Dict[str, Any]:
        return {"data": [1, 2, 3]}
    
    # 노드 B (A의 data를 받음)
    def RunScript(data: List[int] = []) -> Dict[str, Any]:
        result = sum(data)
        return {"sum": result}

2. **TextInput 값 전달**:
   - 프론트엔드: setNodeResult(nodeId, value) 호출
   - 백엔드: result_node_values를 통해 값 수신
   - 실행 시 자동으로 stored_value 매개변수로 전달

3. **큰 데이터 처리**:
   - 10KB 이상 데이터는 자동으로 object_store 참조로 변환
   - {"__ref__": "object_id"} 형식으로 전달
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

### 개발 및 테스트 워크플로우

1. **컴포넌트 생성**:
    # 1. 백엔드 템플릿 생성
    packages/backend/templates/[category]/my_component.py
    
    # 2. 커스텀 UI가 필요한 경우 프론트엔드 컴포넌트 생성
    packages/frontend/src/components/nodes/[category]/MyComponentNode.tsx
    
    # 3. 카테고리 index.ts에 등록
    packages/frontend/src/components/nodes/[category]/index.ts
    
    # 4. 커스텀 UI인 경우 ComponentRegistry에 추가
    packages/frontend/src/components/nodes/ComponentRegistry.tsx

2. **컴포넌트 테스트**:
    # 1. 개발 서버 시작
    pnpm dev  # 또는 docker-compose -f docker-compose.dev.yml up
    
    # 2. 새 프로젝트 생성 (http://localhost:5173)
    "New Project" 버튼 클릭
    
    # 3. 왼쪽 패널에서 컴포넌트 추가
    카테고리에서 찾기 → 클릭하여 추가
    
    # 4. 노드 연결 및 실행 테스트
    출력에서 입력 핸들로 드래그
    Start 노드의 실행 버튼 클릭
    
    # 5. Result 노드에서 결과 확인

3. **디버깅**:
    # 프론트엔드 콘솔 (브라우저 개발자 도구)
    - 컴포넌트 렌더 에러
    - API 호출 응답
    - localStorage 데이터
    
    # 백엔드 로그
    docker logs aim-red-backend-dev  # Docker
    # 또는 로컬 실행 시 터미널 출력
    
    # 실행 에러 표시 위치:
    - 토스트 알림 (상단 중앙)
    - Result 노드 에러 표시

### 스타일링 가이드라인

1. **색상 구성 (다크 테마)**:
    - 배경: bg-neutral-900, bg-neutral-800
    - 테두리: border-neutral-600, border-blue-600 (활성)
    - 텍스트: text-neutral-300, text-blue-300 (하이라이트)
    - 호버: hover:bg-neutral-700
    - 성공: text-green-400, border-green-600
    - 에러: text-red-400, border-red-600

2. **컴포넌트 레이아웃**:
    <div className="bg-neutral-900 rounded-lg border border-neutral-600 p-4">
      <h3 className="text-sm font-medium text-neutral-300 mb-2">
        {props.data?.title}
      </h3>
      {/* 컴포넌트 내용 */}
    </div>

3. **핸들 스타일링**:
    - 노드 타입별 위치 오프셋 다름
    - DefaultNode: -20px 오프셋
    - StartNode: -11.5px 오프셋  
    - ResultNode: -8px 오프셋

### 리사이즈 구현 패턴

    const [dimensions, setDimensions] = useState({ width: 300, height: 200 });
    const [isResizing, setIsResizing] = useState(false);
    
    const handleMouseDown = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsResizing(true);
      
      const startX = e.clientX;
      const startY = e.clientY;
      const startWidth = dimensions.width;
      const startHeight = dimensions.height;
      
      const handleMouseMove = (e: MouseEvent) => {
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        
        setDimensions({
          width: Math.max(200, startWidth + deltaX),  // 최소 너비 200
          height: Math.max(100, startHeight + deltaY)  // 최소 높이 100
        });
      };
      
      const handleMouseUp = () => {
        setIsResizing(false);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        
        // localStorage에 저장
        if (projectId) {
          const key = `node_dimensions_${projectId}_${props.id}`;
          localStorage.setItem(key, JSON.stringify(dimensions));
        }
      };
      
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    };
    
    return (
      <div style={{ width: dimensions.width, height: dimensions.height }}>
        {/* 노드 내용 */}
        
        {/* 리사이즈 핸들 */}
        <div 
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
          onMouseDown={handleMouseDown}
        >
          <svg className="w-full h-full text-neutral-500">
            <path d="M 0,12 L 12,0" stroke="currentColor" />
          </svg>
        </div>
      </div>
    );

### 에러 처리 패턴

    def RunScript(input_data: Any = None) -> Dict[str, Any]:
        try:
            # 입력 검증
            if not input_data:
                raise ValueError("입력 데이터가 필요합니다")
            
            # 데이터 처리
            result = process(input_data)
            
            return {
                "success": True,
                "data": result,
                "error": None
            }
        except Exception as e:
            import traceback
            return {
                "success": False,
                "data": None,
                "error": str(e),
                "traceback": traceback.format_exc()
            }

이제 원하는 컴포넌트를 설명해주시면, 위 구조에 맞게 코드를 생성하겠습니다.
```

---

## 🇬🇧 English Prompt (Full Copy)

```plaintext
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

2. **Frontend Component Rules** (when custom UI needed):
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

3. **Category index.ts Structure**:
    // Location: packages/frontend/src/components/nodes/[category]/index.ts
    import { ComponentDefinition } from "../../../types/component";
    
    export const paramsComponents: ComponentDefinition[] = [
      {
        id: "my-component",
        name: "My Component",
        icon: "📝",
        template: "params/my_component",  // Backend template path
        nodeType: "custom",
        componentType: "MyComponent",  // If custom UI, must match ComponentRegistry key
      }
    ];

4. **ComponentRegistry Registration** (for Custom UI):
    // Location: packages/frontend/src/components/nodes/ComponentRegistry.tsx
    import MyComponentNode from "./params/MyComponentNode";
    
    // Add to registry
    componentRegistry.set("MyComponent", MyComponentNode);

5. **Getting projectId**:
    import { useParams } from "react-router-dom";
    
    export default function MyNode(props: NodeProps) {
      const { projectId } = useParams<{ projectId: string }>();
      
      // Now use in localStorage keys
      const key = `myNode_${projectId}_${props.id}`;
    }

6. **Data Storage Patterns**:
    - Text values: localStorage.setItem(`textInput_${projectId}_${nodeId}`, value)
    - Node dimensions: localStorage.setItem(`textInput_dimensions_${projectId}_${nodeId}`, JSON.stringify({width, height}))

### Real Implementation Examples

#### Example 1: CSV Loader (Simple Component - Uses DefaultNode UI)
Backend only (packages/backend/templates/inputs/csv_loader.py):

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

#### Example 2: Text Input (Custom UI Component)
Backend (packages/backend/templates/params/text_input.py):

    def RunScript(stored_value: str = "") -> str:
        return stored_value

Frontend (packages/frontend/src/components/nodes/params/TextInputNode.tsx):

    import { useState, useEffect } from "react";
    import { Handle, Position, type NodeProps } from "@xyflow/react";
    import { useExecutionStore } from "../../../stores/executionStore";
    
    export default function TextInputNode(props: NodeProps) {
      const [value, setValue] = useState("");
      const [dimensions, setDimensions] = useState({ width: 300, height: 150 });
      const setNodeResult = useExecutionStore((state) => state.setNodeResult);
      
      // Load value and dimensions from localStorage
      useEffect(() => {
        const storageKey = 'textInput_${projectId}_${props.id}';
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          setValue(saved);
          setNodeResult(props.id, saved);
        }
        
        const dimensionsKey = 'textInput_dimensions_${projectId}_${props.id}';
        const savedDimensions = localStorage.getItem(dimensionsKey);
        if (savedDimensions) {
          setDimensions(JSON.parse(savedDimensions));
        }
      }, [props.id]);
      
      const handleChange = (e) => {
        setValue(e.target.value);
        localStorage.setItem('textInput_${projectId}_${props.id}', e.target.value);
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

#### Example 3: AIM Stinger (API Call Component)
Backend (packages/backend/templates/jailbreak/aim_stinger.py):

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

### Node Execution Flow

1. **Start Node Trigger**:
    // StartNode button click
    const handleExecute = async () => {
      const response = await fetch('/api/project/execute-flow', {
        method: 'POST',
        body: JSON.stringify({ 
          project_id: projectId,
          node_id: startNodeId 
        })
      });
      
      // SSE (Server-Sent Events) streaming
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        // Process execution results
      }
    };

2. **Backend Execution Order**:
    - Start node triggered → Find connected nodes via edges
    - Topological sort for dependency order
    - Execute each node with previous outputs as inputs
    - Store results in execution store
    - Stream progress via SSE

### Execution Flow Data Transfer

1. **Regular Data Transfer**:
    # Node A
    def RunScript() -> Dict[str, Any]:
        return {"data": [1, 2, 3]}
    
    # Node B (receives A's data)
    def RunScript(data: List[int] = []) -> Dict[str, Any]:
        result = sum(data)
        return {"sum": result}

2. **TextInput Value Transfer**:
   - Frontend: Call setNodeResult(nodeId, value)
   - Backend: Receives value through result_node_values
   - Automatically passed as stored_value parameter during execution

3. **Large Data Handling**:
   - Data >10KB automatically converted to object_store reference
   - Transferred as {"__ref__": "object_id"} format
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

### Development & Testing Workflow

1. **Creating Component**:
    # 1. Create backend template
    packages/backend/templates/[category]/my_component.py
    
    # 2. If custom UI needed, create frontend component
    packages/frontend/src/components/nodes/[category]/MyComponentNode.tsx
    
    # 3. Register in category index.ts
    packages/frontend/src/components/nodes/[category]/index.ts
    
    # 4. If custom UI, add to ComponentRegistry
    packages/frontend/src/components/nodes/ComponentRegistry.tsx

2. **Testing Component**:
    # 1. Start development servers
    pnpm dev  # or docker-compose -f docker-compose.dev.yml up
    
    # 2. Create new project (http://localhost:5173)
    Click "New Project" button
    
    # 3. Add your component from left panel
    Find in category → Click to add
    
    # 4. Connect nodes and test execution
    Drag from output to input handle
    Click Start node's execute button
    
    # 5. Check results in Result node

3. **Debugging**:
    # Frontend console (Browser DevTools)
    - Component render errors
    - API call responses
    - localStorage data
    
    # Backend logs
    docker logs aim-red-backend-dev  # Docker
    # or terminal output if running locally
    
    # Execution errors appear in:
    - Toast notifications (top center)
    - Result node error display

### Styling Guidelines

1. **Color Scheme (Dark Theme)**:
    - Background: bg-neutral-900, bg-neutral-800
    - Borders: border-neutral-600, border-blue-600 (active)
    - Text: text-neutral-300, text-blue-300 (highlights)
    - Hover: hover:bg-neutral-700
    - Success: text-green-400, border-green-600
    - Error: text-red-400, border-red-600

2. **Component Layout**:
    <div className="bg-neutral-900 rounded-lg border border-neutral-600 p-4">
      <h3 className="text-sm font-medium text-neutral-300 mb-2">
        {props.data?.title}
      </h3>
      {/* Component content */}
    </div>

3. **Handles Styling**:
    - Position offsets vary by node type
    - DefaultNode: -20px offset
    - StartNode: -11.5px offset  
    - ResultNode: -8px offset

### Resize Implementation Pattern

    const [dimensions, setDimensions] = useState({ width: 300, height: 200 });
    const [isResizing, setIsResizing] = useState(false);
    
    const handleMouseDown = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsResizing(true);
      
      const startX = e.clientX;
      const startY = e.clientY;
      const startWidth = dimensions.width;
      const startHeight = dimensions.height;
      
      const handleMouseMove = (e: MouseEvent) => {
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        
        setDimensions({
          width: Math.max(200, startWidth + deltaX),  // Min width 200
          height: Math.max(100, startHeight + deltaY)  // Min height 100
        });
      };
      
      const handleMouseUp = () => {
        setIsResizing(false);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        
        // Save to localStorage
        if (projectId) {
          const key = `node_dimensions_${projectId}_${props.id}`;
          localStorage.setItem(key, JSON.stringify(dimensions));
        }
      };
      
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    };
    
    return (
      <div style={{ width: dimensions.width, height: dimensions.height }}>
        {/* Node content */}
        
        {/* Resize handle */}
        <div 
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
          onMouseDown={handleMouseDown}
        >
          <svg className="w-full h-full text-neutral-500">
            <path d="M 0,12 L 12,0" stroke="currentColor" />
          </svg>
        </div>
      </div>
    );

### Error Handling Pattern

    def RunScript(input_data: Any = None) -> Dict[str, Any]:
        try:
            # Validate input
            if not input_data:
                raise ValueError("Input data is required")
            
            # Process data
            result = process(input_data)
            
            return {
                "success": True,
                "data": result,
                "error": None
            }
        except Exception as e:
            import traceback
            return {
                "success": False,
                "data": None,
                "error": str(e),
                "traceback": traceback.format_exc()
            }

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