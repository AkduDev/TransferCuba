'use client';

import React from 'react';

/**
 * Carcasa accesible compartida por todos los modales de TransferCuba.
 *
 * Aporta lo que el `div` copiado en cada modal no tenía: semántica de diálogo,
 * cierre con Escape, trampa y restauración de foco, clic en el fondo y bloqueo
 * del scroll de la página. Sin dependencias nuevas.
 *
 * Los modales pueden coexistir (p. ej. el de mensajería abre el de cuenta sin
 * cerrarse), así que la pila decide quién manda: solo el diálogo superior
 * responde a Escape, atrapa el foco y acepta el clic en el fondo.
 */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const stack: symbol[] = [];
let bodyOverflow: string | null = null;

interface ModalShellProps {
  isOpen: boolean;
  onClose: () => void;
  /** id del elemento que titula el diálogo; se anuncia al abrir. */
  labelledBy: string;
  describedBy?: string;
  /** Capa de fondo. Se separa para que un modal pueda teñirla distinto. */
  backdropClassName?: string;
  /** Posicionamiento de la capa: z-index y padding. */
  overlayClassName?: string;
  /** Colocación del panel dentro de la capa. Un cajón lateral la cambia. */
  alignClassName?: string;
  panelClassName?: string;
  children: React.ReactNode;
}

function visibleFocusable(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.getClientRects().length > 0
  );
}

export default function ModalShell({
  isOpen,
  onClose,
  labelledBy,
  describedBy,
  backdropClassName = 'bg-slate-950/70 backdrop-blur-sm',
  overlayClassName = '',
  alignClassName = 'items-center justify-center overflow-y-auto',
  panelClassName = '',
  children
}: ModalShellProps) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const restoreRef = React.useRef<HTMLElement | null>(null);
  const startedOnOverlay = React.useRef(false);
  const tokenRef = React.useRef<symbol | null>(null);
  if (tokenRef.current === null) tokenRef.current = Symbol('modal-shell');

  const isTop = React.useCallback(() => stack[stack.length - 1] === tokenRef.current, []);

  React.useEffect(() => {
    if (!isOpen) return;
    const token = tokenRef.current as symbol;

    restoreRef.current = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    stack.push(token);
    if (stack.length === 1) {
      bodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }

    return () => {
      const i = stack.indexOf(token);
      if (i >= 0) stack.splice(i, 1);
      if (stack.length === 0 && bodyOverflow !== null) {
        document.body.style.overflow = bodyOverflow;
        bodyOverflow = null;
      }
      restoreRef.current?.focus?.();
    };
  }, [isOpen]);

  React.useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (!isTop()) return;

      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;

      const panel = panelRef.current;
      if (!panel) return;
      const items = visibleFocusable(panel);
      if (items.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const outside = active === null || !panel.contains(active);
      if (outside) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [isOpen, onClose, isTop]);

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 flex ${alignClassName} ${backdropClassName} ${overlayClassName}`}
      onMouseDown={(e) => {
        startedOnOverlay.current = e.target === e.currentTarget;
      }}
      onMouseUp={(e) => {
        if (startedOnOverlay.current && e.target === e.currentTarget && isTop()) onClose();
        startedOnOverlay.current = false;
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        tabIndex={-1}
        className={`flex flex-col overflow-hidden outline-none ${panelClassName}`}
      >
        {children}
      </div>
    </div>
  );
}
