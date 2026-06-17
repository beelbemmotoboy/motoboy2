const PHOTO_UPLOAD_SETTINGS = {
  maxWidth: 1600,
  maxHeight: 1600,
  quality: 0.78,
  suffix: 'reduzida',
};

const THUMBNAIL_UPLOAD_SETTINGS = {
  maxWidth: 420,
  maxHeight: 420,
  quality: 0.68,
  suffix: 'miniatura',
};

const AVATAR_UPLOAD_SETTINGS = {
  maxWidth: 640,
  maxHeight: 640,
  quality: 0.78,
  suffix: 'perfil',
};

const LOGO_UPLOAD_SETTINGS = {
  maxWidth: 900,
  maxHeight: 900,
  quality: 0.82,
  suffix: 'logo',
};

const outputType = 'image/jpeg';

export async function preparePhotoUpload(file) {
  const photo = await resizeImageFile(file, PHOTO_UPLOAD_SETTINGS);
  const thumbnail = await resizeImageFile(file, THUMBNAIL_UPLOAD_SETTINGS);

  return {
    photoFile: photo.file,
    thumbnailFile: thumbnail.file,
    originalSize: file.size || 0,
    compressedSize: photo.file.size || 0,
    thumbnailSize: thumbnail.file.size || 0,
    width: photo.width,
    height: photo.height,
    thumbnailWidth: thumbnail.width,
    thumbnailHeight: thumbnail.height,
  };
}

export async function prepareAvatarUpload(file) {
  const avatar = await resizeImageFile(file, AVATAR_UPLOAD_SETTINGS);
  return avatar.file;
}

export async function prepareLogoUpload(file) {
  const logo = await resizeImageFile(file, LOGO_UPLOAD_SETTINGS);
  return logo.file;
}

export function getBestPhotoUrl(photo) {
  return photo.thumbnailUrl || photo.photoUrl || '';
}

async function resizeImageFile(file, settings) {
  if (!file?.type?.startsWith('image/')) {
    throw new Error('Selecione apenas arquivos de imagem.');
  }

  const image = await loadImage(file);
  const { width, height } = fitInside(image.naturalWidth || image.width, image.naturalHeight || image.height, settings);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('Nao foi possivel preparar a imagem.');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  const blob = await canvasToBlob(canvas, outputType, settings.quality);
  return {
    file: new File([blob], buildOutputFileName(file.name, settings.suffix), {
      type: outputType,
      lastModified: Date.now(),
    }),
    width,
    height,
  };
}

function fitInside(width, height, settings) {
  const safeWidth = Math.max(1, Number(width) || settings.maxWidth);
  const safeHeight = Math.max(1, Number(height) || settings.maxHeight);
  const ratio = Math.min(1, settings.maxWidth / safeWidth, settings.maxHeight / safeHeight);

  return {
    width: Math.max(1, Math.round(safeWidth * ratio)),
    height: Math.max(1, Math.round(safeHeight * ratio)),
  };
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Nao foi possivel ler esta imagem para reduzir o tamanho.'));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }
      reject(new Error('Nao foi possivel reduzir esta imagem.'));
    }, type, quality);
  });
}

function buildOutputFileName(fileName, suffix) {
  const baseName = String(fileName || 'foto')
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    || 'foto';
  return `${baseName}-${suffix}.jpg`;
}
