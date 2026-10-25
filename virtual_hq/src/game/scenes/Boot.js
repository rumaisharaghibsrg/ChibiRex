/**
 * Boot.js — Load aset minimal untuk layar loading, lalu ke Preloader
 */

import { Scene } from 'phaser';

export class Boot extends Scene {
    constructor() {
        super('Boot');
    }

    preload() {
        // Background gelap untuk layar loading (pakai bg.png dari template)
        this.load.image('background', 'assets/bg.png');
    }

    create() {
        this.scene.start('Preloader');
    }
}
