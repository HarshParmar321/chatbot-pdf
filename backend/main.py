from fastapi import FastAPI, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from contextlib import asynccontextmanager
import time

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Preload the embedding model once at startup so uploads don't hang
    # on a cold model load inside the background task.
    from embeddings import get_embedding_model
    get_embedding_model()
    yield


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class QuestionRequest(BaseModel):
    question: str


# In-memory processing state for the single active document.
processing_status = {
    "ready": False,
    "processing": False,
    "filename": None,
    "error": None,
    "started_at": None,
    "stage": None,
    "progress": 0,
    "detail": None,
}

PROCESSING_TIMEOUT_SECONDS = 600


@app.post("/upload")
async def upload_pdf(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    filename = file.filename or ""
    if not filename.lower().endswith(".pdf"):
        return JSONResponse({"error": "Only PDF files allowed"}, status_code=400)

    contents = await file.read()
    if not contents:
        return JSONResponse({"error": "The uploaded PDF is empty"}, status_code=400)

    processing_status.update({
        "ready": False,
        "processing": True,
        "filename": filename,
        "error": None,
        "started_at": time.time(),
        "stage": "starting",
        "progress": 0,
        "detail": "Upload received, starting processing...",
    })

    background_tasks.add_task(process_pdf_bg, contents, filename)

    return JSONResponse({
        "message": f'"{filename}" upload received and is being processed.'
    }, status_code=202)


def process_pdf_bg(file_bytes: bytes, filename: str):
    def on_progress(stage: str, percent: int, detail: str):
        processing_status.update({
            "stage": stage,
            "progress": percent,
            "detail": detail,
        })

    try:
        from ingest import ingest_pdf
        num_chunks = ingest_pdf(file_bytes, filename, progress_callback=on_progress)
        if num_chunks == 0:
            raise ValueError("No readable text was found in this PDF")
        processing_status.update({
            "ready": True,
            "processing": False,
            "error": None,
            "started_at": None,
            "stage": "completed",
            "progress": 100,
            "detail": f"Ready! {num_chunks} chunks indexed.",
        })
        print(f"[UPLOAD] '{filename}' processed: {num_chunks} chunks ready")
    except Exception as e:
        processing_status.update({
            "ready": False,
            "processing": False,
            "error": str(e),
            "started_at": None,
            "stage": "error",
            "detail": f"Failed: {str(e)}",
        })
        print(f"[UPLOAD] '{filename}' FAILED: {e}")


@app.get("/status")
async def status():
    if (
        processing_status["processing"]
        and processing_status["started_at"]
        and time.time() - processing_status["started_at"] > PROCESSING_TIMEOUT_SECONDS
    ):
        processing_status.update({
            "ready": False,
            "processing": False,
            "error": (
                "PDF processing timed out on the server. "
                "The embedding model may be out of memory on the free hosting tier — "
                "try again after the server restarts, or redeploy with more RAM."
            ),
            "started_at": None,
            "stage": "timeout",
        })
    return processing_status


@app.post("/ask")
async def ask_question(request: QuestionRequest):
    if not processing_status["ready"]:
        return JSONResponse({
            "answer": "Your PDF is still being processed — please wait a few seconds and try again."
        })

    from query import answer_question
    answer = answer_question(request.question)
    return {"answer": answer}


@app.get("/")
def root():
    return {"status": "PDF Chatbot backend is running!"}


@app.get("/health")
def health():
    return {"status": "ok"}
