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


# Simple in-memory flag: is a document ready to be queried?
processing_status = {"ready": False, "filename": None}


@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...), background_tasks: BackgroundTasks = None):
    if not file.filename.lower().endswith(".pdf"):
        return JSONResponse({"error": "Only PDF files allowed"}, status_code=400)

    contents = await file.read()

    processing_status["ready"] = False
    processing_status["filename"] = file.filename

    background_tasks.add_task(process_pdf_bg, contents, file.filename)

    return JSONResponse({
        "message": f'"{file.filename}" upload received! Processing in the background — give it ~20-40 seconds before asking questions.'
    }, status_code=202)


def process_pdf_bg(file_bytes: bytes, filename: str):
    try:
        from ingest import ingest_pdf
        num_chunks = ingest_pdf(file_bytes, filename)
        processing_status["ready"] = True
        print(f"[UPLOAD] '{filename}' processed: {num_chunks} chunks ready")
    except Exception as e:
        processing_status["ready"] = False
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