// Client-side image prep for the factory scan.
//
// Phones (especially iPhones) hand us HEIC/HEIF files that the FastAPI vision
// pipeline cannot decode (PIL / OpenCV only speak JPEG/PNG). Rather than touch
// the backend, we decode the photo in the browser, let the worker crop it, and
// re-encode the crop as a plain JPEG before it ever reaches /api/vision/detect.
// The detection pipeline stays exactly the same -- it just always receives a
// clean JPEG of the region the worker selected.

// Decode any picked file into something <canvas> can draw. createImageBitmap
// handles HEIC natively on iOS Safari and is fastest everywhere else; if it is
// missing or refuses the format we fall back to an <img> object URL.
export async function decodeToDrawable(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file)
      if (bitmap && bitmap.width && bitmap.height) {
        return { drawable: bitmap, width: bitmap.width, height: bitmap.height }
      }
    } catch {
      // fall through to the <img> path below
    }
  }

  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('Could not decode image'))
      el.src = url
    })
    if (!img.naturalWidth || !img.naturalHeight) {
      throw new Error('Image has no dimensions')
    }
    return { drawable: img, width: img.naturalWidth, height: img.naturalHeight, objectUrl: url }
  } catch (err) {
    URL.revokeObjectURL(url)
    throw err
  }
}

// Crop a source-pixel rectangle out of the decoded drawable and return it as a
// JPEG File. Large photos are scaled down so uploads stay quick over a phone
// connection without losing the detail the pipeline needs.
export function cropToJpegFile(drawable, rect, { maxDim = 2400, quality = 0.92, name = 'scan.jpg' } = {}) {
  const srcW = Math.max(1, Math.round(rect.width))
  const srcH = Math.max(1, Math.round(rect.height))
  const scale = Math.max(srcW, srcH) > maxDim ? maxDim / Math.max(srcW, srcH) : 1
  const outW = Math.max(1, Math.round(srcW * scale))
  const outH = Math.max(1, Math.round(srcH * scale))

  const canvas = document.createElement('canvas')
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(drawable, Math.round(rect.x), Math.round(rect.y), srcW, srcH, 0, 0, outW, outH)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Could not encode crop'))
          return
        }
        resolve(new File([blob], name, { type: 'image/jpeg' }))
      },
      'image/jpeg',
      quality,
    )
  })
}
