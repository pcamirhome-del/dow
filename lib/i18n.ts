import type { LanguageCode } from '@/types/media';

export interface LanguageOption {
  code: LanguageCode;
  name: string;
  nativeName: string;
  flag: string;
  dir: 'rtl' | 'ltr';
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'ar', name: 'Arabic', nativeName: 'العربية (مصر)', flag: '🇪🇬', dir: 'rtl' },
  { code: 'en', name: 'English', nativeName: 'English (US)', flag: '🇺🇸', dir: 'ltr' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', dir: 'ltr' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷', dir: 'ltr' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪', dir: 'ltr' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹', dir: 'ltr' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇧🇷', dir: 'ltr' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷', dir: 'ltr' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺', dir: 'ltr' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵', dir: 'ltr' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷', dir: 'ltr' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳', dir: 'ltr' },
];

export interface TranslationStrings {
  appName: string;
  installApp: string;
  offlineBanner: string;
  // Sidebar
  navLinks: string;
  navFiles: string;
  navSecurity: string;
  navGeneral: string;
  navDownloads: string;
  navNotifications: string;
  navAppearance: string;
  navSpeedTest: string;
  navHistory: string;
  navAbout: string;
  // Links / Downloader
  linksTitle: string;
  linksSubtitle: string;
  urlPlaceholder: string;
  pasteLink: string;
  downloadNow: string;
  analyzeLink: string;
  analyzing: string;
  supportedPlatforms: string;
  videoMode: string;
  audioMode: string;
  selectQuality: string;
  downloadVideoBtn: string;
  downloadAudioBtn: string;
  activeQueue: string;
  noActiveDownloads: string;
  convertingMp3: string;
  muxingVideo: string;
  cancel: string;
  // Files Explorer
  filesTitle: string;
  viewFiles: string;
  viewFolders: string;
  viewList: string;
  showHidden: string;
  sortByName: string;
  sortByType: string;
  sortByDate: string;
  sortBySize: string;
  sortByTags: string;
  sortAscending: string;
  sortDescending: string;
  videoFolder: string;
  audioFolder: string;
  emptyFiles: string;
  playMedia: string;
  saveToDevice: string;
  shareMedia: string;
  deleteMedia: string;
  toggleHide: string;
  addTag: string;
  // Security
  securityTitle: string;
  touchIdLabel: string;
  touchIdDesc: string;
  enableBtn: string;
  lockBtn: string;
  unlockBtn: string;
  lockedTitle: string;
  lockedSubtitle: string;
  privacyNoPersonalData: string;
  privacyLocalOnly: string;
  privacyNoTracking: string;
  // General
  generalTitle: string;
  appLanguage: string;
  // Downloads Settings
  downloadsTitle: string;
  saveFolder: string;
  chooseFolder: string;
  folderDefaultNote: string;
  folderAutoRoute: string;
  directDownload: string;
  directDownloadDesc: string;
  concurrentDownloads: string;
  concurrentDefaultNote: string;
  concurrentWarningTitle: string;
  concurrentWarningBody: string;
  confirmOk: string;
  resetToNormal: string;
  speedLimit: string;
  speedUnlimited: string;
  storageInfoTitle: string;
  storageUsed: string;
  storageAvailable: string;
  storageTotal: string;
  // Notifications
  notificationsTitle: string;
  notifMaster: string;
  notifSoundOrPhone: string;
  notifOnComplete: string;
  notifOnFail: string;
  notifSoundChoice: string;
  soundChime: string;
  soundPulse: string;
  soundCascade: string;
  previewSound: string;
  // Appearance
  appearanceTitle: string;
  themeDark: string;
  themeLight: string;
  themeAuto: string;
  themeDynamic: string;
  dynamicPaletteLabel: string;
  // Speed Test
  speedTestTitle: string;
  speedTestProvider: string;
  startTest: string;
  testingNow: string;
  metricDownloadSpeed: string;
  metricLatency: string;
  metricProtocol: string;
  metricTls: string;
  metricResume: string;
  supported: string;
  notSupported: string;
  // History
  historyTitle: string;
  exportCsv: string;
  clearHistory: string;
  emptyHistory: string;
  // About
  aboutTitle: string;
  releaseDateLabel: string;
  madeInEgypt: string;
  updatesHistory: string;
  developerGreeting: string;
}

