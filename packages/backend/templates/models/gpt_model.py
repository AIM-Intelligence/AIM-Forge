import openai
from typing import Optional, Dict, Any

CHAT_TEXT_MODELS = [
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-4.1",
    "gpt-4.1-mini",
    "gpt-4-turbo",
    "gpt-4",
    "gpt-3.5-turbo",
]

REASONING_MODELS = [
    "gpt-5",
    "gpt-5-mini",
    "gpt-5-nano",
    "o3",
    "o3-mini",
    "o3-pro",
    "o1",
    "o1-pro",
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
    prompt: str = "Hi, how are you?",
    system_prompt: str = "You are a helpful assistant.",
    model: str = "gpt-4o-mini",
    temperature: float = 0.7,
    max_tokens: int = 4096,
    api_key: Optional[str] = None,
) -> Dict[str, Any]:
    """
    - REASONING_MODELS: temperature 미전달 (예: gpt-5*, o*)
    - CHAT_TEXT_MODELS: temperature 전달 (예: gpt-4*, gpt-3.5)
    """
    client = openai.OpenAI(api_key=api_key)

    # 1) 추론(o*/gpt-5*) 경로: temperature 미전달
    if model in REASONING_MODELS:
        resp = _call_responses(
            client,
            model=model,
            prompt=prompt,
            system_prompt=system_prompt,
            max_tokens=max_tokens,
            temperature=None,
        )

    # 2) 채팅/멀티모달 경로
    elif model in CHAT_TEXT_MODELS:
        resp = _call_responses(
            client,
            model=model,
            prompt=prompt,
            system_prompt=system_prompt,
            max_tokens=max_tokens,
            temperature=temperature,
        )

    else:
        resp = _call_responses(
            client,
            model=model,
            prompt=prompt,
            system_prompt=system_prompt,
            max_tokens=max_tokens,
            temperature=None,
        )

    text = getattr(resp, "output_text", None) or str(resp)
    usage_info = _mk_usage(getattr(resp, "usage", None))

    return {"response": text, "usage": usage_info, "model": model}
