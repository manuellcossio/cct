import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export type Lang = "es" | "en";

const STORAGE_KEY = "cct-lang";

type Dict = Record<string, string>;

const es: Dict = {
  // Nav
  "nav.archivo": "Archivo",
  "nav.contentGen": "Content Gen",
  // Content Gen
  "cg.title": "Content Gen",
  "cg.subtitle": "Asistente de contenido visual de marca",
  "cg.new": "Nueva conversación",
  "cg.history": "Historial",
  "cg.empty.title": "Crea contenido visual de marca",
  "cg.empty.subtitle": "DESCRIBE TU IDEA.",
  "cg.placeholder": "Describe lo que quieres crear…",
  "cg.send": "Enviar",
  "cg.attach": "Adjuntar archivo",
  "cg.thinking": "Generando…",
  "cg.eta.hint": "Suele tardar 30–90s. Las imágenes pesadas pueden tardar más.",
  "cg.phase.analyzing": "Analizando tu petición…",
  "cg.phase.creating": "Creando la imagen…",
  "cg.phase.branding": "Aplicando la marca antiq…",
  "cg.phase.finishing": "Puliendo los detalles finales…",
  "cg.attachments": "Adjuntos",
  "cg.deleteConv": "Eliminar conversación",
  "cg.deleted": "Conversación eliminada",
  "cg.deleteError": "No se pudo eliminar",
  "cg.error": "Error al generar contenido",
  "cg.noConversations": "Sin conversaciones todavía",
  "cg.you": "Tú",
  "cg.assistant": "antiq",
  "cg.format": "Formato",
  "cg.format.auto": "Auto",
  "cg.market": "Mercado",
  "cg.market.placeholder": "Nº de mercado (opcional)",
  "cg.watermark": "agregar antiq.xyz",
  "cg.watermark.title": "Mostrar \"antiq.xyz\" abajo de la imagen",
  "cg.carousel": "carrusel",
  "cg.carousel.title": "Generar un carrusel de 5 slides con el formato de Instagram (sin meme)",
  // Common
  "common.generate": "Generar",
  "common.generating": "Generando...",
  "common.cancel": "Cancelar",
  "common.delete": "Eliminar",
  "common.download": "Descargar",
  "common.copy": "Copiar",
  "common.markPosted": "Marcar como publicado",
  "common.movedToArchive": "Movido a Archivo",
  "common.copiedClipboard": "Copiado al portapapeles",
  "common.imageDownloaded": "Imagen descargada",
  "common.imageDownloadFailed": "No se pudo descargar la imagen",
  "common.archiveError": "Error al archivar",

  // Twitter
  "tw.postsGenerated": "Tweets generados exitosamente",
  "tw.postsError": "Error al generar tweets",
  "tw.threadsGenerated": "Hilos generados exitosamente",
  "tw.threadsError": "Error al generar hilos",
  "tw.invalidMarket": "Ingresa un número de mercado válido",
  "tw.marketThreadGenerated": "Hilo de mercado generado exitosamente",
  "tw.marketThreadError": "Error al generar hilo de mercado",
  "tw.postDeleted": "Post eliminado",
  "tw.threadDeleted": "Hilo eliminado",
  "tw.threadMovedToArchive": "Hilo movido a Archivo",
  "tw.threadArchiveError": "Error al archivar hilo",
  "tw.menu.posts": "Posts Individuales",
  "tw.menu.postsDesc": "15-20 tweets ÚLTIMA HORA",
  "tw.menu.threads": "Hilos / Threads",
  "tw.menu.threadsDesc": "3 hilos analíticos de 5-8 tweets",
  "tw.menu.market": "Market Based",
  "tw.menu.marketDesc": "Hilo sobre un mercado específico",
  "tw.tab.posts": "Posts",
  "tw.tab.threads": "Hilos",
  "tw.loading.market": "Analizando mercado...",
  "tw.loading.threads": "Generando hilos analíticos...",
  "tw.loading.posts": "Buscando noticias de última hora...",
  "tw.empty.posts": "No hay posts generados.",
  "tw.empty.postsHint": 'Haz clic en "Generar" para comenzar.',
  "tw.empty.threads": "No hay hilos generados.",
  "tw.empty.threadsHint": 'Haz clic en "Generar" y selecciona "Hilos / Threads".',
  "tw.copyThread": "Copiar hilo",
  "tw.sources": "Fuentes",
  "tw.tweetsCount": "tweets",
  "tw.downloadImage": "Descargar imagen",
  "tw.marketWizard.label": "Número de mercado",
  "tw.marketWizard.hint": "Se analizará el mercado indicado y se generará un hilo analítico con datos del mercado y noticias relacionadas.",
  "tw.marketWizard.generate": "Generar hilo",

  // Common (extra)
  "common.exportError": "Error al exportar",
  "common.copied": "Copiado",

  // Instagram
  "ig.slideshow.invalidId": "Ingresa al menos un ID de mercado válido",
  "ig.slideshow.generated": "Slideshow generado",
  "ig.slideshow.error": "Error al generar slideshow",
  "ig.slideshow.deleted": "Slideshow eliminado",
  "ig.imagesDownloaded": "{count} imágenes descargadas",
  "ig.carousels.generated": "Carruseles generados exitosamente",
  "ig.carousels.error": "Error al generar carruseles",
  "ig.fromUrl.generated": "Carrusel generado desde artículo",
  "ig.fromUrl.error": "Error al generar desde URL",
  "ig.carousel.deleted": "Carrusel eliminado",
  "ig.regenerated": "Nueva versión creada",
  "ig.regenerateError": "Error al regenerar imágenes",
  "ig.captionCopied": "Caption copiado",
  "ig.copyFailed": "No se pudo copiar",
  "ig.loading.fromUrl": "Generando carrusel desde artículo...",
  "ig.loading.carousel": "Generando carrusel con 4 imágenes...",
  "ig.loading.takesMinutes": "Esto tarda 1-2 minutos.",
  "ig.loading.slideshow": "Generando slideshow de mercados...",
  "ig.loading.slideshowHint": "Cargando datos y buscando imágenes. Tarda ~10 segundos.",
  "ig.market": "mercado",
  "ig.markets": "mercados",
  "ig.download": "Bajar {count}",
  "ig.regenerateImages": "Regenerar imágenes",
  "ig.empty": "No hay carruseles generados aún.",
  "ig.back": "Atrás",
  "ig.wizard.title": "Generar Carrusel",
  "ig.wizard.newCarousel": "Nuevo carrusel",
  "ig.wizard.autoGenDesc": "1 carrusel de noticia trending",
  "ig.wizard.feedDesc": "Generar desde un link de noticia",
  "ig.wizard.cctDesc": "Seleccionar desde el engine",
  "ig.wizard.mktDesc": "Slideshow desde IDs de mercado",
  "ig.wizard.marketIds": "IDs de mercado",
  "ig.wizard.marketIdsHint": "Separa los IDs con coma o espacio. Máximo 8.",
  "ig.wizard.generateSlideshow": "Generar slideshow",
  "ig.wizard.newsLink": "Link de noticia",
  "ig.wizard.generateCarousel": "Generar carrusel",

  // Ad Gen
  "ad.generated": "Anuncio generado",
  "ad.generateError": "Error al generar anuncio",
  "ad.deleted": "Anuncio eliminado",
  "ad.deleteError": "Error al eliminar anuncio",
  "ad.markedPosted": "Marcado como publicado",
  "ad.markError": "Error al marcar como publicado",
  "ad.loading": "Generando anuncio...",
  "ad.loadingHint": "Esto tarda unos segundos.",
  "ad.empty": "No hay anuncios generados aún.",
  "ad.emptyHint": 'Haz clic en "Generar Anuncio" para comenzar.',
  "ad.wizard.title": "Generar Anuncio",
  "ad.wizard.new": "Nuevo Anuncio",
  "ad.field.text": "Texto",
  "ad.field.textPlaceholder": "Ej: Predice el futuro",
  "ad.field.subtitle": "Subtítulo?",
  "ad.field.subtitlePlaceholder": "Ej: Descárgala gratis",
  "ad.field.bgImage": "Imagen de fondo",
  "ad.field.emotionHint": "Estilo emotivo: imagen abstracta generada con IA (surreal, creative-directed) + tu frase en grande, minimal y con la marca.",
  "ad.field.bgColor": "Color de fondo",
  "ad.field.customColor": "Color personalizado",
  "ad.color.black": "Negro",
  "ad.color.white": "Blanco",
  "ad.color.blue": "Azul",
  "ad.color.purple": "Púrpura",
  "ad.color.green": "Verde",
  "ad.color.red": "Rojo",
  "ad.color.amber": "Ámbar",
  "ad.color.slate": "Slate",

  // Archive
  "arch.subtitle": "Posts ya publicados",
  "arch.threads": "Hilos",
  "arch.threadsCount": "hilos",
  "arch.carouselsCount": "carruseles",
  "arch.empty.posts": "Ningún post archivado aún.",
  "arch.empty.threads": "Ningún hilo archivado aún.",
  "arch.empty.carousels": "Ningún carrusel archivado aún.",

  // Engine
  "eng.error.twitter": "Error generando post de X. Intenta de nuevo.",
  "eng.error.instagram": "Error generando carrusel. Intenta de nuevo.",
  "eng.loading.twitter": "Generando post de X...",
  "eng.loading.instagram": "Generando carrusel de Instagram...",
  "eng.loading.hint": "Esto tarda 30-60 segundos.",

  // Pin
  "pin.incorrect": "PIN incorrecto",
};

