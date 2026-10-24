(() => {
    const euro = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' });
    async function json(url) {
        const resposta = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
        if (resposta.status === 401 || resposta.status === 403) {
            location.assign('/login');
            throw new Error('A sessão terminou.');
        }
        if (!resposta.ok) throw new Error('Não foi possível atualizar. Os dados apresentados podem estar desatualizados.');
        return resposta.json();
    }
    document.querySelectorAll('[data-painel-url]').forEach(painel => {
        let ocupado = false;
        async function atualizar() {
            if (ocupado || document.hidden) return;
            ocupado = true;
            const botao = painel.querySelector('[data-atualizar]');
            if (botao) botao.disabled = true;
            try {
                const dados = await json(painel.dataset.painelUrl);
                painel.querySelectorAll('[data-indicador]').forEach(campo => {
                    const nome = campo.dataset.indicador;
                    campo.textContent = nome === 'valorEncomendasHoje' ? euro.format(dados.indicadores[nome]) : dados.indicadores[nome];
                });
                painel.querySelector('[data-leiloes]').innerHTML = dados.leiloes;
                painel.querySelector('[data-atualizacao]').textContent = `Atualizado às ${new Date(dados.atualizadoEm).toLocaleTimeString('pt-PT')} · a cada 5 segundos`;
            } catch (erro) {
                painel.querySelector('[data-atualizacao]').textContent = erro.message;
            } finally {
                ocupado = false;
                if (botao) botao.disabled = false;
            }
        }
        painel.querySelector('[data-atualizar]')?.addEventListener('click', atualizar);
        setInterval(atualizar, 5000);
        document.addEventListener('visibilitychange', () => { if (!document.hidden) atualizar(); });
    });
    document.querySelectorAll('[data-servicos-url]').forEach(painel => {
        let ocupado = false;
        async function verificar() {
            if (ocupado || document.hidden) return;
            ocupado = true;
            try {
                const dados = await json(painel.dataset.servicosUrl);
                painel.querySelectorAll('[data-servico]').forEach(campo => {
                    const estado = dados.servicos[campo.dataset.servico]?.estado ?? 'Desconhecido';
                    campo.textContent = estado;
                    campo.dataset.estado = estado;
                });
                painel.querySelector('[data-servicos-atualizacao]').textContent = `Verificado às ${new Date(dados.atualizadoEm).toLocaleTimeString('pt-PT')}`;
            } catch {
                painel.querySelectorAll('[data-servico]').forEach(campo => { campo.textContent = 'Não verificado'; campo.dataset.estado = ''; });
                painel.querySelector('[data-servicos-atualizacao]').textContent = 'Não foi possível verificar os serviços.';
            } finally { ocupado = false; }
        }
        verificar();
        setInterval(verificar, 30000);
    });
    setInterval(() => document.querySelectorAll('[data-termina]').forEach(relogio => {
        const segundos = Math.max(0, Math.ceil((new Date(relogio.dataset.termina) - Date.now()) / 1000));
        const horas = Math.floor(segundos / 3600);
        const minutos = Math.floor(segundos % 3600 / 60);
        const resto = segundos % 60;
        relogio.textContent = segundos === 0 ? 'A terminar' : `${horas ? String(horas).padStart(2, '0') + ':' : ''}${String(minutos).padStart(2, '0')}:${String(resto).padStart(2, '0')}`;
    }), 1000);
})();
