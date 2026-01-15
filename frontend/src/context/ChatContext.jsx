import { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import { fetchOpenTrades } from '../services/intentHandlers';

// Initial state
const initialState = {
  messages: [],
  isLoading: false,
  pendingImage: null,
  openTrades: [],
  error: null
};

// Action types
const ACTIONS = {
  ADD_MESSAGE: 'ADD_MESSAGE',
  SET_LOADING: 'SET_LOADING',
  SET_IMAGE: 'SET_IMAGE',
  CLEAR_IMAGE: 'CLEAR_IMAGE',
  SET_OPEN_TRADES: 'SET_OPEN_TRADES',
  SET_ERROR: 'SET_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR'
};

// Reducer
function chatReducer(state, action) {
  switch (action.type) {
    case ACTIONS.ADD_MESSAGE:
      return {
        ...state,
        messages: [...state.messages, action.payload]
      };
    case ACTIONS.SET_LOADING:
      return { ...state, isLoading: action.payload };
    case ACTIONS.SET_IMAGE:
      return { ...state, pendingImage: action.payload };
    case ACTIONS.CLEAR_IMAGE:
      return { ...state, pendingImage: null };
    case ACTIONS.SET_OPEN_TRADES:
      return { ...state, openTrades: action.payload };
    case ACTIONS.SET_ERROR:
      return { ...state, error: action.payload };
    case ACTIONS.CLEAR_ERROR:
      return { ...state, error: null };
    default:
      return state;
  }
}

// Create context
const ChatContext = createContext(null);

// Provider component
export function ChatProvider({ children }) {
  const [state, dispatch] = useReducer(chatReducer, initialState);

  // Load open trades on mount
  useEffect(() => {
    loadOpenTrades();
  }, []);

  const loadOpenTrades = async () => {
    try {
      const trades = await fetchOpenTrades();
      dispatch({ type: ACTIONS.SET_OPEN_TRADES, payload: trades });
    } catch (error) {
      console.error('Failed to load open trades:', error);
    }
  };

  const addMessage = useCallback((role, content, attachments = null) => {
    const message = {
      id: Date.now(),
      role,
      content,
      attachments,
      timestamp: new Date().toISOString()
    };
    dispatch({ type: ACTIONS.ADD_MESSAGE, payload: message });
    return message;
  }, []);

  const setLoading = useCallback((loading) => {
    dispatch({ type: ACTIONS.SET_LOADING, payload: loading });
  }, []);

  const setImage = useCallback((imageData) => {
    dispatch({ type: ACTIONS.SET_IMAGE, payload: imageData });
  }, []);

  const clearImage = useCallback(() => {
    dispatch({ type: ACTIONS.CLEAR_IMAGE });
  }, []);

  const setError = useCallback((error) => {
    dispatch({ type: ACTIONS.SET_ERROR, payload: error });
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: ACTIONS.CLEAR_ERROR });
  }, []);

  const refreshOpenTrades = useCallback(async () => {
    await loadOpenTrades();
  }, []);

  const value = {
    ...state,
    addMessage,
    setLoading,
    setImage,
    clearImage,
    setError,
    clearError,
    refreshOpenTrades
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
}

// Custom hook to use chat context
export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}

export default ChatContext;
