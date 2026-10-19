import React from 'react';

/**
 * RexaLogo — Official brand logo loaded via genuine image asset.
 * Uses genuine Rexa logo uploaded by the user (no artificial AI SVGs or icons).
 */
export default function RexaLogo({
  className = 'h-10 w-auto',
  alt = 'Rexa - Inventory & Cash Flow Copilot',
}) {
  return (
    <img
      src="/rexa-logo-transparent.png"
      alt={alt}
      className={`object-contain select-none ${className}`}
      draggable="false"
    />
  );
}
