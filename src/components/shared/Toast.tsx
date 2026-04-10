import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import type { Toast as ToastType } from '../../contexts/ToastContext';
import { useToast } from '../../contexts/ToastContext';
import clsx from 'clsx';

const Toast: React.FC<ToastType> = ({ id, message, type, duration }) => {
  const { removeToast } = useToast();

  const iconMap = {
    success: <CheckCircle2 className="w-5 h-5" />,
    error: <AlertCircle className="w-5 h-5" />,
    info: <Info className="w-5 h-5" />,
    warning: <AlertTriangle className="w-5 h-5" />,
  };

  const colorMap = {
    success: 'bg-aurora-success/15 border-l-4 border-aurora-success text-aurora-success',
    error: 'bg-aurora-danger/15 border-l-4 border-aurora-danger text-aurora-danger',
    info: 'bg-aurora-indigo/15 border-l-4 border-aurora-indigo text-aurora-indigo-light',
    warning: 'bg-aurora-warning/15 border-l-4 border-aurora-warning text-aurora-warning',
  };

  const iconColorMap = {
    success: 'text-aurora-success',
    error: 'text-aurora-danger',
    info: 'text-aurora-indigo',
    warning: 'text-aurora-warning',
  };

  return (
    <motion.div
      key={id}
      initial={{ opacity: 0, x: 400 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 400 }}
      transition={{ duration: 0.3 }}
      className={clsx('rounded-xl p-4 shadow-aurora-3 backdrop-blur-md flex items-start gap-3', colorMap[type])}
    >
      <div className={clsx('flex-shrink-0 mt-0.5', iconColorMap[type])}>
        {iconMap[type]}
      </div>
      <div className="flex-1 text-sm font-medium">{message}</div>
      <button
        onClick={() => removeToast(id)}
        className="flex-shrink-0 ml-2 text-current hover:opacity-70 transition-opacity"
        aria-label="Dismiss toast"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
};

export const ToastContainer: React.FC = () => {
  const { toasts } = useToast();

  return (
    <div className="fixed top-4 right-4 flex flex-col gap-3 pointer-events-none" style={{ zIndex: 9999 }}>
      <AnimatePresence>
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <Toast {...toast} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default Toast;
