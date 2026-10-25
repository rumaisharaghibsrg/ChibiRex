import { Events } from 'phaser';

// Used to emit events between Phaser scenes and React components
export const EventBus = new Events.EventEmitter();
