import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const markdownPath = path.join(root, 'docs', 'DOCUMENTACAO_DO_SISTEMA.md');
const htmlPath = path.join(root, 'docs', 'DOCUMENTACAO_DO_SISTEMA.html');

const markdown = fs.readFileSync(markdownPath, 'utf8');

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

function renderTable(lines) {
  const rows = lines
    .filter((line) => !/^\|\s*-+/.test(line))
    .map((line) => line.trim().replace(/^\||\|$/g, '').split('|').map((cell) => inlineMarkdown(cell.trim())));
  const [head, ...body] = rows;
  return [
    '<table>',
    '<thead><tr>',
    ...head.map((cell) => `<th>${cell}</th>`),
    '</tr></thead>',
    '<tbody>',
    ...body.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`),
    '</tbody></table>',
  ].join('');
}

function renderMarkdown(source) {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let paragraph = [];
  let list = [];
  let code = [];
  let inCode = false;
  let table = [];

  function flushParagraph() {
    if (!paragraph.length) return;
    html.push(`<p>${inlineMarkdown(paragraph.join(' '))}</p>`);
    paragraph = [];
  }

  function flushList() {
    if (!list.length) return;
    html.push(`<ul>${list.map((item) => `<li>${inlineMarkdown(item)}</li>`).join('')}</ul>`);
    list = [];
  }

  function flushCode() {
    if (!code.length) return;
    html.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
    code = [];
  }

  function flushTable() {
    if (!table.length) return;
    html.push(renderTable(table));
    table = [];
  }

  for (const line of lines) {
    if (line.startsWith('```')) {
      flushParagraph();
      flushList();
      flushTable();
      if (inCode) {
        flushCode();
        inCode = false;
      } else {
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      code.push(line);
      continue;
    }

    if (/^\|.*\|$/.test(line.trim())) {
      flushParagraph();
      flushList();
      table.push(line);
      continue;
    }
    flushTable();

    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    const bullet = line.match(/^-\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      list.push(bullet[1]);
      continue;
    }

    paragraph.push(line.trim());
  }

  flushParagraph();
  flushList();
  flushTable();
  flushCode();
  return html.join('\n');
}

const content = renderMarkdown(markdown);
const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Documentacao do Sistema Beelbem Motoboy</title>
  <style>
    @page { margin: 18mm 15mm; }
    body {
      color: #151515;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11.2pt;
      line-height: 1.45;
      margin: 0;
    }
    h1 {
      border-bottom: 3px solid #111;
      font-size: 24pt;
      margin: 0 0 18px;
      padding-bottom: 10px;
    }
    h2 {
      break-after: avoid;
      border-bottom: 1px solid #d7d7d7;
      font-size: 17pt;
      margin: 24px 0 10px;
      padding-bottom: 5px;
    }
    h3 {
      break-after: avoid;
      font-size: 13pt;
      margin: 18px 0 8px;
    }
    p { margin: 7px 0; }
    ul { margin: 7px 0 10px 20px; padding: 0; }
    li { margin: 3px 0; }
    code {
      background: #f2f4f7;
      border: 1px solid #e1e4e8;
      border-radius: 4px;
      font-family: Consolas, 'Courier New', monospace;
      font-size: 9.5pt;
      padding: 1px 4px;
    }
    pre {
      background: #f7f7f7;
      border: 1px solid #ddd;
      border-radius: 6px;
      overflow-wrap: anywhere;
      padding: 10px;
      white-space: pre-wrap;
    }
    pre code {
      background: transparent;
      border: 0;
      padding: 0;
    }
    table {
      border-collapse: collapse;
      font-size: 9.5pt;
      margin: 12px 0;
      width: 100%;
    }
    th, td {
      border: 1px solid #d8d8d8;
      padding: 6px 8px;
      text-align: left;
      vertical-align: top;
    }
    th { background: #f1f3f5; }
    tr { break-inside: avoid; }
  </style>
</head>
<body>
${content}
</body>
</html>`;

fs.writeFileSync(htmlPath, html, 'utf8');
console.log(htmlPath);
