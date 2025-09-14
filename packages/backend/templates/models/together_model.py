"""
Together AI Model - Together AI를 통한 오픈소스 모델 호출
다양한 오픈소스 LLM (Llama, Mixtral, CodeLlama 등) 사용 가능
"""

import os
from together import Together
from typing import Optional


def RunScript(
    Start: bool = True,
    prompt: str = "Hi, how are you?",
    system_prompt: str = "You are a helpful assistant.",
    model: str = "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
    # === 사용 가능한 Together AI 모델 목록 (2025.01) ===
    # 
    # 🦙 Llama 시리즈:
    #   meta-llama/Llama-4-Scout-17B-16E-Instruct
    #   meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8
    #   meta-llama/Llama-3.3-70B-Instruct-Turbo (무료 버전도 있음)
    #   meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo
    #   meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo
    #   meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo
    #   meta-llama/Meta-Llama-3-70B-Instruct-Turbo
    #   meta-llama/Meta-Llama-3-8B-Instruct
    #   meta-llama/Llama-3.2-3B-Instruct-Turbo
    #   meta-llama/Llama-3.2-1B-Instruct
    #
    # 🐉 Qwen 시리즈:
    #   Qwen/QwQ-32B (추론 특화)
    #   Qwen/Qwen3-235B-A22B-Instruct-2507-tput
    #   Qwen/Qwen3-235B-A22B-Thinking-2507
    #   Qwen/Qwen3-Coder-480B-A35B-Instruct-FP8
    #   Qwen/Qwen2.5-72B-Instruct-Turbo
    #   Qwen/Qwen2.5-7B-Instruct-Turbo
    #   Qwen/Qwen2.5-Coder-32B-Instruct
    #   Qwen/Qwen2.5-VL-72B-Instruct (비전 지원)
    #
    # 🌊 DeepSeek 시리즈:
    #   deepseek-ai/DeepSeek-R1 (최신 추론 모델)
    #   deepseek-ai/DeepSeek-R1-Distill-Llama-70B (무료 버전도 있음)
    #   deepseek-ai/DeepSeek-R1-Distill-Qwen-14B
    #   deepseek-ai/DeepSeek-V3.1
    #   deepseek-ai/DeepSeek-V3
    #
    # 🌟 Mistral 시리즈:
    #   mistralai/Mistral-Small-24B-Instruct-2501
    #   mistralai/Mixtral-8x7B-Instruct-v0.1
    #   mistralai/Mistral-7B-Instruct-v0.3
    #   mistralai/Mistral-7B-Instruct-v0.2
    #
    # 🧠 Cogito 시리즈 (대규모):
    #   deepcogito/cogito-v2-preview-deepseek-671b
    #   deepcogito/cogito-v2-preview-llama-405B
    #   deepcogito/cogito-v2-preview-llama-109B-MoE
    #   deepcogito/cogito-v2-preview-llama-70B
    #
    # 🎭 Arcee AI 시리즈:
    #   arcee-ai/maestro-reasoning (추론 특화)
    #   arcee-ai/virtuoso-large
    #   arcee-ai/coder-large
    #   arcee-ai/AFM-4.5B
    #
    # 🌙 기타 주요 모델:
    #   moonshotai/Kimi-K2-Instruct (Kimi 모델)
    #   lgai/exaone-deep-32b (LG AI)
    #   lgai/exaone-3-5-32b-instruct
    #   google/gemma-3n-E4B-it (Google)
    #   openai/gpt-oss-120b (OpenAI 오픈소스)
    #   togethercomputer/MoA-1-Turbo (Together AI 자체)
    #
    # 🎨 이미지 생성 (FLUX):
    #   black-forest-labs/FLUX.1.1-pro
    #   black-forest-labs/FLUX.1-schnell-Free (무료)
    #   black-forest-labs/FLUX.1-dev
    #
    # 🔊 음성/오디오:
    #   openai/whisper-large-v3
    #   cartesia/sonic-2
    #
    # 🔍 임베딩/리랭킹:
    #   BAAI/bge-large-en-v1.5
    #   mixedbread-ai/Mxbai-Rerank-Large-V2
    #   Salesforce/Llama-Rank-V1
    #
    temperature: float = 0.7,
    max_tokens: int = 5000,
    api_key: Optional[str] = None,
) -> dict:
    """
    Together AI를 통해 오픈소스 모델을 호출하여 응답을 생성합니다.

    Parameters:
        prompt: 사용자 입력 프롬프트
        system_prompt: 시스템 프롬프트 (모델 역할 정의)
        model: 사용할 모델 (Together AI 모델 이름)
        temperature: 창의성 조절 (0.0-2.0)
        max_tokens: 최대 생성 토큰 수
        api_key: Together API 키 (없으면 환경변수 사용)

    Returns:
        response: 모델의 응답
        usage: 토큰 사용량 정보
        model: 사용된 모델명
    """

    if not prompt:
        return {"error": "프롬프트가 비어있습니다"}

    # API 키 확인
    api_key = api_key or os.getenv("TOGETHER_API_KEY")
    if not api_key:
        return {"error": "Together API 키가 설정되지 않았습니다"}

    try:
        # Together 클라이언트 초기화
        client = Together(api_key=api_key)

        # API 호출 (OpenAI 호환 인터페이스)
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt},
            ],
            temperature=temperature,
            max_tokens=max_tokens,
        )

        # 응답 추출
        result = response.choices[0].message.content
        usage = {
            "prompt_tokens": response.usage.prompt_tokens if response.usage else 0,
            "completion_tokens": response.usage.completion_tokens if response.usage else 0,
            "total_tokens": response.usage.total_tokens if response.usage else 0,
        }

        return {"response": result, "usage": usage, "model": model}

    except Exception as e:
        return {"error": f"API 호출 실패: {str(e)}"}