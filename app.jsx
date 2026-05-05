import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Link, NavLink, useParams, useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, Send, MessageSquare, Trash2, Menu, X } from 'lucide-react';
import { marked } from 'marked';
import hljs from 'highlight.js';

const CHATS_STORAGE_KEY = 'ai-chats';
const SYSTEM_PROMPT = 'You are a helpful and concise AI assistant. Your primary goal is to provide accurate and well-structured answers. Format your responses using Markdown, including language-tagged code blocks for any code snippets.';

// --- UTILS & HOOKS ---

function uuidv4() {
  return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
}

const useLocalStorage = (key, defaultValue) => {
  const [value, setValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error(error);
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(error);
    }
  }, [key, value]);

  return [value, setValue];
};

async function streamChat(messages, onDelta) {
  const response = await fetch(window.__AI_ENDPOINT__, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, system: SYSTEM_PROMPT }),
  });
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let boundary;
    while ((boundary = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, boundary).trim();
      buffer = buffer.slice(boundary + 1);
      if (line.startsWith('data:')) {
        const json = line.slice(5).trim();
        if (json === '[DONE]') return;
        try {
          const parsed = JSON.parse(json);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            onDelta(content);
          }
        } catch (error) {
          console.error('Error parsing stream chunk:', error);
        }
      }
    }
  }
}

// --- COMPONENTS ---

const App = () => (
  <BrowserRouter>
    <Layout />
  </BrowserRouter>
);

const Layout = () => {
  const [chats, setChats] = useLocalStorage(CHATS_STORAGE_KEY, {});
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const sortedChats = Object.values(chats).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const createNewChat = () => {
    navigate('/');
    setSidebarOpen(false);
  };

  const deleteChat = (chatId, e) => {
    e.stopPropagation();
    e.preventDefault();
    const { [chatId]: _, ...remainingChats } = chats;
    setChats(remainingChats);
    navigate('/');
  };

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="h-screen w-screen flex bg-background font-mono">
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div 
            initial={{ x: '-100%' }} 
            animate={{ x: 0 }} 
            exit={{ x: '-100%' }} 
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="absolute inset-y-0 left-0 w-64 bg-background border-r border-border z-20 md:hidden"
          >
            <Sidebar chats={sortedChats} createNewChat={createNewChat} deleteChat={deleteChat} />
          </motion.div>
        )}
      </AnimatePresence>
      <div className="hidden md:flex md:w-64 md:flex-shrink-0">
        <Sidebar chats={sortedChats} createNewChat={createNewChat} deleteChat={deleteChat} />
      </div>
      <main className="flex-1 flex flex-col h-full min-w-0">
        <div className="md:hidden p-2 border-b border-border flex items-center">
            <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-md hover:bg-card">
                <Menu size={20} />
            </button>
        </div>
        <Routes>
          <Route path="/" element={<ChatView chats={chats} setChats={setChats} />} />
          <Route path="/c/:chatId" element={<ChatView chats={chats} setChats={setChats} />} />
        </Routes>
      </main>
    </div>
  );
};

