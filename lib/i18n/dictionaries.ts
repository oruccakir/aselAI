export type Locale = "en" | "tr";

export const LOCALES: Locale[] = ["en", "tr"];

export function isLocale(value: string): value is Locale {
  return LOCALES.some((locale) => locale === value);
}

// English is the source of truth: `tr` must satisfy the shape derived from
// `en`, so a missing Turkish string is a type error, not a runtime fallback.
const en = {
  agentPicker: {
    groupHeading: "Agents",
    searchPlaceholder: "Search agents...",
    supportsReasoning: "Supports reasoning",
    supportsTools: "Supports tool use",
    supportsVision: "Supports vision",
  },
  composer: {
    cancel: "Cancel",
    editingMessage: "Editing message",
    editPlaceholder: "Edit your message...",
    placeholder: "Ask anything...",
    waitForModel: "Please wait for the model to finish its response!",
  },
  dialogs: {
    cancel: "Cancel",
    continueAction: "Continue",
    deleteAllChatsDescription:
      "This action cannot be undone. This will permanently delete all your chats and remove them from our servers.",
    deleteAllChatsTitle: "Delete all chats?",
    deleteChatDescription:
      "This action cannot be undone. This will permanently delete your chat and remove it from our servers.",
    deleteChatTitle: "Are you absolutely sure?",
  },
  greeting: {
    iAm: "I am",
    question: "What can I help with?",
  },
  language: {
    english: "English",
    englishDescription: "Interface in English",
    turkish: "Türkçe",
    turkishDescription: "Arayüz Türkçe",
  },
  messageActions: {
    copiedToClipboard: "Copied to clipboard!",
    copy: "Copy",
    edit: "Edit",
    noTextToCopy: "There's no text to copy!",
    waiting: "Waiting...",
  },
  sidebar: {
    allChatsDeleted: "All chats deleted",
    chatDeleted: "Chat deleted",
    delete: "Delete",
    deleteAllChats: "Delete All Chats",
    deleteAllChatsFailed: "Failed to delete all chats",
    deleteChatFailed: "Failed to delete chat",
    deletingAllChats: "Deleting all chats...",
    deletingChat: "Deleting chat...",
    emptyHistory:
      "Your conversations will appear here once you start chatting!",
    history: "History",
    lastMonth: "Last 30 days",
    lastWeek: "Last 7 days",
    loading: "Loading...",
    loginToSave: "Login to save and revisit previous chats!",
    newChat: "New Chat",
    older: "Older",
    openSidebar: "Open sidebar",
    private: "Private",
    public: "Public",
    share: "Share",
    today: "Today",
    yesterday: "Yesterday",
  },
  slash: {
    agent: "Switch the agent",
    clear: "Clear current chat",
    commandsHeading: "Commands",
    delete: "Delete current chat",
    deleteAction: "Delete",
    deleteAllAction: "Delete all",
    deleteAllPrompt: "Delete all chats?",
    deletePrompt: "Delete this chat?",
    new: "Start a new chat",
    purge: "Delete all chats",
    rename: "Rename current chat",
    renameHint: "Rename is available from the sidebar chat menu.",
    theme: "Toggle dark/light mode",
  },
  themes: {
    asel: "Asel Blue",
    aselDescription: "ASELSAN navy + blue accent",
    dark: "Dark",
    darkDescription: "Dimmed low-light palette",
    light: "Light",
    lightDescription: "Bright daytime palette",
  },
  toasts: {
    genericError: "Oops, an error occurred!",
  },
  visibility: {
    privateDescription: "Only you can access this chat",
    privateLabel: "Private",
    publicDescription: "Anyone with the link can access this chat",
    publicLabel: "Public",
  },
};

export type Dictionary = typeof en;

