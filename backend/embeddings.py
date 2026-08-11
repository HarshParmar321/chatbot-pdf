from fastembed import TextEmbedding

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
_model = None


def get_embedding_model() -> TextEmbedding:
    global _model
    if _model is None:
        print(f"[EMBED] Loading {MODEL_NAME}...")
        _model = TextEmbedding(model_name=MODEL_NAME)
        print("[EMBED] Model ready")
    return _model


def encode_texts(texts: list[str]) -> list[list[float]]:
    model = get_embedding_model()
    return [vector.tolist() for vector in model.embed(texts)]


def encode_query(text: str) -> list[float]:
    model = get_embedding_model()
    return next(model.embed([text])).tolist()
