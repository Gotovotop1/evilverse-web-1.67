# Студия: аккаунты и автопостинг — как включить

Код уже на сайте: `app/api/studio/*` и `lib/studio/*`. Пока не заданы переменные из шага 1, всё выключено: студия работает как раньше, кнопки «Войти» и блока «Автопостинг» нет.

Как это работает:

```
Студия (studio.evilverse.lol)                        Сайт (shop.evilverse.lol)
 вход / подключение соцсетей ───────────────────────▶ /api/studio/auth/*, /connect/*, /oauth/*/callback
 ролик собран в браузере ──▶ Vercel Blob (напрямую) ─▶ /api/studio/videos (запись о ролике)
 «выложить в 18:00, TikTok + Shorts + Reels» ───────▶ /api/studio/posts  → таблица studio_posts
                              раз в 10 минут: GitHub Actions ─▶ /api/studio/cron → публикация через API платформ
```

Ключи доступа к соцсетям хранятся в базе только зашифрованными (AES-256-GCM, ключ из `STUDIO_SECRET`). Таблицы `studio_*` создаются сами при первом запросе и ничего старого не трогают.

---

## 1. Основное (Vercel → проект сайта → Settings → Environment Variables)

| Переменная | Значение |
|---|---|
| `STUDIO_SECRET` | случайная строка из 48+ букв и цифр (генератор паролей). **Не меняй потом**: иначе сохранённые подключения соцсетей перестанут расшифровываться |
| `STUDIO_URL` | `https://studio.evilverse.lol` |
| `STUDIO_API_URL` | `https://shop.evilverse.lol` |
| `CRON_SECRET` | ещё одна случайная строка 40+ символов |

`DATABASE_URL` уже есть — используется та же база Postgres.

**Хранилище роликов:** Vercel → проект сайта → **Storage → Create Storage → Blob** (Public) → подключить к проекту. Новые хранилища добавляют переменные `BLOB_STORE_ID` и `BLOB_WEBHOOK_PUBLIC_KEY` (загрузка подписывается через OIDC Vercel, постоянного ключа нет). Старые — `BLOB_READ_WRITE_TOKEN`. Сайт понимает оба варианта. Бесплатного лимита хватит: ролик живёт в хранилище только до публикации и ещё сутки.

**Расписание (раз в 10 минут):** GitHub → репозиторий сайта → **Settings → Secrets and variables → Actions → New repository secret**:
- `STUDIO_CRON_URL` = `https://shop.evilverse.lol/api/studio/cron`
- `CRON_SECRET` = то же значение, что в Vercel

Файл `.github/workflows/studio-cron.yml` уже в репозитории. GitHub иногда запускает его с опозданием на 5–15 минут. Если нужна точность до минуты, используй cron-job.org: адрес тот же, заголовок `Authorization: Bearer <CRON_SECRET>`, каждые 5 минут. Пока студия открыта, она сама подталкивает публикации.

После изменения переменных — **Redeploy**.

## 2. Вход в студию (любой из способов)

