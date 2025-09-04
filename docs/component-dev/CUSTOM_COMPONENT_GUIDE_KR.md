# Custom Component Development Guide

AIM-Forge/RedLab에서 간단한 스크립트부터 완전한 컴포넌트까지 동일한 UX로 만들기 위한 규칙 세트입니다.

> **핵심 원칙**: 입력은 함수 시그니처로, 출력은 dict 키로 UI에 자동 매핑

## 📋 목차

- [개발 모드 개요](#개발-모드-개요)
- [Python Script Mode](#1-python-script-mode-초간단-브릿지)
- [AIM SDK Mode](#2-aim-sdk-mode-정식-컴포넌트)
- [입력/출력 자동 매핑](#입력출력-자동-매핑)
- [타입힌트 UI 매핑 규칙](#타입힌트-ui-매핑-규칙)
- [대용량 데이터 처리](#대용량-데이터-처리)
- [개발 워크플로우](#개발-워크플로우)
- [베스트 프랙티스](#베스트-프랙티스)

## 개발 모드 개요

AIM-Forge는 두 가지 컴포넌트 개발 모드를 제공합니다:

| 모드 | 목적 | 복잡도 | 사용 시점 |
|------|------|--------|----------|
| **Python Script Mode** | 빠른 프로토타이핑, 실험 | 낮음 | 아이디어 테스트, 간단한 처리 |
| **AIM SDK Mode** | 재사용 가능한 정식 컴포넌트 | 중간-높음 | 배포용 컴포넌트, 팀 공유 |

## 1. Python Script Mode (초간단 브릿지)

### 목적
작은 중간 처리나 실험용 컴포넌트를 빠르게 만들 때 사용합니다.

### 특징
- 최소한의 보일러플레이트
- RunScript 함수 하나만 정의
- 자동 포트 생성

### 기본 템플릿

```python
def RunScript(x: int = 0, y: str = "default") -> dict:
    """
    간단한 처리 함수
    
    Args:
        x: 입력 숫자 (자동으로 숫자 입력 UI 생성)
        y: 입력 문자열 (자동으로 텍스트 입력 UI 생성)
    
    Returns:
        dict: 출력 포트로 매핑될 딕셔너리
    """
    # 간단한 처리 로직
    result = f"Processed: {x} with {y}"
    
    return {
        "output": result,
        "count": x * 2
    }
```

### 실제 예시: 텍스트 처리기

```python
def RunScript(
    text: str = "",
    uppercase: bool = False,
    max_length: int = 100
) -> dict:
    """간단한 텍스트 처리기"""
    
    # 처리
    processed = text.upper() if uppercase else text.lower()
    truncated = processed[:max_length]
    
    return {
        "result": truncated,
        "length": len(truncated),
        "was_truncated": len(processed) > max_length
    }
```

## 2. AIM SDK Mode (정식 컴포넌트)

### 목적
파라미터/출력/검증/메타데이터까지 갖춘 재사용 가능한 컴포넌트 개발

### 특징
- 헬퍼 클래스/함수 자유롭게 정의
- 단일 진입점 RunScript
- 타입힌트 기반 UI 자동 구성
- 입력 검증 및 에러 처리

### 완전한 컴포넌트 예시

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CSV Data Processor Component
재사용 가능한 데이터 처리 컴포넌트
"""

from __future__ import annotations
from typing import Dict, Any, List, Literal, Optional
import csv
import json
from dataclasses import dataclass
from enum import Enum

# ===========================
# 헬퍼 레이어
# ===========================

class ProcessingMode(Enum):
    """처리 모드 정의"""
    FAST = "fast"
    NORMAL = "normal"
    DETAILED = "detailed"

@dataclass
class ProcessingResult:
    """처리 결과 컨테이너"""
    data: List[Dict[str, Any]]
    stats: Dict[str, Any]
    errors: List[str]
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "data": self.data,
            "statistics": self.stats,
            "error_messages": self.errors,
            "success": len(self.errors) == 0
        }

class DataProcessor:
    """데이터 처리 유틸리티"""
    
    def __init__(self, mode: ProcessingMode = ProcessingMode.NORMAL):
        self.mode = mode
        self.processed_count = 0
    
    def process_csv_data(
        self, 
        file_path: str,
        filter_column: Optional[str] = None,
        filter_value: Optional[str] = None
    ) -> ProcessingResult:
        """CSV 데이터 처리"""
        data = []
        errors = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                
                for row in reader:
                    # 필터링 로직
                    if filter_column and filter_value:
                        if row.get(filter_column) != filter_value:
                            continue
                    
                    # 모드별 처리
                    if self.mode == ProcessingMode.DETAILED:
                        # 모든 데이터 포함
                        data.append(row)
                    elif self.mode == ProcessingMode.FAST:
                        # 필수 필드만
                        data.append({k: v for k, v in row.items() if k[:3] != '__'})
                    else:
                        data.append(row)
                    
                    self.processed_count += 1
                    
        except FileNotFoundError:
            errors.append(f"File not found: {file_path}")
        except Exception as e:
            errors.append(f"Processing error: {str(e)}")
        
        # 통계 생성
        stats = {
            "total_rows": len(data),
            "processed": self.processed_count,
            "mode": self.mode.value,
            "filtered": filter_column is not None
        }
        
        return ProcessingResult(data, stats, errors)

def validate_inputs(
    file_path: str,
    mode: str,
    limit: int
) -> List[str]:
    """입력 검증 헬퍼"""
    errors = []
    
    if not file_path:
        errors.append("File path is required")
    
    if mode not in ["fast", "normal", "detailed"]:
        errors.append(f"Invalid mode: {mode}")
    
    if limit < 0:
        errors.append("Limit must be non-negative")
    
    return errors

# ===========================
# 엔트리 포인트
# ===========================

def RunScript(
    # 필수 입력
    file_path: str = "",
    
    # 처리 옵션
    mode: Literal["fast", "normal", "detailed"] = "normal",
    filter_column: str = "",
    filter_value: str = "",
    
    # 출력 제어
    limit: int = 1000,
    include_stats: bool = True,
    format_output: Literal["json", "dict", "list"] = "dict",
    
    # 디버그
    verbose: bool = False
) -> Dict[str, Any]:
    """
    CSV 데이터 처리 컴포넌트
    
    파라미터가 자동으로 입력 포트로 매핑됩니다:
    - file_path: 파일 경로 입력 (텍스트 UI)
    - mode: 처리 모드 선택 (드롭다운 UI)
    - filter_column/value: 필터링 옵션 (텍스트 UI)
    - limit: 최대 행 수 (숫자 UI)
    - include_stats: 통계 포함 (체크박스 UI)
    - format_output: 출력 형식 (드롭다운 UI)
    - verbose: 디버그 출력 (체크박스 UI)
    
    반환값의 키가 출력 포트로 매핑됩니다.
    """
    
    # 1. 입력 검증
    validation_errors = validate_inputs(file_path, mode, limit)
    if validation_errors:
        return {
            "success": False,
            "data": None,
            "error": "; ".join(validation_errors),
            "metadata": {"stage": "validation"}
        }
    
    # 2. 프로세서 초기화
    proc_mode = ProcessingMode(mode)
    processor = DataProcessor(proc_mode)
    
    if verbose:
        print(f"[DEBUG] Processing {file_path} in {mode} mode")
        print(f"[DEBUG] Filter: {filter_column}={filter_value}")
    
    # 3. 데이터 처리
    result = processor.process_csv_data(
        file_path,
        filter_column if filter_column else None,
        filter_value if filter_value else None
    )
    
    # 4. 결과 포맷팅
    output_data = result.data[:limit] if limit > 0 else result.data
    
    if format_output == "json":
        formatted = json.dumps(output_data, indent=2)
    elif format_output == "list":
        formatted = output_data
    else:  # dict
        formatted = {"rows": output_data}
    
    # 5. 출력 구성
    output = {
        "data": formatted,
        "success": len(result.errors) == 0,
        "row_count": len(output_data)
    }
    
    if include_stats:
        output["statistics"] = result.stats
    
    if result.errors:
        output["errors"] = result.errors
    
    if verbose:
        output["debug_info"] = {
            "processor": processor.__class__.__name__,
            "mode": proc_mode.value,
            "total_processed": processor.processed_count
        }
    
    # 메타데이터 추가
    output["metadata"] = {
        "component": "CSV Data Processor",
        "version": "1.0.0",
        "format": format_output
    }
    
    return output

# ===========================
# 로컬 테스트
# ===========================

if __name__ == "__main__":
    # 컴포넌트 단독 테스트
    test_result = RunScript(
        file_path="test_data.csv",
        mode="normal",
        filter_column="status",
        filter_value="active",
        limit=10,
        include_stats=True,
        verbose=True
    )
    
    from pprint import pprint
    print("\n=== Test Result ===")
    pprint(test_result)
```

## 입력/출력 자동 매핑

### 입력 매핑 (파라미터 → UI 포트)

```python
def RunScript(
    # 각 파라미터가 입력 포트가 됨
    text: str = "default",           # → 텍스트 입력 포트
    number: float = 1.0,              # → 숫자 입력 포트
    enabled: bool = True,             # → 체크박스 포트
    mode: Literal["a", "b"] = "a",   # → 드롭다운 포트
    optional: Optional[int] = None   # → 옵셔널 입력 포트
) -> Dict[str, Any]:
    ...
```

### 출력 매핑 (dict 키 → UI 포트)

```python
def RunScript(...) -> Dict[str, Any]:
    return {
        "result": processed_data,      # → "result" 출력 포트
        "count": 42,                    # → "count" 출력 포트
        "metadata": {...},              # → "metadata" 출력 포트
        "success": True                 # → "success" 출력 포트
    }
```

## 타입힌트 UI 매핑 규칙

| Python 타입 | UI 위젯 | 예시 |
|------------|---------|------|
| `str` | 텍스트 입력 | `name: str = ""` |
| `int` | 정수 스피너 | `count: int = 0` |
| `float` | 실수 입력 | `value: float = 0.0` |
| `bool` | 체크박스 | `enabled: bool = False` |
| `Literal[...]` | 드롭다운 | `mode: Literal["a", "b", "c"] = "a"` |
| `List[T]` | 리스트 에디터 | `items: List[str] = []` |
| `Dict[K, V]` | JSON 에디터 | `config: Dict[str, Any] = {}` |
| `Optional[T]` | 옵셔널 입력 | `filter: Optional[str] = None` |
| `Any` | 자유 입력 | `data: Any = None` |

## 대용량 데이터 처리

### 자동 참조 시스템

10KB 이상의 데이터는 자동으로 참조(Reference) 시스템으로 전환됩니다:

```python
def RunScript(large_data: Any = None) -> Dict[str, Any]:
    # 큰 데이터 생성
    huge_array = [i for i in range(1000000)]
    
    return {
        "data": huge_array,  # 자동으로 참조로 변환
        "size": len(huge_array)
    }
    
    # UI에서는 다음과 같이 전달됨:
    # {
    #   "data": {
    #     "__ref__": "object_abc123",
    #     "__preview__": "[0, 1, 2, ...]",
    #     "__size__": 1000000
    #   },
    #   "size": 1000000
    # }
```

### 참조 데이터 수신

```python
def RunScript(input_ref: Any = None) -> Dict[str, Any]:
    # 참조든 실제 데이터든 자동으로 처리
    if isinstance(input_ref, dict) and "__ref__" in input_ref:
        print(f"Received reference: {input_ref['__ref__']}")
        # 실행 시스템이 자동으로 실제 데이터로 역참조
    
    # 그냥 사용하면 됨
    actual_data = input_ref  # 이미 역참조된 상태
    
    return {"processed": len(actual_data)}
```

## 개발 워크플로우

### 1단계: Script Mode로 시작

```python
# test_component.py
def RunScript(x: int = 0) -> dict:
    return {"double": x * 2}
```

### 2단계: 테스트 및 검증

```bash
# 로컬 테스트
python test_component.py

# AIM-Forge에서 테스트
1. Custom Node 생성
2. 코드 붙여넣기
3. 실행 및 확인
```

### 3단계: SDK Mode로 발전

```python
# production_component.py
class Calculator:
    def double(self, x: int) -> int:
        return x * 2

def RunScript(
    x: int = 0,
    validate: bool = True
) -> Dict[str, Any]:
    if validate and x < 0:
        return {"error": "x must be non-negative"}
    
    calc = Calculator()
    return {
        "result": calc.double(x),
        "success": True
    }
```

### 4단계: 컴포넌트 등록

```python
# packages/backend/templates/dataops/my_calculator.py
# 위 코드 저장

# packages/frontend/src/components/nodes/dataops/index.ts
export const dataopsComponents = [
  {
    id: "calculator",
    name: "Calculator",
    icon: "🧮",
    template: "dataops/my_calculator",
    nodeType: "custom"
  }
];
```

## 베스트 프랙티스

### ✅ DO

1. **명확한 타입힌트 사용**
   ```python
   def RunScript(count: int = 0, name: str = "") -> Dict[str, Any]:
   ```

2. **의미 있는 기본값 제공**
   ```python
   def RunScript(threshold: float = 0.5, max_items: int = 100):
   ```

3. **입력 검증 추가**
   ```python
   if not 0 <= threshold <= 1:
       raise ValueError("threshold must be between 0 and 1")
   ```

4. **설명적인 출력 키 사용**
   ```python
   return {
       "processed_data": data,      # Good
       "d": data                     # Bad
   }
   ```

5. **에러 처리 포함**
   ```python
   try:
       result = process(data)
       return {"data": result, "success": True}
   except Exception as e:
       return {"error": str(e), "success": False}
   ```

### ❌ DON'T

1. **전역 상태 사용 피하기**
   ```python
   global_cache = {}  # Bad
   
   def RunScript():
       global_cache["key"] = value  # Bad
   ```

2. **부작용 있는 import 피하기**
   ```python
   import some_module_that_modifies_system  # Bad
   ```

3. **무한 루프나 긴 실행 피하기**
   ```python
   while True:  # Bad
       process()
   ```

4. **파일 시스템 직접 수정 피하기**
   ```python
   os.remove("/important/file")  # Bad
   ```

## 디버깅 팁

### 로컬 테스트 패턴

```python
def RunScript(x: int = 0, debug: bool = False) -> Dict[str, Any]:
    if debug:
        print(f"[DEBUG] Input: x={x}")
    
    result = x * 2
    
    if debug:
        print(f"[DEBUG] Output: {result}")
    
    return {"result": result}

if __name__ == "__main__":
    # 직접 실행하여 테스트
    test_result = RunScript(x=5, debug=True)
    print(f"Test result: {test_result}")
```

### 타입 체크

```bash
# mypy를 사용한 타입 체크
pip install mypy
mypy my_component.py
```

### 단위 테스트

```python
# test_my_component.py
import unittest
from my_component import RunScript

class TestMyComponent(unittest.TestCase):
    def test_basic(self):
        result = RunScript(x=5)
        self.assertEqual(result["result"], 10)
    
    def test_validation(self):
        result = RunScript(x=-1)
        self.assertIn("error", result)

if __name__ == "__main__":
    unittest.main()
```

## 고급 패턴

### 비동기 처리 (Future)

```python
import asyncio
from typing import Dict, Any

async def async_process(data):
    await asyncio.sleep(1)
    return data * 2

def RunScript(x: int = 0) -> Dict[str, Any]:
    # 동기 래퍼로 비동기 코드 실행
    loop = asyncio.new_event_loop()
    result = loop.run_until_complete(async_process(x))
    loop.close()
    
    return {"result": result}
```

### 외부 API 호출

```python
import requests
from typing import Dict, Any, Optional

def RunScript(
    api_url: str = "",
    api_key: str = "",
    timeout: int = 30
) -> Dict[str, Any]:
    if not api_url:
        return {"error": "API URL is required"}
    
    try:
        headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
        response = requests.get(api_url, headers=headers, timeout=timeout)
        response.raise_for_status()
        
        return {
            "data": response.json(),
            "status_code": response.status_code,
            "success": True
        }
    except requests.RequestException as e:
        return {
            "error": str(e),
            "success": False
        }
```

## 마이그레이션 가이드

### 기존 Python 스크립트 → AIM Component

기존 스크립트:
```python
# old_script.py
def process_data(input_file, output_file):
    with open(input_file, 'r') as f:
        data = f.read()
    
    processed = data.upper()
    
    with open(output_file, 'w') as f:
        f.write(processed)
```

AIM Component로 변환:
```python
# new_component.py
def RunScript(
    input_file: str = "",
    to_uppercase: bool = True
) -> Dict[str, Any]:
    try:
        with open(input_file, 'r') as f:
            data = f.read()
        
        if to_uppercase:
            processed = data.upper()
        else:
            processed = data.lower()
        
        return {
            "processed_text": processed,
            "original_length": len(data),
            "processed_length": len(processed),
            "success": True
        }
    except Exception as e:
        return {
            "error": str(e),
            "success": False
        }
```

## 다음 단계

1. **간단한 Script Mode 컴포넌트 만들기**
   - 텍스트 처리, 숫자 계산 등

2. **SDK Mode로 발전시키기**
   - 헬퍼 클래스 추가
   - 입력 검증 강화
   - 에러 처리 개선

3. **정식 컴포넌트로 등록**
   - backend/templates에 저장
   - frontend 카테고리에 등록
   - 팀과 공유

4. **고급 기능 활용**
   - 대용량 데이터 참조 시스템
   - 비동기 처리
   - 외부 API 통합

---

> 💡 **Pro Tip**: Script Mode로 빠르게 시작하고, 필요에 따라 SDK Mode로 발전시키세요. 
> 모든 컴포넌트는 동일한 RunScript 인터페이스를 사용하므로 쉽게 전환할 수 있습니다.