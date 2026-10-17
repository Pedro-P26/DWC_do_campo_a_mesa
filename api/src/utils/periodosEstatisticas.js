const calendario = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
});

function partes(data) {
  return Object.fromEntries(calendario.formatToParts(data)
    .filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)]));
}

// A mudança da hora em Lisboa ocorre depois da meia-noite.
function meiaNoite(ano, mes, dia) {
  const utc = new Date(Date.UTC(ano, mes - 1, dia));
  const p = partes(utc);
  const desvio = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - utc.getTime();
  return new Date(utc.getTime() - desvio);
}

module.exports = function periodosEstatisticas(agora = new Date()) {
  const { year, month, day } = partes(agora);
  return {
    hoje: meiaNoite(year, month, day),
    amanha: meiaNoite(year, month, day + 1),
    inicioSemana: meiaNoite(year, month, day - 6)
  };
};
