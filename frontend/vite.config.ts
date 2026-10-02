import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { existsSync, readFileSync } from 'node:fs';
// Read only PORT from the backend config; no backend variables enter the client bundle.
const backendEnv = new URL('../backend/.env', import.meta.url);
const configuredPort = process.env.PORT ?? (existsSync(backendEnv) ? readFileSync(backendEnv, 'utf8').match(/^\s*PORT\s*=\s*["']?(\d+)/m)?.[1] : undefined) ?? '3000';
const port = Number(configuredPort);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Set a valid backend PORT.');
export default defineConfig({ plugins: [react()], server: { proxy: { '/api': `http://127.0.0.1:${port}` } } });
