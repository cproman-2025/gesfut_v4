
"use client";

import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import type { LucideIcon } from 'lucide-react';

interface PageHeaderState {
  title: string;
  description: string;
  icon?: LucideIcon;
  action?: ReactNode;
}

interface PageHeaderContextType {
  headerState: PageHeaderState;
  setHeader: (newState: Partial<PageHeaderState>) => void;
}

const PageHeaderContext = createContext<PageHeaderContextType | undefined>(undefined);

export const PageHeaderProvider = ({ children }: { children: ReactNode }) => {
  const [headerState, setHeaderState] = useState<PageHeaderState>({
    title: 'Dashboard',
    description: 'Visión general de la actividad del club.',
  });

  const setHeader = useCallback((newState: Partial<PageHeaderState>) => {
    setHeaderState(prevState => ({ ...prevState, ...newState }));
  }, []);

  return (
    <PageHeaderContext.Provider value={{ headerState, setHeader }}>
      {children}
    </PageHeaderContext.Provider>
  );
};

export const usePageHeader = (): PageHeaderContextType => {
  const context = useContext(PageHeaderContext);
  if (!context) {
    throw new Error('usePageHeader must be used within a PageHeaderProvider');
  }
  return context;
};
