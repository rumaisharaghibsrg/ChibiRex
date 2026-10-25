/**
 * Preloader.js — Muat semua aset Virtual HQ lalu masuk ke MainScene
 */

import { Scene } from 'phaser';

export class Preloader extends Scene {
    constructor() {
        super('Preloader');
    }

    init() {
        // Progress bar loading di atas background
        this.add.rectangle(480, 320, 468, 32).setStrokeStyle(1, 0xffffff);
        const bar = this.add.rectangle(480 - 230, 320, 4, 28, 0xf39c12);

        this.load.on('progress', (progress) => {
            bar.width = 4 + (460 * progress);
        });

        this.add.text(480, 280, 'Virtual HQ — Memuat...', {
            fontSize: '16px',
            fontFamily: 'monospace',
            color: '#ffffff',
        }).setOrigin(0.5);
    }

    preload() {
        this.load.setPath('assets');

        // Sprite sheet karakter (akan di-load ulang di MainScene, ini pre-cache)
        this.load.spritesheet('characters', 'characters/32x32folk.png', {
            frameWidth:  32,
            frameHeight: 32,
        });

        // Gambar player tunggal (fallback)
        this.load.image('player-img', 'characters/player.png');
    }

    create() {
        // Langsung ke MainScene
        this.scene.start('MainScene');
    }
}
