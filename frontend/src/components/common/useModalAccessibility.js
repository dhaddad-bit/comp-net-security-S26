import { useEffect, useId, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

function getFocusableElements(container) {
  if (!container) return [];
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter((el) => {
    if (!(el instanceof HTMLElement)) return false;
    return !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true';
  });
}

export function useModalAccessibility({ isOpen, onClose, disableClose = false } = {}) {
  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!isOpen) return undefined;

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialogEl = dialogRef.current;
    if (!dialogEl) return undefined;

    const focusable = getFocusableElements(dialogEl);
    if (focusable.length > 0) {
      focusable[0].focus();
    } else {
      dialogEl.focus();
    }

    const handleKeyDown = (event) => {
      if (!dialogRef.current) return;

      if (event.key === 'Escape') {
        if (!disableClose && typeof onClose === 'function') {
          event.preventDefault();
          onClose();
        }
        return;
      }

      if (event.key !== 'Tab') return;

      const focusTargets = getFocusableElements(dialogRef.current);
      if (focusTargets.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const currentIndex = focusTargets.indexOf(document.activeElement);
      const movingBackward = event.shiftKey;

      if (movingBackward && currentIndex <= 0) {
        event.preventDefault();
        focusTargets[focusTargets.length - 1].focus();
      } else if (!movingBackward && currentIndex === focusTargets.length - 1) {
        event.preventDefault();
        focusTargets[0].focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        previousFocusRef.current.focus();
      }
    };
  }, [disableClose, isOpen, onClose]);

  return {
    dialogRef,
    titleId,
    descriptionId
  };
}
