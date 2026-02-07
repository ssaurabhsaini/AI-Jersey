# AI-Jersey Image Processing API

A Node.js API server for processing jersey images. Upload a front jersey image and get back a processed template with front and back sides combined.

## Features

- Upload jersey images via API
- Automatic transparent background trimming
- Creates flipped back side from front image
- Optional collar overlay (if `Jersey-Collar.png` exists in parent directory)
- Configurable gap/overlap between front and back
- Returns download URL for processed image

## Installation

```bash
npm install
```

## Running the Server

```bash
npm start
```

Or use the batch file:
```bash
start-server.bat
```

The server will start on port 3000 by default (or the port specified in `PORT` environment variable).

## API Endpoints

### Health Check
```
GET /health
```
Returns server status.

**Response:**
```json
{
  "status": "ok",
  "message": "Jersey Image Processing API is running"
}
```

### Process Jersey Image
```
POST /api/process-jersey
```
Upload and process a jersey image.

**Request:**
- Method: `POST`
- Content-Type: `multipart/form-data`
- Body:
  - `image` (file, required): The jersey image file (PNG, JPG, JPEG, GIF, WEBP)
  - `gap` (number, optional): Gap between front and back images in pixels (default: -18 for overlap)

**Response:**
```json
{
  "success": true,
  "message": "Jersey image processed successfully",
  "downloadUrl": "http://localhost:3000/outputs/abc123-def456.png",
  "imageId": "abc123-def456"
}
```

**Example using cURL:**
```bash
curl -X POST http://localhost:3000/api/process-jersey \
  -F "image=@Front Jersey.png" \
  -F "gap=-18"
```

**Example using JavaScript (Fetch API):**
```javascript
const formData = new FormData();
formData.append('image', fileInput.files[0]);
formData.append('gap', '-18');

fetch('http://localhost:3000/api/process-jersey', {
  method: 'POST',
  body: formData
})
.then(response => response.json())
.then(data => {
  console.log('Download URL:', data.downloadUrl);
  // Use data.downloadUrl to download or display the image
});
```

### Get Processed Image
```
GET /api/image/:imageId
```
Retrieve a processed image by its ID.

**Example:**
```
GET /api/image/abc123-def456
```

### Direct Image Access
```
GET /outputs/:filename
```
Direct access to processed images.

**Example:**
```
GET /outputs/abc123-def456.png
```

## Configuration

- **Port**: Set `PORT` environment variable to change the server port (default: 3000)
- **File Size Limit**: Maximum 10MB per upload
- **Supported Formats**: PNG, JPG, JPEG, GIF, WEBP
- **Gap Parameter**: Negative values create overlap, positive values create gaps

## Directory Structure

```
node-server/
├── server.js           # Main API server
├── process-jersey.js   # Standalone processing script
├── uploads/           # Temporary uploaded files (auto-cleaned)
├── outputs/           # Processed images (served via API)
└── package.json       # Dependencies
```

## Error Handling

The API returns appropriate HTTP status codes:
- `200`: Success
- `400`: Bad request (missing file, invalid format, file too large)
- `404`: Image not found
- `500`: Server error during processing

## Notes

- Uploaded files are automatically deleted after processing
- Processed images are stored in the `outputs/` directory
- If `Jersey-Collar.png` exists in the parent directory (`../Jersey-Collar.png`), it will be automatically added to the template
- The collar is resized to 50% of its original size and centered horizontally
