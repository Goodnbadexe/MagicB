/**
 * Website Breakdown Component
 * Shows a preview/breakdown of the website structure before generation
 */

import React from 'react';
import { motion as Motion } from 'framer-motion';
import { Layout, Palette, Globe, Code, Sparkles } from 'lucide-react';
import { t } from '../../core/i18n';

export default function WebsiteBreakdown({ analysis }) {
    if (!analysis) return null;

    const { language, category, theme, colors, template, content } = analysis;
    const lang = language.code;

    const breakdownItems = [
        {
            icon: Globe,
            label: t(lang, 'ui.language', 'Language'),
            value: `${language.name} (${language.nativeName})`,
            color: colors.primary
        },
        {
            icon: Layout,
            label: t(lang, 'ui.category', 'Category'),
            value: category.charAt(0).toUpperCase() + category.slice(1),
            color: colors.primary
        },
        {
            icon: Sparkles,
            label: t(lang, 'ui.template', 'Template'),
            value: template?.name || 'Default',
            color: colors.primary
        },
        {
            icon: Palette,
            label: t(lang, 'ui.theme', 'Theme'),
            value: theme.primary.charAt(0).toUpperCase() + theme.primary.slice(1),
            color: colors.primary
        },
        {
            icon: Code,
            label: t(lang, 'ui.sections', 'Sections'),
            value: template?.sections?.length || Object.keys(content.sections).filter(k => content.sections[k]).length,
            color: colors.primary
        }
    ];

    return (
        <Motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-4xl mx-auto p-6 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10"
            dir={language.dir}
        >
            <h3 className="text-xl font-bold mb-4 text-white flex items-center gap-2">
                <Sparkles size={20} style={{ color: colors.primary }} />
                {t(lang, 'ui.breakdown', 'Website Breakdown')}
            </h3>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {breakdownItems.map((item, index) => {
                    const Icon = item.icon;
                    return (
                        <Motion.div
                            key={index}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: index * 0.1 }}
                            className="p-4 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors"
                        >
                            <div className="flex items-center gap-2 mb-2">
                                <Icon size={16} style={{ color: item.color }} />
                                <span className="text-xs font-medium text-white/90 uppercase tracking-wide">
                                    {item.label}
                                </span>
                            </div>
                            <p className="text-sm font-bold text-white">
                                {item.value}
                            </p>
                        </Motion.div>
                    );
                })}
            </div>

            {template?.sections && (
                <div className="mt-4 pt-4 border-t border-white/10">
                    <p className="text-xs font-medium text-white/90 uppercase tracking-wide mb-2">
                        {t(lang, 'ui.includedSections', 'Included Sections')}
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {template.sections.map((section, index) => (
                            <Motion.span
                                key={index}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.3 + index * 0.05 }}
                                className="px-3 py-1 text-xs font-medium rounded-full"
                                style={{
                                    backgroundColor: colors.primary + '20',
                                    color: colors.primary,
                                    border: `1px solid ${colors.primary}40`
                                }}
                            >
                                {section.charAt(0).toUpperCase() + section.slice(1)}
                            </Motion.span>
                        ))}
                    </div>
                </div>
            )}
        </Motion.div>
    );
}
