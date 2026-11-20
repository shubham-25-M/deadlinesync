import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Deadline, DeadlineSource } from './src/types.ts';
import { getISTContext } from './src/utils/istDate.ts';
import { normalizeSource } from './src/utils/batchParser.ts';
import { extractFromPdfInput, extractFromTextInput } from './server/geminiService.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '25mb' }));

  app.get('/api/health', (_req, res) => {
    const ist = getISTContext();
    res.json({ ok: true, ist });
  });

  app.post('/api/extract', async (req, res) => {
    try {
      const body = req.body as {
        text?: unknown;
        source?: unknown;
        batchMode?: unknown;
        existingDeadlines?: unknown;
      };

      const text = typeof body.text === 'string' ? body.text : '';
      if (!text.trim()) {
        res.status(400).json({ error: 'Please paste a message or notice to extract deadlines.' });
        return;
      }

      const source: DeadlineSource = normalizeSource(
        typeof body.source === 'string' ? body.source : undefined,
        'WhatsApp'
      );
      const batchMode = Boolean(body.batchMode);
      const existingDeadlines: Deadline[] = Array.isArray(body.existingDeadlines)
        ? (body.existingDeadlines as Deadline[])
        : [];

      const summary = await extractFromTextInput({
        text,
        source,
        batchMode,
        existingDeadlines,
      });

      res.json(summary);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to extract deadlines using Gemini.';
      console.error('[POST /api/extract] Error:', error);
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/extract-pdf', async (req, res) => {
    try {
      const body = req.body as {
        fileName?: unknown;
        pdfBase64?: unknown;
        source?: unknown;
        existingDeadlines?: unknown;
      };

      const fileName =
        typeof body.fileName === 'string' && body.fileName.trim()
          ? body.fileName.trim()
          : 'uploaded-notice.pdf';
      const pdfBase64 = typeof body.pdfBase64 === 'string' ? body.pdfBase64.trim() : '';

      if (!pdfBase64) {
        res.status(400).json({ error: 'No PDF content received. Please choose a valid PDF file.' });
        return;
      }

      const source: DeadlineSource = normalizeSource(
        typeof body.source === 'string' ? body.source : undefined,
        'College Portal'
      );
      const existingDeadlines: Deadline[] = Array.isArray(body.existingDeadlines)
        ? (body.existingDeadlines as Deadline[])
        : [];

      const summary = await extractFromPdfInput({
        fileName,
        pdfBase64,
        source,
        existingDeadlines,
      });

      res.json(summary);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to parse PDF notice using Gemini.';
      console.error('[POST /api/extract-pdf] Error:', error);
      res.status(500).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`DeadlineSync server running at http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start DeadlineSync server:', err);
  process.exit(1);
});
