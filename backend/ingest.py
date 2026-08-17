from langchain_text_splitters import RecursiveCharacterTextSplitter
from supabase import create_client
from dotenv import load_dotenv
from embeddings import encode_texts
import pymupdf
import os
import time

load_dotenv()

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

_ocr_engine = None
BATCH_SIZE = 50


def get_ocr_engine():
    global _ocr_engine
    if _ocr_engine is None:
        from rapidocr_onnxruntime import RapidOCR
        _ocr_engine = RapidOCR()
    return _ocr_engine


def extract_text_from_pdf(
    file_bytes: bytes, filename: str, progress_callback=None
) -> tuple[str, int]:
    """
    Extracts text from PDF bytes using a hybrid approach:
    1. Direct digital text extraction via PyMuPDF.
    2. Fallback to RapidOCR for scanned/image pages with sparse text (< 50 chars).
    """
    doc = pymupdf.open(stream=file_bytes, filetype="pdf")
    total_pages = len(doc)
    pages_text = []
    ocr_pages_count = 0

    for page_num, page in enumerate(doc, start=1):
        if progress_callback and total_pages > 0:
            extract_percent = int((page_num / total_pages) * 40)
            progress_callback(
                "extracting",
                extract_percent,
                f"Reading page {page_num} of {total_pages}...",
            )

        digital_text = page.get_text().strip()

        # If page has sufficient digital text, use it directly
        if len(digital_text) >= 50:
            pages_text.append(digital_text)
            continue

        # Otherwise, run OCR on the rendered page
        print(f"[OCR] Page {page_num}/{total_pages} in '{filename}' has sparse text ({len(digital_text)} chars). Running OCR...")
        if progress_callback:
            progress_callback(
                "extracting",
                int((page_num / total_pages) * 40),
                f"Scanning page {page_num} of {total_pages} with OCR...",
            )

        ocr_engine = get_ocr_engine()
        pix = page.get_pixmap(dpi=150)
        ocr_res, _ = ocr_engine(pix.tobytes())

        ocr_text = ""
        if ocr_res:
            ocr_text = "\n".join(
                [line[1] for line in ocr_res if line and len(line) > 1 and line[1]]
            ).strip()

        if len(ocr_text) > len(digital_text):
            pages_text.append(ocr_text)
            ocr_pages_count += 1
            print(f"[OCR] Page {page_num}: extracted {len(ocr_text.split())} words via OCR")
        elif digital_text:
            pages_text.append(digital_text)

    full_text = "\n\n".join(pages_text).strip()
    return full_text, ocr_pages_count


def ingest_pdf(file_bytes: bytes, filename: str, progress_callback=None) -> int:
    t0 = time.time()

    if progress_callback:
        progress_callback("clearing", 5, "Preparing storage...")

    # Clear existing documents in Supabase
    supabase.table("documents").delete().neq("id", 0).execute()
    t1 = time.time()

    # Hybrid extraction (digital text + OCR) -> 0% to 40%
    full_text, ocr_count = extract_text_from_pdf(file_bytes, filename, progress_callback)
    t2 = time.time()

    if not full_text:
        return 0

    if progress_callback:
        progress_callback("splitting", 45, "Splitting text into search chunks...")

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1500,
        chunk_overlap=120,
    )
    texts = splitter.split_text(full_text)
    t3 = time.time()

    if not texts:
        return 0

    total_chunks = len(texts)
    print(f"[INGEST] Total chunks to embed: {total_chunks}")

    # Process embeddings and database insertion in batches of BATCH_SIZE (50) -> 50% to 95%
    for i in range(0, total_chunks, BATCH_SIZE):
        batch = texts[i : i + BATCH_SIZE]
        batch_embeddings = encode_texts(batch)

        batch_rows = [
            {
                "content": text,
                "embedding": embedding,
                "metadata": {"source": filename},
            }
            for text, embedding in zip(batch, batch_embeddings)
        ]

        supabase.table("documents").insert(batch_rows).execute()

        processed_count = min(i + len(batch), total_chunks)
        embed_percent = 50 + int((processed_count / total_chunks) * 45)

        if progress_callback:
            progress_callback(
                "embedding",
                embed_percent,
                f"Indexing chunk {processed_count} of {total_chunks}...",
            )

        del batch_embeddings
        del batch_rows

    t5 = time.time()

    if progress_callback:
        progress_callback("completed", 100, f"Ready! {total_chunks} chunks indexed.")

    print(
        f"[INGEST] clear={t1 - t0:.1f}s extract={t2 - t1:.1f}s (ocr_pages={ocr_count}) "
        f"split={t3 - t2:.1f}s embed+save={t5 - t3:.1f}s total={t5 - t0:.1f}s chunks={total_chunks}"
    )

    return total_chunks