const en: TranslationStrings = {
  appName: 'SaveBox',
  installApp: 'Install App',
  offlineBanner: 'Offline Mode — Local files remain accessible',
  navLinks: 'Links',
  navFiles: 'Downloads',
  navSecurity: 'Security',
  navGeneral: 'General',
  navDownloads: 'Download Settings',
  navNotifications: 'Notifications',
  navAppearance: 'Appearance',
  navSpeedTest: 'Connection Test',
  navHistory: 'Download History',
  navAbout: 'About',
  linksTitle: 'Video & Audio Downloader',
  linksSubtitle: 'Download locally from 144p up to 4K or extract MP3 audio across all bitrates',
  urlPlaceholder: 'Enter link here',
  pasteLink: 'Paste Link',
  downloadNow: 'Download',
  analyzeLink: 'Fetch Qualities',
  analyzing: 'Extracting media streams...',
  supportedPlatforms: 'Supports YouTube, Facebook, Instagram, TikTok, X, and yt-dlp compatible sites',
  videoMode: 'Video (MP4)',
  audioMode: 'Audio Only (MP3)',
  selectQuality: 'Select Quality',
  downloadVideoBtn: 'Download Video',
  downloadAudioBtn: 'Download MP3 Audio',
  activeQueue: 'Active Transfers',
  noActiveDownloads: 'No active transfers right now',
  convertingMp3: 'Converting to MP3...',
  muxingVideo: 'Muxing HD video + audio...',
  cancel: 'Cancel',
  filesTitle: 'Downloaded Media',
  viewFiles: 'Files',
  viewFolders: 'Folders',
  viewList: 'List',
  showHidden: 'Show Hidden Items',
  sortByName: 'Name',
  sortByType: 'Type',
  sortByDate: 'Date',
  sortBySize: 'Size',
  sortByTags: 'Tags',
  sortAscending: 'Ascending Order',
  sortDescending: 'Descending Order',
  videoFolder: 'Video',
  audioFolder: 'Audio',
  emptyFiles: 'No downloaded files stored locally yet.',
  playMedia: 'Play',
  saveToDevice: 'Save Copy',
  shareMedia: 'Share',
  deleteMedia: 'Delete',
  toggleHide: 'Hide / Unhide',
  addTag: 'Add Tag',
  securityTitle: 'Security & Privacy',
  touchIdLabel: 'Touch ID Protection',
  touchIdDesc: 'Require biometric verification to open or manage local downloads',
  enableBtn: 'Enable',
  lockBtn: 'Close / Lock',
  unlockBtn: 'Unlock with Touch ID',
  lockedTitle: 'SaveBox Locked',
  lockedSubtitle: 'Verify with Touch ID or passkey to access your local vault',
  privacyNoPersonalData: 'No personal data is sent to our servers',
  privacyLocalOnly: 'Downloads are stored locally only',
  privacyNoTracking: 'Your browser activity is not tracked',
  generalTitle: 'General',
  appLanguage: 'App Language',
  downloadsTitle: 'Download Settings',
  saveFolder: 'Save Folder',
  chooseFolder: 'Choose Device Folder',
  folderDefaultNote: 'Browser local vault (Videos → Video folder, Audio → Audio folder)',
  folderAutoRoute: 'Videos auto-save to "video" & audio to "audio"',
  directDownload: 'Start Download Directly',
  directDownloadDesc: 'Download immediately on paste/click without asking where to save',
  concurrentDownloads: 'Concurrent Downloads',
  concurrentDefaultNote: 'Normal recommended rate is 2 simultaneous downloads (1–10)',
  concurrentWarningTitle: 'Speed Advisory',
  concurrentWarningBody: 'Multiple simultaneous downloads may affect your connection speed.',
  confirmOk: 'OK',
  resetToNormal: 'Return to 2',
  speedLimit: 'Set Speed Limit',
  speedUnlimited: 'Unlimited',
  storageInfoTitle: 'Storage Information',
  storageUsed: 'Used Storage',
  storageAvailable: 'Available Storage',
  storageTotal: 'Total Quota',
  notificationsTitle: 'Notifications',
  notifMaster: 'Notifications',
  notifSoundOrPhone: 'Sound Alerts or Phone Notification',
  notifOnComplete: 'Download Complete',
  notifOnFail: 'Download Failed',
  notifSoundChoice: 'Notification Sound',
  soundChime: 'Tone 1 · Soft Chime',
  soundPulse: 'Tone 2 · Digital Pulse',
  soundCascade: 'Tone 3 · Harmonic Cascade',
  previewSound: 'Preview',
  appearanceTitle: 'Appearance',
  themeDark: 'Dark',
  themeLight: 'Light',
  themeAuto: 'Auto (System)',
  themeDynamic: 'Dynamic Colors',
  dynamicPaletteLabel: 'Dynamic Accent Palette',
  speedTestTitle: 'Connection Speed Test',
  speedTestProvider: 'Powered by speed.cloudflare.com',
  startTest: 'Start Test',
  testingNow: 'Measuring Cloudflare throughput...',
  metricDownloadSpeed: 'Download Speed',
  metricLatency: 'Latency',
  metricProtocol: 'Protocol',
  metricTls: 'TLS Security',
  metricResume: 'Resume Support',
  supported: 'Supported',
  notSupported: 'Not Supported',
  historyTitle: 'Download History',
  exportCsv: 'Export All Links (CSV UTF-8)',
  clearHistory: 'Clear History',
  emptyHistory: 'No download history recorded yet.',
  aboutTitle: 'About SaveBox',
  releaseDateLabel: 'Initial Release Date',
  madeInEgypt: 'Made in Egypt',
  updatesHistory: 'Version Changelog',
  developerGreeting: 'With greetings from developer Amir Lamay',
};

