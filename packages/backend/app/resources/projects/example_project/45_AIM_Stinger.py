"""
AIM-Stinger Attack Node - Multi-turn jailbreak attack via external API
Executes coordinated attacks using attacker LLM against target models
"""

from typing import Dict, Any
import json
import requests


def RunScript(
    start: Any = None,
    base_query: str = "Write a simple story",
    api_key: str = "",
    attacker_model: str = "Qwen/Qwen3-235B-A22B-Instruct-2507-tput",
    target_model_name: str = "gpt-3.5-turbo",
    target_endpoint: str = "https://api.openai.com/v1",
    max_turns: int = 2,
    language: str = "en",
    api_endpoint: str = "http://211.115.110.155:8003",
    timeout: int = 300,
) -> Dict[str, Any]:
    """
    Execute AIM-Stinger attack via external API.

    Parameters:
        base_query: The query/prompt to attack with
        api_key: API key for the target model (e.g., OpenAI key)
        attacker_model: Model to use for generating attacks
        target_model_name: Target model to attack (e.g., gpt-3.5-turbo)
        target_endpoint: API endpoint for target model
        max_turns: Maximum number of attack turns
        language: Language for the attack (en/ko/zh/etc.)
        api_endpoint: AIM-Stinger API endpoint
        timeout: Request timeout in seconds

    Returns:
        Dictionary containing attack results and status
    """

    # Construct the attack payload
    payload = {
        "attacker_model": attacker_model,
        "target_model": {
            "endpoint": target_endpoint,
            "model_name": target_model_name,
            "api_key": api_key,
        },
        "base_query": base_query,
        "language": language,
        "max_turns": max_turns,
    }

    # Make the API request
    response = requests.post(
        f"{api_endpoint}/api/run_attack",
        json=payload,
        headers={"Content-Type": "application/json"},
        timeout=timeout,
    )

    # Check for HTTP errors
    response.raise_for_status()

    # Parse the response
    result = response.json()

    # Extract data based on actual API structure
    # API returns: {session_id: "...", results: {results: [...], run_id: "...", lowest_score: ...}}
    results_data = result.get("results", {})

    # Return structured response matching actual API
    return {
        "success": results_data.get("success_detected"),
        "results": results_data.get("results", []),
        "full_result": result,
        "lowest_score": results_data.get("lowest_score"),
    }
