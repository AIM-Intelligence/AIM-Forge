"""
Claude Model - Anthropic Claude 모델 호출
프롬프트를 받아 Claude로 응답 생성
"""

import os
import anthropic
from typing import Optional


def RunScript(
    Start: bool = True,
    prompt: str = "Hi, how are you?",
    system_prompt: str = "You are a helpful assistant.",
    model: str = "claude-3-5-sonnet-20241022",  # claude-3-5-sonnet-20241022, claude-3-5-haiku-20241022, claude-3-opus-20240229
    temperature: float = 0.7,
    max_tokens: int = 5000,
    api_key: Optional[str] = None,
) -> dict:
    """
    Anthropic Claude 모델을 호출하여 응답을 생성합니다.

    Parameters:
        prompt: 사용자 입력 프롬프트
        system_prompt: 시스템 프롬프트 (모델 역할 정의)
        model: 사용할 Claude 모델
        temperature: 창의성 조절 (0.0-1.0)
        max_tokens: 최대 생성 토큰 수
        api_key: Anthropic API 키 (없으면 환경변수 사용)

    Returns:
        response: Claude 모델의 응답
        usage: 토큰 사용량 정보
    """

    if not prompt:
        return {"error": "프롬프트가 비어있습니다"}

    # API 키 확인
    api_key = api_key or os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return {"error": "Anthropic API 키가 설정되지 않았습니다"}

    try:
        # Anthropic 클라이언트 초기화
        client = anthropic.Anthropic(api_key=api_key)

        # API 호출
        response = client.messages.create(
            model=model,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system_prompt,
            messages=[{"role": "user", "content": prompt}],
        )

        # 응답 추출
        result = response.content[0].text
        usage = {
            "input_tokens": response.usage.input_tokens,
            "output_tokens": response.usage.output_tokens,
            "total_tokens": response.usage.input_tokens + response.usage.output_tokens,
        }

        return {"response": result, "usage": usage, "model": model}

    except Exception as e:
        return {"error": f"API 호출 실패: {str(e)}"}
