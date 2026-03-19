from typing import Annotated, Literal
from typing_extensions import TypedDict

from langchain_groq import ChatGroq
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.checkpoint.memory import MemorySaver
from langgraph.prebuilt import ToolNode

from src.core.config import settings
from src.services.tools import toolkit
from src.prompts import system_prompt

# Initialize the LLM
llm = ChatGroq(
    model_name=settings.llm,
    groq_api_key=settings.GROQ_API_KEY,
    temperature=0.1
)

# Initialize the memory
memory = MemorySaver()

#define state
class State(TypedDict):
    #nadd_messages ensures new messages are appended to the list not overwritten
    messages: Annotated[list, add_messages]
    summary: str

#Define nodes
def call_model(state: State):
    """
    The "brain" node: decides what to do next.
    """
    messages = state["messages"]
    #add summary if present
    if state.get("summary"):
        system_msg = f"{system_prompt}\n\nExisting Summary of conversation: {state['summary']}"
    else:
        system_msg = system_prompt

    #call the model
    response = llm.bind_tools(toolkit).invoke([("system", system_msg)] + messages)
    return {"messages": [response]}

def summarize_conversation(state: State):
    """
    Summarize the conversation to save tokens.
    """
    messages = state['messages']

    summary_msg = f"Summarize the key discussions so far: {state.get('summary', 'No summary yet')}"
    response = llm.invoke([("system", summary_msg)] + messages)

    return {"summary": response.content, "messages": messages[-2:]}

# Initialize the graph
workflow = StateGraph(State)

# Add nodes
workflow.add_node("agent", call_model)
workflow.add_node("tools", ToolNode(toolkit))
workflow.add_node("summarizer", summarize_conversation)

# Add edges
workflow.add_edge(START, "agent")

def should_continue(state: State) -> Literal["tools", "summarizer", END]:
    """
    Logic to router between tools, summary or finishing.
    """
    last_message = state["messages"][-1]
    
    if last_message.tool_calls:
        return "tools"
    #if conversation long (> 6 messages), go to sumarize
    if len(state["messages"]) > 6:
        return "summarizer"
    
    return END

# Add edges
workflow.add_conditional_edges("agent", should_continue)
workflow.add_edge("tools", "agent")
workflow.add_edge("summarizer", END)

# Compile the graph
agent_executor = workflow.compile(
    checkpointer=memory
)