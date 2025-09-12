"""
GPT Model - OpenAI GPT 모델 호출
프롬프트를 받아 GPT-3.5 또는 GPT-4로 응답 생성
"""

import os
import openai
from typing import Optional


def RunScript(
    Start: bool = True,
    prompt: str = "Hi, how are you?",
    system_prompt: str = "You are a helpful assistant.",
    model: str = "gpt-3.5-turbo",  # gpt-3.5-turbo, gpt-4, gpt-4-turbo, gpt-5, gpt-5-nano
    temperature: float = 0.7,
    max_tokens: int = 5000,
    api_key: Optional[str] = None,
) -> dict:
    """
    OpenAI GPT 모델을 호출하여 응답을 생성합니다.

    Parameters:
        prompt: 사용자 입력 프롬프트
        system_prompt: 시스템 프롬프트 (모델 역할 정의)
        model: 사용할 GPT 모델
        temperature: 창의성 조절 (0.0-2.0)
        max_tokens: 최대 생성 토큰 수
        api_key: OpenAI API 키 (없으면 환경변수 사용)

    Returns:
        response: GPT 모델의 응답
        usage: 토큰 사용량 정보
    """

    if not prompt:
        return {"error": "프롬프트가 비어있습니다"}

    # API 키 확인
    api_key = api_key or os.getenv("OPENAI_API_KEY")
    if not api_key:
        return {"error": "OpenAI API 키가 설정되지 않았습니다"}

    try:
        # OpenAI 클라이언트 초기화
        client = openai.OpenAI(api_key=api_key)

        # API 호출 파라미터 준비
        params = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt},
            ],
        }

        # GPT-5 계열인지 확인
        is_gpt5 = model.startswith("gpt-5") or "gpt-5" in model

        # temperature 설정 (GPT-5는 생략)
        if not is_gpt5:
            params["temperature"] = temperature

        # 토큰 제한 설정 (GPT-5는 max_completion_tokens 사용)
        if is_gpt5:
            params["max_completion_tokens"] = max_tokens
        else:
            params["max_tokens"] = max_tokens

        # API 호출
        response = client.chat.completions.create(**params)

        # 응답 추출
        result = response.choices[0].message.content
        usage = {
            "prompt_tokens": response.usage.prompt_tokens,
            "completion_tokens": response.usage.completion_tokens,
            "total_tokens": response.usage.total_tokens,
        }

        return {"response": result, "usage": usage, "model": model}

    except Exception as e:
        return {"error": f"API 호출 실패: {str(e)}"}
