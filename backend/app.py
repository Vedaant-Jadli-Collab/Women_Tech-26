from src.data_loader import load_all_documents
from src.embedding import EmbeddingPipeline
from src.vectorstore import FaissVectorStore
from src.search import RAGSearch

# example usage
if __name__ == "__main__":
    docs = load_all_documents('data/pdf')
    #chunks=EmbeddingPipeline().chunk_documents(docs)
    store = FaissVectorStore("faiss_store")
    
    #store.build_from_documents(docs)

    store.load()

    #print(store.query("What does COUNT(*) return in the Exact engine?",top_k=3))

    rag_search = RAGSearch()

    query = 'What is COUNT(*)?'
    summary = rag_search.search_and_summarize(query,top_k=3)
    print("Summary:",summary)


