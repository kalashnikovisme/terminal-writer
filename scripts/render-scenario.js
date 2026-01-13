#!/usr/bin/env node

const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawnSync } = require('child_process');
const { chromium } = require('playwright');

const DEFAULT_TIMEOUT_MS = 120000;
const DEFAULT_VIEWPORT = { width: 1280, height: 720 };

const parseArgs = (argv) => {
  const args = {
    headful: false,
    timeout: DEFAULT_TIMEOUT_MS,
    output: 'scenario.mp4',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--scenario') {
      args.scenario = argv[i + 1];
      i += 1;
    } else if (arg === '--output') {
      args.output = argv[i + 1];
      i += 1;
    } else if (arg === '--timeout') {
      args.timeout = Number(argv[i + 1]);
      i += 1;
    } else if (arg === '--headful') {
      args.headful = true;
    } else if (arg === '--help') {
      args.help = true;
    }
  }

  return args;
};

const showHelp = () => {
  console.log(`Usage: node scripts/render-scenario.js --scenario <file.tss> [options]

Options:
  --output <file.mp4>   Output mp4 file (default: scenario.mp4)
  --timeout <ms>        Timeout in milliseconds (default: ${DEFAULT_TIMEOUT_MS})
  --headful             Run browser with UI
  --help                Show this help message
`);
};

const contentTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.tss': 'text/plain',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const directivePattern = /^([a-z_-]+):(?:\s*(.*))?$/;

const readScenarioLines = (scenarioPath) =>
  fs.readFileSync(scenarioPath, 'utf8').split('\n');

const getDirectiveValue = (parsed, lines, index) => {
  if (parsed.data !== undefined && parsed.data !== '') {
    return parsed.data;
  }
  return lines[index + 1];
};

const findAudioPaths = (scenarioPath) => {
  const lines = readScenarioLines(scenarioPath);
  const audioPaths = [];

  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(directivePattern);
    if (!match) {
      continue;
    }

    const directive = match[1];
    if (directive !== 'audio') {
      continue;
    }

    const audioPath = getDirectiveValue({ data: match[2] }, lines, i);
    if (audioPath) {
      audioPaths.push(audioPath);
    }
  }

  return audioPaths;
};

const validateAudioPaths = (scenarioPath, rootDir) => {
  const audioPaths = findAudioPaths(scenarioPath);
  const missingPaths = audioPaths.filter((audioPath) => {
    const resolvedPath = path.resolve(rootDir, 'scenarios', audioPath.trim());
    return !fs.existsSync(resolvedPath);
  });

  if (missingPaths.length > 0) {
    throw new Error(
      `Audio file(s) not found for scenario ${scenarioPath}: ${missingPaths.join(', ')}`,
    );
  }
};

const serveStatic = (rootDir) => {
  const server = http.createServer((req, res) => {
    const requestPath = decodeURIComponent(req.url.split('?')[0]);
    const safeSuffix = path.normalize(requestPath).replace(/^\.+/, '');
    const filePath = path.join(rootDir, safeSuffix === '/' ? 'index.html' : safeSuffix);

    if (!filePath.startsWith(rootDir)) {
      res.statusCode = 403;
      res.end('Forbidden');
      return;
    }

    fs.stat(filePath, (err, stats) => {
      if (err) {
        res.statusCode = 404;
        res.end('Not found');
        return;
      }

      const resolvedPath = stats.isDirectory() ? path.join(filePath, 'index.html') : filePath;
      fs.readFile(resolvedPath, (readErr, data) => {
        if (readErr) {
          res.statusCode = 500;
          res.end('Error reading file');
          return;
        }

        const ext = path.extname(resolvedPath);
        res.setHeader('Content-Type', contentTypes[ext] || 'application/octet-stream');
        res.end(data);
      });
    });
  });

  return new Promise((resolve, reject) => {
    server.listen(0, () => {
      const { port } = server.address();
      resolve({ server, port });
    });
    server.on('error', reject);
  });
};

const ensureFfmpeg = () => {
  const result = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  if (result.status !== 0) {
    throw new Error('ffmpeg is required to convert the recording to mp4. Please install ffmpeg.');
  }
};

const convertToMp4 = (inputPath, outputPath, audioPath = null) => {
  ensureFfmpeg();
  const ffmpegArgs = [
    '-y',
    '-i',
    inputPath,
    '-vf',
    'trim=start_frame=1,setpts=PTS-STARTPTS',
  ];
  if (audioPath) {
    ffmpegArgs.push('-i', audioPath, '-map', '0:v:0', '-map', '1:a:0', '-shortest');
  }
  ffmpegArgs.push(
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-movflags',
    '+faststart',
    outputPath,
  );
  const result = spawnSync('ffmpeg', ffmpegArgs, { stdio: 'inherit' });

  if (result.status !== 0) {
    throw new Error('ffmpeg failed to create mp4 output.');
  }
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    showHelp();
    return;
  }

  if (!args.scenario) {
    console.error('Missing required --scenario argument.');
    showHelp();
    process.exit(1);
  }

  const scenarioPath = path.resolve(args.scenario);
  if (!fs.existsSync(scenarioPath)) {
    throw new Error(`Scenario file not found: ${scenarioPath}`);
  }

  const rootDir = path.resolve(__dirname, '..');
  const outputPath = path.resolve(args.output);
  validateAudioPaths(scenarioPath, rootDir);
  const audioPaths = findAudioPaths(scenarioPath);
  const resolvedAudioPath = audioPaths[0]
    ? path.resolve(rootDir, 'scenarios', audioPaths[0].trim())
    : null;

  const { server, port } = await serveStatic(rootDir);

  const videoDir = fs.mkdtempSync(path.join(rootDir, 'tmp-video-'));

  let browser;
  try {
    browser = await chromium.launch({ headless: !args.headful });
    const context = await browser.newContext({
      recordVideo: { dir: videoDir, size: DEFAULT_VIEWPORT },
      viewport: DEFAULT_VIEWPORT,
    });
    const page = await context.newPage();
    await page.goto(`http://localhost:${port}/index.html`, { waitUntil: 'load' });

    await page.setInputFiles('#file-input', scenarioPath);

    await page.evaluate(() => new Promise((resolve) => {
      window.addEventListener('scenario:complete', () => resolve(), { once: true });
    }));

    await page.waitForTimeout(500);

    const video = page.video();
    await page.close();
    await context.close();

    const webmPath = await video.path();
    convertToMp4(webmPath, outputPath, resolvedAudioPath);
    fs.rmSync(videoDir, { recursive: true, force: true });

    console.log(`Recording saved to ${outputPath}`);
  } finally {
    if (browser) {
      await browser.close();
    }
    server.close();
  }
};

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