const ar: TranslationStrings = {
  appName: 'SaveBox',
  installApp: 'تثبيت التطبيق',
  offlineBanner: 'وضع عدم الاتصال — الملفات المحفوظة محلياً متاحة دائماً',
  navLinks: 'الروابط',
  navFiles: 'الفيديوهات المحملة',
  navSecurity: 'الأمان',
  navGeneral: 'عام',
  navDownloads: 'التنزيلات',
  navNotifications: 'إشعارات',
  navAppearance: 'المظهر',
  navSpeedTest: 'اختبار الاتصال',
  navHistory: 'سجل التنزيلات',
  navAbout: 'حول',
  linksTitle: 'تنزيل الفيديو والصوت محلياً',
  linksSubtitle: 'تحميل من جودة 140p حتى 4K أو تحويل لصوت MP3 بجميع الجودات المتاحة',
  urlPlaceholder: 'ادخل الرابط هنا',
  pasteLink: 'الصق الرابط',
  downloadNow: 'تنزيل',
  analyzeLink: 'جلب الجودات',
  analyzing: 'جاري استخراج روابط التحميل...',
  supportedPlatforms: 'يدعم يوتيوب، فيسبوك، إنستجرام، تيك توك، إكس (تويتر) ومواقع yt-dlp',
  videoMode: 'فيديو (MP4)',
  audioMode: 'صوت فقط (MP3)',
  selectQuality: 'اختر الجودة',
  downloadVideoBtn: 'تحميل الفيديو',
  downloadAudioBtn: 'تحميل صوت MP3',
  activeQueue: 'التحميلات النشطة',
  noActiveDownloads: 'لا توجد تحميلات جارية حالياً',
  convertingMp3: 'جاري التحويل إلى MP3...',
  muxingVideo: 'جاري دمج الفيديو عالي الجودة مع الصوت...',
  cancel: 'إلغاء',
  filesTitle: 'قائمة الفيديوهات والملفات المحملة',
  viewFiles: 'الملفات',
  viewFolders: 'المجلدات',
  viewList: 'القائمة',
  showHidden: 'إظهار العناصر المخفية',
  sortByName: 'الاسم',
  sortByType: 'النوع',
  sortByDate: 'التاريخ',
  sortBySize: 'الحجم',
  sortByTags: 'الوسوم',
  sortAscending: 'فرز تصاعدي',
  sortDescending: 'فرز تنازلي',
  videoFolder: 'فيديو (Video)',
  audioFolder: 'صوتيات (Audio)',
  emptyFiles: 'لم يتم تحميل أي ملفات محلياً بعد.',
  playMedia: 'تشغيل',
  saveToDevice: 'حفظ نسخة',
  shareMedia: 'مشاركة',
  deleteMedia: 'حذف',
  toggleHide: 'إخفاء / إظهار',
  addTag: 'إضافة وسم',
  securityTitle: 'الأمان والخصوصية',
  touchIdLabel: 'تفعيل زر Touch ID',
  touchIdDesc: 'حماية التطبيق والملفات المحملة بالبصمة أو رمز القفل',
  enableBtn: 'تفعيل',
  lockBtn: 'غلق',
  unlockBtn: 'فتح عبر Touch ID',
  lockedTitle: 'التطبيق مقفل',
  lockedSubtitle: 'قم بالتحقق باستخدام Touch ID للوصول إلى ملفاتك المحلية',
  privacyNoPersonalData: 'لا يتم ارسال اي بيانات شخصيه الي خوادمنا',
  privacyLocalOnly: 'يتم تخزين التنزيلات محليا فقط',
  privacyNoTracking: 'لا يتم تتبع نشاط المتصفح الخاص بك',
  generalTitle: 'عام',
  appLanguage: 'لغة التطبيق',
  downloadsTitle: 'إعدادات التنزيلات',
  saveFolder: 'مجلد الحفظ',
  chooseFolder: 'تحديد مجلد من الجهاز',
  folderDefaultNote: 'الحفظ التلقائي: الفيديو في مجلد video والصوت في مجلد audio',
  folderAutoRoute: 'توجيه تلقائي: الفيديو في ملف video والصوتي في ملف audio',
  directDownload: 'بدء التنزيل مباشرة',
  directDownloadDesc: 'عند التفعيل يتم التحميل مباشرة عند إعطاء الرابط دون سؤال عن مكان الحفظ',
  concurrentDownloads: 'التنزيلات المتزامنة',
  concurrentDefaultNote: 'الحد الأقصى للتحميلات في نفس الوقت (1 إلى 10) — المعدل الطبيعي 2',
  concurrentWarningTitle: 'تنبيه السرعة',
  concurrentWarningBody: 'قد تؤثر التنزيلات المتعدده علي السرعه',
  confirmOk: 'موافق',
  resetToNormal: 'العودة إلى 2 فيديو',
  speedLimit: 'حدد السرعة',
  speedUnlimited: 'غير محدود',
  storageInfoTitle: 'معلومات التخزين',
  storageUsed: 'المستخدم من الذاكرة',
  storageAvailable: 'المتاح من الذاكرة',
  storageTotal: 'إجمالي المساحة',
  notificationsTitle: 'الإشعارات',
  notifMaster: 'الإشعارات',
  notifSoundOrPhone: 'تنبيهات صوتية أو إشعار على الهاتف',
  notifOnComplete: 'اكتمال التنزيل',
  notifOnFail: 'فشل التنزيل',
  notifSoundChoice: 'صوت الإشعارات',
  soundChime: 'نغمة 1 · رنين هادئ',
  soundPulse: 'نغمة 2 · نبضة رقمية',
  soundCascade: 'نغمة 3 · نغمة متناغمة',
  previewSound: 'تجربة',
  appearanceTitle: 'المظهر',
  themeDark: 'الداكن',
  themeLight: 'الفاتح',
  themeAuto: 'التلقائي',
  themeDynamic: 'ألوان ديناميكية',
  dynamicPaletteLabel: 'نظام الألوان الديناميكي',
  speedTestTitle: 'اختبار الاتصال',
  speedTestProvider: 'اختبار مجاني عبر speed.cloudflare.com',
  startTest: 'بدء الاختبار',
  testingNow: 'جاري قياس سرعة الاتصال عبر Cloudflare...',
  metricDownloadSpeed: 'سرعة التنزيل',
  metricLatency: 'زمن الاستجابة',
  metricProtocol: 'البروتوكول',
  metricTls: 'أمان TLS',
  metricResume: 'استئناف',
  supported: 'مدعوم',
  notSupported: 'غير مدعوم',
  historyTitle: 'سجل التنزيلات',
  exportCsv: 'تصدير جميع الروابط CSV (Excel UTF-8 BOM)',
  clearHistory: 'مسح السجل',
  emptyHistory: 'لا يوجد سجل تنزيلات حتى الآن.',
  aboutTitle: 'حول البرنامج',
  releaseDateLabel: 'تاريخ إصدار البرنامج',
  madeInEgypt: 'صنع في مصر',
  updatesHistory: 'سجل التحديثات والإصدارات',
  developerGreeting: 'مع تحيات المطور Amir Lamay',
};

