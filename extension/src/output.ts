interface ConversionResult {
  title: string;
  url: string;
  markdown: string;
}

function showError(container: HTMLElement, message: string): void {
  // Use safe DOM construction — no innerHTML with user content
  container.textContent = '';

  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-state';

  const title = document.createElement('p');
  title.className = 'error-title';
  title.textContent = 'Something went wrong';

  const msg = document.createElement('p');
  msg.className = 'error-msg';
  msg.textContent = message;

  errorDiv.appendChild(title);
  errorDiv.appendChild(msg);
  container.appendChild(errorDiv);
}

async function init(): Promise<void> {
  const container = document.getElementById('container') as HTMLElement;
  const outputEl = document.getElementById('output') as HTMLPreElement;
  const sourceUrlEl = document.getElementById('sourceUrl') as HTMLDivElement;
  const copyBtn = document.getElementById('copyBtn') as HTMLButtonElement;

  const key = new URLSearchParams(location.search).get('key');

  if (!key) {
    showError(container, 'No conversion key found in URL. Try converting again.');
    return;
  }

  const stored = await chrome.storage.session.get(key);
  const result = stored[key] as ConversionResult | undefined;

  if (!result) {
    showError(container, 'Conversion result not found. It may have expired — try converting again.');
    return;
  }

  document.title = `${result.title} — Defuddle`;
  sourceUrlEl.textContent = result.url;
  outputEl.textContent = result.markdown;

  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(result.markdown);
      copyBtn.textContent = 'Copied!';
      copyBtn.classList.add('copied');
      setTimeout(() => {
        copyBtn.textContent = 'Copy Markdown';
        copyBtn.classList.remove('copied');
      }, 2000);
    } catch {
      copyBtn.textContent = 'Copy failed';
      setTimeout(() => {
        copyBtn.textContent = 'Copy Markdown';
      }, 2000);
    }
  });
}

init();
