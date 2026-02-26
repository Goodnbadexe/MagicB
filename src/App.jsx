
import React, { useState, useEffect } from 'react';
import CommandBar from './components/CommandBar';
import { COMMAND_Types } from './core/CommandParser';
import { motion, AnimatePresence } from 'framer-motion';
import ArchitectView from './features/Builder/ArchitectView';
import { ExternalLink, Settings } from 'lucide-react';
import ApiKeyModal from './components/ApiKeyModal';

function App() {
  const [mode, setMode] = useState('COMMAND'); // COMMAND | BUILDER
  const [currentQuery, setCurrentQuery] = useState('');
  const [redirect, setRedirect] = useState(null); // { url: string } | null
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleCommand = (cmd) => {
    if (cmd.type === COMMAND_Types.REDIRECT || cmd.type === COMMAND_Types.SEARCH) {
      // SIMULATED REDIRECT: Show overlay instead of leaving
      if (cmd.url) {
        setRedirect({ url: cmd.url });
        setTimeout(() => {
          setRedirect(null);
        }, 2000);
      }
    } else if (cmd.type === COMMAND_Types.BUILD) {
      setMode('BUILDER');
      setCurrentQuery(cmd.query);
    } else if (cmd.type === COMMAND_Types.CONFIG) {
      // Save the key
      import('./services/AiService').then(({ AiService }) => {
        AiService.setKey(cmd.key);
        // Show success message with animation
        const notification = document.createElement('div');
        notification.textContent = "✓ API Key Saved! You can now use AI generation.";
        notification.className = 'fixed top-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in';
        notification.style.animation = 'fadeIn 0.3s ease-in';
        document.body.appendChild(notification);
        setTimeout(() => {
          notification.style.animation = 'fadeOut 0.3s ease-out';
          setTimeout(() => document.body.removeChild(notification), 300);
        }, 3000);
      });
    }
  };

  return (
    <div className="min-h-screen w-full relative flex flex-col items-center justify-center overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 z-0 bg-black">
        <div className="absolute top-[-20%] left-[-20%] w-[50%] h-[50%] rounded-full bg-neutral-900/30 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-20%] w-[50%] h-[50%] rounded-full bg-neutral-900/30 blur-[120px]" />
      </div>

      {/* Redirect Overlay */}
      <AnimatePresence>
        {redirect && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md"
          >
            <div className="flex flex-col items-center gap-4 text-white">
              <div className="p-4 bg-white/10 rounded-full animate-pulse">
                <ExternalLink size={48} />
              </div>
              <div className="text-2xl font-light">Redirecting to</div>
              <div className="text-xl font-bold font-mono text-blue-400">{redirect.url}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ApiKeyModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* Settings Button */}
      <button
        onClick={() => setIsSettingsOpen(true)}
        className="absolute top-6 right-6 z-40 p-3 bg-white/20 backdrop-blur-md border border-white/30 rounded-full text-white hover:bg-white/30 transition-all group"
      >
        <Settings size={20} className="group-hover:rotate-90 transition-transform duration-500" />
      </button>

      {/* Content */}
      <div className="relative z-10 w-full h-full flex flex-row overflow-hidden">

        {/* Left Panel: Command Interface */}
        <motion.div
          layout
          className={`flex flex-col items-center justify-center p-8 transition-all duration-700 ease-[0.23, 1, 0.32, 1]
                  ${mode === 'BUILDER' ? 'w-1/3 border-r border-white/10 bg-black/20 backdrop-blur-sm' : 'w-full'}
              `}
        >
          <CommandBar
            onCommand={handleCommand}
            isBuilderActive={mode === 'BUILDER'}
          />

          {mode === 'COMMAND' && (
            <div className="mt-12 flex gap-4 text-white text-sm">
              <span>Press <kbd className="bg-white/20 px-2 py-1 rounded border border-white/30 text-white">yt</kbd> for YouTube</span>
              <span>•</span>
              <span>Type <kbd className="bg-white/20 px-2 py-1 rounded border border-white/30 text-white">build...</kbd> to create</span>
            </div>
          )}
        </motion.div>

        {/* Right Panel: Builder / Results */}
        <AnimatePresence>
          {mode === 'BUILDER' && (
            <motion.div
              key="builder-panel"
              initial={{ opacity: 0, x: '100%' }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: '100%' }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="w-2/3 h-full relative"
            >
              <ArchitectView
                query={currentQuery}
                onBack={() => {
                  // Optional: Close builder or just reset query
                  setMode('COMMAND');
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default App;
