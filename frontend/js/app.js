/* =============================================================================
 * Wealth OS — Frontend SPA (vanilla JS, no build step)
 * =============================================================================
 * One file drives the whole single-page app:
 *
 *  - State & nav      : `state` (all client data) + `pages[]` + show(page) which
 *                       toggles the matching <section class="page"> active.
 *  - Data layer       : get/post/patch/del helpers hit the FastAPI backend (API).
 *  - Loaders          : loadAll() fans out to loadDash/loadHoldings/loadMarkets/
 *                       loadAiDesk/loadForex/... then renders.
 *  - Charts           : chart() is the shared premium helper (gradient lines,
 *                       crosshair, rounded bars, donuts) + drawAssetChart() for the
 *                       interactive asset chart + sentimentGauge() SVG.
 *  - Feature blocks are grouped under banner comments (search "====="), e.g.
 *                       AI Investment Desk, About Me, Asset Detail panels,
 *                       Market Pulse / Forex, premium confirm/track modals.
 *  - Money            : values arrive in EUR; displayMoney()/money() format to the
 *                       user's chosen display currency.
 *
 * Conventions: byId() = getElementById; escapeHtml/escAttr/jsString guard all
 * interpolated user/market strings; cache-busting ?v= on the <script>/<link> tags.
 * ========================================================================== */

const API=window.WEALTH_OS_API||"http://localhost:8000";
let state={profile:"",charts:{},tableSort:{},editingProfileId:"",editingCashflowId:"",profileBooted:false,profiles:[],unlocked:{},pendingProfile:null,history:["Mission Control"],currentPage:"Mission Control",lastSuggestions:[],marketData:null,favoriteRows:[],propertyRows:[],cashAccounts:[],cashflowRows:[],disposingProperty:null,stockMarkets:[],fxRates:{},displayCurrency:"EUR",lastDashboard:null,lastHoldings:[],lastAllocation:null,editingHoldingSymbol:"",fundBondRows:[],brokerDetails:[]};
const pages=["Mission Control","About Me","Profiles","Live Markets","IPOs","Portfolio","Properties","Alerts & Plans","Favorites","AI Desk","Screeners","Compare","News","Funds & Bonds","SIPs","Asset Detail","Brokers","AI CFO"];
const palette=["#4f8cff","#34d399","#f59e0b","#ef4444","#a78bfa","#22d3ee","#f472b6","#94a3b8"];

/* ============================================================
   i18n — language translation (top 10 world languages)
   ============================================================ */
const LANGS=[
  {code:"en",native:"English",flag:"🇬🇧",rtl:false},
  {code:"de",native:"Deutsch",flag:"🇩🇪",rtl:false},
  {code:"zh",native:"中文",flag:"🇨🇳",rtl:false},
  {code:"hi",native:"हिन्दी",flag:"🇮🇳",rtl:false},
  {code:"es",native:"Español",flag:"🇪🇸",rtl:false},
  {code:"fr",native:"Français",flag:"🇫🇷",rtl:false},
  {code:"ar",native:"العربية",flag:"🇸🇦",rtl:true},
  {code:"bn",native:"বাংলা",flag:"🇧🇩",rtl:false},
  {code:"pt",native:"Português",flag:"🇵🇹",rtl:false},
  {code:"ru",native:"Русский",flag:"🇷🇺",rtl:false},
  {code:"ja",native:"日本語",flag:"🇯🇵",rtl:false},
];
const I18N={
  en:{"ui.eyebrow":"Private wealth dashboard","ui.back":"Back","ui.search_ph":"Search: stocks, funds, ETFs, coins…","ui.settings":"Settings","ui.language":"Language","ui.language_desc":"Display language for the entire app","ui.notifications":"Notifications","ui.appearance":"Appearance","ui.privacy":"Privacy & display","ui.livedata":"Live data","ui.profilesSec":"Profiles","ui.abouthelp":"About & help","ui.theme_mode":"Theme mode","ui.accent":"Accent color","ui.density":"Density","ui.hide_amounts":"Hide amounts","ui.clock12":"12-hour clock","ui.default_currency":"Default currency","ui.auto_refresh":"Auto-refresh","ui.refresh_now":"Refresh now","ui.startup_profile":"Startup profile","ui.manage_profiles":"Manage profiles","ui.user_guide":"User guide","ui.reset_settings":"Reset settings","ui.open":"Open","cat.All":"All","cat.Overview":"Overview","cat.Research":"Research","cat.Investing":"Investing","cat.Real assets":"Real assets","cat.Planning":"Planning","cat.Tools":"Tools"},
  de:{"Mission Control":"Kontrollzentrum","About Me":"Über mich","Profiles":"Profile","Live Markets":"Live-Märkte","IPOs":"Börsengänge","Portfolio":"Portfolio","Properties":"Sachwerte","Alerts & Plans":"Warnungen & Pläne","Favorites":"Favoriten","AI Desk":"KI-Desk","Screeners":"Screener","Compare":"Vergleichen","News":"Nachrichten","Funds & Bonds":"Fonds & Anleihen","SIPs":"Sparpläne","Brokers":"Broker","AI CFO":"KI-CFO","Guide":"Leitfaden","ui.eyebrow":"Privates Vermögens-Dashboard","ui.back":"Zurück","ui.search_ph":"Suche: Aktien, Fonds, ETFs, Coins…","ui.settings":"Einstellungen","ui.language":"Sprache","ui.language_desc":"Anzeigesprache für die gesamte App","ui.notifications":"Benachrichtigungen","ui.appearance":"Darstellung","ui.privacy":"Datenschutz & Anzeige","ui.livedata":"Live-Daten","ui.profilesSec":"Profile","ui.abouthelp":"Über & Hilfe","ui.theme_mode":"Designmodus","ui.accent":"Akzentfarbe","ui.density":"Dichte","ui.hide_amounts":"Beträge ausblenden","ui.clock12":"12-Stunden-Uhr","ui.default_currency":"Standardwährung","ui.auto_refresh":"Auto-Aktualisierung","ui.refresh_now":"Jetzt aktualisieren","ui.startup_profile":"Startprofil","ui.manage_profiles":"Profile verwalten","ui.user_guide":"Benutzerhandbuch","ui.reset_settings":"Einstellungen zurücksetzen","ui.open":"Öffnen","cat.All":"Alle","cat.Overview":"Übersicht","cat.Research":"Recherche","cat.Investing":"Investieren","cat.Real assets":"Sachwerte","cat.Planning":"Planung","cat.Tools":"Werkzeuge"},
  zh:{"Mission Control":"控制中心","About Me":"关于我","Profiles":"档案","Live Markets":"实时市场","IPOs":"新股","Portfolio":"投资组合","Properties":"资产","Alerts & Plans":"提醒与计划","Favorites":"收藏","AI Desk":"AI 投资台","Screeners":"筛选器","Compare":"比较","News":"新闻","Funds & Bonds":"基金与债券","SIPs":"定投","Brokers":"券商","AI CFO":"AI 财务官","Guide":"指南","ui.eyebrow":"私人财富仪表板","ui.back":"返回","ui.search_ph":"搜索：股票、基金、ETF、币种…","ui.settings":"设置","ui.language":"语言","ui.language_desc":"整个应用的显示语言","ui.notifications":"通知","ui.appearance":"外观","ui.privacy":"隐私与显示","ui.livedata":"实时数据","ui.profilesSec":"档案","ui.abouthelp":"关于与帮助","ui.theme_mode":"主题模式","ui.accent":"强调色","ui.density":"密度","ui.hide_amounts":"隐藏金额","ui.clock12":"12小时制","ui.default_currency":"默认货币","ui.auto_refresh":"自动刷新","ui.refresh_now":"立即刷新","ui.startup_profile":"启动档案","ui.manage_profiles":"管理档案","ui.user_guide":"用户指南","ui.reset_settings":"重置设置","ui.open":"打开","cat.All":"全部","cat.Overview":"概览","cat.Research":"研究","cat.Investing":"投资","cat.Real assets":"实物资产","cat.Planning":"规划","cat.Tools":"工具"},
  hi:{"Mission Control":"मिशन कंट्रोल","About Me":"मेरे बारे में","Profiles":"प्रोफ़ाइल","Live Markets":"लाइव मार्केट","IPOs":"आईपीओ","Portfolio":"पोर्टफोलियो","Properties":"संपत्तियाँ","Alerts & Plans":"अलर्ट और योजनाएँ","Favorites":"पसंदीदा","AI Desk":"एआई डेस्क","Screeners":"स्क्रीनर","Compare":"तुलना करें","News":"समाचार","Funds & Bonds":"फंड और बॉन्ड","SIPs":"एसआईपी","Brokers":"ब्रोकर","AI CFO":"एआई सीएफओ","Guide":"गाइड","ui.eyebrow":"निजी संपत्ति डैशबोर्ड","ui.back":"वापस","ui.search_ph":"खोजें: स्टॉक, फंड, ईटीएफ, कॉइन…","ui.settings":"सेटिंग्स","ui.language":"भाषा","ui.language_desc":"पूरे ऐप के लिए प्रदर्शन भाषा","ui.notifications":"सूचनाएँ","ui.appearance":"रूप","ui.privacy":"गोपनीयता और प्रदर्शन","ui.livedata":"लाइव डेटा","ui.profilesSec":"प्रोफ़ाइल","ui.abouthelp":"जानकारी और मदद","ui.theme_mode":"थीम मोड","ui.accent":"एक्सेंट रंग","ui.density":"घनत्व","ui.hide_amounts":"राशि छुपाएँ","ui.clock12":"12-घंटे की घड़ी","ui.default_currency":"डिफ़ॉल्ट मुद्रा","ui.auto_refresh":"ऑटो-रिफ़्रेश","ui.refresh_now":"अभी रिफ़्रेश करें","ui.startup_profile":"स्टार्टअप प्रोफ़ाइल","ui.manage_profiles":"प्रोफ़ाइल प्रबंधित करें","ui.user_guide":"उपयोगकर्ता गाइड","ui.reset_settings":"सेटिंग्स रीसेट करें","ui.open":"खोलें","cat.All":"सभी","cat.Overview":"अवलोकन","cat.Research":"अनुसंधान","cat.Investing":"निवेश","cat.Real assets":"वास्तविक संपत्ति","cat.Planning":"योजना","cat.Tools":"उपकरण"},
  es:{"Mission Control":"Centro de Control","About Me":"Sobre mí","Profiles":"Perfiles","Live Markets":"Mercados en vivo","IPOs":"OPVs","Portfolio":"Cartera","Properties":"Propiedades","Alerts & Plans":"Alertas y planes","Favorites":"Favoritos","AI Desk":"Mesa de IA","Screeners":"Filtros","Compare":"Comparar","News":"Noticias","Funds & Bonds":"Fondos y bonos","SIPs":"SIPs","Brokers":"Brókers","AI CFO":"CFO con IA","Guide":"Guía","ui.eyebrow":"Panel de patrimonio privado","ui.back":"Atrás","ui.search_ph":"Buscar: acciones, fondos, ETF, criptos…","ui.settings":"Ajustes","ui.language":"Idioma","ui.language_desc":"Idioma de toda la aplicación","ui.notifications":"Notificaciones","ui.appearance":"Apariencia","ui.privacy":"Privacidad y visualización","ui.livedata":"Datos en vivo","ui.profilesSec":"Perfiles","ui.abouthelp":"Acerca y ayuda","ui.theme_mode":"Modo de tema","ui.accent":"Color de acento","ui.density":"Densidad","ui.hide_amounts":"Ocultar importes","ui.clock12":"Reloj de 12 horas","ui.default_currency":"Moneda predeterminada","ui.auto_refresh":"Actualización automática","ui.refresh_now":"Actualizar ahora","ui.startup_profile":"Perfil de inicio","ui.manage_profiles":"Gestionar perfiles","ui.user_guide":"Guía del usuario","ui.reset_settings":"Restablecer ajustes","ui.open":"Abrir","cat.All":"Todo","cat.Overview":"Resumen","cat.Research":"Investigación","cat.Investing":"Inversión","cat.Real assets":"Activos reales","cat.Planning":"Planificación","cat.Tools":"Herramientas"},
  fr:{"Mission Control":"Centre de contrôle","About Me":"À propos de moi","Profiles":"Profils","Live Markets":"Marchés en direct","IPOs":"Introductions en bourse","Portfolio":"Portefeuille","Properties":"Biens","Alerts & Plans":"Alertes et plans","Favorites":"Favoris","AI Desk":"Bureau IA","Screeners":"Filtres","Compare":"Comparer","News":"Actualités","Funds & Bonds":"Fonds et obligations","SIPs":"SIP","Brokers":"Courtiers","AI CFO":"Directeur financier IA","Guide":"Guide","ui.eyebrow":"Tableau de bord du patrimoine privé","ui.back":"Retour","ui.search_ph":"Rechercher : actions, fonds, ETF, cryptos…","ui.settings":"Paramètres","ui.language":"Langue","ui.language_desc":"Langue d'affichage de l'application","ui.notifications":"Notifications","ui.appearance":"Apparence","ui.privacy":"Confidentialité et affichage","ui.livedata":"Données en direct","ui.profilesSec":"Profils","ui.abouthelp":"À propos et aide","ui.theme_mode":"Mode de thème","ui.accent":"Couleur d'accent","ui.density":"Densité","ui.hide_amounts":"Masquer les montants","ui.clock12":"Horloge 12 heures","ui.default_currency":"Devise par défaut","ui.auto_refresh":"Actualisation auto","ui.refresh_now":"Actualiser maintenant","ui.startup_profile":"Profil de démarrage","ui.manage_profiles":"Gérer les profils","ui.user_guide":"Guide de l'utilisateur","ui.reset_settings":"Réinitialiser","ui.open":"Ouvrir","cat.All":"Tout","cat.Overview":"Aperçu","cat.Research":"Recherche","cat.Investing":"Investissement","cat.Real assets":"Actifs réels","cat.Planning":"Planification","cat.Tools":"Outils"},
  ar:{"Mission Control":"مركز التحكم","About Me":"نبذة عني","Profiles":"الملفات الشخصية","Live Markets":"الأسواق المباشرة","IPOs":"الاكتتابات","Portfolio":"المحفظة","Properties":"الممتلكات","Alerts & Plans":"التنبيهات والخطط","Favorites":"المفضلة","AI Desk":"مكتب الذكاء الاصطناعي","Screeners":"أدوات الفرز","Compare":"مقارنة","News":"الأخبار","Funds & Bonds":"الصناديق والسندات","SIPs":"الاستثمار الدوري","Brokers":"الوسطاء","AI CFO":"المدير المالي الذكي","Guide":"الدليل","ui.eyebrow":"لوحة الثروة الخاصة","ui.back":"رجوع","ui.search_ph":"بحث: أسهم، صناديق، ETF، عملات…","ui.settings":"الإعدادات","ui.language":"اللغة","ui.language_desc":"لغة عرض التطبيق بالكامل","ui.notifications":"الإشعارات","ui.appearance":"المظهر","ui.privacy":"الخصوصية والعرض","ui.livedata":"البيانات المباشرة","ui.profilesSec":"الملفات الشخصية","ui.abouthelp":"حول والمساعدة","ui.theme_mode":"وضع السمة","ui.accent":"لون التمييز","ui.density":"الكثافة","ui.hide_amounts":"إخفاء المبالغ","ui.clock12":"نظام 12 ساعة","ui.default_currency":"العملة الافتراضية","ui.auto_refresh":"تحديث تلقائي","ui.refresh_now":"تحديث الآن","ui.startup_profile":"ملف بدء التشغيل","ui.manage_profiles":"إدارة الملفات","ui.user_guide":"دليل المستخدم","ui.reset_settings":"إعادة تعيين الإعدادات","ui.open":"فتح","cat.All":"الكل","cat.Overview":"نظرة عامة","cat.Research":"بحث","cat.Investing":"استثمار","cat.Real assets":"الأصول الحقيقية","cat.Planning":"تخطيط","cat.Tools":"أدوات"},
  bn:{"Mission Control":"নিয়ন্ত্রণ কেন্দ্র","About Me":"আমার সম্পর্কে","Profiles":"প্রোফাইল","Live Markets":"লাইভ মার্কেট","IPOs":"আইপিও","Portfolio":"পোর্টফোলিও","Properties":"সম্পত্তি","Alerts & Plans":"সতর্কতা ও পরিকল্পনা","Favorites":"প্রিয়","AI Desk":"এআই ডেস্ক","Screeners":"স্ক্রিনার","Compare":"তুলনা","News":"সংবাদ","Funds & Bonds":"ফান্ড ও বন্ড","SIPs":"এসআইপি","Brokers":"ব্রোকার","AI CFO":"এআই সিএফও","Guide":"গাইড","ui.eyebrow":"ব্যক্তিগত সম্পদ ড্যাশবোর্ড","ui.back":"পিছনে","ui.search_ph":"খুঁজুন: স্টক, ফান্ড, ইটিএফ, কয়েন…","ui.settings":"সেটিংস","ui.language":"ভাষা","ui.language_desc":"পুরো অ্যাপের প্রদর্শন ভাষা","ui.notifications":"বিজ্ঞপ্তি","ui.appearance":"চেহারা","ui.privacy":"গোপনীয়তা ও প্রদর্শন","ui.livedata":"লাইভ ডেটা","ui.profilesSec":"প্রোফাইল","ui.abouthelp":"সম্পর্কে ও সহায়তা","ui.theme_mode":"থিম মোড","ui.accent":"অ্যাকসেন্ট রঙ","ui.density":"ঘনত্ব","ui.hide_amounts":"পরিমাণ লুকান","ui.clock12":"১২-ঘণ্টা ঘড়ি","ui.default_currency":"ডিফল্ট মুদ্রা","ui.auto_refresh":"স্বয়ংক্রিয় রিফ্রেশ","ui.refresh_now":"এখন রিফ্রেশ করুন","ui.startup_profile":"স্টার্টআপ প্রোফাইল","ui.manage_profiles":"প্রোফাইল পরিচালনা","ui.user_guide":"ব্যবহারকারী গাইড","ui.reset_settings":"সেটিংস রিসেট","ui.open":"খুলুন","cat.All":"সব","cat.Overview":"সারসংক্ষেপ","cat.Research":"গবেষণা","cat.Investing":"বিনিয়োগ","cat.Real assets":"বাস্তব সম্পদ","cat.Planning":"পরিকল্পনা","cat.Tools":"টুল"},
  pt:{"Mission Control":"Centro de Controle","About Me":"Sobre mim","Profiles":"Perfis","Live Markets":"Mercados ao vivo","IPOs":"IPOs","Portfolio":"Carteira","Properties":"Propriedades","Alerts & Plans":"Alertas e planos","Favorites":"Favoritos","AI Desk":"Mesa de IA","Screeners":"Filtros","Compare":"Comparar","News":"Notícias","Funds & Bonds":"Fundos e títulos","SIPs":"SIPs","Brokers":"Corretoras","AI CFO":"CFO com IA","Guide":"Guia","ui.eyebrow":"Painel de património privado","ui.back":"Voltar","ui.search_ph":"Pesquisar: ações, fundos, ETFs, moedas…","ui.settings":"Configurações","ui.language":"Idioma","ui.language_desc":"Idioma de exibição do aplicativo","ui.notifications":"Notificações","ui.appearance":"Aparência","ui.privacy":"Privacidade e exibição","ui.livedata":"Dados ao vivo","ui.profilesSec":"Perfis","ui.abouthelp":"Sobre e ajuda","ui.theme_mode":"Modo de tema","ui.accent":"Cor de destaque","ui.density":"Densidade","ui.hide_amounts":"Ocultar valores","ui.clock12":"Relógio de 12 horas","ui.default_currency":"Moeda padrão","ui.auto_refresh":"Atualização automática","ui.refresh_now":"Atualizar agora","ui.startup_profile":"Perfil inicial","ui.manage_profiles":"Gerenciar perfis","ui.user_guide":"Guia do usuário","ui.reset_settings":"Redefinir configurações","ui.open":"Abrir","cat.All":"Tudo","cat.Overview":"Visão geral","cat.Research":"Pesquisa","cat.Investing":"Investimento","cat.Real assets":"Ativos reais","cat.Planning":"Planejamento","cat.Tools":"Ferramentas"},
  ru:{"Mission Control":"Центр управления","About Me":"Обо мне","Profiles":"Профили","Live Markets":"Рынки в реальном времени","IPOs":"IPO","Portfolio":"Портфель","Properties":"Имущество","Alerts & Plans":"Уведомления и планы","Favorites":"Избранное","AI Desk":"AI-стол","Screeners":"Скринеры","Compare":"Сравнить","News":"Новости","Funds & Bonds":"Фонды и облигации","SIPs":"SIP","Brokers":"Брокеры","AI CFO":"AI финдиректор","Guide":"Руководство","ui.eyebrow":"Панель частного капитала","ui.back":"Назад","ui.search_ph":"Поиск: акции, фонды, ETF, монеты…","ui.settings":"Настройки","ui.language":"Язык","ui.language_desc":"Язык интерфейса приложения","ui.notifications":"Уведомления","ui.appearance":"Оформление","ui.privacy":"Конфиденциальность и отображение","ui.livedata":"Данные в реальном времени","ui.profilesSec":"Профили","ui.abouthelp":"О программе и справка","ui.theme_mode":"Тема","ui.accent":"Акцентный цвет","ui.density":"Плотность","ui.hide_amounts":"Скрыть суммы","ui.clock12":"12-часовой формат","ui.default_currency":"Валюта по умолчанию","ui.auto_refresh":"Автообновление","ui.refresh_now":"Обновить сейчас","ui.startup_profile":"Профиль при запуске","ui.manage_profiles":"Управление профилями","ui.user_guide":"Руководство пользователя","ui.reset_settings":"Сбросить настройки","ui.open":"Открыть","cat.All":"Все","cat.Overview":"Обзор","cat.Research":"Исследования","cat.Investing":"Инвестиции","cat.Real assets":"Реальные активы","cat.Planning":"Планирование","cat.Tools":"Инструменты"},
  ja:{"Mission Control":"ミッションコントロール","About Me":"自己紹介","Profiles":"プロフィール","Live Markets":"ライブ市場","IPOs":"新規上場","Portfolio":"ポートフォリオ","Properties":"資産","Alerts & Plans":"アラートとプラン","Favorites":"お気に入り","AI Desk":"AIデスク","Screeners":"スクリーナー","Compare":"比較","News":"ニュース","Funds & Bonds":"ファンドと債券","SIPs":"積立投資","Brokers":"ブローカー","AI CFO":"AI CFO","Guide":"ガイド","ui.eyebrow":"プライベート資産ダッシュボード","ui.back":"戻る","ui.search_ph":"検索：株式、ファンド、ETF、暗号資産…","ui.settings":"設定","ui.language":"言語","ui.language_desc":"アプリ全体の表示言語","ui.notifications":"通知","ui.appearance":"外観","ui.privacy":"プライバシーと表示","ui.livedata":"ライブデータ","ui.profilesSec":"プロフィール","ui.abouthelp":"情報とヘルプ","ui.theme_mode":"テーマモード","ui.accent":"アクセントカラー","ui.density":"密度","ui.hide_amounts":"金額を隠す","ui.clock12":"12時間表示","ui.default_currency":"既定の通貨","ui.auto_refresh":"自動更新","ui.refresh_now":"今すぐ更新","ui.startup_profile":"起動プロフィール","ui.manage_profiles":"プロフィール管理","ui.user_guide":"ユーザーガイド","ui.reset_settings":"設定をリセット","ui.open":"開く","cat.All":"すべて","cat.Overview":"概要","cat.Research":"リサーチ","cat.Investing":"投資","cat.Real assets":"実物資産","cat.Planning":"計画","cat.Tools":"ツール"},
};
const I18N_EXTRA={
  en:{"ui.dark":"Dark","ui.light":"Light","ui.auto":"Auto","ui.comfortable":"Comfortable","ui.compact":"Compact","ui.off":"Off","ui.data_backup":"Data & backup","ui.data_backup_desc":"Export your wealth data","ui.export_backup":"Export backup","ui.export_backup_desc":"Download a private JSON copy — no passwords","ui.exported":"Backup downloaded"},
  de:{"ui.dark":"Dunkel","ui.light":"Hell","ui.auto":"Auto","ui.comfortable":"Komfortabel","ui.compact":"Kompakt","ui.off":"Aus","ui.data_backup":"Daten & Backup","ui.data_backup_desc":"Vermögensdaten exportieren","ui.export_backup":"Backup exportieren","ui.export_backup_desc":"Private JSON-Kopie herunterladen — keine Passwörter","ui.exported":"Backup heruntergeladen"},
  zh:{"ui.dark":"深色","ui.light":"浅色","ui.auto":"自动","ui.comfortable":"宽松","ui.compact":"紧凑","ui.off":"关闭","ui.data_backup":"数据与备份","ui.data_backup_desc":"导出您的财富数据","ui.export_backup":"导出备份","ui.export_backup_desc":"下载私密 JSON 副本（无密码）","ui.exported":"备份已下载"},
  hi:{"ui.dark":"डार्क","ui.light":"लाइट","ui.auto":"ऑटो","ui.comfortable":"आरामदायक","ui.compact":"सघन","ui.off":"बंद","ui.data_backup":"डेटा और बैकअप","ui.data_backup_desc":"अपना संपत्ति डेटा निर्यात करें","ui.export_backup":"बैकअप निर्यात करें","ui.export_backup_desc":"निजी JSON कॉपी डाउनलोड करें — कोई पासवर्ड नहीं","ui.exported":"बैकअप डाउनलोड हुआ"},
  es:{"ui.dark":"Oscuro","ui.light":"Claro","ui.auto":"Auto","ui.comfortable":"Cómodo","ui.compact":"Compacto","ui.off":"Apagado","ui.data_backup":"Datos y copia de seguridad","ui.data_backup_desc":"Exporta tus datos de patrimonio","ui.export_backup":"Exportar copia","ui.export_backup_desc":"Descarga una copia JSON privada — sin contraseñas","ui.exported":"Copia descargada"},
  fr:{"ui.dark":"Sombre","ui.light":"Clair","ui.auto":"Auto","ui.comfortable":"Confortable","ui.compact":"Compact","ui.off":"Désactivé","ui.data_backup":"Données et sauvegarde","ui.data_backup_desc":"Exportez vos données patrimoniales","ui.export_backup":"Exporter la sauvegarde","ui.export_backup_desc":"Télécharger une copie JSON privée — sans mots de passe","ui.exported":"Sauvegarde téléchargée"},
  ar:{"ui.dark":"داكن","ui.light":"فاتح","ui.auto":"تلقائي","ui.comfortable":"مريح","ui.compact":"مضغوط","ui.off":"إيقاف","ui.data_backup":"البيانات والنسخ الاحتياطي","ui.data_backup_desc":"تصدير بيانات ثروتك","ui.export_backup":"تصدير نسخة احتياطية","ui.export_backup_desc":"تنزيل نسخة JSON خاصة — بدون كلمات مرور","ui.exported":"تم تنزيل النسخة الاحتياطية"},
  bn:{"ui.dark":"ডার্ক","ui.light":"লাইট","ui.auto":"অটো","ui.comfortable":"আরামদায়ক","ui.compact":"কম্প্যাক্ট","ui.off":"বন্ধ","ui.data_backup":"ডেটা ও ব্যাকআপ","ui.data_backup_desc":"আপনার সম্পদ ডেটা রপ্তানি করুন","ui.export_backup":"ব্যাকআপ রপ্তানি","ui.export_backup_desc":"ব্যক্তিগত JSON কপি ডাউনলোড করুন — পাসওয়ার্ড ছাড়া","ui.exported":"ব্যাকআপ ডাউনলোড হয়েছে"},
  pt:{"ui.dark":"Escuro","ui.light":"Claro","ui.auto":"Auto","ui.comfortable":"Confortável","ui.compact":"Compacto","ui.off":"Desligado","ui.data_backup":"Dados e backup","ui.data_backup_desc":"Exporte os seus dados de património","ui.export_backup":"Exportar backup","ui.export_backup_desc":"Baixar uma cópia JSON privada — sem senhas","ui.exported":"Backup baixado"},
  ru:{"ui.dark":"Тёмная","ui.light":"Светлая","ui.auto":"Авто","ui.comfortable":"Просторно","ui.compact":"Компактно","ui.off":"Выкл","ui.data_backup":"Данные и резервная копия","ui.data_backup_desc":"Экспорт данных о капитале","ui.export_backup":"Экспортировать копию","ui.export_backup_desc":"Скачать приватную JSON-копию — без паролей","ui.exported":"Копия скачана"},
  ja:{"ui.dark":"ダーク","ui.light":"ライト","ui.auto":"自動","ui.comfortable":"快適","ui.compact":"コンパクト","ui.off":"オフ","ui.data_backup":"データとバックアップ","ui.data_backup_desc":"資産データをエクスポート","ui.export_backup":"バックアップをエクスポート","ui.export_backup_desc":"プライベートな JSON コピーをダウンロード（パスワードなし）","ui.exported":"バックアップをダウンロードしました"},
};
Object.keys(I18N_EXTRA).forEach(k=>{I18N[k]=Object.assign(I18N[k]||{},I18N_EXTRA[k]);});
function currentLang(){return (state.settings&&state.settings.lang)||"en";}
function t(key){const l=currentLang();const d=I18N[l]||{};if(key in d)return d[key];if(I18N.en&&key in I18N.en)return I18N.en[key];return key;}
function navLabel(p){return t(p);}
function initLangSelect(){const sel=byId("langSelect");if(!sel)return;sel.innerHTML=LANGS.map(L=>`<option value="${L.code}">${L.flag} ${L.native}</option>`).join("");sel.value=currentLang();}
function applyI18n(){
  const l=currentLang();
  const meta=LANGS.find(x=>x.code===l)||LANGS[0];
  try{document.documentElement.lang=l;document.documentElement.dir=meta.rtl?"rtl":"ltr";}catch(e){}
  if(document.body) document.body.classList.toggle("rtl",!!meta.rtl);
  const navEl=byId("nav");
  if(navEl) navEl.innerHTML=pages.map((p,i)=>`<button class="${p===state.currentPage?'active':''}" onclick="show('${p}',this)">${i+1}. ${escapeHtml(navLabel(p))}</button>`).join("");
  document.querySelectorAll("[data-i18n]").forEach(el=>{el.textContent=t(el.getAttribute("data-i18n"));});
  document.querySelectorAll("[data-i18n-ph]").forEach(el=>{el.setAttribute("placeholder",t(el.getAttribute("data-i18n-ph")));});
  document.querySelectorAll("[data-i18n-title]").forEach(el=>{el.setAttribute("title",t(el.getAttribute("data-i18n-title")));});
  const sel=byId("langSelect");if(sel)sel.value=l;
  if(typeof updatePageHeader==="function") updatePageHeader(state.currentPage);
  if(typeof renderGuide==="function") renderGuide();
  if(byId("settingsModal")&&byId("settingsModal").classList.contains("open")&&typeof renderSettings==="function") renderSettings();
}
function setLanguage(code){state.settings=state.settings||loadSettings();state.settings.lang=code;saveSettings();applyI18n();}
function hexToRgba(hex,a=1){
  let h=String(hex||"").trim();
  if(h.startsWith("rgb")) return h;
  h=h.replace("#","");
  if(h.length===3) h=h.split("").map(c=>c+c).join("");
  const n=parseInt(h||"4f8cff",16);
  return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`;
}
const fallbackMarkets=[
  {code:"GLOBAL",name:"Global / manual / private asset",country:"Global",currency:"EUR",suffix:"",region:"Global"},
  {code:"CRYPTO",name:"Crypto markets",country:"Crypto",currency:"EUR",suffix:"",region:"Crypto"},
  {code:"NYSE",name:"New York Stock Exchange",country:"US",currency:"USD",suffix:"",region:"North America"},
  {code:"NASDAQ",name:"Nasdaq",country:"US",currency:"USD",suffix:"",region:"North America"},
  {code:"NSE",name:"National Stock Exchange of India",country:"India",currency:"INR",suffix:".NS",region:"Asia"},
  {code:"BSE",name:"Bombay Stock Exchange",country:"India",currency:"INR",suffix:".BO",region:"Asia"},
  {code:"XETRA",name:"Deutsche Borse Xetra",country:"Germany",currency:"EUR",suffix:".DE",region:"Europe"},
  {code:"LSE",name:"London Stock Exchange",country:"UK",currency:"GBP",suffix:".L",region:"Europe"},
  {code:"TSE",name:"Tokyo Stock Exchange",country:"Japan",currency:"JPY",suffix:".T",region:"Asia"},
  {code:"HKEX",name:"Hong Kong Exchange",country:"Hong Kong",currency:"HKD",suffix:".HK",region:"Asia"},
  {code:"ASX",name:"Australian Securities Exchange",country:"Australia",currency:"AUD",suffix:".AX",region:"Oceania"}
];
const demo={
  profiles:[
    {id:"me",name:"Yogesh",relation:"Self",country:"Germany",avatar:"YN",photo_url:"",net_worth:541625},
    {id:"father",name:"Father",relation:"Father",country:"India",avatar:"FT",photo_url:"",net_worth:283193},
    {id:"mother",name:"Mother",relation:"Mother",country:"India",avatar:"MT",photo_url:"",net_worth:0},
    {id:"sister",name:"Sister",relation:"Sister",country:"India",avatar:"SR",photo_url:"",net_worth:375026}
  ],
  holdings:[
    {symbol:"NVDA",name:"Nvidia",qty:12,avg:98,price:142.8,currency:"USD",value:1713.6,value_eur:1580,cost_eur:1082,pl_eur:498,pl_pct:46.0,day:3.4,week:7.2,month:18.1,year:165,source:"Demo fallback",broker:"IBKR"},
    {symbol:"AAPL",name:"Apple",qty:8,avg:170,price:212.4,currency:"USD",value:1699.2,value_eur:1567,cost_eur:1251,pl_eur:316,pl_pct:25.3,day:-0.8,week:1.5,month:4.2,year:20.4,source:"Demo fallback",broker:"Trading 212"},
    {symbol:"VUAA",name:"S&P 500 UCITS ETF",qty:42,avg:82,price:105.2,currency:"EUR",value:4418,value_eur:4418,cost_eur:3444,pl_eur:974,pl_pct:28.3,day:.7,week:1.8,month:5,year:18,source:"Demo fallback",broker:"Scalable Capital"},
    {symbol:"BTC",name:"Bitcoin",qty:.05,avg:60000,price:89000,currency:"EUR",value:4450,value_eur:4450,cost_eur:3000,pl_eur:1450,pl_pct:48.3,day:2.8,week:5.2,month:12.5,year:86,source:"Demo fallback",broker:"Coinbase"}
  ],
  properties:[
    {id:1,name:"Future Germany House Goal",location:"Bavaria, Germany",currency:"EUR",value_eur:520000,rent:0},
    {id:2,name:"Family Flat Indore",location:"Indore, India",currency:"INR",value_eur:74800,rent:18000}
  ],
  cashflow:[
    {category:"Salary",type:"income",amount:5800,currency:"EUR"},
    {category:"Rent",type:"expense",amount:1250,currency:"EUR"},
    {category:"Groceries",type:"expense",amount:420,currency:"EUR"},
    {category:"Investments",type:"investment",amount:1900,currency:"EUR"}
  ],
  alerts:[{id:1,symbol:"NVDA",condition:"above",target:150,status:"active"},{id:2,symbol:"BTC",condition:"above",target:95000,status:"active"}],
  savings:[{id:1,name:"Emergency Fund",target:25000,current:18500,currency:"EUR",monthly:700,progress:74,months_left:9,priority:"High"},{id:2,name:"House Down Payment",target:120000,current:22000,currency:"EUR",monthly:1200,progress:18.3,months_left:82,priority:"High"}],
  cash:[{id:1,name:"Main Bank Cash",balance:8500,currency:"EUR",balance_eur:8500,type:"Checking"},{id:2,name:"Emergency Cash",balance:10000,currency:"EUR",balance_eur:10000,type:"Savings"}]
};

nav.innerHTML=pages.map((p,i)=>`<button class="${i==0?'active':''}" onclick="show('${p}',this)">${i+1}. ${escapeHtml(navLabel(p))}</button>`).join("");

function show(p,b){
  state.currentPage=p;
  document.querySelectorAll(".page").forEach(x=>x.classList.remove("active"));
  const page=document.getElementById(p);
  if(page) page.classList.add("active");
  document.querySelectorAll(".nav button").forEach(x=>x.classList.remove("active"));
  if(b) b.classList.add("active");
  updatePageHeader(p);
  updateBackButton();
  if(p==="AI CFO" && typeof cfoGreet==="function") cfoGreet();
  if(p==="About Me" && typeof loadAboutMe==="function") loadAboutMe();
  if(p==="SIPs" && typeof loadSips==="function") loadSips();
  if(p==="AI Desk" && typeof loadAiDesk==="function"){ if(state.aiDesk) renderAiDesk(); else loadAiDesk(); }
  window.scrollTo({top:0,left:0,behavior:"auto"});
  setTimeout(()=>Object.values(state.charts).forEach(c=>c.resize && c.resize()),100);
}
/* ===== Reusable premium confirm dialog (replaces native confirm) ===== */
let _confirmResolver=null;
function uiConfirm(opts={}){
  return new Promise(res=>{
    const m=byId("confirmModal");
    if(!m){res(window.confirm(opts.message||opts.title||"Are you sure?"));return;}
    _confirmResolver=res;
    byId("confirmTitle").textContent=opts.title||"Are you sure?";
    byId("confirmMessage").textContent=opts.message||"";
    byId("confirmIcon").textContent=opts.icon||"⚠️";
    const ok=byId("confirmOkBtn");
    ok.textContent=opts.confirmText||"Confirm";
    ok.className="btn "+(opts.danger===false?"":"danger");
    byId("confirmCancelBtn").textContent=opts.cancelText||"Cancel";
    m.classList.add("open");
    setTimeout(()=>ok.focus(),60);
  });
}
function closeConfirm(val){
  byId("confirmModal")?.classList.remove("open");
  const r=_confirmResolver; _confirmResolver=null;
  if(r) r(!!val);
}
document.addEventListener("keydown",e=>{
  if(e.key!=="Escape") return;
  if(byId("confirmModal")?.classList.contains("open")) closeConfirm(false);
  else if(byId("deskTrackModal")?.classList.contains("open")) closeDeskTrack();
});
function goBack(){
  if(state.currentPage==="Live Markets" && (byId("marketExchange")?.value||"ALL")!=="ALL"){
    showExchangeFinder("marketCalendarPanel");
    return;
  }
  if(state.currentPage==="Asset Detail" && byId("assetDetail")){
    assetDetail.innerHTML=`<div class="aiBox">Use the search bar above to preview a stock, fund, ETF, coin, or asset. Back stays inside this tab now.</div>`;
  }
  updateBackButton();
}
function hasLocalBack(){
  if(state.currentPage==="Live Markets" && (byId("marketExchange")?.value||"ALL")!=="ALL") return true;
  if(state.currentPage==="Asset Detail"){
    const html=String(byId("assetDetail")?.innerHTML||"").trim();
    return html && !html.includes("Back stays inside this tab now.");
  }
  return false;
}
function updateBackButton(){
  const back=byId("backBtn");
  if(back) back.style.display=hasLocalBack()?"inline-flex":"none";
}
function localTimeZone(){
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}
function localLocale(){
  return navigator.language || (navigator.languages||[])[0] || "en-US";
}
function greetingLanguage(){
  const zone=localTimeZone().toLowerCase();
  const locale=localLocale().toLowerCase();
  if(locale.startsWith("hi") || zone.includes("kolkata") || zone.includes("calcutta")) return "hi";
  if(locale.startsWith("de") || zone.includes("berlin") || zone.includes("vienna") || zone.includes("zurich")) return "de";
  return "en";
}
function greetingPeriod(now=new Date()){
  const zone=localTimeZone();
  const hour=Number(new Intl.DateTimeFormat("en-US",{hour:"2-digit",hour12:clockHour12(),timeZone:zone}).format(now));
  const lang=greetingLanguage();
  const phrases={
    en:["good morning","good afternoon","good evening","good night"],
    de:["guten Morgen","guten Nachmittag","guten Abend","gute Nacht"],
    hi:["सुप्रभात","नमस्कार","शुभ संध्या","शुभ रात्रि"]
  }[lang] || ["good morning","good afternoon","good evening","good night"];
  if(hour < 12) return phrases[0];
  if(hour < 17) return phrases[1];
  if(hour < 21) return phrases[2];
  return phrases[3];
}
function greetingPrefix(){
  const lang=greetingLanguage();
  if(lang==="de") return "Hallo";
  if(lang==="hi") return "नमस्ते";
  return "Hello";
}
function formatZoneTime(zone,now=new Date()){
  try{
    return new Intl.DateTimeFormat(localLocale(),{timeZone:zone,hour:"2-digit",minute:"2-digit",hour12:clockHour12()}).format(now);
  }catch(e){
    return "--:--";
  }
}
function localZoneLabel(){
  return localTimeZone().split("/").pop().replaceAll("_"," ");
}
function worldClockText(){
  const now=new Date();
  const zones=[
    [`Local (${localZoneLabel()})`,localTimeZone()],
    ["US West","America/Los_Angeles"],["US East","America/New_York"],["Brazil","America/Sao_Paulo"],
    ["UK","Europe/London"],["Europe","Europe/Berlin"],["UAE","Asia/Dubai"],
    ["India","Asia/Kolkata"],["China","Asia/Shanghai"],["Singapore","Asia/Singapore"],
    ["Japan","Asia/Tokyo"],["Australia","Australia/Sydney"],["UTC","UTC"]
  ];
  return zones.map(([label,zone])=>`${label} ${formatZoneTime(zone,now)}`).join(" • ");
}
function localClockText(now=new Date()){
  try{
    const zone=localTimeZone();
    const time=new Intl.DateTimeFormat(localLocale(),{timeZone:zone,hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:clockHour12()}).format(now);
    const date=new Intl.DateTimeFormat(localLocale(),{timeZone:zone,weekday:"long",day:"2-digit",month:"short",year:"numeric"}).format(now);
    return `${date} · ${time} · ${localZoneLabel()}`;
  }catch(e){
    return "";
  }
}
function tickLocalClock(){
  const el=byId("liveClock");
  if(!el) return;
  if(state.currentPage==="Mission Control"){
    el.style.display="flex";
    const timeEl=byId("liveClockTime");
    const dateEl=byId("liveClockMeta");
    const now=new Date();
    const zone=localTimeZone();
    if(timeEl && dateEl){
      try{
        timeEl.textContent=new Intl.DateTimeFormat(localLocale(),{timeZone:zone,hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:clockHour12()}).format(now);
        dateEl.textContent=`${new Intl.DateTimeFormat(localLocale(),{timeZone:zone,weekday:"long",day:"2-digit",month:"short",year:"numeric"}).format(now)} · ${localZoneLabel()}`;
      }catch(e){
        timeEl.textContent="--:--:--";
        dateEl.textContent="";
      }
    }else{
      el.textContent=localClockText(now);
    }
  }else{
    el.style.display="none";
  }
}
function fmtCountdown(mins){
  mins=Math.max(0,Math.round(Number(mins)||0));
  const d=Math.floor(mins/1440), h=Math.floor((mins%1440)/60), m=mins%60;
  if(d>0) return `${d}d ${h}h ${m}m`;
  if(h>0) return `${h}h ${m}m`;
  return `${m}m`;
}
async function loadMarketStatus(){
  try{
    state.marketStatus=await get("/market-status");
  }catch(e){
    state.marketStatus=null;
  }
  renderMarketStatus();
}
function renderMarketStatus(){
  const statusEl=byId("sideStatus");
  const dot=byId("marketDot");
  const openEl=byId("marketStatusOpen");
  const nextEl=byId("marketStatusNext");
  if(!statusEl) return;
  const s=state.marketStatus;
  const now=Date.now();
  if(!s){
    statusEl.textContent="Unknown";
    statusEl.className="sideValue closed";
    if(dot) dot.className="marketDot closed";
    if(openEl) openEl.innerHTML="";
    if(nextEl) nextEl.innerHTML="";
    return;
  }
  if(s.any_open && s.open_markets && s.open_markets.length){
    statusEl.textContent="Markets Open";
    statusEl.className="sideValue open";
    if(dot) dot.className="marketDot open";
    const lead=s.open_markets[0];
    const codes=s.open_markets.slice(0,4).map(m=>escapeHtml(m.code)).join(", ");
    const extra=s.open_count>4?` <span class="msMeta">+${s.open_count-4} more</span>`:"";
    const closesMins=(new Date(lead.close_utc).getTime()-now)/60000;
    if(openEl) openEl.innerHTML=`<b>${codes}</b>${extra} trading now`
      +`<br><span class="msMeta">${escapeHtml(lead.code)} · ${escapeHtml(lead.name)}</span>`
      +`<br><span class="msMeta">${escapeHtml(lead.local_session)} · closes in ${fmtCountdown(closesMins)}</span>`;
  }else{
    statusEl.textContent="Markets Closed";
    statusEl.className="sideValue closed";
    if(dot) dot.className="marketDot closed";
    if(openEl) openEl.innerHTML=`<span class="msMeta">All tracked stock exchanges are closed right now. Crypto trades 24/7.</span>`;
  }
  if(s.next_open && nextEl){
    const opensMins=(new Date(s.next_open.opens_at_utc).getTime()-now)/60000;
    nextEl.innerHTML=`Next open: <b>${escapeHtml(s.next_open.code)}</b> (${escapeHtml(s.next_open.country)}) in <b>${fmtCountdown(opensMins)}</b>`
      +`<br><span class="msMeta">${escapeHtml(s.next_open.local_open)} · ${escapeHtml(s.next_open.local_session)}</span>`;
  }else if(nextEl){
    nextEl.innerHTML="";
  }
}
function gIcon(p){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+p+'</svg>';}
const GUIDE_MODULES=[
  {page:"Mission Control",cat:"Overview",color:"#4f8cff",tagline:"Your at-a-glance wealth headquarters.",icon:gIcon('<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>'),points:["Total net worth with daily move, savings rate & wealth score","Projection, asset-mix, geography, sector & performance charts","Live local clock + world market clocks","Switch display currency on the fly"]},
  {page:"Profiles",cat:"Overview",color:"#a78bfa",tagline:"Manage the whole family in one app.",icon:gIcon('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),points:["Create a profile per family member with a photo","Each profile has its own holdings, property, cash & goals","Lock sensitive profiles with a password","Switch profiles from the top-right menu"]},
  {page:"About Me",cat:"Overview",color:"#f472b6",tagline:"Your founder story, in one place.",icon:gIcon('<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>'),points:["Photo, headline, role & company","Focus areas, interests & a milestones timeline","A motto, phone, email & social links","Live wealth-at-a-glance snapshot"]},
  {page:"Live Markets",cat:"Research",color:"#22d3ee",tagline:"Track the world's exchanges in real time.",icon:gIcon('<path d="M3 3v18h18"/><path d="m7 14 4-4 3 3 5-6"/>'),points:["Top 50 gainers & losers by day","Global top stocks: US, EU, India, China, crypto, gold","Market calendar: sessions & holidays for 55+ exchanges","Plain-English reason for why each asset moved"]},
  {page:"IPOs",cat:"Research",color:"#22d3ee",tagline:"Upcoming and recently listed public issues.",icon:gIcon('<path d="M12 2v20"/><path d="m5 9 7-7 7 7"/><path d="M5 15h14"/>'),points:["Upcoming IPO calendar & recently listed","Price band, deal size and expected date","Filter by exchange, search by company or sector","Official exchange links for each issue"]},
  {page:"Portfolio",cat:"Investing",color:"#34d399",tagline:"Add, edit and value every holding.",icon:gIcon('<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><path d="M2 13h20"/>'),points:["Add stocks, ETFs, funds, crypto & gold by name","Track cashflow: income, expense & investment","Record cash-in-hand accounts in any currency","Live P/L, broker split and portfolio mix"]},
  {page:"Properties",cat:"Real assets",color:"#f59e0b",tagline:"Real estate, gold, silver & vehicles.",icon:gIcon('<path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9"/><path d="M9 20v-6h6v6"/>'),points:["Location-aware valuation using maps & nearby amenities","Auto-currency from the address you type","Forecast value, rental yield & carrying cost","Sell or gift an asset with a tax estimate"]},
  {page:"Alerts & Plans",cat:"Planning",color:"#ef4444",tagline:"Watch prices and hit your goals.",icon:gIcon('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>'),points:["Price alerts above or below a target","Savings plans with progress & months-left","Prioritise goals as High / Medium / Low","See triggered alerts at a glance"]},
  {page:"Favorites",cat:"Research",color:"#f472b6",tagline:"A deep-watch list of what you love.",icon:gIcon('<path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>'),points:["Star any asset for focused tracking","Sort by AI opportunity, ROI or near-year-low","Estimate returns on a chosen invest amount","Filter by type, market and performance"]},
  {page:"Screeners",cat:"Research",color:"#4f8cff",tagline:"Follow the smart money.",icon:gIcon('<path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/>'),points:["Live insider-trading buys & sales","Top-10% owner and fund-flow screens","Bullish / bearish technical screens","Filter by sector, market and transaction value"]},
  {page:"Compare",cat:"Research",color:"#22d3ee",tagline:"Put assets head-to-head.",icon:gIcon('<line x1="6" y1="20" x2="6" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="18" y1="20" x2="18" y2="14"/>'),points:["Add assets one by one to a basket","Score by AI rating, 1Y/1M return or your P/L","Add a manual asset if search misses it","Visual side-by-side chart & table"]},
  {page:"News",cat:"Research",color:"#94a3b8",tagline:"Market news that matters to you.",icon:gIcon('<path d="M4 4h13v16H4z"/><path d="M17 8h3v9a3 3 0 0 1-3 3"/><line x1="7" y1="8" x2="14" y2="8"/><line x1="7" y1="12" x2="14" y2="12"/><line x1="7" y1="16" x2="11" y2="16"/>'),points:["Portfolio news scoped to your holdings","Top, world, area, sector & industry feeds","Search news for any stock, fund or coin","Clickable, sourced article cards"]},
  {page:"Funds & Bonds",cat:"Investing",color:"#34d399",tagline:"India mutual funds & bonds explorer.",icon:gIcon('<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.66 3.58 3 8 3s8-1.34 8-3V6"/><path d="M4 12v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6"/>'),points:["Search any AMC: SBI, ICICI, HDFC, Axis…","Live NAV trend and category & risk labels","1Y / 3Y returns, expense ratio and yield","Add a fund straight to your portfolio"]},
  {page:"SIPs",cat:"Investing",color:"#34d399",tagline:"SIPs, lumpsums & fixed deposits, tracked live.",icon:gIcon('<path d="M3 17l6-6 4 4 7-7"/><path d="M14 5h6v6"/>'),points:["Recurring SIPs & one-time lumpsums on live AMFI NAV","Simulated units, current value, returns & XIRR","Bulk-import many SIPs from a CSV","Fixed Deposits with maturity, interest & net-worth roll-up"]},
  {page:"AI Desk",cat:"Investing",color:"#a78bfa",tagline:"A six-agent investing desk that grades itself.",icon:gIcon('<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 9h8M8 13h5"/><path d="M9 2h6"/>'),points:["Scout, Analyst, Strategist, Advisor, Tracker & Rater agents","Buy calls with entry / target / stop & risk-reward","“I bought this — track it” logs a real, measured call","Self-grading scorecard: hit-rate, win/loss & best calls"]},
  {page:"Asset Detail",cat:"Research",color:"#a78bfa",tagline:"Everything about one asset.",icon:gIcon('<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>'),points:["Day / week / month / year performance","Movement explanation & analyst-style view","Fundamentals, dividends and news links","1D / 1M / 1Y interactive price charts"]},
  {page:"Brokers",cat:"Tools",color:"#f59e0b",tagline:"Connections & beneficiary records.",icon:gIcon('<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>'),points:["Status for Trading 212, IBKR, Zerodha, Coinbase…","Read-only sync where keys/gateway are set","Store beneficiary & recovery info — never passwords","Guidance for CSV / import workflows"]},
  {page:"AI CFO",cat:"Tools",color:"#f472b6",tagline:"Ask about your money.",icon:gIcon('<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/><path d="m6 6 2 2M16 16l2 2M18 6l-2 2M8 16l-2 2"/>'),points:["Plain-language summary of your finances","Highlights what changed in your portfolio","Educational guidance, not advice","Quick context for decisions"]},
];
const GUIDE_STATS=[
  {big:"18",label:"Smart modules"},
  {big:"55+",label:"World exchanges tracked"},
  {big:"40+",label:"Currencies converted live"},
  {big:"100%",label:"Private, local-first data"},
];
const GUIDE_HIGHLIGHTS=[
  {color:"#22d3ee",title:"Live market status",text:"See which exchanges are open right now, their hours, and a live countdown to the next market opening.",icon:gIcon('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>')},
  {color:"#4f8cff",title:"Real-time world clock",text:"A ticking local clock with seconds plus major financial cities, right on Mission Control.",icon:gIcon('<circle cx="12" cy="12" r="9"/><path d="M12 8v4l2.5 2.5"/>')},
  {color:"#34d399",title:"Multi-currency net worth",text:"View everything in EUR, INR, USD, GBP and more — converted with live exchange rates.",icon:gIcon('<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 5 2M9 13a3 3 0 0 0 5 2M12 7v10"/>')},
  {color:"#f59e0b",title:"Location intelligence",text:"Properties are valued using maps, nearby hospitals, schools, transit and comparable rates.",icon:gIcon('<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>')},
  {color:"#a78bfa",title:"Privacy-first",text:"No broker passwords are ever stored. Lock profiles and keep all data in your own file.",icon:gIcon('<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>')},
  {color:"#f472b6",title:"Always-on",text:"If a data source is unreachable, a demo fallback keeps the dashboard fully usable.",icon:gIcon('<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/>')},
  {color:"#a78bfa",title:"Self-grading AI Desk",text:"Six AI agents issue buy calls with a plan, track them against your real entry, and tune their own scoring toward what actually works.",icon:gIcon('<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 9h8M8 13h5"/>')},
  {color:"#34d399",title:"Live SIP, FD & metal tracking",text:"Mutual-fund SIPs price off real AMFI NAV, fixed deposits compound to maturity, and gold/silver value off live spot — all rolled into net worth.",icon:gIcon('<path d="M3 17l6-6 4 4 7-7"/><path d="M14 5h6v6"/>')},
  {color:"#22d3ee",title:"11 world languages",text:"Switch the whole interface between English, Deutsch, 中文, हिन्दी, Español, Français, العربية (RTL), বাংলা, Português, Русский and 日本語 — from the top bar or Settings.",icon:gIcon('<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18z"/>')},
];
const GUIDE_KEYWORDS={
  "Mission Control":"dashboard home overview networth net worth summary kpi clock currency projection",
  "Profiles":"family members users people switch accounts relatives kids parents",
  "Live Markets":"exchange exchanges stocks movers gainers losers calendar holidays sessions nse bse nasdaq",
  "Portfolio":"holdings stocks etf crypto cashflow income expense cash accounts brokers",
  "Properties":"property properties real estate house flat land plot apartment gold silver car vehicle valuation rent tax sell gift mortgage loan",
  "Alerts & Plans":"alert alerts price notification savings goals targets plan plans reminders",
  "Favorites":"watchlist watch list starred favourite favorites bookmarks",
  "Screeners":"screener insider smart money technical macd rsi sector institutional funds",
  "Compare":"compare comparison versus head to head basket benchmark",
  "News":"news articles headlines feed media press",
  "Funds & Bonds":"mutual fund funds bond bonds nav amc sip india sbi icici hdfc axis nippon debt gilt",
  "Asset Detail":"asset stock detail chart fundamentals analyst dividend research",
  "Brokers":"broker brokers connection sync beneficiary trading212 ibkr zerodha coinbase groww scalable api csv import market data keys",
  "AI CFO":"ai cfo assistant ask question advice chat insight",
  "About Me":"about me founder profile bio photo headline milestones interests motto contact social links story",
  "IPOs":"ipo ipos initial public offering listing listings new issue price band deal size upcoming",
  "SIPs":"sip sips lumpsum mutual fund nav amfi xirr returns fixed deposit fd maturity interest recurring monthly",
  "AI Desk":"ai desk investment agents scout analyst strategist advisor tracker rater scorecard buy call entry target stop track",
};
function setGuideCat(cat){state.guideCat=cat;renderGuide();}
function renderGuide(){
  const grid=byId("guideGrid");
  if(!grid) return;
  const statsEl=byId("guideStats");
  if(statsEl) statsEl.innerHTML=GUIDE_STATS.map(s=>`<div class="guideStat"><b>${escapeHtml(s.big)}</b><span>${escapeHtml(s.label)}</span></div>`).join("");
  const hiEl=byId("guideHighlights");
  if(hiEl) hiEl.innerHTML=GUIDE_HIGHLIGHTS.map(h=>`<div class="guideHi"><span class="guideHiIcon" style="--gc:${h.color}">${h.icon}</span><div><b>${escapeHtml(h.title)}</b><p>${escapeHtml(h.text)}</p></div></div>`).join("");
  const cats=["All",...Array.from(new Set(GUIDE_MODULES.map(m=>m.cat)))];
  const active=state.guideCat||"All";
  const pillsEl=byId("guidePills");
  if(pillsEl){
    pillsEl.innerHTML=cats.map(c=>`<button class="guidePill${c===active?" active":""}" data-cat="${escAttr(c)}">${escapeHtml(t("cat."+c))}</button>`).join("");
    pillsEl.querySelectorAll(".guidePill").forEach(b=>b.addEventListener("click",()=>setGuideCat(b.dataset.cat)));
  }
  const term=(byId("guideSearch")?.value||"").trim().toLowerCase();
  const rows=GUIDE_MODULES.filter(m=>{
    if(active!=="All" && m.cat!==active) return false;
    if(!term) return true;
    const hay=`${m.page} ${m.cat} ${m.tagline} ${m.points.join(" ")} ${GUIDE_KEYWORDS[m.page]||""}`.toLowerCase();
    return hay.includes(term);
  });
  if(!rows.length){
    grid.innerHTML=`<div class="guideEmpty">No module matches “${escapeHtml(term)}”. Try another word or pick a different category.</div>`;
    return;
  }
  grid.innerHTML=rows.map(m=>`<button class="guideCard" data-page="${escAttr(m.page)}" style="--gc:${m.color}">
    <div class="guideCardTop"><span class="guideCardIcon">${m.icon}</span><span class="guideCardCat">${escapeHtml(t("cat."+m.cat))}</span></div>
    <h4>${escapeHtml(navLabel(m.page))}</h4>
    <p class="guideCardTag">${escapeHtml(m.tagline)}</p>
    <ul>${m.points.map(p=>`<li>${escapeHtml(p)}</li>`).join("")}</ul>
    <span class="guideCardOpen">${escapeHtml(t("ui.open"))} ${escapeHtml(navLabel(m.page))} →</span>
  </button>`).join("");
  grid.querySelectorAll(".guideCard").forEach(c=>c.addEventListener("click",()=>show(c.dataset.page)));
}
/* ===== Settings ===== */
const SETTINGS_KEY="wealthos_settings";
/* Persisted UI preferences (currency, profile-tab currency, active profile) so the
   choices you make survive a page refresh. */
const PREFS_KEY="wealthos_prefs";
function loadPrefs(){ try{return JSON.parse(localStorage.getItem(PREFS_KEY)||"{}")||{};}catch(e){return {};} }
function savePref(k,v){ try{const p=loadPrefs();p[k]=v;localStorage.setItem(PREFS_KEY,JSON.stringify(p));}catch(e){} }
/* ===== First-run welcome / onboarding wizard ===== */
const ONB_COUNTRIES=["India","US","UK","Germany","France","Switzerland","UAE","Singapore","Canada","Australia","Other"];
function maybeShowOnboarding(){
  if(loadPrefs().onboarded) return;
  const cur=byId("onbCurrency");
  if(cur && !cur.options.length) cur.innerHTML=["EUR","INR","USD","GBP","CHF","AED","SGD","JPY","CAD","AUD"].map(c=>`<option ${c===(state.displayCurrency||"EUR")?"selected":""}>${c}</option>`).join("");
  const ctry=byId("onbCountry");
  if(ctry && !ctry.options.length) ctry.innerHTML=ONB_COUNTRIES.map(c=>`<option ${c==="India"?"selected":""}>${c}</option>`).join("");
  const lang=byId("onbLang");
  if(lang && !lang.options.length && typeof LANGS!=="undefined") lang.innerHTML=LANGS.map(L=>`<option value="${L.code}" ${L.code===(typeof currentLang==="function"?currentLang():"en")?"selected":""}>${L.flag} ${L.native}</option>`).join("");
  state.onb={risk:"balanced",goal:"grow"};   // sensible defaults (pre-selected chips)
  onbErr(""); onboardGo(1);
  byId("onboardModal")?.classList.add("open");
}
function onboardGo(step){
  document.querySelectorAll("#onboardModal .onbStep").forEach(s=>{ s.style.display=(String(s.dataset.step)===String(step))?"":"none"; });
  const bar=byId("onbBar"); if(bar) bar.style.width=(step*20)+"%";
  onbErr("");
}
function onbPick(group,val,el){
  state.onb=state.onb||{}; state.onb[group]=val;
  const cls=group==="use"?".onbChoice":".onbChip";
  el.parentElement.querySelectorAll(cls).forEach(c=>c.classList.remove("sel"));
  el.classList.add("sel"); onbErr("");
}
function onbErr(msg){ const e=byId("onbError"); if(e){ e.textContent=msg||""; e.style.display=msg?"block":"none"; } }
function onbValidName(){ const n=(byId("onbName")?.value||"").trim(); return n.length>=2 && n.length<=40 && !/[<>{}]/.test(n); }
function onbValidEmail(){ const v=(byId("onbEmail")?.value||"").trim(); return !v || (v.length<=80 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)); }
function onbCountrySync(){
  const map={India:"INR",US:"USD",UK:"GBP",Germany:"EUR",France:"EUR",Switzerland:"CHF",UAE:"AED",Singapore:"SGD",Canada:"CAD",Australia:"AUD"};
  const c=byId("onbCountry")?.value, cur=byId("onbCurrency");
  if(cur && map[c]) cur.value=map[c];
}
function onbNextFrom(step){
  onbErr("");
  if(step===2){ if(!(state.onb&&state.onb.use)) return onbErr("Please choose who this is for to continue."); onboardGo(3); }
  else if(step===3){
    if(!onbValidName()) return onbErr("Please enter your name (2–40 characters, no symbols like < >).");
    if(!onbValidEmail()) return onbErr("That email doesn't look right — fix it or leave it blank.");
    onboardGo(4);
  }
  else if(step===4){ onbBuildSummary(); onboardGo(5); }
}
function onbBuildSummary(){
  const box=byId("onbSummary"); if(!box) return;
  const o=state.onb||{};
  const name=(byId("onbName")?.value||"").trim(), email=(byId("onbEmail")?.value||"").trim();
  const tracks=[...document.querySelectorAll("#onboardModal .onbTracks input:checked")].map(c=>c.parentElement.textContent.trim());
  const cap=s=>s?s.charAt(0).toUpperCase()+s.slice(1):"-";
  const useLbl={personal:"Just me",family:"My family",business:"My business"}[o.use]||"-";
  const goalLbl={grow:"Grow wealth",retire:"Retirement",house:"Buy a house",education:"Kids' education",income:"Passive income"}[o.goal]||"-";
  const row=(k,v)=>`<div class="onbSumRow"><span>${k}</span><b>${escapeHtml(String(v))}</b></div>`;
  box.innerHTML=row("Name",name)+(email?row("Email",email):"")+row("For",useLbl)+row("Country",byId("onbCountry")?.value||"-")+row("Currency",byId("onbCurrency")?.value||"-")+row("Risk",cap(o.risk))+row("Goal",goalLbl)+row("Tracking",tracks.join(", ")||"-");
}
function countryForCurrency(cur){
  return {INR:"India",USD:"US",GBP:"UK",EUR:"Germany",CHF:"Switzerland",AED:"UAE",SGD:"Singapore",JPY:"Japan",CAD:"Canada",AUD:"Australia"}[(cur||"").toUpperCase()]||"";
}
async function finishOnboarding(){
  // Setup is mandatory — re-validate everything before creating the profile.
  if(!(state.onb&&state.onb.use)){ onboardGo(2); return onbErr("Please choose who this is for."); }
  if(!onbValidName()){ onboardGo(3); return onbErr("Please enter your name to create your profile."); }
  if(!onbValidEmail()){ onboardGo(3); return onbErr("That email doesn't look right — fix it or leave it blank."); }
  const o=state.onb||{};
  const name=byId("onbName").value.trim();
  const email=(byId("onbEmail")?.value||"").trim();
  const cur=byId("onbCurrency")?.value;
  const country=byId("onbCountry")?.value||countryForCurrency(cur)||"Germany";
  const lang=byId("onbLang")?.value;
  const tracks=[...document.querySelectorAll("#onboardModal .onbTracks input:checked")].map(c=>c.value);
  // Create a BRAND-NEW profile for this user and land on it. The existing owner/admin
  // profile (e.g. Yogesh) is never touched.
  let created=null;
  try{ created=await post("/profiles",{name,country,relation:"Self"}); }
  catch(e){ onboardGo(3); return onbErr((e&&e.message)||"That name is taken — please choose a different name."); }
  if(cur){ state.settings.currency=cur; state.displayCurrency=cur; savePref("displayCurrency",cur); saveSettings(); if(byId("displayCurrency")) byId("displayCurrency").value=cur; }
  if(lang && typeof setLanguage==="function") setLanguage(lang);
  savePref("usageType",o.use); savePref("tracks",tracks); savePref("ownerName",name);
  savePref("ownerEmail",email); savePref("riskAppetite",o.risk||"balanced"); savePref("primaryGoal",o.goal||"grow");
  if(created&&created.id){ state.profile=created.id; setSoleUnlocked(created.id); savePref("activeProfile",created.id); }
  savePref("onboarded",true);
  byId("onboardModal")?.classList.remove("open");
  showToast(`✓ Welcome, ${name}! Your own profile is ready.`,"success");
  try{ await loadAll(); }catch(e){}
}
function replayOnboarding(){ savePref("onboarded",false); if(typeof closeSettings==="function") closeSettings(); maybeShowOnboarding(); }
const SETTINGS_DEFAULTS={theme:"dark",accent:"#4f8cff",currency:"EUR",privacy:false,clock12:false,refresh:120,defaultProfile:"auto",density:"comfortable",lang:"en"};
function clockHour12(){return !!(state.settings&&state.settings.clock12);}
function loadSettings(){
  let saved={};
  try{saved=JSON.parse(localStorage.getItem(SETTINGS_KEY)||"{}")||{};}catch(e){saved={};}
  state.settings={...SETTINGS_DEFAULTS,...saved};
  return state.settings;
}
function saveSettings(){
  try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(state.settings));}catch(e){}
}
function applyTheme(){
  const mode=state.settings.theme;
  let light=mode==="light";
  if(mode==="auto"){
    light=window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches;
    if(window.matchMedia && !state._themeListener){
      state._themeListener=true;
      try{window.matchMedia("(prefers-color-scheme: light)").addEventListener("change",()=>{if(state.settings.theme==="auto")applyTheme();});}catch(e){}
    }
  }
  document.body.classList.toggle("light",light);
}
function applyAccent(){
  document.documentElement.style.setProperty("--blue",state.settings.accent||"#4f8cff");
}
function applyPrivacy(){
  document.body.classList.toggle("privacyMode",!!state.settings.privacy);
}
function applyDensity(){
  document.body.classList.toggle("compact",state.settings.density==="compact");
}
function applyRefresh(){
  if(state.refreshTimer) clearInterval(state.refreshTimer);
  const sec=Number(state.settings.refresh)||0;
  if(sec>0) state.refreshTimer=setInterval(loadAll,sec*1000);
}
function applyCurrencyDefault(){
  // Prefer the currency the user last chose (persisted), then the settings default.
  const saved=loadPrefs().displayCurrency;
  const cur=saved||state.settings.currency;
  if(cur){
    state.displayCurrency=cur;
    if(byId("displayCurrency")) byId("displayCurrency").value=state.displayCurrency;
    if(typeof renderDashboardCurrency==="function" && state.lastDashboard){renderDashboardCurrency();renderHoldings();renderPropertiesTable();}
  }
}
function applySettings(){
  applyTheme();applyAccent();applyPrivacy();applyDensity();applyRefresh();applyCurrencyDefault();
  if(typeof tickLocalClock==="function") tickLocalClock();
  if(typeof initLangSelect==="function") initLangSelect();
  if(typeof applyI18n==="function") applyI18n();
  updatePageHeader(state.currentPage);
}
function toggleTheme(){
  state.settings=state.settings||loadSettings();
  const nowLight=document.body.classList.contains("light");
  state.settings.theme=nowLight?"dark":"light";
  saveSettings();applyTheme();
  if(typeof renderSettings==="function" && byId("settingsModal")?.classList.contains("open")) renderSettings();
  loadAll();
}
function updateSetting(key,val){
  state.settings[key]=val;
  saveSettings();
  if(key==="theme"){applyTheme();loadAll();}
  else if(key==="accent") applyAccent();
  else if(key==="privacy") applyPrivacy();
  else if(key==="density") applyDensity();
  else if(key==="refresh") applyRefresh();
  else if(key==="currency") applyCurrencyDefault();
  else if(key==="clock12"){tickLocalClock();updatePageHeader(state.currentPage);}
  else if(key==="lang"){applyI18n();return;}
  renderSettings();
}
function resetSettings(){
  state.settings={...SETTINGS_DEFAULTS};
  saveSettings();applySettings();loadAll();renderSettings();
  profileMsg && profileMsg("Settings reset to defaults.","success");
}
async function exportBackup(){
  try{
    const r=await fetch(API+"/export");
    if(!r.ok) throw new Error("Export failed ("+r.status+")");
    const data=await r.json();
    const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const d=new Date();
    const stamp=`${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`;
    const a=document.createElement("a");
    a.href=url; a.download=`wealth-os-backup-${stamp}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
    showToast("✓ "+t("ui.exported"),"success");
  }catch(e){ showToast(e.message||"Could not export backup","alert"); }
}
function openSettings(){
  state.settings=state.settings||loadSettings();
  renderSettings();
  byId("settingsModal")?.classList.add("open");
}
function closeSettings(){byId("settingsModal")?.classList.remove("open");}
function renderSettings(){
  const b=byId("settingsBody");
  if(!b) return;
  const s=state.settings||loadSettings();
  const seg=(key,opts)=>`<div class="setSeg" data-key="${key}">`+opts.map(o=>`<button class="${String(s[key])===String(o.v)?"active":""}" data-val="${escAttr(String(o.v))}">${escapeHtml(o.label)}</button>`).join("")+`</div>`;
  const accents=["#4f8cff","#a78bfa","#34d399","#f3b340","#f472b6","#22d3ee"];
  const curr=["EUR","INR","USD","GBP","JPY","CHF","AUD","CAD","AED"];
  const profOpts=[{id:"auto",name:"Automatic (your own profile)"},{id:"",name:"Family wealth (admin)"}].concat((state.profiles||[]).map(p=>({id:p.id,name:p.name+(p.locked?" • locked":"")})));
  b.innerHTML=`
  <div class="setSection">
    <div class="setHead"><span class="setIco" style="--ic:#22d3ee">🌐</span><div><b>${escapeHtml(t("ui.language"))}</b><small>${escapeHtml(t("ui.language_desc"))}</small></div></div>
    <div class="setRow"><span class="setLabel">${escapeHtml(t("ui.language"))}</span><select class="select setSelect" data-key="lang">${LANGS.map(L=>`<option value="${L.code}" ${s.lang===L.code?"selected":""}>${L.flag} ${escapeHtml(L.native)}</option>`).join("")}</select></div>
  </div>
  <div class="setSection">
    <div class="setHead"><span class="setIco" style="--ic:#4f8cff">🎨</span><div><b>${escapeHtml(t("ui.appearance"))}</b><small>Theme and accent color</small></div></div>
    <div class="setRow"><span class="setLabel">${escapeHtml(t("ui.theme_mode"))}</span>${seg("theme",[{v:"dark",label:t("ui.dark")},{v:"light",label:t("ui.light")},{v:"auto",label:t("ui.auto")}])}</div>
    <div class="setRow"><span class="setLabel">${escapeHtml(t("ui.accent"))}</span><div class="setAccents" data-key="accent">${accents.map(c=>`<button class="setDot ${s.accent===c?"active":""}" data-val="${c}" style="--d:${c}" title="${c}"></button>`).join("")}</div></div>
    <div class="setRow"><span class="setLabel">${escapeHtml(t("ui.density"))}<small>Comfortable spacing or compact for more on screen</small></span>${seg("density",[{v:"comfortable",label:t("ui.comfortable")},{v:"compact",label:t("ui.compact")}])}</div>
  </div>
  <div class="setSection">
    <div class="setHead"><span class="setIco" style="--ic:#a78bfa">🔒</span><div><b>${escapeHtml(t("ui.privacy"))}</b><small>Control what is visible</small></div></div>
    <div class="setRow"><span class="setLabel">${escapeHtml(t("ui.hide_amounts"))}<small>Blur balances; hover to peek</small></span><button class="setSwitch ${s.privacy?"on":""}" data-toggle="privacy" aria-pressed="${!!s.privacy}"><i></i></button></div>
    <div class="setRow"><span class="setLabel">${escapeHtml(t("ui.clock12"))}<small>e.g. 7:42 PM instead of 19:42</small></span><button class="setSwitch ${s.clock12?"on":""}" data-toggle="clock12" aria-pressed="${!!s.clock12}"><i></i></button></div>
    <div class="setRow"><span class="setLabel">${escapeHtml(t("ui.default_currency"))}<small>Used across the dashboard</small></span><select class="select setSelect" data-key="currency">${curr.map(c=>`<option ${s.currency===c?"selected":""}>${c}</option>`).join("")}</select></div>
  </div>
  <div class="setSection">
    <div class="setHead"><span class="setIco" style="--ic:#34d399">⚡</span><div><b>${escapeHtml(t("ui.livedata"))}</b><small>How often prices refresh</small></div></div>
    <div class="setRow"><span class="setLabel">${escapeHtml(t("ui.auto_refresh"))}</span>${seg("refresh",[{v:0,label:t("ui.off")||"Off"},{v:30,label:"30s"},{v:60,label:"1m"},{v:120,label:"2m"},{v:300,label:"5m"}])}</div>
    <div class="setRow"><span class="setLabel">${escapeHtml(t("ui.refresh_now"))}<small>Pull the latest quotes &amp; FX</small></span><button class="btn secondary smallBtn" data-action="refresh">↻ ${escapeHtml(t("ui.refresh_now"))}</button></div>
  </div>
  <div class="setSection">
    <div class="setHead"><span class="setIco" style="--ic:#f3b340">👤</span><div><b>${escapeHtml(t("ui.profilesSec"))}</b><small>Family accounts &amp; startup view</small></div></div>
    <div class="setRow"><span class="setLabel">${escapeHtml(t("ui.startup_profile"))}<small>Unlocked profiles open automatically</small></span><select class="select setSelect" data-key="defaultProfile">${profOpts.map(p=>`<option value="${escAttr(p.id)}" ${s.defaultProfile===p.id?"selected":""}>${escapeHtml(p.name)}</option>`).join("")}</select></div>
    <div class="setRow"><span class="setLabel">${escapeHtml(t("ui.manage_profiles"))}<small>Add, edit, photo, password</small></span><button class="btn secondary smallBtn" data-action="profiles">${escapeHtml(t("ui.open"))} ${escapeHtml(navLabel("Profiles"))} →</button></div>
  </div>
  <div class="setSection">
    <div class="setHead"><span class="setIco" style="--ic:#34d399">💾</span><div><b>${escapeHtml(t("ui.data_backup"))}</b><small>${escapeHtml(t("ui.data_backup_desc"))}</small></div></div>
    <div class="setRow"><span class="setLabel">${escapeHtml(t("ui.export_backup"))}<small>${escapeHtml(t("ui.export_backup_desc"))}</small></span><button class="btn secondary smallBtn" data-action="export">⬇ ${escapeHtml(t("ui.export_backup"))}</button></div>
  </div>
  <div class="setSection">
    <div class="setHead"><span class="setIco" style="--ic:#22d3ee">ℹ️</span><div><b>${escapeHtml(t("ui.abouthelp"))}</b><small>Learn what Wealth OS can do</small></div></div>
    <div class="setRow"><span class="setLabel">${escapeHtml(t("ui.user_guide"))}<small>Full capabilities of every tab</small></span><button class="btn secondary smallBtn" data-action="guide">${escapeHtml(t("ui.open"))} ${escapeHtml(navLabel("Guide"))} →</button></div>
    <div class="setRow"><span class="setLabel">Welcome setup<small>Re-run the first-time setup wizard</small></span><button class="btn secondary smallBtn" data-action="onboard">Run setup →</button></div>
    <div class="setRow"><span class="setLabel">${escapeHtml(t("ui.reset_settings"))}<small>Back to defaults</small></span><button class="btn secondary smallBtn dangerBtn" data-action="reset">${escapeHtml(t("ui.reset_settings"))}</button></div>
    <div class="setVersion">Wealth OS • local-first private build</div>
  </div>`;
  b.querySelectorAll(".setSeg").forEach(seg=>{
    const key=seg.dataset.key;
    seg.querySelectorAll("button").forEach(btn=>btn.addEventListener("click",()=>{
      let v=btn.dataset.val;
      if(key==="refresh") v=Number(v);
      updateSetting(key,v);
    }));
  });
  b.querySelectorAll(".setAccents .setDot").forEach(dot=>dot.addEventListener("click",()=>updateSetting("accent",dot.dataset.val)));
  b.querySelectorAll(".setSwitch[data-toggle]").forEach(sw=>sw.addEventListener("click",()=>updateSetting(sw.dataset.toggle,!s[sw.dataset.toggle])));
  b.querySelectorAll(".setSelect[data-key]").forEach(sel=>sel.addEventListener("change",()=>updateSetting(sel.dataset.key,sel.value)));
  b.querySelectorAll("[data-action]").forEach(btn=>btn.addEventListener("click",()=>{
    const a=btn.dataset.action;
    if(a==="refresh"){loadAll();}
    else if(a==="profiles"){closeSettings();show("Profiles");}
    else if(a==="guide"){closeSettings();show("Guide");}
    else if(a==="export"){exportBackup();}
    else if(a==="onboard"){replayOnboarding();}
    else if(a==="reset"){resetSettings();}
  }));
}
function updatePageHeader(page=state.currentPage){
  const headerMeta=byId("headerMeta");
  const clock=byId("worldClockLine");
  if(page==="Mission Control"){
    const profile=currentProfile();
    const first=String(profile.name||"Yogi").trim().split(/\s+/)[0]||"Yogi";
    const lang=greetingLanguage();
    title.textContent=lang==="hi" ? `${greetingPrefix()} ${first}, ${greetingPeriod()}` : `${greetingPrefix()} ${first}, ${greetingPeriod()}`;
    if(headerMeta) headerMeta.style.display="none";
    if(clock){
      clock.style.display="block";
      clock.textContent=worldClockText();
    }
  }else{
    title.textContent=navLabel(page);
    if(headerMeta) headerMeta.style.display="";
    if(clock){
      clock.style.display="none";
      clock.textContent="";
    }
  }
  tickLocalClock();
}
function euro(n){return "€"+Number(n||0).toLocaleString("de-DE",{maximumFractionDigits:0})}
function money(n,currency="EUR"){return `${currency} ${Number(n||0).toLocaleString("en-IN",{maximumFractionDigits:0})}`}
function displayMoney(eurValue,currency=state.displayCurrency){
  const value=convertFromEur(eurValue,currency);
  const symbol={EUR:"€",USD:"$",INR:"₹",GBP:"£",JPY:"¥",CHF:"CHF ",AED:"د.إ "}[currency]||`${currency} `;
  const locale=currency==="INR"?"en-IN":currency==="EUR"?"de-DE":"en-US";
  return `${symbol}${Number(value||0).toLocaleString(locale,{maximumFractionDigits:0})}`;
}
function convertFromEur(value,currency=state.displayCurrency){
  if(currency==="EUR") return Number(value||0);
  const rate=Number((state.fxRates||{})[currency]||0);
  return rate ? Number(value||0)*rate : Number(value||0);
}
function localToEur(amount,currency="EUR"){
  if(!currency || currency==="EUR") return Number(amount||0);
  const rate=Number((state.fxRates||{})[currency]||0);
  return rate ? Number(amount||0)/rate : Number(amount||0);
}
async function loadFxRates(){
  try{
    const fx=await get("/fx-rates?base=EUR");
    state.fxRates=fx.rates||{};
    if(!state.fxRates.AED && state.fxRates.USD) state.fxRates.AED=Number(state.fxRates.USD)*3.6725;
  }catch(e){
    state.fxRates={USD:1.08,INR:90,GBP:.84,JPY:165,CHF:.93,AUD:1.63,CAD:1.49,AED:3.97};
  }
}
function fmtMins(m){m=Math.max(0,Math.round(Number(m||0)));const h=Math.floor(m/60),mm=m%60;if(h>=24){const d=Math.floor(h/24);return `${d}d ${h%24}h`;}return h?`${h}h ${mm}m`:`${mm}m`;}
function marketLiveBadge(data){
  if(data==null||data.is_open_now===undefined||data.is_open_now===null) return "";
  if(data.is_open_now) return `<div class="marketLive open"><span class="marketLiveDot"></span><b>Open now</b><span>${data.closes_in_minutes!=null?`Closes in ${fmtMins(data.closes_in_minutes)}`:"Trading live"}</span></div>`;
  const no=data.live_next_open;
  return `<div class="marketLive closed"><span class="marketLiveDot"></span><b>Closed</b><span>${no?`Opens in ${fmtMins(no.opens_in_minutes)} · ${escapeHtml(no.local_open)}`:"No upcoming session"}</span></div>`;
}
function pct(n){return Number(n||0).toFixed(1)+"%"}
function cls(n){return Number(n||0)>=0?"green":"red"}
function signed(n){return `${Number(n||0)>=0?"+":""}${pct(n)}`}
function byId(id){return document.getElementById(id)}
function badMoney(value){
  const raw=String(value??"").trim();
  if(!raw) return false; // empty allowed (treated as 0/optional)
  const num=parseFloat(raw.toLowerCase().replace(/,/g,"").replace(/[^\d.\-]/g,""));
  return !Number.isFinite(num) || num<0; // invalid if no number, or negative
}
function isFutureDate(s){ if(!s) return false; const d=new Date(s); return !isNaN(d.getTime()) && d>new Date(); }
function isFutureYear(y){ const n=parseInt(y,10); return Number.isFinite(n) && n>new Date().getFullYear(); }
function parseMoney(value){
  const raw=String(value||"").trim().toLowerCase().replace(/,/g,"");
  if(!raw) return 0;
  const num=parseFloat(raw.replace(/[^\d.-]/g,""));
  if(!Number.isFinite(num)) return 0;
  if(raw.includes("crore") || raw.includes("cr")) return num*10000000;
  if(raw.includes("lakh") || raw.endsWith("l")) return num*100000;
  if(raw.includes("k")) return num*1000;
  return num;
}
function tip(text,html){return `<span title="${escAttr(text)}">${html}</span>`}
function assetCodeFromName(name){
  const cleaned=String(name||"").toUpperCase().replace(/[^A-Z0-9]+/g,"_").replace(/^_+|_+$/g,"");
  return (cleaned||"CUSTOM_ASSET").slice(0,28);
}
function marketLabel(m){return `${m.code} - ${m.name}`}
function getMarket(code){return (state.stockMarkets||fallbackMarkets).find(m=>m.code===code)||fallbackMarkets[0]}
function ensureSelectOption(select,value,label=value){
  if(!select || !value) return;
  if(![...select.options].some(o=>o.value===value)){
    select.add(new Option(label,value));
  }
}
function populateMarketSelects(){
  const markets=state.stockMarkets.length?state.stockMarkets:fallbackMarkets;
  const grouped=markets.map(m=>`<option value="${escAttr(m.code)}">${escapeHtml(marketLabel(m))}</option>`).join("");
  const h=byId("hMarket");
  if(h && !h.dataset.ready){h.innerHTML=grouped; h.value="GLOBAL"; h.dataset.ready="1";}
  const marketFilter=byId("marketExchange");
  if(marketFilter){
    const current=marketFilter.value||"ALL";
    marketFilter.innerHTML=`<option value="ALL">All world markets</option>`+grouped;
    marketFilter.value=[...marketFilter.options].some(o=>o.value===current)?current:"ALL";
  }
  if(h) loadMarketCalendar(h.value||"GLOBAL","holdingMarketCalendarPanel");
}
function filterMarketSelect(id,query,includeAll=false){
  const select=byId(id);
  if(!select) return;
  const q=String(query||"").toLowerCase();
  const current=select.value;
  const rows=(state.stockMarkets.length?state.stockMarkets:fallbackMarkets).filter(m=>!q || `${m.code} ${m.name} ${m.country} ${m.region}`.toLowerCase().includes(q));
  select.innerHTML=(includeAll?`<option value="ALL">All world markets</option>`:"")+rows.map(m=>`<option value="${escAttr(m.code)}">${escapeHtml(marketLabel(m))}</option>`).join("");
  select.value=[...select.options].some(o=>o.value===current)?current:(includeAll?"ALL":rows[0]?.code||"GLOBAL");
  if(id==="hMarket") applyMarketDefaults("hMarket");
}
async function loadStockMarkets(){
  state.stockMarkets=fallbackMarkets;
  populateMarketSelects();
  try{
    const rows=await get("/stock-markets");
    if(Array.isArray(rows) && rows.length){
      state.stockMarkets=rows;
      byId("hMarket")?.removeAttribute("data-ready");
      populateMarketSelects();
    }
  }catch(e){}
}
function applyMarketDefaults(id="hMarket"){
  const select=byId(id);
  if(!select) return;
  const m=getMarket(select.value);
  if(id==="hMarket"){
    ensureSelectOption(hCountry,m.country,m.country);
    hCountry.value=m.country;
    hCurrency.value=m.currency||hCurrency.value||"EUR";
    if(m.code==="CRYPTO") hType.value="Crypto";
    loadMarketCalendar(m.code,"holdingMarketCalendarPanel");
  }
}
async function loadMarketCalendar(code="ALL",targetId="marketCalendarPanel"){
  const panel=byId(targetId);
  if(!panel) return;
  panel.innerHTML=`<div class="calendarStatus"><b>Exchange calendar</b><span>Loading market hours and holidays...</span></div>`;
  try{
    const data=await get(`/market-calendar?market_code=${encodeURIComponent(code||"ALL")}`);
    renderMarketCalendar(data,targetId);
  }catch(e){
    panel.innerHTML=`<div class="calendarStatus warn"><b>Exchange calendar unavailable</b><span>Backend calendar endpoint did not respond. Market data tables can still load.</span></div>`;
  }
}
function renderMarketCalendar(data,targetId="marketCalendarPanel"){
  const panel=byId(targetId);
  if(!panel || !data) return;
  if(Array.isArray(data.markets)){
    state.marketCalendarData=data;
    if(!state.marketCalendarFilters) state.marketCalendarFilters={query:"",region:"",status:"",expanded:false};
    renderAllExchangeCalendar(targetId);
    updateBackButton();
    return;
  }
  const market=data.market||{};
  const next=data.next_holiday;
  const upcoming=(data.upcoming_holidays||[]).map(h=>`<span>${escapeHtml(h.date)} - ${escapeHtml(h.name)}${h.days_until===0?" (today)":h.days_until===1?" (tomorrow)":` (${h.days_until} days)`}</span>`).join("");
  const starredRow=renderStarredExchangeRow(targetId);
  const isStarred=starredExchanges().includes(market.code);
  panel.innerHTML=`
    ${marketLiveBadge(data)}
    <div class="calendarStatus ${escapeHtml(data.status||"open")}">
      <b>${escapeHtml(market.code||"Market")} calendar</b>
      <span>${escapeHtml(data.notice||"Exchange timing loaded.")}</span>
    </div>
    <div class="singleExchangeActions">
      <button class="btn secondary smallBtn" onclick="showExchangeFinder('${escAttr(targetId)}')">All exchanges</button>
      <button class="exchangeStarToggle ${isStarred?"active":""}" onclick="toggleExchangeStar('${escAttr(market.code||"")}','${escAttr(targetId)}')" title="${isStarred?"Unstar":"Star"} ${escAttr(market.code||"market")}"><span>${isStarred?"★":"☆"}</span>${isStarred?"Starred exchange":"Star exchange"}</button>
    </div>
    ${starredRow}
    <div class="marketCalendarGrid">
      <div class="calendarMini"><span>Exchange</span><b>${escapeHtml(market.name||market.code||"Market")}</b><em>${escapeHtml(market.country||"")} • ${escapeHtml(data.timezone||"")}</em></div>
      <div class="calendarMini"><span>Local session</span><b>${escapeHtml(data.regular_session_local||"-")}</b><em>${escapeHtml(data.note||"Regular cash-market hours")}</em></div>
      <div class="calendarMini"><span>UTC</span><b>${escapeHtml(data.regular_session_utc||"-")}</b><em>Universal trading window</em></div>
      <div class="calendarMini"><span>Berlin time</span><b>${escapeHtml(data.regular_session_berlin||"-")}</b><em>Your local view</em></div>
      <div class="calendarMini"><span>Today</span><b>${data.is_open_today?"Open schedule":"Closed"}</b><em>${escapeHtml(data.today_local_date||"")} ${data.today_holiday_name?`• ${escapeHtml(data.today_holiday_name)}`:""}</em></div>
      <div class="calendarMini"><span>Next holiday</span><b>${next?escapeHtml(next.date):"No near holiday"}</b><em>${next?escapeHtml(next.name):"No configured closure ahead"}</em></div>
    </div>
    ${upcoming?`<div class="calendarUpcoming"><b>Upcoming closures</b>${upcoming}</div>`:""}
  `;
  updateBackButton();
}
function showExchangeFinder(targetId="marketCalendarPanel"){
  if(targetId==="marketCalendarPanel"){
    const select=byId("marketExchange");
    const input=byId("marketExchangeSearch");
    if(select) select.value="ALL";
    if(input) input.value="";
    updateBackButton();
    loadMarkets();
    return;
  }
  loadMarketCalendar("ALL",targetId);
}
function selectCalendarExchange(code,label,targetId="marketCalendarPanel"){
  if(targetId==="holdingMarketCalendarPanel"){
    const select=byId("hMarket");
    ensureSelectOption(select,code,label||code);
    if(select) select.value=code;
    applyMarketDefaults("hMarket");
    return;
  }
  selectLiveMarket(code,label||code);
}
function marketCalendarAction(action,value="",targetId="marketCalendarPanel"){
  if(!state.marketCalendarFilters) state.marketCalendarFilters={query:"",region:"",status:"",expanded:false};
  if(action==="query") state.marketCalendarFilters.query=value;
  if(action==="region") state.marketCalendarFilters.region=state.marketCalendarFilters.region===value?"":value;
  if(action==="status") state.marketCalendarFilters.status=state.marketCalendarFilters.status===value?"":value;
  if(action==="toggle") state.marketCalendarFilters.expanded=!state.marketCalendarFilters.expanded;
  if(action!=="toggle") state.marketCalendarFilters.expanded=false;
  renderAllExchangeCalendar(targetId);
  if(action==="query"){
    const input=byId(targetId)?.querySelector(".exchangeSearch");
    if(input){
      input.focus();
      input.setSelectionRange(input.value.length,input.value.length);
    }
  }
}
function starredExchanges(){
  try{
    const rows=JSON.parse(localStorage.getItem("wealth_os_starred_exchanges")||"[]");
    return Array.isArray(rows)?rows:[];
  }catch(e){
    return [];
  }
}
function saveStarredExchanges(rows){
  localStorage.setItem("wealth_os_starred_exchanges",JSON.stringify([...new Set(rows)].slice(0,16)));
}
function toggleExchangeStar(code,targetId="marketCalendarPanel"){
  if(!code) return;
  const current=starredExchanges();
  const exists=current.includes(code);
  saveStarredExchanges(exists?current.filter(x=>x!==code):[code,...current]);
  refreshExchangeCalendarPanels();
}
function refreshExchangeCalendarPanels(){
  const livePanel=byId("marketCalendarPanel");
  const holdingPanel=byId("holdingMarketCalendarPanel");
  if(livePanel) loadMarketCalendar(byId("marketExchange")?.value||"ALL","marketCalendarPanel");
  if(holdingPanel) loadMarketCalendar(byId("hMarket")?.value||"GLOBAL","holdingMarketCalendarPanel");
}
function renderStarredExchangeRow(targetId="marketCalendarPanel"){
  const all=state.marketCalendarData?.markets||[];
  const starred=starredExchanges().filter(code=>all.some(r=>r.market.code===code));
  const starredHtml=starred.length?starred.map(code=>{
    const r=all.find(x=>x.market.code===code);
    return `<button class="exchangeChip starred" onclick="selectCalendarExchange('${escAttr(code)}','${escAttr(marketLabel(r.market))}','${escAttr(targetId)}')" title="${escAttr(r.notice)}"><span>★</span>${escapeHtml(code)} <i onclick="event.stopPropagation();toggleExchangeStar('${escAttr(code)}','${escAttr(targetId)}')" title="Unstar exchange">×</i></button>`;
  }).join(""):`<span class="exchangeHint">Star exchanges from the finder and they will stay pinned here.</span>`;
  return `<div class="exchangeChipRow starredRow singleStarredRow"><b>Starred</b>${starredHtml}</div>`;
}
function renderAllExchangeCalendar(targetId="marketCalendarPanel"){
  const panel=byId(targetId);
  const data=state.marketCalendarData;
  if(!panel || !data || !Array.isArray(data.markets)) return;
  const filters=state.marketCalendarFilters||{query:"",region:"",status:"",expanded:false};
  const q=String(filters.query||"").toLowerCase();
  const all=data.markets||[];
  const regions=[...new Set(all.map(r=>r.market.region).filter(Boolean))];
  const priority=["NASDAQ","NYSE","NSE","BSE","XETRA","LSE","TSE","HKEX","ASX","SGX","CRYPTO","GLOBAL"];
  const starred=starredExchanges().filter(code=>all.some(r=>r.market.code===code));
  const counts={
    open:all.filter(r=>r.status==="open").length,
    warn:all.filter(r=>r.status==="warn").length,
    closed:all.filter(r=>r.status==="closed").length
  };
  let rows=all.filter(r=>
    (!q || `${r.market.code} ${r.market.name} ${r.market.country} ${r.market.region} ${r.market.currency} ${r.notice}`.toLowerCase().includes(q)) &&
    (!filters.region || r.market.region===filters.region) &&
    (!filters.status || r.status===filters.status)
  );
  rows=rows.slice().sort((a,b)=>{
    const warning=(b.status!=="open")-(a.status!=="open");
    if(warning) return warning;
    const as=starred.includes(a.market.code)?-1:0, bs=starred.includes(b.market.code)?-1:0;
    if(as!==bs) return as-bs;
    const ai=priority.indexOf(a.market.code), bi=priority.indexOf(b.market.code);
    const ap=ai>=0?ai:999, bp=bi>=0?bi:999;
    return ap-bp || a.market.code.localeCompare(b.market.code);
  });
  const visibleLimit=q||filters.region||filters.status ? 24 : 12;
  const visible=filters.expanded?rows:rows.slice(0,visibleLimit);
  const quick=priority.filter(code=>all.some(r=>r.market.code===code)).map(code=>{
    const r=all.find(x=>x.market.code===code);
    return `<button class="exchangeChip" onclick="selectCalendarExchange('${escAttr(code)}','${escAttr(marketLabel(r.market))}','${escAttr(targetId)}')" title="${r.is_open_now?"Open now":"Closed"}"><span class="liveDot ${r.is_open_now?"open":"closed"}"></span>${escapeHtml(code)}</button>`;
  }).join("");
  const starredHtml=starred.length?starred.map(code=>{
    const r=all.find(x=>x.market.code===code);
    return `<button class="exchangeChip starred" onclick="selectCalendarExchange('${escAttr(code)}','${escAttr(marketLabel(r.market))}','${escAttr(targetId)}')" title="${escAttr(r.notice)}"><span>★</span>${escapeHtml(code)} <i onclick="event.stopPropagation();toggleExchangeStar('${escAttr(code)}','${escAttr(targetId)}')" title="Unstar exchange">×</i></button>`;
  }).join(""):`<span class="exchangeHint">Star exchanges from the cards below and they will stay pinned here.</span>`;
  const regionChips=regions.map(region=>`<button class="exchangeChip ${filters.region===region?"active":""}" onclick="marketCalendarAction('region','${escAttr(jsString(region))}','${escAttr(targetId)}')">${escapeHtml(region)}</button>`).join("");
  const statusChips=["open","warn","closed"].map(status=>`<button class="exchangeChip ${filters.status===status?"active":""}" onclick="marketCalendarAction('status','${status}','${escAttr(targetId)}')">${status.toUpperCase()} ${counts[status]||0}</button>`).join("");
  const cards=visible.map(r=>{
    const isStarred=starred.includes(r.market.code);
    return `<div class="exchangeCard ${isStarred?"isStarred":""}" title="${escAttr(r.notice)}">
      <div class="exchangeCardTop"><span class="liveStatusPill ${r.is_open_now?"open":"closed"}"><span class="liveDot"></span>${r.is_open_now?"OPEN":"CLOSED"}</span><button class="starBtn ${isStarred?"active":""}" onclick="toggleExchangeStar('${escAttr(r.market.code)}','${escAttr(targetId)}')" title="${isStarred?"Unstar":"Star"} ${escAttr(r.market.code)}"><span>${isStarred?"★":"☆"}</span></button></div>
      <button class="exchangeOpenBtn" onclick="selectCalendarExchange('${escAttr(r.market.code)}','${escAttr(marketLabel(r.market))}','${escAttr(targetId)}')">
        <b>${escapeHtml(r.market.code)}</b>
        <strong>${escapeHtml(r.market.name)}</strong>
        <em>${escapeHtml(r.market.country)} • ${escapeHtml(r.market.currency)} • ${escapeHtml(r.market.region)}</em>
        <i class="exLive ${r.is_open_now?"green":"red"}">${r.is_open_now?`Closes in ${fmtMins(r.closes_in_minutes)}`:(r.live_next_open?`Opens in ${fmtMins(r.live_next_open.opens_in_minutes)}`:"Closed")}</i>
        <i>Local ${escapeHtml(r.regular_session_local)}</i>
        <i>UTC ${escapeHtml(r.regular_session_utc)}</i>
        <i>Berlin ${escapeHtml(r.regular_session_berlin)}</i>
        <small>${escapeHtml(r.notice)}</small>
      </button>
    </div>`;
  }).join("");
  const empty=`<div class="emptyExchangeState"><b>No exchange found</b><span>Try a market code like BSE, NSE, NASDAQ, XETRA, ASX, or a country/region.</span></div>`;
  panel.innerHTML=`
    <div class="calendarStatus ${escapeHtml(data.status||"open")}"><b>Exchange finder</b><span>${escapeHtml(data.notice||"Global market calendar")} Search or tap a region to shorten the list.</span></div>
    <div class="exchangeFinder">
      <input class="input exchangeSearch" placeholder="Search exchange, country, currency, holiday..." value="${escAttr(filters.query||"")}" oninput="marketCalendarAction('query',this.value,'${escAttr(targetId)}')"/>
      <div class="exchangeSummary">
        <span><b>${all.length}</b> markets</span><span><b>${counts.open}</b> open schedule</span><span><b>${counts.warn}</b> warning</span><span><b>${counts.closed}</b> closed</span>
      </div>
      <div class="exchangeChipRow starredRow"><b>Starred</b>${starredHtml}</div>
      <div class="exchangeChipRow"><b>Quick</b>${quick}</div>
      <div class="exchangeChipRow"><b>Status</b>${statusChips}</div>
      <div class="exchangeChipRow regionChips"><b>Region</b><button class="exchangeChip ${!filters.region?"active":""}" onclick="marketCalendarAction('region','','${escAttr(targetId)}')">All</button>${regionChips}</div>
    </div>
    <div class="exchangeCardGrid">${cards||empty}</div>
    ${rows.length>visible.length?`<button class="btn secondary exchangeMoreBtn" onclick="marketCalendarAction('toggle','','${escAttr(targetId)}')">Show ${rows.length-visible.length} more exchanges</button>`:""}
    ${filters.expanded && rows.length>visibleLimit?`<button class="btn secondary exchangeMoreBtn" onclick="marketCalendarAction('toggle','','${escAttr(targetId)}')">Show compact view</button>`:""}
  `;
}
function smartHoldingDefaults(){
  const type=byId("hType")?.value||"";
  const country=byId("hCountry")?.value||"";
  const market=byId("hMarket")?.value||"";
  if(market && market!=="GLOBAL") return applyMarketDefaults("hMarket");
  if(type==="Crypto") hCountry.value="Crypto";
  if(type==="Crypto") hCurrency.value="EUR";
  else if(country==="India") hCurrency.value="INR";
  else if(country==="US") hCurrency.value="USD";
  else if(country==="Germany" || country==="Global") hCurrency.value="EUR";
  if(type==="Mutual Fund" && hBroker.value==="Manual") hBroker.value="Groww";
  if(type==="Crypto" && hBroker.value==="Manual") hBroker.value="Coinbase";
}
function smartPropertyCurrency(){
  const profile=currentProfile();
  const category=byId("prCategory")?.value||"";
  if(byId("prCurrency")?.dataset.manual==="1") return;
  const location=`${prLocation.value||""} ${profile.country||""}`.toLowerCase();
  const setAutoCurrency=(code)=>{
    if(!code || !byId("prCurrency")) return;
    prCurrency.value=code;
    prCurrency.dataset.auto="1";
  };
  if(category==="FD") { setAutoCurrency("INR"); return; }   // fixed deposits are India-context → INR by default
  if(category==="Physical Gold" || category==="Physical Silver") {
    if(profile.country==="India") setAutoCurrency("INR");
    else if(profile.country==="US") setAutoCurrency("USD");
    else setAutoCurrency("INR");
    return;
  }
  if(locationCurrency(location)) setAutoCurrency(locationCurrency(location));
}
function markPropertyCurrencyManual(){
  if(byId("prCurrency")) prCurrency.dataset.manual="1";
}
function locationCurrency(text=""){
  const q=String(text||"").toLowerCase();
  if(["india","bharat","indore","mumbai","delhi","new delhi","pune","bangalore","bengaluru","hyderabad","chennai","bhopal","ujjain","madhya pradesh","himachal","himachal pradesh","maharashtra","karnataka","gujarat","rajasthan","uttar pradesh","uttarakhand","punjab","haryana","bihar","jharkhand","odisha","orissa","west bengal","assam","kerala","tamil nadu","telangana","andhra pradesh","goa","chhattisgarh","jammu","kashmir","sikkim","meghalaya","manipur","mizoram","nagaland","tripura","arunachal","chandigarh","lucknow","kanpur","jaipur","ahmedabad","surat","vadodara","nagpur","nashik","patna","ranchi","kolkata","kochi","thiruvananthapuram","coimbatore","madurai","visakhapatnam","vijayawada","noida","gurgaon","gurugram"].some(x=>q.includes(x))) return "INR";
  if(["usa","united states","america","new york","california","texas","florida","washington","chicago","boston"].some(x=>q.includes(x))) return "USD";
  if(["uk","united kingdom","london","england","scotland"].some(x=>q.includes(x))) return "GBP";
  if(["switzerland","zurich","geneva"].some(x=>q.includes(x))) return "CHF";
  if(["uae","united arab emirates","dubai","abu dhabi","sharjah"].some(x=>q.includes(x))) return "AED";
  if(["saudi","riyadh","jeddah"].some(x=>q.includes(x))) return "SAR";
  if(["qatar","doha"].some(x=>q.includes(x))) return "QAR";
  if(["singapore"].some(x=>q.includes(x))) return "SGD";
  if(["japan","tokyo","osaka"].some(x=>q.includes(x))) return "JPY";
  if(["hong kong","hongkong"].some(x=>q.includes(x))) return "HKD";
  if(["china","shanghai","beijing","shenzhen"].some(x=>q.includes(x))) return "CNY";
  if(["australia","sydney","melbourne","brisbane","perth"].some(x=>q.includes(x))) return "AUD";
  if(["canada","toronto","vancouver"].some(x=>q.includes(x))) return "CAD";
  if(["germany","berlin","munich","bavaria","europe","france","spain","italy","netherlands","austria"].some(x=>q.includes(x))) return "EUR";
  return "";
}
function currencyForCountry(country){
  const c=String(country||"").trim().toLowerCase();
  const map={india:"INR",us:"USD",usa:"USD","united states":"USD",uk:"GBP","united kingdom":"GBP",
    germany:"EUR",france:"EUR",spain:"EUR",italy:"EUR",netherlands:"EUR",austria:"EUR",ireland:"EUR",
    switzerland:"CHF",uae:"AED","united arab emirates":"AED",singapore:"SGD",japan:"JPY",canada:"CAD",australia:"AUD"};
  return map[c]||locationCurrency(c)||"";
}
function applyProfileCurrency(country){
  const cur=currencyForCountry(country);
  if(cur){ state.displayCurrency=cur; const sel=byId("displayCurrency"); if(sel) sel.value=cur; savePref("displayCurrency",cur); }
}
function profileMsg(text,kind="info"){
  const msg=byId("profileMessage");
  if(!msg) return;
  msg.textContent=text;
  msg.className=kind==="error"?"red":kind==="success"?"green":"subtitle";
}
async function api(p,options={}){
  const method=(options.method||"GET").toUpperCase();
  let r;
  try{
    r=await fetch(API+p,options);
  }catch(e){
    const fallback=demoResponse(p,method);
    if(fallback!==undefined){
      state.demo=true;
      return JSON.parse(JSON.stringify(fallback));
    }
    throw e;
  }
  const data=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(formatApiError(data, r.status));
  return data;
}
function formatApiError(data,status){
  const detail=data?.detail||data?.error||data?.message;
  if(Array.isArray(detail)){
    return detail.map(x=>{
      const where=Array.isArray(x.loc)?x.loc.filter(Boolean).join("."):"";
      return `${where ? where+": " : ""}${x.msg||JSON.stringify(x)}`;
    }).join("\n");
  }
  if(detail && typeof detail==="object") return detail.msg||JSON.stringify(detail);
  return detail||`API error ${status}`;
}
async function get(p){return api(p)}
async function post(p,d){return api(p,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(d)})}
async function patch(p,d){return api(p,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(d)})}
async function del(p){return api(p,{method:"DELETE"})}
function q(){return state.profile?`?profile_id=${encodeURIComponent(state.profile)}`:""}
function ownProfileId(){
  const own=state.profiles.find(x=>String(x.relation||"").toLowerCase()==="self")||state.profiles[0];
  return own ? own.id : "me";
}
// A profile needs the correct password before you can switch into it if it either
// has a password set, or is a legacy locked (non-self) profile.
function profileLocked(p){ return !!(p && (p.has_password || p.locked)); }
function adminProfileObj(){ return (state.profiles||[]).find(x=>String(x.relation||"").toLowerCase()==="self"); }
// Returns the profile id that must be unlocked before `target` (id or "" for family view)
// can be shown, or null if no password is required.
function unlockNeededFor(target){
  if(target===""||target==null){ const a=adminProfileObj(); return (a && profileLocked(a) && !state.unlocked[a.id]) ? a.id : null; }
  const t=(state.profiles||[]).find(x=>x.id===target);
  return (t && profileLocked(t) && !state.unlocked[t.id]) ? t.id : null;
}
// Only the profile currently in view stays unlocked. Switching to any other
// protected profile therefore always asks for its password again.
function setSoleUnlocked(id){ state.unlocked={}; if(id) state.unlocked[id]=true; }
function selectedProfile(){return state.profile||ownProfileId()}
function currentProfileName(){
  const profile=state.profiles.find(x=>x.id===state.profile);
  return profile ? profile.name : "";
}
function updateScopeCopy(){
  const personal=!!state.profile;
  const name=currentProfileName();
  const scopeLabel=byId("scopeLabel");
  const netWorthLabel=byId("netWorthLabel");
  const scopeHint=byId("scopeHint");
  if(scopeLabel) scopeLabel.textContent=personal ? `${name || "Selected profile"} only` : "Family wealth";
  if(netWorthLabel) netWorthLabel.textContent=personal ? "Personal Net Worth" : "Family Net Worth";
  if(scopeHint) scopeHint.textContent=personal
    ? `Showing only ${name || "this profile"}'s holdings, property, cash, plans, and cashflow.`
    : "Showing the combined wealth of every family profile.";
}
function currentProfile(){
  return state.profiles.find(x=>x.id===state.profile)||state.profiles.find(x=>String(x.relation||"").toLowerCase()==="self")||state.profiles[0]||{};
}
function topAvatarHtml(profile){
  const photo=profile.photo_url||"";
  if(photo) return `<img src="${escAttr(photo)}" alt="${escAttr(profile.name||"Profile")}"/>`;
  return "";
}
function renderTopProfile(){
  const profile=currentProfile();
  const avatar=byId("topAvatar");
  const name=byId("topProfileName");
  if(avatar){
    avatar.innerHTML=topAvatarHtml(profile);
    avatar.classList.toggle("blankAvatar", !profile.photo_url);
  }
  if(name) name.textContent=state.profile ? (profile.name||"Profile") : "Family";
  updatePageHeader(state.currentPage);
}
function toggleProfileMenu(){
  const menu=byId("profileMenuList");
  if(menu) menu.classList.toggle("open");
}
function renderProfileMenu(){
  const menu=byId("profileMenuList");
  if(!menu) return;
  const rows=[`<button data-profile-id="" title="Admin view: all family wealth"><span class="menuAvatar blankAvatar"></span><span><b>Family wealth</b><small>Admin only</small></span></button>`].concat(state.profiles.map(p=>`<button data-profile-id="${escAttr(p.id)}" title="Switch to ${escAttr(p.name)}"><span class="menuAvatar ${p.photo_url?"":"blankAvatar"}">${p.photo_url?`<img src="${escAttr(p.photo_url)}" alt="${escAttr(p.name)}"/>`:""}</span><span><b>${escapeHtml(p.name)}</b><small>${escapeHtml(p.relation)} ${p.locked?"• locked":""}</small></span></button>`));
  menu.innerHTML=rows.join("");
  menu.querySelectorAll("button").forEach(btn=>btn.addEventListener("click",()=>requestProfileSwitch(btn.dataset.profileId||"")));
}
async function requestProfileSwitch(profileId){
  const target=state.profiles.find(x=>x.id===profileId);
  byId("profileMenuList")?.classList.remove("open");
  if(!profileId){
    const admin=state.profiles.find(x=>String(x.relation||"").toLowerCase()==="self");
    if(admin && profileLocked(admin) && state.profile!==admin.id && !state.unlocked[admin.id]){
      return openPasswordModal(admin.id,"Unlock admin profile","Enter the admin password to view family wealth.",{familyView:true});
    }
    setSoleUnlocked(admin && profileLocked(admin) ? admin.id : "");
    state.profile="";
    savePref("activeProfile","");
    state.profileBooted=true;
    state.pendingOverlay=true;
    state.overlayText="Loading family wealth";
    return loadAll();
  }
  if(!target) return;
  if(profileLocked(target) && !state.unlocked[profileId]){
    return openPasswordModal(profileId,`Unlock ${target.name}`,`Enter ${target.name}'s profile password to switch to this profile.`);
  }
  setSoleUnlocked(profileId);
  state.profile=profileId;
  savePref("activeProfile",profileId);
  applyProfileCurrency(target.country);   // show each profile in its own home currency (changeable via chips)
  state.profileBooted=true;
  state.pendingOverlay=true;
  state.overlayText=`Loading ${target.name||"profile"}`;
  await loadAll();
}
function openPasswordModal(profileId,titleText,helpText,opts){
  state.pendingProfile=profileId;
  state.pendingFamilyView=!!(opts&&opts.familyView);
  byId("passwordTitle").textContent=titleText;
  byId("passwordHelp").textContent=helpText;
  byId("profilePasswordInput").value="";
  byId("passwordModal").classList.add("open");
  setTimeout(()=>byId("profilePasswordInput").focus(),50);
}
// Boot-time lock: app stays blurred behind the password prompt until the right
// password is entered, so protected profile data never shows without it.
function showProfileBootLock(){
  const bl=state.bootLock; if(!bl) return;
  const t=(state.profiles||[]).find(x=>x.id===bl.lockId);
  const cancel=byId("pwCancelBtn"); if(cancel) cancel.style.display="none";
  byId("passwordModal")?.classList.add("bootLock");
  openPasswordModal(bl.lockId,"🔒 Locked",`Enter ${t?t.name:"the"} profile's password to open the app.`,{familyView:bl.target===""});
}
function closePasswordModal(){
  if(state.bootLock){ return; }   // boot lock can only be cleared by the correct password
  state.pendingProfile=null;
  byId("passwordModal").classList.remove("open");
  profileSelect.value=state.profile;
}
// Which profile guards what's currently on screen (the admin guards family view).
function lockTargetFor(target){
  if(target===""||target==null){ const a=adminProfileObj(); return a?a.id:null; }
  return target;
}
// Manual "lock now" — e.g. stepping away for a coffee. Blurs the app behind the
// password prompt and requires the profile's password to resume. Stays online.
function lockProfile(){
  if(state.bootLock) return;                       // already locked
  const target=state.profile;
  const lockId=lockTargetFor(target);
  const t=lockId ? (state.profiles||[]).find(x=>x.id===lockId) : null;
  if(!t || !profileLocked(t)){
    return showToast("Set a password for this profile first (Profiles tab → pick the profile → set a password → Update) so it can be locked.","info");
  }
  state.unlocked[lockId]=false;
  state.bootLock={target:(target==null?"":target), lockId};
  state.profile="__locked__";
  showProfileBootLock();
}
// Restore-from-back/forward-cache (bfcache): the page comes back without re-running
// boot, so an already-unlocked session would skip the gate. Force a re-lock here.
function relockOnRestore(){
  if(state.bootLock){ showProfileBootLock(); return; }
  const target=state.profile;
  const lockId=lockTargetFor(target);
  const t=lockId ? (state.profiles||[]).find(x=>x.id===lockId) : null;
  if(!t || !profileLocked(t)) return;              // nothing protected to re-lock
  state.unlocked[lockId]=false;
  state.bootLock={target:(target==null?"":target), lockId};
  state.profile="__locked__";
  showProfileBootLock();
}
async function confirmProfilePassword(){
  const profileId=state.pendingProfile;
  if(!profileId) return closePasswordModal();
  try{
    await post(`/profiles/${encodeURIComponent(profileId)}/unlock`,{password:byId("profilePasswordInput").value});
    setSoleUnlocked(profileId);
    // Boot lock: unlock the app and load the profile (or family view) we were gating.
    if(state.bootLock){
      const tgt=state.bootLock.target;
      state.bootLock=null;
      const cancel=byId("pwCancelBtn"); if(cancel) cancel.style.display="";
      byId("passwordModal")?.classList.remove("bootLock");
      state.pendingProfile=null;
      byId("passwordModal")?.classList.remove("open");
      state.profile=tgt;
      savePref("activeProfile",tgt);
      const tp=state.profiles.find(x=>x.id===tgt);
      if(tp) applyProfileCurrency(tp.country);
      state.profileBooted=true; state.pendingOverlay=true; state.overlayText="Loading your profile";
      return loadAll();
    }
    const familyView=state.pendingFamilyView;
    closePasswordModal();
    const target=state.profiles.find(x=>x.id===profileId);
    state.profile = familyView ? "" : profileId;
    savePref("activeProfile",state.profile);
    if(target) applyProfileCurrency(target.country);
    state.profileBooted=true;
    state.pendingOverlay=true;
    state.overlayText=`Loading ${target?.name||"profile"}`;
    await loadAll();
  }catch(e){
    byId("passwordHelp").textContent=e.message||"Wrong password";
  }
}
function demoResponse(p,method){
  if(method==="POST" && p==="/ai-cfo") return {answer:"Demo mode: connect the backend on port 8000 for live CFO responses. The dashboard UI is rendering with local sample data.",disclaimer:"Educational only."};
  if(method!=="GET") return undefined;
  const path=p.split("?")[0];
  if(path==="/live/status") return {stock_provider:"Demo mode",fx_provider:"Local sample",broker_status:[],note:"Backend unavailable in this browser."};
  if(path==="/profiles") return demo.profiles.map(x=>({...x,updated:new Date().toISOString()}));
  if(path==="/dashboard") return {net_worth:541625,investments:21625,properties:520000,pl:4605,daily:3064,income:5800,expenses:1670,monthly_investment:1900,savings_rate:71.2,updated:new Date().toISOString()};
  if(path==="/wealth-score") return {score:83,grade:"Good"};
  if(path==="/holdings") return demo.holdings;
  if(path==="/properties") return demo.properties;
  if(path==="/cashflow") return demo.cashflow;
  if(path==="/alerts") return demo.alerts;
  if(path==="/savings-plans") return demo.savings;
  if(path==="/cash-accounts") return demo.cash;
  if(path==="/allocations") return {
    by_type:[{name:"Property",value:520000},{name:"Stock",value:3247},{name:"ETF",value:4418},{name:"Crypto",value:4450}],
    by_country:[{name:"Germany",value:520000},{name:"US",value:3247},{name:"Global",value:4418},{name:"Crypto",value:4450}],
    by_sector:[{name:"Real Estate",value:520000},{name:"Technology",value:3247},{name:"ETF",value:4418},{name:"Crypto",value:4450}],
    by_broker:[{name:"IBKR",value:1580},{name:"Trading 212",value:1567},{name:"Scalable Capital",value:4418},{name:"Coinbase",value:4450}]
  };
  if(path==="/markets/movers") return {top_gainers:demo.holdings.filter(x=>x.day>=0),top_losers:demo.holdings.filter(x=>x.day<0),all:demo.holdings};
  if(path==="/markets/global-top") return {valuable:demo.holdings,gainers:demo.holdings.filter(x=>x.day>=0),losers:demo.holdings.filter(x=>x.day<0),coins:demo.holdings.filter(x=>x.type==="Crypto")};
  if(path.startsWith("/asset/")){
    const sym=path.split("/").pop().toUpperCase();
    const asset=demo.holdings.find(x=>x.symbol===sym)||demo.holdings[0];
    return {asset,movement_explanation:`${asset.name} is ${asset.day>=0?"up":"down"} ${signed(asset.day)} today. Likely drivers include sector momentum, macro risk appetite, recent news, valuation expectations, and technical positioning.`,why_up_or_down:`${asset.name} moved ${signed(asset.day)} because of a mix of sector momentum, market liquidity, earnings/news expectations, and broader risk appetite.`,fundamentals:{instrument_type:asset.type||"Stock",sector:asset.sector||"Technology",country:asset.country||"US",broker:asset.broker,currency:asset.currency,current_price:asset.price,position_qty:asset.qty,average_cost:asset.avg,market_value:asset.value,market_value_eur:asset.value_eur,unrealized_pl_eur:asset.pl_eur,unrealized_pl_pct:asset.pl_pct},news:[{headline:`${asset.symbol} on Yahoo Finance`,summary:"Open live market page for current headlines, financials, statistics, and chart context.",url:`https://finance.yahoo.com/quote/${asset.symbol}`,source:"Yahoo Finance"}],analyst_view:{rating:asset.day>=0?"Neutral to positive":"Neutral to cautious",risk_level:"High",bull_case:"Upside can come from growth, margin expansion, market-share gains, and positive analyst revisions.",bear_case:"Risks include valuation compression, earnings misses, regulation, competition, and macro risk-off moves.",what_to_watch:["Earnings and guidance","Analyst revisions","Sector ETF trend","Interest rates and FX","Major company news"],world_class_sources:["Investor relations","Exchange filings","Yahoo Finance","Reuters/Bloomberg-style news when configured"]},alerts:[],portfolio_context:{owned:true,daily_impact_eur:asset.daily_eur||0,weight_hint:"Portfolio position",action_ideas:["Set a price alert","Check concentration risk","Compare with month/year trend","Read latest news before trading"]}};
  }
  if(path==="/brokers/status") return [{broker:"IBKR",configured:false,method:"Gateway",status:"Needs setup"},{broker:"Trading 212",configured:false,method:"API key",status:"Needs setup"}];
  if(path==="/news-intelligence") return demo.holdings.map(x=>({symbol:x.symbol,impact_score:Math.min(10,Math.abs(x.day)+3).toFixed(1),sentiment:x.day>=0?"Positive":"Negative",summary:`${x.name} demo movement: ${signed(x.day)} today.`}));
  return undefined;
}

function table(id,h,rows){
  const el=document.getElementById(id);
  if(!el) return;
  const sort=state.tableSort[id];
  let sorted=(rows||[]).slice();
  if(sort){
    sorted.sort((a,b)=>compareCells(a[sort.index],b[sort.index])*(sort.dir==="asc"?1:-1));
  }
  el.innerHTML=`<thead><tr>${h.map((x,i)=>`<th class="sortableTh" title="Sort by ${escAttr(x)}" onclick="sortTable('${escAttr(id)}',${i})">${escapeHtml(x)}${sort?.index===i?` <span>${sort.dir==="asc"?"↑":"↓"}</span>`:""}</th>`).join("")}</tr></thead><tbody>${sorted.map(r=>`<tr>${r.map(c=>`<td title="${escAttr(cellTitle(c))}">${c}</td>`).join("")}</tr>`).join("")}</tbody>`;
}
function cellTitle(value){
  const div=document.createElement("div");
  div.innerHTML=String(value||"");
  return (div.textContent||div.innerText||String(value||"")).replace(/\s+/g," ").trim();
}
function compareCells(a,b){
  const aa=cellTitle(a);
  const bb=cellTitle(b);
  const an=parseComparableNumber(aa);
  const bn=parseComparableNumber(bb);
  if(Number.isFinite(an) && Number.isFinite(bn)) return an-bn;
  return aa.localeCompare(bb,undefined,{numeric:true,sensitivity:"base"});
}
function parseComparableNumber(value){
  const text=String(value||"").replace(/[₹€$£,%]/g,"").replace(/CHF|EUR|USD|INR|GBP|JPY|GBp|AUD|CAD/gi,"").replace(/,/g,"").trim();
  const match=text.match(/[-+]?\d*\.?\d+/);
  return match ? Number(match[0]) : NaN;
}
function sortTable(id,index){
  const current=state.tableSort[id];
  state.tableSort[id]={index,dir:current?.index===index && current.dir==="asc"?"desc":"asc"};
  rerenderTable(id);
}
function rerenderTable(id){
  if(["gainers","losers","gainers50","losers50","globalTop","globalCoins"].includes(id)) return renderMarketTables();
  if(id==="holdings") return renderHoldings();
  if(id==="portfolioHoldings") return loadPortfolio();
  if(id==="cashflowTable") return renderCashflowTable();
  if(id==="propertyTable") return renderPropertiesTable();
  if(id==="favoritesTable") return renderFavoritesTable();
  if(id==="fundBondTable") return renderFundsBonds();
  if(id==="screenerTable") return renderScreeners();
  if(id==="compareTable") return renderCompare();
  if(id==="newsCenterTable") return renderNewsCenter();
  loadAll();
}
function fallbackChart(id,labels,data,label){
  const el=document.getElementById(id);
  if(!el) return;
  const max=Math.max(...data.map(x=>Math.abs(Number(x)||0)),1);
  const rows=labels.map((name,i)=>{
    const value=Number(data[i]||0);
    const width=Math.max(Math.abs(value)/max*100,4);
    return `<div class="barRow"><span>${escapeHtml(name)}</span><div class="barTrack"><i style="width:${width}%;background:${palette[i%palette.length]}"></i></div><b>${Math.abs(value)>1000?euro(value):Number(value).toLocaleString()}</b></div>`;
  }).join("");
  const box=document.createElement("div");
  box.className="chartFallback";
  box.id=id;
  box.innerHTML=`<div class="subtitle">${escapeHtml(label||"Chart")}</div>${rows}`;
  el.replaceWith(box);
}
function setChartReadout(cfg,labels,data,i,extra={}){
  if(!cfg||i==null||i<0) return;
  const val=Number(data[i]||0), first=Number(data[0]||0);
  const dEl=byId(cfg.date), vEl=byId(cfg.value), cEl=byId(cfg.change);
  if(dEl) dEl.textContent=cfg.label?`${cfg.label}: ${labels[i]}`:String(labels[i]??"");
  if(vEl) vEl.textContent=cfg.money?displayMoney(val):(extra.percent?`${val>=0?"+":""}${val.toFixed(2)}%`:val.toLocaleString());
  if(cEl){
    const ch=first?((val-first)/first*100):0;
    cEl.className="chartReadoutChange "+cls(ch);
    cEl.textContent=`${ch>=0?"▲":"▼"} ${cfg.money?displayMoney(Math.abs(val-first)):Math.abs(val-first).toLocaleString()} (${signed(ch)}) ${cfg.sinceLabel||"over the period"}`;
  }
}
function chart(id,type,labels,data,label,extra={}){
  const el=document.getElementById(id);
  if(!el) return;
  if(!window.Chart){
    fallbackChart(id,labels,data,label);
    return;
  }
  if(state.charts[id]) state.charts[id].destroy();
  const textColor=getComputedStyle(document.body).getPropertyValue("--text").trim();
  const mutedColor=getComputedStyle(document.body).getPropertyValue("--muted").trim();
  const gridColor=getComputedStyle(document.body).getPropertyValue("--grid").trim()||"rgba(148,163,184,.12)";
  const surface=getComputedStyle(document.body).getPropertyValue("--surface").trim()||"#0e1116";
  const isLine=type==="line", isBar=type==="bar", isPie=type==="doughnut"||type==="pie";
  const ctx=el.getContext("2d");
  const fmt=(v)=>extra.percent?`${Number(v||0)>=0?"+":""}${Number(v||0).toFixed(2)}%`:Number(v||0).toLocaleString();
  let dataset;
  if(isLine){
    const base=extra.borderColor||palette[0];
    const grad=ctx.createLinearGradient(0,0,0,el.height||260);
    grad.addColorStop(0,hexToRgba(base,.30));
    grad.addColorStop(1,hexToRgba(base,0));
    dataset={label,data,borderColor:base,backgroundColor:grad,borderWidth:2,tension:.3,fill:true,
      pointRadius:0,pointHoverRadius:5,pointHoverBackgroundColor:base,pointHoverBorderColor:"#fff",pointHoverBorderWidth:2};
  }else if(isBar){
    const colors=data.map((v,i)=>extra.percent?(Number(v)>=0?"#16c784":"#ea3943"):palette[i%palette.length]);
    dataset={label,data,backgroundColor:colors.map(c=>hexToRgba(c,.85)),hoverBackgroundColor:colors,
      borderWidth:0,borderRadius:6,borderSkipped:false,maxBarThickness:48};
  }else{
    dataset={label,data,backgroundColor:labels.map((_,i)=>hexToRgba(palette[i%palette.length],.92)),
      borderColor:surface,borderWidth:2,hoverOffset:10};
  }
  const plugins=[];
  if(isLine && typeof wosCrosshairPlugin!=="undefined") plugins.push(wosCrosshairPlugin);
  if(extra.readout) setChartReadout(extra.readout,labels,data,data.length-1,extra);
  state.charts[id]=new Chart(el,{
    type,
    data:{labels,datasets:[dataset]},
    options:{
      responsive:true,
      maintainAspectRatio:false,
      animation:{duration:520},
      interaction:isPie?{mode:"nearest",intersect:true}:{mode:"index",intersect:false},
      cutout:type==="doughnut"?"62%":undefined,
      plugins:{
        legend:{display:isPie,position:"bottom",labels:{color:textColor,boxWidth:9,usePointStyle:true,pointStyle:"circle",padding:13,font:{size:11}}},
        tooltip:{backgroundColor:"rgba(15,23,42,.96)",padding:11,cornerRadius:8,borderColor:"rgba(148,163,184,.25)",borderWidth:1,titleColor:"#fff",bodyColor:"#e2e8f0",displayColors:isPie,usePointStyle:true,
          callbacks:{label:(c)=>{
            if(isPie){const total=data.reduce((s,x)=>s+Number(x||0),0)||1;const v=Number(c.raw||0);return ` ${c.label}: ${v.toLocaleString()} (${(v/total*100).toFixed(1)}%)`;}
            return ` ${c.dataset.label||""}: ${fmt(c.raw)}`;
          }}
        }
      },
      onClick:(evt,elements)=>{ if(elements?.length && extra.onClick) extra.onClick(elements[0].index); },
      onHover:(evt,elements)=>{ if(extra.onClick && evt.native) evt.native.target.style.cursor=elements.length?"pointer":"default"; if(extra.readout && elements.length) setChartReadout(extra.readout,labels,data,elements[0].index,extra); },
      scales:isPie?{}:{
        x:{ticks:{color:mutedColor,maxRotation:0,autoSkip:true,maxTicksLimit:10,font:{size:11}},grid:{display:false}},
        y:{ticks:{color:mutedColor,maxTicksLimit:6,font:{size:11},callback:v=>extra.percent?v+"%":shortNum(v)},grid:{color:gridColor},grace:"6%"}
      }
    },
    plugins
  });
}

function showOverlay(text){
  const o=byId("loadingOverlay");
  if(!o) return;
  const t=byId("loaderText");
  if(t && text) t.textContent=text;
  o.classList.add("show");
}
function hideOverlay(){byId("loadingOverlay")?.classList.remove("show");}
function startTopBar(){byId("topBar")?.classList.add("show");}
function stopTopBar(){byId("topBar")?.classList.remove("show");}
async function loadAll(){
  const statusEl=document.getElementById("status");
  const liveStatusEl=document.getElementById("liveStatus");
  const connEl=document.getElementById("connState");
  const firstLoad=!state.firstLoadDone;
  if(firstLoad||state.pendingOverlay) showOverlay(state.overlayText||"Loading market data");
  startTopBar();
  try{
    state.demo=false;
    setConn("online");
    const ls=await get("/live/status");
    if(liveStatusEl){ liveStatusEl.textContent="All changes saved"; liveStatusEl.title=`Live data: ${ls.stock_provider}, ${ls.fx_provider}`; }
    await loadProfiles();
    if(state.bootLock){ showProfileBootLock(); return; }   // gate: wait for the password before loading any data
    await loadFxRates();
    await Promise.all([loadDash(),loadHoldings(),loadPortfolio(),loadProperties(),loadMarkets(),loadBrokers(),loadNews(),loadTwin(),loadAlertsAndPlans(),loadFavorites(),loadFundsBonds(),loadMarketStatus(),loadIpos(),loadAiDesk(),loadForex(),loadSips()]);
    renderScreeners(); renderCompare(); renderNewsCenter(); renderAssetSpecificHints(); computeNotifications();
    if(state.currentPage==="About Me" && !state.aboutEditing && typeof renderAboutMe==="function") renderAboutMe();
    if(state.demo) setConn("demo");
  } catch(e){
    setConn("offline");
    console.error(e);
  } finally{
    stopTopBar();
    hideOverlay();
    state.firstLoadDone=true;
    state.pendingOverlay=false;
    state.overlayText="";
    startLiveRefresh();
  }
}
/* ===== Friendly connection status ("Online · Saved") instead of API/DB jargon ===== */
function setConn(s){
  const dot=byId("connDot"), word=byId("status"), conn=byId("connState");
  const map={online:["ok","Online"],offline:["bad","Offline"],demo:["warn","Demo data"],refreshing:["ok","Refreshing…"]};
  const [cls,txt]=map[s]||map.online;
  if(dot) dot.className="statusDot "+cls;
  if(word) word.textContent=txt;
  if(conn) conn.textContent=txt;
}
/* ===== Live updates toggle + manual refresh ===== */
function isLiveOn(){ return loadPrefs().liveOn!==false; }  // default ON
function renderLiveToggle(){
  const b=byId("liveToggle"), lbl=byId("liveToggleLabel");
  if(!b) return;
  const on=isLiveOn();
  b.classList.toggle("on",on); b.classList.toggle("off",!on);
  if(lbl) lbl.textContent=on?"Live":"Paused";
  b.title=on?"Live price updates are ON — click to pause":"Live updates paused — click to go live";
}
function toggleLive(){
  const on=!isLiveOn();
  savePref("liveOn",on);
  renderLiveToggle();
  if(on){ startLiveRefresh(); liveRefresh(); showToast("▶ Live price updates on","success"); }
  else{ if(_liveTimer){clearInterval(_liveTimer);_liveTimer=null;} if(typeof stopAssetLiveTicker==="function") stopAssetLiveTicker(); showToast("⏸ Live updates paused","info"); }
}
async function manualRefresh(){
  const b=byId("refreshNowBtn"); if(b) b.classList.add("spinning");
  setConn("refreshing");
  try{ await loadAll(); }catch(e){}
  if(b) setTimeout(()=>b.classList.remove("spinning"),600);
  showToast("↻ Refreshed","success");
}
/* ===== Auto-refresh: keep prices live without a manual reload ===== */
let _liveTimer=null;
function startLiveRefresh(){
  if(_liveTimer) return;
  if(!isLiveOn()) return;   // respect the Live toggle
  _liveTimer=setInterval(()=>{ if(!document.hidden && isLiveOn()) liveRefresh(); }, 60000); // every 60s
}
async function liveRefresh(){
  if(state._refreshing) return;
  state._refreshing=true;
  const conn=byId("connState");
  try{
    if(conn) conn.textContent="refreshing…";
    await Promise.all([loadDash(),loadHoldings(),loadMarkets(),loadForex(),loadFavorites(),loadAiDesk()]);
    computeNotifications();
    if(state.currentPage==="About Me" && !state.aboutEditing && typeof renderAboutMe==="function") renderAboutMe();
    const u=byId("updated"); if(u) u.textContent=new Date().toLocaleString();
    if(conn) conn.textContent="online";
  }catch(e){ if(conn) conn.textContent="online"; }
  finally{ state._refreshing=false; }
}

async function loadDash(){
  let d=await get("/dashboard"+q());
  state.lastDashboard=d;
  renderDashboardCurrency();
  daily.className=cls(d.daily);
  updated.textContent=new Date(d.updated).toLocaleString();
  let s=await get("/wealth-score"+q());
  state.lastWealthScore=s;
  renderDashboardCurrency();
  let a=await get("/allocations"+q());
  state.lastAllocation=a;
  renderAllocationCharts();
  const holdings=await get("/holdings"+q());
  state.lastHoldings=holdings;
  renderDashboardCurrency();
  const top=holdings.slice().sort((a,b)=>b.value_eur-a.value_eur).slice(0,8);
  chart("perfChart",byId("dashChartType")?.value||"bar",top.map(x=>x.symbol),top.map(x=>x[byId("dashPerfMetric")?.value||"day"]),"Performance",{percent:true,onClick:i=>openAsset(top[i].symbol)});
}
function setDisplayCurrency(cur){
  // cur passed = explicit choice (currency chip); no arg = read the settings dropdown
  state.displayCurrency = cur || byId("displayCurrency")?.value || state.displayCurrency || "EUR";
  if(byId("displayCurrency")) byId("displayCurrency").value=state.displayCurrency;
  savePref("displayCurrency",state.displayCurrency);   // persist so it survives refresh
  renderDashboardCurrency();
  renderHoldings();
  renderPropertiesTable();
  if(typeof renderMissionAssetSummary==="function") renderMissionAssetSummary();
}
function animateCount(el,to,fmt){
  if(!el) return;
  to=Number(to)||0;
  const prev=Number(el.dataset.cv);
  const start=isNaN(prev)?0:prev;
  if(Math.abs(to-start)<0.0001){
    if(!el._raf){el.dataset.cv=to;el.textContent=fmt(to);}
    return;
  }
  el.dataset.cv=to;
  const reduce=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if(reduce){el.textContent=fmt(to);return;}
  const dur=750,t0=performance.now();
  if(el._raf) cancelAnimationFrame(el._raf);
  const step=(now)=>{
    const p=Math.min((now-t0)/dur,1), eased=1-Math.pow(1-p,3);
    el.textContent=fmt(start+(to-start)*eased);
    if(p<1){el._raf=requestAnimationFrame(step);} else {el._raf=0;el.textContent=fmt(to);}
  };
  el._raf=requestAnimationFrame(step);
}
function worthInWords(eurValue){
  const cur=state.displayCurrency||"EUR";
  const v=Math.abs(convertFromEur(eurValue,cur));
  const sym={EUR:"€",USD:"$",INR:"₹",GBP:"£",JPY:"¥",CHF:"CHF ",AED:"AED "}[cur]||cur+" ";
  const neg=eurValue<0?"−":"";
  let out;
  if(cur==="INR"){
    if(v>=1e7) out=`${(v/1e7).toFixed(2)} crore`;
    else if(v>=1e5) out=`${(v/1e5).toFixed(2)} lakh`;
    else if(v>=1e3) out=`${(v/1e3).toFixed(1)} thousand`;
    else out=`${Math.round(v)}`;
  }else{
    if(v>=1e12) out=`${(v/1e12).toFixed(2)} trillion`;
    else if(v>=1e9) out=`${(v/1e9).toFixed(2)} billion`;
    else if(v>=1e6) out=`${(v/1e6).toFixed(2)} million`;
    else if(v>=1e3) out=`${(v/1e3).toFixed(1)} thousand`;
    else out=`${Math.round(v)}`;
  }
  return `${neg}${sym}${out}`;
}
function renderDashboardCurrency(){
  const d=state.lastDashboard||{};
  if(byId("displayCurrency")) byId("displayCurrency").value=state.displayCurrency;
  if(byId("netWorth")) animateCount(netWorth,d.net_worth||0,v=>displayMoney(v));
  if(byId("netWorthWords")) netWorthWords.innerHTML=`<span class="nwwLabel">In words</span> ${escapeHtml(worthInWords(d.net_worth||0))} <span class="nwwLabel">·</span> across all assets, cash & investments`;
  if(byId("daily")) animateCount(daily,d.daily||0,v=>displayMoney(v));
  if(byId("savings")) animateCount(savings,d.savings_rate||0,v=>pct(v));
  const chips=byId("currencyChips");
  if(chips){
    chips.innerHTML=["EUR","INR","USD","AED","GBP","JPY","CHF"].map(c=>`<button class="${state.displayCurrency===c?"active":""}" onclick="setDisplayCurrency('${c}')">${c}: ${displayMoney(d.net_worth||0,c)}</button>`).join("");
  }
  renderMissionKpiDetails();
  renderMissionAssetSummary();
}
function rateFor(currency){
  if(currency==="EUR") return 1;
  return Number((state.fxRates||{})[currency]||0);
}
function fxToInr(currency){
  const inr=rateFor("INR");
  const rate=rateFor(currency);
  if(!inr || !rate) return null;
  return inr/rate;
}
function renderFxStrip(){
  const strip=byId("fxStrip");
  if(!strip) return;
  const rows=["EUR","USD","AED","GBP","CHF","JPY"].map(c=>{
    const toInr=fxToInr(c);
    const eurRate=rateFor(c);
    const title=c==="EUR"?"Base currency":`1 EUR = ${eurRate.toLocaleString(undefined,{maximumFractionDigits:4})} ${c}`;
    return `<button title="${escAttr(title)}" onclick="setDisplayCurrency('${c}')"><b>${c}</b><span>${toInr?`1 ${c} = ₹${toInr.toLocaleString("en-IN",{maximumFractionDigits:c==="JPY"?2:2})}`:"rate loading"}</span></button>`;
  }).join("");
  strip.innerHTML=rows;
}
function renderMissionKpiDetails(){
  const d=state.lastDashboard||{};
  const holdings=state.lastHoldings||[];
  const net=Number(d.net_worth||0);
  const inv=Number(d.investments||0);
  const periodMove=(metric)=>holdings.reduce((sum,h)=>sum+(Number(h.value_eur||0)*Number(h[metric]||0)/100),0);
  const dayMove=Number(d.daily||0);
  const monthMove=periodMove("month");
  const yearMove=periodMove("year");
  const moveBase=inv||net||1;
  if(byId("dailyDetail")){
    dailyDetail.innerHTML=[
      `<span><b>Daily</b><em>${signed(dayMove/moveBase*100)} of invested assets</em></span>`,
      `<span><b>Monthly</b><em>${displayMoney(monthMove)} (${signed(monthMove/moveBase*100)})</em></span>`,
      `<span><b>Yearly</b><em>${displayMoney(yearMove)} (${signed(yearMove/moveBase*100)})</em></span>`
    ].join("");
  }
  const income=Number(d.income||0), expenses=Number(d.expenses||0), invest=Number(d.monthly_investment||0);
  const monthlySaved=Math.max(income-expenses,0);
  const dailySaved=monthlySaved/30;
  const yearlySaved=monthlySaved*12;
  if(byId("savingsDetail")){
    savingsDetail.innerHTML=[
      `<span><b>Daily</b><em>${displayMoney(dailySaved)} run-rate</em></span>`,
      `<span><b>Monthly</b><em>${displayMoney(monthlySaved)} saved</em></span>`,
      `<span><b>Yearly</b><em>${displayMoney(yearlySaved)} • invest ${pct(income?invest/income*100:0)}</em></span>`
    ].join("");
  }
  const s=state.lastWealthScore||{};
  const score=Number(s.score||0);
  if(byId("scoreMini")){ if(score) animateCount(scoreMini,score,v=>`${Math.round(v)}/100`); else scoreMini.textContent="-"; }
  if(byId("scoreDetail")){
    const grade=s.grade|| (score>=85?"Excellent":score>=70?"Good":"Needs work");
    const runway=expenses?Math.round(Number(d.cash||0)/expenses):0;
    const nudge=score>=85?"Protect gains: review taxes, insurance, and concentration.":score>=70?"Strong base: raise automation and reduce weak positions.":"Focus: emergency cash, debt, and regular investing first.";
    scoreDetail.innerHTML=[
      `<span><b>${escapeHtml(grade)}</b><em>Cash runway ${runway||0} months</em></span>`,
      `<span><b>P/L</b><em>${displayMoney(d.pl||0)} • savings ${pct(d.savings_rate)}</em></span>`,
      `<span class="wideInsight"><em>${escapeHtml(nudge)}</em></span>`
    ].join("");
  }
  if(byId("currencyDetail")){
    const current=state.displayCurrency||"EUR";
    const inr=fxToInr(current);
    currencyDetail.innerHTML=`<span><b>${current}</b><em>Selected display</em></span><span><b>INR</b><em>${inr?`1 ${current} = ₹${inr.toLocaleString("en-IN",{maximumFractionDigits:2})}`:"FX rate loading"}</em></span>`;
  }
  renderFxStrip();
}
function renderMissionAssetSummary(){
  const box=byId("assetSummaryGrid");
  if(!box) return;
  const props=state.propertyRows||[];
  const cash=state.cashAccounts||[];
  const active=props.filter(p=>(p.status||"active")==="active");
  const total=(rows)=>rows.reduce((sum,p)=>sum+Number(p.value_eur||0),0);
  const gainEur=(rows)=>rows.filter(p=>Number(p.all_in_cost||0)>0).reduce((s,p)=>{
    const costEur=Number(p.value_eur||0)*Number(p.all_in_cost||0)/(Number(p.value||0)||1);
    return s+(Number(p.value_eur||0)-costEur);
  },0);
  const byCategory=(categories)=>active.filter(p=>categories.includes(p.category));
  const houses=byCategory(["Flat","House","Villa","Bungalow","Commercial","Future Property"]);
  const land=byCategory(["Plot","Land"]);
  const cars=byCategory(["Car"]);
  const metals=byCategory(["Physical Gold","Physical Silver","Diamond"]);
  const fds=byCategory(["FD"]);
  const cashValue=cash.reduce((sum,c)=>sum+Number(c.balance_eur||0),0);
  // total profit / loss across assets we have a cost basis for + market holdings
  const propPL=active.filter(p=>Number(p.all_in_cost||0)>0).reduce((s,p)=>{
    const costEur=Number(p.value_eur||0)*Number(p.all_in_cost||0)/(Number(p.value||0)||1);
    return s+(Number(p.value_eur||0)-costEur);
  },0);
  const holdPL=(state.lastHoldings||[]).reduce((s,h)=>s+Number(h.pl_eur||0),0);
  // mutual-fund SIPs/lumpsums (values are in their own currency, usually INR)
  const sipsArr=state.sips||[];
  const sipCurEur=sipsArr.reduce((s,r)=>s+localToEur(r.current_value,r.currency||"INR"),0);
  const sipInvEur=sipsArr.reduce((s,r)=>s+localToEur(r.invested,r.currency||"INR"),0);
  const sipPL=sipCurEur-sipInvEur;
  const totalPL=propPL+holdPL+sipPL;
  const dashboard=state.lastDashboard||{};
  const incomeRows=(state.cashflowRows||[]).filter(c=>c.type==="income");
  const incomeValue=Number(dashboard.income||0);
  const incomeNote=incomeRows.length ? `${incomeRows.length} income row${incomeRows.length===1?"":"s"} tracked` : "Add salary, rent, dividends, or other income";
  const cards=[
    {icon:"+",label:"Income",value:incomeValue,count:incomeRows.length,unit:"row",note:incomeNote,target:"Portfolio"},
    {icon:"🏠",label:"House / flats",value:total(houses),gain:gainEur(houses),count:houses.length,unit:"item",note:topAssetNote(houses,"No house/flat added yet"),target:"Properties"},
    {icon:"▧",label:"Land / plots",value:total(land),gain:gainEur(land),count:land.length,unit:"item",note:topAssetNote(land,"No land or plot added yet"),target:"Properties"},
    {icon:"◆",label:"Gold / silver / gems",value:total(metals),gain:gainEur(metals),count:metals.length,unit:"item",note:topAssetNote(metals,"No gold/silver/diamond added yet"),target:"Properties"},
    {icon:"◼",label:"Cars",value:total(cars),gain:gainEur(cars),count:cars.length,unit:"item",note:topAssetNote(cars,"No car added yet"),target:"Properties"},
    {icon:"🏦",label:"Fixed deposits",value:total(fds),gain:gainEur(fds),count:fds.length,unit:"FD",note:topAssetNote(fds,"No FD added yet"),target:"SIPs"},
    {icon:"€",label:"Cash",value:cashValue || Number(dashboard.cash||0),count:cash.length,unit:"account",note:cash.length?`${cash.length} cash account${cash.length===1?"":"s"}`:"No cash account added yet",target:"Portfolio"},
    {icon:"💼",label:"Investments",value:total(state.lastHoldings||[]),gain:holdPL,count:(state.lastHoldings||[]).length,unit:"holding",note:"Stocks, funds & ETFs at live prices",target:"Portfolio"},
    {icon:"🔁",label:"Mutual funds / SIPs",value:sipCurEur,gain:sipPL,count:sipsArr.length,unit:"plan",note:sipsArr.length?`Invested ${euro(sipInvEur)}`:"No SIPs/funds tracked yet",target:"SIPs"},
    {icon:totalPL>=0?"📈":"📉",label:"Total profit / loss",value:totalPL,count:0,unit:"",note:"Unrealized P/L across assets, holdings & funds (EUR)",target:"Portfolio",pl:true}
  ];
  const scope=byId("assetSummaryScope");
  if(scope) scope.textContent=selectedProfile()?`Profile: ${selectedProfile()}`:"Family view";
  box.innerHTML=cards.map(c=>{
    const val = c.pl ? `<b class="${cls(c.value)}">${c.value>=0?"+":""}${displayMoney(c.value)}</b>` : `<b>${displayMoney(c.value)}</b>`;
    const meta = c.unit ? `${escapeHtml(c.label)} • ${c.count} ${c.unit}${c.count===1?"":"s"}` : escapeHtml(c.label);
    const gainLine = (c.gain!=null && Math.round(c.gain)!==0) ? `<i class="cardPL ${cls(c.gain)}">${c.gain>=0?"▲ +":"▼ "}${displayMoney(c.gain)} P/L</i>` : "";
    return `<button class="assetSummaryCard${c.pl?" plCard":""}" onclick="show('${c.target||"Properties"}')" title="${escAttr(c.note)}"><span>${c.icon}</span><div>${val}${gainLine}<small>${meta}</small><em>${escapeHtml(c.note)}</em></div></button>`;
  }).join("");
}
function propertySummaryMoney(rows,valueEur){
  if(rows?.length){
    const currencies=[...new Set(rows.map(p=>p.currency||locationCurrency(p.location)||"EUR"))];
    if(currencies.length===1){
      const currency=currencies[0];
      const local=rows.reduce((sum,p)=>sum+(p.status==="active"?Number(p.value||0)-Number(p.loan||0):0),0);
      return money(local,currency);
    }
  }
  return displayMoney(valueEur);
}
function topAssetNote(rows,empty){
  if(!rows.length) return empty;
  const top=rows.slice().sort((a,b)=>Number(b.value_eur||0)-Number(a.value_eur||0))[0];
  const location=top.location?` • ${top.location}`:"";
  return `${top.category}${location}`;
}
function renderAllocationCharts(){
  const a=state.lastAllocation;
  if(!a) return;
  const group=byId("dashGroupFilter")?.value||"all";
  const type=byId("dashChartType")?.value||"doughnut";
  if(group==="all" || group==="type") chart("mixChart",type,a.by_type.map(x=>x.name),a.by_type.map(x=>convertFromEur(x.value)),"Asset mix");
  if(group==="all" || group==="country") chart("countryChart",type,a.by_country.map(x=>x.name),a.by_country.map(x=>convertFromEur(x.value)),"Geography");
  if(group==="all" || group==="sector") chart("sectorChart",type==="doughnut"?"bar":type,a.by_sector.map(x=>x.name),a.by_sector.map(x=>convertFromEur(x.value)),"Sector exposure");
  const metric=byId("dashPerfMetric")?.value||"day";
  const top=(state.lastHoldings||[]).slice().sort((a,b)=>b.value_eur-a.value_eur).slice(0,8);
  if(top.length) chart("perfChart",type==="doughnut"?"bar":type,top.map(x=>x.symbol),top.map(x=>Number(x[metric]||0)),"Performance",{percent:true,onClick:i=>openAsset(top[i].symbol)});
}

async function loadTwin(){
  if(!document.getElementById("twinChart") && !document.getElementById("projectionChart")) return;
  let d=await get("/dashboard"+q());
  let base=d.net_worth || 100000;
  let invest=d.monthly_investment || 1000;
  const years=["2026","2028","2030","2032","2035","2040"];
  const data=years.map((y,i)=>Math.round(base*Math.pow(1.07,i*2)+invest*12*i*2));
  chart("twinChart","line",years,data,"Projected net worth");
  chart("projectionChart","line",years,data,"Projected net worth",{borderColor:palette[1],readout:{date:"mcChartDate",value:"mcChartValue",change:"mcChartChange",money:true,label:"Year",sinceLabel:"vs today"}});
}

async function loadProfiles(){
  let p=await get("/profiles");
  state.profiles=p;
  if(!state.profileBooted && !state.profile){
    const prefs=loadPrefs();
    const saved=prefs.activeProfile;   // restore the profile you were last viewing
    let target;
    if(saved===""){
      target="";
    }else if(typeof saved==="string" && saved && p.find(x=>x.id===saved)){
      target=saved;
    }else{
      const dp=(state.settings&&state.settings.defaultProfile)||"auto";
      if(dp==="auto") target=ownProfileId();
      else if(dp==="") target="";
      else target = p.find(x=>x.id===dp) ? dp : ownProfileId();
    }
    // Password-protected profiles (and family view of a protected admin) must be
    // unlocked every session — never auto-restore them on refresh.
    const lockId = prefs.onboarded ? unlockNeededFor(target) : null;
    if(lockId){ state.bootLock={target,lockId}; state.profile="__locked__"; }
    else { state.profile=target; }
    state.profileBooted=true;
  }
  profileSelect.innerHTML=`<option value="">Family wealth (all profiles)</option>`+p.map(x=>`<option value="${escAttr(x.id)}">${escapeHtml(x.name)} only</option>`).join("");
  profileSelect.value=state.profile;
  updateScopeCopy();
  renderTopProfile();
  renderProfileMenu();
  const csel=byId("profilesCurrency");
  if(csel && !csel.options.length){
    csel.innerHTML=["EUR","INR","USD","GBP","JPY","CHF","AED"].map(c=>`<option value="${c}">${c}</option>`).join("");
  }
  if(!state.profilesCurrency) state.profilesCurrency=loadPrefs().profilesCurrency||state.displayCurrency||"EUR";
  if(csel) csel.value=state.profilesCurrency;
  renderProfileCards();
  if(byId("aboutView") && !state.aboutEditing) renderAboutMe();
}
function setProfilesCurrency(cur){ state.profilesCurrency=cur||"EUR"; savePref("profilesCurrency",state.profilesCurrency); renderProfileCards(); }
function renderProfileCards(){
  const el=document.getElementById("profiles"); if(!el) return;
  const cur=state.profilesCurrency||state.displayCurrency||"EUR";
  el.innerHTML=(state.profiles||[]).map(x=>`<button class="profile" type="button" data-id="${escAttr(x.id)}" data-name="${escAttr(x.name)}" data-relation="${escAttr(x.relation)}" data-country="${escAttr(x.country)}" data-photo="${escAttr(x.photo_url||"")}">
      <div class="profileTop">${profilePhotoHtml(x)}<div><b>${escapeHtml(x.name)}${(x.has_password||x.locked)?' <span title="Password protected">🔒</span>':''}</b><div class="subtitle">${escapeHtml(x.id)} • ${escapeHtml(x.relation)} • ${escapeHtml(x.country)}</div></div></div>
      <div class="metric">${displayMoney(x.net_worth||0,cur)}</div>
      <div class="subtitle">Click to edit</div>
    </button>`).join("");
  el.querySelectorAll(".profile").forEach(card=>card.addEventListener("click",()=>selectProfileForEdit(card.dataset.id,card.dataset.name,card.dataset.relation,card.dataset.country,card.dataset.photo)));
  el.querySelectorAll(".profile").forEach(card=>card.classList.toggle("selected", card.dataset.id===state.editingProfileId));
}
function profilePhotoHtml(profile){
  const url=profile.photo_url||"";
  if(url) return `<img class="profilePhoto" src="${escAttr(url)}" alt="${escAttr(profile.name)}" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'"/><span class="profileInitials" style="display:none">${escapeHtml(profile.avatar||avatarFromName(profile.name))}</span>`;
  return `<span class="profileInitials">${escapeHtml(profile.avatar||avatarFromName(profile.name))}</span>`;
}
function setPhotoFormValue(url="",label="PNG or JPG"){
  const photo=byId("pPhoto");
  const preview=byId("pPhotoPreview");
  const name=byId("pPhotoName");
  if(photo) photo.value=url||"";
  if(preview){
    preview.innerHTML=url ? `<img src="${escAttr(url)}" alt="Profile photo preview"/>` : "+";
    preview.classList.toggle("hasImage", !!url);
  }
  if(name) name.textContent=url ? label : "PNG or JPG";
}
function readFileAsDataUrl(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(reader.result);
    reader.onerror=reject;
    reader.readAsDataURL(file);
  });
}
async function resizeImageDataUrl(file,maxSize=512,quality=.86){
  const original=await readFileAsDataUrl(file);
  if(file.type==="image/gif" || !file.type.startsWith("image/")) return original;
  return new Promise(resolve=>{
    const img=new Image();
    img.onload=()=>{
      const scale=Math.min(1,maxSize/Math.max(img.width,img.height));
      const canvas=document.createElement("canvas");
      canvas.width=Math.max(1,Math.round(img.width*scale));
      canvas.height=Math.max(1,Math.round(img.height*scale));
      const ctx=canvas.getContext("2d");
      ctx.drawImage(img,0,0,canvas.width,canvas.height);
      resolve(canvas.toDataURL("image/jpeg",quality));
    };
    img.onerror=()=>resolve(original);
    img.src=original;
  });
}
async function handleProfilePhotoUpload(event){
  const file=event.target.files && event.target.files[0];
  if(!file) return;
  if(!file.type.startsWith("image/")){
    event.target.value="";
    return profileMsg("Choose an image file for the profile photo.", "error");
  }
  if(file.size>8*1024*1024){
    event.target.value="";
    return profileMsg("Choose an image smaller than 8 MB.", "error");
  }
  try{
    profileMsg("Preparing profile photo...", "info");
    const dataUrl=await resizeImageDataUrl(file);
    setPhotoFormValue(dataUrl,file.name);
    profileMsg("Photo ready. Press Update or Create to save it.", "success");
  }catch(e){
    event.target.value="";
    profileMsg("Could not read that image. Try another file.", "error");
  }
}
function removeProfilePhoto(){
  const file=byId("pPhotoFile");
  if(file) file.value="";
  setPhotoFormValue("");
  profileMsg("Photo removed from the form. Press Update to save the change.", "info");
}
function avatarFromName(name){return String(name||"PF").split(/\s+/).map(x=>x[0]).join("").slice(0,2).toUpperCase()||"PF"}
function escapeHtml(s){return String(s||"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function escAttr(s){return escapeHtml(s)}
function jsString(s){return String(s||"").replace(/\\/g,"\\\\").replace(/'/g,"\\'").replace(/\n/g," ")}
function selectProfileForEdit(id,name,relation,country,photo=""){
  state.editingProfileId=id;
  byId("pId").value=id;
  byId("pName").value=name;
  byId("pRelation").value=relation;
  byId("pCountry").value=country;
  byId("pPassword").value="";
  const file=byId("pPhotoFile");
  if(file) file.value="";
  setPhotoFormValue(photo||"",photo ? "Current photo" : "PNG or JPG");
  const mode=byId("profileMode");
  if(mode) mode.textContent=`Editing ${id}`;
  profileMsg(`Editing ${name}. Change fields and press Update.`, "info");
  document.querySelectorAll("#profiles .profile").forEach(card=>card.classList.toggle("selected", card.dataset.id===id));
}
function clearProfileForm(){
  state.editingProfileId="";
  ["pId","pName","pRelation","pCountry","pPassword"].forEach(id=>{const node=byId(id); if(node) node.value="";});
  const file=byId("pPhotoFile");
  if(file) file.value="";
  setPhotoFormValue("");
  const mode=byId("profileMode");
  if(mode) mode.textContent="Create mode";
  profileMsg("Click a profile card below to edit it, then press Update.");
  document.querySelectorAll("#profiles .profile").forEach(card=>card.classList.remove("selected"));
}
async function createProfile(){
  const name=byId("pName").value.trim();
  if(!name) return profileMsg("Enter a profile name before creating.", "error");
  try{
    const created=await post("/profiles",{name,relation:byId("pRelation").value||"Family",country:byId("pCountry").value||"Germany",photo_url:byId("pPhoto").value.trim(),password:byId("pPassword").value.trim()});
    clearProfileForm();
    profileMsg(`Created profile ${created.name}.`, "success");
    // Land the user on the profile they just created
    state.profile=created.id;
    setSoleUnlocked(created.id);                 // just created it — no password gate this session
    savePref("activeProfile",created.id);
    if(typeof applyProfileCurrency==="function") applyProfileCurrency(created.country);
    showToast(`✓ Created "${created.name}" — switched to it`, "success");
  }
  catch(e){return profileMsg(e.message, "error")}
  await loadAll();
}
async function updateProfile(){
  const id=state.editingProfileId||byId("pId").value.trim();
  const newId=byId("pId").value.trim();
  const name=byId("pName").value.trim();
  if(!id) return profileMsg("Click a profile card first, then update.", "error");
  if(!newId) return profileMsg("Profile ID cannot be empty.", "error");
  if(!name) return profileMsg("Name cannot be empty.", "error");
  try{
    const updated=await patch("/profiles/"+encodeURIComponent(id),{id:newId,name,relation:byId("pRelation").value,country:byId("pCountry").value,photo_url:byId("pPhoto").value.trim(),password:byId("pPassword").value.trim()});
    profileMsg(`Updated ${updated.name}. Profile ID is now ${updated.id}.`, "success");
    state.editingProfileId=updated.id;
    byId("pId").value=updated.id;
    const mode=byId("profileMode");
    if(mode) mode.textContent=`Editing ${updated.id}`;
    if(state.profile===id) state.profile=updated.id;
  }
  catch(e){return profileMsg(e.message, "error")}
  await loadAll();
}
async function deleteProfile(){
  const id=state.editingProfileId||byId("pId").value.trim();
  if(!id) return profileMsg("Click a profile first.", "error");
  if(!await uiConfirm({title:"Delete profile?",message:"This permanently removes the profile. Holdings owned by this profile will no longer appear in the family view.",confirmText:"Delete profile",icon:"👤"})) return;
  try{await del("/profiles/"+encodeURIComponent(id));}
  catch(e){return profileMsg(e.message, "error")}
  clearProfileForm();
  profileMsg("Profile deleted.", "success");
  await loadAll();
}

/* ===== About Me (founder profile) ===== */
let _aboutDraftPhoto=null;
function aboutProfile(){
  const id=selectedProfile();
  return (state.profiles||[]).find(p=>p.id===id) || (state.profiles||[])[0] || null;
}
function loadAboutMe(){ if(state.aboutEditing) return; renderAboutMe(); }
function renderAboutMe(){
  const view=byId("aboutView"); if(!view) return;
  const p=aboutProfile();
  const editBtn=byId("aboutEditBtn");
  if(!p){ view.innerHTML='<div class="deskEmpty">No profile found. Create one in Profiles first.</div>'; byId("aboutEdit").style.display="none"; if(editBtn) editBtn.style.display="none"; return; }
  if(editBtn){ editBtn.style.display=""; editBtn.textContent="✎ Edit profile"; }
  state.aboutEditing=false;
  byId("aboutEdit").style.display="none";
  view.style.display="";
  const links=p.links||{};
  const linkDefs=[["website","🌐","Website"],["linkedin","in","LinkedIn"],["twitter","𝕏","X / Twitter"],["email","✉","Email"]];
  let linkHtml=linkDefs.filter(([k])=>links[k]).map(([k,icon,label])=>{
    let href=links[k]; if(k==="email") href="mailto:"+href; else if(!/^https?:\/\//.test(href)) href="https://"+href;
    return `<a class="aboutLink" href="${escAttr(href)}" target="_blank" rel="noopener"><span class="aboutLinkIcon">${icon}</span>${escapeHtml(label)}</a>`;
  }).join("");
  if(p.phone) linkHtml+=`<a class="aboutLink" href="tel:${escAttr(p.phone)}"><span class="aboutLinkIcon">📞</span>${escapeHtml(p.phone)}</a>`;
  const photo=p.photo_url?`<img class="aboutPhoto" src="${escAttr(p.photo_url)}" alt="${escAttr(p.name)}"/>`:`<div class="aboutPhoto aboutInitials">${escapeHtml(p.avatar||avatarFromName(p.name))}</div>`;
  const expertise=(p.expertise||"").split(",").map(s=>s.trim()).filter(Boolean);
  const interests=(p.interests||"").split(",").map(s=>s.trim()).filter(Boolean);
  const miles=(p.milestones||"").split("\n").map(s=>s.trim()).filter(Boolean);
  const d=state.lastDashboard||{};
  const stats=[["Net worth",displayMoney(d.net_worth||0)],["Investments",displayMoney(d.investments||0)],["Real assets",displayMoney(d.properties||0)],["Family profiles",(state.profiles||[]).length]];
  view.innerHTML=`<div class="aboutHero">${photo}<div class="aboutHeroInfo">
      <h2 class="aboutName">${escapeHtml(p.name)}</h2>
      ${(p.role||p.company)?`<div class="aboutRole">${escapeHtml(p.role||"")}${p.role&&p.company?" · ":""}${p.company?`<b>${escapeHtml(p.company)}</b>`:""}</div>`:""}
      ${p.headline?`<div class="aboutHeadline">${escapeHtml(p.headline)}</div>`:""}
      <div class="aboutChips">${p.location?`<span class="aboutChip">📍 ${escapeHtml(p.location)}</span>`:""}<span class="aboutChip">${escapeHtml(p.relation||"Family")}</span>${p.country?`<span class="aboutChip">${escapeHtml(p.country)}</span>`:""}</div>
      ${linkHtml?`<div class="aboutLinks">${linkHtml}</div>`:""}
    </div></div>
    <div class="aboutStats">${stats.map(([l,v])=>`<div class="aboutStat"><b>${escapeHtml(String(v))}</b><span>${escapeHtml(l)}</span></div>`).join("")}</div>
    ${p.motto?`<div class="aboutMotto"><span class="aboutQuoteMark">“</span>${escapeHtml(p.motto)}<span class="aboutQuoteMark">”</span></div>`:""}
    <div class="aboutGrid2">
      <div class="aboutBioCard"><h4>About</h4><p class="aboutBio">${p.bio?escapeHtml(p.bio).replace(/\n/g,"<br>"):'<span class="cfoMuted">No bio yet. Click “Edit profile” to tell your story — who you are, what you do, your founder journey, what drives you.</span>'}</p>
        ${expertise.length?`<div class="aboutSub"><h5>Focus areas</h5><div class="aboutTagRow">${expertise.map(t=>`<span class="aboutTag">${escapeHtml(t)}</span>`).join("")}</div></div>`:""}
        ${interests.length?`<div class="aboutSub"><h5>Interests</h5><div class="aboutTagRow">${interests.map(t=>`<span class="aboutTag soft">${escapeHtml(t)}</span>`).join("")}</div></div>`:""}
      </div>
      <div class="aboutBioCard"><h4>Milestones &amp; highlights</h4>${miles.length?`<ul class="aboutMiles">${miles.map(m=>`<li>${escapeHtml(m)}</li>`).join("")}</ul>`:'<p class="cfoMuted">Add career, founder or wealth milestones in the editor — one per line. They show here as a timeline.</p>'}</div>
    </div>`;
}
function renderAboutEdit(){
  const p=aboutProfile(); if(!p) return;
  _aboutDraftPhoto=p.photo_url||"";
  const links=p.links||{};
  const previewInner=_aboutDraftPhoto?`<img src="${escAttr(_aboutDraftPhoto)}"/>`:escapeHtml(p.avatar||avatarFromName(p.name));
  byId("aboutEdit").innerHTML=`<div class="aboutEditGrid">
    <div class="aboutPhotoEdit"><div class="aboutPhotoPreview" id="aboutPhotoPreview">${previewInner}</div>
      <label class="btn secondary smallBtn aboutUploadBtn">📷 Upload photo<input type="file" accept="image/*" id="aboutPhotoFile" onchange="handleAboutPhoto(event)" hidden/></label>
      <button class="btn secondary smallBtn" type="button" onclick="removeAboutPhoto()">Remove</button></div>
    <div class="aboutFields">
      <label class="aboutField"><span>Full name</span><input class="input" id="abName" value="${escAttr(p.name)}"/></label>
      <label class="aboutField"><span>Role / Title</span><input class="input" id="abRole" placeholder="e.g. Founder & CEO" value="${escAttr(p.role||"")}"/></label>
      <label class="aboutField"><span>Company / Venture</span><input class="input" id="abCompany" placeholder="e.g. Wealth OS" value="${escAttr(p.company||"")}"/></label>
      <label class="aboutField"><span>Location</span><input class="input" id="abLocation" placeholder="e.g. Munich, Germany" value="${escAttr(p.location||"")}"/></label>
      <label class="aboutField aboutFull"><span>Headline / tagline</span><input class="input" id="abHeadline" placeholder="One line that sums you up — e.g. Building tools that make wealth simple" value="${escAttr(p.headline||"")}"/></label>
      <label class="aboutField aboutFull"><span>About me / Bio</span><textarea class="input" id="abBio" rows="5" placeholder="Who are you? What do you do? Your founder story, mission, what drives you...">${escapeHtml(p.bio||"")}</textarea></label>
      <label class="aboutField"><span>Focus areas <small>(comma separated)</small></span><input class="input" id="abExpertise" placeholder="Investing, Product, Real estate" value="${escAttr(p.expertise||"")}"/></label>
      <label class="aboutField"><span>Interests <small>(comma separated)</small></span><input class="input" id="abInterests" placeholder="Markets, Travel, Chess" value="${escAttr(p.interests||"")}"/></label>
      <label class="aboutField aboutFull"><span>Milestones &amp; highlights <small>(one per line)</small></span><textarea class="input" id="abMilestones" rows="4" placeholder="2024 — Started building Wealth OS&#10;2022 — First property investment&#10;2019 — Began long-term investing journey">${escapeHtml(p.milestones||"")}</textarea></label>
      <label class="aboutField aboutFull"><span>Motto / favourite quote</span><input class="input" id="abMotto" placeholder="e.g. Time in the market beats timing the market." value="${escAttr(p.motto||"")}"/></label>
      <label class="aboutField"><span>📞 Phone</span><input class="input" id="abPhone" placeholder="+49 ..." value="${escAttr(p.phone||"")}"/></label>
      <label class="aboutField"><span>🌐 Website</span><input class="input" id="abWebsite" placeholder="yoursite.com" value="${escAttr(links.website||"")}"/></label>
      <label class="aboutField"><span>in LinkedIn</span><input class="input" id="abLinkedin" placeholder="linkedin.com/in/you" value="${escAttr(links.linkedin||"")}"/></label>
      <label class="aboutField"><span>𝕏 Twitter / X</span><input class="input" id="abTwitter" placeholder="x.com/you" value="${escAttr(links.twitter||"")}"/></label>
      <label class="aboutField"><span>✉ Email</span><input class="input" id="abEmail" placeholder="you@email.com" value="${escAttr(links.email||"")}"/></label>
    </div></div>
    <div class="modalActions"><button class="btn secondary" onclick="toggleAboutEdit()">Cancel</button><button class="btn" onclick="saveAboutMe()">Save profile</button></div>`;
}
function toggleAboutEdit(){
  if(!state.aboutEditing){ state.aboutEditing=true; renderAboutEdit(); byId("aboutEdit").style.display=""; byId("aboutView").style.display="none"; byId("aboutEditBtn").textContent="✕ Close editor"; }
  else { state.aboutEditing=false; renderAboutMe(); }
}
async function handleAboutPhoto(event){
  const file=event.target.files&&event.target.files[0];
  if(!file) return;
  if(!file.type.startsWith("image/")){ event.target.value=""; return showToast("Choose an image file for your photo.","alert"); }
  if(file.size>8*1024*1024){ event.target.value=""; return showToast("Choose an image smaller than 8 MB.","alert"); }
  try{ _aboutDraftPhoto=await resizeImageDataUrl(file); const pv=byId("aboutPhotoPreview"); if(pv) pv.innerHTML=`<img src="${escAttr(_aboutDraftPhoto)}"/>`; showToast("Photo ready — press Save to keep it.","success"); }
  catch(e){ showToast("Could not read that image. Try another file.","alert"); }
}
function removeAboutPhoto(){
  _aboutDraftPhoto="";
  const pv=byId("aboutPhotoPreview"), p=aboutProfile();
  if(pv) pv.innerHTML=escapeHtml((p&&(p.avatar||avatarFromName(p.name)))||"PF");
}
async function saveAboutMe(){
  const p=aboutProfile(); if(!p) return;
  const name=byId("abName").value.trim();
  if(!name) return showToast("Name can't be empty.","alert");
  const links={website:byId("abWebsite").value.trim(),linkedin:byId("abLinkedin").value.trim(),twitter:byId("abTwitter").value.trim(),email:byId("abEmail").value.trim()};
  try{
    await patch("/profiles/"+encodeURIComponent(p.id),{id:p.id,name,role:byId("abRole").value.trim(),company:byId("abCompany").value.trim(),location:byId("abLocation").value.trim(),bio:byId("abBio").value,links,photo_url:_aboutDraftPhoto||"",
      headline:byId("abHeadline").value.trim(),expertise:byId("abExpertise").value.trim(),interests:byId("abInterests").value.trim(),phone:byId("abPhone").value.trim(),milestones:byId("abMilestones").value,motto:byId("abMotto").value.trim()});
    state.aboutEditing=false;
    showToast("✓ Profile saved","success");
    await loadAll();
    renderAboutMe();
  }catch(e){ showToast(e.message||"Could not save profile","alert"); }
}
async function loadHoldings(){
  let h=await get("/holdings"+q());
  state.lastHoldings=h;
  renderHoldings();
}
function filterAssetRows(rows,prefix="holding"){
  const text=(byId(prefix+"Filter")?.value||"").toLowerCase();
  const type=byId(prefix+"TypeFilter")?.value||"";
  const market=byId(prefix+"MarketFilter")?.value||"";
  const minPrice=parseMoney(byId(prefix+"MinPrice")?.value||"");
  const maxPrice=parseMoney(byId(prefix+"MaxPrice")?.value||"");
  const minValue=parseMoney(byId(prefix+"MinValue")?.value||"");
  const maxValue=parseMoney(byId(prefix+"MaxValue")?.value||"");
  const metric=byId(prefix+"PerfMetric")?.value||"day";
  const minPerf=Number(byId(prefix+"MinPerf")?.value||"");
  const maxPerf=Number(byId(prefix+"MaxPerf")?.value||"");
  return (rows||[]).filter(a=>
    (!text || `${a.name} ${a.symbol} ${a.type} ${a.country} ${a.market} ${a.sector} ${a.broker}`.toLowerCase().includes(text)) &&
    (!type || a.type===type) &&
    (!market || a.market===market) &&
    (!minPrice || Number(a.price||0)>=minPrice) &&
    (!maxPrice || Number(a.price||0)<=maxPrice) &&
    (!minValue || Number(a.value_eur||0)>=minValue) &&
    (!maxValue || Number(a.value_eur||0)<=maxValue) &&
    (!minPerf || Number(a[metric]||0)>=minPerf) &&
    (!maxPerf || Number(a[metric]||0)<=maxPerf)
  );
}
function renderHoldings(){
  const metric=byId("holdingPerfMetric")?.value||"day";
  const rows=filterAssetRows(state.lastHoldings||[],"holding");
  table("holdings",["Asset","Qty","Value","P/L","Day","Week","Month","Year","Source"],rows.map(a=>[
    `<span class="ticker" title="${escAttr(a.movement_reason||"Open full asset detail")}" onclick="openAsset('${a.symbol}')">${escapeHtml(a.symbol)}</span><div class="assetName">${escapeHtml(a.name)} • ${escapeHtml(a.market||"")}</div>`,
    a.qty,
    `${a.currency} ${Number(a.value).toLocaleString()}<div class="assetName">${displayMoney(a.value_eur)}</div>`,
    `<span class="${cls(a.pl_eur)}">${displayMoney(a.pl_eur)} (${pct(a.pl_pct)})</span>`,
    `<span class="${cls(a.day)}">${pct(a.day)}</span>`,
    `<span class="${cls(a.week)}">${pct(a.week)}</span>`,
    `<span class="${cls(a.month)}">${pct(a.month)}</span>`,
    `<span class="${cls(a.year)}">${pct(a.year)}</span>`,
    a.source
  ]));
  if(byId("holdingsMiniChart")){
    const top=rows.slice().sort((a,b)=>Math.abs(Number(b[metric]||0))-Math.abs(Number(a[metric]||0))).slice(0,12);
    chart("holdingsMiniChart",byId("holdingChartType")?.value||"bar",top.map(x=>x.symbol),top.map(x=>Number(x[metric]||0)),`Holdings ${metric}`,{percent:true,onClick:i=>openAsset(top[i].symbol)});
  }
}
function renderPortfolioMix(){
  const a=state.lastPortfolioAllocation;
  if(!a||!byId("portfolioMixChart")) return;
  const group=byId("portfolioMixGroup")?.value||"by_type";
  const data=(a[group]||[]).slice().filter(x=>Number(x.value)>0).sort((x,y)=>y.value-x.value);
  const total=data.reduce((s,x)=>s+Number(x.value||0),0)||1;
  const top=data.slice(0,8);
  chart("portfolioMixChart","doughnut",top.map(x=>x.name),top.map(x=>convertFromEur(x.value)),"Mix");
  const leg=byId("portfolioMixLegend");
  if(leg){
    leg.innerHTML=top.length?top.map((x,i)=>`<div class="mixLegendRow"><span class="mixDot" style="background:${palette[i%palette.length]}"></span><span class="mixName" title="${escAttr(x.name)}">${escapeHtml(x.name)}</span><span class="mixPct">${(x.value/total*100).toFixed(1)}%</span><span class="mixVal">${displayMoney(x.value)}</span></div>`).join("")
      :`<div class="mixEmpty">No holdings to break down yet.</div>`;
  }
}
async function loadPortfolio(){
  const holdingRows=await get("/holdings"+q());
  state.lastHoldings=holdingRows;
  const allocation=await get("/allocations"+q());
  state.lastPortfolioAllocation=allocation;
  renderPortfolioMix();
  const rows=filterAssetRows(holdingRows,"portfolio");
  table("portfolioHoldings",["Asset","Market","Qty","Avg","Value","Broker","Actions"],rows.map(a=>[
    `<span class="ticker" title="${escAttr(a.movement_reason||"Open full asset detail")}" onclick="openAsset('${a.symbol}')">${escapeHtml(a.symbol)}</span><div class="assetName">${escapeHtml(a.name)}</div>`,
    `${escapeHtml(a.market||"GLOBAL")}<div class="assetName">${escapeHtml(a.market_name||a.country||"")}</div>`,
    a.qty,
    `${a.currency} ${Number(a.avg||0).toLocaleString()}`,
    `${a.currency} ${Number(a.value||0).toLocaleString()}<div class="assetName">${displayMoney(a.value_eur)}</div>`,
    escapeHtml(a.broker||""),
    `<div class="actionStack"><button class="btn secondary smallBtn" onclick="editHolding('${escapeHtml(a.symbol)}')">Edit</button><button class="btn secondary smallBtn" onclick="sellHolding('${escapeHtml(a.symbol)}')">Sell</button><button class="btn secondary smallBtn" onclick="deleteHolding('${encodeURIComponent(a.symbol)}')">Delete</button></div>`
  ]));
  const cashRows=await get("/cashflow"+q());
  state.cashflowRows=cashRows;
  renderCashflowTable();
  const cashAccounts=await get("/cash-accounts"+q());
  state.cashAccounts=cashAccounts;
  table("cashAccountsTable",["Account","Bank / wallet","Type","Balance","EUR",""],cashAccounts.map(c=>[
    escapeHtml(c.name), c.bank?escapeHtml(c.bank):'<span class="cfoMuted">—</span>', escapeHtml(c.type), `${escapeHtml(c.currency)} ${Number(c.balance||0).toLocaleString()}`, euro(c.balance_eur), c.id?`<button class="btn secondary" onclick="deleteCashAccount(${Number(c.id)})">Delete</button>`:"Seed row"
  ]));
  renderMissionAssetSummary();
}
async function loadProperties(){
  if(!byId("propertyTable")) return;
  state.propertyRows=await get("/properties"+q());
  renderPropertiesTable();
  renderMissionAssetSummary();
}
function renderCashflowTable(){
  if(!byId("cashflowTable")) return;
  const text=(byId("cashflowFilter")?.value||"").toLowerCase();
  const type=byId("cashflowTypeFilter")?.value||"";
  const month=(byId("cashflowMonthFilter")?.value||"").toLowerCase();
  const rows=(state.cashflowRows||[]).filter(c=>
    (!text || `${c.category} ${c.type} ${c.currency}`.toLowerCase().includes(text)) &&
    (!type || c.type===type) &&
    (!month || `${c.date} ${c.month} ${c.year} ${c.period}`.toLowerCase().includes(month))
  ).sort((a,b)=>String(b.date||"").localeCompare(String(a.date||"")));
  const income=rows.filter(c=>c.type==="income").reduce((s,c)=>s+Number(c.amount||0),0);
  const expense=rows.filter(c=>c.type==="expense").reduce((s,c)=>s+Number(c.amount||0),0);
  const investment=rows.filter(c=>c.type==="investment").reduce((s,c)=>s+Number(c.amount||0),0);
  const summary=byId("cashflowSummary");
  if(summary) summary.innerHTML=[
    `<span><b>${rows.length}</b><small>Rows</small></span>`,
    `<span class="green"><b>${Number(income).toLocaleString()}</b><small>Income</small></span>`,
    `<span class="red"><b>${Number(expense).toLocaleString()}</b><small>Expenses</small></span>`,
    `<span><b>${Number(investment).toLocaleString()}</b><small>Invested</small></span>`
  ].join("");
  const periods=[...new Set(rows.map(c=>c.period||`${c.year}-${String(c.month_num||1).padStart(2,"0")}`))].sort().slice(-8);
  const periodNet=periods.map(p=>rows.filter(c=>(c.period||"")===p).reduce((s,c)=>s+(c.type==="expense"?-Number(c.amount||0):Number(c.amount||0)),0));
  if(byId("cashflowChart")) chart("cashflowChart","bar",periods,periodNet,"Cashflow net");
  table("cashflowTable",["Date","Category","Type","Amount",""],rows.map(c=>[
    `${escapeHtml(c.date||"-")}<div class="assetName">${escapeHtml(c.month||"")} ${escapeHtml(String(c.year||""))}</div>`,
    `<b>${escapeHtml(c.category)}</b><div class="assetName">${escapeHtml(c.period||"")}</div>`,
    `<span class="${c.type==="income"?"green":c.type==="expense"?"red":""}">${escapeHtml(c.type)}</span>`,
    `${escapeHtml(c.currency)} ${Number(c.amount||0).toLocaleString()}`,
    c.id?`<div class="actionStack"><button class="btn secondary smallBtn" onclick="editCashflow(${Number(c.id)})">Edit</button><button class="btn secondary smallBtn" onclick="deleteCashflow(${Number(c.id)})">Delete</button></div>`:"Seed"
  ]));
}
function propertyLocalForecast(p){
  if((p.status||"active")!=="active") return 0;
  const growth=Number(p.model_growth ?? p.growth ?? 0);
  const target=Number(p.forecast_year||new Date().getFullYear()+5);
  const years=Math.max(target-new Date().getFullYear(),0);
  return Number(p.value||0)*Math.pow(1+growth/100,years)-Number(p.loan||0);
}
function propertyMapLink(location){
  const q=String(location||"").trim();
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : "";
}
function assetMonthlyLabel(p){
  const value=Number(p.monthly_value_change||0);
  const label=p.category==="Car" ? "Monthly depreciation" : "Monthly model move";
  return `${label}: ${money(value,p.currency)}`;
}
function valuationAiText(p){
  return p.valuation_ai?.summary || p.analysis_precise || p.analysis || "";
}
function valuationSources(p){
  const sources=p.valuation_ai?.price_sources || [];
  return sources.length ? sources.slice(0,3).join(" • ") : "";
}
function boughtText(p){
  const raw=p.purchase_date||p.purchase_year||"";
  const amount=`${escapeHtml(p.currency)} ${Number(p.purchase_value||0).toLocaleString()}`;
  if(!raw) return `Purchase price ${amount}`;
  const label=String(raw).includes("-") ? "Bought on" : "Bought in";
  return `${label} ${escapeHtml(raw)} for ${amount}`;
}
function propertyForecastCell(p){
  const cur=p.currency;
  if(p.category==="FD") return `<b>${money(p.maturity_value,cur)}</b><div class="assetName">Matures ${escapeHtml(p.maturity_date||"—")} · ${p.interest_rate||0}% p.a.</div>`;
  if(p.category==="Physical Gold"||p.category==="Physical Silver") return `<span class="cfoMuted">Live spot</span><div class="assetName">Tracks market price — no growth model</div>`;
  if(p.category==="Diamond") return `<span class="cfoMuted">Appraised</span><div class="assetName">No live price feed</div>`;
  return `<span title="Forecast in local currency based on model growth">${money(propertyLocalForecast(p),cur)}</span><div class="assetName">Model ${pct(p.model_growth)} • ${escapeHtml(assetMonthlyLabel(p))} • Target ${escapeHtml(p.forecast_year||"-")}</div>`;
}
function propertyAnalysisCell(p){
  const note=valuationAiText(p);
  if(["Physical Gold","Physical Silver","Diamond","FD"].includes(p.category))
    return `<div class="reasonText" title="${escAttr(note)}">${escapeHtml(note)}</div>`;
  return `<div class="reasonText" title="${escAttr(p.sale_guidance||note||"")}">${escapeHtml(note)}<br><b>Sources:</b> ${escapeHtml(valuationSources(p)||"Manual value; add comparable/API data for tighter pricing")}<br><b>Sell idea:</b> ${escapeHtml(money(p.suggested_sale_price,p.currency))} • tax est. ${escapeHtml(money(p.estimated_tax,p.currency))}</div>`;
}
function renderPropertiesTable(){
  if(!byId("propertyTable")) return;
  ensurePropertyLayout();
  const text=(byId("propertyFilter")?.value||"").toLowerCase();
  const type=byId("propertyTypeFilter")?.value||"";
  const currency=byId("propertyCurrencyFilter")?.value||"";
  const rows=state.propertyRows.filter(p=>
    (!text || `${p.category} ${p.location} ${p.analysis}`.toLowerCase().includes(text)) &&
    (!type || p.category===type) &&
    (!currency || p.currency===currency)
  );
  renderPropertyChart(rows);
  renderPropertyDetailCards(rows);
  renderPropertyAssetCards(rows);
  table("propertyTable",["Property","Location","Value","Profit / Loss","Forecast","Analysis","Actions"],rows.map(p=>{
    const cost=Number(p.all_in_cost||p.purchase_value||0);
    const gp=cost>0?(Number(p.gain||0)/cost*100):0;
    const plCell=cost>0
      ? `<b class="${cls(p.gain)}">${Number(p.gain||0)>=0?"+":""}${money(p.gain,p.currency)}</b><div class="assetName ${cls(p.gain)}">${gp>=0?"+":""}${gp.toFixed(1)}%${p.metal_live?" • live spot":""}</div>`
      : `<span class="cfoMuted">—</span><div class="assetName">Add bought price to see P/L</div>`;
    return [
    `<div class="assetBadge"><span>${assetIcon(p.category)}</span><b>${escapeHtml(p.category||"Property")}</b> ${propertyStatusBadge(p)}</div><div class="assetName">${valuableMeta(p)}${boughtText(p)}${dispositionMeta(p)}</div>`,
    `<span title="${escAttr(p.location)}">${escapeHtml(p.location||"—")}</span>${(propertyMapLink(p.location) && !["Physical Gold","Physical Silver","Diamond","FD"].includes(p.category))?`<div class="assetName"><a href="${propertyMapLink(p.location)}" target="_blank" rel="noreferrer">Open map</a> • Score ${Number(p.valuation_score||0).toFixed(0)}/100</div>`:""}`,
    `<span title="Local currency current value minus loan">${money(p.status==="active" ? Number(p.value||0)-Number(p.loan||0) : 0,p.currency)}</span><div class="assetName">${p.per_gram?`${money(p.per_gram,p.currency)}/g ${p.metal_live?"· live":"· your rate"}`:(p.metal_live?"live spot":`Yield ${pct(p.rental_yield)}`)}</div>`,
    plCell,
    propertyForecastCell(p),
    propertyAnalysisCell(p),
    `<div class="actionStack"><button class="btn secondary smallBtn" onclick="editProperty(${Number(p.id)})">Edit</button>${p.status==="active"?`<button class="btn smallBtn" title="${escAttr(p.sale_guidance||"Estimate sale price, tax and cash proceeds")}" onclick="openDisposeProperty(${Number(p.id)})">Sell / Gift</button>`:""}<button class="btn secondary smallBtn" onclick="deleteProperty(${Number(p.id)})">Delete</button></div>`
  ];}));
}
function ensurePropertyLayout(){
  const chartCard=byId("propertyChart")?.closest(".card");
  if(chartCard){
    chartCard.classList.remove("c5");
    chartCard.classList.add("c12","propertyOverviewCard");
    const chartBox=chartCard.querySelector(".chartBox");
    if(chartBox) chartBox.classList.add("propertyChartBox");
  }
  const tableCard=byId("propertyTable")?.closest(".card");
  if(tableCard){
    tableCard.classList.remove("c7");
    tableCard.classList.add("c12");
  }
  if(byId("propertyTable") && !byId("propertyCardGrid")){
    const grid=document.createElement("div");
    grid.id="propertyCardGrid";
    grid.className="propertyCardGrid";
    byId("propertyTable").before(grid);
  }
}
function renderPropertyDetailCards(rows){
  const box=byId("propertyDetailGrid");
  if(!box) return;
  const total=rows.reduce((s,p)=>s+Number(p.value_eur||0),0);
  const forecast=rows.reduce((s,p)=>s+Number(p.forecast_value_eur||0),0);
  const active=rows.filter(p=>(p.status||"active")==="active").length;
  const top=rows.slice().sort((a,b)=>Number(b.value_eur||0)-Number(a.value_eur||0))[0];
  box.innerHTML=[
    propertyInfoCard("◆","Total value",displayMoney(total),`${active} active item${active===1?"":"s"}`),
    propertyInfoCard("↗","Forecast",displayMoney(forecast),`${rows.length} tracked asset${rows.length===1?"":"s"}`),
    propertyInfoCard("⌂","Top asset",top?money(Number(top.value||0)-Number(top.loan||0),top.currency):"-",top?`${top.category} • ${top.location||"No location"}`:"Add a property or valuable"),
    propertyInfoCard("🔑","Rental income/yr",displayMoney(rows.reduce((s,p)=>s+Number(p.rental_income_eur||0),0)),`${rows.filter(p=>p.is_rented).length} rented • avg yield ${pct(rows.length?rows.reduce((s,p)=>s+Number(p.rental_yield||0),0)/rows.length:0)}`)
  ].join("");
}
function propertyInfoCard(icon,label,value,note){
  return `<div class="propertyInfoCard"><span>${escapeHtml(icon)}</span><div><small>${escapeHtml(label)}</small><b>${escapeHtml(value)}</b><em>${escapeHtml(note)}</em></div></div>`;
}
function renderPropertyAssetCards(rows){
  const box=byId("propertyCardGrid");
  if(!box) return;
  if(!rows.length){
    box.innerHTML=`<div class="emptyState">Add a property, plot, vehicle, or valuable to see richer details here.</div>`;
    return;
  }
  box.innerHTML=rows.map(p=>{
    const localValue=money((p.status==="active"?Number(p.value||0)-Number(p.loan||0):0),p.currency);
    const forecast=money(propertyLocalForecast(p),p.currency);
    const meta=[p.location, p.area, p.bedrooms?`${p.bedrooms} bed`:""].filter(Boolean).join(" • ");
    const map=propertyMapLink(p.location);
    return `<article class="propertyAssetCard">
      <div class="propertyAssetTop"><span>${assetIcon(p.category)}</span><div><b>${escapeHtml(p.category||"Asset")}</b><small>${escapeHtml(meta||"No location added")}</small></div>${propertyStatusBadge(p)}</div>
      <div class="propertyAssetValue">${escapeHtml(localValue)}</div>
      <div class="propertyAssetStats">
        <span><small>Forecast</small><b>${escapeHtml(forecast)}</b></span>
        <span><small>${p.category==="Car"?"Monthly loss":"Monthly move"}</small><b class="${cls(p.monthly_value_change)}">${escapeHtml(money(p.monthly_value_change,p.currency))}</b></span>
        <span><small>${Number(p.valuation_score||0)?"Location score":"Model growth"}</small><b>${Number(p.valuation_score||0)?`${Number(p.valuation_score||0).toFixed(0)}/100`:pct(p.model_growth)}</b></span>
      </div>
      <p>${escapeHtml(valuationAiText(p)||"Add location, date, value and notes to improve analysis.")}</p>
      <em>${escapeHtml(valuationSources(p)||"Manual value; external price API not configured")}</em>
      <em>${boughtText(p)}${map?` • <a href="${map}" target="_blank" rel="noreferrer">Open map</a>`:""}</em>
      ${propertyRentalHtml(p)}
      ${propertyTaxHtml(p)}
      <div class="propertyAssetActions">${p.status==="active"?`<button class="btn propertyPrimaryAction" onclick="openDisposeProperty(${Number(p.id)})">Sell / Gift</button>`:""}<button class="btn secondary propertyDangerAction" onclick="deleteProperty(${Number(p.id)})">Delete</button></div>
    </article>`;
  }).join("");
}
function propertyRentalHtml(p){
  if(!(p.is_rented || (p.rental_status && p.rental_status!=="Self-occupied") || Number(p.rent||0)>0)) return "";
  const status=p.rental_status||"Rented out";
  const bits=[`<b>🔑 ${escapeHtml(status)}</b>`];
  if(Number(p.rental_income_year||0)>0) bits.push(`Rent ${escapeHtml(money(p.rental_income_year,p.currency))}/yr (${escapeHtml(displayMoney(p.rental_income_eur))})`);
  if(Number(p.net_rental_yield||0)) bits.push(`net yield ${pct(p.net_rental_yield)}`);
  if(p.tenant) bits.push(`tenant ${escapeHtml(p.tenant)}`);
  if(p.lease_end) bits.push(`lease to ${escapeHtml(p.lease_end)}`);
  if(Number(p.deposit||0)) bits.push(`deposit ${escapeHtml(money(p.deposit,p.currency))}`);
  return `<div class="propertyRental">${bits.join(" • ")}</div>`;
}
function propertyTaxHtml(p){
  const t=p.tax;
  if(!t) return "";
  const parts=[];
  if(Number(t.estimated_sale_tax||0)) parts.push(`Sale CGT est. ${escapeHtml(money(t.estimated_sale_tax,p.currency))}`);
  if(Number(t.estimated_rental_tax_year||0)) parts.push(`Rental tax/yr ${escapeHtml(money(t.estimated_rental_tax_year,p.currency))}`);
  if(Number(t.annual_property_tax||0)) parts.push(`Annual ${escapeHtml(money(t.annual_property_tax,p.currency))}`);
  const note=t.sale_capital_gains_note||"";
  return `<details class="propertyTax"><summary>🧾 Tax view (${escapeHtml(t.region)})${parts.length?` — ${escapeHtml(parts.join(" • "))}`:""}</summary>
    <div class="propertyTaxBody">
      <p><b>On sale:</b> ${escapeHtml(note)}</p>
      <p><b>Rental income:</b> ${escapeHtml(t.rental_income_tax_note||"")}</p>
      <p><b>Annual:</b> ${escapeHtml(t.annual_note||"")}</p>
      <p class="taxDisclaimer">${escapeHtml(t.disclaimer||"")}</p>
    </div></details>`;
}
function assetIcon(category=""){
  if(["House","Flat","Villa","Bungalow","Commercial","Future Property"].includes(category)) return "🏠";
  if(["Plot","Land"].includes(category)) return "▧";
  if(category==="Physical Gold") return "Au";
  if(category==="Physical Silver") return "Ag";
  if(category==="Car") return "🚗";
  return "◆";
}
function renderPropertyChart(rows){
  if(!byId("propertyChart")) return;
  const metric=byId("propertyGraphMetric")?.value||"projection";
  if(metric==="projection") return renderPropertyProjection(rows);
  const type=byId("propertyGraphType")?.value||"bar";
  const sorted=rows.slice().sort((a,b)=>Number(b[metric]||0)-Number(a[metric]||0)).slice(0,10);
  chart("propertyChart",type,sorted.map(p=>`${assetIcon(p.category)} ${p.category}`),sorted.map(p=>metric.endsWith("_eur")?convertFromEur(p[metric]):Number(p[metric]||0)),`Properties ${metric}`);
}
function renderPropertyProjection(rows){
  const el=byId("propertyChart");
  if(!el) return;
  const active=rows.filter(p=>(p.status||"active")==="active" && Number(p.value_eur||0)>0);
  if(!window.Chart || !active.length){
    return chart("propertyChart","bar",active.map(p=>`${assetIcon(p.category)} ${p.category}`),active.map(p=>convertFromEur(p.value_eur)),"Value");
  }
  const nowYear=new Date().getFullYear();
  let span=0;
  active.forEach(p=>{ span=Math.max(span, (Number(p.forecast_year)||nowYear+5)-nowYear); });
  span=Math.max(3,Math.min(span,15));
  const years=Array.from({length:span+1},(_,k)=>nowYear+k);
  const top=active.slice().sort((a,b)=>Number(b.value_eur||0)-Number(a.value_eur||0)).slice(0,8);
  if(state.charts["propertyChart"]) state.charts["propertyChart"].destroy();
  const textColor=getComputedStyle(document.body).getPropertyValue("--text").trim();
  const mutedColor=getComputedStyle(document.body).getPropertyValue("--muted").trim();
  const gridColor=getComputedStyle(document.body).getPropertyValue("--grid").trim()||"rgba(255,255,255,.08)";
  const greenC=getComputedStyle(document.body).getPropertyValue("--green").trim()||"#35d18a";
  const redC=getComputedStyle(document.body).getPropertyValue("--red").trim()||"#f06464";
  const datasets=top.map((p,i)=>{
    const g=Number(p.model_growth||0)/100;
    const start=convertFromEur(p.value_eur||0);
    const data=years.map((_,k)=>Math.round(start*Math.pow(1+g,k)));
    const depreciating=g<0;
    const color=depreciating?redC:(palette[i%palette.length]);
    return {
      label:`${assetIcon(p.category)} ${p.category}${p.location?" • "+String(p.location).split(",")[0]:""} (${p.model_growth>=0?"+":""}${Number(p.model_growth||0).toFixed(1)}%/yr)`,
      data, borderColor:color, backgroundColor:"transparent",
      borderWidth:depreciating?2.5:2, borderDash:depreciating?[6,4]:[], tension:.25,
      pointRadius:0, pointHoverRadius:4
    };
  });
  const cur=state.displayCurrency||"EUR";
  state.charts["propertyChart"]=new Chart(el,{
    type:"line",
    data:{labels:years, datasets},
    options:{responsive:true,maintainAspectRatio:false,animation:{duration:520},interaction:{mode:"index",intersect:false},
      plugins:{legend:{display:true,position:"bottom",labels:{color:textColor,boxWidth:9,usePointStyle:true,pointStyle:"circle",padding:12,font:{size:10}}},
        tooltip:{backgroundColor:"rgba(15,23,42,.96)",padding:11,cornerRadius:8,borderColor:"rgba(148,163,184,.25)",borderWidth:1,titleColor:"#fff",bodyColor:"#e2e8f0",usePointStyle:true,
          callbacks:{label:(ctx)=>` ${ctx.dataset.label.split(" (")[0]}: ${cur} ${Number(ctx.raw||0).toLocaleString()}`}}},
      scales:{x:{ticks:{color:mutedColor,font:{size:11}},grid:{display:false}},y:{ticks:{color:mutedColor,maxTicksLimit:6,font:{size:11},callback:v=>shortNum(v)},grid:{color:gridColor},grace:"6%"}}
    },
    plugins:(typeof wosCrosshairPlugin!=="undefined")?[wosCrosshairPlugin]:[]
  });
}
function renderAssetSpecificHints(){
  const category=byId("prCategory")?.value||"";
  state.metalManual=false;
  const hints={
    "Car":"Car mode: depreciation is estimated from registration year, mileage, condition, service/insurance cost and current resale value. Leave growth blank to let the model estimate monthly value loss.",
    "Physical Gold":"Gold mode: fill storage location, current value, bought price/date, weight, unit, purity and form. House fields are hidden.",
    "Physical Silver":"Silver mode: fill storage location, current value, bought price/date, weight, unit, purity and form. House fields are hidden.",
    "Plot":"Plot mode: valuation uses exact address, survey/size, road access, metro/transit, hospital, mall/market, school, police, grocery, comparable rate and rental demand.",
    "Land":"Land mode: valuation uses village/survey number, acreage, road/water/soil, nearby services, comparable rate and demand. These inputs create the AI location score.",
    "FD":"Fixed Deposit mode: enter the bank, deposit amount (principal), interest rate %, start date and maturity date. We compound it (quarterly) to today's value and show interest earned, maturity value and profit.",
  };
  const realEstate="House/flat mode: valuation uses address, area, bedrooms, rent, loan, renovation, nearby metro/transit, hospital, mall, school, police, grocery, comparable rate and rental demand.";
  const box=byId("assetSpecificHints");
  if(box) box.textContent=hints[category]||realEstate;
  const placeholders={
    "Car":{loc:"Registration city / where car is kept",value:"Current resale value",purchase:"Bought price",valuation:"Last valuation / inspection date",loan:"Car loan left",maintenance:"Yearly service + insurance",area:"Engine / fuel / service notes",qty:"Number of cars",unit:"unit",maker:"Car maker e.g. Toyota",model:"Model e.g. Innova Hycross",reg:"Registration year",growth:"Manual depreciation % p.a. optional"},
    "Physical Gold":{loc:"Storage (optional): locker / home",value:"Current gold value",purchase:"Bought value / invoice amount",valuation:"Last valuation date",area:"Certificate / invoice notes",qty:"Weight",unit:"grams",maker:"Purity e.g. 24K",model:"Form e.g. jewellery / coin / bar"},
    "Physical Silver":{loc:"Storage (optional): locker / home",value:"Current silver value",purchase:"Bought value / invoice amount",valuation:"Last valuation date",area:"Certificate / invoice notes",qty:"Weight",unit:"grams",maker:"Purity e.g. 999",model:"Form e.g. coin / bar / jewellery"},
    "Diamond":{loc:"Storage (optional): locker / home",value:"Appraised value",purchase:"Bought value / invoice amount",valuation:"Last appraisal date",area:"Certificate no. (GIA/IGI) / notes",qty:"Carat (ct)",unit:"carat",maker:"Colour & clarity e.g. G VVS1",model:"Cut / shape e.g. Round brilliant"},
    "Plot":{loc:"Exact address / survey number",value:"Current land value",purchase:"Bought value",valuation:"Latest valuation date",area:"Plot size and zoning",qty:"Area number",unit:"sqft",maker:"Road access / frontage",model:"Residential / commercial",growth:"Expected appreciation % p.a."},
    "Land":{loc:"Village / survey number",value:"Current land value",purchase:"Bought value",valuation:"Latest valuation date",area:"Acres and zoning",qty:"Land size",unit:"acre",maker:"Soil / water / road",model:"Agricultural / NA",growth:"Expected appreciation % p.a."}
  };
  const p=placeholders[category]||{loc:"Full property address for map valuation",value:"Current market value e.g. 1cr, 520000",purchase:"Bought for e.g. 45L",valuation:"Current valuation date",loan:"Home loan left",renovation:"Renovation / stamp / registry cost",tax:"Yearly property tax",maintenance:"Yearly society / maintenance",area:"Area e.g. 1250 sqft",qty:"",unit:"",maker:"Builder / developer / quality",model:"Property notes / furnishing",reg:"",growth:"Manual growth % optional"};
  if(byId("prLocation")) prLocation.placeholder=p.loc;
  if(byId("prValue")) prValue.placeholder=p.value||"Current value";
  if(byId("prPurchaseValue")) prPurchaseValue.placeholder=p.purchase||"Bought for";
  if(byId("prValuationDate")) prValuationDate.title=p.valuation||"Valuation date";
  if(byId("prLoan")) prLoan.placeholder=p.loan||"Loan left";
  if(byId("prRenovation")) prRenovation.placeholder=p.renovation||"Renovation / stamp / registry cost";
  if(byId("prYearlyTax")) prYearlyTax.placeholder=p.tax||"Yearly tax";
  if(byId("prMaintenance")) prMaintenance.placeholder=p.maintenance||"Yearly maintenance";
  if(byId("prArea")) prArea.placeholder=p.area;
  if(byId("prQuantity")) prQuantity.placeholder=p.qty;
  if(byId("prMaker")) prMaker.placeholder=p.maker;
  if(byId("prModel")) prModel.placeholder=p.model;
  if(byId("prRegYear")) prRegYear.placeholder=p.reg;
  if(byId("prGrowth")) prGrowth.placeholder=p.growth||"Growth % p.a.";
  if(byId("prUnit") && p.unit) prUnit.value=p.unit;
  applyAssetFieldVisibility(category);
  updateAssetMarketRate();
}
/* ===== live "market reference" rate while adding a property ===== */
const _GRAMS_PER={gram:1,g:1,gm:1,gms:1,grams:1,kg:1000,tola:11.6638,oz:31.1035,ounce:31.1035,pavan:8,sovereign:8};
function _purityFactor(maker,isGold){
  const m=String(maker||"").toLowerCase();
  let mm=m.match(/(\d{1,2})\s*k/); if(mm) return Math.min(1,+mm[1]/24);
  mm=m.match(/\b(\d{3})\b/); if(mm) return Math.min(1,+mm[1]/1000);
  mm=m.match(/(\d{2}\.\d)/); if(mm) return Math.min(1,+mm[1]/100);
  return isGold?1:0.999;
}
async function updateAssetMarketRate(){
  const box=byId("assetMarketRate"); if(!box) return;
  const cat=byId("prCategory")?.value||""; const cur=byId("prCurrency")?.value||"INR";
  const sym={EUR:"€",USD:"$",INR:"₹",GBP:"£",AED:"د.إ "}[cur]||(cur+" ");
  const fmt=v=>sym+Number(v||0).toLocaleString(cur==="INR"?"en-IN":"en-US",{maximumFractionDigits:0});
  if(cat==="Physical Gold"||cat==="Physical Silver"){
    const isGold=cat==="Physical Gold";
    let r=null; try{ r=await get("/metal-rates?currency="+encodeURIComponent(cur)); }catch(e){}
    const m=r?(isGold?r.gold:r.silver):null;
    const wt=Number(byId("prQuantity")?.value||0), unit=(byId("prUnit")?.value||"gram").toLowerCase();
    const grams=wt*( _GRAMS_PER[unit]||1 ), purity=_purityFactor(byId("prMaker")?.value,isGold);
    const est = m? grams*purity*m.per_gram : 0;
    box.style.display="block";
    box.innerHTML=`<div class="mrTitle">📈 Live ${isGold?"gold":"silver"} rate <span class="mrLive">live</span></div>`+
      (m?`<div class="mrRow"><span>${fmt(m.per_gram)}/g</span><span>${fmt(m.per_10g)}/10g</span><span>$${m.usd_oz.toLocaleString()}/oz</span></div>`:'<div class="mrMuted">Rate unavailable right now.</div>')+
      (est>0?`<div class="mrEst">Your ${grams.toFixed(0)}g × ${purity.toFixed(3)} purity ≈ <b>${fmt(est)}</b> <button type="button" class="btn secondary smallBtn" onclick="applyMetalValue(${est.toFixed(2)})">Use this value</button></div>`:'<div class="mrMuted">Enter weight, unit & purity (e.g. 24K) to auto-value it.</div>')+
      `<label class="mrManual"><input type="checkbox" ${state.metalManual?"checked":""} onchange="state.metalManual=this.checked"> Pin my own value instead (ignore live spot — useful if local retail rate differs)</label>`;
    return;
  }
  if(cat==="Diamond"){
    const ct=Number(byId("prQuantity")?.value||0);
    box.style.display="block";
    box.innerHTML=`<div class="mrTitle">💎 Diamond guide <span class="mrEstTag">indicative</span></div>`+
      `<div class="mrMuted">Diamonds are priced by the 4Cs (carat, cut, colour, clarity). There's no free live feed — enter your <b>appraised value</b>. ${ct?`Rough guide for ${ct}ct: a quality 1ct ≈ $4,000–7,000; value scales steeply with size.`:""}</div>`;
    return;
  }
  if(["Flat","House","Villa","Bungalow","Commercial","Plot","Land","Future Property"].includes(cat)){
    const area=parseMoney(byId("prArea")?.value||"")||Number((byId("prArea")?.value||"").replace(/[^\d.]/g,""))||0;
    const rate=parseMoney(byId("prComparableRate")?.value||"")||0;
    box.style.display="block";
    const est=area&&rate?area*rate:0;
    box.innerHTML=`<div class="mrTitle">🏠 Area-rate estimate <span class="mrEstTag">your rate</span></div>`+
      `<div class="mrMuted">No free per-locality price API exists, so enter the <b>comparable rate</b> (${sym}/sqft or /unit) for the area. We'll compute value = area × rate.</div>`+
      (est>0?`<div class="mrEst">${area.toLocaleString()} × ${fmt(rate)} ≈ <b>${fmt(est)}</b> <button type="button" class="btn secondary smallBtn" onclick="applyMetalValue(${est.toFixed(2)})">Use this value</button></div>`:"");
    return;
  }
  if(cat==="Car"){
    box.style.display="block";
    box.innerHTML=`<div class="mrTitle">🚗 Resale estimate <span class="mrEstTag">depreciation model</span></div><div class="mrMuted">No free per-car valuation API exists. We estimate resale from <b>brand, model, registration year, mileage and condition</b> — fill those and enter today's value if you know it.</div>`;
    return;
  }
  box.style.display="none";
}
function applyMetalValue(v){ if(byId("prValue")){ prValue.value=Math.round(v); showToast("Value applied ✓","success"); } }
function assetFieldSets(category){
  const common=["prCategory","prLocation","prValue","prPurchaseValue","prPurchaseDate","prPurchaseYear","prValuationDate","prCurrency"];
  const locationAi=["prMainRoad","prMetro","prHospital","prMall","prSchool","prPolice","prGrocery","prTransit","prComparableRate","prRentalDemand"];
  const realEstate=["prForecastYear","prLoan","prRenovation","prYearlyTax","prMaintenance","prArea","prMaker","prModel","prBedrooms","prRentalStatus","prRent","prTenant","prLeaseEnd","prDeposit","prGrowth",...locationAi];
  const land=["prForecastYear","prLoan","prYearlyTax","prMaintenance","prArea","prQuantity","prUnit","prMaker","prModel","prGrowth",...locationAi];
  const metals=["prArea","prQuantity","prUnit","prMaker","prModel"];
  const car=["prLoan","prMaintenance","prArea","prQuantity","prUnit","prMaker","prModel","prRegYear","prMileage","prCondition","prGrowth"];
  if(category==="FD") return ["prCategory","prBank","prValue","prInterestRate","prPurchaseDate","prMaturityDate","prCurrency"];
  if(category==="Car") return [...common,...car];
  if(category==="Physical Gold" || category==="Physical Silver" || category==="Diamond") return [...common,...metals];
  if(category==="Plot" || category==="Land") return [...common,...land];
  return [...common,...realEstate];
}
function applyAssetFieldVisibility(category=byId("prCategory")?.value||""){
  const ids=["prLocation","prValue","prPurchaseValue","prPurchaseDate","prPurchaseYear","prValuationDate","prForecastYear","prLoan","prRenovation","prYearlyTax","prMaintenance","prArea","prQuantity","prUnit","prMaker","prModel","prRegYear","prMileage","prCondition","prMainRoad","prMetro","prHospital","prMall","prSchool","prPolice","prGrocery","prTransit","prComparableRate","prRentalDemand","prBedrooms","prRentalStatus","prRent","prTenant","prLeaseEnd","prDeposit","prGrowth","prCurrency","prBank","prInterestRate","prMaturityDate"];
  const visible=new Set(assetFieldSets(category));
  ids.forEach(id=>{
    const el=byId(id);
    if(!el) return;
    const show=visible.has(id);
    el.classList.toggle("assetFieldHidden",!show);
    el.disabled=!show;
  });
}
function assetFieldActive(id){
  const el=byId(id);
  return !!el && !el.disabled && !el.classList.contains("assetFieldHidden");
}
function assetText(id){
  const el=byId(id);
  return assetFieldActive(id) ? String(el.value||"").trim() : "";
}
function assetNumber(id){
  const el=byId(id);
  return assetFieldActive(id) ? Number(el.value||0) : 0;
}
function assetMoney(id){
  const el=byId(id);
  return assetFieldActive(id) ? parseMoney(el.value) : 0;
}
function propertyStatusBadge(p){
  const s=p.status||"active";
  return s==="active" ? "" : `<span class="statusPill">${escapeHtml(s)}</span>`;
}
function dispositionMeta(p){
  if((p.status||"active")==="active") return "";
  const action=p.status==="gifted"?"Gifted":"Sold";
  return `<br>${action} to ${escapeHtml(p.disposition_to||"-")} on ${escapeHtml(p.disposition_date||"-")} for ${money(p.disposition_amount,p.disposition_currency||p.currency)}. Tax ${money(p.disposition_tax_paid,p.disposition_currency||p.currency)}, fees ${money(p.disposition_fees,p.disposition_currency||p.currency)}, net cash ${money(p.net_proceeds,p.disposition_currency||p.currency)}.`;
}
function valuableMeta(p){
  const parts=[];
  if(Number(p.quantity||0)) parts.push(`${Number(p.quantity).toLocaleString()} ${p.unit||"unit"}`);
  if(p.maker) parts.push(p.maker);
  if(p.model) parts.push(p.model);
  if(p.registration_year) parts.push(`Reg ${p.registration_year}`);
  return parts.length ? `${escapeHtml(parts.join(" • "))}<br>` : "";
}
async function createHolding(){
  if(!hSymbol.value.trim() && hAssetSearch.value.trim()) {
    const query=hAssetSearch.value.trim();
    hSymbol.value=assetCodeFromName(query);
    hName.value=query;
  }
  if(!hAssetSearch.value.trim() && !hName.value.trim()) return alert("Type the full asset name first.");
  const sym=hSymbol.value.trim();
  // Only update the existing holding if we're still editing that exact symbol; otherwise add new.
  if(state.editingHoldingSymbol && sym && sym.toUpperCase()===String(state.editingHoldingSymbol).toUpperCase()) return updateHolding();
  state.editingHoldingSymbol="";
  const editBtn=document.querySelector(".holdingForm .btn");
  if(editBtn) editBtn.textContent="Add Holding";
  const qty=Number(hQty.value||0);
  if(!Number.isFinite(qty) || qty<=0) return alert("Enter how many units / shares you hold — quantity must be greater than 0, otherwise it won't show in Current Holdings.");
  if(badMoney(hBuyPrice.value)) return alert("Invalid bought price. Enter a number like 100, 1.5L or 2cr (no letters or symbols like “---”).");
  if(badMoney(hPrice.value)) return alert("Invalid current price. Enter a number like 180, 2.5L or 1.2cr.");
  smartHoldingDefaults();
  try{
    await post("/holdings",{
      profile_id:selectedProfile(),
      symbol:sym,
      name:hName.value.trim()||sym.toUpperCase(),
      type:hType.value,
      country:hCountry.value,
      market:byId("hMarket")?.value||"GLOBAL",
      sector:hType.value,
      qty:qty,
      avg:parseMoney(hBuyPrice.value),
      price:parseMoney(hPrice.value)||parseMoney(hBuyPrice.value),
      currency:hCurrency.value.trim()||"EUR",
      broker:hBroker.value.trim()||"Manual"
    });
  }catch(e){return alert(e.message)}
  showToast(`Added ${qty} ${sym.toUpperCase()} to holdings`,"success");
  cancelHoldingEdit();
  await loadAll();
}
function editHolding(symbol){
  const a=(state.lastHoldings||[]).find(x=>x.symbol===symbol)||{};
  state.editingHoldingSymbol=symbol;
  state.editingHoldingProfile=a.profile_id||selectedProfile();
  show("Portfolio",[...document.querySelectorAll(".nav button")].find(b=>b.textContent.includes("Portfolio")));
  hSymbol.value=a.symbol||symbol;
  hName.value=a.name||symbol;
  hAssetSearch.value=a.name ? `${a.name} (${a.symbol})` : symbol;
  if(a.type) hType.value=a.type;
  if(a.market) hMarket.value=a.market;
  if(a.country){ensureSelectOption(hCountry,a.country,a.country); hCountry.value=a.country;}
  hQty.value=a.qty||0;
  hBuyPrice.value=a.avg||0;
  hPrice.value=a.price||0;
  hCurrency.value=a.currency||"EUR";
  hBroker.value=a.broker||"Manual";
  const btn=document.querySelector(".holdingForm .btn");
  if(btn) btn.textContent="Update Holding";
  setTimeout(()=>hQty.focus(),50);
}
async function updateHolding(){
  const symbol=state.editingHoldingSymbol||hSymbol.value.trim();
  if(!symbol) return alert("Choose a holding to edit.");
  if(badMoney(hBuyPrice.value)) return alert("Invalid bought price. Enter a number like 100, 1.5L or 2cr.");
  if(badMoney(hPrice.value)) return alert("Invalid current price. Enter a number like 180, 2.5L or 1.2cr.");
  const editPid=state.editingHoldingProfile||state.profile;
  try{
    await patch(`/holdings/${encodeURIComponent(symbol)}${editPid?`?profile_id=${encodeURIComponent(editPid)}`:""}`,{
      name:hName.value.trim()||hAssetSearch.value.trim()||symbol,
      type:hType.value,
      country:hCountry.value,
      market:byId("hMarket")?.value||"GLOBAL",
      qty:Number(hQty.value||0),
      avg:parseMoney(hBuyPrice.value),
      price:parseMoney(hPrice.value),
      currency:hCurrency.value.trim()||"EUR",
      broker:hBroker.value.trim()||"Manual"
    });
  }catch(e){return alert(e.message)}
  cancelHoldingEdit();
  await loadAll();
}
function cancelHoldingEdit(){
  state.editingHoldingSymbol="";
  state.editingHoldingProfile="";
  hSymbol.value=""; hName.value=""; hAssetSearch.value=""; hQty.value=""; hBuyPrice.value=""; hPrice.value="";
  const btn=document.querySelector(".holdingForm .btn");
  if(btn) btn.textContent="Add Holding";
}
function sellHolding(symbol){
  const a=(state.lastHoldings||[]).find(x=>x.symbol===symbol)||{};
  const held=Number(a.qty||0);
  if(held<=0) return alert(`You don't hold any ${symbol} units to sell.`);
  const cur=a.currency||"EUR";
  const pid=a.profile_id||selectedProfile();
  state.sellCtx={symbol, name:a.name||symbol, held, currency:cur, profile_id:pid, price:Number(a.price||a.avg||0)};
  if(byId("sellTitle")) sellTitle.textContent=`Sell ${a.name||symbol}`;
  if(byId("sellHeld")) sellHeld.innerHTML=`You hold <b>${held}</b> ${escapeHtml(symbol)} unit${held===1?"":"s"} • current price <b>${money(state.sellCtx.price,cur)}</b>`;
  if(byId("sellUnits")){ sellUnits.value=held; sellUnits.max=held; }
  if(byId("sellPrice")) sellPrice.value=state.sellCtx.price||"";
  if(byId("sellUnitsHint")) sellUnitsHint.textContent=`Max ${held}`;
  if(byId("sellPriceHint")) sellPriceHint.textContent=`In ${cur}`;
  // deposit targets
  const sel=byId("sellDeposit");
  if(sel){
    const accts=(state.cashAccounts||[]).filter(c=>c.profile_id===pid && (c.currency||"EUR")===cur);
    sel.innerHTML=`<option value="new">➕ New cash account (${escapeHtml(cur)})</option>`+
      accts.map(c=>`<option value="${c.id}">${escapeHtml(c.bank?c.bank+" · "+c.name:c.name)} • ${escapeHtml(money(c.balance,c.currency))}</option>`).join("")+
      `<option value="none">Don't add to a cash account</option>`;
  }
  updateSellPreview();
  byId("sellModal")?.classList.add("open");
}
function closeSellModal(){byId("sellModal")?.classList.remove("open");state.sellCtx=null;}
function updateSellPreview(){
  const ctx=state.sellCtx||{};
  const units=Number(byId("sellUnits")?.value||0);
  const price=Number(byId("sellPrice")?.value||0);
  const proceeds=+(units*price).toFixed(2);
  const remaining=Math.max(+((ctx.held||0)-units).toFixed(8),0);
  const box=byId("sellPreview");
  if(!box) return;
  let warn="";
  if(units>(ctx.held||0)+1e-9) warn=`<div class="sellWarn">⛔ You only hold ${ctx.held} — reduce the units.</div>`;
  box.innerHTML=`<div class="sellPreviewRow"><span>Proceeds</span><b>${money(proceeds,ctx.currency||"EUR")}</b></div><div class="sellPreviewRow"><span>Remaining units</span><b>${remaining}</b></div>${warn}`;
}
async function confirmSellHolding(){
  const ctx=state.sellCtx;
  if(!ctx) return;
  const units=Number(byId("sellUnits")?.value||0);
  const price=Number(byId("sellPrice")?.value||0);
  if(!Number.isFinite(units)||units<=0) return alert("Enter a valid number of units greater than 0.");
  if(units>ctx.held+1e-9) return alert(`You only hold ${ctx.held} ${ctx.symbol} unit${ctx.held===1?"":"s"} — you can't sell ${units}.`);
  if(!Number.isFinite(price)||price<0) return alert("Enter a valid sale price.");
  const proceeds=+(units*price).toFixed(2);
  const remaining=Math.max(+(ctx.held-units).toFixed(8),0);
  const cur=ctx.currency, pid=ctx.profile_id;
  const target=byId("sellDeposit")?.value||"new";
  try{
    await patch(`/holdings/${encodeURIComponent(ctx.symbol)}${pid?`?profile_id=${encodeURIComponent(pid)}`:""}`,{qty:remaining});
    if(proceeds>0){
      await post("/cashflow",{profile_id:pid,category:`Sold ${units} ${ctx.symbol} @ ${money(price,cur)}`,amount:proceeds,currency:cur,type:"income",date:new Date().toISOString().slice(0,10)});
      if(target==="new"){
        await post("/cash-accounts",{profile_id:pid,name:`Sale proceeds - ${ctx.symbol}`,balance:proceeds,currency:cur,type:"Sale proceeds"});
      }else if(target!=="none"){
        await patch(`/cash-accounts/${Number(target)}`,{delta:proceeds});
      }
    }
  }catch(e){return alert(e.message)}
  closeSellModal();
  showToast(`Sold ${units} ${ctx.symbol} for ${money(proceeds,cur)} → cash + cashflow updated${remaining>0?` • ${remaining} left`:""}`,"success");
  await loadAll();
}
async function suggestHoldingAssets(){
  const v=hAssetSearch.value.trim();
  const box=byId("holdingSuggestions");
  if(!v){box.style.display="none";return}
  const marketFilter=(byId("hMarket")?.value||"");
  const rows=await searchAssets(v,{market:marketFilter==="GLOBAL"?"":marketFilter,limit:80});
  state.lastSuggestions=rows;
  const custom=`<button type="button" onclick="chooseCustomHolding()" title="Add this exact name manually"><b>Add "${escapeHtml(v)}"</b><span>Custom mutual fund, coin, ETF, gold, bond, or unlisted asset</span></button>`;
  box.innerHTML=rows.map(a=>assetSuggestionButton(a,`chooseHoldingAsset('${escAttr(jsString(a.symbol))}')`)).join("")+custom;
  box.style.display="block";
}
function chooseHoldingAsset(symbol){
  const a=state.lastSuggestions.find(x=>x.symbol===symbol)||{};
  hSymbol.value=a.symbol||symbol;
  hName.value=a.name||symbol;
  hAssetSearch.value=a.name ? `${a.name} (${a.symbol})` : symbol;
  if(a.type) hType.value=a.type;
  if(a.country){ensureSelectOption(hCountry,a.country,a.country); hCountry.value=a.country;}
  if(a.market){hMarket.value=a.market;}
  if(a.currency) hCurrency.value=a.currency;
  if(a.price) hPrice.value=a.price;
  smartHoldingDefaults();
  byId("holdingSuggestions").style.display="none";
}
function chooseCustomHolding(){
  const name=hAssetSearch.value.trim();
  hSymbol.value=assetCodeFromName(name);
  hName.value=name;
  if(!hMarket.value) hMarket.value="GLOBAL";
  smartHoldingDefaults();
  byId("holdingSuggestions").style.display="none";
}
async function deleteHolding(symbol){
  if(!await uiConfirm({title:"Delete holding?",message:`Remove ${symbol} from this portfolio? This can't be undone. To record a sale instead, use Sell.`,confirmText:"Delete holding",icon:"🗑️"})) return;
  try{await del(`/holdings/${symbol}${state.profile?`?profile_id=${encodeURIComponent(state.profile)}`:""}`)}
  catch(e){return alert(e.message)}
  await loadAll();
}
async function saveProperty(payload){
  if(state.editingPropertyId) return await patch("/properties/"+state.editingPropertyId, payload);
  return await post("/properties", payload);
}
function afterPropertySaved(verb){
  state.editingPropertyId=null;
  if(byId("propertySubmitBtn")) propertySubmitBtn.textContent="Add Asset";
  if(byId("propertyCancelEditBtn")) propertyCancelEditBtn.style.display="none";
}
function cancelPropertyEdit(){
  state.editingPropertyId=null;
  if(byId("propertySubmitBtn")) propertySubmitBtn.textContent="Add Asset";
  if(byId("propertyCancelEditBtn")) propertyCancelEditBtn.style.display="none";
  ["prLocation","prValue","prPurchaseValue","prPurchaseDate","prPurchaseYear","prValuationDate","prForecastYear","prLoan","prRenovation","prYearlyTax","prMaintenance","prArea","prQuantity","prMaker","prModel","prRegYear","prMileage","prCondition","prMainRoad","prMetro","prHospital","prMall","prSchool","prPolice","prGrocery","prTransit","prComparableRate","prRentalDemand","prBedrooms","prRent","prGrowth","prBank","prInterestRate","prMaturityDate"].forEach(id=>{if(byId(id))byId(id).value="";});
  showToast("Edit cancelled","info");
}
function editProperty(id){
  const p=(state.propertyRows||[]).find(x=>Number(x.id)===Number(id));
  if(!p) return;
  state.editingPropertyId=id;
  byId("prCategory").value=p.category||"Flat";
  renderAssetSpecificHints();
  const setV=(fid,v)=>{const el=byId(fid); if(el) el.value=(v==null?"":v);};
  setV("prLocation",p.location); setV("prValue",p.value); setV("prPurchaseValue",p.purchase_value);
  setV("prPurchaseDate",p.purchase_date); setV("prPurchaseYear",p.purchase_year||""); setV("prValuationDate",p.valuation_date);
  setV("prForecastYear",p.forecast_year||""); setV("prLoan",p.loan); setV("prRenovation",p.renovation_cost);
  setV("prYearlyTax",p.yearly_tax); setV("prMaintenance",p.yearly_maintenance); setV("prArea",p.area);
  setV("prQuantity",p.quantity||""); setV("prUnit",p.unit); setV("prMaker",p.maker); setV("prModel",p.model);
  setV("prRegYear",p.registration_year||""); setV("prMileage",p.mileage_km||""); setV("prCondition",p.condition);
  setV("prComparableRate",p.comparable_rate); setV("prRentalDemand",p.rental_demand); setV("prBedrooms",p.bedrooms||"");
  setV("prRent",p.rent); setV("prRentalStatus",p.rental_status); setV("prTenant",p.tenant); setV("prLeaseEnd",p.lease_end);
  setV("prDeposit",p.deposit); setV("prGrowth",p.growth||""); setV("prCurrency",p.currency||"EUR");
  setV("prBank",p.bank); setV("prInterestRate",p.interest_rate||""); setV("prMaturityDate",p.maturity_date);
  setV("prMainRoad",p.main_road); setV("prMetro",p.metro_distance_km||""); setV("prHospital",p.hospital_distance_km||"");
  setV("prMall",p.mall_distance_km||""); setV("prSchool",p.school_distance_km||""); setV("prPolice",p.police_distance_km||"");
  setV("prGrocery",p.grocery_distance_km||""); setV("prTransit",p.transit_distance_km||"");
  if(byId("prCurrency")) prCurrency.dataset.manual="1";   // keep their currency on edit
  updateAssetMarketRate();
  if(byId("propertySubmitBtn")) propertySubmitBtn.textContent="Update asset";
  if(byId("propertyCancelEditBtn")) propertyCancelEditBtn.style.display="inline-flex";
  byId("prCategory").scrollIntoView({block:"center"});
  showToast("Editing "+(p.category||"asset")+" — change fields and press Update","info");
}
async function createProperty(){
  // Fixed Deposit: simpler flow (bank instead of address)
  if(prCategory.value==="FD"){
    const bank=byId("prBank")?.value.trim();
    const amt=assetMoney("prValue");
    if(!bank) return showToast("Enter the bank name for the FD.","alert");
    if(!(amt>0)) return showToast("Enter the deposit amount (principal).","alert");
    if(isFutureDate(byId("prPurchaseDate")?.value)) return showToast("FD start date can't be in the future.","alert");
    const _fdS=byId("prPurchaseDate")?.value, _fdM=byId("prMaturityDate")?.value;
    if(_fdS&&_fdM&&new Date(_fdM)<new Date(_fdS)) return showToast("FD maturity must be after the start date.","alert");
    try{
      await saveProperty({profile_id:selectedProfile(),category:"FD",name:`FD - ${bank}`,location:bank,bank,
        value:amt,purchase_value:amt,interest_rate:assetNumber("prInterestRate"),
        purchase_date:assetText("prPurchaseDate"),maturity_date:byId("prMaturityDate")?.value||"",
        currency:prCurrency.value.trim()||"INR",currency_manual:true});
    }catch(e){ return showToast(e.message||"Could not save FD","alert"); }
    ["prBank","prValue","prInterestRate","prPurchaseDate","prMaturityDate"].forEach(id=>{if(byId(id))byId(id).value="";});
    showToast(state.editingPropertyId?"✓ Fixed Deposit updated":"✓ Fixed Deposit added","success");
    afterPropertySaved();
    await loadAll();
    return;
  }
  const _noLoc=["Physical Gold","Physical Silver","Diamond"].includes(prCategory.value);
  if(!_noLoc && !prLocation.value.trim()) return alert("Enter the property address or area.");
  if(isFutureYear(byId("prPurchaseYear")?.value) || isFutureDate(byId("prPurchaseDate")?.value)) return showToast("Bought / purchase date can't be in the future.","alert");
  if(isFutureDate(byId("prValuationDate")?.value)) return showToast("Valuation date can't be in the future.","alert");
  if(["Physical Gold","Physical Silver","Diamond"].includes(prCategory.value) && !(assetNumber("prQuantity")>0))
    return showToast(`Enter the ${prCategory.value==="Diamond"?"carat":"weight"} for ${prCategory.value}.`,"alert");
  const moneyFields=[["prValue","Current value"],["prPurchaseValue","Bought price"],["prLoan","Loan left"],["prRenovation","Renovation cost"],["prYearlyTax","Yearly tax"],["prMaintenance","Yearly maintenance"],["prComparableRate","Comparable rate"],["prRent","Monthly rent"],["prDeposit","Deposit"]];
  for(const [id,label] of moneyFields){ if(byId(id) && assetFieldActive(id) && badMoney(byId(id).value)) return alert(`Invalid ${label}. Enter a number like 100, 75L or 1.5cr (no letters or symbols).`); }
  smartPropertyCurrency();
  const _loc=prLocation.value.trim();
  const generatedName=(_loc?`${prCategory.value} - ${_loc}`:prCategory.value).slice(0,120);
  try{
    await saveProperty({
      profile_id:selectedProfile(),
      category:prCategory.value,
      name:generatedName,
      location:assetText("prLocation"),
      value:assetMoney("prValue"),
      purchase_value:assetMoney("prPurchaseValue"),
      purchase_year:assetNumber("prPurchaseYear"),
      purchase_date:assetText("prPurchaseDate"),
      valuation_date:assetText("prValuationDate"),
      forecast_year:assetNumber("prForecastYear"),
      loan:assetMoney("prLoan"),
      renovation_cost:assetMoney("prRenovation"),
      yearly_tax:assetMoney("prYearlyTax"),
      yearly_maintenance:assetMoney("prMaintenance"),
      area:assetText("prArea"),
      quantity:assetNumber("prQuantity"),
      unit:assetText("prUnit"),
      maker:assetText("prMaker"),
      model:assetText("prModel"),
      registration_year:assetNumber("prRegYear"),
      mileage_km:assetNumber("prMileage"),
      condition:assetText("prCondition"),
      main_road:assetText("prMainRoad"),
      metro_distance_km:assetNumber("prMetro"),
      hospital_distance_km:assetNumber("prHospital"),
      mall_distance_km:assetNumber("prMall"),
      school_distance_km:assetNumber("prSchool"),
      police_distance_km:assetNumber("prPolice"),
      grocery_distance_km:assetNumber("prGrocery"),
      transit_distance_km:assetNumber("prTransit"),
      comparable_rate:assetMoney("prComparableRate"),
      rental_demand:assetText("prRentalDemand"),
      bedrooms:assetNumber("prBedrooms"),
      rent:assetMoney("prRent"),
      rental_status:assetText("prRentalStatus"),
      tenant:assetText("prTenant"),
      lease_end:assetText("prLeaseEnd"),
      deposit:assetMoney("prDeposit"),
      growth:assetNumber("prGrowth"),
      currency:prCurrency.value.trim()||"EUR",
      currency_manual:prCurrency.dataset.manual==="1",
      value_manual:!!state.metalManual
    });
  }catch(e){return alert(e.message)}
  ["prLocation","prValue","prPurchaseValue","prPurchaseDate","prPurchaseYear","prValuationDate","prForecastYear","prLoan","prRenovation","prYearlyTax","prMaintenance","prArea","prQuantity","prMaker","prModel","prRegYear","prMileage","prCondition","prMainRoad","prMetro","prHospital","prMall","prSchool","prPolice","prGrocery","prTransit","prComparableRate","prRentalDemand","prBedrooms","prRent","prGrowth"].forEach(id=>byId(id).value="");
  prUnit.value="";
  if(byId("prCurrency")){delete prCurrency.dataset.manual; delete prCurrency.dataset.auto;}
  showToast(state.editingPropertyId?"✓ Asset updated":"✓ Asset added","success");
  afterPropertySaved();
  await loadAll();
}
function openDisposeProperty(id){
  const p=(state.propertyRows||[]).find(x=>Number(x.id)===Number(id));
  if(!p) return alert("Asset not found.");
  state.disposingProperty=p;
  byId("disposeTitle").textContent=`Sell / Gift ${p.category||"Asset"}`;
  byId("disposeSuggestion").textContent=p.sale_guidance||`Suggested sale ${money(p.suggested_sale_price,p.currency)}; estimated tax ${money(p.estimated_tax,p.currency)}.`;
  byId("disposeAction").value="sold";
  byId("disposeTo").value="";
  byId("disposeAmount").value=Number(p.suggested_sale_price||p.value||0).toLocaleString("en-IN",{maximumFractionDigits:0});
  byId("disposeCurrency").value=p.currency||"EUR";
  byId("disposeTax").value=Number(p.estimated_tax||0).toLocaleString("en-IN",{maximumFractionDigits:0});
  byId("disposeFees").value="";
  byId("disposeDate").value=new Date().toISOString().slice(0,10);
  byId("disposeNotes").value="";
  byId("disposeModal").classList.add("open");
}
function closeDisposeModal(){
  state.disposingProperty=null;
  byId("disposeModal")?.classList.remove("open");
}
async function confirmDisposeProperty(){
  const p=state.disposingProperty;
  if(!p) return;
  const action=byId("disposeAction").value;
  const to=byId("disposeTo").value.trim();
  if(!to) return alert("Enter who you sold or gifted it to.");
  const amount=parseMoney(byId("disposeAmount").value);
  if(action==="sold" && amount<=0) return alert("Enter the sale amount.");
  try{
    await post(`/properties/${Number(p.id)}/dispose`,{
      action,
      to,
      amount,
      currency:byId("disposeCurrency").value||p.currency||"EUR",
      tax_paid:parseMoney(byId("disposeTax").value),
      fees:parseMoney(byId("disposeFees").value),
      date:byId("disposeDate").value,
      notes:byId("disposeNotes").value.trim(),
      create_cash:true
    });
  }catch(e){return alert(e.message)}
  closeDisposeModal();
  await loadAll();
}
async function deleteProperty(id){
  const row=(state.propertyRows||[]).find(p=>Number(p.id)===Number(id))||{};
  const cat=row.category||"";
  const meta={
    "Physical Gold":{noun:"gold holding",icon:"🥇",msg:"This removes the gold holding from your assets & net worth."},
    "Physical Silver":{noun:"silver holding",icon:"🥈",msg:"This removes the silver holding from your assets & net worth."},
    "Diamond":{noun:"diamond",icon:"💎",msg:"This removes the diamond from your assets & net worth."},
    "FD":{noun:"fixed deposit",icon:"🏦",msg:"This removes the fixed deposit from your assets & net worth."},
    "Car":{noun:"car",icon:"🚗",msg:"This removes the car from your assets & net worth."},
  }[cat]||{noun:"property",icon:"🏠",msg:"This permanently removes the property and its valuation history."};
  if(!await uiConfirm({title:`Delete ${meta.noun}?`,message:meta.msg,confirmText:`Delete ${meta.noun}`,icon:meta.icon})) return;
  try{await del(`/properties/${id}`)}
  catch(e){return showToast(e.message,"alert")}
  showToast(`${meta.noun.charAt(0).toUpperCase()+meta.noun.slice(1)} deleted`,"success");
  await loadAll();
}
async function saveCashflow(){
  if(state.editingCashflowId) return updateCashflow();
  return createCashflow();
}
async function createCashflow(){
  if(!cfCategory.value.trim()) return alert("Enter a cashflow category");
  try{
    await post("/cashflow",{
      profile_id:selectedProfile(),
      category:cfCategory.value.trim(),
      amount:Number(cfAmount.value||0),
      type:cfType.value,
      currency:cfCurrency.value.trim()||"EUR",
      date:byId("cfDate")?.value||new Date().toISOString().slice(0,10)
    });
  }catch(e){return alert(e.message)}
  clearCashflowForm();
  await loadAll();
}
function editCashflow(id){
  const row=(state.cashflowRows||[]).find(c=>Number(c.id)===Number(id));
  if(!row) return alert("Cashflow row not found.");
  state.editingCashflowId=String(id);
  cfCategory.value=row.category||"";
  cfAmount.value=Number(row.amount||0);
  if(byId("cfDate")) cfDate.value=row.date||new Date().toISOString().slice(0,10);
  cfType.value=row.type||"expense";
  cfCurrency.value=row.currency||"EUR";
  if(byId("cashflowSubmitBtn")) cashflowSubmitBtn.textContent="Update Cashflow";
  cfCategory.focus();
}
async function updateCashflow(){
  const id=state.editingCashflowId;
  if(!id) return createCashflow();
  if(!cfCategory.value.trim()) return alert("Enter a cashflow category");
  try{
    await patch(`/cashflow/${Number(id)}`,{
      category:cfCategory.value.trim(),
      amount:Number(cfAmount.value||0),
      type:cfType.value,
      currency:cfCurrency.value.trim()||"EUR",
      date:byId("cfDate")?.value||new Date().toISOString().slice(0,10)
    });
  }catch(e){return alert(e.message)}
  clearCashflowForm();
  await loadAll();
}
function clearCashflowForm(){
  state.editingCashflowId="";
  if(byId("cfCategory")) cfCategory.value="";
  if(byId("cfAmount")) cfAmount.value="";
  if(byId("cfDate")) cfDate.value=new Date().toISOString().slice(0,10);
  if(byId("cfCurrency")) cfCurrency.value="EUR";
  if(byId("cfType")) cfType.value="income";
  if(byId("cashflowSubmitBtn")) cashflowSubmitBtn.textContent="Add Cashflow";
}
async function deleteCashflow(id){
  if(!await uiConfirm({title:"Delete cashflow entry?",message:"This removes the income/expense record from your cashflow.",confirmText:"Delete entry",icon:"💸"})) return;
  try{await del(`/cashflow/${id}`)}
  catch(e){return alert(e.message)}
  await loadAll();
}
const BANK_DEFAULT_CCY={"Axis Bank":"INR","ICICI Bank":"INR","SBI Bank":"INR","HDFC Bank":"INR","N26":"EUR"};
function onCashBankChange(){
  const bank=byId("cashBank")?.value||"";
  if(!bank) return;
  // suggest a sensible currency for the chosen bank (only if user hasn't typed one)
  const ccy=BANK_DEFAULT_CCY[bank];
  if(ccy && byId("cashCurrency")) cashCurrency.value=ccy;
  // prefill a friendly account name if empty
  if(byId("cashName") && !cashName.value.trim() && bank!=="Other") cashName.value=bank==="Cash in hand"?"Cash in hand":`${bank} account`;
}
async function createCashAccount(){
  if(!cashName.value.trim()) return alert("Enter cash account name");
  const bank=byId("cashBank")?.value||"";
  try{await post("/cash-accounts",{profile_id:selectedProfile(),name:cashName.value.trim(),bank,type:cashType.value.trim()||"Cash",balance:Number(cashBalance.value||0),currency:cashCurrency.value.trim()||"EUR"});}
  catch(e){return alert(e.message)}
  cashName.value=""; cashBalance.value=""; if(byId("cashBank")) cashBank.value="";
  await loadAll();
}
async function deleteCashAccount(id){
  if(!await uiConfirm({title:"Delete cash account?",message:"This removes the cash account and its balance from your net worth.",confirmText:"Delete account",icon:"🏦"})) return;
  try{await del(`/cash-accounts/${id}`)}
  catch(e){return alert(e.message)}
  await loadAll();
}
async function loadAlertsAndPlans(){
  const alertRows=await get("/alerts");
  state.alertsRows=alertRows;
  table("alertsTable",["Symbol","Rule","Current","State",""],alertRows.map(a=>{
    const trigger=Array.isArray(a.triggered) && a.triggered.some(x=>x.triggered);
    const asset=a.asset||{};
    return [
      `<span class="ticker" onclick="openAsset('${escapeHtml(a.symbol)}')">${escapeHtml(a.symbol)}</span>`,
      `${escapeHtml(a.condition)} ${Number(a.target||0).toLocaleString()}`,
      asset.price?`${asset.currency||""} ${Number(asset.price).toLocaleString()}`:"-",
      `<span class="${trigger?"green":"subtitle"}">${trigger?"Triggered":"Watching"}</span>`,
      a.id?`<button class="btn secondary" onclick="deleteAlert(${Number(a.id)})">Delete</button>`:"Seed row"
    ];
  }));
  const plans=await get("/savings-plans"+q());
  state.savingsPlans=plans;
  table("plansTable",["Goal","Progress","Current","Target","Monthly","ETA",""],plans.map(p=>[
    `<b>${escapeHtml(p.name)}</b><div class="assetName">${escapeHtml(p.priority||"Medium")} priority</div>`,
    `<div class="progress"><i style="width:${Math.min(Number(p.progress||0),100)}%"></i></div><span class="subtitle">${pct(p.progress)}</span>`,
    euro(p.current_eur||p.current),
    euro(p.target_eur||p.target),
    `${escapeHtml(p.currency)} ${Number(p.monthly||0).toLocaleString()}`,
    p.months_left===null||p.months_left===undefined?"-":`${p.months_left} months`,
    p.id?`<button class="btn secondary" onclick="deleteSavingsPlan(${Number(p.id)})">Delete</button>`:"Seed row"
  ]));
}
async function createAlert(){
  if(!alertSymbol.value.trim()) return alert("Enter alert symbol");
  const sym=alertSymbol.value.trim().toUpperCase();
  try{await post("/alerts",{symbol:sym,condition:alertCondition.value,target:Number(alertTarget.value||0),status:"active"});}
  catch(e){return alert(e.message)}
  alertSymbol.value=""; alertTarget.value="";
  showToast(`🔔 Alert set for ${sym} — we'll notify you when it hits`,"success");
  await loadAll();
}
async function deleteAlert(id){
  if(!await uiConfirm({title:"Delete alert?",message:"You'll stop receiving notifications for this price alert.",confirmText:"Delete alert",icon:"🔔"})) return;
  try{await del(`/alerts/${id}`)}
  catch(e){return alert(e.message)}
  await loadAll();
}
async function createSavingsPlan(){
  if(!planName.value.trim()) return alert("Enter savings plan name");
  try{await post("/savings-plans",{profile_id:selectedProfile(),name:planName.value.trim(),target:Number(planTarget.value||0),current:Number(planCurrent.value||0),monthly:Number(planMonthly.value||0),currency:planCurrency.value.trim()||"EUR",priority:planPriority.value||"Medium"});}
  catch(e){return alert(e.message)}
  planName.value=""; planTarget.value=""; planCurrent.value=""; planMonthly.value="";
  await loadAll();
}
async function deleteSavingsPlan(id){
  if(!await uiConfirm({title:"Delete savings plan?",message:"This removes the goal and its progress tracking.",confirmText:"Delete plan",icon:"🎯"})) return;
  try{await del(`/savings-plans/${id}`)}
  catch(e){return alert(e.message)}
  await loadAll();
}
function assetRow(a){
  const metric=byId("marketMetric")?.value||"day";
  const mode=byId("marketValueMode")?.value||"percent";
  return [
    `<button class="assetLink" title="${escAttr(a.movement_reason||"Open details")}" onclick="openAsset('${escapeHtml(a.symbol)}')"><b>${escapeHtml(a.name)}</b><span>${escapeHtml(a.symbol)} • ${escapeHtml(a.type||"Asset")} • ${escapeHtml(a.market||a.country||"")}<br>${escapeHtml(a.source||"")}</span></button>`,
    marketDisplayValue(a,metric,mode),
    `<span class="${cls(a.day)}">${pct(a.day)}</span>`,
    `<span class="${cls(a.week)}">${pct(a.week)}</span>`,
    `<span class="${cls(a.month)}">${pct(a.month)}</span>`,
    `<span class="${cls(a.year)}">${pct(a.year)}</span>`
  ];
}
function assetRowCompact(a){
  return [
    `<div class="rowWithFav">${favStar(a.symbol)}<button class="assetLink" title="${escAttr(a.movement_reason||"Open details")}" onclick="openAsset('${escAttr(jsString(a.symbol))}')"><b>${escapeHtml(a.name||a.symbol)}</b><span>${escapeHtml(a.symbol)} • ${escapeHtml(a.market||a.country||"")}</span></button></div>`,
    `${escapeHtml(a.currency||"")} ${Number(a.price||0).toLocaleString()}`,
    `<span class="${cls(a.day)}">${signed(a.day)}</span>`,
    `<span class="${cls(a.week)}">${signed(a.week)}</span>`
  ];
}
function assetIntelRow(a){
  const metric=byId("marketMetric")?.value||"day";
  const mode=byId("marketValueMode")?.value||"percent";
  return [
    `<div class="rowWithFav">${favStar(a.symbol)}<button class="assetLink" title="${escAttr(a.movement_reason||"Open details")}" onclick="openAsset('${escAttr(jsString(a.symbol))}')"><b>${escapeHtml(a.name)}</b><span>${escapeHtml(a.symbol)} • ${escapeHtml(a.type||"Asset")} • ${escapeHtml(a.market||a.country||"")}</span></button></div>`,
    marketDisplayValue(a,metric,mode),
    `<span class="${cls(a.day)}">${signed(a.day)}</span>`,
    `<span class="${cls(a.month)}">${signed(a.month)}</span>`,
    `<span class="${cls(a.year)}">${signed(a.year)}</span>`,
    `<div class="reasonText">${escapeHtml(a.movement_reason||"Movement reason available after live data loads.")}</div>`
  ];
}
function marketDisplayValue(a,metric="day",mode="percent"){
  if(mode==="price") return `${escapeHtml(a.currency||"")} ${Number(a.price||0).toLocaleString()}`;
  if(mode==="money") return `${displayMoney((a.value_eur||0)*Number(a[metric]||0)/100)}<div class="assetName">${signed(a[metric])}</div>`;
  return `<span class="${cls(a[metric])}">${signed(a[metric])}</span><div class="assetName">${escapeHtml(a.currency||"")} ${Number(a.price||0).toLocaleString()}</div>`;
}
async function loadMarkets(){
  const marketCode=byId("marketExchange")?.value||"ALL";
  const marketParam=marketCode && marketCode!=="ALL" ? `?market_code=${encodeURIComponent(marketCode)}` : "";
  loadMarketCalendar(marketCode,"marketCalendarPanel");
  let m=await get("/markets/movers"+marketParam);
  const g=await get("/markets/global-top"+marketParam);
  state.marketData={...m, valuable:g.valuable||[], coins:g.coins||[], gainers:g.gainers||m.top_gainers||[], losers:g.losers||m.top_losers||[]};
  renderMarketCompare();
  renderMarketTables();
  if(!state.forex) loadForex();
  loadExchangeListings(true);
}
/* ===== Exchange browser — list every share/fund of a selected exchange ===== */
function marketLabelByCode(code){
  if(code==="CRYPTO") return "Crypto";
  if(code==="MFINDIA") return "India Mutual Funds";
  const m=(state.stockMarkets||fallbackMarkets).find(x=>x.code===code);
  return m?marketLabel(m):code;
}
function exchBrowserSearchInput(){
  clearTimeout(state._exchTimer);
  state._exchTimer=setTimeout(()=>loadExchangeListings(true),320);
}
async function loadExchangeListings(reset){
  const card=byId("exchangeBrowserCard"); if(!card) return;
  const code=byId("marketExchange")?.value||"";
  const nameEl=byId("exchBrowserName"), hint=byId("exchBrowserHint"), controls=byId("exchBrowserControls"), foot=byId("exchBrowserFoot"), tbl=byId("exchBrowserTable");
  if(!code || code==="ALL" || code==="GLOBAL"){
    if(hint) hint.style.display=""; if(controls) controls.style.display="none"; if(foot) foot.style.display="none";
    if(tbl) tbl.innerHTML=""; if(byId("exchBrowserCount")) exchBrowserCount.textContent="";
    if(nameEl) nameEl.textContent="an exchange"; return;
  }
  if(nameEl) nameEl.textContent=marketLabelByCode(code);
  if(hint) hint.style.display="none"; if(controls) controls.style.display="";
  state.exch=state.exch||{};
  if(reset || state.exch.code!==code){
    state.exch={code, offset:0, total:0, rows:[]};
    if(reset && byId("exchBrowserSearch") && state.exch.code!==code) byId("exchBrowserSearch").value="";
    if(tbl) tbl.innerHTML='<tbody><tr><td class="cfoMuted">Loading the full directory… (the first load of a large exchange can take a few seconds)</td></tr></tbody>';
  }
  const e=state.exch;
  const q=byId("exchBrowserSearch")?.value?.trim()||"";
  try{
    const d=await get(`/exchange/listings?market_code=${encodeURIComponent(code)}&q=${encodeURIComponent(q)}&offset=${e.offset}&limit=50`);
    if(state.currentPage!=="Live Markets" || byId("marketExchange")?.value!==code) return;
    if(e.offset===0) e.rows=[];
    e.rows=e.rows.concat(d.items||[]);
    e.total=d.total||e.rows.length; e.offset=e.rows.length; e.q=q; e.coverage=d.coverage||"full";
    renderExchangeListings();
  }catch(err){ if(tbl) tbl.innerHTML='<tbody><tr><td class="cfoMuted">Could not load this exchange right now. Try again.</td></tr></tbody>'; }
}
function renderExchangeListings(){
  const e=state.exch||{rows:[],total:0}; const tbl=byId("exchBrowserTable"); if(!tbl) return;
  const cov=e.coverage||"full";
  const covLabel={full:"full directory",major:"major companies · curated",limited:"limited — add a Finnhub key for the full list"}[cov]||"";
  if(byId("exchBrowserCount")) exchBrowserCount.textContent=`${(e.total||0).toLocaleString()} ${cov==="full"?"listed":cov==="major"?"major names":"shown"} · ${covLabel}${e.q?` · “${e.q}”`:""}`;
  const hint=byId("exchBrowserHint");
  if(hint){
    if(cov==="full"){ hint.style.display="none"; }
    else{
      hint.style.display="";
      hint.innerHTML = cov==="major"
        ? `Showing this exchange's <b>major companies &amp; ETFs</b>. A complete listing isn't available on <b>free</b> data for this exchange — full free directories exist only for <b>US (NASDAQ/NYSE/AMEX)</b>, <b>NSE India</b>, <b>crypto</b> and <b>India mutual funds</b>. (A paid market‑data feed can unlock every symbol here.)`
        : `<b>Limited list</b> — no free full directory for this exchange, so only known names show. Full free coverage is available for <b>US (NASDAQ/NYSE/AMEX)</b>, <b>NSE India</b>, <b>crypto</b> and <b>India mutual funds</b>.`;
    }
  }
  const body=e.rows.map((a,i)=>`<tr class="exchRow" onclick="openExchangeRow(${i})" title="Open ${escAttr(a.symbol||"")}">
    <td>${favStar(a.symbol)}</td>
    <td><b>${escapeHtml(a.symbol||"")}</b></td>
    <td class="exchName">${escapeHtml(a.name||"")}</td>
    <td><span class="exchType">${escapeHtml(a.type||"Stock")}</span></td>
    <td class="num">${a.price!=null?`${escapeHtml(a.currency||"")} ${Number(a.price).toLocaleString()}`:'<span class="cfoMuted">open ›</span>'}</td>
    <td class="num ${a.day!=null?cls(a.day):""}">${a.day!=null?signed(a.day):""}</td>
  </tr>`).join("");
  tbl.innerHTML=`<thead><tr><th>★</th><th>Symbol</th><th>Name</th><th>Type</th><th>Price</th><th>Today</th></tr></thead><tbody>${body||'<tr><td colspan="6" class="cfoMuted">No matches on this exchange.</td></tr>'}</tbody>`;
  const foot=byId("exchBrowserFoot"), more=byId("exchBrowserMore");
  if(foot) foot.style.display=(e.rows.length<e.total)?"":"none";
  if(more) more.textContent=`Load more — showing ${e.rows.length.toLocaleString()} of ${(e.total||0).toLocaleString()}`;
}
function openExchangeRow(i){
  const a=(state.exch&&state.exch.rows[i])||null; if(!a) return;
  if(a.market==="MFINDIA" || a.type==="Mutual Fund") return (typeof openFundBondDetail==="function"?openFundBondDetail(a):openAsset(a.symbol));
  openAsset(a.yahoo||a.symbol);
}
function marketFilteredRows(rows){
  const text=(byId("marketTableFilter")?.value||"").toLowerCase();
  const type=byId("marketTypeFilter")?.value||"";
  const minPrice=parseMoney(byId("marketMinPrice")?.value||"");
  const maxPrice=parseMoney(byId("marketMaxPrice")?.value||"");
  const metric=byId("marketMetric")?.value||"day";
  const minMove=Number(byId("marketMinMove")?.value||"");
  const maxMove=Number(byId("marketMaxMove")?.value||"");
  const sort=byId("marketTableSort")?.value||"default";
  let out=(rows||[]).filter(a=>
    (!text || `${a.symbol} ${a.name} ${a.type} ${a.sector} ${a.country} ${a.market} ${a.market_name} ${a.source}`.toLowerCase().includes(text)) &&
    (!type || a.type===type) &&
    (!minPrice || Number(a.price||0)>=minPrice) &&
    (!maxPrice || Number(a.price||0)<=maxPrice) &&
    (!minMove || Number(a[metric]||0)>=minMove) &&
    (!maxMove || Number(a[metric]||0)<=maxMove)
  );
  const sortMap={
    price_desc:["price",-1],price_asc:["price",1],
    day_desc:["day",-1],day_asc:["day",1],
    week_desc:["week",-1],month_desc:["month",-1],
    year_desc:["year",-1],year_asc:["year",1]
  };
  if(sortMap[sort]){
    const [key,dir]=sortMap[sort];
    out=out.slice().sort((a,b)=>(Number(a[key]||0)-Number(b[key]||0))*dir);
  }
  return out;
}
function renderMarketTables(){
  if(!state.marketData) return;
  const h=["Asset","Price","Day","Week","Month","Year"];
  const gainers=marketFilteredRows(state.marketData.top_gainers||state.marketData.gainers||[]);
  const losers=marketFilteredRows(state.marketData.top_losers||state.marketData.losers||[]);
  const valuable=marketFilteredRows(state.marketData.valuable||[]);
  const coins=marketFilteredRows(state.marketData.coins||[]);
  table("gainers",["Asset","Price","Day","Week"],gainers.slice(0,20).map(assetRowCompact));
  table("losers",["Asset","Price","Day","Week"],losers.slice(0,20).map(assetRowCompact));
  table("gainers50",["Asset","Price","Day","Month","Year","Why"],gainers.slice(0,50).map(assetIntelRow));
  table("losers50",["Asset","Price","Day","Month","Year","Why"],losers.slice(0,50).map(assetIntelRow));
  table("globalTop",["Asset","Price","Day","Month","Year","Why"],valuable.slice(0,50).map(assetIntelRow));
  table("globalCoins",["Asset","Price","Day","Month","Year","Why"],coins.slice(0,50).map(assetIntelRow));
  renderMarketPulse();
  renderVolatile();
  renderForexTable();
}
function marketPool(){
  const md=state.marketData||{}; const pool={};
  [...(md.top_gainers||md.gainers||[]),...(md.top_losers||md.losers||[]),...(md.valuable||[]),...(md.coins||[])]
    .forEach(a=>{if(a&&a.symbol && !pool[a.symbol]) pool[a.symbol]=a;});
  return Object.values(pool);
}
function renderMarketPulse(){
  const box=byId("marketPulse"); if(!box) return;
  const rows=marketPool();
  if(!rows.length){ box.innerHTML='<div class="cfoMuted">Market data loading…</div>'; return; }
  const metric=byId("marketMetric")?.value||"day";
  const label={day:"today",week:"this week",month:"this month",year:"this year",pl_pct:"since buy"}[metric]||"today";
  let up=0,down=0,flat=0,sum=0;
  rows.forEach(a=>{const v=Number(a[metric]||0); sum+=v; if(v>0.05)up++; else if(v<-0.05)down++; else flat++;});
  const total=rows.length, avg=sum/total;
  const top=rows.slice().sort((a,b)=>Number(b[metric]||0)-Number(a[metric]||0))[0];
  const bot=rows.slice().sort((a,b)=>Number(a[metric]||0)-Number(b[metric]||0))[0];
  const mood=avg>0.5?"Risk-on 🟢":avg<-0.5?"Risk-off 🔴":"Mixed 🟡";
  if(byId("pulseScope")) pulseScope.textContent=`Breadth · ${label}`;
  box.innerHTML=`<div class="pulseStats">
      <div class="pulseStat"><span class="pulseBig ${cls(avg)}">${signed(avg)}</span><small>Avg move ${label}</small></div>
      <div class="pulseStat"><span class="pulseBig">${mood}</span><small>Market mood</small></div>
      <div class="pulseStat"><span class="pulseBig green">${up}</span><small>Advancing</small></div>
      <div class="pulseStat"><span class="pulseBig red">${down}</span><small>Declining</small></div>
      <div class="pulseStat"><span class="pulseBig">${total}</span><small>Tracked</small></div>
    </div>
    <div class="pulseBreadth"><div class="pulseBar" title="${up} up · ${flat} flat · ${down} down"><i class="pbUp" style="width:${(up/total*100).toFixed(1)}%"></i><i class="pbFlat" style="width:${(flat/total*100).toFixed(1)}%"></i><i class="pbDown" style="width:${(down/total*100).toFixed(1)}%"></i></div>
      <div class="pulseBreadthLabels"><span class="green">${Math.round(up/total*100)}% advancing</span><span class="cfoMuted">${flat} flat</span><span class="red">${Math.round(down/total*100)}% declining</span></div></div>
    <div class="pulseMovers">
      ${top?`<button class="pulseMover" onclick="openAsset('${escAttr(jsString(top.symbol))}')"><span class="green">▲ Top gainer</span><b>${escapeHtml(top.symbol)}</b><i class="green">${signed(top[metric])}</i></button>`:""}
      ${bot?`<button class="pulseMover" onclick="openAsset('${escAttr(jsString(bot.symbol))}')"><span class="red">▼ Top loser</span><b>${escapeHtml(bot.symbol)}</b><i class="red">${signed(bot[metric])}</i></button>`:""}
    </div>`;
}
function renderVolatile(){
  if(!byId("volatileTable")) return;
  const metric=byId("marketMetric")?.value||"day";
  const rows=marketFilteredRows(marketPool()).slice()
    .sort((a,b)=>Math.abs(Number(b[metric]||0))-Math.abs(Number(a[metric]||0))).slice(0,12);
  table("volatileTable",["Asset","Price","Move","Range"],rows.map(a=>{
    const v=Number(a[metric]||0), mag=Math.min(Math.abs(v),15)/15*100;
    return [
      `<div class="rowWithFav">${favStar(a.symbol)}<button class="assetLink" onclick="openAsset('${escAttr(jsString(a.symbol))}')"><b>${escapeHtml(a.name||a.symbol)}</b><span>${escapeHtml(a.symbol)} • ${escapeHtml(a.market||a.country||a.type||"")}</span></button></div>`,
      `${escapeHtml(a.currency||"")} ${Number(a.price||0).toLocaleString()}`,
      `<span class="${cls(v)}">${signed(v)}</span>`,
      `<div class="volBar"><i class="${cls(v)} ${v>=0?'volUp':'volDown'}" style="width:${mag.toFixed(0)}%"></i></div>`
    ];
  }));
}
async function loadForex(){
  try{ state.forex=await get("/forex"); }catch(e){ state.forex=null; }
  renderForexTable();
}
function renderForexTable(){
  if(!byId("forexTable")) return;
  const d=state.forex;
  if(byId("forexSource")) forexSource.textContent=d&&d.source?(d.source+(d.as_of?` · ${d.as_of}`:"")):"ECB live";
  const pairs=(d&&d.pairs)||[];
  table("forexTable",["Pair","Price","Day","Week"],pairs.map(p=>{
    const dp=(p.quote==="JPY"||p.quote==="INR")?2:4;
    return [
      `<button class="assetLink fxLink" onclick="openAsset('${escAttr(jsString(p.base+p.quote+'=X'))}')"><b>${escapeHtml(p.pair)}</b><span>${escapeHtml(p.name||"")}</span></button>`,
      `<b>${Number(p.price).toLocaleString(undefined,{minimumFractionDigits:dp,maximumFractionDigits:dp})}</b>`,
      `<span class="${cls(p.day)}">${signed(p.day)}</span>`,
      `<span class="${cls(p.week)}">${signed(p.week)}</span>`
    ];
  }));
}
function clearMarketTableFilters(){
  ["marketTableFilter","marketMinPrice","marketMaxPrice","marketMinMove","marketMaxMove"].forEach(id=>{const el=byId(id); if(el) el.value="";});
  const type=byId("marketTypeFilter");
  const sort=byId("marketTableSort");
  if(type) type.value="";
  if(sort) sort.value="default";
  renderMarketTables();
}
async function liveMarketSearchSuggest(){
  const input=byId("marketExchangeSearch");
  const box=byId("marketExchangeSuggestions");
  const query=(input?.value||"").trim();
  if(!box) return;
  if(!query){
    box.style.display="none";
    box.innerHTML="";
    filterMarketSelect("marketExchange","",true);
    return;
  }
  const q=query.toLowerCase();
  const markets=(state.stockMarkets.length?state.stockMarkets:fallbackMarkets)
    .filter(m=>`${m.code} ${m.name} ${m.country} ${m.region} ${m.currency}`.toLowerCase().includes(q))
    .slice(0,6);
  const assets=await searchAssets(query,{limit:18});
  const marketHtml=markets.map(m=>`<button type="button" onclick="selectLiveMarket('${escAttr(m.code)}','${escAttr(marketLabel(m))}')"><b>Market: ${escapeHtml(marketLabel(m))}</b><span>${escapeHtml(m.country)} • ${escapeHtml(m.region)} • ${escapeHtml(m.currency)}</span></button>`).join("");
  const assetHtml=assets.map(a=>assetSuggestionButton(a,`selectLiveAsset('${escAttr(jsString(a.symbol))}')`)).join("");
  box.innerHTML=marketHtml+assetHtml || `<button type="button" disabled><b>No match yet</b><span>Try the company name, symbol, fund name, coin, or exchange code.</span></button>`;
  box.style.display="block";
  filterMarketSelect("marketExchange",query,true);
}
async function selectLiveMarket(code,label){
  const select=byId("marketExchange");
  const input=byId("marketExchangeSearch");
  const box=byId("marketExchangeSuggestions");
  ensureSelectOption(select,code,label);
  if(select) select.value=code;
  if(input) input.value=label || code;
  if(box) box.style.display="none";
  await loadMarkets();
  updateBackButton();
}
function selectLiveAsset(symbol){
  const input=byId("marketExchangeSearch");
  const box=byId("marketExchangeSuggestions");
  if(input) input.value=symbol;
  if(box) box.style.display="none";
  openAsset(symbol);
}
async function liveMarketSearchKey(event){
  if(event.key!=="Enter") return;
  event.preventDefault();
  const query=(byId("marketExchangeSearch")?.value||"").trim();
  if(!query) return;
  const markets=(state.stockMarkets.length?state.stockMarkets:fallbackMarkets);
  const exactMarket=markets.find(m=>`${m.code} ${m.name}`.toLowerCase().includes(query.toLowerCase()));
  const assets=await searchAssets(query,{limit:20});
  if(assets.length) return selectLiveAsset(assets[0].symbol);
  if(exactMarket) return selectLiveMarket(exactMarket.code,marketLabel(exactMarket));
}
function renderMarketCompare(){
  if(!state.marketData) return;
  const universe=byId("marketUniverse")?.value||"all";
  const metric=byId("marketMetric")?.value||"day";
  const mode=byId("marketValueMode")?.value||"percent";
  const type=byId("marketChartType")?.value||"bar";
  const rows=(universe==="gainers"?state.marketData.gainers:universe==="losers"?state.marketData.losers:universe==="valuable"?state.marketData.valuable:universe==="coins"?state.marketData.coins:state.marketData.all||[]).slice(0,type==="doughnut"?10:18);
  const values=rows.map(x=>mode==="price"?Number(x.price||0):mode==="money"?convertFromEur((x.value_eur||0)*Number(x[metric]||0)/100):(type==="doughnut"?Math.abs(Number(x[metric]||0)):Number(x[metric]||0)));
  chart("moversChart",type,rows.map(x=>x.symbol),values,`${metric.toUpperCase()} ${mode}`,{percent:mode==="percent",onClick:i=>openAsset(rows[i].symbol)});
}
async function openAsset(sym){
  // Navigate immediately with a loading state so the click always gives feedback,
  // even for obscure listings whose live quote takes a few seconds to resolve.
  show("Asset Detail",[...document.querySelectorAll(".nav button")].find(b=>b.textContent.includes("Asset Detail")));
  stopAssetLiveTicker();
  assetDetail.innerHTML=`<div class="aiBox">⏳ Loading live data for <b>${escapeHtml(sym)}</b>…</div>`;
  updateBackButton();
  window.scrollTo({top:0,left:0,behavior:"auto"});
  let d=null;
  try{ d=await get("/asset-detail?symbol="+encodeURIComponent(sym)); }catch(e){ d=null; }
  if(state.currentPage!=="Asset Detail") return; // user navigated away while loading
  if(!d || d.error || !d.asset){
    assetDetail.innerHTML=`<div class="aiBox">No live data found for ${escapeHtml(sym)} yet. Try another listing from search, or add it manually as a holding/favorite so the app can track it.</div>`;
    updateBackButton();
    return;
  }
  let a=d.asset;
  const f=d.fundamentals||{};
  const review=d.analyst_view||{};
  const ctx=d.portfolio_context||{};
  const _isFav=(state.favoriteRows||[]).some(x=>String(x.symbol||"").toUpperCase()===String(a.symbol||"").toUpperCase());
  const _favBtn=_isFav
    ? `<button class="favStarBtn on" id="assetFavBtn" disabled title="Already in favorites">★ In favorites</button>`
    : `<button class="favStarBtn" id="assetFavBtn" onclick="favFromAsset('${escAttr(jsString(a.symbol))}')" title="Add to favorites">☆ Add to favorites</button>`;
  assetDetail.innerHTML=`<div class="grid">
    <div class="heroPanel c12"><div><div class="metricLabel">${escapeHtml(a.type||"Asset")} detail ${_favBtn}</div><h2>${escapeHtml(a.symbol)} — ${escapeHtml(a.name)}</h2><div class="heroMetric ${cls(a.day)}" id="assetHeroMetric"><span id="assetLivePrice">${escapeHtml(a.currency||"")} ${Number(a.price||0).toLocaleString()}</span> • <span id="assetLiveDay">${signed(a.day)}</span> <span class="livePulse" id="assetLivePulse" title="Auto-updating every 15s">● LIVE</span></div><div class="subtitle">${escapeHtml(a.sector||"")} • ${escapeHtml(a.country||"")} • ${escapeHtml(a.market_name||a.market||"")} • <span id="assetLiveSrc">${escapeHtml(a.source||"")}</span></div></div>${assetHeroStats(a,ctx)}</div>
    <div class="card c12 assetTabCard"><div class="tabRow"><button class="active" onclick="showAssetTab('overview',this)">Overview</button><button onclick="showAssetTab('performance',this)">Performance</button><button onclick="showAssetTab('dividends',this)">Dividends</button><button onclick="showAssetTab('price',this)">Price</button><button onclick="showAssetTab('profile',this)">Profile</button><button onclick="showAssetTab('edit',this)">Edit view</button><input class="input compactInput" id="assetDetailSearch" placeholder="Search another asset..." oninput="assetDetailSearchSuggest()"/><div class="searchResults inlineResults" id="assetDetailResults"></div></div></div>
    <div class="card c6 assetTab active" data-tab="overview"><div class="cardHead"><h3>Why it moved</h3><span class="pill">${escapeHtml(review.rating||"Review")}</span></div>
      <p>${escapeHtml(d.why_up_or_down||d.movement_explanation)}</p>
      <table><tr><th>Day</th><th>Week</th><th>Month</th><th>Year</th></tr>
      <tr><td class="${cls(a.day)}">${signed(a.day)}</td><td class="${cls(a.week)}">${signed(a.week)}</td><td class="${cls(a.month)}">${signed(a.month)}</td><td class="${cls(a.year)}">${signed(a.year)}</td></tr></table>
      <div class="aiBox"><b>Bull:</b> ${escapeHtml(review.bull_case||"")}<br><b>Bear:</b> ${escapeHtml(review.bear_case||"")}<br><b>Risk:</b> ${escapeHtml(review.risk_level||"")}</div>
    </div>
    <div class="card c12 assetTab active" data-tab="performance">
      <div class="chartTopBar">
        <div class="chartHoverWrap"><div class="chartHoverDate" id="chartHoverDate">—</div><div class="chartHoverPrice" id="chartHoverPrice">—</div><div class="chartHoverChange" id="chartHoverChange"></div></div>
        <div class="chartLegendMini"><button type="button" class="legendItem" id="legend-price" onclick="toggleChartSeries('price')" title="Show / hide the price line"><i class="clDot clPrice"></i>Price</button><button type="button" class="legendItem" id="legend-volume" onclick="toggleChartSeries('volume')" title="Show / hide volume bars"><i class="clDot clVol"></i>Volume</button><span class="chartHint">↘ hover / tap the chart · click a legend to toggle</span></div>
      </div>
      <div class="assetChartWrap"><canvas id="assetChart"></canvas></div>
      <div class="rangeTabs" id="assetRangeTabs">
        <button data-range="1h" onclick="loadAssetChart('${a.symbol}','1h',this)">1H</button>
        <button data-range="1d" onclick="loadAssetChart('${a.symbol}','1d',this)">24H</button>
        <button data-range="1mo" onclick="loadAssetChart('${a.symbol}','1mo',this)">1M</button>
        <button data-range="1y" class="active" onclick="loadAssetChart('${a.symbol}','1y',this)">1Y</button>
        <button data-range="2y" onclick="loadAssetChart('${a.symbol}','2y',this)">2Y</button>
        <button data-range="5y" onclick="loadAssetChart('${a.symbol}','5y',this)">5Y</button>
      </div>
    </div>
    ${assetPerfPanel(a)}
    ${assetProfilePanel(a,f)}
    ${assetDividendsPanel(a)}
    ${assetPricePanel(a)}
    ${assetEditPanel(a,ctx)}
    <div class="card c6 assetTab active" data-tab="overview"><div class="cardHead"><h3>Analyst Checklist</h3><span class="pill">Research workflow</span></div>
      <div class="aiBox">${(review.what_to_watch||[]).map(x=>`• ${escapeHtml(x)}`).join("\\n")}</div>
      <p><b>Sources to add/use:</b> ${(review.world_class_sources||[]).map(escapeHtml).join(", ")}</p>
      <p><b>Action ideas:</b> ${(ctx.action_ideas||[]).map(escapeHtml).join(", ")}</p>
    </div>
    ${technicalPanelHtml(a)}
    ${ratingsCardHtml(a)}
    <div class="card c12"><div class="cardHead"><h3>Latest News</h3><span class="pill">Real published articles</span></div>
      <div class="newsGrid">${(d.news||[]).map(n=>newsCardHtml(n)).join("")||`<div class="newsEmpty"><div class="newsEmptyArt">📰</div><b>No fresh articles right now</b><span>Try again later or open the research links above.</span></div>`}</div>
    </div>
  </div>`;
  loadAssetChart(a.symbol,"1y");
  showAssetTab("overview",document.querySelector(".tabRow button"));
  updateBackButton();
  window.scrollTo({top:0,left:0,behavior:"auto"});
  startAssetLiveTicker(a.symbol,a.type,a.currency,a.price);
}
/* ===== Asset Detail live price ticker (auto-updates while you watch) ===== */
function stopAssetLiveTicker(){ if(state._liveTickerTimer){clearInterval(state._liveTickerTimer);state._liveTickerTimer=null;} state._liveTickerSym=null; }
function startAssetLiveTicker(symbol,type,currency,lastPrice){
  stopAssetLiveTicker();
  if(!isLiveOn()) return;   // respect the global Live toggle
  state._liveTickerSym=symbol;
  state._liveTickerLast=Number(lastPrice||0);
  const tick=async()=>{
    if(state.currentPage!=="Asset Detail" || state._liveTickerSym!==symbol){ stopAssetLiveTicker(); return; }
    let d=null;
    try{ d=await get(`/live/price?symbol=${encodeURIComponent(symbol)}&type=${encodeURIComponent(type||"Stock")}`); }catch(e){ return; }
    if(!d || d.price==null) return;
    const priceEl=byId("assetLivePrice"); if(!priceEl){ stopAssetLiveTicker(); return; }
    const dayEl=byId("assetLiveDay"), metric=byId("assetHeroMetric"), srcEl=byId("assetLiveSrc");
    const cur=currency||d.currency||"";
    const newP=Number(d.price);
    priceEl.textContent=`${cur} ${newP.toLocaleString(undefined,{maximumFractionDigits:newP<10?4:2})}`;
    if(dayEl) dayEl.textContent=signed(d.day);
    if(metric){ metric.classList.remove("green","red"); metric.classList.add(cls(d.day)); }
    if(srcEl && d.source) srcEl.textContent=d.source;
    const prev=state._liveTickerLast;
    if(prev && newP!==prev){
      priceEl.classList.remove("tickUp","tickDown"); void priceEl.offsetWidth;
      priceEl.classList.add(newP>prev?"tickUp":"tickDown");
    }
    state._liveTickerLast=newP;
  };
  setTimeout(tick,1500);
  state._liveTickerTimer=setInterval(tick,15000);
}
/* ===== Asset Detail rich tab panels ===== */
function rangeMeterHtml(low,high,cur,currency){
  low=Number(low||0); high=Number(high||0); cur=Number(cur||0);
  let pos=high>low?((cur-low)/(high-low)*100):50; pos=Math.max(2,Math.min(98,pos));
  const fromHigh=high?((cur-high)/high*100):0, fromLow=low?((cur-low)/low*100):0;
  return `<div class="rangeMeter"><div class="rangeMeterBar"><div class="rangeMeterFill" style="width:${pos}%"></div><div class="rangeMeterDot" style="left:${pos}%" title="Now ${money(cur,currency)}"></div></div>
    <div class="rangeMeterEnds"><span class="rmEnd"><small>52W Low</small><b>${money(low,currency)}</b><i class="green">${fromLow>=0?"+":""}${fromLow.toFixed(1)}%</i></span><span class="rmEnd rmHigh"><small>52W High</small><b>${money(high,currency)}</b><i class="red">${fromHigh.toFixed(1)}%</i></span></div></div>`;
}
function statTile(label,val,klass=""){return `<div class="statTile"><span class="statTileLabel">${escapeHtml(label)}</span><b class="statTileVal ${klass}">${val}</b></div>`;}
function assetPerfPanel(a){
  const cur=a.currency;
  const tiles=[["Today",a.day],["This week",a.week],["This month",a.month],["This year",a.year]]
    .map(([l,v])=>statTile(l,signed(v),cls(v))).join("");
  const fromHigh=a.year_high?(((a.price-a.year_high)/a.year_high)*100):0;
  const fromLow=a.year_low?(((a.price-a.year_low)/a.year_low)*100):0;
  let chips="";
  if(a.sma50&&a.sma200) chips+=a.sma50>a.sma200?`<span class="trendChip up">▲ Uptrend · 50-day above 200-day</span>`:`<span class="trendChip down">▼ Downtrend · 50-day below 200-day</span>`;
  if(a.sma50) chips+=a.price>=a.sma50?`<span class="trendChip up">Above 50-day avg</span>`:`<span class="trendChip down">Below 50-day avg</span>`;
  if(a.sma50) chips+=`<span class="trendChip">50-day ${money(a.sma50,cur)}</span>`;
  if(a.sma200) chips+=`<span class="trendChip">200-day ${money(a.sma200,cur)}</span>`;
  return `<div class="card c12 assetTab" data-tab="performance"><div class="cardHead"><h3>Performance & Returns</h3><span class="pill">${escapeHtml(a.source||"Live")}</span></div>
    <div class="statGrid">${tiles}${statTile("From 52W low",`+${fromLow.toFixed(1)}%`,"green")}${statTile("From 52W high",`${fromHigh.toFixed(1)}%`,"red")}</div>
    <div class="rangeMeterWrap"><div class="rangeMeterTitle">Where it trades in its 52-week range</div>${rangeMeterHtml(a.year_low,a.year_high,a.price,cur)}</div>
    ${chips?`<div class="trendChips">${chips}</div>`:""}</div>`;
}
function assetDividendsPanel(a){
  const cur=a.currency, dy=Number(a.dividend_yield||0);
  const perShare=a.price?a.price*dy/100:0, income=(a.qty||0)*perShare;
  if(dy<=0) return `<div class="card c12 assetTab" data-tab="dividends"><div class="cardHead"><h3>Dividends & Income</h3><span class="pill">No dividend</span></div>
    <div class="emptyTab"><div class="emptyTabArt">🪙</div><b>${escapeHtml(a.name||a.symbol)} doesn't pay a dividend</b><span>This is a growth / non-distributing asset — returns come from price appreciation (see the Performance tab).</span></div></div>`;
  return `<div class="card c12 assetTab" data-tab="dividends"><div class="cardHead"><h3>Dividends & Income</h3><span class="pill">Income payer</span></div>
    <div class="statGrid two">${statTile("Dividend yield",dy.toFixed(2)+"%","green")}${statTile("Est. / share / yr",money(perShare,cur))}${statTile("Your annual income",a.qty?money(income,cur):"—")}${statTile("Yield on cost",a.avg?((perShare/a.avg)*100).toFixed(2)+"%":"—")}</div>
    <p class="assetNote">Estimated from the trailing yield. Check your broker for exact payout dates, frequency and withholding tax.</p></div>`;
}
function assetPricePanel(a){
  const cur=a.currency;
  const rsiK=a.rsi!=null?(a.rsi>70?"red":a.rsi<30?"green":""):"";
  const tiles=statTile("Current",money(a.price,cur))+statTile("52-week low",money(a.year_low,cur))+statTile("52-week high",money(a.year_high,cur))
    +statTile("50-day avg",a.sma50?money(a.sma50,cur):"—")+statTile("200-day avg",a.sma200?money(a.sma200,cur):"—")+statTile("RSI (14)",a.rsi!=null?Math.round(a.rsi):"—",rsiK);
  return `<div class="card c12 assetTab" data-tab="price"><div class="cardHead"><h3>Price Levels</h3><span class="pill">${escapeHtml(cur||"")}</span></div>
    <div class="rangeMeterWrap">${rangeMeterHtml(a.year_low,a.year_high,a.price,cur)}</div>
    <div class="statGrid two">${tiles}</div>
    <p class="assetNote">💡 Set an alert below ${money(a.year_low,cur)} for a buy-the-dip watch, or above ${money(a.year_high,cur)} for a breakout signal.</p></div>`;
}
function assetProfilePanel(a,f){
  const skip=new Set(["broker","currency","sector","country","instrument_type"]);
  const pretty={average_cost:"Avg cost",market_value:"Market value",market_value_eur:"Value (EUR)",unrealized_pl_eur:"Unrealized P/L (EUR)",unrealized_pl_pct:"Unrealized P/L %",position_qty:"Units held",current_price:"Current price",dividend_yield:"Dividend yield"};
  const fmtVal=(k,v)=>{
    if(typeof v==="number"){
      if(k.includes("eur")) return euro(v);
      if(k.includes("pct")||k==="dividend_yield") return Number(v).toFixed(2)+"%";
      if(k.includes("price")||k.includes("cost")||k.includes("value")) return money(v,a.currency);
      return Number(v).toLocaleString();
    }
    return escapeHtml(String(v));
  };
  const tiles=Object.entries(f).filter(([k])=>!skip.has(k)).map(([k,v])=>{
    const kl=k.includes("pl_")?cls(v):"";
    return statTile(pretty[k]||k.replaceAll("_"," "),fmtVal(k,v),kl);
  }).join("");
  return `<div class="card c12 assetTab" data-tab="profile"><div class="cardHead"><h3>Position & Fundamentals</h3><span class="pill">${escapeHtml(f.broker||"Watchlist")}</span></div>
    <div class="statGrid">${tiles||'<div class="cfoMuted">No fundamentals available for this instrument.</div>'}</div>
    <div class="profileMeta"><span>🏢 ${escapeHtml(a.sector||"—")}</span><span>📍 ${escapeHtml(a.country||"—")}</span><span>🏛 ${escapeHtml(a.market_name||a.market||"—")}</span><span>💱 ${escapeHtml(a.currency||"—")}</span><span>📡 ${escapeHtml(a.source||"—")}</span></div></div>`;
}
function assetEditPanel(a,ctx){
  const cur=a.currency, owned=(ctx&&ctx.owned)||Number(a.qty||0)>0;
  const snap=owned?`<div class="statGrid two">${statTile("Units held",Number(a.qty||0).toLocaleString())}${statTile("Avg cost",money(a.avg,cur))}${statTile("Market value",euro(a.value_eur))}${statTile("Unrealized P/L",`${euro(a.pl_eur)} (${signed(a.pl_pct)})`,cls(a.pl_eur))}</div>`
    :`<div class="assetNote">You don't hold ${escapeHtml(a.symbol)} yet. Add it as a holding to track P/L, or keep it on your watchlist.</div>`;
  const actions=owned
    ?`<button class="btn" onclick="editHolding('${escAttr(jsString(a.symbol))}')">Edit holding</button><button class="btn secondary" onclick="sellHolding('${escAttr(jsString(a.symbol))}')">Sell units</button>`
    :`<button class="btn" onclick="show('Portfolio',[...document.querySelectorAll('.nav button')].find(b=>/Portfolio/.test(b.textContent)))">Add as holding</button>`;
  return `<div class="card c12 assetTab" data-tab="edit"><div class="cardHead"><h3>Position & Actions</h3><span class="pill">${owned?"In portfolio":"Watchlist"}</span></div>
    ${snap}
    <div class="actionStack" style="margin-top:12px">${actions}<button class="btn secondary" onclick="addFavorite('${escAttr(jsString(a.symbol))}')">Add to favorites</button></div></div>`;
}
function showAssetTab(tab,btn){
  document.querySelectorAll(".assetTab").forEach(x=>x.style.display=(x.dataset.tab===tab||tab==="overview"&&x.dataset.tab==="overview")?"block":"none");
  document.querySelectorAll(".tabRow button").forEach(x=>x.classList.remove("active"));
  if(btn) btn.classList.add("active");
  if(tab==="performance" && state.charts.assetChart) setTimeout(()=>state.charts.assetChart.resize(),60);
}
async function assetDetailSearchSuggest(){
  const v=byId("assetDetailSearch")?.value.trim();
  const box=byId("assetDetailResults");
  if(!box || !v){if(box) box.style.display="none";return}
  const r=await searchAssets(v,{limit:30});
  state.assetDetailSearchRows=r;
  box.innerHTML=r.slice(0,10).map(a=>searchResultCard(a,"asset-detail")).join("");
  box.style.display=r.length?"block":"none";
}
/* ===== Premium interactive asset chart (crosshair, volume, hover read-out) ===== */
function wosRoundRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
function shortNum(n){n=Number(n||0);const s=n<0?"-":"";n=Math.abs(n);if(n>=1e12)return s+(n/1e12).toFixed(2)+"T";if(n>=1e9)return s+(n/1e9).toFixed(2)+"B";if(n>=1e6)return s+(n/1e6).toFixed(2)+"M";if(n>=1e3)return s+(n/1e3).toFixed(1)+"K";return s+n.toLocaleString();}
function fmtAxisDate(ts,range){const dt=new Date(ts*1000);if(range==="1h"||range==="1d"||range==="24h")return dt.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});if(range==="1y"||range==="2y"||range==="5y")return dt.toLocaleDateString([],{month:"short",year:"2-digit"});return dt.toLocaleDateString([],{month:"short",day:"numeric"});}
const wosCrosshairPlugin={id:"wosCrosshair",afterDraw(chart){if(!chart._active||!chart._active.length)return;const x=chart._active[0].element.x;const{top,bottom}=chart.chartArea;const ctx=chart.ctx;ctx.save();ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x,bottom);ctx.lineWidth=1;ctx.strokeStyle="rgba(148,163,184,.55)";ctx.setLineDash([4,4]);ctx.stroke();ctx.restore();}};
const wosLastLabelPlugin={id:"wosLastLabel",afterDatasetsDraw(chart){const meta=chart.getDatasetMeta(0);if(!meta||!meta.data||!meta.data.length)return;const pt=meta.data[meta.data.length-1];const val=chart.data.datasets[0].data[chart.data.datasets[0].data.length-1];if(pt==null||val==null)return;const ctx=chart.ctx;const color=chart._wosUp?"#16c784":"#ea3943";const txt=Number(val).toLocaleString(undefined,{maximumFractionDigits:2});ctx.save();ctx.font="700 11px Inter, sans-serif";const w=ctx.measureText(txt).width+14;const right=chart.chartArea.right;let y=pt.y;y=Math.max(chart.chartArea.top+9,Math.min(chart.chartArea.bottom-9,y));ctx.beginPath();ctx.arc(pt.x,pt.y,4,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();ctx.lineWidth=2;ctx.strokeStyle="rgba(255,255,255,.85)";ctx.stroke();ctx.fillStyle=color;wosRoundRect(ctx,right-w-1,y-9,w,18,5);ctx.fill();ctx.fillStyle="#fff";ctx.textBaseline="middle";ctx.textAlign="center";ctx.fillText(txt,right-w/2-1,y);ctx.restore();}};
function setChartHeader(p,d,first){
  const hd=byId("chartHoverDate"),hp=byId("chartHoverPrice"),hc=byId("chartHoverChange");
  if(!p) return;
  const cur=d.currency||"";
  if(hp) hp.textContent=`${cur} ${Number(p.close).toLocaleString(undefined,{maximumFractionDigits:2})}`;
  if(hd) hd.textContent=new Date(p.time*1000).toLocaleString([], {dateStyle:"medium",timeStyle:(d.range==="1h"||d.range==="1d")?"short":undefined});
  if(hc){const ch=first?((p.close-first)/first*100):0;const abs=p.close-first;hc.className="chartHoverChange "+cls(ch);hc.textContent=`${ch>=0?"▲":"▼"} ${cur} ${Math.abs(abs).toLocaleString(undefined,{maximumFractionDigits:2})} (${signed(ch)})`;}
}
function drawAssetChart(d){
  const el=byId("assetChart"); if(!el) return;
  if(state.charts.assetChart){ state.charts.assetChart.destroy(); delete state.charts.assetChart; }
  if(!window.Chart) return;
  const pts=(d&&d.points)||[];
  const hp=byId("chartHoverPrice"),hd=byId("chartHoverDate"),hc=byId("chartHoverChange");
  if(!pts.length){ if(hp)hp.textContent="No data for this range"; if(hd)hd.textContent=""; if(hc)hc.textContent=""; return; }
  const closes=pts.map(p=>p.close);
  const vols=pts.map(p=>p.volume||0);
  const hasVol=vols.some(v=>v>0);
  const labels=pts.map(p=>fmtAxisDate(p.time,d.range));
  const first=closes[0], last=closes[closes.length-1], up=last>=first;
  const line=up?"#16c784":"#ea3943";
  const ctx=el.getContext("2d");
  const grad=ctx.createLinearGradient(0,0,0,300);
  grad.addColorStop(0,up?"rgba(22,199,132,.30)":"rgba(234,57,67,.30)");
  grad.addColorStop(1,up?"rgba(22,199,132,0)":"rgba(234,57,67,0)");
  const datasets=[{label:"Price",data:closes,borderColor:line,backgroundColor:grad,borderWidth:2,fill:true,tension:.25,pointRadius:0,pointHoverRadius:5,pointHoverBackgroundColor:line,pointHoverBorderColor:"#fff",pointHoverBorderWidth:2,yAxisID:"y",order:1}];
  if(hasVol) datasets.push({type:"bar",label:"Volume",data:vols,backgroundColor:"rgba(148,163,184,.20)",hoverBackgroundColor:"rgba(148,163,184,.45)",borderWidth:0,yAxisID:"vol",order:2,barPercentage:1,categoryPercentage:1});
  const muted=getComputedStyle(document.body).getPropertyValue("--muted").trim()||"#94a3b8";
  const grid=getComputedStyle(document.body).getPropertyValue("--grid").trim()||"rgba(148,163,184,.12)";
  setChartHeader(pts[pts.length-1],d,first);
  const c=new Chart(el,{
    type:"line",
    data:{labels,datasets},
    options:{
      responsive:true,maintainAspectRatio:false,animation:{duration:350},
      interaction:{mode:"index",intersect:false},
      onHover:(e,act)=>{ if(act&&act.length) setChartHeader(pts[act[0].index],d,first); },
      plugins:{
        legend:{display:false},
        tooltip:{enabled:true,mode:"index",intersect:false,backgroundColor:"rgba(15,23,42,.96)",padding:10,borderColor:"rgba(148,163,184,.25)",borderWidth:1,titleColor:"#fff",bodyColor:"#e2e8f0",displayColors:false,
          callbacks:{
            title:(items)=>new Date(pts[items[0].dataIndex].time*1000).toLocaleString(),
            label:(item)=>{const p=pts[item.dataIndex];const cur=d.currency||"";const rows=[`Price  ${cur} ${Number(p.close).toLocaleString()}`];if(p.high&&p.low)rows.push(`H ${Number(p.high).toLocaleString()}  ·  L ${Number(p.low).toLocaleString()}`);if(p.volume)rows.push(`Vol  ${shortNum(p.volume)}`);return rows;}
          }
        }
      },
      scales:{
        x:{ticks:{color:muted,maxTicksLimit:7,maxRotation:0,autoSkip:true,font:{size:11}},grid:{display:false}},
        y:{position:"right",ticks:{color:muted,maxTicksLimit:6,callback:v=>shortNum(v),font:{size:11}},grid:{color:grid}},
        vol:{display:false,position:"left",min:0,max:(Math.max(...vols)||1)*4,grid:{display:false}}
      }
    },
    plugins:[wosCrosshairPlugin,wosLastLabelPlugin]
  });
  c._wosUp=up;
  state.charts.assetChart=c;
  // reset legend toggles for the fresh chart
  byId("legend-price")?.classList.remove("legendOff");
  const volLeg=byId("legend-volume");
  if(volLeg){ volLeg.classList.remove("legendOff"); volLeg.style.display=hasVol?"":"none"; }
}
function toggleChartSeries(which){
  const ch=state.charts.assetChart; if(!ch) return;
  const idx=which==="volume"?1:0;
  if(idx>=ch.data.datasets.length) return;
  const vis=ch.isDatasetVisible(idx);
  ch.setDatasetVisibility(idx,!vis);
  ch.update();
  byId("legend-"+which)?.classList.toggle("legendOff",vis);
}
async function loadAssetChart(sym,range,btn){
  state.assetChartSym=sym; state.assetChartRange=range;
  document.querySelectorAll("#assetRangeTabs button").forEach(b=>b.classList.toggle("active",b.dataset.range===range));
  let h;
  try{ h=await get(`/asset-history?symbol=${encodeURIComponent(sym)}&range_=${encodeURIComponent(range)}`); }
  catch(e){ h={points:[],range}; }
  if(!h.range) h.range=range;
  drawAssetChart(h);
}
async function loadIpos(){
  try{state.ipoData=await get("/ipos");}catch(e){state.ipoData=null;}
  const sel=byId("ipoExchange");
  if(sel && state.ipoData){
    const cur=sel.value;
    sel.innerHTML=`<option value="">All exchanges</option>`+(state.ipoData.exchanges||[]).map(e=>`<option ${e===cur?"selected":""}>${escapeHtml(e)}</option>`).join("");
  }
  renderIpos();
}
function renderIpos(){
  const grid=byId("ipoGrid");
  if(!grid) return;
  const data=state.ipoData;
  const srcEl=byId("ipoSource");
  const linksEl=byId("ipoExchangeLinks");
  if(linksEl && data){
    const L=data.exchange_links||{};
    linksEl.innerHTML=`<span class="ipoLinksLabel">Official IPO calendars:</span>`+Object.entries(L).map(([k,u])=>`<a class="btn secondary smallBtn" href="${escAttr(u)}" target="_blank" rel="noopener">${escapeHtml(k)} →</a>`).join("");
  }
  if(!data){grid.innerHTML=`<div class="ipoEmpty">IPO calendar is unavailable right now.</div>`;if(srcEl)srcEl.textContent="";return;}
  const status=byId("ipoStatus")?.value||"upcoming";
  const ex=byId("ipoExchange")?.value||"";
  const text=(byId("ipoFilter")?.value||"").toLowerCase();
  let rows=(data.items||[]).slice();
  if(status!=="all") rows=rows.filter(r=>r.status===status);
  if(ex) rows=rows.filter(r=>String(r.exchange||"").toUpperCase()===ex.toUpperCase());
  if(text) rows=rows.filter(r=>`${r.company} ${r.symbol} ${r.sector} ${r.exchange} ${r.country}`.toLowerCase().includes(text));
  const c=data.counts||{};
  const isSample=/sample/i.test(data.source||"");
  const note=isSample
    ? ` <b>Note:</b> this in-app list is a sample, so each exchange shows only a few names. For the complete, current IPO list (BSE/NSE have many more), open the official calendars below.`
    : ` Verify on the official exchange calendars below.`;
  if(srcEl) srcEl.innerHTML=`<b>${rows.length}</b> ${status==="all"?"IPOs":status==="upcoming"?"upcoming IPOs":"recently listed IPOs"}${ex?` on ${escapeHtml(ex)}`:""} · ${c.upcoming||0} upcoming, ${c.listed||0} recently listed across ${(data.exchanges||[]).length} exchanges. Source: ${escapeHtml(data.source||"")}.${note}`;
  if(!rows.length){grid.innerHTML=`<div class="ipoEmpty">No IPOs match this filter. Try “All” status or a different exchange.</div>`;return;}
  grid.innerHTML=rows.map(r=>{
    const up=r.status==="upcoming";
    const url=r.url||`https://www.google.com/search?q=${encodeURIComponent((r.company||r.symbol)+" IPO")}`;
    return `<div class="ipoCard ${r.status}">
      <div class="ipoCardTop"><span class="ipoExch">${escapeHtml(r.exchange||"")}</span><span class="ipoBadge ${r.status}">${up?"Upcoming":"Listed"}</span></div>
      <h4 class="ipoName">${escapeHtml(r.company||r.symbol)}</h4>
      <div class="ipoSub">${escapeHtml(r.symbol||"")}${r.sector?` • ${escapeHtml(r.sector)}`:""}${r.country?` • ${escapeHtml(r.country)}`:""}</div>
      <div class="ipoRows"><div><span>${up?"Expected":"Listed"}</span><b>${escapeHtml(r.date||"TBA")}</b></div><div><span>Price band</span><b>${escapeHtml(r.price_range||"TBA")}</b></div><div><span>Deal size</span><b>${escapeHtml(r.deal_size||"—")}</b></div></div>
      <a class="btn secondary smallBtn ipoLink" href="${escAttr(url)}" target="_blank" rel="noopener">Details →</a>
    </div>`;
  }).join("");
}
/* ===== Notifications ===== */
function seenNotifs(){try{return JSON.parse(localStorage.getItem("wealthos_seen_notifs")||"[]")||[]}catch(e){return []}}
function saveSeenNotifs(ids){try{localStorage.setItem("wealthos_seen_notifs",JSON.stringify(ids.slice(-300)))}catch(e){}}
function computeNotifications(){
  const holdings=state.lastHoldings||[];
  const favs=state.favoriteRows||[];
  const alertsRows=state.alertsRows||[];
  const watch={};
  [...holdings,...favs].forEach(a=>{if(a&&a.symbol) watch[a.symbol.toUpperCase()]=a;});
  alertsRows.forEach(a=>{const s=String(a.symbol||"").toUpperCase(); if(a.asset&&!watch[s]) watch[s]=a.asset;});
  const list=[];
  alertsRows.forEach(a=>{
    const asset=a.asset||watch[String(a.symbol||"").toUpperCase()]||{};
    const price=Number(asset.price||0), target=Number(a.target||0);
    if(!price||!target) return;
    const cond=a.condition||"above";
    const hit=cond==="above"?price>=target:price<=target;
    if(hit) list.push({id:`alert:${a.symbol}:${cond}:${target}`,sev:"high",icon:"🔔",symbol:a.symbol,
      title:`${a.symbol} alert triggered`,text:`Now ${money(price,asset.currency)} — ${cond} your target ${money(target,asset.currency)}.`});
  });
  Object.values(watch).forEach(a=>{
    const price=Number(a.price||0), low=Number(a.year_low||0), high=Number(a.year_high||0);
    if(price&&low&&price<=low*1.03)
      list.push({id:`low:${a.symbol}`,sev:"high",icon:"📉",symbol:a.symbol,title:`${a.name||a.symbol} near 52-week low`,
        text:`At ${money(price,a.currency)} vs year low ${money(low,a.currency)} — potential value/buy zone.`});
    else if(price&&high&&price>=high*0.98)
      list.push({id:`high:${a.symbol}`,sev:"med",icon:"📈",symbol:a.symbol,title:`${a.name||a.symbol} near 52-week high`,
        text:`At ${money(price,a.currency)} vs year high ${money(high,a.currency)} — breakout / overbought watch.`});
    if(a.rsi!=null){
      if(Number(a.rsi)<30) list.push({id:`rsiLow:${a.symbol}`,sev:"med",icon:"🟢",symbol:a.symbol,title:`${a.symbol} is oversold`,text:`RSI ${Math.round(a.rsi)} (below 30) — often a bounce / value zone.`});
      else if(Number(a.rsi)>70) list.push({id:`rsiHigh:${a.symbol}`,sev:"low",icon:"🔴",symbol:a.symbol,title:`${a.symbol} is overbought`,text:`RSI ${Math.round(a.rsi)} (above 70) — momentum may be stretched.`});
    }
  });
  holdings.forEach(a=>{
    const dmove=Number(a.day||0);
    if(Math.abs(dmove)>=5) list.push({id:`move:${a.symbol}:${dmove>=0?"up":"down"}`,sev:dmove>=0?"low":"med",icon:dmove>=0?"🚀":"⚠️",symbol:a.symbol,
      title:`${a.symbol} ${dmove>=0?"jumped":"dropped"} ${signed(dmove)} today`,text:`${a.name||a.symbol} is a big mover in your portfolio today.`});
  });
  (state.aiDesk?.green_lights||[]).forEach(a=>{
    const adv=a.advisor||{};
    list.push({id:`aibuy:${a.symbol}:${adv.entry}`,sev:"high",icon:"🧠",symbol:a.symbol,
      title:`AI Desk: green light on ${a.symbol}`,
      text:`Score ${a.score}/100 · buy near ${money(adv.entry,a.currency)}, target ${money(adv.target,a.currency)} (R:R ${adv.risk_reward}). Open AI Desk to track it.`});
  });
  const seen=new Set(), dedup=[];
  list.forEach(n=>{if(!seen.has(n.id)){seen.add(n.id);dedup.push(n);}});
  const rank={high:0,med:1,low:2};
  dedup.sort((a,b)=>(rank[a.sev]??3)-(rank[b.sev]??3));
  const prevIds=new Set((state.notifications||[]).map(n=>n.id));
  state.notifications=dedup;
  renderNotifBadge();
  if(byId("notifPanel")?.classList.contains("open")) renderNotifPanel();
  if(!state.notifBooted){state.notifBooted=true;return;}
  const seenIds=seenNotifs();
  dedup.filter(n=>n.sev==="high" && !prevIds.has(n.id) && !seenIds.includes(n.id)).slice(0,3)
    .forEach(n=>showToast(`${n.icon} ${n.title}`,"alert"));
}
function renderNotifBadge(){
  const badge=byId("notifBadge");
  if(!badge) return;
  const seenIds=seenNotifs();
  const unread=(state.notifications||[]).filter(n=>!seenIds.includes(n.id)).length;
  badge.textContent=unread>9?"9+":String(unread);
  badge.style.display=unread>0?"flex":"none";
}
function renderNotifPanel(){
  const list=byId("notifList");
  if(!list) return;
  const seenIds=seenNotifs();
  const items=state.notifications||[];
  if(!items.length){list.innerHTML=`<div class="notifEmpty">You're all caught up.<br><span>Triggered alerts, 52-week lows and big moves will appear here.</span></div>`;return;}
  list.innerHTML=items.map(n=>`<button class="notifItem ${n.sev} ${seenIds.includes(n.id)?"":"unread"}" ${n.symbol?`onclick="notifOpen('${escAttr(jsString(n.symbol))}')"`:""}>
    <span class="notifIcon">${n.icon||"•"}</span>
    <span class="notifTextWrap"><b>${escapeHtml(n.title)}</b><span>${escapeHtml(n.text)}</span></span>
  </button>`).join("");
}
function toggleNotifPanel(){
  const p=byId("notifPanel");
  if(!p) return;
  const opening=!p.classList.contains("open");
  p.classList.toggle("open");
  if(opening){renderNotifPanel();markNotifsSeen(false);}
}
function notifOpen(sym){byId("notifPanel")?.classList.remove("open");markNotifsSeen(false);openAsset(sym);}
function markNotifsSeen(rerender){
  const ids=(state.notifications||[]).map(n=>n.id);
  saveSeenNotifs(Array.from(new Set([...seenNotifs(),...ids])));
  renderNotifBadge();
  if(rerender) renderNotifPanel();
}
function showToast(msg,type="info"){
  let c=byId("toastWrap");
  if(!c){c=document.createElement("div");c.id="toastWrap";c.className="toastWrap";document.body.appendChild(c);}
  const t=document.createElement("div");
  t.className="toast "+type;
  t.innerHTML=`<span>${escapeHtml(msg)}</span>`;
  c.appendChild(t);
  requestAnimationFrame(()=>t.classList.add("show"));
  setTimeout(()=>{t.classList.remove("show");setTimeout(()=>t.remove(),300);},3800);
}
/* Route any legacy native alert() through the premium toast (non-blocking, styled) */
window.alert=function(msg){try{showToast(String(msg),"alert");}catch(e){console.warn(msg);}};
/* ===== AI Investment Desk (6-agent brain) ===== */
const DESK_AGENTS=[
  {i:"👁️",n:"Watcher",d:"tracks favorites live, per exchange"},
  {i:"🔬",n:"Analyst",d:"scores 6 factors after hours + news"},
  {i:"🔮",n:"Strategist",d:"predicts direction, target & horizon"},
  {i:"🎯",n:"Advisor",d:"issues buy/sell calls with a plan"},
  {i:"📋",n:"Tracker",d:"monitors live price vs the plan"},
  {i:"⭐",n:"Rater",d:"grades accuracy & retunes the brain"},
];
function deskScoreColor(s){return s>=68?"var(--green)":s>=50?"var(--amber)":"var(--red)";}
async function loadAiDesk(){
  try{state.aiDesk=await get("/ai-desk"+q());}catch(e){state.aiDesk=null;}
  const sel=byId("deskExFilter");
  if(sel && state.aiDesk){const cur=sel.value;sel.innerHTML=`<option value="">All exchanges</option>`+(state.aiDesk.exchanges||[]).map(e=>`<option ${e.code===cur?"selected":""}>${escapeHtml(e.code)}</option>`).join("");}
  renderAiDesk();
}
function renderAiDesk(){
  if(!byId("deskAssets")) return;
  const d=state.aiDesk;
  if(byId("deskPipeline")) deskPipeline.innerHTML=DESK_AGENTS.map((a,i)=>`<div class="deskAgent"><span class="deskAgentIcon">${a.i}</span><div><b>${a.n}</b><small>${a.d}</small></div></div>${i<5?'<span class="deskArrow">→</span>':""}`).join("");
  if(!d){byId("deskSummary").textContent="AI desk unavailable.";return;}
  if(!d.watched){
    byId("deskSummary").innerHTML="No favorites yet. ⭐ Star stocks/funds (from Favorites, search, or any asset page) and the desk will start watching them per exchange.";
    ["deskExchanges","deskGreen","deskAssets"].forEach(id=>byId(id)&&(byId(id).innerHTML=""));
    renderDeskScorecard(d.scorecard);
    return;
  }
  byId("deskSummary").innerHTML=`Watching <b>${d.watched}</b> favorites across <b>${(d.exchanges||[]).length}</b> exchanges. <b>${(d.green_lights||[]).length}</b> green-light buy${(d.green_lights||[]).length===1?"":"s"} right now. Last run ${d.generated?new Date(d.generated).toLocaleTimeString():"—"}.`;
  byId("deskExchanges").innerHTML=(d.exchanges||[]).map(e=>`<div class="deskExCard"><div class="deskExTop"><b>${escapeHtml(e.code)}</b><span class="marketDot ${e.open?"open":"closed"}"></span></div><small class="deskExName">${escapeHtml(e.name||"")}</small><div class="deskExStats"><span>${e.count} watched</span><span class="${e.buy_signals?"green":""}">${e.buy_signals} buy</span><span>avg ${e.avg_score}</span></div><small class="cfoMuted">${e.open?"Open":"Closed"} · ${escapeHtml(e.session||"")}</small></div>`).join("");
  byId("deskGreen").innerHTML=(d.green_lights||[]).length?d.green_lights.map(deskGreenCard).join(""):'<div class="deskEmpty">No green-light buys right now — the desk only fires when score, trend and risk:reward all align. It keeps watching 24/7.</div>';
  let rows=(d.assets||[]).slice();
  const f=(byId("deskFilter")?.value||"").toLowerCase(), ex=byId("deskExFilter")?.value||"", sort=byId("deskSort")?.value||"score";
  if(f) rows=rows.filter(a=>`${a.symbol} ${a.name} ${a.sector}`.toLowerCase().includes(f));
  if(ex) rows=rows.filter(a=>a.market===ex);
  rows.sort((a,b)=>sort==="confidence"?b.strategist.confidence-a.strategist.confidence:sort==="upside"?b.advisor.upside_pct-a.advisor.upside_pct:b.score-a.score);
  byId("deskAssets").innerHTML=rows.map(deskAssetCard).join("")||'<div class="deskEmpty">No matches.</div>';
  renderDeskScorecard(d.scorecard);
}
function deskGreenCard(a){
  const adv=a.advisor,s=a.strategist;
  return `<div class="deskGreenCard"><div class="deskGreenTop"><button class="ticker deskName" onclick="openAsset('${escAttr(jsString(a.symbol))}')"><b>${escapeHtml(a.symbol)}</b> ${escapeHtml(a.name||"")}</button><span class="techVerdict bullish">BUY · ${a.score}/100</span></div>
    <div class="deskPlanRow"><span><small>Entry</small><b>${money(adv.entry,a.currency)}</b></span><span><small>Target</small><b class="green">${money(adv.target,a.currency)} +${adv.upside_pct}%</b></span><span><small>Stop</small><b class="red">${money(adv.stop,a.currency)} −${adv.downside_pct}%</b></span><span><small>R:R</small><b>${adv.risk_reward??"—"}</b></span><span><small>Conf.</small><b>${s.confidence}%</b></span></div>
    <p class="deskPlan">${escapeHtml(adv.plan)}</p><p class="deskRat">${escapeHtml(a.rationale)}</p>
    <div class="deskActions"><button class="btn" onclick="deskBuy('${escAttr(jsString(a.symbol))}')">📌 I bought this — track it</button><button class="btn secondary" onclick="openAsset('${escAttr(jsString(a.symbol))}')">Open chart</button></div></div>`;
}
function deskAssetCard(a){
  const adv=a.advisor,s=a.strategist;
  const badge=adv.action.startsWith("BUY")?"bullish":adv.action.includes("TRIM")?"bearish":"neutral";
  const facts=Object.entries(a.factors).map(([k,v])=>`<span class="deskFactor" title="${k}: ${v}"><i>${k.slice(0,4)}</i><b class="${v>=0?"green":"red"}">${v>=0?"+":""}${Math.round(v*100)}</b></span>`).join("");
  return `<details class="deskAsset"><summary><span class="deskScore" style="--sc:${deskScoreColor(a.score)}">${a.score}</span><span class="deskAName"><b>${escapeHtml(a.symbol)}</b><small>${escapeHtml(a.name||"")} · ${escapeHtml(a.market||"")}</small></span><span class="techVerdict ${badge} deskBadge">${escapeHtml(adv.action)}</span><span class="deskDir">${s.direction==="up"?"▲":s.direction==="down"?"▼":"▬"} ${s.confidence}%</span></summary>
    <div class="deskAssetBody"><div class="deskFactors">${facts}</div>
    <div class="deskPlanRow"><span><small>Entry</small><b>${money(adv.entry,a.currency)}</b></span><span><small>Target</small><b class="green">${money(adv.target,a.currency)}</b></span><span><small>Stop</small><b class="red">${money(adv.stop,a.currency)}</b></span><span><small>R:R</small><b>${adv.risk_reward??"—"}</b></span></div>
    <p class="deskRat">${escapeHtml(a.rationale)}</p><p class="deskPlan">${escapeHtml(adv.plan)}</p>
    <div class="deskActions"><button class="btn secondary smallBtn" onclick="deskBuy('${escAttr(jsString(a.symbol))}')">Track call</button><button class="btn secondary smallBtn" onclick="openAsset('${escAttr(jsString(a.symbol))}')">Open</button></div></div></details>`;
}
function renderDeskScorecard(sc){
  const el=byId("deskScorecard");
  if(!el||!sc) return;
  const w=sc.weights||{};
  const wins=sc.wins||0, losses=sc.losses||0, decided=wins+losses;
  const winPct=decided?Math.round(wins/decided*100):0;
  const ratingPct=Math.max(0,Math.min(100,sc.rating||0));
  const best=sc.best_call, worst=sc.worst_call;
  el.innerHTML=`<div class="deskRating">
      <div class="deskRatingDial" style="--sc:${deskScoreColor(sc.rating)};--pct:${ratingPct}"><div class="deskRatingNum">${sc.rating}</div></div>
      <div class="deskRatingMeta"><b>${escapeHtml(sc.grade)}</b><small>AI rating / 100</small>
        <div class="deskRatingTrack"><i style="width:${ratingPct}%;background:${deskScoreColor(sc.rating)}"></i></div></div>
    </div>
    <p class="deskVerdict">${escapeHtml(sc.verdict||sc.note||"")}</p>
    <div class="deskScoreStats"><span><b>${sc.hit_rate==null?"—":sc.hit_rate+"%"}</b><small>Hit rate</small></span><span><b>${sc.calls_closed}</b><small>Resolved</small></span><span class="${sc.avg_pl_pct>=0?"green":"red"}"><b>${sc.avg_pl_pct>=0?"+":""}${sc.avg_pl_pct}%</b><small>Avg P/L</small></span><span><b>${sc.open_calls}</b><small>Open</small></span><span class="${(sc.open_pl_pct||0)>=0?"green":"red"}"><b>${(sc.open_pl_pct||0)>=0?"+":""}${sc.open_pl_pct||0}%</b><small>Open P/L</small></span><span><b>${sc.tracked_total||0}</b><small>Total tracked</small></span></div>
    ${decided?`<div class="deskWinLoss"><div class="deskWLHead"><span class="green">${wins} win${wins===1?"":"s"}</span><span class="deskWLPct">${winPct}% win rate</span><span class="red">${losses} loss${losses===1?"":"es"}</span></div><div class="deskWLBar"><i class="wlWin" style="width:${winPct}%"></i><i class="wlLoss" style="width:${100-winPct}%"></i></div></div>`:""}
    ${(best||worst)?`<div class="deskExtremes">${best?`<div class="deskExtreme up"><small>Best call</small><b>${escapeHtml(best.symbol)}</b><i class="green">${best.pl_pct>=0?"+":""}${best.pl_pct}%</i></div>`:""}${worst?`<div class="deskExtreme down"><small>Worst call</small><b>${escapeHtml(worst.symbol)}</b><i class="${worst.pl_pct>=0?"green":"red"}">${worst.pl_pct>=0?"+":""}${worst.pl_pct}%</i></div>`:""}</div>`:""}
    <div class="deskWeights"><small>Factor weights (auto-tuned by results):</small>${Object.entries(w).map(([k,v])=>`<div class="deskWRow"><span>${escapeHtml(k)}</span><div class="deskWBar"><i style="width:${Math.min(v/2.5*100,100)}%"></i></div><b>${v}</b></div>`).join("")}</div>
    <p class="cfoMuted">${escapeHtml(sc.note||"")}</p>`;
  const calls=(state.aiDesk?.open_calls||[]);
  if(byId("deskCalls")) deskCalls.innerHTML=calls.length?calls.map(c=>`<div class="deskCall"${c.note?` title="${escAttr(c.note)}"`:""}><span class="ticker" onclick="openAsset('${escAttr(jsString(c.symbol))}')">${escapeHtml(c.symbol)}</span><span class="cfoMuted">@ ${Number(c.entry).toLocaleString()}${c.units?` × ${c.units}`:""}</span><span class="${(c.pl_pct||0)>=0?"green":"red"}">${(c.pl_pct||0)>=0?"+":""}${c.pl_pct||0}%</span><button class="btn secondary smallBtn" onclick="deskCloseCall(${Number(c.id)})">Close</button></div>`).join(""):'<div class="deskEmpty">No tracked calls yet. Hit “track it” on a buy and the AI grades itself over time.</div>';
}
function deskBuy(sym){
  const a=(state.aiDesk?.assets||[]).find(x=>x.symbol===sym);
  if(!a) return;
  const adv=a.advisor;
  state.trackCtx={symbol:sym,name:a.name,currency:a.currency,advisor:adv,score:a.score,factors:a.factors};
  byId("trackTitle").textContent=`Track ${sym} · ${adv.action}`;
  byId("trackPlanCard").innerHTML=`<div class="trackPlanTop"><b>${escapeHtml(sym)}</b> <span>${escapeHtml(a.name||"")}</span><span class="techVerdict bullish">AI score ${a.score}/100</span></div>
    <div class="trackPlanGrid"><span><small>AI entry</small><b>${money(adv.entry,a.currency)}</b></span><span><small>Target</small><b class="green">${money(adv.target,a.currency)} +${adv.upside_pct}%</b></span><span><small>Stop</small><b class="red">${money(adv.stop,a.currency)} −${adv.downside_pct}%</b></span><span><small>R:R</small><b>${adv.risk_reward??"—"}</b></span></div>
    <p class="trackPlanNote">${escapeHtml(adv.plan)}</p>`;
  byId("trackPrice").value=adv.entry;
  byId("trackPriceHint").textContent=`AI suggested entry ${money(adv.entry,a.currency)} — enter the price you actually paid`;
  byId("trackUnits").value="";
  byId("trackNote").value="";
  updateTrackPreview();
  byId("deskTrackModal").classList.add("open");
  setTimeout(()=>byId("trackPrice")?.focus(),60);
}
function closeDeskTrack(){byId("deskTrackModal")?.classList.remove("open");state.trackCtx=null;}
function updateTrackPreview(){
  const c=state.trackCtx||{}, adv=c.advisor||{};
  const price=Number(byId("trackPrice")?.value||0), units=Number(byId("trackUnits")?.value||0);
  const box=byId("trackPreview"); if(!box) return;
  if(!(price>0)){box.innerHTML='<div class="sellWarn">Enter your buy price to see the plan.</div>';return;}
  const upside=adv.target?((adv.target-price)/price*100):0;
  const downside=adv.stop?((price-adv.stop)/price*100):0;
  const rr=downside>0?(upside/downside):0;
  let rows=`<div class="trackPRow"><span>Upside to target</span><b class="green">+${upside.toFixed(1)}%</b></div>`+
           `<div class="trackPRow"><span>Risk to stop</span><b class="red">−${Math.abs(downside).toFixed(1)}%</b></div>`+
           `<div class="trackPRow"><span>Your risk : reward</span><b>${rr>0?("1 : "+rr.toFixed(2)):"—"}</b></div>`;
  if(units>0) rows+=`<div class="trackPRow"><span>Position cost</span><b>${money(price*units,c.currency)}</b></div>`+
                    `<div class="trackPRow"><span>Value at target</span><b class="green">${money(adv.target*units,c.currency)}</b></div>`;
  let warn="";
  if(adv.target && price>=adv.target) warn=`<div class="sellWarn">⚠️ Your price is already at/above the AI target — limited upside left.</div>`;
  else if(adv.stop && price<=adv.stop) warn=`<div class="sellWarn">⚠️ Your price is at/below the stop — high risk.</div>`;
  box.innerHTML=rows+warn;
}
async function confirmDeskTrack(){
  const c=state.trackCtx; if(!c) return;
  const adv=c.advisor;
  const price=Number(byId("trackPrice")?.value||0);
  if(!Number.isFinite(price)||price<=0) return showToast("Enter a valid buy price.","alert");
  const units=Number(byId("trackUnits")?.value||0);
  const note=(byId("trackNote")?.value||"").trim();
  try{
    await post("/ai-desk/track",{symbol:c.symbol,action:adv.action,entry:price,target:adv.target,stop:adv.stop,score:c.score,factors:c.factors,units:units>0?units:0,note});
    closeDeskTrack();
    showToast(`📌 Tracking ${c.symbol} from ${money(price,c.currency)} — the AI will grade this call`,"success");
    loadAiDesk();
  }catch(e){showToast(e.message||"Could not track call","alert");}
}
function deskCloseCall(id){
  post("/ai-desk/close/"+id,{}).then(()=>{showToast("Call closed & scored","success");loadAiDesk();}).catch(e=>alert(e.message));
}
async function loadBrokers(){
  let b=[];
  try{ b=await get("/brokers/status"); }catch(e){ b=[]; }
  state.brokerStatus=b;
  // populate the CSV-import profile picker
  const ip=byId("importProfile");
  if(ip){ ip.innerHTML=(state.profiles||[]).map(p=>`<option value="${escAttr(p.id)}">${escapeHtml(p.name)}</option>`).join(""); ip.value=selectedProfile(); }
  table("brokers",["Broker","Connection","Method","Action"],b.map(x=>{
    const connected=!!x.configured;
    let actions="";
    if(x.live){
      actions = connected
        ? `<button class="btn smallBtn" onclick="syncBroker('${escAttr(jsString(x.key||x.broker))}')">Sync now</button> <button class="btn secondary smallBtn" onclick="disconnectBroker('${escAttr(jsString(x.key||x.broker))}','${escAttr(jsString(x.broker))}')">Disconnect</button>`
        : `<button class="btn smallBtn" onclick='openBrokerConnect(${JSON.stringify({key:x.key||x.broker,broker:x.broker,fields:x.fields||[],method:x.method})})'>Connect</button>`;
    }else{
      actions = `<button class="btn secondary smallBtn" onclick="show('Brokers');byId('importCsv').scrollIntoView({block:'center'})">Import CSV ↑</button>`;
    }
    return [
      escapeHtml(x.broker),
      `<span class="brokerBadge ${connected?"connected":(x.live?"setup":"manual")}">${connected?"Connected":(x.live?"Not connected":"CSV import")}</span>`,
      escapeHtml(x.method),
      actions
    ];
  }));
  await loadBrokerDetails();
  loadDataProviders();
}
/* ---- Market data providers + keys ---- */
function _exMoney(p,c){
  if(p==null) return "";
  c=c||"";
  if(c.includes("/oz")) return `$${Number(p).toLocaleString(undefined,{maximumFractionDigits:0})}/oz`;
  const sym={USD:"$",EUR:"€",INR:"₹",GBP:"£"}[c]||"";
  return `${sym}${Number(p).toLocaleString(undefined,{maximumFractionDigits:p<10?4:0})}`;
}
async function loadDataProviders(){
  const box=byId("dataProviders"); if(!box) return;
  if(!box.innerHTML.trim()) box.innerHTML='<div class="cfoMuted">Checking every exchange…</div>';
  let data=null;
  try{ data=await get("/live/providers"); }catch(e){ data=null; }
  if(!data||!data.providers){ box.innerHTML='<div class="cfoMuted">Provider status unavailable.</div>'; return; }
  const ex=data.exchanges||[];
  if(byId("dataLiveCount")) dataLiveCount.textContent=`${data.live_count??0}/${data.total??ex.length} markets live`;
  const exHtml = ex.length ? `<div class="dpHead">📡 Live exchanges <span class="dpHeadSub">— data fetched straight from each market, no broker login needed</span></div>
    <div class="exGrid">`+ex.map(e=>`<div class="exCard ${e.live?"on":"off"}">
      <div class="exTop"><span class="liveDot ${e.live?"open":"closed"}"></span><b>${escapeHtml(e.market)}</b><span class="exBadge ${e.live?"live":"down"}">${e.live?"LIVE":"down"}</span></div>
      ${e.brokers?`<div class="exBrokers">${escapeHtml(e.brokers)}</div>`:""}
      <div class="exFoot"><span class="exPrice">${e.live?(e.price!=null?escapeHtml(_exMoney(e.price,e.currency)):"live"):"—"}</span><span class="exSrc">${escapeHtml(e.source||"")}</span></div>
    </div>`).join("")+`</div>` : "";
  const provHtml = `<div class="dpHead">🔌 Data sources</div><div class="dataProvGrid">`+data.providers.map(p=>`<div class="dataProv ${p.active?"on":"off"}"><div class="dataProvTop"><span class="liveDot ${p.active?"open":"closed"}"></span><b>${escapeHtml(p.name)}</b>${p.keyless?'<span class="dpTag">keyless</span>':'<span class="dpTag key">needs key</span>'}</div><small>${escapeHtml(p.covers)}</small><small class="dataProvDetail">${p.active?"✓ ":""}${escapeHtml(p.detail)}</small></div>`).join("")+`</div>`;
  box.innerHTML = exHtml + provHtml;
}
async function saveDataKeys(){
  const out=byId("dataKeyResult");
  const map={twelvedata:"key_twelvedata",finnhub:"key_finnhub",alphavantage:"key_alphavantage"};
  let saved=0;
  if(out) out.textContent="Saving…";
  try{
    for(const [prov,id] of Object.entries(map)){
      const v=byId(id)?.value?.trim();
      if(v){ await post("/market-data/keys",{provider:prov,key:v}); saved++; byId(id).value=""; }
    }
    if(!saved){ if(out) out.textContent="Enter at least one API key."; return; }
    if(out){ out.className="importResult ok"; out.textContent=`✓ Saved ${saved} key${saved>1?"s":""}. Refreshing live data…`; }
    showToast(`✓ Saved ${saved} data key${saved>1?"s":""}`,"success");
    await loadDataProviders();
    await loadAll();
  }catch(e){ if(out) out.textContent=e.message; showToast(e.message||"Could not save keys","alert"); }
}
/* ---- API-key connect flow ---- */
const BROKER_FIELD_LABELS={api_key:"API key",api_secret:"API secret",access_token:"Access token",enabled:"Gateway enabled (true / false)",base_url:"Gateway base URL"};
function openBrokerConnect(info){
  state.bcCtx=info;
  byId("bcTitle").textContent=`Connect ${info.broker}`;
  byId("bcHelp").textContent=`${info.method}. Your credentials are stored only in this app's local data and used read-only — never your broker password.`;
  byId("bcFields").innerHTML=(info.fields||[]).map(f=>{
    const saved=""; const isSecret=/key|secret|token/.test(f);
    return `<label class="bcField"><span>${escapeHtml(BROKER_FIELD_LABELS[f]||f)}</span><input class="input" id="bc_${escAttr(f)}" type="${isSecret?"password":"text"}" autocomplete="off" placeholder="${escAttr(BROKER_FIELD_LABELS[f]||f)}"/></label>`;
  }).join("")||'<p class="cfoMuted">This broker has no API fields — use CSV import instead.</p>';
  byId("brokerConnectModal").classList.add("open");
}
function closeBrokerConnect(){ byId("brokerConnectModal")?.classList.remove("open"); state.bcCtx=null; }
async function confirmBrokerConnect(){
  const ctx=state.bcCtx; if(!ctx) return;
  const creds={};
  (ctx.fields||[]).forEach(f=>{ const v=byId("bc_"+f)?.value?.trim(); if(v) creds[f]=v; });
  if(!Object.keys(creds).length) return showToast("Enter your credentials first.","alert");
  try{
    const r=await post("/brokers/connect",{broker:ctx.key,creds});
    closeBrokerConnect();
    showToast(r.connected?`✓ ${ctx.broker} connected — ${r.positions} positions found`:`${ctx.broker} saved. ${r.message||""}`, r.connected?"success":"info");
    await loadBrokers();
  }catch(e){ showToast(e.message||"Could not connect","alert"); }
}
async function disconnectBroker(key,broker){
  if(!await uiConfirm({title:`Disconnect ${broker}?`,message:"This removes the saved API credentials from the app. Your imported holdings stay.",confirmText:"Disconnect",icon:"🔌"})) return;
  try{ await post("/brokers/disconnect/"+encodeURIComponent(key),{}); showToast(`${broker} disconnected`,"success"); await loadBrokers(); }
  catch(e){ showToast(e.message,"alert"); }
}
/* ---- universal CSV import ---- */
function handleImportFile(ev){
  const f=ev.target.files&&ev.target.files[0]; if(!f) return;
  const reader=new FileReader();
  reader.onload=()=>{ byId("importCsv").value=String(reader.result||""); showToast(`Loaded ${f.name} — review and press Import`,"success"); };
  reader.onerror=()=>showToast("Could not read that file.","alert");
  reader.readAsText(f);
}
function looksLikeSipCsv(csv){
  const first=(String(csv||"").split(/\r?\n/)[0]||"").toLowerCase();
  const has=w=>first.includes(w);
  const hasScheme=has("scheme")||has("fund");
  const hasAmount=has("amount")||has("investment")||has("installment");
  const hasSipHint=has("frequency")||has("freq")||has("kind")||has("lumpsum")||has("sip")||has("folio");
  const hasHoldingCols=has("symbol")||has("ticker")||has("quantity")||has("qty")||has("shares")||has("units");
  return hasScheme && hasAmount && hasSipHint && !hasHoldingCols;
}
async function importHoldingsCsv(){
  const csv=(byId("importCsv")?.value||"").trim();
  const pid=byId("importProfile")?.value||selectedProfile();
  const broker=byId("importBroker")?.value?.trim()||"CSV import";
  const asset_type=byId("importType")?.value||"";
  const out=byId("importResult");
  if(!csv){ if(out) out.textContent="Paste or upload a CSV first."; return showToast("Paste or upload a CSV first.","alert"); }
  // A mutual-fund SIP/lumpsum file (scheme + amount + frequency/kind, no quantity) belongs in
  // the SIPs tracker — auto-route it there so a Brokers/MF-Central export "just works".
  if(looksLikeSipCsv(csv)){
    if(out) out.textContent="Detected a mutual-fund SIP/lumpsum file — importing into SIPs…";
    try{
      const r=await post("/sips/import-csv",{profile_id:pid,csv});
      if(r.status!=="ok"){ if(out) out.textContent=r.message||"Import failed."; return showToast(r.message||"Import failed.","alert"); }
      const msg=`✓ Looked like a mutual-fund SIP/lumpsum file — imported ${r.imported} into the SIPs tab${r.skipped?` (skipped ${r.skipped})`:""}.`;
      if(out){ out.className="importResult ok"; out.textContent=msg; }
      showToast(msg,"success");
      byId("importCsv").value="";
      if(typeof loadSips==="function") await loadSips();
      await loadAll();
    }catch(e){ if(out) out.textContent=e.message; showToast(e.message||"Import failed.","alert"); }
    return;
  }
  if(out) out.textContent="Importing…";
  try{
    const r=await post("/brokers/import-csv",{profile_id:pid,broker,csv,asset_type});
    if(r.status!=="ok"){ if(out) out.textContent=r.message||"Import failed."; return showToast(r.message||"Import failed.","alert"); }
    const msg=`✓ Imported ${r.imported}, updated ${r.updated}${r.skipped?`, skipped ${r.skipped}`:""}.`;
    if(out){ out.className="importResult ok"; out.textContent=msg; }
    showToast(msg,"success");
    byId("importCsv").value="";
    await loadAll();
  }catch(e){ if(out) out.textContent=e.message; showToast(e.message||"Import failed.","alert"); }
}
function brokerFieldTemplate(name){
  const n=String(name||"").toLowerCase();
  if(n.includes("groww")) return {market:"India market", show:["bdPan","bdGender","bdDob"], hint:"Groww: registered mobile, email, PAN, gender and DOB are most useful for recovery/identity."};
  if(n.includes("mf")) return {market:"India mutual funds", show:["bdPan","bdFolio","bdGender","bdDob"], hint:"MF Central: mobile, email, PAN, DOB and folio/CAS hint help recover mutual fund access."};
  if(n.includes("scalable")) return {market:"Germany broker", show:["bdIban","bdTaxId","bdGender","bdDob"], hint:"Scalable Capital: registered email/mobile, IBAN, German tax ID, gender and DOB fit this account."};
  if(n.includes("trading")) return {market:"EU/UK broker", show:["bdAccountId","bdTaxId","bdGender","bdDob"], hint:"Trading 212: email/mobile, account ID, tax ID, DOB and recovery notes are useful."};
  if(n.includes("ibkr")) return {market:"Global broker", show:["bdAccountId","bdTaxId","bdGender","bdDob"], hint:"IBKR: record account/client ID, email/mobile, tax ID and trusted recovery contact."};
  if(n.includes("wazir")) return {market:"India crypto", show:["bdPan","bdKyc","bdGender","bdDob"], hint:"WazirX: mobile, email, PAN, KYC status and DOB are useful. Keep seed/passwords elsewhere."};
  if(n.includes("coinbase")) return {market:"Global crypto", show:["bdAccountId","bdKyc","bdGender","bdDob"], hint:"Coinbase: email/mobile, account ID, KYC status and recovery notes are useful. Do not store wallet secrets here."};
  return {market:"Broker account", show:["bdAccountId","bdTaxId","bdGender","bdDob"], hint:"Record registered identity and recovery details, not passwords."};
}
function renderBrokerDetailFields(){
  const t=brokerFieldTemplate(byId("bdBroker")?.value||"");
  const optional=["bdPan","bdIban","bdAccountId","bdTaxId","bdFolio","bdKyc","bdGender","bdDob"];
  optional.forEach(id=>{
    const el=byId(id);
    if(!el) return;
    const visible=t.show.includes(id);
    el.classList.toggle("assetFieldHidden",!visible);
    el.disabled=!visible;
  });
  if(byId("bdMarket") && !bdMarket.value) bdMarket.value=t.market;
  if(byId("brokerDetailHint")) brokerDetailHint.textContent=t.hint;
}
async function loadBrokerDetails(){
  try{state.brokerDetails=await get("/brokers/details"+q());}
  catch(e){state.brokerDetails=[]}
  renderBrokerDetails();
  renderBrokerDetailFields();
}
function brokerDetailPayload(){
  return {
    profile_id:selectedProfile(),
    broker:bdBroker.value,
    market:bdMarket.value.trim()||brokerFieldTemplate(bdBroker.value).market,
    beneficiary:bdBeneficiary.value.trim(),
    beneficiary_relation:bdRelation.value.trim(),
    knows_credentials:bdKnows.value==="true",
    registered_mobile:bdMobile.value.trim(),
    registered_email:bdEmail.value.trim(),
    pan:bdPan.disabled?"":bdPan.value.trim(),
    iban:bdIban.disabled?"":bdIban.value.trim(),
    account_id:bdAccountId.disabled?"":bdAccountId.value.trim(),
    tax_id:bdTaxId.disabled?"":bdTaxId.value.trim(),
    folio_hint:bdFolio.disabled?"":bdFolio.value.trim(),
    kyc_status:bdKyc.disabled?"":bdKyc.value.trim(),
    gender:bdGender.disabled?"":bdGender.value,
    dob:bdDob.disabled?"":bdDob.value,
    notes:bdNotes.value.trim()
  };
}
async function saveBrokerDetail(){
  try{await post("/brokers/details",brokerDetailPayload());}
  catch(e){return alert(e.message)}
  clearBrokerDetailForm(false);
  await loadBrokerDetails();
}
function clearBrokerDetailForm(resetBroker=true){
  ["bdMarket","bdBeneficiary","bdRelation","bdMobile","bdEmail","bdPan","bdIban","bdAccountId","bdTaxId","bdFolio","bdKyc","bdGender","bdDob","bdNotes"].forEach(id=>{const el=byId(id); if(el) el.value="";});
  bdKnows.value="true";
  if(resetBroker) bdBroker.value="Groww";
  renderBrokerDetailFields();
}
function editBrokerDetail(id){
  const row=(state.brokerDetails||[]).find(x=>Number(x.id)===Number(id));
  if(!row) return;
  bdBroker.value=row.broker||"Groww";
  bdMarket.value=row.market||"";
  bdBeneficiary.value=row.beneficiary||"";
  bdRelation.value=row.beneficiary_relation||"";
  bdKnows.value=String(!!row.knows_credentials);
  bdMobile.value=row.registered_mobile||"";
  bdEmail.value=row.registered_email||"";
  bdPan.value=row.pan||"";
  bdIban.value=row.iban||"";
  bdAccountId.value=row.account_id||"";
  bdTaxId.value=row.tax_id||"";
  bdFolio.value=row.folio_hint||"";
  bdKyc.value=row.kyc_status||"";
  bdGender.value=row.gender||"";
  bdDob.value=row.dob||"";
  bdNotes.value=row.notes||"";
  renderBrokerDetailFields();
  byId("bdBeneficiary")?.focus();
}
async function deleteBrokerDetail(id){
  if(!await uiConfirm({title:"Delete broker details?",message:"This removes the saved broker/account information.",confirmText:"Delete details",icon:"🏛️"})) return;
  try{await del(`/brokers/details/${Number(id)}`);}
  catch(e){return alert(e.message)}
  await loadBrokerDetails();
}
function brokerDetailItems(row){
  const items=[
    ["Beneficiary", row.beneficiary ? `${row.beneficiary}${row.beneficiary_relation?` (${row.beneficiary_relation})`:""}` : "-"],
    ["Credential awareness", row.knows_credentials ? "Knows recovery / credentials location" : "Not marked"],
    ["Mobile", row.registered_mobile||"-"],
    ["Email", row.registered_email||"-"],
    ["PAN", row.pan],
    ["IBAN", row.iban],
    ["Account ID", row.account_id],
    ["Tax ID", row.tax_id],
    ["Folio/CAS", row.folio_hint],
    ["KYC", row.kyc_status],
    ["Gender/DOB", [row.gender,row.dob].filter(Boolean).join(" / ")]
  ].filter(x=>x[1]);
  return items.map(([k,v])=>`<span><small>${escapeHtml(k)}</small><b>${escapeHtml(v)}</b></span>`).join("");
}
function renderBrokerDetails(){
  const box=byId("brokerDetailGrid");
  if(!box) return;
  const rows=state.brokerDetails||[];
  if(!rows.length){
    box.innerHTML=`<div class="emptyState">Add broker details for beneficiary and account recovery planning.</div>`;
    return;
  }
  box.innerHTML=rows.map(r=>`<article class="brokerDetailCard">
    <div class="brokerDetailTop"><div><b>${escapeHtml(r.broker)}</b><small>${escapeHtml(r.market||"Broker account")}</small></div><span class="brokerBadge ${r.knows_credentials?"connected":"setup"}">${r.knows_credentials?"Beneficiary ready":"Review"}</span></div>
    <div class="brokerDetailItems">${brokerDetailItems(r)}</div>
    ${r.notes?`<p>${escapeHtml(r.notes)}</p>`:""}
    <div class="actionStack"><button class="btn secondary" onclick="editBrokerDetail(${Number(r.id)})">Edit</button><button class="btn secondary" onclick="deleteBrokerDetail(${Number(r.id)})">Delete</button></div>
  </article>`).join("");
}
async function syncBroker(name){
  const pid=byId("importProfile")?.value||selectedProfile();
  showToast(`Syncing ${name}…`,"info");
  try{
    const r=await post(`/brokers/sync/${encodeURIComponent(name)}?profile_id=${encodeURIComponent(pid)}`,{});
    if(r.status==="ok"){
      showToast(`✓ ${name}: imported ${r.imported}, updated ${r.updated} (${r.positions} positions)`,"success");
      await loadAll();
    }else{
      showToast(r.message||`${name}: ${r.status}`,"alert");
    }
  }catch(e){ showToast(e.message||"Sync failed","alert"); }
}
/* ===== SIP & Lumpsum tracker ===== */
async function loadSips(){
  const opts=(state.profiles||[]).map(p=>`<option value="${escAttr(p.id)}">${escapeHtml(p.name)}</option>`).join("");
  ["sipProfile","sipImportProfile"].forEach(id=>{const sel=byId(id); if(sel){ sel.innerHTML=opts; sel.value=selectedProfile(); }});
  try{ state.sips=await get("/sips"+q()); }catch(e){ state.sips=[]; }
  renderSips();
  renderFds();
  if(typeof renderMissionAssetSummary==="function") renderMissionAssetSummary();
}
function fdRows(){ return (state.propertyRows||[]).filter(p=>p.category==="FD"); }
function renderFds(){
  const list=byId("fdList"); if(!list) return;
  const sel=byId("fdProfile");
  if(sel){ sel.innerHTML=(state.profiles||[]).map(p=>`<option value="${escAttr(p.id)}">${escapeHtml(p.name)}</option>`).join(""); if(!sel.value) sel.value=selectedProfile(); }
  const rows=fdRows();
  if(byId("fdCount")) fdCount.textContent=`${rows.length} FD${rows.length===1?"":"s"}`;
  const curEur=rows.reduce((s,r)=>s+(r.value_eur||0),0);
  const prinEur=rows.reduce((s,r)=>s+((r.value_eur||0)*(r.principal||0)/(r.value||1)),0);
  const sb=byId("fdSummary");
  if(sb) sb.innerHTML = rows.length? `<div class="statGrid">
      ${statTile("Total deposited",euro(prinEur))}
      ${statTile("Current value",euro(curEur),"green")}
      ${statTile("Interest earned",euro(curEur-prinEur),"green")}
      ${statTile("Fixed deposits",rows.length)}
    </div>` : '<div class="cfoMuted">No FDs yet. Add one below (it also appears in Properties &amp; net worth).</div>';
  list.innerHTML = rows.map(fdCard).join("");
}
function fdCard(r){
  const rate=r.interest_rate||r.model_growth||0;
  const gainPct=r.principal?((r.value-r.principal)/r.principal*100):0;
  return `<div class="sipCard"><div class="sipTop"><div class="sipName"><b>${escapeHtml(r.bank||r.name)}</b><small>FD · ${escapeHtml(r.currency)} ${Number(r.principal||0).toLocaleString()} @ ${rate}% p.a.${r.maturity_date?" · matures "+r.maturity_date:""}${r.matured?" · ✅ matured":""}</small></div><span class="techVerdict bullish">+${gainPct.toFixed(1)}%</span></div>
    <div class="statGrid two">
      ${statTile("Principal",money(r.principal,r.currency))}
      ${statTile("Current value",money(r.value,r.currency),"green")}
      ${statTile("Interest earned",money(r.interest_earned,r.currency),"green")}
      ${statTile("At maturity",money(r.maturity_value,r.currency))}
      ${statTile("Rate",rate+"% p.a.")}
      ${statTile("In EUR",euro(r.value_eur))}
    </div>
    <div class="sipActions"><button class="btn secondary smallBtn" onclick="deleteFd(${Number(r.id)})">Delete</button></div></div>`;
}
async function createFd(){
  const bank=byId("fdBank")?.value.trim();
  const amt=Number(byId("fdAmount")?.value||0);
  if(!bank) return showToast("Enter the bank name.","alert");
  if(!(amt>0)) return showToast("Enter the deposit amount.","alert");
  if(isFutureDate(byId("fdStart")?.value)) return showToast("FD start date can't be in the future.","alert");
  if(byId("fdStart")?.value&&byId("fdMaturity")?.value&&new Date(byId("fdMaturity").value)<new Date(byId("fdStart").value)) return showToast("FD maturity must be after the start date.","alert");
  try{
    await post("/properties",{profile_id:byId("fdProfile")?.value||selectedProfile(),category:"FD",name:`FD - ${bank}`,location:bank,bank,
      value:amt,purchase_value:amt,interest_rate:Number(byId("fdRate")?.value||0),
      purchase_date:byId("fdStart")?.value||"",maturity_date:byId("fdMaturity")?.value||"",
      currency:byId("fdCurrency")?.value||"INR",currency_manual:true});
    showToast("✓ Fixed Deposit added","success");
    ["fdBank","fdAmount","fdRate","fdStart","fdMaturity"].forEach(id=>{if(byId(id))byId(id).value="";});
    await loadAll(); renderFds();
  }catch(e){ showToast(e.message||"Could not add FD","alert"); }
}
async function deleteFd(id){
  if(!await uiConfirm({title:"Delete this FD?",message:"Removes the fixed deposit from your assets & net worth.",confirmText:"Delete",icon:"🏦"})) return;
  try{ await del("/properties/"+id); showToast("Deleted","success"); await loadAll(); renderFds(); }
  catch(e){ showToast(e.message,"alert"); }
}
function handleSipImportFile(ev){
  const f=ev.target.files&&ev.target.files[0]; if(!f) return;
  const reader=new FileReader();
  reader.onload=()=>{ byId("sipImportCsv").value=String(reader.result||""); showToast(`Loaded ${f.name} — press Import SIPs`,"success"); };
  reader.onerror=()=>showToast("Could not read that file.","alert");
  reader.readAsText(f);
}
async function importSipsCsv(){
  const csv=(byId("sipImportCsv")?.value||"").trim();
  const pid=byId("sipImportProfile")?.value||selectedProfile();
  const out=byId("sipImportResult");
  if(!csv){ if(out) out.textContent="Paste or upload a CSV first."; return showToast("Paste or upload a CSV first.","alert"); }
  if(out) out.textContent="Importing…";
  try{
    const r=await post("/sips/import-csv",{profile_id:pid,csv});
    if(r.status!=="ok"){ if(out) out.textContent=r.message||"Import failed."; return showToast(r.message||"Import failed.","alert"); }
    const msg=`✓ Imported ${r.imported} SIP${r.imported===1?"":"s"}${r.skipped?`, skipped ${r.skipped}`:""}.`;
    if(out){ out.className="importResult ok"; out.textContent=msg; }
    showToast(msg,"success");
    byId("sipImportCsv").value="";
    await loadSips();
  }catch(e){ if(out) out.textContent=e.message; showToast(e.message||"Import failed.","alert"); }
}
function renderSips(){
  const list=byId("sipList"); if(!list) return;
  const rows=state.sips||[];
  if(byId("sipCount")) sipCount.textContent=`${rows.length} plan${rows.length===1?"":"s"}`;
  const inv=rows.reduce((s,r)=>s+(r.invested||0),0);
  const cur=rows.reduce((s,r)=>s+(r.current_value||0),0);
  const gain=cur-inv;
  const sb=byId("sipSummary");
  if(sb){
    sb.innerHTML = rows.length? `<div class="statGrid">
      ${statTile("Total invested","₹ "+Math.round(inv).toLocaleString())}
      ${statTile("Current value","₹ "+Math.round(cur).toLocaleString(),cls(gain))}
      ${statTile("Gain / loss","₹ "+Math.round(gain).toLocaleString()+" ("+(inv?(gain/inv*100).toFixed(1):0)+"%)",cls(gain))}
      ${statTile("Active SIPs",rows.filter(r=>r.kind!=="Lumpsum"&&r.status==="active").length)}
    </div>` : '<div class="cfoMuted">No SIPs yet. Add your first SIP or lumpsum on the left — try “Parag Parikh Flexi Cap”, 10000, Monthly, start 2022-01-01.</div>';
  }
  list.innerHTML = rows.length? rows.map(sipCard).join("") : '<div class="deskEmpty">Nothing tracked yet.</div>';
}
function sipCard(r){
  const isSip=r.kind!=="Lumpsum"; const proj=r.projection||{};
  return `<div class="sipCard">
    <div class="sipTop"><div class="sipName"><b>${escapeHtml(r.scheme_name||r.scheme)}</b><small>${escapeHtml(r.kind)} ${isSip?"· "+escapeHtml(r.frequency)+" · ₹"+Number(r.amount).toLocaleString():"· ₹"+Number(r.amount).toLocaleString()}${isSip&&r.next_date?" · next "+r.next_date:""}</small></div>
      ${r.resolved?`<span class="techVerdict ${(r.gain||0)>=0?"bullish":"bearish"}">${(r.gain_pct||0)>=0?"+":""}${r.gain_pct||0}%</span>`:""}</div>
    ${r.resolved?`<div class="statGrid two">
      ${statTile("Invested","₹ "+Number(r.invested).toLocaleString())}
      ${statTile("Current value","₹ "+Number(r.current_value).toLocaleString(),cls(r.gain))}
      ${statTile("Units",Number(r.units).toLocaleString())}
      ${statTile("Latest NAV","₹ "+r.latest_nav)}
      ${statTile("XIRR p.a.",r.xirr==null?"—":r.xirr+"%",r.xirr>=0?"green":"red")}
      ${statTile(isSip?"Installments":"Bought",isSip?r.installments:(r.start_date||"—"))}
    </div>
    <p class="assetNote">If continued at ~12%/yr → <b>₹${Math.round(proj.y5||0).toLocaleString()}</b> in 5y · <b>₹${Math.round(proj.y10||0).toLocaleString()}</b> in 10y. Source: ${escapeHtml(r.nav_source)}.</p>`
    :`<div class="sipWarn">⚠️ ${escapeHtml(r.nav_source)}. Pick the exact AMFI name from the suggestions.</div>`}
    <div class="sipActions"><button class="btn secondary smallBtn" onclick="deleteSip(${Number(r.id)})">Delete</button></div>
  </div>`;
}
async function createSip(){
  const scheme=byId("sipScheme")?.value?.trim();
  const amount=Number(byId("sipAmount")?.value||0);
  if(!scheme) return showToast("Enter the fund/scheme name.","alert");
  if(!(amount>0)) return showToast("Enter an amount greater than 0.","alert");
  if(isFutureDate(byId("sipStart")?.value)) return showToast("SIP / investment start date can't be in the future.","alert");
  const body={profile_id:byId("sipProfile")?.value||selectedProfile(),scheme,kind:byId("sipKind")?.value||"SIP",amount,frequency:byId("sipFreq")?.value||"Monthly",start_date:byId("sipStart")?.value||""};
  try{
    await post("/sips",body);
    showToast("✓ Added to SIP tracker","success");
    byId("sipScheme").value=""; byId("sipAmount").value="";
    await loadSips();
  }catch(e){ showToast(e.message||"Could not add SIP","alert"); }
}
async function deleteSip(id){
  if(!await uiConfirm({title:"Delete this plan?",message:"Removes this SIP/lumpsum from the tracker. Your actual investment is unaffected.",confirmText:"Delete",icon:"🗑️"})) return;
  try{ await del("/sips/"+id); showToast("Deleted","success"); await loadSips(); }
  catch(e){ showToast(e.message,"alert"); }
}
async function sipSchemeSuggest(){
  const v=byId("sipScheme")?.value?.trim(); const box=byId("sipSchemeSuggest");
  if(!box) return;
  if(!v||v.length<3){ box.style.display="none"; box.innerHTML=""; return; }
  let rows=[]; try{ rows=await get("/mf-search?q="+encodeURIComponent(v)); }catch(e){ rows=[]; }
  box.innerHTML=(rows||[]).slice(0,8).map(r=>`<button type="button" onclick="pickSipScheme('${escAttr(jsString(r.schemeName))}')"><b>${escapeHtml(r.schemeName)}</b></button>`).join("");
  box.style.display=(rows&&rows.length)?"block":"none";
}
function pickSipScheme(name){ const i=byId("sipScheme"); if(i) i.value=name; const b=byId("sipSchemeSuggest"); if(b) b.style.display="none"; }
async function loadFavorites(){
  const box=byId("favoriteBar");
  let rows=[];
  try{rows=await get("/watchlist");}catch(e){rows=[]}
  state.favoriteRows=rows;
  if(box) box.innerHTML=`<span class="favoriteTitle">Favorites</span>`+(rows.length?rows.slice(0,12).map(a=>`<button title="${escAttr(a.name)} • ${signed(a.day)}" onclick="openAsset('${escapeHtml(a.symbol)}')"><b>${escapeHtml(a.symbol)}</b><span class="${cls(a.day)}">${signed(a.day)}</span><i onclick="event.stopPropagation();deleteFavorite('${escapeHtml(a.symbol)}')" title="Remove favorite">×</i></button>`).join(""):`<span class="subtitle">Add favorites from markets, search, or asset detail.</span>`);
  renderFavoritesTable();
}
function favoriteScore(a){
  const price=Number(a.price||0), low=Number(a.year_low||price), year=Number(a.year||0), month=Number(a.month||0);
  const nearLow=price&&low ? Math.max(0,100-((price-low)/price*100)) : 50;
  return Math.round(nearLow*.45 + Math.max(Math.min(year,100),-100)*.25 + Math.max(Math.min(month,60),-60)*.3);
}
function favoriteMessage(a){
  const price=Number(a.price||0), low=Number(a.year_low||0), high=Number(a.year_high||0);
  const lowGap=price&&low ? ((price-low)/price*100) : 0;
  if(low && lowGap<8) return `Near yearly low: watch reversal and news before entry.`;
  if(Number(a.year||0)>25) return `Strong 1Y momentum; compare valuation risk before buying.`;
  if(Number(a.month||0)<-8) return `Weak month; could be cheaper but needs catalyst.`;
  if(high && price>high*.92) return `Near yearly high; momentum strong, margin of safety lower.`;
  return `Balanced watch: review news, analyst view, and trend.`;
}
function favoriteProjection(a,amount){
  const price=Number(a.price||0);
  const year=Number(a.year||0);
  const shares=price ? amount/price : 0;
  const expected=amount*(1+year/100);
  return {shares, expected, gain: expected-amount, roi: year};
}
function renderFavoritesTable(){
  if(!byId("favoritesTable")) return;
  const text=(byId("favoriteFilter")?.value||"").toLowerCase();
  const type=byId("favoriteTypeFilter")?.value||"";
  const market=byId("favoriteMarketFilter")?.value||"";
  const sort=byId("favoriteSort")?.value||"ai";
  const amount=parseMoney(byId("favoriteInvest")?.value||1000)||1000;
  const minPrice=parseMoney(byId("favoriteMinPrice")?.value||"");
  const maxPrice=parseMoney(byId("favoriteMaxPrice")?.value||"");
  const minPerf=Number(byId("favoriteMinPerf")?.value||"");
  let rows=state.favoriteRows.filter(a=>
    (!text || `${a.name} ${a.symbol} ${a.type} ${a.country} ${a.market} ${a.movement_reason}`.toLowerCase().includes(text)) &&
    (!type || a.type===type) &&
    (!market || a.market===market) &&
    (!minPrice || Number(a.price||0)>=minPrice) &&
    (!maxPrice || Number(a.price||0)<=maxPrice) &&
    (!minPerf || Number(a[sort]||a.day||0)>=minPerf)
  );
  rows=rows.slice().sort((a,b)=>{
    if(sort==="roi") return favoriteProjection(b,amount).roi-favoriteProjection(a,amount).roi;
    if(sort==="low") return (Number(a.price||0)-Number(a.year_low||0))/(Number(a.price||1)) - (Number(b.price||0)-Number(b.year_low||0))/(Number(b.price||1));
    if(sort==="price") return Number(a.price||0)-Number(b.price||0);
    if(sort==="day") return Number(b.day||0)-Number(a.day||0);
    if(sort==="week") return Number(b.week||0)-Number(a.week||0);
    if(sort==="month") return Number(b.month||0)-Number(a.month||0);
    if(sort==="year") return Number(b.year||0)-Number(a.year||0);
    return favoriteScore(b)-favoriteScore(a);
  });
  if(byId("favoritesChart")){
    const metric=["day","week","month","year"].includes(sort)?sort:"year";
    const top=rows.slice(0,12);
    chart("favoritesChart","bar",top.map(x=>x.symbol),top.map(x=>Number(x[metric]||0)),`Favorites ${metric}`,{percent:true,onClick:i=>openAsset(top[i].symbol)});
  }
  table("favoritesTable",["Asset","AI note","Year low","Invest compare","Trend","Research",""],rows.map(a=>{
    const p=favoriteProjection(a,amount);
    return [
      `<button class="assetLink" onclick="openAsset('${escapeHtml(a.symbol)}')" title="${escAttr(a.movement_reason||"Open full detail")}"><b>${escapeHtml(a.name)}</b><span>${escapeHtml(a.symbol)} • ${escapeHtml(a.type||"Asset")} • ${escapeHtml(a.country||"")}</span></button>`,
      `<button class="messagePill" onclick="openAsset('${escapeHtml(a.symbol)}')" title="Open full news, analyst comments and research links">${escapeHtml(favoriteMessage(a))}</button><div class="assetName">AI score ${favoriteScore(a)}/100</div>`,
      `${escapeHtml(a.currency||"")} ${Number(a.year_low||0).toLocaleString()}<div class="assetName">High ${Number(a.year_high||0).toLocaleString()}</div>`,
      `${Number(p.shares||0).toLocaleString(undefined,{maximumFractionDigits:4})} units<div class="assetName">1Y model: ${money(p.expected,a.currency)} • ${p.gain>=0?"+":""}${money(p.gain,a.currency)}</div>`,
      `<span class="${cls(a.day)}">24H ${signed(a.day)}</span><div class="assetName">1M ${signed(a.month)} • 1Y ${signed(a.year)}</div>`,
      `<button class="btn secondary" onclick="openAsset('${escapeHtml(a.symbol)}')">News & analysts</button>`,
      `<button class="btn secondary" onclick="useFavoriteForHolding('${escapeHtml(a.symbol)}')">Use/Edit</button> <button class="btn secondary" onclick="deleteFavorite('${escapeHtml(a.symbol)}')">Remove</button>`
    ];
  }));
}
function useFavoriteForHolding(symbol){
  const a=state.favoriteRows.find(x=>x.symbol===symbol)||{};
  show("Portfolio",[...document.querySelectorAll(".nav button")].find(b=>b.textContent.includes("Portfolio")));
  hSymbol.value=a.symbol||symbol;
  hName.value=a.name||symbol;
  hAssetSearch.value=a.name ? `${a.name} (${a.symbol})` : symbol;
  if(a.type) hType.value=a.type;
  if(a.country){ensureSelectOption(hCountry,a.country,a.country); hCountry.value=a.country;}
  if(a.market) hMarket.value=a.market;
  if(a.currency) hCurrency.value=a.currency;
  if(a.price) hPrice.value=a.price;
  smartHoldingDefaults();
  setTimeout(()=>hQty.focus(),50);
}
async function addFavorite(symbol){
  try{await post("/watchlist",{symbol});}
  catch(e){return alert(e.message)}
  showToast(`⭐ ${String(symbol).toUpperCase()} added to favorites & watch`,"success");
  await loadFavorites();
}
/* ===== Add-a-favorite search box (Favorites page) ===== */
function favAddSuggest(){ clearTimeout(state._favAddTimer); state._favAddTimer=setTimeout(_favAddSuggest,250); }
async function _favAddSuggest(){
  const inp=byId("favAddSearch"), box=byId("favAddSuggestions"); if(!box) return;
  const v=(inp?.value||"").trim();
  if(v.length<2){ box.style.display="none"; box.innerHTML=""; return; }
  const rows=await searchAssets(v,{limit:14});
  state.favAddRows=rows;
  box.innerHTML = rows.length
    ? rows.map(a=>assetSuggestionButton(a,`addFavoriteFromSearch('${escAttr(jsString(a.symbol))}')`)).join("")
    : `<button type="button" disabled><b>No match yet</b><span>Try the full company / fund name, ticker, or coin.</span></button>`;
  box.style.display="block";
}
function favAddKey(ev){
  if(ev.key!=="Enter") return; ev.preventDefault();
  const rows=state.favAddRows||[]; if(rows[0]) addFavoriteFromSearch(rows[0].symbol);
}
async function addFavoriteFromSearch(symbol){
  const box=byId("favAddSuggestions"); if(box){ box.style.display="none"; }
  const inp=byId("favAddSearch"); if(inp) inp.value="";
  await addFavorite(symbol);
}
async function favFromAsset(symbol){
  await addFavorite(symbol);
  const b=byId("assetFavBtn"); if(b){ b.textContent="★ In favorites"; b.classList.add("on"); b.disabled=true; b.onclick=null; }
}
/* Compact ⭐ toggle for any table row (Live Markets, exchange browser, screeners…) */
function isFavorite(symbol){ return (state.favoriteRows||[]).some(f=>String(f.symbol||"").toUpperCase()===String(symbol||"").toUpperCase()); }
function favStar(symbol){
  const fav=isFavorite(symbol);
  const s=escAttr(jsString(symbol||""));
  return `<button class="favStarMini${fav?" on":""}" title="${fav?"In favorites":"Add to favorites"}" onclick="quickFav(event,'${s}')">${fav?"★":"☆"}</button>`;
}
async function quickFav(ev,symbol){
  ev.stopPropagation(); ev.preventDefault();
  const el=ev.currentTarget;
  if(el&&el.classList.contains("on")) return;       // already a favorite
  if(el){ el.textContent="★"; el.classList.add("on"); el.title="In favorites"; }
  try{ await addFavorite(symbol); }
  catch(e){ if(el){ el.textContent="☆"; el.classList.remove("on"); } }
}
async function deleteFavorite(symbol){
  try{await del(`/watchlist/${encodeURIComponent(symbol)}`);}
  catch(e){return alert(e.message)}
  await loadFavorites();
}
let newsTimer=null;
async function loadNews(){
  let n=await get("/news-intelligence"+q());
  table("newsTable",["Asset","Impact","Sentiment","Summary"],n.map(x=>[x.symbol,x.impact_score+"/10",x.sentiment,x.summary]));
  state.newsRows=[];
  renderNewsCenter();
}
async function loadFundsBonds(){
  if(!byId("fundBondTable")) return;
  try{state.fundBondRows=await get("/funds-bonds");}
  catch(e){state.fundBondRows=[]}
  renderFundsBonds();
}
let fundBondSeq=0;
let fundBondTimer=null;
function scheduleFundBondSearch(){
  clearTimeout(fundBondTimer);
  fundBondTimer=setTimeout(()=>renderFundsBonds(),350);
}
function fundBondKey(event){
  if(event.key==="Enter"){
    event.preventDefault();
    clearTimeout(fundBondTimer);
    renderFundsBonds();
  }
}
async function renderFundsBonds(){
  if(!byId("fundBondTable")) return;
  const rawText=(byId("fundBondFilter")?.value||"").trim();
  const text=rawText.toLowerCase();
  const type=byId("fundBondType")?.value||"";
  const sort=byId("fundBondSort")?.value||"one_year";
  const seq=++fundBondSeq;
  let sourceRows=state.fundBondRows||[];
  if(byId("fundBondStatus")){
    fundBondStatus.textContent=text.length>=2?`Searching full India mutual fund master list for "${rawText}"...`:"Showing browse list. Type SBI, ICICI, HDFC, Axis, Kotak, Nippon or any scheme name.";
  }
  if(text.length>=2 || type){
    try{
      const params=`${text.length>=2?`q=${encodeURIComponent(text)}`:""}${type?`${text.length>=2?"&":""}type=${encodeURIComponent(type)}`:""}`;
      sourceRows=await get(`/funds-bonds${params?`?${params}`:""}`);
      if(seq!==fundBondSeq) return;
      state.fundBondSearchRows=sourceRows;
    }catch(e){}
  }
  let rows=(sourceRows||[]).filter(r=>
    (!text || `${r.symbol} ${r.name} ${r.category} ${r.type} ${(r.platforms||[]).join(" ")}`.toLowerCase().includes(text)) &&
    (!type || r.type===type)
  ).sort((a,b)=>Number(b[sort]||0)-Number(a[sort]||0));
  if(byId("fundBondStatus")){
    const source=text.length>=2?"MFAPI India master + local bonds":"browse list";
    fundBondStatus.innerHTML=`<b>${rows.length.toLocaleString()} results</b> ${text?`for "${escapeHtml(rawText)}"`:"shown"} from ${escapeHtml(source)}. Press Enter after typing to force a fresh full search.`;
  }
  const top=rows.slice(0,12);
  chart("fundBondChart","bar",top.map(x=>x.symbol),top.map(x=>Number(x[sort]||0)),`Funds/Bonds ${sort}`,{percent:["one_year","three_year","expense","yield","coupon"].includes(sort)});
  table("fundBondTable",["Name","Type","Category","Risk","1Y","3Y/Yield","Cost/Coupon","Platforms",""],rows.map(r=>[
    `<b>${escapeHtml(r.name)}</b><div class="assetName">${escapeHtml(r.symbol)} • ${r.scheme_code?`Scheme ${escapeHtml(r.scheme_code)} • `:""}${r.isin_growth?`ISIN ${escapeHtml(r.isin_growth)} • `:""}${escapeHtml(r.currency)}</div>`,
    escapeHtml(r.type), escapeHtml(r.category), escapeHtml(r.risk),
    r.one_year!==undefined?signed(r.one_year):"-",
    r.type==="Bond"?pct(r.yield||0):signed(r.three_year||0),
    r.type==="Bond"?pct(r.coupon||0):pct(r.expense||0),
    escapeHtml((r.platforms||[]).join(", ")),
    `<button class="btn secondary" onclick="prefillFundBond('${escapeHtml(r.symbol)}')">Add</button>`
  ]));
}
function prefillFundBond(symbol){
  const r=[...(state.previewFundBondRows||[]),...(state.globalSearchRows||[]),...(state.assetDetailSearchRows||[]),...(state.fundBondSearchRows||[]),...(state.fundBondRows||[])].find(x=>x.symbol===symbol)||{};
  show("Portfolio",[...document.querySelectorAll(".nav button")].find(b=>b.textContent.includes("Portfolio")));
  hAssetSearch.value=r.name||symbol;
  hSymbol.value=r.symbol||symbol;
  hName.value=r.name||symbol;
  hType.value=r.type||"Mutual Fund";
  hMarket.value=r.type==="Bond"?"GLOBAL":"NSE";
  ensureSelectOption(hCountry,"India","India");
  hCountry.value="India";
  hCurrency.value="INR";
  hBroker.value=(r.platforms||[])[0]||"Groww";
}
function screenerSignal(a){
  const hasReal=a.rsi!=null && a.macd_hist!=null;
  const rsiNum=hasReal?Number(a.rsi):Math.max(10,Math.min(90,50+Number(a.month||0)*1.4));
  const macdHist=hasReal?Number(a.macd_hist):(Number(a.month||0)-Number(a.week||0));
  const macdPos=a.macd_pos!=null?Number(a.macd_pos):Math.max(0,Math.min(100,50+macdHist*8));
  const bullish=macdHist>0 && rsiNum<70;
  const bearish=macdHist<0 && rsiNum>30;
  return {macd:macdHist.toFixed(2), macdHist, macdPos, rsi:rsiNum.toFixed(0), rsiNum, bullish, bearish, real:hasReal};
}
function techVerdict(a){
  const s=screenerSignal(a);
  let score=0;
  if(s.macdHist>0) score++; else if(s.macdHist<0) score--;
  const price=Number(a.price||0);
  if(a.sma50&&price){ score+= price>a.sma50?1:-1; }
  if(a.sma50&&a.sma200){ score+= a.sma50>a.sma200?1:-1; }
  if(s.rsiNum<30) score++; else if(s.rsiNum>70) score--;
  const v=score>=2?"bullish":score<=-2?"bearish":"neutral";
  return {v,score,signal:s};
}
function sentimentScore(a){
  const s=screenerSignal(a);
  let sc=50;
  sc += Math.max(-16,Math.min(16, s.macdHist*6));
  sc += Math.max(-12,Math.min(12, (s.rsiNum-50)*0.4));
  const price=Number(a.price||0);
  if(a.sma50&&price) sc += price>a.sma50?7:-7;
  if(a.sma50&&a.sma200) sc += a.sma50>a.sma200?8:-8;
  sc += Math.max(-10,Math.min(10, Number(a.month||0)*0.6));
  sc += Math.max(-6,Math.min(6, Number(a.week||0)*0.6));
  return Math.round(Math.max(3,Math.min(97,sc)));
}
const SENTIMENT_ZONES=[
  {lo:0,hi:20,label:"Extremely Bearish",color:"#b91c1c"},
  {lo:20,hi:40,label:"Bearish",color:"#ea3943"},
  {lo:40,hi:60,label:"Neutral",color:"#f5a623"},
  {lo:60,hi:80,label:"Bullish",color:"#16c784"},
  {lo:80,hi:101,label:"Extremely Bullish",color:"#0f9d63"}
];
function sentimentZone(score){return SENTIMENT_ZONES.find(z=>score>=z.lo && score<z.hi)||SENTIMENT_ZONES[SENTIMENT_ZONES.length-1];}
function sentimentGauge(score){
  score=Math.max(0,Math.min(100,Math.round(score)));
  const cx=100,cy=96,rMid=72,band=20,tickR=50,inactive="rgba(148,163,184,.20)";
  const zone=sentimentZone(score);
  const thetaOf=s=>180*(1-s/100);
  const pt=(r,deg)=>{const t=deg*Math.PI/180;return [+(cx+r*Math.cos(t)).toFixed(2),+(cy-r*Math.sin(t)).toFixed(2)];};
  const segs=SENTIMENT_ZONES.map(z=>{
    const a0=thetaOf(z.lo)-1.5, a1=thetaOf(Math.min(z.hi,100))+1.5;
    const [x1,y1]=pt(rMid,a0),[x2,y2]=pt(rMid,a1);
    const col=(z===zone)?z.color:inactive;
    return `<path d="M ${x1} ${y1} A ${rMid} ${rMid} 0 0 1 ${x2} ${y2}" stroke="${col}" stroke-width="${band}" fill="none"/>`;
  }).join("");
  const ticks=[0,25,50,75,100].map(s=>{const [tx,ty]=pt(tickR,thetaOf(s));return `<text x="${tx}" y="${ty+3.5}" class="sgTick">${s}</text>`;}).join("");
  const t=thetaOf(score)*Math.PI/180, L=rMid-3;
  const tip=[+(cx+L*Math.cos(t)).toFixed(2),+(cy-L*Math.sin(t)).toFixed(2)];
  const pA=t+Math.PI/2, bw=6;
  const b1=[+(cx+bw*Math.cos(pA)).toFixed(2),+(cy-bw*Math.sin(pA)).toFixed(2)];
  const b2=[+(cx-bw*Math.cos(pA)).toFixed(2),+(cy+bw*Math.sin(pA)).toFixed(2)];
  return `<div class="sentGauge"><svg viewBox="0 0 200 146" class="sentGaugeSvg" role="img" aria-label="Sentiment ${score} of 100, ${zone.label}">
    ${segs}${ticks}
    <polygon points="${b1[0]},${b1[1]} ${tip[0]},${tip[1]} ${b2[0]},${b2[1]}" fill="${zone.color}"/>
    <circle cx="${cx}" cy="${cy}" r="7" fill="${zone.color}"/>
    <rect x="${cx-26}" y="${cy+8}" width="52" height="30" rx="9" fill="${zone.color}"/>
    <text x="${cx}" y="${cy+29}" class="sgScore">${score}</text>
  </svg>
  <div class="sentGaugeLabel" style="color:${zone.color}">${zone.label}</div></div>`;
}
function techSparkSvg(spark){
  if(!Array.isArray(spark)||spark.length<2) return `<div class="techNoSpark">No chart history</div>`;
  const w=240,h=54,min=Math.min(...spark),max=Math.max(...spark),rng=(max-min)||1;
  const xy=spark.map((v,i)=>`${(i/(spark.length-1)*w).toFixed(1)},${(h-((v-min)/rng)*(h-6)-3).toFixed(1)}`);
  const up=spark[spark.length-1]>=spark[0];
  return `<svg class="techSparkSvg ${up?"up":"down"}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polygon class="techSparkArea" points="0,${h} ${xy.join(" ")} ${w},${h}"/><polyline class="techSparkLine" points="${xy.join(" ")}"/></svg>`;
}
function renderTechCards(rows,mode){
  const wrap=byId("screenerCards");
  if(byId("screenerTable")) screenerTable.innerHTML="";
  if(!wrap) return;
  if(!rows.length){wrap.innerHTML=`<div class="techEmpty"><b>No assets match this screen right now</b><span>Try another market, sector, or the smart-money mode.</span></div>`;return;}
  const notes=screenerNotes();
  wrap.innerHTML=rows.map(a=>{
    const {v,signal}=techVerdict(a);
    const rsi=signal.rsiNum, macdPos=signal.macdPos;
    const rsiState=rsi<30?"Oversold":rsi>70?"Overbought":"Neutral";
    const rsiCls=rsi<30?"pos":rsi>70?"neg":"mon";
    const macdState=signal.macdHist>0?"Bullish crossover":signal.macdHist<0?"Bearish crossover":"Flat";
    const trend=(a.sma50&&a.sma200)?(a.sma50>a.sma200?"Golden cross (50&gt;200 SMA)":"Death cross (50&lt;200 SMA)"):"Trend forming";
    const vLabel=v==="bullish"?"BULLISH":v==="bearish"?"BEARISH":"NEUTRAL";
    return `<div class="techCard ${v}">
      <div class="techTop">
        <button class="techName" onclick="openAsset('${escAttr(jsString(a.symbol))}')"><b>${escapeHtml(a.name||a.symbol)}</b><span>${escapeHtml(a.symbol)} • ${escapeHtml(a.type||"Asset")} • ${escapeHtml(a.market||"-")}</span></button>
        <div class="techPrice"><b>${escapeHtml(money(a.price,a.currency||"USD"))}</b><span class="${cls(a.day)}">${signed(a.day)} today</span></div>
      </div>
      ${sentimentGauge(sentimentScore(a))}
      <div class="techVerdictRow"><span class="techVerdict ${v}">${vLabel}</span><span class="techScore">1M ${signed(a.month)} • 1Y ${signed(a.year)}</span></div>
      <div class="techSpark">${techSparkSvg(a.spark)}</div>
      <div class="techGauge">
        <div class="gaugeHead"><span>MACD (12,26,9)</span><b class="${signal.macdHist>=0?"green":"red"}">${escapeHtml(macdState)}</b></div>
        <div class="macdMeter"><div class="macdTrack"><span class="macdNeedle" style="left:${macdPos}%"></span></div><div class="meterLabels"><span>Bearish</span><span>Signal line</span><span>Bullish</span></div></div>
      </div>
      <div class="techGauge">
        <div class="gaugeHead"><span>RSI (14)</span><b class="${rsiCls==="pos"?"green":rsiCls==="neg"?"red":""}">${Math.round(rsi)} · ${rsiState}</b></div>
        <div class="rsiBar"><span class="rsiMarker" style="left:${Math.max(0,Math.min(100,rsi))}%"></span></div>
        <div class="meterLabels rsiTicks"><span>0</span><span>30</span><span>70</span><span>100</span></div>
      </div>
      <div class="techTrend">${trend}</div>
      <div class="techActions"><button class="btn secondary" onclick="openAsset('${escAttr(jsString(a.symbol))}')">Open chart</button><button class="btn secondary" onclick="addFavorite('${escAttr(jsString(a.symbol))}')">Watch</button></div>
      <div class="techSources"><span class="techSourcesLabel">Ratings &amp; valuation:</span>${ratingsSourceLinks(a)}</div>
    </div>`;
  }).join("");
}
function screenerNotes(){
  try{return JSON.parse(localStorage.getItem("wealth_os_screener_notes")||"{}")}catch(e){return {}}
}
function saveScreenerNote(symbol,value){
  const notes=screenerNotes();
  notes[symbol]=value;
  localStorage.setItem("wealth_os_screener_notes",JSON.stringify(notes));
}
function smartMoneyScore(a){
  const y=Number(a.year||0), m=Number(a.month||0), d=Number(a.day||0), value=Number(a.value_eur||0);
  const megaCapBoost=["NVDA","MSFT","AAPL","AMZN","GOOGL","GOOG","META","AVGO","TSM","LLY","JPM","V","SAP","ASML","RHM.DE"].includes(String(a.symbol||"").toUpperCase())?14:0;
  const momentum=Math.max(Math.min(y,100),-60)*.30 + Math.max(Math.min(m,35),-35)*.42 + Math.max(Math.min(d,10),-10)*.16;
  const ownership=value>0?8:0;
  const quality=/tech|ai|semiconductor|defence|health|finance|metals|mining/i.test(`${a.sector} ${a.name}`)?8:3;
  return Math.round(Math.max(0,Math.min(100,50+momentum+megaCapBoost+ownership+quality)));
}
function insiderProxyScore(a){
  const score=smartMoneyScore(a);
  const sectorBoost=/technology|ai|defence|finance|healthcare/i.test(String(a.sector||""))?8:0;
  return Math.round(Math.max(0,Math.min(100,score*.72+sectorBoost)));
}
function smartAction(a){
  const score=smartMoneyScore(a);
  if(score>=72 && Number(a.month||0)>=0) return "buy";
  if(score<=38 || (Number(a.month||0)<-8 && Number(a.day||0)<0)) return "sell";
  return "watch";
}
function smartActionLabel(action){
  return action==="buy"?"Buying / accumulation":action==="sell"?"Selling / distribution":"Watch trend";
}
function smartMoneyReason(a){
  const action=smartAction(a);
  const signal=screenerSignal(a);
  if(action==="buy") return `Strong proxy accumulation: smart score ${smartMoneyScore(a)}/100, 1M ${signed(a.month)}, 1Y ${signed(a.year)}, MACD ${signal.macd}. Verify with filings/news before acting.`;
  if(action==="sell") return `Distribution/risk signal: smart score ${smartMoneyScore(a)}/100, 1M ${signed(a.month)}, today ${signed(a.day)}, RSI ${signal.rsi}. Check if this is temporary volatility or insider/sector weakness.`;
  return `Watchlist: mixed signal with score ${smartMoneyScore(a)}/100, MACD ${signal.macd}, RSI ${signal.rsi}. Needs confirmation from filings, news and volume.`;
}
function leadershipSignal(a){
  const action=smartAction(a);
  const role=/finance/i.test(a.sector||"")?"CEO/CFO/director":/technology|ai|semiconductor/i.test(`${a.sector} ${a.name}`)?"founder/CEO/director":/defence|healthcare/i.test(a.sector||"")?"director/officer":"executive/director";
  if(action==="buy") return `${role} accumulation watch: check Form 4 / exchange filings for recent buys.`;
  if(action==="sell") return `${role} selling watch: verify whether sales are planned, tax-related, or trend-changing.`;
  return `${role} watch: no confirmed transaction in-app; use source links to verify.`;
}
function screenerUniverse(){
  const base=[...(state.marketData?.valuable||[]),...(state.marketData?.gainers||[]),...(state.marketData?.losers||[]),...(state.lastHoldings||[]),...(state.favoriteRows||[]),...(state.fundBondRows||[])];
  const extra=[
    {symbol:"RHM.DE",name:"Rheinmetall",type:"Stock",sector:"Defence",market:"XETRA",country:"Germany",price:1209,day:1.6,week:3.2,month:-9.8,year:-31.8,currency:"EUR"},
    {symbol:"PLTR",name:"Palantir",type:"Stock",sector:"AI / Defence",market:"NYSE",country:"US",price:145,day:2.4,week:5.1,month:18.5,year:86,currency:"USD"},
    {symbol:"ASML",name:"ASML Holding",type:"Stock",sector:"Semiconductors",market:"NASDAQ",country:"Netherlands",price:908,day:.8,week:1.1,month:7.5,year:22,currency:"USD"},
    {symbol:"TSLA",name:"Tesla",type:"Stock",sector:"Automotive / AI",market:"NASDAQ",country:"US",price:318,day:-1.2,week:2.1,month:9.6,year:18,currency:"USD"}
  ];
  const seen=new Set();
  return base.concat(extra).filter(a=>{
    if(!a?.symbol || seen.has(String(a.symbol).toUpperCase())) return false;
    seen.add(String(a.symbol).toUpperCase());
    return true;
  });
}
function clearScreenerFilters(){
  ["screenerFilter","screenerMinScore"].forEach(id=>{if(byId(id)) byId(id).value=""});
  ["screenerSectorFilter","screenerMarketFilter","screenerActionFilter"].forEach(id=>{if(byId(id)) byId(id).value=""});
  renderScreeners();
}
let insiderKind="insiders";
let screenerRunSeq=0;
let screenerTimer=null;
function scheduleScreeners(){
  clearTimeout(screenerTimer);
  screenerTimer=setTimeout(()=>renderScreeners(),350);
}
function setInsiderKind(kind){
  insiderKind=kind;
  ["Insiders","Managers","Funds"].forEach(name=>{
    const el=byId(`insiderTab${name}`);
    if(el) el.classList.toggle("active", kind===name.toLowerCase());
  });
  if(byId("screenerMode")) screenerMode.value="insider";
  renderScreeners();
}
function ratingSites(a){
  const q=encodeURIComponent(a.name||a.symbol||"");
  const tq=encodeURIComponent(String(a.symbol||"").split(".")[0]);
  return {
    morningstar:`https://www.morningstar.com/search?query=${q}`,
    simplywallst:`https://simplywall.st/search?query=${q}`,
    gurufocus:`https://www.gurufocus.com/search?search=${tq}`
  };
}
function ratingsSourceLinks(a){
  const u=ratingSites(a);
  return `<a class="btn secondary srcBtn morningstar" href="${u.morningstar}" target="_blank" rel="noopener" title="Open ratings & fair value on Morningstar">Morningstar</a>`+
    `<a class="btn secondary srcBtn sws" href="${u.simplywallst}" target="_blank" rel="noopener" title="Open valuation & snowflake on Simply Wall St">Simply Wall St</a>`+
    `<a class="btn secondary srcBtn guru" href="${u.gurufocus}" target="_blank" rel="noopener" title="Open GuruFocus value & warning signs">GuruFocus</a>`;
}
function warningSigns(a){
  const out=[];
  const s=screenerSignal(a);
  const price=Number(a.price||0), high=Number(a.year_high||0);
  if(s.rsiNum>70) out.push({t:`Overbought — RSI ${Math.round(s.rsiNum)} (above 70)`,sev:"high"});
  else if(s.rsiNum<30) out.push({t:`Oversold — RSI ${Math.round(s.rsiNum)} (below 30)`,sev:"med"});
  if(s.macdHist<0) out.push({t:"MACD below its signal line (bearish momentum)",sev:"med"});
  if(a.sma200&&price&&price<a.sma200) out.push({t:"Trading below the 200-day average (long-term downtrend)",sev:"high"});
  if(a.sma50&&a.sma200&&a.sma50<a.sma200) out.push({t:"Death cross: 50-day average below 200-day",sev:"high"});
  if(high&&price&&price<high*0.75) out.push({t:"More than 25% below its 52-week high",sev:"med"});
  if(Number(a.year||0)<-10) out.push({t:`Weak 1-year trend (${signed(a.year)})`,sev:"med"});
  if(Math.abs(Number(a.day||0))>=5) out.push({t:`High volatility — moved ${signed(a.day)} today`,sev:"med"});
  if(Number(a.pl_pct||0)<-20 && Number(a.qty||0)>0) out.push({t:`Your position is down ${signed(a.pl_pct)}`,sev:"high"});
  if(a.type==="Crypto") out.push({t:"Crypto: high volatility and no earnings/fundamentals backing",sev:"med"});
  if(!out.length) out.push({t:"No major technical warning flags from available price data",sev:"ok"});
  return out;
}
function valuationContext(a){
  const price=Number(a.price||0), high=Number(a.year_high||0), low=Number(a.year_low||0);
  const parts=[];
  if(high>low) parts.push(`Trading at ${Math.round((price-low)/(high-low)*100)}% of its 52-week range (${money(low,a.currency)} → ${money(high,a.currency)}).`);
  if(a.sma50&&price) parts.push(price>=a.sma50?`Above the 50-day average (${money(a.sma50,a.currency)}).`:`Below the 50-day average (${money(a.sma50,a.currency)}).`);
  if(Number(a.dividend_yield||0)) parts.push(`Dividend yield ${pct(a.dividend_yield)}.`);
  parts.push("For fair value, DCF, P/E and quality ratings, open the sources below.");
  return parts.join(" ");
}
function assetHeroStats(a,ctx){
  const price=Number(a.price||0), low=Number(a.year_low||0), high=Number(a.year_high||0);
  const rangePos=high>low?Math.round((price-low)/(high-low)*100):null;
  const rsi=a.rsi!=null?Math.round(a.rsi):null;
  const rsiState=rsi==null?"":rsi<30?"Oversold":rsi>70?"Overbought":"Neutral";
  const stat=(label,val,clsName,sub)=>`<div class="assetStat"><span>${label}</span><b class="${clsName||""}">${val}</b>${sub?`<small>${sub}</small>`:""}</div>`;
  let h="";
  h+=stat("Today",signed(a.day),cls(a.day));
  h+=stat("Week",signed(a.week),cls(a.week));
  h+=stat("Month",signed(a.month),cls(a.month));
  h+=stat("Year",signed(a.year),cls(a.year));
  if(rangePos!=null) h+=stat("52-week range",rangePos+"%",rangePos>=50?"green":"red",`${money(low,a.currency)} → ${money(high,a.currency)}`);
  if(rsi!=null) h+=stat("RSI (14)",rsi,rsi<30?"green":rsi>70?"red":"",rsiState);
  if(Number(a.qty||0)>0){
    h+=stat("My value",displayMoney(a.value_eur||0),"",`${Number(a.qty||0).toLocaleString()} units`);
    h+=stat("My return",signed(a.pl_pct),cls(a.pl_pct),`${euro(a.pl_eur||0)}`);
    h+=stat("Daily impact",euro(ctx.daily_impact_eur),cls(ctx.daily_impact_eur),"Your position");
  }
  return `<div class="assetStats">${h}</div>`;
}
function technicalPanelHtml(a){
  if(a.rsi==null && a.macd_hist==null) return "";
  const {v,signal}=techVerdict(a);
  const rsi=signal.rsiNum, macdPos=signal.macdPos;
  const rsiState=rsi<30?"Oversold":rsi>70?"Overbought":"Neutral";
  const rsiCls=rsi<30?"green":rsi>70?"red":"";
  const macdState=signal.macdHist>0?"Bullish — MACD above signal":signal.macdHist<0?"Bearish — MACD below signal":"Flat / crossing";
  const trend=(a.sma50&&a.sma200)?(a.sma50>a.sma200?"Golden cross — 50-day above 200-day average":"Death cross — 50-day below 200-day average"):"Long-term trend still forming";
  const vLabel=v==="bullish"?"BULLISH":v==="bearish"?"BEARISH":"NEUTRAL";
  return `<div class="card c12 techPanel"><div class="cardHead"><h3>Technical Read-out</h3><span class="techVerdict ${v}">${vLabel}</span></div>
    <div class="techSentimentWrap">${sentimentGauge(sentimentScore(a))}<p class="techSentimentNote">Composite sentiment from <b>trend</b> (50/200-day), <b>momentum</b>, <b>RSI</b> and <b>MACD</b> on live price history. Educational, not advice.</p></div>
    <div class="techPanelGrid">
      <div class="techGauge">
        <div class="gaugeHead"><span>MACD (12,26,9)</span><b class="${signal.macdHist>=0?"green":"red"}">${escapeHtml(macdState)}</b></div>
        <div class="macdMeter"><div class="macdTrack"><span class="macdNeedle" style="left:${macdPos}%"></span></div><div class="meterLabels"><span>Bearish</span><span>Signal line</span><span>Bullish</span></div></div>
        <div class="techNums"><span>MACD ${a.macd!=null?a.macd:"–"}</span><span>Signal ${a.macd_signal!=null?a.macd_signal:"–"}</span><span>Hist ${a.macd_hist!=null?a.macd_hist:"–"}</span></div>
      </div>
      <div class="techGauge">
        <div class="gaugeHead"><span>RSI (14)</span><b class="${rsiCls}">${Math.round(rsi)} · ${rsiState}</b></div>
        <div class="rsiBar"><span class="rsiMarker" style="left:${Math.max(0,Math.min(100,rsi))}%"></span></div>
        <div class="meterLabels rsiTicks"><span>0</span><span>30</span><span>70</span><span>100</span></div>
        <div class="techNums"><span>50-day ${a.sma50?money(a.sma50,a.currency):"–"}</span><span>200-day ${a.sma200?money(a.sma200,a.currency):"–"}</span><span>RSI ${a.rsi!=null?a.rsi:"–"}</span></div>
      </div>
    </div>
    <div class="techTrend">${escapeHtml(trend)} · Indicators are computed from real daily price history. Educational, not advice.</div>
  </div>`;
}
function ratingsCardHtml(a){
  return `<div class="card c12 ratingsCard"><div class="cardHead"><h3>Ratings, Valuation &amp; Warning Signs</h3><span class="pill">Verify on sources</span></div>
    <div class="ratingsGrid">
      <div class="ratingsCol">
        <h4>⚠ Warning signs</h4>
        <ul class="warnList">${warningSigns(a).map(w=>`<li class="warn ${w.sev}">${escapeHtml(w.t)}</li>`).join("")}</ul>
      </div>
      <div class="ratingsCol">
        <h4>Valuation context</h4>
        <p class="ratingsText">${escapeHtml(valuationContext(a))}</p>
        <div class="ratingsMeta"><span>RSI ${a.rsi!=null?Math.round(a.rsi):"–"}</span><span>50d ${a.sma50?money(a.sma50,a.currency):"–"}</span><span>200d ${a.sma200?money(a.sma200,a.currency):"–"}</span></div>
      </div>
      <div class="ratingsCol">
        <h4>Ratings &amp; research</h4>
        <p class="ratingsText">Open analyst, quant and fair-value ratings on:</p>
        <div class="ratingsSrc">${ratingsSourceLinks(a)}</div>
      </div>
    </div>
    <div class="ratingsDisclaimer">Warning signs are an educational read from live price data. Star ratings, fair value, DCF and quality/financial-health scores are published by <b>Morningstar</b>, <b>Simply Wall St</b> and <b>GuruFocus</b> — open the links to verify before any decision.</div>
  </div>`;
}
function screenerResearchLinks(a,mode){
  const s=encodeURIComponent(a.symbol||a.name||"");
  const raw=String(a.symbol||"").split(".")[0];
  return `<div class="actionGroup"><button class="btn secondary" onclick="openAsset('${escapeHtml(a.symbol)}')">Asset</button><a class="btn secondary" href="https://finviz.com/quote.ashx?t=${s}" target="_blank" rel="noopener">FINVIZ</a><a class="btn secondary" href="https://www.openinsider.com/screener?s=${encodeURIComponent(raw)}" target="_blank" rel="noopener">Insider</a><a class="btn secondary" href="https://www.sec.gov/edgar/search/#/q=${encodeURIComponent(raw)}" target="_blank" rel="noopener">SEC</a></div>`;
}
async function renderInsiderTrading(mode,seq){
  const kind=insiderKind||"insiders";
  const qText=(byId("screenerFilter")?.value||"").trim();
  const tx=byId("screenerActionFilter")?.value||"";
  const minValue=Number(byId("screenerMinScore")?.value||0);
  if(byId("screenerSummary")) screenerSummary.innerHTML=`<b>Loading ${kind}</b><span>Pulling public insider/owner transaction rows. Search works for owner/person, ticker, company, relationship and industry.</span>`;
  try{
    let rows=await get(`/insider-trading?kind=${encodeURIComponent(kind)}&transaction=${encodeURIComponent(tx||"all")}&query=${encodeURIComponent(qText)}&limit=180`);
    if(seq!==screenerRunSeq) return;
    rows=(rows||[]).filter(r=>Number(r.numeric_value||0)>=minValue);
    const buys=rows.filter(r=>/buy/i.test(r.transaction)).length;
    const sales=rows.filter(r=>/sale|sell/i.test(r.transaction)).length;
    const options=rows.filter(r=>/option|exercise|proposed/i.test(r.transaction)).length;
    const top=rows.slice(0,80);
    chart("screenerChart","bar",top.slice(0,20).map(r=>r.ticker),top.slice(0,20).map(r=>Number(r.numeric_value||0)),"Insider transaction value");
    if(byId("screenerSummary")) screenerSummary.innerHTML=`<b>${kind==="insiders"?"Latest insider trading":kind==="funds"?"Top owner / fund flows":"Manager transactions"}</b><span>${rows.length} rows. ${buys} buys, ${sales} sales, ${options} option/proposed rows. Green means buy/accumulation, red means sale/distribution. Data uses public FINVIZ/SEC-style sources and fallback rows when unavailable.</span>`;
    renderInsiderTable(top);
  }catch(e){
    if(byId("screenerSummary")) screenerSummary.innerHTML=`<b>Insider feed unavailable</b><span>${escapeHtml(e.message||"Could not load public insider data.")}</span>`;
    table("screenerTable",["Ticker","Owner","Relationship","Date","Transaction","Cost","#Shares","Value ($)","#Shares Total","SEC Form 4"],[]);
  }
}
function renderInsiderTable(rows){
  const el=byId("screenerTable");
  if(!el) return;
  const headers=["Ticker","Owner","Relationship","Date","Transaction","Cost","#Shares","Value ($)","#Shares Total","SEC Form 4"];
  el.classList.add("insiderTradeTable");
  el.innerHTML=`<thead><tr>${headers.map(h=>`<th>${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>${rows.map(r=>{
    const tx=String(r.transaction||"");
    const cls=/buy/i.test(tx)?"buyRow":/sale|sell/i.test(tx)?"saleRow":/option|exercise/i.test(tx)?"optionRow":"";
    return `<tr class="${cls}">
      <td><button class="tickerLink" onclick="openAsset('${escAttr(r.ticker)}')">${escapeHtml(r.ticker)}</button></td>
      <td><a href="https://finviz.com/insidertrading?oc=&t=${encodeURIComponent(r.ticker||"")}" target="_blank" rel="noopener">${escapeHtml(r.owner)}</a></td>
      <td>${escapeHtml(r.relationship)}</td>
      <td>${escapeHtml(r.date)}</td>
      <td><span class="txPill">${escapeHtml(r.transaction)}</span></td>
      <td class="numCell">${escapeHtml(r.cost)}</td>
      <td class="numCell">${escapeHtml(r.shares)}</td>
      <td class="numCell">${escapeHtml(r.value)}</td>
      <td class="numCell">${escapeHtml(r.shares_total)}</td>
      <td><a href="${escAttr(r.form_url||"https://www.sec.gov/")}" target="_blank" rel="noopener">${escapeHtml(r.form_time||"Open")}</a></td>
    </tr>`;
  }).join("")}</tbody>`;
}
async function renderScreeners(){
  if(!byId("screenerTable")) return;
  const seq=++screenerRunSeq;
  const mode=byId("screenerMode")?.value||"smart";
  if(byId("screenerTable")) screenerTable.classList.remove("insiderTradeTable");
  const cardModes=new Set(["bullish","bearish","smart","charts"]);
  if(!cardModes.has(mode) && byId("screenerCards")) screenerCards.innerHTML="";
  if(mode==="insider") return renderInsiderTrading(mode,seq);
  const text=(byId("screenerFilter")?.value||"").toLowerCase();
  const sector=byId("screenerSectorFilter")?.value||"";
  const marketFilter=byId("screenerMarketFilter")?.value||"";
  const actionFilter=byId("screenerActionFilter")?.value||"";
  const minScore=Number(byId("screenerMinScore")?.value||0);
  const metric=byId("screenerChartMetric")?.value||"smart_score";
  const notes=screenerNotes();
  let rows=screenerUniverse().map(a=>({...a,smart_score:smartMoneyScore(a),insider_score:insiderProxyScore(a),action:smartAction(a),rsi:Number(screenerSignal(a).rsi)}));
  rows=rows.filter(a=>!text || `${a.name} ${a.symbol} ${a.sector} ${a.market} ${a.type} ${smartActionLabel(a.action)}`.toLowerCase().includes(text));
  rows=rows.filter(a=>!sector || `${a.sector} ${a.name}`.toLowerCase().includes(sector.toLowerCase()));
  rows=rows.filter(a=>!marketFilter || String(a.market||"").toUpperCase().includes(marketFilter.toUpperCase()));
  rows=rows.filter(a=>!actionFilter || a.action===actionFilter);
  rows=rows.filter(a=>smartMoneyScore(a)>=minScore);
  if(mode==="sector"){
    const sectors=["Technology","AI","Defence","Finance","Healthcare","Metals and Mining","Education","Professional Services","Distributors","Energy","Consumer","Automotive","ETF","Crypto"];
    const sectorRows=sectors.map(sec=>{
      const members=rows.filter(a=>(a.sector||"").toLowerCase().includes(sec.toLowerCase().split(" ")[0]) || (sec==="AI" && /ai|nvidia|microsoft|alphabet|meta/i.test(`${a.name} ${a.symbol}`)));
      const count=members.length;
      const avg=count?members.reduce((s,a)=>s+smartMoneyScore(a),0)/count:0;
      return {sector:sec,count,avg,top:members.sort((a,b)=>smartMoneyScore(b)-smartMoneyScore(a))[0]};
    }).filter(x=>x.count || !text);
    if(byId("screenerSummary")) screenerSummary.innerHTML=`<b>Sector/industry map</b><span>Average smart-money score by sector. Use this to spot where institutional-style momentum is clustering.</span>`;
    chart("screenerChart","bar",sectorRows.map(x=>x.sector),sectorRows.map(x=>x.avg),"Sector smart score");
    table("screenerTable",["Sector / industry","Assets","Avg score","Top asset","Research"],sectorRows.map(s=>[
      escapeHtml(s.sector), s.count, `${Number(s.avg||0).toFixed(0)}/100`, s.top?`${escapeHtml(s.top.symbol)} • ${escapeHtml(s.top.name)}`:"Add assets to track", s.top?screenerResearchLinks(s.top,mode):"-"
    ]));
    return;
  }
  if(mode==="bullish") rows=rows.filter(a=>screenerSignal(a).bullish).sort((a,b)=>Number(b.month||0)-Number(a.month||0));
  if(mode==="bearish") rows=rows.filter(a=>screenerSignal(a).bearish).sort((a,b)=>Number(a.month||0)-Number(b.month||0));
  if(mode==="smart") rows=rows.sort((a,b)=>smartMoneyScore(b)-smartMoneyScore(a));
  if(mode==="charts") rows=rows.sort((a,b)=>Number(b[metric]||0)-Number(a[metric]||0));
  if(mode==="insider") rows=rows.filter(a=>/Technology|Finance|Healthcare|AI|Defence|Semiconductor/i.test(a.sector)||Number(a.year||0)>20).sort((a,b)=>insiderProxyScore(b)-insiderProxyScore(a));
  if(mode==="forex") rows=[{symbol:"EURUSD",name:"Euro / US Dollar",type:"Forex",sector:"FX",market:"FOREX",day:.2,week:.8,month:1.2,year:3.1,price:1.08,smart_score:67,insider_score:0,action:"watch",rsi:52},{symbol:"EURINR",name:"Euro / Indian Rupee",type:"Forex",sector:"FX",market:"FOREX",day:.1,week:.6,month:1.7,year:4.5,price:90,smart_score:71,insider_score:0,action:"buy",rsi:54},{symbol:"USDJPY",name:"US Dollar / Japanese Yen",type:"Forex",sector:"FX",market:"FOREX",day:-.3,week:.4,month:2.5,year:8.2,price:151,smart_score:63,insider_score:0,action:"watch",rsi:56},{symbol:"AEDINR",name:"UAE Dirham / Indian Rupee",type:"Forex",sector:"FX",market:"FOREX",day:.1,week:.3,month:1.1,year:3.8,price:22.7,smart_score:60,insider_score:0,action:"watch",rsi:51}];
  if(mode==="futures") rows=[{symbol:"GOLD",name:"Gold Futures",type:"Future",sector:"Metals and Mining",market:"COMEX",day:1.1,week:2.4,month:6.2,year:28.1,price:2400,smart_score:78,insider_score:0,action:"buy",rsi:59},{symbol:"SILVER",name:"Silver Futures",type:"Future",sector:"Metals and Mining",market:"COMEX",day:.7,week:1.9,month:5.4,year:22.5,price:31,smart_score:72,insider_score:0,action:"buy",rsi:57},{symbol:"OIL",name:"Crude Oil Futures",type:"Future",sector:"Energy",market:"NYMEX",day:-.8,week:-2.1,month:3.1,year:9.4,price:78,smart_score:51,insider_score:0,action:"watch",rsi:54},{symbol:"NIFTYFUT",name:"Nifty Futures",type:"Future",sector:"Index",market:"NSE",day:.5,week:1.4,month:4.2,year:14.2,price:24500,smart_score:70,insider_score:0,action:"buy",rsi:56}];
  const top=rows.slice(0,20);
  if(byId("screenerSummary")){
    const buying=top.filter(a=>a.action==="buy").length, selling=top.filter(a=>a.action==="sell").length;
    screenerSummary.innerHTML=`<b>${mode==="insider"?"CEO / insider watch":"Top 10% buying trend"}</b><span>${buying} accumulation signals, ${selling} distribution signals. Scores are public-market proxies; verify real insider activity with FINVIZ, OpenInsider and SEC links.</span>`;
  }
  chart("screenerChart","bar",top.slice(0,12).map(x=>x.symbol),top.slice(0,12).map(x=>Number(x[metric]??x.smart_score??0)),`Screener ${metric}`,{percent:["year","month","day"].includes(metric),onClick:i=>openAsset(top[i].symbol)});
  if(cardModes.has(mode)){
    if(byId("screenerSummary")){
      const bull=top.filter(a=>screenerSignal(a).macdHist>0).length;
      const over=top.filter(a=>screenerSignal(a).rsiNum>70).length;
      const under=top.filter(a=>screenerSignal(a).rsiNum<30).length;
      const label=mode==="bullish"?"Bullish MACD + RSI setups":mode==="bearish"?"Bearish MACD + RSI setups":mode==="smart"?"Top smart-money trend":"Technical chart screen";
      screenerSummary.innerHTML=`<b>${label}</b><span>${top.length} assets · ${bull} with MACD above signal · ${under} oversold (RSI&lt;30) · ${over} overbought (RSI&gt;70). RSI &amp; MACD are computed from real daily price history. Educational, not advice.</span>`;
    }
    return renderTechCards(top,mode);
  }
  table("screenerTable",["Asset","Smart","Action","Sector","Market","MACD","RSI","Today","1M","1Y","Leadership signal","Why / trend","Notes","Research"],top.map(a=>{
    const s=screenerSignal(a);
    return [
      `<button class="assetLink" onclick="openAsset('${escapeHtml(a.symbol)}')"><b>${escapeHtml(a.name)}</b><span>${escapeHtml(a.symbol)} • ${escapeHtml(a.type||"Asset")}</span></button>`,
      `${smartMoneyScore(a)}/100`,
      `<span class="statusPill">${smartActionLabel(a.action)}</span>`,
      escapeHtml(a.sector||"-"), escapeHtml(a.market||"-"), s.macd, s.rsi,
      `<span class="${cls(a.day)}">${signed(a.day)}</span>`,
      `<span class="${cls(a.month)}">${signed(a.month)}</span>`,
      `<span class="${cls(a.year)}">${signed(a.year)}</span>`,
      `<div class="reasonText">${escapeHtml(leadershipSignal(a))}</div>`,
      `<div class="reasonText">${escapeHtml(smartMoneyReason(a))}</div>`,
      `<input class="input screenerNote" value="${escAttr(notes[a.symbol]||"")}" placeholder="My note..." onchange="saveScreenerNote('${escAttr(a.symbol)}',this.value)"/>`,
      `<div class="actionGroup"><button class="btn secondary" onclick="addFavorite('${escapeHtml(a.symbol)}')">Watch</button>${screenerResearchLinks(a,mode)}</div>`
    ];
  }));
}
let compareTimer=null;
let compareRenderSeq=0;
let compareSearchTimer=null;
let compareItems=[];
function scheduleCompare(){
  renderCompare();
}
function scheduleCompareSearch(){
  clearTimeout(compareSearchTimer);
  compareSearchTimer=setTimeout(()=>compareSearchSuggest(),250);
}
function compareTokens(){
  return compareItems.slice();
}
function comparePool(){
  const pool=[...(state.lastHoldings||[]),...(state.favoriteRows||[]),...(state.marketData?.valuable||[]),...(state.marketData?.coins||[]),...(state.fundBondRows||[])];
  const seen=new Map();
  pool.forEach(a=>{if(a?.symbol && !seen.has(a.symbol)) seen.set(a.symbol,a)});
  return [...seen.values()];
}
function compareItemLabel(item){
  if(!item) return "";
  return item.name || item.symbol || item.token || "";
}
function compareItemKey(item){
  return String(item?.symbol||item?.token||item?.name||"").trim().toLowerCase();
}
function manualCompareAsset(q){
  const name=String(q||byId("compareAssetSearch")?.value||"Manual asset").trim();
  const code=assetCodeFromName(name);
  return {
    symbol: code,
    yahoo: code,
    name,
    type: byId("compareAssetType")?.value||"Other",
    market: byId("compareMarket")?.value||"Manual",
    currency: (byId("compareCurrency")?.value||"EUR").toUpperCase(),
    price: parseMoney(byId("comparePrice")?.value||0),
    day:0,week:0,month:0,year:0,value_eur:0,source:"Manual compare entry",
    manual:true
  };
}
async function resolveCompareAsset(item,pool){
  if(item?.manual) return item;
  const q=String(item?.token||item?.symbol||item||"").trim();
  if(!q) return null;
  const upper=q.toUpperCase();
  let local=pool.find(a=>String(a.symbol||"").toUpperCase()===upper) || pool.find(a=>`${a.name} ${a.symbol}`.toLowerCase().includes(q.toLowerCase()));
  if(local) return local;
  try{
    const hits=await searchAssets(q,{limit:20});
    const hit=(hits||[]).find(x=>x.symbol)||null;
    if(hit){
      const detail=await get(`/asset-detail?symbol=${encodeURIComponent(hit.symbol)}`);
      return detail.asset || hit;
    }
  }catch(e){}
  return manualCompareAsset(q);
}
async function compareSearchSuggest(){
  const box=byId("compareSuggestions");
  const input=byId("compareAssetSearch");
  if(!box || !input) return;
  const q=input.value.trim();
  input.dataset.symbol="";
  if(!q){box.style.display="none";box.innerHTML="";return}
  const hits=await searchAssets(q,{limit:20});
  box.innerHTML=hits.slice(0,12).map(a=>assetSuggestionButton(a,`selectCompareSuggestion('${escAttr(jsString(a.symbol))}','${escAttr(jsString(a.name||a.symbol))}','${escAttr(jsString(a.type||"Stock"))}','${escAttr(jsString(a.market||""))}','${escAttr(jsString(a.currency||""))}')`)).join("")+
    `<button type="button" onclick="addCompareAsset(true)"><b>Add manually: ${escapeHtml(q)}</b><span>Use this exact name even if search misses the listing</span></button>`;
  box.style.display="block";
}
function selectCompareSuggestion(symbol,name,type,market,currency){
  const input=byId("compareAssetSearch");
  if(input){
    input.value=name||symbol;
    input.dataset.symbol=symbol||"";
  }
  if(byId("compareAssetType")) compareAssetType.value=type||"Stock";
  if(byId("compareMarket")) compareMarket.value=market||"";
  if(byId("compareCurrency") && currency) compareCurrency.value=currency;
  if(byId("compareSuggestions")) compareSuggestions.style.display="none";
}
function renderCompareBasket(){
  const box=byId("compareBasket");
  if(!box) return;
  box.innerHTML=compareItems.length?compareItems.map(item=>`<button class="compareChip" onclick="removeCompareAsset('${escAttr(compareItemKey(item))}')" title="Remove ${escAttr(compareItemLabel(item))}"><b>${escapeHtml(compareItemLabel(item))}</b><span>${escapeHtml(item.type||item.market||"Compare")}</span><i>×</i></button>`).join(""):`<div class="emptyState">No assets added yet. Add each share, fund, ETF or coin separately above.</div>`;
}
async function addCompareAsset(forceManual=false){
  const input=byId("compareAssetSearch");
  const q=String(input?.value||"").trim();
  if(!q) return;
  const symbol=input?.dataset.symbol||"";
  const item=forceManual || !symbol ? manualCompareAsset(q) : {token:symbol,symbol,name:q,type:byId("compareAssetType")?.value||"Stock",market:byId("compareMarket")?.value||""};
  const key=compareItemKey(item);
  compareItems=compareItems.filter(x=>compareItemKey(x)!==key).concat(item);
  if(input){input.value="";input.dataset.symbol="";}
  if(byId("comparePrice")) comparePrice.value="";
  if(byId("compareSuggestions")) compareSuggestions.style.display="none";
  renderCompareBasket();
  renderCompare();
}
function compareScore(a){
  const y=Number(a.year||0), m=Number(a.month||0), d=Number(a.day||0), pl=Number(a.pl_pct||0);
  const momentum=Math.max(Math.min(y,120),-80)*.34 + Math.max(Math.min(m,40),-40)*.26 + Math.max(Math.min(d,12),-12)*.12;
  const ownership=Number(a.value_eur||0)>0 ? 8 : 0;
  const riskPenalty=Math.max(0,Math.abs(d)-4)*2 + (a.type==="Crypto"?10:0);
  return Math.round(Math.max(0,Math.min(100,55+momentum+pl*.12+ownership-riskPenalty)));
}
function compareRisk(a){
  const vol=Math.abs(Number(a.day||0))+Math.abs(Number(a.week||0))/2+Math.abs(Number(a.month||0))/4;
  if(a.type==="Crypto" || vol>12) return "High";
  if(vol>6) return "Medium";
  return "Lower";
}
function compareAiNote(a,best){
  const score=compareScore(a);
  const risk=compareRisk(a);
  const lead=a.symbol===best?.symbol ? "Best current fit" : "Watchlist candidate";
  return `${lead}: score ${score}/100, ${risk.toLowerCase()} risk, 1Y ${signed(a.year)} and 1M ${signed(a.month)}. ${favoriteMessage(a)}`;
}
function renderCompareSummary(rows,best){
  if(!byId("compareAI")) return;
  if(!rows.length){
    compareAI.textContent="No comparison selected. Add assets one by one above. If search misses the listing, add it manually with name, type, market and price.";
    return;
  }
  const risk=compareRisk(best);
  const runner=rows.filter(x=>x.symbol!==best.symbol).sort((a,b)=>compareScore(b)-compareScore(a))[0];
  compareAI.innerHTML=`<b>AI choice: ${escapeHtml(best.name||best.symbol)} (${escapeHtml(best.symbol)})</b><br>${escapeHtml(best.name||best.symbol)} leads with score ${compareScore(best)}/100, ${risk.toLowerCase()} risk, ${signed(best.year)} 1Y and ${signed(best.month)} 1M. ${runner?`Runner-up: ${escapeHtml(runner.symbol)} at ${compareScore(runner)}/100.`:""} Use this as a decision screen, not a buy order: check news, concentration, taxes and your target holding size.`;
}
async function renderCompare(){
  if(!byId("compareTable")) return;
  const seq=++compareRenderSeq;
  renderCompareBasket();
  const tokens=compareTokens();
  if(!tokens.length){
    chart("compareChart","bar",[],[],"Compare AI score");
    renderCompareSummary([],null);
    table("compareTable",["Asset","AI score","Risk","Price","Today","1M","1Y","Position","AI note","Actions"],[]);
    return;
  }
  const inputs=tokens;
  const pool=comparePool();
  const resolved=await Promise.all(inputs.map(async t=>{
    const asset=await resolveCompareAsset(t,pool);
    return asset ? {...asset,_compareToken:compareItemKey(t)} : null;
  }));
  if(seq!==compareRenderSeq) return;
  const seen=new Set();
  let rows=resolved.filter(Boolean).filter(a=>{const s=a.symbol||a.name; if(seen.has(s)) return false; seen.add(s); return true;});
  const type=byId("compareTypeFilter")?.value||"";
  const minScore=Number(byId("compareMinScore")?.value||0);
  rows=rows.filter(a=>(!type || String(a.type||"").toLowerCase()===type.toLowerCase()) && compareScore(a)>=minScore);
  rows.forEach(a=>a.compare_score=compareScore(a));
  const metric=byId("compareMetric")?.value||"compare_score";
  chart("compareChart","bar",rows.map(x=>x.symbol),rows.map(x=>Number(x[metric]||0)),`Compare ${metric}`,{percent:!metric.includes("value") && metric!=="compare_score",onClick:i=>openAsset(rows[i].symbol)});
  const best=rows.slice().sort((a,b)=>compareScore(b)-compareScore(a))[0];
  renderCompareSummary(rows,best);
  table("compareTable",["Asset","AI score","Risk","Price","Today","1M","1Y","Position","AI note","Actions"],rows.map(a=>[
    `<button class="assetLink" onclick="openAsset('${escapeHtml(a.symbol)}')"><b>${escapeHtml(a.name||a.symbol)}</b><span>${escapeHtml(a.symbol)} • ${escapeHtml(a.type||"Asset")} • ${escapeHtml(a.market||a.country||"")}</span></button>`,
    `${compareScore(a)}/100`,
    compareRisk(a),
    `${escapeHtml(a.currency||"")} ${Number(a.price||0).toLocaleString()}`,
    signed(a.day),
    signed(a.month),
    signed(a.year),
    displayMoney(a.value_eur||0),
    `<div class="reasonText">${escapeHtml(compareAiNote(a,best))}</div>`,
    `<div class="actionGroup"><button class="btn secondary" onclick="openAsset('${escapeHtml(a.symbol)}')">Details</button><button class="btn secondary" onclick="removeCompareAsset('${escAttr(a._compareToken||compareItemKey(a))}')">Remove</button></div>`
  ]));
}
function removeCompareAsset(token){
  const remove=String(token||"").trim().toLowerCase();
  compareItems=compareItems.filter(x=>compareItemKey(x)!==remove);
  renderCompareBasket();
  renderCompare();
}
function clearCompare(){
  compareRenderSeq++;
  compareItems=[];
  if(byId("compareAssetSearch")) {compareAssetSearch.value="";compareAssetSearch.dataset.symbol="";}
  if(byId("comparePrice")) comparePrice.value="";
  if(byId("compareMarket")) compareMarket.value="";
  if(byId("compareSuggestions")) compareSuggestions.style.display="none";
  if(byId("compareMinScore")) compareMinScore.value="";
  if(byId("compareTypeFilter")) compareTypeFilter.value="";
  renderCompareBasket();
  renderCompare();
}
function scheduleNewsCenter(){
  clearTimeout(newsTimer);
  newsTimer=setTimeout(()=>renderNewsCenter(),350);
}
function clearNewsSearch(){
  if(byId("newsFilter")) newsFilter.value="";
  renderNewsCenter();
}
function newsColor(str){
  const p=["#4f8cff","#34d399","#f59e0b","#ef4444","#a78bfa","#22d3ee","#f472b6"];
  let h=0;const s=String(str||"x");
  for(let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))>>>0;
  return p[h%p.length];
}
function newsFavicon(domain){return domain?`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`:"";}
function newsTimeAgo(pub){
  if(!pub) return "";
  const t=new Date(pub).getTime();
  if(isNaN(t)) return "";
  const diff=(Date.now()-t)/1000;
  if(diff<0) return "just now";
  if(diff<60) return "just now";
  if(diff<3600) return Math.floor(diff/60)+"m ago";
  if(diff<86400) return Math.floor(diff/3600)+"h ago";
  if(diff<604800) return Math.floor(diff/86400)+"d ago";
  try{return new Date(t).toLocaleDateString(localLocale(),{day:"2-digit",month:"short"});}catch(e){return "";}
}
function newsSentimentClass(s){
  s=String(s||"").toLowerCase();
  if(s==="positive") return "pos";
  if(s==="negative") return "neg";
  return "mon";
}
function newsDescription(n){
  if(n.summary && n.summary.trim()) return n.summary.trim();
  const bits=[];
  if(n.category && !["Market","Holding","Portfolio","Other","Asset"].includes(n.category)) bits.push(n.category);
  if(n.area && !["Market","Portfolio","Global"].includes(n.area)) bits.push(n.area);
  let dateStr="";
  if(n.published){const d=new Date(n.published); if(!isNaN(d)) dateStr=d.toLocaleDateString(localLocale(),{day:"2-digit",month:"short",year:"numeric"});}
  const tail=[bits.join(" · "),dateStr].filter(Boolean).join(" · ");
  return `${n.source||"News"}${tail?" · "+tail:""} — tap to read the full article.`;
}
function newsCardHtml(n){
  const color=newsColor(n.domain||n.source||n.symbol||n.category);
  const fav=newsFavicon(n.domain);
  const initial=escapeHtml(String(n.source||n.symbol||"N").trim().charAt(0).toUpperCase()||"N");
  const time=newsTimeAgo(n.published);
  const sent=escapeHtml(n.sentiment||"Monitor");
  const areaTxt=(n.area&&!["Market","Portfolio"].includes(n.area))?` · ${escapeHtml(n.area)}`:"";
  const symChip=n.symbol?` · <span class="newsSym" onclick="event.preventDefault();event.stopPropagation();openAsset('${escAttr(jsString(n.symbol))}')">${escapeHtml(n.symbol)}</span>`:"";
  return `<a class="newsCard" href="${escAttr(n.url||"#")}" target="_blank" rel="noopener" title="${escAttr(n.headline||"")}">
    <div class="newsFoot" style="--nc:${color}"><span class="newsLogo">${fav?`<img src="${escAttr(fav)}" alt="" loading="lazy" onerror="this.style.display='none';this.parentNode.querySelector('.newsLogoFallback').style.display='flex'"/>`:""}<span class="newsLogoFallback" style="${fav?"display:none":"display:flex"}">${initial}</span></span></div>
    <h4 class="newsTitle">${escapeHtml(n.headline||"Open news")}</h4>
    <p class="newsDesc">${escapeHtml(newsDescription(n))}</p>
    <div class="newsMetaLine"><b>${escapeHtml(n.source||"News")}</b>${time?` · ${escapeHtml(time)}`:""}${areaTxt}${symChip}</div>
    <span class="newsRowTag newsTag ${newsSentimentClass(sent)}">${sent}</span>
  </a>`;
}
async function renderNewsCenter(){
  const grid=byId("newsCenterGrid");
  if(!grid) return;
  const scope=byId("newsScope")?.value||"portfolio";
  const text=(byId("newsFilter")?.value||"").trim();
  if(byId("newsHint")){
    newsHint.textContent=scope==="portfolio" && !text
      ? "Live headlines for the stocks, funds, ETFs and coins you actually hold — only real, published articles."
      : "Broader market headlines from real publishers. Search any stock, fund, coin, area, sector or industry.";
  }
  grid.innerHTML=Array.from({length:6},()=>`<div class="newsCard skelNews"><span class="skeleton skelLine" style="width:85%;height:16px"></span><span class="skeleton skelLine" style="width:97%"></span><span class="skeleton skelLine" style="width:55%"></span><div class="skelFoot"><span class="skeleton" style="width:36px;height:36px;border-radius:9px"></span><span class="skeleton skelLine" style="width:40%"></span></div></div>`).join("");
  let rows=[];
  try{rows=await get(`/news-center?scope=${encodeURIComponent(scope)}&query=${encodeURIComponent(text)}${q().replace("?","&")}`);}
  catch(e){rows=[]}
  // Fresh / no holdings: "My portfolio" is empty — show general Top market news instead.
  if(scope==="portfolio" && !text && !rows.length){
    try{ rows=await get(`/news-center?scope=top${q().replace("?","&")}`); }catch(e){}
    if(rows.length && byId("newsHint")) newsHint.textContent="No holdings yet — showing top market headlines. Add assets to see news for your portfolio.";
  }
  state.newsRows=rows;
  if(!rows.length){
    grid.innerHTML=`<div class="newsEmpty"><div class="newsEmptyArt">📰</div><b>No fresh articles right now</b><span>${scope==="portfolio"&&!text?"Your holdings have no published news at the moment. Try the Top, World or Sector tabs.":"No published articles matched. Try another search term or scope."}</span></div>`;
    return;
  }
  grid.innerHTML=rows.map(newsCardHtml).join("");
}
function cfoSec(icon,title,body){return `<div class="cfoSec"><h4>${icon} ${escapeHtml(title)}</h4>${body}</div>`;}
function cfoHeader(){
  const d=state.lastDashboard||{};
  const who=currentProfileName()||(state.profile?state.profile:"Family");
  const pl=Number(d.pl||0);
  return cfoSec("💰","Net worth snapshot",
    `<p><b>${displayMoney(d.net_worth||0)}</b> total for <b>${escapeHtml(who)}</b> — ${displayMoney(d.investments||0)} investments, ${displayMoney(d.properties||0)} real assets, ${displayMoney(d.cash||0)} cash.</p>
     <p>Today: <span class="${cls(d.daily)}">${displayMoney(d.daily||0)}</span> • Unrealised P/L: <span class="${cls(pl)}">${displayMoney(pl)}</span> • Savings rate: <b>${pct(d.savings_rate)}</b>.</p>`);
}
function cfoCashflow(){
  const d=state.lastDashboard||{};
  const inc=Number(d.income||0), exp=Number(d.expenses||0), inv=Number(d.monthly_investment||0), sr=Number(d.savings_rate||0);
  let verdict=sr>=40?"Excellent — you keep a large share of income.":sr>=20?"Healthy savings rate.":sr>0?"Positive but could be higher — aim for 20%+.":"You're spending more than you earn this month — review expenses.";
  return cfoSec("📊","Cashflow & savings",
    `<p>Income ${displayMoney(inc)} • Expenses ${displayMoney(exp)} • Investing ${displayMoney(inv)} /period.</p>
     <p>Net surplus: <span class="${cls(inc-exp)}">${displayMoney(inc-exp)}</span> • Savings rate <b>${pct(sr)}</b>. ${escapeHtml(verdict)}</p>`);
}
function cfoConcentration(){
  const h=(state.lastHoldings||[]).filter(x=>Number(x.value_eur)>0);
  if(!h.length) return cfoSec("🧭","Diversification","<p>No holdings yet to analyse. Add holdings in the Portfolio tab.</p>");
  const totalInv=h.reduce((s,x)=>s+Number(x.value_eur||0),0)||1;
  const top=h.slice().sort((a,b)=>b.value_eur-a.value_eur)[0];
  const topPct=top.value_eur/totalInv*100;
  const alloc=state.lastPortfolioAllocation||state.lastAllocation||{};
  const secs=(alloc.by_sector||[]).slice().sort((a,b)=>b.value-a.value);
  const ctry=(alloc.by_country||[]).slice().sort((a,b)=>b.value-a.value);
  const secTotal=secs.reduce((s,x)=>s+x.value,0)||1;
  const topSec=secs[0];
  let warn=topPct>=35?`<p class="cfoWarn">⚠️ ${escapeHtml(top.symbol)} is ${topPct.toFixed(0)}% of your investments — that's concentrated. Consider trimming or adding other names.</p>`:
    (topSec && topSec.value/secTotal*100>=50?`<p class="cfoWarn">⚠️ Over half your equity is in ${escapeHtml(topSec.name)} — sector concentration risk.</p>`:`<p>Spread looks reasonable.</p>`);
  return cfoSec("🧭","Diversification & concentration",
    `<p>Largest position: <b>${escapeHtml(top.symbol)}</b> at ${topPct.toFixed(1)}% of investments.</p>
     <p>Top sectors: ${secs.slice(0,3).map(s=>`${escapeHtml(s.name)} ${(s.value/secTotal*100).toFixed(0)}%`).join(" · ")||"—"}.</p>
     <p>Top geographies: ${ctry.slice(0,3).map(c=>escapeHtml(c.name)).join(" · ")||"—"}.</p>${warn}`);
}
function cfoMovers(metric="year"){
  const h=(state.lastHoldings||[]).filter(x=>Number(x.value_eur)>0);
  if(!h.length) return cfoSec("📈","Movers","<p>No holdings to rank yet.</p>");
  const lbl={day:"today",week:"this week",month:"this month",year:"over 1 year"}[metric]||metric;
  const sorted=h.slice().sort((a,b)=>Number(b[metric]||0)-Number(a[metric]||0));
  const up=sorted.slice(0,3), down=sorted.slice(-3).reverse();
  const row=x=>`${escapeHtml(x.symbol)} <span class="${cls(x[metric])}">${signed(x[metric])}</span>`;
  return cfoSec("📈",`Best & worst ${lbl}`,
    `<p><b>Top:</b> ${up.map(row).join(" · ")}</p><p><b>Lagging:</b> ${down.map(row).join(" · ")}</p>`);
}
function cfoBuyZone(){
  const h=(state.lastHoldings||[]).filter(x=>Number(x.value_eur)>0);
  const low=h.filter(x=>Number(x.year_high)>0 && Number(x.price)<=Number(x.year_low)*1.05);
  const oversold=h.filter(x=>x.rsi!=null && Number(x.rsi)<35);
  const set={}; [...low,...oversold].forEach(x=>set[x.symbol]=x);
  const list=Object.values(set).slice(0,6);
  if(!list.length) return cfoSec("🟢","Value / buy watch","<p>None of your holdings are near their 52-week low or oversold right now.</p>");
  return cfoSec("🟢","Value / buy watch",
    `<p>Near 52-week low or oversold (RSI&lt;35) — potential value zones to research:</p>
     <ul>${list.map(x=>`<li><b>${escapeHtml(x.symbol)}</b> ${money(x.price,x.currency)}${x.rsi!=null?` · RSI ${Math.round(x.rsi)}`:""}${Number(x.year_low)?` · 52w low ${money(x.year_low,x.currency)}`:""}</li>`).join("")}</ul>`);
}
function cfoRisk(){
  const h=(state.lastHoldings||[]).filter(x=>Number(x.value_eur)>0);
  const overbought=h.filter(x=>x.rsi!=null && Number(x.rsi)>70);
  const losers=h.filter(x=>Number(x.pl_pct||0)<-15);
  const bits=[];
  if(overbought.length) bits.push(`<p><b>Overbought (RSI&gt;70):</b> ${overbought.slice(0,5).map(x=>`${escapeHtml(x.symbol)} (${Math.round(x.rsi)})`).join(", ")} — momentum may be stretched.</p>`);
  if(losers.length) bits.push(`<p><b>Big drawdowns:</b> ${losers.slice(0,5).map(x=>`${escapeHtml(x.symbol)} ${signed(x.pl_pct)}`).join(", ")} — review the thesis.</p>`);
  if(!bits.length) bits.push("<p>No major overbought or deep-loss positions right now.</p>");
  return cfoSec("⚠️","Risk check",bits.join(""));
}
function cfoGoals(){
  const plans=state.savingsPlans||[];
  if(!plans.length) return cfoSec("🎯","Goals","<p>No savings goals yet. Add them in Alerts & Plans.</p>");
  return cfoSec("🎯","Savings goals",
    `<ul>${plans.map(p=>`<li><b>${escapeHtml(p.name)}</b> — ${pct(p.progress)} done (${displayMoney(p.current_eur||p.current)} / ${displayMoney(p.target_eur||p.target)})${p.months_left!=null?` · ~${p.months_left} months left`:""}</li>`).join("")}</ul>`);
}
function cfoProperty(){
  const p=(state.propertyRows||[]).filter(x=>(x.status||"active")==="active");
  if(!p.length) return cfoSec("🏠","Real assets","<p>No properties or valuables added yet.</p>");
  const val=p.reduce((s,x)=>s+Number(x.value_eur||0),0);
  const fc=p.reduce((s,x)=>s+Number(x.forecast_value_eur||0),0);
  const rent=p.reduce((s,x)=>s+Number(x.rental_income_eur||0),0);
  const rented=p.filter(x=>x.is_rented).length;
  return cfoSec("🏠","Real assets",
    `<p>${p.length} asset(s) worth <b>${displayMoney(val)}</b>, forecast <b>${displayMoney(fc)}</b>.</p>
     <p>Rental income: <b>${displayMoney(rent)}</b>/yr from ${rented} rented unit(s).</p>`);
}
function cfoTax(){
  const p=(state.propertyRows||[]).filter(x=>x.tax);
  if(!p.length) return cfoSec("🧾","Tax","<p>Add properties to see indicative tax estimates, or open any asset for ratings & valuation sources.</p>");
  return cfoSec("🧾","Tax (indicative)",
    `<ul>${p.slice(0,5).map(x=>`<li><b>${escapeHtml(x.name)}</b> (${escapeHtml(x.tax.region)}) — sale CGT est. ${money(x.tax.estimated_sale_tax,x.currency)}, rental tax ${money(x.tax.estimated_rental_tax_year,x.currency)}/yr</li>`).join("")}</ul>
     <p class="cfoMuted">Indicative only — verify with a tax advisor.</p>`);
}
const CFO_SUGGESTIONS=["Give me an overview","How is my cashflow & savings rate?","Is my portfolio diversified?","What should I watch to buy?","What are my risks?","Best & worst performers","How are my goals?","My real estate & rent","What changed today?","Any tax to know?"];
function cfoBuildAnswer(q){
  q=(q||"").toLowerCase();
  const parts=[]; let matched=false;
  if(/overview|summary|how am i|net worth|how.?s it going|status|doing/.test(q)){parts.push(cfoHeader());matched=true;}
  if(/save|saving|cash ?flow|income|expense|spend|budget|afford/.test(q)){parts.push(cfoCashflow());matched=true;}
  if(/alloc|diversif|concentrat|spread|sector|geograph|countr|exposure|rebalanc/.test(q)){parts.push(cfoConcentration());matched=true;}
  if(/buy|cheap|low|oversold|opportun|undervalu|value|add more/.test(q)){parts.push(cfoBuyZone());matched=true;}
  if(/sell|overbought|risk|risky|trim|reduce|danger|loss|losing|drawdown/.test(q)){parts.push(cfoRisk());matched=true;}
  if(/best|top|winner|gainer|perform|worst|loser|return/.test(q)){parts.push(cfoMovers(/today|day|now/.test(q)?"day":"year"));matched=true;}
  if(/goal|plan|target|emergency|retire/.test(q)){parts.push(cfoGoals());matched=true;}
  if(/propert|real ?estate|house|flat|rent|land|plot|villa/.test(q)){parts.push(cfoProperty());matched=true;}
  if(/tax/.test(q)){parts.push(cfoTax());matched=true;}
  if(/chang|today|now|happen|update|move/.test(q)){parts.push(cfoMovers("day"));matched=true;}
  if(!matched){parts.push(cfoHeader());parts.push(cfoMovers("year"));parts.push(cfoBuyZone());}
  return parts.join("");
}
function renderCfoChat(){
  const box=byId("cfoChat");
  if(!box) return;
  const msgs=state.cfoChat||[];
  box.innerHTML=msgs.map(m=>m.role==="user"
    ? `<div class="cfoMsg user"><div class="cfoBubble">${escapeHtml(m.text)}</div></div>`
    : `<div class="cfoMsg bot"><div class="cfoAvatar">🤖</div><div class="cfoBubble cfoAnswer">${m.html}</div></div>`
  ).join("")+(state.cfoTyping?`<div class="cfoMsg bot"><div class="cfoAvatar">🤖</div><div class="cfoBubble cfoTyping"><i></i><i></i><i></i></div></div>`:"");
  box.scrollTop=box.scrollHeight;
}
function renderCfoSuggest(last){
  const el=byId("cfoSuggest");
  if(!el) return;
  const opts=CFO_SUGGESTIONS.filter(s=>s!==last);
  for(let i=opts.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[opts[i],opts[j]]=[opts[j],opts[i]];}
  el.innerHTML=opts.slice(0,4).map(s=>`<button class="cfoChip" onclick="askQuick('${escAttr(jsString(s))}')">${escapeHtml(s)}</button>`).join("");
}
function cfoGreet(){
  if(state.cfoChat && state.cfoChat.length){renderCfoChat();return;}
  const d=state.lastDashboard||{};
  const who=currentProfileName()||(state.profile?state.profile:"there");
  state.cfoChat=[{role:"bot",html:`<p>👋 Hi <b>${escapeHtml(who)}</b>, I'm your AI CFO. I read your live portfolio (this profile only) and can break down your wealth, spot risks, find value, and track goals.</p>`+cfoHeader()+`<p class="cfoMuted">Pick a question below or type your own.</p>`}];
  renderCfoChat();
  renderCfoSuggest();
}
function askQuick(text){ if(byId("question")) byId("question").value=text; askAI(); }
function askAI(){
  const inp=byId("question");
  const q=(inp?.value||"").trim();
  if(!q) return;
  state.cfoChat=state.cfoChat||[];
  state.cfoChat.push({role:"user",text:q});
  if(inp) inp.value="";
  if(byId("cfoSuggest")) byId("cfoSuggest").innerHTML="";
  state.cfoTyping=true; renderCfoChat();
  setTimeout(()=>{
    state.cfoTyping=false;
    state.cfoChat.push({role:"bot",html:cfoBuildAnswer(q)+`<p class="cfoMuted">Educational only — not financial advice.</p>`});
    renderCfoChat();
    renderCfoSuggest(q);
  },480);
}
function clearCfoChat(){ state.cfoChat=[]; cfoGreet(); }
let _searchTimer=null, _searchSeq=0;
function runSearch(){
  clearTimeout(_searchTimer);
  const v=search.value.trim();
  if(!v){searchResults.style.display="none";return;}
  searchResults.innerHTML='<div class="searchEmpty"><b>Searching live…</b></div>';
  searchResults.style.display="block";
  _searchTimer=setTimeout(()=>doRunSearch(v),260);
}
async function doRunSearch(v){
  const seq=++_searchSeq;
  const r=await searchAssets(v,{limit:60});
  if(seq!==_searchSeq) return; // a newer search superseded this one
  state.globalSearchRows=r;
  searchResults.innerHTML=r.map(a=>searchResultCard(a,"global")).join("") || `<div class="searchEmpty"><b>No exact match yet</b><br><span class="subtitle">Try the full company/fund name, ISIN, ticker, scheme code, market, or add it manually inside Portfolio / Compare.</span></div>`;
  searchResults.style.display="block";
}
function assetSearchMeta(a){
  return `${escapeHtml(a.type||"Asset")} • ${escapeHtml(a.market_name||a.market||a.country||"Global")} • ${escapeHtml(a.currency||"")}${a.price?` ${Number(a.price||0).toLocaleString()}`:""} • ${escapeHtml(a.source||"")}`;
}
function assetSuggestionButton(a,onclick){
  return `<button type="button" class="suggestionItem" onclick="${onclick}" title="${escAttr(searchHoverText(a))}"><b>${escapeHtml(a.name||a.symbol)}</b><span>${escapeHtml(a.symbol)} • ${assetSearchMeta(a)}</span><small>${escapeHtml(searchMiniInsight(a))}</small></button>`;
}
function searchResultCard(a,source="global"){
  const symbol=escAttr(jsString(a.symbol||""));
  return `<div class="searchResultItem" onclick="openSearchResult('${symbol}','${escAttr(source)}')" title="${escAttr(searchHoverText(a))}">
    <div class="searchResultMain">
      <span class="searchType">${escapeHtml(a.type||"Asset")}</span>
      <b>${escapeHtml(a.name||a.symbol)}</b>
      <small>${escapeHtml(a.symbol)} • ${escapeHtml(a.market_name||a.market||a.country||"Global")} • ${escapeHtml(a.currency||"")}${a.price?` ${Number(a.price||0).toLocaleString()}`:""}</small>
    </div>
    <div class="searchResultStats">
      <span class="${cls(a.day)}">${signed(a.day)}</span>
      <em>${escapeHtml(a.source||"Search")}</em>
    </div>
    <div class="searchHoverPanel">
      <b>${escapeHtml(a.symbol||"")}</b>
      <span>${escapeHtml(searchMiniInsight(a))}</span>
      <span>${escapeHtml(searchHoverText(a))}</span>
    </div>
  </div>`;
}
function searchHoverText(a){
  const parts=[
    a.name||a.symbol,
    a.type||"Asset",
    a.category,
    a.sector,
    a.market_name||a.market,
    a.country,
    a.currency,
    a.scheme_code?`Scheme ${a.scheme_code}`:"",
    a.isin_growth?`ISIN ${a.isin_growth}`:"",
    a.source
  ].filter(Boolean);
  return parts.join(" • ");
}
function searchMiniInsight(a){
  if(a.market==="MFINDIA" || a.type==="Mutual Fund") return `${a.category||"Mutual fund"} from India. Click to review first; add to portfolio only if you choose.`;
  if(a.market==="BONDINDIA" || a.type==="Bond") return `${a.category||"Bond"} watch item. Review yield/coupon before adding.`;
  if(a.type==="Crypto") return `Crypto asset, high volatility. Review price, trend and news before adding.`;
  if(a.type==="ETF") return `ETF/listed fund. Review market, currency and yearly performance.`;
  return `${a.sector||"Market"} asset. Review details, movement and news before adding.`;
}
function searchRowsForSource(source){
  if(source==="asset-detail") return state.assetDetailSearchRows||[];
  return state.globalSearchRows||[];
}
function searchAssetBySymbol(symbol,source="global"){
  const pools=[searchRowsForSource(source),state.globalSearchRows||[],state.assetDetailSearchRows||[],state.fundBondSearchRows||[],state.fundBondRows||[],localAssetSearch(symbol)];
  return pools.flat().find(a=>String(a.symbol||"").toUpperCase()===String(symbol||"").toUpperCase())||{symbol,name:symbol};
}
function openSearchResult(symbol,source="global"){
  const row=searchAssetBySymbol(symbol,source);
  const results=source==="asset-detail"?byId("assetDetailResults"):byId("searchResults");
  if(results) results.style.display="none";
  if(source==="global" && byId("search")) search.value="";
  if(row.market==="MFINDIA" || row.market==="BONDINDIA" || row.type==="Mutual Fund" || row.type==="Bond") return openFundBondDetail(row);
  return openAsset(symbol);
}
async function openFundBondDetail(row){
  state.previewFundBondRows=[row].concat(state.previewFundBondRows||[]).slice(0,20);
  show("Asset Detail",[...document.querySelectorAll(".nav button")].find(b=>b.textContent.includes("Asset Detail")));
  assetDetail.innerHTML=`<div class="aiBox">Loading fund details, latest NAV and history...</div>`;
  let detail={};
  if(row.scheme_code && row.type!=="Bond"){
    try{detail=await get(`/fund-detail?scheme_code=${encodeURIComponent(row.scheme_code)}`);}
    catch(e){detail={error:e.message};}
  }
  renderFundBondDetail(row,detail);
}
function navMoney(v){return `₹${Number(v||0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:4})}`}
function metricValue(v){return v===undefined || v===null || Number.isNaN(Number(v)) ? "-" : signed(v)}
function fundMetricCard(label,value,note="",klass=""){
  return `<div class="fundMetricCard"><small>${escapeHtml(label)}</small><b class="${klass}">${escapeHtml(value)}</b><em>${escapeHtml(note)}</em></div>`;
}
function renderFundBondDetail(row,detail={}){
  const merged={...row,...Object.fromEntries(Object.entries(detail||{}).filter(([,v])=>v!=="" && v!==undefined && v!==null))};
  state.previewFundBondRows=[merged].concat(state.previewFundBondRows||[]).slice(0,20);
  const platforms=(row.platforms||[]).join(", ")||"Add broker/platform";
  const isBond=merged.type==="Bond";
  const category=merged.scheme_category||merged.category||"Mutual Fund";
  const headline=isBond ? `${pct(merged.yield||0)} yield • ${pct(merged.coupon||0)} coupon` : merged.latest_nav ? `${navMoney(merged.latest_nav)} NAV` : `${escapeHtml(category)} • ${escapeHtml(merged.risk||"Risk to review")}`;
  const navDate=merged.nav_date||"NAV date unavailable";
  const navNote=merged.latest_nav ? `Latest NAV on ${navDate}` : "Connect/fetch NAV data by scheme code";
  const points=merged.nav_points||[];
  assetDetail.innerHTML=`<div class="grid fundDetailPage">
    <div class="card c12 fundActionBar"><div><button class="btn secondary smallBtn" data-back="1">Back</button><button class="btn" onclick="addFundBondToPortfolio('${escAttr(jsString(merged.symbol))}')">Add to portfolio</button><button class="btn secondary" onclick="addFavorite('${escAttr(jsString(merged.symbol))}')">Add favorite</button></div><span class="pill">${escapeHtml(merged.market||"MFINDIA")} • ${escapeHtml(merged.currency||"INR")}</span></div>
    <div class="heroPanel c12 fundHero"><div class="fundTitleBlock"><div class="metricLabel">${escapeHtml(merged.type||"Fund")} research</div><h2>${escapeHtml(merged.name||merged.symbol)}</h2><div class="heroMetric">${headline}</div><div class="subtitle">${escapeHtml(merged.symbol)} • ${escapeHtml(merged.source||"Funds catalog")}</div></div><div class="fundMetricGrid">
      ${fundMetricCard("Latest NAV",merged.latest_nav?navMoney(merged.latest_nav):"-",navNote)}
      ${fundMetricCard("NAV Move",`${merged.nav_change?navMoney(merged.nav_change):"₹0.00"} (${metricValue(merged.nav_change_pct)})`,"Previous NAV comparison",cls(merged.nav_change_pct))}
      ${fundMetricCard("1 Month",metricValue(merged.return_1m),"NAV return",cls(merged.return_1m))}
      ${fundMetricCard("6 Months",metricValue(merged.return_6m),"NAV return",cls(merged.return_6m))}
      ${fundMetricCard("1 Year",metricValue(merged.return_1y ?? merged.one_year),"NAV return",cls(merged.return_1y ?? merged.one_year))}
      ${fundMetricCard("3 Years",metricValue(merged.return_3y ?? merged.three_year),"NAV return",cls(merged.return_3y ?? merged.three_year))}
      ${fundMetricCard(isBond?"Coupon":"Risk",isBond?pct(merged.coupon||0):(merged.risk||"Review"),isBond?"Bond coupon":"Category risk estimate")}
      ${fundMetricCard("Platform",(merged.platforms||[])[0]||"Manual",platforms)}
    </div></div>
    <div class="card c7"><div class="cardHead"><h3>NAV History</h3><span class="pill">${points.length?`${points.length} points`:"No NAV history"}</span></div><div class="chartBox"><canvas id="fundNavChart"></canvas></div></div>
    <div class="card c5"><h3>Scheme Snapshot</h3><table><tbody><tr><th>Fund house</th><td>${escapeHtml(merged.fund_house||"-")}</td></tr><tr><th>Scheme type</th><td>${escapeHtml(merged.scheme_type||merged.type||"-")}</td></tr><tr><th>Category</th><td>${escapeHtml(category)}</td></tr><tr><th>Scheme code</th><td>${escapeHtml(merged.scheme_code||"-")}</td></tr><tr><th>ISIN growth</th><td>${escapeHtml(merged.isin_growth||"-")}</td></tr><tr><th>ISIN IDCW</th><td>${escapeHtml(merged.isin_reinvestment||"-")}</td></tr><tr><th>History rows</th><td>${escapeHtml(merged.history_count||points.length||"-")}</td></tr></tbody></table></div>
    <div class="card c6"><h3>Research Note</h3><div class="aiBox">This search result is not added to your portfolio yet. Review NAV trend, category, risk, fund house and factsheet before adding. NAV comes from MFAPI/AMFI-style public data; holdings, AUM, TER and benchmark can be added later via AMFI/Groww/MF Central feeds.</div></div>
    <div class="card c6"><h3>Dynamic Checks</h3><div class="aiBox">${escapeHtml(fundAiComment(merged))}</div></div>
    <div class="card c12"><h3>Quick Actions</h3><div class="actionGroup fundQuickActions"><button class="btn" onclick="addFundBondToPortfolio('${escAttr(jsString(merged.symbol))}')">Add to portfolio</button><button class="btn secondary" onclick="show('Funds & Bonds')">Open Funds & Bonds tab</button><a class="btn secondary" href="https://www.google.com/search?q=${encodeURIComponent((merged.name||merged.symbol)+' factsheet')}" target="_blank" rel="noopener">Search factsheet</a><a class="btn secondary" href="https://www.google.com/search?q=${encodeURIComponent((merged.name||merged.symbol)+' portfolio holdings AUM expense ratio')}" target="_blank" rel="noopener">Search holdings/AUM</a></div></div>
  </div>`;
  if(points.length){
    const sample=points.slice(-90);
    chart("fundNavChart","line",sample.map(p=>p.date),sample.map(p=>Number(p.nav||0)),"NAV");
  }else{
    fallbackChart("fundNavChart",["NAV"],[Number(merged.latest_nav||0)],"NAV");
  }
  updateBackButton();
}
function addFundBondToPortfolio(symbol){
  prefillFundBond(symbol);
}
function fundAiComment(f){
  const ret1=Number(f.return_1y ?? f.one_year ?? 0);
  const ret3=Number(f.return_3y ?? f.three_year ?? 0);
  const move=Number(f.nav_change_pct||0);
  const parts=[];
  if(f.latest_nav) parts.push(`Latest NAV is ${navMoney(f.latest_nav)} on ${f.nav_date}.`);
  if(ret1 || ret3) parts.push(`NAV returns: 1M ${metricValue(f.return_1m)}, 6M ${metricValue(f.return_6m)}, 1Y ${metricValue(ret1)}, 3Y ${metricValue(ret3)}.`);
  if(move > 0) parts.push(`Short-term NAV moved up ${metricValue(move)}, so recent price action is positive.`);
  else if(move < 0) parts.push(`Short-term NAV moved down ${metricValue(move)}, so check if this is normal market volatility or category weakness.`);
  parts.push(`Category: ${f.scheme_category||f.category||"Mutual Fund"}; risk estimate: ${f.risk||"review factsheet"}. Compare with benchmark, expense ratio, AUM, fund manager, exit load and portfolio concentration before investing.`);
  return parts.join(" ");
}
const CRYPTO_HINTS=["coin","crypto","token","bitcoin","ethereum","solana","dogecoin","cardano","ripple","btc","eth","sol","xrp","usdt","usdc","-usd"];
function searchRank(a,query){
  const q=String(query||"").toLowerCase();
  const terms=q.split(/\s+/).filter(Boolean);
  const symbol=String(a.symbol||"").toLowerCase();
  const yahoo=String(a.yahoo||"").toLowerCase();
  const name=String(a.name||"").toLowerCase();
  const baseSym=symbol.split("-")[0].split(".")[0]; // RELIANCE matches RELIANCE.NS, BTC matches BTC-USD
  const hay=`${symbol} ${yahoo} ${name} ${a.type||""} ${a.category||""} ${a.sector||""} ${a.country||""} ${a.market||""} ${a.market_name||""} ${a.scheme_code||""} ${a.isin_growth||""}`.toLowerCase();
  let score=0;
  if(q===symbol || q===yahoo || q===baseSym) score+=2000;
  else if(symbol.startsWith(q) || yahoo.startsWith(q) || baseSym.startsWith(q)) score+=700;
  if(name===q) score+=1400;
  else if(name.startsWith(q)) score+=520;
  else if(q && name.includes(q)) score+=320;
  if(q && hay.includes(q)) score+=180;
  score+=terms.filter(t=>hay.includes(t)).length*50;
  if(terms.length && terms.every(t=>hay.includes(t))) score+=220;
  // Live, tradeable assets (a real quote came back) rank far above name-only listings
  if(a.price) score+=650;
  if(a.source==="Yahoo search") score+=40;
  if(a.source==="MFAPI India master") score+=60;
  // Demote crypto unless the user is clearly searching crypto (keeps "Tesla AI USD" below TSLA)
  const cryptoish=CRYPTO_HINTS.some(w=>q.includes(w));
  if(a.type==="Crypto" && !cryptoish) score-=500;
  const indiaAmcs=new Set(["sbi","icici","hdfc","axis","kotak","nippon","uti","motilal","quant","tata","aditya","bandhan","invesco","mirae","parag","canara","edelweiss","franklin","dsp"]);
  if(indiaAmcs.has(q)){
    if(["Mutual Fund","ETF"].includes(a.type) && a.country==="India") score+=1200;
    else if(a.country!=="India") score-=700;
  }
  if(["Stock","ETF","Mutual Fund","Crypto"].includes(a.type)) score+=30;
  return score;
}
async function searchAssets(query,options={}){
  const q=String(query||"").trim();
  if(!q) return [];
  const market=options.market||"";
  const limit=options.limit||60;
  const cacheKey=`${q.toLowerCase()}|${market}`;
  state.searchCache=state.searchCache||{};
  let rows=state.searchCache[cacheKey];
  if(!rows){
    try{rows=await post("/search",{query:q,market});}
    catch(e){rows=[]}
    state.searchCache[cacheKey]=rows;
  }
  const local=localAssetSearch(q);
  const seen=new Set();
  return (rows||[]).concat(local).filter(a=>{
    const key=`${String(a.symbol||"").toUpperCase()}|${String(a.yahoo||"").toUpperCase()}|${String(a.scheme_code||"")}`;
    if(!a.symbol || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a,b)=>searchRank(b,q)-searchRank(a,q)).slice(0,limit);
}
function localAssetSearch(query){
  const q=query.toLowerCase();
  const pool=[...(state.lastHoldings||[]),...(state.favoriteRows||[]),...(state.marketData?.valuable||[]),...(state.marketData?.coins||[]),...(state.fundBondRows||[])];
  const seen=new Set();
  return pool.filter(a=>{
    if(!a.symbol || seen.has(a.symbol)) return false;
    seen.add(a.symbol);
    return `${a.symbol} ${a.name} ${a.type} ${a.sector} ${a.category} ${a.market} ${a.country}`.toLowerCase().includes(q);
  });
}

function searchEnterActions(){
  return {
    search:runSearch,
    hAssetSearch:suggestHoldingAssets,
    marketSearch:()=>filterMarketSelect("hMarket",byId("marketSearch")?.value||""),
    portfolioFilter:loadPortfolio,
    portfolioMinPrice:loadPortfolio,
    portfolioMaxPrice:loadPortfolio,
    portfolioMinValue:loadPortfolio,
    portfolioMinPerf:loadPortfolio,
    holdingFilter:renderHoldings,
    holdingMinPrice:renderHoldings,
    holdingMaxPrice:renderHoldings,
    holdingMinValue:renderHoldings,
    holdingMinPerf:renderHoldings,
    holdingMaxPerf:renderHoldings,
    cashflowFilter:renderCashflowTable,
    cashflowMonthFilter:renderCashflowTable,
    propertyFilter:renderPropertiesTable,
    marketExchangeSearch:()=>liveMarketSearchKey({key:"Enter",preventDefault(){}}),
    marketTableFilter:renderMarketTables,
    marketMinPrice:renderMarketTables,
    marketMaxPrice:renderMarketTables,
    marketMinMove:renderMarketTables,
    marketMaxMove:renderMarketTables,
    favoriteFilter:renderFavoritesTable,
    favoriteMinPrice:renderFavoritesTable,
    favoriteMaxPrice:renderFavoritesTable,
    favoriteMinPerf:renderFavoritesTable,
    favoriteInvest:renderFavoritesTable,
    screenerFilter:()=>{clearTimeout(screenerTimer);return renderScreeners();},
    screenerMinScore:()=>{clearTimeout(screenerTimer);return renderScreeners();},
    compareAssetSearch:addCompareAsset,
    compareMinScore:renderCompare,
    newsFilter:()=>{clearTimeout(newsTimer);return renderNewsCenter();},
    fundBondFilter:()=>{clearTimeout(fundBondTimer);return renderFundsBonds();},
    assetDetailSearch:assetDetailSearchSuggest
  };
}
function applySearchEnterAction(id){
  const action=searchEnterActions()[id];
  if(!action) return false;
  try{
    const result=action();
    if(result && typeof result.catch==="function") result.catch(e=>console.warn("Search action failed",e));
  }catch(e){
    console.warn("Search action failed",e);
  }
  return true;
}
function handleSearchEnter(event){
  if(event.defaultPrevented || event.key!=="Enter") return;
  const target=event.target;
  if(!target || target.tagName!=="INPUT" || !target.id) return;
  if(applySearchEnterAction(target.id)) event.preventDefault();
}
function annotateEnterSearchFields(){
  Object.keys(searchEnterActions()).forEach(id=>{
    const el=byId(id);
    if(el && !String(el.title||"").includes("Enter")){
      el.title=(el.title?`${el.title} • `:"")+"Press Enter to search or apply this filter";
    }
  });
}

function initUI(){
  if(byId("cfDate")) cfDate.value=new Date().toISOString().slice(0,10);
  byId("profileSwitch")?.addEventListener("click",toggleProfileMenu);
  byId("backBtn")?.addEventListener("click",goBack);
  updateBackButton();
  updatePageHeader(state.currentPage);
  setInterval(()=>updatePageHeader(state.currentPage),60000);
  annotateEnterSearchFields();
  document.addEventListener("keydown",handleSearchEnter);
  document.addEventListener("click",e=>{
    const back=e.target.closest("[data-back]");
    if(back){
      e.preventDefault();
      goBack();
    }
    const menu=byId("profileMenuList");
    const switcher=byId("profileSwitch");
    if(menu && switcher && !menu.contains(e.target) && !switcher.contains(e.target)){
      menu.classList.remove("open");
    }
    const notif=byId("notifPanel");
    const notifBtn=byId("notifBtn");
    if(notif && notifBtn && !notif.contains(e.target) && !notifBtn.contains(e.target)){
      notif.classList.remove("open");
    }
    const marketSuggest=byId("marketExchangeSuggestions");
    const marketSearch=byId("marketExchangeSearch");
    if(marketSuggest && marketSearch && !marketSuggest.contains(e.target) && e.target!==marketSearch){
      marketSuggest.style.display="none";
    }
  });
}

loadSettings();initUI();applySettings();renderLiveToggle();maybeShowOnboarding();renderGuide();loadStockMarkets();loadAll();askAI();tickLocalClock();setInterval(()=>{tickLocalClock();renderMarketStatus();},1000);setInterval(loadMarketStatus,60000);
// If the page is restored from the browser's back/forward cache, the JS never re-runs,
// so re-lock any protected profile that was open before, to require the password again.
window.addEventListener("pageshow",(e)=>{ if(e.persisted) relockOnRestore(); });
