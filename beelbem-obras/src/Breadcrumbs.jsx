import React from 'react';
import { ChevronLeft } from 'lucide-react';

export default function Breadcrumbs({
  items = [],
  onBack,
  fallbackLabel = '',
}) {
  return (
    <div className={items.length ? 'page-breadcrumbs' : 'title-row'}>
      {onBack ? (
        <button className="icon-button" type="button" aria-label="Voltar" title="Voltar" onClick={onBack}>
          <ChevronLeft size={22} aria-hidden="true" />
        </button>
      ) : null}
      {items.length ? (
        <nav aria-label="Navegacao estrutural">
          {items.map((item, index) => (
            <React.Fragment key={`${item.label}-${index}`}>
              {index > 0 ? <span className="breadcrumb-separator" aria-hidden="true">/</span> : null}
              {item.onClick ? (
                <button type="button" onClick={item.onClick}>{item.label}</button>
              ) : (
                <span className="breadcrumb-current" aria-current={index === items.length - 1 ? 'page' : undefined}>
                  {item.label}
                </span>
              )}
            </React.Fragment>
          ))}
        </nav>
      ) : (
        <span>{fallbackLabel}</span>
      )}
    </div>
  );
}
