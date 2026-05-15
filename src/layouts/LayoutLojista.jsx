import React from 'react';

export function LayoutLojista({ children, dataPage = false }) {
  return (
    <main className={`store-app-home${dataPage ? ' store-data-page' : ''}`}>
      {children}
    </main>
  );
}