- **Google** — тот же ключ, что для YouTube (шаг 3). Отдельно ничего не нужно.
- **Discord** — [discord.com/developers/applications](https://discord.com/developers/applications) → New Application «EvilVerse Studio» (иконка — логотип студии) → **OAuth2**:
  - Redirects → Add: `https://shop.evilverse.lol/api/studio/oauth/discord/callback` → Save;
  - Client ID и Client Secret (Reset Secret) → в Vercel: `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`.
  Студия берёт только имя, аватар и подтверждённую почту (scopes `identify email`), ключ Discord сразу отзывает. Проверка приложения у Discord не нужна.
- **Telegram** — используется бот из `TELEGRAM_BOT_TOKEN` (уже есть). В @BotFather: `/setdomain` → выбрать этого бота → `studio.evilverse.lol`. В Vercel: `TELEGRAM_LOGIN_BOT` = имя бота без `@`.
- **Почта** — [resend.com](https://resend.com): добавить домен `evilverse.lol` (DNS-записи в Namecheap), создать API-ключ. В Vercel: `RESEND_API_KEY` и `STUDIO_MAIL_FROM` = `EvilVerse Studio <studio@evilverse.lol>`.

## 3. YouTube Shorts (Google Cloud)

1. [console.cloud.google.com](https://console.cloud.google.com) → создать проект «EvilVerse Studio».
2. **APIs & Services → Library → YouTube Data API v3 → Enable.**
3. **OAuth consent screen** (Google Auth Platform):
   - тип External;
   - название EvilVerse Studio, логотип, почта поддержки;
   - домены: `evilverse.lol`;
   - Privacy Policy: `https://studio.evilverse.lol/privacy.html`;
   - Terms: `https://studio.evilverse.lol/terms.html`;
   - scopes: `openid`, `email`, `profile`, `.../auth/youtube.upload`, `.../auth/youtube.readonly`.
4. **Credentials → Create credentials → OAuth client ID → Web application:**
   - Authorized redirect URI: `https://shop.evilverse.lol/api/studio/oauth/google/callback`.
5. В Vercel: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
6. Пока приложение в режиме Testing, войти могут только добавленные **Test users** (до 100 человек). Ролики, загруженные непроверенным приложением, YouTube делает приватными.
7. Для всех пользователей:
   - **Publish app → Verification** (нужно демо-видео: вход → подключение канала → публикация);
   - затем [аудит YouTube API](https://support.google.com/youtube/contact/yt_api_form) — снимает приватность и позволяет попросить квоту больше ~6 загрузок в день на всё приложение.
   - После этого в Vercel: `YOUTUBE_AUDITED=1` — пропадёт пометка «тестовый режим».

## 4. TikTok

1. [developers.tiktok.com](https://developers.tiktok.com) → Manage apps → Connect an app (тип Web).
2. Заполнить:
   - название, иконку, категорию;
   - Terms: `https://studio.evilverse.lol/terms.html`;
   - Privacy: `https://studio.evilverse.lol/privacy.html`;
   - Web/Desktop URL: `https://studio.evilverse.lol`.
3. **Products:** добавить **Login Kit** и **Content Posting API** (включить **Direct Post**).
4. **Scopes:** `user.info.basic`, `video.upload`, `video.publish`.
5. **Login Kit → Redirect URI:** `https://shop.evilverse.lol/api/studio/oauth/tiktok/callback`.
6. В Vercel: `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`.
7. До проверки TikTok:
   - работают только аккаунты, добавленные как Target users в Sandbox;
   - публикации идут только как «Только я» (студия это показывает).
8. **Submit for review**: нужно демо-видео. В студии уже есть всё, что требует TikTok: имя аккаунта, выбор «кто увидит» без значения по умолчанию, галочка согласия и ссылка на Music Usage Confirmation.
9. После одобрения Direct Post в Vercel: `TIKTOK_AUDITED=1`.

## 5. Instagram Reels (Meta)

1. [developers.facebook.com](https://developers.facebook.com) → My Apps → Create app (тип Business).
2. Add product **Instagram → API setup with Instagram login**.
3. **Business login settings:**
   - OAuth redirect URI: `https://shop.evilverse.lol/api/studio/oauth/instagram/callback`;
   - Deauthorize callback: `https://shop.evilverse.lol/api/studio/meta`;
   - Data deletion request: `https://shop.evilverse.lol/api/studio/meta`.
4. **Permissions:** `instagram_business_basic`, `instagram_business_content_publish`.
5. В Vercel: `INSTAGRAM_APP_ID` и `INSTAGRAM_APP_SECRET` — это **Instagram app ID / secret** из раздела Instagram, а не ID Facebook-приложения.
6. Работает только с профессиональными аккаунтами Instagram («Автор» или «Бизнес»). До App Review — только для аккаунтов, добавленных в Roles → Instagram Testers.
7. **App Review** (нужны Business verification и демо-видео) → после одобрения в Vercel: `INSTAGRAM_APPROVED=1`.

## 6. Проверка

1. Открой studio.evilverse.lol: справа вверху появится «Войти». Если нет — проверь `STUDIO_SECRET` и сделай Redeploy.
2. Войди, подключи соцсети. В шаге 3 включи «Автопостинг», выбери «Только я» для TikTok и YouTube «Только я», собери 1 ролик.
3. В разделе «Мои публикации» статус сменится на «выложено» со ссылкой. Если «ошибка» — там же написана причина.
4. Вручную проверить планировщик: `curl -H "Authorization: Bearer <CRON_SECRET>" https://shop.evilverse.lol/api/studio/cron`.

## Лимиты платформ, которые стоит знать
- **YouTube: отложенный выход делает сам YouTube.** Если публичный ролик запланирован на потом, сайт загружает его сразу (при планировании или при ближайшем запуске планировщика) приватным с `publishAt` — ролик виден в YouTube Studio во вкладке «Запланированные» и выходит ровно в назначенное время, без нашего планировщика. Статус в студии — «уже в YouTube, выйдет сам» (`uploaded`); после времени выхода он становится «выложено». Отменить, перенести или изменить описание такого ролика можно только в YouTube Studio (у студии доступ только на загрузку). Квота YouTube тратится в момент загрузки. Если ранняя загрузка не удалась, выбранное время не сдвигается — ролик попробует выйти как обычно, в своё время.
- **TikTok и Instagram** отложенного выхода в API не имеют — для них ролик ждёт на сайте, и точность зависит от планировщика (GitHub Actions бывает редким — для точности до 5 минут используй cron-job.org, см. выше).

- **YouTube:** по умолчанию квота ≈ 6 загрузок в сутки на всё приложение (на всех пользователей). При исчерпании студия сама переносит публикацию на 6 часов позже. Увеличение — через аудит YouTube API.
- **TikTok:** у автора есть дневной лимит публикаций через API. При ограничении студия переносит публикацию на сутки.
- **Instagram:** около 50 публикаций в сутки на аккаунт.
- Публикация повторяется до 5 раз при временных ошибках. Если доступ отозван, соцсеть помечается «нужно переподключить».

## Проверено на стенде

На поддельных API всех трёх платформ (локальный Postgres, сайт в режиме разработки):
- вход по почте, Google, Discord и Telegram, в том числе отклонение поддельных подписей и привязка Discord/Google к аккаунту с той же подтверждённой почтой;
- оборванная посреди загрузки публикация не повторяется сама (нет дублей), а помечается «проверь и нажми „Повторить“»;
- подключение трёх соцсетей, одноразовые билеты;
- загрузка роликов и пачка из 2 роликов из студии;
- публикация в TikTok (загрузка файла кусками, проверка статуса), YouTube (resumable upload, #Shorts, теги) и Instagram (контейнер → обработка → media_publish → ссылка);
- перенос при исчерпании квоты, отмена, «выложить сейчас», повтор;
- шифрование ключей в базе, отключение соцсети и удаление аккаунта.

С настоящими API платформ код ещё не запускался: для этого нужны ключи из шагов 3–5.
