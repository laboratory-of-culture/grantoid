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
# Homebrew, Docker, Ollama
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew install --cask docker ollama
brew install cloudflared

# Модель
ollama pull qwen3:4b
ollama run qwen3:4b --verbose   # подивіться eval rate; орієнтир — 40-70 ток/с
```

`--verbose` тут не для краси. Усі числа в `docs/DEPLOY.md` виміряні на RTX 3050 з
61,6 ток/с. Якщо ваш результат у тому ж діапазоні — таблиця пропускної здатності
переноситься без перерахунку. Якщо вдвічі менший — нічне вікно вдвічі довше, і
краще знати це до запуску.

### Ollama має слухати не тільки loopback

За замовчуванням вона прив'язується до `127.0.0.1`, а контейнер із застосунком
живе в іншій мережі й туди не дістанеться.

```bash
launchctl setenv OLLAMA_HOST "0.0.0.0"
# перезапустіть Ollama, щоб змінна підхопилась
```

**Ціна цього**: Ollama не має автентифікації взагалі, і тепер вона відповідає
всім у локальній мережі. Закрийте 11434 у брандмауері macOS (System Settings →
Network → Firewall → Options → додайте `ollama` і заборонте вхідні), або
переконайтесь, що мережа, в якій стоїть машина, вам справді підконтрольна.

### Запуск

```bash
cp .env.example .env
# заповніть POSTGRES_PASSWORD і APP_BASE_URL

docker compose -f docker-compose.prod.yml -f docker-compose.mac.yml up -d db app
docker compose -f docker-compose.prod.yml -f docker-compose.mac.yml exec app npx prisma migrate deploy
docker compose -f docker-compose.prod.yml -f docker-compose.mac.yml exec app npx tsx scripts/setup-sources.ts
```

**`db app` наприкінці обов'язкові.** Накладка не вміє видаляти сервіс, тож без
переліку піднявся б і `ollama` — контейнер, який слухає той самий порт усередині
мережі compose і рахує на CPU. Симптом був би не помилкою, а просто повільною
системою.

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

**Рекомендація: на цій машині FileVault вимкнути**, увімкнути автоматичний вхід
(System Settings → Users & Groups → Automatically log in as), а Docker Desktop
поставити в елементи входу. Тоді після відновлення живлення все піднімається
саме, а `restart: unless-stopped` у compose доробить решту.

Ціна цього — незашифрований диск на машині, де лежать статути організацій. Тому:

- машина стоїть у приміщенні, до якого є фізичний контроль;
- **резервні копії шифруються** (розділ 7), бо саме вони їздять назовні.

Якщо фізичного контролю немає — лишайте FileVault і змиріться, що після кожного
блекауту сервіс піднімає людина.

```bash
fdesetup status    # перевірте, що стан саме той, який ви обрали
```

## 5. Домен

Спершу з'ясуйте, чи маєте справжню публічну адресу: порівняйте WAN-IP у роутері з
`curl ifconfig.me`. Різні — у вас CGNAT, і проброс портів неможливий.

### Cloudflare Tunnel

```bash
cloudflared tunnel login
cloudflared tunnel create hrantoid
cloudflared tunnel route dns hrantoid grants.example.org
```

`~/.cloudflared/config.yml`:

```yaml
tunnel: hrantoid
credentials-file: /Users/<ви>/.cloudflared/<UUID>.json

ingress:
  - hostname: grants.example.org
    service: http://127.0.0.1:3000
  - service: http_status:404
```

```bash
sudo cloudflared service install    # стартує сам після перезавантаження
```

Порти відкривати не треба взагалі: тунель іде назовні. Сертифікат теж не ваш
клопіт.

**Що варто розуміти**: TLS термінується в Cloudflare, тобто вони бачать трафік у
відкритому вигляді, включно із завантаженими статутами. D1 це формально не
порушує — обіцянка стосується того, що документи не йдуть до чужого AI-сервісу.
Але продукт, чия центральна обіцянка — приватність документів, мав би сказати про
це в `/pryvatnist`, а не змовчати.

Якщо публічна адреса все-таки є — проброс 80/443 і Caddy з `docs/OVHCLOUD.md`
розділ 6, і між вами та користувачем немає нікого.

### APP_BASE_URL

```
APP_BASE_URL=https://grants.example.org
```

З цього будується кожне посилання в щотижневому листі, зокрема відписка.

## 6. Розклад

macOS має cron, але рідний спосіб — launchd. Створіть
`/Library/LaunchDaemons/org.hrantoid.nightly.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>org.hrantoid.nightly</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/sh</string>
    <string>-c</string>
    <string>cd /opt/grant-assistant &amp;&amp; /usr/local/bin/docker compose -f docker-compose.prod.yml -f docker-compose.mac.yml exec -T app npm run nightly</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict><key>Hour</key><integer>4</integer><key>Minute</key><integer>0</integer></dict>
  <key>StandardOutPath</key><string>/var/log/hrantoid-nightly.log</string>
  <key>StandardErrorPath</key><string>/var/log/hrantoid-nightly.log</string>
</dict>
</plist>
```

```bash
sudo launchctl load /Library/LaunchDaemons/org.hrantoid.nightly.plist
```

Другий такий самий для розсилки — `npm run digest`, понеділок о десятій
(`<key>Weekday</key><integer>1</integer>`).

Один рядок `npm run nightly`, а не чотири окремі етапи. Причина в
`docs/DEPLOY.md` розділ 5: порядок етапів обов'язковий, і рознесення їх по
годинах означає вгадувати, скільки триватиме витягування.

## 7. Резервні копії

Ноутбук чи mini — байдуже: копія на тому самому диску не є копією. Диск помирає
цілком.

```bash
docker compose -f docker-compose.prod.yml -f docker-compose.mac.yml exec -T db \
  pg_dump -U grant grant_assistant | gzip > /Volumes/backup/db-$(date +%F).sql.gz

docker run --rm -v grant-assistant_storage:/data -v /Volumes/backup:/backup \
  alpine tar czf /backup/storage-$(date +%F).tar.gz -C /data .
```

Обидві разом, третім launchd-завданням. База без файлів — це посилання на
документи, які не завантажуються; файли без бази — набір файлів без доступу.

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

## 9. Перевірка, що воно справді працює

```bash
npm run preflight        # має бути зелений на сервері, на відміну від машини розробки
```

І окремо — те, чого жоден скрипт не перевірить:

- [ ] `sudo reboot`, і за п'ять хвилин сайт відповідає **без вашої участі**
- [ ] витягнути шнур із розетки, вставити назад — те саме
- [ ] `ollama run qwen3:4b --verbose` під навантаженням не скидає швидкість утричі
- [ ] нічний прогін відпрацював повний цикл, у `/var/log/hrantoid-nightly.log` немає помилок
- [ ] резервна копія **відновлена** на порожню базу хоча б раз
- [ ] 11434 недоступний з іншої машини в мережі

Перший пункт — головний. Усе інше в цьому документі існує заради нього.
