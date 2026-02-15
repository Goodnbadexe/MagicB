/**
 * Website Templates Configuration
 * Comprehensive template system with multiple variations per category
 */

/**
 * Template structure:
 * - id: unique identifier
 * - name: display name
 * - category: category it belongs to
 * - style: visual style (minimal, modern, classic, bold, elegant, creative)
 * - layout: layout type (grid, list, masonry, fullscreen, split)
 * - sections: array of section types included
 * - colorScheme: suggested color schemes
 * - description: template description
 */

export const TEMPLATE_CATEGORIES = {
    portfolio: {
        name: 'Portfolio',
        keywords: ['portfolio', 'showcase', 'gallery', 'work', 'projects', 'creative', 'artist', 'designer', 'photographer'],
        templates: [
            {
                id: 'portfolio-minimal',
                name: 'Minimal Portfolio',
                style: 'minimal',
                layout: 'grid',
                sections: ['hero', 'projects', 'about', 'skills', 'contact', 'footer'],
                colorScheme: ['monochrome', 'blue', 'black'],
                description: 'Clean, minimal portfolio perfect for showcasing work'
            },
            {
                id: 'portfolio-modern',
                name: 'Modern Portfolio',
                style: 'modern',
                layout: 'masonry',
                sections: ['hero', 'featured', 'projects', 'testimonials', 'contact', 'footer'],
                colorScheme: ['blue', 'purple', 'gradient'],
                description: 'Contemporary portfolio with dynamic layouts'
            },
            {
                id: 'portfolio-creative',
                name: 'Creative Portfolio',
                style: 'creative',
                layout: 'fullscreen',
                sections: ['hero', 'projects', 'process', 'about', 'contact', 'footer'],
                colorScheme: ['colorful', 'gradient', 'vibrant'],
                description: 'Bold, creative portfolio for artists and designers'
            },
            {
                id: 'portfolio-classic',
                name: 'Classic Portfolio',
                style: 'classic',
                layout: 'list',
                sections: ['hero', 'about', 'projects', 'services', 'contact', 'footer'],
                colorScheme: ['brown', 'gray', 'elegant'],
                description: 'Timeless, professional portfolio design'
            }
        ]
    },
    agency: {
        name: 'Agency',
        keywords: ['agency', 'company', 'business', 'corporate', 'firm', 'studio', 'team'],
        templates: [
            {
                id: 'agency-modern',
                name: 'Modern Agency',
                style: 'modern',
                layout: 'split',
                sections: ['hero', 'services', 'team', 'portfolio', 'testimonials', 'contact', 'footer'],
                colorScheme: ['blue', 'purple', 'professional'],
                description: 'Sleek agency website with service focus'
            },
            {
                id: 'agency-bold',
                name: 'Bold Agency',
                style: 'bold',
                layout: 'fullscreen',
                sections: ['hero', 'about', 'services', 'case-studies', 'team', 'contact', 'footer'],
                colorScheme: ['black', 'red', 'vibrant'],
                description: 'Bold, impactful agency presence'
            },
            {
                id: 'agency-elegant',
                name: 'Elegant Agency',
                style: 'elegant',
                layout: 'grid',
                sections: ['hero', 'services', 'portfolio', 'testimonials', 'contact', 'footer'],
                colorScheme: ['gold', 'brown', 'elegant'],
                description: 'Sophisticated agency website'
            }
        ]
    },
    shop: {
        name: 'E-commerce',
        keywords: ['shop', 'store', 'ecommerce', 'marketplace', 'products', 'buy', 'sell', 'retail'],
        templates: [
            {
                id: 'shop-modern',
                name: 'Modern Shop',
                style: 'modern',
                layout: 'grid',
                sections: ['hero', 'featured', 'products', 'categories', 'testimonials', 'contact', 'footer'],
                colorScheme: ['blue', 'green', 'professional'],
                description: 'Clean, conversion-focused e-commerce site'
            },
            {
                id: 'shop-luxury',
                name: 'Luxury Shop',
                style: 'elegant',
                layout: 'fullscreen',
                sections: ['hero', 'collections', 'products', 'about', 'contact', 'footer'],
                colorScheme: ['gold', 'black', 'elegant'],
                description: 'Premium, luxury shopping experience'
            },
            {
                id: 'shop-minimal',
                name: 'Minimal Shop',
                style: 'minimal',
                layout: 'grid',
                sections: ['hero', 'products', 'about', 'contact', 'footer'],
                colorScheme: ['white', 'monochrome', 'clean'],
                description: 'Minimalist product showcase'
            }
        ]
    },
    blog: {
        name: 'Blog',
        keywords: ['blog', 'article', 'news', 'journal', 'post', 'magazine', 'content'],
        templates: [
            {
                id: 'blog-classic',
                name: 'Classic Blog',
                style: 'classic',
                layout: 'list',
                sections: ['header', 'featured', 'posts', 'sidebar', 'about', 'footer'],
                colorScheme: ['brown', 'gray', 'warm'],
                description: 'Traditional blog layout with sidebar'
            },
            {
                id: 'blog-modern',
                name: 'Modern Blog',
                style: 'modern',
                layout: 'masonry',
                sections: ['hero', 'featured', 'posts', 'categories', 'about', 'footer'],
                colorScheme: ['blue', 'purple', 'modern'],
                description: 'Contemporary blog with card layout'
            },
            {
                id: 'blog-minimal',
                name: 'Minimal Blog',
                style: 'minimal',
                layout: 'list',
                sections: ['header', 'posts', 'about', 'footer'],
                colorScheme: ['monochrome', 'clean', 'simple'],
                description: 'Clean, reading-focused blog'
            }
        ]
    },
    landing: {
        name: 'Landing Page',
        keywords: ['landing', 'promo', 'campaign', 'marketing', 'launch', 'product'],
        templates: [
            {
                id: 'landing-modern',
                name: 'Modern Landing',
                style: 'modern',
                layout: 'fullscreen',
                sections: ['hero', 'features', 'benefits', 'testimonials', 'pricing', 'cta', 'footer'],
                colorScheme: ['blue', 'gradient', 'vibrant'],
                description: 'High-converting modern landing page'
            },
            {
                id: 'landing-bold',
                name: 'Bold Landing',
                style: 'bold',
                layout: 'split',
                sections: ['hero', 'features', 'social-proof', 'pricing', 'cta', 'footer'],
                colorScheme: ['black', 'red', 'vibrant'],
                description: 'Bold, attention-grabbing landing page'
            },
            {
                id: 'landing-minimal',
                name: 'Minimal Landing',
                style: 'minimal',
                layout: 'centered',
                sections: ['hero', 'features', 'cta', 'footer'],
                colorScheme: ['monochrome', 'clean', 'simple'],
                description: 'Clean, focused landing page'
            }
        ]
    },
    restaurant: {
        name: 'Restaurant',
        keywords: ['restaurant', 'cafe', 'coffee', 'food', 'dining', 'menu', 'culinary', 'bistro'],
        templates: [
            {
                id: 'restaurant-elegant',
                name: 'Elegant Restaurant',
                style: 'elegant',
                layout: 'fullscreen',
                sections: ['hero', 'about', 'menu', 'gallery', 'reservations', 'contact', 'footer'],
                colorScheme: ['gold', 'brown', 'warm'],
                description: 'Sophisticated restaurant website'
            },
            {
                id: 'restaurant-modern',
                name: 'Modern Restaurant',
                style: 'modern',
                layout: 'grid',
                sections: ['hero', 'menu', 'gallery', 'about', 'reservations', 'contact', 'footer'],
                colorScheme: ['red', 'orange', 'warm'],
                description: 'Contemporary dining experience'
            },
            {
                id: 'restaurant-cozy',
                name: 'Cozy Cafe',
                style: 'classic',
                layout: 'split',
                sections: ['hero', 'menu', 'about', 'gallery', 'contact', 'footer'],
                colorScheme: ['brown', 'beige', 'warm'],
                description: 'Warm, inviting cafe website'
            }
        ]
    },
    saas: {
        name: 'SaaS',
        keywords: ['saas', 'app', 'software', 'platform', 'tool', 'service', 'productivity'],
        templates: [
            {
                id: 'saas-modern',
                name: 'Modern SaaS',
                style: 'modern',
                layout: 'fullscreen',
                sections: ['hero', 'features', 'benefits', 'pricing', 'testimonials', 'cta', 'footer'],
                colorScheme: ['blue', 'purple', 'tech'],
                description: 'Tech-forward SaaS platform'
            },
            {
                id: 'saas-minimal',
                name: 'Minimal SaaS',
                style: 'minimal',
                layout: 'centered',
                sections: ['hero', 'features', 'pricing', 'cta', 'footer'],
                colorScheme: ['monochrome', 'clean', 'simple'],
                description: 'Clean, focused SaaS site'
            },
            {
                id: 'saas-bold',
                name: 'Bold SaaS',
                style: 'bold',
                layout: 'split',
                sections: ['hero', 'features', 'demo', 'pricing', 'testimonials', 'cta', 'footer'],
                colorScheme: ['black', 'gradient', 'vibrant'],
                description: 'Bold, innovative SaaS presence'
            }
        ]
    },
    education: {
        name: 'Education',
        keywords: ['education', 'school', 'course', 'learn', 'tutorial', 'academy', 'university'],
        templates: [
            {
                id: 'education-modern',
                name: 'Modern Education',
                style: 'modern',
                layout: 'grid',
                sections: ['hero', 'courses', 'features', 'testimonials', 'pricing', 'contact', 'footer'],
                colorScheme: ['blue', 'green', 'professional'],
                description: 'Contemporary learning platform'
            },
            {
                id: 'education-classic',
                name: 'Classic Academy',
                style: 'classic',
                layout: 'list',
                sections: ['hero', 'about', 'courses', 'instructors', 'testimonials', 'contact', 'footer'],
                colorScheme: ['brown', 'gray', 'academic'],
                description: 'Traditional academic website'
            }
        ]
    },
    healthcare: {
        name: 'Healthcare',
        keywords: ['health', 'medical', 'clinic', 'hospital', 'doctor', 'wellness', 'therapy'],
        templates: [
            {
                id: 'healthcare-modern',
                name: 'Modern Healthcare',
                style: 'modern',
                layout: 'grid',
                sections: ['hero', 'services', 'doctors', 'about', 'testimonials', 'appointment', 'footer'],
                colorScheme: ['blue', 'teal', 'professional'],
                description: 'Trustworthy medical website'
            },
            {
                id: 'healthcare-elegant',
                name: 'Elegant Clinic',
                style: 'elegant',
                layout: 'split',
                sections: ['hero', 'services', 'team', 'about', 'appointment', 'contact', 'footer'],
                colorScheme: ['teal', 'white', 'clean'],
                description: 'Sophisticated healthcare presence'
            }
        ]
    },
    realestate: {
        name: 'Real Estate',
        keywords: ['real estate', 'property', 'house', 'apartment', 'home', 'realty', 'estate'],
        templates: [
            {
                id: 'realestate-modern',
                name: 'Modern Real Estate',
                style: 'modern',
                layout: 'grid',
                sections: ['hero', 'properties', 'search', 'about', 'agents', 'contact', 'footer'],
                colorScheme: ['blue', 'gray', 'professional'],
                description: 'Property showcase platform'
            },
            {
                id: 'realestate-luxury',
                name: 'Luxury Real Estate',
                style: 'elegant',
                layout: 'fullscreen',
                sections: ['hero', 'featured', 'properties', 'about', 'contact', 'footer'],
                colorScheme: ['gold', 'black', 'elegant'],
                description: 'Premium property showcase'
            }
        ]
    },
    fitness: {
        name: 'Fitness',
        keywords: ['fitness', 'gym', 'workout', 'training', 'health', 'exercise', 'sport'],
        templates: [
            {
                id: 'fitness-bold',
                name: 'Bold Fitness',
                style: 'bold',
                layout: 'fullscreen',
                sections: ['hero', 'programs', 'trainers', 'testimonials', 'pricing', 'contact', 'footer'],
                colorScheme: ['black', 'red', 'vibrant'],
                description: 'Energetic fitness website'
            },
            {
                id: 'fitness-modern',
                name: 'Modern Gym',
                style: 'modern',
                layout: 'grid',
                sections: ['hero', 'classes', 'trainers', 'testimonials', 'pricing', 'contact', 'footer'],
                colorScheme: ['orange', 'black', 'dynamic'],
                description: 'Contemporary fitness center'
            }
        ]
    },
    photography: {
        name: 'Photography',
        keywords: ['photography', 'photographer', 'photo', 'gallery', 'wedding', 'portrait'],
        templates: [
            {
                id: 'photography-minimal',
                name: 'Minimal Photography',
                style: 'minimal',
                layout: 'masonry',
                sections: ['hero', 'gallery', 'about', 'services', 'contact', 'footer'],
                colorScheme: ['monochrome', 'black', 'clean'],
                description: 'Clean photo showcase'
            },
            {
                id: 'photography-creative',
                name: 'Creative Photography',
                style: 'creative',
                layout: 'fullscreen',
                sections: ['hero', 'portfolio', 'about', 'services', 'testimonials', 'contact', 'footer'],
                colorScheme: ['colorful', 'gradient', 'vibrant'],
                description: 'Bold photography portfolio'
            }
        ]
    },
    music: {
        name: 'Music',
        keywords: ['music', 'musician', 'band', 'artist', 'album', 'concert', 'audio'],
        templates: [
            {
                id: 'music-bold',
                name: 'Bold Music',
                style: 'bold',
                layout: 'fullscreen',
                sections: ['hero', 'music', 'about', 'tour', 'merch', 'contact', 'footer'],
                colorScheme: ['black', 'purple', 'vibrant'],
                description: 'Energetic music artist site'
            },
            {
                id: 'music-elegant',
                name: 'Elegant Music',
                style: 'elegant',
                layout: 'split',
                sections: ['hero', 'albums', 'about', 'tour', 'contact', 'footer'],
                colorScheme: ['gold', 'black', 'elegant'],
                description: 'Sophisticated musician website'
            }
        ]
    },
    travel: {
        name: 'Travel',
        keywords: ['travel', 'tourism', 'tour', 'destination', 'vacation', 'adventure'],
        templates: [
            {
                id: 'travel-modern',
                name: 'Modern Travel',
                style: 'modern',
                layout: 'fullscreen',
                sections: ['hero', 'destinations', 'packages', 'testimonials', 'contact', 'footer'],
                colorScheme: ['blue', 'teal', 'vibrant'],
                description: 'Adventure travel website'
            },
            {
                id: 'travel-elegant',
                name: 'Luxury Travel',
                style: 'elegant',
                layout: 'grid',
                sections: ['hero', 'destinations', 'packages', 'about', 'contact', 'footer'],
                colorScheme: ['gold', 'blue', 'elegant'],
                description: 'Premium travel experience'
            }
        ]
    },
    nonprofit: {
        name: 'Nonprofit',
        keywords: ['nonprofit', 'charity', 'foundation', 'donation', 'cause', 'volunteer'],
        templates: [
            {
                id: 'nonprofit-modern',
                name: 'Modern Nonprofit',
                style: 'modern',
                layout: 'centered',
                sections: ['hero', 'mission', 'programs', 'impact', 'donate', 'contact', 'footer'],
                colorScheme: ['green', 'blue', 'warm'],
                description: 'Impactful nonprofit website'
            },
            {
                id: 'nonprofit-warm',
                name: 'Warm Nonprofit',
                style: 'classic',
                layout: 'split',
                sections: ['hero', 'about', 'programs', 'stories', 'donate', 'contact', 'footer'],
                colorScheme: ['orange', 'warm', 'friendly'],
                description: 'Welcoming charity website'
            }
        ]
    },
    law: {
        name: 'Law',
        keywords: ['law', 'lawyer', 'attorney', 'legal', 'law firm', 'justice'],
        templates: [
            {
                id: 'law-professional',
                name: 'Professional Law',
                style: 'elegant',
                layout: 'grid',
                sections: ['hero', 'services', 'attorneys', 'about', 'testimonials', 'contact', 'footer'],
                colorScheme: ['blue', 'gray', 'professional'],
                description: 'Trustworthy law firm website'
            },
            {
                id: 'law-modern',
                name: 'Modern Law',
                style: 'modern',
                layout: 'split',
                sections: ['hero', 'practice-areas', 'attorneys', 'about', 'contact', 'footer'],
                colorScheme: ['navy', 'gold', 'elegant'],
                description: 'Contemporary legal practice'
            }
        ]
    },
    consulting: {
        name: 'Consulting',
        keywords: ['consulting', 'consultant', 'advisory', 'strategy', 'business'],
        templates: [
            {
                id: 'consulting-professional',
                name: 'Professional Consulting',
                style: 'elegant',
                layout: 'grid',
                sections: ['hero', 'services', 'expertise', 'about', 'testimonials', 'contact', 'footer'],
                colorScheme: ['blue', 'gray', 'professional'],
                description: 'Executive consulting website'
            },
            {
                id: 'consulting-modern',
                name: 'Modern Consulting',
                style: 'modern',
                layout: 'split',
                sections: ['hero', 'services', 'case-studies', 'team', 'contact', 'footer'],
                colorScheme: ['purple', 'blue', 'professional'],
                description: 'Contemporary advisory firm'
            }
        ]
    },
    tech: {
        name: 'Technology',
        keywords: ['tech', 'technology', 'startup', 'innovation', 'digital', 'software'],
        templates: [
            {
                id: 'tech-modern',
                name: 'Modern Tech',
                style: 'modern',
                layout: 'fullscreen',
                sections: ['hero', 'products', 'features', 'about', 'careers', 'contact', 'footer'],
                colorScheme: ['blue', 'purple', 'tech'],
                description: 'Cutting-edge tech company'
            },
            {
                id: 'tech-bold',
                name: 'Bold Tech',
                style: 'bold',
                layout: 'split',
                sections: ['hero', 'solutions', 'innovation', 'team', 'contact', 'footer'],
                colorScheme: ['black', 'neon', 'vibrant'],
                description: 'Bold tech startup'
            }
        ]
    },
    fashion: {
        name: 'Fashion',
        keywords: ['fashion', 'style', 'clothing', 'boutique', 'apparel', 'designer'],
        templates: [
            {
                id: 'fashion-elegant',
                name: 'Elegant Fashion',
                style: 'elegant',
                layout: 'fullscreen',
                sections: ['hero', 'collections', 'lookbook', 'about', 'contact', 'footer'],
                colorScheme: ['gold', 'black', 'elegant'],
                description: 'Luxury fashion brand'
            },
            {
                id: 'fashion-modern',
                name: 'Modern Fashion',
                style: 'modern',
                layout: 'grid',
                sections: ['hero', 'collections', 'about', 'contact', 'footer'],
                colorScheme: ['pink', 'black', 'vibrant'],
                description: 'Contemporary fashion label'
            }
        ]
    },
    beauty: {
        name: 'Beauty',
        keywords: ['beauty', 'cosmetics', 'salon', 'spa', 'skincare', 'makeup'],
        templates: [
            {
                id: 'beauty-elegant',
                name: 'Elegant Beauty',
                style: 'elegant',
                layout: 'grid',
                sections: ['hero', 'services', 'gallery', 'about', 'booking', 'contact', 'footer'],
                colorScheme: ['pink', 'gold', 'elegant'],
                description: 'Luxury beauty salon'
            },
            {
                id: 'beauty-modern',
                name: 'Modern Beauty',
                style: 'modern',
                layout: 'split',
                sections: ['hero', 'services', 'products', 'about', 'booking', 'contact', 'footer'],
                colorScheme: ['pink', 'purple', 'vibrant'],
                description: 'Contemporary beauty brand'
            }
        ]
    },
    general: {
        name: 'General',
        keywords: ['website', 'site', 'page', 'general', 'business'],
        templates: [
            {
                id: 'general-modern',
                name: 'Modern Website',
                style: 'modern',
                layout: 'grid',
                sections: ['hero', 'features', 'about', 'contact', 'footer'],
                colorScheme: ['blue', 'gradient', 'modern'],
                description: 'Versatile modern website'
            },
            {
                id: 'general-minimal',
                name: 'Minimal Website',
                style: 'minimal',
                layout: 'centered',
                sections: ['hero', 'about', 'contact', 'footer'],
                colorScheme: ['monochrome', 'clean', 'simple'],
                description: 'Clean, simple website'
            },
            {
                id: 'general-elegant',
                name: 'Elegant Website',
                style: 'elegant',
                layout: 'split',
                sections: ['hero', 'features', 'about', 'contact', 'footer'],
                colorScheme: ['gold', 'brown', 'elegant'],
                description: 'Sophisticated business website'
            }
        ]
    }
};

