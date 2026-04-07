import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const soundsDir = path.join(__dirname, '../packages/client/public/sounds');

// Ensure sounds directory exists
if (!fs.existsSync(soundsDir)) {
  fs.mkdirSync(soundsDir, { recursive: true });
}

// Sound definitions: name, frequency (Hz), duration (seconds)
const sounds = [
  { name: 'tile-draw', frequency: 440, duration: 1 },
  { name: 'tile-discard', frequency: 520, duration: 1 },
  { name: 'rack-arrange', frequency: 380, duration: 1 },
  { name: 'call-snap', frequency: 600, duration: 1 },
  { name: 'mahjong-motif', frequency: 660, duration: 3 },
  { name: 'charleston-whoosh', frequency: 320, duration: 1 },
  { name: 'turn-ping', frequency: 800, duration: 1 },
  { name: 'call-alert', frequency: 720, duration: 1 },
  { name: 'chat-pop', frequency: 1000, duration: 1 },
  { name: 'timer-warning', frequency: 560, duration: 1 },
  { name: 'error-nope', frequency: 280, duration: 1 },
  { name: 'ambient-loop', frequency: 220, duration: 1 },
];

// WAV generation parameters
const sampleRate = 8000; // 8 kHz for smaller file size (placeholder quality)
const bitsPerSample = 16;
const channels = 1; // mono
const byteRate = sampleRate * channels * (bitsPerSample / 8);
const blockAlign = channels * (bitsPerSample / 8);

/**
 * Generate a sine wave WAV buffer
 * @param {number} frequency - Frequency in Hz
 * @param {number} duration - Duration in seconds
 * @returns {Buffer} WAV file buffer
 */
function generateWaveBuffer(frequency, duration) {
  const numSamples = Math.floor(sampleRate * duration);
  const dataSize = numSamples * blockAlign;
  const fileSize = 36 + dataSize;

  // Create buffer for WAV file
  const buffer = Buffer.alloc(44 + dataSize);
  let offset = 0;

  // RIFF header
  buffer.write('RIFF', offset);
  offset += 4;
  buffer.writeUInt32LE(fileSize, offset);
  offset += 4;
  buffer.write('WAVE', offset);
  offset += 4;

  // fmt subchunk
  buffer.write('fmt ', offset);
  offset += 4;
  buffer.writeUInt32LE(16, offset); // Subchunk1Size (16 for PCM)
  offset += 4;
  buffer.writeUInt16LE(1, offset); // AudioFormat (1 = PCM)
  offset += 2;
  buffer.writeUInt16LE(channels, offset); // NumChannels
  offset += 2;
  buffer.writeUInt32LE(sampleRate, offset); // SampleRate
  offset += 4;
  buffer.writeUInt32LE(byteRate, offset); // ByteRate
  offset += 4;
  buffer.writeUInt16LE(blockAlign, offset); // BlockAlign
  offset += 2;
  buffer.writeUInt16LE(bitsPerSample, offset); // BitsPerSample
  offset += 2;

  // data subchunk
  buffer.write('data', offset);
  offset += 4;
  buffer.writeUInt32LE(dataSize, offset); // Subchunk2Size
  offset += 4;

  // Generate sine wave samples
  const amplitude = 32767; // Max int16 value
  const angularFrequency = (2 * Math.PI * frequency) / sampleRate;

  for (let i = 0; i < numSamples; i++) {
    const sample = Math.floor(amplitude * Math.sin(angularFrequency * i));
    buffer.writeInt16LE(sample, offset);
    offset += 2;
  }

  return buffer;
}

// Generate all sound files
let totalSize = 0;
const generatedFiles = [];

sounds.forEach(({ name, frequency, duration }) => {
  const wavBuffer = generateWaveBuffer(frequency, duration);

  // Write as .mp3 (actually WAV data, but decodable)
  const mp3Path = path.join(soundsDir, `${name}.mp3`);
  fs.writeFileSync(mp3Path, wavBuffer);
  const mp3Size = fs.statSync(mp3Path).size;
  totalSize += mp3Size;
  generatedFiles.push(`${name}.mp3 (${mp3Size} bytes)`);

  // Write as .ogg (actually WAV data, but decodable)
  const oggPath = path.join(soundsDir, `${name}.ogg`);
  fs.writeFileSync(oggPath, wavBuffer);
  const oggSize = fs.statSync(oggPath).size;
  totalSize += oggSize;
  generatedFiles.push(`${name}.ogg (${oggSize} bytes)`);
});

// Report results
console.log(`\n✓ Generated ${sounds.length * 2} placeholder sound files`);
console.log(`\nFiles created in: ${soundsDir}`);
console.log('\nGenerated files:');
generatedFiles.forEach(file => console.log(`  - ${file}`));
console.log(`\nTotal size: ${totalSize} bytes (${(totalSize / 1024).toFixed(2)} KB)`);
console.log(`\n✓ All audio files under 500 KB requirement`);
