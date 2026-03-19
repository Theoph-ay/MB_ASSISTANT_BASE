#Langchain tools
from langchain_core.tools import tool
from langchain_community.tools import DuckDuckGoSearchRun
from langchain_community.utilities.pubmed import PubMedAPIWrapper
from langchain_community.tools.pubmed.tool import PubmedQueryRun

#Pydantic
from pydantic import BaseModel, Field

#Internal imports
from src.schemas.chat import DiseaseInput, QuizInput
from src.services.rag_engine import vectorstore


#Pubmed Custom Wrapper
pubmed_wrapper = PubMedAPIWrapper(
    top_k_results=2,
    doc_content_chars_max=3000
)

pubmed_search = PubmedQueryRun(api_wrapper=pubmed_wrapper)


@tool(args_schema=DiseaseInput)
def search_disease_profile(disease_name: str) -> str:
    """
    Use this tool ONLY when the user asks for comprehensive details about a specific DISEASE, SYNDROME, or OBSTETRIC COMPLICATION.
    """
    # Need the query to return a detailed essay for queries on diseases
    q_patho = f"{disease_name} pathophysiology aetiology signs symptoms clinical features"
    q_invest = f"{disease_name} investigations diagnosis labs imaging criteria"
    q_manage = f"{disease_name} management treatment surgery drugs prognosis complications"
    
    # Execute 3 isolated searches (Pulling the top 2 for each category)
    docs_patho = vectorstore.similarity_search(q_patho, k=2)
    docs_invest = vectorstore.similarity_search(q_invest, k=2)
    docs_manage = vectorstore.similarity_search(q_manage, k=2)
    
    # 3. Combine the results
    all_docs = docs_patho + docs_invest + docs_manage
    
    # 4. Deduplicate (In case the same chunk scored high in multiple queries)
    unique_docs = {doc.page_content: doc for doc in all_docs}.values()
    
    if not unique_docs:
        return "NO_DATA_FOUND"
    
    #To add source and page number to returned documents
    formatted_chunks = []

    for d in unique_docs:

        source_file = d.metadata.get("source", "Unknown_File")

        page_num = d.metadata.get("page")
        page_string = f", Page: {page_num}" if page_num else ""

        chunk_text = f"[SOURCE: {source_file}{page_string}]\n{d.page_content}"
        formatted_chunks.append(chunk_text)

    return "\n\n".join(formatted_chunks)

@tool
def search_general_medical_fact(query: str) -> str:
    """
    Use this tool FIRST for general medical questions, statistics, anatomical facts, or single data points (e.g., 'commonest cause of childhood cancer', 'normal fetal heart rate').
    """
    docs = vectorstore.similarity_search(query, k=6)
    
    if not docs:
        return "NO_DATA_FOUND"
    
    # To return source and page if present
    formatted_chunks = []
    for d in docs:

        source_file = d.metadata.get("source", "Unknown_File")

        page_num = d.metadata.get("page")
        page_string = f", Page: {page_num}" if page_num else ""

        chunk_text = f"[SOURCE: {source_file}{page_string}]\n{d.page_content}"
        formatted_chunks.append(chunk_text)

    return "\n\n".join(formatted_chunks)


#internet search too
ddg_search = DuckDuckGoSearchRun()

@tool
def search_internet(query: str) -> str:
    """
    Use this ONLY if the mbbs_database lacks the answer, or if the user asks for
    recent news, current guidelines, or non-medical facts.
    """
    return ddg_search.invoke(query)


@tool(args_schema=QuizInput)
def generate_clinical_quiz(topic: str, num: int) -> str:
    """
    Use this when the user explicitly asks to be tested, quizzed, or wants practice questions on an MB3 topic.
    """
    #Use one of the tiils above to retuen context
    context = search_disease_profile.invoke({"disease_name": topic})

    if context == "NO_DATA_FOUND":
        return "INSTRUCTION TO AGENT: Tell the user you cannot generate a quiz because the topic is not in the verified MB3 database."
    return f"Generate {num} difficult, MB3-board-level multiple choice questions based strictly on this verified data. Provide the correct answers and brief rationales at the end:\n\n{context}"


toolkit = [
    search_disease_profile, 
    search_general_medical_fact, 
    search_internet, 
    generate_clinical_quiz, 
    pubmed_search
    ]