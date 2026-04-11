/**
 * services/share/intents.ts — social deep-link URL builders.
 *
 * Each function returns a URL that opens the target platform's composer
 * pre-filled with the given text + URL. No React, no window access, no
 * side effects — safe to call on the server or in tests.
 *
 * Discord has no web intent, so we expose a plain string to copy into
 * the clipboard instead of a URL.
 */

const enc = (v: string): string => encodeURIComponent(v);

export function twitterIntent(url: string, text: string): string {
    // twitter.com/intent/tweet auto-redirects to x.com — stable for years.
    return `https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(url)}`;
}

export function telegramIntent(url: string, text: string): string {
    return `https://t.me/share/url?url=${enc(url)}&text=${enc(text)}`;
}

export function warpcastIntent(url: string, text: string): string {
    // Warpcast embeds URLs as Frames automatically when they appear in the cast body.
    return `https://warpcast.com/~/compose?text=${enc(`${text}\n${url}`)}`;
}

export function whatsappIntent(url: string, text: string): string {
    return `https://wa.me/?text=${enc(`${text} ${url}`)}`;
}

export function redditIntent(url: string, title: string): string {
    return `https://www.reddit.com/submit?url=${enc(url)}&title=${enc(title)}`;
}

/**
 * Discord has no web composer intent. Return the text the caller should
 * write to the clipboard so the user can paste it into any Discord channel.
 */
export function discordShareText(url: string, text: string): string {
    return `${text}\n${url}`;
}