const tr: Dictionary = {
  agentPicker: {
    groupHeading: "Agent'lar",
    searchPlaceholder: "Agent ara...",
    supportsReasoning: "Akıl yürütme destekler",
    supportsTools: "Araç kullanımı destekler",
    supportsVision: "Görüntü destekler",
  },
  composer: {
    cancel: "Vazgeç",
    editingMessage: "Mesaj düzenleniyor",
    editPlaceholder: "Mesajını düzenle...",
    placeholder: "Bir şey sor...",
    waitForModel: "Lütfen modelin yanıtını bitirmesini bekleyin!",
  },
  dialogs: {
    cancel: "Vazgeç",
    continueAction: "Devam et",
    deleteAllChatsDescription:
      "Bu işlem geri alınamaz. Tüm sohbetleriniz kalıcı olarak silinir ve sunucularımızdan kaldırılır.",
    deleteAllChatsTitle: "Tüm sohbetler silinsin mi?",
    deleteChatDescription:
      "Bu işlem geri alınamaz. Sohbetiniz kalıcı olarak silinir ve sunucularımızdan kaldırılır.",
    deleteChatTitle: "Emin misiniz?",
  },
  greeting: {
    iAm: "Ben",
    question: "Nasıl yardımcı olabilirim?",
  },
  language: {
    english: "English",
    englishDescription: "Interface in English",
    turkish: "Türkçe",
    turkishDescription: "Arayüz Türkçe",
  },
  messageActions: {
    copiedToClipboard: "Panoya kopyalandı!",
    copy: "Kopyala",
    edit: "Düzenle",
    noTextToCopy: "Kopyalanacak metin yok!",
    waiting: "Bekleniyor...",
  },
  sidebar: {
    allChatsDeleted: "Tüm sohbetler silindi",
    chatDeleted: "Sohbet silindi",
    delete: "Sil",
    deleteAllChats: "Tüm Sohbetleri Sil",
    deleteAllChatsFailed: "Tüm sohbetler silinemedi",
    deleteChatFailed: "Sohbet silinemedi",
    deletingAllChats: "Tüm sohbetler siliniyor...",
    deletingChat: "Sohbet siliniyor...",
    emptyHistory: "Sohbet etmeye başladığınızda konuşmalarınız burada görünür!",
    history: "Geçmiş",
    lastMonth: "Son 30 gün",
    lastWeek: "Son 7 gün",
    loading: "Yükleniyor...",
    loginToSave: "Önceki sohbetlerinizi kaydetmek için giriş yapın!",
    newChat: "Yeni Sohbet",
    older: "Daha eski",
    openSidebar: "Kenar çubuğunu aç",
    private: "Özel",
    public: "Herkese açık",
    share: "Paylaş",
    today: "Bugün",
    yesterday: "Dün",
  },
  slash: {
    agent: "Agent değiştir",
    clear: "Sohbeti temizle",
    commandsHeading: "Komutlar",
    delete: "Bu sohbeti sil",
    deleteAction: "Sil",
    deleteAllAction: "Tümünü sil",
    deleteAllPrompt: "Tüm sohbetler silinsin mi?",
    deletePrompt: "Bu sohbet silinsin mi?",
    new: "Yeni sohbet başlat",
    purge: "Tüm sohbetleri sil",
    rename: "Sohbeti yeniden adlandır",
    renameHint: "Yeniden adlandırma kenar çubuğundaki sohbet menüsünde.",
    theme: "Koyu/açık temayı değiştir",
  },
  themes: {
    asel: "Asel Mavisi",
    aselDescription: "ASELSAN laciverti + mavi vurgu",
    dark: "Koyu",
    darkDescription: "Loş ışık paleti",
    light: "Açık",
    lightDescription: "Aydınlık gündüz paleti",
  },
  toasts: {
    genericError: "Bir hata oluştu!",
  },
  visibility: {
    privateDescription: "Bu sohbete yalnızca siz erişebilirsiniz",
    privateLabel: "Özel",
    publicDescription: "Bağlantıya sahip herkes bu sohbete erişebilir",
    publicLabel: "Herkese açık",
  },
};

export const dictionaries: Record<Locale, Dictionary> = { en, tr };
