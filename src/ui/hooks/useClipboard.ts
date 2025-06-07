import React, { useState, useCallback, useRef } from 'react';

export interface UseClipboardReturn {
  copyToClipboard: (text: string) => Promise<boolean>;
  isSuccess: boolean;
  isError: boolean;
  reset: () => void;
}

export function useClipboard(resetDelay = 1500): UseClipboardReturn {
  const [isSuccess, setIsSuccess] = useState(false);
  const [isError, setIsError] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const reset = useCallback(() => {
    setIsSuccess(false);
    setIsError(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }
  }, []);

  const fallbackCopyToClipboard = useCallback(async (text: string): Promise<boolean> => {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    } catch (err) {
      console.error('Fallback copy failed:', err);
      return false;
    }
  }, []);

  const copyToClipboard = useCallback(async (text: string): Promise<boolean> => {
    // Reset previous state
    reset();

    try {
      let success = false;

      // Try modern Clipboard API first
      if (navigator.clipboard && window.isSecureContext) {
        try {
          await navigator.clipboard.writeText(text);
          success = true;
        } catch (clipboardErr) {
          console.warn('Clipboard API failed, trying fallback:', clipboardErr);
          success = await fallbackCopyToClipboard(text);
        }
      } else {
        // Use fallback for older browsers or non-secure contexts
        success = await fallbackCopyToClipboard(text);
      }

      if (success) {
        setIsSuccess(true);
        timeoutRef.current = setTimeout(() => {
          setIsSuccess(false);
        }, resetDelay);
      } else {
        setIsError(true);
        timeoutRef.current = setTimeout(() => {
          setIsError(false);
        }, resetDelay);
      }

      return success;
    } catch (err) {
      console.error('Copy operation failed:', err);
      setIsError(true);
      timeoutRef.current = setTimeout(() => {
        setIsError(false);
      }, resetDelay);
      return false;
    }
  }, [resetDelay, reset, fallbackCopyToClipboard]);

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    copyToClipboard,
    isSuccess,
    isError,
    reset,
  };
}