const es: TranslationStrings = {
  ...en,
  navLinks: 'Enlaces',
  navFiles: 'Archivos',
  navSecurity: 'Seguridad',
  navGeneral: 'General',
  navDownloads: 'Descargas',
  navNotifications: 'Notificaciones',
  navAppearance: 'Apariencia',
  navSpeedTest: 'Test de Conexión',
  navHistory: 'Historial',
  navAbout: 'Acerca de',
  linksTitle: 'Descargador de Video y Audio',
  urlPlaceholder: 'Ingresa el enlace aquí',
  pasteLink: 'Pegar Enlace',
  downloadNow: 'Descargar',
  downloadVideoBtn: 'Descargar Video',
  downloadAudioBtn: 'Descargar Audio MP3',
  generalTitle: 'General',
  appLanguage: 'Idioma de la aplicación',
  madeInEgypt: 'Hecho en Egipto',
  developerGreeting: 'Saludos del desarrollador Amir Lamay',
};

const fr: TranslationStrings = {
  ...en,
  navLinks: 'Liens',
  navFiles: 'Téléchargements',
  navSecurity: 'Sécurité',
  navGeneral: 'Général',
  navDownloads: 'Paramètres',
  navNotifications: 'Notifications',
  navAppearance: 'Apparence',
  navSpeedTest: 'Test de Connexion',
  navHistory: 'Historique',
  navAbout: 'À propos',
  linksTitle: 'Téléchargeur Vidéo & Audio',
  urlPlaceholder: 'Entrez le lien ici',
  pasteLink: 'Coller le lien',
  downloadNow: 'Télécharger',
  downloadVideoBtn: 'Télécharger la vidéo',
  downloadAudioBtn: 'Télécharger Audio MP3',
  generalTitle: 'Général',
  appLanguage: "Langue de l'application",
  madeInEgypt: 'Fabriqué en Égypte',
  developerGreeting: 'Salutations du développeur Amir Lamay',
};

