/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { QrCode, Copy, Check, ExternalLink } from 'lucide-react';

interface QRCodeDisplayProps {
  code: string;
  onClose?: () => void;
}

export const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({ code }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}?code=${code}`
    : `https://void.app?code=${code}`;

  useEffect(() => {
    QRCode.toDataURL(shareUrl, {
      width: 256,
      margin: 1.5,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('QR generation error:', err));
  }, [shareUrl]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Ignore fallback
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // Ignore fallback
    }
  };

  return (
    <div className="flex flex-col items-center text-center p-5 rounded-2xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
      <div className="inline-flex items-center gap-1.5 text-xs font-mono text-neutral-500 dark:text-neutral-400 mb-3">
        <QrCode className="w-4 h-4 text-teal-500" />
        <span>Scan with phone camera to auto-pair</span>
      </div>

      {/* QR Canvas / Image */}
      <div className="p-3 bg-white rounded-xl shadow-md border border-neutral-200 dark:border-neutral-700">
        {qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt={`QR Code for void pairing ${code}`}
            className="w-44 h-44 sm:w-48 sm:h-48 rounded"
          />
        ) : (
          <div className="w-44 h-44 flex items-center justify-center text-xs text-neutral-400 font-mono animate-pulse">
            Generating Secure QR...
          </div>
        )}
      </div>

      {/* Action shortcuts */}
      <div className="flex items-center gap-2 mt-4 w-full max-w-xs">
        <button
          id="copy-code-btn"
          onClick={copyCode}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-mono rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        >
          {copiedCode ? <Check className="w-3.5 h-3.5 text-teal-500" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copiedCode ? 'PIN Copied' : 'Copy PIN'}</span>
        </button>

        <button
          id="copy-link-btn"
          onClick={copyLink}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-mono rounded-lg border border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-300 hover:bg-teal-500/20 transition-colors"
        >
          {copiedLink ? <Check className="w-3.5 h-3.5 text-teal-500" /> : <ExternalLink className="w-3.5 h-3.5" />}
          <span>{copiedLink ? 'Link Copied' : 'Copy Link'}</span>
        </button>
      </div>
    </div>
  );
};
