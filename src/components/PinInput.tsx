/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect } from 'react';

interface PinInputProps {
  value: string;
  onChange: (val: string) => void;
  onComplete?: (val: string) => void;
  disabled?: boolean;
}

export const PinInput: React.FC<PinInputProps> = ({
  value,
  onChange,
  onComplete,
  disabled = false,
}) => {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  // Focus the first input on initial mount
  useEffect(() => {
    if (!disabled && inputsRef.current[0]) {
      inputsRef.current[0].focus();
    }
  }, [disabled]);

  const digits = value.padEnd(6, ' ').slice(0, 6).split('');

  const handleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const digit = rawVal.replace(/\D/g, '').slice(-1); // Take last numeric digit

    const currentArray = value.split('');
    currentArray[index] = digit || '';
    const newPin = currentArray.join('').slice(0, 6);

    onChange(newPin);

    if (digit && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }

    if (newPin.length === 6 && onComplete) {
      onComplete(newPin);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!digits[index] || digits[index] === ' ') {
        if (index > 0) {
          inputsRef.current[index - 1]?.focus();
        }
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputsRef.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pastedData) return;

    onChange(pastedData);

    const focusIndex = Math.min(pastedData.length, 5);
    inputsRef.current[focusIndex]?.focus();

    if (pastedData.length === 6 && onComplete) {
      onComplete(pastedData);
    }
  };

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-3 my-4">
      {[0, 1, 2, 3, 4, 5].map((index) => {
        const char = digits[index] && digits[index] !== ' ' ? digits[index] : '';
        return (
          <input
            key={index}
            ref={(el) => {
              inputsRef.current[index] = el;
            }}
            id={`pin-input-${index}`}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            value={char}
            disabled={disabled}
            onChange={(e) => handleChange(index, e)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            className={`w-11 h-14 sm:w-14 sm:h-16 text-center text-2xl sm:text-3xl font-mono font-bold rounded-xl border transition-all duration-200 outline-none
              ${
                char
                  ? 'border-teal-500/80 bg-teal-500/5 text-teal-600 dark:text-teal-400 shadow-[0_0_12px_rgba(0,245,212,0.15)]'
                  : 'border-neutral-300 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/80 text-neutral-900 dark:text-neutral-100'
              }
              focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:scale-[1.03]
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
          />
        );
      })}
    </div>
  );
};
