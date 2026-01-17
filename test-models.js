/**
 * Simple test script to compare Haiku vs Sonnet OCR performance
 *
 * Usage: node test-models.js <path-to-wine-image>
 * Example: node test-models.js ~/Downloads/wine-bottle.jpg
 */

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import Anthropic from '@anthropic-ai/sdk';

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const imagePath = process.argv[2];

if (!imagePath) {
  console.log('Usage: node test-models.js <path-to-wine-image>');
  console.log('Example: node test-models.js ~/Downloads/wine-bottle.jpg');
  process.exit(1);
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('Error: ANTHROPIC_API_KEY environment variable is required');
  console.log('\nSet your API key:');
  console.log('  export ANTHROPIC_API_KEY=your-api-key-here');
  process.exit(1);
}

if (!fs.existsSync(imagePath)) {
  console.error(`Error: Image file not found: ${imagePath}`);
  process.exit(1);
}

console.log('🍷 Testing Haiku vs Sonnet OCR Performance');
console.log('===========================================');
console.log(`Image: ${imagePath}\n`);

/**
 * Resize image if it exceeds Claude's 5MB limit
 * Reduces dimensions while maintaining aspect ratio
 * Returns { base64, mediaType } for Anthropic SDK
 */
async function prepareImage(imagePath) {
  const imageBuffer = fs.readFileSync(imagePath);
  const ext = path.extname(imagePath).toLowerCase().replace('.', '');

  // Get initial base64 size
  let processedBuffer = imageBuffer;
  let sizeBytes = imageBuffer.length;
  const sizeMB = sizeBytes / (1024 * 1024);

  console.log(`Original image size: ${sizeMB.toFixed(2)}MB`);

  // Claude's limit is 5MB for images
  const MAX_SIZE_BYTES = 5 * 1024 * 1024;

  if (sizeBytes > MAX_SIZE_BYTES) {
    console.log(`Image exceeds 5MB limit, resizing...`);

    // Resize image using sharp
    const metadata = await sharp(imageBuffer).metadata();
    const currentWidth = metadata.width;

    // Calculate new width to stay under 5MB (with some headroom)
    // Aim for 4.5MB to be safe
    const targetSizeBytes = 4.5 * 1024 * 1024;
    const scaleFactor = Math.sqrt(targetSizeBytes / sizeBytes);
    const newWidth = Math.floor(currentWidth * scaleFactor);

    console.log(`Resizing from ${currentWidth}px to ${newWidth}px width...`);

    processedBuffer = await sharp(imageBuffer)
      .resize({ width: newWidth, withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();

    sizeBytes = processedBuffer.length;
    const newSizeMB = sizeBytes / (1024 * 1024);

    console.log(`Resized image size: ${newSizeMB.toFixed(2)}MB\n`);
  } else {
    console.log(`Image size is within limits\n`);
  }

  // Map file extensions to media types
  const mediaTypeMap = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp'
  };

  const mediaType = mediaTypeMap[ext] || 'image/jpeg';
  const base64Data = processedBuffer.toString('base64');

  return { base64: base64Data, mediaType };
}

// Prepare image (resize if needed)
const imageData = await prepareImage(imagePath);

// Prompt for wine extraction
const WINE_EXTRACTION_PROMPT = `Extract wine information from this bottle image. Return JSON (or JSON array if multiple wines visible).

IMPORTANT: Make your best guess even if uncertain. If you're unsure about a field, provide your best estimate and reflect the uncertainty in the confidence_level (1-10).
- Don't say "Unknown" or "Not visible"
- If you can't read something clearly, make an educated guess based on what you can see
- Use the confidence_level to indicate how certain you are (10 = very certain, 1 = just guessing)

Required fields for each wine:
- name: Wine name (guess if unclear)
- producer: Producer/winery name (guess if unclear)
- vintage: Year (null if truly not visible)
- region: Wine region (guess based on label clues)
- type: Red/White/Sparkling/Rosé/Dessert (guess from bottle color/shape)
- variety: Grape variety (guess based on region/label)
- confidence_level: 1-10 (how confident you are in this extraction)`;

async function testModel(modelName, displayName, emoji) {
  console.log(`${emoji} Testing with ${displayName}...`);

  const startTime = Date.now();

  try {
    const response = await anthropic.messages.create({
      model: modelName,
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: imageData.mediaType,
              data: imageData.base64
            }
          },
          {
            type: 'text',
            text: WINE_EXTRACTION_PROMPT
          }
        ]
      }]
    });

    const endTime = Date.now();
    const latency = endTime - startTime;

    const content = response.content[0].text;

    // Try to parse as JSON (handles both plain JSON and markdown code blocks)
    let parsedContent;
    try {
      // Remove markdown code blocks if present
      let jsonText = content;
      const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (codeBlockMatch) {
        jsonText = codeBlockMatch[1];
      }

      // Try to find JSON object or array
      const jsonMatch = jsonText.match(/[\{\[][\s\S]*[\}\]]/);
      parsedContent = jsonMatch ? JSON.parse(jsonMatch[0]) : content;
    } catch (e) {
      parsedContent = content;
    }

    return {
      latency,
      content: parsedContent,
      raw: content
    };

  } catch (error) {
    const endTime = Date.now();
    const latency = endTime - startTime;
    console.error(`  Error: ${error.message}`);
    return {
      latency,
      error: error.message
    };
  }
}

