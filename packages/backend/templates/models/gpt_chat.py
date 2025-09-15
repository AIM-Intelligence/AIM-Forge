"""
GPT Chat - 대화 기록을 유지하는 OpenAI GPT 모델
이전 대화 내용을 기억하며 멀티턴 대화 가능
"""

import os
import openai
from typing import Optional, List, Dict, Any

# 모델 타입 정의
CHAT_TEXT_MODELS = [
    "gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini",
    "gpt-4-turbo", "gpt-4", "gpt-3.5-turbo"
]

REASONING_MODELS = [
    "gpt-5", "gpt-5-mini", "gpt-5-nano",
    "o3", "o3-mini", "o3-pro", 
    "o1", "o1-mini", "o1-pro"
]


def _mk_usage(usage_obj: Any) -> Optional[Dict[str, int]]:
    """Responses API usage 객체를 dict로 정리."""
    if not usage_obj:
        return None
    return {
        "input_tokens": getattr(usage_obj, "input_tokens", None),
        "output_tokens": getattr(usage_obj, "output_tokens", None),
        "total_tokens": getattr(usage_obj, "total_tokens", None),
    }


def _call_responses(
    client: openai.OpenAI,
    *,
    model: str,
    prompt: str,
    system_prompt: str,
    max_tokens: int,
    temperature: Optional[float] = None,
):
    """Responses API 호출 래퍼. temperature는 None이면 전달하지 않음."""
    kwargs: Dict[str, Any] = {
        "model": model,
        "input": prompt,
        "instructions": system_prompt,
        "max_output_tokens": max_tokens,
    }
    if temperature is not None:
        kwargs["temperature"] = temperature
    return client.responses.create(**kwargs)


