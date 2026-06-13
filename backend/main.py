from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from ingest import ingest_pdf
from query import answer_question

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class QuestionRequest(BaseModel):
    question: str

@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    contents = await file.read()
    num_chunks = ingest_pdf(contents, file.filename)
    return {"message": f"PDF uploaded successfully! Created {num_chunks} chunks."}

@app.post("/ask")
async def ask_question(request: QuestionRequest):
    answer = answer_question(request.question)
    return {"answer": answer}

@app.get("/")
def root():
    return {"status": "PDF Chatbot backend is running!"}