import ofetch from '@/utils/ofetch';
import { load } from 'cheerio';
import cache from '@/utils/cache';
import { Route } from '@/types';
import { parseDate } from '@/utils/parse-date';
import pMap from 'p-map';
import logger from '@/utils/logger';

export const route: Route = {
    path: '/release-notes',
    categories: ['programming'],
    example: '/devin/release-notes',
    parameters: {},
    radar: [
        {
            source: ['docs.devin.ai/release-notes/overview', 'docs.devin.ai/release-notes', 'docs.devin.ai'],
        },
    ],
    name: 'Release Notes',
    maintainers: ['claude'],
    handler,
    url: 'docs.devin.ai/release-notes/overview',
};

async function handler(ctx) {
    const limit = ctx.req.query('limit') ? parseInt(ctx.req.query('limit'), 10) : 20;
    const maxLimit = Math.min(limit, 50); // Cap at 50 items

    const link = 'https://docs.devin.ai/release-notes/overview';
    try {
        const response = await ofetch(link, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; RSSHub/1.0; +https://rsshub.app/)',
            },
        });

        if (!response || typeof response !== 'string' || response.length < 500) {
            throw new Error('Invalid or empty response from Devin release notes page');
        }

        const $ = load(response);

        // Try multiple selectors to find release note entries
        const selectors = [
            'article',
            'section[class*="release"]',
            'div[class*="release"]',
            'div[class*="note"]',
            'div[class*="entry"]',
            'div[class*="post"]',
            'div[class*="item"]',
            '.release-note',
            '.changelog-entry',
            'li',
        ];

        let entries = [];
        for (const selector of selectors) {
            entries = $(selector).toArray();
            if (entries.length > 0) {
                // Filter out entries that don't seem to be release notes
                entries = entries.filter((e) => {
                    const text = $(e).text().toLowerCase();
                    return text.length > 50 && (
                        text.includes('release') ||
                        text.includes('version') ||
                        text.includes('update') ||
                        text.includes('fix') ||
                        text.includes('feature') ||
                        text.includes('improvement') ||
                        text.includes('change')
                    );
                });
                if (entries.length > 0) {
                    break;
                }
            }
        }

        if (entries.length === 0) {
            // Fallback: look for any content that might be release notes
            const content = $('main, article, .content, [class*="content"]').first();
            if (content.length > 0 && content.text().length > 100) {
                entries = [content.get(0)];
            } else {
                throw new Error('No release note entries found on the page');
            }
        }

        // Limit entries
        entries = entries.slice(0, maxLimit);

        const list = entries.map((entry) => {
            const $entry = $(entry);
            // Try to find title
            let title = '';
            const titleSelectors = ['h1', 'h2', 'h3', 'h4', '.title', '[class*="title"]', '[class*="heading"]'];
            for (const titleSelector of titleSelectors) {
                const titleEl = $entry.find(titleSelector).first();
                if (titleEl.length > 0) {
                    title = titleEl.text().trim();
                    break;
                }
            }

            if (!title) {
                // Use first line of text as title
                const text = $entry.text().trim();
                title = text.split('\n')[0].substring(0, 100).trim();
                if (title.length > 50) {
                    title = title.substring(0, 50) + '...';
                }
            }

            // Try to find date
            let pubDate = null;
            const dateSelectors = ['time', '.date', '[class*="date"]', '[class*="time"]'];
            for (const dateSelector of dateSelectors) {
                const dateEl = $entry.find(dateSelector).first();
                if (dateEl.length > 0) {
                    const dateText = dateEl.attr('datetime') || dateEl.text().trim();
                    try {
                        pubDate = parseDate(dateText);
                        break;
                    } catch {
                        // Continue to next selector
                    }
                }
            }

            // Try to find a link to individual release page
            let itemLink = link; // Default to main page
            const linkEl = $entry.find('a[href]').first();
            if (linkEl.length > 0) {
                const href = linkEl.attr('href');
                if (href) {
                    itemLink = href.startsWith('http') ? href : `https://docs.devin.ai${href}`;
                }
            }

            return {
                title: title || 'Devin Release Note',
                link: itemLink,
                pubDate,
                description: $entry.html() || $entry.text(),
                guid: itemLink,
            };
        });

        // Try to fetch full content for individual release pages
        const items = await pMap(
            list,
            async (item) => {
                if (item.link === link) {
                    return item; // Skip if it's the main page
                }

                return await cache.tryGet(item.link, async () => {
                    try {
                        const pageResponse = await ofetch(item.link, {
                            timeout: 8000,
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (compatible; RSSHub/1.0; +https://rsshub.app/)',
                            },
                        });

                        const page$ = load(pageResponse);

                        // Try to get main content
                        const contentSelectors = ['main', 'article', '.content', '[class*="content"]', 'body'];
                        let content = '';
                        for (const contentSelector of contentSelectors) {
                            const contentEl = page$(contentSelector).first();
                            if (contentEl.length > 0 && contentEl.text().length > 100) {
                                content = contentEl.html();
                                break;
                            }
                        }

                        if (content) {
                            item.description = content;
                        }

                        // Try to get better title from the page
                        const pageTitle = page$('h1').first().text().trim() || page$('title').text().trim();
                        if (pageTitle && pageTitle.length > item.title.length) {
                            item.title = pageTitle;
                        }

                        return item;
                    } catch (error) {
                        logger.warn(`Failed to fetch individual release page: ${item.link}`, error);
                        return item; // Return original item if fetching fails
                    }
                }, 60 * 60 * 1000); // Cache for 1 hour
            },
            { concurrency: 3 }
        );

        return {
            title: 'Devin Release Notes',
            link,
            description: 'Latest release notes from Devin AI coding assistant',
            language: 'en',
            item: items,
        };

    } catch (error) {
        logger.error('Failed to fetch Devin release notes:', error);
        // Return a basic feed with error information
        return {
            title: 'Devin Release Notes',
            link,
            description: 'Latest release notes from Devin AI coding assistant',
            language: 'en',
            item: [
                {
                    title: 'Unable to fetch release notes',
                    link,
                    description: `Error fetching release notes: ${error.message}. Please check the source page.`,
                    pubDate: new Date(),
                    guid: `error-${Date.now()}`,
                },
            ],
        };
    }
}