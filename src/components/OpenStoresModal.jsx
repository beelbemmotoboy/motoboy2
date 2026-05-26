import React from 'react';
import { Store } from 'lucide-react';

export async function createStoreLogoPreviewUrl(supabase, path) {
  if (!path || typeof path !== 'string') return '';
  if (/^https?:\/\//i.test(path)) return path;
  if (!path.includes('/') || !supabase?.storage) return '';
  const { data, error } = await supabase.storage.from('user-documents').createSignedUrl(path, 600);
  return error ? '' : data?.signedUrl || '';
}

export async function fetchOpenStores({ supabase, cityId }) {
  if (!supabase || !cityId) {
    throw new Error('Nao foi possivel buscar as lojas abertas.');
  }

  const { data, error } = await supabase
    .from('stores')
    .select('id, name, fantasy_name, district, logo_url')
    .eq('city_id', cityId)
    .eq('active', true)
    .eq('is_open', true)
    .order('fantasy_name', { ascending: true });

  if (error) throw new Error(`Nao foi possivel buscar as lojas abertas: ${error.message}`);

  return Promise.all((data ?? []).map(async (store) => ({
    id: store.id,
    name: store.fantasy_name || store.name || 'Loja',
    district: store.district || 'Nao informado',
    logoUrl: await createStoreLogoPreviewUrl(supabase, store.logo_url),
  })));
}

export function mapOpenStoresFromLocal(stores = []) {
  return stores
    .filter((store) => store.active !== false && store.isOpen !== false)
    .sort((first, second) => String(first.fantasyName || first.name || '').localeCompare(String(second.fantasyName || second.name || ''), 'pt-BR'))
    .map((store) => ({
      id: store.id || store.email || store.name,
      name: store.fantasyName || store.name || 'Loja',
      district: store.district || 'Nao informado',
      logoUrl: store.logoUrl || store.logo_url || '',
    }));
}

export function OpenStoresModal({ rows, loading, message, onClose }) {
  return (
    <div className="courier-data-modal" role="dialog" aria-modal="true" aria-labelledby="open-stores-title">
      <section>
        <header>
          <div>
            <span>Atendendo agora</span>
            <h2 id="open-stores-title">Lojas abertas</h2>
          </div>
          <button type="button" onClick={onClose}>Fechar</button>
        </header>

        <div className="courier-data-table-wrap">
          <table className="courier-data-table open-stores-table">
            <thead>
              <tr>
                <th>Logo</th>
                <th>Nome da loja</th>
                <th>Bairro</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((store) => (
                <tr key={store.id}>
                  <td>
                    <span className="open-store-logo">
                      {store.logoUrl ? <img src={store.logoUrl} alt="" /> : <Store size={22} />}
                    </span>
                  </td>
                  <td>{store.name}</td>
                  <td>{store.district}</td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan="3">{loading ? 'Buscando lojas abertas...' : message || 'Nenhum dado encontrado.'}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
