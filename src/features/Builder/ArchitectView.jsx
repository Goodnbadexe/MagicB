
import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { generateHtml } from './HtmlGenerator.jsx';
import { Loader2, CheckCircle2, Layout, ScanSearch, Code2, Lock, Download, Copy, ExternalLink, Share2, ShieldCheck, Send, MessageSquare, Sparkles } from 'lucide-react';
import { detectLanguage } from '../../core/LanguageDetector';
import { t } from '../../core/i18n';
import { analyzePrompt } from '../../core/PromptAnalyzer';
import WebsiteBreakdown from './WebsiteBreakdown';
import { downloadHTML, copyToClipboard, openInNewWindow } from '../../utils/exportUtils';
import ApiKeyModal from '../../components/ApiKeyModal';
import { AiService } from '../../services/AiService.js';

const STEPS = [
    { key: 'analyzing', icon: ScanSearch },
    { key: 'architecting', icon: Layout },
    { key: 'generating', icon: Code2 },
    { key: 'finalizing', icon: CheckCircle2 }
];

export default function ArchitectView({ query, onBack }) {
    const [currentStep, setCurrentStep] = useState(0);
    const [html, setHtml] = useState('');
    const [analysis, setAnalysis] = useState(null);
    const [exportStatus, setExportStatus] = useState(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [hasApiKey, setHasApiKey] = useState(!!localStorage.getItem('magicb_ai_key'));

    // Refinement State
    const [refinementQuery, setRefinementQuery] = useState('');
    const [isRefining, setIsRefining] = useState(false);
    const [chatHistory, setChatHistory] = useState([]); // Array of { role: 'user'|'ai', text: string }

    const language = detectLanguage(query);
    const lang = language.code;

    // Check key on mount and when modal closes
    useEffect(() => {
        setHasApiKey(!!localStorage.getItem('magicb_ai_key'));
    }, [isSettingsOpen]);

    // Helper for toast notifications
    const showToast = (message, type = 'success') => {
        const notification = document.createElement('div');
        notification.textContent = message;
        const bgClass = type === 'error' ? 'bg-red-600' : 'bg-green-600';
        notification.className = `fixed top-4 right-4 ${bgClass} text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in font-medium flex items-center gap-2`;
        notification.style.animation = 'fadeIn 0.3s ease-in';

        // Add icon
        const icon = document.createElement('span');
        icon.innerHTML = type === 'error' ? '✕' : '✓';
        notification.prepend(icon);

        document.body.appendChild(notification);
        setTimeout(() => {
            notification.style.animation = 'fadeOut 0.3s ease-out';
            setTimeout(() => document.body.removeChild(notification), 300);
        }, 3000);
    };

    // Analyze prompt immediately for breakdown
    useEffect(() => {
        if (query) {
            const promptAnalysis = analyzePrompt(query);
            setAnalysis(promptAnalysis);
        }
    }, [query]);

    // Dynamic Generation Logic
    useEffect(() => {
        let isMounted = true;
        let stepInterval;

        const performGeneration = async () => {
            // Start the step animation
            setCurrentStep(0);

            // Advance steps periodically to show progress
            stepInterval = setInterval(() => {
                setCurrentStep(prev => {
                    if (prev < STEPS.length - 2) return prev + 1; // Don't go to finalizing yet
                    return prev;
                });
            }, 800);

            try {
                // Actual generation
                const generated = await generateHtml(query);

                if (!isMounted) return;

                // Stop the auto-advance
                clearInterval(stepInterval);

                // Fast forward to finalizing
                setCurrentStep(STEPS.length - 1); // Finalizing

                // Small delay for "Finalizing" to be seen
                setTimeout(() => {
                    if (isMounted) {
                        setHtml(generated);
                    }
                }, 600);

            } catch (err) {
                console.error("Generation failed", err);
                if (isMounted) showToast("Generation failed. Please try again.", "error");
            }
        };

        performGeneration();

        return () => {
            isMounted = false;
            clearInterval(stepInterval);
        };
    }, [query]);

    // Refinement Handler
    const handleRefinement = async (e) => {
        e.preventDefault();
        if (!refinementQuery.trim() || isRefining) return;

        const instruction = refinementQuery;
        setRefinementQuery('');
        setIsRefining(true);

        // Add to history
        setChatHistory(prev => [...prev, { role: 'user', text: instruction }]);

        try {
            if (!hasApiKey) {
                throw new Error("Please configure your API Key first");
            }

            const newHtml = await AiService.refineWebsite(html, instruction);
            setHtml(newHtml);
            showToast(t(lang, 'ui.refined', 'Website updated!'));
            setChatHistory(prev => [...prev, { role: 'ai', text: 'Updated successfully! Anything else?' }]);

        } catch (err) {
            console.error("Refinement failed", err);
            showToast(err.message, "error");
            setChatHistory(prev => [...prev, { role: 'ai', text: `Error: ${err.message}` }]);
        } finally {
            setIsRefining(false);
        }
    };

    return (
        <div className="w-full h-full flex flex-col pt-4 md:pt-10 px-4 md:px-8" dir={language.dir}>
            <ApiKeyModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

            <div className="max-w-6xl mx-auto w-full h-[85vh] bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col border border-gray-800 relative">

                {/* Header / Browser Interface */}
                <div className="bg-gray-100 p-3 md:p-4 border-b border-gray-200 flex items-center justify-between z-10" dir="ltr">
                    <div className="flex items-center gap-4">
                        <div className="flex gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-400"></div>
                            <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                            <div className="w-3 h-3 rounded-full bg-green-400"></div>
                        </div>

                        {/* AI Status Pill */}
                        <button
                            onClick={() => setIsSettingsOpen(true)}
                            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-all ${hasApiKey
                                ? 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100'
                                : 'bg-gray-200 text-gray-500 border-gray-300 hover:bg-gray-300'
                                }`}
                        >
                            <ShieldCheck size={10} />
                            {hasApiKey ? 'AI ONLINE' : 'AI OFF'}
                        </button>
                    </div>

                    <div className="text-xs md:text-sm font-medium text-gray-500 truncate max-w-[200px] md:max-w-md">localhost:3000/preview</div>
                    <div className="flex gap-2">
                        <button
                            onClick={onBack}
                            className="text-xs bg-white border border-gray-300 px-3 py-1 rounded hover:bg-gray-50 transition-colors shadow-sm"
                        >
                            {t(lang, 'ui.newPrompt', 'New Prompt')}
                        </button>
                        {html && (
                            <>
                                <button
                                    className="text-xs bg-blue-600 text-white px-3 py-1 rounded flex items-center gap-1 hover:bg-blue-700 transition-colors shadow-sm"
                                    onClick={async () => {
                                        const success = await copyToClipboard(html);
                                        if (success) showToast(t(lang, 'ui.copied', 'Code copied to clipboard!'));
                                        setExportStatus(success ? 'copied' : 'error');
                                        setTimeout(() => setExportStatus(null), 2000);
                                    }}
                                    title={t(lang, 'ui.copyCode', 'Copy HTML')}
                                >
                                    <Copy size={10} />
                                    {exportStatus === 'copied' ? t(lang, 'ui.copied', 'Copied!') : t(lang, 'ui.copy', 'Copy')}
                                </button>
                                <button
                                    className="text-xs bg-green-600 text-white px-3 py-1 rounded flex items-center gap-1 hover:bg-green-700 transition-colors shadow-sm"
                                    onClick={() => {
                                        const filename = analysis?.title || 'website';
                                        downloadHTML(html, filename);
                                        showToast(t(lang, 'ui.downloaded', 'Website downloaded!'));
                                        setExportStatus('downloaded');
                                        setTimeout(() => setExportStatus(null), 2000);
                                    }}
                                    title={t(lang, 'ui.download', 'Download HTML')}
                                >
                                    <Download size={10} />
                                    {t(lang, 'ui.download', 'Download')}
                                </button>
                                <button
                                    className="text-xs bg-purple-600 text-white px-3 py-1 rounded flex items-center gap-1 hover:bg-purple-700 transition-colors shadow-sm"
                                    onClick={() => openInNewWindow(html)}
                                    title={t(lang, 'ui.openNewWindow', 'Open in New Window')}
                                >
                                    <ExternalLink size={10} />
                                    {t(lang, 'ui.open', 'Open')}
                                </button>
                            </>
                        )}
                        <button
                            className="text-xs bg-black text-white px-3 py-1 rounded flex items-center gap-1 hover:bg-gray-800 transition-colors shadow-sm"
                            onClick={() => showToast("✨ Upgrade to PRO to publish instantly!", "success")}
                        >
                            <Lock size={10} />
                            {t(lang, 'ui.publish', 'Publish')}
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 relative bg-white flex overflow-hidden">

                    {/* Rendered Website - Takes available space */}
                    <div className="flex-1 w-full h-full relative border-r border-gray-100">
                        {html ? (
                            <motion.iframe
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                srcDoc={html}
                                className="w-full h-full border-none"
                                title="Generated Website"
                            />
                        ) : (
                            /* Loading State */
                            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 overflow-y-auto">
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="w-full max-w-4xl space-y-8"
                                >
                                    <div className="text-center space-y-2">
                                        <h2 className="text-2xl font-bold text-gray-900">
                                            {t(lang, 'ui.architectingVision', 'Architecting your vision')}
                                        </h2>
                                        <p className="text-gray-500 text-sm">"{query}"</p>
                                    </div>

                                    {/* Website Breakdown Preview */}
                                    {analysis && (
                                        <WebsiteBreakdown analysis={analysis} />
                                    )}

                                    <div className="space-y-4">
                                        {STEPS.map((step, index) => {
                                            const isActive = index === currentStep;
                                            const StepIcon = step.icon;

                                            return (
                                                <div
                                                    key={index}
                                                    className={`flex items-center gap-4 p-3 rounded-lg transition-all duration-500 ${isActive ? 'bg-blue-50 border border-blue-100 scale-105 shadow-sm' : 'opacity-50'}`}
                                                >
                                                    <div className={`p-2 rounded-full ${isActive ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                                                        {isActive ? <Loader2 className="animate-spin" size={20} /> : <StepIcon size={20} />}
                                                    </div>
                                                    <span className={`font-medium ${isActive ? 'text-blue-900' : 'text-gray-500'}`}>
                                                        {t(lang, `ui.${step.key}`, step.key)}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </motion.div>
                            </div>
                        )}
                    </div>

                    {/* Chat / Refinement Sidebar - Shows when HTML is ready */}
                    {html && (
                        <motion.div
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: 300, opacity: 1 }}
                            className="bg-gray-50 border-l border-gray-200 flex flex-col shadow-xl z-20"
                        >
                            <div className="p-4 border-b border-gray-200 bg-white/50 backdrop-blur-sm">
                                <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                    <Sparkles size={14} className="text-purple-500" />
                                    {t(lang, 'ui.aiArchitect', 'AI Architect')}
                                </h3>
                                <p className="text-[10px] text-gray-400">{t(lang, 'ui.refineHint', 'Type usage instructions to refine')}</p>
                            </div>

                            {/* Chat History */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                {chatHistory.length === 0 && (
                                    <div className="text-center mt-10 opacity-40">
                                        <MessageSquare size={32} className="mx-auto mb-2" />
                                        <p className="text-xs">Ask me to change colors, add sections, or update text!</p>
                                    </div>
                                )}
                                {chatHistory.map((msg, idx) => (
                                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`rounded-xl p-3 max-w-[90%] text-xs ${msg.role === 'user'
                                                ? 'bg-blue-600 text-white rounded-tr-none'
                                                : 'bg-white border border-gray-200 text-gray-700 rounded-tl-none shadow-sm'
                                            }`}>
                                            {msg.text}
                                        </div>
                                    </div>
                                ))}
                                {isRefining && (
                                    <div className="flex justify-start">
                                        <div className="bg-white border border-gray-200 rounded-xl rounded-tl-none p-3 shadow-sm">
                                            <Loader2 size={16} className="animate-spin text-purple-500" />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Input Area */}
                            <div className="p-4 border-t border-gray-200 bg-white">
                                <form onSubmit={handleRefinement} className="relative">
                                    <input
                                        type="text"
                                        value={refinementQuery}
                                        onChange={(e) => setRefinementQuery(e.target.value)}
                                        placeholder={t(lang, 'ui.refinePlaceholder', 'e.g. "Make background dark"')}
                                        className="w-full bg-gray-100 border-none rounded-xl py-3 pl-4 pr-10 text-xs focus:ring-2 focus:ring-purple-500/20 focus:bg-white transition-all outline-none"
                                        disabled={isRefining}
                                    />
                                    <button
                                        type="submit"
                                        disabled={!refinementQuery.trim() || isRefining}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                    >
                                        <Send size={12} />
                                    </button>
                                </form>
                            </div>
                        </motion.div>
                    )}
                </div>
            </div>
        </div>
    );
}
