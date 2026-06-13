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

     # Clear previous PDF data
    supabase.table("documents").delete().neq("id", 0).execute()
    
    # Save PDF temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name

    # Load and chunk the PDF
    loader = PyPDFLoader(tmp_path)
    documents = loader.load()

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=50
    )
    chunks = splitter.split_documents(documents)

    # Embed each chunk and store in Supabase
    for chunk in chunks:
        embedding = model.encode(chunk.page_content).tolist()
        supabase.table("documents").insert({
            "content": chunk.page_content,
            "embedding": embedding,
            "metadata": {"source": filename}
        }).execute()

    os.unlink(tmp_path)
    return len(chunks)