"""
AIM-Stinger Attack Node - Multi-turn jailbreak attack via external API
Executes coordinated attacks using attacker LLM against target models
"""

from typing import Dict, Any
import json


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

    try:
        import requests
    except ImportError:
        return {
            "success": False,
            "session_id": None,
            "results": None,
            "run_id": None,
            "lowest_score": None,
            "error": "requests library not available. Please install: pip install requests"
        }

    # Validate required inputs
    if not base_query:
        return {
            "success": False,
            "session_id": None,
            "results": None,
            "run_id": None,
            "lowest_score": None,
            "error": "base_query is required"
        }

    if not api_key and "openai" in target_endpoint.lower():
        return {
            "success": False,
            "session_id": None,
            "results": None,
            "run_id": None,
            "lowest_score": None,
            "error": f"api_key is required for OpenAI models (endpoint: {target_endpoint})"
        }

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

    # Execute the attack
    try:
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

        # Log the raw response for debugging
        print(f"[AIM-Stinger] Raw API response keys: {list(result.keys())}")

        # Extract data based on actual API structure
        # API returns: {session_id: "...", results: {results: [...], run_id: "...", lowest_score: ...}}
        results_data = result.get("results", {})
        
        # Return structured response matching actual API
        return {
            "success": True,
            "session_id": result.get("session_id"),
            "results": results_data.get("results", []),  # Array of turn results
            "run_id": results_data.get("run_id"),
            "lowest_score": results_data.get("lowest_score"),
            "error": None
        }

    except requests.exceptions.Timeout:
        return {
            "success": False,
            "session_id": None,
            "results": None,
            "run_id": None,
            "lowest_score": None,
            "error": f"Request timed out after {timeout} seconds (query: {base_query[:50]}...)"
        }
    except requests.exceptions.HTTPError as e:
        return {
            "success": False,
            "session_id": None,
            "results": None,
            "run_id": None,
            "lowest_score": None,
            "error": f"HTTP error: {e.response.status_code} - {e.response.text[:200]}"
        }
    except requests.exceptions.ConnectionError:
        return {
            "success": False,
            "session_id": None,
            "results": None,
            "run_id": None,
            "lowest_score": None,
            "error": f"Failed to connect to {api_endpoint}"
        }
    except requests.exceptions.RequestException as e:
        return {
            "success": False,
            "session_id": None,
            "results": None,
            "run_id": None,
            "lowest_score": None,
            "error": f"Request failed: {str(e)}"
        }
    except json.JSONDecodeError as e:
        return {
            "success": False,
            "session_id": None,
            "results": None,
            "run_id": None,
            "lowest_score": None,
            "error": f"Failed to parse API response: {str(e)}"
        }
    except Exception as e:
        return {
            "success": False,
            "session_id": None,
            "results": None,
            "run_id": None,
            "lowest_score": None,
            "error": f"Unexpected error: {str(e)}"
        }
