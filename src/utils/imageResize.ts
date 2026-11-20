/**
 * Resizes an uploaded image file to a compact square JPEG data URL
 * so personal profile photos stay well under Firestore's 200 KB limit.
 */
export function resizeImageFileToDataUrl(file: File, maxSize = 220): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the selected image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image format.'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas compression unavailable.'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const jpeg = canvas.toDataURL('image/jpeg', 0.82);
        resolve(jpeg);
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}
