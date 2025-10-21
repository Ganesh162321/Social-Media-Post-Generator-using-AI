import React from "react";
import { useState } from "react";
import './HomePage.css';
function HomePage() {
    const [formData, setFormData] = useState({
        rawText: "",
        platforms: []
    })

    const [geminiResponse, setGeminiResponse] = useState("");
    const [structuredPosts, setStructuredPosts] = useState([]);

    /**
     * Parse Gemini free-form response into structured [{ platform, post }] entries.
     * This is forgiving: it looks for platform headings and extracts following text as the post
     * until the next platform heading or end of text.
     */
    function parseGeminiResponse(text) {
        if (!text || typeof text !== 'string') return [];

        // Normalize some common separators and remove leading filler sentence
        // e.g., "Okay, here are some social media posts based on the raw text you provided, tailored for..."
        const cleaned = text.replace(/\*\*/g, '');

        // Heuristic: split by occurrences of platform headings like "LinkedIn:", "LinkedIn -", "Platform Name: LinkedIn"
        // We'll capture common platform names by looking for lines that contain words and a colon and treat them as headings.
        const lines = cleaned.split(/\r?\n/).map(l => l.trim()).filter(l => l.length>0);

        const result = [];
        let current = null;

        const headingRegex = /^(?:\*?\*?\s*)?(?:Platform Name:\s*)?([A-Za-z0-9 &()+#'-]{2,30})\s*[:\-–—]?$/i;

        for (let i=0;i<lines.length;i++) {
            const line = lines[i];

            // If line looks like "LinkedIn:" or "**LinkedIn:**" or "Platform Name: LinkedIn"
            const headingMatch = line.match(headingRegex);
            if (headingMatch) {
                // start new entry
                if (current) result.push(current);
                current = { platform: headingMatch[1].trim(), post: '' };
                continue;
            }

            // Some responses put the platform inline like "**LinkedIn:** Platform Name: LinkedIn post: ..."
            // Detect inline "Platform Name: <name>" or "post:" markers
            const inlinePlatform = line.match(/Platform Name:\s*([A-Za-z0-9 &()+#'-]{2,30})/i);
            if (inlinePlatform) {
                if (current) result.push(current);
                current = { platform: inlinePlatform[1].trim(), post: '' };
                // remove the matched portion and continue with remaining text on same line
                const rest = line.replace(inlinePlatform[0], '').trim();
                if (rest) {
                    // If rest contains 'post:' marker, remove it
                    const postText = rest.replace(/^[Pp]ost:\s*/,'').trim();
                    current.post += (current.post? ' ' : '') + postText;
                }
                continue;
            }

            // Detect 'post:' marker
            const postMarker = line.match(/^[Pp]ost:\s*(.*)$/);
            if (postMarker) {
                if (!current) current = { platform: 'Unknown', post: '' };
                current.post += (current.post? ' ' : '') + postMarker[1].trim();
                continue;
            }

            // If the line starts with an uppercase platform name followed by text, e.g. "LinkedIn: post text"
            const inlineHead = line.match(/^([A-Za-z0-9 &()+#'-]{2,30})\s*[:\-–—]\s*(.*)$/);
            if (inlineHead) {
                if (current) result.push(current);
                current = { platform: inlineHead[1].trim(), post: inlineHead[2].trim() };
                continue;
            }

            // Otherwise append to current post text
            if (!current) {
                // Try to see if line starts with a known platform word followed by nothing
                const maybePlatform = line.match(/^([A-Za-z0-9 &()+#'-]{2,30})$/);
                if (maybePlatform) {
                    if (current) result.push(current);
                    current = { platform: maybePlatform[1].trim(), post: '' };
                    continue;
                }
                // ignore filler lines at the top
                continue;
            }

            current.post += (current.post ? ' ' : '') + line;
        }

        if (current) result.push(current);

        // Final cleanup: trim posts and remove image suggestion lines
        return result.map(r => ({
            platform: r.platform,
            post: r.post.replace(/\[?Image Suggestion[:\]]?.*$/i,'').trim()
        })).filter(r => r.post.length>0 || r.platform.length>0);
    }

    async function ContactGemini() {
        try {

            const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
            const options = {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'X-goog-api-key': 'AIzaSyA6AhmA70SA78O3oUPi7InM1AKtgJsqEGk'
                },
                body:
                    JSON.stringify({
                        contents: [
                            {
                                parts: [
                                    {
                                        text: `I want you to generate social media posts based on the raw text: ${formData.rawText} 
                                        for the following platforms: ${formData.platforms.join(", ")}. Make sure tone of the post align with the platform.
                                        Output Structure:
                                        Platform Name: [platformName]
                                        post: [postContent]
                                        `
                                    }
                                ]
                            }
                        ]
                    })

            }

            try {
                const response = await fetch(url, options);
                const data = await response.json();
                    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
                    setGeminiResponse(text);
                    const parsed = parseGeminiResponse(text);
                    setStructuredPosts(parsed);
                    console.log('Gemini Response: ', text, 'Parsed:', parsed);
            } catch (error) {
                console.error(error);
            }
        } catch (error) {
            console.log(error)
        }
    }

    return (
        <div className="home-page">
            <div className="home-container">
                <header className="hp-header">
                    <h1>My Project</h1>
                    <p className="hp-sub">Generate tailored social posts quickly — pick platforms, paste raw text, and hit Gemini.</p>
                </header>

                <form className="hp-form" onSubmit={(e)=>e.preventDefault()}>
                    <label className="label">Enter Raw Text</label>
                    <textarea className="raw-input" name="rawText" id="rawText" rows={10} onChange={e => setFormData({ ...formData, rawText: e.target.value })} value={formData.rawText}></textarea>

                    <label className="label">Platforms</label>
                    <div className="platforms">
                        <label className="platform-option"><input type="checkbox" name="platform" id="Linkedin" value={'Linkedin'} onChange={(e) => {
                            if (e.target.checked) {
                                setFormData({
                                    ...formData,
                                    platforms: [...formData.platforms, e.target.value]
                                })
                            } else if (e.target.checked === false) {
                                setFormData({
                                    ...formData,
                                    platforms: formData.platforms.filter((platform) => platform !== e.target.value)
                                })
                            }
                        }} /> Linkedin</label>

                        <label className="platform-option"><input type="checkbox" name="platform" id="Instagram" value={'Instagram'} onChange={(e) => {
                            if (e.target.checked) {
                                setFormData({
                                    ...formData,
                                    platforms: [...formData.platforms, e.target.value]
                                })
                            } else if (e.target.checked === false) {
                                setFormData({
                                    ...formData,
                                    platforms: formData.platforms.filter((platform) => platform !== e.target.value)
                                })
                            }
                        }} /> Instagram</label>

                        <label className="platform-option"><input type="checkbox" name="platform" id="Twitter" value={'Twitter'} onChange={(e) => {
                            if (e.target.checked) {
                                setFormData({
                                    ...formData,
                                    platforms: [...formData.platforms, e.target.value]
                                })
                            } else if (e.target.checked === false) {
                                setFormData({
                                    ...formData,
                                    platforms: formData.platforms.filter((platform) => platform !== e.target.value)
                                })
                            }
                        }} /> Twitter</label>
                    </div>

                    <div className="actions">
                        <button type="button" className="btn-primary" onClick={() => { ContactGemini() }}>Contact Gemini</button>
                        <button type="button" className="btn-ghost" onClick={() => { setFormData({ rawText: '', platforms: [] }); setGeminiResponse(''); setStructuredPosts([]); }}>Reset</button>
                    </div>
                </form>

                <section className="results">
                    {structuredPosts.length>0 ? (
                        <div>
                            <h3 className="results-title">Generated Posts</h3>
                            <div className="posts-grid">
                                {structuredPosts.map((item, idx) => (
                                    <article key={idx} className="post-card">
                                        <div className="platform"><strong>{item.platform}</strong></div>
                                        <div className="post-text">{item.post}</div>
                                    </article>
                                ))}
                            </div>
                        </div>
                    ) : (
                        geminiResponse.length>0 && (
                            <div>
                                <h3 className="results-title">Raw Response</h3>
                                <pre className="raw-response">{geminiResponse}</pre>
                            </div>
                        )
                    )}
                </section>
            </div>
        </div>
    )
}
export default HomePage;