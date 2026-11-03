'use client';
import LookupBox from '@/components/LookupBox';
import { KINDS } from '@/lib/lookups';

export default function Elenchi() {
  return (
    <>
      <div className="top"><h2>Elenchi</h2><span className="muted">Valori selezionabili nelle modali delle azioni</span></div>
      <div className="body" style={{ display: 'grid', gap: 20, maxWidth: 900 }}>
        {KINDS.map((k) => <LookupBox key={k.kind} {...k} />)}
        <div className="muted" style={{ fontSize: 13 }}>Rimuovere un valore non modifica le azioni già salvate. Per bonificare usa la matita: rinomina il valore e aggiorna le voci della settimana corrente; se il nuovo nome esiste già, i due valori vengono uniti (es. &quot;Cloud pages&quot; in &quot;Cloud Pages&quot;).</div>
      </div>
    </>
  );
}
