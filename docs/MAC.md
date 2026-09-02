# Mac mini як сервер бети

Розгортання на Apple Silicon: що ставити, як не дати машині заснути, і як
причепити домен без публічної IP-адреси.

Загальне — у `docs/DEPLOY.md`. Про OVHcloud — у `docs/OVHCLOUD.md`. Тут лише те,
що на macOS робиться інакше, і кожен такий пункт має причину, а не «на Mac
прийнято так».

**Нічого з цього не перевірено на живому Mac.** Перевірити можу тільки те, що
накладка `docker-compose.mac.yml` коректно зливається з прод-конфігом і що
застосунок читає `OLLAMA_HOST` зі змінної (`packages/llm/ollama.ts:24`). Решта —
команди, які треба виконати й подивитись на результат. Позначки «перевірте» нижче
стоять там, де це особливо варто зробити.

---

## 1. Чому модель не в контейнері

Docker Desktop на macOS — це Linux-VM, і Metal туди не прокидається. Контейнер із
Ollama рахував би на CPU: приблизно вп'ятеро повільніше, тобто 6-секундна правка
секції стає півхвилинною, а редактором із такою затримкою просто перестають
користуватися.

Тож Ollama ставиться нативно, а база й застосунок лишаються в Docker — той самий
`Dockerfile`, що поїде потім на Linux, якщо бета переросте цю машину.

## 2. Встановлення

```bash
# Homebrew, контейнерний рушій, Ollama, cloudflared
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew install --cask orbstack ollama-app
brew install cloudflared

# Модель
ollama pull qwen3:4b
ollama run qwen3:4b --verbose   # подивіться eval rate; орієнтир — 40-70 ток/с
```

Рушій — **OrbStack**, а не Docker Desktop: легший, швидше стартує після
перезавантаження, менше пам'яті. Дає ті самі `docker` і `docker compose`
(у `/usr/local/bin/docker`). `docker-compose.mac.yml` уже має `extra_hosts` для
`host-gateway`, тож `host.docker.internal` працює і тут. Docker Desktop теж
підійшов би без змін.

`--verbose` не для краси. Усі числа в `docs/DEPLOY.md` виміряні на RTX 3050 з
61,6 ток/с. Якщо ваш результат у тому ж діапазоні — таблиця пропускної здатності
переноситься без перерахунку. Заміряно на цьому M2: **52 ток/с**, той самий
діапазон.

### Ollama слухає мережу і стартує сама

Контейнер із застосунком дістає хост за адресою мосту, не за `127.0.0.1`, тож
Ollama має слухати `0.0.0.0`. І вона має підніматися без меню-бару — сервером
керує LaunchAgent, а не застосунок:

```bash
cp deploy/launchd/ua.grantoid.ollama.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/ua.grantoid.ollama.plist
```

Плейлист задає `OLLAMA_HOST=0.0.0.0` і `KeepAlive`. Меню-барний застосунок Ollama
тоді **не** тримайте в елементах входу — двоє на одному порту не вживуться.

**Ціна `0.0.0.0`**: Ollama не має автентифікації взагалі й тепер відповідає всім
у локальній мережі. Закрийте 11434 у брандмауері macOS (System Settings →
Network → Firewall → Options → додайте `/opt/homebrew/bin/ollama`, заборонте
вхідні), або переконайтесь, що мережа, в якій стоїть машина, вам підконтрольна.

### Запуск

```bash
cp .env.example .env
# заповніть POSTGRES_PASSWORD і APP_BASE_URL (https://grantoid.in.ua)

docker compose -f docker-compose.prod.yml -f docker-compose.mac.yml up -d
docker compose -f docker-compose.prod.yml -f docker-compose.mac.yml exec app npx prisma migrate deploy
docker compose -f docker-compose.prod.yml -f docker-compose.mac.yml exec app npx tsx scripts/setup-sources.ts
```

`up -d` піднімає лише `db` і `app`: накладка `docker-compose.mac.yml` ховає
сервіс `ollama` у невибраний профіль, бо на macOS модель працює на хості
(розділ 1), а контейнерна `ollama` слухала б той самий порт усередині мережі
compose і рахувала б на CPU — симптом не помилка, а просто повільна система.

## 3. Машина не повинна засинати

```bash
sudo pmset -a sleep 0 disksleep 0 powernap 0 displaysleep 10
sudo pmset -a autorestart 1      # піднятися саму після зникнення живлення
```

І вимкніть автоматичні оновлення macOS: System Settings → General → Software
Update → Automatic Updates → усе, що встановлює й перезавантажує, вимкнути.
Оновлення, яке перезавантажить машину о третій ночі, — це не оновлення, це збій.

## 4. FileVault: рішення, яке треба ухвалити свідомо

