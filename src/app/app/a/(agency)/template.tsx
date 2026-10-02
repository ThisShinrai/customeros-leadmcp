'use client';

import { usePathname } from 'next/navigation';

export default function AgencyTemplate({ children }: { children: React.ReactNode }) {
  const path = usePathname();

  return (
    <div key={path} className="page-transition">
      {children}
    </div>
  );
}
