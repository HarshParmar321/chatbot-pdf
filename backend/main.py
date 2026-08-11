from fastapi import FastAPI, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
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
}


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
    })

    background_tasks.add_task(process_pdf_bg, contents, filename)

    return JSONResponse({
        "message": f'"{filename}" upload received and is being processed.'
    }, status_code=202)


def process_pdf_bg(file_bytes: bytes, filename: str):
    try:
        from ingest import ingest_pdf
        num_chunks = ingest_pdf(file_bytes, filename)
        if num_chunks == 0:
            raise ValueError("No readable text was found in this PDF")
        processing_status.update({
            "ready": True,
            "processing": False,
            "error": None,
        })
        print(f"[UPLOAD] '{filename}' processed: {num_chunks} chunks ready")
    except Exception as e:
        processing_status.update({
            "ready": False,
            "processing": False,
            "error": str(e),
        })
        print(f"[UPLOAD] '{filename}' FAILED: {e}")


@app.get("/status")
async def status():
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