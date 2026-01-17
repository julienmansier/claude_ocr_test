# Claude OCR Test

Testing Claude's models (Haiku vs Sonnet) for OCR cost and accuracy on wine bottle images.

## Overview

This project compares the performance of Claude Haiku 4.5 and Claude Sonnet 4.5 for extracting structured wine information from bottle images. It measures latency, accuracy, and confidence levels to help determine the optimal model choice for OCR tasks.

## Features

- **Dual Model Testing**: Compares Haiku 4.5 and Sonnet 4.5 side-by-side
- **Automatic Image Resizing**: Handles large images by resizing to fit Claude's 5MB limit
- **Structured Data Extraction**: Extracts wine name, producer, vintage, region, type, and variety
- **Confidence Scoring**: Models provide confidence levels (1-10) for each extraction
- **Performance Metrics**: Measures latency and cost comparison

## Usage

First, set your Anthropic API key:
```bash
export ANTHROPIC_API_KEY=your-api-key-here
```

Then run the script:
```bash
node test-models.js <path-to-wine-image>
```

Example:
```bash
node test-models.js ~/Downloads/wine-bottle.jpg
```

## Installation

```bash
npm install
```

This installs the required dependencies defined in `package.json`:
- `@anthropic-ai/sdk` - Official Anthropic SDK
- `sharp` - For image processing and resizing

## Requirements

- Node.js 18+ (ESM modules)
- Anthropic API key (get one at https://console.anthropic.com)

## How It Works

1. **Image Preparation**: Loads the image and automatically resizes if it exceeds 5MB
2. **Prompt Engineering**: Sends a structured prompt asking for wine information with confidence levels
3. **Model Testing**: Tests both Haiku and Sonnet with identical prompts
4. **Results Analysis**: Compares latency, accuracy, and confidence distributions

## Output

The script provides:
- Latency for each model (in milliseconds)
- Number of wines detected
- Confidence level distribution
- Speed comparison (Haiku faster by X ms / Y%)
- Cost comparison (Haiku ~75-90% cheaper)

## Key Features of the Prompt

- Forces models to make best guesses rather than saying "Unknown"
- Uses confidence levels to indicate uncertainty
- Extracts multiple wines if present in a single image
- Returns structured JSON for easy parsing

## Model Identifiers

The script uses the following Claude models (as of January 2026):
- `claude-haiku-4-5-20251001` - Haiku 4.5
- `claude-sonnet-4-5-20250929` - Sonnet 4.5

See [Anthropic's model documentation](https://docs.anthropic.com/en/docs/about-claude/models) for the latest model identifiers.
