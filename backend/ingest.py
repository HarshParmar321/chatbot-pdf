from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import PyPDFLoader
from sentence_transformers import SentenceTransformer
from supabase import create_client
from dotenv import load_dotenv
import os
import tempfile

load_dotenv()

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
model = SentenceTransformer("all-MiniLM-L6-v2")


def ingest_pdf(file_bytes: bytes, filename: str):
    # Clear previous PDF data FIRST so old chunks can't be queried
    # while the new PDF is still processing.
    supabase.table("documents").delete().neq("id", 0).execute()

    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name

    try:
        loader = PyPDFLoader(tmp_path)
        documents = loader.load()

        splitter = RecursiveCharacterTextSplitter(
            chunk_size=500,
            chunk_overlap=50
        )
        chunks = splitter.split_documents(documents)

        if not chunks:
            return 0

        texts = [chunk.page_content for chunk in chunks]

        # Batch-embed all chunks in one call
        embeddings = model.encode(
            texts,
            batch_size=32,
            show_progress_bar=False,
            convert_to_numpy=True,
        )

        rows = [
            {
                "content": text,
                "embedding": embedding.tolist(),
                "metadata": {"source": filename},
            }
            for text, embedding in zip(texts, embeddings)
        ]

        BATCH_SIZE = 100
        for i in range(0, len(rows), BATCH_SIZE):
            batch = rows[i:i + BATCH_SIZE]
            supabase.table("documents").insert(batch).execute()

        return len(chunks)
    finally:
        os.unlink(tmp_path)