/**
 * Get template by ID
 * @param {string} templateId - Template ID
 * @returns {Object|null}
 */
export function getTemplateById(templateId) {
    for (const category of Object.values(TEMPLATE_CATEGORIES)) {
        const template = category.templates.find(t => t.id === templateId);
        if (template) return template;
    }
    return null;
}

/**
 * Get templates by category
 * @param {string} categoryKey - Category key
 * @returns {Array}
 */
export function getTemplatesByCategory(categoryKey) {
    const category = TEMPLATE_CATEGORIES[categoryKey];
    return category ? category.templates : [];
}

/**
 * Find category by keyword
 * @param {string} keyword - Keyword to search
 * @returns {string|null} Category key
 */
export function findCategoryByKeyword(keyword) {
    const lower = keyword.toLowerCase();
    for (const [key, category] of Object.entries(TEMPLATE_CATEGORIES)) {
        if (category.keywords.some(kw => lower.includes(kw))) {
            return key;
        }
    }
    return 'general';
}

/**
 * Get all categories
 * @returns {Array}
 */
export function getAllCategories() {
    return Object.entries(TEMPLATE_CATEGORIES).map(([key, category]) => ({
        key,
        name: category.name,
        templateCount: category.templates.length
    }));
}

/**
 * Get all templates
 * @returns {Array}
 */
export function getAllTemplates() {
    const allTemplates = [];
    for (const category of Object.values(TEMPLATE_CATEGORIES)) {
        allTemplates.push(...category.templates);
    }
    return allTemplates;
}

/**
 * Select best template based on analysis
 * @param {Object} analysis - Prompt analysis
 * @returns {Object} Selected template
 */
export function selectTemplate(analysis) {
    const { category, theme, layout } = analysis;
    
    // Find category
    const categoryKey = findCategoryByKeyword(category);
    const categoryData = TEMPLATE_CATEGORIES[categoryKey];
    
    if (!categoryData || categoryData.templates.length === 0) {
        // Fallback to general
        return TEMPLATE_CATEGORIES.general.templates[0];
    }
    
    // Try to match style preference
    const preferredStyle = theme.primary;
    let template = categoryData.templates.find(t => t.style === preferredStyle);
    
    if (!template) {
        // Try to match layout preference
        const preferredLayout = Object.keys(layout).find(k => layout[k] === true);
        template = categoryData.templates.find(t => t.layout === preferredLayout);
    }
    
    // Fallback to first template in category
    return template || categoryData.templates[0];
}
