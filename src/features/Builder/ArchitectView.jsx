
import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { generateHtml } from './HtmlGenerator.jsx';
import { Loader2, CheckCircle2, Layout, ScanSearch, Code2, Lock } from 'lucide-react';
import { detectLanguage } from '../../core/LanguageDetector';
import { t } from '../../core/i18n';
import { analyzePrompt } from '../../core/PromptAnalyzer';
import WebsiteBreakdown from './WebsiteBreakdown';

const STEPS_CONFIG = [
    { key: 'analyzing', icon: ScanSearch, time: 2000 },
    { key: 'architecting', icon: Layout, time: 3000 },
    { key: 'generating', icon: Code2, time: 2500 },
    { key: 'finalizing', icon: CheckCircle2, time: 1000 }
];

export default function ArchitectView({ query, onBack }) {
    const [currentStep, setCurrentStep] = useState(0);
    const [html, setHtml] = useState('');
    const [analysis, setAnalysis] = useState(null);

    const language = detectLanguage(query);
    const lang = language.code;

    // Analyze prompt immediately for breakdown
    useEffect(() => {
        if (query) {
            const promptAnalysis = analyzePrompt(query);
            setAnalysis(promptAnalysis);
        }
    }, [query]);

    useEffect(() => {
        let totalTime = 0;

        // Schedule step updates
        STEPS_CONFIG.forEach((step, index) => {
            setTimeout(() => {
                setCurrentStep(index);
            }, totalTime);
            totalTime += step.time;
        });

        // Set final HTML after all steps
        setTimeout(() => {
            generateHtml(query).then(generated => {
                setHtml(generated);
            });
        }, totalTime);

    }, [query]);

    return (
        <div className="w-full h-full flex flex-col pt-4 md:pt-10 px-4 md:px-8" dir={language.dir}>
            <div className="max-w-6xl mx-auto w-full h-[85vh] bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col border border-gray-800 relative">

                {/* Header / Browser Interface */}
                <div className="bg-gray-100 p-3 md:p-4 border-b border-gray-200 flex items-center justify-between z-10" dir="ltr">
                    <div className="flex gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-400"></div>
                        <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                        <div className="w-3 h-3 rounded-full bg-green-400"></div>
                    </div>
                    <div className="text-xs md:text-sm font-medium text-gray-500 truncate max-w-[200px] md:max-w-md">localhost:3000/preview</div>
                    <div className="flex gap-2">
                        <button
                            onClick={onBack}
                            className="text-xs bg-white border border-gray-300 px-3 py-1 rounded hover:bg-gray-50 transition-colors shadow-sm"
                        >
                            {t(lang, 'ui.newPrompt', 'New Prompt')}
                        </button>
                        <button
                            className="text-xs bg-black text-white px-3 py-1 rounded flex items-center gap-1 hover:bg-gray-800 transition-colors shadow-sm"
                            onClick={() => alert("Upgrade to PRO to publish your site!")}
                        >
                            <Lock size={10} />
                            {t(lang, 'ui.publish', 'Publish')}
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 relative bg-white">
                    {/* Rendered Website */}
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
                                    {STEPS_CONFIG.map((step, index) => {
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
            </div>
        </div>
    );
}
