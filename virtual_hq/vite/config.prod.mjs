import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

const phasermsg = () => {
    return {
        name: 'phasermsg',
        buildStart() {
            process.stdout.write(`Building for production...\n`);
        },
        buildEnd() {
            const line = "---------------------------------------------------------";
            const msg = `❤️❤️❤️ Tell us about your game! - games@phaser.io ❤️❤️❤️`;
            process.stdout.write(`${line}\n${msg}\n${line}\n`);

            process.stdout.write(`✨ Done ✨\n`);
        }
    }
}

function copyDirSafe(src, dest) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const file of fs.readdirSync(src)) {
        if (file === 'frame_debug') continue;
        const srcFile = path.join(src, file);
        const destFile = path.join(dest, file);
        try {
            const stat = fs.statSync(srcFile);
            if (stat.isDirectory()) {
                copyDirSafe(srcFile, destFile);
            } else {
                fs.copyFileSync(srcFile, destFile);
            }
        } catch {
            // Abaikan folder sementara / delete-pending
        }
    }
}

const copyPublicSafePlugin = () => {
    return {
        name: 'copy-public-safe',
        closeBundle() {
            const publicDir = path.resolve('public');
            const outDir = path.resolve('dist');
            if (fs.existsSync(publicDir)) {
                copyDirSafe(publicDir, outDir);
            }
        }
    };
};

export default defineConfig({
    base: './',
    plugins: [
        react(),
        phasermsg(),
        copyPublicSafePlugin()
    ],
    logLevel: 'warning',
    build: {
        copyPublicDir: false,
        rollupOptions: {
            output: {
                manualChunks: {
                    phaser: ['phaser']
                }
            }
        },
        minify: 'terser',
        terserOptions: {
            compress: {
                passes: 2
            },
            mangle: true,
            format: {
                comments: false
            }
        }
    }
});
