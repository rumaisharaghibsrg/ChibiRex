"""Pembuat model Strands sesuai CHIBIREX_LLM_PROVIDER. Dipakai agent dan skrip cek."""

from agent import config


def nama_model() -> str:
    if config.LLM_PROVIDER == "ollama":
        return f"Ollama {config.OLLAMA_MODEL} ({config.OLLAMA_HOST})"
    return f"Bedrock {config.BEDROCK_MODEL_ID} ({config.BEDROCK_REGION})"


def buat_model():
    if config.LLM_PROVIDER == "ollama":
        from strands.models.ollama import OllamaModel

        return OllamaModel(
            config.OLLAMA_HOST,
            model_id=config.OLLAMA_MODEL,
            temperature=0.2,
            options={"num_ctx": config.OLLAMA_NUM_CTX},
            additional_args={"think": config.OLLAMA_THINK},
        )
    if config.LLM_PROVIDER == "bedrock":
        from strands.models import BedrockModel

        return BedrockModel(model_id=config.BEDROCK_MODEL_ID, region_name=config.BEDROCK_REGION, temperature=0.2)
    raise ValueError(f"CHIBIREX_LLM_PROVIDER tidak dikenal: {config.LLM_PROVIDER!r} (pilih 'ollama' atau 'bedrock')")
