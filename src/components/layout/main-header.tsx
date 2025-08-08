
'use client';

import { usePageHeader } from '@/contexts/page-header-context';
import { UserNav } from './user-nav';
import { useSidebar } from '@/components/ui/sidebar';
import { IconMenu2 } from '@tabler/icons-react';

export function MainHeader() {
  const { headerState } = usePageHeader();
  const { title, description, icon: Icon, action: ActionComponent } = headerState;
  const { setOpen } = useSidebar();

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b bg-card px-4 sm:px-6 no-print">
      <div className="flex items-center gap-3">
        {/* Mobile Sidebar Trigger */}
        <button
          onClick={() => setOpen(true)}
          className="md:hidden"
          aria-label="Abrir menú"
        >
          <IconMenu2 className="h-6 w-6" />
        </button>
        
        {Icon && <Icon className="h-6 w-6 text-muted-foreground hidden sm:block" />}
        <div className="flex flex-col">
          <h1 className="text-lg sm:text-xl font-semibold font-headline">{title || 'Dashboard'}</h1>
          {description && (
            <p className="text-sm text-muted-foreground hidden md:block">
              {description}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 sm:gap-4">
        {ActionComponent && <div>{ActionComponent}</div>}
        <UserNav />
      </div>
    </header>
  );
}
