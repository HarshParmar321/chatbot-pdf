from langchain_groq import ChatGroq
from sentence_transformers import SentenceTransformer
from supabase import create_client
from dotenv import load_dotenv
import os
import re

load_dotenv()

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
model = SentenceTransformer("all-MiniLM-L6-v2")
llm = ChatGroq(
    model="llama-3.3-70b-versatile",
    api_key=os.getenv("GROQ_API_KEY"),
    temperature=0.2,
)

# Patterns that indicate the user wants a broad overview/summary of the
# whole document rather than a specific fact. Covers English + Hindi/Hinglish.
OVERVIEW_PATTERNS = [
    r"what'?s in (the )?(this )?(pdf|document|doc|file)",
    r"what is (in|inside) (the )?(this )?(pdf|document|doc|file)",
    r"summari[sz]e",
    r"summary",
    r"overview",
    r"what (is|does) (the )?(this )?(pdf|document|doc|file)( say| contain| about)?",
    r"tell me about (the )?(this )?(pdf|document|doc|file)",
    r"pdf (me|mein) kya hai",
    r"document (me|mein) kya hai",
    r"is (pdf|document) (me|mein) kya likha hai",
    r"kya likha hai",
    r"explain (the )?(this )?(pdf|document|doc|file)",
]


def is_overview_question(question: str) -> bool:
    q = question.strip().lower()
    return any(re.search(pattern, q) for pattern in OVERVIEW_PATTERNS)


def get_overview_chunks(question_embedding):
    """
    For broad/meta questions, combine:
    - top similarity matches (in case the question has some specific angle)
    - a spread of chunks across the whole document (first, middle, last)
    so the model has a representative picture of the entire document.
    """
    sim_result = supabase.rpc("match_documents", {
        "query_embedding": question_embedding,
        "match_count": 6
    }).execute()
    sim_chunks = [doc["content"] for doc in sim_result.data]

    try:
        all_result = (
            supabase.table("documents")
            .select("content")
            .order("id")
            .execute()
        )
        all_chunks = [row["content"] for row in all_result.data]
    except Exception:
        all_chunks = []

    spread_chunks = []
    if all_chunks:
        n = len(all_chunks)
        if n <= 6:
            spread_chunks = all_chunks
        else:
            indices = sorted(set([0, 1, n // 2 - 1, n // 2, n - 2, n - 1]))
            spread_chunks = [all_chunks[i] for i in indices if 0 <= i < n]

    seen = set()
    merged = []
    for chunk in spread_chunks + sim_chunks:
        if chunk not in seen:
            seen.add(chunk)
            merged.append(chunk)

    return merged


def answer_question(question: str):
    question_embedding = model.encode(question).tolist()

    if is_overview_question(question):
        chunks = get_overview_chunks(question_embedding)
    else:
        result = supabase.rpc("match_documents", {
            "query_embedding": question_embedding,
            "match_count": 12
        }).execute()
        chunks = [doc["content"] for doc in result.data]

    context = "\n\n".join(chunks)

    prompt = f"""You are a professional, knowledgeable assistant helping the user understand a document AND any topics, tools, or terms mentioned within it.

DOCUMENT CONTENT:
{context}

USER QUESTION:
{question}

HOW TO ANSWER — read carefully and pick the right mode:

MODE A — Fact lookup: If the question asks for a specific fact stated in the document (name, date, salary, requirement, etc.), extract it precisely and state it plainly in 1-2 sentences.

MODE B — Overview/summary: If the question asks generally what the document is about ("what's in this pdf", "summarize", "pdf me kya hai"), give a brief, well-organized summary of its purpose and key sections in 3-5 sentences.

MODE C — Reasoning/judgment: If the question requires evaluation, comparison, or opinion ("is this a good offer", "which is better", "pros and cons"), use facts from the document to form a grounded, confident view, referencing specific details that support it.

MODE D — Concept explanation: If the question asks "what is X" / "what does X mean" / "why do we use X" / "tell me about X" for a tool, technology, skill, or term that is MENTIONED in the document (even just as a keyword, e.g. a skill requirement, technology name, or section heading) — explain X using your own general knowledge (what it is, what it's used for), THEN briefly connect it to how/why it's relevant in this document's context. Do not refuse just because the document doesn't define the term itself — mentioning it is enough to answer about it.

MODE E — Truly unrelated: ONLY if the question has absolutely no connection to anything in the document (the term/topic doesn't appear anywhere and isn't implied by the document's subject matter) — say so briefly, and mention what the document IS about instead.

GENERAL STYLE RULES (apply to all modes):
- Concise, professional, report-style. No filler like "Based on the context" or "According to the document" — answer directly.
- SYNTHESIZE in your own words. Do not copy-paste bullet structure or phrasing from the document.
- Use bullet points only when the question asks for a list or when 3+ distinct items genuinely improve clarity — keep each bullet short and rewritten.
- Never fabricate document-specific facts (numbers, names, dates) that aren't present. General knowledge explanations (Mode D) are fine and expected.
- If the question is in Hindi or Hinglish, respond in the same language/style.
- Avoid repetition, hedging, or restating the question.

ANSWER:"""

    response = llm.invoke(prompt)
    return response.content