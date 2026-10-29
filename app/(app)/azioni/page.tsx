'use client';
import { useState } from 'react';
import { useApp } from '@/components/AppShell';
import ImportModal from '@/components/ImportModal';
import ItemTable from '@/components/ItemTable';
import { Ic } from '@/components/icons';

export default function Azioni() {
  const { me } = useApp();
  const [tab, setTab] = useState<'MC' | 'SC'>(me.role);
  const [imp, setImp] = useState(false);
  return (
    <>
      <div className="top"><h2>Azioni {tab === 'MC' ? 'Marketing Cloud' : 'CRM & Service Cloud'}</h2><span className="sp" />
        <button className="btn" onClick={() => setImp(true)}><Ic n="up" />Importa JSON</button></div>
      <div className="body">
        <div className="tabs">
          <button className={'tab' + (tab === 'MC' ? ' on' : '')} onClick={() => setTab('MC')}>Marketing Cloud{me.role === 'MC' ? ' (tue)' : ''}</button>
          <button className={'tab' + (tab === 'SC' ? ' on' : '')} onClick={() => setTab('SC')}>Service Cloud{me.role === 'SC' ? ' (tue)' : ''}</button>
        </div>
        <ItemTable key={tab} area={tab} prefix={tab} label="azione" />
      </div>
      {imp && <ImportModal onClose={() => setImp(false)} />}
    </>
  );
}
