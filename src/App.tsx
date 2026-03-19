import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Send, Volume2, VolumeX, Loader2, History, FlaskConical, BookOpen, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { chemistryService, ChemistryResponse } from './services/chemistryService';
import { cn } from './lib/utils';

interface SessionItem {
  id: string;
  query: string;
  summary: string;
  timestamp: Date;
  details: ChemistryResponse;
  imageUrl?: string | null;
}

export default function App() {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentResponse, setCurrentResponse] = useState<ChemistryResponse | null>(null);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [history, setHistory] = useState<SessionItem[]>([]);
  const [chatHistory, setChatHistory] = useState<{ role: string; parts: { text: string }[] }[]>([]);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Initialize Speech Recognition if available
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      
      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        handleSend(transcript);
        setIsRecording(false);
      };

      recognitionRef.current.onerror = () => {
        setIsRecording(false);
      };

      recognitionRef.current.onend = () => {
        setIsRecording(false);
      };
    }
  }, []);

  const handleSend = async (text: string = input) => {
    if (!text.trim() || isLoading) return;

    setIsLoading(true);
    setInput('');
    
    try {
      const response = await chemistryService.getChemistryExplanation(text, chatHistory);
      setCurrentResponse(response);
      
      // Update chat history for context
      setChatHistory(prev => [
        ...prev,
        { role: "user", parts: [{ text }] },
        { role: "model", parts: [{ text: JSON.stringify(response) }] }
      ]);

      // Generate Speech
      if (!isMuted) {
        const audioData = await chemistryService.generateSpeech(response.voiceText, response.language);
        if (audioData) {
          if (audioRef.current) {
            audioRef.current.src = `data:audio/mp3;base64,${audioData}`;
            audioRef.current.play();
          }
        }
      }

      // Generate Image if molecular description exists
      let imageUrl = null;
      if (response.molecularDescription) {
        imageUrl = await chemistryService.generateMolecularImage(response.molecularDescription);
        setCurrentImage(imageUrl);
      } else {
        setCurrentImage(null);
      }

      // Add to session history
      const newItem: SessionItem = {
        id: Math.random().toString(36).substr(2, 9),
        query: text,
        summary: response.summary,
        timestamp: new Date(),
        details: response,
        imageUrl
      };
      setHistory(prev => [newItem, ...prev]);

    } catch (error) {
      console.error("Error in handleSend:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
    } else {
      setIsRecording(true);
      recognitionRef.current?.start();
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-slate-900 font-sans flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
            <FlaskConical size={24} />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight">Chemistry Expert AI</h1>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Interactive Voice Teacher</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsMuted(!isMuted)}
            className={cn(
              "p-2 rounded-full transition-all",
              isMuted ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            )}
          >
            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Panel: Interaction & History */}
        <div className="flex-1 flex flex-col border-r border-slate-200 overflow-hidden">
          {/* Chat/Interaction Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <AnimatePresence mode="wait">
              {!currentResponse ? (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-4"
                >
                  <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 mb-2">
                    <BookOpen size={40} />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-800">How can I help you today?</h2>
                  <p className="text-slate-500">Ask me about any chemical reaction, molecular structure, or chemistry concept from grade 6 to university level.</p>
                  <div className="flex flex-wrap justify-center gap-2 pt-4">
                    {['সালফিউরিক এসিডের প্রস্তুতি', 'Photosynthesis reaction', 'বেনজিনের গঠন', 'What is an isotope?'].map(suggestion => (
                      <button 
                        key={suggestion}
                        onClick={() => handleSend(suggestion)}
                        className="px-4 py-2 bg-white border border-slate-200 rounded-full text-sm font-medium hover:border-indigo-400 hover:text-indigo-600 transition-colors shadow-sm"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  key={currentResponse.summary}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-6"
                >
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 shrink-0">
                        <Volume2 size={20} />
                      </div>
                      <div className="space-y-2">
                        <p className="text-lg leading-relaxed text-slate-800 font-medium">
                          {currentResponse.voiceText}
                        </p>
                      </div>
                    </div>
                  </div>

                  {currentImage && (
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 overflow-hidden">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Info size={14} /> Molecular Visualization
                      </p>
                      <img 
                        src={currentImage} 
                        alt="Molecular Structure" 
                        className="w-full h-auto rounded-xl object-contain max-h-[400px]"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Input Area */}
          <div className="p-6 bg-white border-t border-slate-200">
            <div className="max-w-3xl mx-auto relative">
              <div className="flex items-center gap-3 bg-slate-50 rounded-2xl p-2 pl-4 border border-slate-200 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
                <input 
                  type="text" 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Ask a chemistry question..."
                  className="flex-1 bg-transparent border-none focus:ring-0 text-slate-800 placeholder:text-slate-400"
                />
                <div className="flex items-center gap-1">
                  <button 
                    onClick={toggleRecording}
                    className={cn(
                      "p-2.5 rounded-xl transition-all",
                      isRecording ? "bg-red-500 text-white animate-pulse" : "text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                    )}
                  >
                    {isRecording ? <MicOff size={20} /> : <Mic size={20} />}
                  </button>
                  <button 
                    onClick={() => handleSend()}
                    disabled={isLoading || !input.trim()}
                    className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-indigo-100"
                  >
                    {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel: Reaction Details & History */}
        <div className="w-full lg:w-[400px] bg-white flex flex-col overflow-hidden">
          {/* Reaction Details */}
          <div className="flex-1 overflow-y-auto p-6 border-b border-slate-100">
            <div className="flex items-center gap-2 mb-6">
              <FlaskConical className="text-indigo-600" size={20} />
              <h3 className="font-bold text-slate-800">Reaction Details</h3>
            </div>

            <AnimatePresence mode="wait">
              {currentResponse?.reactionDetails ? (
                <motion.div 
                  key={currentResponse.reactionDetails.name}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-6"
                >
                  <section>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Reaction Name</label>
                    <h4 className="text-xl font-bold text-slate-900">{currentResponse.reactionDetails.name}</h4>
                  </section>

                  <section className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Chemical Equation</label>
                    <div className="font-mono text-indigo-700 bg-white p-3 rounded-lg border border-slate-200 overflow-x-auto">
                      {currentResponse.reactionDetails.equation}
                    </div>
                  </section>

                  <section>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Mechanism / Details</label>
                    <div className="text-sm text-slate-600 leading-relaxed prose prose-slate max-w-none">
                      <Markdown>{currentResponse.reactionDetails.mechanism}</Markdown>
                    </div>
                  </section>

                  <section className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                    <label className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1 block">Important Notes</label>
                    <p className="text-sm text-amber-800 font-medium">{currentResponse.reactionDetails.notes}</p>
                  </section>
                </motion.div>
              ) : (
                <div className="h-40 flex flex-col items-center justify-center text-center opacity-40">
                  <FlaskConical size={40} className="mb-2" />
                  <p className="text-xs font-medium">No reaction details available</p>
                </div>
              )}
            </AnimatePresence>
          </div>

          {/* Session History */}
          <div className="h-[300px] border-t border-slate-200 bg-slate-50/50 flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white">
              <div className="flex items-center gap-2">
                <History size={18} className="text-slate-400" />
                <h3 className="font-bold text-sm text-slate-700">Session History</h3>
              </div>
              <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold">{history.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {history.length === 0 ? (
                <p className="text-center text-xs text-slate-400 mt-10">Your session history will appear here.</p>
              ) : (
                history.map((item) => (
                  <button 
                    key={item.id}
                    onClick={() => {
                      setCurrentResponse(item.details);
                      setCurrentImage(item.imageUrl || null);
                    }}
                    className="w-full text-left p-3 bg-white rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-sm transition-all group"
                  >
                    <p className="text-xs font-bold text-slate-800 truncate mb-1 group-hover:text-indigo-600">{item.query}</p>
                    <p className="text-[10px] text-slate-500 line-clamp-1">{item.summary}</p>
                    <p className="text-[9px] text-slate-400 mt-2">{item.timestamp.toLocaleTimeString()}</p>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </main>

      <audio ref={audioRef} className="hidden" />
    </div>
  );
}
