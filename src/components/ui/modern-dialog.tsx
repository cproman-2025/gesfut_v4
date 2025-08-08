

'use client';

import React, { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Settings, AlertTriangle, CheckCircle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogPortal, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { ScrollArea } from './scroll-area';

interface ModernDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  type?: 'default' | 'error' | 'success' | 'warning' | 'info';
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  showCloseButton?: boolean;
  headerActions?: ReactNode;
  footerContent?: ReactNode;
}

const typeConfig = {
  default: { headerBg: 'bg-gray-700', Icon: Settings },
  error:   { headerBg: 'bg-destructive', Icon: AlertTriangle },
  success: { headerBg: 'bg-green-500', Icon: CheckCircle },
  warning: { headerBg: 'bg-amber-500', Icon: AlertTriangle },
  info:    { headerBg: 'bg-primary',  Icon: Info }
};

export const ModernDialog: React.FC<ModernDialogProps> = ({
  isOpen,
  onClose,
  title,
  children,
  type = 'default',
  size = 'md',
  showCloseButton = true,
  headerActions,
  footerContent,
}) => {
  const config = typeConfig[type];
  const Icon = config.Icon;

  const sizeClasses = {
    sm: 'sm:max-w-sm',
    md: 'sm:max-w-md',
    lg: 'sm:max-w-xl',
    xl: 'sm:max-w-3xl',
    '2xl': 'sm:max-w-6xl',
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AnimatePresence>
        {isOpen && (
          <DialogPortal forceMount>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
              onClick={onClose}
            />
             <DialogContent
              onInteractOutside={(e) => e.preventDefault()}
              showCloseButton={false} 
              className={cn(
                'fixed left-[50%] top-[50%] z-50 grid w-full translate-x-[-50%] translate-y-[-50%]',
                'max-w-[calc(100vw-2rem)] max-h-[90vh]',
                'rounded-xl bg-card text-card-foreground shadow-2xl border dark:border-gray-700 overflow-hidden flex flex-col p-0',
                sizeClasses[size]
              )}
              aria-modal="true"
              role="dialog"
            >
              <header className={cn('flex items-center justify-between p-4 text-white shrink-0 no-print', config.headerBg)}>
                <div className="flex items-center space-x-3">
                  <Icon className="w-6 h-6 shrink-0" />
                  <DialogTitle className="text-lg font-semibold truncate">{title}</DialogTitle>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {headerActions}
                  {showCloseButton && (
                    <DialogClose asChild>
                      <button
                        onClick={onClose}
                        aria-label="Cerrar diálogo"
                        className="p-1 rounded-full hover:bg-white/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </DialogClose>
                  )}
                </div>
              </header>
              
              <div className="flex-1 min-h-0 overflow-y-auto">
                 {children}
              </div>

              {footerContent && (
                  <div className="shrink-0 no-print">
                      {footerContent}
                  </div>
              )}
            </DialogContent>
          </DialogPortal>
        )}
      </AnimatePresence>
    </Dialog>
  );
};
