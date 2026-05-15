import React from 'react';
import { Bike, Store } from 'lucide-react';
import beeIcon from '../../../imagem/icone.png';

export function JoinView() {
  return (
    <main className="password-page">
      <section className="password-panel join-panel">
        <div className="logo dark auth-logo"><img src={beeIcon} alt="" /><span>BEELBEM</span></div>
        <h1>Faça parte!</h1>
        <p>Escolha como deseja se cadastrar. Depois do cadastro aprovado, voce recebera um link para criar sua senha de acesso.</p>
        <div className="join-options">
          <a className="join-card" href="#signup-store">
            <Store size={28} />
            <strong>Sou lojista</strong>
            <span>Cadastro para lojas que querem solicitar entregas.</span>
          </a>
          <a className="join-card" href="#signup-courier">
            <Bike size={30} />
            <strong>Sou motoboy</strong>
            <span>Cadastro para entregadores trabalharem na cidade.</span>
          </a>
        </div>
        <div className="auth-links single">
          <a href="#login">Voltar para login</a>
        </div>
      </section>
    </main>
  );
}
