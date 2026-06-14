from langchain_groq import ChatGroq
from sentence_transformers import SentenceTransformer
from supabase import create_client
from dotenv import load_dotenv
import os
import re
import time

load_dotenv()

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
model = SentenceTransformer("all-MiniLM-L6-v2")
llm = ChatGroq(
    model="llama-3.3-70b-versatile",
    api_key=os.getenv("GROQ_API_KEY"),
    temperature=0.2,
)

DEVANAGARI_PATTERN = re.compile(r"[\u0900-\u097F]")


def answer_question(question: str):
    t0 = time.time()

    question_embedding = model.encode(question).tolist()
    t1 = time.time()

    result = supabase.rpc("match_documents", {
        "query_embedding": question_embedding,
        "match_count": 12
    }).execute()
    t2 = time.time()

    chunks = [doc["content"] for doc in result.data]
    context = "\n\n".join(chunks)

    is_hindi = bool(DEVANAGARI_PATTERN.search(question))
    language_instruction = (
        "Respond in Hindi (Devanagari script), matching the user's language."
        if is_hindi
        else "Respond in English, regardless of the document's language."
    )

    prompt = f"""You are a professional, knowledgeable assistant helping the user understand a document AND any topics, tools, or terms mentioned within it.

DOCUMENT CONTENT:
{context}

USER QUESTION:
{question}

HOW TO ANSWER — pick the right mode:

MODE A — Fact lookup: If the question asks for a specific fact stated in the document, extract it precisely in 1-2 sentences.

MODE B — Overview/summary: If the question asks generally what the document is about, give a brief summary of its purpose and key sections in 3-5 sentences.

MODE C — Reasoning/judgment: If the question requires evaluation, comparison, or opinion, use facts from the document to form a grounded, confident view, referencing specific details.

MODE D — Concept explanation: If the question asks "what is X" / "who made X" / "why do we use X" for a tool, technology, or term MENTIONED in the document (even just as a keyword or skill requirement) — explain X using your own general knowledge, then briefly connect it to the document's context. Do not refuse just because the document doesn't define the term itself.

MODE E — Truly unrelated: ONLY if the question has zero connection to the document's topic — say so briefly and mention what the document IS about instead.

MODE F — Casual/social (e.g. "thanks", "ok", "hello"): Respond briefly and naturally, like a normal conversation. Do not force document context into casual replies.

STYLE RULES:
- Concise, professional. No filler like "Based on the context" or "According to the document".
- SYNTHESIZE in your own words — do not copy bullet structure from the document.
- Use bullets only for genuine lists of 3+ items.
- Never fabricate document-specific facts not present in the context.
- {language_instruction}
- Avoid repetition and hedging.

ANSWER:"""

    t3 = time.time()
    response = llm.invoke(prompt)
    t4 = time.time()

    print(f"[TIMING] embed={t1-t0:.2f}s supabase={t2-t1:.2f}s groq={t4-t3:.2f}s total={t4-t0:.2f}s")

    return response.content