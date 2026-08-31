# LAN Remote Control (Windows 10/11) 🚀

[![Platform](https://img.shields.io/badge/Platform-Windows%2010%20%7C%2011-0078d7.svg)](https://microsoft.com/windows)
[![Python](https://img.shields.io/badge/Python-3.10%2B-3776ab.svg)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115%2B-009688.svg)](https://fastapi.tiangolo.com)
[![Direct3D 11](https://img.shields.io/badge/Direct3D%2011-Hardware%2060%20FPS-green.svg)](https://learn.microsoft.com/windows/uwp/audio-video-camera/screen-capture)
[![WASAPI](https://img.shields.io/badge/WASAPI-Audio%20Loopback-blue.svg)](https://learn.microsoft.com/windows/win32/coreaudio/wasapi)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Универсальный, сверхбыстрый веб-центр удаленного управления компьютером на базе **FastAPI**, **Direct3D 11 Hardware Screen Capture**, **WASAPI Audio Loopback** и **PWA (Progressive Web App)** для смартфонов, планшетов и браузеров по локальной сети и VPN.

---

## 🌟 Ключевые возможности

### 🎮 1. Стриминг экрана и управление в 60 FPS
* **Direct3D 11 GPU Capture (Windows.Graphics.Capture API)** — нулевая задержка захвата (`0.0 ms`) напрямую из видеопамяти (аналогично OBS Studio).
* **SIMD AVX2 JPEG кодирование** — сверхбыстрое сжатие кадра за 2–4 мс через `simplejpeg`.
* **Аппаратная фиксация разрешения (1080p Lock)** — плавная трансляция 2K и 4K мониторов без просадок FPS.
* **Режим ожидания с 0% CPU/GPU** — кнопка паузы освобождает 100% ресурсов при ненадобности.
* **Универсальный сенсорный геймпад** — адаптивный D-Pad, кнопки A/B/X/Y и триггеры для управления играми и медиа.
* **Виртуальный трекпад и мышь** — поддержка мультитач, прокрутки двумя пальцами, зажатия Drag и правого клика.

### 🔊 2. Системный звук ПК на телефон (Live Audio Streaming)
* Прямой захват всего звука Windows через **WASAPI Loopback (Realtek / Speakers)** в качестве `48 000 Гц Stereo 16-bit PCM`.
* Воспроизведение через **Web Audio API** в браузере мобильного устройства без задержек.

### 🎛️ 3. Touch Deck (Интерактивная панель макросов)
* Кастомные плитки макросов с поддержкой Hotkeys, запуска программ, медиа-кнопок, громкости, питания и скриптов.
* Категории: *Media, Windows, Gaming, Work, Audio Knobs*.
* Интегрированная библиотека из **43 векторных SVG-иконок** (чистый векторный дизайн без эмодзи).

### 📊 4. Диспетчер задач Windows 11 в браузере
* Мониторинг всех запущенных процессов, потребления CPU, памяти и пользователей.
* Управление процессами: Завершить (Kill), сменить приоритет (Realtime, High, Normal, Idle).
* Запуск новых процессов (`Run Task...`).
* **Монитор GPU:** раздельная загрузка 3D Core, Video Decode, Video Encode, VRam и температура видеокарты.

### 📁 5. Файловый проводник (File Explorer)
* Быстрый доступ ко всем дискам (`C:\`, `D:\`, `H:\` и сетевым ресурсам).
* Загрузка и скачивание файлов, удаление, навигация в стиле проводника Windows 11.

### 📋 6. Буфер обмена и уведомления
* Живая история последних 5 записей буфера обмена с возможностью копирования в 1 клик.
* Отправка нативных всплывающих уведомлений (Windows Toast) со смартфона на ПК.
* Индикатор уровня заряда батареи ноутбука/ИБП (`psutil.sensors_battery`) в шапке приложения.

---

## 🚀 Быстрый старт

### Вариант 1: Запуск из исходного кода (Python)

```bash
# 1. Клонирование репозитория
git clone https://github.com/yksyse/lan-remote.git
cd lan-remote

# 2. Установка зависимостей
pip install -r requirements.txt

# 3. Запуск сервера
python server.py
```

Сервер автоматически выведет доступные URL в вашей локальной сети:
```text
LAN Remote Control Server Ready!
Local URL:   http://localhost:8080
Network URL: http://192.168.1.240:8080
```

### Вариант 2: Запуск автономного EXE бинарника

Скомпилируйте или запустите `LAN-Remote.exe`:
```bash
# Сборка единого бинарника:
pyinstaller --noconfirm LAN-Remote.spec
```
Исполняемый файл появится в папке `dist/LAN-Remote.exe`. Он не требует установленного Python и запускается в один клик.

---

## 📱 Использование на телефоне (PWA)

1. Подключите телефон к тому же Wi-Fi роутеру или Radmin VPN.
2. Откройте в браузере на телефоне адрес (например, `http://192.168.1.240:8080` или отсканируйте QR-код в веб-интерфейсе).
3. Нажмите **«Добавить на главный экран»** (Add to Home Screen), чтобы запускать как нативное полноэкранное приложение без адресной строки браузера.

---

## 🛠️ Архитектура проекта

```
lan-remote/
├── core/
│   ├── audio_streamer.py    # Захват системного звука WASAPI Loopback
│   ├── screen_streamer.py   # Direct3D 11 & MSS 60 FPS захват экрана
│   ├── input_driver.py      # Эмуляция мыши, трекпада и клавиатуры
│   ├── system_manager.py    # Метрики CPU, GPU, батареи, буфера обмена
│   ├── task_manager.py      # Диспетчер задач и управление процессами
│   ├── file_manager.py      # Файловый проводник дисков
│   └── config_manager.py    # Менеджер профилей и настроек
├── static/
│   ├── index.html           # SPA интерфейс приложения
│   ├── css/style.css        # Темы (OLED, Cyberpunk, Slate, Glass)
│   ├── js/
│   │   ├── stream.js        # Декодер экрана и обработчик тачпада
│   │   ├── audio.js         # Web Audio API PCM плеер
│   │   ├── deck.js          # Touch Deck макросы
│   │   ├── taskmgr.js       # Диспетчер задач
│   │   ├── files.js         # Проводник файлов
│   │   ├── system.js        # Системные действия и буфер
│   │   └── i18n.js          # Локализация (RU, EN, DE)
│   └── icons/               # 43 SVG векторных иконок
├── server.py                # FastAPI & WebSocket сервер
├── requirements.txt         # Зависимости Python
├── LAN-Remote.spec          # PyInstaller спецификация сборки
└── LICENSE                  # MIT License
```

---

## 📄 Лицензия

Проект распространяется под лицензией **MIT**. Подробности в файле [LICENSE](LICENSE).