На Apple Silicon із увімкненим FileVault машина після зникнення живлення
підніметься **до вікна входу й не розблокує диск**. Ні Docker, ні launchd-агенти,
ні Ollama не стартують, доки хтось не введе пароль руками. `fdesetup authrestart`
рятує лише при плановому перезавантаженні.

За два-три місяці бети блекаут станеться майже напевно, і це означає лежачий
сервіс до вашого приходу.

**Рекомендація: на цій машині FileVault вимкнути** (`sudo fdesetup disable`),
увімкнути автоматичний вхід (System Settings → Users & Groups → Automatically log
in as), а OrbStack поставити в елементи входу (Settings → Start at login). Тоді
після відновлення живлення сесія користувача піднімається сама, за нею OrbStack,
за ним `restart: unless-stopped` у compose і LaunchAgent'и розкладу. Саме тому
розклад — це LaunchAgent'и, а не root-демони: сокет OrbStack живе в сесії
користувача, і автологін — те, що робить її завжди присутньою.

Ціна цього — незашифрований диск на машині, де лежать статути організацій. Тому:

- машина стоїть у приміщенні, до якого є фізичний контроль;
- **резервні копії шифруються** (розділ 7), бо саме вони їздять назовні.

Якщо фізичного контролю немає — лишайте FileVault і змиріться, що після кожного
блекауту сервіс піднімає людина.

```bash
fdesetup status    # перевірте, що стан саме той, який ви обрали
```

## 5. Домен

`grantoid.in.ua` віддається через Cloudflare Tunnel. Застосунок слухає лише
`127.0.0.1:3000`, `cloudflared` тримає вихідне з'єднання до Cloudflare, і проброс
портів на роутері не потрібен зовсім. Це саме й закриває питання CGNAT: тунель
іде назовні, вхідних з'єднань немає, а звіряти WAN-IP роутера з `curl ifconfig.me`
більше ні до чого.

### Спершу: зона має обслуговуватися Cloudflare

Зараз `grantoid.in.ua` стоїть на DNS реєстратора (`imena.ua`). `cloudflared tunnel
route dns` і проксі працюють лише коли NS домену вказують на Cloudflare.

1. Cloudflare → Add a site → `grantoid.in.ua`, план Free.
2. У панелі реєстратора — розділ **DNS-серверів**, не редактор записів — заміни
   NS на пару, яку видав Cloudflare.
3. Дочекайся статусу Active (кілька хвилин — доба).

Пошта на домені не використовується, тож зі старої зони переносити нема чого:
Cloudflare підхопить лише ті записи, які створить тунель. Стара парковка на
`194.28.173.2` (записи `@`, `www`, `mail`, `ftp`) при цьому відмирає — це
навмисно.

### Тунель

```bash
cloudflared tunnel login
cloudflared tunnel create grantoid
cloudflared tunnel route dns grantoid grantoid.in.ua
```

Останній рядок створює в зоні проксований CNAME `grantoid.in.ua` →
`<UUID>.cfargotunnel.com`.

`cloudflared tunnel login` кладе `~/.cloudflared/cert.pem`, `create` — файл
облікових даних `~/.cloudflared/<UUID>.json`.

Служба працює **у файловому режимі**, як root-демон. Не `cloudflared service
install` без аргументів (створює plist без `tunnel run`) і не токен-режим
(`service install <token>` ігнорує локальний `config.yml` — ingress тоді лише в
дашборді). Конфіг і облікові дані кладуться в `/etc/cloudflared/`, а plist
запускає `cloudflared --config /etc/cloudflared/config.yml tunnel run`:

```bash
sudo mkdir -p /etc/cloudflared
sudo cp ~/.cloudflared/<UUID>.json /etc/cloudflared/
sudo cp deploy/cloudflared/config.yml /etc/cloudflared/config.yml      # правит UUID усередині
sudo cp deploy/cloudflared/com.cloudflare.cloudflared.plist /Library/LaunchDaemons/
sudo launchctl bootstrap system /Library/LaunchDaemons/com.cloudflare.cloudflared.plist
```

`cloudflared tunnel info grantoid` має показати активні з'єднання. Root-демон, а
не LaunchAgent: тунель — мережева інфраструктура, йому не потрібна сесія
користувача, лише `127.0.0.1:3000`, який OrbStack публікує на loopback хоста
незалежно від входу.

Порти відкривати не треба взагалі. Сертифікат теж не ваш клопіт.

### www → без www

Тунель не редіректить, а застосунок не дивиться на `Host`. Тому `www` зводиться
на голий домен на боці Cloudflare:

- DNS: CNAME `www` → `grantoid.in.ua`, proxied;
- Rules → Redirect Rules: `Host` дорівнює `www.grantoid.in.ua` → 301 на
  `https://grantoid.in.ua` + concat(URI path).

### Що варто розуміти

