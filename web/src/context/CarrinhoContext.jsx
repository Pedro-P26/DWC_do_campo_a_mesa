// Estado global do carrinho
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const CarrinhoContext = createContext(null);

function lerCarrinho() {
  try {
    const dados = JSON.parse(localStorage.getItem('carrinho'));
    return Array.isArray(dados) ? dados.filter((linha) =>
      linha?.produto?._id && Number.isFinite(linha.produto.preco) && linha.produto.preco >= 0 &&
      Number.isInteger(linha.quantidade) && linha.quantidade > 0) : [];
  } catch { return []; }
}

export function CarrinhoProvider({ children }) {
  const [linhas, setLinhas] = useState(lerCarrinho); // [{ produto, quantidade }]

  useEffect(() => {
    try { localStorage.setItem('carrinho', JSON.stringify(linhas)); } catch { /* Sem armazenamento disponível. */ }
  }, [linhas]);

  function adicionar(produto, quantidade = 1) {
    if (!Number.isInteger(quantidade) || quantidade < 1 || produto.stock === 0) return;
    setLinhas((atual) => {
      const existe = atual.find((l) => l.produto._id === produto._id);
      const novaQuantidade = Math.min((existe?.quantidade || 0) + quantidade, produto.stock ?? Infinity);
      if (novaQuantidade < 1) return atual;
      if (existe) {
        return atual.map((l) => l.produto._id === produto._id
          ? { produto, quantidade: novaQuantidade } : l);
      }
      return [...atual, { produto, quantidade: novaQuantidade }];
    });
  }

  function alterarQuantidade(produtoId, quantidade) {
    if (!Number.isInteger(quantidade)) return;
    setLinhas((atual) => quantidade < 1
      ? atual.filter((l) => l.produto._id !== produtoId)
      : atual.map((l) => l.produto._id === produtoId
        ? { ...l, quantidade: Math.min(quantidade, l.produto.stock ?? Infinity) } : l));
  }

  const remover = (produtoId) => alterarQuantidade(produtoId, 0);
  const esvaziar = () => setLinhas([]);

  const total = useMemo(
    () => linhas.reduce((s, l) => s + l.produto.preco * l.quantidade, 0), [linhas]);

  return (
    <CarrinhoContext.Provider value={{ linhas, adicionar, alterarQuantidade, remover, esvaziar, total }}>
      {children}
    </CarrinhoContext.Provider>
  );
}

export const useCarrinho = () => useContext(CarrinhoContext);
