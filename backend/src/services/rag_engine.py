import os
import time
from langchain_pinecone import PineconeVectorStore
from langchain_community.embeddings import HuggingFaceEmbeddings, HuggingFaceInferenceAPIEmbeddings
from src.core.config import settings

class RobustHFEmbeddings(HuggingFaceInferenceAPIEmbeddings):
    """Wraps HuggingFace API to safely retry on rate limits or model loading (preventing KeyError)."""
    def embed_query(self, text: str) -> list[float]:
        last_exception = None
        for attempt in range(5):
            try:
                return super().embed_query(text)
            except Exception as e:
                last_exception = e
                print(f"HF API rate-limited or model loading. Waiting 15s... (Attempt {attempt + 1}/5) - {e}")
                time.sleep(15)
        raise last_exception or Exception("Failed to embed query after 5 attempts")
            
    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        last_exception = None
        for attempt in range(5):
            try:
                result = super().embed_documents(texts)
                if isinstance(result, dict) and "error" in result:
                    raise Exception(result["error"])
                return result
            except Exception as e:
                last_exception = e
                print(f"HF API rate-limited or model loading. Waiting 15s... (Attempt {attempt + 1}/5) - {e}")
                time.sleep(15)
        raise last_exception or Exception("Failed to embed documents after 5 attempts")

def download_embedding_model():
    # embeddings = HuggingFaceEmbeddings(
    #     model_name="BAAI/bge-large-en-v1.5", 
    #     encode_kwargs={'normalize_embeddings': True}
    # )
    # return embeddings
    return RobustHFEmbeddings(
        api_key=settings.HUGGINGFACE_TOKEN, 
        model_name="BAAI/bge-large-en-v1.5",
        api_url="https://router.huggingface.co/hf-inference/models/BAAI/bge-large-en-v1.5"
        )
                                                                     
embeddings = download_embedding_model()
                                                                                             
vectorstore = PineconeVectorStore(
    index_name=settings.PINECONE_INDEX_NAME,
    embedding=embeddings,
    pinecone_api_key=settings.PINECONE_API_KEY
)