// @ts-check
// ── Markdown Parser ──

/**
 * Convert a small markdown subset (headings, bold, italic, bullets) to HTML.
 * @param {string} text raw markdown source
 * @returns {string} HTML markup
 */
export function md(text) {
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  // headings
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  // bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  // italic
  html = html.replace(/\*(.+?)\*/g, '<i>$1</i>');
  // bullet lists
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  // wrap consecutive <li> in <ul>
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');
  // paragraphs: split by blank lines, wrap remaining
  const blocks = html.split(/\n\n+/);
  html = blocks.map(b => {
    b = b.trim();
    if (!b) return '';
    if (/^<(h[12]|ul|ol|li)/.test(b)) return b;
    return '<p>' + b + '</p>';
  }).join('\n');
  return html;
}