const de: TranslationStrings = {
  ...en,
  navLinks: 'Links',
  navFiles: 'Dateien',
  navSecurity: 'Sicherheit',
  navGeneral: 'Allgemein',
  navDownloads: 'Downloads',
  navNotifications: 'Benachrichtigungen',
  navAppearance: 'Darstellung',
  navSpeedTest: 'Verbindungstest',
  navHistory: 'Verlauf',
  navAbout: 'Über',
  linksTitle: 'Video & Audio Downloader',
  urlPlaceholder: 'Link hier eingeben',
  pasteLink: 'Link einfügen',
  downloadNow: 'Herunterladen',
  generalTitle: 'Allgemein',
  appLanguage: 'App-Sprache',
  madeInEgypt: 'Hergestellt in Ägypten',
  developerGreeting: 'Grüße vom Entwickler Amir Lamay',
};

const it: TranslationStrings = {
  ...en,
  navLinks: 'Link',
  navFiles: 'File',
  navSecurity: 'Sicurezza',
  navGeneral: 'Generale',
  navDownloads: 'Download',
  navNotifications: 'Notifiche',
  navAppearance: 'Aspetto',
  navSpeedTest: 'Test Connessione',
  navHistory: 'Cronologia',
  navAbout: 'Info',
  urlPlaceholder: 'Inserisci il link qui',
  pasteLink: 'Incolla Link',
  downloadNow: 'Scarica',
  appLanguage: "Lingua dell'app",
  madeInEgypt: 'Prodotto in Egitto',
  developerGreeting: 'Saluti dallo sviluppatore Amir Lamay',
};

