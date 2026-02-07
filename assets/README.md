# Assets Directory

Place your collar image file here.

## Required File

- **Jersey-Collar.png** - The collar overlay image that will be added to processed jersey templates

## File Location

The collar image should be placed at:
```
node-server/assets/Jersey-Collar.png
```

## Notes

- The collar image will be automatically resized to 50% of its original size
- It will be centered horizontally on the final template
- If the collar image is not found, the API will still process the jersey without it
- Supported formats: PNG (recommended for transparency), JPG, JPEG, GIF, WEBP
