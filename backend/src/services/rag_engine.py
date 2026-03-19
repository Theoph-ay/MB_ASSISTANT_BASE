import os
import time
from langchain_pinecone import PineconeVectorStore
from langchain_community.embeddings import HuggingFaceInferenceAPIEmbeddings
from src.core.config import settings

class RobustHFEmbeddings(HuggingFaceInferenceAPIEmbeddings):
    """Wraps HuggingFace API to safely retry on rate limits or model loading (preventing KeyError)."""
    def embed_query(self, text: str) -> list[float]:
        try:
            return super().embed_query(text)
        except Exception:
            print("HF API rate-limited or model loading. Waiting 10s...")
            time.sleep(10)
            return super().embed_query(text)
            
    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        try:
            return super().embed_documents(texts)
        except Exception:
            print("HF API rate-limited or model loading. Waiting 10s...")
            time.sleep(10)
            return super().embed_documents(texts)

def get_embeddings():
    """Initializes the BGE model via API with robust retry logic for Railway deployment."""
    return RobustHFEmbeddings(
        api_key=settings.HUGGINGFACE_TOKEN, 
        model_name="BAAI/bge-large-en-v1.5"
    )

embeddings = get_embeddings()

vectorstore = PineconeVectorStore(
    index_name=settings.PINECONE_INDEX_NAME,
    embedding=embeddings,
    pinecone_api_key=settings.PINECONE_API_KEY
)
