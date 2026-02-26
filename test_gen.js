
import { generateHtml } from './src/features/Builder/HtmlGenerator.jsx';

// Mock localStorage
global.localStorage = {
    getItem: () => null,
    setItem: () => { },
    removeItem: () => { }
};

async function test() {
    console.log("Generating HTML...");
    try {
        const html = await generateHtml("coffee shop");

        console.log("--- HTML EXTRACT ---");
        // Check for unsplash
        if (html.includes("unsplash.com")) {
            console.log("PASS: Unsplash image found.");
        } else {
            console.error("FAIL: No Unsplash image found.");
        }

        // Check for rgba
        if (html.includes("rgba(var(--primary-rgb)")) {
            console.log("PASS: RGB variable usage found.");
        } else {
            console.error("FAIL: No RGB variable usage found.");
        }

        console.log("--- END ---");
    } catch (e) {
        console.error("ERROR:", e);
    }
}

test();
