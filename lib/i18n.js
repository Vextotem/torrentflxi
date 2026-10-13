// Interface text. TMDB returns titles and overviews in the same language (TMDB_LANGS).

export const LANGS = {
  en: { name: 'English', tmdb: 'en-US' },
  es: { name: 'Español', tmdb: 'es-ES' },
  fr: { name: 'Français', tmdb: 'fr-FR' },
  de: { name: 'Deutsch', tmdb: 'de-DE' },
  pt: { name: 'Português', tmdb: 'pt-BR' },
  it: { name: 'Italiano', tmdb: 'it-IT' }
};

const STRINGS = {
  en: {
    tagline: 'Free movie and TV streaming and torrent search', search: 'Search movies and TV shows', home: 'Home', movies: 'Movies', tv: 'TV Shows',
    top: 'Top rated', genres: 'Genres', upcoming: 'Upcoming', calendar: 'Calendar', myList: 'My list', trendingMovies: 'Trending movies',
    trendingTv: 'Trending TV shows', popularMovies: 'Popular movies', popularTv: 'Popular TV shows', nowPlaying: 'In cinemas now',
    airingToday: 'Airing today', onTheAir: 'On the air this week', seeAll: 'See all', watchNow: 'Watch now', addToList: 'Add to my list',
    inList: 'In my list', trailer: 'Trailer', overview: 'Overview', cast: 'Cast', director: 'Director', creators: 'Created by', writers: 'Writers',
    genre: 'Genre', year: 'Year', sort: 'Sort', sortPopular: 'Most popular', sortRating: 'Highest rated', sortNewest: 'Newest', sortVotes: 'Most votes',
    filter: 'Apply', any: 'Any', page: 'Page', previous: 'Previous', next: 'Next', noResults: 'Nothing found.', seasons: 'Seasons', season: 'Season',
    episode: 'Episode', episodes: 'Episodes', related: 'You might also like', whereToWatch: 'Where to watch', stream: 'Stream', free: 'Free',
    rent: 'Rent', buy: 'Buy', poweredByJustWatch: 'Streaming data by JustWatch', torrents: 'Torrents', loadingTorrents: 'Searching torrents…',
    noTorrents: 'No torrents found for this title yet.', quality: 'Quality', all: 'All', seeders: 'Seeders', leechers: 'Leechers', size: 'Size',
    score: 'Score', source: 'Source', audio: 'Audio', languages: 'Languages', audioLanguage: 'Audio language', subtitles: 'Subtitles', codec: 'Codec',
    hdr: 'HDR / Dolby Vision', minSeeders: 'Min. seeders', maxSize: 'Max. size (GB)', sortBy: 'Sort by', hideCam: 'Hide CAM / TS', keyword: 'Filter by name',
    magnet: 'Magnet', copyMagnet: 'Copy magnet', copied: 'Copied', download: '.torrent', indexer: 'Indexer', published: 'Published', results: 'results',
    subtitlesAvailable: 'Subtitles', noSubtitles: 'No subtitles found.', images: 'Images', details: 'Details', runtime: 'Runtime', rating: 'Rating',
    released: 'Released', status: 'Status', network: 'Network', studio: 'Studio', country: 'Country', language: 'Language', collection: 'Collection',
    partOf: 'Part of', keywords: 'Keywords', legal: 'Legal notice', terms: 'Terms', privacy: 'Privacy', dmca: 'DMCA', about: 'About',
    discover: 'Discover', site: 'Site', freeForever: 'Free for everyone. No account, no subscription.',
    legalNote: 'TorrentFlxi indexes publicly available metadata and does not host files. You are responsible for following the laws of your country.',
    emptyList: 'Your list is empty. Use “Add to my list” on any title.', airDate: 'Air date', nextEpisode: 'Next episode', comingSoon: 'Coming soon',
    tmdbNotice: 'This product uses the TMDB API but is not endorsed or certified by TMDB.', play: 'Play', searchResults: 'Search results for',
    group4k: '4K / UHD', groupSd: 'SD', pack: 'Pack', moviesLabel: 'Movie', tvLabel: 'TV'
  },
  es: {
    tagline: 'Películas y series gratis y buscador de torrents', search: 'Buscar películas y series', home: 'Inicio', movies: 'Películas', tv: 'Series',
    top: 'Mejor valoradas', genres: 'Géneros', upcoming: 'Próximos estrenos', calendar: 'Calendario', myList: 'Mi lista', trendingMovies: 'Películas en tendencia',
    trendingTv: 'Series en tendencia', popularMovies: 'Películas populares', popularTv: 'Series populares', nowPlaying: 'En cines',
    airingToday: 'Se emiten hoy', onTheAir: 'En emisión esta semana', seeAll: 'Ver todo', watchNow: 'Ver ahora', addToList: 'Añadir a mi lista',
    inList: 'En mi lista', trailer: 'Tráiler', overview: 'Sinopsis', cast: 'Reparto', director: 'Dirección', creators: 'Creada por', writers: 'Guion',
    genre: 'Género', year: 'Año', sort: 'Orden', sortPopular: 'Más populares', sortRating: 'Mejor valoradas', sortNewest: 'Más recientes', sortVotes: 'Más votadas',
    filter: 'Aplicar', any: 'Cualquiera', page: 'Página', previous: 'Anterior', next: 'Siguiente', noResults: 'No se encontró nada.', seasons: 'Temporadas', season: 'Temporada',
    episode: 'Episodio', episodes: 'Episodios', related: 'También te puede gustar', whereToWatch: 'Dónde ver', stream: 'Streaming', free: 'Gratis',
    rent: 'Alquilar', buy: 'Comprar', poweredByJustWatch: 'Datos de streaming de JustWatch', torrents: 'Torrents', loadingTorrents: 'Buscando torrents…',
    noTorrents: 'Todavía no hay torrents para este título.', quality: 'Calidad', all: 'Todos', seeders: 'Seeders', leechers: 'Leechers', size: 'Tamaño',
    score: 'Puntuación', source: 'Origen', audio: 'Audio', languages: 'Idiomas', audioLanguage: 'Idioma del audio', subtitles: 'Subtítulos', codec: 'Códec',
    hdr: 'HDR / Dolby Vision', minSeeders: 'Seeders mín.', maxSize: 'Tamaño máx. (GB)', sortBy: 'Ordenar por', hideCam: 'Ocultar CAM / TS', keyword: 'Filtrar por nombre',
    magnet: 'Magnet', copyMagnet: 'Copiar magnet', copied: 'Copiado', download: '.torrent', indexer: 'Indexador', published: 'Publicado', results: 'resultados',
    subtitlesAvailable: 'Subtítulos', noSubtitles: 'No hay subtítulos.', images: 'Imágenes', details: 'Detalles', runtime: 'Duración', rating: 'Valoración',
    released: 'Estreno', status: 'Estado', network: 'Cadena', studio: 'Estudio', country: 'País', language: 'Idioma', collection: 'Colección',
    partOf: 'Parte de', keywords: 'Palabras clave', legal: 'Aviso legal', terms: 'Términos', privacy: 'Privacidad', dmca: 'DMCA', about: 'Acerca de',
    discover: 'Descubrir', site: 'Sitio', freeForever: 'Gratis para todos. Sin cuenta y sin suscripción.',
    legalNote: 'TorrentFlxi indexa metadatos públicos y no aloja archivos. Eres responsable de cumplir las leyes de tu país.',
    emptyList: 'Tu lista está vacía. Usa «Añadir a mi lista» en cualquier título.', airDate: 'Fecha de emisión', nextEpisode: 'Próximo episodio', comingSoon: 'Próximamente',
    tmdbNotice: 'Este producto usa la API de TMDB pero no está respaldado ni certificado por TMDB.', play: 'Reproducir', searchResults: 'Resultados para',
    group4k: '4K / UHD', groupSd: 'SD', pack: 'Pack', moviesLabel: 'Película', tvLabel: 'Serie'
  },
  fr: {
    tagline: 'Films et séries gratuits et recherche de torrents', search: 'Rechercher des films et des séries', home: 'Accueil', movies: 'Films', tv: 'Séries',
    top: 'Les mieux notés', genres: 'Genres', upcoming: 'Prochainement', calendar: 'Calendrier', myList: 'Ma liste', trendingMovies: 'Films tendance',
    trendingTv: 'Séries tendance', popularMovies: 'Films populaires', popularTv: 'Séries populaires', nowPlaying: 'Au cinéma',
    airingToday: 'Diffusées aujourd’hui', onTheAir: 'Diffusées cette semaine', seeAll: 'Tout voir', watchNow: 'Regarder', addToList: 'Ajouter à ma liste',
    inList: 'Dans ma liste', trailer: 'Bande-annonce', overview: 'Synopsis', cast: 'Distribution', director: 'Réalisation', creators: 'Créée par', writers: 'Scénario',
    genre: 'Genre', year: 'Année', sort: 'Tri', sortPopular: 'Les plus populaires', sortRating: 'Les mieux notés', sortNewest: 'Les plus récents', sortVotes: 'Les plus votés',
    filter: 'Appliquer', any: 'Tous', page: 'Page', previous: 'Précédent', next: 'Suivant', noResults: 'Aucun résultat.', seasons: 'Saisons', season: 'Saison',
    episode: 'Épisode', episodes: 'Épisodes', related: 'Vous aimerez aussi', whereToWatch: 'Où regarder', stream: 'Streaming', free: 'Gratuit',
    rent: 'Louer', buy: 'Acheter', poweredByJustWatch: 'Données de streaming par JustWatch', torrents: 'Torrents', loadingTorrents: 'Recherche de torrents…',
    noTorrents: 'Aucun torrent pour ce titre pour le moment.', quality: 'Qualité', all: 'Tous', seeders: 'Seeders', leechers: 'Leechers', size: 'Taille',
    score: 'Score', source: 'Source', audio: 'Audio', languages: 'Langues', audioLanguage: 'Langue audio', subtitles: 'Sous-titres', codec: 'Codec',
    hdr: 'HDR / Dolby Vision', minSeeders: 'Seeders min.', maxSize: 'Taille max. (Go)', sortBy: 'Trier par', hideCam: 'Masquer CAM / TS', keyword: 'Filtrer par nom',
    magnet: 'Magnet', copyMagnet: 'Copier le magnet', copied: 'Copié', download: '.torrent', indexer: 'Indexeur', published: 'Publié', results: 'résultats',
    subtitlesAvailable: 'Sous-titres', noSubtitles: 'Aucun sous-titre.', images: 'Images', details: 'Détails', runtime: 'Durée', rating: 'Note',
    released: 'Sortie', status: 'Statut', network: 'Chaîne', studio: 'Studio', country: 'Pays', language: 'Langue', collection: 'Collection',
    partOf: 'Fait partie de', keywords: 'Mots-clés', legal: 'Mentions légales', terms: 'Conditions', privacy: 'Confidentialité', dmca: 'DMCA', about: 'À propos',
    discover: 'Découvrir', site: 'Site', freeForever: 'Gratuit pour tous. Sans compte ni abonnement.',
    legalNote: 'TorrentFlxi indexe des métadonnées publiques et n’héberge aucun fichier. Vous êtes responsable du respect des lois de votre pays.',
    emptyList: 'Votre liste est vide. Utilisez « Ajouter à ma liste » sur n’importe quel titre.', airDate: 'Diffusion', nextEpisode: 'Prochain épisode', comingSoon: 'Bientôt',
    tmdbNotice: 'Ce produit utilise l’API TMDB mais n’est ni approuvé ni certifié par TMDB.', play: 'Lire', searchResults: 'Résultats pour',
    group4k: '4K / UHD', groupSd: 'SD', pack: 'Pack', moviesLabel: 'Film', tvLabel: 'Série'
  },
  de: {
    tagline: 'Kostenlose Filme und Serien und Torrent-Suche', search: 'Filme und Serien suchen', home: 'Start', movies: 'Filme', tv: 'Serien',
    top: 'Bestbewertet', genres: 'Genres', upcoming: 'Demnächst', calendar: 'Kalender', myList: 'Meine Liste', trendingMovies: 'Angesagte Filme',
    trendingTv: 'Angesagte Serien', popularMovies: 'Beliebte Filme', popularTv: 'Beliebte Serien', nowPlaying: 'Jetzt im Kino',
    airingToday: 'Heute im TV', onTheAir: 'Diese Woche im TV', seeAll: 'Alle ansehen', watchNow: 'Jetzt ansehen', addToList: 'Zu meiner Liste',
    inList: 'In meiner Liste', trailer: 'Trailer', overview: 'Handlung', cast: 'Besetzung', director: 'Regie', creators: 'Erstellt von', writers: 'Drehbuch',
    genre: 'Genre', year: 'Jahr', sort: 'Sortierung', sortPopular: 'Beliebteste', sortRating: 'Bestbewertete', sortNewest: 'Neueste', sortVotes: 'Meiste Stimmen',
    filter: 'Anwenden', any: 'Alle', page: 'Seite', previous: 'Zurück', next: 'Weiter', noResults: 'Nichts gefunden.', seasons: 'Staffeln', season: 'Staffel',
    episode: 'Folge', episodes: 'Folgen', related: 'Das könnte dir auch gefallen', whereToWatch: 'Wo ansehen', stream: 'Streaming', free: 'Kostenlos',
    rent: 'Leihen', buy: 'Kaufen', poweredByJustWatch: 'Streaming-Daten von JustWatch', torrents: 'Torrents', loadingTorrents: 'Torrents werden gesucht…',
    noTorrents: 'Für diesen Titel gibt es noch keine Torrents.', quality: 'Qualität', all: 'Alle', seeders: 'Seeder', leechers: 'Leecher', size: 'Größe',
    score: 'Wertung', source: 'Quelle', audio: 'Audio', languages: 'Sprachen', audioLanguage: 'Tonsprache', subtitles: 'Untertitel', codec: 'Codec',
    hdr: 'HDR / Dolby Vision', minSeeders: 'Min. Seeder', maxSize: 'Max. Größe (GB)', sortBy: 'Sortieren nach', hideCam: 'CAM / TS ausblenden', keyword: 'Nach Name filtern',
    magnet: 'Magnet', copyMagnet: 'Magnet kopieren', copied: 'Kopiert', download: '.torrent', indexer: 'Indexer', published: 'Veröffentlicht', results: 'Ergebnisse',
    subtitlesAvailable: 'Untertitel', noSubtitles: 'Keine Untertitel gefunden.', images: 'Bilder', details: 'Details', runtime: 'Laufzeit', rating: 'Bewertung',
    released: 'Erschienen', status: 'Status', network: 'Sender', studio: 'Studio', country: 'Land', language: 'Sprache', collection: 'Sammlung',
    partOf: 'Teil von', keywords: 'Schlagwörter', legal: 'Rechtlicher Hinweis', terms: 'Nutzungsbedingungen', privacy: 'Datenschutz', dmca: 'DMCA', about: 'Über uns',
    discover: 'Entdecken', site: 'Seite', freeForever: 'Kostenlos für alle. Ohne Konto, ohne Abo.',
    legalNote: 'TorrentFlxi indexiert öffentlich verfügbare Metadaten und hostet keine Dateien. Du bist für die Einhaltung der Gesetze deines Landes verantwortlich.',
    emptyList: 'Deine Liste ist leer. Nutze „Zu meiner Liste“ bei einem beliebigen Titel.', airDate: 'Ausstrahlung', nextEpisode: 'Nächste Folge', comingSoon: 'Demnächst',
    tmdbNotice: 'Dieses Produkt nutzt die TMDB-API, ist aber nicht von TMDB unterstützt oder zertifiziert.', play: 'Abspielen', searchResults: 'Ergebnisse für',
    group4k: '4K / UHD', groupSd: 'SD', pack: 'Paket', moviesLabel: 'Film', tvLabel: 'Serie'
  },
  pt: {
    tagline: 'Filmes e séries grátis e busca de torrents', search: 'Buscar filmes e séries', home: 'Início', movies: 'Filmes', tv: 'Séries',
    top: 'Mais bem avaliados', genres: 'Gêneros', upcoming: 'Em breve', calendar: 'Calendário', myList: 'Minha lista', trendingMovies: 'Filmes em alta',
    trendingTv: 'Séries em alta', popularMovies: 'Filmes populares', popularTv: 'Séries populares', nowPlaying: 'Nos cinemas',
    airingToday: 'No ar hoje', onTheAir: 'No ar esta semana', seeAll: 'Ver tudo', watchNow: 'Assistir', addToList: 'Adicionar à minha lista',
    inList: 'Na minha lista', trailer: 'Trailer', overview: 'Sinopse', cast: 'Elenco', director: 'Direção', creators: 'Criada por', writers: 'Roteiro',
    genre: 'Gênero', year: 'Ano', sort: 'Ordem', sortPopular: 'Mais populares', sortRating: 'Mais bem avaliados', sortNewest: 'Mais recentes', sortVotes: 'Mais votados',
    filter: 'Aplicar', any: 'Qualquer', page: 'Página', previous: 'Anterior', next: 'Próxima', noResults: 'Nada encontrado.', seasons: 'Temporadas', season: 'Temporada',
    episode: 'Episódio', episodes: 'Episódios', related: 'Você também pode gostar', whereToWatch: 'Onde assistir', stream: 'Streaming', free: 'Grátis',
    rent: 'Alugar', buy: 'Comprar', poweredByJustWatch: 'Dados de streaming do JustWatch', torrents: 'Torrents', loadingTorrents: 'Buscando torrents…',
    noTorrents: 'Ainda não há torrents para este título.', quality: 'Qualidade', all: 'Todos', seeders: 'Seeders', leechers: 'Leechers', size: 'Tamanho',
    score: 'Nota', source: 'Fonte', audio: 'Áudio', languages: 'Idiomas', audioLanguage: 'Idioma do áudio', subtitles: 'Legendas', codec: 'Codec',
    hdr: 'HDR / Dolby Vision', minSeeders: 'Seeders mín.', maxSize: 'Tamanho máx. (GB)', sortBy: 'Ordenar por', hideCam: 'Ocultar CAM / TS', keyword: 'Filtrar por nome',
    magnet: 'Magnet', copyMagnet: 'Copiar magnet', copied: 'Copiado', download: '.torrent', indexer: 'Indexador', published: 'Publicado', results: 'resultados',
    subtitlesAvailable: 'Legendas', noSubtitles: 'Nenhuma legenda encontrada.', images: 'Imagens', details: 'Detalhes', runtime: 'Duração', rating: 'Avaliação',
    released: 'Lançamento', status: 'Status', network: 'Emissora', studio: 'Estúdio', country: 'País', language: 'Idioma', collection: 'Coleção',
    partOf: 'Parte de', keywords: 'Palavras-chave', legal: 'Aviso legal', terms: 'Termos', privacy: 'Privacidade', dmca: 'DMCA', about: 'Sobre',
    discover: 'Descobrir', site: 'Site', freeForever: 'Grátis para todos. Sem conta e sem assinatura.',
    legalNote: 'O TorrentFlxi indexa metadados públicos e não hospeda arquivos. Você é responsável por cumprir as leis do seu país.',
    emptyList: 'Sua lista está vazia. Use “Adicionar à minha lista” em qualquer título.', airDate: 'Exibição', nextEpisode: 'Próximo episódio', comingSoon: 'Em breve',
    tmdbNotice: 'Este produto usa a API do TMDB, mas não é endossado nem certificado pelo TMDB.', play: 'Reproduzir', searchResults: 'Resultados para',
    group4k: '4K / UHD', groupSd: 'SD', pack: 'Pacote', moviesLabel: 'Filme', tvLabel: 'Série'
  },
  it: {
    tagline: 'Film e serie gratis e ricerca di torrent', search: 'Cerca film e serie TV', home: 'Home', movies: 'Film', tv: 'Serie TV',
    top: 'Più votati', genres: 'Generi', upcoming: 'Prossimamente', calendar: 'Calendario', myList: 'La mia lista', trendingMovies: 'Film di tendenza',
    trendingTv: 'Serie di tendenza', popularMovies: 'Film popolari', popularTv: 'Serie popolari', nowPlaying: 'Al cinema',
    airingToday: 'In onda oggi', onTheAir: 'In onda questa settimana', seeAll: 'Vedi tutto', watchNow: 'Guarda ora', addToList: 'Aggiungi alla mia lista',
    inList: 'Nella mia lista', trailer: 'Trailer', overview: 'Trama', cast: 'Cast', director: 'Regia', creators: 'Creata da', writers: 'Sceneggiatura',
    genre: 'Genere', year: 'Anno', sort: 'Ordine', sortPopular: 'Più popolari', sortRating: 'Più votati', sortNewest: 'Più recenti', sortVotes: 'Più voti',
    filter: 'Applica', any: 'Tutti', page: 'Pagina', previous: 'Precedente', next: 'Successiva', noResults: 'Nessun risultato.', seasons: 'Stagioni', season: 'Stagione',
    episode: 'Episodio', episodes: 'Episodi', related: 'Potrebbe piacerti anche', whereToWatch: 'Dove guardare', stream: 'Streaming', free: 'Gratis',
    rent: 'Noleggio', buy: 'Acquisto', poweredByJustWatch: 'Dati di streaming di JustWatch', torrents: 'Torrent', loadingTorrents: 'Ricerca dei torrent…',
    noTorrents: 'Ancora nessun torrent per questo titolo.', quality: 'Qualità', all: 'Tutti', seeders: 'Seeder', leechers: 'Leecher', size: 'Dimensione',
    score: 'Punteggio', source: 'Fonte', audio: 'Audio', languages: 'Lingue', audioLanguage: 'Lingua audio', subtitles: 'Sottotitoli', codec: 'Codec',
    hdr: 'HDR / Dolby Vision', minSeeders: 'Seeder min.', maxSize: 'Dimensione max. (GB)', sortBy: 'Ordina per', hideCam: 'Nascondi CAM / TS', keyword: 'Filtra per nome',
    magnet: 'Magnet', copyMagnet: 'Copia magnet', copied: 'Copiato', download: '.torrent', indexer: 'Indicizzatore', published: 'Pubblicato', results: 'risultati',
    subtitlesAvailable: 'Sottotitoli', noSubtitles: 'Nessun sottotitolo trovato.', images: 'Immagini', details: 'Dettagli', runtime: 'Durata', rating: 'Voto',
    released: 'Uscita', status: 'Stato', network: 'Rete', studio: 'Studio', country: 'Paese', language: 'Lingua', collection: 'Collezione',
    partOf: 'Parte di', keywords: 'Parole chiave', legal: 'Note legali', terms: 'Termini', privacy: 'Privacy', dmca: 'DMCA', about: 'Chi siamo',
    discover: 'Scopri', site: 'Sito', freeForever: 'Gratis per tutti. Senza account e senza abbonamento.',
    legalNote: 'TorrentFlxi indicizza metadati pubblici e non ospita file. Sei responsabile del rispetto delle leggi del tuo paese.',
    emptyList: 'La tua lista è vuota. Usa «Aggiungi alla mia lista» su qualsiasi titolo.', airDate: 'Messa in onda', nextEpisode: 'Prossimo episodio', comingSoon: 'Prossimamente',
    tmdbNotice: 'Questo prodotto usa l’API di TMDB ma non è approvato né certificato da TMDB.', play: 'Riproduci', searchResults: 'Risultati per',
    group4k: '4K / UHD', groupSd: 'SD', pack: 'Pack', moviesLabel: 'Film', tvLabel: 'Serie'
  }
};

export function translator(lang) {
  const table = STRINGS[lang] || STRINGS.en;
  return key => table[key] ?? STRINGS.en[key] ?? key;
}

export function pickLanguage(query, cookie, acceptLanguage) {
  for (const value of [query, cookie]) if (value && LANGS[value]) return value;
  for (const part of String(acceptLanguage || '').split(',')) {
    const code = part.trim().slice(0, 2).toLowerCase();
    if (LANGS[code]) return code;
  }
  return 'en';
}

// Strings the browser script needs.
export function clientStrings(lang) {
  const t = translator(lang);
  return Object.fromEntries(['loadingTorrents', 'noTorrents', 'all', 'seeders', 'leechers', 'size', 'score', 'source', 'audio', 'languages', 'subtitles',
    'codec', 'magnet', 'copyMagnet', 'copied', 'download', 'indexer', 'published', 'results', 'noSubtitles', 'addToList', 'inList', 'emptyList',
    'group4k', 'groupSd', 'pack', 'moviesLabel', 'tvLabel'].map(key => [key, t(key)]));
}

export { STRINGS };
