
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { parseCommand, COMMAND_Types } from '../core/CommandParser';
import { getMacroStyle } from '../core/ThemeSystem';
import { getIcon } from './Icons';
import { ArrowRight, Sparkles, Search } from 'lucide-react';
import { MACROS } from '../config/macros';

export default function CommandBar({ onCommand, isBuilderActive }) {
    const [input, setInput] = useState('');
    const [parsed, setParsed] = useState(null);
    const [suggestions, setSuggestions] = useState([]);
    const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
    const [hintIndex, setHintIndex] = useState(0);
    const inputRef = useRef(null);

    const focusInput = () => {
        // On mobile, the keyboard still requires a user gesture; focusing here ensures
        // a single tap anywhere on the bar focuses the input.
        requestAnimationFrame(() => {
            inputRef.current?.focus();
        });
    };

    const applySuggestion = (macro) => {
        if (!macro) return;
        setInput(macro.triggers?.[0] || macro.name || '');
        focusInput();
    };

    // Global "type anywhere" + shortcuts (/, Cmd/Ctrl+K)
    useEffect(() => {
        const onGlobalKeyDown = (e) => {
            const target = e.target;
            const isTypingTarget =
                target &&
                (target.tagName === 'INPUT' ||
                    target.tagName === 'TEXTAREA' ||
                    target.isContentEditable);
            if (isTypingTarget) return;

            // Cmd/Ctrl + K focuses input
            if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
                e.preventDefault();
                focusInput();
                return;
            }

            // "/" focuses input (like many command palettes) unless user is typing in a field
            if (!e.metaKey && !e.ctrlKey && !e.altKey && e.key === '/') {
                e.preventDefault();
                focusInput();
                return;
            }

            // Printable character starts typing into the prompt (type anywhere)
            const isPrintable = e.key && e.key.length === 1;
            if (!e.metaKey && !e.ctrlKey && !e.altKey && isPrintable) {
                e.preventDefault();
                focusInput();
                setInput((prev) => prev + e.key);
            }
        };

        window.addEventListener('keydown', onGlobalKeyDown, { capture: true });
        return () => window.removeEventListener('keydown', onGlobalKeyDown, { capture: true });
    }, []);

    // Rotating Hints Logic
    useEffect(() => {
        if (input) return; // Stop rotating if user types
        const interval = setInterval(() => {
            setHintIndex((prev) => (prev + 1) % MACROS.length);
        }, 2500);
        return () => clearInterval(interval);
    }, [input]);

    const currentHint = MACROS[hintIndex];

    useEffect(() => {
        inputRef.current?.focus();

        if (!input.trim()) {
            setParsed(null);
            setSuggestions([]);
            setSelectedSuggestionIndex(-1);
            return;
        }

        const result = parseCommand(input);
        setParsed(result);

        // Generate Suggestions
        const lower = input.toLowerCase();
        const activeSuggestions = MACROS.filter(m =>
            m.name.toLowerCase().includes(lower) ||
            m.triggers.some(t => t.includes(lower))
        ).slice(0, 5); // Limit to top 5

        setSuggestions(activeSuggestions);
        setSelectedSuggestionIndex(activeSuggestions.length ? 0 : -1);

    }, [input]);

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            setInput('');
            setSelectedSuggestionIndex(-1);
            return;
        }

        if (e.key === 'ArrowDown') {
            if (!suggestions.length) return;
            e.preventDefault();
            setSelectedSuggestionIndex((prev) => {
                const next = prev < 0 ? 0 : (prev + 1) % suggestions.length;
                return next;
            });
            return;
        }

        if (e.key === 'ArrowUp') {
            if (!suggestions.length) return;
            e.preventDefault();
            setSelectedSuggestionIndex((prev) => {
                if (prev < 0) return suggestions.length - 1;
                const next = (prev - 1 + suggestions.length) % suggestions.length;
                return next;
            });
            return;
        }

        if (e.key === 'Tab') {
            // Autocomplete with selected suggestion
            if (selectedSuggestionIndex >= 0 && suggestions[selectedSuggestionIndex]) {
                e.preventDefault();
                applySuggestion(suggestions[selectedSuggestionIndex]);
            }
            return;
        }

        if (e.key === 'Enter') {
            e.preventDefault();
            // If a suggestion is highlighted and input isn't already a direct command, apply it
            if (selectedSuggestionIndex >= 0 && suggestions[selectedSuggestionIndex] && parsed?.type !== COMMAND_Types.BUILD) {
                applySuggestion(suggestions[selectedSuggestionIndex]);
                const nextParsed = parseCommand(suggestions[selectedSuggestionIndex].triggers?.[0] || input);
                if (nextParsed) onCommand(nextParsed);
                return;
            }

            if (parsed) {
                onCommand(parsed);
            } else if (input.trim()) {
                // Fallback to search if no explicit command parsed but input exists
                onCommand({ type: COMMAND_Types.SEARCH, query: input, url: `https://google.com/search?q=${input}` });
            }
        }
    };

    const activeStyle = parsed?.type === COMMAND_Types.REDIRECT && parsed.macro
        ? getMacroStyle(parsed.macro)
        : {};

    // Default to white text unless macro specifies otherwise (better for dark mode)
    const textColor = activeStyle.color || '#ffffff';

    // Icon logic
    const IconComponent = parsed?.type === COMMAND_Types.REDIRECT && parsed.macro?.icon
        ? getIcon(parsed.macro.icon)
        : (parsed?.type === COMMAND_Types.BUILD ? Sparkles
            : (parsed?.type === COMMAND_Types.CALCULATOR ? ArrowRight : Search));

    return (
        <div
            className={`flex flex-col items-center justify-center w-full transition-all duration-500 ${isBuilderActive ? 'h-full justify-start pt-20' : 'min-h-[40vh]'}`}
            onPointerDown={(e) => {
                // Don't steal focus from interactive elements (like clicking a suggestion)
                if (e.target?.closest?.('button,a,input,textarea,select,[role="button"]')) return;
                focusInput();
            }}
        >

            {/* The Input Core */}
            <div className="relative z-50 flex flex-col items-center w-full max-w-4xl">

                {/* PROMPT Label */}
                <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="self-start ml-4 md:ml-10 mb-2 text-xs font-bold tracking-[0.2em] uppercase opacity-90 transition-colors duration-300"
                    style={{ color: textColor }}
                >
                    Word / Prompt
                </motion.div>

                {/* Main Input Line */}
                <div
                    className="flex items-center justify-center gap-4 w-full"
                    onPointerDown={() => focusInput()}
                    role="presentation"
                >
                    {/* Icon (Only if parsed or builder) */}
                    {(parsed || isBuilderActive) && (
                        <motion.div
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="mr-2 opacity-80"
                            style={{ color: textColor }}
                        >
                            <IconComponent size={40} />
                        </motion.div>
                    )}

                    <div className="relative">
                        <motion.input
                            ref={inputRef}
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            aria-label="Command prompt"
                            className={`bg-transparent font-bold outline-none uppercase tracking-tight placeholder-transparent
                                ${input.length > 0 ? 'w-auto' : 'w-20'} 
                                transition-all duration-300`}
                            style={{
                                color: textColor,
                                fontSize: '2.5rem',
                                textAlign: 'left',
                                minWidth: '50px'
                            }}
                            autoFocus
                            placeholder=""
                            animate={{
                                scale: input.length > 0 ? 1.02 : 1,
                            }}
                            transition={{
                                type: "spring",
                                stiffness: 300,
                                damping: 20
                            }}
                        />

                        {/* Typing Cursor Animation */}
                        {input.length > 0 && (
                            <motion.span
                                className="absolute top-0 right-0 w-0.5 h-8 pointer-events-none"
                                style={{
                                    backgroundColor: textColor,
                                    marginTop: '0.5rem'
                                }}
                                animate={{
                                    opacity: [1, 0, 1],
                                }}
                                transition={{
                                    duration: 1,
                                    repeat: Infinity,
                                    ease: "easeInOut"
                                }}
                            />
                        )}

                        {/* Rotating Hint (Ghost Text) */}
                        {!input && currentHint && (
                            <motion.div
                                key={currentHint.name}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 0.5, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{
                                    type: "spring",
                                    stiffness: 100,
                                    damping: 15
                                }}
                                className="absolute top-0 left-0 w-full h-full pointer-events-none whitespace-nowrap"
                                style={{
                                    color: textColor,
                                    fontSize: '2.5rem',
                                    fontWeight: 'bold',
                                    textTransform: 'uppercase'
                                }}
                            >
                                {currentHint.triggers[0]}
                            </motion.div>
                        )}
                    </div>
                </div>

                {/* Suggestions / Predicate List */}
                <div className="mt-8 flex flex-wrap justify-center gap-6 w-full px-10">
                    <AnimatePresence>
                        {suggestions.map((s, i) => {
                            const isSelected = i === selectedSuggestionIndex;
                            return (
                            <motion.div
                                key={s.name}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                transition={{ delay: i * 0.05 }}
                                className={`text-xl font-medium cursor-pointer transition-colors opacity-90 hover:opacity-100 hover:text-white rounded-lg px-3 py-1
                                    ${isSelected ? 'opacity-100 text-white bg-white/20 border border-white/30' : ''}`}
                                style={{ color: activeStyle.color ? activeStyle.color : '#ffffff' }}
                                onClick={() => {
                                    setSelectedSuggestionIndex(i);
                                    applySuggestion(s);
                                }}
                            >
                                {s.name}
                            </motion.div>
                        )})}
                    </AnimatePresence>
                </div>

                {/* Hints Description (Legacy style below input) - Only if input empty */}
                {!input && (
                    <motion.div
                        key={currentHint?.name + "-desc"}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.9 }}
                        exit={{ opacity: 0 }}
                        className="mt-2 text-lg font-medium tracking-widest uppercase"
                        style={{ color: textColor }}
                    >
                        {currentHint?.name}
                    </motion.div>
                )}

                {/* Active Command Hint */}
                {parsed && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="mt-4 text-lg font-medium tracking-widest uppercase opacity-90"
                        style={{ color: textColor }}
                    >
                        {parsed.type === COMMAND_Types.BUILD ? "ARCHITECT MODE"
                            : parsed.type === COMMAND_Types.CALCULATOR ? `= ${parsed.result}`
                                : parsed.type}
                    </motion.div>
                )}

            </div>
        </div>
    );
}
