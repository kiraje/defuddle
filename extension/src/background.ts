interface ConversionResult {
  title: string;
  url: string;
  markdown: string;
  frontmatter: object;
}

function showNotification(message: string): void {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title: 'Defuddle',
    message,
  });
}

async function convert(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url) return;

  // executeScript cannot access these URL schemes (spec lists file:// as restricted too)
  const restricted = /^(chrome|about|file|moz-extension|chrome-extension|devtools):/.test(tab.url);
  if (restricted) {
    showNotification("Can't convert this page.");
    return;
  }

  let result: ConversionResult | undefined;

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js'],
    });
    result = results[0]?.result as ConversionResult | undefined;
  } catch {
    showNotification("Can't convert this page.");
    return;
  }

  if (!result) {
    showNotification('Conversion failed — no content extracted.');
    return;
  }

  const key = crypto.randomUUID();
  await chrome.storage.session.set({ [key]: result });
  await chrome.tabs.create({
    url: chrome.runtime.getURL(`output.html?key=${key}`),
  });
}

chrome.action.onClicked.addListener(() => { convert().catch(console.error); });
chrome.commands.onCommand.addListener((command) => {
  if (command === 'convert') convert().catch(console.error);
});