TLS термінується в Cloudflare: вони бачать трафік у відкритому вигляді, включно
із завантаженими статутами. D1 це формально не порушує — обіцянка стосується
того, що документи не йдуть до чужого AI-сервісу. Але продукт, чия центральна
обіцянка — приватність документів, каже про це в `/pryvatnist` окремим абзацом, а
не мовчить. Правити той абзац, якщо схема доставки зміниться.

Якщо колись з'явиться справжня публічна адреса — проброс 80/443 і Caddy з
`docs/OVHCLOUD.md` розділ 6, і між вами та користувачем немає нікого.

### APP_BASE_URL

```
APP_BASE_URL=https://grantoid.in.ua
```

З цього будується кожне посилання в щотижневому листі, зокрема відписка.

## 6. Розклад

macOS має cron, але рідний спосіб — launchd. Готові плейлисти — у
`deploy/launchd/`, це **LaunchAgent'и**: вони живуть у `~/Library/LaunchAgents/`
і виконуються в сесії користувача, де є сокет OrbStack (розділ 4). Root-демон до
того сокета не дістався б.

```bash
cp deploy/launchd/ua.grantoid.nightly.plist ~/Library/LaunchAgents/
cp deploy/launchd/ua.grantoid.digest.plist  ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/ua.grantoid.nightly.plist
launchctl load ~/Library/LaunchAgents/ua.grantoid.digest.plist
```

`nightly` — конвеєр о 04:00, `digest` — розсилка в понеділок о 10:00. Шляхи в
плейлистах абсолютні до `~/grantoid` і `/usr/local/bin/docker`; правити обидва,
якщо щось переїде. Логи — у `~/Library/Logs/grantoid-*.log`.

Один рядок `npm run nightly`, а не чотири окремі етапи: порядок етапів
обов'язковий, і рознесення їх по годинах означає вгадувати, скільки триватиме
витягування (`docs/DEPLOY.md` розділ 5).

## 7. Резервні копії

Ноутбук чи mini — байдуже: копія на тому самому диску не є копією. Диск помирає
цілком.

```bash
docker compose -f docker-compose.prod.yml -f docker-compose.mac.yml exec -T db \
  pg_dump -U grant grant_assistant | gzip > /Volumes/backup/db-$(date +%F).sql.gz

docker run --rm -v grant-assistant_storage:/data -v /Volumes/backup:/backup \
  alpine tar czf /backup/storage-$(date +%F).tar.gz -C /data .
```

Обидві разом, третім LaunchAgent'ом — `deploy/launchd/ua.grantoid.backup.plist`
викликає `deploy/backup.sh` о 05:30, після нічного конвеєра. База без файлів — це
посилання на документи, які не завантажуються; файли без бази — набір файлів без
доступу.

Якщо FileVault ви вимкнули (розділ 4), **зашифруйте самі копії** перед тим, як
вони поїдуть кудись за межі приміщення: `age`, `gpg`, або зашифрований том на
зовнішньому диску.

## 8. Живлення

У mini немає батареї. Кожен блекаут — це жорстке знеструмлення на працюючому
Postgres, і хоч WAL таке переживає, повторювати це щотижня не варто.

ДБЖ на 15–30 хвилин коштує €60–100 і має живити **і машину, і роутер**. Разом із
`pmset autorestart 1` це закриває короткі відключення повністю.

Довгі не закриває нічого: якщо знеструмлено обладнання провайдера, сайт лежить
незалежно від вашого ДБЖ. Для бети на тридцять організацій це прийнятно, і краще
сказати це вголос зараз, ніж пояснювати потім.

## 9. Оновлення

```bash
./deploy/update.sh
```

`git fetch` + `reset --hard origin/main`, пересборка образу, `prisma migrate
deploy` **перед** заміною контейнера (міграція, що впала, лишає стару версію
робочою), `up -d`, і чекання, доки застосунок відповість на `127.0.0.1:3000`.
Падає — друкує команду відкату. Автодеплою на цю машину немає: тунель іде
назовні, вхідного SSH нема, а `SSH_DEPLOY` у CI лишається `false`.

## 10. Перевірка, що воно справді працює

```bash
docker compose -f docker-compose.prod.yml -f docker-compose.mac.yml \
  run --rm app npx tsx scripts/preflight.ts   # зелений на сервері, на відміну від машини розробки
```

І окремо — те, чого жоден скрипт не перевірить:

- [ ] `sudo reboot`, і за п'ять хвилин сайт відповідає **без вашої участі**
- [ ] витягнути шнур із розетки, вставити назад — те саме
- [ ] `ollama run qwen3:4b --verbose` під навантаженням не скидає швидкість утричі
- [ ] нічний прогін відпрацював повний цикл, у `~/Library/Logs/grantoid-nightly.log` немає помилок
- [ ] резервна копія **відновлена** на порожню базу хоча б раз
- [ ] 11434 недоступний з іншої машини в мережі

Перший пункт — головний. Усе інше в цьому документі існує заради нього.
