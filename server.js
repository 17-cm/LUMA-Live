import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import archiver from 'archiver';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const HOST = '0.0.0.0';

// API route to download the ready-to-install zip package for AI Virtual Phone
app.get('/api/download-zip', (req, res) => {
  const archive = archiver('zip', {
    zlib: { level: 9 }
  });

  res.attachment('luma-live-v3.4.0.zip');

  archive.on('error', (err) => {
    res.status(500).send({ error: err.message });
  });

  archive.pipe(res);

  const filesToInclude = [
    'manifest.json',
    'index.html',
    'main.js',
    'live.js',
    'trends.js',
    'style.css',
    'presets.json',
    'regex.json',
    'world.json',
    'README.md'
  ];

  filesToInclude.forEach((file) => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
      archive.file(filePath, { name: file });
    }
  });

  archive.finalize();
});

// Serve static assets from project root
app.use(express.static(__dirname));

// Fallback to index.html for SPA routing if needed
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`LUMA Live server listening on http://${HOST}:${PORT}`);
});