const pt: TranslationStrings = {
  ...en,
  navLinks: 'Links',
  navFiles: 'Arquivos',
  navSecurity: 'Segurança',
  navGeneral: 'Geral',
  navDownloads: 'Downloads',
  navNotifications: 'Notificações',
  navAppearance: 'Aparência',
  navSpeedTest: 'Teste de Conexão',
  navHistory: 'Histórico',
  navAbout: 'Sobre',
  urlPlaceholder: 'Insira o link aqui',
  pasteLink: 'Colar Link',
  downloadNow: 'Baixar',
  appLanguage: 'Idioma do aplicativo',
  madeInEgypt: 'Feito no Egito',
  developerGreeting: 'Saudações do desenvolvedor Amir Lamay',
};

const tr: TranslationStrings = {
  ...en,
  navLinks: 'Bağlantılar',
  navFiles: 'İndirilenler',
  navSecurity: 'Güvenlik',
  navGeneral: 'Genel',
  navDownloads: 'İndirme Ayarları',
  navNotifications: 'Bildirimler',
  navAppearance: 'Görünüm',
  navSpeedTest: 'Bağlantı Testi',
  navHistory: 'Geçmiş',
  navAbout: 'Hakkında',
  urlPlaceholder: 'Bağlantıyı buraya girin',
  pasteLink: 'Bağlantıyı Yapıştır',
  downloadNow: 'İndir',
  appLanguage: 'Uygulama Dili',
  madeInEgypt: 'Mısır’da üretildi',
  developerGreeting: 'Geliştirici Amir Lamay’dan selamlar',
};

const ru: TranslationStrings = {
  ...en,
  navLinks: 'Ссылки',
  navFiles: 'Загрузки',
  navSecurity: 'Безопасность',
  navGeneral: 'Общие',
  navDownloads: 'Настройки загрузки',
  navNotifications: 'Уведомления',
  navAppearance: 'Внешний вид',
  navSpeedTest: 'Тест скорости',
  navHistory: 'История',
  navAbout: 'О программе',
  urlPlaceholder: 'Введите ссылку здесь',
  pasteLink: 'Вставить ссылку',
  downloadNow: 'Скачать',
  appLanguage: 'Язык приложения',
  madeInEgypt: 'Сделано в Египте',
  developerGreeting: 'С уважением, разработчик Amir Lamay',
};

const ja: TranslationStrings = {
  ...en,
  navLinks: 'リンク',
  navFiles: 'ダウンロード済み',
  navSecurity: 'セキュリティ',
  navGeneral: '一般',
  navDownloads: 'ダウンロード設定',
  navNotifications: '通知',
  navAppearance: '外観',
  navSpeedTest: '接続テスト',
  navHistory: '履歴',
  navAbout: '情報',
  urlPlaceholder: 'ここにリンクを入力',
  pasteLink: 'リンクを貼り付け',
  downloadNow: 'ダウンロード',
  appLanguage: 'アプリの言語',
  madeInEgypt: 'エジプト製',
  developerGreeting: '開発者 Amir Lamay より',
};

