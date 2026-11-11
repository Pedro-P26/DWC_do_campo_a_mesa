export default function MapaProdutor({ produtor }) {
  const detalhes = produtor?.produtor;
  const coordenadas = detalhes?.localizacao;
  const temCoordenadas = Number.isFinite(coordenadas?.lat) && Number.isFinite(coordenadas?.lng) &&
    Math.abs(coordenadas.lat) <= 90 && Math.abs(coordenadas.lng) <= 180;
  const destino = temCoordenadas
    ? coordenadas.lat + ',' + coordenadas.lng
    : detalhes?.localidade?.trim() && detalhes.localidade.trim() + ', Portugal';

  if (!destino) return null;

  return <section className="produtor-localizacao" aria-label="Localização da exploração">
    <div className="produtor-localizacao__cabecalho">
      <div>
        <h2>Localização da exploração</h2>
        <p>{temCoordenadas ? 'Localização indicada pelo produtor.' : 'Mapa da localidade indicada pelo produtor.'}</p>
      </div>
      <a href={'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(destino)}
        target="_blank" rel="noopener noreferrer">Abrir no Google Maps</a>
    </div>
    <iframe title={'Mapa de ' + (detalhes?.nomeExploracao || produtor.nome)}
      src={'https://www.google.com/maps?q=' + encodeURIComponent(destino) + '&z=' + (temCoordenadas ? 15 : 12) + '&output=embed'}
      loading="lazy" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
  </section>;
}