// Run tests
// Model identifiers: https://docs.anthropic.com/en/docs/about-claude/models
console.log('Running tests...\n');

const haikuResult = await testModel('claude-haiku-4-5-20251001', 'Haiku 4.5', '⚡');
console.log(`  Completed in ${haikuResult.latency}ms\n`);

const sonnetResult = await testModel('claude-sonnet-4-5-20250929', 'Sonnet 4.5', '🎯');
console.log(`  Completed in ${sonnetResult.latency}ms\n`);

/**
 * Calculate confidence level distribution from results
 * Handles both single object and array of objects
 */
function getConfidenceDistribution(data) {
  const distribution = {};

  // Convert to array if single object
  const items = Array.isArray(data) ? data : [data];

  // Count confidence levels
  items.forEach(item => {
    if (item.confidence_level) {
      const key = `level${item.confidence_level}`;
      distribution[key] = (distribution[key] || 0) + 1;
    }
  });

  return distribution;
}

/**
 * Get total number of wines extracted
 */
function getWineCount(data) {
  return Array.isArray(data) ? data.length : 1;
}

// Display results
console.log('📊 RESULTS');
console.log('==========\n');

console.log('⚡ HAIKU:');
console.log(`  Latency: ${haikuResult.latency}ms`);
if (haikuResult.error) {
  console.log(`  Error: ${haikuResult.error}`);
} else {
  const wineCount = getWineCount(haikuResult.content);
  const distribution = getConfidenceDistribution(haikuResult.content);
  console.log(`  Wines detected: ${wineCount}`);
  console.log('  Confidence distribution:');
  console.log(JSON.stringify(distribution, null, 2));
}

console.log('\n🎯 SONNET:');
console.log(`  Latency: ${sonnetResult.latency}ms`);
if (sonnetResult.error) {
  console.log(`  Error: ${sonnetResult.error}`);
} else {
  const wineCount = getWineCount(sonnetResult.content);
  const distribution = getConfidenceDistribution(sonnetResult.content);
  console.log(`  Wines detected: ${wineCount}`);
  console.log('  Confidence distribution:');
  console.log(JSON.stringify(distribution, null, 2));
}

// Comparison
if (!haikuResult.error && !sonnetResult.error) {
  const speedup = sonnetResult.latency - haikuResult.latency;
  const speedupPercent = ((speedup / sonnetResult.latency) * 100).toFixed(1);

  console.log('\n🏆 COMPARISON:');
  console.log(`  Haiku faster by: ${speedup}ms (${speedupPercent}%)`);
  console.log(`  Cost savings: ~75-90% (Haiku is significantly cheaper)`);

  // Compare confidence distributions
  const haikuDist = getConfidenceDistribution(haikuResult.content);
  const sonnetDist = getConfidenceDistribution(sonnetResult.content);

  console.log('\n  Confidence Quality:');
  console.log(`    Haiku:  ${JSON.stringify(haikuDist)}`);
  console.log(`    Sonnet: ${JSON.stringify(sonnetDist)}`);
}

console.log('');
