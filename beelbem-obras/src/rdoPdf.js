const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 38;
const BLUE = [30, 64, 175];
const LIGHT_BLUE = [239, 246, 255];
const BORDER = [203, 213, 225];
const TEXT = [15, 23, 42];
const MUTED = [71, 85, 105];

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

function formatDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : cleanText(value || '-');
}

function dateRangeLabel(startDate, endDate) {
  return startDate === endDate ? formatDate(startDate) : `${formatDate(startDate)} a ${formatDate(endDate)}`;
}

function bestPhotoUrl(photo) {
  return photo.thumbnailUrl || photo.photoUrl || '';
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
  constructor() {
    this.objects = [null];
    this.pages = [];
    this.rootObj = this.reserve();
    this.pagesObj = this.reserve();
    this.fontRegularObj = this.reserve();
    this.fontBoldObj = this.reserve();
    this.setObject(this.fontRegularObj, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    this.setObject(this.fontBoldObj, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
    this.current = null;
    this.y = MARGIN;
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
    this.y = MARGIN;
  }

  ensure(height) {
    if (this.y + height <= PAGE_HEIGHT - 54) return;
    this.newPage();
    this.smallHeader();
  }

  smallHeader() {
    this.fillRect(MARGIN, 24, PAGE_WIDTH - (MARGIN * 2), 22, LIGHT_BLUE);
    this.text(MARGIN + 10, 39, 'RDO - Relatorio Diario de Obra', 9, true, BLUE);
    this.y = 58;
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

  wrappedText(x, y, value, width, size = 10, bold = false, lineGap = 4, color = TEXT) {
    let cursor = y;
    wrapText(value, width, size).forEach((line) => {
      this.text(x, cursor, line, size, bold, color);
      cursor += size + lineGap;
    });
    return cursor;
  }

  section(title) {
    this.ensure(44);
    this.fillRect(MARGIN, this.y, PAGE_WIDTH - (MARGIN * 2), 22, BLUE);
    this.text(MARGIN + 10, this.y + 15, title, 10, true, [255, 255, 255]);
    this.y += 32;
  }

  field(label, value, width = PAGE_WIDTH - (MARGIN * 2)) {
    this.ensure(26);
    this.text(MARGIN, this.y, `${label}:`, 9, true, MUTED);
    const nextY = this.wrappedText(MARGIN + 112, this.y, value || '-', width - 112, 9, false, 3, TEXT);
    this.y = Math.max(this.y + 17, nextY);
  }

  paragraph(value) {
    this.ensure(32);
    this.y = this.wrappedText(MARGIN, this.y, value || '-', PAGE_WIDTH - (MARGIN * 2), 9.5, false, 4, TEXT) + 4;
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

  build() {
    this.pages.forEach((page, index) => {
      page.ops.push(`${rgb(MUTED)} rg BT /F1 8 Tf ${(PAGE_WIDTH - MARGIN - 54).toFixed(2)} 24 Td (Pagina ${index + 1}/${this.pages.length}) Tj ET`);
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

    let pdf = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
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

async function imageToJpegDataUrl(url, maxWidth = 900, maxHeight = 650) {
  if (!url) return '';
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
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

export async function generateRdoPdf({ report, account, project }) {
  const doc = new PdfDocument();
  const period = dateRangeLabel(report.startDate || report.reportDate, report.endDate || report.reportDate);
  const companyName = account?.nome || 'Empresa nao informada';
  const title = report.titulo || `RDO - ${project?.nome || 'Obra'} - ${period}`;

  doc.fillRect(0, 0, PAGE_WIDTH, 72, BLUE);
  doc.text(MARGIN, 30, 'RELATORIO DIARIO DE OBRA - RDO', 15, true, [255, 255, 255]);
  doc.text(MARGIN, 51, period, 10, false, [219, 234, 254]);
  doc.y = 92;

  doc.section('1. CABECALHO');
  doc.field('Empresa', companyName);
  doc.field('CPF/CNPJ', account?.documento || 'Nao informado');
  doc.field('Responsavel', account?.responsavel || project?.responsavel || 'Nao informado');
  doc.field('Contato', [account?.telefone, account?.email].filter(Boolean).join(' - ') || 'Nao informado');
  doc.field('Endereco empresa', [account?.endereco, account?.cidade].filter(Boolean).join(' - ') || 'Nao informado');
  doc.field('Obra', project?.nome || 'Nao informada');
  doc.field('Cliente', project?.cliente || 'Nao informado');
  doc.field('Endereco obra', [project?.endereco, project?.bairro, project?.cidade].filter(Boolean).join(' - ') || 'Nao informado');
  doc.field('Periodo', period);

  doc.section('2. RESUMO DO PERIODO');
  doc.field('Titulo', title);
  doc.field('Clima', report.clima || 'Nao informado');
  doc.paragraph(report.resumo || 'Sem resumo informado.');

  doc.section('3. MAO DE OBRA');
  doc.paragraph(report.equipe || 'Nao informado.');

  doc.section('4. SERVICOS EXECUTADOS');
  doc.paragraph(report.servicosExecutados || 'Nao houve servicos registrados no periodo.');

  doc.section('5. MATERIAIS, FERRAMENTAS E OCORRENCIAS');
  doc.field('Materiais', report.materiais || 'Nao informado');
  doc.field('Ferramentas', report.ferramentas || 'Nao informado');
  doc.field('Ocorrencias', report.ocorrencias || 'Nao informado');

  doc.section('6. REGISTRO FOTOGRAFICO POR CRONOGRAMA');
  const groups = report.payload?.groupedPhotos || [];
  if (!groups.length) {
    doc.paragraph('Nenhuma foto registrada no periodo.');
  }

  for (const group of groups) {
    doc.ensure(56);
    doc.fillRect(MARGIN, doc.y, PAGE_WIDTH - (MARGIN * 2), 24, LIGHT_BLUE);
    doc.text(MARGIN + 8, doc.y + 16, `${group.stageName}${group.subitemName ? ` / ${group.subitemName}` : ''}`, 10, true, BLUE);
    doc.y += 34;

    for (const photo of group.photos || []) {
      doc.ensure(170);
      const yStart = doc.y;
      const imageUrl = bestPhotoUrl(photo);
      let imageData = '';
      try {
        imageData = await imageToJpegDataUrl(imageUrl);
      } catch {
        imageData = '';
      }

      if (imageData) {
        doc.addImage(imageData, MARGIN, yStart, 168, 126);
      } else {
        doc.strokeRect(MARGIN, yStart, 168, 126, BORDER);
        doc.text(MARGIN + 18, yStart + 64, 'Imagem indisponivel', 9, false, MUTED);
      }

      const textX = MARGIN + 182;
      doc.text(textX, yStart + 14, formatDate(photo.data || photo.createdAt), 9, true, TEXT);
      const afterDescription = doc.wrappedText(
        textX,
        yStart + 32,
        photo.observacao || photo.fileName || 'Registro fotografico da obra',
        PAGE_WIDTH - textX - MARGIN,
        9,
        false,
        4,
        TEXT,
      );
      doc.text(textX, Math.max(afterDescription + 8, yStart + 104), photo.usuario || 'Usuario nao informado', 8.5, false, MUTED);
      doc.y = yStart + 142;
      doc.line(MARGIN, doc.y, PAGE_WIDTH - MARGIN, doc.y, BORDER);
      doc.y += 12;
    }
  }

  const blob = doc.build();
  downloadBlob(blob, `${safeFileName(title)}.pdf`);
}
