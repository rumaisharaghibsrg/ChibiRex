/**
 * main.js — Konfigurasi Phaser Game untuk Virtual HQ
 *
 * Scene pipeline:
 *   Boot → Preloader → MainScene
 *
 * Physics: Arcade (ringan, cocok untuk top-down 2D)
 */

import { Boot }      from './scenes/Boot';
import { Preloader } from './scenes/Preloader';
import { MainScene } from './scenes/MainScene';
import { Game, AUTO, Scale } from 'phaser';

const config = {
    type: AUTO,
    parent: 'game-container',
    backgroundColor: '#0b0c16',
    pixelArt: true,       // rendering tajam tanpa blur untuk pixel art
    roundPixels: true,    // cegah sub-pixel ghosting

    scale: {
        mode: Scale.RESIZE,
        parent: 'game-container',
        width: '100%',
        height: '100%',
    },

    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },  // top-down, tidak ada gravitasi
            debug: false,       // ganti true untuk melihat hitbox
        },
    },

    scene: [
        Boot,
        Preloader,
        MainScene,
    ],
};

const StartGame = (parent) => {
    return new Game({ ...config, parent });
};

export default StartGame;
