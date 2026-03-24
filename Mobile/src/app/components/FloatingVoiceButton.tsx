import { Mic } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useVoiceAssistant } from '../hooks/useVoiceAssistant';

export default function FloatingVoiceButton() {
  const { status, transcript, feedback, startListening, stopListening } = useVoiceAssistant();

  return (
    <div className="fixed bottom-[90px] w-full max-w-md mx-auto pointer-events-none z-50 flex flex-col items-end justify-end px-6 space-y-3 right-0 left-0">
      <AnimatePresence>
        {status !== 'idle' && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="pointer-events-auto bg-white dark:bg-[#1A1A1A] p-4 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-white/10 max-w-[260px] mr-2"
          >
            <p className="text-[#004F71] dark:text-[#FFCC00] text-sm font-bold italic">"{transcript || '...'}"</p>
            {feedback && (
              <p className={`text-xs mt-1 font-medium ${status === 'error' ? 'text-red-500' : 'text-slate-500 dark:text-zinc-400'}`}>
                {feedback}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={status === 'idle' ? startListening : stopListening}
        whileTap={{ scale: 0.9 }}
        className={`pointer-events-auto relative w-16 h-16 rounded-full flex items-center justify-center shadow-xl z-20 border-[3px] border-slate-50 dark:border-[#121212] ${
          status === 'idle'
            ? 'bg-[#004F71] text-white hover:bg-[#003B5C]'
            : 'bg-red-500 text-white'
        }`}
      >
        {status === 'listening' || status === 'processing' ? (
          <motion.div
            animate={{
              boxShadow: ["0 0 0 0px rgba(239, 68, 68, 0.4)", "0 0 0 20px rgba(239, 68, 68, 0)"]
            }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="absolute inset-0 rounded-full"
          />
        ) : null}
        <Mic size={28} className={status === 'listening' ? 'animate-pulse' : ''} />
      </motion.button>
    </div>
  );
}
