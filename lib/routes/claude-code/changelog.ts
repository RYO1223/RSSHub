import { Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';
import MarkdownIt from 'markdown-it';

const md = new MarkdownIt();

export const route: Route = {
    path: '/changelog',
    categories: ['program-update'],
    example: '/claude-code/changelog',
    parameters: {},
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    name: 'Changelog',
    maintainers: ['claude'],
    handler,
    url: 'https://github.com/anthropics/claude-code',
    radar: [
        {
            source: ['github.com/anthropics/claude-code'],
        },
    ],
};

async function handler() {
    const changelogUrl = 'https://raw.githubusercontent.com/anthropics/claude-code/refs/heads/main/CHANGELOG.md';
    
    const response = await ofetch(changelogUrl);
    const content = response;
    
    // Parse markdown content to extract version entries
    const versionRegex = /^## \[([^\]]+)\] - (\d{4}-\d{2}-\d{2})/gm;
    const items = [];
    
    const matches = Array.from(content.matchAll(versionRegex));
    
    for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        const version = match[1];
        const dateStr = match[2];
        const startIndex = match.index!;
        
        // Find the end of this version section (start of next version or end of file)
        const nextMatch = matches[i + 1];
        const endIndex = nextMatch ? nextMatch.index! : content.length;
        
        // Extract content for this version
        const versionContent = content.substring(startIndex, endIndex).trim();
        
        // Convert markdown to HTML for better display
        const htmlContent = md.render(versionContent);
        
        // Create a clean anchor link for the version
        const anchorId = version.toLowerCase().replace(/[^\w\d]/g, '');
        
        items.push({
            title: `Claude Code ${version}`,
            description: htmlContent,
            link: `https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md#${anchorId}`,
            pubDate: parseDate(dateStr),
            guid: `claude-code-${version}`,
        });
    }
    
    return {
        title: 'Claude Code Changelog',
        link: 'https://github.com/anthropics/claude-code',
        description: 'Latest changes and updates to Claude Code',
        item: items.slice(0, 20), // Limit to last 20 releases
    };
}