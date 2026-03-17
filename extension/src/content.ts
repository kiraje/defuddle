import Defuddle from 'defuddle';
import TurndownService from 'turndown';

// Note: spec included error? field on ConversionResult but it is never populated
// or consumed — omitted here per YAGNI.
interface ConversionResult {
  title: string;
  url: string;
  markdown: string;
  frontmatter: {
    title: string;
    url: string;
    author?: string;
    published?: string;
    description?: string;
    domain: string;
    word_count: number;
  };
}

// IMPORTANT: esbuild --format=iife wraps all code in (() => { ... })()
// The IIFE's return value is discarded by executeScript — it always sees undefined.
// Fix: assign to window.__defuddleResult, then use --footer:js="window.__defuddleResult"
// so that expression is the final evaluated value captured by executeScript.
declare global { interface Window { __defuddleResult: ConversionResult; } }

function buildFrontmatter(fm: ConversionResult['frontmatter']): string {
  const lines = ['---'];
  lines.push(`title: "${fm.title.replace(/"/g, '\\"')}"`);
  lines.push(`url: "${fm.url}"`);
  if (fm.author) lines.push(`author: "${fm.author}"`);
  if (fm.published) lines.push(`published: "${fm.published}"`);
  if (fm.description) lines.push(`description: "${fm.description.replace(/"/g, '\\"')}"`);
  lines.push(`domain: "${fm.domain}"`);
  lines.push(`word_count: ${fm.word_count}`);
  lines.push('---');
  return lines.join('\n');
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

const parsed = new Defuddle(document).parse();
const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
const markdown = td.turndown(parsed.content || document.body.outerHTML);

const fm: ConversionResult['frontmatter'] = {
  title: parsed.title || document.title || '',
  url: location.href,
  domain: location.hostname,
  word_count: countWords(markdown),
};

if (parsed.author) fm.author = parsed.author;
if (parsed.published) fm.published = parsed.published;
if (parsed.description) fm.description = parsed.description;

window.__defuddleResult = {
  title: fm.title,
  url: location.href,
  markdown: buildFrontmatter(fm) + '\n\n' + markdown,
  frontmatter: fm,
};
// window.__defuddleResult is appended as the final expression via --footer:js
// making it the value captured by chrome.scripting.executeScript