def RunScript(
    Start: bool = True,
    messages: List[Dict[str, str]] = None,  # 이전 대화 기록
    user_prompt: str = "",  # 새로운 사용자 메시지
    system_prompt: str = "",  # 시스템 프롬프트 (첫 대화에서만 사용)
    model: str = "gpt-4o-mini",  # 기본값을 gpt-4o-mini로 변경
    temperature: float = 0.7,
    max_tokens: int = 4096,
    api_key: Optional[str] = None,
) -> dict:
    """
    대화 기록을 유지하며 GPT 모델과 대화합니다.
    
    Parameters:
        messages: 이전 대화 기록 [{"role": "user/assistant/system", "content": "..."}]
        user_prompt: 새로운 사용자 입력
        system_prompt: 시스템 프롬프트 (messages가 비어있을 때만 적용)
        model: 사용할 GPT 모델
        temperature: 창의성 조절 (0.0-2.0)
        max_tokens: 최대 생성 토큰 수
        api_key: OpenAI API 키
    
    Returns:
        messages: 업데이트된 전체 대화 기록
        response: 최신 AI 응답
        usage: 토큰 사용량
        turn_count: 총 대화 턴 수
    """
    
    # messages 초기화
    if messages is None:
        messages = []
    
    # messages가 string으로 왔을 경우 (TextInput에서 JSON 문자열로 입력)
    if isinstance(messages, str):
        try:
            import json
            messages = json.loads(messages)
        except (json.JSONDecodeError, ValueError) as e:
            # JSON 파싱 실패 시 에러 메시지와 함께 빈 리스트로 초기화
            print(f"Warning: Failed to parse messages JSON: {e}")
            messages = []
    
    # messages가 dict로 왔을 경우 (이전 결과에서 온 경우)
    elif isinstance(messages, dict):
        # 이전 출력에서 messages 키 추출
        if "messages" in messages:
            messages = messages["messages"]
        else:
            messages = []
    
    # messages가 이미 list가 아닌 다른 타입인 경우
    elif not isinstance(messages, list):
        messages = []
    
    # messages 형식 검증 (각 메시지가 올바른 형식인지 확인)
    validated_messages = []
    for msg in messages:
        if isinstance(msg, dict) and "role" in msg and "content" in msg:
            # role이 올바른지 확인
            if msg["role"] in ["system", "user", "assistant"]:
                validated_messages.append(msg)
            else:
                print(f"Warning: Invalid role '{msg['role']}' in message, skipping")
        else:
            print(f"Warning: Invalid message format, skipping: {msg}")
    
    messages = validated_messages
    
    # messages 복사 (원본 수정 방지)
    conversation = messages.copy() if messages else []
    
    # 첫 대화이고 system_prompt가 있으면 추가
    if not conversation and system_prompt:
        conversation.append({"role": "system", "content": system_prompt})
    
    # 새 사용자 메시지 추가
    if user_prompt:
        conversation.append({"role": "user", "content": user_prompt})
    else:
        # user_prompt가 없으면 messages만 반환 (대화 이어가기 용도)
        if not conversation:
            return {"error": "대화를 시작하려면 user_prompt를 입력하세요"}
        
    # API 키 확인
    if not api_key and not os.environ.get("OPENAI_API_KEY"):
        return {
            "error": "OpenAI API 키가 설정되지 않았습니다",
            "messages": conversation
        }
    
    try:
        # OpenAI 클라이언트 초기화
        client = openai.OpenAI(api_key=api_key)
    except Exception as e:
        return {
            "error": f"API 키 오류: {str(e)}",
            "messages": conversation
        }
    
    try:
        # 대화 기록을 하나의 프롬프트로 변환
        full_prompt = ""
        for msg in conversation:
            if msg["role"] == "system":
                # 시스템 메시지는 instructions로 사용
                system_prompt = msg["content"]
            elif msg["role"] == "user":
                full_prompt += f"User: {msg['content']}\n"
            elif msg["role"] == "assistant":
                full_prompt += f"Assistant: {msg['content']}\n"
        
        # 최종 프롬프트 정리
        full_prompt = full_prompt.strip()
        if not full_prompt:
            full_prompt = user_prompt or "Hello"
        
        # 시스템 프롬프트가 없으면 기본값
        if not system_prompt:
            system_prompt = "You are a helpful assistant. Continue the conversation naturally."
        
        # Responses API 호출
        if model in REASONING_MODELS:
            # 추론 모델: temperature 미전달
            resp = _call_responses(
                client,
                model=model,
                prompt=full_prompt,
                system_prompt=system_prompt,
                max_tokens=max_tokens,
                temperature=None,
            )
        elif model in CHAT_TEXT_MODELS:
            # 채팅 모델: temperature 전달
            resp = _call_responses(
                client,
                model=model,
                prompt=full_prompt,
                system_prompt=system_prompt,
                max_tokens=max_tokens,
                temperature=temperature,
            )
        else:
            # 알 수 없는 모델: temperature 없이 시도
            resp = _call_responses(
                client,
                model=model,
                prompt=full_prompt,
                system_prompt=system_prompt,
                max_tokens=max_tokens,
                temperature=None,
            )
        
        # 응답 추출
        assistant_message = getattr(resp, "output_text", None) or str(resp)
        
        # 대화 기록에 AI 응답 추가
        conversation.append({"role": "assistant", "content": assistant_message})
        
        # 토큰 사용량
        usage_info = _mk_usage(getattr(resp, "usage", None))
        
        # 대화 턴 계산 (user + assistant 메시지 쌍)
        turn_count = sum(1 for msg in conversation if msg["role"] == "user")
        
        # 사용량 정보 포맷팅 (선택적)
        usage_str = ""
        if usage_info:
            usage_str = f"""모델: {model}
입력 토큰: {usage_info.get('input_tokens', 0)}
출력 토큰: {usage_info.get('output_tokens', 0)}
총 토큰: {usage_info.get('total_tokens', 0)}"""
        else:
            usage_str = f"모델: {model}"
        
        return {
            "messages": conversation,  # 전체 대화 기록
            "response": assistant_message,  # 최신 응답만
            "usage": usage_str.strip(),  # 문자열로 포맷팅된 사용량
            "usage_dict": usage_info,  # 딕셔너리 형태 사용량 (선택적)
            "model": model,
            "turn_count": turn_count,
            "total_messages": len(conversation)
        }
        
    except Exception as e:
        error_msg = str(e)
        if "model" in error_msg.lower():
            return {
                "error": f"❌ 모델 '{model}'을 사용할 수 없습니다.\n사용 가능한 모델:\n• 채팅: gpt-4o-mini, gpt-4o, gpt-3.5-turbo\n• 추론: o1-mini, o3-mini",
                "messages": conversation
            }
        return {
            "error": f"API 호출 실패: {error_msg}",
            "messages": conversation
        }