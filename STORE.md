# Store listing metadata

Copy-paste source for the various app store consoles. Character limits are
noted per field. Keep both languages in sync when editing.

> Not committed to the app bundle — this is a reference doc for whoever fills in
> App Store Connect / Google Play Console / Microsoft Partner Center / F-Droid.

---

## App name

- **English:** `ZenWidget`
- **Русский:** `ZenWidget` (бренд не переводим)

Apple title ≤ 30 chars · Google Play title ≤ 30 chars — OK.

---

## Subtitle / short description

Apple subtitle ≤ 30 · Google Play short description ≤ 80 · F-Droid summary ≤ 80.

- **EN (short, ≤30):** `Tiny calm games for breaks`
- **EN (≤80):** `A floating widget with 20 relaxing mini-games. No timers, no scores, no ads.`
- **RU (short, ≤30):** `Спокойные мини-паузы`
- **RU (≤80):** `Плавающий виджет с 20 расслабляющими мини-играми. Без таймеров, очков и рекламы.`

---

## Promotional text (Apple, ≤170, editable without re-review)

- **EN:** `Pop bubbles, rake sand, watch a lava lamp, then get back to work. 20 calm mini-games that ask nothing of you — no goals, no streaks, no notifications.`
- **RU:** `Лопни пузыри, разровняй песок, посмотри на лавовую лампу — и вернись к делам. 20 спокойных мини-игр, которые ничего не требуют: ни целей, ни серий, ни уведомлений.`

---

## Full description (≤4000 Apple/Google)

### English

```
ZenWidget is a small floating window with a collection of 20 relaxing
mini-games. It's built for the 30-second breaks during work or study — not for
gaming sessions.

No timers. No game over. No scores. Nothing to win or lose. Just something calm
to do with your hands for a moment, then back to what you were doing.

THE GAMES
• Bubbles — tap to pop, they refill in a wave
• Clouds — drag and throw them across the sky
• Sand — classic falling-sand you draw with your finger
• Zen Garden — rake patterns around stones
• Water — ripples and fish that flee from splashes
• Fireflies — they scatter from your cursor
• Pendulum Wave — nine pendulums, hypnotic patterns
• Campfire — feed logs to the fire, keep it alive
• Holo Paper — brush over paper to reveal hidden colours
• Newton's Cradle — pull a ball, watch momentum travel
• Metronome — a real mechanical tick, slide to change tempo
• Lava Lamp — drag the blobs around
• Aurora — northern lights that react to touch
• Ink — a drop spreading in water
• Aquarium — drop food, watch the fish chase it
• Leaves — falling, blow them with your cursor
• Snow Globe — shake it; you can even load your own photo
• Tetris — no score, no game over, just blocks
• Snake — place food, it finds its own path
• Generator — crank a handle, light a bulb, drive a train

Six games have gentle procedural sound generated on the fly — a mute button is
always one tap away.

PRIVACY
ZenWidget collects nothing, sends nothing, stores nothing. No account, no
analytics, no ads, no network access. It works fully offline.

Free. Open source. No ads, ever.
```

### Русский

```
ZenWidget — это маленькое плавающее окно с коллекцией из 20 расслабляющих
мини-игр. Сделано для 30-секундных пауз во время работы или учёбы, а не для
игровых сессий.

Без таймеров. Без game over. Без очков. Ничего не выиграть и не проиграть.
Просто спокойное занятие для рук на минуту — и обратно к делам.

ИГРЫ
• Пузыри — тыкаешь, лопаются волной
• Облака — таскаешь и бросаешь по небу
• Песок — классический falling-sand, рисуешь пальцем
• Сад камней — разравниваешь узоры вокруг камней
• Вода — волны и рыбы, убегающие от всплеска
• Светлячки — разлетаются от курсора
• Маятник-волна — девять маятников, гипнотический рисунок
• Костёр — подкладываешь брёвна, поддерживаешь огонь
• Голо-бумага — кисть проявляет скрытые цвета
• Колыбель Ньютона — тянешь шар, смотришь как идёт импульс
• Метроном — настоящий механический тик, грузик меняет темп
• Лавовая лампа — таскаешь пузыри
• Северное сияние — ленты реагируют на касание
• Чернила — капля растекается в воде
• Аквариум — бросаешь корм, рыбы за ним плывут
• Листья — падают, можно сдувать курсором
• Снежный шар — трясёшь; можно загрузить своё фото
• Тетрис — без очков, без game over, просто блоки
• Змейка — ставишь еду, сама находит путь
• Генератор — крутишь ручку, лампочка горит, поезд едет

В шести играх есть мягкий процедурный звук, генерируемый на лету — кнопка
отключения всегда под рукой.

КОНФИДЕНЦИАЛЬНОСТЬ
ZenWidget ничего не собирает, не отправляет и не хранит. Нет аккаунта,
аналитики, рекламы и доступа в сеть. Работает полностью офлайн.

Бесплатно. Открытый код. Без рекламы — навсегда.
```

---

## Keywords (Apple, ≤100 chars total, comma-separated)

- **EN:** `relax,calm,fidget,bubbles,zen,break,mini games,sand,lava lamp,stress,focus,offline`
- **RU:** `релакс,спокойствие,антистресс,пузыри,дзен,пауза,мини игры,песок,фокус,офлайн`

---

## Category

- **Primary:** Games → Casual (or Entertainment, if you prefer it positioned away from "real" games)
- **Secondary (Apple allows one):** Lifestyle
- **Google Play:** Casual, or Health & Fitness if leaning into the "micro-break / calm" angle

---

## Age rating

- **Apple:** 4+
- **Google Play (IARC):** Everyone / PEGI 3 — no objectionable content, no ads, no data collection
- **Microsoft Store:** All ages

---

## Privacy / data declarations

- **Apple "App Privacy":** _Data Not Collected_ — tick nothing.
- **Google Play "Data safety":** No data collected, no data shared.
- **Privacy policy URL:** point to the raw `PRIVACY.md` in the repo, e.g.
  `https://github.com/i1sme/swiper/blob/main/PRIVACY.md`
  (a hosted GitHub Pages URL also works and looks cleaner).

---

## Assets still needed (cannot be generated from code)

These are the remaining blockers before any store submission — they need a
design pass:

- [ ] **App icon 1024×1024 PNG** (no alpha for Apple). Current max is 256×256.
- [ ] **Screenshots** per platform:
  - Apple: iPhone 6.7" (1290×2796) + 6.5" + iPad 12.9" (2048×2732) + Mac (1280×800)
  - Google Play: phone (min 1080px) + feature graphic 1024×500
  - Microsoft: 1366×768
  - 5–6 games each, in different states.
- [ ] (Optional) a 15–30s preview video — boosts conversion but not required.

Generate mobile icons from the 1024 source via `@capacitor/assets`:

```bash
npm install --save-dev @capacitor/assets
# put the 1024×1024 in resources/icon.png
npx capacitor-assets generate
```
