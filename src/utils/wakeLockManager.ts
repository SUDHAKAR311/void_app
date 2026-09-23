/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import NoSleep from 'nosleep.js';

export type WakeLockType = 'native' | 'video' | 'none';

export interface WakeLockStatus {
  isActive: boolean;
  type: WakeLockType;
}

type WakeLockListener = (status: WakeLockStatus) => void;

class DualWakeLockManager {
  private nativeSentinel: any = null;
  private noSleepInstance: NoSleep | null = null;
  private currentStatus: WakeLockStatus = { isActive: false, type: 'none' };
  private listeners: Set<WakeLockListener> = new Set();
  private isRequestInProgress = false;

  constructor() {
    // Re-acquire if app was minimized and brought back to foreground
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.currentStatus.isActive) {
          this.reacquire();
        }
      });
    }
  }

  public get status(): WakeLockStatus {
    return { ...this.currentStatus };
  }

  public subscribe(listener: WakeLockListener): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const s = this.status;
    this.listeners.forEach((fn) => fn(s));
  }

  /**
   * Request dual wake lock:
   * 1. Primary: Native Screen Wake Lock API
   * 2. Fallback: Silent microscopic looping video (NoSleep)
   */
  public async acquire(): Promise<WakeLockStatus> {
    if (this.currentStatus.isActive) {
      return this.status;
    }

    if (this.isRequestInProgress) {
      return this.status;
    }

    this.isRequestInProgress = true;

    // --- STEP 1: Attempt Native Wake Lock API ---
    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
      try {
        const sentinel = await (navigator as any).wakeLock.request('screen');
        this.nativeSentinel = sentinel;
        this.currentStatus = { isActive: true, type: 'native' };

        sentinel.addEventListener('release', () => {
          this.nativeSentinel = null;
          // If we intended to be active, trigger fallback or update status
          if (this.currentStatus.isActive && this.currentStatus.type === 'native') {
            // If document still visible, fallback to video loop
            if (document.visibilityState === 'visible') {
              this.activateVideoFallback();
            } else {
              this.currentStatus = { isActive: false, type: 'none' };
              this.notify();
            }
          }
        });

        this.isRequestInProgress = false;
        this.notify();
        return this.status;
      } catch (err) {
        console.warn('[void] Native wakeLock rejected or unavailable, activating video fallback:', err);
      }
    }

    // --- STEP 2: Fallback to Microscopic Silent Video Loop ---
    this.activateVideoFallback();
    this.isRequestInProgress = false;
    return this.status;
  }

  private activateVideoFallback() {
    try {
      if (!this.noSleepInstance) {
        this.noSleepInstance = new NoSleep();
      }
      this.noSleepInstance.enable();
      this.currentStatus = { isActive: true, type: 'video' };
      this.notify();
    } catch (videoErr) {
      console.warn('[void] Video fallback wake lock failed:', videoErr);
      this.currentStatus = { isActive: false, type: 'none' };
      this.notify();
    }
  }

  private async reacquire() {
    if (this.currentStatus.type === 'native') {
      try {
        if ('wakeLock' in navigator) {
          this.nativeSentinel = await (navigator as any).wakeLock.request('screen');
          this.currentStatus = { isActive: true, type: 'native' };
          this.notify();
        }
      } catch {
        this.activateVideoFallback();
      }
    } else if (this.currentStatus.type === 'video' && this.noSleepInstance) {
      try {
        this.noSleepInstance.enable();
        this.currentStatus = { isActive: true, type: 'video' };
        this.notify();
      } catch {}
    }
  }

  /**
   * Release both native wake lock and video fallback
   */
  public release() {
    if (this.nativeSentinel) {
      try {
        this.nativeSentinel.release();
      } catch {}
      this.nativeSentinel = null;
    }

    if (this.noSleepInstance) {
      try {
        this.noSleepInstance.disable();
      } catch {}
    }

    this.currentStatus = { isActive: false, type: 'none' };
    this.isRequestInProgress = false;
    this.notify();
  }
}

export const wakeLockManager = new DualWakeLockManager();
