"""
GPT Chat - 대화 기록을 유지하는 OpenAI GPT 모델
이전 대화 내용을 기억하며 멀티턴 대화 가능
"""

import os
import openai
from typing import Optional, List, Dict


def RunScript(
    Start: bool = True,
    messages: List[Dict[str, str]] = None,  # 이전 대화 기록
    user_prompt: str = "",  # 새로운 사용자 메시지
    system_prompt: str = "",  # 시스템 프롬프트 (첫 대화에서만 사용)
    model: str = "gpt-4o",  # gpt-4o, gpt-4-turbo, gpt-3.5-turbo
    temperature: float = 0.7,
    max_tokens: int = 5000,
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
    api_key = api_key or os.getenv("OPENAI_API_KEY")
    if not api_key:
        return {"error": "OpenAI API 키가 설정되지 않았습니다"}
    
    try:
        # OpenAI 클라이언트 초기화
        client = openai.OpenAI(api_key=api_key)
        
        # API 호출 파라미터
        params = {
            "model": model,
            "messages": conversation
        }
        
        # GPT-5 계열 확인
        is_gpt5 = model.startswith("gpt-5") or "gpt-5" in model
        
        if not is_gpt5:
            params["temperature"] = temperature
            params["max_tokens"] = max_tokens
        else:
            params["max_completion_tokens"] = max_tokens
        
        # API 호출
        response = client.chat.completions.create(**params)
        
        # 응답 추출
        assistant_message = response.choices[0].message.content
        
        # 대화 기록에 AI 응답 추가
        conversation.append({"role": "assistant", "content": assistant_message})
        
        # 토큰 사용량
        usage = {
            "prompt_tokens": response.usage.prompt_tokens,
            "completion_tokens": response.usage.completion_tokens,
            "total_tokens": response.usage.total_tokens,
        }
        
        # 대화 턴 계산 (user + assistant 메시지 쌍)
        turn_count = sum(1 for msg in conversation if msg["role"] == "user")
        
        return {
            "messages": conversation,  # 전체 대화 기록
            "response": assistant_message,  # 최신 응답만
            "usage": usage,
            "model": model,
            "turn_count": turn_count,
            "total_messages": len(conversation)
        }
        
    except Exception as e:
        return {"error": f"API 호출 실패: {str(e)}"}