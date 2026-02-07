const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Create necessary directories
const uploadsDir = path.join(__dirname, 'uploads');
const outputsDir = path.join(__dirname, 'outputs');
const publicDir = path.join(__dirname, 'public');

[uploadsDir, outputsDir, publicDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Serve static files from outputs directory
app.use('/outputs', express.static(outputsDir));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// Helper function to find actual content bounds (ignoring transparent edges)
async function getContentBounds(imageBuffer) {
  const { data, info } = await sharp(imageBuffer).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  const channels = info.channels;
  const alphaThreshold = 1; // Consider pixels with alpha > 1 as content
  
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
  
  // Find left edge
  for (let x = 0; x < info.width && minX === info.width; x++) {
    for (let y = minY; y <= maxY; y++) {
      const idx = (y * info.width + x) * channels;
      const alpha = channels === 4 ? data[idx + 3] : 255;
      if (alpha > alphaThreshold) {
        minX = x;
        break;
      }
    }
  }
  
  // Find right edge
  for (let x = info.width - 1; x >= 0 && maxX === 0; x--) {
    for (let y = minY; y <= maxY; y++) {
      const idx = (y * info.width + x) * channels;
      const alpha = channels === 4 ? data[idx + 3] : 255;
      if (alpha > alphaThreshold) {
        maxX = x;
        break;
      }
    }
  }
  
  return { 
    top: minY, 
    bottom: maxY, 
    left: minX,
    right: maxX,
    height: maxY - minY + 1,
    width: maxX - minX + 1
  };
}

// Main image processing function
async function processJerseyImage(inputPath, collarPath = null, gapBetweenImages = -18) {
  try {
    // 1. Load and trim the input image
    const inputImage = sharp(inputPath).ensureAlpha();
    const originalMeta = await inputImage.metadata();
    
    // Try standard trim first
    let trimmedImage = inputImage.trim({ threshold: 0 });
    let trimmedBuffer = await trimmedImage.toBuffer();
    let { width, height } = await sharp(trimmedBuffer).metadata();
    
    // If trim didn't reduce size, use custom transparent trim
    if (originalMeta.width === width && originalMeta.height === height) {
      const { data, info } = await inputImage.raw().ensureAlpha().toBuffer({ resolveWithObject: true });
      const channels = info.channels;
      const alphaThreshold = 5;
      
      let minX = info.width, minY = info.height, maxX = 0, maxY = 0;
      let hasContent = false;
      
      // Find content bounds
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
      
      if (hasContent && minX < maxX && minY < maxY) {
        const contentWidth = maxX - minX + 1;
        const contentHeight = maxY - minY + 1;
        
        if (minX > 0 || minY > 0 || maxX < info.width - 1 || maxY < info.height - 1) {
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
        }
      }
    }
    
    // 2. Create flipped back version
    const backSide = await sharp(trimmedBuffer).flip().toBuffer();
    const frontSide = trimmedBuffer;
    
    // 3. Get content bounds for positioning
    const backBounds = await getContentBounds(backSide);
    const frontBounds = await getContentBounds(frontSide);
    
    // 4. Load and prepare collar image (if provided)
    let collarBuffer = null;
    let collarWidth = 0;
    let collarHeight = 0;
    let collarLeft = 0;
    let collarTop = 0;
    
    if (collarPath && fs.existsSync(collarPath)) {
      const collarImage = sharp(collarPath).ensureAlpha();
      const collarMeta = await collarImage.metadata();
      collarWidth = Math.floor(collarMeta.width * 0.5);
      collarHeight = Math.floor(collarMeta.height * 0.5);
      
      collarBuffer = await collarImage
        .resize(collarWidth, collarHeight, { 
          kernel: sharp.kernel.lanczos3
        })
        .toBuffer();
      
      collarLeft = Math.floor((width - collarWidth) / 2);
    }
    
    // 5. Stack jersey parts with configurable gap
    const backTop = 0 - backBounds.top;
    const backBottomContentY = backTop + backBounds.bottom;
    const frontTop = backBottomContentY + gapBetweenImages - frontBounds.top;
    const frontBottomContentY = frontTop + frontBounds.bottom;
    const totalHeight = frontBottomContentY + 1;
    
    const compositeLayers = [
      { input: backSide, top: backTop, left: 0 },
      { input: frontSide, top: frontTop, left: 0 }
    ];
    
    if (collarBuffer) {
      collarTop = Math.floor((totalHeight - collarHeight) / 2);
      compositeLayers.push({
        input: collarBuffer,
        top: collarTop,
        left: collarLeft
      });
    }
    
    // 6. Create final composite image
    const outputBuffer = await sharp({
      create: {
        width: width,
        height: totalHeight,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })
    .composite(compositeLayers)
    .png()
    .toBuffer();
    
    return outputBuffer;
  } catch (error) {
    throw new Error(`Image processing failed: ${error.message}`);
  }
}

// API Routes

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Jersey Image Processing API is running' });
});

// Upload and process jersey image
app.post('/api/process-jersey', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }
    
    const inputPath = req.file.path;
    const outputId = uuidv4();
    const outputFilename = `${outputId}.png`;
    const outputPath = path.join(outputsDir, outputFilename);
    
    // Optional: Check if collar image exists in parent directory
    const collarPath = path.join(__dirname, '..', 'Jersey-Collar.png');
    const collarExists = fs.existsSync(collarPath);
    
    // Process the image
    const gapBetweenImages = req.body.gap ? parseInt(req.body.gap) : -18;
    const processedBuffer = await processJerseyImage(
      inputPath, 
      collarExists ? collarPath : null,
      gapBetweenImages
    );
    
    // Save processed image
    await sharp(processedBuffer).toFile(outputPath);
    
    // Clean up uploaded file
    fs.unlinkSync(inputPath);
    
    // Return download URL
    const baseUrl = req.protocol + '://' + req.get('host');
    const downloadUrl = `${baseUrl}/outputs/${outputFilename}`;
    
    res.json({
      success: true,
      message: 'Jersey image processed successfully',
      downloadUrl: downloadUrl,
      imageId: outputId
    });
  } catch (error) {
    console.error('Processing error:', error);
    
    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      error: 'Failed to process image',
      message: error.message
    });
  }
});

// Get processed image by ID
app.get('/api/image/:imageId', (req, res) => {
  const imageId = req.params.imageId;
  const imagePath = path.join(outputsDir, `${imageId}.png`);
  
  if (fs.existsSync(imagePath)) {
    res.sendFile(imagePath);
  } else {
    res.status(404).json({ error: 'Image not found' });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 10MB' });
    }
    return res.status(400).json({ error: error.message });
  }
  res.status(500).json({ error: error.message || 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Jersey Image Processing API running on port ${PORT}`);
  console.log(`📁 Uploads directory: ${uploadsDir}`);
  console.log(`📁 Outputs directory: ${outputsDir}`);
  console.log(`\nEndpoints:`);
  console.log(`  GET  /health - Health check`);
  console.log(`  POST /api/process-jersey - Upload and process jersey image`);
  console.log(`  GET  /api/image/:imageId - Get processed image by ID`);
  console.log(`  GET  /outputs/:filename - Direct access to processed images`);
});
