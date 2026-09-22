/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Header } from './components/Header';
import { ChoiceView } from './components/ChoiceView';
import { SendView } from './components/SendView';
import { ReceiveView } from './components/ReceiveView';
import { TransferDashboard } from './components/TransferDashboard';
import { FeaturesModal } from './components/FeaturesModal';
import { SpeedGuideModal } from './components/SpeedGuideModal';
import { TransferManager } from './lib/transferManager';
import { 
  AppView, 
  TransferMetadata, 
  TransferProgress, 
  VoidRole, 
  VoidStatus 
} from './types';

export function App() {
  // Theme state
  const [isDark, setIsDark] = useState<boolean>(() => {
    return true; // Default to sleek twilight dark mode
  });

  // App routing & views
  const [view, setView] = useState<AppView>('choice');
  const [role, setRole] = useState<VoidRole>('sender');
  const [code, setCode] = useState<string>('');
  const [receivePin, setReceivePin] = useState<string>('');
  const [status, setStatus] = useState<VoidStatus>('idle');
  const [isSocketConnected, setIsSocketConnected] = useState<boolean>(false);
  const [isReceiverReady, setIsReceiverReady] = useState<boolean>(false);
  const [isLoadingReceive, setIsLoadingReceive] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [showFeatures, setShowFeatures] = useState<boolean>(false);
  const [showSpeedGuide, setShowSpeedGuide] = useState<boolean>(false);

  // Active send payload
  const [activeSendTab, setActiveSendTab] = useState<'file' | 'text'>('file');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
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

  const managerRef = useRef<TransferManager | null>(null);

  // Sync dark class to html document
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  // Teardown manager on page unmount
  useEffect(() => {
    return () => {
      if (managerRef.current) {
        managerRef.current.destroy();
      }
    };
  }, []);

  // Initialize TransferManager with reactive event callbacks
  const initManager = (newRole: VoidRole, assignedCode: string): TransferManager => {
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
        if (selectedFile) {
          const meta = await manager.preparePayload({ file: selectedFile });
          setMetadata(meta);
        } else if (clipboardText.trim()) {
          const meta = await manager.preparePayload({ text: clipboardText });
          setMetadata(meta);
        }
      },
      onMetadataReceived: async (meta) => {
        setMetadata(meta);
        setIsLoadingReceive(false);
        // Automated transfer: immediately signal ready to receive
        setView('transfer');
        await manager.signalReadyToReceive();
      },
      onReceiverReady: () => {
        // Receiver signaled ready, sender transitions to transfer view
        setView('transfer');
      },
      onTextReceived: (text) => {
        setReceivedText(text);
      },
      onFileReadyToDownload: (blob, filename) => {
        const url = URL.createObjectURL(blob);
        setDownloadBlob({ blob, filename });
        setDownloadUrl(url);
        // Automatically trigger browser download safely
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      },
      onError: (msg) => {
        setErrorMessage(msg);
        setStatus('error');
        setIsLoadingReceive(false);
      },
    });

    managerRef.current = manager;
    manager.setCode(assignedCode);

    // Track socket connection
    const sock = manager.getSocket();
    sock.on('connect', () => setIsSocketConnected(true));
    sock.on('disconnect', () => setIsSocketConnected(false));
    setIsSocketConnected(sock.connected);

    return manager;
  };

  // Sender starts: opens SendView without generating a code until the user selects a file/text and clicks Send
  const handleSelectSend = () => {
    setCode('');
    setRole('sender');
    setView('send');
    setStatus('idle');
    setIsReceiverReady(false);
    setErrorMessage('');
    setMetadata(null);
  };

  // User clicked "Send to Get Void Code" after picking their file or typing text
  const handleGenerateCode = async () => {
    const generatedPin = Math.floor(100000 + Math.random() * 900000).toString();
    setCode(generatedPin);
    setStatus('waiting');
    setIsReceiverReady(false);
    setErrorMessage('');

    const manager = initManager('sender', generatedPin);
    manager.getSocket().emit('create-void', generatedPin);

    // Prepare encrypted payload under the newly generated PIN
    if (activeSendTab === 'text' && clipboardText.trim()) {
      try {
        const meta = await manager.preparePayload({ text: clipboardText });
        setMetadata(meta);
      } catch (err) {
        console.warn('[void] Error preparing text payload:', err);
      }
    } else if (selectedFile) {
      try {
        const meta = await manager.preparePayload({ file: selectedFile });
        setMetadata(meta);
      } catch (err) {
        console.warn('[void] Error preparing file payload:', err);
      }
    }
  };

  // Regenerate 6-digit PIN on sender side
  const handleRegenerateCode = () => {
    const newPin = Math.floor(100000 + Math.random() * 900000).toString();
    setCode(newPin);
    setIsReceiverReady(false);
    setErrorMessage('');
    setMetadata(null);

    const manager = initManager('sender', newPin);
    manager.getSocket().emit('create-void', newPin);

    // Re-prepare payload under new PIN if file or text is already chosen
    if (activeSendTab === 'text' && clipboardText.trim()) {
      manager.preparePayload({ text: clipboardText }).then(setMetadata).catch(() => {});
    } else if (selectedFile) {
      manager.preparePayload({ file: selectedFile }).then(setMetadata).catch(() => {});
    }
  };

  // Sender payload selection handlers
  const handleSelectFile = async (file: File | null) => {
    setSelectedFile(file);
    if (!file) {
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
        const meta = await managerRef.current.preparePayload({ file });
        setMetadata(meta);
        if (isReceiverReady) {
          managerRef.current.broadcastMetadata(meta);
        }
      } catch (err: any) {
        console.warn('[void] Error preparing file:', err);
      }
    }
  };

  const handleChangeClipboardText = async (text: string) => {
    setClipboardText(text);
    if (managerRef.current && text.trim().length > 0) {
      try {
        const meta = await managerRef.current.preparePayload({ text });
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
    setIsLoadingReceive(false);
  };

  // Receiver submits 6-digit code
  const handleSubmitPin = (pin: string) => {
    if (pin.length !== 6) return;
    setIsLoadingReceive(true);
    setErrorMessage('');
    setCode(pin);

    const manager = initManager('receiver', pin);
    manager.getSocket().emit('join-void', pin);
  };

  // Manual fallback transfer trigger for sender
  const handleStartSenderTransfer = async () => {
    if (!managerRef.current) return;
    setErrorMessage('');

    let currentMeta = metadata;
    if (!currentMeta) {
      if (activeSendTab === 'text' && clipboardText.trim()) {
        currentMeta = await managerRef.current.preparePayload({ text: clipboardText });
        setMetadata(currentMeta);
      } else if (selectedFile) {
        currentMeta = await managerRef.current.preparePayload({ file: selectedFile });
        setMetadata(currentMeta);
      }
    }

    if (currentMeta && isReceiverReady) {
      setView('transfer');
      managerRef.current.broadcastMetadata(currentMeta);
      await managerRef.current.startStreamingChunks();
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
    setSelectedFile(null);
    setClipboardText('');
    setMetadata(null);
    setReceivedText('');
    setDownloadBlob(null);
    if (downloadUrl) {
      try { URL.revokeObjectURL(downloadUrl); } catch {}
      setDownloadUrl('');
    }
    setIsReceiverReady(false);
    setIsLoadingReceive(false);
    setErrorMessage('');
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
        : 'bg-neutral-50 text-neutral-900'
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
            onBack={handleReset}
            onGenerateCode={handleGenerateCode}
            onRegenerateCode={handleRegenerateCode}
            selectedFile={selectedFile}
            onSelectFile={handleSelectFile}
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
            receivedText={receivedText}
            onReset={handleReset}
            onOpenSpeedGuide={() => setShowSpeedGuide(true)}
          />
        )}
      </main>

      {/* Ephemeral Architecture Footer */}
      <footer className="w-full py-4 border-t border-neutral-200/80 dark:border-neutral-800/80 text-center text-xs font-mono text-neutral-400 dark:text-neutral-600">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>void • Ephemeral WebRTC &amp; Web Crypto Engine</span>
          <span>Zero Server Storage • RAM Only • End-to-End Encrypted</span>
        </div>
      </footer>

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
