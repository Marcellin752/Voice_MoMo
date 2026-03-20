import { Link } from "react-router";
import { Mic, ChevronRight } from "lucide-react";
import { motion } from "motion/react";

export default function WelcomeScreen() {
  return (
    <div className="flex flex-col items-center justify-between h-[100dvh] w-full max-w-md mx-auto bg-[#FFCC00] text-[#004F71] px-6 py-12">
      <div className="flex-1 flex flex-col items-center justify-center space-y-10 mt-12">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="relative w-36 h-36 bg-white rounded-full flex items-center justify-center shadow-xl shadow-[#004F71]/10"
        >
          <Mic className="text-[#004F71]" size={72} />
          <motion.div 
            animate={{ 
              boxShadow: ["0 0 0 0px rgba(255, 255, 255, 0.6)", "0 0 0 40px rgba(255, 255, 255, 0)"]
            }}
            transition={{ 
              repeat: Infinity, 
              duration: 2 
            }}
            className="absolute inset-0 rounded-full"
          />
        </motion.div>
        
        <div className="text-center space-y-4">
          <h1 className="text-5xl font-black tracking-tight text-[#004F71]">MoMo<br/>Voice</h1>
          <p className="text-[#004F71]/80 text-lg font-medium max-w-xs mx-auto">
            Gérez votre argent par la voix, simplement et rapidement.
          </p>
        </div>
      </div>

      <div className="w-full space-y-4">
        <Link 
          to="/login"
          className="flex items-center justify-between w-full bg-[#004F71] text-white font-bold py-5 px-6 rounded-2xl transition-transform active:scale-95 shadow-lg shadow-[#004F71]/20"
        >
          <span className="text-lg">Commencer</span>
          <ChevronRight size={24} />
        </Link>
      </div>
    </div>
  );
}
