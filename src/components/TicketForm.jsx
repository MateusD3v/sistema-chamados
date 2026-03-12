import { useState } from 'react';
import { loadTickets, saveTickets, nextId } from '../utils/storage';

export default function TicketForm({ onTicketCreated }) {
  const [formData, setFormData] = useState({
    titulo: '',
    descricao: '',
    setor: '',
    solicitante: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.titulo || !formData.descricao || !formData.setor || !formData.solicitante) return;

    const list = loadTickets();
    const newTicket = {
      id: nextId(list),
      ...formData,
      status: 'ABERTO',
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
      comentarios: []
    };

    saveTickets([...list, newTicket]);
    setFormData({ titulo: '', descricao: '', setor: '', solicitante: '' });
    if (onTicketCreated) onTicketCreated();
    
    alert(`Chamado #${newTicket.id} criado com sucesso!`);
  };

  return (
    <section className="card card-elev ws-left">
      <div className="card-head">
        <h2 className="card-title">Novo Chamado</h2>
      </div>
      <form id="novo-form" className="form-grid" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="titulo">Titulo</label>
          <input 
            id="titulo" 
            name="titulo" 
            required 
            maxLength={120} 
            placeholder="Descreva o titulo do chamado"
            value={formData.titulo}
            onChange={handleChange}
          />
        </div>
        <div className="field">
          <label htmlFor="descricao">Descricao</label>
          <textarea 
            id="descricao" 
            name="descricao" 
            required 
            rows={4} 
            placeholder="Detalhe o problema ou solicitacao"
            value={formData.descricao}
            onChange={handleChange}
          />
        </div>
        <div className="field">
          <label htmlFor="setor">Setor</label>
          <input 
            id="setor" 
            name="setor" 
            required 
            maxLength={80} 
            placeholder="Informe o setor"
            value={formData.setor}
            onChange={handleChange}
          />
        </div>
        <div className="field">
          <label htmlFor="solicitante">Solicitante</label>
          <input 
            id="solicitante" 
            name="solicitante" 
            required 
            maxLength={80} 
            placeholder="Informe o nome do solicitante"
            value={formData.solicitante}
            onChange={handleChange}
          />
        </div>
        <div className="actions">
          <button type="submit" className="btn-accent">Criar</button>
        </div>
      </form>
    </section>
  );
}