const en: Dict = {
  // Nav
  "nav.archivo": "Archive",
  "nav.contentGen": "Content Gen",
  // Content Gen
  "cg.title": "Content Gen",
  "cg.subtitle": "Brand-aware visual content assistant",
  "cg.new": "New conversation",
  "cg.history": "History",
  "cg.empty.title": "Create brand visual content",
  "cg.empty.subtitle": "Describe the image, ad, or carousel you need. Attach photos or documents as reference. The antiq logo is added automatically.",
  "cg.placeholder": "Describe what you want to create…",
  "cg.send": "Send",
  "cg.attach": "Attach file",
  "cg.thinking": "Generating…",
  "cg.eta.hint": "Usually takes 30–90s. Heavy images can take longer.",
  "cg.phase.analyzing": "Analyzing your request…",
  "cg.phase.creating": "Creating the image…",
  "cg.phase.branding": "Applying the antiq brand…",
  "cg.phase.finishing": "Polishing the final details…",
  "cg.attachments": "Attachments",
  "cg.deleteConv": "Delete conversation",
  "cg.deleted": "Conversation deleted",
  "cg.deleteError": "Could not delete",
  "cg.error": "Failed to generate content",
  "cg.noConversations": "No conversations yet",
  "cg.you": "You",
  "cg.assistant": "antiq",
  "cg.format": "Format",
  "cg.format.auto": "Auto",
  "cg.market": "Market",
  "cg.market.placeholder": "Market # (optional)",
  "cg.watermark": "add antiq.xyz",
  "cg.watermark.title": "Show \"antiq.xyz\" at the bottom of the image",
  "cg.carousel": "carousel",
  "cg.carousel.title": "Generate a 5-slide carousel in the Instagram format (no meme)",
  // Common
  "common.generate": "Generate",
  "common.generating": "Generating...",
  "common.cancel": "Cancel",
  "common.delete": "Delete",
  "common.download": "Download",
  "common.copy": "Copy",
  "common.markPosted": "Mark as posted",
  "common.movedToArchive": "Moved to Archive",
  "common.copiedClipboard": "Copied to clipboard",
  "common.imageDownloaded": "Image downloaded",
  "common.imageDownloadFailed": "Could not download the image",
  "common.archiveError": "Failed to archive",

  // Twitter
  "tw.postsGenerated": "Tweets generated successfully",
  "tw.postsError": "Failed to generate tweets",
  "tw.threadsGenerated": "Threads generated successfully",
  "tw.threadsError": "Failed to generate threads",
  "tw.invalidMarket": "Enter a valid market number",
  "tw.marketThreadGenerated": "Market thread generated successfully",
  "tw.marketThreadError": "Failed to generate market thread",
  "tw.postDeleted": "Post deleted",
  "tw.threadDeleted": "Thread deleted",
  "tw.threadMovedToArchive": "Thread moved to Archive",
  "tw.threadArchiveError": "Failed to archive thread",
  "tw.menu.posts": "Individual Posts",
  "tw.menu.postsDesc": "15-20 BREAKING NEWS tweets",
  "tw.menu.threads": "Threads",
  "tw.menu.threadsDesc": "3 analytical threads of 5-8 tweets",
  "tw.menu.market": "Market Based",
  "tw.menu.marketDesc": "Thread about a specific market",
  "tw.tab.posts": "Posts",
  "tw.tab.threads": "Threads",
  "tw.loading.market": "Analyzing market...",
  "tw.loading.threads": "Generating analytical threads...",
  "tw.loading.posts": "Searching breaking news...",
  "tw.empty.posts": "No posts generated.",
  "tw.empty.postsHint": 'Click "Generate" to get started.',
  "tw.empty.threads": "No threads generated.",
  "tw.empty.threadsHint": 'Click "Generate" and select "Threads".',
  "tw.copyThread": "Copy thread",
  "tw.sources": "Sources",
  "tw.tweetsCount": "tweets",
  "tw.downloadImage": "Download image",
  "tw.marketWizard.label": "Market number",
  "tw.marketWizard.hint": "The selected market will be analyzed and an analytical thread will be generated with market data and related news.",
  "tw.marketWizard.generate": "Generate thread",

  // Common (extra)
  "common.exportError": "Failed to export",
  "common.copied": "Copied",

  // Instagram
  "ig.slideshow.invalidId": "Enter at least one valid market ID",
  "ig.slideshow.generated": "Slideshow generated",
  "ig.slideshow.error": "Failed to generate slideshow",
  "ig.slideshow.deleted": "Slideshow deleted",
  "ig.imagesDownloaded": "{count} images downloaded",
  "ig.carousels.generated": "Carousels generated successfully",
  "ig.carousels.error": "Failed to generate carousels",
  "ig.fromUrl.generated": "Carousel generated from article",
  "ig.fromUrl.error": "Failed to generate from URL",
  "ig.carousel.deleted": "Carousel deleted",
  "ig.regenerated": "New version created",
  "ig.regenerateError": "Failed to regenerate images",
  "ig.captionCopied": "Caption copied",
  "ig.copyFailed": "Could not copy",
  "ig.loading.fromUrl": "Generating carousel from article...",
  "ig.loading.carousel": "Generating carousel with 4 images...",
  "ig.loading.takesMinutes": "This takes 1-2 minutes.",
  "ig.loading.slideshow": "Generating market slideshow...",
  "ig.loading.slideshowHint": "Loading data and fetching images. Takes ~10 seconds.",
  "ig.market": "market",
  "ig.markets": "markets",
  "ig.download": "Download {count}",
  "ig.regenerateImages": "Regenerate images",
  "ig.empty": "No carousels generated yet.",
  "ig.back": "Back",
  "ig.wizard.title": "Generate Carousel",
  "ig.wizard.newCarousel": "New carousel",
  "ig.wizard.autoGenDesc": "1 carousel from a trending news story",
  "ig.wizard.feedDesc": "Generate from a news link",
  "ig.wizard.cctDesc": "Select from the engine",
  "ig.wizard.mktDesc": "Slideshow from market IDs",
  "ig.wizard.marketIds": "Market IDs",
  "ig.wizard.marketIdsHint": "Separate IDs with comma or space. Max 8.",
  "ig.wizard.generateSlideshow": "Generate slideshow",
  "ig.wizard.newsLink": "News link",
  "ig.wizard.generateCarousel": "Generate carousel",

  // Ad Gen
  "ad.generated": "Ad generated",
  "ad.generateError": "Failed to generate ad",
  "ad.deleted": "Ad deleted",
  "ad.deleteError": "Failed to delete ad",
  "ad.markedPosted": "Marked as posted",
  "ad.markError": "Failed to mark as posted",
  "ad.loading": "Generating ad...",
  "ad.loadingHint": "This takes a few seconds.",
  "ad.empty": "No ads generated yet.",
  "ad.emptyHint": 'Click "Generate Ad" to get started.',
  "ad.wizard.title": "Generate Ad",
  "ad.wizard.new": "New Ad",
  "ad.field.text": "Text",
  "ad.field.textPlaceholder": "Ex: Predict the future",
  "ad.field.subtitle": "Subtitle?",
  "ad.field.subtitlePlaceholder": "Ex: Download it free",
  "ad.field.bgImage": "Background image",
  "ad.field.emotionHint": "Emotion style: AI-generated abstract background (surreal, creative-directed) + your phrase in large, minimal type with branding.",
  "ad.field.bgColor": "Background color",
  "ad.field.customColor": "Custom color",
  "ad.color.black": "Black",
  "ad.color.white": "White",
  "ad.color.blue": "Blue",
  "ad.color.purple": "Purple",
  "ad.color.green": "Green",
  "ad.color.red": "Red",
  "ad.color.amber": "Amber",
  "ad.color.slate": "Slate",

  // Archive
  "arch.subtitle": "Already published posts",
  "arch.threads": "Threads",
  "arch.threadsCount": "threads",
  "arch.carouselsCount": "carousels",
  "arch.empty.posts": "No archived posts yet.",
  "arch.empty.threads": "No archived threads yet.",
  "arch.empty.carousels": "No archived carousels yet.",

  // Engine
  "eng.error.twitter": "Error generating X post. Try again.",
  "eng.error.instagram": "Error generating carousel. Try again.",
  "eng.loading.twitter": "Generating X post...",
  "eng.loading.instagram": "Generating Instagram carousel...",
  "eng.loading.hint": "This takes 30-60 seconds.",

  // Pin
  "pin.incorrect": "Incorrect PIN",
};

const translations: Record<Lang, Dict> = { es, en };

type I18nContextValue = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === "en" || saved === "es" ? saved : "es";
  });

  const setLang = useCallback((l: Lang) => {
    localStorage.setItem(STORAGE_KEY, l);
    setLangState(l);
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      let s = translations[lang][key] ?? translations.es[key] ?? key;
      if (vars) {
        for (const k of Object.keys(vars)) {
          s = s.replace(new RegExp(`\\{${k}\\}`, "g"), String(vars[k]));
        }
      }
      return s;
    },
    [lang]
  );

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
