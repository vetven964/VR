# 📡 Forex Signal → Telegram Bot Dashboard

Web App សម្រាប់វាយបញ្ចូល Forex Trading Signal លើ Dashboard រួចផ្ញើទៅ Telegram Channel/Group ដោយស្វ័យប្រវត្តិ។

---

## ជំហានទី ១៖ បង្កើត Telegram Bot

1. បើក Telegram រួចស្វែងរក **@BotFather**
2. វាយ `/newbot` រួចដាក់ឈ្មោះ Bot តាមចង់បាន
3. BotFather នឹងឲ្យ **Token** មួយមកវិញ (ឧទាហរណ៍ `123456789:AAExample...`) — ចម្លងទុក
4. បង្កើត Telegram **Channel** ឬ **Group** ថ្មី ដែលចង់ផ្ញើ Signal ទៅ
5. បន្ថែម Bot របស់បងជា **Admin** នៅក្នុង Channel/Group នោះ
6. រកយក **Chat ID**៖
   - ងាយបំផុត៖ បន្ថែម bot `@userinfobot` ចូល Channel/Group បណ្ដោះអាសន្ន ហើយវានឹងបង្ហាញ Chat ID (ជាធម្មតាចាប់ផ្ដើមដោយ `-100`)
   - ឬចូល `https://api.telegram.org/bot<TOKEN>/getUpdates` ក្រោយពីផ្ញើសារណាមួយក្នុង Channel

---

## ជំហានទី ១.៥៖ (ស្រេចចិត្ត) បើចង់ប្រើ Auto-Scan FVG

មុខងារនេះស្កេនរកតម្លៃទីផ្សារ Forex ដោយស្វ័យប្រវត្តិ ហើយផ្ញើ Signal ទៅ Telegram ភ្លាមៗពេលរកឃើញ **FVG (Fair Value Gap)** ថ្មី — មិនចាំបាច់វាយបញ្ចូលដោយដៃទៀត។

