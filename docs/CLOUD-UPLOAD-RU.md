# API Sapphire: загрузка файлов и авторизация

**Только начинаете?** Пошагово: что установить, что запускать и куда заходить в браузере — в [ПОШАГОВАЯ-ИНСТРУКЦИЯ-RU.md](ПОШАГОВАЯ-ИНСТРУКЦИЯ-RU.md).

Базовый URL ниже — `https://ваш-домен.ru` (локально `http://127.0.0.1:5000`).

---

## Как получить сессию (простыми словами)

**Сессия — это не отдельный токен, который нужно копировать из ответа.** Это **файл cookie**, который сервер **сам присылает** в заголовке ответа при успешном логине:

```http
Set-Cookie: session=...; HttpOnly; ...
```

**Что сделать вам:**

1. Отправить **`POST /api/auth/login`** с логином и паролем (см. ниже).
2. **Сохранить cookie**, которую вернул сервер, и **подставлять её во все следующие запросы** (`/upload`, `/tracks`, …).

Как именно «сохранить» — зависит от программы:

| Где вы вызываете API | Что делать |
|----------------------|------------|
| **Браузер** (сайт уже открыт, вы нажали «Войти») | Ничего: браузер сам хранит cookie и шлёт её с `fetch(..., { credentials: "same-origin" })`. |
| **curl** | Флаг **`-c cookies.txt`** при логине сохраняет cookie в файл; дальше **`-b cookies.txt`** на каждый запрос. |
| **Python `requests`** | Один раз `s = requests.Session()`, затем `s.post(.../login)`, потом все запросы через **`s.post` / `s.get`** — сессия сама хранит cookie. |
| **Postman / Insomnia** | Включить сохранение cookies для запроса логина или вручную скопировать cookie `session` из ответа в заголовок следующего запроса: `Cookie: session=...`. |

Если после логина следующий запрос снова даёт **401**, значит cookie **не отправилась** (другой домен, нет `credentials`, забыли `-b` / не тот `Session`).

---

## 1. Вход (получить сессию)

**`POST /api/auth/login`**

Тело — JSON:

```json
{ "username": "admin", "password": "ваш_пароль" }
```

Пример **curl** (cookie сохраняется в файл `cookies.txt`):

```bash
curl -c cookies.txt -X POST https://ваш-домен.ru/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"admin\",\"password\":\"admin\"}"
```

Дальше подставляйте **`-b cookies.txt`** во все запросы к API.

---

## 2. Загрузка трека (файл)

**`POST /upload`**

- Формат: **`multipart/form-data`**
- Поле файла: **`file`** (именно такое имя)
- Допустимые расширения: **`.mp3`**, **`.wav`**
- Лимит размера: **25 МБ** (настраивается в коде)

Ответ **201**: JSON с метаданными трека (`id`, `title`, `artist`, `audio_url`, …).

### curl

```bash
curl -b cookies.txt -X POST https://ваш-домен.ru/upload \
  -F "file=@/путь/к/треку.mp3"
```

### Python (requests)

```python
import requests

s = requests.Session()
s.post(
    "https://ваш-домен.ru/api/auth/login",
    json={"username": "admin", "password": "admin"},
)
r = s.post(
    "https://ваш-домен.ru/upload",
    files={"file": open("track.mp3", "rb")},
)
r.raise_for_status()
track = r.json()
print(track["id"], track["audio_url"])
```

### JavaScript (fetch, из браузера после входа на сайте)

Если пользователь уже залогинен на том же origin, **cookie уйдёт сама**:

```javascript
const form = new FormData();
form.append("file", fileInput.files[0]);

const res = await fetch("/upload", {
  method: "POST",
  body: form,
  credentials: "same-origin",
});
const track = await res.json();
```

---

## 3. Полезные методы рядом

| Метод | Назначение |
|--------|------------|
| `GET /api/auth/session` | Проверка, залогинен ли пользователь |
| `POST /api/auth/logout` | Выход |
| `GET /tracks` | Список треков текущего пользователя |
| `DELETE /tracks/<id>` | Удалить трек |
| `POST /playlists` | Создать плейлист (JSON: `name`, опционально `cover_url`) |
| `POST /playlists/<id>/tracks` | Добавить трек в плейлист (JSON: `track_id`) |

Плейлисты — это **метаданные в БД**, не ZIP-архивы: сначала загружаете файлы через **`/upload`**, затем добавляете `track_id` в плейлист.

---

## 4. Окружение сервера (кратко)

| Переменная | Зачем |
|------------|--------|
| `FLASK_SECRET_KEY` | Секрет сессий (обязательно свой в продакшене) |
| `DATABASE_URL` | PostgreSQL; без неё используется SQLite `instance/sapphire.db` |
| `SAPPHIRE_BOOTSTRAP_PASSWORD` | Пароль первого пользователя `admin` при пустой БД |
| `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, при необходимости `S3_ENDPOINT` | Файлы в S3/R2; иначе — папка `uploads/` на сервере |

Регистрация через API: **`POST /api/auth/register`** только если задано **`SAPPHIRE_ALLOW_REGISTRATION=true`**.

---

## 5. Ошибки

- **401** без сессии — сначала `POST /api/auth/login`.
- **400** — нет поля `file`, пустое имя или не mp3/wav.
- **413** — файл больше лимита.