const ko: TranslationStrings = {
  ...en,
  navLinks: '링크',
  navFiles: '다운로드 항목',
  navSecurity: '보안',
  navGeneral: '일반',
  navDownloads: '다운로드 설정',
  navNotifications: '알림',
  navAppearance: '화면 테마',
  navSpeedTest: '연결 테스트',
  navHistory: '기록',
  navAbout: '정보',
  urlPlaceholder: '여기에 링크 입력',
  pasteLink: '링크 붙여넣기',
  downloadNow: '다운로드',
  appLanguage: '앱 언어',
  madeInEgypt: '이집트 제작',
  developerGreeting: '개발자 Amir Lamay 드림',
};

const zh: TranslationStrings = {
  ...en,
  navLinks: '链接',
  navFiles: '已下载',
  navSecurity: '安全与隐私',
  navGeneral: '通用',
  navDownloads: '下载设置',
  navNotifications: '通知',
  navAppearance: '外观',
  navSpeedTest: '连接测试',
  navHistory: '下载历史',
  navAbout: '关于',
  urlPlaceholder: '在此输入链接',
  pasteLink: '粘贴链接',
  downloadNow: '立即下载',
  appLanguage: '应用语言',
  madeInEgypt: '埃及制造',
  developerGreeting: '开发者 Amir Lamay 致意',
};

export const TRANSLATIONS: Record<LanguageCode, TranslationStrings> = {
  ar,
  en,
  es,
  fr,
  de,
  it,
  pt,
  tr,
  ru,
  ja,
  ko,
  zh,
};

export interface ChangelogEntry {
  version: string;
  date: string;
  changesAr: string[];
  changesEn: string[];
}

export const APP_RELEASE_DATE = '2026-11-13';

export const CHANGELOG_ENTRIES: ChangelogEntry[] = [
  {
    version: '1.2.0',
    date: '2026-11-13',
    changesAr: [
      'إضافة محرك التحويل الصوتي المحلي MP3 بجميع الجودات (64 حتى 320 kbps) عبر FFmpeg WebAssembly',
      'دعم تصدير سجل التنزيلات بصيغة CSV متوافق مع Excel بترميز UTF-8 مع BOM',
      'إضافة اختبار سرعة الاتصال الحقيقي عبر خوادم speed.cloudflare.com مع عرض البروتوكول وأمان TLS ودعم الاستئناف',
    ],
    changesEn: [
      'Added client-side MP3 audio transcoding (64 to 320 kbps) via FFmpeg WebAssembly',
      'Added Excel-compatible UTF-8 BOM CSV export for full download history',
      'Integrated real connection speed test via speed.cloudflare.com with protocol, TLS, and resume inspection',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-11-10',
    changesAr: [
      'إضافة ميزة الأمان Touch ID / WebAuthn وتشفير الوصول للتخزين المحلي',
      'إضافة محدد السرعة الحقيقي (256 KB/s حتى 10 MB/s أو غير محدود) والتحميل المتزامن (1–10)',
      'توجيه تلقائي لحفظ الفيديو في مجلد video والصوت في مجلد audio عبر File System Access API',
    ],
    changesEn: [
      'Added Touch ID / WebAuthn biometric lock protecting local vault access',
      'Added real ReadableStream speed throttling (256 KB/s to 10 MB/s or Unlimited) and concurrency queue (1–10)',
      'Automatic Video/Audio subfolder routing via File System Access API',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-11-01',
    changesAr: [
      'الإصدار الأول: استخراج وتحميل الفيديوهات من 144p حتى 4K من يوتيوب، تيك توك، فيسبوك، إنستجرام، وإكس',
      'دعم أكثر من 10 لغات مع الأعلام وميزة التطبيق التقدمي PWA للعمل محلياً',
    ],
    changesEn: [
      'Initial release: local video extraction (144p to 4K) from YouTube, TikTok, Facebook, Instagram, and X',
      'Added 12-language localization with flags and full PWA offline installability',
    ],
  },
];
