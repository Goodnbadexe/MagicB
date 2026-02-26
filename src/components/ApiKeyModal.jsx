import React, { useState, useEffect } from 'react';
import { X, Key, ExternalLink, Check, Trash2, ShieldCheck, CircleAlert } from 'lucide-react';

/** Validates Gemini API key format (starts with AIza, ~39 chars, base64-like) */
function isValidGeminiKey(value) {
    const trimmed = (value || '').trim();
    if (!trimmed) return { ok: false, message: 'Enter an API key' };
    if (!trimmed.startsWith('AIza')) return { ok: false, message: 'Key should start with "AIza" (from Google AI Studio)' };
    if (trimmed.length < 35) return { ok: false, message: 'Key looks too short. Get a full key from Google AI Studio.' };
    if (trimmed.length > 50) return { ok: false, message: 'Key looks too long. Check you copied the full key without extra spaces.' };
    return { ok: true };
}

export default function ApiKeyModal({ isOpen, onClose }) {
    const [apiKey, setApiKey] = useState('');
    const [savedKey, setSavedKey] = useState('');
    const [showSuccess, setShowSuccess] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!isOpen) return;
        setError(null);
        const key = localStorage.getItem('magicb_ai_key');
        if (!key) return;
        const id = setTimeout(() => {
            setSavedKey(key);
            setApiKey(key);
        }, 0);
        return () => clearTimeout(id);
    }, [isOpen]);

    const handleApiKeyChange = (e) => {
        setApiKey(e.target.value);
        setError(null);
    };

    const validation = isValidGeminiKey(apiKey);
    const canSave = apiKey.trim() && validation.ok && !showSuccess;

    const handleSave = () => {
        if (!canSave) {
            if (apiKey.trim() && !validation.ok) setError(validation.message);
            return;
        }

        const trimmed = apiKey.trim();
        localStorage.setItem('magicb_ai_key', trimmed);
        setSavedKey(trimmed);
        setError(null);

        setShowSuccess(true);
        setTimeout(() => {
            setShowSuccess(false);
            onClose();
        }, 1500);
    };

    const handleClear = () => {
        localStorage.removeItem('magicb_ai_key');
        setSavedKey('');
        setApiKey('');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl transform transition-all animate-scale-in flex flex-col">

                {/* Header */}
                <div className="p-6 border-b border-neutral-800 flex justify-between items-center bg-neutral-900/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
                            <Key size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">Gemini API Key</h2>
                            <p className="text-xs text-neutral-300">Unlock full AI generation power</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">

                    {/* Status Banner */}
                    <div className={`p-4 rounded-xl border flex items-start gap-3 ${savedKey ? 'bg-green-500/10 border-green-500/20' : 'bg-blue-500/10 border-blue-500/20'}`}>
                        <div className={`mt-0.5 ${savedKey ? 'text-green-400' : 'text-blue-400'}`}>
                            {savedKey ? <ShieldCheck size={18} /> : <ExternalLink size={18} />}
                        </div>
                        <div className="flex-1">
                            <h3 className={`text-sm font-medium ${savedKey ? 'text-green-400' : 'text-blue-400'}`}>
                                {savedKey ? 'AI functionality active' : 'Get your free API Key'}
                            </h3>
                            <p className="text-xs text-neutral-300 mt-1 leading-relaxed">
                                {savedKey
                                    ? 'Your key is saved locally in your browser. You can now generate unlimited websites using Google Gemini.'
                                    : 'Get a free API key from Google AI Studio to enable advanced website generation.'}
                            </p>
                            {!savedKey && (
                                <a
                                    href="https://aistudio.google.com/app/apikey"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-xs font-bold text-blue-400 mt-2 hover:text-blue-300 hover:underline"
                                >
                                    Get Free Key <ExternalLink size={10} />
                                </a>
                            )}
                        </div>
                    </div>

                    {/* Input Area */}
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
                            API Key
                        </label>
                        <div className="relative">
                            <input
                                type="password"
                                value={apiKey}
                                onChange={handleApiKeyChange}
                                onBlur={() => apiKey.trim() && !validation.ok && setError(validation.message)}
                                placeholder="Paste your key here (starts with AIza...)"
                                aria-invalid={!!error}
                                aria-describedby={error ? 'api-key-error' : undefined}
                                className={`w-full bg-neutral-950 rounded-xl px-4 py-3 pr-10 text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 transition-all font-mono text-sm ${
                                    error ? 'border-2 border-red-500/50 focus:border-red-500 focus:ring-red-500/30' : 'border border-neutral-700 focus:border-blue-500 focus:ring-blue-500'
                                }`}
                            />
                            {savedKey && !error && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500">
                                    <Check size={16} />
                                </div>
                            )}
                        </div>
                        {error && (
                            <div id="api-key-error" role="alert" className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                                <CircleAlert size={16} className="mt-0.5 shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}
                        <p className="text-[10px] text-neutral-400">
                            Your key is stored locally in your browser and sent directly to Google. It never touches our servers.
                        </p>
                    </div>

                </div>

                {/* Footer */}
                <div className="p-6 pt-0 flex gap-3 mt-auto">
                    {savedKey && (
                        <button
                            onClick={handleClear}
                            className="px-4 py-3 rounded-xl border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                            title="Remove Key"
                        >
                            <Trash2 size={16} />
                        </button>
                    )}

                    <button
                        onClick={handleSave}
                        disabled={!canSave}
                        className={`flex-1 px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all
              ${showSuccess
                                ? 'bg-green-500 text-white'
                                : canSave
                                    ? 'bg-white text-black hover:bg-neutral-200'
                                    : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                            }`}
                    >
                        {showSuccess ? (
                            <>
                                <Check size={18} /> Saved!
                            </>
                        ) : (
                            'Save API Key'
                        )}
                    </button>
                </div>

            </div>
        </div>
    );
}