1. ចូល [twelvedata.com](https://twelvedata.com) → Sign up (ឥតគិតថ្លៃ គ្មានត្រូវការ Card)
2. ចម្លង **API Key** ដាក់ក្នុង `.env` field `TWELVEDATA_API_KEY`
3. Free tier អនុញ្ញាត ៨ requests/នាទី, ៨០០/ថ្ងៃ — ដូច្នេះកុំដាក់ Pair ច្រើនពេក ឬចន្លោះពេលខ្លីពេក (Timeframe 15min-1h ជាមួយ Pair ២-៤ គ្រប់គ្រាន់)
4. នៅលើ Dashboard មាន Card ថ្មីឈ្មោះ **"🤖 Auto-Scan FVG"**:
   - បិទ/បើក Auto-Scan
   - កំណត់ Pairs (ឧ. `EURUSD, GBPUSD, XAUUSD`)
   - កំណត់ Timeframe និងចន្លោះពេលស្កេន (នាទី)
   - ចុច **"ស្កេនឥឡូវនេះ"** ដើម្បីសាកល្បងភ្លាមៗ

**របៀបកំណត់ FVG:** ប្រើគោលការណ៍ ICT ៣ Candle — Bullish FVG កើតឡើងពេល high របស់ Candle ទី១ ទាបជាង low របស់ Candle ទី៣ (Bearish ដូចគ្នាបញ្ច្រាស)។ Signal ប្រភេទនេះនឹងបង្ហាញស្លាក **AUTO FVG** នៅក្នុងប្រវត្តិ, និងមិនមាន Entry/SL ជាក់លាក់ទេ (ត្រូវពិនិត្យ Gap Zone ដោយខ្លួនឯងមុន Trade)។

---

## ជំហានទី ១.៦៖ (ស្រេចចិត្ត) ចង់បានតម្លៃដូច MT5 Broker បង 100%

លំនាំដើម App ប្រើ **Twelve Data** ជា Data Source ដែលជាទិន្នន័យទីផ្សារទូទៅ — អាចខុសបន្តិចពី Broker MT5 របស់បង (Spread ខុសគ្នា)។ ប្រសិនបើចង់ឲ្យតម្លៃត្រូវគ្នា **100%** ជាមួយ Broker Account ជាក់ស្តែង អាចប្រើ **MetaApi.cloud** ជំនួសវិញ (ឥតគិតថ្លៃសម្រាប់ 1 Account)៖

1. ចូល [app.metaapi.cloud](https://app.metaapi.cloud) → Sign up ឥតគិតថ្លៃ
2. **Add Trading Account** → បំពេញ Login, Password, Server ដូចដែលបងប្រើចូល MT5 (ព័ត៌មានពី Broker របស់បង)
3. រង់ចាំ ១-២នាទីអោយ MetaApi ភ្ជាប់ (Deploy) Cloud Terminal ទៅ Broker Account របស់បង
4. ចម្លង **API Token** (ពី Settings → API Keys) និង **Account ID** (ពីទំព័រ Account) ដាក់ក្នុង `.env`:
   ```
   METAAPI_TOKEN=...
   METAAPI_ACCOUNT_ID=...
   METAAPI_REGION=new-york   (ឬតំបន់ផ្សេងបើមានបង្ហាញនៅ Account page)
   ```
5. នៅ Dashboard → Card "🤖 Auto-Scan FVG" → ប្តូរ **"ប្រភពទិន្នន័យតម្លៃ"** ទៅ **"MT5 Broker តាម MetaApi"**
6. **សំខាន់៖** Pair ដែលបងវាយក្នុង Dashboard (ឧ. `EURUSD`) ត្រូវតែដូចទៅនឹង **ឈ្មោះ Symbol ពិតប្រាកដក្នុង MT5** របស់បង (Broker ខ្លះមាន Suffix ដូចជា `EURUSDm`, `EURUSD.` — ត្រូវពិនិត្យក្នុង Market Watch របស់ MT5 ជាមុន)

**ចំណាំ:** Free tier របស់ MetaApi ផ្តល់សម្រាប់ **1 MT5 Account** តែប៉ុណ្ណោះ — គ្រប់គ្រាន់សម្រាប់ Broker Account មួយ។

---

## ជំហានទី ១.៧៖ (ស្រេចចិត្ត) Gold Futures (CME GC=F) តាម Yahoo Finance

ចង់បន្ថែម **Gold Futures** (ដូចប្រភេទនៅលើ CMEGroup.com) ចូល Dashboard/Telegram ដោយឥតគិតថ្លៃ អាចធ្វើបានតាម Yahoo Finance's public chart API។

⚠️ **សំខាន់៖** នេះជា **Unofficial API** (Yahoo មិនបានផ្តល់ជា Product ផ្លូវការ) — មិនមែនជា Data ផ្លូវការពី CME Group ទេ។ វាអាចឈប់ដំណើរការ ឬត្រូវបាន Block ដោយគ្មានការជូនដំណឹងជាមុន។ សម្រាប់ Data ផ្លូវការ ត្រូវការ License បង់ប្រាក់ពី CME Market Data / DataMine។

**របៀបប្រើ៖**
1. នៅ Card "🤖 Auto-Scan FVG" → Field **Pairs** បន្ថែម `GC=F:yahoo` ខណៈពេលដែល Pair ផ្សេងទៀតនៅតែប្រើប្រភពលំនាំដើម (ឧ. `EURUSD, GBPUSD, GC=F:yahoo`)
2. ការសរសេរ `:yahoo` ខាងក្រោយ Symbol មានន័យថា Pair នោះនឹងប្រើ Yahoo Finance ជំនួសឲ្យប្រភពទិន្នន័យសកលដែលបានកំណត់លើ Dropdown
3. Ticker ផ្សេងទៀតដែលអាចប្រើតាម Yahoo: `SI=F` (Silver), `CL=F` (Crude Oil), `GC=F` (Gold) — ត្រូវប្រើទម្រង់ដូចលើ [finance.yahoo.com](https://finance.yahoo.com) ខ្លួនឯង

---

## ជំហានទី ២៖ Setup នៅលើកុំព្យូទ័រ (សាកល្បង)

```bash
cd telegram-signal-bot
npm install
cp .env.example .env
```

បើក `.env` រួចបំពេញ៖
```
BOT_TOKEN=token_ដែលបានពី_BotFather
CHAT_ID=chat_id_ដែលបានរក
ADMIN_PASSWORD=ពាក្យសម្ងាត់ផ្ទាល់ខ្លួនរបស់បង
```

រត់ server:
```bash
npm start
```

បើក browser ទៅ `http://localhost:3000`

---

## ជំហានទី ៣៖ ដាក់ឲ្យដំណើរការ 24/7 ឥតគិតថ្លៃ

### ជម្រើស A — Railway (ងាយបំផុត)
1. ចូល [railway.app](https://railway.app) → Sign up ដោយ GitHub
2. Push កូដនេះទៅ GitHub repo មួយ
3. Railway → **New Project → Deploy from GitHub repo**
4. នៅ Tab **Variables** បន្ថែម `BOT_TOKEN`, `CHAT_ID`, `ADMIN_PASSWORD`
5. Railway នឹង Deploy ស្វ័យប្រវត្តិ និងឲ្យ URL សាធារណៈមកវិញ
   *(Free tier មាន limit ម៉ោង/ខែ — គ្រប់គ្រាន់សម្រាប់ប្រើផ្ទាល់ខ្លួន)*

### ជម្រើស B — Render
1. ចូល [render.com](https://render.com) → New → **Web Service**
2. ភ្ជាប់ GitHub repo
3. Build Command: `npm install` / Start Command: `npm start`
4. បន្ថែម Environment Variables ដូចខាងលើ
   *(Free tier នឹង Sleep ក្រោយ idle ១៥នាទី — មិនមែន 24/7 ពិតប្រាកដ)*

### ជម្រើស C — Oracle Cloud Free Tier (24/7 ពិតប្រាកដ, គ្មាន Sleep)
1. បង្កើត Always Free VM (Ubuntu) នៅ [oracle.com/cloud/free](https://www.oracle.com/cloud/free/)
2. SSH ចូល VM រួច install Node.js:
   ```bash
   sudo apt update && sudo apt install -y nodejs npm
   ```
3. ចម្លង project ចូល VM (git clone ឬ scp)
4. `npm install` រួច `.env` ដូចខាងលើ
5. ប្រើ **pm2** ដើម្បីឲ្យវារត់ជាប់ស្ថិតបន្ទាប់ពី SSH disconnect៖
   ```bash
   sudo npm install -g pm2
   pm2 start server.js --name signal-bot
   pm2 startup && pm2 save
   ```
6. បើក Port នៅ Oracle Security List (ឧ. 3000) ដើម្បីចូលពី browser បាន

---

## រចនាសម្ព័ន្ធឯកសារ

```
telegram-signal-bot/
├── server.js          ← Backend (Express) — ទទួល Signal + ផ្ញើទៅ Telegram
├── package.json
├── .env.example        ← ចម្លងទៅ .env រួចបំពេញ
├── signals.json         ← បង្កើតដោយស្វ័យប្រវត្តិ (ប្រវត្តិ Signal)
└── public/
    ├── index.html       ← Dashboard UI
    ├── style.css
    └── app.js
```

## សុវត្ថិភាព
- ពាក្យសម្ងាត់ (`ADMIN_PASSWORD`) ការពារកុំឲ្យអ្នកផ្សេងចូលផ្ញើ Signal
- `BOT_TOKEN` និង `CHAT_ID` ស្ថិតនៅក្នុង `.env` ប៉ុណ្ណោះ — កុំដាក់ Public ឬ Push ចូល GitHub ជា Public repo (ដាក់ `.env` ក្នុង `.gitignore`)
- Session token នៅតែមាននៅក្នុង memory server — Restart server = ត្រូវចូល login ម្តងទៀត