const Sidebar = ({ chats, createNewChat, deleteChat }) => (
  <div className="w-full h-full bg-background border-r border-border flex flex-col p-2">
    <button
      onClick={createNewChat}
      className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium rounded-md text-foreground hover:bg-card transition-colors mb-4"
    >
      New Chat
      <Plus size={16} />
    </button>
    <nav className="flex-1 overflow-y-auto -mr-2 pr-2">
      <ul className="space-y-1">
        {chats.map(chat => (
          <li key={chat.id}>
            <NavLink
              to={`/c/${chat.id}`}
              className={({ isActive }) =>
                `group flex items-center justify-between w-full px-3 py-2 text-sm rounded-md transition-colors ${ 
                  isActive ? 'bg-primary text-background font-medium' : 'text-muted hover:bg-card hover:text-foreground'
                }`
              }
            >
              <span className="truncate flex-1">{chat.title || 'New Chat'}</span>
              <button onClick={(e) => deleteChat(chat.id, e)} className="opacity-0 group-hover:opacity-100 text-muted hover:text-foreground p-1 ml-2 transition-opacity">
                <Trash2 size={14} />
              </button>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  </div>
);

const ChatView = ({ chats, setChats }) => {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef(null);

  const currentChat = chatId ? chats[chatId] : null;
  const messages = currentChat ? currentChat.messages : [];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;

    const userInput = input.trim();
    setInput('');

    let newChatId = chatId;
    let newChatCreated = false;

    if (!newChatId) {
        newChatId = uuidv4();
        newChatCreated = true;
    }

    const newUserMessage = { role: 'user', content: userInput };
    const updatedMessages = [...(currentChat?.messages || []), newUserMessage];

    const updatedChat = {
      id: newChatId,
      title: currentChat?.title || userInput.substring(0, 40),
      messages: updatedMessages,
      createdAt: currentChat?.createdAt || Date.now(),
    };

    setChats(prev => ({ ...prev, [newChatId]: updatedChat }));
    if (newChatCreated) {
        navigate(`/c/${newChatId}`);
    }
    
    setIsStreaming(true);
    
    const assistantMessage = { role: 'assistant', content: '' };
    setChats(prev => ({
      ...prev,
      [newChatId]: { ...prev[newChatId], messages: [...updatedMessages, assistantMessage] },
    }));

    await streamChat([...updatedMessages.map(m => ({ role: m.role, content: m.content }))], (delta) => {
      assistantMessage.content += delta;
       setChats(prev => ({
        ...prev,
        [newChatId]: { ...prev[newChatId], messages: [...updatedMessages, { ...assistantMessage }] },
      }));
    });

    setIsStreaming(false);
  };

  if (chatId && !currentChat) {
    return (
        <div className="flex-1 flex items-center justify-center text-center text-muted">
            <div className="space-y-2">
                <h2 className="text-2xl font-display">Chat not found</h2>
                <p>It might have been deleted.</p>
            </div>
        </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {messages.length === 0 ? (
          <WelcomeScreen />
        ) : (
          <div className="space-y-6 max-w-3xl mx-auto">
            {messages.map((msg, i) => (
              <Message key={i} message={msg} />
            ))}
             <div ref={messagesEndRef} />
          </div>
        )}
      </div>
      <div className="p-4 md:p-6 border-t border-border bg-background">
        <form onSubmit={handleSend} className="max-w-3xl mx-auto">
          <div className="relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e);
                }
              }}
              placeholder="Start typing your message..."
              rows="1"
              className="w-full bg-card border border-transparent rounded-lg py-3 pl-4 pr-12 resize-none focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-200 font-body text-base placeholder:text-muted"
              style={{boxShadow: `0 0 15px -5px hsl(var(--primary) / 0)`}}
              onFocus={e => e.target.style.boxShadow = `0 0 15px -5px hsl(var(--primary) / 0.5)`}
              onBlur={e => e.target.style.boxShadow = `0 0 15px -5px hsl(var(--primary) / 0)`}
            />
            <button
              type="submit"
              disabled={isStreaming || !input.trim()}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-primary text-background disabled:bg-muted disabled:opacity-50 transition-colors"
            >
              <Send size={18} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const WelcomeScreen = () => (
  <div className="flex flex-col items-center justify-center h-full text-center">
    <div className="p-4 bg-card/50 rounded-full mb-4">
        <MessageSquare size={32} className="text-primary" />
    </div>
    <h1 className="text-2xl md:text-3xl font-display text-foreground">Local-First AI Chat</h1>
    <p className="text-muted mt-2 max-w-sm">Your conversations are saved directly in your browser. Start a new chat by typing in the box below.</p>
  </div>
);

const Message = React.memo(({ message }) => {
  const contentRef = useRef(null);
  const isUser = message.role === 'user';

  const parsedContent = marked.parse(message.content || '', { gfm: true, breaks: true });

  useLayoutEffect(() => {
    if (contentRef.current) {
      contentRef.current.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightElement(block);
      });
    }
  }, [parsedContent]);

  return (
    <div className={`flex items-start gap-4 ${isUser ? 'justify-end' : ''}`}>
        {!isUser && (
            <div className="w-8 h-8 rounded-full bg-card flex-shrink-0 flex items-center justify-center font-display text-accent">A</div>
        )}
        <div className={`max-w-full md:max-w-[80%] prose prose-invert ${isUser ? 'bg-accent/20 text-foreground' : 'bg-card'} p-4 rounded-lg`}>
            <div ref={contentRef} dangerouslySetInnerHTML={{ __html: parsedContent }} />
        </div>
         {isUser && (
            <div className="w-8 h-8 rounded-full bg-card flex-shrink-0 flex items-center justify-center font-display text-primary">Y</div>
        )}
    </div>
  );
});

createRoot(document.getElementById('root')).render(<App />);