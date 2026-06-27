const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 38;
const HEADER_BOTTOM = 92;
const FOOTER_TOP = PAGE_HEIGHT - 34;
const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2);
const IMAGE_LOAD_TIMEOUT_MS = 8000;

const BLUE = [30, 64, 175];
const DARK_BLUE = [15, 45, 120];
const LIGHT_BLUE = [239, 246, 255];
const HEADER_BG = [248, 250, 252];
const BORDER = [203, 213, 225];
const LIGHT_BORDER = [226, 232, 240];
const TEXT = [15, 23, 42];
const MUTED = [71, 85, 105];
const WHITE = [255, 255, 255];

function cleanText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '')
    .trim();
}

function escapePdfText(value) {
  return cleanText(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function normalizeDateKey(value) {
  const raw = String(value || '').trim();
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return '';
}

function formatDate(value) {
  const key = normalizeDateKey(value);
  if (!key) return cleanText(value || '-');
  const [year, month, day] = key.split('-');
  return `${day}/${month}/${year}`;
}

function dateRangeLabel(startDate, endDate) {
  const start = normalizeDateKey(startDate);
  const end = normalizeDateKey(endDate);
  return start && start === end ? formatDate(start) : `${formatDate(start)} a ${formatDate(end)}`;
}

function dayDiff(startDate, endDate) {
  const start = normalizeDateKey(startDate);
  const end = normalizeDateKey(endDate);
  if (!start || !end) return null;
  const startTime = new Date(`${start}T00:00:00`).getTime();
  const endTime = new Date(`${end}T00:00:00`).getTime();
  return Math.max(0, Math.round((endTime - startTime) / 86400000) + 1);
}

function todayLabel() {
  return formatDate(new Date().toISOString().slice(0, 10));
}

function bestPhotoUrl(photo) {
  return photo.thumbnailUrl || photo.photoUrl || '';
}

function splitLines(value) {
  return String(value || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function wrapText(text, maxWidth, size) {
  const words = cleanText(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  const charWidth = size * 0.52;

  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (next.length * charWidth <= maxWidth) {
      line = next;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  });
  if (line) lines.push(line);
  return lines.length ? lines : ['-'];
}

function rgb(values) {
  return values.map((value) => (value / 255).toFixed(3)).join(' ');
}

class PdfDocument {
  constructor(headerInfo = {}) {
    this.headerInfo = headerInfo;
    this.objects = [null];
    this.pages = [];
    this.rootObj = this.reserve();
    this.pagesObj = this.reserve();
    this.fontRegularObj = this.reserve();
    this.fontBoldObj = this.reserve();
    this.setObject(this.fontRegularObj, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    this.setObject(this.fontBoldObj, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
    this.current = null;
    this.y = HEADER_BOTTOM + 18;
    this.newPage();
  }

  reserve() {
    this.objects.push(null);
    return this.objects.length - 1;
  }

  setObject(id, body) {
    this.objects[id] = body;
  }

  newPage() {
    this.current = { ops: [], images: new Map() };
    this.pages.push(this.current);
    this.y = HEADER_BOTTOM + 18;
    this.reportHeader();
  }

  ensure(height) {
    if (this.y + height <= FOOTER_TOP) return;
    this.newPage();
  }

  fillRect(x, y, width, height, color) {
    this.current.ops.push(`${rgb(color)} rg ${x.toFixed(2)} ${(PAGE_HEIGHT - y - height).toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re f`);
  }

  strokeRect(x, y, width, height, color = BORDER) {
    this.current.ops.push(`${rgb(color)} RG ${x.toFixed(2)} ${(PAGE_HEIGHT - y - height).toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re S`);
  }

  line(x1, y1, x2, y2, color = BORDER) {
    this.current.ops.push(`${rgb(color)} RG ${x1.toFixed(2)} ${(PAGE_HEIGHT - y1).toFixed(2)} m ${x2.toFixed(2)} ${(PAGE_HEIGHT - y2).toFixed(2)} l S`);
  }

  text(x, y, value, size = 10, bold = false, color = TEXT) {
    const font = bold ? 'F2' : 'F1';
    this.current.ops.push(`${rgb(color)} rg BT /${font} ${size} Tf ${x.toFixed(2)} ${(PAGE_HEIGHT - y).toFixed(2)} Td (${escapePdfText(value)}) Tj ET`);
  }

  textRight(xRight, y, value, size = 10, bold = false, color = TEXT) {
    const text = cleanText(value);
    const width = text.length * size * 0.52;
    this.text(xRight - width, y, text, size, bold, color);
  }

  wrappedText(x, y, value, width, size = 10, bold = false, lineGap = 4, color = TEXT) {
    let cursor = y;
    wrapText(value, width, size).forEach((line) => {
      this.text(x, cursor, line, size, bold, color);
      cursor += size + lineGap;
    });
    return cursor;
  }

  reportHeader() {
    const { companyName, companyAddress, companyContact, generatedAt, logoImage } = this.headerInfo;
    const textX = logoImage ? MARGIN + 106 : MARGIN;
    this.fillRect(0, 0, PAGE_WIDTH, HEADER_BOTTOM - 10, HEADER_BG);
    if (logoImage) {
      const maxWidth = 92;
      const maxHeight = 58;
      const fit = Math.min(maxWidth / logoImage.width, maxHeight / logoImage.height);
      const width = Math.max(1, logoImage.width * fit);
      const height = Math.max(1, logoImage.height * fit);
      this.addImage(logoImage, MARGIN, 10 + ((maxHeight - height) / 2), width, height);
    }
    this.text(textX, 25, companyName || 'Empresa nao informada', 10.5, true, TEXT);
    this.text(textX, 43, companyAddress || 'Endereco da empresa nao informado', 8.5, false, MUTED);
    this.text(textX, 59, companyContact || 'Contato da empresa nao informado', 8.5, false, MUTED);
    this.textRight(PAGE_WIDTH - MARGIN, 74, generatedAt || todayLabel(), 8.5, false, MUTED);
    this.line(MARGIN, HEADER_BOTTOM - 10, PAGE_WIDTH - MARGIN, HEADER_BOTTOM - 10, LIGHT_BORDER);
  }

  title(title, subtitle) {
    this.ensure(54);
    this.text(MARGIN, this.y, title, 15, true, DARK_BLUE);
    this.y += 18;
    if (subtitle) {
      this.text(MARGIN, this.y, subtitle, 8.5, false, MUTED);
      this.y += 14;
    }
    this.line(MARGIN, this.y, PAGE_WIDTH - MARGIN, this.y, LIGHT_BORDER);
    this.y += 18;
  }

  section(title) {
    this.ensure(28);
    this.text(MARGIN, this.y, title, 11, true, DARK_BLUE);
    this.line(MARGIN, this.y + 6, PAGE_WIDTH - MARGIN, this.y + 6, LIGHT_BORDER);
    this.y += 22;
  }

  paragraph(value) {
    this.ensure(32);
    this.y = this.wrappedText(MARGIN, this.y, value || '-', CONTENT_WIDTH, 9, false, 4, TEXT) + 4;
  }

  infoGrid(items, columns = 2) {
    const gap = 8;
    const cellWidth = (CONTENT_WIDTH - (gap * (columns - 1))) / columns;
    for (let index = 0; index < items.length; index += columns) {
      const row = items.slice(index, index + columns);
      const heights = row.map((item) => {
        const valueLines = wrapText(item.value || '-', cellWidth - 14, 8.8);
        return Math.max(44, 28 + (valueLines.length * 11));
      });
      const rowHeight = Math.max(...heights);
      this.ensure(rowHeight + 6);
      row.forEach((item, offset) => {
        const x = MARGIN + (offset * (cellWidth + gap));
        this.fillRect(x, this.y, cellWidth, rowHeight, WHITE);
        this.strokeRect(x, this.y, cellWidth, rowHeight, LIGHT_BORDER);
        this.text(x + 7, this.y + 13, item.label, 7.5, true, MUTED);
        this.wrappedText(x + 7, this.y + 29, item.value || '-', cellWidth - 14, 8.8, item.bold !== false, 3, TEXT);
      });
      this.y += rowHeight + 6;
    }
  }

  table(headers, rows, widths) {
    const normalizedRows = rows.length ? rows : [headers.map(() => '-')];
    const drawHeader = () => {
      this.ensure(22);
      let x = MARGIN;
      this.fillRect(MARGIN, this.y, CONTENT_WIDTH, 20, LIGHT_BLUE);
      headers.forEach((header, index) => {
        this.strokeRect(x, this.y, widths[index], 20, LIGHT_BORDER);
        this.text(x + 5, this.y + 13, header, 7.8, true, DARK_BLUE);
        x += widths[index];
      });
      this.y += 20;
    };

    drawHeader();
    normalizedRows.forEach((row, rowIndex) => {
      const cellLines = row.map((value, index) => wrapText(value || '-', widths[index] - 10, 8));
      const rowHeight = Math.max(22, ...cellLines.map((lines) => 10 + (lines.length * 10)));
      if (this.y + rowHeight > FOOTER_TOP) {
        this.newPage();
        drawHeader();
      }
      let x = MARGIN;
      if (rowIndex % 2 === 1) this.fillRect(MARGIN, this.y, CONTENT_WIDTH, rowHeight, [252, 252, 253]);
      cellLines.forEach((lines, index) => {
        this.strokeRect(x, this.y, widths[index], rowHeight, LIGHT_BORDER);
        lines.forEach((line, lineIndex) => {
          this.text(x + 5, this.y + 13 + (lineIndex * 10), line, 8, false, TEXT);
        });
        x += widths[index];
      });
      this.y += rowHeight;
    });
    this.y += 14;
  }

  addImage(imageSource, x, y, width, height) {
    const dataUrl = typeof imageSource === 'string' ? imageSource : imageSource?.dataUrl;
    const imageWidth = typeof imageSource === 'string' ? Math.round(width) : imageSource?.width || Math.round(width);
    const imageHeight = typeof imageSource === 'string' ? Math.round(height) : imageSource?.height || Math.round(height);
    const match = String(dataUrl || '').match(/^data:image\/jpeg;base64,(.+)$/);
    if (!match) return;
    const binary = atob(match[1]);
    let hex = '';
    for (let index = 0; index < binary.length; index += 1) {
      hex += binary.charCodeAt(index).toString(16).padStart(2, '0');
    }
    const name = `Im${this.current.images.size + 1}`;
    const obj = this.reserve();
    this.setObject(
      obj,
      `<< /Type /XObject /Subtype /Image /Width ${Math.round(imageWidth)} /Height ${Math.round(imageHeight)} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter [/ASCIIHexDecode /DCTDecode] /Length ${hex.length + 1} >>\nstream\n${hex}>\nendstream`,
    );
    this.current.images.set(name, obj);
    this.current.ops.push(`q ${width.toFixed(2)} 0 0 ${height.toFixed(2)} ${x.toFixed(2)} ${(PAGE_HEIGHT - y - height).toFixed(2)} cm /${name} Do Q`);
  }

  photoBox(imageData, x, y, width, height) {
    this.fillRect(x, y, width, height, [241, 245, 249]);
    this.strokeRect(x, y, width, height, LIGHT_BORDER);
    if (!imageData) {
      this.text(x + 24, y + (height / 2), 'Imagem indisponivel', 8, false, MUTED);
      return;
    }
    const fit = Math.min(width / imageData.width, height / imageData.height);
    const drawWidth = Math.max(1, imageData.width * fit);
    const drawHeight = Math.max(1, imageData.height * fit);
    this.addImage(
      imageData,
      x + ((width - drawWidth) / 2),
      y + ((height - drawHeight) / 2),
      drawWidth,
      drawHeight,
    );
  }

  signature(label) {
    this.ensure(68);
    this.y += 16;
    const width = 220;
    const x = MARGIN;
    this.line(x, this.y, x + width, this.y, MUTED);
    this.text(x, this.y + 15, label || 'Responsavel', 8.5, false, MUTED);
    this.y += 36;
  }

  build() {
    this.pages.forEach((page, index) => {
      page.ops.push(`${rgb(MUTED)} rg BT /F1 8 Tf ${(PAGE_WIDTH - MARGIN - 52).toFixed(2)} ${(PAGE_HEIGHT - 50).toFixed(2)} Td (Pagina ${index + 1}/${this.pages.length}) Tj ET`);
      page.ops.push(`${rgb(LIGHT_BORDER)} RG ${MARGIN.toFixed(2)} ${(PAGE_HEIGHT - FOOTER_TOP + 4).toFixed(2)} m ${(PAGE_WIDTH - MARGIN).toFixed(2)} ${(PAGE_HEIGHT - FOOTER_TOP + 4).toFixed(2)} l S`);
    });

    const pageRefs = this.pages.map((page) => {
      const content = `${page.ops.join('\n')}\n`;
      const contentObj = this.reserve();
      this.setObject(contentObj, `<< /Length ${content.length} >>\nstream\n${content}endstream`);
      const xObjects = [...page.images.entries()].map(([name, obj]) => `/${name} ${obj} 0 R`).join(' ');
      const resources = `<< /Font << /F1 ${this.fontRegularObj} 0 R /F2 ${this.fontBoldObj} 0 R >>${xObjects ? ` /XObject << ${xObjects} >>` : ''} >>`;
      const pageObj = this.reserve();
      this.setObject(pageObj, `<< /Type /Page /Parent ${this.pagesObj} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources ${resources} /Contents ${contentObj} 0 R >>`);
      return pageObj;
    });

    this.setObject(this.pagesObj, `<< /Type /Pages /Kids [${pageRefs.map((ref) => `${ref} 0 R`).join(' ')}] /Count ${pageRefs.length} >>`);
    this.setObject(this.rootObj, `<< /Type /Catalog /Pages ${this.pagesObj} 0 R >>`);

    let pdf = '%PDF-1.4\n%----\n';
    const offsets = [0];
    for (let index = 1; index < this.objects.length; index += 1) {
      offsets[index] = pdf.length;
      pdf += `${index} 0 obj\n${this.objects[index]}\nendobj\n`;
    }
    const xref = pdf.length;
    pdf += `xref\n0 ${this.objects.length}\n0000000000 65535 f \n`;
    for (let index = 1; index < this.objects.length; index += 1) {
      pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${this.objects.length} /Root ${this.rootObj} 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return new Blob([pdf], { type: 'application/pdf' });
  }
}

async function imageToJpegDataUrl(url, maxWidth = 720, maxHeight = 520) {
  if (!url) return '';
  let objectUrl = '';
  const controller = new AbortController();
  const fetchTimeout = window.setTimeout(() => controller.abort(), IMAGE_LOAD_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      cache: 'force-cache',
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Imagem indisponivel (${response.status}).`);
    objectUrl = URL.createObjectURL(await response.blob());
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      const imageTimeout = window.setTimeout(
        () => reject(new Error('Tempo limite ao processar imagem.')),
        IMAGE_LOAD_TIMEOUT_MS,
      );
      img.onload = () => {
        window.clearTimeout(imageTimeout);
        resolve(img);
      };
      img.onerror = () => {
        window.clearTimeout(imageTimeout);
        reject(new Error('Nao foi possivel processar a imagem.'));
      };
      img.src = objectUrl;
    });
    const scale = Math.min(1, maxWidth / image.naturalWidth, maxHeight / image.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return {
      dataUrl: canvas.toDataURL('image/jpeg', 0.78),
      width: canvas.width,
      height: canvas.height,
    };
  } finally {
    window.clearTimeout(fetchTimeout);
    controller.abort();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

async function preloadReportImages(report) {
  const urls = new Set([
    ...collectPhotos(report).map(bestPhotoUrl),
    ...(report.payload?.checklistPhotos || []).map(bestPhotoUrl),
  ].filter(Boolean));

  const entries = await Promise.all([...urls].map(async (url) => {
    try {
      return [url, await imageToJpegDataUrl(url)];
    } catch {
      return [url, ''];
    }
  }));

  return new Map(entries);
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function safeFileName(value) {
  return cleanText(value).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'rdo';
}

function collectPhotos(report) {
  const groups = report.payload?.groupedPhotos || [];
  if (groups.length) {
    return groups.flatMap((group) => (
      (group.photos || []).map((photo) => ({
        ...photo,
        stageName: photo.stageName || group.stageName || '',
        subitemName: photo.subitemName || group.subitemName || '',
      }))
    ));
  }
  return report.payload?.photos || [];
}

function groupPhotosByDateAndSchedule(report) {
  const grouped = new Map();
  collectPhotos(report).forEach((photo) => {
    const dateKey = normalizeDateKey(photo.data || photo.createdAt || photo.updatedAt) || 'sem-data';
    const scheduleKey = [photo.stageName || photo.etapa || 'Sem etapa', photo.subitemName || ''].filter(Boolean).join(' / ');
    if (!grouped.has(dateKey)) grouped.set(dateKey, new Map());
    const schedules = grouped.get(dateKey);
    if (!schedules.has(scheduleKey)) schedules.set(scheduleKey, []);
    schedules.get(scheduleKey).push(photo);
  });

  return [...grouped.entries()]
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([date, schedules]) => ({
      date,
      schedules: [...schedules.entries()].map(([title, photos]) => ({ title, photos })),
    }));
}

function collectActivityDates(report) {
  const dates = new Set();
  (report.payload?.logs || []).forEach((log) => dates.add(normalizeDateKey(log.visitDate)));
  (report.payload?.openIssues || []).forEach((issue) => dates.add(normalizeDateKey(issue.updatedAt || issue.createdAt || issue.prazo)));
  (report.payload?.checklistResults || []).forEach((result) => dates.add(normalizeDateKey(result.checkedAt || result.updatedAt || result.createdAt)));
  collectPhotos(report).forEach((photo) => dates.add(normalizeDateKey(photo.data || photo.createdAt || photo.updatedAt)));
  dates.delete('');
  if (!dates.size && normalizeDateKey(report.startDate || report.reportDate)) dates.add(normalizeDateKey(report.startDate || report.reportDate));
  return [...dates].sort();
}

function scheduleBounds(scheduleItems) {
  const dates = (scheduleItems || [])
    .filter((item) => item.visible !== false)
    .flatMap((item) => [item.inicioPrevisto, item.fimPrevisto, item.inicioReal, item.fimReal])
    .map(normalizeDateKey)
    .filter(Boolean)
    .sort();
  return {
    start: dates[0] || '',
    end: dates[dates.length - 1] || '',
  };
}

function buildProjectData({ report, account, project }) {
  const scheduleItems = report.payload?.scheduleItems || [];
  const bounds = scheduleBounds(scheduleItems);
  const totalDays = dayDiff(bounds.start, bounds.end);
  const elapsedDays = bounds.start ? dayDiff(bounds.start, report.endDate || report.reportDate) : null;
  const remainingDays = totalDays === null || elapsedDays === null ? null : Math.max(0, totalDays - elapsedDays);
  return [
    { label: 'Proprietario', value: project?.cliente || 'Nao informado' },
    { label: 'CEP', value: project?.cep || 'Nao informado' },
    { label: 'Endereco', value: project?.endereco || 'Nao informado', bold: false },
    { label: 'Numero', value: project?.numero || 'Nao informado' },
    { label: 'Quadra / lote', value: [project?.quadra ? `Quadra ${project.quadra}` : '', project?.lote ? `Lote ${project.lote}` : ''].filter(Boolean).join(' - ') || 'Nao informado' },
    { label: 'Bairro', value: project?.bairro || 'Nao informado' },
    { label: 'Cidade', value: project?.cidade || 'Nao informado' },
    { label: 'Inicio', value: formatDate(bounds.start || project?.inicio || '') },
    { label: 'Previsao de termino', value: formatDate(bounds.end || project?.previsaoTermino || '') },
    { label: 'Prazo (dias)', value: totalDays === null ? '-' : String(totalDays) },
    { label: 'Tempo decorrido', value: elapsedDays === null ? '-' : String(elapsedDays) },
    { label: 'Saldo prazo', value: remainingDays === null ? '-' : String(remainingDays) },
    { label: 'Observacoes', value: project?.observacoes || report.resumo || 'Sem observacoes', bold: false },
  ];
}

function buildDateRows(report) {
  const photos = collectPhotos(report);
  const logs = report.payload?.logs || [];
  const issues = report.payload?.openIssues || [];
  return collectActivityDates(report).map((date) => {
    const logCount = logs.filter((log) => normalizeDateKey(log.visitDate) === date).length;
    const photoCount = photos.filter((photo) => normalizeDateKey(photo.data || photo.createdAt || photo.updatedAt) === date).length;
    const issueCount = issues.filter((issue) => normalizeDateKey(issue.updatedAt || issue.createdAt || issue.prazo) === date).length;
    const parts = [
      logCount ? `${logCount} registro(s) de diario` : '',
      photoCount ? `${photoCount} foto(s)` : '',
      issueCount ? `${issueCount} ocorrencia(s)` : '',
    ].filter(Boolean);
    return [formatDate(date), parts.join(' - ') || 'Sem movimentacao detalhada'];
  });
}

function buildTaskRows(report) {
  const logs = report.payload?.logs || [];
  if (!logs.length) return [];
  return logs.map((log) => [
    formatDate(log.visitDate),
    log.itemLabel || 'Cronograma',
    log.observacoes || log.checklist || 'Registro diario da obra',
    '',
  ]);
}

function buildOccurrenceRows(report) {
  const rows = [];
  (report.payload?.openIssues || []).forEach((issue) => {
    rows.push([
      formatDate(issue.updatedAt || issue.createdAt || issue.prazo),
      `${issue.etapa || 'Pendencia'}: ${issue.descricao || issue.status || 'Ocorrencia registrada'}`,
    ]);
  });
  splitLines(report.ocorrencias).forEach((line) => rows.push(['-', line]));
  return rows;
}

function buildImageRows(report) {
  return groupPhotosByDateAndSchedule(report).flatMap((dateGroup) => (
    dateGroup.schedules.map((schedule) => [
      formatDate(dateGroup.date),
      `${schedule.title} - ${schedule.photos.length} foto(s)`,
    ])
  ));
}

function buildChecklistRows(report) {
  return (report.payload?.checklistResults || [])
    .filter((result) => result.checked !== false)
    .map((result) => [
      formatDate(result.checkedAt || result.updatedAt || result.createdAt),
      result.itemLabel || result.subitemName || 'Subitem nao informado',
      result.checklistItemText || result.checklistTitle || 'Item conferido',
      'Conferido',
    ]);
}

function checklistPhotoGroups(report) {
  const grouped = new Map();
  (report.payload?.checklistPhotos || []).forEach((photo) => {
    const title = [
      photo.stageName || 'Sem etapa',
      photo.subitemName,
      photo.checklistItemText || photo.checklistTitle,
    ].filter(Boolean).join(' / ');
    if (!grouped.has(title)) grouped.set(title, []);
    grouped.get(title).push(photo);
  });
  return [...grouped.entries()].map(([title, photos]) => ({ title, photos }));
}

async function companyHeader(account) {
  let logoImage = '';
  if (account?.logoUrl) {
    try {
      logoImage = await imageToJpegDataUrl(account.logoUrl, 320, 160);
    } catch {
      logoImage = '';
    }
  }
  return {
    companyName: account?.nome || 'Empresa nao informada',
    companyAddress: [account?.endereco, account?.cidade].filter(Boolean).join(' - ') || 'Endereco da empresa nao informado',
    companyContact: [account?.email, account?.documento ? `CNPJ/CPF: ${account.documento}` : '', account?.telefone].filter(Boolean).join(' - ') || 'Contato da empresa nao informado',
    generatedAt: todayLabel(),
    logoImage,
  };
}

async function renderPhotoPages(doc, report, preparedImages) {
  const groupsByDate = groupPhotosByDateAndSchedule(report);
  if (!groupsByDate.length) return;

  for (const dateGroup of groupsByDate) {
    doc.newPage();
    doc.title('Registro fotografico', formatDate(dateGroup.date));

    for (const schedule of dateGroup.schedules) {
      doc.ensure(34);
      doc.text(MARGIN, doc.y, schedule.title, 10, true, DARK_BLUE);
      doc.y += 16;

      let column = 0;
      const gap = 12;
      const cardWidth = (CONTENT_WIDTH - gap) / 2;
      const imageHeight = 118;
      const cardHeight = 154;

      for (const photo of schedule.photos) {
        if (column === 0) doc.ensure(cardHeight + 8);
        const x = MARGIN + (column * (cardWidth + gap));
        const y = doc.y;
        const imageUrl = bestPhotoUrl(photo);
        const imageData = preparedImages.get(imageUrl) || '';
        doc.photoBox(imageData, x, y, cardWidth, imageHeight);
        doc.wrappedText(x, y + imageHeight + 13, photo.fileName || photo.observacao || 'Registro fotografico', cardWidth, 7.6, false, 2, MUTED);
        column += 1;
        if (column >= 2) {
          column = 0;
          doc.y += cardHeight + 8;
        }
      }
      if (column !== 0) doc.y += cardHeight + 8;
      doc.y += 4;
    }
  }
}

async function renderChecklistPhotoPages(doc, report, preparedImages) {
  const groups = checklistPhotoGroups(report);
  if (!groups.length) return;

  doc.newPage();
  doc.title('Fotos dos checklists', `${groups.reduce((total, group) => total + group.photos.length, 0)} foto(s)`);

  for (const group of groups) {
    doc.ensure(34);
    doc.text(MARGIN, doc.y, group.title, 10, true, DARK_BLUE);
    doc.y += 16;

    let column = 0;
    const gap = 12;
    const cardWidth = (CONTENT_WIDTH - gap) / 2;
    const imageHeight = 118;
    const cardHeight = 144;

    for (const photo of group.photos) {
      if (column === 0) doc.ensure(cardHeight + 8);
      const x = MARGIN + (column * (cardWidth + gap));
      const y = doc.y;
      const imageData = preparedImages.get(bestPhotoUrl(photo)) || '';
      doc.photoBox(imageData, x, y, cardWidth, imageHeight);
      doc.text(x, y + imageHeight + 13, formatDate(photo.createdAt), 7.6, false, MUTED);
      column += 1;
      if (column >= 2) {
        column = 0;
        doc.y += cardHeight + 8;
      }
    }
    if (column !== 0) doc.y += cardHeight + 8;
    doc.y += 4;
  }
}

export async function generateRdoPdf({ report, account, project }) {
  const [headerInfo, preparedImages] = await Promise.all([
    companyHeader(account),
    preloadReportImages(report),
  ]);
  const doc = new PdfDocument(headerInfo);
  const period = dateRangeLabel(report.startDate || report.reportDate, report.endDate || report.reportDate);
  const title = report.titulo || `RDO - ${project?.nome || 'Obra'} - ${period}`;

  doc.title('RELATORIO DIARIO DE OBRA', title);

  doc.section('Dados da obra');
  doc.infoGrid(buildProjectData({ report, account, project }));

  doc.section('Data / Descricao');
  doc.table(['Data', 'Descricao'], buildDateRows(report), [110, CONTENT_WIDTH - 110]);

  doc.section('Turno / Tempo');
  doc.table(['Data', 'Manha', 'Tarde', 'Noite'], collectActivityDates(report).map((date) => [formatDate(date), '-', '-', '-']), [130, 129, 130, 130]);

  if (report.equipe) {
    doc.section('Equipe / mao de obra');
    doc.paragraph(report.equipe);
  }

  doc.section('Tarefas');
  doc.table(['Data', 'Fase/Servico', 'Descricao', 'Medicao'], buildTaskRows(report), [82, 150, 227, 60]);

  if (report.payload?.checklistResults?.length) {
    doc.section('Checklist tecnico');
    doc.table(['Data', 'Subitem', 'Item verificado', 'Status'], buildChecklistRows(report), [78, 150, 231, 60]);
  }

  doc.section('Ocorrencias');
  doc.table(['Data', 'Descricao'], buildOccurrenceRows(report), [110, CONTENT_WIDTH - 110]);

  doc.section('Imagens');
  doc.table(['Data', 'Descricao'], buildImageRows(report), [110, CONTENT_WIDTH - 110]);

  await renderPhotoPages(doc, report, preparedImages);
  await renderChecklistPhotoPages(doc, report, preparedImages);

  doc.section('Assinatura');
  doc.signature('Responsavel');

  const blob = doc.build();
  downloadBlob(blob, `${safeFileName(title)}.pdf`);
}
