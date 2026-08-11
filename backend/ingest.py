from langchain_text_splitters import RecursiveCharacterTextSplitter
from supabase import create_client
from dotenv import load_dotenv
from embeddings import encode_texts
from pypdf import PdfReader
import os
import tempfile
import time

load_dotenv()

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))


def ingest_pdf(file_bytes: bytes, filename: str):
    t0 = time.time()

    supabase.table("documents").delete().neq("id", 0).execute()
    t1 = time.time()

    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name

    try:
        reader = PdfReader(tmp_path)
        pages = [page.extract_text() or "" for page in reader.pages]
        full_text = "\n".join(pages).strip()
        t2 = time.time()

        if not full_text:
            return 0

        splitter = RecursiveCharacterTextSplitter(
            chunk_size=1500,
            chunk_overlap=120,
        )
        texts = splitter.split_text(full_text)
        t3 = time.time()

        if not texts:
            return 0

        embeddings = encode_texts(texts)
        t4 = time.time()

        rows = [
            {
                "content": text,
                "embedding": embedding,
                "metadata": {"source": filename},
            }
            for text, embedding in zip(texts, embeddings)
        ]

        for i in range(0, len(rows), 200):
            supabase.table("documents").insert(rows[i : i + 200]).execute()
        t5 = time.time()

        print(
            f"[INGEST] clear={t1 - t0:.1f}s read={t2 - t1:.1f}s "
            f"split={t3 - t2:.1f}s embed={t4 - t3:.1f}s "
            f"save={t5 - t4:.1f}s total={t5 - t0:.1f}s chunks={len(texts)}"
        )

        return len(texts)
    finally:
        os.unlink(tmp_path)
