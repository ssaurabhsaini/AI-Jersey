const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

async function createTightJerseyTemplate() {
  const input = path.join(__dirname, '..', 'Front Jersey.png');
  const output = path.join(__dirname, '..', 'Front_Jersey_result1.png');
  const collar = path.join(__dirname, 'assets', 'Jersey-Collar.png');

  console.log('Processing image:', input);
  console.log('Output will be saved to:', output);

  try {
    // 1. First, ensure alpha channel exists, then trim transparent/empty space
    // .ensureAlpha() ensures transparency support
    const inputImage = sharp(input).ensureAlpha();
    
    // Get original dimensions for logging
    const originalMeta = await inputImage.metadata();
    console.log(`Original dimensions: ${originalMeta.width}x${originalMeta.height}`);
    
    // Trim the image - Sharp's trim() works but may need threshold adjustment
    // For transparent images: try trim with threshold 0 (most aggressive)
    // This removes pixels similar to corner pixels (including transparent ones)
    let trimmedImage = inputImage.trim({ threshold: 0 });
    
    // Get the trimmed image as buffer and its dimensions
    let trimmedBuffer = await trimmedImage.toBuffer();
    let { width, height } = await sharp(trimmedBuffer).metadata();
    
    // If trim didn't reduce size significantly, try custom transparent trim
    // This handles cases where Sharp's trim() doesn't work well with transparent backgrounds
    if (originalMeta.width === width && originalMeta.height === height) {
      console.log('Standard trim did not reduce size, attempting custom transparent trim...');
      
      // Get raw image data to find actual content bounds
      const { data, info } = await inputImage.raw().ensureAlpha().toBuffer({ resolveWithObject: true });
      const channels = info.channels;
      
      let minX = info.width, minY = info.height, maxX = 0, maxY = 0;
      let hasContent = false;
      
      // Scan image to find content bounds (non-transparent pixels)
      // Use a threshold for alpha to handle semi-transparent pixels
      const alphaThreshold = 5; // Consider pixels with alpha > 5 as content (lower threshold for better detection)
      
      console.log(`Scanning ${info.width}x${info.height} image with ${channels} channels...`);
      
      // Scan from edges inward to find first content pixel
      // This is more efficient and handles transparent padding better
      
      // Find top edge (scan top to bottom)
      for (let y = 0; y < info.height && minY === info.height; y++) {
        for (let x = 0; x < info.width; x++) {
          const idx = (y * info.width + x) * channels;
          const alpha = channels === 4 ? data[idx + 3] : 255;
          if (alpha > alphaThreshold) {
            minY = y;
            hasContent = true;
            break;
          }
        }
      }
      
      // Find bottom edge (scan bottom to top)
      for (let y = info.height - 1; y >= 0 && maxY === 0; y--) {
        for (let x = 0; x < info.width; x++) {
          const idx = (y * info.width + x) * channels;
          const alpha = channels === 4 ? data[idx + 3] : 255;
          if (alpha > alphaThreshold) {
            maxY = y;
            hasContent = true;
            break;
          }
        }
      }
      
      // Find left edge (scan left to right)
      for (let x = 0; x < info.width && minX === info.width; x++) {
        for (let y = minY; y <= maxY; y++) {
          const idx = (y * info.width + x) * channels;
          const alpha = channels === 4 ? data[idx + 3] : 255;
          if (alpha > alphaThreshold) {
            minX = x;
            hasContent = true;
            break;
          }
        }
      }
      
      // Find right edge (scan right to left)
      for (let x = info.width - 1; x >= 0 && maxX === 0; x--) {
        for (let y = minY; y <= maxY; y++) {
          const idx = (y * info.width + x) * channels;
          const alpha = channels === 4 ? data[idx + 3] : 255;
          if (alpha > alphaThreshold) {
            maxX = x;
            hasContent = true;
            break;
          }
        }
      }
      
      console.log(`Content scan results: hasContent=${hasContent}, bounds: minX=${minX}, minY=${minY}, maxX=${maxX}, maxY=${maxY}`);
      
      // If we found content bounds, extract that region
      if (hasContent && minX < maxX && minY < maxY) {
        const contentWidth = maxX - minX + 1;
        const contentHeight = maxY - minY + 1;
        
        // Only extract if we actually found a smaller bounding box
        if (minX > 0 || minY > 0 || maxX < info.width - 1 || maxY < info.height - 1) {
          console.log(`Extracting content bounds: x=${minX}, y=${minY}, width=${contentWidth}, height=${contentHeight}`);
          
          trimmedImage = inputImage.extract({
            left: minX,
            top: minY,
            width: contentWidth,
            height: contentHeight
          });
          
          trimmedBuffer = await trimmedImage.toBuffer();
          const extractedMeta = await sharp(trimmedBuffer).metadata();
          width = extractedMeta.width;
          height = extractedMeta.height;
          console.log(`Extracted dimensions: ${width}x${height}`);
        } else {
          console.log('Content fills entire image, no trimming needed');
        }
      } else {
        console.log('No content found or invalid bounds');
      }
    }
    
    if (originalMeta.width !== width || originalMeta.height !== height) {
      console.log(`Image trimmed: ${originalMeta.width}x${originalMeta.height} -> ${width}x${height}`);
    }
    console.log(`Trimmed dimensions (t-shirt only): ${width}x${height}`);

    // 2. Create the flipped back version from the trimmed shirt (preserve transparency)
    const backSide = await sharp(trimmedBuffer).flip().toBuffer();
    const frontSide = trimmedBuffer;

    // Helper function to find actual content bounds (ignoring transparent edges)
    async function getContentBounds(imageBuffer) {
      const { data, info } = await sharp(imageBuffer).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
      const channels = info.channels;
      const alphaThreshold = 1; // Consider pixels with alpha > 1 as content (more precise detection)
      
      let minX = info.width, minY = info.height, maxX = 0, maxY = 0;
      
      // Find top edge
      for (let y = 0; y < info.height && minY === info.height; y++) {
        for (let x = 0; x < info.width; x++) {
          const idx = (y * info.width + x) * channels;
          const alpha = channels === 4 ? data[idx + 3] : 255;
          if (alpha > alphaThreshold) {
            minY = y;
            break;
          }
        }
      }
      
      // Find bottom edge
      for (let y = info.height - 1; y >= 0 && maxY === 0; y--) {
        for (let x = 0; x < info.width; x++) {
          const idx = (y * info.width + x) * channels;
          const alpha = channels === 4 ? data[idx + 3] : 255;
          if (alpha > alphaThreshold) {
            maxY = y;
            break;
          }
        }
      }
      
      return { top: minY, bottom: maxY, height: maxY - minY + 1 };
    }

    // Get actual content bounds for both images
    const backBounds = await getContentBounds(backSide);
    const frontBounds = await getContentBounds(frontSide);
    
    console.log(`Back side content: top=${backBounds.top}, bottom=${backBounds.bottom}, height=${backBounds.height}`);
    console.log(`Front side content: top=${frontBounds.top}, bottom=${frontBounds.bottom}, height=${frontBounds.height}`);

    // 3. Load and prepare collar image (if it exists)
    let collarBuffer = null;
    let collarWidth = 0;
    let collarHeight = 0;
    let collarLeft = 0;
    let collarTop = 0;

    try {
      if (fs.existsSync(collar)) {
        console.log('Loading collar image:', collar);
        const collarImage = sharp(collar).ensureAlpha();
        const collarMeta = await collarImage.metadata();
        // Resize collar to 50% of original size
        const originalCollarWidth = collarMeta.width;
        const originalCollarHeight = collarMeta.height;
        collarWidth = Math.floor(originalCollarWidth * 0.5);
        collarHeight = Math.floor(originalCollarHeight * 0.5);
        
        collarBuffer = await collarImage
          .resize(collarWidth, collarHeight, { 
            kernel: sharp.kernel.lanczos3 // High quality resizing
          })
          .toBuffer();
        
        // Center the collar horizontally
        collarLeft = Math.floor((width - collarWidth) / 2);
        // collarTop will be calculated later after we know the actual total height
        console.log(`Collar dimensions: ${originalCollarWidth}x${originalCollarHeight} -> ${collarWidth}x${collarHeight} (50%), positioned at (${collarLeft}, ${collarTop})`);
      } else {
        console.log('Collar image not found, skipping...');
      }
    } catch (collarError) {
      console.log('Collar image not found or could not be loaded:', collarError.message);
    }

    // 4. Stack jersey parts perfectly aligned (touching at content edges)
    // ADJUST THIS VARIABLE to control the gap between images (in pixels):
    // - Negative values: overlap the images (e.g., -1, -2)
    // - 0: perfect touch (no gap, no overlap)
    // - Positive values: add gap between images (e.g., 1, 2, 5)
    const gapBetweenImages = -18;
    
    // Position backSide so its top content edge is at the top (Y=0)
    const backTop = 0 - backBounds.top;
    
    // Position frontSide relative to backSide's bottom content edge
    // backSide's bottom content pixel is at: backTop + backBounds.bottom
    const backBottomContentY = backTop + backBounds.bottom;
    const frontTop = backBottomContentY + gapBetweenImages - frontBounds.top;
    
    // Calculate total canvas height based on actual content positioning
    const frontBottomContentY = frontTop + frontBounds.bottom;
    const totalHeight = frontBottomContentY + 1;
    
    console.log(`Positioning: gapBetweenImages=${gapBetweenImages}, backTop=${backTop}, frontTop=${frontTop}, totalHeight=${totalHeight}`);
    
    const compositeLayers = [
      { input: backSide, top: backTop, left: 0 },
      { input: frontSide, top: frontTop, left: 0 }
    ];

    // Add collar if available
    if (collarBuffer) {
      // Recalculate collar position with actual total height
      collarTop = Math.floor((totalHeight - collarHeight) / 2);
      compositeLayers.push({
        input: collarBuffer,
        top: collarTop,
        left: collarLeft
      });
    }

    await sharp({
      create: {
        width: width,
        height: totalHeight,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })
    .composite(compositeLayers)
    .png()
    .toFile(output);

    console.log('Success! Jersey template created with transparent background:', output);
    console.log(`Final dimensions: ${width}x${totalHeight}`);
    if (collarBuffer) {
      console.log('Collar added successfully!');
    }
  } catch (error) {
    console.error('Error processing image:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

createTightJerseyTemplate();
