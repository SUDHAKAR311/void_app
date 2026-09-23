/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { ChoiceView } from './components/ChoiceView';
import { SendView } from './components/SendView';
import { ReceiveView } from './components/ReceiveView';
import { TransferDashboard } from './components/TransferDashboard';
import { FeaturesModal } from './components/FeaturesModal';
import { SpeedGuideModal } from './components/SpeedGuideModal';
import { Footer } from './components/Footer';
import { TransferManager } from './lib/transferManager';
import { 
  AppView, 
  DistributionMode,
  TransferMetadata, 
  TransferProgress, 
  VoidRole, 
  VoidStatus 
} from './types';

export function App() {
  // Theme state: default to clean white light mode as requested
  const [isDark, setIsDark] = useState<boolean>(() => false);

  // App routing & views
  const [view, setView] = useState<AppView>('choice');
  const [role, setRole] = useState<VoidRole>('sender');
  const [distributionMode, setDistributionMode] = useState<DistributionMode>('p2p');
  const [code, setCode] = useState<string>('');
  const [receivePin, setReceivePin] = useState<string>('');
  const [status, setStatus] = useState<VoidStatus>('idle');
  const [isSocketConnected, setIsSocketConnected] = useState<boolean>(false);
  const [isReceiverReady, setIsReceiverReady] = useState<boolean>(false);
  const [isLoadingReceive, setIsLoadingReceive] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [warningMessage, setWarningMessage] = useState<string>('');
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [lockRemainingSeconds, setLockRemainingSeconds] = useState<number>(0);
  const [showFeatures, setShowFeatures] = useState<boolean>(false);
  const [showSpeedGuide, setShowSpeedGuide] = useState<boolean>(false);

  // Active send payload (multi-files supported)
  const [activeSendTab, setActiveSendTab] = useState<'file' | 'text'>('file');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [clipboardText, setClipboardText] = useState<string>('');

  // Active transfer state
  const [metadata, setMetadata] = useState<TransferMetadata | null>(null);
  const [progress, setProgress] = useState<TransferProgress>({
    bytesTransferred: 0,
    totalBytes: 0,
    percentage: 0,
    speedBps: 0,
    etaSeconds: 0,
    currentChunk: 0,
    totalChunks: 1,
    mode: 'p2p-direct',
    encryptionActive: true,
    sha256Verified: false,
  });

  // Completed receiver artifacts
  const [receivedText, setReceivedText] = useState<string>('');
  const [downloadBlob, setDownloadBlob] = useState<{ blob: Blob; filename: string } | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string>('');
  const [unpackedFiles, setUnpackedFiles] = useState<Array<{ name: string; blob: Blob; size: number }>>([]);

  const managerRef = useRef<TransferManager | null>(null);

  // Sync dark class to html document
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  // Check rate-limit / lockout status on mount
  useEffect(() => {
    fetch('/api/check-lockout')
      .then((res) => res.json())
      .then((data) => {
        if (data.locked) {
          setIsLocked(true);
          setLockRemainingSeconds(data.remainingSeconds || 1800);
        }
      })
      .catch(() => {});
  }, []);

  // Teardown manager on page unmount
  useEffect(() => {
    return () => {
      if (managerRef.current) {
        managerRef.current.destroy();
      }
    };
  }, []);

  // Initialize TransferManager with reactive event callbacks
  const initManager = (newRole: VoidRole, assignedCode: string, mode: DistributionMode = 'p2p'): TransferManager => {
    if (managerRef.current) {
      managerRef.current.destroy();
    }

    const manager = new TransferManager(newRole, {
      onStatusChange: (newStatus) => {
        setStatus(newStatus);
      },
      onProgressUpdate: (newProgress) => {
        setProgress(newProgress);
      },
      onPartnerJoined: async () => {
        setIsReceiverReady(true);
        // Automatically announce payload to receiver upon connection
        if (selectedFiles.length > 0) {
          const meta = await manager.preparePayload({ files: selectedFiles, distributionMode: mode });
          setMetadata(meta);
        } else if (clipboardText.trim()) {
          const meta = await manager.preparePayload({ text: clipboardText, distributionMode: mode });
          setMetadata(meta);
        }
      },
      onMetadataReceived: async (meta) => {
        setMetadata(meta);
        setIsLoadingReceive(false);
        setWarningMessage('');
        setErrorMessage('');
        setView('transfer');
        await manager.signalReadyToReceive();
      },
      onReceiverReady: () => {
        setView('transfer');
      },
      onTextReceived: (text) => {
        setReceivedText(text);
      },
      onFileReadyToDownload: (blob, filename) => {
        const url = URL.createObjectURL(blob);
        setDownloadBlob({ blob, filename });
        setDownloadUrl(url);

        // Auto trigger download safely
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      },
      onMultiFilesReady: (files, zipBlob) => {
        setUnpackedFiles(files);
      },
      onError: (msg, locked, remainingSecs, warning) => {
        if (locked) {
          setIsLocked(true);
          setLockRemainingSeconds(remainingSecs || 1800);
        }
        if (warning) {
          setWarningMessage(warning);
        }
        setErrorMessage(msg);
        setStatus('error');
        setIsLoadingReceive(false);
      },
    });

    managerRef.current = manager;
    manager.setCode(assignedCode);
    manager.setDistributionMode(mode);

    // Track socket connection
    const sock = manager.getSocket();
    sock.on('connect', () => setIsSocketConnected(true));
    sock.on('disconnect', () => setIsSocketConnected(false));
    setIsSocketConnected(sock.connected);

    return manager;
  };

  // Sender starts: opens SendView with selected mode
  const handleSelectSend = (preferredMode?: DistributionMode) => {
    setCode('');
    setRole('sender');
    if (preferredMode) {
      setDistributionMode(preferredMode);
    }
    setView('send');
    setStatus('idle');
    setIsReceiverReady(false);
    setErrorMessage('');
    setWarningMessage('');
    setMetadata(null);
  };

  // User clicked "Send to Get Void Code"
  const handleGenerateCode = async () => {
    const generatedPin = Math.floor(100000 + Math.random() * 900000).toString();
    setCode(generatedPin);
    setStatus('waiting');
    setIsReceiverReady(false);
    setErrorMessage('');
    setWarningMessage('');

    const manager = initManager('sender', generatedPin, distributionMode);
    manager.getSocket().emit('create-void', { code: generatedPin, mode: distributionMode });

    // Prepare encrypted payload under the newly generated PIN
    if (activeSendTab === 'text' && clipboardText.trim()) {
      try {
        const meta = await manager.preparePayload({ text: clipboardText, distributionMode });
        setMetadata(meta);
      } catch (err) {
        console.warn('[void] Error preparing text payload:', err);
      }
    } else if (selectedFiles.length > 0) {
      try {
        const meta = await manager.preparePayload({ files: selectedFiles, distributionMode });
        setMetadata(meta);
      } catch (err) {
        console.warn('[void] Error preparing files payload:', err);
      }
    }
  };

  // Regenerate 6-digit PIN on sender side
  const handleRegenerateCode = () => {
    const newPin = Math.floor(100000 + Math.random() * 900000).toString();
    setCode(newPin);
    setIsReceiverReady(false);
    setErrorMessage('');
    setWarningMessage('');
    setMetadata(null);

    const manager = initManager('sender', newPin, distributionMode);
    manager.getSocket().emit('create-void', { code: newPin, mode: distributionMode });

    if (activeSendTab === 'text' && clipboardText.trim()) {
      manager.preparePayload({ text: clipboardText, distributionMode }).then(setMetadata).catch(() => {});
    } else if (selectedFiles.length > 0) {
      manager.preparePayload({ files: selectedFiles, distributionMode }).then(setMetadata).catch(() => {});
    }
  };

  // Sender file handlers (Multiple files support)
  const handleSelectFiles = async (files: File[]) => {
    setSelectedFiles(files);
    if (files.length === 0) {
      setCode('');
      setMetadata(null);
      if (managerRef.current) {
        managerRef.current.destroy();
        managerRef.current = null;
      }
      return;
    }
    if (managerRef.current && code) {
      try {
        const meta = await managerRef.current.preparePayload({ files, distributionMode });
        setMetadata(meta);
        if (isReceiverReady) {
          managerRef.current.broadcastMetadata(meta);
        }
      } catch (err: any) {
        console.warn('[void] Error preparing files:', err);
      }
    }
  };

  const handleChangeClipboardText = async (text: string) => {
    setClipboardText(text);
    if (managerRef.current && text.trim().length > 0) {
      try {
        const meta = await managerRef.current.preparePayload({ text, distributionMode });
        setMetadata(meta);
        if (isReceiverReady) {
          managerRef.current.broadcastMetadata(meta);
        }
      } catch (err: any) {
        console.warn('[void] Error preparing text:', err);
      }
    }
  };

  // Receiver starts: shows PIN input
  const handleSelectReceive = () => {
    setRole('receiver');
    setView('receive');
    setStatus('idle');
    setMetadata(null);
    setErrorMessage('');
    setWarningMessage('');
    setIsLoadingReceive(false);
  };

  // Receiver submits 6-digit code
  const handleSubmitPin = useCallback((pin: string) => {
    if (pin.length !== 6 || isLocked) return;
    setIsLoadingReceive(true);
    setErrorMessage('');
    setWarningMessage('');
    setCode(pin);

    const manager = initManager('receiver', pin);
    manager.getSocket().emit('join-void', pin);
  }, [isLocked]);

  // QR Code Auto-Retrieval: Detect ?code= in URL on mount and auto-initiate
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlCode = params.get('code');
      if (urlCode && urlCode.length === 6 && /^\d{6}$/.test(urlCode)) {
        // Clean URL to prevent repeated triggers on reload
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);

        setReceivePin(urlCode);
        setRole('receiver');
        setView('receive');
        handleSubmitPin(urlCode);
      }
    }
  }, [handleSubmitPin]);

  // Manual fallback transfer trigger for sender
  const handleStartSenderTransfer = async () => {
    if (!managerRef.current) return;
    setErrorMessage('');

    let currentMeta = metadata;
    if (!currentMeta) {
      if (activeSendTab === 'text' && clipboardText.trim()) {
        currentMeta = await managerRef.current.preparePayload({ text: clipboardText, distributionMode });
        setMetadata(currentMeta);
      } else if (selectedFiles.length > 0) {
        currentMeta = await managerRef.current.preparePayload({ files: selectedFiles, distributionMode });
        setMetadata(currentMeta);
      }
    }

    if (currentMeta) {
      setView('transfer');
      if (distributionMode === 'p2p' && isReceiverReady) {
        managerRef.current.broadcastMetadata(currentMeta);
        await managerRef.current.startStreamingChunks();
      }
    }
  };

  // Manual fallback accept trigger for receiver
  const handleAcceptReceiverTransfer = async () => {
    if (!managerRef.current) return;
    setView('transfer');
    await managerRef.current.signalReadyToReceive();
  };

  // Reset to root home view
  const handleReset = () => {
    if (managerRef.current) {
      managerRef.current.destroy();
      managerRef.current = null;
    }
    setView('choice');
    setStatus('idle');
    setCode('');
    setReceivePin('');
    setSelectedFiles([]);
    setClipboardText('');
    setMetadata(null);
    setReceivedText('');
    setDownloadBlob(null);
    setUnpackedFiles([]);
    if (downloadUrl) {
      try { URL.revokeObjectURL(downloadUrl); } catch {}
      setDownloadUrl('');
    }
    setIsReceiverReady(false);
    setIsLoadingReceive(false);
    setErrorMessage('');
    setWarningMessage('');
    setProgress({
      bytesTransferred: 0,
      totalBytes: 0,
      percentage: 0,
      speedBps: 0,
      etaSeconds: 0,
      currentChunk: 0,
      totalChunks: 1,
      mode: 'p2p-direct',
      encryptionActive: true,
      sha256Verified: false,
    });
  };

  // Manual file save trigger
  const handleManualDownload = () => {
    if (!downloadBlob) return;
    const url = downloadUrl || URL.createObjectURL(downloadBlob.blob);
    if (!downloadUrl) setDownloadUrl(url);
    const a = document.createElement('a');
    a.href = url;
    a.download = downloadBlob.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-200 ${
      isDark 
        ? 'bg-[#0a0a0c] text-neutral-100' 
        : 'bg-white text-neutral-900'
    } selection:bg-teal-500/30 selection:text-teal-600 dark:selection:text-teal-300 font-sans`}>
      {/* Top Header */}
      <Header
        isDark={isDark}
        onToggleTheme={() => setIsDark(!isDark)}
        onOpenFeatures={() => setShowFeatures(true)}
        onOpenSpeedGuide={() => setShowSpeedGuide(true)}
        isConnected={isSocketConnected}
        onResetToHome={handleReset}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 md:p-8">
        {view === 'choice' && (
          <ChoiceView
            onSelectSend={handleSelectSend}
            onSelectReceive={handleSelectReceive}
            onOpenFeatures={() => setShowFeatures(true)}
            onOpenSpeedGuide={() => setShowSpeedGuide(true)}
          />
        )}

        {view === 'send' && (
          <SendView
            code={code}
            distributionMode={distributionMode}
            onChangeDistributionMode={setDistributionMode}
            onBack={handleReset}
            onGenerateCode={handleGenerateCode}
            onRegenerateCode={handleRegenerateCode}
            selectedFiles={selectedFiles}
            onSelectFiles={handleSelectFiles}
            clipboardText={clipboardText}
            onChangeClipboardText={handleChangeClipboardText}
            activeTab={activeSendTab}
            onChangeTab={setActiveSendTab}
            isReceiverReady={isReceiverReady}
            onStartTransfer={handleStartSenderTransfer}
          />
        )}

        {view === 'receive' && (
          <ReceiveView
            pin={receivePin}
            onChangePin={setReceivePin}
            onBack={handleReset}
            onSubmitPin={handleSubmitPin}
            isLoading={isLoadingReceive}
            errorMessage={errorMessage}
            warningMessage={warningMessage}
            isLocked={isLocked}
            lockRemainingSeconds={lockRemainingSeconds}
            incomingMetadata={metadata}
            onAcceptTransfer={handleAcceptReceiverTransfer}
          />
        )}

        {view === 'transfer' && (
          <TransferDashboard
            role={role}
            status={status}
            metadata={metadata || (managerRef.current ? managerRef.current.getMetadata() : null)}
            progress={progress}
            errorMessage={errorMessage}
            onCancel={handleReset}
            onDownloadManual={handleManualDownload}
            downloadBlob={downloadBlob}
            downloadUrl={downloadUrl}
            unpackedFiles={unpackedFiles}
            receivedText={receivedText}
            onReset={handleReset}
            onOpenSpeedGuide={() => setShowSpeedGuide(true)}
          />
        )}
      </main>

      {/* Professional Ephemeral Architecture Footer */}
      <Footer 
        onOpenFeatures={() => setShowFeatures(true)} 
        onOpenSpeedGuide={() => setShowSpeedGuide(true)} 
      />

      {/* Features Modal */}
      <FeaturesModal
        isOpen={showFeatures}
        onClose={() => setShowFeatures(false)}
        onOpenSpeedGuide={() => setShowSpeedGuide(true)}
      />

      {/* Speed & Network Guide Modal */}
      <SpeedGuideModal
        isOpen={showSpeedGuide}
        onClose={() => setShowSpeedGuide(false)}
      />
    </div>
  );
}

export default App;
