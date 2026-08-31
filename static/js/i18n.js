// Internationalization (i18n) Module: RU, EN, DE
const I18n = {
  currentLang: localStorage.getItem('lan_remote_lang') || 'ru',

  translations: {
    ru: {
      // Header & Navigation
      app_title: "LAN Remote",
      connecting: "Подключение...",
      disconnected: "Отключено",
      search_placeholder: "Поиск настроек (Ctrl+K)...",
      tab_screen: "Экран",
      tab_deck: "Дек",
      tab_system: "Система",
      tab_settings: "Настройки",

      // Screen Stream & Toolbar
      input_mode_btn: "Режим ввода (Тачпад / Прямой)",
      cursor_mode_btn: "Переключить режим мыши (Реальная / Виртуальная)",
      orientation_btn: "Поворот ориентации (Альбомная/Книжная)",
      keyboard_btn: "Экранная клавиатура",
      fullscreen_btn: "Во весь экран",
      ping_label: "Пинг",
      monitors_label: "Экран",
      btn_lmb: "ЛКМ (Левая)",
      btn_rmb: "ПКМ (Правая)",
      btn_drag: "🔒 Зажать (Drag)",
      btn_drag_active: "Зажато (Drag)",
      type_text_placeholder: "Введите текст для отправки на ПК...",
      send_btn: "Отправить",
      trackpad_hint: "Тачпад: 1 палец — курсор и ЛКМ, 2 пальца — скролл, удержание — ПКМ, кнопка Drag — перетаскивание",
      right_click_toast: "Правый клик (ПКМ)",
      drag_on_toast: "Режим перетаскивания (Drag) включен",
      drag_off_toast: "Режим перетаскивания (Drag) выключен",
      text_sent_toast: "Текст отправлен",
      input_mode_toast: "Режим ввода: ",
      mode_trackpad: "Виртуальный тачпад",
      mode_direct: "Прямой сенсор",
      cursor_mode_toast: "Режим курсора: ",
      cursor_physical: "Физический курсор ОС",
      cursor_virtual: "Виртуальный курсор (Тест)",
      orientation_toast: "Ориентация: ",
      orient_normal: "Стандартная",
      orient_landscape: "Альбомный поворот 90°",

      // Touch Deck Profiles
      deck_title: "Touch Deck",
      profile_all: "Все",
      profile_media: "Медиа",
      profile_server: "Сервер",
      profile_gaming: "Игры",
      card_profile_label: "Профиль категории",
      add_action_btn: "Добавить кнопку",
      edit_card_btn: "Редактировать",
      modal_add_title: "Создать кнопку",
      modal_edit_title: "Редактирование кнопки",
      card_title_label: "Название кнопки",
      card_title_placeholder: "Например: Выключить звук",
      card_type_label: "Тип действия",
      card_type_shortcut: "Сочетание клавиш (Shortcut)",
      card_type_command: "Команда консоли / Запуск программы",
      card_type_media: "Управление медиа",
      card_type_power: "Управление питанием",
      card_type_system: "Системная функция",
      card_color_label: "Цвет акцента",
      card_icon_label: "Выберите SVG-иконку",
      save_btn: "Сохранить",
      delete_btn: "Удалить",
      card_saved_toast: "Кнопка сохранена",
      card_deleted_toast: "Кнопка удалена",
      no_cards_in_profile: "В этом профиле пока нет кнопок",

      // System Dashboard & Hardware
      cpu_usage: "Нагрузка CPU",
      ram_memory: "Оперативная память",
      disks_storage: "Диски и накопители",
      free_space: "свободно",
      active_window_title: "Активное окно на ПК:",
      master_volume: "Громкость",
      mute_btn: "Заглушить",
      power_actions: "Питание и экран",
      act_lock: "Блокировка",
      act_screen_off: "Выкл. экран",
      act_sleep: "Спящий режим",
      act_restart: "Перезагрузка",
      act_shutdown: "Выключение",
      confirm_power: "Вы уверены, что хотите выполнить данное действие питания?",

      // Task Manager (Диспетчер задач) & GPU
      taskmgr_title: "Диспетчер задач Windows",
      taskmgr_tab_procs: "Процессы",
      taskmgr_tab_gpu: "GPU и Ядра",
      tasks_running: "процессов",
      taskmgr_search_placeholder: "Поиск процесса по имени или PID...",
      sort_cpu: "По CPU %",
      sort_mem: "По Памяти (MB)",
      sort_name: "По Имени",
      sort_pid: "По PID",
      refresh_btn: "Обновить",
      new_task_btn: "Запустить задачу...",
      run_task_prompt: "Введите имя программы или команду (например: notepad, taskmgr, calc):",
      col_process: "Процесс",
      col_pid: "PID",
      col_cpu: "CPU",
      col_memory: "Память",
      col_user: "Пользователь",
      col_actions: "Действия",
      end_task_btn: "Снять задачу",
      priority_label: "Приоритет",
      task_terminated: "Процесс завершен",
      no_processes_found: "Процессы не найдены",

      // Clipboard History Sync
      clipboard_title: "История буфера обмена (последние 5)",
      clipboard_placeholder: "Вставьте текст для передачи на хост или нажмите Получить...",
      clipboard_send_btn: "Отправить на ПК",
      clipboard_get_btn: "Получить с ПК",
      clipboard_sent_toast: "Текст отправлен в буфер обмена ПК",
      clipboard_got_toast: "Текст получен из буфера обмена ПК",
      no_clipboard_items: "История буфера обмена пуста",
      copy_btn: "Копировать",
      paste_btn: "На ПК",

      // Command Runner
      cmd_runner_title: "Удаленное выполнение команд",
      cmd_runner_placeholder: "Введите shell команду (например: dir, ipconfig, docker ps)...",
      cmd_runner_btn: "Выполнить",
      cmd_ready: "Готов к выполнению команд...",

      // Settings
      settings_search_placeholder: "Поиск любых настроек, звуков, тем, FPS, качества, жестов...",
      sec_appearance: "Внешний вид и Тема",
      setting_theme_title: "Цветовая тема интерфейса",
      setting_theme_desc: "Выберите оформление интерфейса",
      theme_oled: "OLED Deep Black (Черный)",
      theme_cyber: "Cyberpunk Neon (Неон)",
      theme_slate: "Obsidian Slate (Матовый графит)",
      theme_glass: "Glassmorphism (Матовое стекло)",
      setting_sound_title: "Звуковой тактильный отклик",
      setting_sound_desc: "Щелчки переключателей и звуки подтверждения действий",

      sec_language: "Язык интерфейса / Language",
      sec_language_desc: "Выберите язык для меню и управления",
      sec_stream: "Видео и Стрим экрана",
      sec_input: "Ввод и Сенсорные жесты",
      sec_deck: "Touch Deck и SVG-иконки",
      sec_network: "Безопасность и Локальная сеть",

      setting_lang_title: "Язык системы",
      setting_fps_title: "Частота кадров (FPS)",
      setting_fps_desc: "Плавность трансляции экрана (15, 30 или 60 FPS)",
      fps_15: "15 FPS (Экономия батареи)",
      fps_30: "30 FPS (Сбалансировано)",
      fps_60: "60 FPS (Максимальная плавность)",

      setting_quality_title: "Качество сжатия",
      setting_quality_desc: "Степень сжатия JPEG (ниже = быстрее передача и меньше лаг)",
      quality_low: "Низкое (Быстрое, ~20 КБ/кадр)",
      quality_med: "Среднее (Оптимально, ~50 КБ/кадр)",
      quality_high: "Высокое (Четкий текст, ~120 КБ/кадр)",

      setting_scale_title: "Масштабирование разрешения",
      setting_scale_desc: "Уменьшение разрешения перед сжатием",
      scale_50: "50% Масштаб (Высокая скорость)",
      scale_75: "75% Масштаб (Рекомендуется)",
      scale_100: "100% Исходное разрешение",

      setting_monitor_title: "Выбор монитора",
      setting_monitor_desc: "Какой физический экран захватывать",

      setting_cursor_mode_title: "Режим курсора мыши",
      setting_cursor_mode_desc: "Физический (управляет курсором Windows) или Виртуальный (изолирован для тестов)",

      setting_input_mode_title: "Режим ввода по умолчанию",
      setting_input_mode_desc: "Виртуальный тачпад (относительный) или прямое касание",

      setting_sens_title: "Чувствительность тачпада",
      setting_sens_desc: "Скорость перемещения курсора пальцем",
      sens_slow: "0.8x (Медленно и точно)",
      sens_norm: "1.0x (Нормально)",
      sens_fast: "1.3x (Быстро)",
      sens_vfast: "1.8x (Очень быстро)",

      setting_invert_scroll_title: "Инвертировать скролл",
      setting_invert_scroll_desc: "Обратное направление прокрутки двумя пальцами",

      setting_haptic_title: "Тактильный отклик (Вибрация)",
      setting_haptic_desc: "Вибрация телефона при кликах и удержании",

      setting_columns_title: "Колонки сетки Touch Deck",
      setting_columns_desc: "Количество кнопок в одной строке на широких экранах (макс. 4)",

      setting_svg_lib_title: "Библиотека и загрузка SVG",
      setting_svg_lib_desc: "Просмотр встроенных иконок или загрузка собственного .svg файла",
      upload_svg_btn: "Загрузить SVG",

      setting_pin_title: "PIN-код доступа",
      setting_pin_desc: "Пароль для подключения (оставьте пустым для открытого доступа в LAN)",
      setting_port_title: "Порт веб-сервера",
      setting_port_desc: "HTTP порт веб-панели и стриминга",
      setting_ips_title: "Локальные IP-адреса и QR-код для подключения с телефона:",
      qr_scan_hint: "Отсканируйте камерой телефона для быстрого входа:",
      copied_toast: "URL скопирован в буфер!",
      settings_saved_toast: "Настройки сохранены"
    },

    en: {
      // Header & Navigation
      app_title: "LAN Remote",
      connecting: "Connecting...",
      disconnected: "Disconnected",
      search_placeholder: "Search settings (Ctrl+K)...",
      tab_screen: "Screen",
      tab_deck: "Deck",
      tab_system: "System",
      tab_settings: "Settings",

      // Screen Stream & Toolbar
      input_mode_btn: "Input Mode (Trackpad / Direct)",
      cursor_mode_btn: "Toggle Mouse Mode (Physical / Virtual)",
      orientation_btn: "Screen Orientation (Landscape/Portrait)",
      keyboard_btn: "Virtual Keyboard",
      fullscreen_btn: "Fullscreen",
      ping_label: "Ping",
      monitors_label: "Display",
      btn_lmb: "LMB (Left)",
      btn_rmb: "RMB (Right)",
      btn_drag: "🔒 Hold Drag",
      btn_drag_active: "Dragging...",
      type_text_placeholder: "Type text to send to host PC...",
      send_btn: "Send",
      trackpad_hint: "Trackpad: 1 finger move/tap, 2 fingers scroll, long press RMB, Drag button to move windows",
      right_click_toast: "Right Click",
      drag_on_toast: "Drag Lock enabled",
      drag_off_toast: "Drag Lock released",
      text_sent_toast: "Text sent",
      input_mode_toast: "Input Mode: ",
      mode_trackpad: "Virtual Trackpad",
      mode_direct: "Direct Touch",
      cursor_mode_toast: "Cursor Mode: ",
      cursor_physical: "Physical OS Cursor",
      cursor_virtual: "Virtual Cursor (Test)",
      orientation_toast: "Orientation: ",
      orient_normal: "Standard",
      orient_landscape: "Landscape 90°",

      // Touch Deck Profiles
      deck_title: "Touch Deck",
      profile_all: "All",
      profile_media: "Media",
      profile_server: "Server",
      profile_gaming: "Gaming",
      card_profile_label: "Category Profile",
      add_action_btn: "Add Action",
      edit_card_btn: "Edit",
      modal_add_title: "Add Action Button",
      modal_edit_title: "Edit Action Button",
      card_title_label: "Button Title",
      card_title_placeholder: "e.g. Mute Audio",
      card_type_label: "Action Type",
      card_type_shortcut: "Keyboard Shortcut",
      card_type_command: "Shell Command / App Launch",
      card_type_media: "Media Control",
      card_type_power: "Power Management",
      card_type_system: "System Function",
      card_color_label: "Accent Color",
      card_icon_label: "Select SVG Icon",
      save_btn: "Save",
      delete_btn: "Delete",
      card_saved_toast: "Button saved",
      card_deleted_toast: "Button deleted",
      no_cards_in_profile: "No buttons in this profile yet",

      // System Dashboard & Hardware
      cpu_usage: "CPU Usage",
      ram_memory: "RAM Memory",
      disks_storage: "Disks & Storage",
      free_space: "free",
      active_window_title: "Active Host Window:",
      master_volume: "Volume",
      mute_btn: "Mute",
      power_actions: "Power & Display",
      act_lock: "Lock PC",
      act_screen_off: "Screen Off",
      act_sleep: "Sleep",
      act_restart: "Restart",
      act_shutdown: "Shutdown",
      confirm_power: "Are you sure you want to execute this power action?",

      // Task Manager
      taskmgr_title: "Windows Task Manager",
      taskmgr_tab_procs: "Processes",
      taskmgr_tab_gpu: "GPU & Engines",
      tasks_running: "tasks running",
      taskmgr_search_placeholder: "Search process by name or PID...",
      sort_cpu: "By CPU %",
      sort_mem: "By Memory (MB)",
      sort_name: "By Name",
      sort_pid: "By PID",
      refresh_btn: "Refresh",
      new_task_btn: "Run Task...",
      run_task_prompt: "Enter executable or command (e.g. notepad, taskmgr, calc):",
      col_process: "Process",
      col_pid: "PID",
      col_cpu: "CPU",
      col_memory: "Memory",
      col_user: "User",
      col_actions: "Actions",
      end_task_btn: "End Task",
      priority_label: "Priority",
      task_terminated: "Process terminated",
      no_processes_found: "No processes found",

      // Clipboard History Sync
      clipboard_title: "Clipboard History (Last 5 Items)",
      clipboard_placeholder: "Type text to send to host or click Fetch...",
      clipboard_send_btn: "Send to Host",
      clipboard_get_btn: "Fetch from Host",
      clipboard_sent_toast: "Text sent to host clipboard",
      clipboard_got_toast: "Text fetched from host clipboard",
      no_clipboard_items: "No clipboard items yet",
      copy_btn: "Copy",
      paste_btn: "Host",

      // Command Runner
      cmd_runner_title: "Remote Command Execution",
      cmd_runner_placeholder: "Enter shell command (e.g. dir, ipconfig, docker ps)...",
      cmd_runner_btn: "Run",
      cmd_ready: "Ready for commands...",

      // Settings
      settings_search_placeholder: "Search settings, themes, audio, FPS, quality, gestures...",
      sec_appearance: "Appearance & Theme",
      setting_theme_title: "Interface Theme",
      setting_theme_desc: "Choose visual style and color palette",
      theme_oled: "OLED Deep Black",
      theme_cyber: "Cyberpunk Neon",
      theme_slate: "Obsidian Slate",
      theme_glass: "Glassmorphism",
      setting_sound_title: "Tactile Audio Clicks",
      setting_sound_desc: "Mechanical switch clicks and confirmation sounds",

      sec_language: "Interface Language",
      sec_language_desc: "Choose language for UI and navigation",
      sec_stream: "Video & Screen Stream",
      sec_input: "Input & Touch Gestures",
      sec_deck: "Touch Deck & SVG Icons",
      sec_network: "Security & Local Network",

      setting_lang_title: "System Language",
      setting_fps_title: "Target Frame Rate (FPS)",
      setting_fps_desc: "Screen stream smoothness (15, 30, or 60 FPS)",
      fps_15: "15 FPS (Battery Saver)",
      fps_30: "30 FPS (Balanced)",
      fps_60: "60 FPS (Ultra Smooth)",

      setting_quality_title: "Image Compression Quality",
      setting_quality_desc: "JPEG compression degree (lower = faster stream and lower latency)",
      quality_low: "Low (Fastest, ~20 KB/frame)",
      quality_med: "Medium (Optimal, ~50 KB/frame)",
      quality_high: "High (Crisp Text, ~120 KB/frame)",

      setting_scale_title: "Resolution Scaling",
      setting_scale_desc: "Downscale screen resolution before encoding",
      scale_50: "50% Scale (High Speed)",
      scale_75: "75% Scale (Recommended)",
      scale_100: "100% Native Resolution",

      setting_monitor_title: "Capture Monitor",
      setting_monitor_desc: "Select which physical display to stream",

      setting_cursor_mode_title: "Mouse Cursor Mode",
      setting_cursor_mode_desc: "Physical (moves Windows host cursor) or Virtual (isolated for testing)",

      setting_input_mode_title: "Default Input Mode",
      setting_input_mode_desc: "Virtual Trackpad (relative cursor) or Direct Coordinate Touch",

      setting_sens_title: "Trackpad Sensitivity",
      setting_sens_desc: "Multiplier for finger movement speed",
      sens_slow: "0.8x (Slow & Precise)",
      sens_norm: "1.0x (Normal)",
      sens_fast: "1.3x (Fast)",
      sens_vfast: "1.8x (Very Fast)",

      setting_invert_scroll_title: "Invert 2-Finger Scroll",
      setting_invert_scroll_desc: "Reverse vertical two-finger scrolling direction",

      setting_haptic_title: "Haptic Vibration Feedback",
      setting_haptic_desc: "Vibrate phone on tap clicks and long-press right-clicks",

      setting_columns_title: "Deck Grid Columns",
      setting_columns_desc: "Number of action cards per row on larger screens (max 4)",

      setting_svg_lib_title: "SVG Icons Library & Upload",
      setting_svg_lib_desc: "Browse embedded icons or upload custom .svg files",
      upload_svg_btn: "Upload SVG",

      setting_pin_title: "Access PIN Code",
      setting_pin_desc: "Optional PIN requirement (leave blank for open LAN access)",
      setting_port_title: "Web Server Port",
      setting_port_desc: "HTTP port for web dashboard and streaming",
      setting_ips_title: "Active Network IP Addresses & Mobile QR Code:",
      qr_scan_hint: "Scan with phone camera to connect instantly:",
      copied_toast: "URL copied to clipboard!",
      settings_saved_toast: "Settings saved"
    },

    de: {
      // Header & Navigation
      app_title: "LAN Remote",
      connecting: "Verbindung wird hergestellt...",
      disconnected: "Getrennt",
      search_placeholder: "Einstellungen suchen (Strg+K)...",
      tab_screen: "Bildschirm",
      tab_deck: "Deck",
      tab_system: "System",
      tab_settings: "Einstellungen",

      // Screen Stream & Toolbar
      input_mode_btn: "Eingabemodus (Touchpad / Direkt)",
      cursor_mode_btn: "Mausmodus umschalten (Physisch / Virtuell)",
      orientation_btn: "Bildschirmausrichtung (Quer-/Hochformat)",
      keyboard_btn: "Virtuelle Tastatur",
      fullscreen_btn: "Vollbild",
      ping_label: "Ping",
      monitors_label: "Bildschirm",
      btn_lmb: "LMT (Links)",
      btn_rmb: "RMT (Rechts)",
      btn_drag: "🔒 Ziehen (Drag)",
      btn_drag_active: "Gezogen (Drag)",
      type_text_placeholder: "Text eingeben und an PC senden...",
      send_btn: "Senden",
      trackpad_hint: "Touchpad: 1 Finger bewegen/tippen, 2 Finger scrollen, langes Drücken RMT, Drag-Taste zum Ziehen",
      right_click_toast: "Rechtsklick",
      drag_on_toast: "Ziehmodus aktiviert",
      drag_off_toast: "Ziehmodus beendet",
      text_sent_toast: "Text gesendet",
      input_mode_toast: "Eingabemodus: ",
      mode_trackpad: "Virtuelles Touchpad",
      mode_direct: "Direkte Berührung",
      cursor_mode_toast: "Zeigermodus: ",
      cursor_physical: "Physischer OS-Zeiger",
      cursor_virtual: "Virtueller Zeiger (Test)",
      orientation_toast: "Ausrichtung: ",
      orient_normal: "Standard",
      orient_landscape: "Querformat 90°",

      // Touch Deck Profiles
      deck_title: "Touch Deck",
      profile_all: "Alle",
      profile_media: "Medien",
      profile_server: "Server",
      profile_gaming: "Gaming",
      card_profile_label: "Kategorie-Profil",
      add_action_btn: "Aktion hinzufügen",
      edit_card_btn: "Bearbeiten",
      modal_add_title: "Aktion erstellen",
      modal_edit_title: "Aktion bearbeiten",
      card_title_label: "Titel der Schaltfläche",
      card_title_placeholder: "z.B. Ton stummschalten",
      card_type_label: "Aktionstyp",
      card_type_shortcut: "Tastenkombination (Shortcut)",
      card_type_command: "Konsolenbefehl / App-Start",
      card_type_media: "Mediensteuerung",
      card_type_power: "Energieverwaltung",
      card_type_system: "Systemfunktion",
      card_color_label: "Akzentfarbe",
      card_icon_label: "SVG-Symbol auswählen",
      save_btn: "Speichern",
      delete_btn: "Löschen",
      card_saved_toast: "Schaltfläche gespeichert",
      card_deleted_toast: "Schaltfläche gelöscht",
      no_cards_in_profile: "Noch keine Schaltflächen in diesem Profil",

      // System Dashboard & Hardware
      cpu_usage: "CPU-Auslastung",
      ram_memory: "Arbeitsspeicher (RAM)",
      disks_storage: "Datenträger & Speicher",
      free_space: "frei",
      active_window_title: "Aktives Host-Fenster:",
      master_volume: "Lautstärke",
      mute_btn: "Stumm",
      power_actions: "Energie & Anzeige",
      act_lock: "Sperren",
      act_screen_off: "Bildschirm aus",
      act_sleep: "Energiesparmodus",
      act_restart: "Neustart",
      act_shutdown: "Herunterfahren",
      confirm_power: "Möchten Sie diese Energieaktion wirklich ausführen?",

      // Task Manager & GPU
      taskmgr_title: "Windows Task-Manager",
      taskmgr_tab_procs: "Prozesse",
      taskmgr_tab_gpu: "GPU & Kerne",
      tasks_running: "Aufgaben aktiv",
      taskmgr_search_placeholder: "Prozess nach Name oder PID suchen...",
      sort_cpu: "Nach CPU %",
      sort_mem: "Nach Speicher (MB)",
      sort_name: "Nach Name",
      sort_pid: "Nach PID",
      refresh_btn: "Aktualisieren",
      new_task_btn: "Aufgabe ausführen...",
      run_task_prompt: "Programm oder Befehl eingeben (z.B. notepad, taskmgr, calc):",
      col_process: "Prozess",
      col_pid: "PID",
      col_cpu: "CPU",
      col_memory: "Speicher",
      col_user: "Benutzer",
      col_actions: "Aktionen",
      end_task_btn: "Task beenden",
      priority_label: "Priorität",
      task_terminated: "Prozess beendet",
      no_processes_found: "Keine Prozesse gefunden",

      // Clipboard History Sync
      clipboard_title: "Zwischenablage-Verlauf (Letzte 5)",
      clipboard_placeholder: "Text eingeben zum Senden oder Abrufen klicken...",
      clipboard_send_btn: "An Host senden",
      clipboard_get_btn: "Vom Host abrufen",
      clipboard_sent_toast: "Text in Host-Zwischenablage kopiert",
      clipboard_got_toast: "Text aus Host-Zwischenablage abgerufen",
      no_clipboard_items: "Zwischenablage ist leer",
      copy_btn: "Kopieren",
      paste_btn: "Host",

      // Command Runner
      cmd_runner_title: "Remote-Befehlsausführung",
      cmd_runner_placeholder: "Shell-Befehl eingeben (z.B. dir, ipconfig, docker ps)...",
      cmd_runner_btn: "Ausführen",
      cmd_ready: "Bereit für Befehle...",

      // Settings
      settings_search_placeholder: "Einstellungen, Themes, Audio, FPS, Qualität, Gesten suchen...",
      sec_appearance: "Erscheinungsbild & Theme",
      setting_theme_title: "Oberflächendesign",
      setting_theme_desc: "Farbpalette und Design wählen",
      theme_oled: "OLED Deep Black",
      theme_cyber: "Cyberpunk Neon",
      theme_slate: "Obsidian Slate",
      theme_glass: "Glassmorphism",
      setting_sound_title: "Taktile Audioklicks",
      setting_sound_desc: "Schalterklicks und Aktionsbestätigungen",

      sec_language: "Oberflächensprache",
      sec_language_desc: "Wählen Sie die Sprache für Navigation und Menüs",
      sec_stream: "Video & Bildschirm-Stream",
      sec_input: "Eingabe & Touch-Gesten",
      sec_deck: "Touch Deck & SVG-Symbole",
      sec_network: "Sicherheit & Lokales Netzwerk",

      setting_lang_title: "Systemsprache",
      setting_fps_title: "Bildwiederholrate (FPS)",
      setting_fps_desc: "Flüssigkeit des Bildschirm-Streams (15, 30 oder 60 FPS)",
      fps_15: "15 FPS (Batteriesparmodus)",
      fps_30: "30 FPS (Ausgewogen)",
      fps_60: "60 FPS (Sehr flüssig)",

      setting_quality_title: "Bildkomprimierungsqualität",
      setting_quality_desc: "JPEG-Komprimierungsgrad (niedriger = schnellerer Stream und weniger Latenz)",
      quality_low: "Niedrig (Schnell, ~20 KB/Frame)",
      quality_med: "Mittel (Optimal, ~50 KB/Frame)",
      quality_high: "Hoch (Scharfer Text, ~120 KB/Frame)",

      setting_scale_title: "Auflösungsskalierung",
      setting_scale_desc: "Herunterskalieren vor der Codierung",
      scale_50: "50% Skalierung (Hohe Geschwindigkeit)",
      scale_75: "75% Skalierung (Empfohlen)",
      scale_100: "100% Native Auflösung",

      setting_monitor_title: "Monitor auswählen",
      setting_monitor_desc: "Welcher physische Bildschirm gestreamt werden soll",

      setting_cursor_mode_title: "Mauszeigermodus",
      setting_cursor_mode_desc: "Physisch (steuert Windows-Zeiger) oder Virtuell (isoliert für Tests)",

      setting_input_mode_title: "Standard-Eingabemodus",
      setting_input_mode_desc: "Virtuelles Touchpad oder direkte Berührung",

      setting_sens_title: "Touchpad-Empfindlichkeit",
      setting_sens_desc: "Multiplikator für Fingerbewegungsgeschwindigkeit",
      sens_slow: "0.8x (Langsam & Präzise)",
      sens_norm: "1.0x (Normal)",
      sens_fast: "1.3x (Fast)",
      sens_vfast: "1.8x (Sehr schnell)",

      setting_invert_scroll_title: "2-Finger-Scrollen umkehren",
      setting_invert_scroll_desc: "Richtung beim Scrollen mit zwei Fingern umkehren",

      setting_haptic_title: "Haptisches Vibrationsfeedback",
      setting_haptic_desc: "Vibration beim Tippen und langen Drücken",

      setting_columns_title: "Touch Deck Spalten",
      setting_columns_desc: "Anzahl der Schaltflächen pro Zeile auf breiten Bildschirmen (max 4)",

      setting_svg_lib_title: "SVG-Symbolbibliothek & Upload",
      setting_svg_lib_desc: "Integrierte Symbole durchsuchen oder eigene .svg-Datei hochladen",
      upload_svg_btn: "SVG hochladen",

      setting_pin_title: "Zugriffs-PIN",
      setting_pin_desc: "Optionale PIN für die Verbindung (leer lassen für offenen LAN-Zugriff)",
      setting_port_title: "Webserver-Port",
      setting_port_desc: "HTTP-Port für Web-Dashboard und Streaming",
      setting_ips_title: "Aktive IP-Adressen & Mobiler QR-Code:",
      qr_scan_hint: "Mit der Handykamera scannen, um sich sofort zu verbinden:",
      copied_toast: "URL in die Zwischenablage kopiert!",
      settings_saved_toast: "Einstellungen gespeichert"
    }
  },

  t(key) {
    const langDict = this.translations[this.currentLang] || this.translations['en'];
    return langDict[key] || this.translations['en'][key] || key;
  },

  setLanguage(lang) {
    if (!this.translations[lang]) lang = 'en';
    this.currentLang = lang;
    localStorage.setItem('lan_remote_lang', lang);
    this.applyTranslations();
  },

  applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      const text = this.t(key);
      if (text) el.textContent = text;
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.dataset.i18nPlaceholder;
      const text = this.t(key);
      if (text) el.placeholder = text;
    });

    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.dataset.i18nTitle;
      const text = this.t(key);
      if (text) el.title = text;
    });

    document.querySelectorAll('.lang-selector-select').forEach(sel => {
      sel.value = this.currentLang;
    });
  }
};

window.I18n = I18n;
