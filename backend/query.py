from langchain_groq import ChatGroq
from sentence_transformers import SentenceTransformer
from supabase import create_client
from dotenv import load_dotenv
import os

load_dotenv()

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
model = SentenceTransformer("all-MiniLM-L6-v2")
llm = ChatGroq(model="llama-3.3-70b-versatile", api_key=os.getenv("GROQ_API_KEY"))

def answer_question(question: str):
    # Embed the question
    question_embedding = model.encode(question).tolist()

    # Find similar chunks from Supabase
    result = supabase.rpc("match_documents", {
        "query_embedding": question_embedding,
        "match_count": 10
    }).execute()

    # Build context from matched chunks
    context = "\n\n".join([doc["content"] for doc in result.data])

    # Ask Groq with context
    prompt = f"""You are a helpful assistant. Answer the question based only on the context below.

    INSTRUCTIONS:
- Answer clearly and in detail based on the context below
- Use bullet points or numbered lists where appropriate
- If the answer is not in the context, say "I couldn't find that in the document"
- Never make up information that isn't in the context
- Be specific and extract exact details from the context
    
Context:
{context}

Question: {question}

Answer:"""

    response = llm.invoke(prompt)
    return response.content